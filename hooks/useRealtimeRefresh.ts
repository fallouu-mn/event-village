'use client';

import { useEffect, useRef, useState } from 'react';
import type {
    RealtimeChannel,
    RealtimePostgresChangesFilter,
    RealtimePostgresChangesPayload,
} from '@supabase/supabase-js';
import { getBrowserClient } from '@/lib/supabase/client';

/**
 * Lot 5 (tâche 5.13, contrat O3) — hook partagé du temps réel : signal, puis rechargement serveur.
 *
 *  - Abonnement postgres_changes aux tables demandées (publication supabase_realtime, RLS de chaque table).
 *  - Aucune donnée n'est lue dans la charge reçue : chaque message ne fait que déclencher `onSignal`
 *    (rechargement par la route serveur), après un anti-rebond de 300 ms qui regroupe les rafales.
 *  - `onSignal` est aussi appelé à chaque (re)connexion (état SUBSCRIBED) : Realtime ne rejoue pas les
 *    changements manqués pendant une coupure, ni ceux survenus entre le premier chargement et l'abonnement.
 *  - États suivis : 'connecting' (abonnement en cours ou désactivé), 'live' (SUBSCRIBED), 'offline'
 *    (CHANNEL_ERROR, TIMED_OUT, CLOSED, ou navigateur hors ligne).
 *  - Le nom du canal est unique par montage (`${channelKey}:${n}`) : realtime-js renvoie le canal existant
 *    quand un nom est déjà pris, et le démontage d'un composant couperait alors celui d'un autre.
 *  - Au démontage : temporisation annulée, écouteurs retirés, removeChannel.
 */

export type RealtimeStatus = 'live' | 'connecting' | 'offline';
export type RealtimeChangeEvent = 'INSERT' | 'UPDATE' | 'DELETE' | '*';

export interface RealtimeSubscription {
    /** Table du schéma public, présente dans la publication supabase_realtime. */
    table: string;
    /** Filtre postgres_changes, par exemple `event_id=eq.${eventId}`. */
    filter?: string;
    /** Type de changement écouté (défaut : '*'). */
    event?: RealtimeChangeEvent;
}

export interface UseRealtimeRefreshOptions {
    /** Préfixe stable du nom de canal (par exemple `pilotage-entrees-${eventId}`). */
    channelKey: string;
    subscriptions: RealtimeSubscription[];
    /** Rechargement des données par le serveur ; ses erreurs sont journalisées, jamais avalées. */
    onSignal: () => void | Promise<void>;
    /** Faux tant que l'écran n'a pas ce qu'il faut pour s'abonner (session, identifiant). Défaut : vrai. */
    enabled?: boolean;
}

export interface UseRealtimeRefreshResult {
    status: RealtimeStatus;
}

const DEBOUNCE_MS = 300;

let mountSequence = 0;

export function useRealtimeRefresh({
    channelKey,
    subscriptions,
    onSignal,
    enabled = true,
}: UseRealtimeRefreshOptions): UseRealtimeRefreshResult {
    const [status, setStatus] = useState<RealtimeStatus>('connecting');
    const signalRef = useRef(onSignal);

    useEffect(() => {
        signalRef.current = onSignal;
    }, [onSignal]);

    // Clé stable des abonnements : l'effet ne se rejoue que si les tables, filtres ou types changent.
    const subscriptionsKey = JSON.stringify(
        subscriptions.map((s) => [s.table, s.event ?? '*', s.filter ?? null] as [string, RealtimeChangeEvent, string | null]),
    );

    useEffect(() => {
        if (!enabled) {
            setStatus('connecting');
            return;
        }
        const bindings = JSON.parse(subscriptionsKey) as Array<[string, RealtimeChangeEvent, string | null]>;
        if (bindings.length === 0) {
            setStatus('connecting');
            return;
        }

        let disposed = false;
        let debounceTimer: ReturnType<typeof setTimeout> | null = null;

        const runSignal = () => {
            if (disposed) return;
            Promise.resolve()
                .then(() => signalRef.current())
                .catch((err: unknown) => {
                    console.error(`[useRealtimeRefresh] ${channelKey} : rechargement en échec`, err);
                });
        };

        const scheduleSignal = () => {
            if (debounceTimer) clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                debounceTimer = null;
                runSignal();
            }, DEBOUNCE_MS);
        };

        const supabase = getBrowserClient();
        mountSequence += 1;
        let channel: RealtimeChannel = supabase.channel(`${channelKey}:${mountSequence}`);
        for (const [table, event, filter] of bindings) {
            const spec: RealtimePostgresChangesFilter<RealtimeChangeEvent> = { event, schema: 'public', table };
            if (filter) spec.filter = filter;
            channel = channel.on(
                'postgres_changes',
                spec,
                (_payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => scheduleSignal(),
            );
        }

        setStatus('connecting');
        channel.subscribe((state, err) => {
            if (disposed) return;
            if (state === 'SUBSCRIBED') {
                setStatus('live');
                // Connexion ou reconnexion : les changements manqués ne sont pas rejoués, on recharge.
                runSignal();
                return;
            }
            if (state === 'CHANNEL_ERROR' || state === 'TIMED_OUT' || state === 'CLOSED') {
                setStatus('offline');
                if (err) console.warn(`[useRealtimeRefresh] ${channelKey} : ${state}`, err.message);
            }
        });

        const handleOffline = () => {
            if (!disposed) setStatus('offline');
        };
        window.addEventListener('offline', handleOffline);

        return () => {
            disposed = true;
            if (debounceTimer) clearTimeout(debounceTimer);
            window.removeEventListener('offline', handleOffline);
            void supabase.removeChannel(channel).catch((removeErr: unknown) => {
                console.warn(`[useRealtimeRefresh] ${channelKey} : fermeture du canal en échec`, removeErr);
            });
        };
    }, [channelKey, subscriptionsKey, enabled]);

    return { status };
}

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchJson } from './fetch-json';

export interface ServerData<T> {
    data: T | null;
    /** Erreur du dernier chargement (message français), null sinon. */
    error: string | null;
    /** Premier chargement (aucune donnée encore) : squelette. */
    loading: boolean;
    /** Rechargement en arrière-plan (signal temps réel, bouton Actualiser) : les données restent affichées. */
    refreshing: boolean;
    /** Heure de la dernière lecture réussie, null avant la première (et au changement d'URL). */
    updatedAt: Date | null;
    reload: () => Promise<void>;
}

/**
 * Lecture d'une route serveur (seule source des chiffres) : chargement initial, rechargement silencieux à
 * chaque `signal` (temps réel), « Réessayer ». Une réponse arrivée après une plus récente est ignorée.
 * `url` null : rien n'est chargé (identifiant pas encore connu).
 */
export function useServerData<T>(url: string | null, signal = 0): ServerData<T> {
    const [data, setData] = useState<T | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState<boolean>(url !== null);
    const [refreshing, setRefreshing] = useState(false);
    const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
    const seq = useRef(0);
    const hasData = useRef(false);

    const load = useCallback(async (silent: boolean) => {
        if (!url) return;
        const mine = ++seq.current;
        if (silent && hasData.current) setRefreshing(true);
        else setLoading(true);
        try {
            const body = await fetchJson<T>(url);
            if (mine !== seq.current) return;
            hasData.current = true;
            setData(body);
            setUpdatedAt(new Date());
            setError(null);
        } catch (err) {
            if (mine !== seq.current) return;
            console.error(`[useServerData] ${url}`, err);
            setError(err instanceof Error && err.message ? err.message : 'Lecture impossible pour le moment.');
        } finally {
            if (mine === seq.current) {
                setLoading(false);
                setRefreshing(false);
            }
        }
    }, [url]);

    useEffect(() => {
        hasData.current = false;
        setData(null);
        setUpdatedAt(null);
        setError(null);
        void load(false);
    }, [load]);

    // Signal temps réel : rechargement silencieux (seulement quand le signal change, pas au montage)
    const lastSignal = useRef(signal);
    useEffect(() => {
        if (lastSignal.current === signal) return;
        lastSignal.current = signal;
        void load(true);
    }, [signal, load]);

    const reload = useCallback(() => load(true), [load]);

    return { data, error, loading, refreshing, updatedAt, reload };
}

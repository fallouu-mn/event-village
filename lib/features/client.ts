'use client';

/**
 * Lot 7 (7.3, contrat 3.4, D55) — interrupteurs des services lus par le navigateur (GET /api/features).
 *
 * useFeatureFlags() renvoie null tant que la réponse n'est pas arrivée (ou si elle a échoué) : les entrées de
 * navigation des services restent masquées, aucune entrée n'apparaît puis ne disparaît. Une seule requête par
 * chargement de page : la promesse est partagée par tous les composants (module). Un échec est journalisé et
 * laisse la valeur à null (services masqués) ; la requête est retentée au prochain montage d'un composant.
 * Les valeurs ne sont qu'un confort d'affichage : chaque page et chaque route contrôle elle-même son
 * interrupteur côté serveur (404 si fermé).
 * Hors ligne (navigator.onLine faux, par exemple sur la page du billet hors ligne servie par le service worker),
 * aucune requête n'est tentée : les services restent masqués et la lecture part au retour du réseau (« online »).
 */
import { useEffect, useState } from 'react';

export interface ClientFeatureFlags {
    halls: boolean;
    tables: boolean;
    orders: boolean;
}

let shared: Promise<ClientFeatureFlags> | null = null;
let resolved: ClientFeatureFlags | null = null;

function parseFlags(body: unknown): ClientFeatureFlags {
    const b = (body ?? {}) as Record<string, unknown>;
    if (typeof b.halls !== 'boolean' || typeof b.tables !== 'boolean' || typeof b.orders !== 'boolean') {
        throw new Error(`réponse inattendue de /api/features : ${JSON.stringify(body).slice(0, 200)}`);
    }
    return { halls: b.halls, tables: b.tables, orders: b.orders };
}

/** Lecture unique (par chargement de page) de GET /api/features. */
export function loadFeatureFlags(): Promise<ClientFeatureFlags> {
    if (!shared) {
        shared = fetch('/api/features', { cache: 'no-store', credentials: 'same-origin' })
            .then(async (res) => {
                if (!res.ok) throw new Error(`/api/features : HTTP ${res.status}`);
                const flags = parseFlags(await res.json());
                resolved = flags;
                return flags;
            })
            .catch((err: unknown) => {
                shared = null; // nouvel essai au prochain montage
                throw err;
            });
    }
    return shared;
}

/** Interrupteurs des services, ou null tant qu'ils ne sont pas lus. */
export function useFeatureFlags(): ClientFeatureFlags | null {
    const [flags, setFlags] = useState<ClientFeatureFlags | null>(resolved);
    useEffect(() => {
        if (resolved) {
            setFlags(resolved);
            return;
        }
        let alive = true;
        const load = () => {
            loadFeatureFlags()
                .then((f) => {
                    if (alive) setFlags(f);
                })
                .catch((err: unknown) => {
                    console.error('[features] lecture des interrupteurs impossible, services masqués :', err instanceof Error ? err.message : String(err));
                });
        };
        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
            // Hors ligne : pas de requête vouée à l'échec ; lecture au retour du réseau.
            const onOnline = () => {
                window.removeEventListener('online', onOnline);
                if (alive) load();
            };
            window.addEventListener('online', onOnline);
            return () => {
                alive = false;
                window.removeEventListener('online', onOnline);
            };
        }
        load();
        return () => {
            alive = false;
        };
    }, []);
    return flags;
}

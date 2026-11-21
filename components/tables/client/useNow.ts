'use client';

/**
 * Lot 11b (écrans du client) : heure courante pour les comptes à rebours, relue toutes les `intervalMs` millisecondes.
 * null avant le premier affichage dans le navigateur (le rendu du serveur ne montre pas de délai qui serait faux à
 * l'arrivée) ; relue aussi au retour sur l'onglet. Un seul minuteur par composant, arrêté au démontage.
 */
import { useEffect, useState } from 'react';

export function useNow(intervalMs: number): number | null {
    const [now, setNow] = useState<number | null>(null);
    useEffect(() => {
        setNow(Date.now());
        const timer = window.setInterval(() => setNow(Date.now()), intervalMs);
        const onVisible = () => {
            if (document.visibilityState === 'visible') setNow(Date.now());
        };
        document.addEventListener('visibilitychange', onVisible);
        return () => {
            window.clearInterval(timer);
            document.removeEventListener('visibilitychange', onVisible);
        };
    }, [intervalMs]);
    return now;
}

/** Millisecondes restantes jusqu'à `iso` (null si inconnu ou pas encore monté). */
export function msUntil(iso: string | null | undefined, now: number | null): number | null {
    if (!iso || now === null) return null;
    const t = Date.parse(iso);
    return Number.isNaN(t) ? null : t - now;
}

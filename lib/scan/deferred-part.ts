'use client';

/**
 * Lot 7, tâche 7.5 — parties du scanner chargées à la demande et préchargées (caméra, résultat plein écran, caisse).
 *
 * Pourquoi : ces composants ne servent pas au premier affichage (écran « Commencer le contrôle ») ; les sortir du
 * premier chargement allège /controller/scanner (budget de poids, scripts/js-budget.json). Ils sont préchargés dès
 * le montage de la page, donc avant le départ du contrôle et avant le premier scan.
 *
 * Pourquoi pas next/dynamic : React.lazy suspend au moins une fois au premier rendu, même quand le module est déjà
 * là ; le plein écran du verdict serait alors précédé d'un rendu de repli. Ici, une fois la partie chargée, le
 * composant est rendu tout de suite, sans suspension (useDeferredPart rend le composant lui-même, ou null tant
 * qu'il n'est pas arrivé : la page affiche alors un repli neutre, jamais un verdict).
 *
 * Réseau instable : un chargement en échec est journalisé puis retenté (au retour du réseau, sinon après 1 à 5 s),
 * sans fin et sans jamais lever d'erreur dans la page (webpack retente le fichier qui a échoué).
 */
import { useEffect, useState } from 'react';

export interface DeferredPart<T> {
    /** Lance le chargement (une seule fois) ; la promesse ne rejette jamais. */
    preload: () => Promise<T>;
    /** La partie si elle est déjà chargée, sinon null. */
    current: () => T | null;
}

export function deferredPart<T>(label: string, load: () => Promise<T>): DeferredPart<T> {
    let value: T | null = null;
    let pending: Promise<T> | null = null;
    const preload = (): Promise<T> => {
        pending ??= new Promise<T>((resolve) => {
            const attempt = (n: number): void => {
                load().then((v) => {
                    value = v;
                    resolve(v);
                }, (err: unknown) => {
                    console.warn(`[scanner] ${label} non chargé (essai ${n}) : nouvel essai`, err instanceof Error ? err.message : String(err));
                    const again = () => attempt(n + 1);
                    if (navigator.onLine === false) window.addEventListener('online', again, { once: true });
                    else setTimeout(again, Math.min(1000 * n, 5000));
                });
            };
            attempt(1);
        });
        return pending;
    };
    return { preload, current: () => value };
}

/**
 * Précharge la partie et la rend dès qu'elle est là (tout de suite si elle l'est déjà).
 * Lot 9 ter (passe du run 133) : `start` retarde le préchargement jusqu'à ce que la page ait rendu son premier
 * affichage utile (écran de départ du scanner), pour que ces morceaux n'entrent pas dans le JavaScript chargé avant
 * lui (e2e/perf.spec.ts, JS (a)) ; ils restent chargés bien avant le premier scan. Sans `start`, préchargement au montage.
 */
export function useDeferredPart<T>(part: DeferredPart<T>, start = true): T | null {
    // Fonction rangée par un « updater » : un composant est une fonction, il ne doit pas être appelé par setState
    const [value, setValue] = useState<T | null>(part.current);
    useEffect(() => {
        if (!start) return undefined;
        let alive = true;
        void part.preload().then((v) => {
            if (alive) setValue(() => v);
        });
        return () => { alive = false; };
    }, [part, start]);
    return value;
}

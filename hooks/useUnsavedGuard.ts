'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Lot 9 ter (consigne 0.8, R93 ; contrat B.5 point 7) — garde avant de quitter un écran avec des modifications non
 * enregistrées.
 *  - Fermeture ou rechargement de l'onglet : avertissement natif du navigateur (`beforeunload`) tant que `dirty`.
 *  - Lien interne (même origine, sans nouvel onglet ni téléchargement, sans touche de modification, bouton principal,
 *    hors ancre « # ») : le clic est arrêté en capture sur le document, la fenêtre de confirmation s'ouvre avec la
 *    liste rendue par `describe()` ; `leave()` lève la garde puis suit le lien, `stay()` ferme la fenêtre.
 *  - `guard(proceed)` : même fenêtre avant une action de l'écran qui perdrait les saisies (rechargement).
 * Limite connue : le bouton « Précédent » du navigateur (popstate) n'est pas intercepté.
 * Aucun rendu ici : la fenêtre (ConfirmDialog) est rendue par l'écran.
 */
export interface UnsavedGuard {
    /** La fenêtre de confirmation est ouverte. */
    open: boolean;
    /** Ce qui serait perdu (libellés rendus par describe au moment du clic). */
    items: string[];
    stay(): void;
    leave(): void;
    guard(proceed: () => void): void;
}

interface Pending {
    items: string[];
    run: () => void;
}

export function useUnsavedGuard(dirty: boolean, describe: () => string[]): UnsavedGuard {
    const router = useRouter();
    const [pending, setPending] = useState(null as Pending | null);
    const dirtyRef = useRef(dirty);
    const describeRef = useRef(describe);
    /** Vrai une fois « Quitter sans enregistrer » choisi : la navigation qui suit n'est plus arrêtée. */
    const released = useRef(false);

    const pendingRef = useRef(null as Pending | null);

    useEffect(() => {
        dirtyRef.current = dirty;
        describeRef.current = describe;
        pendingRef.current = pending;
    });

    useEffect(() => {
        if (!dirty) return undefined;
        const onBeforeUnload = (e: BeforeUnloadEvent) => {
            if (released.current) return;
            e.preventDefault();
            e.returnValue = '';
        };
        window.addEventListener('beforeunload', onBeforeUnload);
        return () => window.removeEventListener('beforeunload', onBeforeUnload);
    }, [dirty]);

    useEffect(() => {
        if (!dirty) return undefined;
        const onClick = (e: MouseEvent) => {
            if (released.current || e.defaultPrevented || e.button !== 0) return;
            if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
            const link = e.target instanceof Element ? e.target.closest('a[href]') : null;
            if (!(link instanceof HTMLAnchorElement)) return;
            const raw = link.getAttribute('href') ?? '';
            if (raw.startsWith('#') || link.target === '_blank' || link.hasAttribute('download')) return;
            const url = new URL(link.href, window.location.href);
            if (url.origin !== window.location.origin) return;
            e.preventDefault();
            const href = `${url.pathname}${url.search}${url.hash}`;
            setPending({
                items: describeRef.current(),
                run: () => {
                    released.current = true;
                    router.push(href);
                },
            });
        };
        document.addEventListener('click', onClick, true);
        return () => document.removeEventListener('click', onClick, true);
    }, [dirty, router]);

    const stay = useCallback(() => setPending(null), []);

    const leave = useCallback(() => {
        const current = pendingRef.current;
        setPending(null);
        current?.run();
    }, []);

    const guard = useCallback((proceed: () => void) => {
        if (!dirtyRef.current) {
            proceed();
            return;
        }
        setPending({ items: describeRef.current(), run: proceed });
    }, []);

    return { open: pending !== null, items: pending?.items ?? [], stay, leave, guard };
}

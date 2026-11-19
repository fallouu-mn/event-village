'use client';

import { useEffect, useState } from 'react';

type IdleWindow = Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number; cancelIdleCallback?: (id: number) => void };

/**
 * Design 1b (décision du 18/11, temps de blocage de l'accueil et de Mes billets) — vrai une fois la page chargée
 * (événement `load`) puis le téléphone libre (requestIdleCallback, 3 s au plus ; sans lui : 1,5 s). Pour ce qui n'est pas
 * utile au premier écran : abonnement temps réel, sections sous le premier écran. Faux au rendu serveur.
 */
export function usePageSettled(): boolean {
    const [settled, setSettled] = useState(false);
    useEffect(() => {
        if (settled) return undefined;
        const w = window as IdleWindow;
        let idleId: number | null = null;
        let timer: ReturnType<typeof setTimeout> | null = null;
        const go = (): void => setSettled(true);
        const whenIdle = (): void => {
            if (w.requestIdleCallback) idleId = w.requestIdleCallback(go, { timeout: 3_000 });
            else timer = setTimeout(go, 1_500);
        };
        if (document.readyState === 'complete') whenIdle();
        else window.addEventListener('load', whenIdle, { once: true });
        return () => {
            window.removeEventListener('load', whenIdle);
            if (idleId !== null && w.cancelIdleCallback) w.cancelIdleCallback(idleId);
            if (timer) clearTimeout(timer);
        };
    }, [settled]);
    return settled;
}

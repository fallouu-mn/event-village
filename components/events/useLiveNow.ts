'use client';

import { useEffect, useState } from 'react';
import { isLiveAt, nextLiveChange, type LiveWindow } from '@/lib/events/live-status';

/**
 * Design 1b (point 11) — « en cours » calculé sur le téléphone : vrai entre le début et la fin retenue. Une seule minuterie
 * par carte, posée sur le prochain changement (début ou fin) : le badge apparaît et disparaît à la bonne minute, page
 * ouverte. Au rendu serveur (et au premier rendu), faux : rien d'« en cours » n'est figé dans une page en cache.
 */
export function useLiveNow(window: LiveWindow | null): boolean {
    const [live, setLive] = useState(false);
    useEffect(() => {
        if (!window) { setLive(false); return undefined; }
        let timer: ReturnType<typeof setTimeout> | null = null;
        const tick = (): void => {
            const now = new Date();
            setLive(isLiveAt(window, now));
            const next = nextLiveChange(window, now);
            if (!next) return;
            // setTimeout plafonne à ~24,8 jours : au-delà, on revient voir plus tard
            const wait = Math.min(next.getTime() - now.getTime() + 250, 2_000_000_000);
            timer = setTimeout(tick, Math.max(1_000, wait));
        };
        tick();
        const onVisible = (): void => { if (document.visibilityState === 'visible') { if (timer) clearTimeout(timer); tick(); } };
        document.addEventListener('visibilitychange', onVisible);
        return () => { if (timer) clearTimeout(timer); document.removeEventListener('visibilitychange', onVisible); };
    }, [window?.startsAt.getTime(), window?.endsAt.getTime()]); // eslint-disable-line react-hooks/exhaustive-deps
    return live;
}

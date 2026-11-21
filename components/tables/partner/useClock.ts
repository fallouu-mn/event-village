'use client';

/**
 * Lot 11b : horloge légère des écrans de l'établissement, recalée sur l'heure du serveur (écart mesuré à chaque lecture
 * du planning) : comptes à rebours et actions selon l'heure ne dépendent pas de l'horloge du téléphone. Un seul
 * intervalle par écran ; il s'arrête quand l'onglet est caché et reprend (avec une mise à jour immédiate) au retour.
 */
import { useEffect, useState } from 'react';

export function useClock(skewMs: number, everyMs = 1_000): number {
    const [now, setNow] = useState(() => Date.now() + skewMs);

    useEffect(() => {
        let timer: ReturnType<typeof setInterval> | null = null;
        const tick = () => setNow(Date.now() + skewMs);
        const start = () => {
            if (timer !== null) return;
            tick();
            timer = setInterval(tick, everyMs);
        };
        const stop = () => {
            if (timer !== null) clearInterval(timer);
            timer = null;
        };
        const onVisibility = () => (document.visibilityState === 'visible' ? start() : stop());
        start();
        document.addEventListener('visibilitychange', onVisibility);
        return () => {
            stop();
            document.removeEventListener('visibilitychange', onVisibility);
        };
    }, [skewMs, everyMs]);

    return now;
}

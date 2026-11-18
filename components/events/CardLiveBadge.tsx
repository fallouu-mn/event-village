'use client';

import { useEffect } from 'react';
import { isLiveAt, nextLiveChange, liveWindowFromIso } from '@/lib/events/live-status';

/** Attribut posé par EventCard sur le badge « En cours » (rendu masqué par le serveur). */
export const LIVE_BADGE_ATTR = 'data-ev-live';

/**
 * Design 1b (point 11) — badges « En cours » des cartes, calculés sur le téléphone par un SEUL îlot par page : chaque carte
 * porte son badge rendu masqué (`hidden`, instants ISO du début et de la fin retenue dans `data-starts` / `data-ends`) ;
 * cet îlot l'affiche entre le début et la fin, et pose une seule minuterie sur le prochain changement de toutes les cartes
 * (le badge apparaît et disparaît à la bonne minute, page ouverte, malgré le cache de 60 s). Cartes ajoutées plus tard
 * (Explorer, « Près de chez vous ») : relues à chaque ajout. Aucune carte n'hydrate de composant pour son badge (run 376).
 */
export function CardLiveBadges() {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let frame = 0;
    const apply = (): void => {
      frame = 0;
      if (timer) clearTimeout(timer);
      const now = new Date();
      let next: number | null = null;
      document.querySelectorAll<HTMLElement>(`[${LIVE_BADGE_ATTR}]`).forEach((el) => {
        const window = liveWindowFromIso(el.dataset.starts, el.dataset.ends);
        const live = isLiveAt(window, now);
        if (el.hidden === live) el.hidden = !live;
        const change = nextLiveChange(window, now);
        if (change && (next === null || change.getTime() < next)) next = change.getTime();
      });
      if (next !== null) timer = setTimeout(apply, Math.max(1_000, Math.min(next - now.getTime() + 250, 2_000_000_000)));
    };
    const schedule = (): void => { if (!frame) frame = requestAnimationFrame(apply); };
    apply();
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
    const onVisible = (): void => { if (document.visibilityState === 'visible') schedule(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      if (timer) clearTimeout(timer);
      if (frame) cancelAnimationFrame(frame);
      observer.disconnect();
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);
  return null;
}

'use client';

import { useEffect } from 'react';
import { isLiveAt, nextLiveChange, liveWindowFromIso } from '@/lib/events/live-status';
import { watchLiveDots } from '@/lib/ui/live-dots';
import { cardCountdown } from '@/lib/events/countdown';

/** Attribut posé par EventCard sur le badge « En cours » (rendu masqué par le serveur). */
export const LIVE_BADGE_ATTR = 'data-ev-live';

/** Design 1d (point 4) : compte à rebours de la carte (rendu masqué et vide par le serveur, rempli à l'heure du téléphone). */
export const CARD_COUNTDOWN_ATTR = 'data-ev-countdown';

/**
 * Design 1b (point 11) — badges « En cours » des cartes, calculés sur le téléphone par un SEUL îlot par page : chaque carte
 * porte son badge rendu masqué (`hidden`, instants ISO du début et de la fin retenue dans `data-starts` / `data-ends`) ;
 * cet îlot l'affiche entre le début et la fin, et pose une seule minuterie sur le prochain changement de toutes les cartes
 * (le badge apparaît et disparaît à la bonne minute, page ouverte, malgré le cache de 60 s). Cartes ajoutées plus tard
 * (Explorer, « Près de chez vous ») : relues à chaque ajout. Aucune carte n'hydrate de composant pour son badge (run 376).
 * Design 1d (point 4) : la même minuterie remplit le compte à rebours de chaque carte (« Commence dans 2 j 4 h », puis à
 * la minute le dernier jour ; rien à plus de 7 jours ; masqué pendant l'événement, le badge « En cours » le dit déjà).
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
      document.querySelectorAll<HTMLElement>(`[${CARD_COUNTDOWN_ATTR}]`).forEach((el) => {
        const cd = cardCountdown(now.getTime(), el.dataset.starts, el.dataset.ends);
        const text = cd.kind === 'days' || cd.kind === 'clock' ? cd.text : null;
        // Texte posé seulement s'il change : l'observateur ci-dessous ne relance rien pour rien
        if (text === null) {
          if (!el.hidden) el.hidden = true;
        } else {
          if (el.textContent !== text) el.textContent = text;
          if (el.hidden) el.hidden = false;
        }
        if (cd.nextIn !== null) {
          const at = now.getTime() + cd.nextIn;
          if (next === null || at < next) next = at;
        }
      });
      if (next !== null) timer = setTimeout(apply, Math.max(1_000, Math.min(next - now.getTime() + 250, 2_000_000_000)));
    };
    const schedule = (): void => { if (!frame) frame = requestAnimationFrame(apply); };
    apply();
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true });
    const onVisible = (): void => { if (document.visibilityState === 'visible') schedule(); };
    document.addEventListener('visibilitychange', onVisible);
    // Décision du 18/11 : halo des points (3 pulsations) seulement à l'écran (lib/ui/live-dots.ts)
    const stopDots = watchLiveDots();
    return () => {
      stopDots();
      if (timer) clearTimeout(timer);
      if (frame) cancelAnimationFrame(frame);
      observer.disconnect();
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);
  return null;
}

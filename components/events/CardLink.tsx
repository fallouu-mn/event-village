'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/** Temps maximal pendant lequel l'écran reste figé par la transition, en attendant la fiche (jamais bloquant). */
const MAX_FREEZE_MS = 400;

type TransitionDocument = Document & { startViewTransition?: (update: () => Promise<void>) => unknown };

/** Nom de transition partagé par l'affiche de la carte et celle de la fiche (lot FICHE : même nom sur la fiche). */
export function posterTransitionName(id: string): string {
  return `ev-poster-${id}`;
}

/** Attribut posé par EventCard sur le lien de chaque carte (valeur : id de l'événement). */
export const CARD_LINK_ATTR = 'data-ev-card-link';

/**
 * Design 1b (point 4) — transition carte → fiche par l'API View Transitions du navigateur, sans bibliothèque.
 *
 * Un SEUL îlot par page (monté par l'accueil, Explorer, la vitrine) écoute les clics sur les liens des cartes
 * (`a[data-ev-card-link]`, délégation) : aucune carte n'hydrate de composant pour cela (run 376 : l'accueil rend jusqu'à
 * une cinquantaine de cartes, un îlot par carte coûtait le temps de blocage). L'affiche de la carte touchée prend
 * `view-transition-name: ev-poster-<id>` (comme celle de la fiche) au toucher seulement : un même événement peut paraître
 * dans plusieurs rangées, et deux éléments du même nom annuleraient la transition. Seulement quand le navigateur sait le
 * faire et que « réduire les animations » n'est pas demandé ; clic du milieu, Ctrl, Cmd, Maj : comportement normal du
 * lien. L'écran n'est jamais figé plus de 400 ms : si la fiche tarde, la navigation continue sans animation.
 */
export function CardTransitions() {
  const router = useRouter();
  useEffect(() => {
    const onClick = (e: MouseEvent): void => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const link = (e.target as Element | null)?.closest?.<HTMLAnchorElement>(`a[${CARD_LINK_ATTR}]`);
      if (!link) return;
      const doc = document as TransitionDocument;
      if (typeof doc.startViewTransition !== 'function') return;
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      const href = link.getAttribute('href');
      if (!href) return;
      e.preventDefault();
      const id = link.getAttribute(CARD_LINK_ATTR);
      if (id) {
        const name = posterTransitionName(id);
        document.querySelectorAll<HTMLElement>('[data-ev-poster]').forEach((el) => {
          if (el.style.getPropertyValue('view-transition-name') === name) el.style.removeProperty('view-transition-name');
        });
        link.closest('article')?.querySelector<HTMLElement>('[data-ev-poster]')?.style.setProperty('view-transition-name', name);
      }
      const target = new URL(href, window.location.href).pathname;
      try {
        doc.startViewTransition(() => new Promise<void>((resolve) => {
          const started = performance.now();
          router.push(href);
          const check = (): void => {
            if (window.location.pathname === target || performance.now() - started > MAX_FREEZE_MS) resolve();
            else requestAnimationFrame(check);
          };
          requestAnimationFrame(check);
        }));
      } catch {
        router.push(href);
      }
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, [router]);
  return null;
}

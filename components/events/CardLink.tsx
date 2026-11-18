'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

/** Temps maximal pendant lequel l'écran reste figé par la transition, en attendant la fiche (jamais bloquant). */
const MAX_FREEZE_MS = 400;

type TransitionDocument = Document & { startViewTransition?: (update: () => Promise<void>) => unknown };

/** Nom de transition partagé par l'affiche de la carte et celle de la fiche (lot FICHE : même nom sur la fiche). */
export function posterTransitionName(id: string): string {
  return `ev-poster-${id}`;
}

/**
 * Design 1b (point 4) — lien de la carte vers la fiche, avec la transition de vue du navigateur (sans bibliothèque) :
 * l'affiche de la carte et celle de la fiche portent le même `view-transition-name` (`ev-poster-<id>`), le navigateur
 * fait glisser l'une vers l'autre. Le nom est posé au toucher sur l'affiche de la carte touchée seulement : un même
 * événement peut paraître dans plusieurs rangées de l'accueil, et deux éléments du même nom annuleraient la transition.
 * Seulement quand le navigateur sait le faire et que « réduire les animations » n'est pas demandé ; clic du milieu,
 * Ctrl, Cmd, Maj : comportement normal du lien. L'écran n'est jamais figé plus de 400 ms : si la fiche tarde, la
 * navigation continue sans animation. Préchargement de next/link gardé.
 */
export function CardLink({ href, transitionId, className, children }: { href: string; transitionId?: string; className?: string; children: React.ReactNode }) {
  const router = useRouter();

  const onClick = (e: React.MouseEvent<HTMLAnchorElement>): void => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const doc = document as TransitionDocument;
    if (typeof doc.startViewTransition !== 'function') return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    e.preventDefault();
    if (transitionId) {
      const name = posterTransitionName(transitionId);
      document.querySelectorAll<HTMLElement>('[data-ev-poster]').forEach((el) => {
        if (el.style.getPropertyValue('view-transition-name') === name) el.style.removeProperty('view-transition-name');
      });
      const poster = e.currentTarget.closest('article')?.querySelector<HTMLElement>('[data-ev-poster]');
      poster?.style.setProperty('view-transition-name', name);
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

  return (
    <Link href={href} onClick={onClick} className={className}>
      {children}
    </Link>
  );
}

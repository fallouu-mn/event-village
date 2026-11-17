'use client';

import React, { useId, useRef, useState } from 'react';
import { cn } from './cn';

export type SheetState = 'replie' | 'moitie' | 'ouvert';

/**
 * Design 1a (direction.md, section 5) — feuille glissante (carte, liste d'événements sur téléphone).
 *
 * Trois états : repliée (poignée et titre), à mi-hauteur, ouverte. On la fait glisser par la poignée, ET un bouton
 * « Tout afficher » / « Réduire » fait la même chose pour qui ne peut pas glisser (WCAG 2.5.7). Haut arrondi de 20 px,
 * fond `popover`, ombre forte. Hauteur animée en 250 ms (sa hauteur est son état), coupée si « réduire les animations ».
 * Région non modale (la carte reste utilisable derrière) : nommée par son titre.
 */
const HEIGHTS: Record<SheetState, string> = { replie: '5.5rem', moitie: '50vh', ouvert: '88vh' };
const ORDER: SheetState[] = ['replie', 'moitie', 'ouvert'];

export function BottomSheet({
  title,
  children,
  initial = 'moitie',
  className,
}: {
  title: string;
  children: React.ReactNode;
  initial?: SheetState;
  className?: string;
}) {
  const [state, setState] = useState<SheetState>(initial);
  const titleId = useId();
  const startY = useRef<number | null>(null);

  const step = (delta: 1 | -1): void => {
    const i = ORDER.indexOf(state) + delta;
    if (i >= 0 && i < ORDER.length) setState(ORDER[i]);
  };

  return (
    <section
      aria-labelledby={titleId}
      className={cn(
        'fixed inset-x-0 bottom-0 z-40 flex flex-col overflow-hidden rounded-t-[20px] border-t border-border bg-popover shadow-popover',
        'motion-safe:transition-[height] motion-safe:duration-slow motion-safe:ease-out',
        className,
      )}
      style={{ height: HEIGHTS[state] }}
    >
      <div
        className="flex touch-none flex-col items-center pt-2"
        onPointerDown={(e) => { startY.current = e.clientY; }}
        onPointerUp={(e) => {
          if (startY.current === null) return;
          const dy = e.clientY - startY.current;
          startY.current = null;
          if (Math.abs(dy) > 24) step(dy < 0 ? 1 : -1);
        }}
      >
        <span aria-hidden="true" className="h-1.5 w-10 rounded-full bg-input" />
        <div className="flex w-full items-center justify-between gap-3 px-4 pb-2 pt-2">
          <h2 id={titleId} className="truncate text-base font-bold text-foreground-strong">{title}</h2>
          <button
            type="button"
            onClick={() => setState(state === 'ouvert' ? 'replie' : 'ouvert')}
            aria-expanded={state === 'ouvert'}
            className="min-h-11 flex-shrink-0 rounded-lg px-3 text-sm font-semibold text-primary-text hover:bg-primary-soft"
          >
            {state === 'ouvert' ? 'Réduire' : 'Tout afficher'}
          </button>
        </div>
      </div>
      <div className={cn('min-h-0 flex-1 overflow-y-auto px-4 pb-6', state === 'replie' && 'invisible')}>{children}</div>
    </section>
  );
}

'use client';

import React, { useCallback, useEffect, useLayoutEffect, useRef } from 'react';
import { FilterChip } from '@/components/ui/FilterChip';
import { cn } from '@/components/ui/cn';
import { EVENT_CATEGORIES } from '@/lib/constants/event-categories';

const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

/**
 * Design 1d (point 10) — pastilles de catégories d'Explorer qui restent visibles en haut de l'écran (collées sous
 * l'en-tête pendant le défilement), avec un indicateur qui glisse sous la pastille choisie : un seul élément déplacé et
 * étiré par transform (220 ms), jamais en boucle, immobile si « réduire les animations ». La pastille choisie est amenée
 * dans la rangée si elle était hors de vue (défilement de la rangée seulement, jamais de la page). L'état reste dit par
 * aria-pressed et la coche de FilterChip : l'indicateur n'est qu'un repère visuel.
 */
export function CategoryChipsBar({ selected, onSelect }: { selected: string | null; onSelect: (id: string | null) => void }) {
  const rowRef = useRef<HTMLDivElement | null>(null);
  const indicatorRef = useRef<HTMLSpanElement | null>(null);

  const place = useCallback((reveal: boolean) => {
    const row = rowRef.current;
    const indicator = indicatorRef.current;
    if (!row || !indicator) return;
    const active = row.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (!active) {
      indicator.style.opacity = '0';
      return;
    }
    indicator.style.opacity = '1';
    indicator.style.transform = `translate(${active.offsetLeft + 12}px, ${active.offsetTop + active.offsetHeight + 3}px) scaleX(${Math.max(1, active.offsetWidth - 24)})`;
    if (reveal) {
      const left = active.offsetLeft - row.scrollLeft;
      if (left < 0 || left + active.offsetWidth > row.clientWidth) {
        row.scrollTo({ left: Math.max(0, active.offsetLeft - 16), behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
      }
    }
  }, []);

  useIsoLayoutEffect(() => {
    place(true);
  }, [selected, place]);

  useEffect(() => {
    const onResize = (): void => place(false);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [place]);

  return (
    <div className="sticky top-[61px] z-10 -mx-4 border-b border-border bg-background px-4 sm:mx-0 sm:border-0 sm:px-0">
      <div
        ref={rowRef}
        role="group"
        aria-label="Catégorie"
        className="relative flex gap-2 overflow-x-auto pb-2.5 pt-2 no-scrollbar sm:flex-wrap sm:overflow-visible"
      >
        <FilterChip pressed={selected === null} onClick={() => onSelect(null)} className="ev-press">
          Toutes les catégories
        </FilterChip>
        {EVENT_CATEGORIES.map((c) => (
          <FilterChip key={c.id} pressed={selected === c.id} onClick={() => onSelect(selected === c.id ? null : c.id)} className="ev-press">
            {c.label}
          </FilterChip>
        ))}
        <span ref={indicatorRef} aria-hidden="true" className={cn('ev-chip-indicator top-0')} style={{ bottom: 'auto', opacity: 0 }} />
      </div>
    </div>
  );
}

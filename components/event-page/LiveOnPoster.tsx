'use client';

import { useMemo } from 'react';
import { liveLabel, liveWindowFromIso } from '@/lib/events/live-status';
import { useLiveNow } from '@/components/events/useLiveNow';

/**
 * Design 1b (point 11) — « En cours · se termine vers 05:00 » sur l'affiche de la fiche, calculé sur le téléphone entre
 * le début et la fin retenue (useLiveNow : minuterie posée sur le prochain changement). Jamais dans le HTML en cache
 * (faux au rendu serveur). Posé en surimpression sur l'affiche : son apparition ne déplace rien (aucun saut de mise en
 * page). Seulement pour un événement publié ou suspendu (annulé ou terminé : le bandeau de la page le dit).
 */
export function LiveOnPoster({ startsAt, endsAt, enabled }: { startsAt: string; endsAt: string; enabled: boolean }) {
  const window = useMemo(() => (enabled ? liveWindowFromIso(startsAt, endsAt) : null), [enabled, startsAt, endsAt]);
  const live = useLiveNow(window);
  if (!live || !window) return null;
  return (
    <p className="pointer-events-none absolute bottom-3 left-3 inline-flex max-w-[calc(100%-1.5rem)] items-center gap-2 rounded-full bg-black/80 px-3 py-1.5 text-sm font-bold text-white shadow-sm ev-sheet-up">
      <span aria-hidden="true" className="ev-live-dot relative inline-flex h-2 w-2 flex-shrink-0 rounded-full bg-scan-accept-bg" />
      <span className="truncate tabular-nums">{liveLabel(window)}</span>
    </p>
  );
}

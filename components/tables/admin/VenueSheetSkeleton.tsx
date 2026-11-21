/**
 * Lot 11b (administration) : squelette de la fiche de décision d'un établissement, même gabarit que la fiche :
 * en-tête, bloc de décision, photos et colonnes. Partagé par la page et par son loading.tsx.
 */

import React from 'react';
import { Skeleton } from '@/components/ui/Skeleton';

export function VenueSheetSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-label="Chargement de la fiche de l’établissement" className="flex flex-col gap-4">
      <Skeleton className="h-9 w-48" />
      <Skeleton className="h-6 w-56" />
      <Skeleton className="h-9 w-3/4 max-w-xl" />
      <Skeleton className="h-24 w-full rounded-xl" />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-4 lg:col-span-2">
          <Skeleton className="aspect-[16/10] w-full rounded-xl" />
          <Skeleton className="h-48 rounded-xl" />
          <Skeleton className="h-40 rounded-xl" />
        </div>
        <div className="flex min-w-0 flex-col gap-4">
          <Skeleton className="h-56 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-40 rounded-xl" />
        </div>
      </div>
      <span className="sr-only">Chargement…</span>
    </div>
  );
}

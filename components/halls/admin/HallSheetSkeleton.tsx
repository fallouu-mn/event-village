/**
 * Lot 10b (point 4) : squelette de la fiche d'une salle (administration), même gabarit que la fiche :
 * en-tête, bloc de décision, photos et colonnes. Partagé par la page et par son loading.tsx.
 */

import React from 'react';
import { Skeleton } from '@/components/ui/Skeleton';

export function HallSheetSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-label="Chargement de la fiche de la salle" className="flex flex-col gap-4">
      <Skeleton className="h-9 w-40" />
      <Skeleton className="h-6 w-48" />
      <Skeleton className="h-9 w-3/4 max-w-xl" />
      <Skeleton className="h-24 w-full rounded-xl" />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="flex flex-col gap-4 lg:col-span-2">
          <Skeleton className="aspect-[16/10] w-full rounded-xl" />
          <Skeleton className="h-40 rounded-xl" />
        </div>
        <div className="flex flex-col gap-4">
          <Skeleton className="h-56 rounded-xl" />
          <Skeleton className="h-40 rounded-xl" />
        </div>
      </div>
      <span className="sr-only">Chargement…</span>
    </div>
  );
}

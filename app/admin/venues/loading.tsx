/** Lot 11b (administration) : chargement de la file de validation des établissements (titre, recherche, onglets, lignes). */

import { Skeleton } from '@/components/ui/Skeleton';

export default function Loading() {
  return (
    <div role="status" aria-busy="true" aria-label="Chargement des établissements" className="flex flex-col gap-4">
      <Skeleton className="h-9 w-64 rounded-lg" />
      <Skeleton className="h-5 w-full max-w-2xl rounded-md" />
      <Skeleton className="h-12 w-full max-w-md" />
      <div className="flex gap-2 overflow-hidden">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-11 w-36 flex-shrink-0" />
        ))}
      </div>
      <div className="flex flex-col gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 rounded-xl border border-border bg-card p-4">
            <Skeleton className="h-12 w-16 flex-shrink-0 rounded-lg" />
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <Skeleton className="h-5 w-3/4 max-w-sm" />
              <Skeleton className="h-4 w-1/2 max-w-xs" />
            </div>
            <Skeleton className="hidden h-7 w-28 sm:block" />
          </div>
        ))}
      </div>
      <span className="sr-only">Chargement…</span>
    </div>
  );
}

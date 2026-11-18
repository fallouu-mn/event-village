import { Skeleton, StatCardSkeleton } from '@/components/ui/Skeleton';

/** Design 1a (point 7) : squelette du pilotage d'un événement (retour, titre et statut, onglets, indicateurs, panneau). */
export default function Loading() {
  return (
    <div role="status" aria-busy="true" className="space-y-6">
      <Skeleton className="h-5 w-32 rounded-md" />
      <div className="flex flex-wrap items-center gap-3">
        <Skeleton className="h-9 w-64 max-w-full rounded-lg" />
        <Skeleton className="h-7 w-24 rounded-full" />
      </div>
      <div className="flex gap-2 overflow-hidden border-b border-border pb-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-24 flex-shrink-0 rounded-lg" />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>
      <Skeleton className="h-64 w-full rounded-2xl" />
      <span className="sr-only">Chargement…</span>
    </div>
  );
}

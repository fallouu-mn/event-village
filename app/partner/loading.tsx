import { ListRowSkeleton, Skeleton, StatCardSkeleton } from '@/components/ui/Skeleton';

/** Design 1a (point 7) : squelette commun de l'espace partenaire (titre, indicateurs en cartes, liste). */
export default function Loading() {
  return (
    <div role="status" aria-busy="true" className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <Skeleton className="h-9 w-52 rounded-lg" />
        <Skeleton className="h-11 w-36 rounded-xl" />
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>
      <div className="rounded-2xl border border-border bg-card px-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <ListRowSkeleton key={i} />
        ))}
      </div>
      <span className="sr-only">Chargement…</span>
    </div>
  );
}

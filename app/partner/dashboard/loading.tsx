import { Skeleton, StatCardSkeleton, ListRowSkeleton } from '@/components/ui/Skeleton';

/**
 * Squelette du tableau de bord de l'organisatrice (design 1c) : même gabarit que la page (en-tête, quatre indicateurs
 * sur une colonne au téléphone, deux sur tablette, quatre sur ordinateur, puis la liste des événements) pour que rien
 * ne saute à l'arrivée des chiffres.
 */
export default function Loading() {
  return (
    <div role="status" aria-busy="true" className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Skeleton className="h-9 w-52 max-w-full rounded-lg" />
        <Skeleton className="h-11 w-36 rounded-xl" />
      </div>

      {/* Indicateurs */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>

      {/* Événements */}
      <div className="space-y-1 rounded-xl border border-border bg-card px-4 py-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <ListRowSkeleton key={i} />
        ))}
      </div>
      <span className="sr-only">Chargement du tableau de bord…</span>
    </div>
  );
}

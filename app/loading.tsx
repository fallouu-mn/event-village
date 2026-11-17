import { EventCardSkeleton, Skeleton } from '@/components/ui/Skeleton';

/**
 * Design 1a (point 7) : squelette de l'accueil, à la forme de son contenu (maquettes/accueil.html) : rangée « À la une »
 * (première carte plus grande), puces de filtre, grille « Cette semaine ». Repli aussi des routes sans squelette propre.
 */
export default function Loading() {
  return (
    <div role="status" aria-busy="true" className="space-y-6">
      <Skeleton className="h-9 w-56 rounded-lg" />
      <div className="grid gap-4 md:grid-cols-[2fr_1fr_1fr]">
        <Skeleton className="aspect-[16/10] w-full rounded-2xl" />
        <Skeleton className="hidden aspect-[16/10] w-full rounded-2xl md:block" />
        <Skeleton className="hidden aspect-[16/10] w-full rounded-2xl md:block" />
      </div>
      <div className="flex gap-2 overflow-hidden">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-24 flex-shrink-0 rounded-full" />
        ))}
      </div>
      <Skeleton className="h-7 w-40 rounded-lg" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <EventCardSkeleton key={i} />
        ))}
      </div>
      <span className="sr-only">Chargement…</span>
    </div>
  );
}

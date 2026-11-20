import { Skeleton } from '@/components/ui/Skeleton';

/** Squelette de Mes favoris : titre, puis grille de cartes d'affiche (4:5). */
export default function Loading() {
  return (
    <div role="status" aria-busy="true" className="mx-auto max-w-5xl space-y-5 pb-24 lg:pb-12">
      <Skeleton className="h-10 w-48 rounded-2xl" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="aspect-[4/5] w-full rounded-2xl" />
        ))}
      </div>
      <span className="sr-only">Chargement de vos favoris…</span>
    </div>
  );
}

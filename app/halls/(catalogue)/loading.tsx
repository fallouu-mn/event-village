import { EventCardSkeleton, Skeleton } from '@/components/ui/Skeleton';

/** Lot 10b (point 5) : squelette de la recherche des salles (en-tête, formulaire, cartes à la taille des vraies). */
export default function Loading() {
    return (
        <div role="status" aria-busy="true" className="space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-2">
                    <Skeleton className="h-8 w-48 rounded-xl" />
                    <Skeleton className="h-5 w-72 max-w-full rounded-md" />
                </div>
                <Skeleton className="h-11 w-44 rounded-xl" />
            </div>
            <div className="grid gap-4 rounded-xl border border-border bg-card p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-4">
                {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="space-y-2">
                        <Skeleton className="h-4 w-24 rounded-md" />
                        <Skeleton className="h-12 w-full rounded-xl" />
                    </div>
                ))}
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                    <EventCardSkeleton key={i} />
                ))}
            </div>
            <span className="sr-only">Chargement des salles…</span>
        </div>
    );
}

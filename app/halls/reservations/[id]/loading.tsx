import { Skeleton } from '@/components/ui/Skeleton';

/** Lot 10b (point 5) : squelette du détail d'une réservation de salle (en-tête, salle, montants, actions). */
export default function Loading() {
    return (
        <div role="status" aria-busy="true" className="space-y-6">
            <Skeleton className="h-11 w-44 rounded-xl" />
            <div className="space-y-2">
                <Skeleton className="h-6 w-40 rounded-lg" />
                <Skeleton className="h-8 w-2/3 rounded-xl" />
                <Skeleton className="h-5 w-1/2 rounded-md" />
            </div>
            <Skeleton className="h-20 w-full rounded-xl" />
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
                <div className="min-w-0 space-y-6 lg:col-span-2">
                    <div className="space-y-3 rounded-xl border border-border bg-card p-5">
                        <Skeleton className="h-6 w-32 rounded-lg" />
                        <div className="flex gap-4">
                            <Skeleton className="h-20 w-24 flex-shrink-0 rounded-lg sm:h-24 sm:w-32" />
                            <div className="flex-1 space-y-2">
                                <Skeleton className="h-5 w-3/4 rounded-md" />
                                <Skeleton className="h-4 w-1/2 rounded-md" />
                            </div>
                        </div>
                    </div>
                    <div className="space-y-3 rounded-xl border border-border bg-card p-5">
                        <Skeleton className="h-6 w-28 rounded-lg" />
                        {Array.from({ length: 5 }).map((_, i) => (
                            <Skeleton key={i} className="h-5 w-full rounded-md" />
                        ))}
                    </div>
                </div>
                <div className="space-y-3 rounded-xl border border-border bg-card p-5">
                    <Skeleton className="h-12 w-full rounded-full" />
                    <Skeleton className="h-11 w-full rounded-xl" />
                </div>
            </div>
            <span className="sr-only">Chargement de la réservation…</span>
        </div>
    );
}

import { Skeleton } from '@/components/ui/Skeleton';

/** Lot 10b (point 5) : squelette de la fiche d'une salle (galerie 16/10, en-tête, panneau de réservation). */
export default function Loading() {
    return (
        <div role="status" aria-busy="true" className="space-y-4">
            <Skeleton className="h-11 w-40 rounded-xl" />
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
                <div className="min-w-0 space-y-6 lg:col-span-2">
                    <Skeleton className="-mx-4 aspect-[16/10] rounded-none sm:mx-0 sm:rounded-xl" />
                    <div className="flex gap-2">
                        {Array.from({ length: 4 }).map((_, i) => (
                            <Skeleton key={i} className="h-14 w-20 rounded-lg sm:h-16 sm:w-24" />
                        ))}
                    </div>
                    <div className="space-y-2">
                        <Skeleton className="h-9 w-3/4 rounded-lg" />
                        <Skeleton className="h-5 w-1/2 rounded-md" />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <Skeleton className="h-14 rounded-xl" />
                        <Skeleton className="h-14 rounded-xl" />
                    </div>
                    <div className="space-y-2">
                        <Skeleton className="h-4 w-full rounded-md" />
                        <Skeleton className="h-4 w-11/12 rounded-md" />
                        <Skeleton className="h-4 w-2/3 rounded-md" />
                    </div>
                </div>
                <div className="space-y-4 rounded-xl border border-border bg-card p-5 sm:p-6">
                    <Skeleton className="h-7 w-1/2 rounded-lg" />
                    <Skeleton className="h-12 w-full rounded-xl" />
                    <Skeleton className="h-12 w-full rounded-xl" />
                    <Skeleton className="h-32 w-full rounded-xl" />
                    <Skeleton className="h-12 w-full rounded-full" />
                </div>
            </div>
            <span className="sr-only">Chargement de la salle…</span>
        </div>
    );
}

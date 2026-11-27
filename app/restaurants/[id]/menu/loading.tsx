import { Skeleton } from '@/components/ui/Skeleton';

/** Lot 12b : squelette de la carte des plats (en-tête, plat du jour, plats en grille, panier sur ordinateur). */
export default function Loading() {
    return (
        <div role="status" aria-busy="true" className="space-y-4">
            <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_24rem] lg:gap-8">
                <div className="min-w-0 space-y-6">
                    <Skeleton className="aspect-[16/9] rounded-3xl sm:aspect-[21/8]" />
                    <Skeleton className="h-36 rounded-2xl" />
                    <div className="flex gap-2 overflow-hidden">
                        {Array.from({ length: 4 }).map((_, i) => (
                            <Skeleton key={i} className="h-11 w-28 flex-none rounded-full" />
                        ))}
                    </div>
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                        {Array.from({ length: 6 }).map((_, i) => (
                            <Skeleton key={i} className="aspect-[4/5] rounded-2xl" />
                        ))}
                    </div>
                </div>
                <Skeleton className="hidden h-96 rounded-3xl lg:block" />
            </div>
            <span className="sr-only">Chargement de la carte…</span>
        </div>
    );
}

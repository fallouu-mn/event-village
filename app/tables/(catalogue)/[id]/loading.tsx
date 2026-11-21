import { Skeleton } from '@/components/ui/Skeleton';

/** Lot 11b (écrans du client) : squelette de la fiche d'un établissement (galerie 16/10, en-tête, panneau de réservation). */
export default function Loading() {
    return (
        <div role="status" aria-busy="true" className="space-y-4">
            <Skeleton className="h-11 w-52 rounded-xl" />
            <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
                <div className="min-w-0 space-y-6 lg:col-span-2">
                    <Skeleton className="-mx-4 aspect-[16/10] rounded-none sm:mx-0 sm:rounded-2xl" />
                    <div className="space-y-2">
                        <Skeleton className="h-6 w-24 rounded-lg" />
                        <Skeleton className="h-9 w-3/4 rounded-lg" />
                        <Skeleton className="h-5 w-1/2 rounded-md" />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                        {Array.from({ length: 4 }).map((_, i) => (
                            <Skeleton key={i} className="h-14 rounded-xl" />
                        ))}
                    </div>
                    <div className="space-y-2">
                        {Array.from({ length: 7 }).map((_, i) => (
                            <Skeleton key={i} className="h-6 w-full rounded-md" />
                        ))}
                    </div>
                </div>
                <div className="space-y-5 rounded-2xl border border-border bg-card p-4 sm:p-6">
                    <Skeleton className="h-7 w-1/2 rounded-lg" />
                    <Skeleton className="h-12 w-48 rounded-xl" />
                    <div className="flex gap-2 overflow-hidden">
                        {Array.from({ length: 5 }).map((_, i) => (
                            <Skeleton key={i} className="h-[4.5rem] w-16 flex-none rounded-xl" />
                        ))}
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {Array.from({ length: 8 }).map((_, i) => (
                            <Skeleton key={i} className="h-11 w-[4.5rem] rounded-xl" />
                        ))}
                    </div>
                    <Skeleton className="h-12 w-full rounded-2xl" />
                </div>
            </div>
            <span className="sr-only">Chargement de l’établissement…</span>
        </div>
    );
}

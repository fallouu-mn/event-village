import { Skeleton } from '@/components/ui/Skeleton';

/** Lot 12d — chargement des livraisons du jour (mêmes blocs que la page). */
export default function Loading() {
    return (
        <div role="status" aria-busy="true" className="mx-auto max-w-2xl space-y-4 pb-24 pt-2 lg:pb-12">
            <Skeleton className="h-10 w-48 rounded-xl" />
            <Skeleton className="h-32 rounded-3xl" />
            <Skeleton className="h-32 rounded-3xl" />
            <span className="sr-only">Chargement de vos livraisons…</span>
        </div>
    );
}

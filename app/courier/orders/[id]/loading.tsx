import { Skeleton } from '@/components/ui/Skeleton';

/** Lot 12d — chargement d'une livraison (mêmes blocs que la page). */
export default function Loading() {
    return (
        <div role="status" aria-busy="true" className="mx-auto max-w-2xl space-y-4 pb-24 pt-2 lg:pb-12">
            <Skeleton className="h-10 w-2/3 rounded-xl" />
            <Skeleton className="h-36 rounded-3xl" />
            <Skeleton className="h-56 rounded-3xl" />
            <span className="sr-only">Chargement de la livraison…</span>
        </div>
    );
}

import { Skeleton } from '@/components/ui/Skeleton';

/** Lot 12b — chargement du suivi d'une commande (mêmes blocs que la page). */
export default function Loading() {
    return (
        <div role="status" aria-busy="true" className="mx-auto max-w-5xl space-y-4 pb-24 pt-2 lg:pb-12">
            <Skeleton className="h-10 w-48 rounded-xl" />
            <Skeleton className="h-10 w-2/3 rounded-xl" />
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
                <Skeleton className="h-80 rounded-3xl" />
                <Skeleton className="h-64 rounded-3xl" />
            </div>
            <span className="sr-only">Chargement de votre commande…</span>
        </div>
    );
}

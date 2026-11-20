import { Skeleton, TicketSkeleton } from '@/components/ui/Skeleton';

/** Lot 10b (point 5) : squelette de « Mes réservations » de salles (en-tête, onglets, réservations). */
export default function Loading() {
    return (
        <div role="status" aria-busy="true" className="space-y-5">
            <Skeleton className="h-11 w-36 rounded-xl" />
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-2">
                    <Skeleton className="h-8 w-56 rounded-xl" />
                    <Skeleton className="h-5 w-72 max-w-full rounded-md" />
                </div>
                <Skeleton className="h-11 w-44 rounded-xl" />
            </div>
            <div className="flex gap-2">
                <Skeleton className="h-11 w-28 rounded-xl" />
                <Skeleton className="h-11 w-48 rounded-xl" />
            </div>
            <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                    <TicketSkeleton key={i} />
                ))}
            </div>
            <span className="sr-only">Chargement de vos réservations…</span>
        </div>
    );
}

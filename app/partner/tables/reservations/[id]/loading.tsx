import { TableReservationSkeleton } from '@/components/tables/partner/TablesSkeletons';

/** Lot 11b : chargement du détail d'une réservation de table. */
export default function Loading() {
    return (
        <div role="status" aria-busy="true">
            <TableReservationSkeleton />
            <span className="sr-only">Chargement…</span>
        </div>
    );
}

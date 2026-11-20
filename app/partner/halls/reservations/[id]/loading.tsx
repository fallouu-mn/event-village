import { ReservationSkeleton } from '@/components/halls/partner/HallSkeletons';

/** Lot 10b (point 3) : chargement du détail d'une réservation de salle. */
export default function Loading() {
    return (
        <div role="status" aria-busy="true">
            <ReservationSkeleton />
            <span className="sr-only">Chargement…</span>
        </div>
    );
}

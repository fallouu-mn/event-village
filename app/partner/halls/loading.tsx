import { HallListSkeleton } from '@/components/halls/partner/HallSkeletons';

/** Lot 10b (point 3) : chargement de « Mes salles », à la taille des cartes attendues. */
export default function Loading() {
    return (
        <div role="status" aria-busy="true">
            <HallListSkeleton />
            <span className="sr-only">Chargement…</span>
        </div>
    );
}

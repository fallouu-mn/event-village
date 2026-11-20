import { EarningsSkeleton } from '@/components/halls/partner/HallSkeletons';

/** Lot 10b (point 3) : chargement des recettes des salles. */
export default function Loading() {
    return (
        <div role="status" aria-busy="true">
            <EarningsSkeleton />
            <span className="sr-only">Chargement…</span>
        </div>
    );
}

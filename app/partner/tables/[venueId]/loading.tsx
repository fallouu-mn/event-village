import { PlanningSkeleton } from '@/components/tables/partner/TablesSkeletons';

/** Lot 11b : chargement du planning du jour d'un établissement. */
export default function Loading() {
    return (
        <div role="status" aria-busy="true">
            <PlanningSkeleton />
            <span className="sr-only">Chargement…</span>
        </div>
    );
}

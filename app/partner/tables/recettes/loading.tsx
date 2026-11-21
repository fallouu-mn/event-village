import { TableEarningsSkeleton } from '@/components/tables/partner/TablesSkeletons';

/** Lot 11b : chargement des recettes des tables. */
export default function Loading() {
    return (
        <div role="status" aria-busy="true">
            <TableEarningsSkeleton />
            <span className="sr-only">Chargement…</span>
        </div>
    );
}

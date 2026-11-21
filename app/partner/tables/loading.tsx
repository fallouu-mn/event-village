import { VenuesListSkeleton } from '@/components/tables/partner/TablesSkeletons';

/** Lot 11b : chargement de « Mes établissements », à la taille des cartes attendues. */
export default function Loading() {
    return (
        <div role="status" aria-busy="true">
            <VenuesListSkeleton />
            <span className="sr-only">Chargement…</span>
        </div>
    );
}

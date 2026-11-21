import { VenueFormSkeleton } from '@/components/tables/editor/EditorSkeletons';

/** Lot 11b : chargement du formulaire d'ajout d'un établissement. */
export default function Loading() {
    return (
        <div role="status" aria-busy="true">
            <VenueFormSkeleton />
            <span className="sr-only">Chargement…</span>
        </div>
    );
}

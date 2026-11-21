import { VenueFormSkeleton } from '@/components/tables/editor/EditorSkeletons';

/** Lot 11b : chargement de la modification d'un établissement. */
export default function Loading() {
    return (
        <div role="status" aria-busy="true">
            <VenueFormSkeleton actions={2} />
            <span className="sr-only">Chargement de l’établissement…</span>
        </div>
    );
}

import { ClosuresSkeleton } from '@/components/tables/editor/EditorSkeletons';

/** Lot 11b : chargement des fermetures exceptionnelles. */
export default function Loading() {
    return (
        <div role="status" aria-busy="true">
            <ClosuresSkeleton />
            <span className="sr-only">Chargement des fermetures…</span>
        </div>
    );
}

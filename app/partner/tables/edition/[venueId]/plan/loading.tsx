import { PlanSkeleton } from '@/components/tables/editor/EditorSkeletons';

/** Lot 11b : chargement du plan de salle. */
export default function Loading() {
    return (
        <div role="status" aria-busy="true">
            <PlanSkeleton />
            <span className="sr-only">Chargement du plan de salle…</span>
        </div>
    );
}

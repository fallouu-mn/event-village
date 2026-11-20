import { HallFormSkeleton } from '@/components/halls/partner/HallSkeletons';

/** Lot 10b (point 3) : chargement du formulaire de modification d'une salle. */
export default function Loading() {
    return (
        <div role="status" aria-busy="true">
            <HallFormSkeleton />
            <span className="sr-only">Chargement…</span>
        </div>
    );
}

import { HallSheetSkeleton } from '@/components/halls/partner/HallSkeletons';

/** Lot 10b (point 3) : chargement de la fiche d'une salle et de son calendrier. */
export default function Loading() {
    return (
        <div role="status" aria-busy="true">
            <HallSheetSkeleton />
            <span className="sr-only">Chargement…</span>
        </div>
    );
}

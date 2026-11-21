/**
 * Lot 11b — squelettes des écrans d'édition d'un établissement, à la taille du contenu attendu (aucun saut à l'arrivée
 * des données). Décoratifs : l'écran ou le loading.tsx qui les affiche porte l'annonce « Chargement… » (role="status").
 * Pulsation du composant Skeleton, coupée si « réduire les animations ».
 */
import { Skeleton } from '@/components/ui/Skeleton';

function Header({ actions = 0 }: { actions?: number }) {
    return (
        <div className="flex flex-col gap-3 pb-4 sm:pb-6">
            <Skeleton className="h-11 w-40 max-w-full rounded-xl" />
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 flex-1 basis-64 flex-col gap-2">
                    <Skeleton className="h-8 w-64 max-w-full rounded-lg" />
                    <Skeleton className="h-5 w-80 max-w-full rounded-md" />
                </div>
                {actions > 0 && (
                    <div className="flex flex-wrap gap-2">
                        {Array.from({ length: actions }).map((_, i) => <Skeleton key={i} className="h-11 w-32 rounded-xl" />)}
                    </div>
                )}
            </div>
        </div>
    );
}

function SectionSkeleton({ rows = 2 }: { rows?: number }) {
    return (
        <div className="flex flex-col gap-5 rounded-2xl border border-border bg-card p-4 sm:p-6">
            <div className="flex items-start gap-3">
                <Skeleton className="h-8 w-8 flex-shrink-0 rounded-lg" />
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                    <Skeleton className="h-6 w-48 max-w-full rounded-md" />
                    <Skeleton className="h-4 w-72 max-w-full rounded-md" />
                </div>
            </div>
            {Array.from({ length: rows }).map((_, i) => (
                <div key={i} className="flex flex-col gap-2">
                    <Skeleton className="h-4 w-28 rounded-md" />
                    <Skeleton className="h-12 w-full rounded-xl" />
                </div>
            ))}
        </div>
    );
}

export function VenueFormSkeleton({ actions = 0 }: { actions?: number }) {
    return (
        <div className="mx-auto w-full max-w-4xl pb-10">
            <Header actions={actions} />
            <div className="flex flex-col gap-6">
                <Skeleton className="h-20 w-full rounded-xl" />
                <SectionSkeleton rows={3} />
                <SectionSkeleton rows={2} />
                <SectionSkeleton rows={1} />
            </div>
        </div>
    );
}

export function PlanSkeleton() {
    return (
        <div className="mx-auto w-full max-w-6xl pb-10">
            <Header actions={1} />
            <div className="flex flex-col gap-4">
                <Skeleton className="h-16 w-full rounded-2xl" />
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
                    <Skeleton className="aspect-[4/3] w-full rounded-2xl" />
                    <div className="flex flex-col gap-4">
                        <Skeleton className="h-40 w-full rounded-2xl" />
                        <Skeleton className="h-32 w-full rounded-2xl" />
                    </div>
                </div>
            </div>
        </div>
    );
}

export function ClosuresSkeleton() {
    return (
        <div className="mx-auto w-full max-w-3xl pb-10">
            <Header />
            <div className="flex flex-col gap-6">
                <SectionSkeleton rows={1} />
                <SectionSkeleton rows={3} />
            </div>
        </div>
    );
}

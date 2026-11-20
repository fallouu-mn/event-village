/**
 * Lot 10b (point 3) : squelettes des écrans de la salle, à la taille du contenu attendu (aucun saut à l'arrivée des
 * données). Décoratifs : l'écran qui les affiche porte l'annonce « Chargement… » (role="status"). Pulsation du composant
 * Skeleton, coupée si « réduire les animations », et seulement le temps du chargement.
 */
import React from 'react';
import { Skeleton } from '@/components/ui/Skeleton';

function Header({ actions = 0 }: { actions?: number }) {
    return (
        <div className="flex flex-col gap-3 pb-4 sm:pb-6">
            <Skeleton className="h-11 w-32 rounded-xl" />
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 flex-1 basis-64 flex-col gap-2">
                    <Skeleton className="h-8 w-56 max-w-full rounded-lg" />
                    <Skeleton className="h-5 w-80 max-w-full rounded-md" />
                </div>
                {actions > 0 && (
                    <div className="flex gap-2">
                        {Array.from({ length: actions }).map((_, i) => <Skeleton key={i} className="h-11 w-32 rounded-xl" />)}
                    </div>
                )}
            </div>
        </div>
    );
}

/** Carte d'une salle de « Mes salles ». */
export function HallCardSkeleton() {
    return (
        <div className="flex flex-col overflow-hidden rounded-xl border border-border bg-card sm:flex-row">
            <Skeleton className="aspect-[16/10] w-full rounded-none sm:aspect-auto sm:h-auto sm:w-56 sm:self-stretch" />
            <div className="flex flex-1 flex-col gap-3 p-4">
                <Skeleton className="h-6 w-40 rounded-lg" />
                <Skeleton className="h-6 w-2/3 rounded-md" />
                <Skeleton className="h-4 w-1/2 rounded-md" />
                <div className="flex flex-wrap gap-2 pt-2">
                    <Skeleton className="h-11 w-24 rounded-xl" />
                    <Skeleton className="h-11 w-28 rounded-xl" />
                    <Skeleton className="h-11 w-24 rounded-xl" />
                </div>
            </div>
        </div>
    );
}

export function HallListSkeleton() {
    return (
        <div className="mx-auto w-full max-w-5xl">
            <Header actions={2} />
            <div className="flex flex-col gap-4">
                {Array.from({ length: 3 }).map((_, i) => <HallCardSkeleton key={i} />)}
            </div>
        </div>
    );
}

export function HallFormSkeleton() {
    return (
        <div className="mx-auto w-full max-w-4xl">
            <Header />
            <div className="flex flex-col gap-6">
                <Skeleton className="h-20 w-full rounded-xl" />
                {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 sm:p-6">
                        <Skeleton className="h-7 w-48 rounded-lg" />
                        <Skeleton className="h-12 w-full rounded-xl" />
                        <Skeleton className="h-12 w-full rounded-xl" />
                    </div>
                ))}
            </div>
        </div>
    );
}

export function HallSheetSkeleton() {
    return (
        <div className="mx-auto w-full max-w-5xl">
            <Header actions={2} />
            <div className="flex flex-col gap-6">
                <Skeleton className="h-20 w-full rounded-xl" />
                <Skeleton className="aspect-[16/9] w-full rounded-xl sm:aspect-[21/9]" />
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                    {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
                </div>
                <Skeleton className="h-96 w-full rounded-xl" />
            </div>
        </div>
    );
}

export function ReservationSkeleton() {
    return (
        <div className="mx-auto w-full max-w-3xl">
            <Header />
            <div className="flex flex-col gap-4">
                <Skeleton className="h-20 w-full rounded-xl" />
                <Skeleton className="h-40 w-full rounded-xl" />
                <Skeleton className="h-48 w-full rounded-xl" />
            </div>
        </div>
    );
}

export function EarningsSkeleton() {
    return (
        <div className="mx-auto w-full max-w-5xl">
            <Header actions={1} />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Skeleton className="h-32 rounded-xl" />
                <Skeleton className="h-32 rounded-xl" />
            </div>
            <div className="mt-6 flex flex-col gap-3">
                {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
            </div>
        </div>
    );
}

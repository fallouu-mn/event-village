/**
 * Lot 11b : squelettes des écrans quotidiens de l'établissement, à la taille du contenu attendu (aucun saut à l'arrivée
 * des données). Décoratifs : l'écran qui les affiche porte l'annonce « Chargement… » (role="status"). Pulsation du
 * composant Skeleton, coupée si « réduire les animations ».
 */
import React from 'react';
import { Skeleton } from '@/components/ui/Skeleton';

function Header({ actions = 0, back = true }: { actions?: number; back?: boolean }) {
    return (
        <div className="flex flex-col gap-3 pb-4 sm:pb-6">
            {back && <Skeleton className="h-11 w-40 rounded-xl" />}
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 flex-1 basis-64 flex-col gap-2">
                    <Skeleton className="h-8 w-56 max-w-full rounded-lg" />
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

export function VenueCardSkeleton() {
    return (
        <div className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card sm:flex-row">
            <Skeleton className="aspect-[16/10] w-full rounded-none sm:aspect-auto sm:w-56 sm:self-stretch" />
            <div className="flex flex-1 flex-col gap-3 p-4">
                <Skeleton className="h-6 w-40 rounded-lg" />
                <Skeleton className="h-6 w-2/3 rounded-md" />
                <div className="grid grid-cols-3 gap-2">
                    {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
                </div>
                <div className="flex flex-wrap gap-2 pt-1">
                    <Skeleton className="h-11 w-40 rounded-xl" />
                    <Skeleton className="h-11 w-28 rounded-xl" />
                </div>
            </div>
        </div>
    );
}

export function VenuesListSkeleton() {
    return (
        <div className="mx-auto w-full max-w-5xl">
            <Header actions={2} back={false} />
            <div className="flex flex-col gap-4">
                {Array.from({ length: 2 }).map((_, i) => <VenueCardSkeleton key={i} />)}
            </div>
        </div>
    );
}

/** Une réservation de la frise du jour. */
export function BookingRowSkeleton() {
    return (
        <div className="flex gap-3 rounded-2xl border border-border bg-card p-4">
            <Skeleton className="h-12 w-16 flex-shrink-0 rounded-xl" />
            <div className="flex flex-1 flex-col gap-2">
                <Skeleton className="h-5 w-48 max-w-full rounded-md" />
                <Skeleton className="h-4 w-32 rounded-md" />
                <Skeleton className="h-11 w-40 rounded-xl" />
            </div>
        </div>
    );
}

export function PlanningSkeleton() {
    return (
        <div className="mx-auto w-full max-w-6xl">
            <Header actions={3} />
            <Skeleton className="mb-4 h-14 w-full rounded-2xl" />
            <div className="mb-6 flex gap-2 overflow-hidden">
                {Array.from({ length: 7 }).map((_, i) => <Skeleton key={i} className="h-16 w-16 flex-shrink-0 rounded-xl" />)}
            </div>
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
                <div className="flex flex-col gap-3 lg:col-span-3">
                    <Skeleton className="h-7 w-48 rounded-lg" />
                    {Array.from({ length: 3 }).map((_, i) => <BookingRowSkeleton key={i} />)}
                </div>
                <div className="flex flex-col gap-3 lg:col-span-2">
                    <Skeleton className="h-7 w-40 rounded-lg" />
                    <Skeleton className="aspect-[4/3] w-full rounded-2xl" />
                </div>
            </div>
        </div>
    );
}

export function TableReservationSkeleton() {
    return (
        <div className="mx-auto w-full max-w-2xl">
            <Header />
            <div className="flex flex-col gap-4">
                <Skeleton className="h-36 w-full rounded-2xl" />
                <Skeleton className="h-28 w-full rounded-2xl" />
                <Skeleton className="h-44 w-full rounded-2xl" />
            </div>
        </div>
    );
}

export function TableEarningsSkeleton() {
    return (
        <div className="mx-auto w-full max-w-5xl">
            <Header actions={1} />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Skeleton className="h-32 rounded-2xl" />
                <Skeleton className="h-32 rounded-2xl" />
            </div>
            <div className="mt-6 flex flex-col gap-3">
                {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
            </div>
        </div>
    );
}

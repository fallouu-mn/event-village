import React from 'react';
import { cn } from './cn';

/**
 * Squelettes de chargement (lot 6, contrat A7) sur les tokens du système de design :
 *  - bloc `bg-surface-sunken` (MASTER : « puits, pistes, squelettes ») cerné d'un filet `ring-border`, pour
 *    rester visible aussi bien dans une carte (`bg-surface`) que posé sur le fond de page (lui-même
 *    `surface-sunken`), en clair comme en sombre ;
 *  - pulsation en `motion-safe:` seulement (prefers-reduced-motion respecté) ;
 *  - cartes `bg-surface border-border`.
 * Décoratifs : les écrans qui les affichent portent eux-mêmes l'annonce « Chargement… » (role="status").
 */
export const Skeleton: React.FC<{ className?: string }> = ({ className }) => (
  <div aria-hidden="true" className={cn('rounded-xl bg-surface-sunken ring-1 ring-inset ring-border motion-safe:animate-pulse', className)} />
);

/** Carte d'un squelette : même surface et même bordure que les cartes des écrans migrés. */
export const SKELETON_CARD = 'rounded-3xl border border-border bg-surface';

export const EventCardSkeleton: React.FC = () => (
  <div className={cn(SKELETON_CARD, 'space-y-3 p-3')}>
    <Skeleton className="h-48 w-full rounded-2xl" />
    <div className="space-y-2 px-1">
      <Skeleton className="h-4 w-1/3 rounded-md" />
      <Skeleton className="h-5 w-3/4 rounded-md" />
      <Skeleton className="h-4 w-1/2 rounded-md" />
    </div>
    <div className="flex items-center justify-between px-1 pt-2">
      <Skeleton className="h-6 w-20 rounded-lg" />
      <Skeleton className="h-9 w-24 rounded-xl" />
    </div>
  </div>
);

export const StatCardSkeleton: React.FC = () => (
  <div className="space-y-3 rounded-2xl border border-border bg-surface p-5">
    <div className="flex items-center justify-between">
      <Skeleton className="h-10 w-10 rounded-xl" />
      <Skeleton className="h-5 w-16 rounded-full" />
    </div>
    <Skeleton className="h-7 w-24 rounded-lg" />
    <Skeleton className="h-4 w-32 rounded-md" />
  </div>
);

export const ListRowSkeleton: React.FC<{ lines?: number }> = ({ lines = 2 }) => (
  <div className="flex items-center gap-4 border-b border-border py-3 last:border-0">
    <Skeleton className="h-10 w-10 flex-shrink-0 rounded-xl" />
    <div className="flex-1 space-y-2">
      <Skeleton className="h-4 w-3/4 rounded-md" />
      {lines >= 2 && <Skeleton className="h-3 w-1/2 rounded-md" />}
    </div>
    <Skeleton className="h-6 w-16 flex-shrink-0 rounded-lg" />
  </div>
);

export const TicketSkeleton: React.FC = () => (
  <div className={cn(SKELETON_CARD, 'space-y-3 p-4')}>
    <div className="flex gap-4">
      <Skeleton className="h-20 w-20 flex-shrink-0 rounded-2xl" />
      <div className="flex-1 space-y-2 pt-1">
        <Skeleton className="h-5 w-3/4 rounded-lg" />
        <Skeleton className="h-4 w-1/2 rounded-md" />
        <Skeleton className="h-4 w-2/5 rounded-md" />
      </div>
    </div>
    <div className="flex items-center justify-between pt-1">
      <Skeleton className="h-8 w-24 rounded-xl" />
      <Skeleton className="h-8 w-28 rounded-xl" />
    </div>
  </div>
);

export const ProfileCardSkeleton: React.FC = () => (
  <div className={cn(SKELETON_CARD, 'p-6')}>
    <div className="flex flex-col items-center space-y-3 text-center">
      <Skeleton className="h-20 w-20 rounded-full" />
      <Skeleton className="h-6 w-36 rounded-lg" />
      <Skeleton className="h-4 w-24 rounded-md" />
      <div className="flex gap-3 pt-2">
        <Skeleton className="h-9 w-28 rounded-xl" />
        <Skeleton className="h-9 w-28 rounded-xl" />
      </div>
    </div>
  </div>
);

export const HeroSkeleton: React.FC = () => (
  <div className="space-y-4">
    <Skeleton className="h-64 w-full rounded-3xl sm:h-80" />
    <div className="space-y-2">
      <Skeleton className="h-4 w-28 rounded-full" />
      <Skeleton className="h-7 w-3/4 rounded-lg" />
      <Skeleton className="h-5 w-1/2 rounded-md" />
    </div>
  </div>
);

import React from 'react';
import { clsx } from 'clsx';

export const Skeleton: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={clsx('ev-skel', className)} />
);

export const EventCardSkeleton: React.FC = () => (
  <div className="rounded-3xl border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3 space-y-3">
    <Skeleton className="w-full h-48 rounded-2xl" />
    <div className="space-y-2 px-1">
      <Skeleton className="w-1/3 h-4 rounded-md" />
      <Skeleton className="w-3/4 h-5 rounded-md" />
      <Skeleton className="w-1/2 h-4 rounded-md" />
    </div>
    <div className="flex justify-between items-center pt-2 px-1">
      <Skeleton className="w-20 h-6 rounded-lg" />
      <Skeleton className="w-24 h-9 rounded-xl" />
    </div>
  </div>
);

export const StatCardSkeleton: React.FC = () => (
  <div className="rounded-2xl border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-3">
    <div className="flex items-center justify-between">
      <Skeleton className="w-10 h-10 rounded-xl" />
      <Skeleton className="w-16 h-5 rounded-full" />
    </div>
    <Skeleton className="w-24 h-7 rounded-lg" />
    <Skeleton className="w-32 h-4 rounded-md" />
  </div>
);

export const ListRowSkeleton: React.FC<{ lines?: number }> = ({ lines = 2 }) => (
  <div className="flex items-center gap-4 py-3 border-b border-slate-100 dark:border-zinc-800 last:border-0">
    <Skeleton className="w-10 h-10 rounded-xl flex-shrink-0" />
    <div className="flex-1 space-y-2">
      <Skeleton className="h-4 w-3/4 rounded-md" />
      {lines >= 2 && <Skeleton className="h-3 w-1/2 rounded-md" />}
    </div>
    <Skeleton className="w-16 h-6 rounded-lg flex-shrink-0" />
  </div>
);

export const TicketSkeleton: React.FC = () => (
  <div className="rounded-3xl border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 space-y-3">
    <div className="flex gap-4">
      <Skeleton className="w-20 h-20 rounded-2xl flex-shrink-0" />
      <div className="flex-1 space-y-2 pt-1">
        <Skeleton className="h-5 w-3/4 rounded-lg" />
        <Skeleton className="h-4 w-1/2 rounded-md" />
        <Skeleton className="h-4 w-2/5 rounded-md" />
      </div>
    </div>
    <div className="flex justify-between items-center pt-1">
      <Skeleton className="h-8 w-24 rounded-xl" />
      <Skeleton className="h-8 w-28 rounded-xl" />
    </div>
  </div>
);

export const ProfileCardSkeleton: React.FC = () => (
  <div className="rounded-3xl border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6">
    <div className="flex flex-col items-center text-center space-y-3">
      <Skeleton className="w-20 h-20 rounded-full" />
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
    <Skeleton className="w-full h-64 sm:h-80 rounded-3xl" />
    <div className="space-y-2">
      <Skeleton className="h-4 w-28 rounded-full" />
      <Skeleton className="h-7 w-3/4 rounded-lg" />
      <Skeleton className="h-5 w-1/2 rounded-md" />
    </div>
  </div>
);

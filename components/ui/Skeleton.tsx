import React from 'react';
import { clsx } from 'clsx';

export const Skeleton: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <div
      className={clsx(
        'animate-pulse rounded-xl bg-slate-200/80 dark:bg-zinc-800/80',
        className
      )}
    />
  );
};

export const EventCardSkeleton: React.FC = () => {
  return (
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
};

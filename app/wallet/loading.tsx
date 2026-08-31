import { Skeleton, StatCardSkeleton, ListRowSkeleton } from '@/components/ui/Skeleton';

export default function Loading() {
  return (
    <div className="space-y-6 ev-fade-in">
      <Skeleton className="h-8 w-44 rounded-xl" />

      {/* Balance card */}
      <div className="rounded-3xl border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 space-y-4">
        <Skeleton className="h-5 w-32 rounded-md" />
        <Skeleton className="h-10 w-48 rounded-xl" />
        <div className="flex gap-3 pt-2">
          <Skeleton className="h-11 flex-1 rounded-2xl" />
          <Skeleton className="h-11 flex-1 rounded-2xl" />
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <StatCardSkeleton key={i} />
        ))}
      </div>

      {/* Commissions list */}
      <div className="rounded-3xl border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-1">
        <Skeleton className="h-5 w-44 rounded-lg mb-3" />
        {Array.from({ length: 5 }).map((_, i) => (
          <ListRowSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

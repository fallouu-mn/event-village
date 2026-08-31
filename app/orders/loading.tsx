import { Skeleton, ListRowSkeleton } from '@/components/ui/Skeleton';

export default function Loading() {
  return (
    <div className="space-y-5 ev-fade-in">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-36 rounded-xl" />
        <Skeleton className="h-8 w-28 rounded-xl" />
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-24 rounded-xl" />
        ))}
      </div>

      {/* Order rows */}
      <div className="rounded-3xl border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-2 divide-y divide-slate-100 dark:divide-zinc-800">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="px-3">
            <ListRowSkeleton lines={2} />
          </div>
        ))}
      </div>
    </div>
  );
}

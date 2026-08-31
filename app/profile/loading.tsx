import { Skeleton, ProfileCardSkeleton, ListRowSkeleton } from '@/components/ui/Skeleton';

export default function Loading() {
  return (
    <div className="space-y-5 ev-fade-in max-w-2xl mx-auto">
      <ProfileCardSkeleton />

      {/* Info sections */}
      {Array.from({ length: 3 }).map((_, s) => (
        <div
          key={s}
          className="rounded-3xl border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-1"
        >
          <Skeleton className="h-5 w-32 rounded-lg mb-3" />
          {Array.from({ length: 3 }).map((_, i) => (
            <ListRowSkeleton key={i} lines={2} />
          ))}
        </div>
      ))}
    </div>
  );
}

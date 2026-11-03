import { Skeleton, ProfileCardSkeleton, ListRowSkeleton } from '@/components/ui/Skeleton';

export default function Loading() {
  return (
    <div role="status" aria-busy="true" className="space-y-5 ev-fade-in max-w-2xl mx-auto">
      <ProfileCardSkeleton />

      {/* Info sections */}
      {Array.from({ length: 3 }).map((_, s) => (
        <div
          key={s}
          className="rounded-3xl border border-border bg-surface p-5 space-y-1"
        >
          <Skeleton className="h-5 w-32 rounded-lg mb-3" />
          {Array.from({ length: 3 }).map((_, i) => (
            <ListRowSkeleton key={i} lines={2} />
          ))}
        </div>
      ))}
      <span className="sr-only">Chargement…</span>
    </div>
  );
}

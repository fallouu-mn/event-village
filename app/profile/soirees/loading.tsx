import { ListRowSkeleton, Skeleton } from '@/components/ui/Skeleton';

/** Squelette de Mes soirées : titre, puis cartes des soirées. */
export default function Loading() {
  return (
    <div role="status" aria-busy="true" className="mx-auto max-w-2xl space-y-5 pb-24 lg:pb-12">
      <Skeleton className="h-10 w-48 rounded-2xl" />
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-border bg-surface p-4">
            <ListRowSkeleton lines={3} />
          </div>
        ))}
      </div>
      <span className="sr-only">Chargement de vos soirées…</span>
    </div>
  );
}

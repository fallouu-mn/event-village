import { KpiCardSkeleton } from '@/components/ui/KpiCard';
import { ListRowSkeleton, Skeleton } from '@/components/ui/Skeleton';

/** Squelette de Mes paiements : totaux, puis lignes de la liste. */
export default function Loading() {
  return (
    <div role="status" aria-busy="true" className="mx-auto max-w-2xl space-y-5 pb-24 lg:pb-12">
      <Skeleton className="h-10 w-48 rounded-2xl" />
      <div className="grid gap-3 sm:grid-cols-2">
        <KpiCardSkeleton />
        <KpiCardSkeleton />
      </div>
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-border bg-surface p-4">
            <ListRowSkeleton lines={2} />
          </div>
        ))}
      </div>
      <span className="sr-only">Chargement de vos paiements…</span>
    </div>
  );
}

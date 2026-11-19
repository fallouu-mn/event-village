import { Skeleton } from '@/components/ui/Skeleton';

/** Chargement de la fiche (navigation depuis une carte) : mêmes tailles que la page, rien ne saute à l'arrivée. */
export default function Loading() {
  return (
    <div role="status" aria-busy="true" className="space-y-6">
      <Skeleton className="h-11 w-48 rounded-xl" />
      <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-3">
        <div className="min-w-0 space-y-6 lg:col-span-2">
          <Skeleton className="-mx-4 aspect-[16/10] w-auto rounded-none sm:mx-0 sm:rounded-[20px]" />
          <div className="space-y-3">
            <Skeleton className="h-6 w-24 rounded-lg" />
            <Skeleton className="h-9 w-3/4 rounded-xl" />
          </div>
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-11 w-11 rounded-xl" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-2/3 rounded-md" />
                  <Skeleton className="h-3 w-1/3 rounded-sm" />
                </div>
              </div>
            ))}
          </div>
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
        <Skeleton className="h-96 w-full rounded-xl" />
      </div>
      <span className="sr-only">Chargement…</span>
    </div>
  );
}

import { Skeleton, EventCardSkeleton } from '@/components/ui/Skeleton';

export default function Loading() {
  return (
    <div className="space-y-6 ev-fade-in">
      <Skeleton className="h-14 w-full rounded-2xl" />
      <div className="flex gap-2 overflow-hidden">
        {['w-20', 'w-24', 'w-16', 'w-20', 'w-24'].map((w, i) => (
          <Skeleton key={i} className={`h-9 ${w} rounded-full flex-shrink-0`} />
        ))}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <EventCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

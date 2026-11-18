'use client';

import { useMemo } from 'react';
import { liveWindowFromIso } from '@/lib/events/live-status';
import { LiveBadge } from './LiveBadge';

/**
 * Design 1b (point 11) — badge « En cours » d'une carte, à partir des instants ISO servis par le catalogue (début et fin
 * retenue). Calculé sur le téléphone (LiveBadge, useLiveNow) : jamais figé dans une page en cache.
 */
export function CardLiveBadge({ startsAt, endsAt, className }: { startsAt?: string | null; endsAt?: string | null; className?: string }) {
  const window = useMemo(() => liveWindowFromIso(startsAt, endsAt), [startsAt, endsAt]);
  return <LiveBadge window={window} className={className} />;
}

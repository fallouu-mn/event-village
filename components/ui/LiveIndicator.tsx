import React from 'react';
import type { RealtimeStatus } from '@/hooks/useRealtimeRefresh';
import { cn } from './cn';

export interface LiveIndicatorProps {
  /** État renvoyé par useRealtimeRefresh : live, connecting ou offline. */
  status: RealtimeStatus;
  className?: string;
}

const LABELS: Record<RealtimeStatus, string> = {
  live: 'En direct',
  connecting: 'Connexion…',
  offline: 'Hors ligne',
};

const DOTS: Record<RealtimeStatus, string> = {
  live: 'bg-success motion-safe:animate-pulse',
  connecting: 'bg-warning',
  offline: 'border border-fg-muted bg-transparent',
};

/**
 * Indicateur de mise à jour en direct (contrat O3, Q) : « En direct » quand le canal est abonné,
 * « Hors ligne » discret sinon (les données restent celles du dernier chargement). Annoncé poliment.
 */
export const LiveIndicator: React.FC<LiveIndicatorProps> = ({ status, className }) => (
  <span
    role="status"
    aria-live="polite"
    className={cn(
      'inline-flex items-center gap-2 whitespace-nowrap text-sm font-medium',
      status === 'live' ? 'text-success-fg' : 'text-fg-muted',
      className,
    )}
    title={status === 'offline' ? 'Les chiffres affichés sont ceux du dernier chargement.' : undefined}
  >
    <span className={cn('h-2 w-2 flex-shrink-0 rounded-full', DOTS[status])} aria-hidden="true" />
    {LABELS[status]}
  </span>
);

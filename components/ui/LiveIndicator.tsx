import React from 'react';
import type { RealtimeStatus } from '@/hooks/useRealtimeRefresh';
import { cn } from './cn';

export interface LiveIndicatorProps {
  /** État renvoyé par useRealtimeRefresh : live, connecting ou offline. */
  status: RealtimeStatus;
  /**
   * Les chiffres affichés (ventes comprises) suivent-ils le temps réel ? Faux sur un écran qui ne s'abonne pas
   * aux ventes : l'indicateur dit alors l'heure de la dernière mise à jour, jamais « En direct » (R49).
   */
  salesLive?: boolean;
  /** Heure de la dernière lecture réussie, déjà formatée par l'appelant (formatTime), null si inconnue. */
  updatedTime?: string | null;
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
 * Indicateur de mise à jour (contrat O3, Q ; lot 9 ter R49) : « En direct » seulement quand le canal est abonné
 * et que les ventes sont suivies ; sinon l'heure de la dernière mise à jour (« Mis à jour à 14:32 ») ;
 * « Hors ligne » discret, suivi de l'heure si elle est connue (les données restent celles du dernier chargement).
 * Annoncé poliment.
 */
export const LiveIndicator: React.FC<LiveIndicatorProps> = ({ status, salesLive = true, updatedTime = null, className }) => {
  const notFollowed = !salesLive && status !== 'offline';
  let label = LABELS[status];
  if (notFollowed) label = updatedTime ? `Mis à jour à ${updatedTime}` : 'Mise à jour en cours';
  else if (status === 'offline' && updatedTime) label = `Hors ligne · mis à jour à ${updatedTime}`;
  const live = status === 'live' && !notFollowed;
  return (
    <span
      role="status"
      aria-live="polite"
      aria-atomic={notFollowed || updatedTime ? true : undefined}
      className={cn(
        'inline-flex items-center gap-2 whitespace-nowrap text-sm font-medium',
        live ? 'text-success-fg' : 'text-fg-muted',
        className,
      )}
      title={status === 'offline' ? 'Les chiffres affichés sont ceux du dernier chargement.' : undefined}
    >
      <span className={cn('h-2 w-2 flex-shrink-0 rounded-full', notFollowed ? 'bg-fg-muted' : DOTS[status])} aria-hidden="true" />
      {label}
    </span>
  );
};

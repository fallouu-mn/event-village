'use client';

/**
 * Lot 7, tâche 7.1 (contrat 5.2) — indicateur « billet disponible hors ligne » de la carte billet et de la page
 * hors ligne. L'état est porté par `data-ev-offline-state` (available, missing, not_yet, offline_missing,
 * expired) pour l'e2e. Chaque état a son icône et son texte : la couleur ne porte jamais seule l'information
 * (trace ui-ux-pro-max E2-004). Message atomique annoncé poliment (role status), sans déplacer le focus.
 */
import React from 'react';
import { CheckCircle2, Clock, CloudOff, Smartphone, TimerReset } from 'lucide-react';
import { cn } from '@/components/ui/cn';
import { TONE_SOFT, type Tone } from '@/components/ui/tones';
import { formatDateTime } from '@/lib/format';
import type { OfflineIndicatorState } from '@/lib/tickets/offline-clock';

export interface OfflineStatusBadgeProps {
  state: OfflineIndicatorState;
  /** Début de la fenêtre de téléchargement (état not_yet), heure ISO. */
  availableFrom?: string | null;
  /** Téléchargement en cours (état missing avec du réseau). */
  busy?: boolean;
  className?: string;
}

const TONES: Record<OfflineIndicatorState, Tone> = {
  available: 'success',
  missing: 'warning',
  not_yet: 'info',
  offline_missing: 'danger',
  expired: 'warning',
};

const ICONS: Record<OfflineIndicatorState, typeof Clock> = {
  available: CheckCircle2,
  missing: Smartphone,
  not_yet: Clock,
  offline_missing: CloudOff,
  expired: TimerReset,
};

/** Textes du contrat 5.2, mot pour mot. */
export function offlineStateText(state: OfflineIndicatorState, availableFrom?: string | null, busy?: boolean): string {
  switch (state) {
    case 'available':
      return 'Disponible hors ligne';
    case 'missing':
      return busy ? 'Enregistrement du billet sur ce téléphone…' : 'Ouvrez ce billet avec du réseau avant d’arriver';
    case 'not_yet':
      return availableFrom
        ? `Disponible hors ligne à partir du ${formatDateTime(availableFrom).replace(' à ', ' à ')}`
        : 'Disponible hors ligne la veille de l’événement';
    case 'offline_missing':
      return 'Ce billet n’est pas enregistré sur ce téléphone. Reconnectez-vous au réseau, ou présentez votre numéro de billet et votre pièce d’identité au contrôle.';
    case 'expired':
      return 'Codes expirés : ouvrez le billet avec du réseau';
  }
}

export const OfflineStatusBadge: React.FC<OfflineStatusBadgeProps> = ({ state, availableFrom, busy = false, className }) => {
  const Icon = ICONS[state];
  return (
    <p
      role="status"
      aria-atomic="true"
      data-ev-offline-state={state}
      className={cn('flex items-start gap-2 rounded-xl border px-3 py-2 text-sm font-medium leading-snug', TONE_SOFT[TONES[state]], className)}
    >
      <Icon size={16} aria-hidden="true" className={cn('mt-0.5 flex-shrink-0', busy && 'motion-safe:animate-pulse')} />
      <span>{offlineStateText(state, availableFrom, busy)}</span>
    </p>
  );
};

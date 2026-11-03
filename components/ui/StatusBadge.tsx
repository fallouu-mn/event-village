import React from 'react';
import { EVENT_STATUS_META, isEventStatus } from '@/lib/events/event-status';
import { TICKET_STATUS_META, isTicketStatus } from '@/lib/tickets/ticket-status';
import { OUTBOX_STATUS_LABELS, OUTBOX_STATUS_TONES, OUTBOX_STATUSES, type OutboxStatus } from '@/lib/notifications/outbox-labels';
import { cn } from './cn';
import { TONE_DOT, TONE_SOFT, type Tone } from './tones';

/**
 * Domaines de statut couverts : événement (EVENT_STATUS_META), billet (TICKET_STATUS_META) et, au lot 6,
 * notification de la boîte d'envoi (OUTBOX_STATUS_LABELS et OUTBOX_STATUS_TONES, contrat L4). Les autres
 * domaines (paiements…) restent sur Badge.tsx tant qu'ils ne sont pas migrés.
 */
export type StatusDomain = 'event' | 'ticket' | 'notification';

export interface StatusBadgeProps {
  /** Domaine du statut : un même code (VALIDE) n'a pas le même sens pour un billet et pour un événement. */
  domain: StatusDomain;
  /** Valeur brute venue de l'API ; jamais affichée telle quelle. */
  status: string | null | undefined;
  size?: 'sm' | 'md';
  className?: string;
}

const SIZES = {
  sm: 'text-caption px-2 py-0.5 gap-1.5 rounded-md',
  md: 'text-sm px-2.5 py-1 gap-2 rounded-lg',
} as const;

const UNKNOWN_LABEL = 'Statut inconnu';

function isOutboxStatus(value: string | null | undefined): value is OutboxStatus {
  return typeof value === 'string' && (OUTBOX_STATUSES as readonly string[]).includes(value);
}

function metaOf(domain: StatusDomain, status: string | null | undefined): { label: string; tone: Tone; description?: string } {
  if (domain === 'event' && isEventStatus(status)) return EVENT_STATUS_META[status];
  if (domain === 'ticket' && isTicketStatus(status)) return TICKET_STATUS_META[status];
  if (domain === 'notification' && isOutboxStatus(status)) return { label: OUTBOX_STATUS_LABELS[status], tone: OUTBOX_STATUS_TONES[status] };
  return { label: UNKNOWN_LABEL, tone: 'neutral' };
}

/**
 * Pastille de statut (contrat Q) : libellé, ton et description lus dans EVENT_STATUS_META (contrat B)
 * ou TICKET_STATUS_META (lib/tickets/ticket-status.ts) selon le domaine, en casse de phrase. Le point
 * de couleur double le libellé, il ne le remplace pas.
 */
export const StatusBadge: React.FC<StatusBadgeProps> = ({ domain, status, size = 'md', className }) => {
  const meta = metaOf(domain, status);
  return (
    <span
      // Lot 6 (contrat A6) : texte de 12 px admis par le contrôle des captures (pastille, MASTER.md).
      data-ev-caption=""
      className={cn('inline-flex max-w-full items-center whitespace-nowrap border font-semibold leading-tight', TONE_SOFT[meta.tone], SIZES[size], className)}
      title={meta.description}
    >
      <span className={cn('h-1.5 w-1.5 flex-shrink-0 rounded-full', TONE_DOT[meta.tone])} aria-hidden="true" />
      <span className="truncate">{meta.label}</span>
    </span>
  );
};

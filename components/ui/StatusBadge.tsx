import React from 'react';
import { EVENT_STATUS_META, isEventStatus } from '@/lib/events/event-status';
import { TICKET_STATUS_META, isTicketStatus } from '@/lib/tickets/ticket-status';
import { cn } from './cn';
import { TONE_DOT, TONE_SOFT, type Tone } from './tones';

/**
 * Domaines de statut couverts : événement (EVENT_STATUS_META), billet (TICKET_STATUS_META) et, au lot 6,
 * notification de la boîte d'envoi (contrat L4). Les autres domaines (paiements…) restent sur Badge.tsx tant
 * qu'ils ne sont pas migrés.
 *
 * Lot 7 (7.5) : les libellés et les tons de la boîte d'envoi (lib/notifications/outbox-labels.ts, plus de
 * 6 Ko avec les motifs et les types) ne sont plus importés ici. L'écran admin, seul à afficher ce domaine,
 * les passe par `catalog` : Mes billets, qui rend ce badge, n'embarque plus ce module.
 */
export type StatusDomain = 'event' | 'ticket' | 'notification';

/** Libellés et tons d'un domaine fournis par l'appelant (domaine « notification » : OUTBOX_STATUS_LABELS et OUTBOX_STATUS_TONES). */
export interface StatusCatalog {
  labels: Readonly<Record<string, string>>;
  tones: Readonly<Record<string, Tone>>;
}

interface StatusBadgeBaseProps {
  /** Valeur brute venue de l'API ; jamais affichée telle quelle. */
  status: string | null | undefined;
  size?: 'sm' | 'md';
  className?: string;
}

export type StatusBadgeProps = StatusBadgeBaseProps & (
  | {
      /** Domaine du statut : un même code (VALIDE) n'a pas le même sens pour un billet et pour un événement. */
      domain: Exclude<StatusDomain, 'notification'>;
      catalog?: undefined;
    }
  | {
      domain: 'notification';
      /** Obligatoire pour ce domaine : table des libellés et des tons de la boîte d'envoi. */
      catalog: StatusCatalog;
    }
);

const SIZES = {
  sm: 'text-caption px-2 py-0.5 gap-1.5 rounded-md',
  md: 'text-sm px-2.5 py-1 gap-2 rounded-lg',
} as const;

const UNKNOWN_LABEL = 'Statut inconnu';

function catalogMeta(catalog: StatusCatalog, status: string | null | undefined): { label: string; tone: Tone } | null {
  if (typeof status !== 'string') return null;
  const own = (table: object) => Object.prototype.hasOwnProperty.call(table, status);
  if (!own(catalog.labels)) return null;
  return { label: catalog.labels[status], tone: own(catalog.tones) ? catalog.tones[status] : 'neutral' };
}

function metaOf(props: StatusBadgeProps): { label: string; tone: Tone; description?: string } {
  const { domain, status } = props;
  if (domain === 'event' && isEventStatus(status)) return EVENT_STATUS_META[status];
  if (domain === 'ticket' && isTicketStatus(status)) return TICKET_STATUS_META[status];
  if (props.domain === 'notification') {
    const meta = catalogMeta(props.catalog, status);
    if (meta) return meta;
  }
  return { label: UNKNOWN_LABEL, tone: 'neutral' };
}

/**
 * Pastille de statut (contrat Q) : libellé, ton et description lus dans EVENT_STATUS_META (contrat B)
 * ou TICKET_STATUS_META (lib/tickets/ticket-status.ts) selon le domaine, ou dans la table `catalog` passée
 * par l'appelant (domaine « notification »), en casse de phrase. Le point de couleur double le libellé, il
 * ne le remplace pas.
 */
export const StatusBadge: React.FC<StatusBadgeProps> = (props) => {
  const { size = 'md', className } = props;
  const meta = metaOf(props);
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

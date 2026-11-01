import React from 'react';
import { EVENT_STATUS_META, isEventStatus } from '@/lib/events/event-status';
import { cn } from './cn';
import { TONE_DOT, TONE_SOFT, type Tone } from './tones';

/** Domaines de statut couverts. Les autres domaines (billets, paiements…) restent sur Badge.tsx tant qu'ils ne sont pas migrés. */
export type StatusDomain = 'event';

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

function metaOf(domain: StatusDomain, status: string | null | undefined): { label: string; tone: Tone; description?: string } {
  if (domain === 'event' && isEventStatus(status)) return EVENT_STATUS_META[status];
  return { label: UNKNOWN_LABEL, tone: 'neutral' };
}

/**
 * Pastille de statut (contrat Q) : libellé, ton et description lus dans EVENT_STATUS_META (contrat B),
 * en casse de phrase. Le point de couleur double le libellé, il ne le remplace pas.
 */
export const StatusBadge: React.FC<StatusBadgeProps> = ({ domain, status, size = 'md', className }) => {
  const meta = metaOf(domain, status);
  return (
    <span
      className={cn('inline-flex max-w-full items-center whitespace-nowrap border font-semibold leading-tight', TONE_SOFT[meta.tone], SIZES[size], className)}
      title={meta.description}
    >
      <span className={cn('h-1.5 w-1.5 flex-shrink-0 rounded-full', TONE_DOT[meta.tone])} aria-hidden="true" />
      <span className="truncate">{meta.label}</span>
    </span>
  );
};

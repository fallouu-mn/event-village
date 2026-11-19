'use client';

import React from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/components/ui/cn';
import { categoryClasses } from './wallet';

/**
 * Décision du 19/11 (Mes billets, option 1) — vignette légère d'un billet, façon Wallet : couleur de la catégorie, titre,
 * date, heure et lieu. Seul le billet visible est dessiné en entier (QR compris) ; une vignette se déplie au défilement
 * (le billet arrive à l'écran) ou au toucher. Rien n'est perdu : le billet complet, son code d'entrée et son
 * enregistrement hors ligne (synchronisation de tous les billets) ne dépendent pas de la vignette.
 */
export interface TicketThumbProps {
  title: string;
  ticketNumber: string;
  seat?: string;
  dateFormatted: string;
  timeFormatted: string;
  venue: string;
  categoryColor?: string | null;
  onOpen: () => void;
}

export function TicketThumb({ title, ticketNumber, seat, dateFormatted, timeFormatted, venue, categoryColor, onOpen }: TicketThumbProps) {
  return (
    <article aria-label={`Billet pour ${title}`} data-ev-ticket-thumb="" className="w-full overflow-hidden rounded-2xl border border-border bg-card shadow-md">
      <button
        type="button"
        onClick={onOpen}
        className={cn(
          'ev-press flex min-h-11 w-full flex-col gap-1 px-4 py-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
          categoryClasses(categoryColor),
        )}
      >
        {seat && (
          <span className="truncate text-sm font-semibold">
            <span className="sr-only">Catégorie : </span>
            {seat}
          </span>
        )}
        <span className="line-clamp-2 text-lg font-bold leading-snug">{title}</span>
        <span className="text-sm">
          {dateFormatted} · {timeFormatted} · {venue}
        </span>
        <span className="text-sm">
          <span className="sr-only">Numéro du billet : </span>
          <span className="font-mono tabular-nums">{ticketNumber}</span>
        </span>
        <span className="mt-1 inline-flex items-center gap-1.5 text-sm font-semibold">
          Afficher le billet
          <ChevronDown size={16} aria-hidden="true" />
        </span>
      </button>
    </article>
  );
}

'use client';

import React from 'react';
import Link from 'next/link';
import { shortWhen } from '@/lib/events/calendar-days';
import { priceBadge, type PublicMapEvent } from '@/lib/events/map-shared';
import { cn } from '@/components/ui/cn';

/**
 * Lot Carte B — vignette d'un événement de la carte et du calendrier (feuille du téléphone, liste de l'ordinateur,
 * feuille d'un jour). Seules les données publiques de la carte : petite image floutée de l'affiche sur sa couleur (aucune
 * grande image chargée), titre, date, prix d'appel, « À la une ». Toute la vignette mène à la fiche (achat).
 */

/** Vignette ronde de l'affiche : image floutée sur la couleur de l'affiche (décorative : le titre est écrit à côté). */
export function PosterDot({ event, size = 'md', className }: { event: Pick<PublicMapEvent, 'color' | 'blur'>; size?: 'sm' | 'md' | 'lg'; className?: string }) {
    const dims = size === 'sm' ? 'h-6 w-6' : size === 'lg' ? 'h-14 w-14' : 'h-11 w-11';
    return (
        <span
            aria-hidden="true"
            className={cn('relative inline-block flex-shrink-0 overflow-hidden rounded-full ring-2 ring-card', dims, className)}
            style={{ backgroundColor: event.color }}
        >
            {event.blur && (
                // Image de 24 px au plus, inscrite dans la page (data:) : aucune requête
                // eslint-disable-next-line @next/next/no-img-element
                <img src={event.blur} alt="" className="h-full w-full scale-110 object-cover" draggable={false} />
            )}
        </span>
    );
}

/** Date lisible d'un événement de la carte : « sam. 13 déc. · 20:00 » (Dakar = UTC). */
export function mapEventWhen(e: Pick<PublicMapEvent, 'startsAt'>): string {
    return shortWhen(e.startsAt);
}

export function MapEventCard({
    event,
    highlighted = false,
    onHover,
    action,
    className,
}: {
    event: PublicMapEvent;
    highlighted?: boolean;
    /** Survol ou focus de la vignette (liste de l'ordinateur : repère mis en évidence). */
    onHover?: (id: string | null) => void;
    /** Libellé du lien (défaut : le titre seul ; « Voir l'événement » ou « Acheter » dans les feuilles). */
    action?: string;
    className?: string;
}) {
    const price = priceBadge(event.price);
    return (
        <Link
            href={`/events/${event.id}`}
            prefetch={false}
            onMouseEnter={onHover ? () => onHover(event.id) : undefined}
            onMouseLeave={onHover ? () => onHover(null) : undefined}
            onFocus={onHover ? () => onHover(event.id) : undefined}
            onBlur={onHover ? () => onHover(null) : undefined}
            className={cn(
                'ev-press group flex min-h-16 items-center gap-3 rounded-xl border bg-card p-3 transition-colors duration-fast',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                highlighted ? 'border-brand-vif' : 'border-border hover:bg-muted',
                className,
            )}
        >
            <PosterDot event={event} size="lg" />
            <span className="min-w-0 flex-1">
                <span className="line-clamp-2 text-base font-semibold leading-snug text-foreground-strong">{event.title}</span>
                <span className="mt-0.5 block text-sm text-muted-foreground">{mapEventWhen(event)}</span>
                <span className="mt-1 flex flex-wrap items-center gap-1.5">
                    {event.highlight && (
                        <small data-ev-caption="" className="inline-flex items-center rounded-full bg-brand-vif px-2 text-caption font-bold text-brand-vif-foreground">
                            À la une
                        </small>
                    )}
                    {price && (
                        <span className="inline-flex items-center rounded-full bg-primary-soft px-2 text-sm font-semibold tabular-nums text-primary-text">{price}</span>
                    )}
                </span>
            </span>
            {action && (
                <span className="flex-shrink-0 rounded-lg px-2 text-sm font-semibold text-primary-text group-hover:underline">{action}</span>
            )}
        </Link>
    );
}

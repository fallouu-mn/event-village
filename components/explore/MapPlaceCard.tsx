'use client';

import React, { useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Users } from 'lucide-react';
import { cn } from '@/components/ui/cn';
import { eventImageSrc } from '@/lib/events/event-image';
import { openingState, placePriceBadge, type PublicMapPlace } from '@/lib/lieux/carte-lieux';
import { HALL_ICON_SVG, RESTO_ICON_SVG } from './place-markers';

/**
 * Lot Carte B3 — vignette d'une salle ou d'un restaurant de la carte (liste de l'ordinateur, feuille du téléphone).
 * Seules les données publiques de la carte (lib/lieux/carte-lieux.ts) : photos, nom, quartier, prix d'appel, capacité,
 * « Ouvert maintenant » ou « Fermé · ouvre à 19 h » (horaires du lot 11b, heure de Dakar). La vignette mène à la fiche (la réservation se fait là, jamais depuis la carte).
 */

export function placeHref(p: Pick<PublicMapPlace, 'type' | 'id'>): string {
    return p.type === 'salle' ? `/halls/${p.id}` : `/tables/${p.id}`;
}

function TypeIcon({ type, className }: { type: PublicMapPlace['type']; className?: string }) {
    // SVG de place-markers.ts (mêmes dessins que les repères), décoratif
    return <span aria-hidden="true" className={cn('inline-flex', className)} dangerouslySetInnerHTML={{ __html: type === 'salle' ? HALL_ICON_SVG : RESTO_ICON_SVG }} />;
}

function Facts({ place, now }: { place: PublicMapPlace; now: Date }) {
    const opening = place.type === 'restaurant' ? openingState(place.hours, now) : null;
    return (
        <>
            <span className="mt-0.5 flex items-center gap-1.5 text-sm text-muted-foreground">
                <TypeIcon type={place.type} className="text-primary-text" />
                <span className="truncate">{[place.type === 'salle' ? 'Salle' : 'Restaurant', place.area].filter(Boolean).join(' · ')}</span>
            </span>
            <span className="mt-1 flex flex-wrap items-center gap-1.5">
                <span className="inline-flex items-center whitespace-nowrap rounded-full bg-primary-soft px-2 text-sm font-semibold tabular-nums text-primary-text">
                    {placePriceBadge(place)}
                </span>
                {place.capacity !== null && (
                    <span className="inline-flex items-center gap-1 whitespace-nowrap text-sm text-muted-foreground">
                        <Users size={14} aria-hidden="true" />
                        {place.type === 'salle' ? `jusqu’à ${place.capacity.toLocaleString('fr-FR')}` : `${place.capacity.toLocaleString('fr-FR')} places`}
                    </span>
                )}
                {opening && (
                    <span className={cn('inline-flex items-center gap-1 whitespace-nowrap text-sm font-semibold', opening.open ? 'text-success-text' : 'text-muted-foreground')}>
                        <span aria-hidden="true" className={cn('h-2 w-2 rounded-full', opening.open ? 'bg-success-text' : 'bg-muted-foreground')} />
                        {opening.text}
                    </span>
                )}
            </span>
        </>
    );
}

/** Vignette de la liste de l'ordinateur (et d'un groupe au même endroit). */
export function MapPlaceCard({ place, highlighted = false, onHover, action, className }: {
    place: PublicMapPlace;
    highlighted?: boolean;
    onHover?: (id: string | null) => void;
    action?: string;
    className?: string;
}) {
    return (
        <Link
            href={placeHref(place)}
            prefetch={false}
            onMouseEnter={onHover ? () => onHover(place.id) : undefined}
            onMouseLeave={onHover ? () => onHover(null) : undefined}
            onFocus={onHover ? () => onHover(place.id) : undefined}
            onBlur={onHover ? () => onHover(null) : undefined}
            className={cn(
                'ev-press group flex min-h-16 items-center gap-3 rounded-xl border bg-card p-3 transition-colors duration-fast',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                highlighted ? 'border-brand-vif' : 'border-border hover:bg-muted',
                className,
            )}
        >
            <span className="relative h-14 w-14 flex-shrink-0 overflow-hidden rounded-lg bg-muted" aria-hidden="true">
                <Image src={eventImageSrc(place.photos[0] ?? null)} alt="" fill sizes="56px" className="object-cover" loading="lazy" />
            </span>
            <span className="min-w-0 flex-1">
                <span className="line-clamp-2 text-base font-semibold leading-snug text-foreground-strong">{place.name}</span>
                <Facts place={place} now={new Date()} />
                {action && <span className="mt-1 block text-sm font-semibold text-primary-text group-hover:underline">{action}</span>}
            </span>
        </Link>
    );
}

function reducedMotion(): boolean {
    return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Feuille du téléphone : photos qui glissent (défilement au doigt, aimanté ; boutons « Photo précédente » et « Photo
 * suivante » ; aucun défilement automatique), puis les faits et le lien vers la fiche.
 */
export function PlaceSheetCard({ place }: { place: PublicMapPlace }) {
    const stripRef = useRef<HTMLUListElement | null>(null);
    const [index, setIndex] = useState(0);
    const photos = place.photos.length > 0 ? place.photos : [null];
    const go = (delta: number) => {
        const strip = stripRef.current;
        if (!strip) return;
        const next = Math.min(Math.max(index + delta, 0), photos.length - 1);
        strip.scrollTo({ left: next * strip.clientWidth, behavior: reducedMotion() ? 'auto' : 'smooth' });
        setIndex(next);
    };
    const onScroll = () => {
        const strip = stripRef.current;
        if (strip && strip.clientWidth > 0) setIndex(Math.round(strip.scrollLeft / strip.clientWidth));
    };
    const kind = place.type === 'salle' ? 'la salle' : 'l’établissement';
    return (
        <div>
            <div className="relative overflow-hidden rounded-xl bg-muted">
                <ul
                    ref={stripRef}
                    onScroll={onScroll}
                    aria-label={`Photos de ${place.name}`}
                    className="flex aspect-[2/1] snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                >
                    {photos.map((src, i) => (
                        <li key={`${src ?? 'aucune'}-${i}`} className="relative h-full w-full flex-shrink-0 snap-center" aria-label={`Photo ${i + 1} sur ${photos.length}`}>
                            <Image src={eventImageSrc(src)} alt="" fill sizes="(min-width: 1024px) 20rem, 100vw" className="object-cover" loading="lazy" />
                        </li>
                    ))}
                </ul>
                {photos.length > 1 && (
                    <>
                        <button type="button" onClick={() => go(-1)} disabled={index === 0} aria-label="Photo précédente"
                            className="absolute left-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-card/90 text-foreground-strong shadow-sm transition-opacity duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-0">
                            <ChevronLeft size={20} aria-hidden="true" />
                        </button>
                        <button type="button" onClick={() => go(1)} disabled={index === photos.length - 1} aria-label="Photo suivante"
                            className="absolute right-2 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-card/90 text-foreground-strong shadow-sm transition-opacity duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-0">
                            <ChevronRight size={20} aria-hidden="true" />
                        </button>
                        <span className="pointer-events-none absolute bottom-2 right-2 rounded-full bg-card/90 px-2 text-sm font-semibold tabular-nums text-foreground-strong" aria-hidden="true">
                            {`${index + 1} / ${photos.length}`}
                        </span>
                    </>
                )}
            </div>
            <p className="mt-3 line-clamp-2 text-lg font-bold leading-snug text-foreground-strong">{place.name}</p>
            <div className="flex flex-col">
                <Facts place={place} now={new Date()} />
            </div>
            <Link
                href={placeHref(place)}
                prefetch={false}
                className="ev-press mt-3 flex min-h-11 w-full items-center justify-center rounded-xl bg-primary px-4 text-base font-semibold text-primary-foreground transition-colors duration-fast hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
                {`Voir ${kind}`}
            </Link>
        </div>
    );
}

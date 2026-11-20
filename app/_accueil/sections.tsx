import React from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { EventCard } from '@/components/events/EventCard';
import { cn } from '@/components/ui/cn';
import type { CatalogEventDto } from '@/lib/events/catalog.server';

/**
 * Design 1b (point 3) — briques serveur des sections de l'accueil : en-tête de section et rangées de cartes. Les rangées
 * défilent au doigt sur téléphone en CSS seulement (scroll-snap, aucun JavaScript) et deviennent des grilles sur
 * ordinateur. Place réservée partout (affiches en aspect-ratio) : rien ne saute au chargement.
 */

/** Rangée sur téléphone (-mx-4 annule la gouttière de 16 px : les cartes vont jusqu'au bord), grille dès 640 px. */
export const ROW = '-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto overscroll-x-contain px-4 pb-2 no-scrollbar sm:mx-0 sm:grid sm:snap-none sm:grid-cols-3 sm:gap-5 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-4';
export const ROW_ITEM = 'w-[64%] flex-none snap-start sm:w-auto';
export const ROW_SIZES = '(max-width: 640px) 64vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 300px';

export function SectionHead({ id, title, hint, href, linkLabel, aside }: {
  id: string;
  title: string;
  hint?: string;
  href?: string;
  linkLabel?: string;
  aside?: React.ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-3">
      <div className="min-w-0 space-y-1">
        <h2 id={id} className="text-xl font-bold tracking-tight text-foreground-strong sm:text-2xl">{title}</h2>
        {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
        {aside}
      </div>
      {href && linkLabel && (
        <Link
          href={href}
          prefetch={false}
          className="ev-press inline-flex min-h-11 flex-shrink-0 items-center gap-1.5 rounded-lg px-2 text-sm font-semibold text-primary-text hover:bg-primary-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          {linkLabel}
          <ArrowRight size={16} aria-hidden="true" />
        </Link>
      )}
    </div>
  );
}

export type CardData = CatalogEventDto & { highlight?: string | null };

/** Propriétés de la carte à partir d'une carte du catalogue. */
export function cardProps(e: CardData) {
  return {
    id: e.id,
    title: e.title,
    subtitle: e.subtitle,
    imageUrl: e.imageUrl,
    posterColor: e.posterColor,
    dateFormatted: e.dateFormatted,
    dayNumber: e.dayNumber,
    monthShort: e.monthShort,
    timeFormatted: e.timeFormatted,
    venue: e.venue,
    city: e.city,
    categoryLabel: e.categoryLabel,
    price: e.price,
    paidFrom: e.paidFrom,
    saleLabel: e.saleLabel,
    stock: e.stock,
    startsAt: e.startsAt,
    endsAt: e.endsAt,
    highlight: e.highlight ?? null,
  };
}

/** Rangée de cartes (cascade à l'entrée, coupée si « réduire les animations »). Jamais d'affiche prioritaire ici. */
export function CardRow({ events, className }: { events: CardData[]; className?: string }) {
  return (
    <ul data-ev-row="" className={cn(ROW, 'ev-stagger', className)}>
      {events.map((e) => (
        <li key={e.id} className={ROW_ITEM}>
          <EventCard {...cardProps(e)} sizes={ROW_SIZES} />
        </li>
      ))}
    </ul>
  );
}

/**
 * Rangée « À la une » : défile au doigt (scroll-snap, CSS seulement), première carte plus grande. Sur ordinateur, grille
 * de quatre colonnes où la première carte prend deux colonnes et deux lignes (neuf cartes au plus, sans défilement
 * horizontal à la souris). Seule la première affiche est prioritaire, et seulement si elle est l'image principale du
 * premier écran (`priorityFirst`).
 */
export function FeaturedRow({ events, priorityFirst }: { events: CardData[]; priorityFirst: boolean }) {
  return (
    <ul data-ev-row="" className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto overscroll-x-contain px-4 pb-2 no-scrollbar sm:-mx-6 sm:scroll-px-6 sm:px-6 lg:mx-0 lg:grid lg:snap-none lg:grid-cols-4 lg:gap-5 lg:overflow-visible lg:px-0 lg:pb-0">
      {events.map((e, i) => (
        <li
          key={e.id}
          className={cn(
            'flex-none snap-start',
            i === 0 ? 'w-[78%] sm:w-[48%] lg:col-span-2 lg:row-span-2 lg:w-auto' : 'w-[64%] sm:w-[36%] lg:w-auto',
            i >= 9 && 'lg:hidden',
          )}
        >
          <EventCard
            {...cardProps(e)}
            size={i === 0 ? 'feature' : 'default'}
            sizes={i === 0 ? '(max-width: 640px) 78vw, (max-width: 1024px) 48vw, 600px' : '(max-width: 640px) 64vw, (max-width: 1024px) 36vw, 300px'}
            priority={i === 0 && priorityFirst}
          />
        </li>
      ))}
    </ul>
  );
}

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowRight, CalendarDays, MapPin } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { formatFcfa } from '@/lib/format';
import { eventImageSrc } from '@/lib/events/event-image';

/**
 * Carte d'un événement du catalogue et de l'accueil (lot 5, tâche 5.3 ; contrat E et Q).
 *  - Toute la carte est un seul lien, porté par le titre (nom accessible = titre de l'événement).
 *  - Prix « à partir de » calculé par le serveur sur les catégories actives et visibles ; sans
 *    catégorie achetable : « Bientôt en vente », jamais « Gratuit » par défaut (un vrai 0 F reste
 *    « Gratuit »).
 *  - Affiche du stockage du projet seulement, sinon l'image locale neutre (lib/events/event-image.ts).
 */
export interface EventCardProps {
  id: string;
  title: string;
  /** Organisateur (nom commercial). */
  subtitle?: string | null;
  imageUrl?: string | null;
  dateFormatted: string;
  dayNumber?: string | null;
  monthShort?: string | null;
  timeFormatted?: string | null;
  venue: string;
  city?: string | null;
  categoryLabel?: string | null;
  /** Prix minimum des catégories achetables, null sans catégorie achetable. */
  price: number | null;
  /** Rang dans la grille : seules les premières affiches sont chargées en priorité. */
  priority?: boolean;
}

/** « SAINT-LOUIS » → « Saint-Louis » (le catalogue renvoie la ville en capitales). */
export function cityLabel(city: string | null | undefined): string | null {
  if (!city) return null;
  return city
    .toLowerCase()
    .split(/([\s-])/)
    .map((part) => (part.length > 0 && !/[\s-]/.test(part) ? part.charAt(0).toUpperCase() + part.slice(1) : part))
    .join('');
}

export const EventCard: React.FC<EventCardProps> = ({
  id,
  title,
  subtitle,
  imageUrl,
  dateFormatted,
  dayNumber,
  monthShort,
  timeFormatted,
  venue,
  city,
  categoryLabel,
  price,
  priority = false,
}) => {
  const onSaleSoon = price === null || !Number.isFinite(price);
  const place = [venue, cityLabel(city)].filter(Boolean).join(', ');
  const when = timeFormatted ? `${dateFormatted} à ${timeFormatted}` : dateFormatted;

  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-3xl border border-border bg-surface shadow-sm transition-shadow duration-200 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-surface hover:shadow-lg">
      <div className="relative aspect-[16/10] w-full overflow-hidden bg-surface-sunken">
        <Image
          src={eventImageSrc(imageUrl)}
          alt=""
          fill
          priority={priority}
          className="object-cover motion-safe:transition-transform motion-safe:duration-500 motion-safe:group-hover:scale-[1.03]"
          sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw"
        />
        {dayNumber && monthShort && (
          <div
            className="absolute left-3 top-3 flex min-w-14 flex-col items-center rounded-2xl border border-border bg-surface px-2.5 py-1.5 text-fg shadow-sm"
            aria-hidden="true"
          >
            <span className="text-xl font-bold leading-none tabular-nums">{dayNumber}</span>
            <span className="mt-1 text-sm font-semibold leading-none text-brand-fg">{monthShort}</span>
          </div>
        )}
        {categoryLabel && (
          <div className="absolute right-3 top-3">
            <Badge variant="default" className="shadow-sm">{categoryLabel}</Badge>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4 sm:p-5">
        <div className="min-w-0 space-y-1.5">
          {subtitle && <p className="truncate text-sm font-semibold text-brand-fg">{subtitle}</p>}
          <h3 className="line-clamp-2 text-lg font-bold leading-snug tracking-tight text-fg">
            <Link
              href={`/events/${id}`}
              className="rounded-sm after:absolute after:inset-0 after:content-[''] focus-visible:outline-none"
            >
              {title}
            </Link>
          </h3>
        </div>

        <ul className="space-y-1.5 text-sm text-fg-muted">
          <li className="flex min-w-0 items-center gap-2">
            <CalendarDays size={16} className="flex-shrink-0 text-fg-muted" aria-hidden="true" />
            <span className="truncate">{when}</span>
          </li>
          <li className="flex min-w-0 items-center gap-2">
            <MapPin size={16} className="flex-shrink-0 text-fg-muted" aria-hidden="true" />
            <span className="truncate">{place}</span>
          </li>
        </ul>

        <div className="mt-auto flex items-end justify-between gap-3 border-t border-border pt-3">
          {onSaleSoon ? (
            <div className="min-w-0">
              <p className="text-sm text-fg-muted">Billetterie</p>
              <p className="text-base font-bold text-fg">Bientôt en vente</p>
            </div>
          ) : (
            <div className="min-w-0">
              <p className="text-sm text-fg-muted">À partir de</p>
              <p className="text-base font-bold tabular-nums text-fg">{price === 0 ? 'Gratuit' : formatFcfa(price)}</p>
            </div>
          )}
          <span
            className="inline-flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-brand-bg text-brand-fg transition-colors duration-200 group-hover:bg-brand group-hover:text-on-brand"
            aria-hidden="true"
          >
            <ArrowRight size={18} />
          </span>
        </div>
      </div>
    </article>
  );
};

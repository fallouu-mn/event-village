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
 *    catégorie achetable : l'état de la vente du serveur (`saleLabel`, lot 9 bis R35 : « Vente sur place
 *    uniquement », « Complet »…), « Bientôt en vente » à défaut, jamais « Gratuit » (un vrai 0 F reste « Gratuit »).
 *  - Affiche du stockage du projet seulement, sinon l'image locale neutre (lib/events/event-image.ts).
 *  - Lot 9 ter (9t.19) : badge de stock du serveur dans le corps de la carte, le texte porte le sens (jamais la couleur seule).
 *  - Rien n'est superposé à l'affiche : le titre et la date sont souvent imprimés dans sa partie haute
 *    (relecture des captures du run 49). Pastille de date et catégorie vivent dans le corps de la carte.
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
  /** Lot 9 bis (R35, B60) : état de la vente servi par le catalogue, affiché sans prix (« Vente sur place uniquement »). */
  saleLabel?: string | null;
  /** Lot 9 ter (9t.19) : tranche servie par le catalogue, badge « Complet » ou « Dernières places » ; jamais de nombre. */
  stock?: 'SOLD_OUT' | 'LOW' | null;
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
  saleLabel,
  stock,
  priority = false,
}) => {
  const onSaleSoon = price === null || !Number.isFinite(price);
  // Ville d'abord : c'est le lieu qui se tronque (relecture du run 111). Budget JS de / : pas d'élément de plus.
  const place = [cityLabel(city), venue].filter(Boolean).join(' · ');
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
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4 sm:p-5">
        <div className="flex min-w-0 items-start gap-3">
          {dayNumber && monthShort && (
            <div
              className="flex min-w-14 flex-shrink-0 flex-col items-center justify-center rounded-2xl border border-brand-fg/20 bg-brand-bg px-2.5 py-2 text-brand-fg"
              aria-hidden="true"
            >
              <span className="text-xl font-bold leading-none tabular-nums">{dayNumber}</span>
              <span className="mt-1 text-sm font-semibold leading-none">{monthShort}</span>
            </div>
          )}
          <div className="min-w-0 flex-1 space-y-1">
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
        </div>

        {(stock || categoryLabel) && (
          <div className="flex flex-wrap gap-2">
            {stock === 'SOLD_OUT' ? <Badge variant="danger">Complet</Badge> : stock === 'LOW' && <Badge variant="warning">Dernières places</Badge>}
            {categoryLabel && <Badge variant="neutral">{categoryLabel}</Badge>}
          </div>
        )}

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
              <p className="text-base font-bold text-fg">{saleLabel || 'Bientôt en vente'}</p>
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

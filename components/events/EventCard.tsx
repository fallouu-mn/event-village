import React from 'react';
import Image, { getImageProps } from 'next/image';
import Link from 'next/link';
import { CalendarDays, MapPin } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/components/ui/cn';
import { cardPrice, cardWhen } from '@/lib/events/catalog-display';
import { eventImageSrc } from '@/lib/events/event-image';
import { CARD_LINK_ATTR } from './CardLink';
import { LIVE_BADGE_ATTR } from './CardLiveBadge';

/**
 * Carte d'un événement du catalogue et de l'accueil (lot 5, tâche 5.3 ; contrat E et Q ; design 1b, point 4).
 *  - Toute la carte est un seul lien, porté par le titre (nom accessible = titre de l'événement) ; transition de vue
 *    carte → fiche par le navigateur (îlot unique CardTransitions de la page : l'affiche prend `ev-poster-<id>` au toucher,
 *    comme celle de la fiche).
 *  - Design 1b (run 376, temps de blocage de l'accueil) : AUCUN îlot client par carte. Lien `next/link` marqué
 *    `data-ev-card-link`, badge « En cours » rendu masqué et affiché par l'îlot unique CardLiveBadges, image en <img> simple
 *    (getImageProps) sauf la carte prioritaire (image principale : préchargée, fetchpriority=high).
 *  - Affiche 16/10 (4/3 pour la grande carte de « À la une » sur téléphone), place réservée : rien ne saute. Sur
 *    l'affiche, seulement : la pastille de date (coin haut droit), l'étiquette de mise en avant et le badge « En cours »
 *    (calculé sur le téléphone, jamais figé dans une page en cache). Aucun dégradé sur l'affiche.
 *  - Prix : « Gratuit », « Gratuit ou dès … », « Dès … » (catalog-display) ; sans catégorie achetable : l'état de la vente
 *    du serveur (`saleLabel`, lot 9 bis R35 : « Vente sur place uniquement », « Complet »…), « Bientôt en vente » à défaut.
 *  - Lot 9 ter (9t.19) : badge de stock du serveur dans le corps de la carte, jamais sur l'affiche (titres souvent
 *    imprimés en haut des affiches) ; le texte porte le sens (jamais la couleur seule). « Dernières places » : places
 *    restantes en ligne au plus à 10 % de la jauge (lib/events/catalog.server.ts, lowStockLimit).
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
  /** Design 1b : plus petit prix payant achetable (« Gratuit ou dès … »). */
  paidFrom?: number | null;
  /** Lot 9 bis (R35, B60) : état de la vente servi par le catalogue, affiché sans prix (« Vente sur place uniquement »). */
  saleLabel?: string | null;
  /** Lot 9 ter (9t.19) : tranche servie par le catalogue, badge « Complet » ou « Dernières places » ; jamais de nombre. */
  stock?: 'SOLD_OUT' | 'LOW' | null;
  /** Design 1b : début et fin retenue (instants ISO) : date lisible et badge « En cours ». */
  startsAt?: string | null;
  endsAt?: string | null;
  /** Design 1b : étiquette de mise en avant déjà traduite (« À la une »), posée sur l'affiche. */
  highlight?: string | null;
  /** Design 1b : `feature` = première carte de « À la une », plus grande. */
  size?: 'default' | 'feature';
  /** Largeur affichée de l'affiche (attribut `sizes`) ; par défaut, celle d'une grille 1, 2 puis 3 colonnes. */
  sizes?: string;
  /** Seule l'image principale du premier écran est chargée en priorité. */
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

const GRID_SIZES = '(max-width: 640px) calc(100vw - 32px), (max-width: 1280px) 50vw, 400px';

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
  paidFrom = null,
  saleLabel,
  stock,
  startsAt,
  endsAt,
  highlight,
  size = 'default',
  sizes = GRID_SIZES,
  priority = false,
}) => {
  const feature = size === 'feature';
  // Ville d'abord : c'est le lieu qui se tronque (relecture du run 111).
  const place = [cityLabel(city), venue].filter(Boolean).join(' · ');
  const when = cardWhen(startsAt, timeFormatted) || (timeFormatted ? `${dateFormatted} à ${timeFormatted}` : dateFormatted);
  const priceLine = cardPrice({ price, paidFrom, saleLabel });

  return (
    <article className="ev-press group relative flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card shadow-sm transition-[box-shadow,border-color] duration-fast ease-standard focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background hover:border-primary-text/40 hover:shadow-md">
      <div data-ev-poster={id} className={cn('relative w-full overflow-hidden bg-muted', feature ? 'aspect-[4/3] sm:aspect-[16/10] lg:aspect-auto lg:min-h-64 lg:flex-1' : 'aspect-[16/10]')}>
        {priority ? (
          <Image src={eventImageSrc(imageUrl)} alt="" fill priority fetchPriority="high" sizes={sizes} className="object-cover" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text -- props de next/image (srcset, tailles), sans composant client
          <img {...getImageProps({ src: eventImageSrc(imageUrl), alt: '', fill: true, sizes, className: 'object-cover' }).props} />
        )}
        {highlight && (
          <small className="absolute left-3 top-3 rounded-lg bg-brand-vif px-2.5 py-1 text-caption font-bold text-brand-vif-foreground shadow-sm">
            {highlight}
          </small>
        )}
        {startsAt && endsAt && (
          <small
            {...{ [LIVE_BADGE_ATTR]: '' }}
            data-starts={startsAt}
            data-ends={endsAt}
            hidden
            className={cn('pointer-events-none absolute left-3 inline-flex items-center gap-1.5 rounded-full bg-black/80 px-2.5 py-1 text-caption font-bold text-white shadow-sm', highlight ? 'top-11' : 'top-3')}
          >
            <span aria-hidden="true" className="ev-live-dot relative inline-flex h-2 w-2 rounded-full bg-scan-accept-bg" />
            En cours
          </small>
        )}
        {dayNumber && monthShort && (
          <span
            className="absolute right-3 top-3 flex min-w-12 flex-col items-center rounded-lg bg-popover px-2 py-1.5 leading-none text-foreground-strong shadow-sm"
            aria-hidden="true"
          >
            <span className="text-lg font-extrabold tabular-nums">{dayNumber}</span>
            <small className="mt-0.5 text-caption font-bold text-primary-text">{monthShort}</small>
          </span>
        )}
      </div>

      <div className={cn('flex flex-1 flex-col gap-1.5', feature ? 'p-4 sm:p-5' : 'p-4')}>
        {subtitle && <p className="break-words text-sm font-semibold text-primary-text">{subtitle}</p>}
        <h3 className={cn('break-words font-bold leading-snug tracking-tight text-foreground-strong', feature ? 'text-xl sm:text-2xl' : 'text-lg')}>
          <Link
            href={`/events/${id}`}
            prefetch={false}
            {...{ [CARD_LINK_ATTR]: id }}
            className="rounded-sm after:absolute after:inset-0 after:content-[''] focus-visible:outline-none"
          >
            {title}
          </Link>
        </h3>
        <p className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
          <CalendarDays size={16} className="flex-shrink-0" aria-hidden="true" />
          <span className="min-w-0 break-words">{when}</span>
        </p>
        <p className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
          <MapPin size={16} className="flex-shrink-0" aria-hidden="true" />
          <span className="min-w-0 break-words">{place}</span>
        </p>

        {(stock || categoryLabel) && (
          <div className="flex flex-wrap gap-2 pt-1">
            {stock === 'SOLD_OUT' ? <Badge variant="danger">Complet</Badge> : stock === 'LOW' && <Badge variant="warning">Dernières places</Badge>}
            {categoryLabel && <Badge variant="neutral">{categoryLabel}</Badge>}
          </div>
        )}

        <p className="mt-auto flex min-w-0 items-baseline gap-1.5 border-t border-border pt-3">
          {priceLine.lead && <span className="text-sm text-muted-foreground">{priceLine.lead}</span>}
          <span className="whitespace-nowrap text-base font-extrabold tabular-nums text-foreground-strong">{priceLine.value}</span>
        </p>
      </div>
    </article>
  );
};

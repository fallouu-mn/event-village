import React, { type CSSProperties } from 'react';
import Image, { getImageProps } from 'next/image';
import Link from 'next/link';
import { CalendarDays, MapPin } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { cn } from '@/components/ui/cn';
import { cardPrice, cardWhen } from '@/lib/events/catalog-display';
import { eventImageSrc } from '@/lib/events/event-image';
import { posterColorOrFallback } from '@/lib/events/poster-color';
import { POSTER_FADE_ATTR } from '@/lib/ui/poster-fade';
import { CARD_LINK_ATTR } from './CardLink';
import { CARD_COUNTDOWN_ATTR, LIVE_BADGE_ATTR } from './CardLiveBadge';
import { FavoriteHeart } from './FavoriteHeart';

/**
 * Carte d'un événement du catalogue et de l'accueil (lot 5, tâche 5.3 ; contrat E et Q ; design 1b, point 4 ; design 1d,
 * point 2).
 *  - Design 1d : carte VERTICALE. Affiche en 4:5 montrée en entier (`object-contain`, jamais rognée sur son texte), sur
 *    la couleur de l'affiche (`--poster`, contraste ≥ 4,5:1 avec le blanc, « bleu nuit » à défaut) ; bas de carte en
 *    dégradé de cette couleur ; titre blanc entier (retour à la ligne), date, compte à rebours, catégorie, lieu, prix
 *    d'appel dans une pastille orange. Pendant le chargement, la carte montre déjà sa couleur ; l'image arrive en fondu
 *    (script de app/layout.tsx), jamais de flash blanc ; l'image principale (préchargée) n'attend pas.
 *  - Toute la carte est un seul lien, porté par le titre (nom accessible = titre) ; transition de vue carte → fiche par
 *    l'îlot unique CardTransitions. Cœur des favoris (FavoriteHeart) au-dessus du lien, mis à jour par l'îlot unique
 *    CardFavorites. Badges « En cours » et compte à rebours rendus masqués, affichés par l'îlot unique CardLiveBadges
 *    (heure du téléphone : jamais figés dans une page en cache). AUCUN îlot client par carte (run 376).
 *  - Lot 9 ter (9t.19) : badge de stock dans le bas de la carte, jamais sur l'affiche ; le texte porte le sens.
 *  - Affiche du stockage du projet seulement, sinon l'image locale neutre (lib/events/event-image.ts).
 */
export interface EventCardProps {
  id: string;
  title: string;
  /** Organisateur (nom commercial). Gardé pour les appelants ; non affiché depuis le design 1d (carte d'affiche). */
  subtitle?: string | null;
  imageUrl?: string | null;
  /** Design 1d : couleur de l'affiche (catalogue), « bleu nuit » à défaut. */
  posterColor?: string | null;
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
  /** Design 1b : début et fin retenue (instants ISO) : date lisible, badge « En cours », compte à rebours. */
  startsAt?: string | null;
  endsAt?: string | null;
  /** Design 1b : étiquette de mise en avant déjà traduite (« À la une »), posée sur l'affiche. */
  highlight?: string | null;
  /** `feature` = première carte de « À la une », plus grande ; `compact` = grille de deux colonnes sur téléphone. */
  size?: 'default' | 'feature' | 'compact';
  /** Largeur affichée de l'affiche (attribut `sizes`) ; par défaut, celle d'une grille 2, 3 puis 4 colonnes. */
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

const GRID_SIZES = '(max-width: 640px) 50vw, (max-width: 1024px) 33vw, (max-width: 1280px) 25vw, 300px';

export const EventCard: React.FC<EventCardProps> = ({
  id,
  title,
  imageUrl,
  posterColor,
  dateFormatted,
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
  const compact = size === 'compact';
  // Ville d'abord : c'est le lieu qui se tronque (relecture du run 111).
  const place = [cityLabel(city), venue].filter(Boolean).join(' · ');
  const when = cardWhen(startsAt, timeFormatted) || (timeFormatted ? `${dateFormatted} à ${timeFormatted}` : dateFormatted);
  const priceLine = cardPrice({ price, paidFrom, saleLabel });
  const style = { '--poster': posterColorOrFallback(posterColor) } as CSSProperties;

  return (
    <article
      style={style}
      className="ev-press ev-lift ev-poster-card group relative flex h-full flex-col overflow-hidden rounded-2xl shadow-sm focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background"
    >
      <div data-ev-poster={id} className={cn('relative w-full overflow-hidden', feature ? 'aspect-[4/5] lg:aspect-auto lg:min-h-80 lg:flex-1' : 'aspect-[4/5]')}>
        {priority ? (
          <Image src={eventImageSrc(imageUrl)} alt="" fill priority fetchPriority="high" sizes={sizes} className="object-contain" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text -- props de next/image (srcset, tailles), sans composant client
          <img {...getImageProps({ src: eventImageSrc(imageUrl), alt: '', fill: true, sizes, className: 'object-contain' }).props} {...{ [POSTER_FADE_ATTR]: '' }} />
        )}
        {highlight && (
          <small className="absolute left-2.5 top-2.5 rounded-lg bg-brand-vif px-2.5 py-1 text-caption font-bold text-brand-vif-foreground shadow-sm">
            {highlight}
          </small>
        )}
        {startsAt && endsAt && (
          <small
            {...{ [LIVE_BADGE_ATTR]: '' }}
            data-starts={startsAt}
            data-ends={endsAt}
            hidden
            className={cn('pointer-events-none absolute left-2.5 inline-flex items-center gap-1.5 rounded-full bg-black/80 px-2.5 py-1 text-caption font-bold text-white shadow-sm', highlight ? 'top-11' : 'top-2.5')}
          >
            <span aria-hidden="true" className="ev-live-dot relative inline-flex h-2 w-2 rounded-full bg-scan-accept-bg" />
            En cours
          </small>
        )}
        <FavoriteHeart id={id} title={title} className="!absolute right-1.5 top-1.5" />
      </div>

      <div className={cn('ev-poster-foot flex flex-1 flex-col gap-1.5', feature ? 'p-4 sm:p-5' : compact ? 'p-3' : 'p-4')}>
        {categoryLabel && <p className="break-words text-sm font-semibold">{categoryLabel}</p>}
        <h3 className={cn('break-words font-extrabold leading-snug tracking-tight', feature ? 'text-xl sm:text-2xl' : compact ? 'text-base' : 'text-lg')}>
          <Link
            href={`/events/${id}`}
            prefetch={false}
            {...{ [CARD_LINK_ATTR]: id }}
            className="rounded-sm after:absolute after:inset-0 after:content-[''] focus-visible:outline-none"
          >
            {title}
          </Link>
        </h3>
        <p className="flex min-w-0 items-start gap-2 text-sm font-medium">
          <CalendarDays size={16} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
          <span className="min-w-0 break-words">{when}</span>
        </p>
        {startsAt && endsAt && (
          <p {...{ [CARD_COUNTDOWN_ATTR]: '' }} data-starts={startsAt} data-ends={endsAt} hidden className="break-words text-sm font-bold" />
        )}
        {!compact && place && (
          <p className="flex min-w-0 items-start gap-2 text-sm font-medium">
            <MapPin size={16} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
            <span className="min-w-0 break-words">{place}</span>
          </p>
        )}
        {compact && city && <p className="break-words text-sm font-medium">{cityLabel(city)}</p>}

        {stock && (
          <div className="flex flex-wrap gap-2 pt-1">
            {stock === 'SOLD_OUT' ? <Badge variant="danger">Complet</Badge> : <Badge variant="warning">Dernières places</Badge>}
          </div>
        )}

        <p className="mt-auto flex min-w-0 pt-2.5">
          <span
            className={cn(
              'inline-flex max-w-full flex-wrap items-baseline gap-x-1.5 rounded-full px-3 py-1.5 text-sm font-extrabold',
              priceLine.amount || priceLine.value === 'Gratuit' ? 'bg-brand-vif text-brand-vif-foreground' : 'bg-card text-foreground-strong',
            )}
          >
            {priceLine.lead && <span className="font-semibold">{priceLine.lead}</span>}
            <span className={cn('whitespace-nowrap', priceLine.amount && 'tabular-nums')}>{priceLine.value}</span>
          </span>
        </p>
      </div>
    </article>
  );
};

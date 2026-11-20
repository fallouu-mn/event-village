import type { Metadata } from 'next';
import type { CSSProperties, ReactNode } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ArrowLeft,
  Bus,
  CalendarDays,
  Car,
  ClipboardList,
  ExternalLink,
  MapPin,
  Navigation,
  Phone,
  Ticket,
  Wallet,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { LinkButton } from '@/components/ui/LinkButton';
import { StatusBanner, type StatusBannerTone } from '@/components/ui/StatusBanner';
import { EventTicketing } from '@/components/event-page/EventTicketing';
import { LiveOnPoster } from '@/components/event-page/LiveOnPoster';
import { PendingPaymentSlot } from '@/components/event-page/PendingPaymentSlot';
import { ShareButton } from '@/components/event-page/ShareButton';
import { EventCountdown } from '@/components/event-page/Countdowns';
import { CardFavorites } from '@/components/events/CardFavorites';
import { FavoriteHeart } from '@/components/events/FavoriteHeart';
import { VenueMap } from '@/components/event-page/VenueMap';
import { readPublicSheet } from '@/lib/events/event-detail.server';
import { shareImagesFor } from '@/lib/events/share-preview.server';
import type { BannerKind, PublicEventDetail } from '@/lib/events/event-detail';
import { eventImageSrc, isProjectStorageImage } from '@/lib/events/event-image';
import { formatDate, formatDateTime } from '@/lib/format';

/**
 * Page publique d'un événement — design 1b (points 1, 6, 10, 11).
 *
 *  - Composant serveur : la fiche publique est lue côté serveur (lib/events/event-detail.server.ts, même source que
 *    GET /api/events/[id]) et la page est mise en cache 60 s (revalidate) ; le HTML ne contient QUE la fiche publique.
 *    Les parties personnelles sont des îlots du navigateur chargés après : bandeau de paiement en attente
 *    (PendingPaymentSlot, session), billetterie (EventTicketing : panier, quantités, devis, achat, temps réel du stock),
 *    « En cours » (LiveOnPoster, calculé sur le téléphone), carte du lieu (VenueMap, au toucher), partage.
 *  - Vrai 404 : événement non public, inconnu ou identifiant illisible → notFound() (layout, puis la page), sans rien
 *    laisser paraître ; une panne de lecture lève une erreur (page d'erreur avec « Réessayer », jamais mise en cache).
 *  - Affiche en grand (16/10, place réservée), seule image prioritaire (préchargée), tailles justes ; même
 *    view-transition-name que l'affiche de la carte du catalogue (ev-poster-<id>).
 *  - Bandeau suspendu, annulé ou terminé ; pour un événement annulé, l'avis public, jamais le motif interne.
 */

export const revalidate = 60;

/** Aucune fiche préparée à la construction : chacune l'est à sa première visite, puis resservie (60 s). */
export function generateStaticParams(): Array<{ id: string }> {
  return [];
}

const BANNER_TONE: Record<BannerKind, StatusBannerTone> = {
  SUSPENDU: 'suspended',
  ANNULE: 'danger',
  TERMINE: 'neutral',
};

const PROGRAM_KIND_LABEL: Record<string, string> = {
  ARTISTE: 'Artiste',
  INTERVENANT: 'Intervenant',
  ACTIVITE: 'Activité',
};

/** Largeur rendue de l'affiche : pleine largeur sur téléphone, deux tiers de 1 200 px au plus sur ordinateur. */
const POSTER_SIZES = '(min-width: 1280px) 760px, (min-width: 1024px) 62vw, 100vw';

function capitalize(text: string): string {
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}

function initialsOf(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w.charAt(0).toUpperCase()).join('') || 'EV';
}

async function sheetOf(id: string): Promise<PublicEventDetail> {
  const read = await readPublicSheet(id);
  if (read.kind === 'not-public') notFound();
  // Panne de lecture : erreur levée (app/error.tsx, « Réessayer ») ; Next ne garde pas une page en erreur.
  if (read.kind === 'unavailable') throw new Error('Fiche de l’événement momentanément indisponible.');
  return read.event;
}

export async function generateMetadata(props: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await props.params;
  const read = await readPublicSheet(id);
  if (read.kind !== 'public') return { title: 'Événement — Event Village' };
  const event = read.event;
  const description = `${capitalize(event.dateFormatted)} à ${event.time} · ${[event.venue, event.city].filter(Boolean).join(', ')}`;
  return {
    title: `${event.title} — Event Village`,
    description,
    // Design 1d (point 5) : aperçu généré seulement pour un événement publié (shareImagesFor), image du site sinon
    openGraph: {
      title: event.title,
      description,
      images: shareImagesFor(event),
    },
    twitter: { card: 'summary_large_image', title: event.title, description, images: shareImagesFor(event).map((i) => i.url) },
  };
}

function InfoRow({ icon, children, sub }: { icon: ReactNode; children: ReactNode; sub?: ReactNode }) {
  return (
    <li className="flex min-w-0 items-start gap-3">
      <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary-text" aria-hidden="true">
        {icon}
      </span>
      <div className="min-w-0 pt-0.5">
        <p className="break-words text-base font-semibold text-foreground-strong">{children}</p>
        {sub && <p className="break-words text-sm text-muted-foreground">{sub}</p>}
      </div>
    </li>
  );
}

function Section({ title, id, children }: { title: string; id: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="space-y-4 rounded-xl border border-border bg-card p-5 sm:p-6">
      <h2 id={id} className="text-xl font-bold tracking-tight text-foreground-strong">{title}</h2>
      {children}
    </section>
  );
}

function PracticalRow({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground" aria-hidden="true">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-foreground-strong">{label}</p>
        <div className="whitespace-pre-line break-words text-sm leading-relaxed text-muted-foreground">{children}</div>
      </div>
    </div>
  );
}

export default async function EventDetailPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params;
  const event = await sheetOf(id);

  const info = event.practicalInfo;
  const program = event.program.filter((item) => item && item.title);
  const hasCoordinates = typeof event.latitude === 'number' && typeof event.longitude === 'number';
  const liveEnabled = event.status === 'PUBLIE' || event.status === 'SUSPENDU';
  const placeLine = [info.address, event.city].filter(Boolean).join(' · ');
  // Moyens de paiement en ligne : événement publié avec au moins une catégorie vendue en ligne et des places. Design 1c bis
  // (erreur 418) : sans l'heure (la page est en cache) ; l'ouverture de la vente est dite par la billetterie, à l'heure du
  // téléphone. Le guichet est dit par la billetterie, seulement quand la vente en ligne est fermée.
  const showPayment = event.status === 'PUBLIE' && event.categories.some((c) => !c.isSoldOut);
  const hasPractical = Boolean(info.accessNotes || info.parking || info.contactPhone || info.rules) || showPayment;

  const heroStyle = { '--poster': event.posterColor } as CSSProperties;

  return (
    <div>
      {/* Design 1d (point 3) : haut immersif. Fond : petite image déjà floutée de l'affiche (aucun flou CSS), sous un voile
          de la couleur de l'affiche ; affiche entière au premier plan ; titre et infos en blanc sur la couleur pleine. */}
      <section
        aria-labelledby="fiche-titre"
        style={heroStyle}
        className="ev-hero ev-poster-card -mx-4 -mt-4 overflow-hidden px-4 pb-14 pt-3 sm:mx-0 sm:mt-0 sm:rounded-3xl sm:px-6 sm:pb-16 lg:px-10 lg:pt-6"
      >
        {event.posterBlur && (
          <div className="ev-hero-backdrop" aria-hidden="true">
            {/* eslint-disable-next-line @next/next/no-img-element -- image déjà floutée de 24 px en adresse data:, agrandie */}
            <img src={event.posterBlur} alt="" />
          </div>
        )}
        <div className="flex items-center justify-between gap-3">
          <Link
            href="/explore"
            className="inline-flex min-h-11 items-center gap-2 rounded-full bg-scrim/60 px-4 text-sm font-semibold text-on-tone focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ArrowLeft size={18} aria-hidden="true" />
            Retour aux événements
          </Link>
          <div className="flex items-center gap-2">
            <FavoriteHeart id={event.id} title={event.title} />
            <ShareButton title={event.title} />
          </div>
        </div>

        <div className="mt-5 grid items-end gap-6 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] lg:gap-10">
          {/* Affiche entière (4:5, jamais rognée), place réservée : aucun saut ; même nom de transition que la carte */}
          <div
            className="relative mx-auto aspect-[4/5] w-full max-w-[min(76vw,380px)] overflow-hidden rounded-2xl bg-scrim/20 shadow-lg lg:mx-0 lg:max-w-none"
            style={{ viewTransitionName: `ev-poster-${event.id}` }}
          >
            <Image
              src={eventImageSrc(event.posterUrl)}
              alt={`Affiche de l’événement ${event.title}`}
              fill
              priority
              fetchPriority="high"
              sizes={POSTER_SIZES}
              className="object-contain"
            />
            <LiveOnPoster startsAt={event.startsAt} endsAt={event.endsAt} enabled={liveEnabled} />
          </div>

          <header className="min-w-0 space-y-4 lg:pb-4">
            {event.categoryLabel && (
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="brand">{event.categoryLabel}</Badge>
              </div>
            )}
            <h1 id="fiche-titre" className="break-words text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl lg:text-5xl">{event.title}</h1>
            {event.organizer?.name && (
              <p className="text-base">
                Organisé par <span className="font-bold">{event.organizer.name}</span>
              </p>
            )}
            <ul className="space-y-2.5" aria-label="Date et lieu">
              <li className="flex min-w-0 items-start gap-2.5">
                <CalendarDays size={20} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
                <span className="min-w-0 break-words">
                  <span className="block text-base font-bold">{capitalize(event.dateFormatted)} à&nbsp;{event.time}</span>
                  {event.endFormatted && <span className="block text-sm font-medium">{capitalize(event.endFormatted)}</span>}
                </span>
              </li>
              <li className="flex min-w-0 items-start gap-2.5">
                <MapPin size={20} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
                <span className="min-w-0 break-words">
                  <span className="block text-base font-bold">{event.venue}</span>
                  {placeLine && <span className="block text-sm font-medium">{placeLine}</span>}
                </span>
              </li>
            </ul>
            {/* Design 1d (point 4) : compte à rebours à l'heure du téléphone, jamais dans la page en cache */}
            <EventCountdown startsAt={event.startsAt} endsAt={event.endsAt} enabled={liveEnabled} className="rounded-full bg-scrim/40 px-3.5 py-2 text-sm font-bold" />
          </header>
        </div>
      </section>

      {/* Feuille de contenu aux coins arrondis qui monte par-dessus le haut de la fiche */}
      <div className="ev-sheet-up relative z-[1] -mx-4 -mt-8 space-y-6 rounded-t-[28px] bg-background px-4 pt-6 sm:mx-0 sm:-mt-10 sm:rounded-3xl sm:px-6 lg:px-8">

      {event.banner && (
        <StatusBanner tone={BANNER_TONE[event.banner.kind]} title={event.banner.title}>
          <p>{event.banner.message}</p>
          {event.cancellation && (
            <div className="mt-3 space-y-1 rounded-xl border border-danger-border bg-card p-3 text-foreground-strong">
              <p className="font-semibold">Message de l’organisateur</p>
              <p className="whitespace-pre-line">{event.cancellation.publicNotice}</p>
              <p className="text-muted-foreground">
                Annulé le <time dateTime={event.cancellation.cancelledAt}>{formatDateTime(event.cancellation.cancelledAt)}</time>
              </p>
            </div>
          )}
        </StatusBanner>
      )}

      {/* Session : îlot du navigateur, rien dans le HTML en cache */}
      <PendingPaymentSlot eventId={event.id} />

      <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-3">
        <article className="min-w-0 space-y-6 lg:col-span-2">
          <ul className="space-y-4" aria-label="Infos de l’événement">
            <InfoRow icon={<Ticket size={20} />} sub="Présentez son QR code à l’entrée, depuis Mes billets.">
              Billet dans l’application
            </InfoRow>
          </ul>

          <Section title="À propos" id="fiche-a-propos">
            <p className="whitespace-pre-line break-words text-base leading-relaxed text-foreground">{event.description}</p>
          </Section>

          {program.length > 0 && (
            <Section title="Programme" id="fiche-programme">
              <ol className="space-y-4 border-l-2 border-border pl-5">
                {program.map((item, idx) => (
                  <li key={item.id || `${item.time ?? ''}-${idx}`} className="relative">
                    <span className="absolute -left-[27px] top-1.5 h-3 w-3 rounded-full border-2 border-card bg-brand-vif" aria-hidden="true" />
                    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      {(item.day || item.time) && (
                        <p className="text-sm font-semibold tabular-nums text-primary-text">
                          {[item.day ? formatDate(item.day) : null, item.time].filter(Boolean).join(' à ')}
                        </p>
                      )}
                      {item.kind && PROGRAM_KIND_LABEL[item.kind] && (
                        <Badge variant="neutral" size="sm">{PROGRAM_KIND_LABEL[item.kind]}</Badge>
                      )}
                    </div>
                    <p className="mt-1 text-base font-semibold text-foreground-strong">{item.title}</p>
                    {item.participant && <p className="text-sm text-foreground-strong">{item.participant}</p>}
                    {item.description && <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{item.description}</p>}
                  </li>
                ))}
              </ol>
            </Section>
          )}

          <Section title="Lieu et accès" id="fiche-lieu">
            <div>
              <p className="text-base font-semibold text-foreground-strong">{event.venue}</p>
              {placeLine && <p className="text-sm text-muted-foreground">{placeLine}</p>}
            </div>

            {hasCoordinates && (
              <>
                <VenueMap latitude={event.latitude as number} longitude={event.longitude as number} venueName={event.venue} eventName={event.title} />
                <LinkButton
                  href={`https://www.google.com/maps/dir/?api=1&destination=${event.latitude},${event.longitude}`}
                  external
                  variant="secondary"
                  leftIcon={<Navigation size={18} />}
                  rightIcon={<ExternalLink size={16} />}
                >
                  Voir l’itinéraire
                </LinkButton>
              </>
            )}

            {hasPractical && (
            <div className="space-y-4 border-t border-border pt-4">
              {info.accessNotes && (
                <PracticalRow icon={<Bus size={18} />} label="Accès et transports">{info.accessNotes}</PracticalRow>
              )}
              {info.parking && (
                <PracticalRow icon={<Car size={18} />} label="Stationnement">{info.parking}</PracticalRow>
              )}
              {showPayment && (
                <PracticalRow icon={<Wallet size={18} />} label="Paiement">
                  Wave ou Orange Money, en ligne. Les frais de service s’affichent avant le paiement.
                </PracticalRow>
              )}
              {info.contactPhone && (
                <PracticalRow icon={<Phone size={18} />} label="Contact de l’organisateur">
                  <a
                    href={`tel:${info.contactPhoneTel ?? info.contactPhone.replace(/\s+/g, '')}`}
                    className="inline-flex min-h-11 items-center font-semibold text-primary-text underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {info.contactPhone}
                  </a>
                </PracticalRow>
              )}
              {info.rules && (
                <PracticalRow icon={<ClipboardList size={18} />} label="Règlement et consignes">{info.rules}</PracticalRow>
              )}
            </div>
            )}
          </Section>

          {event.organizer?.name && (
            <section aria-label="Organisateur" className="flex items-center gap-4 rounded-xl border border-border bg-card p-5">
              <div className="relative flex h-12 w-12 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-primary-soft text-base font-bold text-primary-text">
                {isProjectStorageImage(event.organizer.avatar) ? (
                  <Image src={event.organizer.avatar} alt="" fill className="object-cover" sizes="48px" />
                ) : (
                  <span aria-hidden="true">{initialsOf(event.organizer.name)}</span>
                )}
              </div>
              <div className="min-w-0">
                <p className="text-sm text-muted-foreground">Organisateur</p>
                <p className="truncate text-base font-bold text-foreground-strong">{event.organizer.name}</p>
              </div>
            </section>
          )}
        </article>

        {/* Billetterie : îlot du navigateur (panier, devis, achat, temps réel), rendu d'abord avec la fiche publique */}
        <aside
          id="billetterie"
          aria-labelledby="billetterie-titre"
          className="min-w-0 rounded-xl border border-border bg-card p-5 shadow-sm sm:p-6 lg:sticky lg:top-20"
        >
          <EventTicketing initial={event} />
        </aside>
      </div>
      </div>

      {/* Design 1d (point 8) : un seul îlot pour le cœur des favoris de la fiche */}
      <CardFavorites />
    </div>
  );
}

'use client';

/**
 * Lot 11b (administration) : fiche de décision d'un établissement de la réservation de tables (droit halls.validate).
 * Même gabarit que la fiche d'une salle (app/admin/halls/[id]/page.tsx).
 *  - Lecture : GET /api/admin/venues/[id] (photos, genre, adresse et position, horaires, zones et tables, acompte par
 *    personne, mode de confirmation, durée du créneau, plan montré ou non, partenaire et ses contacts si
 *    `contactsAllowed`, nombre de réservations à venir, historique).
 *  - Décisions : composant VenueDecision (valider, refuser, suspendre, réactiver selon le statut), affiché seulement
 *    avec le droit halls.validate ; la route décide toujours. Après une décision, la fiche est relue.
 *  - Carte chargée à la demande (Leaflet lit window), seulement si l'établissement a une position.
 *  - Aucun montant calculé ici : tout vient de la route.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { loadEventMap } from '@/components/ui/event-map-load';
import {
  Building2,
  House,
  CalendarClock,
  Clock,
  Hourglass,
  LayoutGrid,
  Mail,
  MapPin,
  Phone,
  Store,
  Wallet,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { LinkButton } from '@/components/ui/LinkButton';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/components/providers/AuthProvider';
import { HallPhotoGallery } from '@/components/halls/admin/HallPhotoGallery';
import { finiteOrNull, readError } from '@/components/halls/admin/types';
import { VenueDecision } from '@/components/tables/admin/VenueDecision';
import { VenueSheetSkeleton } from '@/components/tables/admin/VenueSheetSkeleton';
import { VenueOpeningHours } from '@/components/tables/admin/VenueOpeningHours';
import { VenueTablesList } from '@/components/tables/admin/VenueTablesList';
import {
  DEFAULT_VENUE_STATUS,
  SUBMITTED_UNKNOWN,
  confirmationText,
  depositText,
  isVenueSheet,
  slotDurationText,
  upcomingText,
  venueName,
  type AdminVenueSheet,
} from '@/components/tables/admin/types';
import { HOST_KIND_TEXT, hostKindOf } from '@/lib/lieux/position-publique';
import { formatDateTime, toDakarDateTimeLocal } from '@/lib/format';

// Carte du lieu, chargée à la demande (Leaflet lit window) ; place réservée fixe, sans animation.
const EventMap = dynamic(() => loadEventMap().then((m) => ({ default: m.EventMap })), {
  ssr: false,
  loading: () => <div className="h-48 w-full rounded-xl bg-muted sm:h-56" aria-hidden="true" />,
});

type Phase = 'loading' | 'ready' | 'not-found' | 'error';

const LOAD_ERROR = 'Impossible de charger la fiche de l’établissement. Vérifiez votre connexion, puis réessayez.';
const REFRESH_ERROR = 'La fiche n’a pas pu être actualisée. Rechargez la page pour voir son état actuel.';
const BACK_LABEL = 'Retour aux établissements';
const LINK_CLASS = 'inline-flex min-h-11 items-center text-primary-text underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

function Section({ title, children, id, action }: { title: string; children: React.ReactNode; id: string; action?: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="rounded-xl border border-border bg-card p-4 sm:p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 id={id} className="text-lg font-bold tracking-tight text-foreground-strong">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

/** Ligne « libellé : valeur » ; l'icône, décorative, est posée dans le <dt>. */
function InfoRow({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="relative min-h-9 min-w-0 pl-12">
      <dt className="text-sm text-muted-foreground">
        <span className="absolute left-0 top-0.5 flex h-9 w-9 items-center justify-center rounded-xl bg-muted text-muted-foreground" aria-hidden="true">
          {icon}
        </span>
        {label}
      </dt>
      <dd className="break-words text-base font-medium text-foreground-strong">{children}</dd>
    </div>
  );
}

/** Date de l'historique « libellé : date » (rien si la date manque). */
function DatedLine({ label, at }: { label: string; at: string | null }) {
  if (!at) return null;
  return (
    <div className="flex flex-wrap gap-x-1">
      <dt>{label}</dt>
      <dd><time dateTime={toDakarDateTimeLocal(at)} className="tabular-nums">{formatDateTime(at)}</time></dd>
    </div>
  );
}

export default function AdminVenueSheetPage() {
  const params = useParams<{ id: string }>();
  const venueId = typeof params?.id === 'string' ? params.id : '';
  const toast = useToast();
  const { hasPermission } = useAuth();
  const canDecide = hasPermission('halls.validate');
  const canValidatePartners = hasPermission('partners.validate');

  const [venue, setVenue] = useState<AdminVenueSheet | null>(null);
  const [phase, setPhase] = useState<Phase>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const requestSeq = useRef(0);

  const load = useCallback(async (silent: boolean) => {
    if (!venueId) {
      setPhase('not-found');
      return;
    }
    const seq = ++requestSeq.current;
    if (!silent) {
      setPhase('loading');
      setErrorMessage(null);
    }
    try {
      const res = await fetch(`/api/admin/venues/${encodeURIComponent(venueId)}`, { cache: 'no-store' });
      const body: unknown = await res.json().catch(() => null);
      if (seq !== requestSeq.current) return;
      if (res.status === 404) {
        setPhase('not-found');
        return;
      }
      if (!res.ok || !isVenueSheet(body)) {
        if (silent) {
          toast.error(REFRESH_ERROR);
          return;
        }
        setErrorMessage(readError(body) ?? LOAD_ERROR);
        setPhase('error');
        return;
      }
      setVenue(body.venue);
      setPhase('ready');
    } catch (err) {
      if (seq !== requestSeq.current) return;
      console.error('[admin/venues/[id]] chargement de la fiche en échec', err);
      if (silent) {
        toast.error(REFRESH_ERROR);
        return;
      }
      setErrorMessage(LOAD_ERROR);
      setPhase('error');
    }
  }, [venueId, toast]);

  useEffect(() => {
    void load(false);
  }, [load]);

  const retry = async (): Promise<void> => {
    setIsRetrying(true);
    try {
      await load(false);
    } finally {
      setIsRetrying(false);
    }
  };

  const reload = useCallback(() => load(true), [load]);

  if (phase === 'loading' && !venue) return <VenueSheetSkeleton />;

  if (phase === 'not-found') {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader title="Établissement introuvable" back={{ href: '/admin/venues', label: BACK_LABEL }} />
        <EmptyState
          icon={<Store size={28} />}
          title="Cet établissement n’existe pas ou a été supprimé"
          description="La partenaire l’a peut-être supprimé. Revenez à la file pour continuer."
          actionLabel="Voir les établissements"
          actionHref="/admin/venues"
        />
      </div>
    );
  }

  if (phase === 'error' || !venue) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader title="Fiche de l’établissement" back={{ href: '/admin/venues', label: BACK_LABEL }} />
        <ErrorState
          title="Fiche indisponible"
          description={errorMessage ?? LOAD_ERROR}
          onRetry={() => void retry()}
          isRetrying={isRetrying}
        />
      </div>
    );
  }

  const name = venueName(venue.name);
  const backHref = venue.status && venue.status !== DEFAULT_VENUE_STATUS ? `/admin/venues?status=${encodeURIComponent(venue.status)}` : '/admin/venues';
  const latitude = finiteOrNull(venue.latitude);
  const longitude = finiteOrNull(venue.longitude);
  const hasPosition = latitude !== null && longitude !== null;
  const address = [venue.address, venue.city].filter(Boolean).join(', ');
  // Lot Carte B3 : chez un particulier (adresse cachée au public) ou lieu professionnel
  const hostKind = hostKindOf(venue.hostKind);
  const isPending = venue.status === DEFAULT_VENUE_STATUS;
  const partnerName = venue.partner.name ?? 'Partenaire inconnue';
  const submittedAt = venue.submittedAt ?? null;
  const confirmation = confirmationText(venue.confirmation);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        back={{ href: backHref, label: BACK_LABEL }}
        eyebrow={(
          <>
            <Badge variant={venue.statusTone} size="md">{venue.statusLabel}</Badge>
            <Badge variant="neutral" size="md">{venue.kindLabel}</Badge>
            {!venue.isActive && <Badge variant="neutral" size="md">Retiré de la vente par la partenaire</Badge>}
          </>
        )}
        title={name}
        description={[partnerName, venue.city].filter(Boolean).join(' · ')}
      />

      {venue.status === 'REFUSEE' && (
        <StatusBanner tone="warning" title="Motif du refus">
          <p className="break-words">{venue.reason ?? 'Aucun motif enregistré.'}</p>
          <p className="mt-1 text-muted-foreground">La partenaire peut corriger l’établissement puis le renvoyer en validation.</p>
        </StatusBanner>
      )}
      {venue.status === 'SUSPENDUE' && (
        <StatusBanner tone="suspended" title="Motif de la suspension">
          <p className="break-words">{venue.reason ?? 'Aucun motif enregistré.'}</p>
          <p className="mt-1 text-muted-foreground">L’établissement n’est plus visible des clients. Les réservations déjà prises sont maintenues.</p>
        </StatusBanner>
      )}

      {isPending && !venue.partner.validated && (
        <StatusBanner
          tone="warning"
          title="Compte de la partenaire non validé"
          action={canValidatePartners ? (
            <LinkButton href="/admin/dashboard" variant="secondary" size="sm">
              Voir les partenaires à valider
            </LinkButton>
          ) : undefined}
        >
          <p>L’établissement ne peut pas être validé tant que le compte de la partenaire n’est pas validé. Vous pouvez déjà le refuser avec un motif.</p>
        </StatusBanner>
      )}

      {canDecide && (
        <Section id="etablissement-decision" title="Décision">
          {isPending && (
            <p className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
              <CalendarClock size={16} className="flex-shrink-0" aria-hidden="true" />
              {submittedAt ? (
                <span>
                  {'Envoyé en validation le '}
                  <time dateTime={toDakarDateTimeLocal(submittedAt)} className="tabular-nums font-medium text-foreground-strong">{formatDateTime(submittedAt)}</time>
                </span>
              ) : <span>{SUBMITTED_UNKNOWN}</span>}
            </p>
          )}
          <VenueDecision
            venueId={venue.id}
            venueName={name}
            status={venue.status}
            partnerValidated={venue.partner.validated}
            isActive={venue.isActive}
            upcomingReservations={venue.upcomingReservations}
            onChanged={reload}
          />
        </Section>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-4 lg:col-span-2">
          <Section id="etablissement-photos" title="Photos">
            <HallPhotoGallery photos={venue.photos} hallName={name} />
          </Section>

          <Section id="etablissement-description" title="Description">
            {venue.description?.trim()
              ? <p className="whitespace-pre-line break-words text-base leading-relaxed text-foreground-strong">{venue.description}</p>
              : <p className="text-sm text-muted-foreground">La partenaire n’a pas rédigé de description.</p>}
          </Section>

          <Section id="etablissement-reglages" title="Réservation des tables">
            <dl className="grid gap-4 sm:grid-cols-2">
              <InfoRow icon={<Wallet size={18} />} label="Acompte">
                <span className="tabular-nums">{depositText(venue.depositPerPerson)}</span>
              </InfoRow>
              <InfoRow icon={<Hourglass size={18} />} label="Confirmation">
                {confirmation.label}
                <span className="block text-sm font-normal text-muted-foreground">{confirmation.hint}</span>
              </InfoRow>
              <InfoRow icon={<Clock size={18} />} label="Durée d’un créneau">
                <span className="tabular-nums">{slotDurationText(venue.slotMinutes)}</span>
              </InfoRow>
              <InfoRow icon={<LayoutGrid size={18} />} label="Plan de salle">
                {venue.floorPlan ? 'Montré aux clients' : 'Non montré aux clients'}
                <span className="block text-sm font-normal text-muted-foreground">
                  {venue.floorPlan ? 'Les clients peuvent choisir leur table sur le plan.' : 'Les clients ne choisissent pas leur table sur un plan.'}
                </span>
              </InfoRow>
            </dl>
          </Section>

          <Section id="etablissement-horaires" title="Horaires de la semaine">
            <VenueOpeningHours hours={venue.hours} />
          </Section>

          <Section id="etablissement-tables" title="Zones et tables">
            <VenueTablesList zones={venue.zones} tables={venue.tables} />
          </Section>

          <Section id="etablissement-adresse" title="Adresse">
            <dl className="flex flex-col gap-4">
              <InfoRow icon={<MapPin size={18} />} label="Adresse">
                {address || 'Non renseignée'}
                {!hasPosition && <span className="block text-sm font-normal text-muted-foreground">Aucun repère sur la carte.</span>}
              </InfoRow>
              <InfoRow icon={hostKind === 'PROFESSIONNEL' ? <Building2 size={18} /> : <House size={18} />} label="Accueil">
                {HOST_KIND_TEXT[hostKind].label}
              </InfoRow>
            </dl>
            {hasPosition && (
              <div className="mt-4 border-t border-border pt-4">
                <EventMap latitude={latitude} longitude={longitude} venueName={name} />
              </div>
            )}
          </Section>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <Section id="etablissement-partenaire" title="Partenaire">
            <dl className="flex flex-col gap-4">
              <InfoRow icon={<Building2 size={18} />} label="Nom">
                {partnerName}
                <span className="mt-1 block">
                  {venue.partner.validated
                    ? <Badge variant="success" size="sm">Compte validé</Badge>
                    : <Badge variant="warning" size="sm">Compte non validé</Badge>}
                </span>
              </InfoRow>
              {venue.partner.contactsAllowed === false && (
                <InfoRow icon={<Phone size={18} />} label="Téléphone et email">
                  Contacts visibles avec le droit Consulter les partenaires
                </InfoRow>
              )}
              {venue.partner.contactsAllowed !== false && venue.partner.phone && (
                <InfoRow icon={<Phone size={18} />} label="Téléphone">
                  <a href={`tel:${venue.partner.phone}`} className={`${LINK_CLASS} tabular-nums`}>
                    {venue.partner.phone}
                  </a>
                </InfoRow>
              )}
              {venue.partner.contactsAllowed !== false && venue.partner.email && (
                <InfoRow icon={<Mail size={18} />} label="Email">
                  <a href={`mailto:${venue.partner.email}`} className={`${LINK_CLASS} break-all`}>
                    {venue.partner.email}
                  </a>
                </InfoRow>
              )}
              {venue.partner.city && <InfoRow icon={<MapPin size={18} />} label="Ville">{venue.partner.city}</InfoRow>}
            </dl>
          </Section>

          <Section id="etablissement-reservations" title="Réservations">
            <dl className="flex flex-col gap-4">
              <InfoRow icon={<CalendarClock size={18} />} label="À venir">
                <span className="tabular-nums">{upcomingText(venue.upcomingReservations)}</span>
              </InfoRow>
            </dl>
            {venue.upcomingReservations > 0 && venue.status === 'VALIDEE' && (
              <p className="mt-3 text-sm text-muted-foreground">Si vous suspendez l’établissement, les réservations déjà prises sont maintenues.</p>
            )}
          </Section>

          <Section id="etablissement-historique" title="Historique">
            <dl className="mb-4 flex flex-col gap-1 text-sm text-muted-foreground">
              <DatedLine label="Créé le" at={venue.createdAt} />
              {submittedAt ? (
                <DatedLine label="Envoyé en validation le" at={submittedAt} />
              ) : isPending ? (
                <div className="flex flex-wrap gap-x-1">
                  <dt className="sr-only">Envoyé en validation le</dt>
                  <dd>{SUBMITTED_UNKNOWN}</dd>
                </div>
              ) : null}
              <DatedLine label="Dernière décision le" at={venue.validatedAt} />
            </dl>
            {venue.history.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune décision ni modification enregistrée pour le moment.</p>
            ) : (
              <ol className="flex flex-col gap-4">
                {venue.history.map((h, i) => (
                  <li key={`${h.at}-${i}`} className="relative border-l-2 border-border pl-4">
                    <span className="absolute -left-[5px] top-1.5 h-2 w-2 rounded-full bg-muted-foreground" aria-hidden="true" />
                    <p className="text-base font-semibold text-foreground-strong">{h.what}</p>
                    <p className="text-sm text-muted-foreground">
                      <time dateTime={toDakarDateTimeLocal(h.at)}>{formatDateTime(h.at)}</time>
                    </p>
                    {h.reason && (
                      <blockquote className="mt-2 break-words rounded-xl bg-muted px-3 py-2 text-sm text-foreground-strong">
                        <span className="sr-only">Motif : </span>{h.reason}
                      </blockquote>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </Section>
        </div>
      </div>
    </div>
  );
}

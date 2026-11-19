'use client';

/**
 * Lot 10b (point 4) : fiche d'une salle de fête pour décider (administration, droit halls.validate).
 *  - Lecture : GET /api/admin/halls/[id] (photos, position, description, capacité, prix au jour et à l'heure,
 *    acompte, règle d'annulation, équipements, adresse, partenaire et ses contacts, réservations à venir,
 *    historique des décisions).
 *  - Décisions : composant HallDecision (valider, refuser, suspendre, réactiver selon le statut), affiché seulement
 *    avec le droit halls.validate ; la route décide toujours. Après une décision, la fiche est relue.
 *  - Carte chargée à la demande (Leaflet lit window), seulement si la salle a une position.
 *  - Aucun montant calculé ici : tout vient de la route.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import {
  Building2,
  CalendarCheck,
  CalendarClock,
  Clock,
  Mail,
  MapPin,
  Phone,
  Users,
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
import { HallDecision } from '@/components/halls/admin/HallDecision';
import { HallSheetSkeleton } from '@/components/halls/admin/HallSheetSkeleton';
import {
  DEFAULT_HALL_STATUS,
  finiteOrNull,
  isHallSheet,
  readError,
  type AdminHallSheet,
} from '@/components/halls/admin/types';
import { formatDateTime, formatFcfa, formatInteger, toDakarDateTimeLocal } from '@/lib/format';

// Carte du lieu, chargée à la demande (Leaflet lit window) ; place réservée fixe, sans animation.
const EventMap = dynamic(() => import('@/components/ui/EventMap').then((m) => ({ default: m.EventMap })), {
  ssr: false,
  loading: () => <div className="h-48 w-full rounded-xl bg-muted sm:h-56" aria-hidden="true" />,
});

type Phase = 'loading' | 'ready' | 'not-found' | 'error';

const LOAD_ERROR = 'Impossible de charger la fiche de la salle. Vérifiez votre connexion, puis réessayez.';

function Section({ title, children, id, action }: { title: string; children: React.ReactNode; id: string; action?: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="rounded-2xl border border-border bg-card p-4 sm:p-6">
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

/** Acompte tel que réglé par la partenaire (valeur de la route, mise en forme seulement). */
function depositText(mode: string | null, value: number | null): string {
  if (mode === 'MONTANT_FIXE') {
    return value === null
      ? 'Montant fixe, valeur par défaut d’Event Village'
      : `Montant fixe de ${formatFcfa(value)} (plafonné au prix)`;
  }
  return value === null
    ? 'Pourcentage du prix, taux par défaut d’Event Village'
    : `${formatInteger(value)} % du prix`;
}

function upcomingText(n: number): string {
  if (n <= 0) return 'Aucune réservation à venir';
  return n === 1 ? '1 réservation à venir' : `${formatInteger(n)} réservations à venir`;
}

export default function AdminHallSheetPage() {
  const params = useParams<{ id: string }>();
  const hallId = typeof params?.id === 'string' ? params.id : '';
  const toast = useToast();
  const { hasPermission } = useAuth();
  const canDecide = hasPermission('halls.validate');
  const canValidatePartners = hasPermission('partners.validate');

  const [hall, setHall] = useState<AdminHallSheet | null>(null);
  const [phase, setPhase] = useState<Phase>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const requestSeq = useRef(0);

  const load = useCallback(async (silent: boolean) => {
    if (!hallId) {
      setPhase('not-found');
      return;
    }
    const seq = ++requestSeq.current;
    if (!silent) {
      setPhase('loading');
      setErrorMessage(null);
    }
    try {
      const res = await fetch(`/api/admin/halls/${encodeURIComponent(hallId)}`, { cache: 'no-store' });
      const body: unknown = await res.json().catch(() => null);
      if (seq !== requestSeq.current) return;
      if (res.status === 404) {
        setPhase('not-found');
        return;
      }
      if (!res.ok || !isHallSheet(body)) {
        const message = readError(body) ?? LOAD_ERROR;
        if (silent) {
          toast.error('La fiche n’a pas pu être actualisée. Rechargez la page pour voir son état actuel.');
          return;
        }
        setErrorMessage(message);
        setPhase('error');
        return;
      }
      setHall(body.hall);
      setPhase('ready');
    } catch (err) {
      if (seq !== requestSeq.current) return;
      console.error('[admin/halls/[id]] chargement de la fiche en échec', err);
      if (silent) {
        toast.error('La fiche n’a pas pu être actualisée. Rechargez la page pour voir son état actuel.');
        return;
      }
      setErrorMessage(LOAD_ERROR);
      setPhase('error');
    }
  }, [hallId, toast]);

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

  if (phase === 'loading' && !hall) return <HallSheetSkeleton />;

  if (phase === 'not-found') {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader title="Salle introuvable" back={{ href: '/admin/halls', label: 'Retour aux salles' }} />
        <EmptyState
          icon={<Building2 size={28} />}
          title="Cette salle n’existe pas ou a été supprimée"
          description="La partenaire l’a peut-être supprimée. Revenez à la file pour continuer."
          actionLabel="Voir les salles"
          actionHref="/admin/halls"
        />
      </div>
    );
  }

  if (phase === 'error' || !hall) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader title="Fiche de la salle" back={{ href: '/admin/halls', label: 'Retour aux salles' }} />
        <ErrorState
          title="Fiche indisponible"
          description={errorMessage ?? LOAD_ERROR}
          onRetry={() => void retry()}
          isRetrying={isRetrying}
        />
      </div>
    );
  }

  const name = hall.name?.trim() || 'Salle sans nom';
  const backHref = hall.status && hall.status !== DEFAULT_HALL_STATUS ? `/admin/halls?status=${encodeURIComponent(hall.status)}` : '/admin/halls';
  const latitude = finiteOrNull(hall.latitude);
  const longitude = finiteOrNull(hall.longitude);
  const hasPosition = latitude !== null && longitude !== null;
  const amenities = hall.amenities.filter((a): a is string => typeof a === 'string' && a.trim() !== '');
  const address = [hall.address, hall.city].filter(Boolean).join(', ');
  const isPending = hall.status === DEFAULT_HALL_STATUS;
  const partnerName = hall.partner.name ?? 'Partenaire inconnue';

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        back={{ href: backHref, label: 'Retour aux salles' }}
        eyebrow={(
          <>
            <Badge variant={hall.statusTone} size="md">{hall.statusLabel}</Badge>
            {!hall.isActive && <Badge variant="neutral" size="md">Retirée de la vente par la partenaire</Badge>}
          </>
        )}
        title={name}
        description={[partnerName, hall.city].filter(Boolean).join(' · ')}
      />

      {hall.status === 'REFUSEE' && (
        <StatusBanner tone="warning" title="Motif du refus">
          <p className="break-words">{hall.reason ?? 'Aucun motif enregistré.'}</p>
          <p className="mt-1 text-muted-foreground">La partenaire peut corriger la salle puis la renvoyer en validation.</p>
        </StatusBanner>
      )}
      {hall.status === 'SUSPENDUE' && (
        <StatusBanner tone="suspended" title="Motif de la suspension">
          <p className="break-words">{hall.reason ?? 'Aucun motif enregistré.'}</p>
          <p className="mt-1 text-muted-foreground">La salle n’est plus visible des clients. Les réservations déjà payées sont maintenues.</p>
        </StatusBanner>
      )}

      {isPending && !hall.partner.validated && (
        <StatusBanner
          tone="warning"
          title="Compte de la partenaire non validé"
          action={canValidatePartners ? (
            <LinkButton href="/admin/dashboard" variant="secondary" size="sm">
              Voir les partenaires à valider
            </LinkButton>
          ) : undefined}
        >
          <p>La salle ne peut pas être validée tant que le compte de la partenaire n’est pas validé. Vous pouvez déjà la refuser avec un motif.</p>
        </StatusBanner>
      )}

      {canDecide && (
        <Section id="salle-decision" title="Décision">
          <HallDecision
            hallId={hall.id}
            hallName={name}
            status={hall.status}
            partnerValidated={hall.partner.validated}
            isActive={hall.isActive}
            upcomingReservations={hall.upcomingReservations}
            onChanged={reload}
          />
        </Section>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-4 lg:col-span-2">
          <Section id="salle-photos" title="Photos">
            <HallPhotoGallery photos={hall.photos} hallName={name} />
          </Section>

          <Section id="salle-description" title="Description">
            {hall.description?.trim()
              ? <p className="whitespace-pre-line break-words text-base leading-relaxed text-foreground-strong">{hall.description}</p>
              : <p className="text-sm text-muted-foreground">La partenaire n’a pas rédigé de description.</p>}
          </Section>

          <Section id="salle-tarifs" title="Capacité, prix et conditions">
            <dl className="grid gap-4 sm:grid-cols-2">
              <InfoRow icon={<Users size={18} />} label="Capacité">
                <span className="tabular-nums">{hall.capacity === null ? 'Non précisée' : `${formatInteger(hall.capacity)} personnes`}</span>
              </InfoRow>
              <InfoRow icon={<CalendarCheck size={18} />} label="Prix par jour">
                <span className="tabular-nums">{hall.pricePerDay === null ? 'Non renseigné' : formatFcfa(hall.pricePerDay)}</span>
              </InfoRow>
              <InfoRow icon={<Clock size={18} />} label="Prix à l’heure">
                <span className="tabular-nums">{hall.pricePerHour === null ? 'Location à l’heure non proposée' : formatFcfa(hall.pricePerHour)}</span>
              </InfoRow>
              <InfoRow icon={<Wallet size={18} />} label="Acompte">
                {depositText(hall.depositMode, hall.depositValue)}
              </InfoRow>
            </dl>
            <div className="mt-4 border-t border-border pt-4">
              <h3 className="text-sm text-muted-foreground">Règle d’annulation</h3>
              <p className="mt-1 whitespace-pre-line break-words text-base text-foreground-strong">
                {hall.cancellation ?? 'Règle d’annulation non disponible.'}
              </p>
            </div>
          </Section>

          <Section id="salle-equipements" title="Équipements">
            {amenities.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun équipement indiqué.</p>
            ) : (
              <ul className="flex flex-wrap gap-2" aria-label="Équipements de la salle">
                {amenities.map((a) => (
                  <li key={a} className="rounded-full border border-border bg-muted px-3 py-1.5 text-sm text-foreground-strong">{a}</li>
                ))}
              </ul>
            )}
          </Section>

          <Section id="salle-adresse" title="Adresse">
            <dl className="flex flex-col gap-4">
              <InfoRow icon={<MapPin size={18} />} label="Adresse">
                {address || 'Non renseignée'}
                {!hasPosition && <span className="block text-sm font-normal text-muted-foreground">Aucun repère sur la carte.</span>}
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
          <Section id="salle-partenaire" title="Partenaire">
            <dl className="flex flex-col gap-4">
              <InfoRow icon={<Building2 size={18} />} label="Nom">
                {partnerName}
                <span className="mt-1 block">
                  {hall.partner.validated
                    ? <Badge variant="success" size="sm">Compte validé</Badge>
                    : <Badge variant="warning" size="sm">Compte non validé</Badge>}
                </span>
              </InfoRow>
              {hall.partner.phone && (
                <InfoRow icon={<Phone size={18} />} label="Téléphone">
                  <a href={`tel:${hall.partner.phone}`} className="inline-flex min-h-11 items-center text-primary-text underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    {hall.partner.phone}
                  </a>
                </InfoRow>
              )}
              {hall.partner.email && (
                <InfoRow icon={<Mail size={18} />} label="Email">
                  <a href={`mailto:${hall.partner.email}`} className="inline-flex min-h-11 items-center break-all text-primary-text underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    {hall.partner.email}
                  </a>
                </InfoRow>
              )}
              {hall.partner.city && <InfoRow icon={<MapPin size={18} />} label="Ville">{hall.partner.city}</InfoRow>}
            </dl>
          </Section>

          <Section id="salle-reservations" title="Réservations">
            <dl className="flex flex-col gap-4">
              <InfoRow icon={<CalendarClock size={18} />} label="À venir">
                <span className="tabular-nums">{upcomingText(hall.upcomingReservations)}</span>
              </InfoRow>
            </dl>
            {hall.upcomingReservations > 0 && hall.status === 'VALIDEE' && (
              <p className="mt-3 text-sm text-muted-foreground">Si vous suspendez la salle, les réservations déjà payées sont maintenues.</p>
            )}
          </Section>

          <Section id="salle-historique" title="Historique des décisions">
            <dl className="mb-4 flex flex-col gap-1 text-sm text-muted-foreground">
              {hall.createdAt && (
                <div className="flex flex-wrap gap-x-1">
                  <dt>Créée le</dt>
                  <dd><time dateTime={toDakarDateTimeLocal(hall.createdAt)} className="tabular-nums">{formatDateTime(hall.createdAt)}</time></dd>
                </div>
              )}
              {hall.validatedAt && (
                <div className="flex flex-wrap gap-x-1">
                  <dt>Validée le</dt>
                  <dd><time dateTime={toDakarDateTimeLocal(hall.validatedAt)} className="tabular-nums">{formatDateTime(hall.validatedAt)}</time></dd>
                </div>
              )}
            </dl>
            {hall.history.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune décision enregistrée pour le moment.</p>
            ) : (
              <ol className="flex flex-col gap-4">
                {hall.history.map((h, i) => (
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

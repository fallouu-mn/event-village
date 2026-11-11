'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import {
  Building2,
  CalendarDays,
  Clock,
  ExternalLink,
  Image as ImageIcon,
  Mail,
  MapPin,
  Phone,
  Users,
} from 'lucide-react';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { Badge } from '@/components/ui/Badge';
import { Button, type ButtonVariant } from '@/components/ui/Button';
import { LinkButton } from '@/components/ui/LinkButton';
import { Modal } from '@/components/ui/Modal';
import { ReasonDialog } from '@/components/ui/ReasonDialog';
import { DataList, type DataColumn } from '@/components/ui/DataList';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/components/providers/AuthProvider';
import { EventCancelDialog } from '@/components/events/EventCancelDialog';
import { RefundProgress } from '@/components/events/RefundProgress';
import { categoryChannelLabel } from '@/lib/events/category-channels';
import { EVENT_STATUS_META, eventStatusLabel, isEventStatus, type EventStatus } from '@/lib/events/event-status';
import { getCategoryLabel } from '@/lib/constants/event-categories';
import { PROGRAM_KIND_LABELS, type ProgramKind } from '@/lib/validations/event';
import { formatDateTime, formatEventDateTime, formatFcfa, formatInteger, formatShortDate, toDakarDateTimeLocal } from '@/lib/format';

/**
 * Lot 5 (tâche 5.7, contrat G ; 5.8, contrat J) — fiche complète d'un événement pour l'administration.
 *  - Lecture : GET /api/admin/events/[id] (affiche, dates, lieu, programme, catégories et prix, tous canaux et
 *    inactives comprises, organisateur et contact, historique des statuts avec les motifs, actions).
 *  - Actions : uniquement celles renvoyées par event_actions (D5). Une action avec `reason_required`
 *    (refuser, suspendre) ouvre ReasonDialog ; les autres (valider, publier, réactiver, terminer) une
 *    confirmation. Envoi : POST /api/admin/events/[id]/transition { to, reason? }.
 *  - Annulation : EventCancelDialog (portée admin, impact et titre à retaper), puis RefundProgress.
 */

interface SheetEvent {
  id: string;
  title: string;
  status: string;
  description: string | null;
  category: string | null;
  image_url: string | null;
  start_date: string | null;
  start_time: string | null;
  end_date: string | null;
  end_time: string | null;
  location: string | null;
  city: string | null;
  capacity: number | null;
  program: unknown;
  practical_info: Record<string, unknown> | null;
  created_at: string | null;
  updated_at: string | null;
}

interface SheetCategory {
  id: string;
  name: string;
  description: string | null;
  price: number | string;
  total_quantity: number;
  sale_start: string | null;
  sale_end: string | null;
  max_per_order: number | null;
  sale_online: boolean;
  sale_counter: boolean;
  is_active: boolean | null;
}

interface SheetOrganizer {
  id: string;
  company_name: string | null;
  commercial_name: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  status: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
}

interface SheetHistoryRow {
  id: string;
  old_status: string | null;
  new_status: string;
  actor_role: string | null;
  actor_name: string | null;
  reason: string | null;
  channel: string | null;
  created_at: string;
}

interface SheetAction {
  to: string;
  reason_required: boolean;
  label: string;
}

interface SheetActions {
  status: string;
  actions: SheetAction[];
  can_edit: boolean;
  can_cancel: boolean;
  last_reason: { kind: 'REFUS' | 'SUSPENSION'; reason: string | null; at: string } | null;
}

interface Sheet {
  event: SheetEvent;
  categories: SheetCategory[];
  organizer: SheetOrganizer | null;
  history: SheetHistoryRow[];
  actions: SheetActions;
  cancellation: { public_notice: string | null; internal_reason: string | null; cancelled_at: string | null } | null;
}

interface ProgramItem {
  id: string;
  time: string | null;
  kind: string | null;
  title: string;
  participant: string | null;
  description: string | null;
  day: string | null;
}

type Phase = 'loading' | 'ready' | 'not-found' | 'error';

/** Statuts où la page publique existe (contrat E). */
const PUBLIC_STATUSES: readonly EventStatus[] = ['PUBLIE', 'SUSPENDU', 'ANNULE', 'TERMINE'];

const ROLE_LABELS: Record<string, string> = {
  PARTENAIRE: 'Organisateur',
  ADMIN: 'Administration',
  SYSTEM: 'Automatique',
};

const CHANNEL_LABELS: Record<string, string> = {
  CREATION: 'Création',
  TRANSITION: 'Changement de statut',
  CANCELLATION: 'Annulation',
  CRON: 'Fin automatique',
};

const PARTNER_STATUS: Record<string, { label: string; variant: 'success' | 'warning' | 'danger' | 'neutral' }> = {
  VALIDE: { label: 'Compte validé', variant: 'success' },
  EN_ATTENTE: { label: 'Compte en attente de validation', variant: 'warning' },
  REJETE: { label: 'Compte refusé', variant: 'danger' },
  SUSPENDU: { label: 'Compte suspendu', variant: 'danger' },
};

const PRACTICAL_LABELS: Record<string, string> = {
  address: 'Adresse',
  accessNotes: 'Accès',
  parking: 'Stationnement',
  contactPhone: 'Téléphone sur place',
  rules: 'Règlement',
};

/** Textes des confirmations et des motifs, choisis d'après la cible et le statut courant (jamais affichés bruts). */
interface ActionCopy {
  title: string;
  body: string;
  success: string;
  variant: ButtonVariant;
}

function actionCopy(action: SheetAction, from: string): ActionCopy {
  switch (action.to) {
    case 'VALIDE':
      return {
        title: 'Valider l’événement ?',
        body: 'L’organisateur est prévenu et pourra publier l’événement. La fiche ne repasse pas en validation.',
        success: 'Événement validé : l’organisateur peut maintenant le publier.',
        variant: 'primary',
      };
    case 'BROUILLON':
      return {
        title: 'Refuser l’événement',
        body: 'L’événement revient en brouillon chez l’organisateur, qui voit votre motif sur sa fiche et peut le soumettre de nouveau.',
        success: 'Refus envoyé : l’organisateur voit votre motif.',
        variant: 'secondary',
      };
    case 'SUSPENDU':
      return {
        title: 'Suspendre l’événement',
        body: 'La vente et le contrôle d’accès s’arrêtent immédiatement. L’organisateur et les détenteurs de billets sont prévenus ; seul l’organisateur voit le motif.',
        success: 'Événement suspendu : la vente et le contrôle d’accès sont arrêtés.',
        variant: 'secondary',
      };
    case 'PUBLIE':
      return from === 'SUSPENDU'
        ? {
          title: 'Réactiver l’événement ?',
          body: 'La page publique, la vente et le contrôle d’accès reprennent. L’organisateur et les détenteurs de billets sont prévenus.',
          success: 'Événement réactivé : la vente reprend.',
          variant: 'primary',
        }
        : {
          title: 'Publier l’événement ?',
          body: 'La page publique devient visible de tous et la billetterie s’ouvre selon les dates de vente.',
          success: 'Événement publié.',
          variant: 'primary',
        };
    case 'TERMINE':
      return {
        title: 'Terminer l’événement ?',
        body: 'La vente est close. Le contrôle des entrées reste possible jusqu’à la fermeture de la fenêtre de scan.',
        success: 'Événement terminé.',
        variant: 'secondary',
      };
    default:
      return {
        title: `${action.label} ?`,
        body: 'Confirmez le changement de statut de cet événement.',
        success: 'Statut de l’événement mis à jour.',
        variant: 'primary',
      };
  }
}

function readError(body: unknown): string | null {
  if (body && typeof body === 'object' && typeof (body as { error?: unknown }).error === 'string') {
    return (body as { error: string }).error;
  }
  return null;
}

function isSheet(body: unknown): body is Sheet {
  const b = body as Sheet | null;
  return !!b && typeof b === 'object' && !!b.event && typeof b.event.id === 'string' && Array.isArray(b.categories)
    && Array.isArray(b.history) && !!b.actions && Array.isArray(b.actions.actions);
}

function str(v: unknown): string | null {
  return typeof v === 'string' && v.trim() !== '' ? v : null;
}

/** Programme lu tel qu'il est stocké, trié par jour puis heure (contrat F1). */
function programOf(raw: unknown): ProgramItem[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((l): l is Record<string, unknown> => !!l && typeof l === 'object')
    .map((l, i) => ({
      id: str(l.id) ?? `ligne-${i}`,
      time: str(l.time),
      kind: str(l.kind),
      title: str(l.title) ?? 'Sans titre',
      participant: str(l.participant) ?? str(l.artistOrSpeaker),
      description: str(l.description),
      day: str(l.day),
    }))
    .sort((a, b) => `${a.day ?? ''} ${a.time ?? ''}`.localeCompare(`${b.day ?? ''} ${b.time ?? ''}`));
}

function kindLabel(kind: string | null): string | null {
  return kind && kind in PROGRAM_KIND_LABELS ? PROGRAM_KIND_LABELS[kind as ProgramKind] : null;
}

function amount(v: number | string): number {
  return typeof v === 'number' ? v : Number(v);
}

function Section({ title, children, id }: { title: string; children: React.ReactNode; id: string }) {
  return (
    <section aria-labelledby={id} className="rounded-2xl border border-border bg-surface p-4 sm:p-6">
      <h2 id={id} className="mb-4 text-lg font-bold tracking-tight text-fg">{title}</h2>
      {children}
    </section>
  );
}

/**
 * Ligne « libellé : valeur » d'une liste de définitions, avec pastille d'icône. Le <div> n'enveloppe que
 * <dt> et <dd> (structure exigée dans un <dl>) : l'icône, décorative, est posée dans le <dt>.
 */
function InfoRow({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="relative min-h-9 min-w-0 pl-12">
      <dt className="text-sm text-fg-muted">
        <span className="absolute left-0 top-0.5 flex h-9 w-9 items-center justify-center rounded-xl bg-surface-sunken text-fg-muted" aria-hidden="true">
          {icon}
        </span>
        {label}
      </dt>
      <dd className="break-words text-base font-medium text-fg">{children}</dd>
    </div>
  );
}

function SheetSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-label="Chargement de la fiche" className="flex flex-col gap-4">
      <Skeleton className="h-6 w-40" />
      <Skeleton className="h-9 w-3/4 max-w-xl" />
      <div className="grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-72 lg:col-span-2" />
        <Skeleton className="h-72" />
      </div>
      <Skeleton className="h-48" />
    </div>
  );
}

export default function AdminEventSheetPage() {
  const params = useParams<{ id: string }>();
  const eventId = typeof params?.id === 'string' ? params.id : '';
  const toast = useToast();
  // Lot 9 bis (R51, B31, B34) : valider, suspendre, annuler… demandent events.write. event_actions ne sert déjà ces
  // actions qu'à un admin qui l'a (M08) ; l'écran ne montre pas de bouton qui mènerait à un refus.
  const { hasPermission } = useAuth();
  const canWriteEvents = hasPermission('events.write');

  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [phase, setPhase] = useState<Phase>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);

  const [confirmAction, setConfirmAction] = useState<SheetAction | null>(null);
  const [reasonAction, setReasonAction] = useState<SheetAction | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCancelOpen, setIsCancelOpen] = useState(false);

  const requestSeq = useRef(0);

  const load = useCallback(async (silent: boolean) => {
    if (!eventId) return;
    const seq = ++requestSeq.current;
    if (!silent) {
      setPhase('loading');
      setErrorMessage(null);
    }
    try {
      const res = await fetch(`/api/admin/events/${encodeURIComponent(eventId)}`, { cache: 'no-store' });
      const body: unknown = await res.json().catch(() => null);
      if (seq !== requestSeq.current) return;
      if (res.status === 404) {
        setPhase('not-found');
        return;
      }
      if (!res.ok || !isSheet(body)) {
        throw new Error(readError(body) ?? 'Impossible de charger la fiche de l’événement pour le moment.');
      }
      setSheet(body);
      setPhase('ready');
    } catch (err) {
      if (seq !== requestSeq.current) return;
      console.error('[admin/events/[id]] chargement de la fiche en échec', err);
      const message = err instanceof Error && err.message && !/fetch|network/i.test(err.message)
        ? err.message
        : 'Impossible de charger la fiche. Vérifiez votre connexion, puis réessayez.';
      if (silent) {
        toast.error('La fiche n’a pas pu être actualisée. Rechargez la page pour voir son état actuel.');
        return;
      }
      setErrorMessage(message);
      setPhase('error');
    }
  }, [eventId, toast]);

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

  const openAction = (action: SheetAction): void => {
    setActionError(null);
    if (action.reason_required) setReasonAction(action);
    else setConfirmAction(action);
  };

  const closeDialogs = (): void => {
    if (isSubmitting) return;
    setConfirmAction(null);
    setReasonAction(null);
    setActionError(null);
  };

  const runTransition = async (action: SheetAction, reason?: string): Promise<void> => {
    if (!sheet || isSubmitting) return;
    const from = sheet.actions.status;
    setIsSubmitting(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/admin/events/${encodeURIComponent(eventId)}/transition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reason !== undefined ? { to: action.to, reason } : { to: action.to }),
      });
      const body: unknown = await res.json().catch(() => null);
      if (!res.ok) {
        const message = readError(body) ?? 'Le changement de statut a échoué. Réessayez dans un instant.';
        setActionError(message);
        // L'état a pu changer entre-temps (autre administrateur, fin automatique) : on relit la fiche.
        if (res.status === 409) void load(true);
        return;
      }
      toast.success(actionCopy(action, from).success);
      setConfirmAction(null);
      setReasonAction(null);
      await load(true);
    } catch (err) {
      console.error('[admin/events/[id]] transition en échec', err);
      setActionError('Le serveur ne répond pas. Vérifiez votre connexion, puis réessayez.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (phase === 'loading' && !sheet) {
    return (
      <div className="flex flex-col gap-4">
        <SheetSkeleton />
      </div>
    );
  }

  if (phase === 'not-found') {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader title="Événement introuvable" back={{ href: '/admin/events', label: 'Retour aux événements' }} />
        <EmptyState
          title="Cet événement n’existe pas ou a été supprimé"
          description="Le brouillon a peut-être été supprimé par son organisateur. Revenez à la liste pour continuer."
          actionLabel="Voir les événements"
          actionHref="/admin/events"
        />
      </div>
    );
  }

  if (phase === 'error' || !sheet) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader title="Fiche de l’événement" back={{ href: '/admin/events', label: 'Retour aux événements' }} />
        <ErrorState
          title="Fiche indisponible"
          description={errorMessage ?? 'Impossible de charger la fiche. Vérifiez votre connexion, puis réessayez.'}
          onRetry={() => void retry()}
          isRetrying={isRetrying}
        />
      </div>
    );
  }

  const { event, categories, organizer, history, actions, cancellation } = sheet;
  const currentStatus = actions.status;
  const program = programOf(event.program);
  const practical = event.practical_info && typeof event.practical_info === 'object'
    ? Object.entries(PRACTICAL_LABELS)
      .map(([key, label]) => ({ key, label, value: str(event.practical_info?.[key]) }))
      .filter((r): r is { key: string; label: string; value: string } => r.value !== null)
    : [];
  const isPublic = isEventStatus(currentStatus) && PUBLIC_STATUSES.includes(currentStatus);
  const isCancelled = currentStatus === 'ANNULE';
  const partnerStatus = organizer?.status ? PARTNER_STATUS[organizer.status] : undefined;
  const historyNewestFirst = history.slice().reverse();
  const startLabel = formatEventDateTime(event.start_date, event.start_time);
  const endLabel = event.end_date ? formatEventDateTime(event.end_date, event.end_time) : null;
  const confirmCopy = confirmAction ? actionCopy(confirmAction, currentStatus) : null;
  const reasonCopy = reasonAction ? actionCopy(reasonAction, currentStatus) : null;

  const categoryColumns: DataColumn<SheetCategory>[] = [
    {
      key: 'name',
      header: 'Catégorie',
      render: (c) => (
        <div className="flex min-w-0 flex-col gap-1">
          <span className="font-semibold text-fg">{c.name}</span>
          {c.description && <span className="text-sm text-fg-muted">{c.description}</span>}
        </div>
      ),
    },
    { key: 'price', header: 'Prix', align: 'right', render: (c) => <span className="whitespace-nowrap tabular-nums">{amount(c.price) === 0 ? 'Gratuit' : formatFcfa(amount(c.price))}</span> },
    { key: 'quota', header: 'Quota', align: 'right', render: (c) => <span className="tabular-nums">{formatInteger(c.total_quantity)}</span> },
    {
      key: 'sale',
      header: 'Période de vente',
      render: (c) => (
        <span className="text-sm">
          {c.sale_start ? `Du ${formatDateTime(c.sale_start)}` : 'Dès la publication'}
          {' · '}
          {c.sale_end ? `jusqu’au ${formatDateTime(c.sale_end)}` : 'jusqu’à l’événement'}
        </span>
      ),
    },
    { key: 'max', header: 'Par commande', align: 'right', render: (c) => <span className="tabular-nums">{c.max_per_order ? `${formatInteger(c.max_per_order)} au plus` : '—'}</span> },
    {
      key: 'state',
      header: 'Canaux et état',
      render: (c) => (
        <div className="flex flex-wrap gap-1.5">
          <Badge variant={c.sale_online || c.sale_counter ? 'info' : 'neutral'} size="sm">{categoryChannelLabel(c)}</Badge>
          <Badge variant={c.is_active === false ? 'warning' : 'success'} size="sm">{c.is_active === false ? 'Inactive' : 'Active'}</Badge>
        </div>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        back={{ href: '/admin/events', label: 'Retour aux événements' }}
        eyebrow={(
          <>
            <StatusBadge domain="event" status={currentStatus} />
            <span className="text-sm text-fg-muted">{getCategoryLabel(event.category)}</span>
          </>
        )}
        title={event.title}
        description={`${organizer?.company_name ?? 'Organisateur inconnu'} · ${startLabel}`}
        actions={(
          <>
            {canWriteEvents && actions.actions.filter((a) => a.to !== 'ANNULE').map((a) => (
              <Button
                key={a.to}
                variant={actionCopy(a, currentStatus).variant}
                onClick={() => openAction(a)}
                disabled={isSubmitting}
              >
                {a.label}
              </Button>
            ))}
            {canWriteEvents && actions.can_cancel && (
              <Button variant="danger" onClick={() => setIsCancelOpen(true)} disabled={isSubmitting}>
                Annuler l’événement
              </Button>
            )}
            {isPublic && (
              <LinkButton href={`/events/${event.id}`} variant="ghost" external rightIcon={<ExternalLink size={16} />}>
                Page publique
              </LinkButton>
            )}
          </>
        )}
      />

      {actions.last_reason && (
        <StatusBanner
          tone={actions.last_reason.kind === 'SUSPENSION' ? 'suspended' : 'warning'}
          title={actions.last_reason.kind === 'SUSPENSION' ? 'Motif de la suspension' : 'Motif du refus'}
        >
          <p>{actions.last_reason.reason ?? 'Aucun motif enregistré.'}</p>
          <p className="mt-1 text-fg-muted">
            Communiqué à l’organisateur le{' '}
            <time dateTime={toDakarDateTimeLocal(actions.last_reason.at)}>{formatDateTime(actions.last_reason.at)}</time>.
          </p>
        </StatusBanner>
      )}

      {isCancelled && (
        <StatusBanner tone="danger" title="Événement annulé">
          {cancellation?.public_notice && <p><span className="font-semibold">Avis public : </span>{cancellation.public_notice}</p>}
          {cancellation?.internal_reason && <p className="mt-1"><span className="font-semibold">Motif interne : </span>{cancellation.internal_reason}</p>}
          {cancellation?.cancelled_at && (
            <p className="mt-1">
              Annulé le <time dateTime={toDakarDateTimeLocal(cancellation.cancelled_at)}>{formatDateTime(cancellation.cancelled_at)}</time>.
            </p>
          )}
        </StatusBanner>
      )}

      {isCancelled && <RefundProgress eventId={event.id} isAdmin />}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-4 lg:col-span-2">
          <Section id="fiche-infos" title="Dates et lieu">
            <dl className="grid gap-4 sm:grid-cols-2">
              <InfoRow icon={<CalendarDays size={18} />} label="Début">{startLabel}</InfoRow>
              <InfoRow icon={<Clock size={18} />} label="Fin">{endLabel ?? 'Non précisée (fin de journée)'}</InfoRow>
              <InfoRow icon={<MapPin size={18} />} label="Lieu">
                {[event.location, event.city].filter(Boolean).join(', ') || 'Non renseigné'}
              </InfoRow>
              <InfoRow icon={<Users size={18} />} label="Jauge déclarée">
                <span className="tabular-nums">{event.capacity ? `${formatInteger(event.capacity)} personnes` : 'Non limitée'}</span>
              </InfoRow>
            </dl>
            {practical.length > 0 && (
              <dl className="mt-4 grid gap-3 border-t border-border pt-4 sm:grid-cols-2">
                {practical.map((p) => (
                  <div key={p.key} className="min-w-0">
                    <dt className="text-sm text-fg-muted">{p.label}</dt>
                    <dd className="whitespace-pre-line break-words text-base text-fg">{p.value}</dd>
                  </div>
                ))}
              </dl>
            )}
          </Section>

          <Section id="fiche-description" title="Description">
            {event.description
              ? <p className="whitespace-pre-line break-words text-base leading-relaxed text-fg">{event.description}</p>
              : <p className="text-sm text-fg-muted">L’organisateur n’a pas rédigé de description.</p>}
          </Section>

          <Section id="fiche-programme" title="Programme">
            {program.length === 0 ? (
              <p className="text-sm text-fg-muted">Aucun programme renseigné.</p>
            ) : (
              <ol className="flex flex-col gap-3">
                {program.map((line) => (
                  <li key={line.id} className="flex gap-3 rounded-xl border border-border bg-surface-sunken/60 p-3">
                    <div className="w-24 flex-shrink-0 text-sm font-semibold tabular-nums text-fg">
                      {line.day && <span className="block font-normal text-fg-muted">{formatShortDate(line.day)}</span>}
                      {line.time ?? '—'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-fg">{line.title}</span>
                        {kindLabel(line.kind) && <Badge variant="neutral" size="sm">{kindLabel(line.kind)}</Badge>}
                      </div>
                      {line.participant && <p className="text-sm text-fg-muted">{line.participant}</p>}
                      {line.description && <p className="mt-1 whitespace-pre-line break-words text-sm text-fg">{line.description}</p>}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </Section>

          <Section id="fiche-categories" title="Catégories et prix">
            <DataList
              items={categories}
              columns={categoryColumns}
              getKey={(c) => c.id}
              caption="Catégories de billets, tous canaux et inactives comprises"
              cardTitle={(c) => c.name}
              empty={<p className="text-sm text-fg-muted">Aucune catégorie de billet : l’événement ne peut pas être vendu.</p>}
            />
          </Section>
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <Section id="fiche-affiche" title="Affiche">
            {event.image_url ? (
              // Affiche servie par le stockage du projet (local en e2e) : pas d'optimiseur next/image.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={event.image_url}
                alt={`Affiche de « ${event.title} »`}
                loading="lazy"
                className="mx-auto block h-auto max-h-[36rem] w-auto max-w-full rounded-xl border border-border bg-surface-sunken object-contain"
              />
            ) : (
              <div className="flex aspect-[3/4] w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-surface-sunken text-fg-muted">
                <ImageIcon size={28} aria-hidden="true" />
                <span className="text-sm">Aucune affiche</span>
              </div>
            )}
          </Section>

          <Section id="fiche-organisateur" title="Organisateur">
            {organizer ? (
              <dl className="flex flex-col gap-4">
                <InfoRow icon={<Building2 size={18} />} label="Structure">
                  {organizer.company_name ?? 'Non renseignée'}
                  {organizer.commercial_name && organizer.commercial_name !== organizer.company_name && (
                    <span className="block text-sm font-normal text-fg-muted">{organizer.commercial_name}</span>
                  )}
                  {partnerStatus && (
                    <span className="mt-1 block">
                      <Badge variant={partnerStatus.variant} size="sm">{partnerStatus.label}</Badge>
                    </span>
                  )}
                </InfoRow>
                {organizer.contact_name && (
                  <InfoRow icon={<Users size={18} />} label="Responsable">{organizer.contact_name}</InfoRow>
                )}
                {(organizer.phone || organizer.contact_phone) && (
                  <InfoRow icon={<Phone size={18} />} label="Téléphone">
                    <a href={`tel:${organizer.phone ?? organizer.contact_phone}`} className="inline-flex min-h-11 items-center text-brand-fg underline-offset-4 hover:underline">
                      {organizer.phone ?? organizer.contact_phone}
                    </a>
                  </InfoRow>
                )}
                {(organizer.email || organizer.contact_email) && (
                  <InfoRow icon={<Mail size={18} />} label="Email">
                    <a href={`mailto:${organizer.email ?? organizer.contact_email}`} className="inline-flex min-h-11 items-center break-all text-brand-fg underline-offset-4 hover:underline">
                      {organizer.email ?? organizer.contact_email}
                    </a>
                  </InfoRow>
                )}
                {organizer.city && <InfoRow icon={<MapPin size={18} />} label="Ville">{organizer.city}</InfoRow>}
              </dl>
            ) : (
              <p className="text-sm text-fg-muted">Organisateur introuvable.</p>
            )}
          </Section>

          <Section id="fiche-historique" title="Historique des statuts">
            {historyNewestFirst.length === 0 ? (
              <p className="text-sm text-fg-muted">Aucun changement de statut enregistré.</p>
            ) : (
              <ol className="flex flex-col gap-4">
                {historyNewestFirst.map((h) => (
                  <li key={h.id} className="relative border-l-2 border-border pl-4">
                    <span className="absolute -left-[5px] top-1.5 h-2 w-2 rounded-full bg-fg-muted" aria-hidden="true" />
                    <p className="text-base font-semibold text-fg">
                      {h.old_status ? `${eventStatusLabel(h.old_status)} → ${eventStatusLabel(h.new_status)}` : `Création : ${eventStatusLabel(h.new_status)}`}
                    </p>
                    <p className="text-sm text-fg-muted">
                      {h.actor_name ?? ROLE_LABELS[h.actor_role ?? ''] ?? 'Auteur inconnu'}
                      {h.actor_name && h.actor_role && ROLE_LABELS[h.actor_role] ? ` (${ROLE_LABELS[h.actor_role]})` : ''}
                      {h.channel && CHANNEL_LABELS[h.channel] ? ` · ${CHANNEL_LABELS[h.channel]}` : ''}
                    </p>
                    <p className="text-sm text-fg-muted">
                      <time dateTime={toDakarDateTimeLocal(h.created_at)}>{formatDateTime(h.created_at)}</time>
                    </p>
                    {h.reason && (
                      <blockquote className="mt-2 rounded-xl bg-surface-sunken px-3 py-2 text-sm text-fg">
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

      <Modal
        isOpen={!!confirmAction}
        onClose={closeDialogs}
        title={confirmCopy?.title}
        subtitle={event.title}
        maxWidth="md"
        busy={isSubmitting}
        footer={confirmAction ? (
          <>
            <Button variant="secondary" onClick={closeDialogs} disabled={isSubmitting} className="flex-1 sm:flex-none">
              Annuler
            </Button>
            <Button
              variant="primary"
              onClick={() => void runTransition(confirmAction)}
              isLoading={isSubmitting}
              className="flex-1 sm:flex-none"
            >
              {confirmAction.label}
            </Button>
          </>
        ) : undefined}
      >
        <div className="flex flex-col gap-3">
          <p className="text-base leading-relaxed text-fg">{confirmCopy?.body}</p>
          {actionError && (
            <StatusBanner tone="danger" title="Action impossible" announce="alert">
              {actionError}
            </StatusBanner>
          )}
        </div>
      </Modal>

      <ReasonDialog
        isOpen={!!reasonAction}
        onClose={closeDialogs}
        onConfirm={(reason) => {
          if (reasonAction) void runTransition(reasonAction, reason);
        }}
        title={reasonCopy?.title ?? 'Motif'}
        description={reasonCopy?.body}
        label={reasonAction?.to === 'SUSPENDU' ? 'Motif de la suspension' : 'Motif du refus'}
        hint="Au moins 3 caractères. Ce motif est communiqué à l’organisateur et reste dans l’historique."
        confirmLabel={reasonAction?.label ?? 'Confirmer'}
        variant="danger"
        isLoading={isSubmitting}
        error={actionError ?? undefined}
      />

      <EventCancelDialog
        eventId={event.id}
        eventTitle={event.title}
        scope="admin"
        open={isCancelOpen}
        onClose={() => setIsCancelOpen(false)}
        onCancelled={() => {
          setIsCancelOpen(false);
          void load(true);
        }}
      />
    </div>
  );
}

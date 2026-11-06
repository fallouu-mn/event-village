'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { RotateCcw, SearchX, ShieldOff } from 'lucide-react';
import { useAuth } from '@/components/providers/AuthProvider';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatusBadge, type StatusCatalog } from '@/components/ui/StatusBadge';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { useToast } from '@/components/ui/Toast';
import { formatDateTime, formatInteger } from '@/lib/format';
import {
  OUTBOX_STATUS_LABELS,
  OUTBOX_STATUS_TONES,
  outboxChannelLabel,
  outboxReasonLabel,
  outboxStatusLabel,
  outboxTypeLabel,
} from '@/lib/notifications/outbox-labels';

/**
 * Détail d'une notification de la boîte d'envoi (lot 6, contrats L2 à L4).
 *  - Source : GET /api/admin/notifications/[id] (ligne sans jeton de réservation, destinataire, instantané de
 *    décision, aperçu rendu par le serveur avec le catalogue). Pour un journal d'envoi immédiat (code à usage
 *    unique, invitation), le contenu n'est jamais conservé : rien n'est affiché du code ni du lien.
 *  - Sections : Envoi, Destinataire, Décision (instantané en libellés humains), Contenu, Tentatives.
 *  - « Relancer » n'est rendu QUE pour une ligne en échec relançable (statut FAILED, can_retry du serveur) et
 *    si l'administrateur a la permission notifications.write (SUPERADMIN : toujours) ; confirmation, puis
 *    POST /api/admin/notifications/[id]/retry. Jamais pour une ligne envoyée, en cours ou incertaine.
 *  - Aucun code technique affiché : statuts, canaux, types, motifs et décisions par leurs libellés.
 */

type Row = Record<string, unknown>;

/** Lot 7 (7.5) : libellés et tons du badge de statut, passés par l'écran (StatusBadge n'importe plus outbox-labels). */
const OUTBOX_STATUS_CATALOG: StatusCatalog = { labels: OUTBOX_STATUS_LABELS, tones: OUTBOX_STATUS_TONES };

interface Recipient {
  displayName: string | null;
  phone: string | null;
  email: string | null;
}

interface Detail {
  id: string;
  type: string;
  channel: string;
  status: string;
  origin: string;
  family: string | null;
  reason: string | null;
  reasonDetail: string | null;
  attempts: number;
  maxAttempts: number;
  manualRetries: number;
  createdAt: string | null;
  dueAt: string | null;
  nextAttemptAt: string | null;
  claimedAt: string | null;
  sentAt: string | null;
  finishedAt: string | null;
  providerMessageId: string | null;
  eventTitle: string | null;
  eventStatus: string | null;
  recipient: Recipient;
  decision: Row | null;
  canRetry: boolean;
}

type Preview = { available: true; title: string | null; text: string } | { available: false; reason: string };

type Phase = 'loading' | 'ready' | 'error' | 'not-found' | 'forbidden';

const NETWORK_MESSAGE = 'Connexion impossible : vérifiez votre réseau, puis réessayez.';
const OTP_CONTENT = 'Contenu non conservé : code à usage unique';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CODE_TOKEN_RE = /\b[A-Z][A-Z0-9]+(?:_[A-Z0-9]+)+\b/g;

const STAGE_LABELS: Record<string, string> = { ENQUEUE: 'À la mise en file', CLAIM: 'Au moment de l’envoi' };
const OUTCOME_LABELS: Record<string, string> = { SEND: 'Envoyer', SKIP: 'Ne pas envoyer', CANCEL: 'Annuler', WAIT: 'Attendre le résultat de la notification push' };
const FAMILY_LABELS: Record<string, string> = { ESSENTIAL: 'Indispensable (toujours envoyée)', OPTIONAL: 'Optionnelle (selon les préférences)' };
const TOPIC_LABELS: Record<string, string> = {
  REMINDERS: 'Rappels avant l’événement',
  EVENT_UPDATES: 'Changements d’un événement',
  PRO_ACTIVITY: 'Activité des ventes',
};
const SMS_POLICY_LABELS: Record<string, string> = {
  ALWAYS: 'SMS toujours envoyé',
  IF_NO_PUSH: 'SMS seulement sans notification push remise',
  NEVER: 'Jamais de SMS',
};
const SMS_OUTCOME_LABELS: Record<string, string> = {
  SENT: 'Accepté par le fournisseur',
  REJECTED: 'Refusé par le fournisseur',
  UNCERTAIN: 'Remise non confirmée par le fournisseur',
};
const ENCODING_LABELS: Record<string, string> = { GSM7: 'alphabet standard', 'GSM-7': 'alphabet standard', UCS2: 'caractères spéciaux', 'UCS-2': 'caractères spéciaux' };

const str = (v: unknown): string | null => (typeof v === 'string' && v ? v : null);
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : Number(v ?? 0) || 0);

function isRecord(v: unknown): v is Row {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function parseDetail(body: unknown): { item: Detail; preview: Preview } | null {
  if (!isRecord(body) || !isRecord(body.item)) return null;
  const i = body.item;
  if (typeof i.id !== 'string') return null;
  const r = isRecord(i.recipient) ? i.recipient : {};
  const item: Detail = {
    id: i.id,
    type: str(i.type) ?? '',
    channel: str(i.channel) ?? '',
    status: str(i.status) ?? '',
    origin: str(i.origin) ?? 'OUTBOX',
    family: str(i.family),
    reason: str(i.reason),
    reasonDetail: str(i.reason_detail),
    attempts: num(i.attempts),
    maxAttempts: num(i.max_attempts),
    manualRetries: num(i.manual_retries),
    createdAt: str(i.created_at),
    dueAt: str(i.due_at),
    nextAttemptAt: str(i.next_attempt_at),
    claimedAt: str(i.claimed_at),
    sentAt: str(i.sent_at),
    finishedAt: str(i.finished_at),
    providerMessageId: str(i.provider_message_id),
    eventTitle: str(i.event_title),
    eventStatus: str(i.event_status),
    recipient: { displayName: str(r.display_name), phone: str(r.phone), email: str(r.email) },
    decision: isRecord(i.decision) ? i.decision : null,
    canRetry: i.can_retry === true,
  };
  const p = isRecord(body.preview) ? body.preview : null;
  const preview: Preview = p && p.available === true && typeof p.text === 'string'
    ? { available: true, title: str(p.title), text: p.text }
    : { available: false, reason: str(p?.reason) ?? 'Aperçu indisponible.' };
  return { item, preview };
}

/** Détail technique du serveur : un code éventuel est remplacé par son libellé (jamais affiché brut). */
function humanDetail(text: string): string {
  return text.replace(CODE_TOKEN_RE, (code) => outboxReasonLabel(code) ?? 'code technique');
}

function when(iso: string | null): React.ReactNode {
  return iso ? <time dateTime={iso}>{formatDateTime(iso)}</time> : '—';
}

function Section({ title, id, children }: { title: string; id: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="rounded-2xl border border-border bg-surface p-4 sm:p-6">
      <h2 id={id} className="mb-4 text-lg font-semibold text-fg">{title}</h2>
      {children}
    </section>
  );
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-1 sm:grid-cols-[minmax(0,14rem)_minmax(0,1fr)] sm:gap-4">
      <dt className="text-sm text-fg-muted">{label}</dt>
      <dd className="min-w-0 break-words text-sm font-medium text-fg">{children}</dd>
    </div>
  );
}

/** Instantané de décision (C3) en libellés humains : aucun code n'est rendu tel quel. */
function DecisionList({ decision }: { decision: Row }) {
  const stage = str(decision.stage);
  const outcome = str(decision.outcome);
  const reason = str(decision.reason);
  const account = isRecord(decision.account) ? decision.account : null;
  const preference = isRecord(decision.preference) ? decision.preference : null;
  const event = isRecord(decision.event) ? decision.event : null;
  const holder = isRecord(decision.holder) ? decision.holder : null;
  const quiet = isRecord(decision.quiet) ? decision.quiet : null;
  const smsPolicy = str(decision.sms_policy);
  const pushSibling = str(decision.push_sibling);
  const delivery = isRecord(decision.delivery) ? decision.delivery : null;
  const validTickets = holder && Array.isArray(holder.valid_ticket_ids) ? holder.valid_ticket_ids.length : null;
  const devices = delivery && Array.isArray(delivery.devices) ? delivery.devices.length : null;
  const smsOutcome = delivery ? str(delivery.outcome) : null;
  const segments = delivery && typeof delivery.segments === 'number' ? delivery.segments : null;
  const encoding = delivery ? str(delivery.encoding) : null;

  return (
    <dl className="space-y-3 tabular-nums">
      <Info label="Moment">
        {stage ? STAGE_LABELS[stage] ?? 'Étape non répertoriée' : '—'}
        {str(decision.at) ? <> · {when(str(decision.at))}</> : null}
      </Info>
      <Info label="Décision">
        {outcome ? OUTCOME_LABELS[outcome] ?? 'Décision non répertoriée' : '—'}
        {reason ? ` · ${outboxReasonLabel(reason)}` : ''}
      </Info>
      {account && (
        <Info label="Compte du destinataire">
          {account.blocked === true ? 'Suspendu ou supprimé : seuls les messages admis lui parviennent' : 'Actif'}
        </Info>
      )}
      <Info label="Préférence">
        {preference
          ? `${TOPIC_LABELS[str(preference.topic) ?? ''] ?? 'Sujet non répertorié'} · ${outboxChannelLabel(str(preference.channel) ?? '')} : ${preference.enabled === false ? 'désactivé par le destinataire' : 'activé'}`
          : 'Message indispensable : aucune préférence ne s’applique'}
      </Info>
      {event && (
        <Info label="Événement à ce moment">
          <span className="inline-flex flex-wrap items-center gap-2">
            <StatusBadge domain="event" status={str(event.status)} size="sm" />
            {str(event.start_at) ? <span>Début : {when(str(event.start_at))}</span> : null}
          </span>
        </Info>
      )}
      {validTickets !== null && (
        <Info label="Porteur">
          {validTickets > 0 ? `${formatInteger(validTickets)} billet${validTickets > 1 ? 's' : ''} valable${validTickets > 1 ? 's' : ''} à ce moment` : 'Aucun billet valable à ce moment'}
        </Info>
      )}
      {quiet && (
        <Info label="Plage sans SMS">
          {`De ${String(quiet.start ?? '?')} h à ${String(quiet.end ?? '?')} h (heure de Dakar) ; heure de la décision : ${String(quiet.hour ?? '?')} h, ${quiet.in_quiet === true ? 'dans la plage' : 'hors de la plage'}`}
        </Info>
      )}
      {smsPolicy && <Info label="Règle du SMS">{SMS_POLICY_LABELS[smsPolicy] ?? 'Règle non répertoriée'}</Info>}
      {pushSibling && <Info label="Notification push du même message">{outboxStatusLabel(pushSibling)}</Info>}
      {smsOutcome && <Info label="Réponse du fournisseur SMS">{SMS_OUTCOME_LABELS[smsOutcome] ?? 'Réponse non répertoriée'}</Info>}
      {segments !== null && (
        <Info label="Taille du SMS">
          {`${formatInteger(segments)} SMS facturé${segments > 1 ? 's' : ''}${encoding ? `, ${ENCODING_LABELS[encoding] ?? 'encodage non répertorié'}` : ''}`}
        </Info>
      )}
      {devices !== null && <Info label="Appareils visés">{`${formatInteger(devices)} appareil${devices > 1 ? 's' : ''}`}</Info>}
    </dl>
  );
}

export default function AdminNotificationDetailPage() {
  const params = useParams<{ id: string }>();
  const id = typeof params?.id === 'string' ? params.id : '';
  const toast = useToast();
  const { user, hasRole, isLoading: isAuthLoading } = useAuth();

  const [detail, setDetail] = useState<{ item: Detail; preview: Preview } | null>(null);
  const [phase, setPhase] = useState<Phase>('loading');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const [canWrite, setCanWrite] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isRelaunching, setIsRelaunching] = useState(false);
  const [relaunchError, setRelaunchError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!UUID_RE.test(id)) {
      setPhase('not-found');
      return;
    }
    let res: Response;
    try {
      res = await fetch(`/api/admin/notifications/${id}`, { cache: 'no-store' });
    } catch (err) {
      console.error('[Détail de notification] injoignable :', err instanceof Error ? err.message : String(err));
      setErrorMessage(NETWORK_MESSAGE);
      setPhase('error');
      return;
    }
    if (res.status === 404) {
      setPhase('not-found');
      return;
    }
    if (res.status === 403) {
      setPhase('forbidden');
      return;
    }
    let body: unknown = null;
    try {
      body = await res.json();
    } catch (err) {
      console.error(`[Détail de notification] réponse illisible (HTTP ${res.status}) :`, err instanceof Error ? err.message : String(err));
      setErrorMessage(`Réponse inattendue du serveur (erreur ${res.status}).`);
      setPhase('error');
      return;
    }
    if (!res.ok) {
      setErrorMessage(isRecord(body) && typeof body.error === 'string' && body.error ? body.error : `Détail indisponible (erreur ${res.status}).`);
      setPhase('error');
      return;
    }
    const parsed = parseDetail(body);
    if (!parsed) {
      console.error('[Détail de notification] réponse inattendue :', body);
      setErrorMessage('Réponse inattendue du serveur.');
      setPhase('error');
      return;
    }
    setDetail(parsed);
    setErrorMessage(null);
    setPhase('ready');
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  // Permission de relance : SUPERADMIN d'office ; ADMIN selon ses permissions (le serveur revérifie).
  useEffect(() => {
    if (isAuthLoading || !user?.id) return;
    if (hasRole('SUPERADMIN')) {
      setCanWrite(true);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/admin/permissions?adminId=${encodeURIComponent(user.id)}`, { cache: 'no-store' });
        if (!res.ok) {
          console.warn(`[Détail de notification] permissions illisibles (HTTP ${res.status}) : relance masquée`);
          if (!cancelled) setCanWrite(false);
          return;
        }
        const body = await res.json() as { assignedPermissions?: unknown };
        const assigned = Array.isArray(body.assignedPermissions) ? body.assignedPermissions : [];
        if (!cancelled) setCanWrite(assigned.includes('notifications.write'));
      } catch (err) {
        console.warn('[Détail de notification] permissions injoignables, relance masquée :', err instanceof Error ? err.message : String(err));
        if (!cancelled) setCanWrite(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAuthLoading, user?.id, hasRole]);

  const retryLoad = async () => {
    setIsRetrying(true);
    try {
      await load();
    } finally {
      setIsRetrying(false);
    }
  };

  const relaunch = async () => {
    setIsRelaunching(true);
    setRelaunchError(null);
    try {
      const res = await fetch(`/api/admin/notifications/${id}/retry`, { method: 'POST' });
      let body: { error?: unknown } = {};
      try {
        body = await res.json();
      } catch (err) {
        console.error(`[Détail de notification] réponse de relance illisible (HTTP ${res.status}) :`, err instanceof Error ? err.message : String(err));
      }
      if (!res.ok) {
        setRelaunchError(typeof body.error === 'string' && body.error ? body.error : `La relance a échoué (erreur ${res.status}).`);
        setConfirmOpen(false);
        if (res.status === 403) setCanWrite(false);
        await load();
        return;
      }
      toast.success('Notification remise en attente : elle repartira au prochain passage de l’envoyeur.');
      setConfirmOpen(false);
      await load();
    } catch (err) {
      console.error('[Détail de notification] relance injoignable :', err instanceof Error ? err.message : String(err));
      setRelaunchError(NETWORK_MESSAGE);
      setConfirmOpen(false);
    } finally {
      setIsRelaunching(false);
    }
  };

  const back = { href: '/admin/notifications', label: 'Toutes les notifications' };

  if (phase === 'not-found') {
    return (
      <div className="space-y-6 pb-24 lg:pb-12">
        <PageHeader title="Notification introuvable" back={back} />
        <EmptyState
          icon={<SearchX size={28} />}
          title="Cette notification n’existe pas"
          description="Le lien est incomplet ou la ligne a été supprimée avec le compte du destinataire."
          actionLabel="Voir toutes les notifications"
          actionHref="/admin/notifications"
        />
      </div>
    );
  }

  if (phase === 'forbidden') {
    return (
      <div className="space-y-6 pb-24 lg:pb-12">
        <PageHeader title="Notification" back={back} />
        <EmptyState
          icon={<ShieldOff size={28} />}
          title="Accès refusé"
          description="Vous n'avez pas la permission de consulter les notifications."
          actionLabel="Retour à l’administration"
          actionHref="/admin/dashboard"
        />
      </div>
    );
  }

  if (phase === 'error' || (phase === 'ready' && !detail)) {
    return (
      <div className="space-y-6 pb-24 lg:pb-12">
        <PageHeader title="Notification" back={back} />
        <ErrorState title="Détail indisponible" description={errorMessage ?? NETWORK_MESSAGE} onRetry={() => void retryLoad()} isRetrying={isRetrying} />
      </div>
    );
  }

  if (phase === 'loading' || !detail) {
    return (
      <div className="space-y-6 pb-24 lg:pb-12" aria-busy="true">
        <PageHeader title="Notification" back={back} />
        <span className="sr-only">Chargement de la notification…</span>
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-32 rounded-2xl border border-border bg-surface motion-safe:animate-pulse" aria-hidden="true" />
        ))}
      </div>
    );
  }

  const { item, preview } = detail;
  const isSyncLog = item.origin === 'SYNC_LOG';
  const canRetry = item.status === 'FAILED' && item.canRetry && canWrite;

  return (
    <div className="space-y-6 pb-24 lg:pb-12">
      <PageHeader
        title={outboxTypeLabel(item.type)}
        description={`${outboxChannelLabel(item.channel)} · créée le ${formatDateTime(item.createdAt)}`}
        eyebrow={<StatusBadge domain="notification" catalog={OUTBOX_STATUS_CATALOG} status={item.status} />}
        back={back}
        actions={canRetry && (
          <Button variant="primary" onClick={() => { setRelaunchError(null); setConfirmOpen(true); }} leftIcon={<RotateCcw size={18} aria-hidden="true" />}>
            Relancer
          </Button>
        )}
      />

      {relaunchError && (
        <StatusBanner tone="danger" announce="alert" title="Relance impossible">
          {relaunchError}
        </StatusBanner>
      )}
      {item.status === 'UNCERTAIN' && (
        <StatusBanner tone="warning" title="Remise non confirmée">
          Le fournisseur a peut-être remis ce message : il n’est jamais renvoyé, ni automatiquement ni à la main, pour éviter un doublon.
        </StatusBanner>
      )}
      {item.status === 'FAILED' && !item.canRetry && (
        <StatusBanner tone="neutral" title="Relance non proposée">
          Un code à usage unique ou une invitation ne se renvoie pas : la personne doit en demander un nouveau.
        </StatusBanner>
      )}

      <Section title="Envoi" id="notif-envoi">
        <dl className="space-y-3">
          <Info label="Type">{outboxTypeLabel(item.type)}</Info>
          <Info label="Canal">{outboxChannelLabel(item.channel)}</Info>
          <Info label="Statut"><StatusBadge domain="notification" catalog={OUTBOX_STATUS_CATALOG} status={item.status} size="sm" /></Info>
          {item.reason && <Info label="Motif">{outboxReasonLabel(item.reason)}</Info>}
          {item.reasonDetail && <Info label="Précision">{humanDetail(item.reasonDetail)}</Info>}
          {item.family && <Info label="Famille">{FAMILY_LABELS[item.family] ?? 'Famille non répertoriée'}</Info>}
          <Info label="Origine">{isSyncLog ? 'Envoi immédiat journalisé (code à usage unique ou invitation)' : 'Boîte d’envoi'}</Info>
          {item.eventTitle && (
            <Info label="Événement">
              <span className="inline-flex flex-wrap items-center gap-2">
                <span>{item.eventTitle}</span>
                {item.eventStatus && <StatusBadge domain="event" status={item.eventStatus} size="sm" />}
              </span>
            </Info>
          )}
          <Info label="Créée le">{when(item.createdAt)}</Info>
          <Info label="Prévue le">{when(item.dueAt)}</Info>
          <Info label="Envoyée le">{when(item.sentAt)}</Info>
          {item.providerMessageId && <Info label="Référence du fournisseur">{item.providerMessageId}</Info>}
        </dl>
      </Section>

      <Section title="Destinataire" id="notif-destinataire">
        <dl className="space-y-3">
          <Info label="Compte">{item.recipient.displayName ?? 'Aucun compte (numéro seul)'}</Info>
          <Info label="Téléphone"><span className="tabular-nums">{item.recipient.phone ?? '—'}</span></Info>
          <Info label="Email">{item.recipient.email ?? '—'}</Info>
        </dl>
      </Section>

      <Section title="Décision" id="notif-decision">
        {item.decision ? (
          <DecisionList decision={item.decision} />
        ) : (
          <p className="text-sm text-fg-muted">Aucune décision enregistrée : la notification n’est pas encore passée par l’envoyeur.</p>
        )}
      </Section>

      <Section title="Contenu" id="notif-contenu">
        {isSyncLog ? (
          <p className="text-sm text-fg-muted">{OTP_CONTENT}</p>
        ) : preview.available ? (
          <div className="space-y-2 rounded-xl border border-border bg-surface-sunken p-4">
            {preview.title && <p className="text-sm font-semibold text-fg">{preview.title}</p>}
            <p className="whitespace-pre-line break-words text-sm leading-relaxed text-fg">{preview.text}</p>
            <p className="text-sm text-fg-muted">Aperçu rendu par le serveur à partir des données de la notification.</p>
          </div>
        ) : (
          <p className="text-sm text-fg-muted">{preview.reason}</p>
        )}
      </Section>

      <Section title="Tentatives" id="notif-tentatives">
        <dl className="space-y-3 tabular-nums">
          <Info label="Tentatives">{`${formatInteger(item.attempts)} sur ${formatInteger(item.maxAttempts)}`}</Info>
          <Info label="Relances manuelles">{formatInteger(item.manualRetries)}</Info>
          <Info label="Dernière prise en charge">{when(item.claimedAt)}</Info>
          <Info label="Prochain essai">{item.status === 'PENDING' ? when(item.nextAttemptAt) : '—'}</Info>
          <Info label="Terminée le">{when(item.finishedAt)}</Info>
        </dl>
      </Section>

      <ConfirmDialog
        isOpen={confirmOpen}
        onClose={() => { if (!isRelaunching) setConfirmOpen(false); }}
        onConfirm={() => void relaunch()}
        title="Relancer cette notification ?"
        message="Elle repartira au prochain passage de l'envoyeur."
        confirmLabel="Relancer"
        variant="warning"
        isLoading={isRelaunching}
      />
    </div>
  );
}

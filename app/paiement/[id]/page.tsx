'use client';

/**
 * Suivi d'un paiement Mobile Money (lot 2.10) — /paiement/<id>.
 *
 * Le cashin direct SamirPay n'a pas d'URL de retour : après l'initiation, le client arrive ici.
 * La page sonde la route de statut toutes les 3 s tant que le paiement est en attente (pause quand
 * l'onglet est masqué, reprise immédiate au retour de l'application de l'opérateur), affiche le temps
 * restant jusqu'à l'échéance de la réservation (expires_at), permet l'annulation tant que le paiement
 * est en attente et renvoie vers la bonne destination une fois le paiement confirmé.
 *
 * Lot 7 (7.3, E4 ; D58, D60, D62, contrat 3.5) :
 *  - attente honnête (PaymentWaitingInfo) : ce que le client va recevoir, et ce qui se passe si la page se
 *    ferme (achat enregistré, SMS au numéro masqué payer_phone_masked, billets dans Mes billets) ;
 *  - succès : destination servie par la route (success_url : /tickets, /partner/subscription pour un
 *    abonnement, jamais /orders pour lui) ; échec, annulation, échéance : « Réessayer le paiement » vers
 *    retry_url (la page de l'événement préremplit le panier) ;
 *  - annulation vérifiée chez SamirPay par le serveur : « vient d'être confirmé » (409), « vérification
 *    impossible » (503) ;
 *  - plus aucune bibliothèque d’animation (D77), système de design (tokens, 14 px au moins), montants par formatFcfa (D60).
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { QRCodeSVG } from 'qrcode.react';
import {
  AlertTriangle,
  ArrowRight,
  Check,
  CheckCircle2,
  Clock,
  ExternalLink,
  Hourglass,
  LogIn,
  QrCode,
  RefreshCw,
  RotateCcw,
  SearchX,
  ShieldCheck,
  Smartphone,
  Ticket,
  WifiOff,
  XCircle,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Badge, type BadgeVariant } from '@/components/ui/Badge';
import { Button, buttonClasses } from '@/components/ui/Button';
import { LinkButton } from '@/components/ui/LinkButton';
import { Skeleton } from '@/components/ui/Skeleton';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { useToast } from '@/components/ui/Toast';
import { cn } from '@/components/ui/cn';
import { PaymentWaitingInfo, type PaymentWaitingItem } from '@/components/payment/PaymentWaitingInfo';
import { formatFcfa, formatTime } from '@/lib/format';
import {
  clearPaymentHandoff,
  isMobileDevice,
  isRecord,
  isSamirPayOperator,
  nonEmptyString,
  readAmount,
  readJsonBody,
  readPaymentHandoff,
  serverErrorCode,
  serverErrorMessage,
  toSafeExternalUrl,
  type PaymentHandoff,
} from '@/lib/payments/payment-client';
import { REFUND_DELAYED_LABEL } from '@/lib/payments/payment-labels';
import { OPERATOR_LABELS } from '@/lib/samirpay/types';

/* ──────────────────────────────── Réglages ──────────────────────────────── */

const POLL_INTERVAL_MS = 3_000;
/** Après plusieurs échecs réseau consécutifs, le sondage ralentit. */
const POLL_BACKOFF_MS = 10_000;
const BACKOFF_AFTER_FAILURES = 3;
/**
 * Délai laissé à la réconciliation après la fin de validité du paiement chez SamirPay (paymentDeadline, création
 * + 60 minutes ; à défaut l'échéance de la réservation) avant d'arrêter le sondage automatique.
 */
const GRACE_AFTER_DEADLINE_MS = 120_000;
const SUCCESS_REDIRECT_SECONDS = 6;
const PAYMENT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Destinations internes acceptées depuis la route (chemin commençant par « / », jamais « // »). */
const INTERNAL_PATH = /^\/(?!\/)[^\s]*$/;

/* ──────────────────────────────── Types ──────────────────────────────── */

interface PaymentStatusView {
  paymentId: string;
  status: string;
  /** Total payé (prix + frais de service), montant demandé à l'opérateur. */
  amount: number;
  /** Prix des billets ou de la prestation (facial_amount) ; null si la route ne le fournit pas. */
  facialAmount: number | null;
  /** Frais de service payés par l'acheteur (service_fee) ; null si la route ne le fournit pas. */
  serviceFee: number | null;
  operator: string | null;
  /** Échéance de la réservation (expires_at), en millisecondes ; null si le paiement n'en a pas. */
  expiresAt: number | null;
  /** Lot 9 bis (H2) : durée de garde des places appliquée à ce paiement (holdMinutes), en minutes ; null sans réservation. */
  holdMinutes: number | null;
  /** Lot 9 bis (H2) : fin de validité du paiement chez SamirPay (paymentDeadline), en millisecondes ; null si inconnue. */
  paymentDeadline: number | null;
  /** Lot 9 bis (B9) : un remboursement de ce paiement est retardé (refundDelayed). */
  refundDelayed: boolean;
  ticketIds: string[];
  /** Cible du paiement (target_type) : TICKET, SUBSCRIPTION, ORDER… */
  targetType: string | null;
  event: { title: string; startAt: string | null } | null;
  ticketCount: number;
  items: PaymentWaitingItem[];
  /** Numéro payeur masqué (payer_phone_masked), jamais le numéro en clair. */
  payerPhoneMasked: string | null;
  receiptChannels: string[];
  /** Destination après confirmation (success_url) servie par la route. */
  successUrl: string;
  /** Reprise après un échec (retry_url) ; null si la cible n'en a pas. */
  retryUrl: string | null;
}

type LoadState =
  | { kind: 'loading' }
  | { kind: 'ready' }
  | { kind: 'unauthenticated' }
  | { kind: 'forbidden'; message: string }
  | { kind: 'not_found' }
  | { kind: 'error'; message: string };

type Tone = 'pending' | 'success' | 'failed' | 'refund' | 'unknown';

interface StatusMeta {
  badge: 'En attente' | 'Confirmé' | 'Échoué' | 'Statut inconnu';
  chip: string | null;
  tone: Tone;
  title: string;
  description: string;
  icon: LucideIcon;
}

/* ─────────────────────────────── Utilitaires ─────────────────────────────── */

function operatorLabel(operator: string): string {
  return isSamirPayOperator(operator) ? OPERATOR_LABELS[operator] : 'Mobile Money';
}

function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  if (hours > 0) return `${hours} h ${String(minutes).padStart(2, '0')} min`;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function internalPath(value: unknown): string | null {
  const path = nonEmptyString(value);
  return path && INTERNAL_PATH.test(path) ? path : null;
}

function readItems(value: unknown): PaymentWaitingItem[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((raw: unknown) => {
    if (!isRecord(raw)) return [];
    const quantity = readAmount(raw.quantity);
    if (quantity === null || quantity <= 0) return [];
    return [{ categoryName: nonEmptyString(raw.category_name), quantity }];
  });
}

/** Date ISO facultative en millisecondes ; undefined si elle est présente mais illisible (réponse hors contrat). */
function readInstant(value: unknown): number | null | undefined {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') return undefined;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? undefined : parsed;
}

/** Réponse de GET /api/payments/<id>/status ; null si elle ne respecte pas le contrat. */
function parseStatusBody(body: unknown): PaymentStatusView | null {
  if (!isRecord(body)) return null;
  const b = body;
  if (typeof b.payment_id !== 'string' || typeof b.status !== 'string') return null;
  if (typeof b.amount !== 'number' || !Number.isFinite(b.amount)) return null;
  if (b.operator !== null && b.operator !== undefined && typeof b.operator !== 'string') return null;
  const expiresAt = readInstant(b.expires_at);
  const paymentDeadline = readInstant(b.paymentDeadline);
  if (expiresAt === undefined || paymentDeadline === undefined) return null;
  const holdMinutes = readAmount(b.holdMinutes);
  if (!Array.isArray(b.ticket_ids) || !b.ticket_ids.every((t) => typeof t === 'string')) return null;
  const event = isRecord(b.event) && typeof b.event.title === 'string'
    ? { title: b.event.title, startAt: nonEmptyString(b.event.start_at) }
    : null;
  const channels = Array.isArray(b.receipt_channels) ? b.receipt_channels.filter((c): c is string => typeof c === 'string') : [];
  const targetType = nonEmptyString(b.target_type);
  return {
    paymentId: b.payment_id,
    status: b.status,
    amount: b.amount,
    facialAmount: readAmount(b.facial_amount),
    serviceFee: readAmount(b.service_fee),
    operator: typeof b.operator === 'string' ? b.operator : null,
    expiresAt,
    holdMinutes: holdMinutes !== null && holdMinutes > 0 ? holdMinutes : null,
    paymentDeadline,
    refundDelayed: b.refundDelayed === true,
    ticketIds: b.ticket_ids as string[],
    targetType,
    event,
    ticketCount: readAmount(b.ticket_count) ?? 0,
    items: readItems(b.items),
    payerPhoneMasked: nonEmptyString(b.payer_phone_masked),
    receiptChannels: channels,
    successUrl: internalPath(b.success_url) ?? (targetType === 'SUBSCRIPTION' ? '/partner/subscription' : '/tickets'),
    retryUrl: internalPath(b.retry_url),
  };
}

function describeStatus(p: PaymentStatusView, ctx: { expired: boolean; stale: boolean }): StatusMeta {
  const label = p.operator ? operatorLabel(p.operator) : null;
  const amount = formatFcfa(p.amount);
  switch (p.status) {
    case 'PENDING':
      if (ctx.stale) {
        return {
          badge: 'En attente',
          chip: null,
          tone: 'pending',
          title: 'Confirmation non reçue',
          description: `${label ?? 'L’opérateur'} n’a pas encore confirmé ce paiement. Actualisez dans un instant : si votre compte a été débité, le paiement sera pris en compte automatiquement.`,
          icon: Hourglass,
        };
      }
      if (ctx.expired) {
        return {
          badge: 'En attente',
          chip: null,
          tone: 'pending',
          title: 'Places plus garanties',
          description: 'Vos places ne sont plus garanties. Si vous validez quand même le paiement, vos billets seront émis s’il reste des places ; sinon vous serez remboursé automatiquement.',
          icon: Hourglass,
        };
      }
      return {
        badge: 'En attente',
        chip: null,
        tone: 'pending',
        title: 'Validez le paiement',
        description: `Confirmez le paiement de ${amount} dans ${label ?? 'votre application Mobile Money'}. Cette page se met à jour automatiquement.`,
        icon: Smartphone,
      };
    case 'SUCCESS': {
      const n = p.ticketIds.length;
      return {
        badge: 'Confirmé',
        chip: null,
        tone: 'success',
        title: 'Paiement confirmé',
        description:
          n > 1
            ? `Vos ${n} billets sont disponibles dans Mes billets.`
            : n === 1
            ? 'Votre billet est disponible dans Mes billets.'
            : p.targetType === 'SUBSCRIPTION'
            ? 'Votre paiement est enregistré : votre abonnement est mis à jour.'
            : 'Votre paiement est enregistré.',
        icon: CheckCircle2,
      };
    }
    case 'FAILED':
      return {
        badge: 'Échoué',
        chip: null,
        tone: 'failed',
        title: 'Le paiement n’a pas abouti',
        description: `${label ?? 'L’opérateur'} n’a pas confirmé le paiement de ${amount}. Vous pouvez réessayer ; si votre compte a tout de même été débité, contactez le support (page Aide : /aide) avec la référence ci-\u2060dessous.`,
        icon: XCircle,
      };
    case 'CANCELLED':
      return {
        badge: 'Échoué',
        chip: null,
        tone: 'failed',
        title: 'Paiement annulé',
        description:
          'La demande a été annulée et la réservation libérée. Si vous aviez déjà validé sur votre téléphone, le paiement sera tout de même pris en compte ou remboursé automatiquement.',
        icon: XCircle,
      };
    case 'EXPIRED':
      return {
        badge: 'Échoué',
        chip: null,
        tone: 'failed',
        title: 'Délai de paiement dépassé',
        description:
          'La réservation a expiré faute de confirmation à temps et les places ont été libérées. Si vous avez validé après l’échéance, le paiement sera pris en compte ou remboursé automatiquement.',
        icon: Clock,
      };
    case 'REFUND_PENDING':
      return {
        badge: 'Échoué',
        chip: p.refundDelayed ? 'Remboursement retardé' : 'Remboursement en cours',
        tone: 'refund',
        title: 'Paiement en cours de remboursement',
        description: `Ce paiement n’a pas pu être honoré : ${amount} vous est reversé sur le compte ${label ?? 'Mobile Money'} qui a payé.`,
        icon: RotateCcw,
      };
    case 'PARTIAL':
      return {
        badge: 'Confirmé',
        chip: 'Remboursé en partie',
        tone: 'success',
        title: 'Paiement remboursé en partie',
        description: `Une partie de ce paiement a été reversée sur le compte ${label ?? 'Mobile Money'} qui a payé.`,
        icon: CheckCircle2,
      };
    case 'REFUNDED':
      return {
        badge: 'Échoué',
        chip: 'Remboursé',
        tone: 'refund',
        title: 'Paiement remboursé',
        description: `${amount} a été reversé sur le compte ${label ?? 'Mobile Money'} qui a payé.`,
        icon: RotateCcw,
      };
    default:
      return {
        badge: 'Statut inconnu',
        chip: null,
        tone: 'unknown',
        title: 'Statut à vérifier',
        description: 'Le statut de ce paiement n’a pas pu être interprété. Si la situation persiste, contactez le support (page Aide : /aide) avec la référence ci-\u2060dessous.',
        icon: AlertTriangle,
      };
  }
}

const TONE_STYLES: Record<Tone, { bar: string; circle: string; badge: BadgeVariant }> = {
  pending: { bar: 'bg-warning', circle: 'border-warning-border bg-warning-bg text-warning-fg', badge: 'warning' },
  success: { bar: 'bg-success', circle: 'border-success-border bg-success-bg text-success-fg', badge: 'success' },
  failed: { bar: 'bg-danger', circle: 'border-danger-border bg-danger-bg text-danger-fg', badge: 'danger' },
  refund: { bar: 'bg-info', circle: 'border-info-border bg-info-bg text-info-fg', badge: 'danger' },
  unknown: { bar: 'bg-border-strong', circle: 'border-border bg-surface-sunken text-fg-muted', badge: 'neutral' },
};

const CARD = 'w-full max-w-md rounded-3xl border border-border bg-surface shadow-lg';

/** Libellé du bouton de succès selon la destination servie par la route. */
function successLabel(p: PaymentStatusView): string {
  if (p.successUrl.startsWith('/tickets')) return 'Voir mes billets';
  if (p.successUrl.startsWith('/partner/subscription')) return 'Voir mon abonnement';
  return 'Voir mes commandes et réservations';
}

/* ─────────────────────────────── Hooks ─────────────────────────────── */

/**
 * Sondage du statut : immédiat puis toutes les 3 s tant que le paiement est en attente. Arrêt sur
 * un statut final, une erreur d'accès (401, 403, 404) ou au-delà de l'échéance + délai de grâce.
 */
function usePaymentStatusPolling(id: string | null) {
  const [load, setLoad] = useState<LoadState>({ kind: 'loading' });
  const [payment, setPayment] = useState<PaymentStatusView | null>(null);
  const [connectionIssue, setConnectionIssue] = useState(false);
  const [stale, setStale] = useState(false);
  const [cycle, setCycle] = useState(0);

  useEffect(() => {
    if (!id) return;
    let disposed = false;
    let active = true;
    let running = false;
    let failures = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const schedule = (delay: number) => {
      if (timer) clearTimeout(timer);
      timer = null;
      if (disposed || !active) return;
      // Onglet masqué : reprise au retour (visibilitychange).
      if (document.visibilityState !== 'visible') return;
      timer = setTimeout(() => void tick(), delay);
    };

    const tick = async () => {
      if (disposed || running) return;
      running = true;
      try {
        const res = await fetch(`/api/payments/${id}/status`, { cache: 'no-store' });
        const body = await readJsonBody(res, `paiement ${id} / statut`);
        if (disposed) return;
        if (res.status === 401) {
          active = false;
          setLoad({ kind: 'unauthenticated' });
          return;
        }
        if (res.status === 403) {
          active = false;
          setLoad({ kind: 'forbidden', message: serverErrorMessage(body) ?? 'Votre compte ne permet pas de consulter ce paiement.' });
          return;
        }
        if (res.status === 404 || res.status === 400) {
          active = false;
          setLoad({ kind: 'not_found' });
          return;
        }
        if (!res.ok) {
          throw new Error(`HTTP ${res.status} : ${serverErrorMessage(body) ?? 'statut indisponible'}`);
        }
        const view = parseStatusBody(body);
        if (!view) throw new Error('réponse de statut hors contrat');
        failures = 0;
        setConnectionIssue(false);
        setPayment(view);
        setLoad({ kind: 'ready' });
        if (view.status !== 'PENDING') {
          active = false;
          return;
        }
        // Lot 9 bis (H2) : suivi jusqu'à la fin de validité chez SamirPay, pas seulement jusqu'à l'échéance des places.
        const end = view.paymentDeadline ?? view.expiresAt;
        if (end !== null && Date.now() > end + GRACE_AFTER_DEADLINE_MS) {
          active = false;
          setStale(true);
          return;
        }
        setStale(false);
      } catch (err) {
        if (disposed) return;
        failures += 1;
        console.error(`[paiement ${id}] sondage du statut en échec (${failures}) :`, err instanceof Error ? err.message : err);
        setConnectionIssue(true);
        setLoad((prev) => (prev.kind === 'ready' ? prev : { kind: 'error', message: 'Le statut du paiement est momentanément indisponible.' }));
      } finally {
        running = false;
        schedule(failures >= BACKOFF_AFTER_FAILURES ? POLL_BACKOFF_MS : POLL_INTERVAL_MS);
      }
    };

    const onVisibility = () => {
      if (document.visibilityState !== 'visible' || !active || running) return;
      if (timer) clearTimeout(timer);
      timer = null;
      void tick();
    };

    document.addEventListener('visibilitychange', onVisibility);
    void tick();
    return () => {
      disposed = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [id, cycle]);

  /** Relance le sondage (bouton « Actualiser », après une annulation refusée…). */
  const refresh = useCallback(() => {
    setStale(false);
    setCycle((c) => c + 1);
  }, []);

  /** Statut connu localement (annulation acceptée) avant la prochaine lecture du serveur. */
  const applyStatus = useCallback((status: string) => {
    setPayment((prev) => (prev ? { ...prev, status } : prev));
  }, []);

  return { load, payment, connectionIssue, stale, refresh, applyStatus };
}

function useNow(enabled: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!enabled) return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [enabled]);
  return now;
}

/* ─────────────────────────────── Composants ─────────────────────────────── */

function StateCard({
  icon: Icon,
  tone,
  title,
  description,
  children,
}: {
  icon: LucideIcon;
  tone: 'failed' | 'neutral' | 'pending';
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  const circle =
    tone === 'failed'
      ? 'bg-danger-bg text-danger-fg'
      : tone === 'pending'
      ? 'bg-warning-bg text-warning-fg'
      : 'bg-brand-bg text-brand-fg';
  return (
    <section className={cn(CARD, 'space-y-6 p-6 text-center sm:p-8')}>
      <div className={cn('mx-auto flex h-16 w-16 items-center justify-center rounded-full', circle)} aria-hidden="true">
        <Icon size={30} />
      </div>
      <div className="space-y-2">
        <h1 className="text-xl font-bold tracking-tight text-fg">{title}</h1>
        <p className="text-sm leading-relaxed text-fg-muted">{description}</p>
      </div>
      {children && <div className="flex flex-col gap-2 pt-1">{children}</div>}
    </section>
  );
}

function ProgressSteps({ done, label }: { done: boolean; label: string | null }) {
  const steps: { title: string; state: 'done' | 'active' | 'todo' }[] = [
    { title: 'Demande envoyée', state: 'done' },
    { title: `Validation ${label ?? 'opérateur'}`, state: done ? 'done' : 'active' },
    { title: 'Confirmation', state: done ? 'done' : 'todo' },
  ];
  return (
    <ol className="grid grid-cols-3" aria-label="Étapes du paiement">
      {steps.map((step, index) => (
        <li
          key={step.title}
          className="relative flex flex-col items-center gap-1.5 px-1 text-center"
          aria-current={step.state === 'active' ? 'step' : undefined}
        >
          {index > 0 && (
            <span
              aria-hidden="true"
              className={cn('absolute right-1/2 top-3 h-0.5 w-full', step.state === 'todo' ? 'bg-border' : 'bg-success')}
            />
          )}
          <span
            aria-hidden="true"
            className={cn(
              'relative z-10 flex h-6 w-6 items-center justify-center rounded-full',
              step.state === 'done'
                ? 'bg-success text-on-tone'
                : step.state === 'active'
                ? 'bg-warning text-on-tone ring-4 ring-warning/20'
                : 'bg-surface-sunken text-fg-muted ring-1 ring-inset ring-border',
            )}
          >
            {step.state === 'done' ? (
              <Check size={14} strokeWidth={3} />
            ) : step.state === 'active' ? (
              <span className="h-2 w-2 rounded-full bg-on-tone motion-safe:animate-pulse" />
            ) : (
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
            )}
          </span>
          <span className={cn('text-sm font-semibold leading-tight', step.state === 'todo' ? 'text-fg-muted' : 'text-fg')}>
            {step.title}
            <span className="sr-only">{step.state === 'done' ? ' : terminé' : step.state === 'active' ? ' : en cours' : ' : à venir'}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

/** QR code de paiement : image fournie (data URL ou base64) ou contenu à encoder. */
function PaymentQr({ value, label }: { value: string; label: string }) {
  const compact = value.replace(/\s/g, '');
  const image = value.startsWith('data:image/')
    ? value
    : /^[A-Za-z0-9+/]+={0,2}$/.test(compact) && compact.length >= 200
    ? `data:image/png;base64,${compact}`
    : null;
  if (image) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- QR de paiement en data URL généré à la volée : next/image inapplicable
      <img src={image} alt={`QR code de paiement ${label}`} width={160} height={160} className="h-40 w-40 object-contain" />
    );
  }
  return <QRCodeSVG value={value} size={160} level="M" marginSize={0} title={`QR code de paiement ${label}`} />;
}

/* ─────────────────────────────── Page ─────────────────────────────── */

export default function PaymentStatusPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const toast = useToast();
  const id = PAYMENT_ID.test(params.id) ? params.id : null;
  const loginHref = `/login?redirect=${encodeURIComponent(`/paiement/${params.id}`)}`;

  const { load, payment, connectionIssue, stale, refresh, applyStatus } = usePaymentStatusPolling(id);
  const [handoff, setHandoff] = useState<PaymentHandoff | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [windowMs, setWindowMs] = useState<number | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [redirectIn, setRedirectIn] = useState<number | null>(null);

  const isPending = payment?.status === 'PENDING';
  const expiresAt = payment?.expiresAt ?? null;
  const now = useNow(isPending && expiresAt !== null);
  const remainingMs = expiresAt !== null ? expiresAt - now : null;
  const expired = remainingMs !== null && remainingMs <= 0;
  const hasTickets = payment?.status === 'SUCCESS' && payment.ticketIds.length > 0;
  const successUrl = payment?.successUrl ?? '/tickets';

  // Liens de l'opérateur transmis par la modale (même onglet) et type d'appareil.
  useEffect(() => {
    setIsMobile(isMobileDevice());
    if (id) setHandoff(readPaymentHandoff(id));
  }, [id]);

  // Paiement terminé : les liens de paiement ne servent plus.
  useEffect(() => {
    if (id && payment && payment.status !== 'PENDING') clearPaymentHandoff(id);
  }, [id, payment]);

  // Durée de référence de la barre de progression : le temps restant à la première lecture.
  useEffect(() => {
    if (expiresAt === null) return;
    setWindowMs((prev) => prev ?? Math.max(1_000, expiresAt - Date.now()));
  }, [expiresAt]);

  // Paiement confirmé avec billets : redirection automatique vers success_url, annulable.
  useEffect(() => {
    if (hasTickets) setRedirectIn(SUCCESS_REDIRECT_SECONDS);
  }, [hasTickets]);

  useEffect(() => {
    if (redirectIn === null) return;
    if (redirectIn <= 0) {
      router.push(successUrl);
      return;
    }
    const timer = setTimeout(() => setRedirectIn((s) => (s === null ? null : s - 1)), 1000);
    return () => clearTimeout(timer);
  }, [redirectIn, router, successUrl]);

  const handleCancel = async () => {
    if (!id || isCancelling) return;
    setIsCancelling(true);
    try {
      const res = await fetch(`/api/payments/${id}/cancel`, { method: 'POST' });
      const body = await readJsonBody(res, `paiement ${id} / annulation`);
      const code = serverErrorCode(body);
      if (res.ok) {
        const status = isRecord(body) ? nonEmptyString(body.status) : null;
        applyStatus(status ?? 'CANCELLED');
        toast.success(status && status !== 'CANCELLED' ? 'Ce paiement n’était plus en attente : voici son statut à jour.' : 'Paiement annulé : la réservation a été libérée.');
        refresh();
      } else if (res.status === 409 && code === 'PAYMENT_ALREADY_CONFIRMED') {
        // SamirPay a confirmé le paiement juste avant l'annulation : les billets sont émis.
        toast.success(serverErrorMessage(body) ?? 'Votre paiement vient d’être confirmé.');
        refresh();
      } else if (res.status === 409) {
        toast.info(serverErrorMessage(body) ?? 'Ce paiement n’est plus en attente : voici son statut à jour.');
        refresh();
      } else if (res.status === 503) {
        // Vérification chez SamirPay impossible : rien n'est annulé à l'aveugle (D4).
        toast.error(serverErrorMessage(body) ?? 'Vérification impossible pour le moment : réessayez dans un instant.');
      } else if (res.status === 401) {
        toast.error('Votre session a expiré : reconnectez-vous pour annuler.');
        router.push(loginHref);
      } else {
        console.error(`[paiement ${id}] annulation refusée (HTTP ${res.status}) :`, body);
        toast.error(serverErrorMessage(body) ?? `Annulation impossible (erreur ${res.status}). Réessayez.`);
      }
    } catch (err) {
      console.error(`[paiement ${id}] annulation impossible :`, err);
      toast.error('Connexion impossible : l’annulation n’a pas été envoyée. Réessayez.');
    } finally {
      setIsCancelling(false);
      setConfirmCancel(false);
    }
  };

  let content: React.ReactNode;

  if (!id) {
    content = (
      <StateCard
        icon={SearchX}
        tone="failed"
        title="Lien de paiement invalide"
        description="Ce lien ne correspond à aucun paiement. Retrouvez vos achats dans Mes billets."
      >
        <LinkButton href="/tickets" variant="primary" fullWidth>
          Voir mes billets
        </LinkButton>
        <LinkButton href="/explore" variant="secondary" fullWidth>
          Explorer les événements
        </LinkButton>
      </StateCard>
    );
  } else if (load.kind === 'loading') {
    content = (
      <div className={cn(CARD, 'space-y-5 p-6 sm:p-8')} role="status" aria-busy="true">
        <span className="sr-only">Chargement du statut du paiement…</span>
        <Skeleton className="mx-auto h-20 w-20 rounded-full" />
        <Skeleton className="mx-auto h-5 w-24 rounded-lg" />
        <Skeleton className="mx-auto h-7 w-3/4 rounded-lg" />
        <Skeleton className="h-4 w-full rounded-lg" />
        <Skeleton className="h-16 w-full rounded-2xl" />
        <Skeleton className="h-12 w-full rounded-2xl" />
      </div>
    );
  } else if (load.kind === 'unauthenticated') {
    content = (
      <StateCard
        icon={LogIn}
        tone="neutral"
        title="Connexion requise"
        description="Connectez-vous avec le compte qui a lancé ce paiement pour suivre son statut."
      >
        <LinkButton href={loginHref} variant="primary" size="lg" fullWidth leftIcon={<LogIn size={16} />}>
          Se connecter
        </LinkButton>
      </StateCard>
    );
  } else if (load.kind === 'forbidden') {
    content = (
      <StateCard icon={AlertTriangle} tone="failed" title="Accès refusé" description={load.message}>
        <LinkButton href="/" variant="secondary" fullWidth>
          Retour à l’accueil
        </LinkButton>
      </StateCard>
    );
  } else if (load.kind === 'not_found') {
    content = (
      <StateCard
        icon={SearchX}
        tone="failed"
        title="Paiement introuvable"
        description="Ce paiement n’existe pas ou n’est pas associé à votre compte. Vérifiez que vous êtes connecté avec le bon compte."
      >
        <LinkButton href="/tickets" variant="primary" fullWidth>
          Voir mes billets
        </LinkButton>
        <LinkButton href="/explore" variant="secondary" fullWidth>
          Explorer les événements
        </LinkButton>
      </StateCard>
    );
  } else if (load.kind === 'error' || !payment) {
    content = (
      <StateCard
        icon={WifiOff}
        tone="pending"
        title="Statut momentanément indisponible"
        description={`${load.kind === 'error' ? load.message : 'Le statut du paiement n’a pas pu être lu.'} Nouvelle tentative automatique en cours…`}
      >
        <Button variant="primary" fullWidth leftIcon={<RefreshCw size={16} />} onClick={refresh}>
          Réessayer maintenant
        </Button>
      </StateCard>
    );
  } else {
    const meta = describeStatus(payment, { expired, stale });
    const styles = TONE_STYLES[meta.tone];
    const StatusIcon = meta.icon;
    const label = payment.operator ? operatorLabel(payment.operator) : null;
    const link = handoff
      ? toSafeExternalUrl(isMobile ? handoff.deepLink ?? handoff.paymentUrl : handoff.paymentUrl)
      : null;
    const linkIsWeb = link !== null && (link.protocol === 'https:' || link.protocol === 'http:');
    const qrCode = handoff && !isMobile ? handoff.qrCode : null;
    const progress = remainingMs !== null && windowMs ? Math.min(1, Math.max(0, remainingMs / windowMs)) : 0;
    const showSteps = payment.status === 'PENDING' || payment.status === 'SUCCESS';
    const canRetry = meta.tone === 'failed' && payment.retryUrl !== null;

    content = (
      <section className={cn(CARD, 'overflow-hidden')} aria-labelledby="payment-status-title">
        <div className={cn('h-1.5 transition-colors', styles.bar)} aria-hidden="true" />

        <div className="space-y-6 p-6 sm:p-8">
          {/* Lot 9 bis (R47, B10, contrat 5.6) : réservation échue, paiement toujours en attente chez nous et chez
              l'opérateur. Aucun autre paiement n'est possible pour l'événement : la page propose d'abord d'annuler. */}
          {isPending && expired && (
            <StatusBanner tone="warning" title="Paiement toujours en attente.">
              <p>Si vous n’avez pas validé sur votre téléphone, annulez-le : aucun autre paiement n’est possible pour cet événement tant que celui-ci n’est ni confirmé ni annulé.</p>
              <p className="mt-1">Si vous avez déjà validé, attendez : vos billets arriveront, ou vous serez remboursé.</p>
            </StatusBanner>
          )}

          {/* État */}
          <header className="space-y-4 text-center">
            <div className="relative mx-auto h-20 w-20">
              {meta.tone === 'pending' && !stale && (
                <span className="absolute inset-0 rounded-full bg-warning/25 motion-safe:animate-ping" aria-hidden="true" />
              )}
              <div className={cn('relative flex h-20 w-20 items-center justify-center rounded-full border', styles.circle)}>
                <StatusIcon size={36} aria-hidden="true" />
              </div>
            </div>

            <div role="status" aria-live="polite" aria-atomic="true" className="space-y-2">
              <div className="flex flex-wrap items-center justify-center gap-2">
                <Badge variant={styles.badge}>{meta.badge}</Badge>
                {meta.chip && (
                  <Badge variant="info" icon={<RotateCcw size={12} aria-hidden="true" />}>
                    {meta.chip}
                  </Badge>
                )}
              </div>
              <h1 id="payment-status-title" className="text-2xl font-bold tracking-tight text-fg">
                {meta.title}
              </h1>
              <p className="text-sm leading-relaxed text-fg-muted">{meta.description}</p>
            </div>
          </header>

          {/* Connexion instable : le sondage continue */}
          {connectionIssue && (
            <p role="status" className="flex items-center gap-2 rounded-2xl border border-warning-border bg-warning-bg p-3 text-sm text-warning-fg">
              <WifiOff size={16} className="shrink-0" aria-hidden="true" />
              <span>Connexion instable : nouvelle vérification automatique dans quelques secondes.</span>
            </p>
          )}

          {/* Lot 9 bis (B9) : un remboursement de ce paiement attend une reprise par l'équipe (état honnête). */}
          {payment.refundDelayed && (
            <p role="status" className="flex items-start gap-2 rounded-2xl border border-warning-border bg-warning-bg p-3 text-sm text-warning-fg">
              <Hourglass size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
              <span>{REFUND_DELAYED_LABEL}</span>
            </p>
          )}

          {showSteps && <ProgressSteps done={payment.status === 'SUCCESS'} label={label} />}

          {/* Compte à rebours jusqu'à l'échéance de la réservation (expires_at), puis suivi jusqu'à la fin de
              validité du paiement chez l'opérateur (paymentDeadline, lot 9 bis H2) */}
          {isPending && !expired && expiresAt !== null && remainingMs !== null && (
            <div className="rounded-2xl border border-border bg-surface-sunken p-3.5">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="flex items-center gap-2 text-fg">
                  <Clock size={16} className="shrink-0 text-brand-fg" aria-hidden="true" />
                  Places gardées encore
                </span>
                {/* Police du système (pas de font-mono, absente du système de design) et sur une ligne :
                    à 390 px, « 3 h 58 min » passait sur deux lignes (relecture du run 77) */}
                <span className="whitespace-nowrap text-base font-bold tabular-nums text-brand-fg">
                  {formatRemaining(remainingMs)}
                </span>
              </div>
              <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-brand-bg" aria-hidden="true">
                <div
                  className="h-full w-full origin-left rounded-full bg-brand transition-transform duration-1000 ease-linear motion-reduce:transition-none"
                  style={{ transform: `scaleX(${progress})` }}
                />
              </div>
              <p className="mt-2 text-sm text-fg-muted">
                {payment.holdMinutes !== null && (
                  <>Vos places sont gardées <span className="tabular-nums">{payment.holdMinutes}</span> minutes. Validez le paiement sur votre téléphone avant l’échéance.{' '}</>
                )}
                Échéance à <time dateTime={new Date(expiresAt).toISOString()} className="tabular-nums">{formatTime(expiresAt)}</time>.
              </p>
            </div>
          )}

          {isPending && expired && !stale && payment.paymentDeadline !== null && now <= payment.paymentDeadline && (
            <div className="flex items-start gap-2 rounded-2xl border border-border bg-surface-sunken p-3.5 text-sm text-fg-muted">
              <Clock size={16} className="mt-0.5 shrink-0 text-brand-fg" aria-hidden="true" />
              <p>
                La demande de paiement reste valable jusqu’à <time dateTime={new Date(payment.paymentDeadline).toISOString()} className="font-semibold tabular-nums text-fg">{formatTime(payment.paymentDeadline)}</time> : cette page suit sa confirmation jusque-là.
              </p>
            </div>
          )}

          {/* Valider chez l'opérateur */}
          {isPending && !expired && (
            <div className="space-y-3">
              {qrCode && (
                <div className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-surface-sunken p-4 sm:flex-row">
                  {/* Fond blanc dans les deux thèmes : un QR code se lit en sombre sur clair. */}
                  <div className="shrink-0 rounded-xl border border-border bg-white p-2.5">
                    <PaymentQr value={qrCode} label={label ?? 'Mobile Money'} />
                  </div>
                  <div className="space-y-1 text-center sm:text-left">
                    <p className="flex items-center justify-center gap-1.5 text-sm font-semibold text-fg sm:justify-start">
                      <QrCode size={16} className="text-brand-fg" aria-hidden="true" /> Scannez avec {label ?? 'votre application'}
                    </p>
                    <p className="text-sm leading-relaxed text-fg-muted">
                      Ouvrez {label ?? 'votre application Mobile Money'} sur votre téléphone, touchez « Scanner » puis visez ce code.
                    </p>
                  </div>
                </div>
              )}

              {link ? (
                <a
                  href={link.href}
                  {...(linkIsWeb ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                  className={buttonClasses({ variant: handoff?.opened || qrCode ? 'secondary' : 'primary', size: 'lg', fullWidth: true, className: 'no-underline' })}
                >
                  <ExternalLink size={18} aria-hidden="true" />
                  <span>{handoff?.opened ? `Rouvrir ${label ?? 'l’application'}` : `Ouvrir ${label ?? 'l’application de paiement'}`}</span>
                </a>
              ) : (
                !qrCode && (
                  <p className="flex items-start gap-2 rounded-2xl border border-border bg-surface-sunken p-3.5 text-sm text-fg-muted">
                    <Smartphone size={16} className="mt-0.5 shrink-0 text-brand-fg" aria-hidden="true" />
                    <span>Validez la demande dans {label ?? 'votre application Mobile Money'}, sur le téléphone du payeur.</span>
                  </p>
                )
              )}
            </div>
          )}

          {/* Ce que le client va recevoir, et ce qui se passe si la page se ferme (D58) */}
          {isPending && (
            <PaymentWaitingInfo
              targetType={payment.targetType}
              event={payment.event}
              ticketCount={payment.ticketCount}
              items={payment.items}
              payerPhoneMasked={payment.payerPhoneMasked}
              receiptChannels={payment.receiptChannels}
            />
          )}

          {/* Détails */}
          <dl className="space-y-2.5 rounded-2xl border border-border bg-surface-sunken p-4 text-sm">
            {payment.facialAmount !== null && (
              <div className="flex items-center justify-between gap-3">
                <dt className="text-fg-muted">Prix</dt>
                <dd className="font-semibold tabular-nums text-fg">{formatFcfa(payment.facialAmount)}</dd>
              </div>
            )}
            {payment.serviceFee !== null && (
              <div className="flex items-center justify-between gap-3">
                <dt className="text-fg-muted">Frais de service</dt>
                <dd className="font-semibold tabular-nums text-fg">{formatFcfa(payment.serviceFee)}</dd>
              </div>
            )}
            <div
              className={cn(
                'flex items-center justify-between gap-3',
                (payment.facialAmount !== null || payment.serviceFee !== null) && 'border-t border-border pt-2.5',
              )}
            >
              <dt className="font-semibold text-fg">{payment.status === 'SUCCESS' ? 'Total payé' : 'Total'}</dt>
              <dd className="text-base font-bold tabular-nums text-fg">{formatFcfa(payment.amount)}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-fg-muted">Opérateur</dt>
              <dd className="font-semibold text-fg">{label ?? 'Non renseigné'}</dd>
            </div>
            {payment.status === 'SUCCESS' && payment.ticketIds.length > 0 && (
              <div className="flex items-center justify-between gap-3">
                <dt className="text-fg-muted">Billets émis</dt>
                <dd className="flex items-center gap-1 font-semibold text-success-fg">
                  <Ticket size={16} aria-hidden="true" /> {payment.ticketIds.length}
                </dd>
              </div>
            )}
            <div className="flex items-center justify-between gap-3">
              <dt className="text-fg-muted">Référence</dt>
              <dd className="font-semibold tabular-nums tracking-wide text-fg">{payment.paymentId.slice(0, 8).toUpperCase()}</dd>
            </div>
          </dl>

          {/* Actions */}
          <div className="flex flex-col gap-2">
            {/* Réservation échue (B10) : annuler devient l'action principale, avant toute autre. */}
            {isPending && expired && (
              <Button
                variant="danger"
                size="lg"
                fullWidth
                leftIcon={<XCircle size={16} aria-hidden="true" />}
                disabled={isCancelling}
                onClick={() => setConfirmCancel(true)}
              >
                Annuler ce paiement
              </Button>
            )}

            {isPending && stale && (
              <Button variant="secondary" fullWidth leftIcon={<RefreshCw size={16} />} onClick={refresh}>
                Actualiser le statut
              </Button>
            )}

            {isPending && !expired && (
              <Button
                variant="ghost"
                fullWidth
                disabled={isCancelling}
                onClick={() => setConfirmCancel(true)}
                className="text-danger-fg hover:bg-danger-bg"
              >
                Annuler ce paiement
              </Button>
            )}

            {payment.status === 'SUCCESS' && (
              <>
                <LinkButton href={successUrl} variant="primary" size="lg" fullWidth rightIcon={<ArrowRight size={16} />}>
                  {successLabel(payment)}
                </LinkButton>
                {hasTickets && redirectIn !== null && (
                  <p className="text-center text-sm text-fg-muted">
                    Redirection automatique dans {redirectIn} s.{' '}
                    <button
                      type="button"
                      onClick={() => setRedirectIn(null)}
                      className="inline-flex min-h-11 items-center rounded-lg px-1 font-semibold text-brand-fg underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      Rester sur cette page
                    </button>
                  </p>
                )}
              </>
            )}

            {meta.tone === 'failed' || meta.tone === 'refund' ? (
              <>
                {canRetry && payment.retryUrl && (
                  <LinkButton href={payment.retryUrl} variant="primary" size="lg" fullWidth leftIcon={<RotateCcw size={16} />}>
                    Réessayer le paiement
                  </LinkButton>
                )}
                {payment.targetType === 'TICKET' || payment.targetType === null ? (
                  <LinkButton href="/tickets" variant={canRetry ? 'secondary' : 'primary'} fullWidth>
                    Mes billets
                  </LinkButton>
                ) : null}
                {!canRetry && (
                  <LinkButton href="/explore" variant="secondary" fullWidth>
                    Explorer les événements
                  </LinkButton>
                )}
              </>
            ) : null}

            {meta.tone === 'unknown' && (
              <Button variant="secondary" fullWidth leftIcon={<RefreshCw size={16} />} onClick={refresh}>
                Actualiser le statut
              </Button>
            )}
          </div>
        </div>
      </section>
    );
  }

  return (
    <>
      <div className="flex min-h-[80vh] flex-col items-center justify-center gap-4 py-8 sm:py-12">
        {content}
        <p className="flex max-w-md items-center justify-center gap-1.5 text-left text-sm text-fg-muted">
          <ShieldCheck size={16} className="shrink-0 text-success-fg" aria-hidden="true" />
          <span>Ne communiquez jamais votre code secret : Event Village ne vous le demandera pas.</span>
        </p>
      </div>

      <ConfirmDialog
        isOpen={confirmCancel}
        onClose={() => {
          if (!isCancelling) setConfirmCancel(false);
        }}
        onConfirm={() => void handleCancel()}
        title="Annuler ce paiement ?"
        message="Nous vérifions d’abord auprès de l’opérateur : si vous avez déjà validé sur votre téléphone, le paiement est confirmé et vos billets émis. Sinon, la demande est abandonnée et la réservation libérée."
        confirmLabel="Annuler ce paiement"
        cancelLabel="Continuer le paiement"
        variant="danger"
        isLoading={isCancelling}
      />
    </>
  );
}

'use client';

/**
 * Suivi d'un paiement Mobile Money (lot 2.10) — /paiement/<id>.
 *
 * Le cashin direct SamirPay n'a pas d'URL de retour : après l'initiation, le client arrive ici.
 * La page sonde la route de statut toutes les 3 s tant que le paiement est en attente (pause quand
 * l'onglet est masqué, reprise immédiate au retour de l'application de l'opérateur), affiche le temps
 * restant jusqu'à l'échéance de la réservation (expires_at), permet l'annulation tant que le paiement
 * est en attente et renvoie vers les billets une fois le paiement confirmé.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, MotionConfig, motion } from 'framer-motion';
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
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import {
  clearPaymentHandoff,
  isMobileDevice,
  isSamirPayOperator,
  readAmount,
  readJsonBody,
  readPaymentHandoff,
  serverErrorMessage,
  toSafeExternalUrl,
  type PaymentHandoff,
} from '@/components/payment/PaymentModal';
import { OPERATOR_LABELS } from '@/lib/samirpay/types';

/* ──────────────────────────────── Réglages ──────────────────────────────── */

const POLL_INTERVAL_MS = 3_000;
/** Après plusieurs échecs réseau consécutifs, le sondage ralentit. */
const POLL_BACKOFF_MS = 10_000;
const BACKOFF_AFTER_FAILURES = 3;
/** Délai laissé à la réconciliation après l'échéance avant d'arrêter le sondage automatique. */
const GRACE_AFTER_EXPIRY_MS = 120_000;
const SUCCESS_REDIRECT_SECONDS = 6;
const PAYMENT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
  currency: string;
  operator: string | null;
  /** Échéance de la réservation (expires_at), en millisecondes ; null si le paiement n'en a pas. */
  expiresAt: number | null;
  ticketIds: string[];
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
  return isSamirPayOperator(operator) ? OPERATOR_LABELS[operator] : operator;
}

function formatAmount(amount: number, currency: string): string {
  return `${amount.toLocaleString('fr-FR')} ${currency === 'XOF' ? 'FCFA' : currency}`;
}

function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  if (hours > 0) return `${hours} h ${String(minutes).padStart(2, '0')} min`;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function formatClock(ms: number): string {
  return new Date(ms).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

/** Réponse de GET /api/payments/<id>/status ; null si elle ne respecte pas le contrat. */
function parseStatusBody(body: unknown): PaymentStatusView | null {
  if (typeof body !== 'object' || body === null) return null;
  const b = body as Record<string, unknown>;
  if (typeof b.payment_id !== 'string' || typeof b.status !== 'string') return null;
  if (typeof b.amount !== 'number' || !Number.isFinite(b.amount)) return null;
  if (typeof b.currency !== 'string') return null;
  if (b.operator !== null && typeof b.operator !== 'string') return null;
  let expiresAt: number | null = null;
  if (b.expires_at !== null && b.expires_at !== undefined) {
    if (typeof b.expires_at !== 'string') return null;
    const parsed = Date.parse(b.expires_at);
    if (Number.isNaN(parsed)) return null;
    expiresAt = parsed;
  }
  if (!Array.isArray(b.ticket_ids) || !b.ticket_ids.every((t) => typeof t === 'string')) return null;
  return {
    paymentId: b.payment_id,
    status: b.status,
    amount: b.amount,
    facialAmount: readAmount(b.facial_amount),
    serviceFee: readAmount(b.service_fee),
    currency: b.currency,
    operator: b.operator,
    expiresAt,
    ticketIds: b.ticket_ids as string[],
  };
}

function describeStatus(p: PaymentStatusView, ctx: { expired: boolean; stale: boolean }): StatusMeta {
  const label = p.operator ? operatorLabel(p.operator) : null;
  const amount = formatAmount(p.amount, p.currency);
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
          title: 'Vérification en cours',
          description: `Le délai de paiement est écoulé : nous attendons la réponse finale de ${label ?? 'l’opérateur'}.`,
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
            ? `Vos ${n} billets sont disponibles dans votre espace billets.`
            : n === 1
            ? 'Votre billet est disponible dans votre espace billets.'
            : 'Votre paiement est enregistré : retrouvez le détail dans vos commandes et réservations.',
        icon: CheckCircle2,
      };
    }
    case 'FAILED':
      return {
        badge: 'Échoué',
        chip: null,
        tone: 'failed',
        title: 'Le paiement n’a pas abouti',
        description: `${label ?? 'L’opérateur'} n’a pas confirmé le paiement de ${amount}. Vous pouvez relancer un achat ; si votre compte a tout de même été débité, contactez le support avec la référence ci-dessous.`,
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
        chip: 'Remboursement en cours',
        tone: 'refund',
        title: 'Paiement en cours de remboursement',
        description: `Ce paiement n’a pas pu être honoré : ${amount} vous est reversé sur le compte ${label ?? 'Mobile Money'} qui a payé.`,
        icon: RotateCcw,
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
        description: `Statut reçu : ${p.status}. Si la situation persiste, contactez le support avec la référence ci-dessous.`,
        icon: AlertTriangle,
      };
  }
}

const TONE_STYLES: Record<Tone, { bar: string; circle: string; badge: string }> = {
  pending: {
    bar: 'bg-gradient-to-r from-amber-400 to-[#FF5722]',
    circle: 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900/50 text-amber-600 dark:text-amber-400',
    badge: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800/50',
  },
  success: {
    bar: 'bg-gradient-to-r from-emerald-400 to-emerald-600',
    circle: 'bg-emerald-100 dark:bg-emerald-950/50 border-emerald-200 dark:border-emerald-900/50 text-emerald-600 dark:text-emerald-400',
    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800/50',
  },
  failed: {
    bar: 'bg-gradient-to-r from-red-400 to-red-600',
    circle: 'bg-red-100 dark:bg-red-950/50 border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400',
    badge: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800/50',
  },
  refund: {
    bar: 'bg-gradient-to-r from-sky-400 to-sky-600',
    circle: 'bg-sky-100 dark:bg-sky-950/50 border-sky-200 dark:border-sky-900/50 text-sky-600 dark:text-sky-400',
    badge: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-400 dark:border-red-800/50',
  },
  unknown: {
    bar: 'bg-gradient-to-r from-slate-300 to-slate-500',
    circle: 'bg-slate-100 dark:bg-zinc-800 border-slate-200 dark:border-zinc-700 text-slate-600 dark:text-zinc-300',
    badge: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700',
  },
};

const CARD = 'w-full max-w-md bg-white dark:bg-[#16161A] border border-slate-200/80 dark:border-zinc-800 rounded-3xl shadow-2xl';
const OPERATOR_LINK =
  'inline-flex w-full items-center justify-center gap-2.5 h-12 sm:h-13 px-6 rounded-2xl text-base font-bold tracking-tight transition-all duration-200 active:scale-[0.98] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5722] focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#16161A]';

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
        const res = await fetch(`/api/payments/${id}/status`);
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
        if (view.expiresAt !== null && Date.now() > view.expiresAt + GRACE_AFTER_EXPIRY_MS) {
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
      ? 'bg-red-100 dark:bg-red-950/50 text-red-600 dark:text-red-400'
      : tone === 'pending'
      ? 'bg-amber-100 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400'
      : 'bg-orange-50 dark:bg-orange-950/40 text-[#FF5722]';
  return (
    <motion.section
      initial={{ opacity: 0, scale: 0.97, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ type: 'spring', damping: 25, stiffness: 300 }}
      className={`${CARD} p-6 sm:p-8 text-center space-y-6`}
    >
      <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto ${circle}`}>
        <Icon size={30} />
      </div>
      <div className="space-y-2">
        <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">{title}</h1>
        <p className="text-sm text-slate-600 dark:text-zinc-400 leading-relaxed">{description}</p>
      </div>
      {children && <div className="flex flex-col gap-2 pt-1">{children}</div>}
    </motion.section>
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
          className="relative flex flex-col items-center gap-1.5 text-center px-1"
          aria-current={step.state === 'active' ? 'step' : undefined}
        >
          {index > 0 && (
            <span
              aria-hidden="true"
              className={`absolute top-3 right-1/2 w-full h-0.5 ${
                step.state === 'todo' ? 'bg-slate-200 dark:bg-zinc-800' : 'bg-emerald-400 dark:bg-emerald-600'
              }`}
            />
          )}
          <span
            aria-hidden="true"
            className={`relative z-10 w-6 h-6 rounded-full flex items-center justify-center ${
              step.state === 'done'
                ? 'bg-emerald-500 text-white'
                : step.state === 'active'
                ? 'bg-amber-500 text-white ring-4 ring-amber-500/20'
                : 'bg-slate-200 dark:bg-zinc-800 text-slate-400 dark:text-zinc-500'
            }`}
          >
            {step.state === 'done' ? (
              <Check size={13} strokeWidth={3} />
            ) : step.state === 'active' ? (
              <span className="w-2 h-2 rounded-full bg-white animate-pulse motion-reduce:animate-none" />
            ) : (
              <span className="w-1.5 h-1.5 rounded-full bg-current" />
            )}
          </span>
          <span
            className={`text-[10px] sm:text-[11px] font-bold leading-tight ${
              step.state === 'todo' ? 'text-slate-400 dark:text-zinc-500' : 'text-slate-700 dark:text-zinc-300'
            }`}
          >
            {step.title}
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
      <img src={image} alt={`QR code de paiement ${label}`} width={160} height={160} className="w-40 h-40 object-contain" />
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

  // Paiement confirmé avec billets : redirection automatique, annulable.
  useEffect(() => {
    if (hasTickets) setRedirectIn(SUCCESS_REDIRECT_SECONDS);
  }, [hasTickets]);

  useEffect(() => {
    if (redirectIn === null) return;
    if (redirectIn <= 0) {
      router.push('/tickets');
      return;
    }
    const timer = setTimeout(() => setRedirectIn((s) => (s === null ? null : s - 1)), 1000);
    return () => clearTimeout(timer);
  }, [redirectIn, router]);

  const handleCancel = async () => {
    if (!id || isCancelling) return;
    setIsCancelling(true);
    try {
      const res = await fetch(`/api/payments/${id}/cancel`, { method: 'POST' });
      const body = await readJsonBody(res, `paiement ${id} / annulation`);
      if (res.ok) {
        applyStatus('CANCELLED');
        toast.success('Paiement annulé : la réservation a été libérée.');
        refresh();
      } else if (res.status === 409) {
        toast.info('Ce paiement n’est plus en attente : voici son statut à jour.');
        refresh();
      } else if (res.status === 401) {
        toast.error('Votre session a expiré : reconnectez-vous pour annuler.');
        router.push(loginHref);
      } else {
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
        description="Ce lien ne correspond à aucun paiement. Retrouvez vos achats dans votre espace billets."
      >
        <Button variant="primary" size="md" fullWidth onClick={() => router.push('/tickets')}>
          Voir mes billets
        </Button>
        <Button variant="secondary" size="md" fullWidth onClick={() => router.push('/explore')}>
          Explorer les événements
        </Button>
      </StateCard>
    );
  } else if (load.kind === 'loading') {
    content = (
      <div className={`${CARD} p-6 sm:p-8 space-y-5`} aria-busy="true" aria-label="Chargement du statut du paiement">
        <Skeleton className="w-20 h-20 rounded-full mx-auto" />
        <Skeleton className="h-5 w-24 rounded-lg mx-auto" />
        <Skeleton className="h-7 w-3/4 rounded-lg mx-auto" />
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
        <Button variant="primary" size="lg" fullWidth leftIcon={<LogIn size={16} />} onClick={() => router.push(loginHref)}>
          Se connecter
        </Button>
      </StateCard>
    );
  } else if (load.kind === 'forbidden') {
    content = (
      <StateCard icon={AlertTriangle} tone="failed" title="Accès refusé" description={load.message}>
        <Button variant="secondary" size="md" fullWidth onClick={() => router.push('/')}>
          Retour à l’accueil
        </Button>
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
        <Button variant="primary" size="md" fullWidth onClick={() => router.push('/tickets')}>
          Voir mes billets
        </Button>
        <Button variant="secondary" size="md" fullWidth onClick={() => router.push('/explore')}>
          Explorer les événements
        </Button>
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
        <Button variant="primary" size="md" fullWidth leftIcon={<RefreshCw size={16} />} onClick={refresh}>
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

    content = (
      <motion.section
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className={`${CARD} overflow-hidden`}
        aria-labelledby="payment-status-title"
      >
        <div className={`h-1.5 ${styles.bar} transition-colors`} aria-hidden="true" />

        <div className="p-6 sm:p-8 space-y-6">
          {/* État */}
          <header className="text-center space-y-4">
            <div className="relative mx-auto w-20 h-20">
              {meta.tone === 'pending' && !stale && (
                <span
                  className="absolute inset-0 rounded-full bg-amber-400/25 animate-ping motion-reduce:animate-none"
                  aria-hidden="true"
                />
              )}
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={`${payment.status}-${meta.title}`}
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.6, opacity: 0 }}
                  transition={{ type: 'spring', damping: 18, stiffness: 260 }}
                  className={`relative w-20 h-20 rounded-full border flex items-center justify-center ${styles.circle}`}
                >
                  <StatusIcon size={36} aria-hidden="true" />
                </motion.div>
              </AnimatePresence>
            </div>

            <div role="status" aria-live="polite" aria-atomic="true" className="space-y-2">
              <div className="flex items-center justify-center gap-2 flex-wrap">
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black border ${styles.badge}`}>
                  {meta.badge}
                </span>
                {meta.chip && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-400 dark:border-sky-800/50">
                    <RotateCcw size={12} aria-hidden="true" /> {meta.chip}
                  </span>
                )}
              </div>
              <h1 id="payment-status-title" className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                {meta.title}
              </h1>
              <p className="text-sm text-slate-600 dark:text-zinc-400 leading-relaxed">{meta.description}</p>
            </div>
          </header>

          {/* Connexion instable : le sondage continue */}
          {connectionIssue && (
            <div
              role="status"
              className="flex items-center gap-2 p-3 rounded-2xl text-xs bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 text-amber-800 dark:text-amber-300"
            >
              <WifiOff size={15} className="shrink-0" aria-hidden="true" />
              <span>Connexion instable : nouvelle vérification automatique dans quelques secondes.</span>
            </div>
          )}

          {showSteps && <ProgressSteps done={payment.status === 'SUCCESS'} label={label} />}

          {/* Compte à rebours jusqu'à l'échéance de la réservation */}
          {isPending && expiresAt !== null && remainingMs !== null && (
            <div className="p-3.5 rounded-2xl bg-orange-50/80 dark:bg-orange-950/20 border border-orange-200/70 dark:border-orange-900/40">
              <div className="flex items-center justify-between gap-3 text-xs">
                <span className="flex items-center gap-2 text-slate-700 dark:text-zinc-300">
                  <Clock size={16} className="text-[#FF5722] shrink-0" aria-hidden="true" />
                  {expired ? 'Délai écoulé' : 'Réservation valable encore'}
                </span>
                <span className="font-mono font-black text-[#FF5722] text-base tabular-nums">
                  {expired ? '00:00' : formatRemaining(remainingMs)}
                </span>
              </div>
              <div className="mt-2.5 h-1.5 rounded-full bg-orange-100 dark:bg-orange-950/60 overflow-hidden" aria-hidden="true">
                <div
                  className="h-full w-full origin-left rounded-full bg-gradient-to-r from-[#FF6A3D] to-[#FF3D68] transition-transform duration-1000 ease-linear motion-reduce:transition-none"
                  style={{ transform: `scaleX(${progress})` }}
                />
              </div>
              <p className="mt-2 text-[11px] text-slate-500 dark:text-zinc-400">
                {expired
                  ? 'Vérification du statut final auprès de l’opérateur…'
                  : `Échéance à ${formatClock(expiresAt)} : passé ce délai, la réservation est libérée.`}
              </p>
            </div>
          )}

          {/* Valider chez l'opérateur */}
          {isPending && !expired && (
            <div className="space-y-3">
              {qrCode && (
                <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900/80 flex flex-col sm:flex-row items-center gap-4">
                  <div className="p-2.5 rounded-xl bg-white border border-slate-200 shrink-0">
                    <PaymentQr value={qrCode} label={label ?? 'Mobile Money'} />
                  </div>
                  <div className="text-center sm:text-left space-y-1">
                    <p className="text-xs font-black text-slate-900 dark:text-white flex items-center justify-center sm:justify-start gap-1.5">
                      <QrCode size={14} className="text-[#FF5722]" aria-hidden="true" /> Scannez avec {label ?? 'votre application'}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-zinc-400 leading-relaxed">
                      Ouvrez {label ?? 'votre application Mobile Money'} sur votre téléphone, touchez « Scanner » puis visez ce code.
                    </p>
                  </div>
                </div>
              )}

              {link ? (
                <a
                  href={link.href}
                  {...(linkIsWeb ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                  className={`${OPERATOR_LINK} ${
                    handoff?.opened || qrCode
                      ? 'bg-slate-100 dark:bg-zinc-800/90 text-slate-900 dark:text-white hover:bg-slate-200 dark:hover:bg-zinc-700/90 border border-slate-200/80 dark:border-zinc-700/80'
                      : 'bg-gradient-to-r from-[#FF6A3D] to-[#FF3D68] hover:from-[#FF5722] hover:to-[#F02D58] text-white shadow-md shadow-[#FF5722]/25'
                  }`}
                >
                  <ExternalLink size={17} aria-hidden="true" />
                  {handoff?.opened ? `Rouvrir ${label ?? 'l’application'}` : `Ouvrir ${label ?? 'l’application de paiement'}`}
                </a>
              ) : (
                !qrCode && (
                  <p className="flex items-start gap-2 p-3.5 rounded-2xl text-xs bg-slate-50 dark:bg-zinc-900/80 border border-slate-200/80 dark:border-zinc-800 text-slate-600 dark:text-zinc-400">
                    <Smartphone size={15} className="text-[#FF5722] shrink-0 mt-px" aria-hidden="true" />
                    <span>Validez la demande dans {label ?? 'votre application Mobile Money'}, sur le téléphone du payeur.</span>
                  </p>
                )
              )}
            </div>
          )}

          {/* Détails */}
          <dl className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-900/80 border border-slate-200/80 dark:border-zinc-800 space-y-2.5 text-xs">
            {payment.facialAmount !== null && (
              <div className="flex items-center justify-between gap-3">
                <dt className="text-slate-500 dark:text-zinc-400">Prix</dt>
                <dd className="font-bold text-slate-900 dark:text-white tabular-nums">{formatAmount(payment.facialAmount, payment.currency)}</dd>
              </div>
            )}
            {payment.serviceFee !== null && (
              <div className="flex items-center justify-between gap-3">
                <dt className="text-slate-500 dark:text-zinc-400">Frais de service</dt>
                <dd className="font-bold text-slate-900 dark:text-white tabular-nums">{formatAmount(payment.serviceFee, payment.currency)}</dd>
              </div>
            )}
            <div
              className={`flex items-center justify-between gap-3 ${
                payment.facialAmount !== null || payment.serviceFee !== null ? 'pt-2.5 border-t border-slate-200 dark:border-zinc-800' : ''
              }`}
            >
              <dt className="font-bold text-slate-700 dark:text-zinc-200">{payment.status === 'SUCCESS' ? 'Total payé' : 'Total'}</dt>
              <dd className="font-black text-slate-900 dark:text-white tabular-nums">{formatAmount(payment.amount, payment.currency)}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-slate-500 dark:text-zinc-400">Opérateur</dt>
              <dd className="font-bold text-slate-900 dark:text-white">{label ?? 'Non renseigné'}</dd>
            </div>
            {payment.status === 'SUCCESS' && payment.ticketIds.length > 0 && (
              <div className="flex items-center justify-between gap-3">
                <dt className="text-slate-500 dark:text-zinc-400">Billets émis</dt>
                <dd className="font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <Ticket size={13} aria-hidden="true" /> {payment.ticketIds.length}
                </dd>
              </div>
            )}
            <div className="flex items-center justify-between gap-3">
              <dt className="text-slate-500 dark:text-zinc-400">Référence</dt>
              <dd className="font-mono font-bold text-slate-900 dark:text-white">{payment.paymentId.slice(0, 8).toUpperCase()}</dd>
            </div>
          </dl>

          {/* Actions */}
          <div className="flex flex-col gap-2">
            {isPending && stale && (
              <Button variant="primary" size="lg" fullWidth leftIcon={<RefreshCw size={16} />} onClick={refresh}>
                Actualiser le statut
              </Button>
            )}

            {isPending && (
              <Button
                variant="ghost"
                size="md"
                fullWidth
                disabled={isCancelling}
                onClick={() => setConfirmCancel(true)}
                className="text-red-600 dark:text-red-400 hover:bg-red-50 hover:text-red-700 dark:hover:bg-red-950/30 dark:hover:text-red-300 focus-visible:ring-red-500"
              >
                Annuler le paiement
              </Button>
            )}

            {payment.status === 'SUCCESS' &&
              (hasTickets ? (
                <>
                  <Button variant="primary" size="lg" fullWidth rightIcon={<ArrowRight size={16} />} onClick={() => router.push('/tickets')}>
                    Voir mes billets
                  </Button>
                  {redirectIn !== null && (
                    <p className="text-[11px] text-center text-slate-500 dark:text-zinc-400">
                      Redirection automatique dans {redirectIn} s ·{' '}
                      <button
                        type="button"
                        onClick={() => setRedirectIn(null)}
                        className="font-bold underline underline-offset-2 hover:text-slate-700 dark:hover:text-zinc-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5722] rounded"
                      >
                        Rester sur cette page
                      </button>
                    </p>
                  )}
                </>
              ) : (
                <Button variant="primary" size="lg" fullWidth rightIcon={<ArrowRight size={16} />} onClick={() => router.push('/orders')}>
                  Voir mes commandes et réservations
                </Button>
              ))}

            {meta.tone === 'failed' || meta.tone === 'refund' ? (
              <>
                <Button variant="primary" size="md" fullWidth onClick={() => router.push('/explore')}>
                  Explorer les événements
                </Button>
                <Button variant="secondary" size="md" fullWidth onClick={() => router.push('/tickets')}>
                  Mes billets
                </Button>
              </>
            ) : null}

            {meta.tone === 'unknown' && (
              <Button variant="secondary" size="md" fullWidth leftIcon={<RefreshCw size={16} />} onClick={refresh}>
                Actualiser le statut
              </Button>
            )}
          </div>
        </div>
      </motion.section>
    );
  }

  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-[80vh] flex flex-col items-center justify-center gap-4 px-4 py-8 sm:py-12">
        {content}
        <p className="flex items-center justify-center gap-1.5 max-w-md text-center text-[11px] text-slate-400 dark:text-zinc-500">
          <ShieldCheck size={14} className="text-emerald-500 shrink-0" aria-hidden="true" />
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
        message="La demande sera abandonnée et la réservation libérée. Si vous avez déjà validé sur votre téléphone, le paiement sera tout de même pris en compte ou remboursé automatiquement."
        confirmLabel="Annuler le paiement"
        cancelLabel="Continuer le paiement"
        variant="danger"
        isLoading={isCancelling}
      />
    </MotionConfig>
  );
}

'use client';

/**
 * Modale de paiement Mobile Money (lot 2, contrat SamirPay « cashin direct »).
 *
 * - L'opérateur est choisi explicitement (rien n'est présélectionné) et aucune demande ne part sans
 *   opérateur ni numéro payeur valide (mobile sénégalais, envoyé en 9 chiffres dans payerPhone).
 * - Chaque tentative porte un en-tête Idempotency-Key : la même clé est réutilisée tant que la
 *   demande est identique et que son sort est incertain (double clic, coupure réseau) ; une nouvelle
 *   clé est tirée pour toute nouvelle tentative (échec définitif, panier ou saisie modifiés).
 * - Après l'initiation, le lien de l'opérateur est ouvert puis le client est conduit sur la page de
 *   suivi /paiement/<id> (status_page_url), qui sonde le statut jusqu'à l'échéance expires_at.
 */

import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { AlertCircle, CheckCircle2, Clock, Loader2, LogIn, ShieldCheck, Smartphone, X } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/components/providers/AuthProvider';
import { normalizePayerPhone } from '@/lib/payments/payer-phone';
import { OPERATOR_LABELS, SAMIRPAY_OPERATORS, type SamirPayOperatorName } from '@/lib/samirpay/types';

/* ──────────────────────────────── Types ──────────────────────────────── */

export type PaymentTargetType = 'ORDER' | 'HALL_RESERVATION' | 'TABLE_RESERVATION' | 'TICKET' | 'SUBSCRIPTION';

export interface CheckoutItem {
  categoryId: string;
  quantity: number;
  /** Nom de la catégorie, affiché si le serveur signale un problème sur cette ligne (jamais envoyé). */
  label?: string;
}

interface PaymentModalBaseProps {
  isOpen: boolean;
  onClose: () => void;
  amountFormatted: string;
  title: string;
  /**
   * Appelée quand l'achat est confirmé sans paiement (panier gratuit). Un paiement Mobile Money se
   * suit sur /paiement/<id>, qui renvoie vers les billets une fois confirmé.
   */
  onPaymentSuccess?: () => void;
}

/** Paiement d'une cible unique via /api/payments/create (salle, table, commande, abonnement, billet). */
interface TargetPaymentProps extends PaymentModalBaseProps {
  targetType: PaymentTargetType;
  targetId: string;
  quantity?: number;
  checkoutItems?: undefined;
  eventId?: undefined;
}

/** Panier de billets complet (payants et gratuits) via /api/checkout. */
interface CheckoutPaymentProps extends PaymentModalBaseProps {
  checkoutItems: CheckoutItem[];
  eventId: string;
  targetType?: undefined;
  targetId?: undefined;
  quantity?: undefined;
}

export type PaymentModalProps = TargetPaymentProps | CheckoutPaymentProps;

export interface CheckoutProblem {
  categoryId: string | null;
  code: string;
  message: string;
}

export interface PaymentRequestError {
  /** Statut HTTP de la réponse, 0 si la requête n'a pas abouti (réseau). */
  httpStatus: number;
  code: string | null;
  message: string;
  problems: CheckoutProblem[];
  retryAfterSeconds: number | null;
}

/** Liens de paiement transmis à la page de suivi (même onglet, sessionStorage). */
export interface PaymentHandoff {
  operator: SamirPayOperatorName | null;
  deepLink: string | null;
  paymentUrl: string | null;
  qrCode: string | null;
  /** Le lien de l'opérateur a été ouvert automatiquement après l'initiation. */
  opened: boolean;
}

type Initiation =
  | { kind: 'free' }
  | {
      kind: 'payment';
      paymentId: string;
      status: string;
      operator: SamirPayOperatorName | null;
      deepLink: string | null;
      paymentUrl: string | null;
      qrCode: string | null;
      expiresAt: string | null;
      statusPagePath: string;
    };

interface RedirectState {
  kind: 'pending' | 'settled';
  label: string;
  opened: boolean;
  statusPath: string;
  expiresAt: string | null;
}

/* ─────────────────────────── Utilitaires partagés ─────────────────────────── */

export function operatorLabel(operator: SamirPayOperatorName): string {
  return OPERATOR_LABELS[operator];
}

export function isSamirPayOperator(value: unknown): value is SamirPayOperatorName {
  return typeof value === 'string' && (SAMIRPAY_OPERATORS as readonly string[]).includes(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function nonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}

/** Message d'erreur fourni par le serveur ({ error }), ou null s'il n'y en a pas. */
export function serverErrorMessage(body: unknown): string | null {
  return isRecord(body) ? nonEmptyString(body.error) : null;
}

/** Lit un corps JSON ; null si le corps est vide ou illisible (l'anomalie est journalisée). */
export async function readJsonBody(res: Response, context: string): Promise<unknown> {
  let text: string;
  try {
    text = await res.text();
  } catch (err) {
    console.error(`[${context}] lecture de la réponse impossible (HTTP ${res.status}) :`, err);
    return null;
  }
  if (text.trim() === '') return null;
  try {
    return JSON.parse(text) as unknown;
  } catch (err) {
    console.error(`[${context}] réponse non JSON (HTTP ${res.status}) :`, err);
    return null;
  }
}

/** UUID v4 tiré avec crypto.getRandomValues (disponible aussi hors contexte sécurisé). */
export function newIdempotencyKey(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * Clé d'idempotence d'une tentative : identique tant que la demande (empreinte) ne change pas et
 * qu'elle n'a pas été abandonnée par reset() ; une demande différente reçoit une nouvelle clé.
 */
export function useIdempotencyKey() {
  const attemptRef = useRef<{ key: string; fingerprint: string } | null>(null);
  const keyFor = useCallback((fingerprint: string): string => {
    if (!attemptRef.current || attemptRef.current.fingerprint !== fingerprint) {
      attemptRef.current = { key: newIdempotencyKey(), fingerprint };
    }
    return attemptRef.current.key;
  }, []);
  const reset = useCallback(() => {
    attemptRef.current = null;
  }, []);
  return { keyFor, reset };
}

/**
 * Réponse dont le sort est incertain (réseau coupé, erreur interne, service indisponible) : la clé
 * est conservée pour qu'un nouvel essai retrouve le même paiement. 502 = refus ou panne de
 * l'opérateur, paiement déjà marqué échoué : nouvelle tentative, nouvelle clé.
 */
export function isUncertainOutcome(httpStatus: number): boolean {
  return httpStatus === 0 || (httpStatus >= 500 && httpStatus !== 502);
}

export function formatDelay(totalSeconds: number): string {
  const seconds = Math.max(1, Math.ceil(totalSeconds));
  if (seconds < 60) return `${seconds} s`;
  if (seconds < 3600) return `${Math.ceil(seconds / 60)} min`;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.ceil((seconds % 3600) / 60);
  return minutes > 0 ? `${hours} h ${minutes} min` : `${hours} h`;
}

/** Erreur lisible à partir d'une réponse non 2xx de /api/checkout ou /api/payments/create. */
export function readPaymentError(httpStatus: number, body: unknown): PaymentRequestError {
  const record = isRecord(body) ? body : null;
  const code = nonEmptyString(record?.code);
  const serverMessage = serverErrorMessage(body);
  const rawProblems = record?.problems;
  const problems: CheckoutProblem[] = Array.isArray(rawProblems)
    ? rawProblems.flatMap((p: unknown) => {
        if (!isRecord(p)) return [];
        const message = nonEmptyString(p.message);
        return message
          ? [{ categoryId: nonEmptyString(p.category_id), code: nonEmptyString(p.code) ?? 'SALE_CHECK_FAILED', message }]
          : [];
      })
    : [];
  const retry = record?.retryAfterSeconds;
  const retryAfterSeconds = typeof retry === 'number' && Number.isFinite(retry) && retry > 0 ? Math.ceil(retry) : null;

  let message: string;
  if (httpStatus === 401) {
    message = 'Votre session a expiré : reconnectez-vous pour continuer.';
  } else if (httpStatus === 429) {
    message = retryAfterSeconds
      ? `Trop de tentatives d’achat. Réessayez dans ${formatDelay(retryAfterSeconds)}.`
      : serverMessage ?? 'Trop de tentatives d’achat. Réessayez plus tard.';
  } else {
    message = serverMessage ?? `Le paiement n’a pas pu être lancé (erreur ${httpStatus}).`;
  }
  return { httpStatus, code, message, problems, retryAfterSeconds };
}

export function isMobileDevice(): boolean {
  const ua = navigator.userAgent;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

const BLOCKED_PROTOCOLS = new Set(['javascript:', 'data:', 'vbscript:', 'file:', 'blob:', 'about:']);

/** Lien d'opérateur utilisable (https ou schéma d'application) ; null si illisible ou dangereux. */
export function toSafeExternalUrl(value: string | null): URL | null {
  if (!value) return null;
  let url: URL;
  try {
    url = new URL(value);
  } catch (err) {
    console.warn('[paiement] lien opérateur illisible, non utilisé :', value, err);
    return null;
  }
  if (BLOCKED_PROTOCOLS.has(url.protocol)) {
    console.warn(`[paiement] lien opérateur refusé (protocole ${url.protocol}).`);
    return null;
  }
  return url;
}

const HANDOFF_PREFIX = 'event-village:paiement:';

export function savePaymentHandoff(paymentId: string, handoff: PaymentHandoff): void {
  try {
    window.sessionStorage.setItem(HANDOFF_PREFIX + paymentId, JSON.stringify(handoff));
  } catch (err) {
    console.warn('[paiement] liens de paiement non mémorisés pour la page de suivi :', err);
  }
}

export function readPaymentHandoff(paymentId: string): PaymentHandoff | null {
  let raw: string | null;
  try {
    raw = window.sessionStorage.getItem(HANDOFF_PREFIX + paymentId);
  } catch (err) {
    console.warn('[paiement] liens de paiement illisibles :', err);
    return null;
  }
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    console.warn('[paiement] liens de paiement mémorisés corrompus :', err);
    return null;
  }
  if (!isRecord(parsed)) return null;
  return {
    operator: isSamirPayOperator(parsed.operator) ? parsed.operator : null,
    deepLink: nonEmptyString(parsed.deepLink),
    paymentUrl: nonEmptyString(parsed.paymentUrl),
    qrCode: nonEmptyString(parsed.qrCode),
    opened: parsed.opened === true,
  };
}

export function clearPaymentHandoff(paymentId: string): void {
  try {
    window.sessionStorage.removeItem(HANDOFF_PREFIX + paymentId);
  } catch (err) {
    console.warn('[paiement] nettoyage des liens de paiement impossible :', err);
  }
}

/* ─────────────────────────── Utilitaires internes ─────────────────────────── */

const FINISHED_FAILED: Record<string, string> = {
  FAILED: 'échec',
  CANCELLED: 'annulée',
  EXPIRED: 'délai dépassé',
};

const OPERATOR_VISUALS: Record<SamirPayOperatorName, { mark: string; tile: string }> = {
  WAVE: { mark: 'W', tile: 'bg-[#1DC8F2] text-slate-950' },
  ORANGE_MONEY: { mark: 'OM', tile: 'bg-[#FF7900] text-white' },
};

function formatLocalPhone(nineDigits: string): string {
  return `${nineDigits.slice(0, 2)} ${nineDigits.slice(2, 5)} ${nineDigits.slice(5, 7)} ${nineDigits.slice(7)}`;
}

function formatClock(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

function readInitiation(body: unknown): Initiation | null {
  if (!isRecord(body)) return null;
  if (body.free === true) return { kind: 'free' };
  const paymentId = nonEmptyString(body.payment_id);
  const status = nonEmptyString(body.status);
  if (!paymentId || !status) return null;
  const statusPage = nonEmptyString(body.status_page_url);
  return {
    kind: 'payment',
    paymentId,
    status,
    operator: isSamirPayOperator(body.operator) ? body.operator : null,
    deepLink: nonEmptyString(body.deep_link),
    paymentUrl: nonEmptyString(body.payment_url),
    qrCode: nonEmptyString(body.qr_code),
    expiresAt: nonEmptyString(body.expires_at),
    // status_page_url est de la forme /paiement/<id> : seul un chemin interne de suivi est accepté.
    statusPagePath: statusPage && statusPage.startsWith('/paiement/') ? statusPage : `/paiement/${encodeURIComponent(paymentId)}`,
  };
}

/**
 * Ouvre le lien de l'opérateur. Lien web : nouvel onglet (la page courante part vers le suivi) ;
 * schéma d'application : ouverture directe, la page reste en place. Renvoie false si le navigateur
 * a bloqué l'ouverture : la page de suivi propose alors un bouton.
 */
function openOperatorLink(link: string): boolean {
  const url = toSafeExternalUrl(link);
  if (!url) return false;
  if (url.protocol === 'https:' || url.protocol === 'http:') {
    const win = window.open(url.href, '_blank');
    if (!win) {
      console.warn('[PaymentModal] ouverture du lien opérateur bloquée par le navigateur.');
      return false;
    }
    win.opener = null;
    return true;
  }
  window.location.href = url.href;
  return true;
}

function failureTitle(failure: PaymentRequestError): string {
  if (failure.httpStatus === 0) return 'Connexion impossible';
  if (failure.httpStatus === 401) return 'Session expirée';
  if (failure.httpStatus === 429) return 'Trop de tentatives';
  if (failure.code === 'INSUFFICIENT_STOCK') return 'Plus assez de places';
  if (failure.code === 'SALE_CHECK_FAILED') return 'Panier à ajuster';
  if (failure.code === 'PAYMENT_PROVIDER_REJECTED') return 'Paiement refusé';
  if (failure.code?.startsWith('PAYMENT_PROVIDER_')) return 'Service de paiement indisponible';
  return 'Paiement non lancé';
}

function makeFailure(httpStatus: number, message: string): PaymentRequestError {
  return { httpStatus, code: null, message, problems: [], retryAfterSeconds: null };
}

/* ──────────────────────────────── Composant ──────────────────────────────── */

export const PaymentModal: React.FC<PaymentModalProps> = (props) => {
  const { isOpen, onClose, amountFormatted, title, onPaymentSuccess } = props;
  const router = useRouter();
  const pathname = usePathname();
  const toast = useToast();
  const { profile } = useAuth();
  const attempt = useIdempotencyKey();
  const fieldId = useId();
  const phoneFieldId = `${fieldId}-payer-phone`;
  const phoneHelpId = `${fieldId}-payer-phone-help`;
  const operatorErrorId = `${fieldId}-operator-error`;

  const [operator, setOperator] = useState<SamirPayOperatorName | null>(null);
  const [operatorMissing, setOperatorMissing] = useState(false);
  const [phoneInput, setPhoneInput] = useState('');
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [phonePrefilled, setPhonePrefilled] = useState(false);
  const [phoneRejected, setPhoneRejected] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [failure, setFailure] = useState<PaymentRequestError | null>(null);
  const [redirect, setRedirect] = useState<RedirectState | null>(null);
  const [retryAt, setRetryAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const submittingRef = useRef(false);
  const prefillDoneRef = useRef(false);
  const firstOperatorRef = useRef<HTMLInputElement | null>(null);
  const phoneRef = useRef<HTMLInputElement | null>(null);

  const payerPhone = normalizePayerPhone(phoneInput);
  const chosenLabel = operator ? operatorLabel(operator) : null;
  const retryRemaining = retryAt === null ? 0 : Math.max(0, Math.ceil((retryAt - now) / 1000));
  const phoneError =
    phoneRejected ??
    (phoneTouched
      ? phoneInput.trim() === ''
        ? 'Le numéro du payeur est obligatoire.'
        : !payerPhone
        ? 'Numéro invalide : mobile sénégalais de 9 chiffres commençant par 70, 75, 76, 77 ou 78.'
        : null
      : null);
  const phoneHelp = phonePrefilled
    ? `Numéro de votre profil. Modifiez-le si un autre compte ${chosenLabel ?? 'Mobile Money'} paie.`
    : 'Mobile sénégalais, avec ou sans +221. La demande de paiement sera liée à ce numéro.';

  // Préremplissage unique depuis le profil, jamais par-dessus une saisie.
  useEffect(() => {
    if (!isOpen || prefillDoneRef.current) return;
    if (phoneInput.trim() !== '') {
      prefillDoneRef.current = true;
      return;
    }
    const fromProfile = normalizePayerPhone(profile?.phone);
    if (!fromProfile) return;
    prefillDoneRef.current = true;
    setPhoneInput(formatLocalPhone(fromProfile));
    setPhonePrefilled(true);
  }, [isOpen, phoneInput, profile?.phone]);

  // Délai imposé par le serveur après un 429 : décompte, puis le message disparaît.
  useEffect(() => {
    if (retryAt === null) return;
    const tick = () => {
      const t = Date.now();
      setNow(t);
      if (t >= retryAt) {
        setRetryAt(null);
        setFailure((prev) => (prev?.httpStatus === 429 ? null : prev));
      }
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [retryAt]);

  // À la fermeture : messages et écran de redirection effacés (le délai 429 reste affiché).
  useEffect(() => {
    if (isOpen) return;
    setFailure((prev) => (prev?.httpStatus === 429 ? prev : null));
    setRedirect(null);
  }, [isOpen]);

  const dismissEditableFailure = () => setFailure((prev) => (prev && prev.httpStatus !== 429 ? null : prev));

  const selectOperator = (op: SamirPayOperatorName) => {
    setOperator(op);
    setOperatorMissing(false);
    dismissEditableFailure();
  };

  const categoryLabel = (categoryId: string | null): string | null => {
    if (!categoryId || props.checkoutItems === undefined) return null;
    return props.checkoutItems.find((item) => item.categoryId === categoryId)?.label ?? null;
  };

  const finish = () => {
    submittingRef.current = false;
    setIsSubmitting(false);
  };

  const handleSubmit = async () => {
    if (submittingRef.current || retryRemaining > 0) return;
    setPhoneTouched(true);
    if (!operator) {
      setOperatorMissing(true);
      firstOperatorRef.current?.focus();
      return;
    }
    if (!payerPhone || phoneRejected) {
      phoneRef.current?.focus();
      return;
    }

    const request =
      props.checkoutItems !== undefined
        ? {
            endpoint: '/api/checkout',
            body: {
              eventId: props.eventId,
              items: props.checkoutItems.map(({ categoryId, quantity }) => ({ categoryId, quantity })),
              operator,
              payerPhone,
            },
          }
        : {
            endpoint: '/api/payments/create',
            body: {
              targetType: props.targetType,
              targetId: props.targetId,
              operator,
              payerPhone,
              ...(props.quantity !== undefined ? { quantity: props.quantity } : {}),
            },
          };
    const idempotencyKey = attempt.keyFor(JSON.stringify(request));

    submittingRef.current = true;
    setIsSubmitting(true);
    setFailure(null);

    let res: Response;
    try {
      res = await fetch(request.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
        body: JSON.stringify(request.body),
      });
    } catch (err) {
      console.error('[PaymentModal] requête de paiement impossible :', err);
      // Clé conservée : la demande a pu atteindre le serveur, un nouvel essai retrouvera le même paiement.
      setFailure(makeFailure(0, 'Le serveur est injoignable. Vérifiez votre connexion puis réessayez : votre demande ne sera pas dupliquée.'));
      finish();
      return;
    }
    const body = await readJsonBody(res, 'PaymentModal');

    if (!res.ok) {
      const error = readPaymentError(res.status, body);
      if (!isUncertainOutcome(res.status)) attempt.reset();
      if (error.retryAfterSeconds && res.status === 429) {
        const start = Date.now();
        setNow(start);
        setRetryAt(start + error.retryAfterSeconds * 1000);
      }
      if (error.code === 'OPERATOR_REQUIRED') setOperatorMissing(true);
      if (error.code === 'INVALID_PAYER_PHONE') setPhoneRejected(error.message);
      setFailure(
        error.code === 'PAYMENT_PROVIDER_REJECTED'
          ? {
              ...error,
              message: `${error.message} Vérifiez le numéro et le solde du compte ${operatorLabel(operator)}, ou choisissez l’autre opérateur.`,
            }
          : error
      );
      finish();
      return;
    }

    const outcome = readInitiation(body);
    if (!outcome) {
      console.error('[PaymentModal] réponse de paiement inattendue :', body);
      // Sort incertain : la clé est conservée pour retrouver le même paiement au prochain essai.
      setFailure(makeFailure(res.status, 'Réponse inattendue du serveur. Patientez un instant puis réessayez.'));
      finish();
      return;
    }

    if (outcome.kind === 'free') {
      attempt.reset();
      finish();
      toast.success('Billets réservés : retrouvez-les dans votre espace billets.');
      if (onPaymentSuccess) onPaymentSuccess();
      else router.push('/tickets');
      return;
    }

    const paymentOperator = outcome.operator ?? operator;
    const label = operatorLabel(paymentOperator);
    const failedAs = FINISHED_FAILED[outcome.status];
    if (failedAs) {
      // Rejeu d'une tentative déjà close : la suivante doit créer un nouveau paiement.
      attempt.reset();
      setFailure(makeFailure(res.status, `La demande précédente via ${label} n’a pas abouti (${failedAs}). Relancez le paiement pour en créer une nouvelle.`));
      finish();
      return;
    }

    if (outcome.status === 'PENDING') {
      const mobile = isMobileDevice();
      // Mobile : application de l'opérateur choisi. Ordinateur : QR code sur la page de suivi s'il
      // existe, sinon page de paiement web dans un nouvel onglet.
      const link = mobile ? outcome.deepLink ?? outcome.paymentUrl : outcome.qrCode ? null : outcome.paymentUrl;
      const opened = link !== null && openOperatorLink(link);
      savePaymentHandoff(outcome.paymentId, {
        operator: paymentOperator,
        deepLink: outcome.deepLink,
        paymentUrl: outcome.paymentUrl,
        qrCode: outcome.qrCode,
        opened,
      });
      setRedirect({ kind: 'pending', label, opened, statusPath: outcome.statusPagePath, expiresAt: outcome.expiresAt });
    } else {
      setRedirect({ kind: 'settled', label, opened: false, statusPath: outcome.statusPagePath, expiresAt: null });
    }
    finish();
    router.push(outcome.statusPagePath);
  };

  const handleClose = () => {
    if (submittingRef.current) return;
    onClose();
  };

  const ctaLabel = isSubmitting
    ? `Connexion à ${chosenLabel ?? 'l’opérateur'}…`
    : retryRemaining > 0
    ? `Réessayer dans ${formatDelay(retryRemaining)}`
    : chosenLabel
    ? `Payer ${amountFormatted} avec ${chosenLabel}`
    : `Payer ${amountFormatted}`;

  const reservationClock = redirect ? formatClock(redirect.expiresAt) : null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Paiement sécurisé"
      subtitle="Mobile Money · SamirPay"
      icon={<ShieldCheck size={18} />}
    >
      {redirect ? (
        /* ── Initiation réussie : ouverture de l'opérateur et renvoi vers le suivi ── */
        <div className="flex flex-col items-center text-center gap-5 py-6" role="status" aria-live="polite">
          <div className="relative flex items-center justify-center">
            <span className="absolute w-16 h-16 rounded-full bg-[#FF5722]/20 animate-ping motion-reduce:animate-none" aria-hidden="true" />
            <div className="relative w-16 h-16 rounded-full bg-orange-50 dark:bg-orange-950/50 border border-orange-200 dark:border-orange-900/50 flex items-center justify-center">
              <Smartphone size={28} className="text-[#FF5722]" aria-hidden="true" />
            </div>
          </div>

          <div className="space-y-1.5 px-2">
            <h3 className="text-base font-black text-slate-900 dark:text-white">
              {redirect.kind === 'settled'
                ? 'Paiement déjà traité'
                : redirect.opened
                ? `${redirect.label} est ouvert`
                : `Demande ${redirect.label} créée`}
            </h3>
            <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
              {redirect.kind === 'settled'
                ? 'Affichage du statut de ce paiement…'
                : redirect.opened
                ? `Validez le paiement de ${amountFormatted} dans ${redirect.label}, puis revenez ici : le suivi se met à jour tout seul.`
                : `Sur la page de suivi, ouvrez ${redirect.label} ou scannez le QR code pour valider le paiement de ${amountFormatted}.`}
            </p>
            {reservationClock && (
              <p className="inline-flex items-center gap-1.5 pt-1 text-[11px] font-bold text-[#FF5722]">
                <Clock size={12} aria-hidden="true" /> Réservation valable jusqu’à {reservationClock}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2 text-[11px] text-slate-400 dark:text-zinc-500">
            <Loader2 size={12} className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
            <span>Redirection vers le suivi du paiement…</span>
          </div>

          <Link
            href={redirect.statusPath}
            className="text-xs font-bold text-[#FF5722] hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF5722] rounded-md px-1"
          >
            Suivre le paiement
          </Link>
        </div>
      ) : (
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void handleSubmit();
          }}
          className="space-y-5"
        >
          {/* Récapitulatif */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-900/80 border border-slate-200/80 dark:border-zinc-800 flex items-start justify-between gap-3">
            <div className="min-w-0">
              <span className="text-[10px] text-slate-400 dark:text-zinc-500 uppercase font-bold tracking-wider">Récapitulatif</span>
              <p className="text-xs font-bold text-slate-900 dark:text-white leading-snug line-clamp-2">{title}</p>
            </div>
            <span className="shrink-0 text-sm sm:text-base font-black text-[#FF5722] px-3 py-1 rounded-xl bg-orange-50 dark:bg-orange-950/40 border border-orange-200 dark:border-orange-900/30 whitespace-nowrap">
              {amountFormatted}
            </span>
          </div>

          {/* Erreur */}
          {failure && (
            <div
              role="alert"
              className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40"
            >
              <AlertCircle size={16} className="text-red-500 flex-shrink-0 mt-0.5" aria-hidden="true" />
              <div className="flex-1 min-w-0 space-y-1.5">
                <p className="text-xs font-bold text-red-800 dark:text-red-200">{failureTitle(failure)}</p>
                {failure.problems.length > 0 ? (
                  <ul className="space-y-1">
                    {failure.problems.map((problem, index) => {
                      const label = categoryLabel(problem.categoryId);
                      return (
                        <li
                          key={`${problem.categoryId ?? 'panier'}-${problem.code}-${index}`}
                          className="text-xs text-red-700 dark:text-red-300 leading-relaxed"
                        >
                          {label && <span className="font-bold">{label} : </span>}
                          {problem.message}
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="text-xs text-red-700 dark:text-red-300 leading-relaxed">{failure.message}</p>
                )}
                {failure.httpStatus === 401 && (
                  <Link
                    href={`/login?redirect=${encodeURIComponent(pathname)}`}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-red-700 dark:text-red-300 underline underline-offset-2"
                  >
                    <LogIn size={13} aria-hidden="true" /> Se reconnecter
                  </Link>
                )}
              </div>
              {failure.httpStatus !== 429 && (
                <button
                  type="button"
                  onClick={() => setFailure(null)}
                  aria-label="Masquer le message d’erreur"
                  className="p-1 -m-1 rounded-lg text-red-400 hover:text-red-600 dark:hover:text-red-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
                >
                  <X size={14} aria-hidden="true" />
                </button>
              )}
            </div>
          )}

          {/* Opérateur : choix explicite obligatoire */}
          <fieldset aria-describedby={operatorMissing ? operatorErrorId : undefined}>
            <legend className="text-xs font-bold text-slate-700 dark:text-zinc-300 mb-2">
              Moyen de paiement <span className="text-[#FF5722]" aria-hidden="true">*</span>
            </legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {SAMIRPAY_OPERATORS.map((op, index) => {
                const selected = operator === op;
                const visual = OPERATOR_VISUALS[op];
                return (
                  <label key={op} className="relative block cursor-pointer">
                    <input
                      ref={index === 0 ? firstOperatorRef : undefined}
                      type="radio"
                      name={`${fieldId}-operator`}
                      value={op}
                      checked={selected}
                      required
                      onChange={() => selectOperator(op)}
                      className="peer sr-only"
                    />
                    <span
                      className={`flex items-center gap-3 min-h-[64px] p-3 rounded-2xl border-2 transition-all duration-200 peer-focus-visible:ring-2 peer-focus-visible:ring-[#FF5722] peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-white dark:peer-focus-visible:ring-offset-[#18181C] ${
                        selected
                          ? 'border-[#FF5722] bg-[#FF5722]/5 dark:bg-[#FF5722]/10 shadow-sm'
                          : operatorMissing
                          ? 'border-red-300 dark:border-red-900/60 bg-white dark:bg-zinc-900'
                          : 'border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-slate-300 dark:hover:border-zinc-700'
                      }`}
                    >
                      <span
                        aria-hidden="true"
                        className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black tracking-tight shrink-0 ${visual.tile}`}
                      >
                        {visual.mark}
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm font-bold text-slate-900 dark:text-white truncate">{operatorLabel(op)}</span>
                        <span className="block text-[11px] text-slate-500 dark:text-zinc-400">Mobile Money</span>
                      </span>
                      <span
                        aria-hidden="true"
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                          selected ? 'border-[#FF5722] bg-[#FF5722]' : 'border-slate-300 dark:border-zinc-600'
                        }`}
                      >
                        {selected && <span className="w-2 h-2 rounded-full bg-white" />}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
            {operatorMissing && (
              <p id={operatorErrorId} className="mt-1.5 text-[11px] font-medium text-red-600 dark:text-red-400">
                Choisissez l’opérateur avec lequel vous allez payer.
              </p>
            )}
          </fieldset>

          {/* Téléphone payeur */}
          <div>
            <label htmlFor={phoneFieldId} className="text-xs font-bold text-slate-700 dark:text-zinc-300 block mb-1.5">
              Numéro {chosenLabel ?? 'Mobile Money'} du payeur <span className="text-[#FF5722]" aria-hidden="true">*</span>
            </label>
            <div className="relative">
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-sm font-bold text-slate-400 dark:text-zinc-500"
              >
                +221
              </span>
              <input
                ref={phoneRef}
                id={phoneFieldId}
                type="tel"
                inputMode="tel"
                autoComplete="tel-national"
                required
                maxLength={20}
                placeholder="77 123 45 67"
                value={phoneInput}
                aria-invalid={phoneError ? true : undefined}
                aria-describedby={phoneHelpId}
                onChange={(e) => {
                  setPhoneInput(e.target.value);
                  setPhonePrefilled(false);
                  setPhoneRejected(null);
                  dismissEditableFailure();
                }}
                onBlur={() => {
                  setPhoneTouched(true);
                  const normalized = normalizePayerPhone(phoneInput);
                  if (normalized) setPhoneInput(formatLocalPhone(normalized));
                }}
                className={`w-full h-12 pl-[3.75rem] pr-10 rounded-xl bg-slate-50 dark:bg-zinc-900 border text-base font-mono font-bold tracking-wide text-slate-900 dark:text-white placeholder:text-slate-300 dark:placeholder:text-zinc-600 focus:outline-none focus:ring-2 transition-colors ${
                  phoneError
                    ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20'
                    : 'border-slate-200 dark:border-zinc-800 focus:border-[#FF5722] focus:ring-[#FF5722]/20'
                }`}
              />
              {payerPhone && !phoneRejected && (
                <CheckCircle2
                  size={18}
                  aria-hidden="true"
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-emerald-500"
                />
              )}
            </div>
            <p
              id={phoneHelpId}
              className={`mt-1.5 text-[11px] leading-relaxed ${
                phoneError ? 'font-medium text-red-600 dark:text-red-400' : 'text-slate-500 dark:text-zinc-400'
              }`}
            >
              {phoneError ?? phoneHelp}
            </p>
          </div>

          {/* Ce qui va se passer */}
          {(chosenLabel && payerPhone) || props.checkoutItems !== undefined ? (
            <ul className="space-y-1.5 text-[11px] text-slate-500 dark:text-zinc-400">
              {chosenLabel && payerPhone && (
                <li className="flex items-start gap-2">
                  <Smartphone size={13} className="text-[#FF5722] mt-px shrink-0" aria-hidden="true" />
                  <span>
                    Vous validerez ensuite le paiement dans {chosenLabel}, depuis le{' '}
                    <span className="font-mono font-bold text-slate-700 dark:text-zinc-300">+221 {formatLocalPhone(payerPhone)}</span>.
                  </span>
                </li>
              )}
              {props.checkoutItems !== undefined && (
                <li className="flex items-start gap-2">
                  <Clock size={13} className="text-[#FF5722] mt-px shrink-0" aria-hidden="true" />
                  <span>Vos billets restent réservés pendant le paiement ; le temps restant s’affiche à l’étape suivante.</span>
                </li>
              )}
            </ul>
          ) : null}

          <Button type="submit" variant="primary" fullWidth size="lg" isLoading={isSubmitting} disabled={retryRemaining > 0}>
            {ctaLabel}
          </Button>

          <p className="flex items-center justify-center gap-1.5 text-[11px] text-slate-400 dark:text-zinc-500 text-center">
            <ShieldCheck size={14} className="text-emerald-500 shrink-0" aria-hidden="true" />
            <span>Paiement sécurisé via SamirPay. Votre code secret ne vous sera jamais demandé ici.</span>
          </p>
        </form>
      )}
    </Modal>
  );
};

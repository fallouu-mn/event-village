/**
 * Lot 7 (7.3, E4) — aides du parcours de paiement côté navigateur, sans JSX ni classe CSS.
 *
 * Extraites de components/payment/PaymentModal.tsx pour que la page d'un événement charge la modale par
 * next/dynamic sans en importer statiquement une valeur (sinon le module entier reste dans le paquet de la
 * page). La modale les réexporte pour les écrans qui les importaient déjà depuis elle.
 *  - lecture des réponses JSON (corps vide ou illisible journalisé), message d'erreur du serveur ;
 *  - devis serveur d'un panier (POST /api/checkout/quote) : montants affichés tels quels ;
 *  - clé d'idempotence d'une tentative (en-tête Idempotency-Key) ;
 *  - erreurs lisibles de /api/checkout et /api/payments/create ;
 *  - liens de l'opérateur transmis à la page de suivi (sessionStorage, même onglet).
 */
import { useCallback, useRef } from 'react';
import { OPERATOR_LABELS, SAMIRPAY_OPERATORS, type SamirPayOperatorName } from '@/lib/samirpay/types';

/* ──────────────────────────────── Types ──────────────────────────────── */

export type PaymentTargetType = 'ORDER' | 'HALL_RESERVATION' | 'TABLE_RESERVATION' | 'TICKET' | 'SUBSCRIPTION';

export interface CheckoutItem {
  categoryId: string;
  quantity: number;
  /** Nom de la catégorie, affiché si le serveur signale un problème sur cette ligne (jamais envoyé). */
  label?: string;
}

/** Ligne du devis serveur (POST /api/checkout/quote). */
export interface CheckoutQuoteLine {
  categoryId: string;
  unitPrice: number;
  quantity: number;
  unitServiceFee: number;
  lineFacial: number;
  lineServiceFee: number;
  lineTotal: number;
}

/** Devis serveur d'un panier de billets : montants affichés tels quels, jamais recalculés ici. */
export interface CheckoutQuote {
  lines: CheckoutQuoteLine[];
  /** Somme des prix des billets. */
  facialAmount: number;
  /** Frais de service payés par l'acheteur. */
  serviceFee: number;
  /** Taux des frais de service (en %), pour information. */
  serviceRatePercent: number | null;
  /** Total à payer = montant demandé à l'opérateur. */
  totalAmount: number;
}

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
  /** 409 PAYMENT_PENDING : page de suivi du paiement déjà en attente (/paiement/<id>). */
  pendingStatusPath: string | null;
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

/* ─────────────────────────────── Lecture ─────────────────────────────── */

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function nonEmptyString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}

export function operatorLabel(operator: SamirPayOperatorName): string {
  return OPERATOR_LABELS[operator];
}

export function isSamirPayOperator(value: unknown): value is SamirPayOperatorName {
  return typeof value === 'string' && (SAMIRPAY_OPERATORS as readonly string[]).includes(value);
}

/** Nombre lu dans une réponse JSON (nombre, ou chaîne numérique d'une colonne numeric) ; null sinon. */
export function readAmount(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/** Devis renvoyé par POST /api/checkout/quote ; null s'il ne respecte pas le contrat. */
export function readCheckoutQuote(body: unknown): CheckoutQuote | null {
  const root = isRecord(body) && isRecord(body.quote) ? body.quote : body;
  if (!isRecord(root) || !Array.isArray(root.lines)) return null;
  const facialAmount = readAmount(root.facial_amount);
  const serviceFee = readAmount(root.service_fee);
  const totalAmount = readAmount(root.total_amount);
  if (facialAmount === null || serviceFee === null || totalAmount === null) return null;
  const lines: CheckoutQuoteLine[] = [];
  for (const raw of root.lines) {
    if (!isRecord(raw)) return null;
    const categoryId = nonEmptyString(raw.category_id);
    const unitPrice = readAmount(raw.unit_price);
    const quantity = readAmount(raw.quantity);
    const unitServiceFee = readAmount(raw.unit_service_fee);
    const lineFacial = readAmount(raw.line_facial);
    const lineServiceFee = readAmount(raw.line_service_fee);
    const lineTotal = readAmount(raw.line_total);
    if (!categoryId || unitPrice === null || quantity === null || unitServiceFee === null || lineFacial === null || lineServiceFee === null || lineTotal === null) {
      return null;
    }
    lines.push({ categoryId, unitPrice, quantity, unitServiceFee, lineFacial, lineServiceFee, lineTotal });
  }
  return { lines, facialAmount, serviceFee, serviceRatePercent: readAmount(root.service_fee_rate), totalAmount };
}

/** Message d'erreur fourni par le serveur ({ error }), ou null s'il n'y en a pas. */
export function serverErrorMessage(body: unknown): string | null {
  return isRecord(body) ? nonEmptyString(body.error) : null;
}

/** Code d'erreur fourni par le serveur ({ code }), ou null. */
export function serverErrorCode(body: unknown): string | null {
  return isRecord(body) ? nonEmptyString(body.code) : null;
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

/** Chemin de suivi d'un paiement, accepté seulement s'il est de la forme /paiement/<id>. */
export function paymentStatusPath(candidate: unknown, paymentId: string | null): string | null {
  const path = nonEmptyString(candidate);
  if (path && /^\/paiement\/[0-9A-Za-z-]+$/.test(path)) return path;
  return paymentId ? `/paiement/${encodeURIComponent(paymentId)}` : null;
}

/* ──────────────────────────── Idempotence ──────────────────────────── */

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

/* ──────────────────────────────── Erreurs ──────────────────────────────── */

export function formatDelay(totalSeconds: number): string {
  const seconds = Math.max(1, Math.ceil(totalSeconds));
  if (seconds < 60) return `${seconds} s`;
  if (seconds < 3600) return `${Math.ceil(seconds / 60)} min`;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.ceil((seconds % 3600) / 60);
  return minutes > 0 ? `${hours} h ${minutes} min` : `${hours} h`;
}

/** Message affiché pour un second paiement refusé (409 PAYMENT_PENDING, D4). */
export const PAYMENT_PENDING_TEXT = 'Un paiement est déjà en attente pour cet événement : suivez-le avant d’en lancer un autre.';

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
  const pendingStatusPath = code === 'PAYMENT_PENDING'
    ? paymentStatusPath(record?.status_page_url, nonEmptyString(record?.payment_id))
    : null;

  let message: string;
  if (httpStatus === 401) {
    message = 'Votre session a expiré : reconnectez-vous pour continuer.';
  } else if (httpStatus === 429) {
    message = retryAfterSeconds
      ? `Trop de tentatives d’achat. Réessayez dans ${formatDelay(retryAfterSeconds)}.`
      : serverMessage ?? 'Trop de tentatives d’achat. Réessayez plus tard.';
  } else if (code === 'PAYMENT_PENDING') {
    message = PAYMENT_PENDING_TEXT;
  } else {
    message = serverMessage ?? `Le paiement n’a pas pu être lancé (erreur ${httpStatus}).`;
  }
  return { httpStatus, code, message, problems, retryAfterSeconds, pendingStatusPath };
}

/* ───────────────────────────── Opérateur ───────────────────────────── */

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

/** Numéro à 9 chiffres affiché « 77 123 45 67 ». */
export function formatLocalPhone(nineDigits: string): string {
  return `${nineDigits.slice(0, 2)} ${nineDigits.slice(2, 5)} ${nineDigits.slice(5, 7)} ${nineDigits.slice(7)}`;
}

/* ─────────────────────── Passage vers la page de suivi ─────────────────────── */

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

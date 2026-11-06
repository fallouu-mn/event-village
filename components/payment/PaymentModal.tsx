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
 * - Lot 3 : un panier de billets s'affiche avec le devis du serveur (POST /api/checkout/quote) :
 *   prix des billets, frais de service et total. Aucun frais n'est calculé dans le navigateur.
 * - Lot 7 (7.3, E4) : système de design (tokens, 14 px au moins) ; pastilles des opérateurs sur les jetons
 *   --op-wave et --op-orange-money (D59) ; montants par formatFcfa de lib/format (D60) ; un second paiement
 *   refusé (409 PAYMENT_PENDING, D4) propose « Suivre le paiement » vers le paiement déjà en attente. Les
 *   aides sans rendu vivent dans lib/payments/payment-client.ts (la page d'un événement charge la modale par
 *   next/dynamic) ; elles restent réexportées ici pour les écrans qui les importaient depuis la modale.
 */

import React, { useEffect, useId, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { AlertCircle, CheckCircle2, Clock, Loader2, LogIn, ShieldCheck, Smartphone, X } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { LinkButton } from '@/components/ui/LinkButton';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { cn } from '@/components/ui/cn';
import { useAuth } from '@/components/providers/AuthProvider';
import { formatFcfa, formatTime } from '@/lib/format';
import { normalizePayerPhone } from '@/lib/payments/payer-phone';
import {
  formatDelay,
  formatLocalPhone,
  isRecord,
  isSamirPayOperator,
  isUncertainOutcome,
  nonEmptyString,
  operatorLabel,
  paymentStatusPath,
  readJsonBody,
  readPaymentError,
  savePaymentHandoff,
  toSafeExternalUrl,
  useIdempotencyKey,
  isMobileDevice,
  type CheckoutItem,
  type CheckoutQuote,
  type PaymentRequestError,
  type PaymentTargetType,
} from '@/lib/payments/payment-client';
import { SAMIRPAY_OPERATORS, type SamirPayOperatorName } from '@/lib/samirpay/types';

// Aides réexportées (écrans de retrait, administration, suivi du paiement) : même comportement qu'avant le
// lot 7, sauf formatFcfa, désormais celui de lib/format (« F CFA », D60).
export {
  clearPaymentHandoff,
  formatDelay,
  formatLocalPhone,
  isMobileDevice,
  isSamirPayOperator,
  isUncertainOutcome,
  newIdempotencyKey,
  operatorLabel,
  readAmount,
  readCheckoutQuote,
  readJsonBody,
  readPaymentError,
  readPaymentHandoff,
  savePaymentHandoff,
  serverErrorMessage,
  toSafeExternalUrl,
  useIdempotencyKey,
} from '@/lib/payments/payment-client';
export type {
  CheckoutItem,
  CheckoutProblem,
  CheckoutQuote,
  CheckoutQuoteLine,
  PaymentHandoff,
  PaymentRequestError,
  PaymentTargetType,
} from '@/lib/payments/payment-client';
export { formatFcfa };

/* ──────────────────────────────── Types ──────────────────────────────── */

interface PaymentModalBaseProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  /**
   * Appelée quand l'achat est confirmé sans paiement (panier gratuit). Un paiement Mobile Money se
   * suit sur /paiement/<id>, qui renvoie vers les billets une fois confirmé.
   */
  onPaymentSuccess?: () => void;
}

/** Paiement d'une cible unique via /api/payments/create (salle, table, commande, abonnement, billet). */
interface TargetPaymentProps extends PaymentModalBaseProps {
  /** Montant affiché par la page appelante (hors frais de service, calculés par le serveur). */
  amountFormatted: string;
  targetType: PaymentTargetType;
  targetId: string;
  quantity?: number;
  checkoutItems?: undefined;
  eventId?: undefined;
  quote?: undefined;
}

/** Panier de billets complet (payants et gratuits) via /api/checkout. */
interface CheckoutPaymentProps extends PaymentModalBaseProps {
  checkoutItems: CheckoutItem[];
  eventId: string;
  /** Devis du serveur pour ce panier ; null pendant son calcul (paiement impossible). */
  quote: CheckoutQuote | null;
  amountFormatted?: undefined;
  targetType?: undefined;
  targetId?: undefined;
  quantity?: undefined;
}

export type PaymentModalProps = TargetPaymentProps | CheckoutPaymentProps;

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

/* ─────────────────────────── Rendu des opérateurs ─────────────────────────── */

/**
 * Pastille de marque de chaque opérateur (partagée avec les écrans de retrait). Couleurs des jetons
 * d'app/globals.css branchés dans tailwind.config.ts (fond --op-*, texte --on-op-*, contraste ≥ 4,5:1 vérifié
 * par tests/parcours/client-interface.test.ts), jamais écrites en dur (D59).
 */
export const OPERATOR_VISUALS: Record<SamirPayOperatorName, { mark: string; tile: string }> = {
  WAVE: { mark: 'W', tile: 'bg-op-wave text-on-op-wave' },
  ORANGE_MONEY: { mark: 'OM', tile: 'bg-op-orange-money text-on-op-orange-money' },
};

/* ─────────────────────────── Utilitaires internes ─────────────────────────── */

const FINISHED_FAILED: Record<string, string> = {
  FAILED: 'échec',
  CANCELLED: 'annulée',
  EXPIRED: 'délai dépassé',
};

function readInitiation(body: unknown): Initiation | null {
  if (!isRecord(body)) return null;
  if (body.free === true) return { kind: 'free' };
  const paymentId = nonEmptyString(body.payment_id);
  const status = nonEmptyString(body.status);
  if (!paymentId || !status) return null;
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
    statusPagePath: paymentStatusPath(body.status_page_url, paymentId) ?? `/paiement/${encodeURIComponent(paymentId)}`,
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
  if (failure.code === 'PAYMENT_PENDING') return 'Un paiement est déjà en attente';
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
  return { httpStatus, code: null, message, problems: [], retryAfterSeconds: null, pendingStatusPath: null };
}

/* ──────────────────────────────── Composant ──────────────────────────────── */

export const PaymentModal: React.FC<PaymentModalProps> = (props) => {
  const { isOpen, onClose, title, onPaymentSuccess } = props;
  // Panier de billets : montants du devis serveur. Autres cibles : montant de la page appelante,
  // hors frais de service (calculés par le serveur, détaillés sur la page de suivi), sauf abonnement.
  const quote = props.checkoutItems !== undefined ? props.quote : null;
  const awaitingQuote = props.checkoutItems !== undefined && props.quote === null;
  const feesComputedLater = props.checkoutItems === undefined && props.targetType !== 'SUBSCRIPTION';
  const payableAmount: string | null =
    props.checkoutItems !== undefined
      ? quote
        ? formatFcfa(quote.totalAmount)
        : null
      : feesComputedLater
      ? null
      : props.amountFormatted;
  const payableText = payableAmount ? `le paiement de ${payableAmount}` : 'le paiement';
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
    if (submittingRef.current || retryRemaining > 0 || awaitingQuote) return;
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
      if (error.code === 'PAYMENT_PENDING') {
        // Second paiement refusé (D4) : le premier est toujours en cours, on le fait suivre au lieu d'en créer un.
        console.warn('[PaymentModal] paiement déjà en attente pour cet événement :', error.pendingStatusPath);
      }
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
    : awaitingQuote
    ? 'Calcul du total…'
    : payableAmount
    ? chosenLabel
      ? `Payer ${payableAmount} avec ${chosenLabel}`
      : `Payer ${payableAmount}`
    : chosenLabel
    ? `Continuer avec ${chosenLabel}`
    : 'Continuer vers le paiement';

  const reservationClock = redirect?.expiresAt ? formatTime(redirect.expiresAt) : null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Paiement sécurisé"
      subtitle="Mobile Money, par SamirPay"
      icon={<ShieldCheck size={18} />}
    >
      {redirect ? (
        /* ── Initiation réussie : ouverture de l'opérateur et renvoi vers le suivi ── */
        <div className="flex flex-col items-center gap-5 py-6 text-center" role="status" aria-live="polite">
          <div className="relative flex items-center justify-center">
            <span className="absolute h-16 w-16 rounded-full bg-brand-decor/20 motion-safe:animate-ping" aria-hidden="true" />
            <div className="relative flex h-16 w-16 items-center justify-center rounded-full border border-border bg-brand-bg text-brand-fg">
              <Smartphone size={28} aria-hidden="true" />
            </div>
          </div>

          <div className="space-y-1.5 px-2">
            <h3 className="text-base font-bold text-fg">
              {redirect.kind === 'settled'
                ? 'Paiement déjà traité'
                : redirect.opened
                ? `${redirect.label} est ouvert`
                : `Demande ${redirect.label} créée`}
            </h3>
            <p className="text-sm leading-relaxed text-fg-muted">
              {redirect.kind === 'settled'
                ? 'Affichage du statut de ce paiement…'
                : redirect.opened
                ? `Validez ${payableText} dans ${redirect.label}, puis revenez ici : le suivi se met à jour tout seul.`
                : `Sur la page de suivi, ouvrez ${redirect.label} ou scannez le QR code pour valider ${payableText}.`}
            </p>
            {reservationClock && redirect.expiresAt && (
              <p className="inline-flex items-center gap-1.5 pt-1 text-sm font-semibold text-brand-fg">
                <Clock size={16} aria-hidden="true" />
                <span>
                  Réservation valable jusqu’à <time dateTime={redirect.expiresAt}>{reservationClock}</time>
                </span>
              </p>
            )}
          </div>

          <p className="flex items-center gap-2 text-sm text-fg-muted">
            <Loader2 size={16} className="motion-safe:animate-spin" aria-hidden="true" />
            <span>Redirection vers le suivi du paiement…</span>
          </p>

          <LinkButton href={redirect.statusPath} variant="secondary" size="sm">
            Suivre le paiement
          </LinkButton>
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
          {props.checkoutItems !== undefined ? (
            <div className="space-y-3 rounded-2xl border border-border bg-surface-sunken p-4">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-fg-muted">Récapitulatif</p>
                <p className="line-clamp-2 text-sm font-semibold leading-snug text-fg">{title}</p>
              </div>
              {quote ? (
                <dl className="space-y-1.5 text-sm" aria-live="polite">
                  <div className="flex items-baseline justify-between gap-3">
                    <dt className="text-fg-muted">Prix des billets</dt>
                    <dd className="whitespace-nowrap font-semibold tabular-nums text-fg">{formatFcfa(quote.facialAmount)}</dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-3">
                    <dt className="text-fg-muted">
                      Frais de service{quote.serviceRatePercent !== null && quote.serviceFee > 0 ? ` (${quote.serviceRatePercent.toLocaleString('fr-FR')} %)` : ''}
                    </dt>
                    <dd className="whitespace-nowrap font-semibold tabular-nums text-fg">{formatFcfa(quote.serviceFee)}</dd>
                  </div>
                  <div className="flex items-baseline justify-between gap-3 border-t border-border pt-2">
                    <dt className="font-semibold text-fg">Total à payer</dt>
                    <dd className="whitespace-nowrap text-lg font-bold tabular-nums text-fg">{formatFcfa(quote.totalAmount)}</dd>
                  </div>
                </dl>
              ) : (
                <div className="space-y-2" role="status" aria-live="polite">
                  <span className="sr-only">Calcul du total en cours…</span>
                  <Skeleton className="h-4 w-2/3 rounded" />
                  <Skeleton className="h-4 w-1/2 rounded" />
                  <Skeleton className="h-6 w-1/3 rounded" />
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2 rounded-2xl border border-border bg-surface-sunken p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-fg-muted">Récapitulatif</p>
                  <p className="line-clamp-2 text-sm font-semibold leading-snug text-fg">{title}</p>
                </div>
                <span className="shrink-0 whitespace-nowrap rounded-xl border border-border bg-surface px-3 py-1 text-base font-bold tabular-nums text-fg">
                  {props.amountFormatted}
                </span>
              </div>
              {feesComputedLater && (
                <p className="text-sm leading-relaxed text-fg-muted">
                  Montant hors frais de service : le total exact, frais de service compris, s’affiche sur la page de suivi du paiement.
                </p>
              )}
            </div>
          )}

          {/* Erreur */}
          {failure && (
            <div role="alert" className="flex items-start gap-2.5 rounded-2xl border border-danger-border bg-danger-bg p-3.5 text-danger-fg">
              <AlertCircle size={18} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
              <div className="min-w-0 flex-1 space-y-2">
                <p className="text-sm font-semibold">{failureTitle(failure)}</p>
                {failure.problems.length > 0 ? (
                  <ul className="space-y-1">
                    {failure.problems.map((problem, index) => {
                      const label = categoryLabel(problem.categoryId);
                      return (
                        <li key={`${problem.categoryId ?? 'panier'}-${problem.code}-${index}`} className="text-sm leading-relaxed text-fg">
                          {label && <span className="font-semibold">{label} : </span>}
                          {problem.message}
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="text-sm leading-relaxed text-fg">{failure.message}</p>
                )}
                {failure.pendingStatusPath && (
                  <LinkButton href={failure.pendingStatusPath} variant="secondary" size="sm" leftIcon={<Clock size={16} />}>
                    Suivre le paiement
                  </LinkButton>
                )}
                {failure.httpStatus === 401 && (
                  <LinkButton href={`/login?redirect=${encodeURIComponent(pathname)}`} variant="secondary" size="sm" leftIcon={<LogIn size={16} />}>
                    Se reconnecter
                  </LinkButton>
                )}
              </div>
              {failure.httpStatus !== 429 && (
                <IconButton aria-label="Masquer le message d’erreur" variant="danger" onClick={() => setFailure(null)} className="-m-1.5">
                  <X size={18} />
                </IconButton>
              )}
            </div>
          )}

          {/* Opérateur : choix explicite obligatoire */}
          <fieldset aria-describedby={operatorMissing ? operatorErrorId : undefined}>
            <legend className="mb-2 text-sm font-semibold text-fg">
              Moyen de paiement <span className="text-brand-fg" aria-hidden="true">*</span>
            </legend>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
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
                      className={cn(
                        'flex min-h-16 items-center gap-3 rounded-2xl border-2 p-3 transition-colors duration-200',
                        'peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-surface-raised',
                        selected
                          ? 'border-brand-fg bg-brand-bg'
                          : operatorMissing
                          ? 'border-danger-border bg-surface'
                          : 'border-border bg-surface hover:border-border-strong',
                      )}
                    >
                      <span
                        aria-hidden="true"
                        className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold tracking-tight', visual.tile)}
                      >
                        {visual.mark}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-fg">{operatorLabel(op)}</span>
                        <span className="block text-sm text-fg-muted">Mobile Money</span>
                      </span>
                      <span
                        aria-hidden="true"
                        className={cn(
                          'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
                          selected ? 'border-brand bg-brand' : 'border-border-strong',
                        )}
                      >
                        {selected && <span className="h-2 w-2 rounded-full bg-on-brand" />}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
            {operatorMissing && (
              <p id={operatorErrorId} className="mt-1.5 text-sm font-medium text-danger-fg">
                Choisissez l’opérateur avec lequel vous allez payer.
              </p>
            )}
          </fieldset>

          {/* Téléphone payeur */}
          <div>
            <label htmlFor={phoneFieldId} className="mb-1.5 block text-sm font-semibold text-fg">
              Numéro {chosenLabel ?? 'Mobile Money'} du payeur <span className="text-brand-fg" aria-hidden="true">*</span>
            </label>
            <div className="relative">
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-base font-semibold text-fg-muted"
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
                className={cn(
                  'h-12 w-full rounded-xl border bg-surface pl-[3.75rem] pr-10 text-base font-semibold tabular-nums tracking-wide text-fg transition-colors',
                  'placeholder:text-fg-muted/70 focus:outline-none focus:ring-2 focus:ring-ring',
                  phoneError ? 'border-danger' : 'border-border-strong',
                )}
              />
              {payerPhone && !phoneRejected && (
                <CheckCircle2 size={18} aria-hidden="true" className="absolute right-3.5 top-1/2 -translate-y-1/2 text-success-fg" />
              )}
            </div>
            <p id={phoneHelpId} className={cn('mt-1.5 text-sm leading-relaxed', phoneError ? 'font-medium text-danger-fg' : 'text-fg-muted')}>
              {phoneError ?? phoneHelp}
            </p>
          </div>

          {/* Ce qui va se passer */}
          {(chosenLabel && payerPhone) || props.checkoutItems !== undefined ? (
            <ul className="space-y-1.5 text-sm text-fg-muted">
              {chosenLabel && payerPhone && (
                <li className="flex items-start gap-2">
                  <Smartphone size={16} className="mt-0.5 shrink-0 text-brand-fg" aria-hidden="true" />
                  <span>
                    Vous validerez ensuite le paiement dans {chosenLabel}, depuis le{' '}
                    <span className="whitespace-nowrap font-semibold tabular-nums text-fg">+221 {formatLocalPhone(payerPhone)}</span>.
                  </span>
                </li>
              )}
              {props.checkoutItems !== undefined && (
                <li className="flex items-start gap-2">
                  <Clock size={16} className="mt-0.5 shrink-0 text-brand-fg" aria-hidden="true" />
                  <span>Vos billets restent réservés pendant le paiement ; le temps restant s’affiche à l’étape suivante.</span>
                </li>
              )}
            </ul>
          ) : null}

          <Button type="submit" variant="primary" fullWidth size="lg" isLoading={isSubmitting} disabled={retryRemaining > 0 || awaitingQuote}>
            {ctaLabel}
          </Button>

          <p className="flex items-center justify-center gap-1.5 text-center text-sm text-fg-muted">
            <ShieldCheck size={16} className="shrink-0 text-success-fg" aria-hidden="true" />
            <span>Paiement sécurisé par SamirPay. Votre code secret ne vous sera jamais demandé ici.</span>
          </p>
        </form>
      )}
    </Modal>
  );
};

'use client';

/**
 * Portefeuille de parrainage (lot 3.6) : compte PARRAINAGE du grand livre.
 *  - solde disponible au retrait, commissions en attente (avec leur date de disponibilité),
 *    retraits en cours, créance éventuelle, historique et retraits : GET /api/finance/balance ;
 *  - lien de parrainage, taux et filleuls : GET /api/referrals/my-stats (aucun solde lu là) ;
 *  - retrait : Wave ou Orange Money, numéro, montant, code SMS (POST /api/withdrawals/otp), puis
 *    POST /api/withdrawals/request (Idempotency-Key). Frais et seuil viennent de la réponse serveur.
 * Lot 7 (7.3, E4) : système de design (tokens, 14 px au moins, aucune couleur écrite en dur, plus de dégradé
 * sous du texte) ; montants par formatFcfa de lib/format (D60) ; statuts et opérations par leurs libellés
 * français, jamais le code brut ; statut effectif du retrait (effective_status) lu s'il est servi.
 */

import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowDownLeft,
  ArrowUpRight,
  Award,
  CalendarClock,
  Check,
  CheckCircle2,
  Copy,
  Gift,
  Hourglass,
  KeyRound,
  Send,
  ShieldCheck,
  Wallet,
  XCircle,
} from 'lucide-react';
import { useToast } from '@/components/ui/Toast';
import { Badge, type BadgeVariant } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { PageHeader } from '@/components/ui/PageHeader';
import { Skeleton } from '@/components/ui/Skeleton';
import { cn } from '@/components/ui/cn';
import { useAuth } from '@/components/providers/AuthProvider';
import { OPERATOR_VISUALS } from '@/components/payment/PaymentModal';
import { formatDateTime as formatDakarDateTime, formatFcfa, toDate } from '@/lib/format';
import {
  formatLocalPhone,
  isUncertainOutcome,
  operatorLabel,
  readAmount,
  readJsonBody,
  serverErrorMessage,
  useIdempotencyKey,
} from '@/lib/payments/payment-client';
import { maskPhone, normalizePayerPhone } from '@/lib/payments/payer-phone';
import { SAMIRPAY_OPERATORS, type SamirPayOperatorName } from '@/lib/samirpay/types';

const ACCOUNT = 'PARRAINAGE';

/* ──────────────────────────────── Types ──────────────────────────────── */

interface Balance {
  available: number;
  pending: number;
  nextAvailableAt: string | null;
  inProgress: number;
  debt: number;
  withdrawable: number;
}

interface HistoryEntry {
  id: string;
  entryType: string;
  amount: number;
  availableAt: string | null;
  createdAt: string;
  description: string | null;
}

interface WithdrawalRow {
  id: string;
  gross: number;
  fee: number;
  net: number;
  status: string;
  operator: string | null;
  phone: string | null;
  createdAt: string;
  processedAt: string | null;
  rejectionReason: string | null;
}

interface AccountView {
  balance: Balance;
  history: HistoryEntry[];
  withdrawals: WithdrawalRow[];
}

interface WithdrawalResult {
  status: string;
  gross: number | null;
  fee: number | null;
  net: number | null;
}

interface ReferralInfo {
  referralLink: string;
  isAmbassador: boolean;
  rates: { level1: number; level2: number };
  network: { level1Count: number; level2Count: number };
  recentCommissions: Array<{ id: string; amount: number; generation: string; status: string; createdAt: string }>;
}

type Step = 'form' | 'otp' | 'done';

interface FieldErrors {
  operator?: string;
  phone?: string;
  amount?: string;
  otp?: string;
}

/* ─────────────────────────────── Lecture ─────────────────────────────── */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}

function parseAccount(body: unknown): AccountView | null {
  if (!isRecord(body)) return null;
  const available = readAmount(body.available);
  const pending = readAmount(body.pending);
  const withdrawable = readAmount(body.withdrawable);
  if (available === null || pending === null || withdrawable === null) return null;
  const history: HistoryEntry[] = Array.isArray(body.history)
    ? body.history.flatMap((e: unknown, i: number) => {
        if (!isRecord(e)) return [];
        const amount = readAmount(e.amount);
        const createdAt = text(e.created_at);
        if (amount === null || !createdAt) return [];
        return [{
          id: text(e.id) ?? `entree-${i}`,
          entryType: text(e.entry_type) ?? 'AUTRE',
          amount,
          availableAt: text(e.available_at),
          createdAt,
          description: text(e.description),
        }];
      })
    : [];
  const withdrawals: WithdrawalRow[] = Array.isArray(body.withdrawals)
    ? body.withdrawals.flatMap((w: unknown) => {
        if (!isRecord(w)) return [];
        const id = text(w.id);
        const gross = readAmount(w.gross_amount);
        const fee = readAmount(w.fee_amount);
        const net = readAmount(w.net_amount);
        const createdAt = text(w.created_at);
        if (!id || gross === null || fee === null || net === null || !createdAt) return [];
        return [{
          id,
          gross,
          fee,
          net,
          // Statut effectif (envoi confirmé ou échoué) quand le serveur le sert, sinon le statut enregistré.
          status: text(w.effective_status) ?? text(w.status) ?? 'PENDING',
          operator: text(w.operator),
          phone: text(w.phone_number),
          createdAt,
          processedAt: text(w.processed_at),
          rejectionReason: text(w.rejection_reason),
        }];
      })
    : [];
  return {
    balance: {
      available,
      pending,
      nextAvailableAt: text(body.next_available_at),
      inProgress: readAmount(body.in_progress) ?? 0,
      debt: readAmount(body.debt) ?? 0,
      withdrawable,
    },
    history,
    withdrawals,
  };
}

function parseResult(body: unknown): WithdrawalResult | null {
  if (!isRecord(body)) return null;
  const root = isRecord(body.withdrawal) ? body.withdrawal : body;
  const status = text(root.status);
  if (!status) return null;
  // Issue de l'envoi (cashout_status) quand le statut du retrait n'a pas encore été mis à jour.
  const cashout = text(root.cashout_status);
  const effective = status === 'PROCESSING' && cashout === 'CONFIRME' ? 'PAID' : status === 'PROCESSING' && cashout === 'ECHOUE' ? 'REJECTED' : status;
  return { status: effective, gross: readAmount(root.gross_amount), fee: readAmount(root.fee_amount), net: readAmount(root.net_amount) };
}

function parseReferral(body: unknown): ReferralInfo | null {
  if (!isRecord(body) || body.success !== true) return null;
  const rates = isRecord(body.rates) ? body.rates : {};
  const network = isRecord(body.network) ? body.network : {};
  const commissions = Array.isArray(body.recentCommissions) ? body.recentCommissions : [];
  return {
    referralLink: text(body.referralLink) ?? '',
    isAmbassador: body.isAmbassador === true,
    rates: { level1: readAmount(rates.level1) ?? 0, level2: readAmount(rates.level2) ?? 0 },
    network: { level1Count: readAmount(network.level1Count) ?? 0, level2Count: readAmount(network.level2Count) ?? 0 },
    recentCommissions: commissions.flatMap((c: unknown) => {
      if (!isRecord(c)) return [];
      const id = text(c.id);
      const amount = readAmount(c.amount);
      const createdAt = text(c.created_at);
      if (!id || amount === null || !createdAt) return [];
      return [{ id, amount, generation: text(c.generation) ?? 'N1', status: text(c.status) ?? 'PENDING', createdAt }];
    }),
  };
}

/* ─────────────────────────────── Affichage ─────────────────────────────── */

const ENTRY_LABELS: Record<string, string> = {
  COMMISSION: 'Commission de parrainage',
  COMMISSION_ANNULEE: 'Commission annulée (achat remboursé)',
  REGULARISATION: 'Régularisation (achat remboursé)',
  RETRAIT: 'Retrait demandé',
  RETRAIT_ANNULE: 'Retrait refusé : montant rendu',
  COMPENSATION_CREANCE: 'Compensation d’une créance',
  VENTE: 'Vente en ligne',
  REMBOURSEMENT: 'Remboursement',
};

const WITHDRAWAL_STATUS: Record<string, { label: string; variant: BadgeVariant }> = {
  PENDING: { label: 'En attente', variant: 'warning' },
  PROCESSING: { label: 'En cours', variant: 'warning' },
  PAID: { label: 'Versé', variant: 'success' },
  REJECTED: { label: 'Refusé, montant rendu', variant: 'danger' },
  CANCELLED: { label: 'Annulé', variant: 'neutral' },
};

const COMMISSION_STATUS: Record<string, string> = {
  PENDING: 'En attente',
  AVAILABLE: 'Disponible',
  PAID: 'Versée',
  CANCELLED: 'Annulée',
};

function withdrawalStatus(status: string): { label: string; variant: BadgeVariant } {
  return WITHDRAWAL_STATUS[status] ?? { label: 'Statut à vérifier', variant: 'neutral' };
}

/** Date et heure à Dakar (lib/format) ; null si la valeur est absente ou illisible. */
function formatDateTime(iso: string | null): string | null {
  return toDate(iso) ? formatDakarDateTime(iso) : null;
}

function formatSigned(amount: number): string {
  return amount < 0 ? `− ${formatFcfa(-amount)}` : `+ ${formatFcfa(amount)}`;
}

function isFuture(iso: string | null): boolean {
  if (!iso) return false;
  const t = Date.parse(iso);
  return !Number.isNaN(t) && t > Date.now();
}

function fieldForCode(code: string | null): keyof FieldErrors | null {
  if (!code) return null;
  if (code.includes('OTP')) return 'otp';
  if (['BELOW_MINIMUM', 'INVALID_AMOUNT', 'INSUFFICIENT_BALANCE'].includes(code)) return 'amount';
  if (code === 'INVALID_DESTINATION' || code === 'INVALID_PHONE') return 'phone';
  if (code === 'INVALID_OPERATOR') return 'operator';
  return null;
}

/* ──────────────────────────────── Page ──────────────────────────────── */

export default function WalletPage() {
  const { profile } = useAuth();
  const toast = useToast();
  const attempt = useIdempotencyKey();
  const fieldId = useId();
  const ids = {
    phone: `${fieldId}-phone`,
    phoneHelp: `${fieldId}-phone-help`,
    amount: `${fieldId}-amount`,
    amountHelp: `${fieldId}-amount-help`,
    otp: `${fieldId}-otp`,
    otpHelp: `${fieldId}-otp-help`,
    operatorError: `${fieldId}-operator-error`,
  };

  const [copied, setCopied] = useState(false);
  const [referral, setReferral] = useState<ReferralInfo | null>(null);
  const [referralError, setReferralError] = useState<string | null>(null);

  const [account, setAccount] = useState<AccountView | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [step, setStep] = useState<Step>('form');
  const [operator, setOperator] = useState<SamirPayOperatorName | null>(null);
  const [phoneInput, setPhoneInput] = useState('');
  const [amountInput, setAmountInput] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [flowError, setFlowError] = useState<string | null>(null);
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<WithdrawalResult | null>(null);

  const prefillDone = useRef(false);
  const otpRef = useRef<HTMLInputElement | null>(null);
  const resultRef = useRef<HTMLDivElement | null>(null);

  const payoutPhone = normalizePayerPhone(phoneInput);
  const accountPhone = normalizePayerPhone(profile?.phone);
  const amountValue = /^\d+$/.test(amountInput.trim()) ? Number(amountInput.trim()) : null;
  const balance = account?.balance ?? null;

  const loadAccount = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/finance/balance?account=${ACCOUNT}`, { cache: 'no-store' });
      const body = await readJsonBody(res, 'portefeuille');
      if (!res.ok) {
        setLoadError(serverErrorMessage(body) ?? `Le solde n’a pas pu être chargé (erreur ${res.status}).`);
        return;
      }
      const view = parseAccount(body);
      if (!view) {
        console.error('[portefeuille] réponse de solde inattendue :', body);
        setLoadError('Réponse inattendue du serveur : le solde n’a pas pu être affiché.');
        return;
      }
      setAccount(view);
      setLoadError(null);
    } catch (err) {
      console.error('[portefeuille] chargement du solde impossible :', err);
      setLoadError('Connexion impossible : vérifiez votre réseau puis réessayez.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadReferral = useCallback(async () => {
    try {
      const res = await fetch('/api/referrals/my-stats', { cache: 'no-store' });
      const body = await readJsonBody(res, 'portefeuille/parrainage');
      const info = res.ok ? parseReferral(body) : null;
      if (!info) {
        setReferralError(serverErrorMessage(body) ?? 'Vos informations de parrainage n’ont pas pu être chargées.');
        return;
      }
      setReferral(info);
      setReferralError(null);
    } catch (err) {
      console.error('[portefeuille] chargement du parrainage impossible :', err);
      setReferralError('Connexion impossible : vos informations de parrainage n’ont pas pu être chargées.');
    }
  }, []);

  useEffect(() => {
    if (!profile?.id) return;
    void loadAccount();
    void loadReferral();
  }, [profile?.id, loadAccount, loadReferral]);

  useEffect(() => {
    if (prefillDone.current || !accountPhone) return;
    prefillDone.current = true;
    setPhoneInput(formatLocalPhone(accountPhone));
  }, [accountPhone]);

  useEffect(() => {
    if (step === 'otp') otpRef.current?.focus();
    if (step === 'done') resultRef.current?.focus();
  }, [step]);

  const handleCopyLink = async () => {
    if (!referral?.referralLink) return;
    try {
      await navigator.clipboard.writeText(referral.referralLink);
      setCopied(true);
      toast.success('Lien de parrainage copié.');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('[portefeuille] copie du lien impossible :', err);
      toast.error('Copie impossible : sélectionnez le lien et copiez-le manuellement.');
    }
  };

  const validate = (): boolean => {
    const next: FieldErrors = {};
    if (!operator) next.operator = 'Choisissez Wave ou Orange Money.';
    if (!payoutPhone) next.phone = 'Numéro invalide : mobile sénégalais de 9 chiffres commençant par 70, 75, 76, 77 ou 78.';
    if (amountValue === null || amountValue <= 0) next.amount = 'Indiquez un montant entier en francs CFA.';
    else if (balance && amountValue > balance.withdrawable) {
      next.amount = `Le montant dépasse votre solde disponible au retrait (${formatFcfa(balance.withdrawable)}).`;
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const requestCode = async () => {
    if (isSendingCode) return;
    setFlowError(null);
    if (!validate()) return;
    setIsSendingCode(true);
    try {
      const res = await fetch('/api/withdrawals/otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ account: ACCOUNT }),
      });
      const body = await readJsonBody(res, 'portefeuille/code');
      if (!res.ok) {
        setFlowError(serverErrorMessage(body) ?? `Le code de confirmation n’a pas pu être envoyé (erreur ${res.status}).`);
        return;
      }
      setOtpCode('');
      setErrors({});
      setStep('otp');
      toast.success('Code de confirmation envoyé par SMS.');
    } catch (err) {
      console.error('[portefeuille] envoi du code impossible :', err);
      setFlowError('Connexion impossible : le code n’a pas pu être envoyé. Réessayez.');
    } finally {
      setIsSendingCode(false);
    }
  };

  const confirmWithdrawal = async () => {
    if (isSubmitting || !operator || !payoutPhone || amountValue === null) return;
    setFlowError(null);
    if (!/^\d{6}$/.test(otpCode.trim())) {
      setErrors({ otp: 'Saisissez le code à 6 chiffres reçu par SMS.' });
      otpRef.current?.focus();
      return;
    }
    const request = { account: ACCOUNT, amount: amountValue, method: 'MOBILE_MONEY', operator, phoneNumber: payoutPhone };
    const idempotencyKey = attempt.keyFor(JSON.stringify(request));
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/withdrawals/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
        body: JSON.stringify({ ...request, otpCode: otpCode.trim() }),
      });
      const body = await readJsonBody(res, 'portefeuille/retrait');
      if (!res.ok) {
        if (!isUncertainOutcome(res.status)) attempt.reset();
        const message = serverErrorMessage(body) ?? `Le retrait n’a pas pu être demandé (erreur ${res.status}).`;
        const field = fieldForCode(isRecord(body) ? text(body.code) : null);
        if (field === 'otp') {
          setErrors({ otp: message });
          otpRef.current?.focus();
        } else if (field) {
          setErrors({ [field]: message });
          setStep('form');
        } else {
          setFlowError(message);
        }
        return;
      }
      const parsed = parseResult(body);
      if (!parsed) {
        console.error('[portefeuille] réponse de retrait inattendue :', body);
        setFlowError('Réponse inattendue du serveur. Actualisez la page : votre demande ne sera pas dupliquée.');
        return;
      }
      attempt.reset();
      setResult(parsed);
      setStep('done');
      void loadAccount();
    } catch (err) {
      // Sort incertain : la même clé sera réutilisée, la demande ne sera pas dupliquée.
      console.error('[portefeuille] demande de retrait impossible :', err);
      setFlowError('Connexion interrompue : la demande n’a peut-être pas abouti. Réessayez, elle ne sera pas dupliquée.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const restart = () => {
    setStep('form');
    setResult(null);
    setOtpCode('');
    setAmountInput('');
    setErrors({});
    setFlowError(null);
  };

  const inputClass = (invalid: boolean) =>
    cn(
      'h-12 w-full rounded-xl border bg-surface px-4 text-base font-semibold text-fg transition-colors',
      'placeholder:text-fg-muted/70 focus:outline-none focus:ring-2 focus:ring-ring',
      invalid ? 'border-danger' : 'border-border-strong',
    );
  const helpClass = (invalid: boolean) => cn('mt-1.5 text-sm leading-relaxed', invalid ? 'font-medium text-danger-fg' : 'text-fg-muted');
  const cardClass = 'space-y-5 rounded-3xl border border-border bg-surface p-5 sm:p-6';
  const statClass = 'space-y-1 rounded-2xl border border-border bg-surface p-4';

  return (
    <div className="space-y-8 pb-24 lg:pb-12">
      {/* 1. En-tête */}
      <PageHeader
        title="Portefeuille de parrainage"
        description="Vos commissions N1 et N2 deviennent disponibles après leur délai de validation ; retirez-les par Wave ou Orange Money."
      />

      {/* 2. Soldes */}
      {loadError && !account ? (
        <ErrorState title="Solde indisponible" description={loadError} onRetry={() => void loadAccount()} isRetrying={isLoading} />
      ) : !account || !balance ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3" role="status" aria-busy="true">
          <span className="sr-only">Chargement du solde…</span>
          <Skeleton className="h-36 rounded-3xl sm:col-span-3" />
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
        </div>
      ) : (
        <section aria-labelledby={`${fieldId}-soldes`} className="space-y-3">
          <h2 id={`${fieldId}-soldes`} className="sr-only">Soldes</h2>
          {loadError && (
            <p role="alert" className="flex items-center gap-2 rounded-xl border border-danger-border bg-danger-bg p-3 text-sm text-danger-fg">
              <AlertCircle size={16} className="flex-shrink-0" aria-hidden="true" />
              {loadError}
            </p>
          )}
          <div className="space-y-2 rounded-3xl bg-brand p-6 text-on-brand shadow-lg sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-semibold">Disponible au retrait</span>
              {referral && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-on-brand/30 bg-on-brand/15 px-3 py-1 text-sm font-semibold">
                  <Award size={16} aria-hidden="true" /> {referral.isAmbassador ? 'Ambassadeur' : 'Client standard'}
                </span>
              )}
            </div>
            <p className="text-3xl font-bold tracking-tight tabular-nums sm:text-4xl">{formatFcfa(balance.withdrawable)}</p>
            <p className="text-sm font-medium">Commissions validées, retirables dès maintenant.</p>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className={statClass}>
              <p className="flex items-center gap-1.5 text-sm font-semibold text-fg-muted">
                <Hourglass size={16} className="text-warning-fg" aria-hidden="true" /> En attente
              </p>
              <p className="text-lg font-bold tabular-nums text-fg">{formatFcfa(balance.pending)}</p>
              <p className="text-sm leading-relaxed text-fg-muted">
                {balance.pending > 0 && formatDateTime(balance.nextAvailableAt)
                  ? `Prochaine disponibilité : ${formatDateTime(balance.nextAvailableAt)}.`
                  : 'Chaque commission devient disponible après son délai de validation.'}
              </p>
            </div>
            <div className={statClass}>
              <p className="flex items-center gap-1.5 text-sm font-semibold text-fg-muted">
                <Send size={16} className="text-brand-fg" aria-hidden="true" /> Retraits en cours
              </p>
              <p className="text-lg font-bold tabular-nums text-fg">{formatFcfa(balance.inProgress)}</p>
              <p className="text-sm leading-relaxed text-fg-muted">Montant réservé pendant l’envoi vers Wave ou Orange Money.</p>
            </div>
            <div className={statClass}>
              <p className="flex items-center gap-1.5 text-sm font-semibold text-fg-muted">
                <ShieldCheck size={16} className="text-success-fg" aria-hidden="true" /> Créance
              </p>
              <p className="text-lg font-bold tabular-nums text-fg">{formatFcfa(balance.debt)}</p>
              <p className="text-sm leading-relaxed text-fg-muted">
                {balance.debt > 0 ? 'Commission déjà versée sur un achat remboursé : déduite de vos prochains gains.' : 'Aucune somme à compenser.'}
              </p>
            </div>
          </div>
        </section>
      )}

      {/* 3. Retrait */}
      <section aria-labelledby={`${fieldId}-retrait`} className={cardClass}>
        <div>
          <h2 id={`${fieldId}-retrait`} className="flex items-center gap-2 text-lg font-bold text-fg">
            <Send size={18} className="text-brand-fg" aria-hidden="true" />
            Retirer mes commissions
          </h2>
          <p className="mt-0.5 text-sm text-fg-muted">
            Wave ou Orange Money. Montant minimum et frais de retrait appliqués par Event Village à la demande, puis affichés ici.
          </p>
        </div>

        <ol className="flex flex-wrap items-center gap-2 text-sm font-semibold" aria-label="Étapes du retrait">
          {(['form', 'otp', 'done'] as const).map((s, i) => {
            const labels = { form: 'Demande', otp: 'Code SMS', done: 'Suivi' };
            const reached = ['form', 'otp', 'done'].indexOf(step) >= i;
            return (
              <li key={s} className="flex items-center gap-2" aria-current={step === s ? 'step' : undefined}>
                <span
                  className={cn(
                    'flex h-6 w-6 items-center justify-center rounded-full',
                    reached ? 'bg-brand text-on-brand' : 'bg-surface-sunken text-fg-muted ring-1 ring-inset ring-border',
                  )}
                  aria-hidden="true"
                >
                  {i + 1}
                </span>
                <span className={reached ? 'text-fg' : 'text-fg-muted'}>{labels[s]}</span>
                {i < 2 && <span className="h-px w-6 bg-border" aria-hidden="true" />}
              </li>
            );
          })}
        </ol>

        {flowError && (
          <div role="alert" className="flex items-start gap-2.5 rounded-2xl border border-danger-border bg-danger-bg p-3.5 text-danger-fg">
            <AlertCircle size={18} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
            <p className="text-sm leading-relaxed">{flowError}</p>
          </div>
        )}

        {step === 'form' && (
          <form
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              void requestCode();
            }}
            className="space-y-4"
          >
            <fieldset aria-describedby={errors.operator ? ids.operatorError : undefined}>
              <legend className="mb-2 text-sm font-semibold text-fg">
                Recevoir sur <span className="text-brand-fg" aria-hidden="true">*</span>
              </legend>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {SAMIRPAY_OPERATORS.map((op) => {
                  const selected = operator === op;
                  const visual = OPERATOR_VISUALS[op];
                  return (
                    <label key={op} className="relative block cursor-pointer">
                      <input
                        type="radio"
                        name={`${fieldId}-operator`}
                        value={op}
                        checked={selected}
                        onChange={() => {
                          setOperator(op);
                          setErrors((prev) => ({ ...prev, operator: undefined }));
                        }}
                        className="peer sr-only"
                      />
                      <span
                        className={cn(
                          'flex min-h-14 items-center gap-3 rounded-2xl border-2 p-3 transition-colors',
                          'peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-surface',
                          selected
                            ? 'border-brand-fg bg-brand-bg'
                            : errors.operator
                            ? 'border-danger-border'
                            : 'border-border hover:border-border-strong',
                        )}
                      >
                        <span aria-hidden="true" className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-bold', visual.tile)}>
                          {visual.mark}
                        </span>
                        <span className="text-sm font-semibold text-fg">{operatorLabel(op)}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
              {errors.operator && (
                <p id={ids.operatorError} className="mt-1.5 text-sm font-medium text-danger-fg">{errors.operator}</p>
              )}
            </fieldset>

            <div>
              <label htmlFor={ids.phone} className="mb-1.5 block text-sm font-semibold text-fg">
                Numéro {operator ? operatorLabel(operator) : 'Mobile Money'} qui reçoit le retrait <span className="text-brand-fg" aria-hidden="true">*</span>
              </label>
              <input
                id={ids.phone}
                type="tel"
                inputMode="tel"
                autoComplete="tel-national"
                placeholder="77 123 45 67"
                value={phoneInput}
                aria-invalid={errors.phone ? true : undefined}
                aria-describedby={ids.phoneHelp}
                onChange={(e) => {
                  setPhoneInput(e.target.value);
                  setErrors((prev) => ({ ...prev, phone: undefined }));
                }}
                onBlur={() => {
                  if (payoutPhone) setPhoneInput(formatLocalPhone(payoutPhone));
                }}
                className={cn(inputClass(Boolean(errors.phone)), 'font-mono tracking-wide')}
              />
              <p id={ids.phoneHelp} className={helpClass(Boolean(errors.phone))}>
                {errors.phone ?? 'Mobile sénégalais de 9 chiffres. Le code de confirmation part au numéro de votre compte.'}
              </p>
            </div>

            <div>
              <label htmlFor={ids.amount} className="mb-1.5 block text-sm font-semibold text-fg">
                Montant à retirer (F CFA) <span className="text-brand-fg" aria-hidden="true">*</span>
              </label>
              <input
                id={ids.amount}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="off"
                placeholder="Ex : 10000"
                value={amountInput}
                aria-invalid={errors.amount ? true : undefined}
                aria-describedby={ids.amountHelp}
                onChange={(e) => {
                  setAmountInput(e.target.value.replace(/[^\d]/g, ''));
                  setErrors((prev) => ({ ...prev, amount: undefined }));
                }}
                className={cn(inputClass(Boolean(errors.amount)), 'tabular-nums')}
              />
              <p id={ids.amountHelp} className={helpClass(Boolean(errors.amount))}>
                {errors.amount ??
                  (balance
                    ? `Disponible : ${formatFcfa(balance.withdrawable)}. Frais calculés à la demande et déduits du montant versé.`
                    : 'Frais calculés à la demande et déduits du montant versé.')}
              </p>
            </div>

            <Button
              type="submit"
              variant="primary"
              fullWidth
              size="lg"
              isLoading={isSendingCode}
              disabled={!balance || balance.withdrawable <= 0}
              leftIcon={<KeyRound size={16} aria-hidden="true" />}
            >
              {balance && balance.withdrawable <= 0 ? 'Aucun montant disponible au retrait' : 'Recevoir le code de confirmation'}
            </Button>
          </form>
        )}

        {step === 'otp' && operator && payoutPhone && amountValue !== null && (
          <form
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              void confirmWithdrawal();
            }}
            className="space-y-4"
          >
            <dl className="space-y-2 rounded-2xl border border-border bg-surface-sunken p-4 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-fg-muted">Montant demandé</dt>
                <dd className="font-bold tabular-nums text-fg">{formatFcfa(amountValue)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-fg-muted">Vers</dt>
                <dd className="text-right font-semibold text-fg">
                  {operatorLabel(operator)} · <span className="whitespace-nowrap font-mono">+221 {formatLocalPhone(payoutPhone)}</span>
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-fg-muted">Frais de retrait</dt>
                <dd className="font-semibold text-fg-muted">Calculés à la confirmation</dd>
              </div>
            </dl>

            <div>
              <label htmlFor={ids.otp} className="mb-1.5 block text-sm font-semibold text-fg">
                Code de confirmation <span className="text-brand-fg" aria-hidden="true">*</span>
              </label>
              <input
                ref={otpRef}
                id={ids.otp}
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]{6}"
                maxLength={6}
                placeholder="000000"
                value={otpCode}
                aria-invalid={errors.otp ? true : undefined}
                aria-describedby={ids.otpHelp}
                onChange={(e) => {
                  setOtpCode(e.target.value.replace(/[^\d]/g, '').slice(0, 6));
                  setErrors((prev) => ({ ...prev, otp: undefined }));
                }}
                className={cn(inputClass(Boolean(errors.otp)), 'text-center font-mono text-xl tracking-[0.5em]')}
              />
              <p id={ids.otpHelp} className={helpClass(Boolean(errors.otp))}>
                {errors.otp ?? `Code à 6 chiffres envoyé par SMS au ${accountPhone ? `+221 ${maskPhone(accountPhone)}` : 'numéro de votre compte'}.`}
              </p>
            </div>

            <Button type="submit" variant="primary" fullWidth size="lg" isLoading={isSubmitting} leftIcon={<CheckCircle2 size={16} aria-hidden="true" />}>
              {isSubmitting ? 'Demande en cours…' : 'Confirmer le retrait'}
            </Button>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button type="button" variant="ghost" fullWidth disabled={isSubmitting || isSendingCode} isLoading={isSendingCode} onClick={() => void requestCode()}>
                Renvoyer un code
              </Button>
              <Button
                type="button"
                variant="ghost"
                fullWidth
                disabled={isSubmitting}
                onClick={() => {
                  setStep('form');
                  setErrors({});
                  setFlowError(null);
                }}
              >
                Modifier la demande
              </Button>
            </div>
          </form>
        )}

        {step === 'done' && result && (
          <div ref={resultRef} tabIndex={-1} role="status" aria-live="polite" className="space-y-4 focus:outline-none">
            <div
              className={cn(
                'flex items-start gap-3 rounded-2xl border p-4',
                result.status === 'REJECTED'
                  ? 'border-danger-border bg-danger-bg text-danger-fg'
                  : result.status === 'PAID'
                  ? 'border-success-border bg-success-bg text-success-fg'
                  : 'border-warning-border bg-warning-bg text-warning-fg',
              )}
            >
              {result.status === 'REJECTED' ? (
                <XCircle size={20} className="shrink-0" aria-hidden="true" />
              ) : result.status === 'PAID' ? (
                <CheckCircle2 size={20} className="shrink-0" aria-hidden="true" />
              ) : (
                <Hourglass size={20} className="shrink-0" aria-hidden="true" />
              )}
              <div className="space-y-1">
                <p className="text-sm font-bold">
                  {result.status === 'PAID' ? 'Retrait versé' : result.status === 'REJECTED' ? 'Retrait refusé par l’opérateur' : 'Retrait en cours de traitement'}
                </p>
                <p className="text-sm leading-relaxed text-fg">
                  {result.status === 'PAID'
                    ? 'Le montant net a été envoyé sur votre compte Mobile Money.'
                    : result.status === 'REJECTED'
                    ? 'Le montant a été rendu à votre solde disponible. Vérifiez le numéro puis refaites une demande.'
                    : 'Le montant reste réservé jusqu’à la confirmation de l’opérateur. Il ne sera jamais versé deux fois ; suivez son état ci-dessous.'}
                </p>
              </div>
            </div>
            <dl className="space-y-2 rounded-2xl border border-border bg-surface-sunken p-4 text-sm">
              {result.gross !== null && (
                <div className="flex justify-between gap-3">
                  <dt className="text-fg-muted">Montant demandé</dt>
                  <dd className="font-semibold tabular-nums text-fg">{formatFcfa(result.gross)}</dd>
                </div>
              )}
              {result.fee !== null && (
                <div className="flex justify-between gap-3">
                  <dt className="text-fg-muted">Frais de retrait</dt>
                  <dd className="font-semibold tabular-nums text-fg">{formatFcfa(result.fee)}</dd>
                </div>
              )}
              {result.net !== null && (
                <div className="flex justify-between gap-3 border-t border-border pt-2">
                  <dt className="font-semibold text-fg">Montant versé</dt>
                  <dd className="font-bold tabular-nums text-brand-fg">{formatFcfa(result.net)}</dd>
                </div>
              )}
            </dl>
            <Button type="button" variant="secondary" fullWidth onClick={restart}>
              Nouvelle demande
            </Button>
          </div>
        )}
      </section>

      {/* 4. Lien de parrainage, taux et filleuls */}
      <section aria-labelledby={`${fieldId}-lien`} className={cn(cardClass, 'space-y-4')}>
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-brand-bg text-brand-fg" aria-hidden="true">
            <Gift size={20} />
          </span>
          <div>
            <h2 id={`${fieldId}-lien`} className="text-lg font-bold text-fg">Votre lien de parrainage</h2>
            <p className="text-sm text-fg-muted">
              Partagez ce lien : vous touchez une commission sur les achats en ligne de vos filleuls.
            </p>
          </div>
        </div>

        {referralError && !referral ? (
          <div role="alert" className="flex flex-wrap items-center gap-2 rounded-xl border border-danger-border bg-danger-bg p-3 text-sm text-danger-fg">
            <AlertCircle size={16} className="flex-shrink-0" aria-hidden="true" />
            <span className="flex-1">{referralError}</span>
            <Button variant="secondary" size="sm" onClick={() => void loadReferral()}>Réessayer</Button>
          </div>
        ) : !referral ? (
          <Skeleton className="h-12 rounded-xl" />
        ) : (
          <>
            <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
              <p className="flex min-h-12 w-full flex-1 select-all items-center break-all rounded-xl border border-border bg-surface-sunken px-4 py-3 font-mono text-sm text-fg">
                {referral.referralLink}
              </p>
              <Button variant="primary" onClick={() => void handleCopyLink()} leftIcon={copied ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}>
                {copied ? 'Lien copié' : 'Copier mon lien'}
              </Button>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-border bg-surface-sunken p-4">
                <p className="text-sm font-semibold text-fg-muted">Génération 1 (filleuls directs)</p>
                <div className="mt-1 flex items-baseline justify-between gap-2">
                  <span className="text-xl font-bold tabular-nums text-brand-fg">{referral.rates.level1.toLocaleString('fr-FR')} %</span>
                  <span className="text-sm font-semibold text-fg-muted">{referral.network.level1Count} filleul{referral.network.level1Count > 1 ? 's' : ''}</span>
                </div>
              </div>
              <div className="rounded-2xl border border-border bg-surface-sunken p-4">
                <p className="text-sm font-semibold text-fg-muted">Génération 2 (sous-filleuls)</p>
                <div className="mt-1 flex items-baseline justify-between gap-2">
                  <span className="text-xl font-bold tabular-nums text-warning-fg">{referral.rates.level2.toLocaleString('fr-FR')} %</span>
                  <span className="text-sm font-semibold text-fg-muted">{referral.network.level2Count} filleul{referral.network.level2Count > 1 ? 's' : ''}</span>
                </div>
              </div>
            </div>
            {referral.recentCommissions.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-base font-bold text-fg">Dernières commissions</h3>
                <ul className="space-y-2">
                  {referral.recentCommissions.map((comm) => (
                    <li key={comm.id} className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-surface-sunken p-3 text-sm">
                      <div className="flex min-w-0 items-center gap-3">
                        <span
                          aria-hidden="true"
                          className={cn(
                            'flex h-8 w-8 shrink-0 items-center justify-center rounded-xl font-bold',
                            comm.generation === 'N1' ? 'bg-success-bg text-success-fg' : 'bg-warning-bg text-warning-fg',
                          )}
                        >
                          {comm.generation}
                        </span>
                        <div className="min-w-0">
                          <span className="block font-semibold text-fg">
                            Commission {comm.generation} · {COMMISSION_STATUS[comm.status] ?? 'statut à vérifier'}
                          </span>
                          <span className="text-fg-muted">{formatDateTime(comm.createdAt) ?? '—'}</span>
                        </div>
                      </div>
                      <span className="whitespace-nowrap font-bold tabular-nums text-success-fg">+ {formatFcfa(comm.amount)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </section>

      {/* 5. Retraits */}
      <section aria-labelledby={`${fieldId}-retraits`} className="space-y-3">
        <h2 id={`${fieldId}-retraits`} className="text-lg font-bold text-fg">Mes retraits</h2>
        {!account ? (
          isLoading ? <Skeleton className="h-20 rounded-2xl" /> : null
        ) : account.withdrawals.length === 0 ? (
          <EmptyState title="Aucun retrait" description="Vous n’avez pas encore retiré de commissions." icon={<Wallet size={28} aria-hidden="true" />} />
        ) : (
          <ul className="divide-y divide-border rounded-2xl border border-border bg-surface">
            {account.withdrawals.map((w) => {
              const st = withdrawalStatus(w.status);
              return (
                <li key={w.id} className="flex flex-col justify-between gap-2 px-4 py-3 sm:flex-row sm:items-center">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={st.variant} size="sm">{st.label}</Badge>
                      <span className="text-sm text-fg-muted">
                        {w.operator === 'WAVE' || w.operator === 'ORANGE_MONEY' ? operatorLabel(w.operator) : 'Mobile Money'}
                        {w.phone && <span className="font-mono"> · {maskPhone(w.phone)}</span>}
                      </span>
                    </div>
                    <p className="text-sm text-fg-muted">
                      Demandé le {formatDateTime(w.createdAt) ?? '—'}
                      {w.processedAt && formatDateTime(w.processedAt) && `, traité le ${formatDateTime(w.processedAt)}`}
                    </p>
                    {w.status === 'REJECTED' && w.rejectionReason && <p className="text-sm text-danger-fg">{w.rejectionReason}</p>}
                  </div>
                  <div className="shrink-0 sm:text-right">
                    <p className="text-base font-bold tabular-nums text-fg">{formatFcfa(w.gross)}</p>
                    <p className="text-sm tabular-nums text-fg-muted">
                      Versé : {formatFcfa(w.net)} · frais : {formatFcfa(w.fee)}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* 6. Historique */}
      <section aria-labelledby={`${fieldId}-historique`} className="space-y-3">
        <h2 id={`${fieldId}-historique`} className="text-lg font-bold text-fg">Historique du compte</h2>
        {!account ? (
          isLoading ? <Skeleton className="h-28 rounded-2xl" /> : null
        ) : account.history.length === 0 ? (
          <EmptyState
            title="Aucune opération"
            description="Partagez votre lien : les commissions de vos filleuls apparaîtront ici."
            icon={<CalendarClock size={28} aria-hidden="true" />}
          />
        ) : (
          <ul className="divide-y divide-border rounded-2xl border border-border bg-surface">
            {account.history.map((e) => {
              const credit = e.amount > 0;
              const future = credit && isFuture(e.availableAt);
              return (
                <li key={e.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="flex min-w-0 items-start gap-3">
                    <span
                      aria-hidden="true"
                      className={cn(
                        'flex h-8 w-8 shrink-0 items-center justify-center rounded-xl',
                        credit ? 'bg-success-bg text-success-fg' : 'bg-surface-sunken text-fg-muted',
                      )}
                    >
                      {credit ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
                    </span>
                    <div className="min-w-0 text-sm">
                      <p className="font-semibold text-fg">{ENTRY_LABELS[e.entryType] ?? 'Opération du compte'}</p>
                      {e.description && <p className="truncate text-fg-muted">{e.description}</p>}
                      <p className="text-fg-muted">
                        {formatDateTime(e.createdAt) ?? '—'}
                        {future && formatDateTime(e.availableAt) && (
                          <span className="ml-1 font-semibold text-warning-fg">, disponible le {formatDateTime(e.availableAt)}</span>
                        )}
                      </p>
                    </div>
                  </div>
                  <span className={cn('whitespace-nowrap text-sm font-bold tabular-nums', credit ? 'text-success-fg' : 'text-fg')}>
                    {formatSigned(e.amount)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

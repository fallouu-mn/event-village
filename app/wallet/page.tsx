'use client';

/**
 * Portefeuille de parrainage (lot 3.6) : compte PARRAINAGE du grand livre.
 *  - solde disponible au retrait, commissions en attente (avec leur date de disponibilité),
 *    retraits en cours, créance éventuelle, historique et retraits : GET /api/finance/balance ;
 *  - lien de parrainage, taux et filleuls : GET /api/referrals/my-stats (aucun solde lu là) ;
 *  - retrait : Wave ou Orange Money, numéro, montant, code SMS (POST /api/withdrawals/otp), puis
 *    POST /api/withdrawals/request (Idempotency-Key). Frais et seuil viennent de la réponse serveur.
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
import { Button } from '@/components/ui/Button';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { useAuth } from '@/components/providers/AuthProvider';
import {
  OPERATOR_VISUALS,
  formatFcfa,
  formatLocalPhone,
  isUncertainOutcome,
  operatorLabel,
  readAmount,
  readJsonBody,
  serverErrorMessage,
  useIdempotencyKey,
} from '@/components/payment/PaymentModal';
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
          status: text(w.status) ?? 'PENDING',
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

const WITHDRAWAL_STATUS: Record<string, { label: string; className: string }> = {
  PENDING: { label: 'En attente', className: 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300' },
  PROCESSING: { label: 'En cours', className: 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300' },
  PAID: { label: 'Versé', className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300' },
  REJECTED: { label: 'Refusé, montant rendu', className: 'bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300' },
  CANCELLED: { label: 'Annulé', className: 'bg-slate-100 text-slate-700 dark:bg-zinc-800 dark:text-zinc-300' },
};

const COMMISSION_STATUS: Record<string, string> = {
  PENDING: 'En attente',
  AVAILABLE: 'Disponible',
  PAID: 'Versée',
  CANCELLED: 'Annulée',
};

function withdrawalStatus(status: string) {
  return WITHDRAWAL_STATUS[status] ?? { label: status, className: 'bg-slate-100 text-slate-700 dark:bg-zinc-800 dark:text-zinc-300' };
}

function formatDateTime(iso: string | null): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString('fr-FR', {
    day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Dakar',
  });
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
      toast.success('Lien de parrainage copié !');
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
    if (amountValue === null || amountValue <= 0) next.amount = 'Indiquez un montant entier en FCFA.';
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
    `w-full h-12 px-4 rounded-xl bg-slate-50 dark:bg-zinc-900 border text-base font-bold text-slate-900 dark:text-white placeholder:text-slate-300 dark:placeholder:text-zinc-600 focus:outline-none focus:ring-2 transition-colors ${
      invalid
        ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20'
        : 'border-slate-200 dark:border-zinc-800 focus:border-[#FF5722] focus:ring-[#FF5722]/20'
    }`;

  return (
    <div className="space-y-8 pb-20">
      {/* 1. En-tête */}
      <div className="border-b border-slate-200 dark:border-zinc-800 pb-5">
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
          <Wallet className="text-[#FF5722]" size={28} aria-hidden="true" />
          <span>Portefeuille de parrainage</span>
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-zinc-400 mt-1">
          Vos commissions N1 / N2 deviennent disponibles après leur délai de validation ; retirez-les par Wave ou Orange Money.
        </p>
      </div>

      {/* 2. Soldes */}
      {loadError && !account ? (
        <ErrorState title="Solde indisponible" description={loadError} onRetry={() => void loadAccount()} />
      ) : !account || !balance ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3" aria-busy="true">
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
            <div role="alert" className="p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 flex items-center gap-2 text-xs text-red-700 dark:text-red-300">
              <AlertCircle className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
              {loadError}
            </div>
          )}
          <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-orange-500 via-[#FF5722] to-amber-600 text-white shadow-xl space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs uppercase font-bold tracking-wider text-orange-50">Disponible au retrait</span>
              {referral && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white/20 border border-white/30 text-[11px] font-bold">
                  <Award size={13} aria-hidden="true" /> {referral.isAmbassador ? 'Ambassadeur' : 'Client standard'}
                </span>
              )}
            </div>
            <p className="text-3xl sm:text-4xl font-black tracking-tight tabular-nums">{formatFcfa(balance.withdrawable)}</p>
            <p className="text-xs text-orange-50 font-medium">Commissions validées, retirables dès maintenant.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-[#1E1E1E] space-y-1">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
                <Hourglass className="w-3.5 h-3.5 text-amber-500" aria-hidden="true" /> En attente
              </div>
              <div className="text-lg font-black text-slate-900 dark:text-white tabular-nums">{formatFcfa(balance.pending)}</div>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400 leading-relaxed">
                {balance.pending > 0 && formatDateTime(balance.nextAvailableAt)
                  ? `Prochaine disponibilité : ${formatDateTime(balance.nextAvailableAt)}.`
                  : 'Chaque commission devient disponible après son délai de validation.'}
              </p>
            </div>
            <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-[#1E1E1E] space-y-1">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
                <Send className="w-3.5 h-3.5 text-[#FF5722]" aria-hidden="true" /> Retraits en cours
              </div>
              <div className="text-lg font-black text-slate-900 dark:text-white tabular-nums">{formatFcfa(balance.inProgress)}</div>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400 leading-relaxed">Montant réservé pendant l’envoi vers Wave ou Orange Money.</p>
            </div>
            <div className="p-4 rounded-2xl border border-slate-200/80 dark:border-zinc-800 bg-white dark:bg-[#1E1E1E] space-y-1">
              <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" aria-hidden="true" /> Créance
              </div>
              <div className="text-lg font-black text-slate-900 dark:text-white tabular-nums">{formatFcfa(balance.debt)}</div>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400 leading-relaxed">
                {balance.debt > 0 ? 'Commission déjà versée sur un achat remboursé : déduite de vos prochains gains.' : 'Aucune somme à compenser.'}
              </p>
            </div>
          </div>
        </section>
      )}

      {/* 3. Retrait */}
      <section
        aria-labelledby={`${fieldId}-retrait`}
        className="p-5 sm:p-6 rounded-3xl bg-white dark:bg-[#1E1E1E] border border-slate-200/80 dark:border-zinc-800 shadow-xs space-y-5"
      >
        <div>
          <h2 id={`${fieldId}-retrait`} className="text-base font-black text-slate-900 dark:text-white flex items-center gap-2">
            <Send className="w-4 h-4 text-[#FF5722]" aria-hidden="true" />
            Retirer mes commissions
          </h2>
          <p className="text-[11px] text-slate-500 dark:text-zinc-400 mt-0.5">
            Wave ou Orange Money. Montant minimum et frais de retrait appliqués par Event Village à la demande, puis affichés ici.
          </p>
        </div>

        <ol className="flex items-center gap-2 text-[11px] font-bold" aria-label="Étapes du retrait">
          {(['form', 'otp', 'done'] as const).map((s, i) => {
            const labels = { form: 'Demande', otp: 'Code SMS', done: 'Suivi' };
            const reached = ['form', 'otp', 'done'].indexOf(step) >= i;
            return (
              <li key={s} className="flex items-center gap-2" aria-current={step === s ? 'step' : undefined}>
                <span
                  className={`w-6 h-6 rounded-full flex items-center justify-center ${
                    reached ? 'bg-[#FF5722] text-white' : 'bg-slate-100 text-slate-400 dark:bg-zinc-800 dark:text-zinc-500'
                  }`}
                  aria-hidden="true"
                >
                  {i + 1}
                </span>
                <span className={reached ? 'text-slate-900 dark:text-white' : 'text-slate-400 dark:text-zinc-500'}>{labels[s]}</span>
                {i < 2 && <span className="w-6 h-px bg-slate-200 dark:bg-zinc-700" aria-hidden="true" />}
              </li>
            );
          })}
        </ol>

        {flowError && (
          <div role="alert" className="flex items-start gap-2.5 p-3.5 rounded-2xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40">
            <AlertCircle size={16} className="text-red-500 flex-shrink-0 mt-0.5" aria-hidden="true" />
            <p className="text-xs text-red-700 dark:text-red-300 leading-relaxed">{flowError}</p>
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
              <legend className="text-xs font-bold text-slate-700 dark:text-zinc-300 mb-2">
                Recevoir sur <span className="text-[#FF5722]" aria-hidden="true">*</span>
              </legend>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
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
                        className={`flex items-center gap-3 min-h-[56px] p-3 rounded-2xl border-2 transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-[#FF5722] peer-focus-visible:ring-offset-2 dark:peer-focus-visible:ring-offset-[#1E1E1E] ${
                          selected
                            ? 'border-[#FF5722] bg-[#FF5722]/5 dark:bg-[#FF5722]/10'
                            : errors.operator
                            ? 'border-red-300 dark:border-red-900/60'
                            : 'border-slate-200 dark:border-zinc-800 hover:border-slate-300 dark:hover:border-zinc-700'
                        }`}
                      >
                        <span aria-hidden="true" className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-black shrink-0 ${visual.tile}`}>
                          {visual.mark}
                        </span>
                        <span className="text-sm font-bold text-slate-900 dark:text-white">{operatorLabel(op)}</span>
                      </span>
                    </label>
                  );
                })}
              </div>
              {errors.operator && (
                <p id={ids.operatorError} className="mt-1.5 text-[11px] font-medium text-red-600 dark:text-red-400">{errors.operator}</p>
              )}
            </fieldset>

            <div>
              <label htmlFor={ids.phone} className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1.5">
                Numéro {operator ? operatorLabel(operator) : 'Mobile Money'} qui reçoit le retrait <span className="text-[#FF5722]" aria-hidden="true">*</span>
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
                className={`${inputClass(Boolean(errors.phone))} font-mono tracking-wide`}
              />
              <p id={ids.phoneHelp} className={`mt-1.5 text-[11px] leading-relaxed ${errors.phone ? 'font-medium text-red-600 dark:text-red-400' : 'text-slate-500 dark:text-zinc-400'}`}>
                {errors.phone ?? 'Mobile sénégalais de 9 chiffres. Le code de confirmation part au numéro de votre compte.'}
              </p>
            </div>

            <div>
              <label htmlFor={ids.amount} className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1.5">
                Montant à retirer (FCFA) <span className="text-[#FF5722]" aria-hidden="true">*</span>
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
                className={`${inputClass(Boolean(errors.amount))} tabular-nums`}
              />
              <p id={ids.amountHelp} className={`mt-1.5 text-[11px] leading-relaxed ${errors.amount ? 'font-medium text-red-600 dark:text-red-400' : 'text-slate-500 dark:text-zinc-400'}`}>
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
              leftIcon={<KeyRound className="w-4 h-4" aria-hidden="true" />}
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
            <dl className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-900/80 border border-slate-200/80 dark:border-zinc-800 space-y-2 text-xs">
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500 dark:text-zinc-400">Montant demandé</dt>
                <dd className="font-black text-slate-900 dark:text-white tabular-nums">{formatFcfa(amountValue)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500 dark:text-zinc-400">Vers</dt>
                <dd className="font-bold text-slate-900 dark:text-white">
                  {operatorLabel(operator)} · <span className="font-mono">+221 {formatLocalPhone(payoutPhone)}</span>
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-slate-500 dark:text-zinc-400">Frais de retrait</dt>
                <dd className="font-bold text-slate-600 dark:text-zinc-300">Calculés à la confirmation</dd>
              </div>
            </dl>

            <div>
              <label htmlFor={ids.otp} className="block text-xs font-bold text-slate-700 dark:text-zinc-300 mb-1.5">
                Code de confirmation <span className="text-[#FF5722]" aria-hidden="true">*</span>
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
                className={`${inputClass(Boolean(errors.otp))} font-mono text-center text-xl tracking-[0.5em]`}
              />
              <p id={ids.otpHelp} className={`mt-1.5 text-[11px] leading-relaxed ${errors.otp ? 'font-medium text-red-600 dark:text-red-400' : 'text-slate-500 dark:text-zinc-400'}`}>
                {errors.otp ?? `Code à 6 chiffres envoyé par SMS au ${accountPhone ? `+221 ${maskPhone(accountPhone)}` : 'numéro de votre compte'}.`}
              </p>
            </div>

            <Button type="submit" variant="primary" fullWidth size="lg" isLoading={isSubmitting} leftIcon={<CheckCircle2 className="w-4 h-4" aria-hidden="true" />}>
              {isSubmitting ? 'Demande en cours…' : 'Confirmer le retrait'}
            </Button>
            <div className="flex flex-col sm:flex-row gap-2">
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
              className={`flex items-start gap-3 p-4 rounded-2xl border ${
                result.status === 'REJECTED'
                  ? 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900/40'
                  : result.status === 'PAID'
                  ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/40'
                  : 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900/40'
              }`}
            >
              {result.status === 'REJECTED' ? (
                <XCircle className="w-5 h-5 text-red-500 shrink-0" aria-hidden="true" />
              ) : result.status === 'PAID' ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" aria-hidden="true" />
              ) : (
                <Hourglass className="w-5 h-5 text-amber-500 shrink-0" aria-hidden="true" />
              )}
              <div className="space-y-1">
                <p className="text-sm font-black text-slate-900 dark:text-white">
                  {result.status === 'PAID' ? 'Retrait versé' : result.status === 'REJECTED' ? 'Retrait refusé par l’opérateur' : 'Retrait en cours de traitement'}
                </p>
                <p className="text-xs text-slate-600 dark:text-zinc-400 leading-relaxed">
                  {result.status === 'PAID'
                    ? 'Le montant net a été envoyé sur votre compte Mobile Money.'
                    : result.status === 'REJECTED'
                    ? 'Le montant a été rendu à votre solde disponible. Vérifiez le numéro puis refaites une demande.'
                    : 'Le montant reste réservé jusqu’à la confirmation de l’opérateur. Il ne sera jamais versé deux fois ; suivez son état ci-dessous.'}
                </p>
              </div>
            </div>
            <dl className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-900/80 border border-slate-200/80 dark:border-zinc-800 space-y-2 text-xs">
              {result.gross !== null && (
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500 dark:text-zinc-400">Montant demandé</dt>
                  <dd className="font-bold text-slate-900 dark:text-white tabular-nums">{formatFcfa(result.gross)}</dd>
                </div>
              )}
              {result.fee !== null && (
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500 dark:text-zinc-400">Frais de retrait</dt>
                  <dd className="font-bold text-slate-900 dark:text-white tabular-nums">{formatFcfa(result.fee)}</dd>
                </div>
              )}
              {result.net !== null && (
                <div className="flex justify-between gap-3 pt-2 border-t border-slate-200 dark:border-zinc-800">
                  <dt className="font-bold text-slate-700 dark:text-zinc-200">Montant versé</dt>
                  <dd className="font-black text-[#FF5722] tabular-nums">{formatFcfa(result.net)}</dd>
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
      <section aria-labelledby={`${fieldId}-lien`} className="p-6 rounded-3xl bg-white dark:bg-[#1E1E1E] border border-slate-200/80 dark:border-zinc-800 shadow-xs space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-orange-50 dark:bg-orange-950/40 text-[#FF5722] flex items-center justify-center" aria-hidden="true">
            <Gift size={20} />
          </div>
          <div>
            <h2 id={`${fieldId}-lien`} className="text-base font-black text-slate-900 dark:text-white">Votre lien de parrainage</h2>
            <p className="text-xs text-slate-500 dark:text-zinc-400">
              Partagez ce lien : vous touchez une commission sur les achats en ligne de vos filleuls.
            </p>
          </div>
        </div>

        {referralError && !referral ? (
          <div role="alert" className="p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 flex flex-wrap items-center gap-2 text-xs text-red-700 dark:text-red-300">
            <AlertCircle className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
            <span className="flex-1">{referralError}</span>
            <Button variant="secondary" size="sm" onClick={() => void loadReferral()}>Réessayer</Button>
          </div>
        ) : !referral ? (
          <Skeleton className="h-12 rounded-xl" />
        ) : (
          <>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
              <div className="flex-1 w-full min-h-[48px] px-4 py-3 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 flex items-center font-mono text-xs text-slate-800 dark:text-zinc-200 select-all break-all">
                {referral.referralLink}
              </div>
              <Button variant="primary" size="md" onClick={() => void handleCopyLink()} leftIcon={copied ? <Check size={16} aria-hidden="true" /> : <Copy size={16} aria-hidden="true" />}>
                {copied ? 'Lien copié !' : 'Copier mon lien'}
              </Button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-900/80 border border-slate-200/80 dark:border-zinc-800">
                <span className="text-[11px] uppercase font-bold text-slate-500 dark:text-zinc-400 block">Génération 1 (filleuls directs)</span>
                <div className="flex items-baseline justify-between mt-1 gap-2">
                  <span className="text-xl font-black text-[#FF5722] tabular-nums">{referral.rates.level1.toLocaleString('fr-FR')} %</span>
                  <span className="text-xs font-bold text-slate-500 dark:text-zinc-400">{referral.network.level1Count} filleul(s)</span>
                </div>
              </div>
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-zinc-900/80 border border-slate-200/80 dark:border-zinc-800">
                <span className="text-[11px] uppercase font-bold text-slate-500 dark:text-zinc-400 block">Génération 2 (sous-filleuls)</span>
                <div className="flex items-baseline justify-between mt-1 gap-2">
                  <span className="text-xl font-black text-amber-600 dark:text-amber-400 tabular-nums">{referral.rates.level2.toLocaleString('fr-FR')} %</span>
                  <span className="text-xs font-bold text-slate-500 dark:text-zinc-400">{referral.network.level2Count} filleul(s)</span>
                </div>
              </div>
            </div>
            {referral.recentCommissions.length > 0 && (
              <div className="space-y-2">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">Dernières commissions</h3>
                <ul className="space-y-2">
                  {referral.recentCommissions.map((comm) => (
                    <li key={comm.id} className="p-3 rounded-2xl bg-slate-50 dark:bg-zinc-900/80 border border-slate-200/80 dark:border-zinc-800 flex items-center justify-between gap-3 text-xs">
                      <div className="flex items-center gap-3 min-w-0">
                        <span
                          aria-hidden="true"
                          className={`w-8 h-8 rounded-xl flex items-center justify-center font-black shrink-0 ${
                            comm.generation === 'N1' ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                          }`}
                        >
                          {comm.generation}
                        </span>
                        <div className="min-w-0">
                          <span className="font-bold text-slate-900 dark:text-white block">
                            Commission {comm.generation} · {COMMISSION_STATUS[comm.status] ?? comm.status}
                          </span>
                          <span className="text-[11px] text-slate-500 dark:text-zinc-400">{formatDateTime(comm.createdAt) ?? '—'}</span>
                        </div>
                      </div>
                      <span className="font-black text-emerald-600 dark:text-emerald-400 text-sm tabular-nums whitespace-nowrap">+ {formatFcfa(comm.amount)}</span>
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
        <h2 id={`${fieldId}-retraits`} className="text-sm font-black text-slate-900 dark:text-white">Mes retraits</h2>
        {!account ? (
          isLoading ? <Skeleton className="h-20 rounded-2xl" /> : null
        ) : account.withdrawals.length === 0 ? (
          <EmptyState title="Aucun retrait" description="Vous n’avez pas encore retiré de commissions." icon={<Wallet size={28} aria-hidden="true" />} />
        ) : (
          <ul className="rounded-2xl bg-white dark:bg-[#1E1E1E] border border-slate-200/80 dark:border-zinc-800 divide-y divide-slate-100 dark:divide-zinc-800">
            {account.withdrawals.map((w) => {
              const st = withdrawalStatus(w.status);
              return (
                <li key={w.id} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="space-y-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wide ${st.className}`}>{st.label}</span>
                      <span className="text-[11px] text-slate-500 dark:text-zinc-400">
                        {w.operator === 'WAVE' || w.operator === 'ORANGE_MONEY' ? operatorLabel(w.operator) : 'Mobile Money'}
                        {w.phone && <span className="font-mono"> · {maskPhone(w.phone)}</span>}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 dark:text-zinc-500">
                      Demandé le {formatDateTime(w.createdAt) ?? '—'}
                      {w.processedAt && formatDateTime(w.processedAt) && ` · traité le ${formatDateTime(w.processedAt)}`}
                    </div>
                    {w.status === 'REJECTED' && w.rejectionReason && <div className="text-[11px] text-red-600 dark:text-red-400">{w.rejectionReason}</div>}
                  </div>
                  <div className="sm:text-right shrink-0">
                    <div className="text-sm font-black text-slate-900 dark:text-white tabular-nums">{formatFcfa(w.gross)}</div>
                    <div className="text-[11px] text-slate-500 dark:text-zinc-400 tabular-nums">
                      Versé : {formatFcfa(w.net)} · frais : {formatFcfa(w.fee)}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* 6. Historique */}
      <section aria-labelledby={`${fieldId}-historique`} className="space-y-3">
        <h2 id={`${fieldId}-historique`} className="text-sm font-black text-slate-900 dark:text-white">Historique du compte</h2>
        {!account ? (
          isLoading ? <Skeleton className="h-28 rounded-2xl" /> : null
        ) : account.history.length === 0 ? (
          <EmptyState
            title="Aucune opération"
            description="Partagez votre lien : les commissions de vos filleuls apparaîtront ici."
            icon={<CalendarClock size={28} aria-hidden="true" />}
          />
        ) : (
          <ul className="rounded-2xl bg-white dark:bg-[#1E1E1E] border border-slate-200/80 dark:border-zinc-800 divide-y divide-slate-100 dark:divide-zinc-800">
            {account.history.map((e) => {
              const credit = e.amount > 0;
              const future = credit && isFuture(e.availableAt);
              return (
                <li key={e.id} className="px-4 py-3 flex items-center justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <span
                      aria-hidden="true"
                      className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                        credit ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400' : 'bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-300'
                      }`}
                    >
                      {credit ? <ArrowDownLeft className="w-4 h-4" /> : <ArrowUpRight className="w-4 h-4" />}
                    </span>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-900 dark:text-white">{ENTRY_LABELS[e.entryType] ?? e.entryType}</div>
                      {e.description && <div className="text-[11px] text-slate-500 dark:text-zinc-400 truncate">{e.description}</div>}
                      <div className="text-[11px] text-slate-400 dark:text-zinc-500">
                        {formatDateTime(e.createdAt) ?? '—'}
                        {future && formatDateTime(e.availableAt) && (
                          <span className="ml-1 font-bold text-amber-600 dark:text-amber-400">· disponible le {formatDateTime(e.availableAt)}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <span className={`text-sm font-black tabular-nums whitespace-nowrap ${credit ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-white'}`}>
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

'use client';

/**
 * Finances du partenaire (lot 3.6, migré au lot 7, tâche 7.4) : compte ORGANISATEUR du grand livre.
 *  - solde disponible au retrait, montant en attente et sa date de disponibilité, retraits en cours, créance,
 *    50 dernières écritures et 20 derniers retraits : tout vient de GET /api/finance/balance ; aucun montant
 *    n'est recalculé ici, et l'état de chaque ligne est servi (is_pending des écritures, à l'horloge du
 *    serveur ; effective_status des retraits, statut corrigé par l'issue de l'envoi) ;
 *  - retrait : Wave ou Orange Money, numéro, montant, code de confirmation envoyé au téléphone du compte
 *    (POST /api/withdrawals/otp, saisi par OtpInput), puis demande (POST /api/withdrawals/request, en-tête
 *    Idempotency-Key). Frais et seuil sont appliqués par le serveur et affichés depuis sa réponse.
 * Lot 9 bis (R62, B27, contrat 5.10) : minimum, taux et net sont dits AVANT le bouton du code, à partir du minimum et
 * du taux servis par GET /api/finance/balance (withdrawal_min_amount, withdrawal_fee_rate) ; sous le minimum, le
 * bouton est désactivé. Le corps du code porte `amount` : le serveur refait le devis avant tout SMS, et le devis
 * de sa réponse (`quote`) remplace l'estimation à l'étape du code.
 * Lot 9 bis (R4, B14, contrat 5.2) : `frozen` servi par le serveur ; s'il est positif, ligne « Fonds gelés : … » sous
 * le disponible (le gel est déjà retiré de `withdrawable`).
 */

import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import {
    ArrowDownLeft,
    ArrowUpRight,
    BarChart3,
    CalendarClock,
    CheckCircle2,
    Hourglass,
    KeyRound,
    RefreshCw,
    Send,
    ShieldCheck,
    Wallet,
    XCircle,
} from 'lucide-react';
import { useAuth } from '@/components/providers/AuthProvider';
import { OtpInput } from '@/components/auth/OtpInput';
import { Badge, type BadgeVariant } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { EmptyState, ErrorState } from '@/components/ui/EmptyState';
import { KpiCard } from '@/components/ui/KpiCard';
import { LinkButton } from '@/components/ui/LinkButton';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { TextInput } from '@/components/ui/Field';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { cn } from '@/components/ui/cn';
import {
    OPERATOR_VISUALS,
    formatLocalPhone,
    isUncertainOutcome,
    operatorLabel,
    readAmount,
    readJsonBody,
    serverErrorMessage,
    useIdempotencyKey,
} from '@/components/payment/PaymentModal';
import { formatDateTime, formatFcfa, formatPercent } from '@/lib/format';
import { maskPhone, normalizePayerPhone } from '@/lib/payments/payer-phone';
import { SAMIRPAY_OPERATORS, type SamirPayOperatorName } from '@/lib/samirpay/types';

const ACCOUNT = 'ORGANISATEUR';

/* ──────────────────────────────── Types ──────────────────────────────── */

interface Balance {
    available: number;
    pending: number;
    nextAvailableAt: string | null;
    inProgress: number;
    debt: number;
    withdrawable: number;
    /** Lot 9 bis (R4, B14) : net échu des événements suspendus, calculé par le serveur, non retirable. */
    frozen: number;
    /** Réglage finance.withdrawal_min_amount, servi par le serveur (F CFA). */
    minimum: number;
    /** Réglage finance.withdrawal_fee_rate, servi par le serveur (en %). */
    feeRate: number;
}

/** Devis d'un retrait : estimation avant le code, puis devis du serveur (réponse de POST /api/withdrawals/otp). */
interface Quote {
    fee: number;
    net: number;
}

interface HistoryEntry {
    id: string;
    entryType: string;
    amount: number;
    availableAt: string | null;
    createdAt: string;
    description: string | null;
    /** Titre de l'événement de l'écriture, servi par le serveur (event_title), ou null. */
    eventTitle: string | null;
    /** Servi par le serveur (available_at après son horloge). */
    isPending: boolean;
}

interface WithdrawalRow {
    id: string;
    gross: number;
    fee: number;
    net: number;
    /** Statut à afficher, servi par le serveur (effective_status). */
    effectiveStatus: string;
    /** Lot 9 bis (B9) : envoi retardé, décidé par le serveur (withdrawalsOf, `delayed`). */
    delayed: boolean;
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
    withdrawalId: string | null;
    status: string;
    gross: number | null;
    fee: number | null;
    net: number | null;
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
    const minimum = readAmount(body.withdrawal_min_amount);
    const feeRate = readAmount(body.withdrawal_fee_rate);
    const frozen = readAmount(body.frozen);
    if (available === null || pending === null || withdrawable === null || minimum === null || feeRate === null || frozen === null) return null;
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
                  eventTitle: text(e.event_title),
                  isPending: e.is_pending === true,
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
                  effectiveStatus: text(w.effective_status) ?? text(w.status) ?? 'PENDING',
                  delayed: w.delayed === true,
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
            frozen,
            minimum,
            feeRate,
        },
        history,
        withdrawals,
    };
}

/** Devis de la réponse de POST /api/withdrawals/otp (`quote.fee_amount`, `quote.net_amount`), ou null. */
function parseQuote(body: unknown): Quote | null {
    if (!isRecord(body) || !isRecord(body.quote)) return null;
    const fee = readAmount(body.quote.fee_amount);
    const net = readAmount(body.quote.net_amount);
    return fee === null || net === null ? null : { fee, net };
}

/**
 * Estimation affichée avant le code (R62) : même règle que fin_withdrawal_check (M06), frais = montant × taux / 100
 * arrondi au franc supérieur, net = montant − frais. Calcul exact en entiers (le taux décimal est lu chiffre à
 * chiffre, jamais en flottant) ; null si le taux ne se lit pas. Le serveur refait le devis au code et le sien fait foi.
 */
function estimateQuote(amount: number, feeRatePercent: number): Quote | null {
    const rate = /^(\d+)(?:\.(\d{1,6}))?$/.exec(String(feeRatePercent));
    if (!rate || !Number.isSafeInteger(amount) || amount <= 0) return null;
    const decimals = rate[2] ?? '';
    const scale = 10 ** decimals.length;
    const product = amount * (Number(rate[1]) * scale + Number(decimals || '0'));
    if (!Number.isSafeInteger(product)) return null;
    const divisor = 100 * scale;
    const rest = product % divisor;
    const fee = (product - rest) / divisor + (rest > 0 ? 1 : 0);
    return fee < amount ? { fee, net: amount - fee } : null;
}

/**
 * Réponse de POST /api/withdrawals/request : le statut du retrait, corrigé par l'issue de l'envoi quand le
 * serveur ne l'a pas encore reporté sur le retrait (cashout_status de la réponse, route hors de cet écran).
 */
function parseResult(body: unknown): WithdrawalResult | null {
    if (!isRecord(body)) return null;
    const root = isRecord(body.withdrawal) ? body.withdrawal : body;
    const status = text(root.effective_status) ?? text(root.status);
    if (!status) return null;
    const cashout = text(root.cashout_status);
    const shown = status === 'PROCESSING' && cashout === 'CONFIRME' ? 'PAID' : status === 'PROCESSING' && cashout === 'ECHOUE' ? 'REJECTED' : status;
    return {
        withdrawalId: text(root.withdrawal_id) ?? text(root.id),
        status: shown,
        gross: readAmount(root.gross_amount),
        fee: readAmount(root.fee_amount),
        net: readAmount(root.net_amount),
    };
}

/* ─────────────────────────────── Affichage ─────────────────────────────── */

const ENTRY_LABELS: Record<string, string> = {
    VENTE: 'Vente en ligne',
    REMBOURSEMENT: 'Remboursement d’un billet',
    RETRAIT: 'Retrait demandé',
    RETRAIT_ANNULE: 'Retrait refusé : montant rendu',
    COMMISSION: 'Commission de parrainage',
    COMMISSION_ANNULEE: 'Commission annulée',
    REGULARISATION: 'Régularisation',
    COMPENSATION_CREANCE: 'Compensation d’une créance',
};

/**
 * Écritures dont le libellé comptable (finance_ledger.description) est interne : il porte une référence de
 * transaction et un code technique (« Vente en ligne … (TICKET) », « Remboursement REFUND-… (EVENT_CANCELLATION_REFUND) »).
 * La compensation d'une créance recopie le motif de la créance, c'est-à-dire ce même libellé de remboursement
 * (« Compensation de créance : Remboursement REFUND-… (…) », fin_ledger_debit puis trigger de compensation).
 * Il n'est jamais affiché ; l'écran nomme l'événement à la place.
 */
const INTERNAL_DESCRIPTION_TYPES = new Set(['VENTE', 'REMBOURSEMENT', 'COMPENSATION_CREANCE']);

/**
 * Ligne de détail d'une écriture : pour une écriture au libellé interne, l'événement s'il est connu, sinon rien ;
 * pour les autres (retraits, commissions), le libellé rédigé pour le lecteur, sinon l'événement.
 */
function entryDetail(e: HistoryEntry): string | null {
    const event = e.eventTitle ? `« ${e.eventTitle} »` : null;
    if (INTERNAL_DESCRIPTION_TYPES.has(e.entryType)) return event;
    return e.description ?? event;
}

const WITHDRAWAL_STATUS: Record<string, { label: string; variant: BadgeVariant }> = {
    PENDING: { label: 'En attente', variant: 'warning' },
    PROCESSING: { label: 'En cours d’envoi', variant: 'warning' },
    PAID: { label: 'Versé', variant: 'success' },
    REJECTED: { label: 'Refusé, montant rendu', variant: 'danger' },
    CANCELLED: { label: 'Annulé', variant: 'neutral' },
};

/** Lot 9 bis (B9) : retrait retardé, état honnête dit à la partenaire (texte du contrat). */
const WITHDRAWAL_DELAYED = { label: 'Retardé', variant: 'warning' as BadgeVariant };
const WITHDRAWAL_DELAYED_TEXT = 'Retardé : l’équipe Event Village s’en occupe.';

function withdrawalStatus(status: string) {
    return WITHDRAWAL_STATUS[status] ?? { label: 'Statut inconnu', variant: 'neutral' as BadgeVariant };
}

function formatSigned(amount: number): string {
    return amount < 0 ? `− ${formatFcfa(-amount)}` : `+ ${formatFcfa(amount)}`;
}

/** Erreur de retrait : rattachée au champ concerné quand le code serveur le permet. */
function fieldForCode(code: string | null): keyof FieldErrors | null {
    if (!code) return null;
    if (code.includes('OTP')) return 'otp';
    if (['BELOW_MINIMUM', 'INVALID_AMOUNT', 'INSUFFICIENT_BALANCE', 'FUNDS_FROZEN'].includes(code)) return 'amount';
    if (code === 'INVALID_DESTINATION' || code === 'INVALID_PHONE') return 'phone';
    if (code === 'INVALID_OPERATOR') return 'operator';
    return null;
}

/** Taux de frais servi en % (1 → « 1 % », 1,5 → « 1,5 % »). */
function feeRateLabel(feeRatePercent: number): string {
    return formatPercent(feeRatePercent / 100, 2);
}

const STEPS: Array<{ key: Step; label: string }> = [
    { key: 'form', label: 'Demande' },
    { key: 'otp', label: 'Code SMS' },
    { key: 'done', label: 'Suivi' },
];

/* ──────────────────────────────── Page ──────────────────────────────── */

export default function PartnerFinancePage() {
    const { profile } = useAuth();
    const toast = useToast();
    const attempt = useIdempotencyKey();
    const fieldId = useId();
    const ids = {
        otpLabel: `${fieldId}-otp-label`,
        otpHelp: `${fieldId}-otp-help`,
        operatorError: `${fieldId}-operator-error`,
        quote: `${fieldId}-devis`,
    };

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
    const [serverQuote, setServerQuote] = useState<Quote | null>(null);

    const prefillDone = useRef(false);
    const resultRef = useRef<HTMLDivElement | null>(null);

    const payoutPhone = normalizePayerPhone(phoneInput);
    const accountPhone = normalizePayerPhone(profile?.phone);
    const amountValue = /^\d+$/.test(amountInput.trim()) ? Number(amountInput.trim()) : null;
    const balance = account?.balance ?? null;
    const stepIndex = STEPS.findIndex((s) => s.key === step);
    const belowMinimum = balance !== null && amountValue !== null && amountValue > 0 && amountValue < balance.minimum;
    const estimate = balance && amountValue !== null && !belowMinimum ? estimateQuote(amountValue, balance.feeRate) : null;

    const loadAccount = useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await fetch(`/api/finance/balance?account=${ACCOUNT}`, { cache: 'no-store' });
            const body = await readJsonBody(res, 'finance partenaire');
            if (!res.ok) {
                setLoadError(serverErrorMessage(body) ?? `Le solde n’a pas pu être chargé (erreur ${res.status}).`);
                return;
            }
            const view = parseAccount(body);
            if (!view) {
                console.error('[finance partenaire] réponse de solde inattendue :', body);
                setLoadError('Réponse inattendue du serveur : le solde n’a pas pu être affiché.');
                return;
            }
            setAccount(view);
            setLoadError(null);
        } catch (err) {
            console.error('[finance partenaire] chargement du solde impossible :', err);
            setLoadError('Connexion impossible : vérifiez votre réseau puis réessayez.');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadAccount();
    }, [loadAccount]);

    // Numéro de retrait prérempli une seule fois avec celui du compte (modifiable).
    useEffect(() => {
        if (prefillDone.current || !accountPhone) return;
        prefillDone.current = true;
        setPhoneInput(formatLocalPhone(accountPhone));
    }, [accountPhone]);

    useEffect(() => {
        if (step === 'done') resultRef.current?.focus();
    }, [step]);

    const validate = (): boolean => {
        const next: FieldErrors = {};
        if (!operator) next.operator = 'Choisissez Wave ou Orange Money.';
        if (!payoutPhone) next.phone = 'Numéro invalide : mobile sénégalais de 9 chiffres commençant par 70, 75, 76, 77 ou 78.';
        if (amountValue === null || amountValue <= 0) next.amount = 'Indiquez un montant entier en francs CFA.';
        else if (balance && amountValue < balance.minimum) next.amount = `Le minimum de retrait est de ${formatFcfa(balance.minimum)}.`;
        else if (balance && amountValue > balance.withdrawable) {
            next.amount = `Le montant dépasse votre solde disponible au retrait (${formatFcfa(balance.withdrawable)}).`;
        }
        setErrors(next);
        return Object.keys(next).length === 0;
    };

    const requestCode = async () => {
        if (isSendingCode) return;
        setFlowError(null);
        if (!validate() || amountValue === null) return;
        setIsSendingCode(true);
        try {
            const res = await fetch('/api/withdrawals/otp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ account: ACCOUNT, amount: amountValue }),
            });
            const body = await readJsonBody(res, 'finance partenaire/code');
            if (!res.ok) {
                // Refus du devis (minimum, solde, gel, verrou de 24 h…) : aucun code n'est parti.
                const message = serverErrorMessage(body) ?? `Le code de confirmation n’a pas pu être envoyé (erreur ${res.status}).`;
                const field = fieldForCode(isRecord(body) ? text(body.code) : null);
                if (field === 'amount') {
                    setErrors({ amount: message });
                    setStep('form');
                } else {
                    setFlowError(message);
                }
                return;
            }
            const quote = parseQuote(body);
            if (!quote) console.error('[finance partenaire] devis absent de la réponse du code :', body);
            setServerQuote(quote);
            setOtpCode('');
            setErrors({});
            setStep('otp');
            toast.success('Code de confirmation envoyé par SMS.');
        } catch (err) {
            console.error('[finance partenaire] envoi du code impossible :', err);
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
            const body = await readJsonBody(res, 'finance partenaire/retrait');
            if (!res.ok) {
                if (!isUncertainOutcome(res.status)) attempt.reset();
                const message = serverErrorMessage(body) ?? `Le retrait n’a pas pu être demandé (erreur ${res.status}).`;
                const code = isRecord(body) ? text(body.code) : null;
                const field = fieldForCode(code);
                if (field === 'otp') {
                    setErrors({ otp: message });
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
                console.error('[finance partenaire] réponse de retrait inattendue :', body);
                setFlowError('Réponse inattendue du serveur. Actualisez la page : votre demande ne sera pas dupliquée.');
                return;
            }
            attempt.reset();
            setResult(parsed);
            setStep('done');
            void loadAccount();
        } catch (err) {
            // Sort incertain : la même clé sera réutilisée, la demande ne sera pas dupliquée.
            console.error('[finance partenaire] demande de retrait impossible :', err);
            setFlowError('Connexion interrompue : la demande n’a peut-être pas abouti. Réessayez, elle ne sera pas dupliquée.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const restart = () => {
        setStep('form');
        setResult(null);
        setServerQuote(null);
        setOtpCode('');
        setAmountInput('');
        setErrors({});
        setFlowError(null);
    };

    return (
        <div className="mx-auto max-w-4xl space-y-8 py-6 pb-24">
            <PageHeader
                title="Finances"
                description="Ventes en ligne de vos événements. Les ventes en espèces et les invitations n’alimentent pas ce solde."
                actions={
                    <>
                        <LinkButton href="/partner/stats" variant="ghost" size="sm" leftIcon={<BarChart3 size={16} />}>
                            Statistiques de ventes
                        </LinkButton>
                        <Button
                            variant="secondary"
                            size="sm"
                            leftIcon={<RefreshCw size={16} aria-hidden="true" />}
                            onClick={() => void loadAccount()}
                            isLoading={isLoading && account !== null}
                            disabled={isLoading}
                        >
                            Actualiser
                        </Button>
                    </>
                }
            />

            {/* Soldes */}
            {loadError && !account ? (
                <ErrorState title="Solde indisponible" description={loadError} onRetry={() => void loadAccount()} isRetrying={isLoading} />
            ) : (
                <section aria-labelledby={`${fieldId}-soldes`} className="space-y-3">
                    <h2 id={`${fieldId}-soldes`} className="sr-only">Soldes</h2>
                    {loadError && (
                        <StatusBanner tone="danger" announce="alert" title="Actualisation impossible">
                            {loadError} Les montants affichés sont ceux de la dernière lecture réussie.
                        </StatusBanner>
                    )}
                    {!balance ? (
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3" role="status" aria-busy="true">
                            <span className="sr-only">Chargement du solde…</span>
                            <Skeleton className="h-32 rounded-2xl sm:col-span-3" />
                            <Skeleton className="h-28 rounded-2xl" />
                            <Skeleton className="h-28 rounded-2xl" />
                            <Skeleton className="h-28 rounded-2xl" />
                        </div>
                    ) : (
                        <>
                            <div className="rounded-2xl border border-brand-fg bg-brand-bg p-5 sm:p-6">
                                <p className="text-sm font-semibold text-fg-muted">Disponible au retrait</p>
                                <p className="mt-1 text-3xl font-bold tabular-nums text-brand-fg sm:text-4xl">{formatFcfa(balance.withdrawable)}</p>
                                <p className="mt-1 text-sm text-fg-muted">Montant que vous pouvez retirer dès maintenant.</p>
                            </div>
                            {balance.frozen > 0 && (
                                <StatusBanner tone="suspended" title={<span className="tabular-nums">{`Fonds gelés : ${formatFcfa(balance.frozen)}.`}</span>}>
                                    Un de vos événements est suspendu : ses ventes ne sont pas retirables tant qu’il l’est.
                                </StatusBanner>
                            )}
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                                <KpiCard
                                    label="En attente"
                                    value={formatFcfa(balance.pending)}
                                    hint={balance.pending > 0 && balance.nextAvailableAt
                                        ? `Prochaine disponibilité : ${formatDateTime(balance.nextAvailableAt)}.`
                                        : 'Les ventes deviennent disponibles après la fin de l’événement et le délai de garde.'}
                                    tone="warning"
                                    icon={<Hourglass size={18} />}
                                />
                                <KpiCard
                                    label="Retraits en cours"
                                    value={formatFcfa(balance.inProgress)}
                                    hint="Montant réservé pendant l’envoi vers Wave ou Orange Money."
                                    tone="info"
                                    icon={<Send size={18} />}
                                />
                                <KpiCard
                                    label="À compenser"
                                    value={formatFcfa(balance.debt)}
                                    hint={balance.debt > 0 ? 'Remboursement à compenser : déduit de vos prochaines ventes.' : 'Aucune somme à compenser.'}
                                    tone={balance.debt > 0 ? 'danger' : 'success'}
                                    icon={<ShieldCheck size={18} />}
                                />
                            </div>
                        </>
                    )}
                </section>
            )}

            {/* Retrait */}
            <section aria-labelledby={`${fieldId}-retrait`} className="space-y-5 rounded-2xl border border-border bg-surface p-5 sm:p-6">
                <div>
                    <h2 id={`${fieldId}-retrait`} className="flex items-center gap-2 text-lg font-bold text-fg">
                        <Send size={18} className="text-brand-fg" aria-hidden="true" />
                        Demander un retrait
                    </h2>
                    <p className="mt-1 text-sm text-fg-muted">
                        Wave ou Orange Money. Le minimum, les frais et le montant que vous recevrez sont affichés avant l’envoi du code.
                    </p>
                </div>

                <ol className="flex flex-wrap items-center gap-2 text-sm font-semibold" aria-label="Étapes du retrait">
                    {STEPS.map((s, i) => {
                        const reached = stepIndex >= i;
                        return (
                            <li key={s.key} className="flex items-center gap-2" aria-current={step === s.key ? 'step' : undefined}>
                                <span
                                    className={cn('flex h-7 w-7 items-center justify-center rounded-full tabular-nums', reached ? 'bg-brand text-on-brand' : 'bg-surface-sunken text-fg-muted')}
                                    aria-hidden="true"
                                >
                                    {i + 1}
                                </span>
                                <span className={reached ? 'text-fg' : 'text-fg-muted'}>{s.label}</span>
                                {s.key !== 'done' && <span className="h-px w-6 bg-border" aria-hidden="true" />}
                            </li>
                        );
                    })}
                </ol>

                {flowError && (
                    <StatusBanner tone="danger" announce="alert" title="Retrait impossible">
                        {flowError}
                    </StatusBanner>
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
                                Recevoir sur <span className="text-danger-fg" aria-hidden="true">*</span>
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
                                                    'flex min-h-[56px] items-center gap-3 rounded-2xl border-2 p-3 transition-colors duration-200 peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-surface',
                                                    selected ? 'border-brand-fg bg-brand-bg' : errors.operator ? 'border-danger' : 'border-border hover:border-border-strong',
                                                )}
                                            >
                                                <span aria-hidden="true" className={cn('flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl text-sm font-bold', visual.tile)}>
                                                    {visual.mark}
                                                </span>
                                                <span className="text-base font-semibold text-fg">{operatorLabel(op)}</span>
                                                {selected && <CheckCircle2 size={18} className="ml-auto text-brand-fg" aria-hidden="true" />}
                                            </span>
                                        </label>
                                    );
                                })}
                            </div>
                            {errors.operator && (
                                <p id={ids.operatorError} className="mt-1.5 text-sm font-medium text-danger-fg">{errors.operator}</p>
                            )}
                        </fieldset>

                        <TextInput
                            label={`Numéro ${operator ? operatorLabel(operator) : 'Mobile Money'} qui reçoit le retrait`}
                            required
                            type="tel"
                            inputMode="tel"
                            autoComplete="tel-national"
                            placeholder="77 123 45 67"
                            value={phoneInput}
                            error={errors.phone}
                            hint="Mobile sénégalais de 9 chiffres. Le code de confirmation part au numéro de votre compte."
                            onChange={(e) => {
                                setPhoneInput(e.target.value);
                                setErrors((prev) => ({ ...prev, phone: undefined }));
                            }}
                            onBlur={() => {
                                if (payoutPhone) setPhoneInput(formatLocalPhone(payoutPhone));
                            }}
                            className="tabular-nums tracking-wide"
                        />

                        <TextInput
                            label="Montant à retirer (F CFA)"
                            required
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            autoComplete="off"
                            placeholder="Ex : 50000"
                            value={amountInput}
                            error={errors.amount}
                            hint={balance
                                ? `Disponible : ${formatFcfa(balance.withdrawable)}. Les frais sont déduits du montant versé.`
                                : 'Les frais sont déduits du montant versé.'}
                            onChange={(e) => {
                                setAmountInput(e.target.value.replace(/[^\d]/g, ''));
                                setErrors((prev) => ({ ...prev, amount: undefined }));
                            }}
                            className="tabular-nums"
                        />

                        {balance && (
                            <p
                                id={ids.quote}
                                aria-live="polite"
                                className={cn(
                                    'rounded-2xl border p-4 text-sm leading-relaxed tabular-nums',
                                    belowMinimum ? 'border-warning-border bg-warning-bg font-semibold text-warning-fg' : 'border-border bg-surface-sunken text-fg',
                                )}
                            >
                                {belowMinimum
                                    ? `Le minimum de retrait est de ${formatFcfa(balance.minimum)}.`
                                    : estimate
                                        ? `Minimum de retrait : ${formatFcfa(balance.minimum)}. Frais : ${feeRateLabel(balance.feeRate)} (${formatFcfa(estimate.fee)}). Vous recevrez ${formatFcfa(estimate.net)}.`
                                        : `Minimum de retrait : ${formatFcfa(balance.minimum)}. Frais : ${feeRateLabel(balance.feeRate)} du montant.`}
                            </p>
                        )}

                        <Button
                            type="submit"
                            variant="primary"
                            fullWidth
                            size="lg"
                            isLoading={isSendingCode}
                            disabled={!balance || balance.withdrawable <= 0 || belowMinimum}
                            aria-describedby={balance ? ids.quote : undefined}
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
                                    {operatorLabel(operator)} · <span className="tabular-nums">+221 {formatLocalPhone(payoutPhone)}</span>
                                </dd>
                            </div>
                            <div className="flex justify-between gap-3">
                                <dt className="text-fg-muted">Frais de retrait{balance ? ` (${feeRateLabel(balance.feeRate)})` : ''}</dt>
                                <dd className="font-semibold tabular-nums text-fg">{serverQuote ? formatFcfa(serverQuote.fee) : 'Calculés à la confirmation'}</dd>
                            </div>
                            {serverQuote && (
                                <div className="flex justify-between gap-3 border-t border-border pt-2">
                                    <dt className="font-semibold text-fg">Vous recevrez</dt>
                                    <dd className="font-bold tabular-nums text-brand-fg">{formatFcfa(serverQuote.net)}</dd>
                                </div>
                            )}
                        </dl>

                        <div className="space-y-2">
                            <p id={ids.otpLabel} className="text-sm font-semibold text-fg">
                                Code de confirmation <span className="text-danger-fg" aria-hidden="true">*</span>
                            </p>
                            <OtpInput
                                value={otpCode}
                                onChange={(v) => {
                                    setOtpCode(v);
                                    setErrors((prev) => ({ ...prev, otp: undefined }));
                                }}
                                disabled={isSubmitting}
                                hasError={Boolean(errors.otp)}
                                describedBy={`${ids.otpLabel} ${ids.otpHelp}`}
                            />
                            <p id={ids.otpHelp} className={cn('text-sm leading-relaxed', errors.otp ? 'font-medium text-danger-fg' : 'text-fg-muted')}>
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
                    <div ref={resultRef} tabIndex={-1} className="space-y-4 focus:outline-none">
                        <StatusBanner
                            tone={result.status === 'REJECTED' ? 'danger' : result.status === 'PAID' ? 'success' : 'warning'}
                            icon={result.status === 'REJECTED' ? <XCircle size={20} /> : result.status === 'PAID' ? <CheckCircle2 size={20} /> : <Hourglass size={20} />}
                            title={result.status === 'PAID'
                                ? 'Retrait versé'
                                : result.status === 'REJECTED'
                                    ? 'Retrait refusé par l’opérateur'
                                    : 'Retrait en cours de traitement'}
                        >
                            {result.status === 'PAID'
                                ? 'Le montant net a été envoyé sur votre compte Mobile Money.'
                                : result.status === 'REJECTED'
                                    ? 'Le montant a été rendu à votre solde disponible. Vérifiez le numéro puis refaites une demande.'
                                    : 'Le montant reste réservé jusqu’à la confirmation de l’opérateur. Il ne sera jamais versé deux fois ; suivez son état dans « Mes retraits ».'}
                        </StatusBanner>
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

            {/* Retraits */}
            <section aria-labelledby={`${fieldId}-retraits`} className="space-y-3">
                <div>
                    <h2 id={`${fieldId}-retraits`} className="text-lg font-bold text-fg">Mes retraits</h2>
                    <p className="text-sm text-fg-muted">Vos 20 dernières demandes.</p>
                </div>
                {!account ? (
                    loadError ? null : <Skeleton className="h-20 rounded-2xl" />
                ) : account.withdrawals.length === 0 ? (
                    <EmptyState title="Aucun retrait" description="Vous n’avez pas encore demandé de retrait." icon={<Wallet size={28} />} />
                ) : (
                    <ul className="divide-y divide-border rounded-2xl border border-border bg-surface">
                        {account.withdrawals.map((w) => {
                            const st = w.delayed ? WITHDRAWAL_DELAYED : withdrawalStatus(w.effectiveStatus);
                            return (
                                <li key={w.id} className="flex flex-col justify-between gap-2 px-4 py-3 sm:flex-row sm:items-center">
                                    <div className="min-w-0 space-y-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <Badge variant={st.variant} size="sm">{st.label}</Badge>
                                            <span className="text-sm text-fg-muted">
                                                {w.operator === 'WAVE' || w.operator === 'ORANGE_MONEY' ? operatorLabel(w.operator) : 'Mobile Money'}
                                                {w.phone && <span className="tabular-nums"> · {maskPhone(w.phone)}</span>}
                                            </span>
                                        </div>
                                        <p className="text-sm text-fg-muted">
                                            Demandé le <time dateTime={w.createdAt} className="text-sm">{formatDateTime(w.createdAt)}</time>
                                            {w.processedAt && (
                                                <> · traité le <time dateTime={w.processedAt} className="text-sm">{formatDateTime(w.processedAt)}</time></>
                                            )}
                                        </p>
                                        {w.delayed && <p className="text-sm text-warning-fg">{WITHDRAWAL_DELAYED_TEXT}</p>}
                                        {w.effectiveStatus === 'REJECTED' && w.rejectionReason && (
                                            <p className="text-sm text-danger-fg">Motif : {w.rejectionReason}</p>
                                        )}
                                    </div>
                                    <div className="flex-shrink-0 sm:text-right">
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

            {/* Historique */}
            <section aria-labelledby={`${fieldId}-historique`} className="space-y-3">
                <div>
                    <h2 id={`${fieldId}-historique`} className="text-lg font-bold text-fg">Historique du compte</h2>
                    <p className="text-sm text-fg-muted">Les 50 dernières écritures, de la plus récente à la plus ancienne.</p>
                </div>
                {!account ? (
                    loadError ? null : <Skeleton className="h-28 rounded-2xl" />
                ) : account.history.length === 0 ? (
                    <EmptyState
                        title="Aucune opération"
                        description="Vos ventes en ligne confirmées apparaîtront ici."
                        icon={<CalendarClock size={28} />}
                    />
                ) : (
                    <ul className="divide-y divide-border rounded-2xl border border-border bg-surface">
                        {account.history.map((e) => {
                            const credit = e.amount > 0;
                            const pendingCredit = credit && e.isPending;
                            const detail = entryDetail(e);
                            return (
                                <li key={e.id} className="flex items-center justify-between gap-3 px-4 py-3">
                                    <div className="flex min-w-0 items-start gap-3">
                                        <span
                                            aria-hidden="true"
                                            className={cn('flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl', credit ? 'bg-success-bg text-success-fg' : 'bg-surface-sunken text-fg')}
                                        >
                                            {credit ? <ArrowDownLeft size={16} /> : <ArrowUpRight size={16} />}
                                        </span>
                                        <div className="min-w-0">
                                            <p className="text-sm font-semibold text-fg">
                                                {ENTRY_LABELS[e.entryType] ?? 'Opération du compte'}
                                                <span className="sr-only">{credit ? ' (crédit)' : ' (débit)'}</span>
                                            </p>
                                            {detail && <p className="truncate text-sm text-fg-muted">{detail}</p>}
                                            <p className="text-sm text-fg-muted">
                                                <time dateTime={e.createdAt} className="text-sm">{formatDateTime(e.createdAt)}</time>
                                                {pendingCredit && e.availableAt && (
                                                    <span className="ml-1 font-semibold text-warning-fg">
                                                        · en attente, disponible le <time dateTime={e.availableAt} className="text-sm">{formatDateTime(e.availableAt)}</time>
                                                    </span>
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

'use client';

import React, { useEffect, useId, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Clock, Loader2, Timer } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { LinkButton } from '@/components/ui/LinkButton';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { cn } from '@/components/ui/cn';
import { useAuth } from '@/components/providers/AuthProvider';
import { OperatorLogo } from '@/components/payment/OperatorLogo';
import { PhoneVerifyDialog } from '@/components/tickets/PhoneVerifyDialog';
import { formatFcfa } from '@/lib/format';
import { normalizePayerPhone } from '@/lib/payments/payer-phone';
import { readPaymentPreference, savePaymentPreference } from '@/lib/device/device-prefs';
import {
    formatLocalPhone, isMobileDevice, isRecord, isUncertainOutcome, nonEmptyString, operatorLabel, paymentStatusPath,
    readJsonBody, readPaymentError, savePaymentHandoff, toSafeExternalUrl, useIdempotencyKey, type PaymentRequestError,
} from '@/lib/payments/payment-client';
import { SAMIRPAY_OPERATORS, type SamirPayOperatorName } from '@/lib/samirpay/types';

/**
 * Lot 12b — paiement d'une commande depuis son suivi : la première part (commande en attente de paiement, compte à
 * rebours jusqu'à la fin du délai) ou le solde (commande acceptée, avant la remise). Mêmes règles que le paiement d'une
 * table (components/event-tables/client/PayStep.tsx) : opérateur choisi explicitement, numéro du payeur prérempli par le
 * dernier paiement de ce téléphone puis le profil (enregistré quand le serveur accepte), clé d'idempotence gardée tant
 * que l'issue est incertaine, refus du serveur affichés tels quels, paiement déjà en attente → « Suivre le paiement »,
 * numéro du compte non vérifié → vérification par code.
 * Première part : le montant affiché (servi par la base) est envoyé pour comparaison (expectedAmount) ; s'il a changé, rien
 * n'est créé et la commande est relue. Solde : le montant exact (reste + frais de service) est calculé par la base et
 * affiché sur la page de paiement ; aucun montant n'est inventé ici.
 */

const NETWORK = 'Le serveur est injoignable. Vérifiez votre connexion puis réessayez : votre demande ne sera pas dupliquée.';
const PENDING_TEXT = 'Un paiement est déjà en attente pour cette commande : suivez-le avant d’en lancer un autre.';

function openOperatorLink(link: string): boolean {
    const url = toSafeExternalUrl(link);
    if (!url) return false;
    if (url.protocol === 'https:' || url.protocol === 'http:') {
        const win = window.open(url.href, '_blank');
        if (!win) return false;
        win.opener = null;
        return true;
    }
    window.location.href = url.href;
    return true;
}

/** « 12:34 » restant jusqu'à l'instant donné, ou null s'il est passé. */
function remaining(deadline: string | null, now: number): string | null {
    if (!deadline) return null;
    const ms = Date.parse(deadline) - now;
    if (!Number.isFinite(ms) || ms <= 0) return null;
    const total = Math.ceil(ms / 1000);
    return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

export function HoldCountdown({ deadline, onExpired }: { deadline: string | null; onExpired: () => void }) {
    const [now, setNow] = useState(() => Date.now());
    const fired = useRef(false);
    useEffect(() => {
        const t = window.setInterval(() => setNow(Date.now()), 1000);
        return () => window.clearInterval(t);
    }, []);
    const left = remaining(deadline, now);
    useEffect(() => {
        if (left === null && deadline && !fired.current) {
            fired.current = true;
            onExpired();
        }
    }, [left, deadline, onExpired]);
    return (
        <div className={cn('flex items-center gap-3 rounded-2xl px-4 py-3', left ? 'bg-warning-soft text-warning-text' : 'bg-muted text-muted-foreground')} data-testid="compte-a-rebours">
            <Timer size={22} aria-hidden="true" />
            {left ? (
                <p className="text-base font-semibold">
                    À payer dans <span className="tabular-nums" role="timer" aria-live="off">{left}</span>
                    <span className="block text-sm font-normal">Passé ce délai, la commande est annulée et vos plats sont remis en vente.</span>
                </p>
            ) : (
                <p className="text-base font-semibold">Délai dépassé</p>
            )}
        </div>
    );
}

export function OrderPayPanel({ orderId, part, amount, onPriceChanged, onClose }: {
    orderId: string;
    part: 'PREMIER' | 'SOLDE';
    /** Première part : montant servi par la base (to_pay_now). Solde : reste à payer servi par la base, sans les frais. */
    amount: number;
    /** Montant changé (refus du serveur) : la commande est relue. */
    onPriceChanged: () => void;
    /** Solde : fermer le formulaire. */
    onClose?: () => void;
}) {
    const uid = useId();
    const router = useRouter();
    const { profile } = useAuth();
    const attempt = useIdempotencyKey();
    const [operator, setOperator] = useState<SamirPayOperatorName | null>(null);
    const [phone, setPhone] = useState('');
    const [touched, setTouched] = useState(false);
    const [rejected, setRejected] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [failure, setFailure] = useState<PaymentRequestError | null>(null);
    const [operatorMissing, setOperatorMissing] = useState(false);
    const [verifyRetry, setVerifyRetry] = useState<(() => void) | null>(null);
    const prefilled = useRef(false);
    const phoneRef = useRef<HTMLInputElement>(null);

    // Paiement mémorisé (ajout du 26/11) : dernier paiement de ce téléphone, sinon numéro du profil ; jamais par-dessus une saisie
    useEffect(() => {
        if (prefilled.current) return;
        const device = readPaymentPreference();
        if (device) {
            prefilled.current = true;
            setOperator((op) => op ?? device.operator);
            setPhone(formatLocalPhone(device.phone));
            return;
        }
        const fromProfile = normalizePayerPhone(profile?.phone);
        if (fromProfile) {
            prefilled.current = true;
            setPhone(formatLocalPhone(fromProfile));
        }
    }, [profile?.phone]);

    const payerPhone = normalizePayerPhone(phone);
    const phoneError = rejected ?? (touched ? (phone.trim() === '' ? 'Le numéro du payeur est obligatoire.' : !payerPhone ? 'Numéro invalide : mobile sénégalais de 9 chiffres commençant par 70, 75, 76, 77 ou 78.' : null) : null);
    const label = operator ? operatorLabel(operator) : null;

    const submit = async () => {
        if (busy) return;
        setTouched(true);
        if (!operator) { setOperatorMissing(true); return; }
        if (!payerPhone || rejected) { phoneRef.current?.focus(); return; }
        const body = {
            targetType: 'ORDER', targetId: orderId, operator, payerPhone, part,
            // Montant affiché envoyé pour comparaison seulement (première part) : le serveur refuse s'il ne correspond plus
            ...(part === 'PREMIER' ? { expectedAmount: amount } : {}),
        };
        const key = attempt.keyFor(JSON.stringify(body));
        setBusy(true);
        setFailure(null);
        let res: Response;
        try {
            res = await fetch('/api/payments/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key },
                body: JSON.stringify(body),
            });
        } catch (err) {
            console.error('[commande] paiement injoignable :', err instanceof Error ? err.message : String(err));
            setFailure({ httpStatus: 0, code: null, message: NETWORK, problems: [], retryAfterSeconds: null, pendingStatusPath: null });
            setBusy(false);
            return;
        }
        const json = await readJsonBody(res, 'commande/paiement');
        if (!res.ok) {
            const error = readPaymentError(res.status, json);
            if (!isUncertainOutcome(res.status)) attempt.reset();
            setBusy(false);
            if (error.code === 'PHONE_NOT_VERIFIED') { setVerifyRetry(() => () => void submit()); return; }
            if (error.code === 'INVALID_PAYER_PHONE') setRejected(error.message);
            if (error.code === 'OPERATOR_REQUIRED') setOperatorMissing(true);
            if (error.code === 'ORDER_PRICE_CHANGED') onPriceChanged();
            setFailure(error.code === 'PAYMENT_PENDING' ? { ...error, message: PENDING_TEXT } : error);
            return;
        }
        const paymentId = isRecord(json) ? nonEmptyString(json.payment_id) : null;
        if (!isRecord(json) || !paymentId) {
            console.error('[commande] réponse de paiement inattendue :', json);
            setFailure({ httpStatus: res.status, code: null, message: 'Réponse inattendue du serveur. Patientez un instant puis réessayez : rien ne sera payé deux fois.', problems: [], retryAfterSeconds: null, pendingStatusPath: null });
            setBusy(false);
            return;
        }
        savePaymentPreference({ operator, phone: payerPhone });
        const deepLink = nonEmptyString(json.deep_link);
        const paymentUrl = nonEmptyString(json.payment_url);
        const qrCode = nonEmptyString(json.qr_code);
        const mobile = isMobileDevice();
        const link = mobile ? deepLink ?? paymentUrl : qrCode ? null : paymentUrl;
        const opened = link !== null && openOperatorLink(link);
        savePaymentHandoff(paymentId, { operator, deepLink, paymentUrl, qrCode, opened });
        attempt.reset();
        router.push(paymentStatusPath(json.status_page_url, paymentId) ?? `/paiement/${encodeURIComponent(paymentId)}`);
    };

    const cta = busy
        ? `Connexion à ${label ?? 'l’opérateur'}…`
        : part === 'PREMIER'
            ? (label ? `Payer ${formatFcfa(amount)} avec ${label}` : `Payer ${formatFcfa(amount)}`)
            : (label ? `Payer le reste avec ${label}` : 'Continuer vers le paiement');

    return (
        <div className="space-y-4" data-testid={part === 'PREMIER' ? 'paiement-commande' : 'paiement-solde'}>
            {part === 'SOLDE' && (
                <p className="text-base text-foreground">
                    Reste à payer : <span className="font-bold tabular-nums text-foreground-strong">{formatFcfa(amount)}</span>, plus les frais de service.
                    Le montant exact s’affiche avant que vous confirmiez chez l’opérateur.
                </p>
            )}

            {failure && (
                <StatusBanner tone="danger" announce="alert" title={failure.code === 'PAYMENT_PENDING' ? 'Un paiement est déjà en attente' : failure.code === 'ORDER_PRICE_CHANGED' ? 'Le montant a changé' : 'Paiement non lancé'}>
                    <p>{failure.message}</p>
                    {failure.pendingStatusPath && (
                        <LinkButton href={failure.pendingStatusPath} variant="secondary" size="sm" className="mt-2" leftIcon={<Clock size={16} />}>
                            Suivre le paiement
                        </LinkButton>
                    )}
                </StatusBanner>
            )}

            <fieldset>
                <legend className="mb-2 text-base font-semibold text-foreground-strong">Payer avec</legend>
                <div className="grid grid-cols-2 gap-3">
                    {SAMIRPAY_OPERATORS.map((op) => {
                        const selected = operator === op;
                        return (
                            <label key={op} className="ev-press relative block cursor-pointer">
                                <input
                                    type="radio"
                                    name={`${uid}-operateur`}
                                    value={op}
                                    checked={selected}
                                    onChange={() => { setOperator(op); setOperatorMissing(false); setFailure(null); }}
                                    className="peer sr-only"
                                />
                                <span
                                    className={cn(
                                        'flex min-h-14 items-center gap-3 rounded-xl px-3 py-2 text-on-op shadow-sm',
                                        op === 'WAVE' ? 'bg-op-wave' : 'bg-op-orange-money',
                                        'peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-card',
                                        selected ? 'ring-[3px] ring-foreground-strong ring-offset-2 ring-offset-card' : operatorMissing ? 'ring-2 ring-danger ring-offset-2 ring-offset-card' : '',
                                    )}
                                >
                                    <OperatorLogo operator={op} size="md" />
                                    <span className="text-base font-extrabold leading-tight">{operatorLabel(op)}</span>
                                </span>
                                {selected && (
                                    <span aria-hidden="true" className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-foreground-strong text-background">
                                        <Check size={16} strokeWidth={3} />
                                    </span>
                                )}
                            </label>
                        );
                    })}
                </div>
                {operatorMissing && <p className="mt-1.5 text-sm font-medium text-danger-text">Choisissez l’opérateur avec lequel vous allez payer.</p>}
            </fieldset>

            <div>
                <label htmlFor={`${uid}-tel`} className="mb-1.5 block text-sm font-semibold text-foreground-strong">
                    Numéro {label ?? 'Mobile Money'} du payeur
                </label>
                <div className="relative">
                    <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-base font-semibold text-muted-foreground">+221</span>
                    <input
                        ref={phoneRef}
                        id={`${uid}-tel`}
                        type="tel"
                        inputMode="numeric"
                        autoComplete="tel-national"
                        value={phone}
                        onChange={(e) => { setPhone(e.target.value); setRejected(null); }}
                        onBlur={() => { setTouched(true); const n = normalizePayerPhone(phone); if (n) setPhone(formatLocalPhone(n)); }}
                        aria-invalid={phoneError ? true : undefined}
                        aria-describedby={phoneError ? `${uid}-tel-erreur` : `${uid}-tel-aide`}
                        className="min-h-12 w-full rounded-xl border border-input bg-card pl-16 pr-3 text-base tabular-nums text-foreground-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                </div>
                {phoneError
                    ? <p id={`${uid}-tel-erreur`} className="mt-1.5 text-sm font-medium text-danger-text">{phoneError}</p>
                    : <p id={`${uid}-tel-aide`} className="mt-1.5 text-sm text-muted-foreground">La demande de paiement arrive sur ce numéro.</p>}
            </div>

            <div className="flex flex-col gap-2 sm:flex-row-reverse">
                <Button
                    variant="gradient"
                    fullWidth
                    onClick={() => void submit()}
                    disabled={busy}
                    leftIcon={busy ? <Loader2 size={18} className="animate-spin" /> : undefined}
                >
                    <span className="tabular-nums">{cta}</span>
                </Button>
                {onClose && (
                    <Button variant="ghost" onClick={onClose} disabled={busy} className="sm:flex-shrink-0">Plus tard</Button>
                )}
            </div>

            {verifyRetry && (
                <PhoneVerifyDialog
                    isOpen
                    phone={profile?.phone ?? null}
                    onClose={() => setVerifyRetry(null)}
                    onVerified={() => { const retry = verifyRetry; setVerifyRetry(null); retry(); }}
                />
            )}
        </div>
    );
}

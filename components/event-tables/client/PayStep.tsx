'use client';

import React, { useEffect, useId, useRef, useState } from 'react';
import { ArrowLeft, Check, Clock, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { LinkButton } from '@/components/ui/LinkButton';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { cn } from '@/components/ui/cn';
import { useAuth } from '@/components/providers/AuthProvider';
import { OperatorLogo } from '@/components/payment/OperatorLogo';
import { formatFcfa } from '@/lib/format';
import { normalizePayerPhone } from '@/lib/payments/payer-phone';
import { readPaymentPreference, savePaymentPreference } from '@/lib/device/device-prefs';
import {
    formatLocalPhone,
    isMobileDevice,
    isRecord,
    isUncertainOutcome,
    nonEmptyString,
    operatorLabel,
    paymentStatusPath,
    readJsonBody,
    readPaymentError,
    savePaymentHandoff,
    toSafeExternalUrl,
    useIdempotencyKey,
    type PaymentRequestError,
} from '@/lib/payments/payment-client';
import { SAMIRPAY_OPERATORS, type SamirPayOperatorName } from '@/lib/samirpay/types';

/**
 * Lot 11c-b — paiement d'une table, dans la feuille (téléphone) ou le panneau (ordinateur) : opérateur choisi
 * explicitement, numéro du payeur (prérempli par le dernier paiement de ce téléphone ou le profil), un seul bouton
 * « Payer 157 500 F avec Wave ». Mêmes règles que la fenêtre de paiement des billets : clé d'idempotence gardée tant que
 * l'issue est incertaine, refus du serveur affichés tels quels, paiement déjà en attente → « Suivre le paiement », numéro
 * du compte non vérifié → vérification par code (parcours existant, ouvert par l'écran parent). Le total affiché est
 * celui du devis du serveur pour l'opérateur choisi.
 */

export interface StartedPayment {
    paymentId: string;
    expiresAt: string | null;
    statusPath: string;
    operator: SamirPayOperatorName;
    /** Lien de l'opérateur, s'il n'a pas pu être ouvert tout seul (bloqué par le navigateur, ordinateur). */
    link: string | null;
    tableNumber: number | null;
}

const NETWORK = 'Le serveur est injoignable. Vérifiez votre connexion puis réessayez : votre demande ne sera pas dupliquée.';

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

export function PayStep({
    eventId,
    typeId,
    tableId,
    total,
    totalLoading,
    operator,
    onOperator,
    onStarted,
    onBack,
    onPhoneNotVerified,
    onTableGone,
    onPriceChanged,
}: {
    eventId: string;
    typeId: string;
    tableId: string | null;
    /** Total du devis du serveur pour l'opérateur choisi (null pendant le calcul). */
    total: number | null;
    totalLoading: boolean;
    operator: SamirPayOperatorName | null;
    onOperator: (op: SamirPayOperatorName) => void;
    onStarted: (payment: StartedPayment) => void;
    onBack: () => void;
    onPhoneNotVerified: (retry: () => void) => void;
    /** La table vient d'être prise (refus TABLE_TAKEN ou TABLES_SOLD_OUT) : l'offre est relue. */
    onTableGone: (message: string) => void;
    /** Prix changé depuis le devis affiché (refus du serveur) : l'écran relit le devis ; rien n'a été demandé au client. */
    onPriceChanged: () => void;
}) {
    const uid = useId();
    const { profile } = useAuth();
    const attempt = useIdempotencyKey();
    const [phone, setPhone] = useState('');
    const [touched, setTouched] = useState(false);
    const [rejected, setRejected] = useState<string | null>(null);
    const [busy, setBusy] = useState(false);
    const [failure, setFailure] = useState<PaymentRequestError | null>(null);
    const [operatorMissing, setOperatorMissing] = useState(false);
    const prefilled = useRef(false);
    const phoneRef = useRef<HTMLInputElement>(null);

    // Préremplissage unique (jamais par-dessus une saisie) : dernier paiement de ce téléphone, sinon numéro du profil
    useEffect(() => {
        if (prefilled.current) return;
        const device = readPaymentPreference();
        if (device) {
            prefilled.current = true;
            if (!operator) onOperator(device.operator);
            setPhone(formatLocalPhone(device.phone));
            return;
        }
        const fromProfile = normalizePayerPhone(profile?.phone);
        if (fromProfile) {
            prefilled.current = true;
            setPhone(formatLocalPhone(fromProfile));
        }
    }, [operator, onOperator, profile?.phone]);

    const payerPhone = normalizePayerPhone(phone);
    const phoneError = rejected ?? (touched ? (phone.trim() === '' ? 'Le numéro du payeur est obligatoire.' : !payerPhone ? 'Numéro invalide : mobile sénégalais de 9 chiffres commençant par 70, 75, 76, 77 ou 78.' : null) : null);
    const label = operator ? operatorLabel(operator) : null;

    const submit = async () => {
        if (busy) return;
        setTouched(true);
        if (!operator) { setOperatorMissing(true); return; }
        if (!payerPhone || rejected) { phoneRef.current?.focus(); return; }
        // Total affiché envoyé pour comparaison seulement : le serveur refuse s'il ne correspond plus au prix de la base
        const body = { typeId, tableId, operator, payerPhone, ...(total !== null ? { expectedTotal: total } : {}) };
        const key = attempt.keyFor(JSON.stringify(body));
        setBusy(true);
        setFailure(null);
        let res: Response;
        try {
            res = await fetch(`/api/events/${encodeURIComponent(eventId)}/tables/checkout`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key },
                body: JSON.stringify(body),
            });
        } catch (err) {
            console.error('[tables] achat injoignable :', err instanceof Error ? err.message : String(err));
            setFailure({ httpStatus: 0, code: null, message: NETWORK, problems: [], retryAfterSeconds: null, pendingStatusPath: null });
            setBusy(false);
            return;
        }
        const json = await readJsonBody(res, 'tables/achat');
        if (!res.ok) {
            const error = readPaymentError(res.status, json);
            if (!isUncertainOutcome(res.status)) attempt.reset();
            setBusy(false);
            if (error.code === 'PHONE_NOT_VERIFIED') { onPhoneNotVerified(() => void submit()); return; }
            if (error.code === 'INVALID_PAYER_PHONE') setRejected(error.message);
            if (error.code === 'OPERATOR_REQUIRED') setOperatorMissing(true);
            if (error.code === 'TABLE_TAKEN' || error.code === 'TABLES_SOLD_OUT') { onTableGone(error.message); return; }
            if (error.code === 'TABLE_PRICE_CHANGED') onPriceChanged();
            setFailure(error);
            return;
        }
        const paymentId = isRecord(json) ? nonEmptyString(json.payment_id) : null;
        const status = isRecord(json) ? nonEmptyString(json.status) : null;
        if (!isRecord(json) || !paymentId || !status) {
            console.error('[tables] réponse d’achat inattendue :', json);
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
        setBusy(false);
        const table = isRecord(json.table) ? json.table : null;
        onStarted({
            paymentId,
            expiresAt: nonEmptyString(json.expires_at),
            statusPath: paymentStatusPath(json.status_page_url, paymentId) ?? `/paiement/${encodeURIComponent(paymentId)}`,
            operator,
            link: opened ? null : (deepLink ?? paymentUrl),
            tableNumber: table && typeof table.number === 'number' ? table.number : null,
        });
    };

    const cta = busy
        ? `Connexion à ${label ?? 'l’opérateur'}…`
        : totalLoading ? 'Calcul du total…'
        : total !== null ? (label ? `Payer ${formatFcfa(total)} avec ${label}` : `Payer ${formatFcfa(total)}`) : 'Continuer vers le paiement';

    return (
        <div className="space-y-4">
            <Button variant="ghost" size="sm" onClick={onBack} leftIcon={<ArrowLeft size={16} />} disabled={busy}>
                Changer de table
            </Button>

            {failure && (
                <StatusBanner tone="danger" announce="alert" title={failure.code === 'PAYMENT_PENDING' ? 'Un paiement est déjà en attente' : failure.code === 'TABLE_PRICE_CHANGED' ? 'Le prix a changé' : 'Paiement non lancé'}>
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
                                    onChange={() => { onOperator(op); setOperatorMissing(false); setFailure(null); }}
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

            <Button variant="gradient" fullWidth onClick={() => void submit()} disabled={busy || totalLoading} leftIcon={busy ? <Loader2 size={18} className="animate-spin" /> : undefined}>
                {cta}
            </Button>
        </div>
    );
}

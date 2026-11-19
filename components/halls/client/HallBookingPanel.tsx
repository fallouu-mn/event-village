'use client';

/**
 * Lot 10b (point 2) : panneau de réservation de la fiche d'une salle.
 *  1. Choix : à la journée (date + nombre de jours) ou, si la salle a un prix à l'heure, à l'heure (date + heure de
 *     début à l'heure ou à la demie + nombre d'heures). Choix gardé dans l'adresse (booking-url) : il survit à la
 *     connexion et le calendrier le partage.
 *  2. Devis du serveur (GET /api/halls/[id]/quote) affiché en détail AVANT de payer : prix, frais de service, total,
 *     acompte et solde avec sa date limite (ou paiement en une fois), règle d'annulation et case « J'ai lu les
 *     conditions d'annulation ». Aucun montant n'est calculé ici.
 *  3. « Réserver et payer l'acompte » (ou « Réserver et payer ») → POST /api/halls/reserve (sans aucun montant), puis
 *     fenêtre de paiement (PaymentModal chargée à la demande, part ACOMPTE ou INTEGRAL ; le serveur relit le montant).
 *     Sans session : /login?redirect=<fiche avec le choix>. La réservation créée reste visible avec le lien vers son
 *     détail (« Mes réservations »).
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';
import { CalendarClock, CalendarDays, Clock, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { FilterChip } from '@/components/ui/FilterChip';
import { LinkButton } from '@/components/ui/LinkButton';
import { Select, TextInput } from '@/components/ui/Field';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { Switch } from '@/components/ui/Switch';
import { useAuth } from '@/components/providers/AuthProvider';
import { ApiError, errorMessage, fetchJson } from '@/components/partner/fetch-json';
import { dakarDate, dakarTime, fcfaText, longDate, periodText } from '@/lib/halls/views';
import type { HallQuoteView } from '@/lib/halls/queries';
import { DAY_RE, START_TIMES, loginHref, maxHoursFrom, readChoice, writeChoice } from './booking-url';
import { capitalize, unitsText } from './format';

// La fenêtre de paiement n'est chargée qu'au premier paiement (poids de la fiche).
const PaymentModal = dynamic(
    () => import('@/components/payment/PaymentModal').then((m) => ({ default: m.PaymentModal })),
    { ssr: false },
);

interface Created {
    id: string;
    holdExpiresAt: string | null;
    part: 'ACOMPTE' | 'INTEGRAL';
    amount: number;
    period: string;
}

type QuoteState =
    | { phase: 'idle' }
    | { phase: 'loading' }
    | { phase: 'ok'; quote: HallQuoteView }
    | { phase: 'refused'; message: string; retry: boolean };

const DAY_OPTIONS = Array.from({ length: 30 }, (_, i) => ({ value: String(i + 1), label: unitsText('JOUR', i + 1) }));
const TIME_OPTIONS = START_TIMES.map((t) => ({ value: t, label: t }));

function singlePayment(q: { fullPaymentRequired: boolean; depositAmount: number; totalAmount: number }): boolean {
    return q.fullPaymentRequired || q.depositAmount >= q.totalAmount;
}

function AmountRow({ label, value, strong = false, hint }: { label: string; value: string; strong?: boolean; hint?: string }) {
    return (
        <div className="flex items-start justify-between gap-4 py-2">
            <dt className={strong ? 'text-base font-semibold text-foreground-strong' : 'text-sm text-foreground'}>
                {label}
                {hint && <span className="block text-sm font-normal text-muted-foreground">{hint}</span>}
            </dt>
            <dd className={strong ? 'text-lg font-bold tabular-nums text-foreground-strong' : 'text-sm font-semibold tabular-nums text-foreground-strong'}>{value}</dd>
        </div>
    );
}

export function HallBookingPanel({ hall, today }: { hall: { id: string; name: string; pricePerDay: number; pricePerHour: number | null }; today: string }) {
    const router = useRouter();
    const sp = useSearchParams();
    const { user, isLoading: authLoading } = useAuth();
    const hourly = hall.pricePerHour !== null;
    const choice = readChoice(sp, hourly);
    const { date, mode, units, time } = choice;

    const [quote, setQuote] = useState<QuoteState>({ phase: 'idle' });
    const [accepted, setAccepted] = useState(false);
    const [payAll, setPayAll] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [reserveError, setReserveError] = useState<string | null>(null);
    const [created, setCreated] = useState<Created | null>(null);
    const [payOpen, setPayOpen] = useState(false);
    const [attempt, setAttempt] = useState(0);
    const ctrl = useRef<AbortController | null>(null);

    const ready = DAY_RE.test(date) && (mode === 'JOUR' || Boolean(time));
    const quoteKey = ready ? `${date}|${mode}|${units}|${mode === 'HEURE' ? time : ''}` : '';

    // Devis du serveur à chaque changement du choix (attente courte : un seul appel pendant une saisie rapide)
    useEffect(() => {
        ctrl.current?.abort();
        setReserveError(null);
        if (!quoteKey) {
            setQuote({ phase: 'idle' });
            return undefined;
        }
        const c = new AbortController();
        ctrl.current = c;
        setQuote({ phase: 'loading' });
        const timer = window.setTimeout(async () => {
            const params = new URLSearchParams({ date, mode, units: String(units) });
            if (mode === 'HEURE') params.set('time', time);
            try {
                const body = await fetchJson<{ quote?: HallQuoteView }>(`/api/halls/${hall.id}/quote?${params.toString()}`, { signal: c.signal });
                if (c.signal.aborted) return;
                if (!body.quote) throw new ApiError('Prix momentanément indisponible. Réessayez.', 200, null, null);
                setQuote({ phase: 'ok', quote: body.quote });
            } catch (err) {
                if (c.signal.aborted) return;
                // Refus de la salle (date prise, date passée…) : message de la route ; panne : « Réessayer »
                const retry = !(err instanceof ApiError) || err.status === 0 || err.status >= 500;
                setQuote({ phase: 'refused', message: errorMessage(err, 'Prix momentanément indisponible. Réessayez.'), retry });
            }
        }, 250);
        return () => {
            window.clearTimeout(timer);
            c.abort();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [quoteKey, hall.id, attempt]);

    const q = quote.phase === 'ok' ? quote.quote : null;

    // Conditions d'annulation différentes : la case est à recocher après lecture
    const readTerms = useRef<string | null>(null);
    useEffect(() => {
        if (!q) return;
        if (readTerms.current !== null && readTerms.current !== q.cancellation) setAccepted(false);
        readTerms.current = q.cancellation;
    }, [q]);
    const oneShot = q ? singlePayment(q) : false;
    const part: 'ACOMPTE' | 'INTEGRAL' = q && (oneShot || payAll) ? 'INTEGRAL' : 'ACOMPTE';
    const canReserve = Boolean(q) && accepted && !submitting && !created;

    const hourOptions = useMemo(() => {
        const max = time ? maxHoursFrom(time) : 24;
        return Array.from({ length: max }, (_, i) => ({ value: String(i + 1), label: unitsText('HEURE', i + 1) }));
    }, [time]);

    const reserve = async () => {
        if (!q || !accepted) return;
        if (!authLoading && !user) {
            router.push(loginHref());
            return;
        }
        setSubmitting(true);
        setReserveError(null);
        try {
            const res = await fetch('/api/halls/reserve', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                cache: 'no-store',
                body: JSON.stringify({ hallId: hall.id, startDate: date, mode, units, ...(mode === 'HEURE' ? { startTime: time } : {}) }),
            });
            if (res.status === 401) {
                router.push(loginHref());
                return;
            }
            const body = (await res.json().catch(() => null)) as { error?: unknown; reservation?: Record<string, unknown> } | null;
            const r = body?.reservation;
            if (!res.ok || !r || typeof r.id !== 'string') {
                setReserveError(typeof body?.error === 'string' && body.error.trim() ? body.error : 'La réservation n’a pas pu être enregistrée. Réessayez.');
                return;
            }
            const deposit = Number(r.depositAmount);
            const total = Number(r.totalAmount);
            const single = r.fullPaymentRequired === true || deposit >= total;
            const chosen: 'ACOMPTE' | 'INTEGRAL' = single || payAll ? 'INTEGRAL' : 'ACOMPTE';
            setCreated({
                id: r.id,
                holdExpiresAt: typeof r.holdExpiresAt === 'string' ? r.holdExpiresAt : null,
                part: chosen,
                amount: chosen === 'INTEGRAL' ? total : deposit,
                period: periodText({ start_date: String(r.startDate ?? date), end_date: String(r.endDate ?? date), start_time: typeof r.startTime === 'string' ? r.startTime.slice(0, 5) : null, end_time: typeof r.endTime === 'string' ? r.endTime.slice(0, 5) : null }),
            });
            setPayOpen(true);
        } catch {
            setReserveError('Connexion impossible. Vérifiez votre réseau, puis réessayez.');
        } finally {
            setSubmitting(false);
        }
    };

    if (created) {
        return (
            <div className="space-y-4">
                <h2 id="reserver-titre" className="text-xl font-bold text-foreground-strong">Votre réservation</h2>
                <StatusBanner tone="success" title="Date réservée, il reste à payer">
                    <p>{`${hall.name}, ${created.period}.`}</p>
                    {created.holdExpiresAt && (
                        <p className="mt-1">{`La date vous est gardée jusqu’à ${dakarTime(created.holdExpiresAt)}. Sans paiement d’ici là, elle est libérée.`}</p>
                    )}
                </StatusBanner>
                <Button variant="gradient" size="lg" fullWidth onClick={() => setPayOpen(true)}>
                    {created.part === 'INTEGRAL' ? `Payer ${fcfaText(created.amount)}` : `Payer l’acompte de ${fcfaText(created.amount)}`}
                </Button>
                <LinkButton href={`/halls/reservations/${created.id}`} variant="secondary" fullWidth>
                    Voir ma réservation
                </LinkButton>
                <p className="text-sm text-muted-foreground">Vous la retrouvez à tout moment dans « Mes réservations ».</p>
                {payOpen && (
                    <PaymentModal
                        isOpen={payOpen}
                        onClose={() => setPayOpen(false)}
                        title={created.part === 'INTEGRAL' ? `Payer la réservation de ${hall.name}` : `Payer l’acompte de ${hall.name}`}
                        targetType="HALL_RESERVATION"
                        targetId={created.id}
                        part={created.part}
                        amountFormatted={fcfaText(created.amount)}
                    />
                )}
            </div>
        );
    }

    return (
        <div className="space-y-5">
            <div>
                <h2 id="reserver-titre" className="text-xl font-bold text-foreground-strong">Réserver la salle</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                    {hourly
                        ? `${fcfaText(hall.pricePerDay)} par jour ou ${fcfaText(hall.pricePerHour)} par heure, frais de service en plus.`
                        : `${fcfaText(hall.pricePerDay)} par jour, frais de service en plus.`}
                </p>
            </div>

            {hourly && (
                <div role="group" aria-label="Durée de la location" className="flex flex-wrap gap-2">
                    <FilterChip pressed={mode === 'JOUR'} onClick={() => writeChoice({ mode: 'JOUR', units: 1, time: '' })}>
                        <CalendarDays size={16} aria-hidden="true" />
                        À la journée
                    </FilterChip>
                    <FilterChip pressed={mode === 'HEURE'} onClick={() => writeChoice({ mode: 'HEURE', units: 4, time: time || '18:00' })}>
                        <Clock size={16} aria-hidden="true" />
                        À l’heure
                    </FilterChip>
                </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                <TextInput
                    label="Date"
                    type="date"
                    min={today}
                    value={date}
                    onChange={(e) => writeChoice({ date: e.target.value })}
                    hint={date ? capitalize(longDate(date)) : 'Ou touchez un jour libre du calendrier.'}
                    fieldClassName={mode === 'HEURE' ? 'sm:col-span-2 lg:col-span-1 xl:col-span-2' : undefined}
                />
                {mode === 'JOUR' ? (
                    <Select label="Nombre de jours" value={String(units)} onChange={(e) => writeChoice({ units: Number(e.target.value) })} options={DAY_OPTIONS} />
                ) : (
                    <>
                        <Select
                            label="Heure de début"
                            value={time}
                            placeholder="Choisir une heure"
                            onChange={(e) => {
                                const t = e.target.value;
                                writeChoice({ time: t, units: Math.min(units, maxHoursFrom(t)) });
                            }}
                            options={TIME_OPTIONS}
                        />
                        <Select label="Nombre d’heures" value={String(units)} onChange={(e) => writeChoice({ units: Number(e.target.value) })} options={hourOptions} />
                    </>
                )}
            </div>

            <div aria-live="polite" aria-busy={quote.phase === 'loading'}>
                {quote.phase === 'idle' && (
                    <p className="rounded-xl border border-dashed border-border bg-muted p-4 text-sm text-muted-foreground">
                        {mode === 'HEURE' && date && !time ? 'Choisissez l’heure de début pour voir le prix exact.' : 'Choisissez une date pour voir le prix exact, l’acompte et les conditions.'}
                    </p>
                )}
                {quote.phase === 'loading' && (
                    <div className="space-y-3 rounded-xl border border-border p-4">
                        <span className="sr-only">Calcul du prix…</span>
                        <Skeleton className="h-5 w-2/3 rounded-md" />
                        <Skeleton className="h-5 w-1/2 rounded-md" />
                        <Skeleton className="h-6 w-3/4 rounded-md" />
                        <Skeleton className="h-5 w-1/2 rounded-md" />
                    </div>
                )}
                {quote.phase === 'refused' && (
                    <StatusBanner
                        tone={quote.retry ? 'danger' : 'warning'}
                        title={quote.retry ? 'Prix momentanément indisponible' : 'Ce choix n’est pas possible'}
                        action={quote.retry ? <Button variant="secondary" size="sm" onClick={() => setAttempt((n) => n + 1)}>Réessayer</Button> : undefined}
                    >
                        {quote.message}
                    </StatusBanner>
                )}
                {q && (
                    <div className="space-y-4">
                        <div className="rounded-xl border border-border p-4">
                            <p className="flex items-start gap-2 text-sm font-semibold text-foreground-strong">
                                <CalendarClock size={18} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
                                <span>{capitalize(periodText({ start_date: q.startDate, end_date: q.endDate, start_time: q.startTime, end_time: q.endTime }))}</span>
                            </p>
                            <dl className="mt-2 divide-y divide-border">
                                <AmountRow label={`Prix (${unitsText(q.mode, q.units)})`} value={fcfaText(q.priceAmount)} />
                                <AmountRow label="Frais de service" value={fcfaText(q.serviceFeeAmount)} />
                                <AmountRow label="Total" value={fcfaText(q.totalAmount)} strong />
                            </dl>
                        </div>

                        <div className="rounded-xl border border-border bg-muted p-4">
                            {oneShot ? (
                                <>
                                    <p className="text-base font-semibold text-foreground-strong">Paiement en une fois</p>
                                    <p className="mt-1 text-sm text-foreground">{`Pour cette réservation, vous payez ${fcfaText(q.totalAmount)} en une fois.`}</p>
                                </>
                            ) : (
                                <>
                                    <dl className="divide-y divide-border">
                                        <AmountRow label="Acompte à payer maintenant" value={fcfaText(q.depositAmount)} strong />
                                        <AmountRow
                                            label="Solde à payer plus tard"
                                            value={fcfaText(q.balanceAmount)}
                                            hint={q.balanceDueAt ? `Au plus tard le ${dakarDate(q.balanceDueAt)} à ${dakarTime(q.balanceDueAt)}` : undefined}
                                        />
                                    </dl>
                                    <Switch
                                        className="mt-3"
                                        label="Payer la totalité maintenant"
                                        description={`${fcfaText(q.totalAmount)} en une fois, plus rien à payer ensuite.`}
                                        checked={payAll}
                                        onChange={setPayAll}
                                    />
                                </>
                            )}
                        </div>

                        <div className="space-y-2 rounded-xl border border-border p-4">
                            <h3 className="flex items-center gap-2 text-base font-semibold text-foreground-strong">
                                <ShieldCheck size={18} aria-hidden="true" />
                                Conditions d’annulation
                            </h3>
                            <p className="whitespace-pre-line text-sm leading-relaxed text-foreground">{q.cancellation}</p>
                            <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-semibold text-foreground-strong">
                                <input
                                    type="checkbox"
                                    checked={accepted}
                                    onChange={(e) => setAccepted(e.target.checked)}
                                    className="h-5 w-5 flex-shrink-0 cursor-pointer rounded border-input accent-primary"
                                />
                                J’ai lu les conditions d’annulation
                            </label>
                        </div>
                    </div>
                )}
            </div>

            {reserveError && (
                <StatusBanner tone="danger" title="Réservation non enregistrée" announce="alert">
                    {reserveError}
                </StatusBanner>
            )}

            <div className="space-y-2">
                <Button variant="gradient" size="lg" fullWidth disabled={!canReserve} isLoading={submitting} onClick={reserve}>
                    {part === 'INTEGRAL' ? 'Réserver et payer' : 'Réserver et payer l’acompte'}
                </Button>
                {q && !accepted && <p className="text-sm text-muted-foreground">Cochez « J’ai lu les conditions d’annulation » pour continuer.</p>}
                {q && accepted && !authLoading && !user && <p className="text-sm text-muted-foreground">Vous allez vous connecter ; votre choix sera gardé.</p>}
                <p className="text-sm text-muted-foreground">Après la réservation, la date vous est gardée quelques minutes, le temps de payer par Wave ou Orange Money.</p>
            </div>
        </div>
    );
}

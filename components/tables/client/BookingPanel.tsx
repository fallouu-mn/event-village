'use client';

/**
 * Lot 11b (écrans du client) : panneau de réservation de la fiche d'un établissement.
 *  1. Personnes (pas à pas), jour (bande de 14 jours glissable + « Autre jour »), zone facultative, puis les créneaux
 *     du jour en pastilles (GET /api/tables/[id]/slots, relus à chaque changement, demande précédente annulée) :
 *     retour immédiat au toucher, complet grisé, passé masqué, jour fermé ou complet dit en clair.
 *  2. Plan de salle si l'établissement le montre (GET /api/tables/[id]/floor au créneau choisi, FloorPlan en mode
 *     « select ») : choisir sa table est facultatif ; une table prise ou trop petite ne se choisit pas.
 *  3. Demande particulière (500 caractères), devis de la base si acompte (GET /api/tables/[id]/quote : acompte, frais,
 *     total à payer ; « Gratuit » sinon). Aucun montant n'est calculé ici.
 *  4. « Réserver » → POST /api/restaurants/reserve-table { venueId, date, time, guests, tableId?, zoneId?, notes? }. Sans
 *     session : /login?redirect=<fiche avec le choix>, la demande particulière est gardée dans l'onglet. Refus : message
 *     de la base sous le bouton, créneaux relus. Réservation faite : confirmation animée (BookingConfirmation).
 * Le choix vit dans l'adresse (booking-choice) : il survit à la connexion, au retour arrière et au partage.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';
import { CalendarClock, Calculator, Info, LayoutGrid, MapPinned, Wallet, X, Zap } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { FilterChip } from '@/components/ui/FilterChip';
import { Textarea } from '@/components/ui/Field';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { useAuth } from '@/components/providers/AuthProvider';
import { ApiError, errorMessage, fetchJson } from '@/components/partner/fetch-json';
import type { FloorPlanTable, FloorPlanZone } from '@/components/tables/plan/FloorPlan';
import { loadFloorPlan } from '@/components/tables/plan/load';
import { dayText, fcfaText, guestsText, hmText } from '@/lib/tables/views';
import type { ClientTableReservationDetail, FloorTable, FloorZone, QuoteView } from '@/lib/tables/queries';
import { BookingConfirmation, type CreatedReservation } from './BookingConfirmation';
import { DayStrip } from './DayStrip';
import { GuestStepper } from './GuestStepper';
import { SlotPicker, type SlotsResult } from './SlotPicker';
import { NOTES_MAX, clearNotes, loginHref, readChoice, readNotes, writeChoice, writeNotes } from './booking-choice';
import { capitalize, durationText, minutesText } from './format';

// Plan de salle chargé seulement si l'établissement le montre et qu'un créneau est choisi (poids de la fiche)
// Lot 11c-b : par le chargeur unique du plan (components/tables/plan/load.ts), partagé avec le choix d'une table d'un événement
const FloorPlan = dynamic(() => loadFloorPlan().then((m) => ({ default: m.FloorPlan })), {
    ssr: false,
    loading: () => <Skeleton className="aspect-[4/3] w-full rounded-xl" />,
});

export interface BookingVenue {
    id: string;
    name: string;
    depositPerPerson: number;
    confirmation: 'AUTO' | 'MANUELLE';
    floorPlan: boolean;
    zones: Array<{ id: string; name: string }>;
    minCapacity: number;
    maxCapacity: number;
    slotMinutes: number;
    rules: { holdMinutes: number; responseMinutes: number; cancelFreeHours: number; noShowMinutes: number };
}

interface Loaded<T> {
    key: string;
    data: T | null;
    error: string | null;
    pending: boolean;
}

const EMPTY: Loaded<never> = { key: '', data: null, error: null, pending: false };
const DELAY_MS = 200;

function nextDay(day: string): string {
    return new Date(Date.parse(`${day}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
}

/** Lecture débouncée et annulable d'une route : dernière réponse gardée à l'écran pendant la suivante. */
function useLoaded<T>(key: string, url: string | null, pick: (body: Record<string, unknown>) => T | null, attempt: number): Loaded<T> {
    const [state, setState] = useState<Loaded<T>>(EMPTY);
    const pickRef = useRef(pick);
    pickRef.current = pick;
    useEffect(() => {
        if (!url) {
            setState(EMPTY);
            return undefined;
        }
        const c = new AbortController();
        setState((prev) => ({ ...prev, pending: true, error: null }));
        const timer = window.setTimeout(async () => {
            try {
                const body = await fetchJson<Record<string, unknown>>(url, { signal: c.signal });
                if (c.signal.aborted) return;
                const data = pickRef.current(body);
                if (data === null) throw new ApiError('Réponse du serveur illisible. Réessayez.', 200, null, null);
                setState({ key, data, error: null, pending: false });
            } catch (err) {
                if (c.signal.aborted) return;
                setState({ key, data: null, error: errorMessage(err, 'Lecture impossible pour le moment. Réessayez.'), pending: false });
            }
        }, DELAY_MS);
        return () => {
            window.clearTimeout(timer);
            c.abort();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key, url, attempt]);
    return state;
}

function Step({ n, title, children, aside }: { n: number; title: string; children: React.ReactNode; aside?: React.ReactNode }) {
    return (
        <section className="space-y-3" aria-labelledby={`etape-${n}`}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 id={`etape-${n}`} className="flex items-center gap-2 text-base font-bold text-foreground-strong">
                    <span className="inline-flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-primary-soft text-sm font-bold text-primary-text" aria-hidden="true">{n}</span>
                    {title}
                </h3>
                {aside}
            </div>
            {children}
        </section>
    );
}

function AmountRow({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
    return (
        <div className="flex items-start justify-between gap-4 py-2">
            <dt className={strong ? 'text-base font-semibold text-foreground-strong' : 'text-sm text-foreground'}>{label}</dt>
            <dd className={strong ? 'text-lg font-bold tabular-nums text-foreground-strong' : 'text-sm font-semibold tabular-nums text-foreground-strong'}>{value}</dd>
        </div>
    );
}

export function BookingPanel({ venue, today }: { venue: BookingVenue; today: string }) {
    const router = useRouter();
    const sp = useSearchParams();
    const { user, isLoading: authLoading } = useAuth();
    const choice = readChoice(sp, today);
    const { date, time, guests, zoneId, tableId } = choice;
    const deposit = venue.depositPerPerson > 0;
    const manual = venue.confirmation === 'MANUELLE';

    const [notes, setNotes] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [reserveError, setReserveError] = useState<string | null>(null);
    const [notice, setNotice] = useState<string | null>(null);
    const [created, setCreated] = useState<CreatedReservation | null>(null);
    const [detail, setDetail] = useState<ClientTableReservationDetail | null>(null);
    const [slotsAttempt, setSlotsAttempt] = useState(0);
    const [floorAttempt, setFloorAttempt] = useState(0);
    const [quoteAttempt, setQuoteAttempt] = useState(0);

    // Demande particulière gardée dans l'onglet (survit à la connexion)
    useEffect(() => setNotes(readNotes(venue.id)), [venue.id]);

    // ── Créneaux du jour ─────────────────────────────────────────────────────────────────────────────────────
    const slotsKey = `${date}|${guests}|${zoneId}`;
    const slotsUrl = `/api/tables/${venue.id}/slots?${new URLSearchParams({ date, guests: String(guests), ...(zoneId ? { zoneId } : {}) }).toString()}`;
    const slots = useLoaded<SlotsResult>(slotsKey, slotsUrl, (b) => (Array.isArray(b.slots) ? {
        day: String(b.day ?? ''), message: typeof b.message === 'string' ? b.message : null, partlyClosed: b.partly_closed === true || b.partlyClosed === true,
        slots: b.slots as SlotsResult['slots'],
    } : null), slotsAttempt);
    const slotsData = slots.data;
    const slotsFresh = slots.key === slotsKey && !slots.pending;
    const chosenSlot = slotsData?.slots.find((s) => s.time === time) ?? null;
    const timeOk = Boolean(time) && slotsFresh && chosenSlot?.state === 'LIBRE';

    // Créneau choisi qui n'est plus libre (autre jour, plus de personnes, déjà pris) : retiré, et dit
    useEffect(() => {
        if (!time || !slotsFresh || !slotsData) return;
        if (chosenSlot?.state !== 'LIBRE') {
            setNotice(chosenSlot?.state === 'COMPLET' ? `Le créneau de ${hmText(time)} est complet : choisissez une autre heure.` : null);
            writeChoice({ time: '', tableId: '' });
        }
    }, [time, slotsFresh, slotsData, chosenSlot]);

    // ── Plan de salle au créneau choisi ──────────────────────────────────────────────────────────────────────
    const floorKey = venue.floorPlan && timeOk ? `${date}|${time}|${guests}` : '';
    const floorUrl = floorKey ? `/api/tables/${venue.id}/floor?${new URLSearchParams({ date, time, guests: String(guests) }).toString()}` : null;
    const floor = useLoaded<{ enabled: boolean; tables: FloorTable[]; zones: FloorZone[] }>(floorKey, floorUrl, (b) => (Array.isArray(b.tables) ? {
        enabled: b.enabled === true, tables: b.tables as FloorTable[], zones: Array.isArray(b.zones) ? (b.zones as FloorZone[]) : [],
    } : null), floorAttempt);
    const floorData = floorKey && floor.key === floorKey ? floor.data : null;
    const chosenTable = floorData?.tables.find((t) => t.id === tableId) ?? null;

    useEffect(() => {
        if (!tableId || !floorData || floor.pending) return;
        if (!chosenTable || chosenTable.state !== 'LIBRE') {
            if (chosenTable) setNotice(`La table ${chosenTable.number} n’est plus libre à cette heure : l’établissement en choisira une autre, ou choisissez-en une sur le plan.`);
            writeChoice({ tableId: '' });
        }
    }, [tableId, floorData, floor.pending, chosenTable]);

    const planTables: FloorPlanTable[] = useMemo(() => (floorData?.tables ?? []).map((t) => ({
        id: t.id, number: t.number, capacity: t.capacity, minCapacity: t.minCapacity, x: t.x, y: t.y, shape: t.shape, rotation: t.rotation,
        state: t.state,
        hint: t.state === 'PRISE' ? 'Déjà réservée à cette heure'
            : t.state === 'HORS_CAPACITE' ? `Pour ${t.minCapacity > 1 ? `${t.minCapacity} à ` : ''}${t.capacity} personnes`
                : `${t.capacity} places`,
    })), [floorData]);
    const planZones: FloorPlanZone[] = useMemo(() => (floorData?.zones ?? []).map((z) => ({ id: z.id, name: z.name, x: z.x, y: z.y, w: z.w, h: z.h })), [floorData]);
    const showPlan = venue.floorPlan && timeOk && (floorData === null || (floorData.enabled && floorData.tables.length > 0));

    // ── Devis de la base (acompte) ───────────────────────────────────────────────────────────────────────────
    const quoteKey = deposit ? String(guests) : '';
    const quote = useLoaded<QuoteView>(quoteKey, deposit ? `/api/tables/${venue.id}/quote?guests=${guests}` : null,
        (b) => (b.quote && typeof b.quote === 'object' ? (b.quote as QuoteView) : null), quoteAttempt);
    const q = deposit ? quote.data : null;
    const quoteFresh = !deposit || (quote.key === quoteKey && !quote.pending && quote.data !== null);

    const canReserve = timeOk && quoteFresh && !submitting && !created;

    const update = useCallback((patch: Parameters<typeof writeChoice>[0]) => {
        setReserveError(null);
        setNotice(null);
        writeChoice(patch);
    }, []);

    const reserve = async () => {
        if (!canReserve) return;
        if (!authLoading && !user) {
            writeNotes(venue.id, notes);
            router.push(loginHref());
            return;
        }
        setSubmitting(true);
        setReserveError(null);
        setNotice(null);
        try {
            const res = await fetch('/api/restaurants/reserve-table', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                cache: 'no-store',
                body: JSON.stringify({
                    venueId: venue.id, date, time, guests,
                    // Table choisie : elle prime sur la zone (la base vérifie la table) ; sinon, zone souhaitée
                    ...(tableId ? { tableId } : zoneId ? { zoneId } : {}), ...(notes.trim() ? { notes: notes.trim() } : {}),
                }),
            });
            if (res.status === 401) {
                writeNotes(venue.id, notes);
                router.push(loginHref());
                return;
            }
            const body = (await res.json().catch(() => null)) as { error?: unknown; reservation?: Record<string, unknown> } | null;
            const r = body?.reservation;
            if (!res.ok || !r || typeof r.id !== 'string') {
                setReserveError(typeof body?.error === 'string' && body.error.trim() ? body.error : 'La réservation n’a pas pu être enregistrée. Réessayez.');
                // L'état des tables a pu changer : créneaux et plan relus
                setSlotsAttempt((n) => n + 1);
                setFloorAttempt((n) => n + 1);
                return;
            }
            clearNotes(venue.id);
            const made: CreatedReservation = {
                id: r.id,
                venueName: typeof r.venueName === 'string' ? r.venueName : venue.name,
                tableNumber: typeof r.tableNumber === 'string' || typeof r.tableNumber === 'number' ? String(r.tableNumber) : null,
                guests: Number(r.guests) || guests,
                date: typeof r.date === 'string' ? r.date.slice(0, 10) : date,
                time: typeof r.time === 'string' ? r.time.slice(0, 5) : time,
                endTime: typeof r.endTime === 'string' ? r.endTime.slice(0, 5) : null,
                depositAmount: Number(r.depositAmount) || 0,
                serviceFee: Number(r.serviceFee) || 0,
                totalToPay: Number(r.totalToPay) || 0,
                holdExpiresAt: typeof r.holdExpiresAt === 'string' ? r.holdExpiresAt : null,
                responseDueAt: typeof r.responseDueAt === 'string' ? r.responseDueAt : null,
                cancellation: typeof r.cancellation === 'string' ? r.cancellation : '',
            };
            setCreated(made);
            document.getElementById('reserver')?.scrollIntoView({ block: 'start' });
            // État exact (garde de la table, paiement possible) : relu, sans bloquer la confirmation
            fetchJson<{ reservation?: ClientTableReservationDetail }>(`/api/tables/reservations/${made.id}`)
                .then((d) => { if (d.reservation) setDetail(d.reservation); })
                .catch(() => undefined);
        } catch {
            setReserveError('Connexion impossible. Vérifiez votre réseau, puis réessayez.');
        } finally {
            setSubmitting(false);
        }
    };

    if (created) {
        return <BookingConfirmation created={created} detail={detail} manual={manual} responseMinutes={venue.rules.responseMinutes} />;
    }

    const capacityHint = venue.maxCapacity > 0
        ? `Tables de ${Math.max(1, venue.minCapacity)} à ${venue.maxCapacity} personnes. Plus de 50 ? Contactez l’établissement.`
        : undefined;
    const cta = deposit ? 'Réserver et payer l’acompte' : manual ? 'Envoyer la demande' : 'Réserver';

    return (
        <div className="space-y-6">
            <div className="space-y-2">
                <h2 id="reserver-titre" className="text-xl font-bold text-foreground-strong">Réserver une table</h2>
                <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                    <li className="flex items-center gap-1.5 font-semibold text-foreground-strong">
                        <Wallet size={16} className="text-muted-foreground" aria-hidden="true" />
                        {deposit ? `Acompte ${fcfaText(venue.depositPerPerson)} par personne` : 'Gratuit'}
                    </li>
                    <li className={manual ? 'flex items-center gap-1.5 font-semibold text-info-text' : 'flex items-center gap-1.5 font-semibold text-success-text'}>
                        {manual ? <Info size={16} aria-hidden="true" /> : <Zap size={16} aria-hidden="true" />}
                        {manual ? 'Sur acceptation' : 'Confirmation immédiate'}
                    </li>
                </ul>
            </div>

            <Step n={1} title="Combien de personnes ?">
                <GuestStepper value={guests} onChange={(n) => update({ guests: n })} hint={capacityHint} />
            </Step>

            <Step n={2} title="Quel jour ?">
                <DayStrip value={date} today={today} onChange={(d) => update({ date: d })} />
            </Step>

            <Step
                n={3}
                title="À quelle heure ?"
                aside={venue.slotMinutes > 0 ? <p className="text-sm text-muted-foreground">{`Table pour ${durationText(venue.slotMinutes)}`}</p> : undefined}
            >
                {venue.zones.length > 0 && (
                    <div role="group" aria-label="Zone (facultatif)" className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
                        <FilterChip pressed={!zoneId} onClick={() => update({ zoneId: '', tableId: '' })}>Toutes les zones</FilterChip>
                        {venue.zones.map((z) => (
                            <FilterChip key={z.id} pressed={zoneId === z.id} onClick={() => update({ zoneId: zoneId === z.id ? '' : z.id, tableId: '' })}>
                                <MapPinned size={16} aria-hidden="true" />
                                {z.name}
                            </FilterChip>
                        ))}
                    </div>
                )}
                <p className="sr-only" role="status">{slots.pending ? 'Recherche des créneaux…' : ''}</p>
                <SlotPicker
                    result={slotsData}
                    loading={slots.pending || slots.key !== slotsKey}
                    failed={slots.key === slotsKey ? slots.error : null}
                    onRetry={() => setSlotsAttempt((n) => n + 1)}
                    selected={time}
                    onSelect={(t) => update({ time: t, tableId: '' })}
                    guests={guests}
                    isToday={date === today}
                    onNextDay={() => update({ date: nextDay(date), time: '', tableId: '' })}
                />
                {notice && (
                    <p role="status" className="rounded-xl border border-warning-border bg-warning-soft px-3 py-2 text-sm font-semibold text-warning-text">{notice}</p>
                )}
            </Step>

            {showPlan && (
                <Step
                    n={4}
                    title="Votre table (facultatif)"
                    aside={tableId ? (
                        <Button variant="ghost" size="sm" leftIcon={<X size={16} aria-hidden="true" />} onClick={() => update({ tableId: '' })}>
                            Laisser l’établissement choisir
                        </Button>
                    ) : undefined}
                >
                    {floor.error && floor.key === floorKey ? (
                        <StatusBanner tone="warning" title="Le plan n’a pas pu être chargé" action={<Button variant="secondary" size="sm" onClick={() => setFloorAttempt((n) => n + 1)}>Réessayer</Button>}>
                            {`${floor.error} Vous pouvez réserver sans choisir de table : l’établissement en attribue une.`}
                        </StatusBanner>
                    ) : floorData ? (
                        <div className={floor.pending ? 'space-y-3 opacity-60 transition-opacity duration-fast ease-standard' : 'space-y-3'}>
                            <p className="flex items-start gap-2 text-sm text-muted-foreground">
                                <LayoutGrid size={16} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
                                <span>Touchez une table libre pour la choisir. Sans choix, l’établissement vous en attribue une qui convient.</span>
                            </p>
                            <FloorPlan
                                tables={planTables}
                                zones={planZones}
                                mode="select"
                                selectedId={tableId || null}
                                onSelect={(id) => {
                                    const t = floorData.tables.find((x) => x.id === id);
                                    if (!t || t.state !== 'LIBRE') return;
                                    update({ tableId: id === tableId ? '' : id });
                                }}
                                ariaLabel={`Plan de salle de ${venue.name} à ${hmText(time)}`}
                            />
                            <p className="text-sm font-semibold text-foreground-strong" aria-live="polite">
                                {chosenTable ? `Table ${chosenTable.number} choisie · ${chosenTable.capacity} places` : 'Aucune table choisie'}
                            </p>
                        </div>
                    ) : (
                        <Skeleton className="aspect-[4/3] w-full rounded-xl" />
                    )}
                </Step>
            )}

            <Step n={showPlan ? 5 : 4} title="Une demande particulière ?">
                <Textarea
                    label="Demande particulière (facultatif)"
                    hideLabel
                    value={notes}
                    maxLength={NOTES_MAX}
                    showCount
                    rows={3}
                    placeholder="Par exemple : anniversaire, chaise haute, table au calme"
                    onChange={(e) => {
                        setNotes(e.target.value);
                        writeNotes(venue.id, e.target.value);
                    }}
                    hint="Transmise à l’établissement avec votre réservation."
                />
            </Step>

            <div className="space-y-4 rounded-2xl border border-border bg-muted p-4">
                <p className="flex items-start gap-2 text-sm font-semibold text-foreground-strong">
                    <CalendarClock size={18} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
                    <span>
                        {time
                            ? `${capitalize(dayText(date))} à ${hmText(time)} · ${guestsText(guests)}${chosenTable ? ` · table ${chosenTable.number}` : ''}`
                            : `${capitalize(dayText(date))} · ${guestsText(guests)} · choisissez une heure`}
                    </span>
                </p>
                {deposit ? (
                    <div aria-busy={quote.pending}>
                        <p className="sr-only" role="status">{quote.pending ? 'Calcul du montant…' : q ? `Total à payer : ${fcfaText(q.totalAmount)}.` : ''}</p>
                        {quote.error && quote.key === quoteKey ? (
                            <StatusBanner tone="danger" title="Montant momentanément indisponible" action={<Button variant="secondary" size="sm" onClick={() => setQuoteAttempt((n) => n + 1)}>Réessayer</Button>}>
                                {quote.error}
                            </StatusBanner>
                        ) : q ? (
                            <dl className={quote.pending ? 'divide-y divide-border opacity-60' : 'divide-y divide-border'}>
                                <AmountRow label={`Acompte (${guestsText(q.guests)})`} value={fcfaText(q.depositAmount)} />
                                <AmountRow label="Frais de service" value={fcfaText(q.serviceFeeAmount)} />
                                <AmountRow label="Total à payer" value={fcfaText(q.totalAmount)} strong />
                            </dl>
                        ) : (
                            <p className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Calculator size={16} aria-hidden="true" />
                                Calcul du montant…
                            </p>
                        )}
                    </div>
                ) : (
                    <p className="text-base font-bold text-foreground-strong">Gratuit : rien à payer pour réserver.</p>
                )}
            </div>

            {reserveError && (
                <StatusBanner tone="danger" title="Réservation non enregistrée" announce="alert">
                    {reserveError}
                </StatusBanner>
            )}

            <div className="space-y-2">
                <Button variant="gradient" size="lg" fullWidth disabled={!canReserve} isLoading={submitting} onClick={reserve}>
                    {cta}
                </Button>
                {!time && <p className="text-sm text-muted-foreground">Choisissez une heure pour réserver.</p>}
                {time && !authLoading && !user && <p className="text-sm text-muted-foreground">Vous allez vous connecter ; vos choix sont gardés.</p>}
                <p className="text-sm text-muted-foreground">
                    {deposit
                        ? `Après la réservation, la table vous est gardée ${minutesText(venue.rules.holdMinutes)}, le temps de payer l’acompte par Wave ou Orange Money.${manual ? ` L’établissement répond ensuite sous ${durationText(venue.rules.responseMinutes)}.` : ''}`
                        : manual
                            ? `L’établissement répond sous ${durationText(venue.rules.responseMinutes)}. Vous recevez un avis dès sa réponse.`
                            : 'Votre table est confirmée tout de suite.'}
                </p>
            </div>
        </div>
    );
}

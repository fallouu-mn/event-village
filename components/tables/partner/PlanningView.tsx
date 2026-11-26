'use client';

/**
 * Lot 11b : fiche de l'établissement = planning du jour en temps réel.
 *  - Fiche (GET /api/partner/venues/[id]) : nom, genre, ville, statut de validation en bandeau (refusé : motif et
 *    « Corriger et renvoyer » ; suspendu : motif), liens Modifier, Plan de salle, Fermetures, Recettes.
 *  - Planning (GET /api/partner/venues/[id]/planning?date=) relu toutes les 20 secondes tant que l'onglet est visible, et
 *    au retour sur l'onglet ; LiveIndicator (« Mis à jour à 14:32 » : relecture, pas d'abonnement temps réel, jamais « En direct », règle R49 ; « Hors ligne » sinon).
 *  - Jour choisi dans l'adresse (?date=), aujourd'hui par défaut ; demandes à accepter en tête (tous les jours, compte à
 *    rebours), puis la frise du jour par heure et les tables maintenant (plan en lecture si montré).
 *  - Nouvelle réservation entre deux lectures : surlignage bref, annonce polie « Nouvelle réservation : 4 personnes à
 *    20 h », signal discret (vibration ou petit bip) désactivable et gardé sur l'appareil.
 * Actions sur une réservation : useReservationActions (PATCH …/reservations/[id]) ; le planning est relu après chacune.
 * Page ouverte même service fermé (réservations existantes) : aucune garde d'interrupteur.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CalendarOff, LayoutGrid, MapPin, Pencil, PencilLine, RefreshCw, Store, Wallet } from 'lucide-react';
import { MISSING_VENUE_POSITION_TEXT } from '@/lib/places/place-texts';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ErrorState } from '@/components/ui/EmptyState';
import { IconButton } from '@/components/ui/IconButton';
import { LinkButton } from '@/components/ui/LinkButton';
import { LiveIndicator } from '@/components/ui/LiveIndicator';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { Switch } from '@/components/ui/Switch';
import { cn } from '@/components/ui/cn';
import { useServerData } from '@/components/partner/useServerData';
import type { RealtimeStatus } from '@/hooks/useRealtimeRefresh';
import { dakarToday, guestsText, hmText, instantHm } from '@/lib/tables/views';
import { DayStrip } from './DayStrip';
import { DayTimeline } from './DayTimeline';
import { PendingRequests } from './PendingRequests';
import { TablesNow } from './TablesNow';
import { BookingRowSkeleton, PlanningSkeleton } from './TablesSkeletons';
import { useClock } from './useClock';
import { useNewReservationSignal } from './useNewReservationSignal';
import { useReservationActions } from './useReservationActions';
import {
    capitalize, dayOf, relativeDay, tableFreed, toneBanner, toneVariant,
    type OwnVenue, type PartnerTableReservationView, type PlanningBody,
} from './venue-api';

const POLL_MS = 20_000;
const HIGHLIGHT_MS = 8_000;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** États qui font d'une réservation une vraie nouveauté à signaler (pas une attente de paiement qui peut expirer). */
const ANNOUNCED = new Set(['EN_ATTENTE_ACCEPTATION', 'CONFIRMEE', 'ARRIVEE']);

function newsText(fresh: PartnerTableReservationView[], date: string, today: string): string {
    const one = (r: PartnerTableReservationView) => {
        const when = r.date === date ? `à ${hmText(r.time)}` : `${relativeDay(r.date, today)} à ${hmText(r.time)}`;
        return `${guestsText(r.guests)} ${when}`;
    };
    const demands = fresh.filter((r) => r.state === 'EN_ATTENTE_ACCEPTATION');
    const confirmed = fresh.filter((r) => r.state !== 'EN_ATTENTE_ACCEPTATION');
    const parts: string[] = [];
    if (confirmed.length === 1) parts.push(`Nouvelle réservation : ${one(confirmed[0])}`);
    else if (confirmed.length > 1) parts.push(`${confirmed.length} nouvelles réservations : ${confirmed.map(one).join(', ')}`);
    if (demands.length === 1) parts.push(`Nouvelle demande à accepter : ${one(demands[0])}`);
    else if (demands.length > 1) parts.push(`${demands.length} nouvelles demandes à accepter : ${demands.map(one).join(', ')}`);
    return parts.join('. ');
}

function closureText(c: { startsAt: string; endsAt: string; reason: string | null }, date: string): string {
    const starts = c.startsAt.slice(0, 10) < date ? null : instantHm(`${c.startsAt.slice(0, 19)}Z`);
    const ends = c.endsAt.slice(0, 10) > date ? null : instantHm(`${c.endsAt.slice(0, 19)}Z`);
    if (!starts && !ends) return 'Fermeture exceptionnelle toute la journée';
    if (!starts) return `Fermeture exceptionnelle jusqu’à ${ends}`;
    if (!ends) return `Fermeture exceptionnelle à partir de ${starts}`;
    return `Fermeture exceptionnelle de ${starts} à ${ends}`;
}

export function PlanningView({ venueId, initialDate }: { venueId: string; initialDate: string | null }) {
    const editBase = `/partner/tables/edition/${encodeURIComponent(venueId)}`;
    const [clientToday] = useState(() => dakarToday());
    const [date, setDate] = useState<string>(initialDate && DAY_RE.test(initialDate) ? initialDate : clientToday);
    const [tick, setTick] = useState(0);
    const [online, setOnline] = useState(true);

    const venueQ = useServerData<{ venue: OwnVenue }>(`/api/partner/venues/${encodeURIComponent(venueId)}`);
    const planQ = useServerData<PlanningBody>(`/api/partner/venues/${encodeURIComponent(venueId)}/planning?date=${date}`, tick);
    const { data, error, loading, refreshing, updatedAt, reload } = planQ;
    // Dernier planning lu : garde les demandes (tous les jours) et l'en-tête affichés pendant un changement de jour
    const lastPlan = useRef<PlanningBody | null>(null);
    if (data) lastPlan.current = data;

    // ── Relecture toutes les 20 s (onglet visible) et au retour sur l'onglet ───────────────────────────────
    useEffect(() => {
        let timer: ReturnType<typeof setInterval> | null = null;
        const start = () => {
            if (timer === null) timer = setInterval(() => setTick((n) => n + 1), POLL_MS);
        };
        const stop = () => {
            if (timer !== null) clearInterval(timer);
            timer = null;
        };
        const onVisibility = () => {
            if (document.visibilityState === 'visible') {
                setTick((n) => n + 1);
                start();
            } else stop();
        };
        const onOnline = () => { setOnline(true); setTick((n) => n + 1); };
        const onOffline = () => setOnline(false);
        setOnline(navigator.onLine);
        if (document.visibilityState === 'visible') start();
        document.addEventListener('visibilitychange', onVisibility);
        window.addEventListener('online', onOnline);
        window.addEventListener('offline', onOffline);
        return () => {
            stop();
            document.removeEventListener('visibilitychange', onVisibility);
            window.removeEventListener('online', onOnline);
            window.removeEventListener('offline', onOffline);
        };
    }, []);

    // ── Heure du serveur : écart mesuré à chaque lecture ─────────────────────────────────────────────────
    const [skewMs, setSkewMs] = useState(0);
    useEffect(() => {
        const server = data?.now ? Date.parse(data.now) : NaN;
        if (!Number.isNaN(server)) setSkewMs(server - Date.now());
    }, [data]);
    const now = useClock(skewMs, 30_000);
    const serverNow = (data ?? lastPlan.current)?.now;
    const today = serverNow ? dayOf(Date.parse(serverNow)) : clientToday;
    const isToday = date === today;

    // ── Jour choisi dans l'adresse (lien partageable, retour arrière du navigateur) ──────────────────────
    const chooseDay = useCallback((day: string) => {
        setDate(day);
        const url = new URL(window.location.href);
        if (day === today) url.searchParams.delete('date');
        else url.searchParams.set('date', day);
        window.history.replaceState(window.history.state, '', url.toString());
    }, [today]);

    // ── Nouvelles réservations entre deux lectures ──────────────────────────────────────────────────────
    const signal = useNewReservationSignal();
    const known = useRef<{ date: string; ids: Set<string> } | null>(null);
    const [highlighted, setHighlighted] = useState<ReadonlySet<string>>(new Set());
    const [news, setNews] = useState('');
    const timers = useRef<Array<ReturnType<typeof setTimeout>>>([]);

    useEffect(() => () => timers.current.forEach(clearTimeout), []);

    useEffect(() => {
        if (!data || data.date !== date) return;
        const all = [...data.pending, ...data.reservations];
        const announced = all.filter((r) => ANNOUNCED.has(r.state));
        const ids = new Set(announced.map((r) => r.id));
        const prev = known.current;
        known.current = { date: data.date, ids: prev && prev.date === data.date ? new Set([...prev.ids, ...ids]) : ids };
        if (!prev || prev.date !== data.date) return;
        const seen = new Set<string>();
        const fresh = announced.filter((r) => !prev.ids.has(r.id) && !seen.has(r.id) && seen.add(r.id));
        if (fresh.length === 0) return;
        const freshIds = fresh.map((r) => r.id);
        setHighlighted((h) => new Set([...h, ...freshIds]));
        setNews(newsText(fresh, data.date, today));
        signal.ring();
        timers.current.push(setTimeout(() => {
            setHighlighted((h) => {
                const next = new Set(h);
                freshIds.forEach((id) => next.delete(id));
                return next;
            });
        }, HIGHLIGHT_MS));
        timers.current.push(setTimeout(() => setNews(''), HIGHLIGHT_MS + 4_000));
        // signal.ring change avec le choix de la personne : seule l'arrivée de nouvelles données déclenche ce calcul
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [data]);

    const actions = useReservationActions({ onDone: () => setTick((n) => n + 1) });

    const pending = useMemo(() => ((data ?? lastPlan.current)?.pending ?? []).filter((r) => r.state === 'EN_ATTENTE_ACCEPTATION'), [data]);
    const reservations = useMemo(() => data?.reservations ?? [], [data]);

    const summary = useMemo(() => {
        const open = reservations.filter((r) => !tableFreed(r.state) && r.state !== 'EN_ATTENTE_PAIEMENT');
        return {
            count: open.length,
            guests: open.reduce((n, r) => n + r.guests, 0),
            arrived: open.filter((r) => r.state === 'ARRIVEE').length,
            coming: open.filter((r) => r.clientComing && r.state === 'CONFIRMEE').length,
        };
    }, [reservations]);

    // ── Rendu ─────────────────────────────────────────────────────────────────────────────────────────
    const venue = venueQ.data?.venue ?? null;
    // Changement de jour : la page reste en place, seule la frise montre son squelette
    const dayLoading = loading && !data;

    if ((dayLoading && lastPlan.current === null) || (venueQ.loading && !venue)) {
        return (
            <div role="status" aria-busy="true">
                <PlanningSkeleton />
                <span className="sr-only">Chargement du planning…</span>
            </div>
        );
    }

    if (!venue || (!data && error && lastPlan.current === null)) {
        return (
            <div className="mx-auto w-full max-w-6xl">
                <PageHeader back={{ href: '/partner/tables', label: 'Mes établissements' }} title="Planning" />
                <ErrorState
                    title="Planning indisponible"
                    description={(venue ? error : venueQ.error) ?? 'Cet établissement n’a pas pu être chargé.'}
                    onRetry={() => { void venueQ.reload(); void reload(); }}
                    isRetrying={refreshing || venueQ.refreshing}
                />
            </div>
        );
    }

    const status: RealtimeStatus = !online || (error && data) ? 'offline' : updatedAt ? 'live' : 'connecting';
    const updatedTime = updatedAt ? instantHm(updatedAt.toISOString()) : null;
    const refused = venue.status === 'REFUSEE';
    const suspended = venue.status === 'SUSPENDUE';
    const showPlan = (data?.venue.floorPlan ?? venue.floorPlan) === true;
    const dayLabel = capitalize(relativeDay(date, today));

    return (
        <div className="mx-auto w-full max-w-6xl pb-10">
            <PageHeader
                back={{ href: '/partner/tables', label: 'Mes établissements' }}
                eyebrow={(
                    <>
                        <Badge variant={toneVariant(venue.statusTone)}>{venue.statusLabel}</Badge>
                        {!venue.isActive && <Badge variant="neutral">Désactivé</Badge>}
                    </>
                )}
                title={venue.name}
                description={[venue.kindLabel, venue.city].filter(Boolean).join(' · ') || undefined}
                actions={(
                    <>
                        {refused ? (
                            <LinkButton href={editBase} leftIcon={<PencilLine size={18} />}>Corriger et renvoyer</LinkButton>
                        ) : (
                            <LinkButton href={editBase} variant="secondary" size="sm" leftIcon={<Pencil size={16} />}>Modifier</LinkButton>
                        )}
                        <LinkButton href={`${editBase}/plan`} variant="secondary" size="sm" leftIcon={<LayoutGrid size={16} />}>Plan de salle</LinkButton>
                        <LinkButton href={`${editBase}/fermetures`} variant="secondary" size="sm" leftIcon={<CalendarOff size={16} />}>Fermetures</LinkButton>
                        <LinkButton href="/partner/tables/recettes" variant="ghost" size="sm" leftIcon={<Wallet size={16} />}>Recettes</LinkButton>
                    </>
                )}
            />

            {/* Lot Carte B3 (décision du client du 25/11) : établissement sans position, absent de la carte */}
            {(venue.latitude === null || venue.longitude === null) && !refused && (
                <StatusBanner
                    tone="warning"
                    title={MISSING_VENUE_POSITION_TEXT}
                    action={<LinkButton href={editBase} variant="secondary" size="sm" leftIcon={<MapPin size={16} />}>Placer sur la carte</LinkButton>}
                    className="mb-4"
                >
                    Il reste visible dans la liste des restaurants et par son lien.
                </StatusBanner>
            )}

            {refused ? (
                <StatusBanner tone="danger" title="Établissement refusé par l’équipe d’Event Village" className="mb-4">
                    <span className="block font-semibold">Motif du refus :</span>
                    <span className="mt-1 block whitespace-pre-line break-words rounded-xl border border-danger-border bg-card px-3 py-2 text-base font-medium text-foreground-strong">
                        {venue.reason?.trim() || 'Aucun motif n’a été transmis.'}
                    </span>
                    <span className="mt-2 block">Touchez « Corriger et renvoyer » : faites vos corrections, puis renvoyez l’établissement en validation.</span>
                </StatusBanner>
            ) : venue.status !== 'VALIDEE' ? (
                <StatusBanner tone={suspended ? 'suspended' : toneBanner(venue.statusTone)} title={venue.statusLabel} className="mb-4">
                    <span className="block">{venue.statusHint}</span>
                    {suspended && venue.reason && (
                        <span className="mt-2 block whitespace-pre-line break-words rounded-xl border border-border bg-card px-3 py-2 text-base font-medium text-foreground-strong">{venue.reason}</span>
                    )}
                </StatusBanner>
            ) : !venue.isActive ? (
                <StatusBanner tone="neutral" title="Établissement désactivé" className="mb-4">
                    Les clients ne peuvent plus réserver. Les réservations déjà prises restent à gérer ici.
                </StatusBanner>
            ) : null}

            {/* Barre du jour : état de la mise à jour, signal et choix du jour */}
            <div className="mb-5 flex flex-col gap-4 rounded-2xl border border-border bg-card p-3 shadow-sm sm:p-4">
                <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                    <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
                        <h2 className="text-lg font-bold text-foreground-strong">{dayLabel}</h2>
                        <LiveIndicator status={status} salesLive={false} updatedTime={updatedTime} />
                    </div>
                    <IconButton aria-label="Actualiser le planning" variant="secondary" onClick={() => setTick((n) => n + 1)} disabled={refreshing}>
                        <RefreshCw size={18} className={cn(refreshing && 'motion-safe:animate-spin')} />
                    </IconButton>
                </div>
                <DayStrip value={date} today={today} onChange={chooseDay} />
            </div>

            {/* Annonce des nouveautés : toujours présente (lue poliment), visible seulement quand elle parle */}
            <div
                role="status"
                aria-live="polite"
                aria-atomic="true"
                className={cn(news ? 'mb-4 flex items-center gap-2 rounded-xl border border-primary bg-primary-soft px-4 py-3 text-sm font-semibold text-primary-text ev-fade-in' : 'sr-only')}
            >
                {news}
            </div>

            {error && data && (
                <p role="alert" className="mb-4 text-sm font-medium text-danger-text">
                    Le planning n’a pas pu être relu : il peut ne pas être à jour. Nouvel essai dans quelques secondes.
                </p>
            )}

            {(data?.closures ?? []).map((c) => (
                <StatusBanner key={`${c.startsAt}-${c.endsAt}`} tone="warning" icon={<CalendarOff size={20} />} title={closureText(c, date)} className="mb-4">
                    {c.reason ? `Motif donné aux clients : ${c.reason}` : undefined}
                </StatusBanner>
            ))}

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
                <div className="flex min-w-0 flex-col gap-6 lg:col-span-3">
                    <PendingRequests items={pending} today={today} skewMs={skewMs} actions={actions} highlighted={highlighted} />

                    <section aria-labelledby="planning-frise" className="flex flex-col gap-3">
                        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                            <h2 id="planning-frise" className="text-lg font-bold text-foreground-strong">
                                {isToday ? 'Réservations du jour' : `Réservations du ${relativeDay(date, today)}`}
                            </h2>
                            {summary.count > 0 && (
                                <p className="text-sm text-muted-foreground tabular-nums">
                                    {[
                                        summary.count === 1 ? '1 réservation' : `${summary.count} réservations`,
                                        guestsText(summary.guests),
                                        summary.arrived > 0 ? `${summary.arrived} arrivée${summary.arrived > 1 ? 's' : ''}` : null,
                                        summary.coming > 0 ? `${summary.coming} venue${summary.coming > 1 ? 's' : ''} confirmée${summary.coming > 1 ? 's' : ''}` : null,
                                    ].filter(Boolean).join(' · ')}
                                </p>
                            )}
                        </div>
                        {dayLoading ? (
                            <div role="status" aria-busy="true" className="flex flex-col gap-2">
                                {Array.from({ length: 3 }).map((_, i) => <BookingRowSkeleton key={i} />)}
                                <span className="sr-only">Chargement du planning du jour…</span>
                            </div>
                        ) : !data && error ? (
                            <ErrorState
                                title="Ce jour n’a pas pu être chargé"
                                description={error}
                                onRetry={() => void reload()}
                                isRetrying={refreshing}
                            />
                        ) : (
                            <DayTimeline date={date} items={reservations} now={now} isToday={isToday} actions={actions} highlighted={highlighted} />
                        )}
                    </section>
                </div>

                <aside aria-label="Tables et réglages de l’écran" className="flex min-w-0 flex-col gap-6 lg:col-span-2">
                    {isToday ? (
                        <TablesNow tables={data?.tables ?? []} zones={data?.zones ?? []} reservations={reservations} now={now} showPlan={showPlan} />
                    ) : (
                        <p className="flex items-start gap-2 rounded-2xl border border-border bg-card p-4 text-sm leading-relaxed text-muted-foreground">
                            <LayoutGrid size={18} className="mt-0.5 flex-shrink-0" aria-hidden="true" />
                            L’état des tables en direct s’affiche sur le planning d’aujourd’hui.
                        </p>
                    )}

                    <section aria-labelledby="planning-reglages" className="rounded-2xl border border-border bg-card p-4">
                        <h2 id="planning-reglages" className="sr-only">Réglages de l’écran</h2>
                        <Switch
                            label="Signal des nouvelles réservations"
                            checked={signal.enabled}
                            onChange={signal.setEnabled}
                            description={signal.mode === 'vibration'
                                ? 'Une courte vibration à chaque nouvelle réservation. Choix gardé sur cet appareil.'
                                : signal.mode === 'son'
                                    ? 'Un petit bip à chaque nouvelle réservation. Choix gardé sur cet appareil.'
                                    : 'Un petit bip à chaque nouvelle réservation, dès que vous avez touché la page une fois. Choix gardé sur cet appareil.'}
                        />
                    </section>

                    <div className="flex flex-col gap-1 text-sm text-muted-foreground">
                        <p className="flex items-center gap-1.5">
                            <Store size={16} aria-hidden="true" />
                            Gardez cette page ouverte pendant le service : elle se met à jour toute seule.
                        </p>
                        {!isToday && (
                            <Button variant="ghost" size="sm" className="self-start" onClick={() => chooseDay(today)}>
                                Revenir à aujourd’hui
                            </Button>
                        )}
                    </div>
                </aside>
            </div>

            {actions.dialogs}
        </div>
    );
}

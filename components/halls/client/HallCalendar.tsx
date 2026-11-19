'use client';

/**
 * Lot 10b (point 2) : calendrier des disponibilités d'une salle, un mois à la fois (GET /api/halls/[id]/calendar,
 * du premier au dernier jour du mois affiché). Jour pris en entier : barré, grisé et non choisissable ; jour pris en
 * partie (réservation à l'heure) : souligné en pointillés, heures prises dites sous le calendrier ; la couleur ne porte
 * jamais seule l'information (légende, nom complet de chaque jour pour les lecteurs d'écran). Toucher un jour libre le
 * choisit pour la réservation (date gardée dans l'adresse, lue par le panneau de réservation).
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { LinkButton } from '@/components/ui/LinkButton';
import { Skeleton } from '@/components/ui/Skeleton';
import { StatusBanner } from '@/components/ui/StatusBanner';
import { cn } from '@/components/ui/cn';
import { errorMessage, fetchJson } from '@/components/partner/fetch-json';
import { longDate } from '@/lib/halls/views';
import type { BusySlot } from '@/lib/halls/queries';
import { DAY_RE, writeChoice } from './booking-url';
import { capitalize } from './format';

const MONTHS_AHEAD = 24;
const WEEKDAYS = ['lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.', 'dim.'];

interface DayState {
    full: boolean;
    hours: string[];
}

/** « AAAA-MM » → premier jour, dernier jour, nombre de jours, colonne du 1er (lundi = 0). */
function monthInfo(month: string) {
    const [y, m] = month.split('-').map(Number);
    const first = new Date(Date.UTC(y, m - 1, 1));
    const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const offset = (first.getUTCDay() + 6) % 7;
    const pad = (n: number) => String(n).padStart(2, '0');
    return { y, m, days, offset, from: `${y}-${pad(m)}-01`, to: `${y}-${pad(m)}-${pad(days)}`, day: (d: number) => `${y}-${pad(m)}-${pad(d)}` };
}

function shiftMonth(month: string, delta: number): string {
    const [y, m] = month.split('-').map(Number);
    const d = new Date(Date.UTC(y, m - 1 + delta, 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(month: string): string {
    const [y, m] = month.split('-').map(Number);
    return capitalize(new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m - 1, 1))));
}

/** Jours pris d'un mois, à partir des créneaux de la route (journée entière si les heures sont absentes). */
function busyMap(busy: BusySlot[], from: string, to: string): Map<string, DayState> {
    const map = new Map<string, DayState>();
    const get = (day: string) => {
        const cur = map.get(day) ?? { full: false, hours: [] };
        map.set(day, cur);
        return cur;
    };
    for (const b of busy) {
        if (!DAY_RE.test(b.startDate) || !DAY_RE.test(b.endDate)) continue;
        if (b.startTime && b.endTime) {
            if (b.startDate >= from && b.startDate <= to) get(b.startDate).hours.push(`${b.startTime} à ${b.endTime}`);
            continue;
        }
        const cursor = new Date(`${b.startDate}T00:00:00Z`);
        const end = new Date(`${b.endDate}T00:00:00Z`);
        for (let i = 0; i < 400 && cursor <= end; i += 1) {
            const day = cursor.toISOString().slice(0, 10);
            if (day >= from && day <= to) get(day).full = true;
            cursor.setUTCDate(cursor.getUTCDate() + 1);
        }
    }
    return map;
}

export function HallCalendar({ hallId, today, hourly }: { hallId: string; today: string; hourly: boolean }) {
    const sp = useSearchParams();
    const selectedRaw = sp?.get('date') ?? '';
    const selected = DAY_RE.test(selectedRaw) ? selectedRaw : '';
    const todayMonth = today.slice(0, 7);
    const lastMonth = shiftMonth(todayMonth, MONTHS_AHEAD);
    const [month, setMonth] = useState(() => (selected && selected >= today ? selected.slice(0, 7) : todayMonth));
    const [cache, setCache] = useState<Record<string, BusySlot[]>>({});
    const [loading, setLoading] = useState(false);
    const [failure, setFailure] = useState<string | null>(null);
    const ctrl = useRef<AbortController | null>(null);

    const info = useMemo(() => monthInfo(month), [month]);

    const load = useCallback(async (m: string) => {
        ctrl.current?.abort();
        const c = new AbortController();
        ctrl.current = c;
        const mi = monthInfo(m);
        setLoading(true);
        setFailure(null);
        try {
            const body = await fetchJson<{ busy?: BusySlot[] }>(`/api/halls/${hallId}/calendar?from=${mi.from}&to=${mi.to}`, { signal: c.signal });
            if (c.signal.aborted) return;
            setCache((prev) => ({ ...prev, [m]: Array.isArray(body.busy) ? body.busy : [] }));
        } catch (err) {
            if (c.signal.aborted) return;
            setFailure(errorMessage(err, 'Le calendrier n’a pas pu être chargé.'));
        } finally {
            if (!c.signal.aborted) setLoading(false);
        }
    }, [hallId]);

    useEffect(() => {
        if (cache[month] === undefined) void load(month);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [month, load]);

    useEffect(() => () => ctrl.current?.abort(), []);

    // Le mois suit la date choisie dans le panneau de réservation
    useEffect(() => {
        if (selected && selected >= today && selected.slice(0, 7) !== month && selected.slice(0, 7) <= lastMonth) setMonth(selected.slice(0, 7));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selected]);

    const busy = cache[month];
    const states = useMemo(() => (busy ? busyMap(busy, info.from, info.to) : new Map<string, DayState>()), [busy, info]);
    const hasPartial = Array.from(states.values()).some((s) => !s.full && s.hours.length > 0);
    const selectedState = selected ? states.get(selected) : undefined;
    const label = monthLabel(month);

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between gap-2">
                <IconButton
                    aria-label="Mois précédent"
                    variant="secondary"
                    disabled={month <= todayMonth}
                    onClick={() => setMonth((m) => shiftMonth(m, -1))}
                >
                    <ChevronLeft size={20} aria-hidden="true" />
                </IconButton>
                <h3 className="text-lg font-bold text-foreground-strong" aria-live="polite">{label}</h3>
                <IconButton
                    aria-label="Mois suivant"
                    variant="secondary"
                    disabled={month >= lastMonth}
                    onClick={() => setMonth((m) => shiftMonth(m, 1))}
                >
                    <ChevronRight size={20} aria-hidden="true" />
                </IconButton>
            </div>

            {failure ? (
                <StatusBanner
                    tone="danger"
                    title="Calendrier indisponible"
                    announce="alert"
                    action={<Button variant="secondary" size="sm" onClick={() => void load(month)} isLoading={loading}>Réessayer</Button>}
                >
                    {failure}
                </StatusBanner>
            ) : (
                <div aria-busy={loading || busy === undefined}>
                    <div className="grid grid-cols-7 gap-1 pb-1" aria-hidden="true">
                        {WEEKDAYS.map((d) => (
                            <span key={d} className="text-center text-sm font-semibold text-muted-foreground">{d}</span>
                        ))}
                    </div>
                    {busy === undefined ? (
                        <div className="grid grid-cols-7 gap-1">
                            {Array.from({ length: 35 }).map((_, i) => (
                                <Skeleton key={i} className="h-11 rounded-lg" />
                            ))}
                            <span className="sr-only" role="status">Chargement du calendrier…</span>
                        </div>
                    ) : (
                        <ul className="grid grid-cols-7 gap-1" aria-label={`Jours de ${label}`}>
                            {Array.from({ length: info.offset }).map((_, i) => (
                                <li key={`vide-${i}`} aria-hidden="true" />
                            ))}
                            {Array.from({ length: info.days }).map((_, i) => {
                                const day = info.day(i + 1);
                                const st = states.get(day);
                                const past = day < today;
                                const full = Boolean(st?.full);
                                const partial = !full && Boolean(st?.hours.length);
                                const isSelected = day === selected;
                                const isToday = day === today;
                                const words = [
                                    capitalize(longDate(day)),
                                    isToday ? 'aujourd’hui' : null,
                                    past ? 'passé' : full ? 'déjà réservé' : partial ? `pris en partie, de ${st?.hours.join(', de ')}` : 'libre',
                                    isSelected ? 'choisi' : null,
                                ].filter(Boolean).join(', ');
                                return (
                                    <li key={day}>
                                        <button
                                            type="button"
                                            disabled={past || full}
                                            aria-pressed={isSelected}
                                            aria-label={words}
                                            onClick={() => writeChoice({ date: day })}
                                            className={cn(
                                                'flex h-11 w-full items-center justify-center rounded-lg border text-sm tabular-nums transition-colors duration-fast ease-standard focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                                                isSelected
                                                    ? 'border-primary bg-primary font-bold text-primary-foreground'
                                                    : past
                                                        ? 'cursor-not-allowed border-transparent text-muted-foreground opacity-60'
                                                        : full
                                                            ? 'cursor-not-allowed border-transparent bg-muted text-muted-foreground line-through decoration-2'
                                                            : 'border-border bg-card font-semibold text-foreground-strong hover:border-foreground-strong',
                                                partial && !isSelected && 'underline decoration-dotted decoration-2 underline-offset-4',
                                                isToday && !isSelected && 'border-foreground-strong',
                                            )}
                                        >
                                            {i + 1}
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>
            )}

            <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground" aria-label="Légende du calendrier">
                <li className="flex items-center gap-2">
                    <span aria-hidden="true" className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-border bg-card text-sm font-semibold text-foreground-strong">5</span>
                    Libre
                </li>
                <li className="flex items-center gap-2">
                    <span aria-hidden="true" className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-muted text-sm text-muted-foreground line-through decoration-2">5</span>
                    Déjà réservé
                </li>
                {hasPartial && (
                    <li className="flex items-center gap-2">
                        <span aria-hidden="true" className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-border bg-card text-sm font-semibold text-foreground-strong underline decoration-dotted decoration-2 underline-offset-4">5</span>
                        Pris en partie (à l’heure)
                    </li>
                )}
                <li className="flex items-center gap-2">
                    <span aria-hidden="true" className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground">5</span>
                    Votre date
                </li>
            </ul>

            {selected && (
                <div className="space-y-3 rounded-xl border border-border bg-muted p-4" role="status">
                    <p className="text-base text-foreground">
                        {'Date choisie : '}
                        <span className="font-semibold text-foreground-strong">{capitalize(longDate(selected))}</span>
                    </p>
                    {selectedState?.full && (
                        <p className="text-sm font-semibold text-danger-text">Ce jour est déjà réservé : choisissez une autre date.</p>
                    )}
                    {selectedState && !selectedState.full && selectedState.hours.length > 0 && (
                        <p className="text-sm text-foreground">
                            {`Déjà pris ce jour-là : de ${selectedState.hours.join(', de ')}.`}
                            {hourly ? ' Vous pouvez réserver à l’heure en dehors de ces horaires.' : ' La réservation à la journée n’est pas possible ce jour-là.'}
                        </p>
                    )}
                    <LinkButton href="#reserver" variant="secondary" size="sm" className="lg:hidden">
                        Continuer la réservation
                    </LinkButton>
                </div>
            )}
        </div>
    );
}

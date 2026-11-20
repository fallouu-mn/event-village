'use client';

/**
 * Lot 10b (point 3) : calendrier des réservations d'une salle, pour sa propriétaire.
 * Vue d'un mois navigable (lundi en premier) et liste des réservations du mois, lues par
 * GET /api/partner/halls/reservations?hall=<id>&from=<1er du mois>&to=<dernier jour> (31 jours au plus, sous la limite
 * de 92 de la route). Un jour tenu par une réservation porte un repère plein, un jour qui n'a que des réservations
 * annulées un repère en pointillés, et son nom lu dit le nombre de réservations : la couleur ne porte jamais seule
 * l'information. Toucher un jour réservé filtre la liste sur ce jour ; chaque réservation ouvre son détail.
 * Dates de Dakar (UTC+0, sans heure d'été) : les jours se comparent en « AAAA-MM-JJ ».
 */
import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, User } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ErrorState } from '@/components/ui/EmptyState';
import { IconButton } from '@/components/ui/IconButton';
import { Skeleton } from '@/components/ui/Skeleton';
import { cn } from '@/components/ui/cn';
import { useServerData } from '@/components/partner/useServerData';
import { fcfaText, longDate } from '@/lib/halls/views';
import { periodOf, toneVariant, type PartnerReservation } from './hall-api';

const WEEKDAYS: ReadonlyArray<{ short: string; long: string }> = [
    { short: 'Lun', long: 'lundi' },
    { short: 'Mar', long: 'mardi' },
    { short: 'Mer', long: 'mercredi' },
    { short: 'Jeu', long: 'jeudi' },
    { short: 'Ven', long: 'vendredi' },
    { short: 'Sam', long: 'samedi' },
    { short: 'Dim', long: 'dimanche' },
];

const pad = (n: number) => String(n).padStart(2, '0');
const dayKey = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;

function todayKey(): string {
    return new Date().toISOString().slice(0, 10);
}

function monthLabel(y: number, m: number): string {
    return new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(y, m, 1)));
}

/** « sam. 14 déc. » (bouton d'un jour réservé sur téléphone). */
function shortDay(key: string): string {
    return new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })
        .format(new Date(`${key}T00:00:00Z`));
}

function countText(n: number): string {
    return n === 1 ? '1 réservation' : `${n} réservations`;
}

interface DayCell {
    key: string;
    day: number;
    live: number;
    all: number;
}

export function HallCalendar({ hallId }: { hallId: string }) {
    const today = todayKey();
    const [month, setMonth] = useState(() => ({ y: Number(today.slice(0, 4)), m: Number(today.slice(5, 7)) - 1 }));
    const [selected, setSelected] = useState<string | null>(null);

    const daysInMonth = new Date(Date.UTC(month.y, month.m + 1, 0)).getUTCDate();
    const from = dayKey(month.y, month.m, 1);
    const to = dayKey(month.y, month.m, daysInMonth);
    const url = `/api/partner/halls/reservations?hall=${encodeURIComponent(hallId)}&from=${from}&to=${to}`;
    const { data, error, loading, refreshing, reload } = useServerData<{ reservations: PartnerReservation[] }>(url);
    const reservations = useMemo(() => (Array.isArray(data?.reservations) ? data.reservations : []), [data]);

    const cells = useMemo<DayCell[]>(() => {
        const out: DayCell[] = [];
        for (let d = 1; d <= daysInMonth; d += 1) {
            const key = dayKey(month.y, month.m, d);
            const covering = reservations.filter((r) => r.startDate <= key && key <= r.endDate);
            out.push({ key, day: d, live: covering.filter((r) => r.live).length, all: covering.length });
        }
        return out;
    }, [reservations, daysInMonth, month]);

    const booked = cells.filter((c) => c.all > 0);
    const leading = (new Date(Date.UTC(month.y, month.m, 1)).getUTCDay() + 6) % 7;
    const label = monthLabel(month.y, month.m);
    const isCurrentMonth = from.slice(0, 7) === today.slice(0, 7);

    const shown = selected ? reservations.filter((r) => r.startDate <= selected && selected <= r.endDate) : reservations;

    const go = (delta: number) => {
        setSelected(null);
        setMonth(({ y, m }) => {
            const n = m + delta;
            return { y: y + Math.floor(n / 12), m: ((n % 12) + 12) % 12 };
        });
    };

    return (
        <section id="calendrier" aria-labelledby="calendrier-titre" className="scroll-mt-24 rounded-xl border border-border bg-card p-4 shadow-sm sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 id="calendrier-titre" className="text-xl font-bold text-foreground-strong">Calendrier des réservations</h2>
                {!isCurrentMonth && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => { setSelected(null); setMonth({ y: Number(today.slice(0, 4)), m: Number(today.slice(5, 7)) - 1 }); }}
                    >
                        Revenir à ce mois-ci
                    </Button>
                )}
            </div>

            <div className="mt-4 flex items-center justify-between gap-2">
                <IconButton aria-label="Mois précédent" variant="secondary" onClick={() => go(-1)}>
                    <ChevronLeft size={20} />
                </IconButton>
                <p className="text-base font-semibold capitalize text-foreground-strong" aria-live="polite">{label}</p>
                <IconButton aria-label="Mois suivant" variant="secondary" onClick={() => go(1)}>
                    <ChevronRight size={20} />
                </IconButton>
            </div>

            {/* Téléphone : sept colonnes de 44 px ne tiennent pas ; les jours réservés du mois, qu'on touche pour filtrer */}
            <div className="mt-3 sm:hidden" aria-busy={loading}>
                {loading && !data ? (
                    <div className="flex flex-wrap gap-2">
                        <Skeleton className="h-11 w-28 rounded-lg" />
                        <Skeleton className="h-11 w-28 rounded-lg" />
                    </div>
                ) : booked.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{`Aucun jour réservé en ${label}.`}</p>
                ) : (
                    <ul className="flex flex-wrap gap-2" aria-label={`Jours réservés de ${label}`}>
                        {booked.map((c) => (
                            <li key={c.key}>
                                <button
                                    type="button"
                                    aria-pressed={selected === c.key}
                                    onClick={() => setSelected((s) => (s === c.key ? null : c.key))}
                                    className={cn(
                                        'inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm font-semibold text-foreground-strong transition-colors duration-fast ease-standard focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                                        c.live > 0 ? 'border-primary-text bg-primary-soft' : 'border-dashed border-input bg-card',
                                        selected === c.key && 'ring-2 ring-ring',
                                    )}
                                >
                                    <span
                                        aria-hidden="true"
                                        className={cn('h-1.5 w-5 rounded-full', c.live > 0 ? 'bg-primary' : 'border border-dashed border-muted-foreground')}
                                    />
                                    <span className={cn('tabular-nums', c.key === today && 'underline decoration-2 underline-offset-4')}>
                                        {`${shortDay(c.key)} · ${countText(c.all)}`}
                                    </span>
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            {/* Grille du mois : 7 colonnes à partir de sm */}
            <div className="mt-3 hidden sm:block" role="group" aria-label={`Jours de ${label}`} aria-busy={loading}>
                <div className="grid grid-cols-7 gap-1" aria-hidden="true">
                    {WEEKDAYS.map((w) => (
                        <div key={w.short} className="py-1 text-center text-sm font-semibold text-muted-foreground">
                            <abbr title={w.long} className="no-underline">{w.short}</abbr>
                        </div>
                    ))}
                </div>
                <ol className="grid grid-cols-7 gap-1">
                    {Array.from({ length: leading }).map((_, i) => <li key={`vide-${i}`} aria-hidden="true" />)}
                    {cells.map((c) => {
                        const isToday = c.key === today;
                        const name = `${longDate(c.key)}${isToday ? ', aujourd’hui' : ''}${c.all > 0 ? ` : ${countText(c.all)}` : ''}`;
                        const marker = c.live > 0 ? 'plein' : c.all > 0 ? 'annule' : null;
                        const body = (
                            <>
                                <span className={cn('tabular-nums', isToday && 'underline decoration-2 underline-offset-4')}>{c.day}</span>
                                <span
                                    aria-hidden="true"
                                    className={cn(
                                        'h-1.5 w-5 rounded-full',
                                        marker === 'plein' && 'bg-primary',
                                        marker === 'annule' && 'border border-dashed border-muted-foreground',
                                        marker === null && 'invisible',
                                    )}
                                />
                            </>
                        );
                        const base = 'flex min-h-11 w-full flex-col items-center justify-center gap-1 rounded-lg border text-sm sm:min-h-14';
                        return (
                            <li key={c.key}>
                                {c.all > 0 ? (
                                    <button
                                        type="button"
                                        aria-label={name}
                                        aria-pressed={selected === c.key}
                                        onClick={() => setSelected((s) => (s === c.key ? null : c.key))}
                                        className={cn(
                                            base,
                                            'cursor-pointer font-bold transition-colors duration-fast ease-standard focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                                            c.live > 0 ? 'border-primary-text bg-primary-soft text-foreground-strong' : 'border-dashed border-input bg-card text-foreground-strong',
                                            selected === c.key && 'ring-2 ring-ring',
                                        )}
                                    >
                                        {body}
                                    </button>
                                ) : (
                                    <div className={cn(base, 'border-transparent text-muted-foreground', isToday && 'border-border font-semibold text-foreground-strong')}>
                                        <span aria-hidden="true" className="contents">{body}</span>
                                        <span className="sr-only">{name}</span>
                                    </div>
                                )}
                            </li>
                        );
                    })}
                </ol>
            </div>

            <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground" aria-label="Légende du calendrier">
                <li className="flex items-center gap-2">
                    <span aria-hidden="true" className="h-1.5 w-5 rounded-full bg-primary" />
                    Jour réservé
                </li>
                <li className="flex items-center gap-2">
                    <span aria-hidden="true" className="h-1.5 w-5 rounded-full border border-dashed border-muted-foreground" />
                    Réservation annulée seulement
                </li>
                <li className="flex items-center gap-2">
                    <span aria-hidden="true" className="font-semibold text-foreground-strong underline decoration-2 underline-offset-4">12</span>
                    Aujourd’hui
                </li>
            </ul>

            <div className="mt-6 border-t border-border pt-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-base font-bold text-foreground-strong">
                        {selected ? `Réservations du ${longDate(selected)}` : `Réservations de ${label}`}
                    </h3>
                    {selected && (
                        <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>Voir tout le mois</Button>
                    )}
                </div>

                {loading && !data ? (
                    <div role="status" aria-busy="true" className="mt-3 flex flex-col gap-2">
                        <Skeleton className="h-20 w-full rounded-xl" />
                        <Skeleton className="h-20 w-full rounded-xl" />
                        <span className="sr-only">Chargement des réservations…</span>
                    </div>
                ) : error && !data ? (
                    <ErrorState
                        title="Réservations indisponibles"
                        description={error}
                        onRetry={() => void reload()}
                        isRetrying={refreshing}
                    />
                ) : shown.length === 0 ? (
                    <p className="mt-3 rounded-xl bg-muted px-4 py-3 text-sm text-muted-foreground">
                        {`Aucune réservation en ${label}.`}
                    </p>
                ) : (
                    <ul className="mt-3 flex flex-col gap-2">
                        {shown.map((r) => (
                            <li key={r.id}>
                                <Link
                                    href={`/partner/halls/reservations/${encodeURIComponent(r.id)}`}
                                    className="group flex min-h-11 items-center gap-3 rounded-xl border border-border bg-card p-3 transition-colors duration-fast ease-standard hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:p-4"
                                >
                                    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <Badge variant={toneVariant(r.stateTone)}>{r.stateLabel}</Badge>
                                        </div>
                                        <p className="break-words text-sm font-semibold text-foreground-strong">{periodOf(r)}</p>
                                        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                                            {r.clientName && (
                                                <span className="inline-flex items-center gap-1">
                                                    <User size={14} aria-hidden="true" />
                                                    {r.clientName}
                                                </span>
                                            )}
                                            <span className="tabular-nums">{`Payé : ${fcfaText(r.paidAmount)} sur ${fcfaText(r.totalAmount)}`}</span>
                                        </p>
                                    </div>
                                    <ChevronRight size={20} aria-hidden="true" className="flex-shrink-0 text-muted-foreground" />
                                    <span className="sr-only">Voir le détail</span>
                                </Link>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </section>
    );
}

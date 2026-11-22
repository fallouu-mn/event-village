'use client';

import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { CalendarDays, RefreshCw, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { cn } from '@/components/ui/cn';
import { MapEventCard, PosterDot } from '@/components/explore/MapEventCard';
import { mapUrl, readMapEvents } from '@/lib/events/map-client';
import type { PublicMapEvent } from '@/lib/events/map-shared';
import { DAY_MS, dayAriaLabel, dayLabel, eventsByDay, iso, monthLabel, monthStart, nextMonth, type DayRange } from '@/lib/events/calendar-days';

/**
 * Lot Carte B (B2) — vue Calendrier d'Explorer, chargée à la demande (jamais au premier chargement d'Explorer).
 *  - Mois qui défilent : le mois en cours et le suivant, puis un mois de plus à l'approche du bas (ou par le bouton), douze
 *    au plus. Chaque mois lit GET /api/events/carte sur sa période avec les filtres partagés.
 *  - Chaque jour avec événement montre une vignette ronde de l'affiche (petite image floutée et couleur déjà stockées :
 *    aucune grande image), plusieurs événements = vignettes empilées et « +n ». Aujourd'hui en orange, jours passés
 *    atténués. Un événement de plusieurs jours compte sur chacun de ses jours.
 *  - Toucher un jour ouvre une feuille avec ses événements (lien vers la fiche, où l'on achète).
 *  - Raccourcis « Ce week-end » (feuille du week-end : vendredi 18:00 → lundi, même règle que le filtre) et « Ce mois-ci ».
 *  - Lecteur d'écran : « samedi 13 décembre, 3 événements » sur chaque jour qui en a ; les jours vides sont muets, le mois
 *    dit combien de jours ont des événements.
 * Fuseau Africa/Dakar = UTC toute l'année : les jours se découpent en UTC.
 */

const MAX_MONTHS = 12;
const WEEKDAYS = [
    { short: 'L', long: 'lundi' }, { short: 'M', long: 'mardi' }, { short: 'M', long: 'mercredi' }, { short: 'J', long: 'jeudi' },
    { short: 'V', long: 'vendredi' }, { short: 'S', long: 'samedi' }, { short: 'D', long: 'dimanche' },
];

/**
 * Feuille d'un jour : élément natif <dialog> ouvert en fenêtre modale (showModal : focus placé dedans et gardé, Échap
 * ferme, fond assombri, reste de la page inerte), en bas de l'écran sur téléphone, centrée sur ordinateur ; à la
 * fermeture, le focus revient au jour touché. Écrite ici plutôt qu'avec components/ui/Modal : ce module à la demande ne
 * dépend ainsi d'aucun morceau de code d'autres pages (table des morceaux chargée par toutes les pages, budgets JS).
 * Montée en 250 ms (translation et opacité), coupée si « réduire les animations ».
 */
function DaySheet({ open, title, subtitle, onClose, children }: {
    open: boolean;
    title: string;
    subtitle?: string;
    onClose: () => void;
    children: React.ReactNode;
}) {
    const ref = useRef<HTMLDialogElement>(null);
    const returnTo = useRef<HTMLElement | null>(null);
    const titleId = useId();
    const subtitleId = useId();
    useEffect(() => {
        const d = ref.current;
        if (!d) return;
        if (open && !d.open) {
            returnTo.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
            d.showModal();
        } else if (!open && d.open) {
            d.close();
        }
    }, [open]);
    return (
        <dialog
            ref={ref}
            aria-labelledby={titleId}
            aria-describedby={subtitle ? subtitleId : undefined}
            onClose={() => {
                onClose();
                returnTo.current?.focus();
            }}
            onClick={(e) => { if (e.target === e.currentTarget) e.currentTarget.close(); }}
            className="ev-sheet-up mx-0 mb-0 mt-auto max-h-[85vh] w-full max-w-none overflow-y-auto rounded-t-2xl border border-border bg-popover p-0 text-foreground shadow-popover backdrop:bg-scrim/60 sm:m-auto sm:max-w-lg sm:rounded-2xl"
        >
            <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-border bg-popover px-5 py-4">
                <div className="min-w-0">
                    <h2 id={titleId} className="text-lg font-bold text-foreground-strong first-letter:uppercase">{title}</h2>
                    {subtitle && <p id={subtitleId} className="text-sm text-muted-foreground">{subtitle}</p>}
                </div>
                <IconButton aria-label="Fermer" variant="ghost" onClick={() => ref.current?.close()}>
                    <X size={20} />
                </IconButton>
            </div>
            <div className="px-5 py-4">{children}</div>
        </dialog>
    );
}

interface MonthState {
    key: string;
    year: number;
    /** Mois 0 à 11. */
    month: number;
    events: PublicMapEvent[] | null;
    error: string | null;
}

export default function ExploreCalendar({ filtersQuery, weekend, refreshKey = 0 }: {
    /** Filtres de l'Explorer déjà écrits en adresse par la page (catalogSearchParams). */
    filtersQuery: string;
    /** Plage du « week-end » (vendredi 18:00 → lundi 00:00), calculée par la page avec la règle du filtre (whenRange). */
    weekend: DayRange;
    /** Signal temps réel d'Explorer : les mois affichés se relisent sur place. */
    refreshKey?: number;
}) {
    const filtersKey = filtersQuery;
    const today = useMemo(() => Math.floor(Date.now() / DAY_MS) * DAY_MS, []);
    const [months, setMonths] = useState<MonthState[]>([]);
    const [sheet, setSheet] = useState<{ title: string; subtitle: string; events: PublicMapEvent[] | null; error: string | null } | null>(null);
    const sentinel = useRef<HTMLDivElement>(null);
    const currentHeading = useRef<HTMLHeadingElement>(null);
    const loadSeq = useRef(0);

    // Filtres lus par référence : la lecture d'un mois suit toujours les derniers filtres
    const filtersRef = useRef(filtersQuery);
    filtersRef.current = filtersQuery;
    const loadMonth = useCallback(async (year: number, month: number, seq: number) => {
        const r = await readMapEvents('calendrier', mapUrl(filtersRef.current, { from: iso(monthStart(year, month)), to: iso(monthStart(year, month + 1)) }));
        if (seq !== loadSeq.current) return;
        const key = `${year}-${month}`;
        setMonths((list) => list.map((m) => (m.key === key ? { ...m, events: r.ok ? r.data.events : null, error: r.ok ? null : r.message } : m)));
    }, []);

    const addMonth = useCallback((year: number, month: number, seq: number) => {
        setMonths((list) => (list.some((m) => m.key === `${year}-${month}`) ? list : [...list, { key: `${year}-${month}`, year, month, events: null, error: null }]));
        void loadMonth(year, month, seq);
    }, [loadMonth]);

    // Filtres changés : on repart du mois en cours et du suivant
    useEffect(() => {
        const seq = ++loadSeq.current;
        const now = new Date(today);
        const first = { year: now.getUTCFullYear(), month: now.getUTCMonth() };
        const second = nextMonth(first);
        setMonths([]);
        addMonth(first.year, first.month, seq);
        addMonth(second.year, second.month, seq);
    }, [filtersKey, today, addMonth]);

    // Signal temps réel : chaque mois affiché se relit sur place (sans revenir en haut)
    const monthsRef = useRef<MonthState[]>([]);
    monthsRef.current = months;
    const handledTick = useRef(refreshKey);
    useEffect(() => {
        if (refreshKey === handledTick.current) return;
        handledTick.current = refreshKey;
        for (const m of monthsRef.current) void loadMonth(m.year, m.month, loadSeq.current);
    }, [refreshKey, loadMonth]);

    const loadMore = useCallback(() => {
        const last = months[months.length - 1];
        if (!last || months.length >= MAX_MONTHS || (last.events === null && !last.error)) return;
        const n = nextMonth(last);
        addMonth(n.year, n.month, loadSeq.current);
    }, [months, addMonth]);

    // Un mois de plus à l'approche du bas de la page
    useEffect(() => {
        const el = sentinel.current;
        if (!el || typeof IntersectionObserver !== 'function') return undefined;
        const observer = new IntersectionObserver((entries) => { if (entries.some((e) => e.isIntersecting)) loadMore(); }, { rootMargin: '300px 0px' });
        observer.observe(el);
        return () => observer.disconnect();
    }, [loadMore]);

    const openDay = (t: number, events: PublicMapEvent[]) => {
        setSheet({ title: dayLabel(t), subtitle: `${events.length} ${events.length > 1 ? 'événements' : 'événement'}`, events, error: null });
    };

    const openWeekend = async () => {
        const { from, to } = weekend;
        setSheet({ title: 'Ce week-end', subtitle: 'Du vendredi soir au dimanche', events: null, error: null });
        const startDay = Math.floor(from / DAY_MS) * DAY_MS;
        const r = await readMapEvents('calendrier', mapUrl(filtersQuery, { from: iso(startDay), to: iso(to) }));
        const inWeekend = r.ok ? r.data.events.filter((e) => Date.parse(e.startsAt) < to && Date.parse(e.endsAt) > from) : null;
        setSheet((s) => (s && s.title === 'Ce week-end'
            ? { ...s, events: inWeekend, error: r.ok ? null : r.message, subtitle: inWeekend ? `${inWeekend.length} ${inWeekend.length > 1 ? 'événements' : 'événement'}, du vendredi soir au dimanche` : s.subtitle }
            : s));
    };

    const showThisMonth = () => {
        currentHeading.current?.scrollIntoView({ block: 'start', behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
        currentHeading.current?.focus({ preventScroll: true });
    };

    return (
        <div className="space-y-6">
            <div role="group" aria-label="Raccourcis du calendrier" className="flex flex-wrap gap-2">
                <Button variant="secondary" size="sm" className="min-h-11" onClick={() => void openWeekend()}>Ce week-end</Button>
                <Button variant="secondary" size="sm" className="min-h-11" onClick={showThisMonth} leftIcon={<CalendarDays size={16} />}>Ce mois-ci</Button>
            </div>

            {months.map((m, index) => {
                const start = monthStart(m.year, m.month);
                const daysInMonth = Math.round((monthStart(m.year, m.month + 1) - start) / DAY_MS);
                const lead = (new Date(start).getUTCDay() + 6) % 7;
                const byDay = m.events ? eventsByDay(m.events, m.year, m.month) : new Map<number, PublicMapEvent[]>();
                const label = monthLabel(m.year, m.month);
                const headingId = `calendrier-${m.key}`;
                return (
                    <section key={m.key} aria-labelledby={headingId} className="space-y-3">
                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                            <h2
                                id={headingId}
                                ref={index === 0 ? currentHeading : undefined}
                                tabIndex={-1}
                                className="scroll-mt-24 text-xl font-bold capitalize tracking-tight text-foreground-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                                {label}
                            </h2>
                            <p className="text-sm text-muted-foreground" aria-live="polite">
                                {m.error ? '' : m.events === null ? 'Chargement…' : byDay.size === 0 ? 'Aucun événement ce mois-ci' : `${byDay.size} ${byDay.size > 1 ? 'jours' : 'jour'} avec des événements`}
                            </p>
                        </div>
                        {m.error && (
                            <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-3 text-sm text-foreground">
                                <span>{m.error}</span>
                                <Button size="sm" variant="ghost" leftIcon={<RefreshCw size={16} />} onClick={() => void loadMonth(m.year, m.month, loadSeq.current)}>Réessayer</Button>
                            </div>
                        )}
                        <div aria-hidden="true" className="grid grid-cols-7 gap-1 text-center text-sm font-semibold text-muted-foreground">
                            {WEEKDAYS.map((w) => <span key={w.long}><abbr title={w.long} className="no-underline">{w.short}</abbr></span>)}
                        </div>
                        <ol className={cn('grid grid-cols-7 gap-1', m.events === null && !m.error && 'opacity-60')}>
                            {Array.from({ length: lead }, (_, i) => <li key={`vide-${i}`} aria-hidden="true" />)}
                            {Array.from({ length: daysInMonth }, (_, i) => {
                                const t = start + i * DAY_MS;
                                const list = byDay.get(t) ?? [];
                                const isToday = t === today;
                                const past = t < today;
                                const number = (
                                    <span
                                        className={cn(
                                            'inline-flex h-7 min-w-7 items-center justify-center rounded-full px-1 text-sm font-semibold tabular-nums',
                                            isToday ? 'bg-brand-vif text-brand-vif-foreground' : past ? 'text-muted-foreground' : 'text-foreground-strong',
                                        )}
                                    >
                                        {i + 1}
                                    </span>
                                );
                                if (list.length === 0) {
                                    return (
                                        <li key={t} aria-hidden="true" className={cn('flex h-14 flex-col items-center pt-1 sm:h-20', past && 'opacity-50')}>
                                            {number}
                                        </li>
                                    );
                                }
                                return (
                                    <li key={t}>
                                        <button
                                            type="button"
                                            onClick={() => openDay(t, list)}
                                            aria-label={dayAriaLabel(t, list.length)}
                                            aria-current={isToday ? 'date' : undefined}
                                            className={cn(
                                                'ev-press flex h-14 w-full flex-col items-center gap-0.5 rounded-xl border border-border bg-card pt-1 transition-colors duration-fast hover:bg-muted sm:h-20',
                                                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                                                past && 'opacity-50',
                                            )}
                                        >
                                            {number}
                                            <span className="flex items-center">
                                                {list.slice(0, 3).map((e, k) => (
                                                    <PosterDot key={e.id} event={e} size="sm" className={cn(k > 0 && '-ml-2', k > 0 && 'hidden sm:inline-block', k === 2 && 'hidden md:inline-block')} />
                                                ))}
                                                {list.length > 1 && (
                                                    <small data-ev-caption="" className="ml-0.5 text-caption font-bold tabular-nums text-muted-foreground sm:hidden">+{list.length - 1}</small>
                                                )}
                                                {list.length > 2 && (
                                                    <small data-ev-caption="" className="ml-0.5 hidden text-caption font-bold tabular-nums text-muted-foreground sm:inline md:hidden">+{list.length - 2}</small>
                                                )}
                                                {list.length > 3 && (
                                                    <small data-ev-caption="" className="ml-0.5 hidden text-caption font-bold tabular-nums text-muted-foreground md:inline">+{list.length - 3}</small>
                                                )}
                                            </span>
                                        </button>
                                    </li>
                                );
                            })}
                        </ol>
                    </section>
                );
            })}

            <div ref={sentinel} className="flex justify-center pt-2">
                {months.length > 0 && months.length < MAX_MONTHS && (
                    <Button variant="secondary" onClick={loadMore}>Voir le mois suivant</Button>
                )}
            </div>

            <DaySheet
                open={sheet !== null}
                onClose={() => setSheet(null)}
                title={sheet?.title ?? ''}
                subtitle={sheet?.subtitle}
            >
                {sheet?.error ? (
                    <p role="alert" className="text-base text-foreground">{sheet.error}</p>
                ) : sheet?.events === null ? (
                    <p className="text-base text-muted-foreground">Chargement…</p>
                ) : sheet && sheet.events.length === 0 ? (
                    <p className="text-base text-muted-foreground">Aucun événement pour ces filtres.</p>
                ) : (
                    <ul className="space-y-2">
                        {(sheet?.events ?? []).map((e) => (
                            <li key={e.id}><MapEventCard event={e} action="Acheter" /></li>
                        ))}
                    </ul>
                )}
            </DaySheet>
        </div>
    );
}

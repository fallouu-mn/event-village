import type { PublicMapEvent } from '@/lib/events/map-shared';

/**
 * Lot Carte B — jours du calendrier d'Explorer, en fonctions pures (fuseau Africa/Dakar = UTC toute l'année : les jours se
 * découpent en UTC). Libellés lus par les lecteurs d'écran : « samedi 13 décembre, 3 événements ».
 */

export const DAY_MS = 86_400_000;

export const iso = (t: number): string => new Date(t).toISOString().slice(0, 10);

export function monthStart(year: number, month: number): number {
    return Date.UTC(year, month, 1);
}

export function monthLabel(year: number, month: number): string {
    return new Date(monthStart(year, month)).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

/** « samedi 13 décembre » */
export function dayLabel(t: number): string {
    return new Date(t).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
}

/** « samedi 13 décembre, 3 événements » */
export function dayAriaLabel(t: number, count: number): string {
    return `${dayLabel(t)}, ${count} ${count > 1 ? 'événements' : 'événement'}`;
}

/** Jours (minuit UTC) d'un mois où se déroule chaque événement, au moins en partie. */
export function eventsByDay(events: readonly PublicMapEvent[], year: number, month: number): Map<number, PublicMapEvent[]> {
    const from = monthStart(year, month);
    const to = monthStart(year, month + 1);
    const out = new Map<number, PublicMapEvent[]>();
    for (const e of events) {
        const start = Date.parse(e.startsAt);
        const end = Date.parse(e.endsAt);
        if (!Number.isFinite(start) || !Number.isFinite(end)) continue;
        const first = Math.max(from, Math.floor(start / DAY_MS) * DAY_MS);
        const last = Math.min(to - DAY_MS, Math.floor((end - 1) / DAY_MS) * DAY_MS);
        for (let d = first; d <= last; d += DAY_MS) {
            const list = out.get(d) ?? [];
            list.push(e);
            out.set(d, list);
        }
    }
    return out;
}

export function nextMonth(m: { year: number; month: number }): { year: number; month: number } {
    return m.month === 11 ? { year: m.year + 1, month: 0 } : { year: m.year, month: m.month + 1 };
}


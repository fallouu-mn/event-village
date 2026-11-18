/**
 * Design 1b (point 11) — « En cours » : l'événement se déroule maintenant, entre son début et sa fin retenue (même règle
 * que la vente et le scanner : public.event_end_at, miroir lib/events/event-end.ts). Calcul pur, fait sur le téléphone à
 * partir des heures : le badge apparaît et disparaît à la bonne minute, même page ouverte et malgré le cache de 60 s des
 * pages publiques (qui ne servent que les heures, jamais l'état « en cours »). Fuseau Africa/Dakar = UTC+0 toute l'année.
 */
import { eventEndAt } from './event-end';
import { formatTime } from '../format';

export interface EventTimes {
    start_date: string;
    start_time: string | null;
    end_date?: string | null;
    end_time?: string | null;
}

/** Début de l'événement (date et heure saisies ; sans heure : minuit, comme public.event_start_at). */
export function eventStartAt(row: Pick<EventTimes, 'start_date' | 'start_time'>): Date {
    const t = row.start_time ? (row.start_time.length === 5 ? `${row.start_time}:00` : row.start_time.slice(0, 8)) : '00:00:00';
    return new Date(`${row.start_date}T${t}Z`);
}

export interface LiveWindow {
    startsAt: Date;
    endsAt: Date;
}

export function liveWindow(row: EventTimes): LiveWindow | null {
    if (!row.start_date || !/^\d{4}-\d{2}-\d{2}$/.test(row.start_date)) return null;
    const startsAt = eventStartAt(row);
    const endsAt = eventEndAt({ start_date: row.start_date, start_time: row.start_time, end_date: row.end_date ?? null, end_time: row.end_time ?? null });
    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) return null;
    return { startsAt, endsAt };
}

/** Vrai entre le début (compris) et la fin retenue (exclue). */
export function isLiveAt(window: LiveWindow | null, now: Date): boolean {
    if (!window) return false;
    const t = now.getTime();
    return t >= window.startsAt.getTime() && t < window.endsAt.getTime();
}

/** Prochain instant où l'état « en cours » change (début ou fin), ou null s'il ne changera plus. */
export function nextLiveChange(window: LiveWindow | null, now: Date): Date | null {
    if (!window) return null;
    const t = now.getTime();
    if (t < window.startsAt.getTime()) return window.startsAt;
    if (t < window.endsAt.getTime()) return window.endsAt;
    return null;
}

/** « En cours · se termine vers 05:00 » (fiche). */
export function liveLabel(window: LiveWindow): string {
    return `En cours · se termine vers ${formatTime(window.endsAt)}`;
}

/** Fenêtre à partir d'instants ISO déjà calculés par le serveur (catalogue). */
export function liveWindowFromIso(startsAt: string | null | undefined, endsAt: string | null | undefined): LiveWindow | null {
    if (!startsAt || !endsAt) return null;
    const s = new Date(startsAt), e = new Date(endsAt);
    if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return null;
    return { startsAt: s, endsAt: e };
}

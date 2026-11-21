/**
 * Lot 11b (écrans du client) : filtres de la recherche des établissements, partagés par la page serveur (/tables) et le
 * formulaire client. Module sans « use client » : la page serveur appelle readFilters et filtersQuery.
 * Les noms des paramètres de l'adresse sont ceux de GET /api/tables (q, city, kind, date, time, guests, available) :
 * « Voir plus » reprend l'adresse telle quelle.
 */

export interface VenueFilters {
    q: string;
    city: string;
    /** RESTAURANT, BAR, ESPACE ou chaîne vide (tous). */
    kind: string;
    /** Jour AAAA-MM-JJ ; vide : aujourd'hui. */
    date: string;
    /** Heure HH:MM au quart d'heure ; vide : toute la journée. */
    time: string;
    /** Nombre de personnes (1 à 50) ; vide : 2. */
    guests: string;
    available: boolean;
}

export const EMPTY_FILTERS: VenueFilters = { q: '', city: '', kind: '', date: '', time: '', guests: '', available: false };

export const KINDS: ReadonlyArray<{ value: string; label: string }> = [
    { value: 'RESTAURANT', label: 'Restaurant' },
    { value: 'BAR', label: 'Bar' },
    { value: 'ESPACE', label: 'Espace' },
];

export const DEFAULT_GUESTS = 2;
export const MAX_GUESTS = 50;

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const QUARTER_RE = /^([01]\d|2[0-3]):(00|15|30|45)$/;

/** Heures proposées : au quart d'heure, de 00:00 à 23:45. */
export const QUARTER_TIMES: readonly string[] = Array.from({ length: 96 }, (_, i) => `${String(Math.floor(i / 4)).padStart(2, '0')}:${String((i % 4) * 15).padStart(2, '0')}`);

function one(v: string | string[] | undefined): string {
    return typeof v === 'string' ? v.trim() : '';
}

/** Filtres lus dans l'adresse ; toute valeur illisible est ignorée (filtre vide). */
export function readFilters(sp: Record<string, string | string[] | undefined>): VenueFilters {
    const date = one(sp.date);
    const time = one(sp.time);
    const guests = one(sp.guests);
    const kind = one(sp.kind).toUpperCase();
    return {
        q: one(sp.q).slice(0, 80),
        city: one(sp.city).slice(0, 80),
        kind: KINDS.some((k) => k.value === kind) ? kind : '',
        date: DAY_RE.test(date) ? date : '',
        time: QUARTER_RE.test(time) ? time : '',
        guests: /^\d{1,2}$/.test(guests) && Number(guests) >= 1 && Number(guests) <= MAX_GUESTS ? String(Number(guests)) : '',
        available: one(sp.available) === '1',
    };
}

/** Adresse de recherche (paramètres vides retirés). */
export function filtersQuery(f: VenueFilters): string {
    const p = new URLSearchParams();
    if (f.q.trim()) p.set('q', f.q.trim());
    if (f.city) p.set('city', f.city);
    if (f.kind) p.set('kind', f.kind);
    if (f.date) p.set('date', f.date);
    if (f.time) p.set('time', f.time);
    if (f.guests.trim()) p.set('guests', f.guests.trim());
    if (f.available) p.set('available', '1');
    return p.toString();
}

/** Adresse de la fiche avec le jour, l'heure et le nombre de personnes préremplis. */
export function venueHref(id: string, choice: { date?: string | null; time?: string | null; guests?: number | null }): string {
    const p = new URLSearchParams();
    if (choice.date) p.set('date', choice.date);
    if (choice.time) p.set('time', choice.time);
    if (choice.guests) p.set('guests', String(choice.guests));
    const query = p.toString();
    return `/tables/${id}${query ? `?${query}` : ''}`;
}

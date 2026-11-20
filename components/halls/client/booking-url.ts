/**
 * Lot 10b (point 2) : choix de réservation d'une salle gardé dans l'adresse de la fiche (date, mode, durée, heure de
 * début). Le calendrier et le panneau de réservation lisent la même adresse ; le choix survit à la connexion
 * (/login?redirect=…) et au retour arrière. Écriture par history.replaceState : Next.js met à jour useSearchParams
 * sans relancer le rendu serveur de la fiche. Aucun montant ici : seulement la période demandée.
 */

export type BookingMode = 'JOUR' | 'HEURE';

export interface BookingChoice {
    /** Jour AAAA-MM-JJ, ou chaîne vide. */
    date: string;
    mode: BookingMode;
    /** Nombre de jours (1 à 30) ou d'heures (1 à 24). */
    units: number;
    /** Heure de début HH:MM (à l'heure ou à la demie), ou chaîne vide. */
    time: string;
}

export const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):(00|30)$/;

/** Heures de début proposées : à l'heure pile ou à la demie. */
export const START_TIMES: readonly string[] = Array.from({ length: 48 }, (_, i) => `${String(Math.floor(i / 2)).padStart(2, '0')}:${i % 2 === 0 ? '00' : '30'}`);

/** Nombre d'heures possible depuis une heure de début, sans dépasser minuit (même jour). */
export function maxHoursFrom(time: string): number {
    if (!TIME_RE.test(time)) return 24;
    const [h, m] = time.split(':').map(Number);
    return Math.max(1, Math.floor((24 * 60 - (h * 60 + m)) / 60));
}

interface ParamsLike {
    get(name: string): string | null;
}

export function readChoice(sp: ParamsLike | null, hourlyAllowed: boolean): BookingChoice {
    const date = sp?.get('date') ?? '';
    const mode: BookingMode = hourlyAllowed && sp?.get('mode') === 'heure' ? 'HEURE' : 'JOUR';
    const rawUnits = Number(sp?.get('duree') ?? '');
    const max = mode === 'JOUR' ? 30 : 24;
    const time = sp?.get('debut') ?? '';
    const validTime = TIME_RE.test(time) ? time : '';
    let units = Number.isInteger(rawUnits) && rawUnits >= 1 && rawUnits <= max ? rawUnits : mode === 'JOUR' ? 1 : 4;
    if (mode === 'HEURE' && validTime) units = Math.min(units, maxHoursFrom(validTime));
    return { date: DAY_RE.test(date) ? date : '', mode, units, time: validTime };
}

/** Met à jour le choix dans l'adresse courante, sans rechargement ni nouvelle entrée d'historique. */
export function writeChoice(patch: Partial<BookingChoice>): void {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (patch.date !== undefined) {
        if (patch.date) params.set('date', patch.date);
        else params.delete('date');
    }
    if (patch.mode !== undefined) {
        if (patch.mode === 'HEURE') params.set('mode', 'heure');
        else params.delete('mode');
    }
    if (patch.units !== undefined) params.set('duree', String(patch.units));
    if (patch.time !== undefined) {
        if (patch.time) params.set('debut', patch.time);
        else params.delete('debut');
    }
    const query = params.toString();
    window.history.replaceState(null, '', `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`);
}

/** Adresse de connexion qui ramène sur la fiche avec le même choix. */
export function loginHref(): string {
    if (typeof window === 'undefined') return '/login';
    return `/login?redirect=${encodeURIComponent(`${window.location.pathname}${window.location.search}`)}`;
}

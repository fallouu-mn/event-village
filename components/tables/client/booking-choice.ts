/**
 * Lot 11b (écrans du client) : choix de réservation d'une table gardé dans l'adresse de la fiche (jour, heure, nombre
 * de personnes, zone, table) et demande particulière gardée sur l'appareil (stockage de session de l'onglet). Le choix
 * survit à la connexion (/login?redirect=…) et au retour arrière. Écriture par history.replaceState : Next.js met à
 * jour useSearchParams sans relancer le rendu serveur de la fiche. Aucun montant ici.
 */

export interface TableChoice {
    /** Jour AAAA-MM-JJ (aujourd'hui par défaut). */
    date: string;
    /** Heure HH:MM d'un créneau, ou chaîne vide. */
    time: string;
    /** Nombre de personnes, 1 à 50 (2 par défaut). */
    guests: number;
    /** Zone choisie (facultative), ou chaîne vide. */
    zoneId: string;
    /** Table choisie sur le plan (facultative), ou chaîne vide. */
    tableId: string;
}

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const MIN_GUESTS = 1;
export const MAX_GUESTS = 50;

interface ParamsLike {
    get(name: string): string | null;
}

export function readChoice(sp: ParamsLike | null, today: string): TableChoice {
    const date = sp?.get('date') ?? '';
    const time = sp?.get('time') ?? '';
    const guests = Number(sp?.get('guests') ?? '');
    const zoneId = sp?.get('zone') ?? '';
    const tableId = sp?.get('table') ?? '';
    return {
        date: DAY_RE.test(date) && date >= today ? date : today,
        time: TIME_RE.test(time) ? time : '',
        guests: Number.isInteger(guests) && guests >= MIN_GUESTS && guests <= MAX_GUESTS ? guests : 2,
        zoneId: UUID_RE.test(zoneId) ? zoneId : '',
        tableId: UUID_RE.test(tableId) ? tableId : '',
    };
}

/** Met à jour le choix dans l'adresse courante, sans rechargement ni nouvelle entrée d'historique. */
export function writeChoice(patch: Partial<TableChoice>): void {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const set = (key: string, value: string) => {
        if (value) params.set(key, value);
        else params.delete(key);
    };
    if (patch.date !== undefined) set('date', patch.date);
    if (patch.time !== undefined) set('time', patch.time);
    if (patch.guests !== undefined) set('guests', String(patch.guests));
    if (patch.zoneId !== undefined) set('zone', patch.zoneId);
    if (patch.tableId !== undefined) set('table', patch.tableId);
    const query = params.toString();
    window.history.replaceState(window.history.state, '', `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`);
}

/** Adresse de connexion qui ramène sur la fiche avec le même choix (ancre du panneau de réservation). */
export function loginHref(): string {
    if (typeof window === 'undefined') return '/login';
    return `/login?redirect=${encodeURIComponent(`${window.location.pathname}${window.location.search}#reserver`)}`;
}

// ── Demande particulière : gardée dans l'onglet (survit à la connexion), jamais envoyée ailleurs ───────────────────

const NOTES_PREFIX = 'ev-table-demande:v1:';
export const NOTES_MAX = 500;

function session(): Storage | null {
    try {
        return typeof window === 'undefined' ? null : window.sessionStorage;
    } catch {
        return null;
    }
}

export function readNotes(venueId: string): string {
    try {
        const v = session()?.getItem(`${NOTES_PREFIX}${venueId}`);
        return typeof v === 'string' ? v.slice(0, NOTES_MAX) : '';
    } catch {
        return '';
    }
}

export function writeNotes(venueId: string, notes: string): void {
    try {
        const s = session();
        if (!s) return;
        if (notes.trim()) s.setItem(`${NOTES_PREFIX}${venueId}`, notes.slice(0, NOTES_MAX));
        else s.removeItem(`${NOTES_PREFIX}${venueId}`);
    } catch {
        // Stockage refusé (navigation privée, quota) : la saisie reste à l'écran, rien n'est gardé
    }
}

export function clearNotes(venueId: string): void {
    writeNotes(venueId, '');
}

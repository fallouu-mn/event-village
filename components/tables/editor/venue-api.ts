/**
 * Lot 11b — édition d'un établissement : types des réponses des routes /api/partner/venues/** et petites aides
 * d'affichage partagées par les écrans d'édition (création, modification, plan de salle, fermetures). Aucun montant de
 * réservation calculé ici : les montants de l'aperçu d'une fermeture viennent de la route et sont seulement mis en forme.
 */
import { ApiError, fetchJson } from '@/components/partner/fetch-json';
import { dayText, hmText } from '@/lib/tables/views';

export type VenueKind = 'RESTAURANT' | 'BAR' | 'ESPACE';
export type ConfirmationMode = 'AUTO' | 'MANUELLE';
export type TableShape = 'RONDE' | 'CARREE' | 'RECTANGLE';

export const VENUE_KINDS: readonly { value: VenueKind; label: string; text: string }[] = [
    { value: 'RESTAURANT', label: 'Restaurant', text: 'Repas assis, déjeuner ou dîner.' },
    { value: 'BAR', label: 'Bar', text: 'Lounge, bar, rooftop, club.' },
    { value: 'ESPACE', label: 'Espace', text: 'Terrasse, plage, espace privatisable.' },
];

/** Réglages tables.* lus en base (valeurs par défaut) ; null si illisible (l'écran dit alors la règle sans chiffre). */
export interface VenueDefaults {
    slotMinutes: number | null;
    responseMinutes: number | null;
    holdMinutes: number | null;
    noShowMinutes: number | null;
    cancelFreeHours: number | null;
    /** Frais de service en % (5 = 5 %). */
    serviceFeeRate: number | null;
}

export interface OwnVenueZone { id: string; name: string; description: string | null; isActive: boolean; plan: { x: number; y: number; w: number; h: number } | null }
export interface OwnVenueTable {
    id: string;
    number: string;
    capacity: number;
    minCapacity: number;
    zoneId: string | null;
    isActive: boolean;
    plan: { x: number; y: number } | null;
    shape: TableShape;
    rotation: number;
}
export interface OwnVenueClosure { id: string; startsAt: string; endsAt: string; reason: string | null; createdAt: string }

/** Fiche complète d'un établissement de la partenaire (GET /api/partner/venues/[id]). */
export interface OwnVenue {
    id: string;
    kind: VenueKind;
    kindLabel: string;
    name: string;
    description: string | null;
    /** Lot Carte B3 : 'PARTICULIER' ou 'PROFESSIONNEL' ; absent sur une ancienne réponse (lu comme particulier). */
    hostKind?: string | null;
    address: string | null;
    city: string | null;
    latitude: number | null;
    longitude: number | null;
    photos: string[];
    slotMinutes: number | null;
    depositPerPerson: number | null;
    confirmation: ConfirmationMode;
    floorPlan: boolean;
    isActive: boolean;
    status: string;
    statusLabel: string;
    statusTone: string;
    statusHint: string;
    reason: string | null;
    submittedAt: string | null;
    createdAt: string;
    updatedAt: string;
    hours: { weekday: number; opensAt: string; closesAt: string }[];
    zones: OwnVenueZone[];
    tables: OwnVenueTable[];
    closures: OwnVenueClosure[];
    defaults: Record<keyof VenueDefaults, number | null | undefined>;
}

/** Nombre fini et positif (ou nul pour les heures d'annulation gratuite), sinon null. */
function finite(n: unknown, allowZero = false): number | null {
    const v = Number(n);
    if (!Number.isFinite(v)) return null;
    return v > 0 || (allowZero && v === 0) ? v : null;
}

export function defaultsOf(d: Partial<Record<keyof VenueDefaults, unknown>> | null | undefined): VenueDefaults {
    return {
        slotMinutes: finite(d?.slotMinutes),
        responseMinutes: finite(d?.responseMinutes),
        holdMinutes: finite(d?.holdMinutes),
        noShowMinutes: finite(d?.noShowMinutes),
        cancelFreeHours: finite(d?.cancelFreeHours, true),
        serviceFeeRate: finite(d?.serviceFeeRate, true),
    };
}

/** Message d'une erreur pour l'écran : celui de la route (déjà en français), sinon la phrase de repli. */
export function apiMessage(err: unknown, fallback: string): string {
    return err instanceof ApiError && err.message ? err.message : fallback;
}

export function apiCode(err: unknown): string | null {
    return err instanceof ApiError ? err.code : null;
}

/** Envoi JSON en PUT (fetch-json ne propose que POST, PATCH et DELETE) ; même traitement des refus. */
export function putJson<T>(url: string, payload: unknown): Promise<T> {
    return fetchJson<T>(url, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
}

/** Durée en mots : 90 → « 1 h 30 », 120 → « 2 h », 45 → « 45 min ». */
export function durationText(minutes: number): string {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h === 0) return `${m} min`;
    return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, '0')}`;
}

/** Délai en mots pour une phrase : 60 → « 1 heure », 90 → « 1 h 30 », 30 → « 30 minutes ». */
export function delayText(minutes: number): string {
    if (minutes % 60 === 0) {
        const h = minutes / 60;
        return h === 1 ? '1 heure' : `${h} heures`;
    }
    if (minutes < 60) return `${minutes} minutes`;
    return durationText(minutes);
}

/** Pourcentage réglé, à la française : 5 → « 5 % », 2.5 → « 2,5 % ». */
export function rateText(rate: number): string {
    return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(rate)} %`;
}

/** Nombre entier saisi avec ou sans espaces (« 5 000 ») ; null s'il n'est pas lisible. */
export function wholeNumber(text: string): number | null {
    const clean = text.replace(/[\s  ]/g, '');
    if (!/^\d+$/.test(clean)) return null;
    const n = Number(clean);
    return Number.isSafeInteger(n) ? n : null;
}

/** Durées d'un créneau proposées (30 à 360 minutes par quart d'heure). */
export const SLOT_OPTIONS: readonly number[] = Array.from({ length: (360 - 30) / 15 + 1 }, (_, i) => 30 + i * 15);

/** Heures au quart d'heure, « 00:00 » à « 23:45 ». */
export const QUARTER_TIMES: readonly string[] = Array.from({ length: 96 }, (_, i) => `${String(Math.floor(i / 4)).padStart(2, '0')}:${String((i % 4) * 15).padStart(2, '0')}`);

const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

/** Jour précédent d'une date « AAAA-MM-JJ ». */
function previousDay(day: string): string {
    const d = new Date(`${day}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - 1);
    return d.toISOString().slice(0, 10);
}

/**
 * Période d'une fermeture (horodatages de Dakar sans fuseau, « 2026-12-05T18:00:00 ») en mots :
 * « Toute la journée du samedi 5 décembre », « Du samedi 5 au lundi 7 décembre, journées entières »,
 * « Samedi 5 décembre, de 18 h à 23 h », « Du samedi 5 décembre à 18 h au dimanche 6 décembre à 2 h ».
 */
export function closurePeriodText(startsAt: string, endsAt: string): string {
    const sd = startsAt.slice(0, 10);
    const st = startsAt.slice(11, 16) || '00:00';
    let ed = endsAt.slice(0, 10);
    const et = endsAt.slice(11, 16) || '00:00';
    const fullStart = st === '00:00';
    const fullEnd = et === '00:00';
    if (fullEnd) ed = previousDay(ed);
    if (fullStart && fullEnd) {
        return sd === ed ? `Toute la journée du ${dayText(sd)}` : `Du ${dayText(sd)} au ${dayText(ed)}, journées entières`;
    }
    const endClock = fullEnd ? 'minuit' : hmText(et);
    if (sd === ed) return `${cap(dayText(sd))}, de ${hmText(st)} à ${endClock}`;
    return `Du ${dayText(sd)} à ${hmText(st)} au ${dayText(ed)} à ${endClock}`;
}

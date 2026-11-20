/**
 * Design 1d (points 6 et 9) — préférences de l'appareil, gardées seulement dans le stockage local du navigateur (rien de
 * nouveau côté serveur), toujours sous try/catch : un stockage absent ou refusé ne casse rien, la préférence manque.
 *  - Achat rapide : dernier opérateur choisi (Wave ou Orange Money) et numéro de paiement, enregistrés quand le serveur a
 *    accepté la demande de paiement ; proposés d'avance à l'achat suivant, toujours modifiables. Ils ne contournent rien :
 *    la confirmation de paiement et tous les contrôles du serveur restent les mêmes.
 *  - Recherche : 6 recherches récentes au plus, 60 caractères chacune, « Effacer » les retire.
 * Tout est effacé à la déconnexion (lib/device/device-prefs-purge.ts, AuthProvider).
 */
import { DEVICE_PREFS_PREFIX } from './device-prefs-purge';

export type DeviceOperator = 'WAVE' | 'ORANGE_MONEY';

export interface PaymentPreference {
    operator: DeviceOperator;
    /** Mobile sénégalais, 9 chiffres sans indicatif (format du payeur, lib/payments/payer-phone.ts). */
    phone: string;
}

export const PAYMENT_PREF_KEY = `${DEVICE_PREFS_PREFIX}paiement`;
export const RECENT_SEARCHES_KEY = `${DEVICE_PREFS_PREFIX}recherches`;
export const RECENT_SEARCHES_MAX = 6;
export const RECENT_SEARCH_MAX_LENGTH = 60;

const PHONE_RE = /^7[05678][0-9]{7}$/;

function storage(): Storage | null {
    try {
        return typeof window === 'undefined' ? null : window.localStorage;
    } catch {
        return null; // accès au stockage refusé : aucune préférence
    }
}

function readJson(key: string): unknown {
    try {
        const raw = storage()?.getItem(key);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null; // valeur illisible ou stockage refusé : ignorée
    }
}

function writeJson(key: string, value: unknown): boolean {
    try {
        const s = storage();
        if (!s) return false;
        s.setItem(key, JSON.stringify(value));
        return true;
    } catch {
        return false; // stockage plein ou refusé : la préférence n'est pas gardée
    }
}

/** Dernier opérateur et numéro de paiement de l'appareil, null s'il n'y en a pas ou s'ils sont illisibles. */
export function readPaymentPreference(): PaymentPreference | null {
    const v = readJson(PAYMENT_PREF_KEY) as Partial<PaymentPreference> | null;
    if (!v || typeof v !== 'object') return null;
    if ((v.operator !== 'WAVE' && v.operator !== 'ORANGE_MONEY') || typeof v.phone !== 'string' || !PHONE_RE.test(v.phone)) return null;
    return { operator: v.operator, phone: v.phone };
}

/** Garde l'opérateur et le numéro (9 chiffres) d'un paiement accepté par le serveur. */
export function savePaymentPreference(pref: PaymentPreference): boolean {
    if ((pref.operator !== 'WAVE' && pref.operator !== 'ORANGE_MONEY') || !PHONE_RE.test(pref.phone)) return false;
    return writeJson(PAYMENT_PREF_KEY, { operator: pref.operator, phone: pref.phone });
}

function cleanQuery(q: string): string {
    return q.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, RECENT_SEARCH_MAX_LENGTH);
}

/** Recherches récentes, de la plus récente à la plus ancienne. */
export function readRecentSearches(): string[] {
    const v = readJson(RECENT_SEARCHES_KEY);
    if (!Array.isArray(v)) return [];
    return v.filter((x): x is string => typeof x === 'string').map(cleanQuery).filter((x) => x.length >= 2).slice(0, RECENT_SEARCHES_MAX);
}

/** Ajoute une recherche en tête (sans doublon, casse ignorée). */
export function addRecentSearch(q: string): string[] {
    const clean = cleanQuery(q);
    if (clean.length < 2) return readRecentSearches();
    const next = [clean, ...readRecentSearches().filter((x) => x.toLowerCase() !== clean.toLowerCase())].slice(0, RECENT_SEARCHES_MAX);
    // Stockage plein ou refusé : rien de gardé, la liste reste celle du stockage
    return writeJson(RECENT_SEARCHES_KEY, next) ? next : readRecentSearches();
}

/** « Effacer » : retire toutes les recherches récentes. */
export function clearRecentSearches(): void {
    try {
        storage()?.removeItem(RECENT_SEARCHES_KEY);
    } catch {
        // stockage refusé : rien à effacer
    }
}

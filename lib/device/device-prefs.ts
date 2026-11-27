/**
 * Design 1d (points 6 et 9) — préférences de l'appareil, gardées seulement dans le stockage local du navigateur (rien de
 * nouveau côté serveur), toujours sous try/catch : un stockage absent ou refusé ne casse rien, la préférence manque.
 *  - Achat rapide : dernier opérateur choisi (Wave ou Orange Money) et numéro de paiement, enregistrés quand le serveur a
 *    accepté la demande de paiement ; proposés d'avance à l'achat suivant, toujours modifiables. Ils ne contournent rien :
 *    la confirmation de paiement et tous les contrôles du serveur restent les mêmes.
 *  - Recherche : 6 recherches récentes au plus, 60 caractères chacune, « Effacer » les retire.
 * Tout est effacé à la déconnexion (lib/device/device-prefs-purge.ts, AuthProvider).
 */
import { DEVICE_INVITE_NAMES_KEY, DEVICE_PAYMENT_KEY, DEVICE_PREFS_PREFIX, DEVICE_TABLE_CHOICE_PREFIX, DEVICE_TABLE_NOTES_PREFIX } from './device-prefs-purge';

export type DeviceOperator = 'WAVE' | 'ORANGE_MONEY';

export interface PaymentPreference {
    operator: DeviceOperator;
    /** Mobile sénégalais, 9 chiffres sans indicatif (format du payeur, lib/payments/payer-phone.ts). */
    phone: string;
}

export const PAYMENT_PREF_KEY = DEVICE_PAYMENT_KEY;
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

// ── Lot 11b : tables ─────────────────────────────────────────────────────────────────────────────────────────

/**
 * Lot 11b : demande particulière saisie sur la fiche d'un établissement (gardée pendant la connexion, 500 caractères) ;
 * donnée du compte, effacée aussi quand la session se ferme à l'insu du navigateur (contre-vérification T5).
 */
export const TABLE_NOTES_PREFIX = DEVICE_TABLE_NOTES_PREFIX;
export const TABLE_NOTES_MAX = 500;
/** Lot 11b : signal des nouvelles réservations du planning de l'établissement (« on », « off »). */
export const TABLE_SIGNAL_KEY = `${DEVICE_PREFS_PREFIX}signal-reservations`;

const VENUE_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Demande particulière gardée pour cet établissement, vide s'il n'y en a pas. */
export function readTableNotes(venueId: string): string {
    if (!VENUE_ID_RE.test(venueId)) return '';
    const v = readJson(`${TABLE_NOTES_PREFIX}${venueId}`);
    return typeof v === 'string' ? v.slice(0, TABLE_NOTES_MAX) : '';
}

/** Garde (ou retire, si vide) la demande particulière de cet établissement. */
export function saveTableNotes(venueId: string, notes: string): boolean {
    if (!VENUE_ID_RE.test(venueId)) return false;
    if (!notes.trim()) {
        try {
            storage()?.removeItem(`${TABLE_NOTES_PREFIX}${venueId}`);
            return true;
        } catch {
            return false; // stockage refusé : rien à retirer
        }
    }
    return writeJson(`${TABLE_NOTES_PREFIX}${venueId}`, notes.slice(0, TABLE_NOTES_MAX));
}

/** Signal des nouvelles réservations : activé sauf choix « off » gardé sur l'appareil. */
export function readTableSignal(): boolean {
    return readJson(TABLE_SIGNAL_KEY) !== 'off';
}

export function saveTableSignal(on: boolean): boolean {
    return writeJson(TABLE_SIGNAL_KEY, on ? 'on' : 'off');
}

// ── Lot 11c-b : préférences des tables d'un événement (écrites ici, par des fonctions nommées) ──────────────────────
// Contre-vérification du lot 11c-b (T3) : plus d'accès générique réexporté ; chaque écriture du stockage reste dans ce
// fichier, classé par l'audit de la déconnexion. Les écrans des tables les importent par lib/device/table-prefs.ts.
//  - Prénoms des invités : le transfert d'une place ne porte que le numéro ; le prénom saisi (ou lu dans le carnet du
//    téléphone) sert à l'avatar de la place EN ATTENTE sur l'écran du titulaire, jusqu'à l'acceptation. Rien n'est envoyé
//    au serveur. Donnée du compte : effacée au bouton « Se déconnecter », sur SIGNED_OUT ET à une page chargée sans
//    session (portée « paiement » de clearDevicePrefs).
//  - Table choisie avant la connexion : type et table (identifiants publics), repris une fois au retour sur la fiche
//    (30 minutes au plus), puis effacés ; effacés aussi au bouton « Se déconnecter ».
export const INVITE_NAMES_KEY = DEVICE_INVITE_NAMES_KEY;
export const INVITE_NAME_MAX = 40;
const INVITE_NAMES_MAX = 200;

export function readInviteNames(): Record<string, string> {
    const v = readJson(INVITE_NAMES_KEY);
    if (!v || typeof v !== 'object' || Array.isArray(v)) return {};
    const out: Record<string, string> = {};
    for (const [k, name] of Object.entries(v as Record<string, unknown>)) {
        if (typeof name === 'string' && name.trim()) out[k] = name.trim().slice(0, INVITE_NAME_MAX);
    }
    return out;
}

export function saveInviteName(ticketId: string, name: string): boolean {
    const clean = name.trim().replace(/\s+/g, ' ').slice(0, INVITE_NAME_MAX);
    const names = readInviteNames();
    if (clean) names[ticketId] = clean;
    else delete names[ticketId];
    return writeJson(INVITE_NAMES_KEY, Object.fromEntries(Object.entries(names).slice(-INVITE_NAMES_MAX)));
}

export const TABLE_CHOICE_PREFIX = DEVICE_TABLE_CHOICE_PREFIX;
const TABLE_CHOICE_TTL_MS = 30 * 60 * 1000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface TableChoice { typeId: string; tableId: string | null }

export function saveTableChoice(eventId: string, choice: TableChoice): boolean {
    return writeJson(`${TABLE_CHOICE_PREFIX}${eventId}`, { at: Date.now(), typeId: choice.typeId, tableId: choice.tableId });
}

/** Choix gardé (moins de 30 minutes) pour cet événement, effacé à sa lecture ; null sinon. */
export function takeTableChoice(eventId: string): TableChoice | null {
    const key = `${TABLE_CHOICE_PREFIX}${eventId}`;
    const v = readJson(key) as { at?: unknown; typeId?: unknown; tableId?: unknown } | null;
    try {
        storage()?.removeItem(key);
    } catch (err) {
        console.warn('[appareil] table choisie non effacée (stockage refusé) :', err instanceof Error ? err.message : String(err));
    }
    if (!v || typeof v !== 'object' || typeof v.at !== 'number' || Date.now() - v.at > TABLE_CHOICE_TTL_MS) return null;
    if (typeof v.typeId !== 'string' || !UUID_RE.test(v.typeId)) return null;
    const tableId = typeof v.tableId === 'string' && UUID_RE.test(v.tableId) ? v.tableId : null;
    return { typeId: v.typeId, tableId };
}

// ── Lot 12b : panier par établissement, contrôlé par lib/orders/device-store.ts (lignes, jamais un prix) ──
export const ORDER_CART_PREFIX = `${DEVICE_PREFS_PREFIX}panier:`;

export function readOrderCart(venueId: string): unknown {
    return UUID_RE.test(venueId) ? readJson(`${ORDER_CART_PREFIX}${venueId}`) : null;
}

export function saveOrderCart(venueId: string, value: object | null): boolean {
    if (!UUID_RE.test(venueId)) return false;
    if (value !== null) return writeJson(`${ORDER_CART_PREFIX}${venueId}`, value);
    try {
        storage()?.removeItem(`${ORDER_CART_PREFIX}${venueId}`);
        return true;
    } catch {
        return false; // stockage refusé : rien à retirer
    }
}

// ── Lot 12c : commandes ──────────────────────────────────────────────────────────────────────────────────────

/**
 * Lot 12c : son et vibration à chaque nouvelle commande sur l'écran des commandes (« on », « off »), activés par défaut.
 * Rangés avec les préférences de l'appareil (effacées à la déconnexion, audit cvf2b-6).
 */
export const ORDER_SOUND_KEY = `${DEVICE_PREFS_PREFIX}son-commandes`;

export function readOrderSound(): boolean {
    return readJson(ORDER_SOUND_KEY) !== 'off';
}

export function saveOrderSound(on: boolean): boolean {
    return writeJson(ORDER_SOUND_KEY, on ? 'on' : 'off');
}

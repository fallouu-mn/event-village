/**
 * Lot 11c-b — préférences de l'appareil propres aux tables d'un événement, chargées seulement avec leurs écrans (onglet
 * « Tables » de la fiche, « Ma table ») : rien ici n'entre dans le premier chargement d'une page. Écriture par les accès de
 * lib/device/device-prefs.ts ; clés sous DEVICE_PREFS_PREFIX, effacées à la déconnexion avec les autres préférences.
 *
 *  - Prénoms des invités : le transfert d'une place ne porte que le numéro ; le prénom saisi (ou lu dans le carnet du
 *    téléphone) sert à l'avatar de la place EN ATTENTE sur l'écran du titulaire, jusqu'à l'acceptation (le serveur donne
 *    alors le prénom du compte de l'invité). Rien n'est envoyé au serveur.
 *  - Table choisie avant la connexion : type et table choisis par un visiteur qui doit se connecter pour réserver (comme le
 *    panier des billets), repris une seule fois au retour sur la fiche (30 minutes au plus), puis effacés.
 */
import { DEVICE_PREFS_PREFIX } from './device-prefs-purge';
import { readDevicePref, removeDevicePref, writeDevicePref } from './device-prefs';

export const INVITE_NAMES_KEY = `${DEVICE_PREFS_PREFIX}invites`;
export const INVITE_NAME_MAX = 40;
const INVITE_NAMES_MAX = 200;

export function readInviteNames(): Record<string, string> {
    const v = readDevicePref(INVITE_NAMES_KEY);
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
    const entries = Object.entries(names).slice(-INVITE_NAMES_MAX);
    return writeDevicePref(INVITE_NAMES_KEY, Object.fromEntries(entries));
}

export const TABLE_CHOICE_PREFIX = `${DEVICE_PREFS_PREFIX}table-choisie:`;
const TABLE_CHOICE_TTL_MS = 30 * 60 * 1000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface TableChoice { typeId: string; tableId: string | null }

export function saveTableChoice(eventId: string, choice: TableChoice): boolean {
    return writeDevicePref(`${TABLE_CHOICE_PREFIX}${eventId}`, { at: Date.now(), typeId: choice.typeId, tableId: choice.tableId });
}

/** Choix gardé (moins de 30 minutes) pour cet événement, effacé à sa lecture ; null sinon. */
export function takeTableChoice(eventId: string): TableChoice | null {
    const key = `${TABLE_CHOICE_PREFIX}${eventId}`;
    const v = readDevicePref(key) as { at?: unknown; typeId?: unknown; tableId?: unknown } | null;
    removeDevicePref(key);
    if (!v || typeof v !== 'object' || typeof v.at !== 'number' || Date.now() - v.at > TABLE_CHOICE_TTL_MS) return null;
    if (typeof v.typeId !== 'string' || !UUID_RE.test(v.typeId)) return null;
    const tableId = typeof v.tableId === 'string' && UUID_RE.test(v.tableId) ? v.tableId : null;
    return { typeId: v.typeId, tableId };
}

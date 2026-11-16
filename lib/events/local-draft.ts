/**
 * Finition 2b (C) — brouillon du formulaire d'événement gardé dans le navigateur, propre au compte et à l'événement,
 * rien côté serveur. Au retour : « Reprendre votre saisie du {date} à {heure} ? » (Reprendre, Effacer).
 *
 * Lectures et écritures protégées :
 *  - clé par compte et par événement (`ev-brouillon:v1:<compte>:<événement | nouveau>`), et le contenu redit le compte et
 *    l'événement : un brouillon d'un autre compte ou d'un autre événement n'est jamais repris ;
 *  - stockage absent ou refusé (navigation privée, quota, réglages) : rien n'est gardé, aucune erreur ne remonte à
 *    l'écran (message dans la console) ;
 *  - contenu illisible, d'une autre forme ou trop gros (64 Kio au plus) : ignoré et effacé ;
 *  - effacé à l'enregistrement, à l'envoi, sur « Effacer », et à la déconnexion (tous les brouillons du compte).
 * Le contenu (`data`) est contrôlé par l'appelant (`validate`), champ par champ, avant toute reprise.
 */

const PREFIX = 'ev-brouillon:v1:';
const MAX_BYTES = 64 * 1024;

export interface LocalDraft<T> {
    savedAt: string;
    data: T;
}

interface Stored {
    v: 1;
    userId: string;
    eventId: string;
    savedAt: string;
    data: unknown;
}

/** Stockage du navigateur, ou null s'il est absent ou refusé (aucune exception ne sort). */
function storage(): Storage | null {
    try {
        if (typeof window === 'undefined' || !window.localStorage) return null;
        return window.localStorage;
    } catch (err) {
        console.warn('[brouillon] stockage du navigateur indisponible', err);
        return null;
    }
}

const SAFE_ID = /^[A-Za-z0-9-]{1,64}$/;

/** Clé du brouillon d'un compte pour un événement (null : création) ; null si un identifiant est illisible. */
export function draftKey(userId: string, eventId: string | null): string | null {
    const event = eventId ?? 'nouveau';
    if (!SAFE_ID.test(userId) || !SAFE_ID.test(event)) return null;
    return `${PREFIX}${userId}:${event}`;
}

/** Brouillon gardé, contrôlé par `validate` ; illisible, étranger ou refusé : effacé, null. */
export function readDraft<T>(userId: string, eventId: string | null, validate: (data: unknown) => T | null): LocalDraft<T> | null {
    const key = draftKey(userId, eventId);
    const store = storage();
    if (!key || !store) return null;
    let raw: string | null;
    try {
        raw = store.getItem(key);
    } catch (err) {
        console.warn('[brouillon] lecture refusée', err);
        return null;
    }
    if (raw === null) return null;
    const drop = (why: string): null => {
        console.warn(`[brouillon] brouillon ignoré (${why})`);
        clearDraft(userId, eventId);
        return null;
    };
    if (raw.length > MAX_BYTES) return drop('trop gros');
    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch {
        return drop('illisible');
    }
    const s = parsed as Partial<Stored> | null;
    if (!s || typeof s !== 'object' || s.v !== 1 || s.userId !== userId || s.eventId !== (eventId ?? 'nouveau')
        || typeof s.savedAt !== 'string' || !Number.isFinite(Date.parse(s.savedAt))) {
        return drop('forme inattendue');
    }
    const data = validate(s.data);
    if (data === null) return drop('contenu refusé');
    return { savedAt: s.savedAt, data };
}

/** Garde le brouillon ; stockage refusé ou contenu trop gros : rien n'est gardé (message dans la console). */
export function writeDraft(userId: string, eventId: string | null, data: unknown, now: Date = new Date()): boolean {
    const key = draftKey(userId, eventId);
    const store = storage();
    if (!key || !store) return false;
    let raw: string;
    try {
        raw = JSON.stringify({ v: 1, userId, eventId: eventId ?? 'nouveau', savedAt: now.toISOString(), data } satisfies Stored);
    } catch (err) {
        console.warn('[brouillon] contenu non sérialisable', err);
        return false;
    }
    if (raw.length > MAX_BYTES) {
        console.warn('[brouillon] brouillon trop gros : non gardé');
        return false;
    }
    try {
        store.setItem(key, raw);
        return true;
    } catch (err) {
        console.warn('[brouillon] écriture refusée', err);
        return false;
    }
}

export function clearDraft(userId: string, eventId: string | null): void {
    const key = draftKey(userId, eventId);
    const store = storage();
    if (!key || !store) return;
    try {
        store.removeItem(key);
    } catch (err) {
        console.warn('[brouillon] effacement refusé', err);
    }
}

/** Tous les brouillons d'un compte (déconnexion). */
export function clearUserDrafts(userId: string): void {
    const store = storage();
    if (!store || !SAFE_ID.test(userId)) return;
    try {
        const mine: string[] = [];
        for (let i = 0; i < store.length; i++) {
            const k = store.key(i);
            if (k && k.startsWith(`${PREFIX}${userId}:`)) mine.push(k);
        }
        for (const k of mine) store.removeItem(k);
    } catch (err) {
        console.warn('[brouillon] effacement des brouillons du compte refusé', err);
    }
}

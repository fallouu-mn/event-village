/**
 * Lot 7, tâche 7.1 (contrat 5.2, D31, D34, D35) — horloge du billet hors ligne : fonctions pures, sans
 * IndexedDB ni réseau, testées en node (tests/parcours/hors-ligne-client.test.ts).
 *
 *  - Le lot de codes est la réponse de GET /api/tickets/[id]/offline-codes (contrat 3.1), complétée par
 *    l'écart d'horloge mesuré au téléchargement : `offsetMs` = heure du serveur − heure du téléphone,
 *    `downloadedAtDevice` et `downloadedAtServer` (millisecondes). L'écart est recalculé à chaque réponse
 *    réussie du live-code (champ `server_time`) : ces deux instants sont alors ceux de la dernière mesure.
 *  - Le code affiché est celui de l'heure du serveur (heure du téléphone + écart) : un téléphone en avance ou
 *    en retard de plusieurs minutes affiche le bon code, sans jamais montrer un code hors du lot.
 *  - Horloge reculée de plus de 60 s sous la dernière mesure : l'écart ne vaut plus rien, aucun code.
 *  - Le navigateur ne décide pas de la fenêtre : `offline` vient de GET /api/tickets (ticket_offline_info).
 */

const MS = 1000;
const HOUR_MS = 3600 * MS;
/** Recul d'horloge toléré sous la dernière mesure (réglage manuel, synchronisation réseau du téléphone). */
export const CLOCK_BACKWARD_TOLERANCE_MS = 60 * MS;
/** Retéléchargement d'un lot incomplet quand sa fin est à moins de 24 h (D31). */
export const REFRESH_BEFORE_END_MS = 24 * HOUR_MS;

/** Réponse 200 de GET /api/tickets/[id]/offline-codes (contrat 3.1). */
export interface OfflineLotResponse {
    ticket_id: string;
    secret_version: number;
    prefix: string;
    step_seconds: number;
    digits: number;
    first_counter: number;
    count: number;
    codes: string;
    first_step_at: string;
    last_step_at: string;
    valid_until: string;
    expires_at: string;
    scan_opens_at: string;
    scan_closes_at: string;
    complete: boolean;
    next_from: string | null;
    refresh_after: string | null;
    server_time: string;
    ticket: {
        ticket_number: string;
        category: string;
        event_title: string;
        event_start_at: string;
        location: string;
        city: string;
    };
}

/** Lot enregistré sur le téléphone : réponse 3.1 + mesure de l'écart d'horloge (millisecondes). */
export interface OfflineLot extends OfflineLotResponse {
    offsetMs: number;
    downloadedAtDevice: number;
    downloadedAtServer: number;
}

/** Champ `offline` d'un billet de GET /api/tickets (contrat 3.2). */
export interface OfflineAvailability {
    secret_version: number;
    available: boolean;
    available_from: string | null;
    available_until: string | null;
    reason: null | 'NOT_YET' | 'CLOSED' | 'TICKET_NOT_VALID' | 'EVENT_NOT_PUBLISHED' | 'TRANSFER_PENDING';
}

/** Code choisi pour l'instant présent. */
export interface OfflineCodeShown {
    state: 'code';
    counter: number;
    code: string;
    payload: string;
    /** Heure du serveur estimée (ms). */
    serverNow: number;
    /** Délai avant le prochain code, sur l'horloge du téléphone (ms, au moins 1). */
    nextChangeInMs: number;
    /** Durée d'un pas (ms). */
    stepMs: number;
}

export type OfflinePick =
    | OfflineCodeShown
    | { state: 'not_yet'; opensAt: string }
    | { state: 'expired' }
    | { state: 'clock_changed' }
    | { state: 'corrupt'; reason: string };

function timeOf(iso: string, what: string): number {
    const t = Date.parse(iso);
    if (!Number.isFinite(t)) throw new Error(`lot hors ligne : ${what} illisible (${String(iso)})`);
    return t;
}

/** Écart d'horloge mesuré sur un aller-retour : heure du serveur − milieu de [t0 ; t1] du téléphone. */
export function offsetFromFetch(serverTime: string, t0: number, t1: number): number {
    const server = timeOf(serverTime, 'server_time');
    if (!Number.isFinite(t0) || !Number.isFinite(t1) || t1 < t0) {
        throw new Error(`mesure de l'écart d'horloge : instants du téléphone invalides (${t0}, ${t1})`);
    }
    return server - (t0 + t1) / 2;
}

/**
 * Code du pas de l'heure du serveur pour l'instant `deviceNow` du téléphone (ms).
 * not_yet avant l'ouverture du contrôle (ou du lot), expired à partir de la fin du lot, clock_changed si
 * l'horloge a reculé de plus de 60 s sous la dernière mesure, corrupt si le lot enregistré est illisible.
 */
export function pickOfflineCode(lot: OfflineLot, deviceNow: number): OfflinePick {
    if (deviceNow < Number(lot.downloadedAtDevice) - CLOCK_BACKWARD_TOLERANCE_MS) return { state: 'clock_changed' };
    const offsetMs = Number(lot.offsetMs);
    const stepMs = Number(lot.step_seconds) * MS;
    const digits = Number(lot.digits);
    const firstCounter = Number(lot.first_counter);
    const count = Number(lot.count);
    if (!Number.isFinite(offsetMs) || !(stepMs > 0) || !(digits > 0) || !Number.isSafeInteger(firstCounter)
        || !Number.isSafeInteger(count) || count < 1 || typeof lot.codes !== 'string' || lot.codes.length !== digits * count) {
        return { state: 'corrupt', reason: 'forme du lot' };
    }
    const serverNow = deviceNow + offsetMs;
    const opensAt = Math.max(timeOf(lot.scan_opens_at, 'scan_opens_at'), timeOf(lot.first_step_at, 'first_step_at'));
    if (serverNow < opensAt) return { state: 'not_yet', opensAt: new Date(opensAt).toISOString() };
    const endsAt = Math.min(timeOf(lot.valid_until, 'valid_until'), timeOf(lot.expires_at, 'expires_at'));
    if (serverNow >= endsAt) return { state: 'expired' };
    const counter = Math.floor(serverNow / stepMs);
    const index = counter - firstCounter;
    if (index < 0) return { state: 'not_yet', opensAt: new Date(opensAt).toISOString() };
    if (index >= count) return { state: 'expired' };
    const code = lot.codes.substr(index * digits, digits);
    if (!/^\d+$/.test(code)) return { state: 'corrupt', reason: 'code illisible' };
    return {
        state: 'code',
        counter,
        code,
        payload: `${lot.prefix}:${lot.ticket_id}:${code}`,
        serverNow,
        nextChangeInMs: Math.max(1, (counter + 1) * stepMs - serverNow),
        stepMs,
    };
}

/** Le lot local couvre-t-il encore l'instant présent (heure du serveur estimée) ? */
export function lotExpired(lot: OfflineLot, deviceNow: number = Date.now()): boolean {
    const serverNow = deviceNow + Number(lot.offsetMs ?? 0);
    return serverNow >= Math.min(timeOf(lot.expires_at, 'expires_at'), timeOf(lot.valid_until, 'valid_until'));
}

/**
 * Faut-il (re)télécharger le lot ? Seulement si le serveur dit le billet disponible (`offline.available`),
 * et si le lot est absent, d'une autre version du secret, expiré, ou incomplet à moins de 24 h de sa fin.
 */
export function needsDownload(lot: OfflineLot | null | undefined, offline: OfflineAvailability | null | undefined): boolean {
    if (!offline || offline.available !== true) return false;
    if (!lot) return true;
    if (Number(lot.secret_version) !== Number(offline.secret_version)) return true;
    const now = Date.now();
    if (lotExpired(lot, now)) return true;
    if (!lot.complete) {
        const serverNow = now + Number(lot.offsetMs ?? 0);
        if (serverNow >= timeOf(lot.valid_until, 'valid_until') - REFRESH_BEFORE_END_MS) return true;
    }
    return false;
}

/** États de l'indicateur hors ligne (attribut data-ev-offline-state, contrat 5.2). */
export type OfflineIndicatorState = 'available' | 'missing' | 'not_yet' | 'offline_missing' | 'expired';

/**
 * État de l'indicateur d'une carte billet. `available` exige le lot de la version courante, non expiré,
 * ET la coquille de la page hors ligne en cache (D35). null : aucun indicateur (billet hors fenêtre).
 */
export function offlineIndicator(input: {
    lot: OfflineLot | null;
    offline: OfflineAvailability | null | undefined;
    shellCached: boolean;
    online: boolean;
    deviceNow?: number;
}): OfflineIndicatorState | null {
    const { lot, offline, shellCached, online } = input;
    const now = input.deviceNow ?? Date.now();
    const current = lot && (!offline || Number(lot.secret_version) === Number(offline.secret_version)) ? lot : null;
    if (current && !lotExpired(current, now)) return shellCached ? 'available' : 'missing';
    if (current) return 'expired';
    if (!offline) return online ? null : 'offline_missing';
    if (offline.available) return online ? 'missing' : 'offline_missing';
    if (offline.reason === 'NOT_YET') return 'not_yet';
    return null;
}

/**
 * Lot 4.2 — code dynamique des billets, QR « EVT1:<UUID du billet>:<code à 6 chiffres> ».
 *
 * Clé effective du billet = HMAC-SHA256(TICKET_TOTP_MASTER_KEY, « ticket-totp:v2:<id>:<totp_secret> ») :
 * totp_secret est propre au billet (en base, généré à l'émission, régénéré au transfert) et la clé
 * maître n'est jamais en base, si bien que lire la colonne ne suffit pas à calculer un code. Plus
 * aucune dérivation depuis SUPABASE_AUTH_HOOK_SECRET ni depuis la clé service_role.
 * Pas de 20 s, troncature HOTP sur 6 chiffres, tolérance ±1 pas (un code de plus de 40 s est
 * toujours refusé), comparaison en temps constant.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';
import { getServerEnv } from '@/lib/env';

export const TOTP_STEP_SECONDS = 20;
export const TOTP_DRIFT_STEPS = 1;
export const TOTP_PREFIX = 'EVT1';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SECRET = /^[0-9a-f]{64}$/;
const PAYLOAD = /^EVT1:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}):(\d{6})$/i;

function ticketKey(ticketId: string, totpSecret: string): Buffer {
    if (!UUID.test(ticketId)) throw new Error('Identifiant de billet invalide pour le code dynamique.');
    if (!SECRET.test(totpSecret)) throw new Error(`Secret du billet ${ticketId} invalide.`);
    return createHmac('sha256', getServerEnv().TICKET_TOTP_MASTER_KEY)
        .update(`ticket-totp:v2:${ticketId.toLowerCase()}:${totpSecret}`)
        .digest();
}

function hotp(key: Buffer, counter: number): string {
    const message = Buffer.alloc(8);
    message.writeBigUInt64BE(BigInt(counter));
    const digest = createHmac('sha1', key).update(message).digest();
    const offset = digest[digest.length - 1] & 0x0f;
    const binary = ((digest[offset] & 0x7f) << 24) | (digest[offset + 1] << 16) | (digest[offset + 2] << 8) | digest[offset + 3];
    return String(binary % 1_000_000).padStart(6, '0');
}

export function counterAt(at: Date): number {
    return Math.floor(at.getTime() / 1000 / TOTP_STEP_SECONDS);
}

/** Secondes avant le prochain pas (rafraîchissement du QR affiché). */
export function secondsUntilNextStep(at: Date = new Date()): number {
    const elapsed = (at.getTime() / 1000) % TOTP_STEP_SECONDS;
    return Math.max(1, Math.ceil(TOTP_STEP_SECONDS - elapsed));
}

export function generateTicketCode(ticketId: string, totpSecret: string, at: Date = new Date()): string {
    return hotp(ticketKey(ticketId, totpSecret), counterAt(at));
}

/** Nombre maximal de codes d'un lot hors ligne : 48 h de pas de 20 s (+ 1 de marge, contrat M4.5). */
export const OFFLINE_CODES_MAX = 8641;

/**
 * Lot 7 (7.1, contrat 3.1) — suite des codes du billet pour les compteurs firstCounter … firstCounter + count − 1,
 * concaténés en une seule chaîne de 6 × count chiffres (code d'indice i = substr(6 i, 6)). La clé du billet est
 * dérivée une seule fois. Le secret ne quitte jamais le serveur : seuls les codes sont envoyés au navigateur.
 */
export function generateTicketCodes(ticketId: string, totpSecret: string, firstCounter: number, count: number): string {
    if (!Number.isSafeInteger(firstCounter) || firstCounter < 0) throw new Error(`Compteur de départ invalide pour le billet ${ticketId}.`);
    if (!Number.isSafeInteger(count) || count < 1 || count > OFFLINE_CODES_MAX) {
        throw new Error(`Nombre de codes invalide pour le billet ${ticketId} (${count}, de 1 à ${OFFLINE_CODES_MAX}).`);
    }
    const key = ticketKey(ticketId, totpSecret);
    const codes: string[] = new Array(count);
    for (let i = 0; i < count; i++) codes[i] = hotp(key, firstCounter + i);
    return codes.join('');
}

/** Vrai si le code correspond au pas courant ou à un pas voisin (±1), comparaison en temps constant. */
export function verifyTicketCode(ticketId: string, totpSecret: string, code: string, at: Date = new Date()): boolean {
    if (!/^\d{6}$/.test(code)) return false;
    const key = ticketKey(ticketId, totpSecret);
    const counter = counterAt(at);
    const received = Buffer.from(code);
    let match = false;
    for (let drift = -TOTP_DRIFT_STEPS; drift <= TOTP_DRIFT_STEPS; drift++) {
        const expected = Buffer.from(hotp(key, counter + drift));
        if (expected.length === received.length && timingSafeEqual(expected, received)) match = true;
    }
    return match;
}

export function buildTicketPayload(ticketId: string, code: string): string {
    return `${TOTP_PREFIX}:${ticketId.toLowerCase()}:${code}`;
}

/** Payload de QR dynamique, rien d'autre : un identifiant nu (numéro, qr_code, UUID seul) renvoie null. */
export function parseTicketPayload(raw: string): { ticketId: string; code: string } | null {
    const match = PAYLOAD.exec(String(raw ?? '').trim());
    if (!match) return null;
    return { ticketId: match[1].toLowerCase(), code: match[2] };
}

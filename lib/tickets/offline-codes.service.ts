/**
 * Lot 7, tâche 7.1 (contrat 3.1, D29 à D31, D37, D38) — lot de codes hors ligne d'un billet.
 *
 * Ordre : identifiant (404 si ce n'est pas un UUID), quota tout ou rien par billet et par compte (fenêtres
 * fixes d'une heure : 429 + Retry-After, 503 si la garde ne répond pas), puis RPC ticket_offline_grant
 * (décision sous verrou, fenêtre, plage glissante de 48 h au plus, journal ticket_offline_downloads), enfin
 * calcul des codes en Node (generateTicketCodes, clé du billet dérivée une seule fois).
 *
 * Le secret du billet ne quitte la base que vers ce module : la réponse ne contient que les codes. Aucune heure
 * n'est acceptée de l'appelant (les bornes à la seconde se testent par la RPC seule). Les refus (404, 409, 429)
 * ne sont pas journalisés en base (pas d'oracle) : avertissement serveur seulement.
 */
import { rpcWithRetry } from '@/lib/payments/rpc';
import { getServerEnv } from '@/lib/env';
import { reserveQuota } from '@/lib/security/quota';
import { generateTicketCodes, TOTP_PREFIX, TOTP_STEP_SECONDS } from '@/lib/security/totp';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const STEP_MS = TOTP_STEP_SECONDS * 1000;
const DIGITS = 6;
const QUOTA_WINDOW_SECS = 3600;
const REFRESH_BEFORE_MS = 24 * 3600 * 1000;

export interface OfflineCodesInput {
    ticketId: string;
    userId: string;
}

export interface OfflineCodesResult {
    status: number;
    body: Record<string, unknown>;
    /** En-têtes propres au résultat (Retry-After d'un 429). */
    headers: Record<string, string>;
}

const NOT_FOUND_BODY = { error: 'Billet introuvable.', code: 'TICKET_NOT_FOUND' } as const;

/** Messages des refus 409 de la RPC (codes du contrat 3.1) : jamais un texte de la base. */
const CONFLICT_MESSAGES: Readonly<Record<string, string>> = {
    TICKET_NOT_VALID: 'Ce billet n’est plus valable à l’entrée.',
    EVENT_NOT_PUBLISHED: 'Cet événement n’est pas ouvert : les codes hors ligne ne sont pas disponibles.',
    TRANSFER_PENDING: 'Ce billet est en cours de transfert : les codes hors ligne ne sont pas disponibles.',
    OFFLINE_WINDOW_CLOSED: 'Les codes hors ligne sont disponibles de 24 h avant le début de l’événement jusqu’à la fin du contrôle des entrées.',
};

interface GrantOk {
    ok: true;
    ticket_id: string;
    secret_version: number;
    totp_secret: string;
    first_counter: number;
    count: number;
    first_step_at: string;
    last_step_at: string;
    scan_opens_at: string;
    scan_closes_at: string;
    complete: boolean;
    download_id: string;
    ticket: Record<string, unknown>;
}

interface GrantRefusal {
    ok: false;
    http?: number;
    code?: string;
    available_from?: string;
    available_until?: string;
}

function serverError(): OfflineCodesResult {
    return { status: 500, body: { error: 'Erreur serveur.', code: 'SERVER_ERROR' }, headers: {} };
}

function iso(value: unknown, what: string): string {
    const t = Date.parse(String(value));
    if (!Number.isFinite(t)) throw new Error(`ticket_offline_grant : ${what} illisible (${JSON.stringify(value)})`);
    return new Date(t).toISOString();
}

/** Contrôle la forme de la réponse accordée : une réponse inattendue est une erreur, jamais un lot approximatif. */
function grantOf(data: unknown): GrantOk | GrantRefusal {
    const r = (data ?? {}) as Record<string, unknown>;
    if (r.ok === false) return r as unknown as GrantRefusal;
    if (r.ok !== true) throw new Error(`ticket_offline_grant : réponse inattendue ${JSON.stringify(data).slice(0, 200)}`);
    const g = r as unknown as GrantOk;
    if (typeof g.ticket_id !== 'string' || typeof g.totp_secret !== 'string'
        || !Number.isSafeInteger(Number(g.secret_version)) || !Number.isSafeInteger(Number(g.first_counter))
        || !Number.isSafeInteger(Number(g.count)) || typeof g.complete !== 'boolean' || !g.ticket || typeof g.ticket !== 'object') {
        throw new Error('ticket_offline_grant : réponse accordée incomplète');
    }
    return g;
}

/**
 * Lot de codes hors ligne du billet `ticketId` pour le compte `userId` (session déjà contrôlée par la route).
 * Réponse 200 au format compact du contrat 3.1, ou refus { error, code } (404, 409, 429, 503, 500).
 */
export async function issueOfflineCodes(input: OfflineCodesInput): Promise<OfflineCodesResult> {
    const { ticketId, userId } = input;
    if (!UUID.test(ticketId)) {
        console.warn(`[offline-codes] identifiant non UUID demandé par le compte ${userId} : 404`);
        return { status: 404, body: { ...NOT_FOUND_BODY }, headers: {} };
    }

    const env = getServerEnv();
    const quota = await reserveQuota([
        { scope: 'offline_codes_ticket', bucket: ticketId.toLowerCase(), windowSecs: QUOTA_WINDOW_SECS, max: env.OFFLINE_CODES_PER_TICKET_HOUR },
        { scope: 'offline_codes_user', bucket: userId, windowSecs: QUOTA_WINDOW_SECS, max: env.OFFLINE_CODES_PER_USER_HOUR },
    ], 'offline-codes');
    if (!quota.allowed) {
        if (quota.reason === 'UNAVAILABLE') {
            return { status: 503, body: { error: 'Codes hors ligne momentanément indisponibles : réessayez dans un instant.', code: 'QUOTA_UNAVAILABLE' }, headers: {} };
        }
        console.warn(`[offline-codes] quota ${quota.scope} atteint pour le billet ${ticketId} (compte ${userId}) : 429`);
        return {
            status: 429,
            body: { error: 'Trop de téléchargements des codes hors ligne : réessayez plus tard.', code: 'RATE_LIMITED' },
            headers: { 'Retry-After': String(Math.max(1, Math.ceil(quota.retryAfterSeconds))) },
        };
    }

    const { data, error } = await rpcWithRetry('ticket_offline_grant', { p: { ticket_id: ticketId, user_id: userId } });
    if (error) {
        console.error(`[offline-codes] ticket_offline_grant pour le billet ${ticketId} : ${error.code ?? ''} ${error.message}`);
        return serverError();
    }

    let grant: GrantOk | GrantRefusal;
    try {
        grant = grantOf(data);
    } catch (err) {
        console.error(`[offline-codes] billet ${ticketId} : ${err instanceof Error ? err.message : String(err)}`);
        return serverError();
    }

    if (!grant.ok) {
        const code = String(grant.code ?? '');
        if (grant.http === 404 && code === 'TICKET_NOT_FOUND') {
            console.warn(`[offline-codes] billet ${ticketId} introuvable ou d'un autre porteur (compte ${userId}) : 404`);
            return { status: 404, body: { ...NOT_FOUND_BODY }, headers: {} };
        }
        if (grant.http === 409 && code in CONFLICT_MESSAGES) {
            console.warn(`[offline-codes] billet ${ticketId} (compte ${userId}) refusé : ${code}`);
            const body: Record<string, unknown> = { error: CONFLICT_MESSAGES[code], code };
            if (code === 'OFFLINE_WINDOW_CLOSED') {
                try {
                    body.available_from = iso(grant.available_from, 'available_from');
                    body.available_until = iso(grant.available_until, 'available_until');
                } catch (err) {
                    console.error(`[offline-codes] billet ${ticketId} : ${err instanceof Error ? err.message : String(err)}`);
                    return serverError();
                }
            }
            return { status: 409, body, headers: {} };
        }
        console.error(`[offline-codes] ticket_offline_grant : refus inattendu pour le billet ${ticketId} : ${JSON.stringify(grant).slice(0, 200)}`);
        return serverError();
    }

    try {
        const count = Number(grant.count);
        const firstCounter = Number(grant.first_counter);
        const codes = generateTicketCodes(grant.ticket_id, grant.totp_secret, firstCounter, count);
        const firstStepMs = firstCounter * STEP_MS;
        const lastStepMs = firstStepMs + (count - 1) * STEP_MS;
        const validUntilMs = lastStepMs + STEP_MS;
        if (Date.parse(grant.first_step_at) !== firstStepMs || Date.parse(grant.last_step_at) !== lastStepMs) {
            throw new Error('plage de la base incohérente avec le compteur de départ');
        }
        const scanOpensAt = iso(grant.scan_opens_at, 'scan_opens_at');
        const scanClosesAt = iso(grant.scan_closes_at, 'scan_closes_at');
        const validUntil = new Date(validUntilMs).toISOString();
        const ticket = grant.ticket;
        return {
            status: 200,
            headers: {},
            body: {
                ticket_id: grant.ticket_id,
                secret_version: Number(grant.secret_version),
                prefix: TOTP_PREFIX,
                step_seconds: TOTP_STEP_SECONDS,
                digits: DIGITS,
                first_counter: firstCounter,
                count,
                codes,
                first_step_at: new Date(firstStepMs).toISOString(),
                last_step_at: new Date(lastStepMs).toISOString(),
                valid_until: validUntil,
                expires_at: new Date(Math.min(Date.parse(scanClosesAt), validUntilMs)).toISOString(),
                scan_opens_at: scanOpensAt,
                scan_closes_at: scanClosesAt,
                complete: grant.complete,
                next_from: grant.complete ? null : validUntil,
                refresh_after: grant.complete ? null : new Date(validUntilMs - REFRESH_BEFORE_MS).toISOString(),
                ticket: {
                    ticket_number: String(ticket.ticket_number ?? ''),
                    category: String(ticket.category ?? ''),
                    event_title: String(ticket.event_title ?? ''),
                    event_start_at: iso(ticket.event_start_at, 'ticket.event_start_at'),
                    location: String(ticket.location ?? ''),
                    city: String(ticket.city ?? ''),
                },
                // Heure du serveur juste avant l'envoi : le téléphone en déduit son écart d'horloge.
                server_time: new Date(Date.now()).toISOString(),
            },
        };
    } catch (err) {
        console.error(`[offline-codes] calcul du lot du billet ${grant.ticket_id} (téléchargement ${grant.download_id}) : ${err instanceof Error ? err.message : String(err)}`);
        return serverError();
    }
}

/**
 * Adaptateur email réel — API REST Resend (https://resend.com).
 * Seul endroit du code qui parle au réseau Resend.
 * Sans RESEND_API_KEY, l'envoyeur n'appelle pas cet adaptateur (lot 1C.8, lot 6 :
 * lib/notifications/channels.ts) ; le contrôle ci-dessous reste une défense en profondeur.
 *
 * Lot 6 (contrat F3) :
 *  - version texte (`text`) et en-têtes du message (`headers`, dont List-Unsubscribe) transmis dans le corps ;
 *  - clé d'idempotence de la ligne de la boîte d'envoi dans l'en-tête HTTP `Idempotency-Key` : une relance
 *    après un délai dépassé ne crée pas de second email chez Resend ;
 *  - délai maximal de 15 s par appel (au-delà : relance permise, la clé d'idempotence évite un doublon) ;
 *  - `retryable` : vrai pour HTTP 429, 5xx, délai dépassé ou réseau ; faux pour un refus (4xx).
 *
 * Lot 9 bis (tâche 48) : `timeoutMs` facultatif dans la charge (lien de vérification synchrone : 5 s), borné à 1 à
 * 15 s ; sans lui, 15 s comme avant.
 */
import type { EmailAdapter, EmailSendPayload, EmailSendResult } from '@/lib/integrations/types';

const TIMEOUT_MS = 15_000;
const MIN_TIMEOUT_MS = 1_000;

/** Délai de l'appel : `timeoutMs` de la charge s'il est un entier de 1 à 15 s, sinon 15 s. */
function timeoutOf(payload: EmailSendPayload): number {
    const wanted = (payload as EmailSendPayload & { timeoutMs?: unknown }).timeoutMs;
    if (typeof wanted !== 'number' || !Number.isInteger(wanted)) return TIMEOUT_MS;
    return Math.min(Math.max(wanted, MIN_TIMEOUT_MS), TIMEOUT_MS);
}

/** En-têtes de message admis (aucun en-tête d'adressage ni de routage fourni par l'appelant). */
const FORBIDDEN_MESSAGE_HEADERS = new Set(['to', 'from', 'cc', 'bcc', 'reply-to', 'subject', 'sender', 'return-path']);

function messageHeaders(headers: Record<string, string> | undefined): Record<string, string> | undefined {
    if (!headers) return undefined;
    const out: Record<string, string> = {};
    for (const [name, value] of Object.entries(headers)) {
        if (FORBIDDEN_MESSAGE_HEADERS.has(name.toLowerCase())) continue;
        if (/[\r\n]/.test(name) || /[\r\n]/.test(value)) continue; // aucune injection d'en-tête
        out[name] = value;
    }
    return Object.keys(out).length > 0 ? out : undefined;
}

export class ResendHttpAdapter implements EmailAdapter {
    private static readonly RESEND_API = 'https://api.resend.com/emails';

    private static fromAddress(): string {
        const addr = process.env.NOTIFICATION_FROM_EMAIL || 'notifications@eventvillage.sn';
        return `Event Village <${addr}>`;
    }

    async send(payload: EmailSendPayload): Promise<EmailSendResult> {
        const apiKey = process.env.RESEND_API_KEY;

        if (!apiKey) {
            console.warn('[ResendHttpAdapter] RESEND_API_KEY manquant — email non expédié :', payload.subject);
            return { sent: false, error: 'RESEND_API_KEY_MISSING', retryable: false };
        }

        const httpHeaders: Record<string, string> = {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
        };
        if (payload.idempotencyKey) httpHeaders['Idempotency-Key'] = payload.idempotencyKey.slice(0, 256);
        const extraHeaders = messageHeaders(payload.headers);

        let res: Response;
        try {
            res = await fetch(ResendHttpAdapter.RESEND_API, {
                method: 'POST',
                headers: httpHeaders,
                body: JSON.stringify({
                    from: payload.from ?? ResendHttpAdapter.fromAddress(),
                    to: Array.isArray(payload.to) ? payload.to : [payload.to],
                    subject: payload.subject,
                    html: payload.html,
                    ...(payload.text ? { text: payload.text } : {}),
                    ...(extraHeaders ? { headers: extraHeaders } : {}),
                    ...(payload.replyTo ? { reply_to: payload.replyTo } : {}),
                }),
                signal: AbortSignal.timeout(timeoutOf(payload)),
            });
        } catch (err) {
            const msg = err instanceof Error ? `${err.name}: ${err.message}` : 'network_error';
            console.warn('[ResendHttpAdapter] Exception envoi:', msg, '— sujet:', payload.subject);
            return { sent: false, error: msg, retryable: true };
        }

        if (!res.ok) {
            let detail = `HTTP ${res.status}`;
            try {
                const errBody = await res.json() as Record<string, unknown>;
                if (typeof errBody.message === 'string' && errBody.message) detail = `HTTP ${res.status} : ${errBody.message}`;
            } catch (err) {
                console.warn('[ResendHttpAdapter] réponse d’erreur illisible :', err instanceof Error ? err.message : String(err));
            }
            const retryable = res.status === 429 || res.status >= 500;
            console.warn('[ResendHttpAdapter] Resend API error:', detail, '— sujet:', payload.subject);
            return { sent: false, error: detail, retryable };
        }

        try {
            const data = await res.json() as { id?: string };
            return { sent: true, id: data.id };
        } catch (err) {
            // Accepté par Resend (2xx) mais réponse illisible : l'email est parti ; identifiant inconnu.
            console.warn('[ResendHttpAdapter] réponse de succès illisible :', err instanceof Error ? err.message : String(err));
            return { sent: true };
        }
    }
}

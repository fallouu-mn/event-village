/**
 * Lot 6 (contrat F4) — adaptateur push web réel.
 *
 * `web-push` (3.6.7, version épinglée) ne sert qu'au chiffrement de la charge (aes128gcm, RFC 8291) et à
 * l'en-tête VAPID (JWT ES256, RFC 8292), par `generateRequestDetails`. Le transport est NOTRE `fetch` :
 *  - délai maximal PUSH_TIMEOUT_MS (défaut 10 000 ms, lu à chaque envoi) par AbortSignal.timeout ;
 *  - liste blanche des services push vérifiée juste avant l'envoi (lib/push/endpoints.ts, anti-SSRF) ;
 *  - aucune redirection suivie (`redirect: 'manual'`) : une redirection est un refus ;
 *  - le verrou réseau des tests s'applique (aucun client HTTP parallèle).
 *
 * Correspondance (F4) : 200/201/202 → ACCEPTED ; 404/410 → GONE ; 413 → TOO_LARGE ; 429, 5xx, délai ou
 * réseau → RETRY (Retry-After lu en secondes ou en date HTTP) ; autre statut → REJECTED. Pas d'issue
 * incertaine pour le push : un message reçu deux fois est fusionné par le navigateur (même `tag`).
 */
import webpush from 'web-push';
import type { PushAdapter, PushMessage, PushSendOptions, PushSendResult, PushTarget } from '@/lib/integrations/types';
import { getPushConfig } from './config';
import { isAllowedPushEndpoint } from './endpoints';

const DEFAULT_TIMEOUT_MS = 10_000;

function timeoutMs(): number {
    const raw = Number(process.env.PUSH_TIMEOUT_MS);
    return Number.isInteger(raw) && raw > 0 ? raw : DEFAULT_TIMEOUT_MS;
}

/** Retry-After en secondes (nombre ou date HTTP), ou undefined s'il est absent ou illisible. */
export function parseRetryAfter(value: string | null, nowMs: number = Date.now()): number | undefined {
    if (!value) return undefined;
    const trimmed = value.trim();
    if (/^\d+$/.test(trimmed)) {
        const s = Number(trimmed);
        return s > 0 ? s : undefined;
    }
    const at = Date.parse(trimmed);
    if (Number.isNaN(at)) return undefined;
    const s = Math.ceil((at - nowMs) / 1000);
    return s > 0 ? s : undefined;
}

function errorText(err: unknown): string {
    if (err instanceof Error) {
        const cause = (err as Error & { cause?: { code?: unknown } }).cause;
        const code = cause && typeof cause.code === 'string' ? ` (${cause.code})` : '';
        return `${err.name}: ${err.message}${code}`;
    }
    return String(err);
}

export class WebPushAdapter implements PushAdapter {
    async send(target: PushTarget, message: PushMessage, options: PushSendOptions): Promise<PushSendResult> {
        const config = getPushConfig();
        if (!config.enabled) {
            return { outcome: 'REJECTED', statusCode: null, error: `Push non configuré : ${config.reason}` };
        }
        if (!isAllowedPushEndpoint(target.endpoint)) {
            return { outcome: 'REJECTED', statusCode: null, error: 'Point d’arrivée hors de la liste blanche des services push' };
        }

        let details: ReturnType<typeof webpush.generateRequestDetails>;
        try {
            details = webpush.generateRequestDetails(
                { endpoint: target.endpoint, keys: { p256dh: target.p256dh, auth: target.auth } },
                JSON.stringify(message),
                {
                    vapidDetails: { subject: config.subject, publicKey: config.publicKey, privateKey: config.privateKey },
                    TTL: Math.max(0, Math.floor(options.ttlSeconds)),
                    urgency: options.urgency,
                    contentEncoding: 'aes128gcm',
                },
            );
        } catch (err) {
            // Clés d'abonnement illisibles ou configuration refusée par la bibliothèque : rien n'est parti.
            const error = `Chiffrement du push impossible : ${errorText(err)}`;
            console.error(`[push] ${error}`);
            return { outcome: 'REJECTED', statusCode: null, error };
        }

        const headers: Record<string, string> = {};
        for (const [name, value] of Object.entries(details.headers)) {
            // La longueur est calculée par fetch ; la recopier pourrait contredire le corps envoyé.
            if (name.toLowerCase() === 'content-length') continue;
            headers[name] = String(value);
        }
        const body = details.body ? new Uint8Array(details.body) : undefined;

        let res: Response;
        try {
            res = await fetch(details.endpoint, {
                method: details.method,
                headers,
                body,
                redirect: 'manual',
                signal: AbortSignal.timeout(timeoutMs()),
            });
        } catch (err) {
            const name = err instanceof Error ? err.name : '';
            const error = name === 'TimeoutError' || name === 'AbortError'
                ? `Délai dépassé vers le service push (${timeoutMs()} ms)`
                : `Service push injoignable : ${errorText(err)}`;
            console.warn(`[push] ${error}`);
            return { outcome: 'RETRY', statusCode: null, error };
        }

        const status = res.status;
        const retryAfter = parseRetryAfter(res.headers.get('retry-after'));
        try {
            await res.arrayBuffer(); // corps lu (et ignoré) pour libérer la connexion
        } catch (err) {
            console.warn(`[push] lecture de la réponse du service push impossible (HTTP ${status}) : ${errorText(err)}`);
        }

        if (status === 200 || status === 201 || status === 202) return { outcome: 'ACCEPTED', statusCode: status };
        if (status === 404 || status === 410) return { outcome: 'GONE', statusCode: status, error: `Abonnement expiré (HTTP ${status})` };
        if (status === 413) return { outcome: 'TOO_LARGE', statusCode: status, error: 'Charge trop grande pour le service push (HTTP 413)' };
        if (status === 429 || status >= 500) {
            const out: PushSendResult = { outcome: 'RETRY', statusCode: status, error: `Service push momentanément indisponible (HTTP ${status})` };
            if (retryAfter !== undefined) out.retryAfterSeconds = retryAfter;
            return out;
        }
        return { outcome: 'REJECTED', statusCode: status, error: `Refus du service push (HTTP ${status})` };
    }
}

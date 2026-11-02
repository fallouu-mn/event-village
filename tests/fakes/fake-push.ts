/**
 * Lot 6 — faux adaptateur push web (contrat F4) : n'envoie rien, enregistre chaque appel EN CLAIR
 * (`{ endpoint, message, options, statusCode, outcome, at }`) pour vérifier le contenu exact et le
 * nombre d'envois par appareil.
 *
 * Réponse par défaut : 201 (accepté). Scénarios :
 *  - respondNext(status | 'timeout', opts?) : file globale, consommée dans l'ordre d'appel ;
 *  - respondFor(endpoint, ...statuses)       : file propre à un appareil, prioritaire sur la file globale
 *                                              (l'ordre d'envoi entre appareils n'est pas garanti).
 * Correspondance (F4) : 201/202 → ACCEPTED ; 404/410 → GONE ; 413 → TOO_LARGE ; 429, 5xx et 'timeout'
 * → RETRY ; autre 4xx (400, 401, 403…) → REJECTED.
 *
 * Les interfaces ci-dessous recopient exactement celles du contrat F4 : tant que
 * `lib/integrations/types.ts` ne les déclare pas (correctif 6.2), elles sont définies ici ; le faux
 * reste structurellement conforme à `PushAdapter` une fois le contrat ajouté.
 */

export interface PushTarget { endpoint: string; p256dh: string; auth: string }
export interface PushMessage { title: string; body: string; url: string; tag: string }
export interface PushSendOptions { ttlSeconds: number; urgency: 'normal' | 'high' }
export interface PushSendResult {
    outcome: 'ACCEPTED' | 'GONE' | 'REJECTED' | 'RETRY' | 'TOO_LARGE';
    statusCode: number | null;
    retryAfterSeconds?: number;
    error?: string;
}
export interface PushAdapter { send(target: PushTarget, message: PushMessage, options: PushSendOptions): Promise<PushSendResult> }

export type FakePushResponse = number | 'timeout';

export interface RecordedPush {
    endpoint: string;
    /** Clés de l'abonnement visé (pour vérifier qu'un abonnement d'une autre clé VAPID n'est pas servi). */
    p256dh: string;
    auth: string;
    message: PushMessage;
    options: PushSendOptions;
    statusCode: number | null;
    outcome: PushSendResult['outcome'];
    at: string;
}

interface ScriptedResponse { response: FakePushResponse; retryAfterSeconds?: number }

function toResult(scripted: ScriptedResponse): PushSendResult {
    const { response, retryAfterSeconds } = scripted;
    if (response === 'timeout') return { outcome: 'RETRY', statusCode: null, error: 'Délai dépassé (simulation)' };
    if (!Number.isInteger(response) || response < 100 || response > 599) {
        throw new Error(`Faux push : statut HTTP invalide « ${String(response)} »`);
    }
    if (response === 201 || response === 202 || response === 200) return { outcome: 'ACCEPTED', statusCode: response };
    if (response === 404 || response === 410) return { outcome: 'GONE', statusCode: response, error: 'Abonnement expiré (simulation)' };
    if (response === 413) return { outcome: 'TOO_LARGE', statusCode: response, error: 'Charge trop grande (simulation)' };
    if (response === 429 || response >= 500) {
        const out: PushSendResult = { outcome: 'RETRY', statusCode: response, error: `Service push indisponible (simulation, ${response})` };
        if (retryAfterSeconds !== undefined) out.retryAfterSeconds = retryAfterSeconds;
        return out;
    }
    return { outcome: 'REJECTED', statusCode: response, error: `Refus du service push (simulation, ${response})` };
}

export class FakePushAdapter implements PushAdapter {
    readonly sent: RecordedPush[] = [];
    private globalQueue: ScriptedResponse[] = [];
    private perEndpoint = new Map<string, ScriptedResponse[]>();

    /** Réponse du prochain envoi (puis des suivants, dans l'ordre d'appel). */
    respondNext(response: FakePushResponse, opts: { retryAfterSeconds?: number } = {}): void {
        this.globalQueue.push({ response, retryAfterSeconds: opts.retryAfterSeconds });
    }

    /** Réponses des prochains envois vers cet appareil, dans l'ordre (prioritaires sur respondNext). */
    respondFor(endpoint: string, ...responses: FakePushResponse[]): void {
        const queue = this.perEndpoint.get(endpoint) ?? [];
        for (const response of responses) queue.push({ response });
        this.perEndpoint.set(endpoint, queue);
    }

    reset(): void {
        this.sent.length = 0;
        this.globalQueue = [];
        this.perEndpoint.clear();
    }

    /** Tous les appels vers un appareil, toutes issues confondues. */
    messagesTo(endpoint: string): RecordedPush[] {
        return this.sent.filter((p) => p.endpoint === endpoint);
    }

    /** Appels acceptés par le service push pour cet appareil (`outcome === 'ACCEPTED'`). */
    deliveredTo(endpoint: string): RecordedPush[] {
        return this.messagesTo(endpoint).filter((p) => p.outcome === 'ACCEPTED');
    }

    async send(target: PushTarget, message: PushMessage, options: PushSendOptions): Promise<PushSendResult> {
        const own = this.perEndpoint.get(target.endpoint);
        const scripted = own && own.length > 0 ? own.shift()! : (this.globalQueue.shift() ?? { response: 201 });
        const result = toResult(scripted);
        this.sent.push({
            endpoint: target.endpoint,
            p256dh: target.p256dh,
            auth: target.auth,
            message: { ...message },
            options: { ...options },
            statusCode: result.statusCode,
            outcome: result.outcome,
            at: new Date().toISOString(),
        });
        return result;
    }
}

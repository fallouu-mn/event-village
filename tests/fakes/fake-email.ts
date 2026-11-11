/**
 * Faux adaptateur email : n'envoie rien, enregistre chaque appel pour assertion.
 *
 * Lot 6 (contrat F3) : l'enregistrement garde aussi la version texte (`text`), les en-têtes
 * (`headers`, dont List-Unsubscribe) et la clé d'idempotence si l'appelant la fournit ; `failNext`
 * accepte en plus `{ retryable }` (refus 429 ou 5xx du fournisseur). Sans ces options, le
 * comportement des lots 0 à 5 est inchangé.
 *
 * Lot 9 bis (tâche 52, G.52) : `delayNext(ms, times)` fait attendre la réponse des prochains envois (fournisseur lent) ;
 * l'enregistrement d'un envoi retardé est ajouté à sa réponse, avec `at` (appel) et `finishedAt` (réponse). Sans
 * `delayNext`, rien ne change : réponse immédiate, `finishedAt` égal à `at`.
 */
import type { EmailAdapter, EmailSendPayload, EmailSendResult } from '../../lib/integrations/types';

export interface RecordedEmail {
    to: string[];
    subject: string;
    html: string;
    /** Lot 6 : version texte du message. */
    text?: string;
    /** Lot 6 : en-têtes transmis au fournisseur (List-Unsubscribe…). */
    headers?: Record<string, string>;
    /** Lot 6 : clé d'idempotence transmise au fournisseur (en-tête HTTP Idempotency-Key chez Resend). */
    idempotencyKey?: string;
    from?: string;
    replyTo?: string;
    success: boolean;
    error?: string;
    at: string;
    /** Lot 9 bis : instant de la réponse (après le délai de `delayNext`, sinon égal à `at`). */
    finishedAt: string;
}

/** Charge du contrat F3, typée localement tant que `lib/integrations/types.ts` ne la déclare pas (correctif 6.2). */
export type FakeEmailPayload = EmailSendPayload & {
    text?: string;
    headers?: Record<string, string>;
    idempotencyKey?: string;
};

export type FakeEmailSendResult = EmailSendResult & { retryable?: boolean };

interface EmailFailure { error: string; retryable?: boolean }

export class FakeEmailAdapter implements EmailAdapter {
    readonly sent: RecordedEmail[] = [];
    private failureQueue: EmailFailure[] = [];
    private delayQueue: number[] = [];

    failNext(error = 'Email refusé (simulation)', opts: { retryable?: boolean } = {}): void {
        this.failureQueue.push({ error, retryable: opts.retryable });
    }

    /** Lot 9 bis (tâche 52) : les `times` prochains envois répondent après `ms` millisecondes (dans l'ordre d'appel). */
    delayNext(ms: number, times = 1): void {
        if (!Number.isInteger(ms) || ms < 0) throw new Error(`delayNext : délai invalide (${ms} ms)`);
        if (!Number.isInteger(times) || times < 1) throw new Error(`delayNext : nombre d'envois invalide (${times})`);
        for (let i = 0; i < times; i++) this.delayQueue.push(ms);
    }

    /** Lot 9 bis : retire les refus (`failNext`) et délais (`delayNext`) non consommés, sans toucher aux envois enregistrés. */
    clearQueued(): { failures: number; delays: number } {
        const left = { failures: this.failureQueue.length, delays: this.delayQueue.length };
        this.failureQueue = [];
        this.delayQueue = [];
        return left;
    }

    reset(): void {
        this.sent.length = 0;
        this.failureQueue = [];
        this.delayQueue = [];
    }

    messagesTo(address: string): RecordedEmail[] {
        const needle = address.toLowerCase();
        return this.sent.filter((m) => m.to.some((t) => t.toLowerCase() === needle));
    }

    async send(payload: EmailSendPayload): Promise<FakeEmailSendResult> {
        const extra = payload as FakeEmailPayload;
        const failure = this.failureQueue.shift();
        const success = failure === undefined;
        const at = new Date().toISOString();
        const delay = this.delayQueue.shift();
        if (delay !== undefined && delay > 0) await new Promise<void>((resolve) => { setTimeout(resolve, delay); });
        this.sent.push({
            to: Array.isArray(payload.to) ? [...payload.to] : [payload.to],
            subject: payload.subject,
            html: payload.html,
            text: extra.text,
            headers: extra.headers ? { ...extra.headers } : undefined,
            idempotencyKey: extra.idempotencyKey,
            from: payload.from,
            replyTo: payload.replyTo,
            success,
            error: failure?.error,
            at,
            finishedAt: delay !== undefined && delay > 0 ? new Date().toISOString() : at,
        });
        if (failure) {
            const refused: FakeEmailSendResult = failure.retryable === undefined
                ? { sent: false, error: failure.error }
                : { sent: false, error: failure.error, retryable: failure.retryable };
            return refused;
        }
        return { sent: true, id: `fake-email-${this.sent.length}` };
    }
}

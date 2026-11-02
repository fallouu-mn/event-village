/**
 * Faux adaptateur email : n'envoie rien, enregistre chaque appel pour assertion.
 *
 * Lot 6 (contrat F3) : l'enregistrement garde aussi la version texte (`text`), les en-têtes
 * (`headers`, dont List-Unsubscribe) et la clé d'idempotence si l'appelant la fournit ; `failNext`
 * accepte en plus `{ retryable }` (refus 429 ou 5xx du fournisseur). Sans ces options, le
 * comportement des lots 0 à 5 est inchangé.
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

    failNext(error = 'Email refusé (simulation)', opts: { retryable?: boolean } = {}): void {
        this.failureQueue.push({ error, retryable: opts.retryable });
    }

    reset(): void {
        this.sent.length = 0;
        this.failureQueue = [];
    }

    messagesTo(address: string): RecordedEmail[] {
        const needle = address.toLowerCase();
        return this.sent.filter((m) => m.to.some((t) => t.toLowerCase() === needle));
    }

    async send(payload: EmailSendPayload): Promise<FakeEmailSendResult> {
        const extra = payload as FakeEmailPayload;
        const failure = this.failureQueue.shift();
        const success = failure === undefined;
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
            at: new Date().toISOString(),
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

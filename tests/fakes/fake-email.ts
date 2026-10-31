/**
 * Faux adaptateur email : n'envoie rien, enregistre chaque appel pour assertion.
 */
import type { EmailAdapter, EmailSendPayload, EmailSendResult } from '../../lib/integrations/types';

export interface RecordedEmail {
    to: string[];
    subject: string;
    html: string;
    from?: string;
    replyTo?: string;
    success: boolean;
    error?: string;
    at: string;
}

export class FakeEmailAdapter implements EmailAdapter {
    readonly sent: RecordedEmail[] = [];
    private failureQueue: string[] = [];

    failNext(error = 'Email refusé (simulation)'): void {
        this.failureQueue.push(error);
    }

    reset(): void {
        this.sent.length = 0;
        this.failureQueue = [];
    }

    messagesTo(address: string): RecordedEmail[] {
        const needle = address.toLowerCase();
        return this.sent.filter((m) => m.to.some((t) => t.toLowerCase() === needle));
    }

    async send(payload: EmailSendPayload): Promise<EmailSendResult> {
        const error = this.failureQueue.shift();
        const success = error === undefined;
        this.sent.push({
            to: Array.isArray(payload.to) ? [...payload.to] : [payload.to],
            subject: payload.subject,
            html: payload.html,
            from: payload.from,
            replyTo: payload.replyTo,
            success,
            error,
            at: new Date().toISOString(),
        });
        if (!success) {
            return { sent: false, error };
        }
        return { sent: true, id: `fake-email-${this.sent.length}` };
    }
}

/**
 * Faux adaptateur SMS : n'envoie rien, enregistre chaque appel pour assertion.
 */
import type { SmsAdapter, SmsSendResult } from '../../lib/integrations/types';
import { formatMTargetPhoneNumber } from '../../lib/sms/mtarget-http.adapter';

export interface RecordedSms {
    to: string;
    recipient: string;
    message: string;
    success: boolean;
    error?: string;
    at: string;
}

export class FakeSmsAdapter implements SmsAdapter {
    readonly sent: RecordedSms[] = [];
    private failureQueue: string[] = [];

    /** Fait échouer le prochain envoi (puis les suivants dans l'ordre d'appel). */
    failNext(error = 'SMS refusé (simulation)'): void {
        this.failureQueue.push(error);
    }

    reset(): void {
        this.sent.length = 0;
        this.failureQueue = [];
    }

    /** Messages reçus par un numéro (comparaison après formatage MTarget). */
    messagesTo(phone: string): RecordedSms[] {
        const recipient = formatMTargetPhoneNumber(phone);
        return this.sent.filter((s) => s.recipient === recipient);
    }

    async sendSms(to: string, message: string): Promise<SmsSendResult> {
        const recipient = formatMTargetPhoneNumber(to);
        const error = this.failureQueue.shift();
        const success = error === undefined;
        this.sent.push({ to, recipient, message, success, error, at: new Date().toISOString() });
        if (!success) {
            return { success: false, recipient, error };
        }
        return { success: true, recipient, messageId: `fake-sms-${this.sent.length}` };
    }
}

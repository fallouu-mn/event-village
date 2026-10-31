/**
 * Adaptateur email réel — API REST Resend (https://resend.com).
 * Seul endroit du code qui parle au réseau Resend.
 * Sans RESEND_API_KEY, EmailService n'appelle pas cet adaptateur (lot 1C.8,
 * lib/notifications/channels.ts) ; le contrôle ci-dessous reste une défense en profondeur.
 */
import type { EmailAdapter, EmailSendPayload, EmailSendResult } from '@/lib/integrations/types';

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
            return { sent: false, error: 'RESEND_API_KEY_MISSING' };
        }

        try {
            const res = await fetch(ResendHttpAdapter.RESEND_API, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    from: payload.from ?? ResendHttpAdapter.fromAddress(),
                    to: Array.isArray(payload.to) ? payload.to : [payload.to],
                    subject: payload.subject,
                    html: payload.html,
                    ...(payload.replyTo ? { reply_to: payload.replyTo } : {}),
                }),
            });

            if (!res.ok) {
                const errBody = await res.json().catch(() => ({})) as Record<string, unknown>;
                const msg = (errBody.message as string) || `HTTP ${res.status}`;
                console.warn('[ResendHttpAdapter] Resend API error:', msg, '— sujet:', payload.subject);
                return { sent: false, error: msg };
            }

            const data = await res.json() as { id?: string };
            return { sent: true, id: data.id };
        } catch (err) {
            const msg = err instanceof Error ? err.message : 'network_error';
            console.warn('[ResendHttpAdapter] Exception envoi:', msg, '— sujet:', payload.subject);
            return { sent: false, error: msg };
        }
    }
}

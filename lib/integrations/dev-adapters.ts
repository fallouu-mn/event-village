/**
 * Lot 8 (8.1, L17, L19) — adaptateurs du mode simulé de développement (`next dev`, EV_INTEGRATIONS=fake).
 *
 * Ce module n'entre jamais dans le build de production : registry.ts le charge par un `require` placé dans une
 * branche `process.env.NODE_ENV === 'development'`, morte au build. scripts/e2e/start-app.mjs le prouve en
 * cherchant DEV_ADAPTERS_SENTINEL dans `.next`.
 *
 * SMS : le texte complet s'affiche dans la console, OTP compris (c'est le but du mode). Aucun envoi réel.
 * Email : destinataire et sujet, jamais le HTML. L'envoyeur n'appelle l'adaptateur que si RESEND_API_KEY est
 * renseignée (lib/notifications/channels.ts), comme en réel.
 * Paiement : le vrai client HTTP, vers le faux service local (scripts/dev/fake-samirpay.mjs), sans aucune clé réelle.
 */
import { randomUUID } from 'node:crypto';
import { SamirPayHttpClient } from '@/lib/samirpay/http-client';
import { isLoopbackUrl } from './simulation';
import type { EmailAdapter, EmailSendPayload, EmailSendResult, PaymentGateway, PushAdapter, PushMessage, PushSendResult, PushTarget, SmsAdapter, SmsSendResult } from './types';

export const DEV_ADAPTERS_SENTINEL = 'EV_DEV_ADAPTERS_SENTINEL_LOT8';

// Lecture de la constante à l'exécution : la minification ne peut pas la retirer d'un module qui serait chargé.
(globalThis as Record<symbol, unknown>)[Symbol.for('event-village.dev-adapters')] = DEV_ADAPTERS_SENTINEL;

/** Valeur envoyée au faux service à la place des clés SamirPay : ni clé ni mot de passe réels. */
const DEV_FAKE_CREDENTIAL = 'dev-fake';

export class DevConsoleSmsAdapter implements SmsAdapter {
    async sendSms(to: string, message: string): Promise<SmsSendResult> {
        console.log(`[essai] SMS simulé pour ${to} : ${message}`);
        return { success: true, outcome: 'SENT', recipient: to, messageId: `dev-${randomUUID()}` };
    }
}

export class DevConsoleEmailAdapter implements EmailAdapter {
    async send(payload: EmailSendPayload): Promise<EmailSendResult> {
        const to = Array.isArray(payload.to) ? payload.to.join(', ') : payload.to;
        console.log(`[essai] Email simulé pour ${to} : ${payload.subject}`);
        return { sent: true, id: `dev-${randomUUID()}` };
    }
}

export class DevConsolePushAdapter implements PushAdapter {
    async send(_target: PushTarget, message: PushMessage): Promise<PushSendResult> {
        console.log(`[essai] Notification push simulée : ${message.title}`);
        return { outcome: 'ACCEPTED', statusCode: 201 };
    }
}

/** Passerelle vers le faux service local. Refus nommé si EV_DEV_FAKE_SERVICES_URL est absente ou non locale. */
export function createDevPaymentGateway(): PaymentGateway {
    const baseUrl = process.env.EV_DEV_FAKE_SERVICES_URL;
    if (!baseUrl || !isLoopbackUrl(baseUrl)) {
        throw new Error('EV_DEV_FAKE_SERVICES_URL doit viser le faux service local (http://127.0.0.1:<port>/samirpay) : aucun paiement simulé sans elle.');
    }
    return new SamirPayHttpClient({ baseUrl, apiKey: DEV_FAKE_CREDENTIAL, secretKey: DEV_FAKE_CREDENTIAL });
}

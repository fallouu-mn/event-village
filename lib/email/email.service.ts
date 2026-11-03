/**
 * EMAIL SERVICE — Event Village
 * Façade d'envoi. Le transport (Resend en production, faux adaptateur en test) est fourni par
 * lib/integrations/registry.
 *
 * Canal optionnel (lot 1C.8) : sans RESEND_API_KEY, aucun envoi n'est tenté et un seul
 * avertissement est émis pour le processus (lib/notifications/channels.ts). Le SMS reste le
 * canal essentiel.
 *
 * Lot 6 (contrat G, K) : les textes et la mise en page des emails viennent du catalogue unique
 * (lib/notifications/catalog.ts, lib/notifications/email-layout.ts) ; seul l'envoyeur de la boîte
 * d'envoi (lib/notifications/dispatcher.ts) appelle cette façade. Les anciens modèles HTML
 * (EmailTemplates) et l'envoi groupé (sendToMany), devenus sans appelant, sont supprimés.
 */

import { getEmailAdapter } from '@/lib/integrations/registry';
import { emailChannelAvailable } from '@/lib/notifications/channels';
import type { EmailSendPayload, EmailSendResult } from '@/lib/integrations/types';

export type EmailResult = EmailSendResult;

export class EmailService {
    /**
     * Envoie un email via l'adaptateur fourni par le registre d'intégrations
     * (Resend en production, faux adaptateur sans réseau en test).
     * Retourne toujours — l'échec ne propage pas d'exception.
     */
    static async send(payload: EmailSendPayload): Promise<EmailResult> {
        if (!emailChannelAvailable()) return { sent: false, error: 'EMAIL_CHANNEL_DISABLED' };
        return getEmailAdapter().send(payload);
    }
}

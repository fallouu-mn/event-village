/**
 * Lot 9 quinquies (C2 : AUTH-09) — avis à l'ANCIENNE adresse vérifiée quand une autre adresse la remplace (envoi
 * synchrone de POST /api/account/email/verify, comme le lien de vérification de lib/email/verification.ts). Texte du
 * catalogue (renderEmailChangedOld) : aucune des deux adresses n'est écrite dans le message.
 */
import { EmailService } from '@/lib/email/email.service';
import { getServerEnv } from '@/lib/env';
import { renderEmailChangedOld } from '@/lib/notifications/catalog';

/** Envoie l'avis ; rend `{ sent, error? }` (l'appelant journalise un échec, l'envoi ne lève pas pour un refus du fournisseur). */
export async function sendEmailChangedOldNotice(userId: string, oldAddress: string, tokenHash: string): Promise<{ sent: boolean; error?: string }> {
    const mail = renderEmailChangedOld({ appUrl: getServerEnv().NEXT_PUBLIC_APP_URL.replace(/\/+$/, '') });
    const sent = await EmailService.send({
        to: oldAddress, subject: mail.subject, html: mail.html, text: mail.text,
        idempotencyKey: `EMAIL_CHANGED_OLD:${userId}:${tokenHash.slice(0, 16)}`,
    });
    return sent.sent ? { sent: true } : { sent: false, error: sent.error ?? 'refus' };
}

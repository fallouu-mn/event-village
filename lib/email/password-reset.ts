/**
 * Lot 9 quinquies (B2 : AUTH-08, T5) — « Mot de passe oublié » par email, envoyé par l'application et Resend.
 *
 * Lien `{APP_URL}/reset-password?t=<jeton>` : jeton aléatoire de 256 bits (base64url), rangé en empreinte SHA-256
 * seulement (password_reset_links), à usage unique, valable 60 minutes ; un nouveau lien remplace le précédent. Seule une
 * adresse VÉRIFIÉE d'un compte ACTIF le reçoit ; la réponse de la route est toujours la même (aucune énumération des
 * comptes). Email du catalogue (renderPasswordResetEmail), même expéditeur que les autres emails (EmailService).
 * Le jeton n'est jamais journalisé ni stocké en clair. Envoi synchrone rangé avec les autres (lib/email/verification.ts,
 * contrat K2 du lot 6 : aucun appel direct à l'adaptateur hors de lib/email/ et de l'envoyeur).
 */
import { createHash, randomBytes } from 'node:crypto';
import { EmailService } from '@/lib/email/email.service';
import { getServerEnv } from '@/lib/env';
import { renderPasswordResetEmail } from '@/lib/notifications/catalog';
import { getServiceRoleClient } from '@/lib/supabase/server';

export function resetTokenHash(token: string): string {
    return createHash('sha256').update(token, 'utf8').digest('hex');
}

export type ResetEmailOutcome = 'SENT' | 'NO_ACCOUNT' | 'NOT_SENT';

/** Émet un lien pour l'adresse si un compte éligible la porte, puis l'envoie ; lève si la base refuse l'écriture. */
export async function sendPasswordResetEmail(email: string): Promise<ResetEmailOutcome> {
    const token = randomBytes(32).toString('base64url');
    const { data, error } = await getServiceRoleClient().rpc('password_reset_link_issue', {
        p: { email: email.trim().toLowerCase(), token_hash: resetTokenHash(token) },
    });
    const reply = data as { ok?: boolean; issued?: boolean; user_id?: string; code?: string } | null;
    if (error || reply?.ok !== true) throw new Error(`lien de récupération non enregistré : ${error?.message ?? reply?.code ?? 'réponse vide'}`);
    if (reply.issued !== true) return 'NO_ACCOUNT';
    const mail = renderPasswordResetEmail(token, { appUrl: getServerEnv().NEXT_PUBLIC_APP_URL.replace(/\/+$/, '') });
    const sent = await EmailService.send({
        to: email.trim().toLowerCase(), subject: mail.subject, html: mail.html, text: mail.text,
        idempotencyKey: `PASSWORD_RESET_EMAIL:${resetTokenHash(token).slice(0, 32)}`,
    });
    if (!sent.sent) {
        console.error(`[mot de passe oublié] email du compte ${reply.user_id} non envoyé : ${sent.error ?? 'refus'}`);
        return 'NOT_SENT';
    }
    return 'SENT';
}

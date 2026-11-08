/**
 * Lot 6 (contrat D, E7) — journal des envois synchrones : codes à usage unique (OTP) et invitation d'un
 * nouveau contrôleur. Ces SMS partent tout de suite (l'utilisateur attend) ; ils sont ensuite inscrits dans
 * la boîte d'envoi (origin = SYNC_LOG, statut final) par la RPC notification_sync_log, sans le code ni le
 * lien : `template_data = { purpose }` seulement.
 *
 * Un échec d'écriture du journal est journalisé (console.error) et n'annule pas le code déjà parti :
 * l'issue de l'envoi reste celle que reçoit l'appelant.
 */
import { getServiceRoleClient } from '@/lib/supabase/server';
import { toSenegaleseE164 } from '@/lib/validations/auth';

export type SyncSmsType = 'OTP_LOGIN' | 'OTP_REGISTER' | 'OTP_PASSWORD_RESET' | 'OTP_WITHDRAWAL' | 'OTP_PHONE_CHANGE' | 'OTP_AUTH_HOOK' | 'CONTROLLER_INVITE';

export const SYNC_SMS_TYPES: readonly SyncSmsType[] = ['OTP_LOGIN', 'OTP_REGISTER', 'OTP_PASSWORD_RESET', 'OTP_WITHDRAWAL', 'OTP_PHONE_CHANGE', 'OTP_AUTH_HOOK', 'CONTROLLER_INVITE'];

export type SyncSmsOutcome = 'SENT' | 'FAILED' | 'UNCERTAIN' | 'SKIPPED';

/** Contexte de journal passé par les routes (`ctx.log`) : type, référence (id otp_codes ou webhook-id), comptes. */
export interface SyncLogContext {
    type: SyncSmsType;
    /** Identifiant de la ligne otp_codes (storeOtp) ; pour le hook d'authentification, l'en-tête webhook-id. */
    ref: string;
    userId?: string | null;
    actorId?: string | null;
}

export interface SyncLogEntry extends SyncLogContext {
    phone: string;
    outcome: SyncSmsOutcome;
    /** Motif obligatoire hors SENT (liste fermée du contrat C4). */
    reason?: string | null;
    providerMessageId?: string | null;
}

/** Écrit le journal ; renvoie l'id de la ligne, ou null si l'écriture a échoué (erreur journalisée). */
export async function logSyncSms(entry: SyncLogEntry): Promise<string | null> {
    const phone = toSenegaleseE164(entry.phone);
    if (!phone && !entry.userId) {
        console.error(`[notifications] journal ${entry.type} non écrit : numéro non sénégalais et aucun compte.`);
        return null;
    }
    const p: Record<string, unknown> = {
        type: entry.type,
        ref: entry.ref,
        outcome: entry.outcome,
    };
    if (phone) p.phone = phone;
    if (entry.userId) p.user_id = entry.userId;
    if (entry.actorId) p.actor_id = entry.actorId;
    if (entry.reason) p.reason = entry.reason;
    if (entry.providerMessageId) p.provider_message_id = entry.providerMessageId;
    try {
        const { data, error } = await getServiceRoleClient().rpc('notification_sync_log', { p });
        if (error) {
            console.error(`[notifications] journal ${entry.type} non écrit : ${error.code} ${error.message}`);
            return null;
        }
        const reply = (data ?? null) as { ok?: boolean; id?: string; code?: string; message?: string } | null;
        if (!reply || reply.ok !== true) {
            console.error(`[notifications] journal ${entry.type} refusé : ${reply?.code ?? 'réponse vide'} ${reply?.message ?? ''}`.trim());
            return null;
        }
        return reply.id ? String(reply.id) : null;
    } catch (err) {
        console.error(`[notifications] journal ${entry.type} non écrit :`, err instanceof Error ? err.message : err);
        return null;
    }
}

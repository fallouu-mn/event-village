/**
 * Lot 1C.3 — révocation réelle des sessions d'un compte.
 *
 * auth.admin.signOut(jwt, scope) attend le JWT de l'utilisateur, pas son identifiant ; les appels
 * signOut(userId) étaient sans effet. revokeUserSessions supprime les sessions et révoque les
 * jetons de rafraîchissement en base (fonction public.revoke_user_sessions, service_role).
 * Le jeton d'accès déjà émis reste valable jusqu'à son expiration (1 h au plus) ; les droits sont
 * de toute façon relus en base (user_roles, users.status) à chaque requête.
 *
 * Un échec est journalisé en erreur et signalé à l'appelant (false), jamais ignoré.
 */
import { getServiceRoleClient } from '@/lib/supabase/server';

export async function revokeUserSessions(userId: string, context: { reason: string; actorId?: string | null }): Promise<boolean> {
    const supabase = getServiceRoleClient();
    const { data, error } = await supabase.rpc('revoke_user_sessions', { p_user_id: userId });
    if (error) {
        console.error(`[revokeUserSessions] révocation des sessions de ${userId} impossible (${context.reason}) :`, error.message);
        return false;
    }
    const { error: auditErr } = await supabase.from('audit_logs').insert({
        user_id: context.actorId ?? null,
        user_role: context.actorId ? null : 'SYSTEM',
        action: 'USER_SESSIONS_REVOKED',
        object_type: 'users',
        object_id: userId,
        metadata: { reason: context.reason, sessions_revoked: data },
    });
    if (auditErr) console.error('[revokeUserSessions] journalisation impossible :', auditErr.message);
    return true;
}

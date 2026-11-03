/**
 * Journal d'une alerte d'exploitation (cashout bloqué, refusé, incertain ; lot bloqué) : une ligne
 * audit_logs. Un échec d'écriture est journalisé en erreur et signalé à l'appelant (false).
 *
 * Lot 6 (J2.2) : l'avis aux administrateurs ne s'écrit plus ici. Il est mis en file par le trigger
 * trg_cashouts_notify (ADMIN_REFUND_TO_RETRY, ADMIN_CASHOUT_UNCERTAIN, ADMIN_WITHDRAWAL_REJECTED) dans la
 * transaction qui change le statut du cashout, pour les comptes ACTIF qui ont la permission
 * refunds.manage (le SUPERADMIN reçoit tout), et livré par l'envoyeur unique.
 */
import { getServiceRoleClient } from '@/lib/supabase/server';

export async function logAdminAlert(alert: {
    action: string;
    objectType: string;
    objectId?: string | null;
    metadata?: Record<string, unknown>;
}): Promise<boolean> {
    const { error } = await getServiceRoleClient().from('audit_logs').insert({
        user_role: 'SYSTEM',
        action: alert.action,
        object_type: alert.objectType,
        object_id: alert.objectId ?? null,
        metadata: alert.metadata ?? {},
    });
    if (error) {
        console.error(`[alertes] journal ${alert.action} impossible :`, error.message);
        return false;
    }
    return true;
}

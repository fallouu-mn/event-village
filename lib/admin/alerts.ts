/**
 * Alerte aux SUPERADMIN : ligne audit_logs + notification in-app à chaque superadmin.
 * Les échecs d'écriture sont journalisés en erreur et signalés à l'appelant (false).
 */
import { getServiceRoleClient } from '@/lib/supabase/server';

export async function alertSuperadmins(alert: {
    action: string;
    type: string;
    title: string;
    content: string;
    objectType: string;
    objectId?: string | null;
    metadata?: Record<string, unknown>;
}): Promise<boolean> {
    const supabase = getServiceRoleClient();
    let ok = true;
    const { error: auditErr } = await supabase.from('audit_logs').insert({
        user_role: 'SYSTEM',
        action: alert.action,
        object_type: alert.objectType,
        object_id: alert.objectId ?? null,
        metadata: alert.metadata ?? {},
    });
    if (auditErr) {
        console.error(`[alertes] journal ${alert.action} impossible :`, auditErr.message);
        ok = false;
    }
    const { data: admins, error: adminsErr } = await supabase.from('user_roles').select('user_id').eq('role', 'SUPERADMIN');
    if (adminsErr) {
        console.error('[alertes] lecture des superadmins impossible :', adminsErr.message);
        return false;
    }
    if (!admins?.length) {
        console.error(`[alertes] aucun SUPERADMIN à prévenir pour ${alert.action}`);
        return false;
    }
    const { error: notifErr } = await supabase.from('notifications').insert(admins.map((a) => ({
        user_id: a.user_id,
        type: alert.type,
        title: alert.title,
        content: alert.content,
        channel: 'PUSH',
        status: 'SENT',
        sent_at: new Date().toISOString(),
        metadata: alert.metadata ?? {},
    })));
    if (notifErr) {
        console.error(`[alertes] notification ${alert.action} impossible :`, notifErr.message);
        ok = false;
    }
    return ok;
}

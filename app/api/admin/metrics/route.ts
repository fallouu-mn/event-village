import { NextRequest, NextResponse } from 'next/server';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { verifyAdminAuth } from '@/lib/admin/admin-auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/metrics
 * Fournit les KPIs réels agrégés depuis Supabase (CDC V3) et les derniers logs d'audit
 */
export async function GET(req: NextRequest) {
    const auth = await verifyAdminAuth(req, { requiredPermission: 'statistics.read' });
    if (!auth.authorized) return auth.errorResponse!;

    try {
        const supabase = getServiceRoleClient();

        // Toutes les requêtes sont indépendantes — lancement en parallèle
        const [partnersRes, usersRes, paymentsRes, commissionsRes, ticketsRes, auditLogsRes, platformRateRes] = await Promise.all([
            supabase.from('partners').select('id, status'),
            supabase.from('users').select('id, role, referral_status'),
            supabase.from('payments').select('amount').eq('status', 'SUCCESS'),
            supabase.from('referral_commissions').select('amount'),
            supabase.from('tickets').select('*', { count: 'exact', head: true }),
            supabase.from('audit_logs')
                .select('id, action, object_type, user_role, created_at, user_id')
                .order('created_at', { ascending: false })
                .limit(10),
            supabase.from('platform_settings').select('value').eq('key', 'platform_commission_rate').maybeSingle(),
        ]);

        const partners = partnersRes.data || [];
        const users = usersRes.data || [];
        const payments = paymentsRes.data || [];
        const commissions = commissionsRes.data || [];
        const auditLogs = auditLogsRes.data || [];

        const totalPartners = partners.length;
        const pendingPartners = partners.filter(p => p.status === 'EN_ATTENTE').length;
        const validatedPartners = partners.filter(p => p.status === 'VALIDE').length;
        const rejectedPartners = partners.filter(p => p.status === 'REJETE').length;

        const totalUsers = users.length;
        const activeAmbassadors = users.filter(u => u.referral_status === 'AMBASSADEUR').length;
        const clientsCount = users.filter(u => u.role === 'CLIENT').length;
        const controllersCount = users.filter(u => u.role === 'CONTROLEUR').length;
        const adminsCount = users.filter(u => u.role === 'ADMIN' || u.role === 'SUPERADMIN').length;

        // Taux de commission EV — lecture DB obligatoire (FIN-1)
        let evCommissionRate = 0;
        let configWarning: string | null = null;
        if (platformRateRes.data?.value?.rate) {
            evCommissionRate = Number(platformRateRes.data.value.rate) / 100;
        } else {
            configWarning = 'Configuration financière manquante: platform_commission_rate. Exécutez la migration 0012 ou insérez la valeur via le SQL Editor Supabase. Les revenus nets affichent 0 en attendant.';
        }

        const totalVolume = payments.reduce((acc, p) => acc + Number(p.amount || 0), 0);
        const totalCommissions = commissions.reduce((acc, c) => acc + Number(c.amount || 0), 0);
        const netRevenue = totalVolume > 0 ? Math.round(totalVolume * evCommissionRate) : 0;
        const totalTickets = ticketsRes.count || 0;

        return NextResponse.json({
            success: true,
            kpis: {
                totalVolume,
                netRevenue,
                totalCommissions,
                validatedPartners,
                pendingPartners,
                rejectedPartners,
                totalPartners,
                totalUsers,
                clientsCount,
                controllersCount,
                adminsCount,
                activeAmbassadors,
                totalTickets,
            },
            recentAuditLogs: auditLogs,
            configWarning,
        });
    } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : 'Erreur interne du serveur';
        console.error('[API /api/admin/metrics] Erreur:', errorMsg);
        return NextResponse.json({ error: errorMsg }, { status: 500 });
    }
}

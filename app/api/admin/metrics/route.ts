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

        // 1. Partenaires par statut
        const { data: partners, error: pErr } = await supabase
            .from('partners')
            .select('id, status');

        const totalPartners = partners?.length || 0;
        const pendingPartners = partners?.filter(p => p.status === 'EN_ATTENTE').length || 0;
        const validatedPartners = partners?.filter(p => p.status === 'VALIDE').length || 0;
        const rejectedPartners = partners?.filter(p => p.status === 'REJETE').length || 0;

        // 2. Utilisateurs et Ambassadeurs
        const { data: users, error: uErr } = await supabase
            .from('users')
            .select('id, role, status, referral_status');

        const totalUsers = users?.length || 0;
        const activeAmbassadors = users?.filter(u => u.referral_status === 'AMBASSADEUR').length || 0;
        const clientsCount = users?.filter(u => u.role === 'CLIENT').length || 0;
        const controllersCount = users?.filter(u => u.role === 'CONTROLEUR').length || 0;
        const adminsCount = users?.filter(u => u.role === 'ADMIN' || u.role === 'SUPERADMIN').length || 0;

        // 3. Commandes & Volume Financier (Paiements Réels)
        const { data: payments } = await supabase
            .from('payments')
            .select('amount, status')
            .eq('status', 'SUCCESS');

        const totalVolume = payments?.reduce((acc, p) => acc + Number(p.amount || 0), 0) || 0;
        
        // Commissions Net Event Village (estimé à 6.5% ou selon transactions réelles)
        const { data: commissions } = await supabase
            .from('referral_commissions')
            .select('amount, eligible_net_revenue');

        const totalCommissions = commissions?.reduce((acc, c) => acc + Number(c.amount || 0), 0) || 0;
        const netRevenue = totalVolume > 0 ? Math.round(totalVolume * 0.065) : 0;

        // 4. Billets émis
        const { count: totalTickets } = await supabase
            .from('tickets')
            .select('*', { count: 'exact', head: true });

        // 5. Derniers Logs d'Audit (10 plus récents)
        const { data: auditLogs } = await supabase
            .from('audit_logs')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(10);

        return NextResponse.json({
            success: true,
            kpis: {
                totalVolume,
                netRevenue,
                validatedPartners,
                pendingPartners,
                rejectedPartners,
                totalPartners,
                totalUsers,
                clientsCount,
                controllersCount,
                adminsCount,
                activeAmbassadors,
                totalTickets: totalTickets || 0,
            },
            recentAuditLogs: auditLogs || [],
        });
    } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : 'Erreur interne du serveur';
        console.error('[API /api/admin/metrics] Erreur:', errorMsg);
        return NextResponse.json({ error: errorMsg }, { status: 500 });
    }
}

import { NextRequest, NextResponse } from 'next/server';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { verifyAdminAuth } from '@/lib/admin/admin-auth';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 1000;

interface ReadResult { error: { message: string } | null }

/** Lève une erreur explicite si une lecture a échoué (jamais de KPI calculé sur une lecture ratée). */
function ensure<T extends ReadResult>(label: string, res: T): T {
    if (res.error) throw new Error(`Lecture impossible (${label}) : ${res.error.message}`);
    return res;
}

/** Nombre exact de lignes (requête HEAD : aucune troncature à max_rows). */
async function countOf(label: string, query: PromiseLike<{ count: number | null; error: { message: string } | null }>): Promise<number> {
    const res = ensure(label, await query);
    return res.count ?? 0;
}

/**
 * GET /api/admin/metrics
 * KPIs agrégés depuis Supabase (CDC V3, lot 3 contrat G) et derniers journaux d'audit.
 *  - Volume et revenu Event Village : finance_platform_revenue, paiements plateforme uniquement
 *    (is_platform_payment = true ; espèces et paiements directs exclus, §76) ; revenu net EV =
 *    Σ (net − part annulée par les remboursements). Aucun taux appliqué ici.
 *  - Comptages par requêtes HEAD exactes (pas de troncature à 1 000 lignes).
 */
export async function GET(req: NextRequest) {
    const auth = await verifyAdminAuth(req, { requiredPermission: 'statistics.read' });
    if (!auth.authorized) return auth.errorResponse!;

    try {
        const supabase = getServiceRoleClient();
        const head = { count: 'exact' as const, head: true };

        const sumCommissions = async (): Promise<number> => {
            let total = 0;
            for (let from = 0; ; from += PAGE_SIZE) {
                const { data } = ensure('commissions de parrainage', await supabase
                    .from('referral_commissions')
                    .select('id, amount')
                    .neq('status', 'CANCELLED')
                    .order('id', { ascending: true })
                    .range(from, from + PAGE_SIZE - 1));
                for (const c of data ?? []) total += Number(c.amount);
                if (!data || data.length < PAGE_SIZE) return total;
            }
        };

        const [
            totalPartners, pendingPartners, validatedPartners, rejectedPartners,
            totalUsers, clientsCount, controllersCount, adminsCount, activeAmbassadors,
            totalTickets, totalCommissions, revenueRes, auditLogsRes,
        ] = await Promise.all([
            countOf('partenaires', supabase.from('partners').select('id', head)),
            countOf('partenaires en attente', supabase.from('partners').select('id', head).eq('status', 'EN_ATTENTE')),
            countOf('partenaires validés', supabase.from('partners').select('id', head).eq('status', 'VALIDE')),
            countOf('partenaires rejetés', supabase.from('partners').select('id', head).eq('status', 'REJETE')),
            countOf('utilisateurs', supabase.from('users').select('id', head)),
            countOf('clients', supabase.from('users').select('id', head).eq('role', 'CLIENT')),
            countOf('contrôleurs', supabase.from('users').select('id', head).eq('role', 'CONTROLEUR')),
            countOf('administrateurs', supabase.from('users').select('id', head).in('role', ['ADMIN', 'SUPERADMIN'])),
            countOf('ambassadeurs', supabase.from('users').select('id', head).eq('referral_status', 'AMBASSADEUR')),
            countOf('billets', supabase.from('tickets').select('id', head)),
            sumCommissions(),
            supabase.rpc('finance_platform_revenue', { p_from: null, p_to: null }),
            supabase.from('audit_logs')
                .select('id, action, object_type, user_role, created_at, user_id')
                .order('created_at', { ascending: false })
                .limit(10),
        ]);

        const revenue = ensure('revenu Event Village', revenueRes).data as Record<string, unknown> | null;
        if (!revenue) throw new Error('Lecture impossible (revenu Event Village) : réponse vide');
        const auditLogs = ensure('journal d’audit', auditLogsRes).data ?? [];

        return NextResponse.json({
            success: true,
            kpis: {
                totalVolume: Number(revenue.volume),
                netRevenue: Number(revenue.net_revenue),
                grossRevenue: Number(revenue.gross_revenue),
                serviceFees: Number(revenue.service_fees),
                aggregatorFees: Number(revenue.aggregator_fees),
                refundedAmount: Number(revenue.refunded),
                platformPayments: Number(revenue.payments),
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
            configWarning: null,
        });
    } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : 'Erreur interne du serveur';
        console.error('[API /api/admin/metrics] Erreur:', errorMsg);
        return NextResponse.json({ error: errorMsg }, { status: 500 });
    }
}

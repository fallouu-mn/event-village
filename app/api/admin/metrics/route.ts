import { NextRequest, NextResponse } from 'next/server';
import { apiFailure } from '@/lib/api/public-error';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { verifyAdminAuth } from '@/lib/admin/admin-auth';
import { parseEarned } from '@/lib/finance/admin-summary';
import { currentMonth } from '@/lib/finance/period';

export const dynamic = 'force-dynamic';

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
 * KPIs agrégés depuis Supabase (CDC V3, lot 3 contrat G).
 *  - Comptages par requêtes HEAD exactes (pas de troncature à 1 000 lignes).
 * Finition 3a (1a) : plus aucune ligne du journal d'audit dans la réponse (champ recentAuditLogs retiré) : le journal est
 * réservé au SUPERADMIN (GET /api/admin/audit) alors que cette route ne demande que statistics.read.
 * Finition 3a (3) : un seul « revenu », le même que « Gagné par Event Village » de la page Finance (finance_admin_earned,
 * paiements plateforme uniquement) : earnedMonth et encashedMonth pour le mois en cours à Dakar (accueil) ; netRevenue
 * et totalVolume gardent leurs noms et donnent la même mesure depuis le début. Plus de second calcul du revenu
 * (finance_platform_revenue, commissions additionnées à part).
 */
export async function GET(req: NextRequest) {
    const auth = await verifyAdminAuth(req, { requiredPermission: 'statistics.read' });
    if (!auth.authorized) return auth.errorResponse!;

    try {
        const supabase = getServiceRoleClient();
        const head = { count: 'exact' as const, head: true };
        const month = currentMonth();

        const [
            totalPartners, pendingPartners, validatedPartners, rejectedPartners,
            totalUsers, clientsCount, controllersCount, adminsCount, activeAmbassadors,
            totalTickets, earnedMonthRes, earnedAllRes,
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
            // Paiements plateforme seulement (is_platform_payment, dans finance_admin_earned) : espèces et paiements directs exclus
            supabase.rpc('finance_admin_earned', { p_from: month.from, p_to: month.to }),
            supabase.rpc('finance_admin_earned', { p_from: null, p_to: null }),
        ]);
        const earnedMonth = parseEarned(ensure('gagné du mois', earnedMonthRes).data);
        const earnedAll = parseEarned(ensure('gagné depuis le début', earnedAllRes).data);

        return NextResponse.json({
            success: true,
            kpis: {
                earnedMonth: earnedMonth.total,
                encashedMonth: earnedMonth.volume,
                month: { label: month.label, range: month.range, from: month.from, to: month.to },
                netRevenue: earnedAll.total,
                totalVolume: earnedAll.volume,
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
            configWarning: null,
        });
    } catch (err: unknown) {
        return apiFailure('GET /api/admin/metrics', err, { message: 'Indicateurs momentanément indisponibles.', code: 'METRICS_UNAVAILABLE' });
    }
}

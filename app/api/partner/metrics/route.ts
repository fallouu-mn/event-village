import { NextRequest, NextResponse } from 'next/server';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { requireActiveSession } from '@/lib/auth/session';
import { fetchAllRows, ticketsOfEvents, toPartnerSummary } from '@/lib/partner/partner-dashboard.service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/partner/metrics
 * KPIs du partenaire authentifié (lot 3, contrat G) : chiffre d'affaires en ligne et net organisateur
 * lus dans le grand livre (finance_ledger via finance_partner_summary, paiements plateforme
 * uniquement) ; ventes espèces et frais de service de l'acheteur en lignes informatives ; aucun taux
 * appliqué ici.
 */
export async function GET(req: NextRequest) {
    try {
        const activeSession = await requireActiveSession(req);
        if (activeSession.response) return activeSession.response;

        const supabase = getServiceRoleClient();
        const userId = activeSession.user.id;

        const { data: partner, error: pErr } = await supabase
            .from('partners')
            .select('id, company_name, commercial_name, status, is_verified, trial_started_at, trial_ends_at, is_founder')
            .eq('user_id', userId)
            .maybeSingle();
        if (pErr) throw new Error(`Lecture impossible (profil partenaire) : ${pErr.message}`);

        if (!partner) {
            return NextResponse.json({
                success: true,
                isPartner: false,
                metrics: {
                    grossRevenue: 0,
                    netRevenue: 0,
                    ticketsSold: 0,
                    ordersCount: 0,
                    activeEvents: 0,
                },
                recentOrders: [],
            });
        }

        const partnerId = partner.id;

        const [events, recentOrdersRes, ordersCountRes, summaryRes] = await Promise.all([
            fetchAllRows<{ id: string; status: string }>('événements', (from, to) => supabase
                .from('events').select('id, status').eq('partner_id', partnerId).order('id', { ascending: true }).range(from, to)),
            supabase.from('orders')
                .select('id, order_number, total_amount, order_status, delivery_mode, created_at')
                .eq('partner_id', partnerId)
                .order('created_at', { ascending: false })
                .limit(10),
            supabase.from('orders').select('id', { count: 'exact', head: true }).eq('partner_id', partnerId),
            supabase.rpc('finance_partner_summary', { p_partner_id: partnerId, p_event_id: null }),
        ]);
        if (recentOrdersRes.error) throw new Error(`Lecture impossible (commandes) : ${recentOrdersRes.error.message}`);
        if (ordersCountRes.error) throw new Error(`Lecture impossible (nombre de commandes) : ${ordersCountRes.error.message}`);
        const summary = toPartnerSummary(summaryRes);

        const tickets = await ticketsOfEvents<{ id: string; status: string }>(events.map((e) => e.id), 'id, status');
        const ticketsSold = tickets.filter((t) => t.status === 'VALIDE' || t.status === 'UTILISE').length;

        return NextResponse.json({
            success: true,
            isPartner: true,
            partner: {
                id: partnerId,
                companyName: partner.commercial_name || partner.company_name,
                status: partner.status,
                isVerified: partner.is_verified,
                trialStartedAt: partner.trial_started_at,
                trialEndsAt: partner.trial_ends_at,
                isFounder: partner.is_founder,
            },
            metrics: {
                grossRevenue: summary.onlineSales,
                netRevenue: summary.organizerNet,
                refunded: summary.refunded,
                buyerServiceFees: summary.buyerServiceFees,
                cashSales: summary.cashSales,
                ticketsSold,
                ordersCount: ordersCountRes.count ?? 0,
                activeEvents: events.filter((e) => e.status === 'PUBLIE').length,
            },
            recentOrders: recentOrdersRes.data ?? [],
        });
    } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : 'Erreur interne du serveur';
        console.error('[API /api/partner/metrics] Erreur:', errorMsg);
        return NextResponse.json({ error: errorMsg }, { status: 500 });
    }
}

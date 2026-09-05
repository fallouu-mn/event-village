import { NextRequest, NextResponse } from 'next/server';
import { getServiceRoleClient, getAuthenticatedUser } from '@/lib/supabase/server';
import { FinancialCalculatorService } from '@/lib/payments/financial-calculator.service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/partner/metrics
 * Fournit les KPIs réels et strictement isolés pour le partenaire authentifié (0 mocks)
 */
export async function GET(req: NextRequest) {
    try {
        const authUser = await getAuthenticatedUser(req);
        if (!authUser) {
            return NextResponse.json({ error: 'Authentification requise.' }, { status: 401 });
        }

        const supabase = getServiceRoleClient();
        const userId = authUser.id;

        // 2. Récupération de la fiche partenaire liée à cet utilisateur
        const { data: partner, error: pErr } = await supabase
            .from('partners')
            .select('id, company_name, commercial_name, status, is_verified, trial_started_at, trial_ends_at, is_founder')
            .eq('user_id', userId)
            .maybeSingle();

        if (pErr || !partner) {
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

        // Lancer events, orders et configs financières en parallèle
        const [eventsRes, ordersRes, orderConfigRes, ticketConfigRes] = await Promise.all([
            supabase.from('events').select('id, status').eq('partner_id', partnerId),
            supabase.from('orders')
                .select('id, order_number, total_amount, order_status, delivery_mode, created_at')
                .eq('partner_id', partnerId)
                .order('created_at', { ascending: false })
                .limit(10),
            supabase.from('platform_settings').select('value').eq('key', 'order_commission_config').maybeSingle(),
            supabase.from('platform_settings').select('value').eq('key', 'ticketing_fee_config').maybeSingle(),
        ]);

        const events = eventsRes.data || [];
        const orders = ordersRes.data || [];

        const activeEventsCount = events.filter(e => e.status === 'PUBLIE').length;
        const eventIds = events.map(e => e.id);

        let ticketsSold = 0;
        let ticketRevenue = 0;
        if (eventIds.length > 0) {
            const { data: tickets } = await supabase
                .from('tickets')
                .select('id, price, status')
                .in('event_id', eventIds)
                .neq('status', 'ANNULE');
            ticketsSold = tickets?.length || 0;
            ticketRevenue = tickets?.reduce((acc, t) => acc + (Number(t.price) || 0), 0) || 0;
        }

        const ordersCount = orders.length;
        const orderRevenue = orders
            .filter(o => o.order_status !== 'ANNULEE' && o.order_status !== 'REJETEE')
            .reduce((acc, o) => acc + (Number(o.total_amount) || 0), 0);

        // Taux financiers — lecture DB obligatoire, pas de fallback silencieux
        if (!orderConfigRes.data?.value?.commission_rate) {
            return NextResponse.json(
                { error: 'Configuration financière manquante: order_commission_config. Contactez le superadmin.' },
                { status: 500 }
            );
        }
        if (!ticketConfigRes.data?.value?.service_fee_rate) {
            return NextResponse.json(
                { error: 'Configuration financière manquante: ticketing_fee_config. Contactez le superadmin.' },
                { status: 500 }
            );
        }

        const orderCommissionRate = Number(orderConfigRes.data.value.commission_rate);
        const ticketServiceFeeRate = Number(ticketConfigRes.data.value.service_fee_rate);
        const ticketAggregatorFeeRate = Number(ticketConfigRes.data.value.aggregator_fee_rate);

        const ticketingBreakdown = FinancialCalculatorService.calculateTicketingFinancials({
            ticketFacialPrice: ticketRevenue,
            serviceFeeRatePercent: ticketServiceFeeRate,
            aggregatorFeeRatePercent: ticketAggregatorFeeRate,
        });

        const orderBreakdown = FinancialCalculatorService.calculateOrderFinancials({
            orderTotalAmount: orderRevenue,
            commissionRatePercent: orderCommissionRate,
            aggregatorFeeRatePercent: ticketAggregatorFeeRate,
        });

        // Revenu brut global et Revenu Net Partenaire cumulé
        const totalGrossRevenue = ticketRevenue + orderRevenue;
        const partnerNetRevenue = ticketingBreakdown.partnerPayout + orderBreakdown.partnerPayout;

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
                grossRevenue: totalGrossRevenue,
                netRevenue: partnerNetRevenue,
                ticketsSold,
                ordersCount,
                activeEvents: activeEventsCount,
            },
            recentOrders: orders || [],
        });
    } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : 'Erreur interne du serveur';
        console.error('[API /api/partner/metrics] Erreur:', errorMsg);
        return NextResponse.json({ error: errorMsg }, { status: 500 });
    }
}

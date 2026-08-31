import { NextRequest, NextResponse } from 'next/server';
import { getServerSessionUser } from '@/lib/auth/session';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { FinancialCalculatorService } from '@/lib/payments/financial-calculator.service';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        const user = await getServerSessionUser(request);
        if (!user || user.role !== 'PARTENAIRE') {
            return NextResponse.json({ error: 'Accès non autorisé.' }, { status: 401 });
        }

        const supabase = getServiceRoleClient();

        const { data: partner, error: pErr } = await supabase
            .from('partners')
            .select('id, company_name, commercial_name')
            .eq('user_id', user.id)
            .single();

        if (pErr || !partner) {
            return NextResponse.json({ error: 'Profil partenaire introuvable.' }, { status: 404 });
        }

        const partnerId = partner.id;

        // Lancer toutes les requêtes indépendantes en parallèle — configs financières incluses
        const [eventsRes, ordersRes, hallsRes, orderConfigRes, hallConfigRes, withdrawalsRes] = await Promise.all([
            supabase.from('events').select('id').eq('partner_id', partnerId),
            supabase.from('orders')
                .select('total_amount, paid_amount, order_status')
                .eq('partner_id', partnerId)
                .in('order_status', ['CONFIRMEE', 'EN_PREPARATION', 'PRETE', 'EN_LIVRAISON', 'LIVREE']),
            supabase.from('hall_reservations')
                .select('deposit_amount')
                .eq('partner_id', partnerId)
                .eq('status', 'CONFIRMEE'),
            supabase.from('platform_settings')
                .select('value')
                .eq('key', 'order_commission_config')
                .maybeSingle(),
            supabase.from('platform_settings')
                .select('value')
                .eq('key', 'hall_fee_config')
                .maybeSingle(),
            supabase.from('withdrawals')
                .select('id, gross_amount, fee_amount, net_amount, status, withdrawal_method, payment_details, created_at, processed_at')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false }),
        ]);

        const eventIds = eventsRes.data?.map((e: { id: string }) => e.id) || [];
        let ticketRevenue = 0;
        if (eventIds.length > 0) {
            const { data: tickets } = await supabase
                .from('tickets')
                .select('price')
                .in('event_id', eventIds)
                .in('status', ['VALIDE', 'UTILISE']);
            ticketRevenue = tickets?.reduce((s: number, t: { price: number }) => s + Number(t.price || 0), 0) || 0;
        }

        const orders = ordersRes.data || [];
        const hallReservations = hallsRes.data || [];
        const withdrawalsData = withdrawalsRes.data || [];

        // Taux financiers — lecture DB obligatoire, échec bloquant si absent (FIN-1)
        if (!orderConfigRes.data?.value?.commission_rate) {
            return NextResponse.json(
                { error: 'Configuration financière manquante: order_commission_config. Contactez le superadmin.' },
                { status: 500 }
            );
        }
        if (!hallConfigRes.data?.value?.aggregator_fee_rate) {
            return NextResponse.json(
                { error: 'Configuration financière manquante: hall_fee_config. Contactez le superadmin.' },
                { status: 500 }
            );
        }

        const orderCommissionRate = Number(orderConfigRes.data.value.commission_rate);
        const hallAggregatorFeeRate = Number(hallConfigRes.data.value.aggregator_fee_rate);

        const orderRevenue = orders.reduce((s: number, o: { paid_amount: number; total_amount: number }) =>
            s + Number(o.paid_amount || o.total_amount || 0), 0);
        const hallRevenue = hallReservations.reduce((s: number, r: { deposit_amount: number }) =>
            s + Number(r.deposit_amount || 0), 0);

        // 5. Calculs financiers (CDC V3.0 — server-side, taux 100% issus de la DB)
        const ticketCalc = FinancialCalculatorService.calculateTicketingFinancials({
            ticketFacialPrice: ticketRevenue,
        });

        const orderCalc = FinancialCalculatorService.calculateOrderFinancials({
            orderTotalAmount: orderRevenue,
            commissionRatePercent: orderCommissionRate,
        });

        const hallCalc = FinancialCalculatorService.calculateHallFinancials({
            hallTotalAmount: hallRevenue,
            depositPercentage: 100,
            aggregatorFeeRatePercent: hallAggregatorFeeRate,
        });

        const grossRevenue = ticketRevenue + orderRevenue + hallRevenue;
        const netRevenue = ticketCalc.partnerPayout + orderCalc.partnerPayout + hallCalc.partnerPayout;
        const evCommission = grossRevenue - netRevenue;

        const withdrawals = withdrawalsData;
        const paidWithdrawals = withdrawals.filter((w: { status: string }) => w.status === 'PAID');
        const pendingWithdrawalsArr = withdrawals.filter((w: { status: string }) => ['PENDING', 'PROCESSING'].includes(w.status));

        const totalWithdrawn = paidWithdrawals.reduce((s: number, w: { net_amount: number }) => s + Number(w.net_amount || 0), 0);
        const pendingAmount = pendingWithdrawalsArr.reduce((s: number, w: { gross_amount: number }) => s + Number(w.gross_amount || 0), 0);

        const soldeDisponible = Math.max(0, netRevenue - totalWithdrawn - pendingAmount);

        return NextResponse.json({
            success: true,
            finance: {
                grossRevenue,
                evCommission,
                netRevenue,
                soldeDisponible,
                totalWithdrawn,
                pendingAmount,
                breakdown: {
                    tickets: {
                        grossRevenue: ticketRevenue,
                        netRevenue: ticketCalc.partnerPayout,
                        commissionRate: 0,
                    },
                    orders: {
                        grossRevenue: orderRevenue,
                        netRevenue: orderCalc.partnerPayout,
                        commissionRate: orderCommissionRate,
                    },
                    halls: {
                        grossRevenue: hallRevenue,
                        netRevenue: hallCalc.partnerPayout,
                        aggregatorFeeRate: hallAggregatorFeeRate,
                    },
                },
            },
            withdrawals,
        });
    } catch (error: unknown) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Erreur interne.' },
            { status: 500 }
        );
    }
}

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

        // 1. Revenus billetterie (tickets VALIDE ou UTILISE pour les événements du partenaire)
        const { data: events } = await supabase
            .from('events')
            .select('id')
            .eq('partner_id', partnerId);

        const eventIds = events?.map((e: { id: string }) => e.id) || [];
        let ticketRevenue = 0;

        if (eventIds.length > 0) {
            const { data: tickets } = await supabase
                .from('tickets')
                .select('price, status')
                .in('event_id', eventIds)
                .in('status', ['VALIDE', 'UTILISE']);
            ticketRevenue = tickets?.reduce((s: number, t: { price: number }) => s + Number(t.price || 0), 0) || 0;
        }

        // 2. Revenus commandes (montants encaissés sur commandes actives)
        const { data: orders } = await supabase
            .from('orders')
            .select('total_amount, paid_amount, order_status')
            .eq('partner_id', partnerId)
            .in('order_status', ['CONFIRMEE', 'EN_PREPARATION', 'PRETE', 'EN_LIVRAISON', 'LIVREE']);

        const orderRevenue = orders?.reduce((s: number, o: { paid_amount: number; total_amount: number }) =>
            s + Number(o.paid_amount || o.total_amount || 0), 0) || 0;

        // 3. Revenus salles (acomptes reçus sur réservations confirmées)
        const { data: hallReservations } = await supabase
            .from('hall_reservations')
            .select('deposit_amount, status')
            .eq('partner_id', partnerId)
            .eq('status', 'CONFIRMEE');

        const hallRevenue = hallReservations?.reduce((s: number, r: { deposit_amount: number }) =>
            s + Number(r.deposit_amount || 0), 0) || 0;

        // 4. Taux de commission configurable (plateforme)
        let orderCommissionRate = 5.0;
        const { data: configSetting } = await supabase
            .from('platform_settings')
            .select('value')
            .eq('key', 'order_commission_config')
            .maybeSingle();
        if (configSetting?.value?.commission_rate !== undefined) {
            orderCommissionRate = Number(configSetting.value.commission_rate);
        }

        // 5. Calculs financiers (CDC V3.0 — server-side uniquement)
        // Billetterie : l'organisateur perçoit 100% du prix facial, les frais service 5% sont payés par l'acheteur
        const ticketCalc = FinancialCalculatorService.calculateTicketingFinancials({
            ticketFacialPrice: ticketRevenue,
        });

        // Commandes : commission EV déduite du montant de la commande
        const orderCalc = FinancialCalculatorService.calculateOrderFinancials({
            orderTotalAmount: orderRevenue,
            commissionRatePercent: orderCommissionRate,
        });

        // Salles : frais agrégateur sur l'acompte (depositPercentage=100 car on a déjà les montants d'acompte)
        const hallCalc = FinancialCalculatorService.calculateHallFinancials({
            hallTotalAmount: hallRevenue,
            depositPercentage: 100,
        });

        const grossRevenue = ticketRevenue + orderRevenue + hallRevenue;
        const netRevenue = ticketCalc.partnerPayout + orderCalc.partnerPayout + hallCalc.partnerPayout;
        const evCommission = grossRevenue - netRevenue;

        // 6. Retraits du partenaire (par son user_id)
        const { data: withdrawalsData } = await supabase
            .from('withdrawals')
            .select('id, gross_amount, fee_amount, net_amount, status, withdrawal_method, payment_details, created_at, processed_at')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });

        const withdrawals = withdrawalsData || [];
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
                        commissionRate: 1.5,
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

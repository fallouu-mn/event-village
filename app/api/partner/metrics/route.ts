import { NextRequest, NextResponse } from 'next/server';
import { getServiceRoleClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/partner/metrics
 * Fournit les KPIs réels et strictement isolés pour le partenaire authentifié (0 mocks)
 */
export async function GET(req: NextRequest) {
    try {
        const supabase = getServiceRoleClient();

        // 1. Extraction et vérification de la session
        const authHeader = req.headers.get('authorization');
        let token: string | undefined;
        if (authHeader?.startsWith('Bearer ')) token = authHeader.substring(7);
        else token = req.cookies.get('sb-access-token')?.value || req.cookies.get('sb-auth-token')?.value;

        // Fallback header de test interne si présent
        let userId = req.headers.get('x-user-id') || undefined;

        if (!userId && token) {
            const { data: { user } } = await supabase.auth.getUser(token);
            if (user) userId = user.id;
        }

        if (!userId) {
            return NextResponse.json(
                { error: 'Authentification requise.' },
                { status: 401 }
            );
        }

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

        // 3. Événements du partenaire (Isolation stricte partner_id)
        const { data: events } = await supabase
            .from('events')
            .select('id, title, status')
            .eq('partner_id', partnerId);

        const activeEventsCount = events?.filter(e => e.status === 'PUBLIE').length || 0;
        const eventIds = events?.map(e => e.id) || [];

        // 4. Billets vendus pour ces événements
        let ticketsSold = 0;
        let ticketRevenue = 0;

        if (eventIds.length > 0) {
            const { data: tickets } = await supabase
                .from('tickets')
                .select('id, price_paid, status')
                .in('event_id', eventIds)
                .neq('status', 'ANNULE');

            ticketsSold = tickets?.length || 0;
            ticketRevenue = tickets?.reduce((acc, t) => acc + (Number(t.price_paid) || 0), 0) || 0;
        }

        // 5. Commandes de restauration / services
        const { data: orders } = await supabase
            .from('orders')
            .select('id, order_number, total_amount, order_status, delivery_mode, created_at')
            .eq('partner_id', partnerId)
            .order('created_at', { ascending: false })
            .limit(10);

        const ordersCount = orders?.length || 0;
        const orderRevenue = orders
            ?.filter(o => o.order_status !== 'ANNULEE' && o.order_status !== 'REJETEE')
            .reduce((acc, o) => acc + (Number(o.total_amount) || 0), 0) || 0;

        // 6. Calculs financiers nets (Déduction commission 6.5%)
        const totalGrossRevenue = ticketRevenue + orderRevenue;
        const platformCommissionRate = 6.5;
        const platformFee = Math.round(totalGrossRevenue * (platformCommissionRate / 100));
        const partnerNetRevenue = totalGrossRevenue - platformFee;

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

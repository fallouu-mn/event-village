import { NextRequest, NextResponse } from 'next/server';
import { getServiceRoleClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/orders
 * Récupère toutes les commandes, réservations de salles et de tables de l'utilisateur connecté
 */
export async function GET(req: NextRequest) {
    try {
        const supabase = getServiceRoleClient();
        const authHeader = req.headers.get('authorization');
        const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;

        let userId: string | null = null;
        if (token) {
            const { data: { user } } = await supabase.auth.getUser(token);
            userId = user?.id || null;
        }

        const { searchParams } = new URL(req.url);
        const queryUserId = searchParams.get('userId');
        const effectiveUserId = userId || queryUserId;

        if (!effectiveUserId) {
            return NextResponse.json({ error: 'Connexion requise pour consulter vos commandes.' }, { status: 401 });
        }

        // 1. Commandes Repas / Traiteur
        const { data: orders } = await supabase
            .from('orders')
            .select(`
                id,
                order_number,
                total_amount,
                paid_amount,
                balance_amount,
                delivery_mode,
                order_status,
                payment_status,
                created_at,
                partner_id,
                partners(company_name, commercial_name),
                order_items(id, product_name, quantity, total_price)
            `)
            .eq('client_id', effectiveUserId)
            .order('created_at', { ascending: false });

        // 2. Réservations de Salles
        const { data: hallReservations } = await supabase
            .from('hall_reservations')
            .select(`
                id,
                start_date,
                end_date,
                total_amount,
                deposit_amount,
                balance_amount,
                status,
                payment_status,
                created_at,
                hall_id,
                halls(name, images),
                partner_id,
                partners(company_name, commercial_name)
            `)
            .eq('client_id', effectiveUserId)
            .order('created_at', { ascending: false });

        // 3. Réservations de Tables
        const { data: tableReservations } = await supabase
            .from('table_reservations')
            .select(`
                id,
                reservation_date,
                reservation_time,
                guest_count,
                deposit_amount,
                status,
                payment_status,
                created_at,
                partner_id,
                partners(company_name, commercial_name)
            `)
            .eq('client_id', effectiveUserId)
            .order('created_at', { ascending: false });

        // Formatage unifié
        const unifiedList: any[] = [];

        (orders || []).forEach((o: any) => {
            const date = new Date(o.created_at);
            const dateFormatted = date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
            const total = Number(o.total_amount);

            unifiedList.push({
                id: o.id,
                orderNumber: o.order_number,
                type: 'FOOD_ORDER',
                title: `Commande Traiteur — ${o.partners?.commercial_name || o.partners?.company_name || 'Restaurant'} (${(o.order_items || []).length} article${(o.order_items || []).length > 1 ? 's' : ''})`,
                itemCount: (o.order_items || []).length,
                totalAmountFormatted: `${total.toLocaleString('fr-FR')} FCFA`,
                status: o.order_status,
                paymentStatus: o.payment_status,
                paymentMethod: 'SamirPay (Wave / OM)',
                dateFormatted,
                detailsUrl: `/restaurants/${o.partner_id}/menu`,
                createdAt: o.created_at,
            });
        });

        (hallReservations || []).forEach((h: any) => {
            const date = new Date(h.created_at);
            const dateFormatted = date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
            const deposit = Number(h.deposit_amount);

            unifiedList.push({
                id: h.id,
                orderNumber: `SALLE-${h.id.substring(0, 8).toUpperCase()}`,
                type: 'HALL_RESERVATION',
                title: `Location ${h.halls?.name || 'Salle de réception'} (${h.start_date})`,
                itemCount: 1,
                totalAmountFormatted: `${deposit.toLocaleString('fr-FR')} FCFA (Acompte)`,
                status: h.status,
                paymentStatus: h.payment_status,
                paymentMethod: 'SamirPay (Wave / OM)',
                dateFormatted,
                detailsUrl: `/halls/${h.hall_id}`,
                createdAt: h.created_at,
            });
        });

        (tableReservations || []).forEach((t: any) => {
            const date = new Date(t.created_at);
            const dateFormatted = date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
            const deposit = Number(t.deposit_amount);

            unifiedList.push({
                id: t.id,
                orderNumber: `TAB-${t.id.substring(0, 8).toUpperCase()}`,
                type: 'TABLE_RESERVATION',
                title: `Table ${t.partners?.commercial_name || t.partners?.company_name || 'Restaurant'} (${t.guest_count} pers. - ${t.reservation_time})`,
                itemCount: t.guest_count,
                totalAmountFormatted: deposit > 0 ? `${deposit.toLocaleString('fr-FR')} FCFA` : 'Sur place',
                status: t.status,
                paymentStatus: t.payment_status,
                paymentMethod: deposit > 0 ? 'SamirPay (Wave / OM)' : 'Sur place',
                dateFormatted,
                detailsUrl: `/restaurants/${t.partner_id}/tables`,
                createdAt: t.created_at,
            });
        });

        // Tri par date de création décroissante
        unifiedList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        return NextResponse.json({ orders: unifiedList });
    } catch (err: unknown) {
        console.error('[API /api/orders] Exception:', err);
        return NextResponse.json({ error: 'Erreur interne du serveur' }, { status: 500 });
    }
}

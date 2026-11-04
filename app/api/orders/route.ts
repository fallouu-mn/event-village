import { NextRequest, NextResponse } from 'next/server';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { requireActiveSession } from '@/lib/auth/session';
import { featureNotFound, featuresUnavailable, getFeatureFlags, type FeatureFlags } from '@/lib/features/flags';
import { formatFcfa } from '@/lib/format';

export const dynamic = 'force-dynamic';

/**
 * GET /api/orders
 * Commandes de repas, réservations de salles et de tables du compte de la session.
 * Lot 7 (7.3, D5) : le compte vient TOUJOURS de la session (requireActiveSession : Bearer ou cookies du
 * navigateur) ; un paramètre ?userId= est ignoré (faille IDOR corrigée). Interrupteurs (D55, D56) : session
 * d'abord, puis 404 quand les trois services sont fermés ; sinon seuls les services ouverts sont lus.
 * Une erreur de lecture est une erreur serveur (aucune liste partielle présentée comme complète).
 */
export async function GET(req: NextRequest) {
    const session = await requireActiveSession(req);
    if (session.response) return session.response;
    let flags: FeatureFlags;
    try {
        flags = await getFeatureFlags();
    } catch (err) {
        console.error('[API /api/orders]', err instanceof Error ? err.message : String(err));
        return featuresUnavailable();
    }
    if (!flags.halls && !flags.tables && !flags.orders) return featureNotFound('orders');
    try {
        const supabase = getServiceRoleClient();
        const effectiveUserId = session.user.id;

        // 1. Commandes Repas / Traiteur
        const { data: orders, error: ordersErr } = !flags.orders ? { data: [], error: null } : await supabase
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
        const { data: hallReservations, error: hallsErr } = !flags.halls ? { data: [], error: null } : await supabase
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
        const { data: tableReservations, error: tablesErr } = !flags.tables ? { data: [], error: null } : await supabase
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

        const readErr = ordersErr ?? hallsErr ?? tablesErr;
        if (readErr) throw new Error(`lecture des commandes et réservations de ${effectiveUserId} impossible : ${readErr.message}`);

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
                totalAmountFormatted: formatFcfa(total),
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
                totalAmountFormatted: `${formatFcfa(deposit)} (acompte)`,
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
                totalAmountFormatted: deposit > 0 ? formatFcfa(deposit) : 'Sur place',
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

        return NextResponse.json({ orders: unifiedList }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (err: unknown) {
        console.error('[API /api/orders] erreur interne :', err instanceof Error ? err.message : String(err));
        return NextResponse.json({ error: 'Commandes momentanément indisponibles.', code: 'ORDERS_UNAVAILABLE' }, { status: 500 });
    }
}

import { NextRequest, NextResponse } from 'next/server';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { requireActiveSession } from '@/lib/auth/session';
import { featureNotFound, featuresUnavailable, getFeatureFlags, type FeatureFlags } from '@/lib/features/flags';
import { formatFcfa } from '@/lib/format';
import { partnerPublicName } from '@/lib/partner/public-name';
import { orderStateLabel } from '@/lib/orders/booking';
import { orderListGroup } from '@/lib/orders/client-view';

export const dynamic = 'force-dynamic';

/**
 * GET /api/orders
 * Commandes de repas, réservations de salles et de tables du compte de la session.
 * Lot 12b : commandes de repas lues sur l'état détaillé (order_state) avec un groupe pour l'écran : EN_COURS (à payer
 * dans le délai, ou en cours), TERMINEE, NON_PAYEE (jamais payée à temps : rangée à part) ; lien vers /orders/<id>.
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

        // 1. Commandes de repas (lot 12b) : état détaillé (order_state, seule source depuis le lot 12a), établissement,
        //    montants figés ; plus les anciennes commandes de repas sans établissement (closes au lot 12a), sans lien.
        //    Les commandes de billets payés à l'entrée (lot 4 : tickets.order_id) n'en sont pas.
        const { data: orders, error: ordersErr } = !flags.orders ? { data: [], error: null } : await supabase
            .from('orders')
            .select(`
                id,
                order_number,
                order_state,
                order_status,
                delivery_mode,
                payment_type,
                goods_total,
                total_amount,
                paid_goods,
                onsite_amount,
                hold_expires_at,
                scheduled_for,
                estimated_at,
                created_at,
                venue_id,
                venues(name, photos),
                order_items(quantity),
                tickets(id)
            `)
            .eq('client_id', effectiveUserId)
            .order('created_at', { ascending: false })
            .limit(200);

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
                partners(commercial_name)
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
                partners(commercial_name)
            `)
            .eq('client_id', effectiveUserId)
            .order('created_at', { ascending: false });

        const readErr = ordersErr ?? hallsErr ?? tablesErr;
        if (readErr) throw new Error(`lecture des commandes et réservations de ${effectiveUserId} impossible : ${readErr.message}`);

        // Formatage unifié
        const unifiedList: any[] = [];

        (orders || []).forEach((o: any) => {
            // Commande de billets payés à l'entrée (lot 4) : jamais dans « Mes commandes »
            if (!o.venue_id && Array.isArray(o.tickets) && o.tickets.length > 0) return;
            const date = new Date(o.created_at);
            const dateFormatted = date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
            const items = (o.order_items || []).reduce((n: number, i: any) => n + (Number(i.quantity) || 0), 0);
            const venue = Array.isArray(o.venues) ? o.venues[0] : o.venues;
            const legacy = !o.venue_id;
            const group = legacy ? 'TERMINEE' : orderListGroup(o.order_state, o.hold_expires_at);
            const total = Number(legacy ? o.total_amount : o.goods_total);
            unifiedList.push({
                id: o.id,
                orderNumber: o.order_number,
                type: 'FOOD_ORDER',
                title: legacy ? 'Ancienne commande' : `Commande ${String(venue?.name ?? '')}`.trim(),
                venueName: legacy ? null : venue?.name ?? null,
                // Lot 12b (ajout du 26/11) : « Commander à nouveau » rouvre la carte de cet établissement
                venueId: legacy ? null : o.venue_id,
                image: legacy ? null : (Array.isArray(venue?.photos) && typeof venue.photos[0] === 'string' ? venue.photos[0] : null),
                itemCount: items,
                totalAmountFormatted: formatFcfa(total),
                balanceDue: legacy ? 0 : Math.max(Number(o.goods_total) - Number(o.paid_goods) - Number(o.onsite_amount ?? 0), 0),
                status: o.order_state ?? o.order_status,
                statusLabel: legacy && !o.order_state ? 'Ancienne commande' : orderStateLabel(o.order_state, o.delivery_mode),
                group,
                mode: o.delivery_mode,
                paymentStatus: null,
                paymentMethod: 'SamirPay (Wave / OM)',
                holdExpiresAt: group === 'EN_COURS' && o.order_state === 'EN_ATTENTE_PAIEMENT' ? o.hold_expires_at : null,
                scheduledFor: o.scheduled_for ?? null,
                estimatedAt: o.estimated_at ?? null,
                dateFormatted,
                // Lot 12b : suivi de la commande (une ancienne commande n'a pas de page)
                detailsUrl: legacy ? null : `/orders/${o.id}`,
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
                // Lot 10b : détail dans « Mes réservations » (payer le solde, annuler)
                detailsUrl: `/halls/reservations/${h.id}`,
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
                title: `Table ${partnerPublicName(t.partners)} (${t.guest_count} pers. - ${t.reservation_time})`,
                itemCount: t.guest_count,
                totalAmountFormatted: deposit > 0 ? formatFcfa(deposit) : 'Sur place',
                status: t.status,
                paymentStatus: t.payment_status,
                paymentMethod: deposit > 0 ? 'SamirPay (Wave / OM)' : 'Sur place',
                dateFormatted,
                // Lot 12b : détail de la réservation (lot 11b) ; l'ancien lien menait à une fiche introuvable
                detailsUrl: `/tables/reservations/${t.id}`,
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

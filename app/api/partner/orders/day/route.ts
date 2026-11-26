import { NextRequest, NextResponse } from 'next/server';
import { apiFailure } from '@/lib/api/public-error';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { orderRefusal } from '@/lib/orders/booking';
import { NO_STORE, partnerOrdersContext } from '@/lib/orders/partner-route';

export const dynamic = 'force-dynamic';

/**
 * GET /api/partner/orders/day?venue=<id> — lot 12c : « Ma journée » (order_partner_day, fonction en base) : commandes
 * reçues aujourd'hui (jour de Dakar), ouvertes, à accepter, remises et leur recette (payé en ligne, payé sur place),
 * plats bientôt épuisés. Aucun montant calculé dans le navigateur. Jamais une commande non payée.
 */
export async function GET(request: NextRequest) {
    try {
        const ctx = await partnerOrdersContext(request, '/api/partner/orders/day');
        if (ctx.response) return ctx.response;
        const venue = new URL(request.url).searchParams.get('venue');
        const { data, error } = await getServiceRoleClient().rpc('order_partner_day', { p: { actor_id: ctx.user.id, venue_id: venue || null } });
        if (error) throw new Error(`order_partner_day : ${error.message}`);
        const r = (data ?? {}) as Record<string, unknown>;
        if (r.ok !== true) return orderRefusal(r, 'Journée momentanément indisponible.');
        const low = Array.isArray(r.low) ? (r.low as Array<Record<string, unknown>>) : [];
        return NextResponse.json({
            success: true,
            day: {
                date: r.day,
                receivedToday: Number(r.received_today),
                openNow: Number(r.open_now),
                toAccept: Number(r.to_accept),
                handedToday: Number(r.handed_today),
                revenueToday: Number(r.revenue_today),
                paidOnlineToday: Number(r.paid_online_today),
                onsiteToday: Number(r.onsite_today),
                low: low.map((x) => ({ productId: String(x.product_id), name: String(x.name), venueId: x.venue_id ?? null, kind: x.kind === 'STOCK' ? 'STOCK' : 'PORTIONS', left: Number(x.left) })),
            },
        }, { headers: NO_STORE });
    } catch (error: unknown) {
        return apiFailure('GET /api/partner/orders/day', error, { message: 'Journée momentanément indisponible.', code: 'DAY_UNAVAILABLE', status: 500 });
    }
}

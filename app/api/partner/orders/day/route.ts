import { NextRequest, NextResponse } from 'next/server';
import { apiFailure } from '@/lib/api/public-error';
import { requireActiveSession } from '@/lib/auth/session';
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
        const ctx = await partnerOrdersContext(await requireActiveSession(request), '/api/partner/orders/day');
        if (ctx.response) return ctx.response;
        const venue = new URL(request.url).searchParams.get('venue');
        const { data, error } = await getServiceRoleClient().rpc('order_partner_day', { p: { actor_id: ctx.user.id, venue_id: venue || null } });
        if (error) throw new Error(`order_partner_day : ${error.message}`);
        const r = (data ?? {}) as Record<string, unknown>;
        if (r.ok !== true) return orderRefusal(r, 'Journée momentanément indisponible.');
        const low = Array.isArray(r.low) ? (r.low as Array<Record<string, unknown>>) : [];
        const specials = Array.isArray(r.specials) ? (r.specials as Array<Record<string, unknown>>) : [];
        // Lot 12c : état de la fiche, pour le bandeau de lecture seule d'une fiche suspendue (les actions sont refusées en base)
        const { data: fiche, error: ficheErr } = await getServiceRoleClient().from('partners').select('status').eq('user_id', ctx.user.id)
            .order('created_at').limit(1).maybeSingle();
        if (ficheErr) throw new Error(`fiche partenaire : ${ficheErr.message}`);
        return NextResponse.json({
            success: true,
            partnerStatus: (fiche?.status as string | undefined) ?? null,
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
                // Contre-vérification du lot 12c (point 12) : plats du jour encore en vente (« Plus de … »)
                specials: specials.map((x) => ({ productId: String(x.product_id), name: String(x.name), venueId: x.venue_id ?? null, portions: Number(x.portions), sold: Number(x.sold) })),
            },
        }, { headers: NO_STORE });
    } catch (error: unknown) {
        return apiFailure('GET /api/partner/orders/day', error, { message: 'Journée momentanément indisponible.', code: 'DAY_UNAVAILABLE', status: 500 });
    }
}

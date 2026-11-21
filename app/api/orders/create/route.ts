import { NextRequest, NextResponse } from 'next/server';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { apiFailure } from '@/lib/api/public-error';
import { requireActiveSession, requireVerifiedPhone } from '@/lib/auth/session';
import { guardFeature } from '@/lib/features/flags';
import { invalidBody, orderInput, orderRefusal, orderStateLabel, readJson } from '@/lib/orders/booking';

export const dynamic = 'force-dynamic';

/**
 * POST /api/orders/create { venueId, mode, payment?, items: [{ productId, quantity, optionIds?, notes? }], zoneId?,
 * address?, phone?, onsiteTableId?, onsiteLabel?, scheduledFor?, notes? }
 * Lot 4.0 : session ACTIVE obligatoire ; le client est toujours le compte de la session.
 * Lot 12a : une seule fonction en base, order_create, fait tout sous le verrou de l'établissement puis du client :
 * établissement validé et ouvert à la vente, partenaire VALIDE, produits de cet établissement, jamais réglementés,
 * prix et suppléments relus en base, stock et portions pris une seule fois, zone et minimum, heure dans les horaires,
 * plafond des commandes non payées. Aucun montant n'est lu dans le corps (un prix ou un total envoyé est ignoré).
 * Avant ce lot : total calculé par la route à partir des produits de n'importe quelle partenaire, quantités non bornées,
 * aucun produit réglementé refusé.
 */
export async function POST(req: NextRequest) {
    try {
        const session = await requireActiveSession(req);
        if (session.response) return session.response;
        // Lot 9 quater (A2) : numéro prouvé par un code SMS exigé avant toute action qui engage de l'argent
        const unverified = requireVerifiedPhone(session.user);
        if (unverified) return unverified;
        // Lot 7 (7.3, D56) : session d'abord, puis interrupteur (404 si le service est fermé)
        const closed = await guardFeature('orders', 'POST /api/orders/create');
        if (closed) return closed;

        const body = await readJson(req);
        if (!body) return invalidBody();
        const { data, error } = await getServiceRoleClient().rpc('order_create', { p: orderInput(session.user.id, body) });
        if (error) throw new Error(`order_create : ${error.message}`);
        const r = data as Record<string, unknown>;
        if (r?.ok !== true) return orderRefusal(r, 'Commande impossible pour le moment.');
        return NextResponse.json({
            success: true,
            order: {
                id: r.order_id,
                orderNumber: r.order_number,
                state: r.order_state,
                stateLabel: orderStateLabel(r.order_state, r.mode),
                venueName: r.venue_name,
                mode: r.mode,
                payment: r.payment,
                lines: r.lines,
                itemsAmount: Number(r.items_amount),
                deliveryFee: Number(r.delivery_fee),
                goodsTotal: Number(r.goods_total),
                depositPercent: r.deposit_percent ?? null,
                serviceFee: Number(r.first_fee),
                toPayNow: Number(r.to_pay_now),
                balanceDue: Number(r.balance_due),
                scheduledFor: r.scheduled_for,
                asap: r.asap,
                holdExpiresAt: r.hold_expires_at ?? null,
                responseDueAt: r.response_due_at ?? null,
            },
        }, { status: 201 });
    } catch (err: unknown) {
        return apiFailure('POST /api/orders/create', err, { message: 'Commande impossible pour le moment. Réessayez.', code: 'ORDER_CREATE_FAILED' });
    }
}

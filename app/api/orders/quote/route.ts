import { NextRequest, NextResponse } from 'next/server';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { apiFailure } from '@/lib/api/public-error';
import { requireActiveSession } from '@/lib/auth/session';
import { guardFeature } from '@/lib/features/flags';
import { invalidBody, orderInput, orderRefusal, readJson } from '@/lib/orders/booking';

export const dynamic = 'force-dynamic';

/**
 * POST /api/orders/quote — même corps que POST /api/orders/create ; rend le devis calculé en base (order_quote) sans
 * rien tenir : lignes aux prix relus en base, frais de zone, minimum, part payée maintenant, frais de service, solde à
 * la remise, heure prévue. Aucun montant n'est lu dans le corps.
 */
export async function POST(req: NextRequest) {
    try {
        const session = await requireActiveSession(req);
        if (session.response) return session.response;
        const closed = await guardFeature('orders', 'POST /api/orders/quote');
        if (closed) return closed;
        const body = await readJson(req);
        if (!body) return invalidBody();
        const { data, error } = await getServiceRoleClient().rpc('order_quote', { p: orderInput(null, body) });
        if (error) throw new Error(`order_quote : ${error.message}`);
        const r = data as Record<string, unknown>;
        if (r?.ok !== true) return orderRefusal(r, 'Devis impossible pour le moment.');
        const lines = Array.isArray(r.lines) ? (r.lines as Array<Record<string, unknown>>) : [];
        return NextResponse.json({
            success: true,
            quote: {
                venueName: r.venue_name,
                mode: r.mode,
                payment: r.payment,
                lines: lines.map((l) => ({
                    productId: l.product_id, name: l.name, quantity: l.quantity, options: l.options,
                    unitPrice: Number(l.unit_price), totalPrice: Number(l.total_price),
                })),
                zoneName: r.zone_name ?? null,
                itemsAmount: Number(r.items_amount),
                deliveryFee: Number(r.delivery_fee),
                goodsTotal: Number(r.goods_total),
                depositPercent: r.deposit_percent ?? null,
                serviceFee: Number(r.first_fee),
                toPayNow: Number(r.to_pay_now),
                balanceDue: Number(r.balance_due),
                scheduledFor: r.scheduled_for,
                asap: r.asap,
                prepMinutes: r.prep_minutes,
            },
        }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (err: unknown) {
        return apiFailure('POST /api/orders/quote', err, { message: 'Devis impossible pour le moment. Réessayez.', code: 'ORDER_QUOTE_FAILED' });
    }
}

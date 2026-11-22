import { NextRequest, NextResponse } from 'next/server';
import { apiFailure } from '@/lib/api/public-error';
import { requireActiveSession } from '@/lib/auth/session';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { guardFeature } from '@/lib/features/flags';
import { UUID_RE, deliverHandoverCode, invalidBody, orderNotFound, orderRefusal, orderResponse, orderStateLabel, readJson } from '@/lib/orders/booking';

export const dynamic = 'force-dynamic';

/** GET /api/courier/orders/[id] — une livraison confiée au livreur de la session (order_view, fonction en base). */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const activeSession = await requireActiveSession(request);
        if (activeSession.response) return activeSession.response;
        const closed = await guardFeature('orders', '/api/courier/orders/[id]');
        if (closed) return closed;
        const { id } = await params;
        if (!UUID_RE.test(id)) return orderNotFound();
        const { data, error } = await getServiceRoleClient().rpc('order_view', { p: { order_id: id, actor_id: activeSession.user.id, as: 'COURIER' } });
        if (error) throw new Error(`order_view : ${error.message}`);
        if (!data) return orderNotFound();
        return NextResponse.json({ success: true, order: orderResponse(data as Record<string, unknown>) }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error: unknown) {
        return apiFailure('GET /api/courier/orders/[id]', error, { message: 'Livraison momentanément indisponible.', code: 'COURIER_ORDER_UNAVAILABLE', status: 500 });
    }
}

/**
 * PATCH /api/courier/orders/[id] { action: EN_ROUTE | REMETTRE, minutes?, code?, balanceReceived? } — par
 * order_courier_action : le livreur de cette commande seulement, membre ACTIF de l'équipe ; remise contre le code donné
 * par le client (essais limités), solde reçu sur place noté (jamais compté).
 */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const activeSession = await requireActiveSession(request);
        if (activeSession.response) return activeSession.response;
        const closed = await guardFeature('orders', '/api/courier/orders/[id]');
        if (closed) return closed;
        const { id } = await params;
        if (!UUID_RE.test(id)) return orderNotFound();
        const body = await readJson(request);
        if (!body) return invalidBody();
        const action = typeof body.action === 'string' ? body.action.trim().toUpperCase() : '';
        if (action !== 'EN_ROUTE' && action !== 'REMETTRE') {
            return NextResponse.json({ success: false, error: 'Action inconnue.', code: 'INVALID_ACTION' }, { status: 400 });
        }
        const { data, error } = await getServiceRoleClient().rpc('order_courier_action', {
            p: {
                order_id: id, actor_id: activeSession.user.id, action,
                minutes: typeof body.minutes === 'number' || typeof body.minutes === 'string' ? body.minutes : null,
                code: typeof body.code === 'string' ? body.code.trim() : null,
                balance_received: body.balanceReceived === true,
            },
        });
        if (error) throw new Error(`order_courier_action : ${error.message}`);
        const r = data as Record<string, unknown>;
        if (r?.ok !== true) return orderRefusal(r, 'Action impossible pour le moment.');
        // Code de remise (en route) : SMS immédiat au client, jamais renvoyé au livreur
        await deliverHandoverCode(r, activeSession.user.id);
        return NextResponse.json({ success: true, order: { id, state: r.order_state, stateLabel: orderStateLabel(r.order_state, 'LIVRAISON'), estimatedAt: r.estimated_at ?? null } });
    } catch (error: unknown) {
        return apiFailure('PATCH /api/courier/orders/[id]', error, { message: 'Action impossible pour le moment. Réessayez.', code: 'COURIER_ACTION_FAILED', status: 500 });
    }
}

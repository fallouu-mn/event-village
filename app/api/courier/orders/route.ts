import { NextRequest, NextResponse } from 'next/server';
import { apiFailure } from '@/lib/api/public-error';
import { requireActiveSession } from '@/lib/auth/session';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { guardFeature } from '@/lib/features/flags';
import { orderResponse, orderStateLabel } from '@/lib/orders/booking';

export const dynamic = 'force-dynamic';

/**
 * GET /api/courier/orders — journée du livreur de la session (order_courier_day, lot 12d) : `orders` = livraisons en cours
 * (order_courier_list : seulement s'il est livreur ACTIF de l'équipe de la partenaire ; adresse tant que la commande est
 * ouverte, téléphone du client seulement pendant la livraison), `done` = livraisons terminées aujourd'hui (sans adresse
 * ni téléphone), `invitations` = invitations en attente. Aucune lecture REST des commandes par le livreur.
 */
export async function GET(request: NextRequest) {
    try {
        const activeSession = await requireActiveSession(request);
        if (activeSession.response) return activeSession.response;
        const closed = await guardFeature('orders', '/api/courier/orders');
        if (closed) return closed;
        const { data, error } = await getServiceRoleClient().rpc('order_courier_day', { p: { actor_id: activeSession.user.id } });
        if (error) throw new Error(`order_courier_day : ${error.message}`);
        const day = (data ?? {}) as { active?: unknown; done?: unknown; invitations?: unknown };
        const list = Array.isArray(day.active) ? (day.active as Array<Record<string, unknown>>) : [];
        const done = Array.isArray(day.done) ? (day.done as Array<Record<string, unknown>>) : [];
        return NextResponse.json({
            success: true,
            orders: list.map(orderResponse),
            done: done.map((d) => ({ ...d, stateLabel: orderStateLabel(d.state, d.mode) })),
            invitations: Array.isArray(day.invitations) ? day.invitations : [],
        }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error: unknown) {
        return apiFailure('GET /api/courier/orders', error, { message: 'Livraisons momentanément indisponibles.', code: 'COURIER_ORDERS_UNAVAILABLE', status: 500 });
    }
}

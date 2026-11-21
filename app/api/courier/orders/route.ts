import { NextRequest, NextResponse } from 'next/server';
import { apiFailure } from '@/lib/api/public-error';
import { requireActiveSession } from '@/lib/auth/session';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { guardFeature } from '@/lib/features/flags';
import { orderResponse } from '@/lib/orders/booking';

export const dynamic = 'force-dynamic';

/**
 * GET /api/courier/orders — livraisons confiées au compte de la session (order_courier_list) : seulement s'il est livreur
 * ACTIF de l'équipe de la partenaire, et seulement les commandes en cours. Aucune lecture REST des commandes par le
 * livreur ; adresse et téléphone du client tant que la commande est ouverte.
 */
export async function GET(request: NextRequest) {
    try {
        const activeSession = await requireActiveSession(request);
        if (activeSession.response) return activeSession.response;
        const closed = await guardFeature('orders', '/api/courier/orders');
        if (closed) return closed;
        const { data, error } = await getServiceRoleClient().rpc('order_courier_list', { p: { actor_id: activeSession.user.id } });
        if (error) throw new Error(`order_courier_list : ${error.message}`);
        const list = Array.isArray(data) ? (data as Array<Record<string, unknown>>) : [];
        return NextResponse.json({ success: true, orders: list.map(orderResponse) }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (error: unknown) {
        return apiFailure('GET /api/courier/orders', error, { message: 'Livraisons momentanément indisponibles.', code: 'COURIER_ORDERS_UNAVAILABLE', status: 500 });
    }
}

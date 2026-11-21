import { NextRequest, NextResponse } from 'next/server';
import { apiFailure } from '@/lib/api/public-error';
import { requireActiveSession, serverIsPartner } from '@/lib/auth/session';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { guardFeature } from '@/lib/features/flags';
import { UUID_RE, orderRefusal } from '@/lib/orders/booking';

export const dynamic = 'force-dynamic';

/**
 * DELETE /api/partner/couriers/[userId] — retire un livreur de l'équipe (order_courier_remove) : il ne voit plus aucune
 * commande ; celles pas encore parties lui sont retirées ; celles en route restent à terminer par la partenaire.
 */
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ userId: string }> }) {
    try {
        const activeSession = await requireActiveSession(request);
        if (activeSession.response) return activeSession.response;
        const closed = await guardFeature('orders', 'DELETE /api/partner/couriers/[userId]');
        if (closed) return closed;
        const user = activeSession.user;
        if (!user || !serverIsPartner(user)) {
            return NextResponse.json({ error: 'Accès non autorisé.' }, { status: 403 });
        }
        const { userId } = await params;
        if (!UUID_RE.test(userId)) {
            return NextResponse.json({ success: false, error: 'Ce livreur ne fait pas partie de votre équipe.', code: 'COURIER_NOT_FOUND' }, { status: 404 });
        }
        const { data, error } = await getServiceRoleClient().rpc('order_courier_remove', { p: { actor_id: user.id, courier_id: userId } });
        if (error) throw new Error(`order_courier_remove : ${error.message}`);
        const r = data as Record<string, unknown>;
        if (r?.ok !== true) return orderRefusal(r, 'Retrait impossible pour le moment.');
        return NextResponse.json({ success: true, ordersUnassigned: Number(r.orders_unassigned) });
    } catch (error: unknown) {
        return apiFailure('DELETE /api/partner/couriers/[userId]', error, { message: 'Retrait impossible pour le moment. Réessayez.', code: 'COURIER_REMOVE_FAILED', status: 500 });
    }
}

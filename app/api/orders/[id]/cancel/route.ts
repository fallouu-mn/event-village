import { NextRequest, NextResponse } from 'next/server';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { apiFailure } from '@/lib/api/public-error';
import { requireActiveSession } from '@/lib/auth/session';
import { UUID_RE, orderCancelMessage, orderNotFound, orderRefusal, orderStateLabel, sendOrderRefunds } from '@/lib/orders/booking';

export const dynamic = 'force-dynamic';

/**
 * POST /api/orders/[id]/cancel — le client annule sa commande (order_cancel, origine CLIENT) : gratuit et tout rendu
 * (frais compris) avant le début de la préparation ; ensuite refusé (« La préparation a commencé… »). Remboursement par
 * le moteur financier, puis versé sur Wave ou Orange Money. Sans interrupteur (comme le suivi d'un paiement).
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await requireActiveSession(req, { allowStatuses: ['ACTIF', 'EN_ATTENTE'] });
        if (session.response) return session.response;
        const { id } = await params;
        if (!UUID_RE.test(id)) return orderNotFound();
        const { data, error } = await getServiceRoleClient().rpc('order_cancel', { p: { order_id: id, actor_id: session.user.id, origin: 'CLIENT' } });
        if (error) throw new Error(`order_cancel : ${error.message}`);
        const r = data as Record<string, unknown>;
        if (r?.ok !== true) return orderRefusal(r, 'Annulation impossible.');
        await sendOrderRefunds(r.cashout_ids);
        return NextResponse.json({
            success: true,
            message: orderCancelMessage(r),
            order: { id, state: r.order_state, stateLabel: orderStateLabel(r.order_state), refundAmount: Number(r.refund_amount) },
        });
    } catch (err: unknown) {
        return apiFailure('POST /api/orders/[id]/cancel', err, { message: 'Annulation impossible pour le moment. Réessayez.', code: 'ORDER_CANCEL_FAILED' });
    }
}

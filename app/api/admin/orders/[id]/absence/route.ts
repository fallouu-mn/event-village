import { NextRequest, NextResponse } from 'next/server';
import { apiFailure } from '@/lib/api/public-error';
import { verifyAdminAuth } from '@/lib/admin/admin-auth';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { UUID_RE, fcfa, invalidBody, orderNotFound, orderRefusal, orderStateLabel, readJson, sendOrderRefunds } from '@/lib/orders/booking';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/orders/[id]/absence { decision: TOUT | PART | RIEN, percent?, reason, preview?, expectedAmount? } — lot 12d,
 * décision du client : après l'absence du client (deux appels, 30 minutes d'attente), l'équipe Event Village décide de
 * rembourser tout, une part, ou rien, avec un motif (droit refunds.manage, vérifié par la route puis en base).
 * `preview: true` rend le montant rendu sans rien écrire ; la décision exige ce montant (`expectedAmount`, écrit sur le
 * bouton de confirmation) : refus AMOUNT_CHANGED s'il a changé. Une seule fois sous concurrence (verrou en base). Les
 * remboursements créés sont envoyés tout de suite.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const auth = await verifyAdminAuth(req, { requiredPermission: 'refunds.manage' });
    if (!auth.authorized) return auth.errorResponse!;
    try {
        const { id } = await params;
        if (!UUID_RE.test(id)) return orderNotFound();
        const body = await readJson(req);
        if (!body) return invalidBody();
        const preview = body.preview === true;
        const { data, error } = await getServiceRoleClient().rpc('order_absence_decide', {
            p: {
                actor_id: auth.user!.id, order_id: id,
                decision: typeof body.decision === 'string' ? body.decision : '',
                percent: typeof body.percent === 'number' || typeof body.percent === 'string' ? body.percent : null,
                reason: typeof body.reason === 'string' ? body.reason : '',
                preview,
                ...(typeof body.expectedAmount === 'number' || typeof body.expectedAmount === 'string' ? { expected_amount: body.expectedAmount } : {}),
            },
        });
        if (error) throw new Error(`order_absence_decide : ${error.message}`);
        const r = data as Record<string, unknown>;
        if (r?.ok !== true) return orderRefusal(r, 'Décision impossible.');
        if (preview) {
            return NextResponse.json({ success: true, preview: { decision: r.decision, percent: r.percent, refundAmount: Number(r.refund_amount ?? 0), paid: Number(r.paid ?? 0) } },
                { headers: { 'Cache-Control': 'no-store' } });
        }
        await sendOrderRefunds(r.cashout_ids);
        const refund = Number(r.refund_amount ?? 0);
        return NextResponse.json({
            success: true,
            message: refund > 0 ? `Décision enregistrée. Le client est remboursé de ${fcfa(refund)}.` : 'Décision enregistrée. Le client n’est pas remboursé.',
            order: { id, state: r.order_state, stateLabel: orderStateLabel(r.order_state, 'LIVRAISON'), refundAmount: refund },
        });
    } catch (err: unknown) {
        return apiFailure('POST /api/admin/orders/[id]/absence', err, { message: 'Décision impossible pour le moment. Réessayez.', code: 'ORDER_ABSENCE_FAILED' });
    }
}

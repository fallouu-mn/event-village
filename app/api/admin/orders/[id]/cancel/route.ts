import { NextRequest, NextResponse } from 'next/server';
import { apiFailure } from '@/lib/api/public-error';
import { verifyAdminAuth } from '@/lib/admin/admin-auth';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { UUID_RE, fcfa, orderNotFound, orderRefusal, orderStateLabel, readJson, sendOrderRefunds } from '@/lib/orders/booking';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/orders/[id]/cancel { reason, partnerFault? } — Event Village annule une commande (décision du client :
 * faute de la partenaire constatée, ou tout autre motif) : tout est rendu au client ; droit refunds.manage (ou
 * Superadmin), vérifié par la route puis par order_cancel en base ; motif obligatoire, envoyé au client et à la
 * partenaire ; faute de la partenaire notée (par défaut : oui) ; journal.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const auth = await verifyAdminAuth(req, { requiredPermission: 'refunds.manage' });
    if (!auth.authorized) return auth.errorResponse!;
    try {
        const { id } = await params;
        if (!UUID_RE.test(id)) return orderNotFound();
        const body = await readJson(req);
        if (!body) return NextResponse.json({ success: false, error: 'Indiquez le motif de l’annulation : il est envoyé au client.', code: 'REASON_REQUIRED' }, { status: 400 });
        const { data, error } = await getServiceRoleClient().rpc('order_cancel', {
            p: {
                order_id: id, actor_id: auth.user!.id, origin: 'EVENT_VILLAGE',
                reason: typeof body.reason === 'string' ? body.reason : '',
                partner_fault: body.partnerFault === false ? false : true,
            },
        });
        if (error) throw new Error(`order_cancel : ${error.message}`);
        const r = data as Record<string, unknown>;
        if (r?.ok !== true) return orderRefusal(r, 'Annulation impossible.');
        await sendOrderRefunds(r.cashout_ids);
        return NextResponse.json({
            success: true,
            message: Number(r.refund_amount) > 0 ? `Commande annulée. Le client est remboursé de ${fcfa(r.refund_amount)}.` : 'Commande annulée.',
            order: { id, state: r.order_state, stateLabel: orderStateLabel(r.order_state) },
        });
    } catch (err: unknown) {
        return apiFailure('POST /api/admin/orders/[id]/cancel', err, { message: 'Annulation impossible pour le moment. Réessayez.', code: 'ORDER_CANCEL_FAILED' });
    }
}

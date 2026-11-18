import { NextRequest, NextResponse } from 'next/server';
import { apiFailure } from '@/lib/api/public-error';
import { verifyAdminAuth } from '@/lib/admin/admin-auth';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { fcfa, refusalStatus, tableStateLabel } from '@/lib/tables/booking';
import { sendTableRefunds } from '@/lib/tables/refunds';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/tables/reservations/[id]/cancel { reason } — Event Village annule une réservation de table.
 * Lot 11a (décision du client) : tout est rendu ; droit refunds.manage (ou Superadmin), vérifié par la route puis par
 * table_reservation_cancel en base ; motif obligatoire, envoyé au client et à l'établissement ; journal.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const auth = await verifyAdminAuth(req, { requiredPermission: 'refunds.manage' });
    if (!auth.authorized) return auth.errorResponse!;
    try {
        const { id } = await params;
        let body: { reason?: unknown } = {};
        try {
            body = await req.json();
        } catch {
            return NextResponse.json({ error: 'Indiquez le motif de l’annulation : il est envoyé au client.' }, { status: 400 });
        }
        const { data, error } = await getServiceRoleClient().rpc('table_reservation_cancel', {
            p: { reservation_id: id, actor_id: auth.user!.id, origin: 'EVENT_VILLAGE', reason: typeof body?.reason === 'string' ? body.reason : '' },
        });
        if (error) throw new Error(`table_reservation_cancel : ${error.message}`);
        const r = data as Record<string, unknown>;
        if (r?.ok !== true) {
            return NextResponse.json({ error: r?.message ?? 'Annulation impossible.', code: r?.code }, { status: refusalStatus(r?.code) });
        }
        await sendTableRefunds(r.cashout_ids);
        return NextResponse.json({
            success: true,
            message: Number(r.refund_amount) > 0 ? `Réservation annulée. Le client est remboursé de ${fcfa(r.refund_amount)}.` : 'Réservation annulée.',
            reservation: { id, state: tableStateLabel(r.booking_state) },
        });
    } catch (err: unknown) {
        return apiFailure('POST /api/admin/tables/reservations/[id]/cancel', err, { message: 'Annulation impossible pour le moment. Réessayez.', code: 'TABLE_CANCEL_FAILED' });
    }
}

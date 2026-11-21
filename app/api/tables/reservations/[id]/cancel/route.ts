import { NextRequest, NextResponse } from 'next/server';
import { apiFailure } from '@/lib/api/public-error';
import { requireActiveSession } from '@/lib/auth/session';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { clientCancelMessage, refusalStatus, tableStateLabel } from '@/lib/tables/booking';
import { sendTableRefunds } from '@/lib/tables/refunds';
import { jsonBody } from '@/lib/tables/route-helpers';

export const dynamic = 'force-dynamic';

/**
 * POST /api/tables/reservations/[id]/cancel — le client annule sa réservation de table.
 * Lot 11a : table_reservation_cancel, sous le verrou de l'établissement, avec journal et avis : acompte rendu (frais
 * compris) si le client annule au moins tables.cancel_free_hours (2 h) avant l'heure, rien ensuite ; remboursement
 * par le moteur financier (grand livre, revenu d'Event Village, parrainage corrigés), puis versé sur Wave ou Orange
 * Money. Une réservation d'un autre client : « Réservation introuvable ».
 * Sans interrupteur (comme le suivi d'un paiement) : un client garde le droit d'annuler si le service est fermé.
 * Contre-vérification du lot 11b (T3) : corps { expected_refund } = montant de l'aperçu confirmé par le client ; la base
 * refuse (409 PREVIEW_CHANGED, avec le nouveau montant) s'il a changé depuis, rien n'est annulé.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await requireActiveSession(req, { allowStatuses: ['ACTIF', 'EN_ATTENTE'] });
        if (session.response) return session.response;
        const { id } = await params;
        const body = await jsonBody(req);
        const expected = body?.expected_refund;
        if (expected !== undefined && (typeof expected !== 'number' || !Number.isFinite(expected) || expected < 0 || expected > 1e12)) {
            return NextResponse.json({ error: 'Montant de l’aperçu illisible : affichez de nouveau l’annulation.', code: 'INVALID_AMOUNT' }, { status: 400 });
        }
        const { data, error } = await getServiceRoleClient().rpc('table_reservation_cancel', {
            p: { reservation_id: id, actor_id: session.user.id, origin: 'CLIENT', ...(expected !== undefined ? { expected_refund: expected } : {}) },
        });
        if (error) throw new Error(`table_reservation_cancel : ${error.message}`);
        const r = data as Record<string, unknown>;
        if (r?.ok !== true) {
            const changed = r?.code === 'PREVIEW_CHANGED' ? { refundAmount: Number(r.refund_amount), keptAmount: Number(r.kept_amount) } : {};
            return NextResponse.json({ error: r?.message ?? 'Annulation impossible.', code: r?.code, ...changed }, { status: refusalStatus(r?.code) });
        }
        await sendTableRefunds(r.cashout_ids);
        return NextResponse.json({
            success: true,
            message: clientCancelMessage(r),
            reservation: { id, state: tableStateLabel(r.booking_state), refundAmount: Number(r.refund_amount) },
        });
    } catch (err: unknown) {
        return apiFailure('POST /api/tables/reservations/[id]/cancel', err, { message: 'Annulation impossible pour le moment. Réessayez.', code: 'TABLE_CANCEL_FAILED' });
    }
}

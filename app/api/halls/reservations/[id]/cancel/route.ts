import { NextRequest, NextResponse } from 'next/server';
import { apiFailure } from '@/lib/api/public-error';
import { requireActiveSession } from '@/lib/auth/session';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { bookingStateLabel, fcfa, refusalStatus } from '@/lib/halls/booking';
import { sendHallRefunds } from '@/lib/halls/refunds';

export const dynamic = 'force-dynamic';

/**
 * POST /api/halls/reservations/[id]/cancel — le client annule sa réservation de salle.
 * Lot 10a (point 4) : hall_reservation_cancel applique la règle d'annulation figée sur la réservation (part
 * remboursée selon le temps qui reste avant la date), sous verrou, avec journal ; chaque paiement encaissé est
 * remboursé de cette part par le moteur financier (grand livre, revenu d'Event Village, parrainage corrigés), puis
 * versé sur Wave ou Orange Money. Une réservation d'un autre client : « Réservation introuvable ».
 * Sans interrupteur (comme le suivi d'un paiement) : un client garde le droit d'annuler si le service est fermé.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await requireActiveSession(req, { allowStatuses: ['ACTIF', 'EN_ATTENTE'] });
        if (session.response) return session.response;
        const { id } = await params;
        const { data, error } = await getServiceRoleClient().rpc('hall_reservation_cancel', {
            p: { reservation_id: id, actor_id: session.user.id, origin: 'CLIENT' },
        });
        if (error) throw new Error(`hall_reservation_cancel : ${error.message}`);
        const r = data as Record<string, unknown>;
        if (r?.ok !== true) {
            return NextResponse.json({ error: r?.message ?? 'Annulation impossible.', code: r?.code }, { status: refusalStatus(r?.code) });
        }
        await sendHallRefunds(r.cashout_ids);
        const refund = Number(r.refund_amount);
        return NextResponse.json({
            success: true,
            message: refund > 0
                ? `Réservation annulée. Vous êtes remboursé de ${fcfa(refund)} sur votre compte de paiement.`
                : 'Réservation annulée. Selon les conditions de la salle, aucun remboursement n’est dû.',
            reservation: { id, state: bookingStateLabel(r.booking_state), refundAmount: refund },
        });
    } catch (err: unknown) {
        return apiFailure('POST /api/halls/reservations/[id]/cancel', err, { message: 'Annulation impossible pour le moment. Réessayez.', code: 'HALL_CANCEL_FAILED' });
    }
}

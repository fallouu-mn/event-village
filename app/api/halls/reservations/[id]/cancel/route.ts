import { NextRequest, NextResponse } from 'next/server';
import { apiFailure } from '@/lib/api/public-error';
import { requireActiveSession } from '@/lib/auth/session';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { bookingStateLabel, fcfa, refusalStatus } from '@/lib/halls/booking';
import { sendHallRefunds } from '@/lib/halls/refunds';
import { cancelPreview, HallRefusal } from '@/lib/halls/queries';
import { refusalResponse } from '@/lib/halls/route-helpers';

export const dynamic = 'force-dynamic';

/**
 * GET /api/halls/reservations/[id]/cancel — montant rendu si le client annule maintenant (affiché avant de confirmer).
 * Lot 10b (point 2) : calculé en base (hall_cancel_preview : règle figée sur la réservation, même calcul que le
 * remboursement) ; rien n'est écrit. Réservation d'un autre compte : 404 « Réservation introuvable ». Sans
 * interrupteur, comme l'annulation.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await requireActiveSession(req, { allowStatuses: ['ACTIF', 'EN_ATTENTE'] });
        if (session.response) return session.response;
        const { id } = await params;
        const preview = await cancelPreview(session.user.id, id);
        return NextResponse.json({
            success: true,
            preview: {
                ...preview,
                message: preview.refundAmount > 0
                    ? `Si vous annulez maintenant, vous serez remboursé de ${fcfa(preview.refundAmount)} sur votre compte de paiement.`
                    : preview.paidAmount > 0
                        ? 'Si vous annulez maintenant, rien ne vous sera remboursé selon les conditions de la salle.'
                        : 'Vous n’avez encore rien payé : la date sera simplement libérée.',
            },
        });
    } catch (err: unknown) {
        if (err instanceof HallRefusal) return refusalResponse(err);
        return apiFailure('GET /api/halls/reservations/[id]/cancel', err, { message: 'Montant du remboursement momentanément indisponible.', code: 'HALL_CANCEL_PREVIEW_FAILED', status: 500 });
    }
}

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

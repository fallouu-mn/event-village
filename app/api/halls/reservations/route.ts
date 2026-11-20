import { NextRequest, NextResponse } from 'next/server';
import { apiFailure } from '@/lib/api/public-error';
import { requireActiveSession } from '@/lib/auth/session';
import { clientReservations } from '@/lib/halls/queries';

export const dynamic = 'force-dynamic';

/**
 * GET /api/halls/reservations — « Mes réservations » de salle du compte de la session.
 * Lot 10b (point 2) : états en mots, montants figés à la réservation, échéance du solde ; seules les réservations du
 * client de la session (jamais un identifiant reçu). Sans interrupteur, comme l'annulation : un client garde l'accès
 * à ses réservations si le service est fermé.
 */
export async function GET(req: NextRequest) {
    try {
        const session = await requireActiveSession(req, { allowStatuses: ['ACTIF', 'EN_ATTENTE'] });
        if (session.response) return session.response;
        const reservations = await clientReservations(session.user.id);
        return NextResponse.json({ success: true, reservations });
    } catch (err: unknown) {
        return apiFailure('GET /api/halls/reservations', err, { message: 'Réservations momentanément indisponibles.', code: 'HALL_RESERVATIONS_UNAVAILABLE', status: 500 });
    }
}

import { NextRequest, NextResponse } from 'next/server';
import { apiFailure } from '@/lib/api/public-error';
import { requireActiveSession } from '@/lib/auth/session';
import { clientReservation } from '@/lib/halls/queries';
import { notFound } from '@/lib/halls/route-helpers';

export const dynamic = 'force-dynamic';

/**
 * GET /api/halls/reservations/[id] — une réservation de salle du compte de la session.
 * Lot 10b (point 2) : état en mots, montants, échéance du solde, paiements possibles (acompte ou totalité pendant
 * l'attente, solde avant l'échéance), annulation possible, remboursements (en cours ou versés). Réservation d'un
 * autre compte ou inconnue : 404 « Réservation introuvable », sans indice. Sans interrupteur (voir la liste).
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await requireActiveSession(req, { allowStatuses: ['ACTIF', 'EN_ATTENTE'] });
        if (session.response) return session.response;
        const { id } = await params;
        const reservation = await clientReservation(session.user.id, id);
        if (!reservation) return notFound('Réservation introuvable.', 'RESERVATION_NOT_FOUND');
        return NextResponse.json({ success: true, reservation });
    } catch (err: unknown) {
        return apiFailure('GET /api/halls/reservations/[id]', err, { message: 'Réservation momentanément indisponible.', code: 'HALL_RESERVATION_UNAVAILABLE', status: 500 });
    }
}

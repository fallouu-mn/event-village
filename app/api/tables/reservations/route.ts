import { NextRequest, NextResponse } from 'next/server';
import { requireActiveSession } from '@/lib/auth/session';
import { clientReservations } from '@/lib/tables/queries';
import { tableFailure } from '@/lib/tables/route-helpers';

export const dynamic = 'force-dynamic';

/**
 * GET /api/tables/reservations — « Mes réservations » de tables du compte de la session.
 * Lot 11b (point 1) : états en mots, établissement, heure, table, montants figés, échéances (attente du paiement,
 * réponse de l'établissement, table gardée jusqu'à…). Sans interrupteur (décision du 20/11) : une réservation reste
 * lisible même service fermé, et le lien d'une notification ne mène jamais à une page introuvable.
 */
export async function GET(req: NextRequest) {
    try {
        const session = await requireActiveSession(req, { allowStatuses: ['ACTIF', 'EN_ATTENTE'] });
        if (session.response) return session.response;
        const reservations = await clientReservations(session.user.id);
        return NextResponse.json({ success: true, reservations }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (err: unknown) {
        return tableFailure('GET /api/tables/reservations', err, { message: 'Vos réservations sont momentanément indisponibles.', code: 'TABLE_RESERVATIONS_UNAVAILABLE', status: 500 });
    }
}

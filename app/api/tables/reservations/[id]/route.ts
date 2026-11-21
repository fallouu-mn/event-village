import { NextRequest, NextResponse } from 'next/server';
import { requireActiveSession } from '@/lib/auth/session';
import { getFeatureFlags } from '@/lib/features/flags';
import { clientReservation } from '@/lib/tables/queries';
import { notFound, tableFailure } from '@/lib/tables/route-helpers';

export const dynamic = 'force-dynamic';

/**
 * GET /api/tables/reservations/[id] — une réservation de table du compte de la session.
 * Lot 11b (point 1) : état en mots, montants figés, échéances, remboursements (en cours ou versés), actions possibles
 * (payer l'acompte si le service est ouvert et l'attente en cours, annuler, « J'arrive »). Réservation d'un autre compte
 * ou inconnue : 404 sans indice. Sans interrupteur pour la lecture (décision du 20/11).
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await requireActiveSession(req, { allowStatuses: ['ACTIF', 'EN_ATTENTE'] });
        if (session.response) return session.response;
        const { id } = await params;
        const flags = await getFeatureFlags();
        const reservation = await clientReservation(session.user.id, id, flags.tables);
        if (!reservation) return notFound('Réservation introuvable.', 'RESERVATION_NOT_FOUND');
        return NextResponse.json({ success: true, reservation }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (err: unknown) {
        return tableFailure('GET /api/tables/reservations/[id]', err, { message: 'Réservation momentanément indisponible.', code: 'TABLE_RESERVATION_UNAVAILABLE', status: 500 });
    }
}

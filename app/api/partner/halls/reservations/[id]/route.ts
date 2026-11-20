import { NextRequest, NextResponse } from 'next/server';
import { apiFailure } from '@/lib/api/public-error';
import { requireActiveSession, serverIsPartner } from '@/lib/auth/session';
import { guardFeature } from '@/lib/features/flags';
import { partnerReservation } from '@/lib/halls/queries';
import { notFound } from '@/lib/halls/route-helpers';

export const dynamic = 'force-dynamic';

/**
 * GET /api/partner/halls/reservations/[id] — détail d'une réservation d'une salle de la partenaire de la session.
 * Lot 10b (point 3) : session active, interrupteur, rôle de partenaire ; réservation d'une autre salle : 404
 * « Réservation introuvable », sans indice ; coordonnées du client seulement pour une réservation payée.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const session = await requireActiveSession(req);
        if (session.response) return session.response;
        const closed = await guardFeature('halls', 'GET /api/partner/halls/reservations/[id]');
        if (closed) return closed;
        if (!serverIsPartner(session.user)) {
            return NextResponse.json({ success: false, error: 'Espace réservé aux partenaires.', code: 'FORBIDDEN' }, { status: 403 });
        }
        const { id } = await params;
        const reservation = await partnerReservation(session.user.id, id);
        if (!reservation) return notFound('Réservation introuvable.', 'RESERVATION_NOT_FOUND');
        return NextResponse.json({ success: true, reservation });
    } catch (err: unknown) {
        return apiFailure('GET /api/partner/halls/reservations/[id]', err, { message: 'Réservation momentanément indisponible.', code: 'HALL_RESERVATION_UNAVAILABLE', status: 500 });
    }
}

import { NextRequest, NextResponse } from 'next/server';
import { apiFailure } from '@/lib/api/public-error';
import { requireActiveSession, serverIsPartner } from '@/lib/auth/session';
import { guardFeature } from '@/lib/features/flags';
import { partnerReservations, UUID_RE } from '@/lib/halls/queries';
import { badRequest, DAY_RE } from '@/lib/halls/route-helpers';

export const dynamic = 'force-dynamic';

/**
 * GET /api/partner/halls/reservations?from=AAAA-MM-JJ&to=AAAA-MM-JJ&hall=<id> — calendrier des réservations des
 * salles de la partenaire de la session (92 jours au plus).
 * Lot 10b (point 3) : session active, interrupteur, rôle de partenaire ; seules les réservations de SES salles (fiche
 * résolue depuis la session, jamais reçue) ; coordonnées du client seulement pour une réservation payée (acompte au
 * moins).
 */
export async function GET(req: NextRequest) {
    try {
        const session = await requireActiveSession(req);
        if (session.response) return session.response;
        const closed = await guardFeature('halls', 'GET /api/partner/halls/reservations');
        if (closed) return closed;
        if (!serverIsPartner(session.user)) {
            return NextResponse.json({ success: false, error: 'Espace réservé aux partenaires.', code: 'FORBIDDEN' }, { status: 403 });
        }
        const sp = req.nextUrl.searchParams;
        const today = new Date().toISOString().slice(0, 10);
        const from = sp.get('from') || today;
        const to = sp.get('to') || new Date(Date.parse(`${from}T00:00:00Z`) + 41 * 86_400_000).toISOString().slice(0, 10);
        const hall = sp.get('hall');
        if (!DAY_RE.test(from) || !DAY_RE.test(to)) return badRequest('Période non valable.', 'INVALID_DATES');
        const span = (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000;
        if (!Number.isFinite(span) || span < 0 || span > 92) return badRequest('Choisissez une période de 3 mois au plus.', 'INVALID_DATES');
        if (hall !== null && hall !== '' && !UUID_RE.test(hall)) return badRequest('Salle inconnue.', 'INVALID_FILTER');
        const reservations = await partnerReservations(session.user.id, { from, to, hallId: hall || null });
        return NextResponse.json({ success: true, from, to, reservations });
    } catch (err: unknown) {
        return apiFailure('GET /api/partner/halls/reservations', err, { message: 'Réservations momentanément indisponibles.', code: 'HALL_RESERVATIONS_UNAVAILABLE', status: 500 });
    }
}

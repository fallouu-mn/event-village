import { NextRequest, NextResponse } from 'next/server';
import { apiFailure } from '@/lib/api/public-error';
import { guardFeature } from '@/lib/features/flags';
import { hallCalendar, HallRefusal } from '@/lib/halls/queries';
import { badRequest, DAY_RE, refusalResponse } from '@/lib/halls/route-helpers';

export const dynamic = 'force-dynamic';

/**
 * GET /api/halls/[id]/calendar?from=AAAA-MM-JJ&to=AAAA-MM-JJ — calendrier des disponibilités d'une salle publique.
 * Lot 10b (point 2) : dates et heures prises (réservations qui tiennent la date, attente de paiement comprise), sur
 * 3 mois au plus ; rien sur le client. Lu en base (hall_calendar) ; salle non publique : 404.
 * Interrupteur d'abord (404 si le service est fermé).
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const closed = await guardFeature('halls', 'GET /api/halls/[id]/calendar');
        if (closed) return closed;
        const { id } = await params;
        const from = req.nextUrl.searchParams.get('from') || null;
        const to = req.nextUrl.searchParams.get('to') || null;
        if ((from !== null && !DAY_RE.test(from)) || (to !== null && !DAY_RE.test(to))) return badRequest('Période non valable.', 'INVALID_DATES');
        const calendar = await hallCalendar(id, from, to);
        return NextResponse.json({ success: true, ...calendar });
    } catch (err: unknown) {
        if (err instanceof HallRefusal) return refusalResponse(err);
        return apiFailure('GET /api/halls/[id]/calendar', err, { message: 'Calendrier momentanément indisponible.', code: 'HALL_CALENDAR_UNAVAILABLE', status: 500 });
    }
}

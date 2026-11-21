import { NextRequest, NextResponse } from 'next/server';
import { guardFeature } from '@/lib/features/flags';
import { UUID_RE, venueFloor } from '@/lib/tables/queries';
import { badRequest, intParam, notFound, tableFailure } from '@/lib/tables/route-helpers';

export const dynamic = 'force-dynamic';

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^\d{2}:\d{2}$/;

/**
 * GET /api/tables/[id]/floor?date=&time=&guests= — plan de salle public (s'il est montré par l'établissement) : tables
 * placées et zones, état de chaque table au créneau choisi (libre, prise, hors capacité). Lot 11b (point 1) : venue_floor
 * en base ; rien sur les clients. Interrupteur d'abord.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const closed = await guardFeature('tables', 'GET /api/tables/[id]/floor');
        if (closed) return closed;
        const { id } = await params;
        if (!UUID_RE.test(id)) return notFound('Cet établissement n’existe pas ou n’est plus proposé.', 'VENUE_NOT_FOUND');
        const sp = req.nextUrl.searchParams;
        const date = sp.get('date');
        const time = sp.get('time');
        const guests = intParam(sp.get('guests'));
        if ((date && !DAY.test(date)) || (time && !TIME.test(time)) || Number.isNaN(guests)) {
            return badRequest('Choisissez une date, une heure et un nombre de personnes valables.');
        }
        const floor = await venueFloor(id, { date, time, guests });
        return NextResponse.json({ success: true, ...floor }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (err: unknown) {
        return tableFailure('GET /api/tables/[id]/floor', err, { message: 'Plan de salle momentanément indisponible.', code: 'FLOOR_UNAVAILABLE', status: 500 });
    }
}

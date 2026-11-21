import { NextRequest, NextResponse } from 'next/server';
import { guardFeature } from '@/lib/features/flags';
import { UUID_RE, venueSlots } from '@/lib/tables/queries';
import { badRequest, intParam, notFound, tableFailure } from '@/lib/tables/route-helpers';

export const dynamic = 'force-dynamic';

const DAY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * GET /api/tables/[id]/slots?date=AAAA-MM-JJ&guests=&zoneId= — créneaux d'un jour en pastilles (toutes les 30 minutes
 * dans les horaires) : libre, complet, passé ; jour fermé ou fermeture exceptionnelle. Lot 11b (point 1, point 5) :
 * calculés en base (venue_slots), jamais à l'écran. Interrupteur d'abord ; aucune donnée personnelle.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    try {
        const closed = await guardFeature('tables', 'GET /api/tables/[id]/slots');
        if (closed) return closed;
        const { id } = await params;
        if (!UUID_RE.test(id)) return notFound('Cet établissement n’existe pas ou n’est plus proposé.', 'VENUE_NOT_FOUND');
        const sp = req.nextUrl.searchParams;
        const date = sp.get('date') ?? '';
        const guests = intParam(sp.get('guests'));
        const zoneId = sp.get('zoneId');
        if (!DAY.test(date) || guests === null || Number.isNaN(guests) || (zoneId && !UUID_RE.test(zoneId))) {
            return badRequest('Choisissez une date et un nombre de personnes.');
        }
        const result = await venueSlots(id, date, guests, zoneId || null);
        return NextResponse.json({ success: true, ...result }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (err: unknown) {
        return tableFailure('GET /api/tables/[id]/slots', err, { message: 'Créneaux momentanément indisponibles.', code: 'SLOTS_UNAVAILABLE', status: 500 });
    }
}

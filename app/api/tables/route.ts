import { NextRequest, NextResponse } from 'next/server';
import { guardFeature } from '@/lib/features/flags';
import { searchVenues } from '@/lib/tables/queries';
import { badRequest, intParam, tableFailure } from '@/lib/tables/route-helpers';

export const dynamic = 'force-dynamic';

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^\d{2}:\d{2}$/;

/**
 * GET /api/tables?q=&city=&kind=RESTAURANT|BAR|ESPACE&date=AAAA-MM-JJ&time=HH:MM&guests=&available=1&offset=
 * Lot 11b (point 1) : recherche publique des établissements (actifs, validés, partenaire VALIDE) ; avec une date et un
 * nombre de personnes, les créneaux libres autour de l'heure voulue, calculés en base (venue_search : horaires,
 * fermetures exceptionnelles, tables libres qui conviennent). Interrupteur d'abord (GET public, D56) ; aucune donnée
 * personnelle, aucune réservation.
 */
export async function GET(req: NextRequest) {
    try {
        const closed = await guardFeature('tables', 'GET /api/tables');
        if (closed) return closed;
        const sp = req.nextUrl.searchParams;
        const date = sp.get('date');
        const time = sp.get('time');
        const guests = intParam(sp.get('guests'));
        const offset = intParam(sp.get('offset'));
        if ((date && !DAY.test(date)) || (time && !TIME.test(time)) || Number.isNaN(guests) || Number.isNaN(offset)) {
            return badRequest('Un des filtres n’est pas valable : vérifiez la date, l’heure et le nombre de personnes.');
        }
        const result = await searchVenues({
            q: sp.get('q'), city: sp.get('city'), kind: sp.get('kind'), date: date || null, time: time || null,
            guests, available: sp.get('available') === '1', offset: offset ?? 0,
        });
        return NextResponse.json({ success: true, ...result }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (err: unknown) {
        return tableFailure('GET /api/tables', err, { message: 'Établissements momentanément indisponibles.', code: 'VENUES_UNAVAILABLE', status: 500 });
    }
}

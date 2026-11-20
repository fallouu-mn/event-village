import { NextRequest, NextResponse } from 'next/server';
import { apiFailure } from '@/lib/api/public-error';
import { guardFeature } from '@/lib/features/flags';
import { HallRefusal, searchHalls } from '@/lib/halls/queries';
import { badRequest, DAY_RE, intParam, refusalResponse } from '@/lib/halls/route-helpers';

export const dynamic = 'force-dynamic';

/**
 * GET /api/halls — recherche publique des salles.
 * Lot 10b (point 2) : lieu (texte libre `q`, ville `city`), date `date` (AAAA-MM-JJ) et durée `days` (1 à 30 jours :
 * seules les salles libres sur toute la période), invités `capacity`, prix maximum par jour `price_max`, tri `sort`
 * (« recent » par défaut, ou « price »), page `offset` / `limit` (48 au plus). Recherche faite en base (hall_search) :
 * salles actives, validées, d'une partenaire VALIDE, avec un prix ; colonnes publiques seulement (ni réservation, ni
 * client, ni contact de la partenaire).
 * Lot 7 (7.3, D11, D56) : GET public, interrupteur d'abord (404 si le service est fermé).
 */
export async function GET(req: NextRequest) {
    try {
        const closed = await guardFeature('halls', 'GET /api/halls');
        if (closed) return closed;
        const sp = req.nextUrl.searchParams;
        const date = sp.get('date')?.trim() || null;
        if (date !== null && !DAY_RE.test(date)) return badRequest('Choisissez une date valable.');
        const days = intParam(sp.get('days'));
        const capacity = intParam(sp.get('capacity'));
        const priceMax = intParam(sp.get('price_max'));
        const limit = intParam(sp.get('limit'));
        const offset = intParam(sp.get('offset'));
        for (const v of [days, capacity, priceMax, limit, offset]) {
            if (Number.isNaN(v)) return badRequest('Un des filtres n’est pas valable : vérifiez la date, le nombre d’invités et le prix.');
        }
        const result = await searchHalls({
            q: sp.get('q'),
            city: sp.get('city'),
            date,
            days,
            capacity,
            priceMax,
            sort: sp.get('sort') === 'price' ? 'price' : 'recent',
            limit: limit ?? 24,
            offset: offset ?? 0,
        });
        return NextResponse.json({ success: true, ...result });
    } catch (err: unknown) {
        if (err instanceof HallRefusal) return refusalResponse(err);
        return apiFailure('GET /api/halls', err, { message: 'Impossible de charger les salles.', code: 'HALLS_UNAVAILABLE', status: 500 });
    }
}

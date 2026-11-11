import { NextRequest, NextResponse } from 'next/server';
import { apiFailure } from '@/lib/api/public-error';
import { CATALOG_SELECT, catalogCities, formatCatalogEvent, type CatalogRow } from '@/lib/events/catalog.server';
import { eventEndAt } from '@/lib/events/event-end';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { foldText } from '@/lib/text/fold';

export const dynamic = 'force-dynamic';

function failure(err: unknown): NextResponse {
    const response = apiFailure('GET /api/events', err, {
        message: 'Impossible de charger les événements.',
        code: 'CATALOG_UNAVAILABLE',
    });
    response.headers.set('Cache-Control', 'no-store');
    return response;
}

/**
 * GET /api/events — catalogue public (accueil, explorer). Lot 5 (contrat E) :
 *  - seulement les événements PUBLIE dont la fin (event_end_at : fin renseignée, sinon début à 23:59
 *    Africa/Dakar) est à venir ; un événement en cours reste listé ;
 *  - prix « à partir de » calculé sur les catégories actives ET vendues en ligne ; sans catégorie achetable :
 *    aucun prix (price null) et « Bientôt en vente », jamais « Gratuit » ;
 *  - aucune donnée de stock ni catégorie masquée exposée.
 * Lot 9 (9.1, A28, L18, L19) : les écrans filtrent par ces paramètres. `q` (120 caractères au plus) cherche aussi la
 * ville ; `city` est normalisée, `ALL` = pas de filtre ; `cities` liste les villes à venir AVANT les filtres, pour que
 * le choix de ville reste complet quand une ville est sélectionnée.
 * Lot 9 bis (R35, R36, B59, B60) : prix « à partir de » sur les seules catégories achetables (en ligne, restantes, vente
 * ouverte) ; `saleLabel` et `endFormatted` servis par formatCatalogEvent.
 * Lot 9 bis (ex-10.0 e, B94) : `q` et `city` comparés par foldText (« thies » trouve « Thiès ») ; `cities` dédoublonnée
 * par forme pliée (catalogCities).
 */
export async function GET(req: NextRequest) {
    try {
        const supabase = getServiceRoleClient();
        const { searchParams } = new URL(req.url);
        // Lot 9 bis (ex-10.0 e, B94) : recherche et ville comparées sur leur forme pliée (accents, casse, espaces).
        const search = foldText((searchParams.get('q') ?? '').trim().slice(0, 120));
        const category = searchParams.get('category');
        const city = foldText(searchParams.get('city') ?? '');

        const { data: events, error } = await supabase
            .from('events')
            .select(CATALOG_SELECT)
            .eq('status', 'PUBLIE')
            .order('start_date', { ascending: true });

        if (error) return failure(error);

        const now = Date.now();
        const formatted = ((events ?? []) as unknown as CatalogRow[])
            .filter((evt) => eventEndAt(evt).getTime() > now)
            .map(formatCatalogEvent);
        const cities = catalogCities(formatted);

        // Filtrage en mémoire pour recherche et ville si demandés
        let results = formatted;
        if (search) {
            results = results.filter((e) => [e.title, e.venue, e.subtitle, e.city].some((field) => foldText(field).includes(search)));
        }
        if (category && category !== 'ALL') {
            results = results.filter(e => e.category === category);
        }
        if (city && city !== 'all') {
            results = results.filter((e) => foldText(e.city) === city);
        }

        return NextResponse.json({ events: results, cities }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (err: unknown) {
        return failure(err);
    }
}

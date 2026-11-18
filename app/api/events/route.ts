import { NextRequest, NextResponse } from 'next/server';
import { apiFailure } from '@/lib/api/public-error';
import { catalogCities } from '@/lib/events/catalog.server';
import { applyCatalogFilters, EXPLORE_MAX_PAGE, NO_FILTERS, parseCatalogParams, type CatalogFilterState } from '@/lib/events/catalog-filters';
import { readCatalogEvents } from '@/lib/events/catalog-read.server';

export const dynamic = 'force-dynamic';

function failure(err: unknown): NextResponse {
    const response = apiFailure('GET /api/events', err, {
        message: 'Impossible de charger les événements.',
        code: 'CATALOG_UNAVAILABLE',
    });
    response.headers.set('Cache-Control', 'no-store');
    return response;
}

/** Taille de page admise par `pageSize` (12 par défaut, comme l'Explorer). */
const PAGE_SIZE_DEFAULT = 12;
const PAGE_SIZE_MAX = 50;

/**
 * GET /api/events — catalogue public (accueil, explorer). Lot 5 (contrat E) :
 *  - seulement les événements PUBLIE dont la fin (event_end_at : fin saisie ; date de fin sans heure : ce jour à 23:59 ;
 *    sinon début + 6 h, heure de Dakar) est à venir ; un événement en cours reste listé ;
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
 * Lot 9 ter (9t.19, consigne 5, contrat D.2.3) : chaque carte porte `stock` (SOLD_OUT, LOW ou null) ; ordre : date de
 * début, puis à date égale les événements complets après ceux en vente, puis l'heure de début, puis l'identifiant. Un
 * événement complet reste listé jusqu'à sa fin. Lecture partagée : lib/events/catalog-read.server.ts.
 * Design 1b (point 5) : filtres de l'Explorer, même règle que la page (lib/events/catalog-filters.ts) —
 * `quand` (aujourdhui | weekend | semaine), `gratuit=1`, `tri=prix` ; `category` et `city` gardent leur nom (`categorie`
 * et `ville` sont aussi lus). `total` = nombre de résultats après filtres. Avec `page` (1 à 30) : seuls les résultats de
 * cette page (`pageSize`, 12 par défaut, 50 au plus), et `page`, `pageSize` dans la réponse ; sans `page` : tous les
 * résultats (écrans existants). Réponse jamais mise en cache (temps réel des écrans).
 */
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const parsed = parseCatalogParams(searchParams);
        const category = searchParams.get('category');
        const city = (searchParams.get('city') ?? '').trim();
        const filters: CatalogFilterState = {
            ...NO_FILTERS,
            ...parsed,
            categorie: category && category !== 'ALL' ? category : parsed.categorie,
            ville: city && city.toLowerCase() !== 'all' ? city : parsed.ville,
        };

        const formatted = await readCatalogEvents();
        const cities = catalogCities(formatted);
        const results = applyCatalogFilters(formatted, filters, new Date());

        const body: Record<string, unknown> = { events: results, cities, total: results.length };
        if (searchParams.get('page') !== null) {
            const sizeRaw = Number.parseInt(searchParams.get('pageSize') ?? '', 10);
            const pageSize = Number.isFinite(sizeRaw) ? Math.min(PAGE_SIZE_MAX, Math.max(1, sizeRaw)) : PAGE_SIZE_DEFAULT;
            const page = Math.min(EXPLORE_MAX_PAGE, filters.page);
            body.events = results.slice((page - 1) * pageSize, page * pageSize);
            body.page = page;
            body.pageSize = pageSize;
        }
        return NextResponse.json(body, { headers: { 'Cache-Control': 'no-store' } });
    } catch (err: unknown) {
        return failure(err);
    }
}

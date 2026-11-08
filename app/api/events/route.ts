import { NextRequest, NextResponse } from 'next/server';
import { apiFailure } from '@/lib/api/public-error';
import { CATALOG_SELECT, formatCatalogEvent, type CatalogRow } from '@/lib/events/catalog.server';
import { eventEndAt } from '@/lib/events/event-end';
import { getServiceRoleClient } from '@/lib/supabase/server';

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
 */
export async function GET(req: NextRequest) {
    try {
        const supabase = getServiceRoleClient();
        const { searchParams } = new URL(req.url);
        const search = searchParams.get('q')?.trim().slice(0, 120).toLowerCase();
        const category = searchParams.get('category');
        const city = searchParams.get('city')?.trim().toUpperCase();

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
        const cities = Array.from(new Set(formatted.map((e) => e.city))).sort((a, b) => a.localeCompare(b, 'fr'));

        // Filtrage en mémoire pour recherche et ville si demandés
        let results = formatted;
        if (search) {
            results = results.filter(e =>
                e.title.toLowerCase().includes(search) ||
                e.venue.toLowerCase().includes(search) ||
                e.subtitle.toLowerCase().includes(search) ||
                e.city.toLowerCase().includes(search)
            );
        }
        if (category && category !== 'ALL') {
            results = results.filter(e => e.category === category);
        }
        if (city && city !== 'ALL') {
            results = results.filter(e => e.city === city);
        }

        return NextResponse.json({ events: results, cities }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (err: unknown) {
        return failure(err);
    }
}

import { NextRequest, NextResponse } from 'next/server';
import { apiFailure } from '@/lib/api/public-error';
import { guardFeature } from '@/lib/features/flags';
import { needsAvailability, parsePlacesQuery, selectPlaces, type PlacesResponse } from '@/lib/lieux/carte-lieux';
import { availablePlaceIds, cachedPlaceEntries } from '@/lib/lieux/carte-lieux.server';
import { HallRefusal } from '@/lib/halls/queries';
import { TableRefusal } from '@/lib/tables/queries';

export const dynamic = 'force-dynamic';

/**
 * GET /api/lieux/carte — lot Carte B3 : salles et établissements de la carte d'Explorer. Public, lecture seule, aucune
 * session lue.
 *
 * Paramètres (lib/lieux/carte-lieux.ts, parsePlacesQuery) : `couche=salles|restaurants`, `zone=<sud>,<ouest>,<nord>,<est>`,
 * filtres de la couche (salles : `date`, `jours`, `invites` ; restaurants : `date`, `heure`, `personnes`). Paramètre
 * illisible : 400. Service de la couche fermé par son interrupteur (features.halls_enabled, features.tables_enabled) :
 * 404, comme les autres lectures publiques des services (interrupteur d'abord).
 *
 * Rend `{ places, total, truncated }` : lieux actifs, validés, d'une partenaire VALIDE, avec une position ; seulement
 * les champs de PUBLIC_PLACE_FIELDS ; pour un particulier, centre de sa zone de 300 m (`exact: false`), jamais le vrai
 * point ni l'adresse. 300 au plus. Données sous cache de 60 s (étiquette `lieux-publics`, vidée à chaque changement) ;
 * réponse sans cache (no-store) pour qu'aucun intermédiaire ne garde un lieu retiré.
 */
export async function GET(req: NextRequest) {
    const noStore = { 'Cache-Control': 'no-store' };
    const parsed = parsePlacesQuery(new URL(req.url).searchParams);
    if (!parsed.ok) {
        return NextResponse.json({ error: parsed.message, code: 'INVALID_QUERY' }, { status: 400, headers: noStore });
    }
    const q = parsed.query;
    const closed = await guardFeature(q.layer === 'salles' ? 'halls' : 'tables', 'GET /api/lieux/carte');
    if (closed) return closed;
    try {
        const [entries, available] = await Promise.all([
            cachedPlaceEntries(),
            needsAvailability(q) ? availablePlaceIds(q) : Promise.resolve(null),
        ]);
        const body: PlacesResponse = selectPlaces(entries, q, available);
        return NextResponse.json(body, { headers: noStore });
    } catch (err: unknown) {
        // Refus de la recherche (date passée, trop lointaine…) : sa phrase, déjà en français simple
        if (err instanceof HallRefusal || err instanceof TableRefusal) {
            return NextResponse.json({ error: err.publicText, code: err.code }, { status: 400, headers: noStore });
        }
        const response = apiFailure('GET /api/lieux/carte', err, {
            message: 'Impossible de charger les lieux de la carte.',
            code: 'PLACES_UNAVAILABLE',
        });
        response.headers.set('Cache-Control', 'no-store');
        return response;
    }
}

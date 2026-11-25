import { NextRequest, NextResponse } from 'next/server';
import { apiFailure } from '@/lib/api/public-error';
import { parseMapQuery, selectMapEvents } from '@/lib/events/map-data';
import { cachedMapEntries } from '@/lib/events/map-data.server';
import type { MapResponse } from '@/lib/events/map-shared';

export const dynamic = 'force-dynamic';

/**
 * GET /api/events/carte — lot Carte B (B0) : événements de la carte et du calendrier d'Explorer. Public, lecture seule,
 * aucune session lue.
 *
 * Paramètres : `zone=<sud>,<ouest>,<nord>,<est>` (sans zone : tout le Sénégal ; ramenée aux bornes du Sénégal),
 * `du=AAAA-MM-JJ&au=AAAA-MM-JJ` (calendrier : au exclu, 93 jours au plus), filtres de l'Explorer (`q`, `quand`,
 * `categorie`, `gratuit=1`, `ville`). Paramètre illisible : 400.
 *
 * Rend `{ events, total, truncated }` : seulement les événements PUBLIE, à venir ou en cours, avec une position au
 * Sénégal, chacun réduit à identifiant, titre, dates, prix d'appel, couleur et image floutée de l'affiche, mise en avant,
 * position (lib/events/map-shared.ts, PUBLIC_MAP_FIELDS) ; 300 au plus, dans l'ordre de début.
 *
 * Données sous cache de 60 s (étiquette `catalogue-public`, même invalidation que le catalogue : une suspension ou une
 * annulation retire l'événement aussitôt) ; la réponse elle-même n'est pas mise en cache (no-store), pour qu'aucun
 * intermédiaire ne garde un événement retiré.
 */
export async function GET(req: NextRequest) {
    const parsed = parseMapQuery(new URL(req.url).searchParams);
    if (!parsed.ok) {
        return NextResponse.json({ error: parsed.message, code: 'INVALID_QUERY' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
    }
    try {
        const body: MapResponse = selectMapEvents(await cachedMapEntries(), parsed.query, new Date());
        return NextResponse.json(body, { headers: { 'Cache-Control': 'no-store' } });
    } catch (err: unknown) {
        const response = apiFailure('GET /api/events/carte', err, {
            message: 'Impossible de charger la carte des événements.',
            code: 'MAP_UNAVAILABLE',
        });
        response.headers.set('Cache-Control', 'no-store');
        return response;
    }
}

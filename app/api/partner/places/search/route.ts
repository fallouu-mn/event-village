import { NextRequest, NextResponse } from 'next/server';
import { requireActiveSession, serverIsPartner } from '@/lib/auth/session';
import { getServerEnv } from '@/lib/env';
import { reserveQuota } from '@/lib/security/quota';
import { quotaRefusalResponse } from '@/lib/security/quota-http';
import {
    PLACE_ATTRIBUTION,
    PLACE_QUERY_MAX,
    PLACE_QUERY_MIN,
    PLACE_SEARCH_UNAVAILABLE,
    normalizePlaceQuery,
    searchPlaces,
} from '@/lib/places/place-search';

export const dynamic = 'force-dynamic';

/**
 * GET /api/partner/places/search?q=… — finition 2a (3) : recherche de lieu de l'étape Accès, par le serveur.
 * Session d'organisateur exigée (401 sans session, 403 pour un autre compte) ; recherche de 3 à 120 caractères (400) ;
 * quota par compte et par heure (429, PLACE_SEARCHES_PER_ACCOUNT_HOUR), compté à chaque recherche ; réponse gardée,
 * une requête par seconde au plus vers le service (lib/places/place-search.ts). Réponse : `{ results: [{ label,
 * latitude, longitude }] (5 au plus, au Sénégal), attribution }` ; service indisponible : 503 avec le texte à montrer.
 */
export async function GET(req: NextRequest) {
    const activeSession = await requireActiveSession(req);
    if (activeSession.response) return activeSession.response;
    const user = activeSession.user;
    if (!serverIsPartner(user)) {
        return NextResponse.json({ error: 'Accès réservé aux organisateurs.', code: 'FORBIDDEN' }, { status: 403 });
    }

    const query = normalizePlaceQuery(new URL(req.url).searchParams.get('q') ?? '');
    if (query.length < PLACE_QUERY_MIN) {
        return NextResponse.json({ error: 'Saisissez au moins 3 caractères pour rechercher un lieu.', code: 'QUERY_TOO_SHORT' }, { status: 400 });
    }
    if (query.length > PLACE_QUERY_MAX) {
        return NextResponse.json({ error: 'Recherche trop longue : 120 caractères au plus.', code: 'QUERY_TOO_LONG' }, { status: 400 });
    }

    const quota = await reserveQuota(
        [{ scope: 'place_search', bucket: user.id, windowSecs: 3600, max: getServerEnv().PLACE_SEARCHES_PER_ACCOUNT_HOUR }],
        'recherche de lieu',
    );
    if (!quota.allowed) {
        return quotaRefusalResponse(quota, { error: 'Trop de recherches en une heure : touchez la carte pour placer le repère.', code: 'PLACE_SEARCH_RATE_LIMITED' });
    }

    try {
        const results = await searchPlaces(query);
        return NextResponse.json({ results, attribution: PLACE_ATTRIBUTION }, { headers: { 'Cache-Control': 'no-store' } });
    } catch (err) {
        console.warn(`[places] recherche indisponible pour ${user.id} :`, err instanceof Error ? err.message : String(err));
        return NextResponse.json({ error: PLACE_SEARCH_UNAVAILABLE, code: 'PLACE_SEARCH_UNAVAILABLE', attribution: PLACE_ATTRIBUTION }, { status: 503 });
    }
}

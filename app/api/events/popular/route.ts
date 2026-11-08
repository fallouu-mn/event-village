import { NextResponse } from 'next/server';
import { apiFailure } from '@/lib/api/public-error';
import { getPopularEvents } from '@/lib/events/popular.service';

export const dynamic = 'force-dynamic';

const NO_STORE = 'no-store';

/**
 * GET /api/events/popular — « Populaires » (lot 9, 9.1, AR12). Public par le préfixe /api/events du middleware, sans
 * session ni paramètre : la réponse est la même pour tous. Cache de 60 s côté serveur (lib/events/popular.service),
 * `no-store` vers l'extérieur pour que les 60 s restent 60 s.
 */
export async function GET() {
    try {
        return NextResponse.json({ events: await getPopularEvents() }, { headers: { 'Cache-Control': NO_STORE } });
    } catch (err) {
        const response = apiFailure('GET /api/events/popular', err, {
            message: 'Populaires momentanément indisponibles.',
            code: 'POPULAR_UNAVAILABLE',
        });
        response.headers.set('Cache-Control', NO_STORE);
        return response;
    }
}

import { NextRequest, NextResponse } from 'next/server';
import { requireActiveSession } from '@/lib/auth/session';
import { favoriteCards, favoriteIds } from '@/lib/favorites/favorites.server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/favorites — favoris du compte de la session (design 1d, point 8).
 *  - sans paramètre : `{ ids }`, identifiants des favoris encore publics (cœurs des cartes et de la fiche) ;
 *  - `?cartes=1` : `{ events }`, cartes du catalogue de ces événements (page « Mes favoris »).
 * Le compte est celui de la session, jamais un paramètre : une personne ne voit jamais les favoris d'une autre.
 * Réponse personnelle : jamais mise en cache.
 */
export async function GET(req: NextRequest) {
    const active = await requireActiveSession(req);
    if (active.response) return active.response;
    const cards = new URL(req.url).searchParams.get('cartes') === '1';
    try {
        const body = cards ? { events: await favoriteCards(active.user.id) } : { ids: await favoriteIds(active.user.id) };
        return NextResponse.json(body, { headers: { 'Cache-Control': 'private, no-store' } });
    } catch (err) {
        console.error(`[favoris] lecture impossible pour ${active.user.id} :`, err instanceof Error ? err.message : String(err));
        return NextResponse.json({ error: 'Vos favoris n’ont pas pu être chargés. Réessayez.', code: 'FAVORITES_UNAVAILABLE' }, { status: 503 });
    }
}

import { NextRequest, NextResponse } from 'next/server';
import { adminSearchFeaturedCandidates } from '@/lib/events/featured.server';
import { featuredFailure, guardFeatured, NO_STORE } from '../_shared';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/a-la-une/evenements?q=… — événements publiés non terminés, pas déjà à la une, à proposer (titre ou ville
 * contenant le texte ; les plus proches d'abord ; 20 au plus). Super-administrateur seulement ; lecture, sans mot de passe redemandé.
 */
export async function GET(req: NextRequest) {
    const guard = await guardFeatured(req, { write: false });
    if (!guard.ok) return guard.response;
    try {
        const q = (req.nextUrl.searchParams.get('q') ?? '').slice(0, 100);
        const events = await adminSearchFeaturedCandidates(guard.actorId, q, 20);
        return NextResponse.json({ events }, { headers: NO_STORE });
    } catch (err) {
        return featuredFailure('GET /api/admin/a-la-une/evenements', err, { message: 'La recherche n’a pas abouti. Réessayez dans un instant.', code: 'FEATURED_SEARCH_FAILED' });
    }
}

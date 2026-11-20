import { NextRequest, NextResponse } from 'next/server';
import { cachedCatalogEvents } from '@/lib/events/catalog-cache.server';
import { readCatalogEvents } from '@/lib/events/catalog-read.server';
import { instantSearch } from '@/lib/events/instant-search';

export const dynamic = 'force-dynamic';

function isMissingIncrementalCache(err: unknown): boolean {
    return err instanceof Error && err.message.includes('incrementalCache missing');
}

/**
 * GET /api/events/search?q=… — design 1d (point 9) : recherche instantanée sur le catalogue public mis en cache 60 s
 * (aucune lecture en base par frappe), 8 résultats au plus, même règle que la recherche d'Explorer. Publique, aucune
 * donnée personnelle : réponse gardée 30 s par le navigateur.
 */
export async function GET(req: NextRequest) {
    const q = new URL(req.url).searchParams.get('q');
    try {
        let events;
        try {
            events = await cachedCatalogEvents();
        } catch (err) {
            if (!isMissingIncrementalCache(err)) throw err;
            events = await readCatalogEvents();
        }
        return NextResponse.json(instantSearch(events, q), { headers: { 'Cache-Control': 'public, max-age=30' } });
    } catch (err) {
        console.error('[recherche] catalogue illisible :', err instanceof Error ? err.message : String(err));
        return NextResponse.json({ error: 'La recherche est momentanément indisponible.', code: 'SEARCH_UNAVAILABLE' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
    }
}

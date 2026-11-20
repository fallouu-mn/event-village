import { unstable_cache } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';
import { readPublicSheet } from '@/lib/events/event-detail.server';
import { isEventId } from '@/lib/events/public-status';
import { hasSharePreview, sharePreviewData, sharePreviewVersionOf } from '@/lib/events/share-preview.server';
import { renderSharePreview } from '@/lib/og/event-preview.server';
import { getServiceRoleClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/** Durée de l'image en cache côté serveur ; la version (titre, date, prix, affiche) change l'entrée. */
const PREVIEW_CACHE_SECONDS = 3600;

/**
 * GET /api/events/[id]/apercu — design 1d (point 5) : image d'aperçu de partage (PNG 1 200 × 630) d'un événement PUBLIÉ.
 *  - Statut relu SANS cache à chaque demande : brouillon, en attente, validé, terminé sans publication, suspendu, annulé,
 *    terminé, inconnu ou identifiant illisible → 404 sans image et sans cache (`no-store`), même réponse pour tous ;
 *  - image mise en cache côté serveur (par version) et 5 minutes chez le visiteur ; jamais de donnée personnelle.
 */
function notFound(): NextResponse {
    return NextResponse.json({ error: 'Aperçu indisponible.', code: 'NOT_FOUND' }, { status: 404, headers: { 'Cache-Control': 'no-store' } });
}

async function freshStatus(id: string): Promise<'PUBLIE' | 'AUTRE' | 'PANNE'> {
    const { data, error } = await getServiceRoleClient().from('events').select('status, ended_unpublished').eq('id', id).maybeSingle();
    if (error) {
        console.error(`[aperçu] statut de ${id} illisible :`, error.message);
        return 'PANNE';
    }
    return data && data.ended_unpublished !== true && hasSharePreview(String(data.status)) ? 'PUBLIE' : 'AUTRE';
}

const cachedPreview = unstable_cache(
    async (id: string, _version: string): Promise<string> => {
        const read = await readPublicSheet(id);
        if (read.kind !== 'public') throw new Error(`fiche de ${id} indisponible (${read.kind})`);
        return (await renderSharePreview(sharePreviewData(read.event))).toString('base64');
    },
    ['apercu-partage', 'v1'],
    { revalidate: PREVIEW_CACHE_SECONDS, tags: ['apercu-partage'] },
);

function isMissingIncrementalCache(err: unknown): boolean {
    return err instanceof Error && err.message.includes('incrementalCache missing');
}

export async function GET(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
    const { id } = await props.params;
    if (!isEventId(id)) return notFound();
    const status = await freshStatus(id);
    if (status === 'PANNE') {
        return NextResponse.json({ error: 'Aperçu momentanément indisponible.', code: 'UNAVAILABLE' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
    }
    if (status !== 'PUBLIE') return notFound();
    const read = await readPublicSheet(id);
    if (read.kind !== 'public' || !hasSharePreview(read.event.status)) return notFound();

    let png: Buffer;
    try {
        try {
            png = Buffer.from(await cachedPreview(id, sharePreviewVersionOf(read.event)), 'base64');
        } catch (err) {
            if (!isMissingIncrementalCache(err)) throw err;
            png = await renderSharePreview(sharePreviewData(read.event));
        }
    } catch (err) {
        console.error(`[aperçu] image de ${id} non générée :`, err instanceof Error ? err.message : String(err));
        return NextResponse.json({ error: 'Aperçu momentanément indisponible.', code: 'UNAVAILABLE' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
    }
    return new NextResponse(new Uint8Array(png), {
        status: 200,
        headers: {
            'Content-Type': 'image/png',
            'Content-Length': String(png.length),
            'Cache-Control': 'public, max-age=300',
            'X-Content-Type-Options': 'nosniff',
        },
    });
}

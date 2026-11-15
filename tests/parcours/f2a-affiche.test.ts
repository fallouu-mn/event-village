/**
 * Finition 2a, 1b (sécurité) — affiche d'un événement.
 *  a. Dépôt : l'image est réencodée par sharp (WebP), réduite (1 600 px au plus de côté, jamais agrandie), et aucune
 *     métadonnée ne reste (EXIF, GPS compris, XMP, IPTC, profil ICC) : vérifié sur le fichier stocké.
 *  b. Enregistrement : l'affiche doit exister dans le dossier de la partenaire (stockage) ; une adresse bien formée vers
 *     un fichier absent est refusée « L’affiche n’a pas été trouvée : déposez-la de nouveau. », l'affiche ne change pas.
 *  c. Remplacement : l'ancienne affiche est effacée du stockage, sauf si un autre événement l'utilise encore.
 *  d. Tâche planifiée (events-finish) : les affiches de plus de 7 jours qu'aucun événement n'utilise sont effacées ;
 *     jamais une affiche utilisée, jamais une affiche récente.
 * Rouge avant le correctif : fichier stocké tel quel (EXIF et GPS gardés), adresse d'un fichier absent acceptée, ancienne
 * affiche jamais effacée, aucune purge.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { NextRequest } from 'next/server';
import { service } from './paiement-helpers';
import { newPartner, type TestPartner } from './finance-helpers';
import { createDraftEvent } from './cycle-helpers';
import { BASE_URL } from './helpers';
import { writeLocal } from '../helpers/db';
import { assertFinition1Invariants } from '../helpers/finition1-invariants';
import { api, show, type Reply } from '../audit/cvf1-helpers';

const BUCKET = 'public-images';
const NOT_FOUND_TEXT = 'L’affiche n’a pas été trouvée : déposez-la de nouveau.';
const MARK = 'EssaiGPS-Ngor-14.7';

let P: TestPartner;

before(async () => {
    P = await newPartner('f2a-affiche');
});

after(async () => {
    await assertFinition1Invariants('f2a-affiche');
});

async function photoWithMetadata(width: number, height: number, format: 'jpeg' | 'png' = 'jpeg'): Promise<Buffer> {
    const base = sharp({ create: { width, height, channels: 3, background: { r: 200, g: 60, b: 40 } } });
    const encoded = format === 'jpeg' ? base.jpeg({ quality: 90 }) : base.png();
    return encoded.withExif({
        IFD0: { Artist: MARK, Copyright: MARK, ImageDescription: MARK },
        IFD3: { GPSLatitudeRef: 'N', GPSLatitude: '14/1 44/1 30/1', GPSLongitudeRef: 'W', GPSLongitude: '17/1 30/1 50/1' },
    }).toBuffer();
}

async function upload(buffer: Buffer, name: string, type: string): Promise<Reply & { path?: string; url?: string }> {
    const { POST } = (await import('../../app/api/partner/upload/route')) as { POST: (req: NextRequest) => Promise<Response> };
    const form = new FormData();
    form.append('file', new File([new Uint8Array(buffer)], name, { type }));
    form.append('folder', 'events');
    const res = await POST(new NextRequest(`${BASE_URL}/api/partner/upload`, { method: 'POST', headers: { authorization: `Bearer ${P.accessToken}` }, body: form }));
    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    return { status: res.status, body, path: typeof body.filePath === 'string' ? body.filePath : undefined, url: typeof body.url === 'string' ? body.url : undefined };
}

async function stored(pathInBucket: string): Promise<Buffer | null> {
    const { data, error } = await service.storage.from(BUCKET).download(pathInBucket);
    if (error || !data) return null;
    return Buffer.from(await data.arrayBuffer());
}

async function saveImage(eventId: string, imageUrl: string): Promise<Reply> {
    return api('PUT', 'partner/events/[id]', { token: P.accessToken, path: `/api/partner/events/${eventId}`, params: { id: eventId }, body: { image_url: imageUrl } });
}

async function imageOf(eventId: string): Promise<string | null> {
    const { data } = await service.from('events').select('image_url').eq('id', eventId).single();
    return (data?.image_url as string | null) ?? null;
}

async function age(pathInBucket: string, days: number): Promise<void> {
    await writeLocal(async (c) => {
        const r = await c.query(`UPDATE storage.objects SET created_at = now() - make_interval(days => $3), updated_at = now() - make_interval(days => $3)
                                  WHERE bucket_id = $1 AND name = $2`, [BUCKET, pathInBucket, days]);
        assert.equal(r.rowCount, 1, `vieillissement de ${pathInBucket}`);
    });
}

describe('1b a. dépôt : réencodé, réduit, sans métadonnée', () => {
    test('JPEG de 3 200 × 2 000 avec EXIF et GPS : WebP de 1 600 px au plus, aucune métadonnée', async () => {
        const input = await photoWithMetadata(3200, 2000);
        const inMeta = await sharp(input).metadata();
        assert.ok(inMeta.exif, 'précondition : la photo d’essai porte des métadonnées EXIF');
        const gpsPointer = inMeta.exif.includes(Buffer.from([0x88, 0x25])) || inMeta.exif.includes(Buffer.from([0x25, 0x88]));
        assert.ok(gpsPointer, 'précondition : la photo d’essai porte un bloc GPS (balise 0x8825)');
        assert.ok(input.includes(Buffer.from(MARK)), 'précondition : la marque est lisible dans la photo d’essai');
        const r = await upload(input, 'affiche.jpg', 'image/jpeg');
        assert.equal(r.status, 200, `dépôt : ${show(r)}`);
        const out = await stored(r.path!);
        assert.ok(out, `fichier stocké introuvable : ${r.path}`);
        const meta = await sharp(out).metadata();
        console.log(`[F2A-1B] stocké : ${r.path} ${meta.format} ${meta.width}×${meta.height} exif=${Boolean(meta.exif)} xmp=${Boolean(meta.xmp)} iptc=${Boolean(meta.iptc)} icc=${Boolean(meta.icc)} ${out.length} octets`);
        assert.equal(meta.format, 'webp', 'format stocké');
        assert.ok((meta.width ?? 0) <= 1600 && (meta.height ?? 0) <= 1600, `taille ${meta.width}×${meta.height}`);
        assert.equal(meta.width, 1600, 'largeur réduite à 1 600 px');
        assert.equal(meta.exif, undefined, 'EXIF (GPS compris) gardé');
        assert.equal(meta.xmp, undefined, 'XMP gardé');
        assert.equal(meta.iptc, undefined, 'IPTC gardé');
        assert.equal(meta.icc, undefined, 'profil ICC gardé');
        assert.ok(!out.includes(Buffer.from(MARK)), 'la marque de la photo d’origine reste dans le fichier');
        assert.ok(r.path!.endsWith('.webp'), `extension : ${r.path}`);
    });

    test('petite image PNG : jamais agrandie, réencodée aussi', async () => {
        const r = await upload(await photoWithMetadata(300, 200, 'png'), 'petite.png', 'image/png');
        assert.equal(r.status, 200, `dépôt : ${show(r)}`);
        const meta = await sharp((await stored(r.path!))!).metadata();
        assert.equal(meta.format, 'webp');
        assert.equal(meta.width, 300, 'image agrandie');
        assert.equal(meta.exif, undefined, 'EXIF gardé');
    });
});

describe('1b b, c. enregistrement : fichier vérifié, ancienne affiche effacée', () => {
    test('adresse bien formée vers un fichier absent du dossier : refusée, affiche inchangée', async () => {
        const draft = await createDraftEvent(P, 'f2a-affiche-absente', [{ name: 'Standard', price: 0, total: 10 }], { startsInHours: 72 });
        const { data } = service.storage.from(BUCKET).getPublicUrl(`events/${P.partnerId}/${Date.now()}_${randomUUID().slice(0, 8)}.webp`);
        const before = await imageOf(draft.eventId);
        const r = await saveImage(draft.eventId, data.publicUrl);
        console.log(`[F2A-1B] affiche absente → ${show(r)}`);
        assert.ok(r.status >= 400 && r.status < 500, `affiche absente acceptée : ${show(r)}`);
        assert.equal(r.body.code, 'IMAGE_NOT_FOUND', show(r));
        assert.equal(r.body.error, NOT_FOUND_TEXT, show(r));
        assert.equal(await imageOf(draft.eventId), before, 'affiche changée');
    });

    test('remplacement : l’ancienne est effacée, sauf si un autre événement l’utilise', async () => {
        const ev1 = await createDraftEvent(P, 'f2a-affiche-1', [{ name: 'Standard', price: 0, total: 10 }], { startsInHours: 72 });
        const ev2 = await createDraftEvent(P, 'f2a-affiche-2', [{ name: 'Standard', price: 0, total: 10 }], { startsInHours: 72 });
        const a = await upload(await photoWithMetadata(1200, 750), 'a.jpg', 'image/jpeg');
        const b = await upload(await photoWithMetadata(1200, 750), 'b.jpg', 'image/jpeg');
        const c = await upload(await photoWithMetadata(1200, 750), 'c.jpg', 'image/jpeg');
        for (const x of [a, b, c]) assert.equal(x.status, 200, `dépôt : ${show(x)}`);
        assert.equal((await saveImage(ev1.eventId, a.url!)).status, 200, 'affiche A');
        const replaced = await saveImage(ev1.eventId, b.url!);
        assert.equal(replaced.status, 200, `remplacement par B : ${show(replaced)}`);
        assert.equal(await imageOf(ev1.eventId), b.url, 'affiche B enregistrée');
        assert.equal(await stored(a.path!), null, 'ancienne affiche A encore stockée');
        assert.ok(await stored(b.path!), 'nouvelle affiche B absente');
        // B utilisée aussi par ev2 : remplacer B sur ev1 ne l'efface pas
        const { error } = await service.from('events').update({ image_url: b.url }).eq('id', ev2.eventId);
        assert.equal(error, null, error?.message);
        assert.equal((await saveImage(ev1.eventId, c.url!)).status, 200, 'remplacement par C');
        assert.ok(await stored(b.path!), 'affiche B effacée alors qu’un autre événement l’utilise');
    });
});

describe('1b d. tâche planifiée : affiches orphelines de plus de 7 jours', () => {
    test('effacées ; jamais une affiche utilisée, jamais une affiche récente', async () => {
        const holder = await createDraftEvent(P, 'f2a-affiche-utilisee', [{ name: 'Standard', price: 0, total: 10 }], { startsInHours: 72 });
        const orphanOld = await upload(await photoWithMetadata(800, 500), 'o1.jpg', 'image/jpeg');
        const usedOld = await upload(await photoWithMetadata(800, 500), 'u1.jpg', 'image/jpeg');
        const orphanNew = await upload(await photoWithMetadata(800, 500), 'o2.jpg', 'image/jpeg');
        for (const x of [orphanOld, usedOld, orphanNew]) assert.equal(x.status, 200, `dépôt : ${show(x)}`);
        const { error } = await service.from('events').update({ image_url: usedOld.url }).eq('id', holder.eventId);
        assert.equal(error, null, error?.message);
        await age(orphanOld.path!, 8);
        await age(usedOld.path!, 8);
        await age(orphanNew.path!, 1);
        const { GET } = (await import('../../app/api/cron/events-finish/route')) as { GET: (req: NextRequest) => Promise<Response> };
        const res = await GET(new NextRequest(`${BASE_URL}/api/cron/events-finish`, { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } }));
        const body = (await res.json()) as Record<string, unknown>;
        console.log(`[F2A-1B] tâche planifiée → HTTP ${res.status} ${JSON.stringify(body).slice(0, 300)}`);
        assert.equal(res.status, 200, JSON.stringify(body));
        assert.equal(await stored(orphanOld.path!), null, 'affiche orpheline de 8 jours encore stockée');
        assert.ok(await stored(usedOld.path!), 'affiche utilisée effacée');
        assert.ok(await stored(orphanNew.path!), 'affiche récente effacée');
    });
});

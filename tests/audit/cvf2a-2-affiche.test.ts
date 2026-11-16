/**
 * Contre-vérification de la finition 2a, attaque 2 — affiche.
 *  a. Contourner le réencodage par la route de dépôt : SVG (script), HEIC, GIF, WebP animé, image polyglotte (PNG suivi
 *     d'un document HTML ; en-tête JPEG suivi d'un SVG), en-têtes trompeurs (nom et type annoncés faux), bombe de
 *     décompression (PNG de 8 000 × 8 000 en 62 Ko), image géante sous la limite, fichier vide, dossier « ../ ».
 *     Attendu : refus, ou fichier stocké WebP d'une seule image, sans métadonnée ni charge utile, dans
 *     `<dossier autorisé>/<partenaire>/`.
 *  b. Contourner la route : dépôt, remplacement, effacement directs dans le stockage avec le jeton de la partenaire ou
 *     sans jeton.
 *  c. Affiche d'avant la finition (fichier brut avec position GPS dans le dossier de la partenaire) enregistrée de
 *     nouveau comme affiche : le réencodage ne s'applique qu'au dépôt.
 *  d. image_url (création et modification) vers le dossier d'une autre partenaire, un autre dossier, un autre
 *     compartiment, une adresse externe, un chemin avec ../ (en clair et encodé), des paramètres, une casse différente,
 *     data: et javascript: ; gallery_urls par les mêmes routes.
 *  e. Effacement : une affiche remplacée, ou la purge (events-finish), ne doit jamais effacer un fichier cité (affiche,
 *     galerie, salle, produit, logo et couverture du profil), ni un fichier hors de events/.
 * Sortie brute `[CVF2A-2]`.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import zlib from 'node:zlib';
import sharp from 'sharp';
import { NextRequest } from 'next/server';
import { service } from '../parcours/paiement-helpers';
import { newPartner, type TestPartner } from '../parcours/finance-helpers';
import { createDraftEvent } from '../parcours/cycle-helpers';
import { BASE_URL } from '../parcours/helpers';
import { writeLocal } from '../helpers/db';
import { assertFinition1Invariants } from '../helpers/finition1-invariants';
import { anonClient, api, show, userClient, type Row } from './cvf1-helpers';
import { BUCKET, listFolder, putEvent, putObject, stored, uniqueName, uploadImage } from './cvf2a-helpers';

const MARK = 'CVF2A-CHARGE-UTILE';
const GPS_EXIF = {
    IFD0: { Artist: MARK, ImageDescription: MARK },
    IFD3: { GPSLatitudeRef: 'N', GPSLatitude: '14/1 44/1 30/1', GPSLongitudeRef: 'W', GPSLongitude: '17/1 30/1 50/1' },
};
const CATS = [{ name: 'Standard', price: 0, total: 10 }];

let A: TestPartner;
let B: TestPartner;

before(async () => {
    A = await newPartner('cvf2a-affiche-a');
    B = await newPartner('cvf2a-affiche-b');
});

after(async () => {
    await assertFinition1Invariants('cvf2a-2-affiche');
});

function list(lines: string[]): string {
    return lines.map((l) => `  - ${l}`).join('\n');
}

// ── Fabrication des fichiers d'essai ───────────────────────────────────────

function crc32(buf: Buffer): number {
    let crc = 0xffffffff;
    for (const byte of buf) {
        let c = (crc ^ byte) & 0xff;
        for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
        crc = (crc >>> 8) ^ c;
    }
    return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, 'latin1'), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([len, body, crc]);
}

/** PNG valide en niveaux de gris, entièrement noir : 8 000 × 8 000 tient en ~62 Ko (64 Mo une fois décompressé). */
function pngBomb(width: number, height: number): Buffer {
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(width, 0);
    ihdr.writeUInt32BE(height, 4);
    ihdr[8] = 8;
    const idat = zlib.deflateSync(Buffer.alloc((width + 1) * height), { level: 9 });
    return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), pngChunk('IHDR', ihdr), pngChunk('IDAT', idat), pngChunk('IEND', Buffer.alloc(0))]);
}

async function plain(width: number, height: number): Promise<ReturnType<typeof sharp>> {
    return sharp({ create: { width, height, channels: 3, background: { r: 180, g: 40, b: 60 } } });
}

async function animatedWebp(): Promise<Buffer> {
    const frame = (r: number, b: number) => sharp({ create: { width: 40, height: 30, channels: 3, background: { r, g: 0, b } } }).png().toBuffer();
    return sharp([await frame(255, 0), await frame(0, 255)], { join: { animated: true } }).webp({ loop: 0, delay: [100, 100] }).toBuffer();
}

const SVG = Buffer.from(`<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" onload="alert(document.domain)"><script>alert('${MARK}')</script><rect width="10" height="10"/></svg>`);
// Boîte ftyp d'un fichier HEIC (iPhone), suivie de données
const HEIC = Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from('ftypheic', 'latin1'), Buffer.from([0, 0, 0, 0]), Buffer.from('mif1heic', 'latin1'), Buffer.alloc(64, 7)]);

interface Case { label: string; bytes: () => Promise<Buffer>; name: string; type: string; folder?: string; expect: 'refused' | 'stored' }

const CASES: Case[] = [
    { label: 'SVG avec script', bytes: async () => SVG, name: 'affiche.svg', type: 'image/svg+xml', expect: 'refused' },
    { label: 'SVG annoncé PNG', bytes: async () => SVG, name: 'affiche.png', type: 'image/png', expect: 'refused' },
    { label: 'HEIC', bytes: async () => HEIC, name: 'IMG_0001.HEIC', type: 'image/heic', expect: 'refused' },
    { label: 'GIF', bytes: async () => (await plain(30, 20)).gif().toBuffer(), name: 'a.gif', type: 'image/gif', expect: 'refused' },
    { label: 'en-tête JPEG suivi d’un SVG (polyglotte)', bytes: async () => Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), SVG]), name: 'a.jpg', type: 'image/jpeg', expect: 'refused' },
    { label: 'fichier vide', bytes: async () => Buffer.alloc(0), name: 'vide.jpg', type: 'image/jpeg', expect: 'refused' },
    { label: 'bombe de décompression PNG 8 000 × 8 000', bytes: async () => pngBomb(8000, 8000), name: 'bombe.png', type: 'image/png', expect: 'refused' },
    { label: 'WebP animé (2 images)', bytes: animatedWebp, name: 'anime.webp', type: 'image/webp', expect: 'stored' },
    { label: 'PNG suivi d’un document HTML (polyglotte)', bytes: async () => Buffer.concat([await (await plain(50, 40)).png().toBuffer(), Buffer.from(`<html><script>alert(1)</script>${MARK}</html>`)]), name: 'a.html', type: 'text/html', expect: 'stored' },
    { label: 'PNG annoncé SVG (en-têtes trompeurs)', bytes: async () => (await plain(50, 40)).png().toBuffer(), name: 'a.svg', type: 'image/svg+xml', expect: 'stored' },
    { label: 'WebP avec EXIF (GPS) et XMP', bytes: async () => (await plain(60, 40)).withExif(GPS_EXIF).withXmp(`<x:xmpmeta xmlns:x="adobe:ns:meta/">${MARK}</x:xmpmeta>`).webp().toBuffer(), name: 'a.webp', type: 'image/webp', expect: 'stored' },
    { label: 'JPEG avec profil ICC et EXIF (GPS)', bytes: async () => (await plain(60, 40)).withIccProfile('p3').withExif(GPS_EXIF).jpeg().toBuffer(), name: 'a.jpg', type: 'image/jpeg', expect: 'stored' },
    { label: 'image géante sous la limite (6 000 × 6 000)', bytes: async () => (await plain(6000, 6000)).png({ compressionLevel: 9 }).toBuffer(), name: 'geante.png', type: 'image/png', expect: 'stored' },
    { label: 'dossier « ../avatars »', bytes: async () => (await plain(50, 40)).png().toBuffer(), name: 'a.png', type: 'image/png', folder: '../avatars', expect: 'stored' },
    { label: 'dossier « events/../../halls »', bytes: async () => (await plain(50, 40)).png().toBuffer(), name: 'a.png', type: 'image/png', folder: 'events/../../halls', expect: 'stored' },
];

describe('a. dépôt par la route : rien ne contourne le réencodage', () => {
    test('chaque fichier piégé : refusé, ou stocké WebP d’une seule image, sans métadonnée ni charge utile, au bon endroit', async () => {
        const breaches: string[] = [];
        for (const c of CASES) {
            const before = await listFolder(`events/${A.partnerId}`);
            const t0 = Date.now();
            const r = await uploadImage(A.accessToken, await c.bytes(), c.name, c.type, c.folder ?? 'events');
            const ms = Date.now() - t0;
            if (c.expect === 'refused') {
                const after = await listFolder(`events/${A.partnerId}`);
                console.log(`[CVF2A-2] ${c.label} → ${show(r).slice(0, 200)} (${ms} ms) ; fichiers ${before.length} → ${after.length}`);
                if (r.status < 400) breaches.push(`${c.label} accepté : ${show(r).slice(0, 200)}`);
                if (after.length !== before.length) breaches.push(`${c.label} : un fichier a été stocké malgré le refus`);
                continue;
            }
            if (r.status !== 200 || !r.path) {
                console.log(`[CVF2A-2] ${c.label} → ${show(r).slice(0, 200)} (${ms} ms) : refusé`);
                continue;
            }
            const out = await stored(r.path);
            assert.ok(out, `${c.label} : fichier stocké introuvable (${r.path})`);
            const meta = await sharp(out, { pages: -1 }).metadata();
            const { data: objs } = await service.storage.from(BUCKET).list(r.path.slice(0, r.path.lastIndexOf('/')), { search: r.path.slice(r.path.lastIndexOf('/') + 1) });
            const mime = (objs?.[0]?.metadata as Row | undefined)?.mimetype;
            const line = `${c.label} → ${r.path} ${meta.format} ${meta.width}×${meta.height} pages=${meta.pages ?? 1} exif=${Boolean(meta.exif)} xmp=${Boolean(meta.xmp)} icc=${Boolean(meta.icc)} type=${String(mime)} (${ms} ms)`;
            console.log(`[CVF2A-2] ${line}`);
            const head = out.subarray(0, 12).toString('latin1');
            const allowedPrefix = c.folder ? `misc/${A.partnerId}/` : `events/${A.partnerId}/`;
            if (!(head.startsWith('RIFF') && head.endsWith('WEBP')) || meta.format !== 'webp') breaches.push(`${line} : pas un WebP`);
            if ((meta.pages ?? 1) > 1) breaches.push(`${line} : plusieurs images (animation gardée)`);
            if (meta.exif || meta.xmp || meta.iptc || meta.icc) breaches.push(`${line} : métadonnées gardées`);
            if (out.includes(Buffer.from(MARK)) || out.includes(Buffer.from('<script'))) breaches.push(`${line} : charge utile gardée`);
            if ((meta.width ?? 0) > 1600 || (meta.height ?? 0) > 1600) breaches.push(`${line} : plus de 1 600 px`);
            if (!r.path.startsWith(allowedPrefix) || r.path.includes('..') || !r.path.endsWith('.webp')) breaches.push(`${line} : rangé hors de ${allowedPrefix}`);
            if (mime !== undefined && mime !== 'image/webp') breaches.push(`${line} : type servi ${String(mime)}`);
        }
        assert.deepEqual(breaches, [], `réencodage contourné :\n${list(breaches)}`);
    });
});

describe('b. stockage sans passer par la route', () => {
    test('dépôt, remplacement et effacement directs (jeton de la partenaire, puis sans jeton) : refusés', async () => {
        const kept = await putObject(`events/${A.partnerId}/${uniqueName('webp')}`, await (await plain(40, 30)).webp().toBuffer(), 'image/webp');
        const keptPath = kept.slice(kept.indexOf(`events/${A.partnerId}/`));
        const breaches: string[] = [];
        for (const [who, client] of [['partenaire', userClient(A.accessToken)], ['sans jeton', anonClient()]] as const) {
            const storage = client.storage.from(BUCKET);
            for (const [what, target, bytes, type] of [
                ['SVG dans son dossier', `events/${A.partnerId}/${uniqueName('svg')}`, SVG, 'image/svg+xml'],
                ['JPEG avec GPS dans son dossier', `events/${A.partnerId}/${uniqueName('jpg')}`, await (await plain(40, 30)).withExif(GPS_EXIF).jpeg().toBuffer(), 'image/jpeg'],
                ['WebP dans le dossier de B', `events/${B.partnerId}/${uniqueName('webp')}`, await (await plain(40, 30)).webp().toBuffer(), 'image/webp'],
            ] as const) {
                const up = await storage.upload(target, bytes, { contentType: type, upsert: false });
                console.log(`[CVF2A-2] stockage (${who}) : ${what} → ${up.error ? `refus ${up.error.message}` : JSON.stringify(up.data)}`);
                if (!up.error) breaches.push(`${who} : ${what} déposé (${target})`);
            }
            const over = await storage.upload(keptPath, SVG, { contentType: 'image/svg+xml', upsert: true });
            console.log(`[CVF2A-2] stockage (${who}) : remplacement d'une affiche → ${over.error ? `refus ${over.error.message}` : JSON.stringify(over.data)}`);
            if (!over.error) breaches.push(`${who} : affiche remplacée par un SVG`);
            const rm = await storage.remove([keptPath]);
            console.log(`[CVF2A-2] stockage (${who}) : effacement d'une affiche → ${rm.error ? `refus ${rm.error.message}` : JSON.stringify(rm.data)}`);
        }
        const still = await stored(keptPath);
        if (!still) breaches.push('affiche effacée sans passer par la route');
        else if (still.includes(Buffer.from('<svg'))) breaches.push('affiche remplacée par un SVG');
        assert.deepEqual(breaches, [], list(breaches));
    });
});

describe('c. affiche d’avant la finition', () => {
    test('fichier brut avec position GPS déjà dans son dossier, enregistré comme affiche : jamais servi tel quel', async () => {
        const legacy = `events/${A.partnerId}/${Date.now()}_avant.jpg`;
        const raw = await (await plain(400, 250)).withExif(GPS_EXIF).jpeg().toBuffer();
        const url = await putObject(legacy, raw, 'image/jpeg');
        const draft = await createDraftEvent(A, 'cvf2a-affiche-ancienne', CATS, { startsInHours: 72 });
        const r = await putEvent(A.accessToken, draft.eventId, { image_url: url });
        console.log(`[CVF2A-2] affiche d'avant la finition (JPEG brut, GPS) enregistrée → ${show(r).slice(0, 200)}`);
        const { data: ev } = await service.from('events').select('image_url').eq('id', draft.eventId).single();
        const served = ev?.image_url === url ? await stored(legacy) : null;
        const meta = served ? await sharp(served).metadata() : null;
        console.log(`[CVF2A-2] affiche de l'événement : ${String(ev?.image_url)} ; fichier servi : ${meta ? `${meta.format} exif=${Boolean(meta.exif)}` : 'aucun'}`);
        assert.ok(!(served && meta?.exif), `affiche servie avec ses métadonnées (GPS) : ${url} accepté (${show(r).slice(0, 160)})`);
    });
});

describe('d. image_url et gallery_urls : uniquement un fichier déposé dans son dossier', () => {
    test('création et modification : dossier d’autrui, autre dossier, autre compartiment, externe, ../, paramètres, casse, data:, javascript: refusés', async () => {
        const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/+$/, '');
        const pub = `${base}/storage/v1/object/public`;
        const bPoster = await uploadImage(B.accessToken, await (await plain(80, 50)).png().toBuffer(), 'b.png', 'image/png');
        assert.equal(bPoster.status, 200, `affiche de B (montage) : ${show(bPoster)}`);
        const bName = bPoster.path!.slice(bPoster.path!.lastIndexOf('/') + 1);
        const own = await uploadImage(A.accessToken, await (await plain(80, 50)).png().toBuffer(), 'a.png', 'image/png');
        assert.equal(own.status, 200, `affiche de A (montage) : ${show(own)}`);
        const ownName = own.path!.slice(own.path!.lastIndexOf('/') + 1);
        const hall = await uploadImage(A.accessToken, await (await plain(80, 50)).png().toBuffer(), 'h.png', 'image/png', 'halls');
        assert.equal(hall.status, 200, `image de salle de A (montage) : ${show(hall)}`);
        const urls: Array<[string, string]> = [
            ['affiche de B', bPoster.url!],
            ['image de salle de A (dossier halls)', hall.url!],
            ['autre compartiment (avatars)', `${pub}/avatars/${A.partnerId}/${ownName}`],
            ['adresse externe au même chemin', `https://evil.example/storage/v1/object/public/${BUCKET}/events/${A.partnerId}/${ownName}`],
            ['../ en clair vers B', `${pub}/${BUCKET}/events/${A.partnerId}/../${B.partnerId}/${bName}`],
            ['../ encodé vers B', `${pub}/${BUCKET}/events/${A.partnerId}/..%2F${B.partnerId}%2F${bName}`],
            ['%2e%2e encodé vers B', `${pub}/${BUCKET}/events/${A.partnerId}/%2e%2e/${B.partnerId}/${bName}`],
            ['paramètre après le nom', `${own.url!}?download=1`],
            ['fragment après le nom', `${own.url!}#x`],
            ['identifiant de la partenaire en majuscules', `${pub}/${BUCKET}/events/${A.partnerId.toUpperCase()}/${ownName}`],
            ['data:', `data:image/svg+xml;base64,${SVG.toString('base64')}`],
            ['javascript:', 'javascript:alert(1)'],
        ];
        const draft = await createDraftEvent(A, 'cvf2a-affiche-url', CATS, { startsInHours: 72 });
        const { data: start } = await service.from('events').select('image_url').eq('id', draft.eventId).single();
        const newEvent = (title: string, extra: Row) => api('POST', 'partner/events', {
            token: A.accessToken, body: {
                title, category: 'CONCERT', start_date: new Date(Date.now() + 10 * 86_400_000).toISOString().slice(0, 10), start_time: '20:00',
                location: 'Salle de test', city: 'Dakar', latitude: 14.6928, longitude: -17.4467, ...extra,
            },
        });
        // Témoin : la même création, avec une affiche déposée dans son dossier, est acceptée (le refus vient bien de l'adresse)
        const witness = await newEvent('Affiche témoin', { image_url: own.url });
        console.log(`[CVF2A-2] POST events (témoin, affiche de son dossier) → ${show(witness).slice(0, 180)}`);
        assert.ok(witness.status >= 200 && witness.status < 300, `précondition : création avec sa propre affiche acceptée (${show(witness)})`);
        const breaches: string[] = [];
        for (const [what, url] of urls) {
            const put = await putEvent(A.accessToken, draft.eventId, { image_url: url });
            console.log(`[CVF2A-2] PUT image_url ${what} → ${show(put).slice(0, 180)}`);
            if (put.status < 400) breaches.push(`PUT ${what} accepté : ${show(put).slice(0, 160)}`);
            const created = await newEvent(`Affiche ${what}`.slice(0, 80), { image_url: url });
            console.log(`[CVF2A-2] POST events image_url ${what} → ${show(created).slice(0, 180)}`);
            if (created.status < 400) breaches.push(`POST ${what} accepté : ${show(created).slice(0, 160)}`);
        }
        const gPut = await putEvent(A.accessToken, draft.eventId, { gallery_urls: [bPoster.url!] });
        console.log(`[CVF2A-2] PUT gallery_urls → ${show(gPut).slice(0, 180)}`);
        if (gPut.status < 400) breaches.push(`PUT gallery_urls accepté : ${show(gPut).slice(0, 160)}`);
        const gPost = await newEvent('Galerie', { image_url: own.url, gallery_urls: [bPoster.url!, `${pub}/avatars/x/y.png`] });
        console.log(`[CVF2A-2] POST events gallery_urls → ${show(gPost).slice(0, 180)}`);
        if (gPost.status < 400) breaches.push(`POST gallery_urls accepté : ${show(gPost).slice(0, 160)}`);
        const { data: end } = await service.from('events').select('image_url, gallery_urls').eq('id', draft.eventId).single();
        const { data: foreign } = await service.from('events').select('id, image_url, gallery_urls').eq('partner_id', A.partnerId);
        const citing = (foreign ?? []).filter((e) => JSON.stringify([e.image_url, e.gallery_urls]).includes(B.partnerId) || JSON.stringify([e.image_url, e.gallery_urls]).includes('evil.example'));
        assert.deepEqual(breaches, [], `adresse d'affiche acceptée :\n${list(breaches)}`);
        assert.equal(end?.image_url, start?.image_url, 'affiche du brouillon changée');
        assert.deepEqual(citing, [], `événements de A citant un fichier de B ou externe : ${JSON.stringify(citing)}`);
    });
});

async function age(pathInBucket: string, days: number): Promise<void> {
    await writeLocal(async (c) => {
        const r = await c.query(`UPDATE storage.objects SET created_at = now() - make_interval(days => $3), updated_at = now() - make_interval(days => $3)
                                  WHERE bucket_id = $1 AND name = $2`, [BUCKET, pathInBucket, days]);
        assert.equal(r.rowCount, 1, `vieillissement de ${pathInBucket}`);
    });
}

async function runPurge(): Promise<Row> {
    const { GET } = (await import('../../app/api/cron/events-finish/route')) as { GET: (req: NextRequest) => Promise<Response> };
    const res = await GET(new NextRequest(`${BASE_URL}/api/cron/events-finish`, { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } }));
    const body = (await res.json()) as Row;
    console.log(`[CVF2A-2] tâche planifiée events-finish → HTTP ${res.status} ${JSON.stringify(body).slice(0, 300)}`);
    assert.equal(res.status, 200, JSON.stringify(body));
    return body;
}

describe('e. effacement : jamais un fichier cité, jamais hors de events/', () => {
    test('affiche remplacée encore citée par une salle, un produit ou le profil : gardée', async () => {
        const P = await newPartner('cvf2a-affiche-remplacee');
        const draft = await createDraftEvent(P, 'cvf2a-affiche-remplacee', CATS, { startsInHours: 72 });
        const breaches: string[] = [];
        for (const where of ['salle', 'produit', 'logo du profil'] as const) {
            const x = await uploadImage(P.accessToken, await (await plain(80, 50)).png().toBuffer(), 'x.png', 'image/png');
            const y = await uploadImage(P.accessToken, await (await plain(80, 50)).png().toBuffer(), 'y.png', 'image/png');
            assert.ok(x.status === 200 && y.status === 200, `dépôts (montage) : ${show(x)} ${show(y)}`);
            assert.equal((await putEvent(P.accessToken, draft.eventId, { image_url: x.url })).status, 200, `affiche X (montage, ${where})`);
            if (where === 'salle') {
                const { error } = await service.from('halls').insert({ partner_id: P.partnerId, name: `Salle ${Date.now()}`, capacity: 100, images: [x.url] });
                assert.equal(error, null, `salle (montage) : ${error?.message}`);
            } else if (where === 'produit') {
                const { error } = await service.from('products').insert({ partner_id: P.partnerId, name: `Produit ${Date.now()}`, price: 1000, images: [x.url] });
                assert.equal(error, null, `produit (montage) : ${error?.message}`);
            } else {
                // Correctifs de la contre-vérification (T6), décision de l'utilisateur : le profil refuse désormais une adresse du
                // dossier events/ ; la donnée ancienne est posée directement en base, comme la salle et le produit ci-dessus.
                // Seul le montage change : l'attaque (affiche remplacée encore citée, gardée) est vérifiée comme avant.
                const { error } = await service.from('partners').update({ logo_url: x.url }).eq('id', P.partnerId);
                assert.equal(error, null, `logo du profil (montage) : ${error?.message}`);
            }
            const replaced = await putEvent(P.accessToken, draft.eventId, { image_url: y.url });
            assert.equal(replaced.status, 200, `remplacement par Y (${where}) : ${show(replaced)}`);
            const still = await stored(x.path!);
            console.log(`[CVF2A-2] affiche X remplacée, encore citée par ${where} → ${still ? 'gardée' : 'EFFACÉE'}`);
            if (!still) breaches.push(`affiche remplacée effacée alors que ${where} la cite (${x.path})`);
        }
        assert.deepEqual(breaches, [], list(breaches));
    });

    test('purge : fichiers de plus de 7 jours cités (affiche, galerie, salle, produit, logo, couverture) gardés ; hors de events/ jamais touchés', async () => {
        const P = await newPartner('cvf2a-purge');
        const other = await newPartner('cvf2a-purge-autre');
        const img = async () => (await plain(60, 40)).webp().toBuffer();
        const files: Record<string, string> = {};
        for (const k of ['affiche', 'galerie', 'salle', 'produit', 'logo', 'couverture', 'orpheline']) {
            files[k] = `events/${P.partnerId}/${uniqueName('webp')}`;
            await putObject(files[k], await img(), 'image/webp');
        }
        const outside: Record<string, string> = {
            'halls/<P>': `halls/${P.partnerId}/${uniqueName('webp')}`,
            'products/<P>': `products/${P.partnerId}/${uniqueName('webp')}`,
            'misc/<P>': `misc/${P.partnerId}/${uniqueName('webp')}`,
            'events/ (racine)': `events/cvf2a-racine-${randomUUID().slice(0, 8)}.webp`,
            'events/<P>/sous-dossier': `events/${P.partnerId}/sous/${uniqueName('webp')}`,
        };
        for (const p of Object.values(outside)) await putObject(p, await img(), 'image/webp');
        const url = (p: string) => service.storage.from(BUCKET).getPublicUrl(p).data.publicUrl;
        await createDraftEvent(P, 'cvf2a-purge-affiche', CATS, { startsInHours: 72, imageUrl: url(files.affiche) });
        const d2 = await createDraftEvent(other, 'cvf2a-purge-galerie', CATS, { startsInHours: 72 });
        const { error: gErr } = await service.from('events').update({ gallery_urls: [url(files.galerie)] }).eq('id', d2.eventId);
        assert.equal(gErr, null, `galerie (montage) : ${gErr?.message}`);
        const { error: hErr } = await service.from('halls').insert({ partner_id: P.partnerId, name: `Salle purge ${Date.now()}`, capacity: 50, images: [url(files.salle)] });
        assert.equal(hErr, null, `salle (montage) : ${hErr?.message}`);
        const { error: prErr } = await service.from('products').insert({ partner_id: P.partnerId, name: `Produit purge ${Date.now()}`, price: 500, images: [url(files.produit)] });
        assert.equal(prErr, null, `produit (montage) : ${prErr?.message}`);
        // Correctifs de la contre-vérification (T6), décision de l'utilisateur : le profil refuse désormais une adresse du dossier
        // events/ ; logo et couverture anciens posés directement en base, comme la salle et le produit (montage seulement)
        const { error: profErr } = await service.from('partners').update({ logo_url: url(files.logo), cover_url: url(files.couverture) }).eq('id', P.partnerId);
        assert.equal(profErr, null, `logo et couverture (montage) : ${profErr?.message}`);
        for (const p of [...Object.values(files), ...Object.values(outside)]) await age(p, 8);
        await runPurge();
        const report: string[] = [];
        const breaches: string[] = [];
        for (const [k, p] of Object.entries(files)) {
            const kept = Boolean(await stored(p));
            report.push(`${k}=${kept ? 'gardé' : 'effacé'}`);
            if (k === 'orpheline' && kept) breaches.push('précondition : l’orpheline de 8 jours n’a pas été effacée (la purge n’a pas tourné)');
            if (k !== 'orpheline' && !kept) breaches.push(`fichier cité (${k}) effacé par la purge : ${p}`);
        }
        for (const [k, p] of Object.entries(outside)) {
            const kept = Boolean(await stored(p));
            report.push(`${k}=${kept ? 'gardé' : 'effacé'}`);
            if (!kept) breaches.push(`fichier hors des affiches (${k}) effacé par la purge : ${p}`);
        }
        console.log(`[CVF2A-2] après la purge : ${report.join(' ; ')}`);
        assert.deepEqual(breaches, [], `purge des affiches :\n${list(breaches)}`);
    });
});


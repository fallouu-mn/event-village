/**
 * Lot 9, tâche 9.2, complément photo (contrat 4.3, 5.3 ; L34 à L36 ; AR3 ; D-cpt 4) — POST et DELETE /api/account/avatar.
 *  - JPEG, PNG, WebP, 2 Mo au plus, type lu dans le contenu ; sortie WebP carrée de 256 px, orientation appliquée, sans
 *    EXIF, XMP ni position GPS (image d'entrée fabriquée avec une vraie balise GPS, relue avant le passage) ;
 *  - chemin <user_id>/<uuid>.webp, le nom du fichier envoyé n'est jamais réutilisé ;
 *  - Content-Length absent ou trop grand refusé avant la lecture du corps ; limitInputPixels ;
 *  - remplacement : l'ancienne photo est supprimée ; suppression ; panne de la RPC : le nouvel objet est retiré ;
 *  - décisif (D-cpt C6) : une avatar_url forgée vers l'objet de B ne fait jamais supprimer l'objet de B, ni par POST ni
 *    par DELETE de A (le service_role passe outre les politiques : seul le motif du chemin protège).
 * Les accès directs à l'API Storage (clé anon et jeton authenticated) sont dans tests/security/r27-avatars.test.ts.
 *
 * Rouge avant correctif : la route app/api/account/avatar, le bucket avatars, la RPC account_avatar_set et
 * lib/images/sniff.ts n'existent pas (import dynamique, l'échec les nomme) ; après les tests, assertLot9Invariants reste
 * rouge tant que M2 et M4 ne sont pas livrés. Aucun cas de cette suite n'est vert aujourd'hui, hors les deux du middleware,
 * signalés.
 *
 * La suite laisse la base conforme à (v1) (v2) (v3) : les URL forgées sont remplacées, les objets orphelins retirés.
 */
import '../helpers/env';
import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { NextRequest } from 'next/server';
import sharp from 'sharp';
import { assertLot9Invariants } from '../helpers/lot9-invariants';
import { callMiddleware, sessionCookies } from '../helpers/middleware';
import { BASE_URL, STRONG_PASSWORD } from './helpers';
import { withEnv } from './notif-helpers';
import { importModule, newBuyer, service, type Buyer } from './paiement-helpers';
import { gotrueEmail } from '../helpers/gotrue-email';

after(async () => {
    await assertLot9Invariants('compte-photo');
});

const AVATAR_PATH = '/api/account/avatar';
const BUCKET = 'avatars';
const MAX_BYTES = 2_097_152;
const MARK = 'EVREPEREGPS42';
const SENTINEL = 'SENTINELLE_PHOTO';
const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';

interface Reply { status: number; body: Record<string, unknown>; text: string; headers: Headers }

async function reply(res: Response): Promise<Reply> {
    const text = await res.text();
    let body: Record<string, unknown> = {};
    try {
        body = text ? JSON.parse(text) as Record<string, unknown> : {};
    } catch (err) {
        assert.fail(`réponse non JSON (${err instanceof Error ? err.message : String(err)}) : ${text.slice(0, 200)}`);
    }
    return { status: res.status, body, text, headers: res.headers };
}

type Handler = (req: NextRequest) => Promise<Response>;

async function avatarRoute(): Promise<{ POST: Handler; DELETE: Handler }> {
    const mod = await importModule('../../app/api/account/avatar/route');
    assert.equal(typeof mod.POST, 'function', 'app/api/account/avatar/route doit exporter POST (contrat 4.3)');
    assert.equal(typeof mod.DELETE, 'function', 'app/api/account/avatar/route doit exporter DELETE (contrat 4.3)');
    return mod;
}

interface UploadOptions {
    name?: string;
    mime?: string;
    fields?: Record<string, string>;
    /** undefined : taille réelle du corps ; null : en-tête absent. */
    contentLength?: number | null;
}

async function uploadRequest(token: string | null, content: Buffer, opts: UploadOptions = {}): Promise<NextRequest> {
    const form = new FormData();
    for (const [key, value] of Object.entries(opts.fields ?? {})) form.append(key, value);
    form.append('file', new File([new Uint8Array(content)], opts.name ?? 'portrait.jpg', { type: opts.mime ?? 'image/jpeg' }));
    const encoded = new Response(form);
    const bytes = new Uint8Array(await encoded.arrayBuffer());
    const headers: Record<string, string> = { 'content-type': encoded.headers.get('content-type') ?? '' };
    if (token) headers.authorization = `Bearer ${token}`;
    const length = opts.contentLength === undefined ? bytes.length : opts.contentLength;
    if (length !== null) headers['content-length'] = String(length);
    return new NextRequest(`${BASE_URL}${AVATAR_PATH}`, { method: 'POST', headers, body: bytes });
}

async function post(user: Buyer, content: Buffer, opts: UploadOptions = {}): Promise<Reply> {
    return reply(await (await avatarRoute()).POST(await uploadRequest(user.accessToken, content, opts)));
}

async function remove(user: Buyer): Promise<Reply> {
    const req = new NextRequest(`${BASE_URL}${AVATAR_PATH}`, { method: 'DELETE', headers: { authorization: `Bearer ${user.accessToken}` } });
    return reply(await (await avatarRoute()).DELETE(req));
}

async function avatarUrlOf(userId: string): Promise<string | null> {
    const { data, error } = await service.from('users').select('avatar_url').eq('id', userId).single();
    assert.equal(error, null, `users.avatar_url : ${error?.message}`);
    return (data as { avatar_url: string | null }).avatar_url;
}

async function setAvatarUrl(userId: string, url: string | null): Promise<void> {
    const { error } = await service.from('users').update({ avatar_url: url }).eq('id', userId);
    assert.equal(error, null, `pose de avatar_url : ${error?.message}`);
}

async function objectsOf(userId: string): Promise<string[]> {
    const { data, error } = await service.storage.from(BUCKET).list(userId, { limit: 100 });
    assert.equal(error, null, `liste du dossier ${userId} : ${error?.message}`);
    return (data ?? []).map((o) => `${userId}/${o.name}`);
}

async function download(objectPath: string): Promise<Buffer> {
    const { data, error } = await service.storage.from(BUCKET).download(objectPath);
    assert.equal(error, null, `téléchargement de ${objectPath} : ${error?.message}`);
    return Buffer.from(await data!.arrayBuffer());
}

function objectPathOf(url: unknown): string {
    const marker = `/storage/v1/object/public/${BUCKET}/`;
    const href = String(url);
    const at = href.indexOf(marker);
    assert.ok(at > 0, `URL publique du bucket attendue : ${href}`);
    return href.slice(at + marker.length);
}

function publicUrl(objectPath: string): string {
    return service.storage.from(BUCKET).getPublicUrl(objectPath).data.publicUrl;
}

/** Retire les objets restés dans le dossier (règles v2 et v3 sur toute la base). */
async function clearFolder(userId: string): Promise<void> {
    const objects = await objectsOf(userId);
    if (objects.length === 0) return;
    const { error } = await service.storage.from(BUCKET).remove(objects);
    assert.equal(error, null, `nettoyage du dossier ${userId} : ${error?.message}`);
}

// ── Images de test ─────────────────────────────────────────────────────────

const EXIF_WITH_GPS = {
    IFD0: { Copyright: MARK, ImageDescription: MARK },
    IFD3: { GPSLatitudeRef: 'N', GPSLatitude: '14/1 41/1 2/1', GPSLongitudeRef: 'W', GPSLongitude: '17/1 26/1 49/1', GPSMapDatum: MARK },
};

function canvas(width = 400, height = 300): sharp.Sharp {
    return sharp({ create: { width, height, channels: 3, background: { r: 200, g: 30, b: 30 } } });
}

const jpeg = (width?: number, height?: number): Promise<Buffer> => canvas(width, height).jpeg().toBuffer();
const png = (width?: number, height?: number): Promise<Buffer> => canvas(width, height).png().toBuffer();
const webp = (width?: number, height?: number): Promise<Buffer> => canvas(width, height).webp().toBuffer();

/** Latitude GPS lue dans un bloc EXIF (TIFF, avec ou sans en-tête « Exif ») : relecture indépendante de sharp. */
function gpsLatitude(exif: Buffer): number[] | null {
    const start = exif.subarray(0, 6).toString('latin1') === 'Exif\0\0' ? 6 : 0;
    const littleEndian = exif.subarray(start, start + 2).toString('latin1') === 'II';
    const u16 = (o: number): number => (littleEndian ? exif.readUInt16LE(start + o) : exif.readUInt16BE(start + o));
    const u32 = (o: number): number => (littleEndian ? exif.readUInt32LE(start + o) : exif.readUInt32BE(start + o));
    const entries = (ifd: number): number[] => Array.from({ length: u16(ifd) }, (_, i) => ifd + 2 + i * 12);
    const pointer = entries(u32(4)).find((e) => u16(e) === 0x8825);
    if (pointer === undefined) return null;
    const latitude = entries(u32(pointer + 8)).find((e) => u16(e) === 0x0002);
    if (latitude === undefined) return null;
    const value = u32(latitude + 8);
    return [0, 1, 2].map((i) => u32(value + i * 8) / u32(value + i * 8 + 4));
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
});

function crc32(data: Buffer): number {
    let c = 0xffffffff;
    data.forEach((b) => { c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8); });
    return (c ^ 0xffffffff) >>> 0;
}

/** Vrai PNG d'exactement `size` octets : bloc privé de remplissage avant IEND. */
async function pngOfExactSize(size: number): Promise<Buffer> {
    const base = await png(64, 64);
    const iend = base.length - 12;
    const data = Buffer.alloc(size - base.length - 12, 0x41);
    const type = Buffer.from('evPd', 'latin1');
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(Buffer.concat([type, data])));
    const out = Buffer.concat([base.subarray(0, iend), length, type, data, crc, base.subarray(iend)]);
    assert.equal(out.length, size, 'précondition : taille exacte du fichier');
    return out;
}

// ── Pannes et écoute des appels sortants ───────────────────────────────────

interface Rule { name: string; match: (url: URL, method: string) => boolean; pass?: boolean }

function fault(): Response {
    return new Response(JSON.stringify({ message: `relation "x" ${SENTINEL}`, code: '42P01', statusCode: '500', error: SENTINEL }), {
        status: 500,
        headers: { 'content-type': 'application/json' },
    });
}

const avatarRpc: Rule['match'] = (url, method) => method === 'POST' && url.pathname === '/rest/v1/rpc/account_avatar_set';
const storageUpload: Rule['match'] = (url, method) => method === 'POST' && url.pathname.startsWith(`/storage/v1/object/${BUCKET}/`);
const storageRemove: Rule['match'] = (url, method) => method === 'DELETE' && url.pathname === `/storage/v1/object/${BUCKET}`;

async function intercept<T>(rules: Rule[], fn: () => Promise<T>): Promise<{ result: T; hits: Record<string, number>; logged: string[] }> {
    const previousFetch = globalThis.fetch;
    const previousError = console.error;
    const logged: string[] = [];
    const hits: Record<string, number> = Object.fromEntries(rules.map((r) => [r.name, 0]));
    globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
        const href = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
        const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
        const url = new URL(href);
        const rule = rules.find((r) => r.match(url, method));
        if (!rule) return previousFetch(input, init);
        hits[rule.name] += 1;
        return rule.pass ? previousFetch(input, init) : fault();
    }) as typeof fetch;
    console.error = (...args: unknown[]): void => {
        logged.push(args.map((a) => (a instanceof Error ? a.message : typeof a === 'string' ? a : JSON.stringify(a))).join(' '));
    };
    try {
        return { result: await fn(), hits, logged };
    } finally {
        globalThis.fetch = previousFetch;
        console.error = previousError;
    }
}

function assertRefused(r: Reply, status: number, code: string, what: string): void {
    assert.equal(r.status, status, `${what} : ${r.text.slice(0, 300)}`);
    assert.equal(r.body.code, code, `${what} : ${r.text.slice(0, 300)}`);
    assert.equal(typeof r.body.error, 'string', `${what} : message absent`);
    assert.equal(r.text.includes(SENTINEL), false, `${what} : texte de la base renvoyé : ${r.text.slice(0, 300)}`);
}

async function assertNothingStored(user: Buyer, what: string): Promise<void> {
    assert.deepEqual(await objectsOf(user.userId), [], `${what} : objet écrit dans le bucket`);
    assert.equal(await avatarUrlOf(user.userId), null, `${what} : avatar_url modifiée`);
}

// ── Envoi ──────────────────────────────────────────────────────────────────

describe('POST /api/account/avatar — images acceptées', () => {
    for (const [format, build] of [['JPEG', jpeg], ['PNG', png], ['WebP', webp]] as const) {
        test(`${format} : 200, WebP carré de 256 px, URL enregistrée, réponse sans cache`, async () => {
            const a = await newBuyer('photo-format');
            const r = await post(a, await build());
            assert.equal(r.status, 200, r.text);
            assert.deepEqual(Object.keys(r.body).sort(), ['avatar_url', 'ok'], r.text);
            assert.equal(r.body.ok, true);
            assert.match(r.headers.get('cache-control') ?? '', /no-store/, 'réponse non mise en cache');
            assert.equal(await avatarUrlOf(a.userId), r.body.avatar_url);
            const stored = await download(objectPathOf(r.body.avatar_url));
            const meta = await sharp(stored).metadata();
            assert.equal(meta.format, 'webp');
            assert.equal(meta.width, 256);
            assert.equal(meta.height, 256);
        });
    }

    test('image non carrée : recadrée en 256 × 256', async () => {
        const a = await newBuyer('photo-carre');
        const r = await post(a, await png(800, 300));
        assert.equal(r.status, 200, r.text);
        const meta = await sharp(await download(objectPathOf(r.body.avatar_url))).metadata();
        assert.deepEqual([meta.width, meta.height], [256, 256]);
    });

    test('le type vient du contenu : un PNG nommé .txt et déclaré text/plain est accepté', async () => {
        const a = await newBuyer('photo-contenu');
        const r = await post(a, await png(), { name: 'notes.txt', mime: 'text/plain' });
        assert.equal(r.status, 200, r.text);
        assert.equal((await sharp(await download(objectPathOf(r.body.avatar_url))).metadata()).format, 'webp');
    });

    test('exactement 2 Mo : accepté', async () => {
        const a = await newBuyer('photo-limite');
        const r = await post(a, await pngOfExactSize(MAX_BYTES), { name: 'limite.png', mime: 'image/png' });
        assert.equal(r.status, 200, r.text.slice(0, 300));
    });

    test('orientation EXIF appliquée avant la perte des métadonnées', async () => {
        const a = await newBuyer('photo-orient');
        const left = await sharp({ create: { width: 200, height: 200, channels: 3, background: { r: 255, g: 0, b: 0 } } }).png().toBuffer();
        const input = await sharp({ create: { width: 400, height: 200, channels: 3, background: { r: 0, g: 0, b: 255 } } })
            .composite([{ input: left, left: 0, top: 0 }]).jpeg().withMetadata({ orientation: 6 }).toBuffer();
        assert.equal((await sharp(input).metadata()).orientation, 6, 'précondition : orientation dans l’image envoyée');
        const r = await post(a, input);
        assert.equal(r.status, 200, r.text);
        const raw = await sharp(await download(objectPathOf(r.body.avatar_url))).removeAlpha().raw().toBuffer({ resolveWithObject: true });
        const red = (x: number, y: number): number => raw.data[(y * raw.info.width + x) * raw.info.channels];
        const blue = (x: number, y: number): number => raw.data[(y * raw.info.width + x) * raw.info.channels + 2];
        assert.ok(red(128, 20) > 200 && blue(128, 20) < 60, `haut rouge attendu : ${red(128, 20)}, ${blue(128, 20)}`);
        assert.ok(blue(128, 236) > 200 && red(128, 236) < 60, `bas bleu attendu : ${red(128, 236)}, ${blue(128, 236)}`);
    });

    test('la photo se lit sans session par son URL publique, en image/webp', async () => {
        const a = await newBuyer('photo-public');
        const r = await post(a, await jpeg());
        assert.equal(r.status, 200, r.text);
        const res = await fetch(String(r.body.avatar_url));
        assert.equal(res.status, 200, `lecture publique : HTTP ${res.status}`);
        assert.match(res.headers.get('content-type') ?? '', /image\/webp/);
    });
});

describe('POST /api/account/avatar — métadonnées retirées', () => {
    for (const [format, encode] of [
        ['JPEG', (s: sharp.Sharp) => s.jpeg()],
        ['WebP', (s: sharp.Sharp) => s.webp()],
        ['PNG', (s: sharp.Sharp) => s.png()],
    ] as const) {
        test(`${format} avec balise GPS : EXIF et position absents de l’objet stocké`, async () => {
            const a = await newBuyer('photo-exif');
            const input = await encode(canvas().withExif(EXIF_WITH_GPS)).toBuffer();
            const before = await sharp(input).metadata();
            assert.ok(before.exif, 'précondition : bloc EXIF dans l’image envoyée');
            assert.deepEqual(gpsLatitude(before.exif), [14, 41, 2], 'précondition : vraie balise GPSLatitude dans l’image envoyée');
            assert.ok(input.includes(Buffer.from(MARK, 'latin1')), 'précondition : chaîne repère dans les octets envoyés');

            const r = await post(a, input);
            assert.equal(r.status, 200, r.text);
            const stored = await download(objectPathOf(r.body.avatar_url));
            const after_ = await sharp(stored).metadata();
            assert.equal(after_.exif, undefined, 'bloc EXIF conservé : position GPS exposée publiquement');
            assert.equal(after_.xmp, undefined, 'bloc XMP conservé');
            assert.equal(after_.iptc, undefined, 'bloc IPTC conservé');
            assert.equal(stored.includes(Buffer.from(MARK, 'latin1')), false, 'chaîne repère du bloc présente dans les octets stockés');
            assert.equal(stored.includes(Buffer.from('Exif', 'latin1')), false, 'marqueur Exif présent dans les octets stockés');
        });
    }
});

describe('POST /api/account/avatar — chemin et nom', () => {
    test('chemin <user_id>/<uuid>.webp, un seul objet, le nom envoyé n’apparaît nulle part', async () => {
        const a = await newBuyer('photo-chemin');
        const name = 'photo-secrete-de-famille.jpg';
        const r = await post(a, await jpeg(), { name });
        assert.equal(r.status, 200, r.text);
        const objectPath = objectPathOf(r.body.avatar_url);
        assert.match(objectPath, new RegExp(`^${a.userId}/${UUID}\\.webp$`), objectPath);
        assert.deepEqual(await objectsOf(a.userId), [objectPath]);
        for (const value of [objectPath, String(await avatarUrlOf(a.userId)), r.text]) {
            assert.equal(value.includes('photo-secrete'), false, `nom du fichier réutilisé : ${value}`);
        }
    });

    test('champs du formulaire et nom de fichier hostile : l’objet reste sous le dossier du compte', async () => {
        const a = await newBuyer('photo-champs-a');
        const b = await newBuyer('photo-champs-b');
        const r = await post(a, await jpeg(), {
            name: `../${b.userId}/piege.webp`,
            fields: { user_id: b.userId, userId: b.userId, path: `${b.userId}/piege.webp` },
        });
        assert.equal(r.status, 200, r.text);
        assert.match(objectPathOf(r.body.avatar_url), new RegExp(`^${a.userId}/${UUID}\\.webp$`));
        assert.deepEqual(await objectsOf(b.userId), [], 'rien chez B');
        assert.equal(await avatarUrlOf(b.userId), null, 'avatar_url de B intacte');
    });
});

describe('POST /api/account/avatar — refus', () => {
    test('faux type : texte nommé .jpg et déclaré image/jpeg : 400 UNSUPPORTED_FORMAT', async () => {
        const a = await newBuyer('photo-faux');
        const r = await post(a, Buffer.from('ceci n’est pas une image', 'utf8'), { name: 'photo.jpg', mime: 'image/jpeg' });
        assertRefused(r, 400, 'UNSUPPORTED_FORMAT', 'faux type');
        await assertNothingStored(a, 'faux type');
    });

    test('SVG et GIF réels : 400 UNSUPPORTED_FORMAT', async () => {
        const a = await newBuyer('photo-svg');
        const svg = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><script>alert(1)</script></svg>', 'utf8');
        const gif = await canvas(16, 16).gif().toBuffer();
        assert.equal(gif.subarray(0, 3).toString('latin1'), 'GIF', 'précondition : vrai GIF');
        for (const [what, content, name, mime] of [['SVG', svg, 'a.svg', 'image/svg+xml'], ['GIF', gif, 'a.gif', 'image/gif']] as const) {
            assertRefused(await post(a, content, { name, mime }), 400, 'UNSUPPORTED_FORMAT', what);
        }
        await assertNothingStored(a, 'SVG et GIF');
    });

    test('signature valide et corps corrompu, tronqué : 400 UNSUPPORTED_FORMAT, jamais 500', async () => {
        const a = await newBuyer('photo-corrompu');
        const corrupt = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(4_000, 0x42)]);
        const truncated = (await png(64, 64)).subarray(0, 40);
        for (const [what, content] of [['JPEG corrompu', corrupt], ['PNG tronqué', truncated]] as const) {
            assertRefused(await post(a, content), 400, 'UNSUPPORTED_FORMAT', what);
        }
        await assertNothingStored(a, 'image corrompue');
    });

    test('2 Mo + 1 octet : 413 FILE_TOO_LARGE', async () => {
        const a = await newBuyer('photo-lourd');
        assertRefused(await post(a, await pngOfExactSize(MAX_BYTES + 1), { name: 'lourd.png', mime: 'image/png' }), 413, 'FILE_TOO_LARGE', '2 Mo + 1');
        await assertNothingStored(a, 'fichier trop lourd');
    });

    test('Content-Length absent : 413 avant la lecture du corps', async () => {
        const a = await newBuyer('photo-sans-cl');
        assertRefused(await post(a, await jpeg(), { contentLength: null }), 413, 'FILE_TOO_LARGE', 'Content-Length absent');
        await assertNothingStored(a, 'Content-Length absent');
    });

    test('Content-Length au-delà de la marge : 413 sans lire un corps qui n’est même pas un formulaire', async () => {
        const a = await newBuyer('photo-grand-cl');
        const req = new NextRequest(`${BASE_URL}${AVATAR_PATH}`, {
            method: 'POST',
            headers: { authorization: `Bearer ${a.accessToken}`, 'content-type': 'multipart/form-data; boundary=xxx', 'content-length': String(5 * MAX_BYTES) },
            body: 'corps illisible',
        });
        assertRefused(await reply(await (await avatarRoute()).POST(req)), 413, 'FILE_TOO_LARGE', 'Content-Length trop grand');
        await assertNothingStored(a, 'Content-Length trop grand');
    });

    test('plus de 40 millions de pixels sous 2 Mo : 400 UNSUPPORTED_FORMAT (limitInputPixels)', async () => {
        const a = await newBuyer('photo-pixels');
        const huge = await sharp({ create: { width: 7000, height: 7000, channels: 3, background: { r: 1, g: 2, b: 3 } } }).png({ compressionLevel: 9 }).toBuffer();
        assert.ok(huge.length <= MAX_BYTES, `précondition : image sous 2 Mo (${huge.length})`);
        assertRefused(await post(a, huge, { name: 'enorme.png', mime: 'image/png' }), 400, 'UNSUPPORTED_FORMAT', 'bombe de pixels');
        await assertNothingStored(a, 'bombe de pixels');
    });

    test('corps qui n’est pas un formulaire : 400 INVALID_BODY ; formulaire sans fichier : 400', async () => {
        const a = await newBuyer('photo-corps');
        const text = new NextRequest(`${BASE_URL}${AVATAR_PATH}`, {
            method: 'POST',
            headers: { authorization: `Bearer ${a.accessToken}`, 'content-type': 'text/plain', 'content-length': '5' },
            body: 'bonjour',
        });
        assertRefused(await reply(await (await avatarRoute()).POST(text)), 400, 'INVALID_BODY', 'corps texte');
        const form = new FormData();
        form.append('autre', 'valeur');
        const encoded = new Response(form);
        const bytes = new Uint8Array(await encoded.arrayBuffer());
        const empty = new NextRequest(`${BASE_URL}${AVATAR_PATH}`, {
            method: 'POST',
            headers: { authorization: `Bearer ${a.accessToken}`, 'content-type': encoded.headers.get('content-type') ?? '', 'content-length': String(bytes.length) },
            body: bytes,
        });
        const r = await reply(await (await avatarRoute()).POST(empty));
        assert.equal(r.status, 400, r.text);
        await assertNothingStored(a, 'corps invalide');
    });

    test('quota du compte : au-delà de 2 envois, 429 AVATAR_RATE_LIMITED, la photo en place reste', async () => {
        const a = await newBuyer('photo-quota');
        await withEnv({ AVATAR_UPLOADS_PER_ACCOUNT_HOUR: '2' }, async () => {
            const first = await post(a, await jpeg());
            assert.equal(first.status, 200, first.text);
            const second = await post(a, await jpeg());
            assert.equal(second.status, 200, second.text);
            assertRefused(await post(a, await jpeg()), 429, 'AVATAR_RATE_LIMITED', 'quota');
            assert.equal(await avatarUrlOf(a.userId), second.body.avatar_url);
            assert.deepEqual(await objectsOf(a.userId), [objectPathOf(second.body.avatar_url)]);
        });
    });
});

// ── Remplacement et suppression ────────────────────────────────────────────

describe('Remplacement et suppression', () => {
    test('remplacer : l’ancien objet disparaît, le nouveau est seul', async () => {
        const a = await newBuyer('photo-rempl');
        const first = await post(a, await jpeg());
        assert.equal(first.status, 200, first.text);
        const second = await post(a, await png());
        assert.equal(second.status, 200, second.text);
        assert.notEqual(second.body.avatar_url, first.body.avatar_url, 'nouveau chemin à chaque envoi');
        assert.deepEqual(await objectsOf(a.userId), [objectPathOf(second.body.avatar_url)]);
        assert.equal(await avatarUrlOf(a.userId), second.body.avatar_url);
        const gone = await fetch(String(first.body.avatar_url));
        assert.notEqual(gone.status, 200, 'l’ancienne URL publique répond encore');
    });

    test('deux remplacements simultanés : une seule photo reste, celle de avatar_url', async () => {
        const a = await newBuyer('photo-course');
        const first = await post(a, await jpeg());
        assert.equal(first.status, 200, first.text);
        const [one, two] = await Promise.all([post(a, await jpeg()), post(a, await png())]);
        assert.deepEqual([one.status, two.status], [200, 200], `${one.text} / ${two.text}`);
        const current = await avatarUrlOf(a.userId);
        assert.deepEqual(await objectsOf(a.userId), [objectPathOf(current)], 'chacun supprime exactement ce qu’il remplace');
    });

    test('supprimer : objet absent, avatar_url NULL, deuxième suppression sans effet', async () => {
        const a = await newBuyer('photo-suppr');
        const up = await post(a, await jpeg());
        assert.equal(up.status, 200, up.text);
        const r = await remove(a);
        assert.equal(r.status, 200, r.text);
        assert.deepEqual(r.body, { ok: true });
        assert.equal(await avatarUrlOf(a.userId), null);
        assert.deepEqual(await objectsOf(a.userId), []);
        const again = await remove(a);
        assert.equal(again.status, 200, again.text);
        assert.equal(await avatarUrlOf(a.userId), null);
    });
});

// ── Droits ─────────────────────────────────────────────────────────────────

describe('Droits (D-cpt C6)', () => {
    test('sans session : 401 AUTH_REQUIRED sur POST et DELETE', async () => {
        const route = await avatarRoute();
        const up = await reply(await route.POST(await uploadRequest(null, await jpeg())));
        assert.equal(up.status, 401, up.text);
        assert.equal(up.body.code, 'AUTH_REQUIRED', up.text);
        const del = await reply(await route.DELETE(new NextRequest(`${BASE_URL}${AVATAR_PATH}`, { method: 'DELETE' })));
        assert.equal(del.status, 401, del.text);
        assert.equal(del.body.code, 'AUTH_REQUIRED', del.text);
    });

    test('compte suspendu : 403 ACCOUNT_NOT_ACTIVE, rien d’écrit', async () => {
        const a = await newBuyer('photo-susp');
        const { error } = await service.from('users').update({ status: 'SUSPENDU' }).eq('id', a.userId);
        assert.equal(error, null, `suspension : ${error?.message}`);
        const r = await post(a, await jpeg());
        assert.equal(r.status, 403, r.text);
        assert.equal(r.body.code, 'ACCOUNT_NOT_ACTIVE', r.text);
        await assertNothingStored(a, 'compte suspendu');
    });

    test('middleware : 401 sans session (déjà vrai, garde-fou)', async () => {
        const result = await callMiddleware(AVATAR_PATH, []);
        assert.equal(result.status, 401, JSON.stringify(result));
        assert.equal(result.passedThrough, false);
    });

    test('middleware : une session passe (déjà vrai, garde-fou)', async () => {
        const a = await newBuyer('photo-mw');
        const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
        const { error } = await client.auth.signInWithPassword({ email: await gotrueEmail(a.email), password: STRONG_PASSWORD });
        assert.equal(error, null, `connexion : ${error?.message}`);
        const result = await callMiddleware(AVATAR_PATH, await sessionCookies(client));
        assert.equal(result.passedThrough, true, JSON.stringify(result));
    });

    const forgeries: Array<[string, (victimPath: string, attackerId: string) => string]> = [
        ['URL directe de l’objet de B', (victimPath) => publicUrl(victimPath)],
        ['traversée depuis le dossier de A', (victimPath, attackerId) => publicUrl(`${attackerId}/../${victimPath}`)],
        ['même chemin sur un autre hôte', (victimPath) => `https://example.invalid/storage/v1/object/public/${BUCKET}/${victimPath}`],
    ];

    for (const [what, forge] of forgeries) {
        test(`avatar_url forgée (${what}) : l’objet de B reste intact après POST et DELETE de A, et rien n’est supprimé sans journal`, async () => {
            const a = await newBuyer('photo-forge-a');
            const b = await newBuyer('photo-forge-b');
            const up = await post(b, await jpeg());
            assert.equal(up.status, 200, up.text);
            const victimPath = objectPathOf(up.body.avatar_url);
            const original = await download(victimPath);

            await setAvatarUrl(a.userId, forge(victimPath, a.userId));
            const replaced = await intercept([{ name: 'remove', match: storageRemove, pass: true }], async () => post(a, await png()));
            assert.equal(replaced.result.status, 200, replaced.result.text);
            assert.deepEqual(await download(victimPath), original, 'objet de B modifié ou supprimé par le POST de A');
            assert.deepEqual(await objectsOf(b.userId), [victimPath]);
            assert.equal(replaced.hits.remove, 0, 'aucune suppression demandée pour une ancienne URL hors du dossier du compte');
            assert.ok(replaced.logged.length >= 1, 'chemin refusé journalisé');

            await clearFolder(a.userId);
            await setAvatarUrl(a.userId, forge(victimPath, a.userId));
            const deleted = await intercept([{ name: 'remove', match: storageRemove, pass: true }], () => remove(a));
            assert.equal(deleted.result.status, 200, deleted.result.text);
            assert.deepEqual(await download(victimPath), original, 'objet de B modifié ou supprimé par le DELETE de A');
            assert.deepEqual(await objectsOf(b.userId), [victimPath]);
            assert.equal(deleted.hits.remove, 0, 'aucune suppression demandée pour une ancienne URL hors du dossier du compte');
            assert.ok(deleted.logged.length >= 1, 'chemin refusé journalisé');
            assert.equal(await avatarUrlOf(a.userId), null, 'la photo de A est bien retirée');
            assert.equal(await avatarUrlOf(b.userId), up.body.avatar_url, 'avatar_url de B intacte');
        });
    }
});

// ── Pannes ─────────────────────────────────────────────────────────────────

describe('Pannes', () => {
    test('stockage en panne à l’envoi : 500 AVATAR_SAVE_FAILED, photo en place conservée', async () => {
        const a = await newBuyer('photo-panne-st');
        const first = await post(a, await jpeg());
        assert.equal(first.status, 200, first.text);
        const input = await png();
        const { result, hits, logged } = await intercept([{ name: 'upload', match: storageUpload }], () => post(a, input));
        assertRefused(result, 500, 'AVATAR_SAVE_FAILED', 'panne du stockage');
        assert.ok(hits.upload >= 1, 'panne atteinte');
        assert.ok(logged.length >= 1, 'panne journalisée');
        assert.equal(await avatarUrlOf(a.userId), first.body.avatar_url);
        assert.deepEqual(await objectsOf(a.userId), [objectPathOf(first.body.avatar_url)]);
    });

    test('RPC en panne après l’envoi : 500, le nouvel objet est retiré, la photo en place reste', async () => {
        const a = await newBuyer('photo-panne-rpc');
        const first = await post(a, await jpeg());
        assert.equal(first.status, 200, first.text);
        const input = await png();
        const { result, hits } = await intercept([{ name: 'rpc', match: avatarRpc }], () => post(a, input));
        assertRefused(result, 500, 'AVATAR_SAVE_FAILED', 'panne de la RPC');
        assert.equal(hits.rpc, 1, 'RPC appelée une seule fois');
        assert.equal(await avatarUrlOf(a.userId), first.body.avatar_url);
        assert.deepEqual(await objectsOf(a.userId), [objectPathOf(first.body.avatar_url)], 'pas d’objet orphelin');
    });

    test('suppression de l’ancienne en panne : la nouvelle photo reste valide, 200, journal', async () => {
        const a = await newBuyer('photo-panne-rm');
        const first = await post(a, await jpeg());
        assert.equal(first.status, 200, first.text);
        const input = await png();
        const { result, hits, logged } = await intercept([{ name: 'remove', match: storageRemove }], () => post(a, input));
        assert.equal(result.status, 200, result.text);
        assert.ok(hits.remove >= 1, 'panne atteinte');
        assert.ok(logged.length >= 1, 'échec de suppression journalisé');
        assert.equal(await avatarUrlOf(a.userId), result.body.avatar_url);
        const left = (await objectsOf(a.userId)).sort();
        assert.deepEqual(left, [objectPathOf(first.body.avatar_url), objectPathOf(result.body.avatar_url)].sort(), 'l’orphelin reste, signalé');
        const { error } = await service.storage.from(BUCKET).remove([objectPathOf(first.body.avatar_url)]);
        assert.equal(error, null, `retrait de l’orphelin (règle v3) : ${error?.message}`);
    });

    test('DELETE avec RPC en panne : 500 AVATAR_SAVE_FAILED, photo conservée', async () => {
        const a = await newBuyer('photo-panne-del');
        const first = await post(a, await jpeg());
        assert.equal(first.status, 200, first.text);
        const { result } = await intercept([{ name: 'rpc', match: avatarRpc }], () => remove(a));
        assertRefused(result, 500, 'AVATAR_SAVE_FAILED', 'DELETE, panne de la RPC');
        assert.equal(await avatarUrlOf(a.userId), first.body.avatar_url);
        assert.deepEqual(await objectsOf(a.userId), [objectPathOf(first.body.avatar_url)]);
    });
});

// ── Module de signature, écran ─────────────────────────────────────────────

describe('Module partagé et écran (L35, L36, AR3)', () => {
    function read(rel: string): string {
        const abs = path.resolve(process.cwd(), rel);
        assert.ok(fs.existsSync(abs), `${rel} absent (contrat 5.3)`);
        return fs.readFileSync(abs, 'utf8');
    }

    test('lib/images/sniff : JPEG, PNG, WebP reconnus ; GIF, SVG, texte, fichier trop court refusés', async () => {
        const { sniffImage } = await importModule('../../lib/images/sniff');
        assert.equal(typeof sniffImage, 'function', 'lib/images/sniff.ts doit exporter sniffImage (L35)');
        assert.equal(sniffImage(await jpeg(16, 16))?.mime, 'image/jpeg');
        assert.equal(sniffImage(await png(16, 16))?.mime, 'image/png');
        assert.equal(sniffImage(await webp(16, 16))?.mime, 'image/webp');
        assert.equal(sniffImage(await canvas(16, 16).gif().toBuffer()), null);
        assert.equal(sniffImage(Buffer.from('<svg></svg>', 'utf8')), null);
        assert.equal(sniffImage(Buffer.from('bonjour', 'utf8')), null);
        assert.equal(sniffImage(Buffer.from([0xff, 0xd8])), null);
    });

    test('partner/upload utilise le module partagé, sans copie locale', () => {
        const src = read('app/api/partner/upload/route.ts');
        assert.match(src, /from '@\/lib\/images\/sniff'/, 'import du module partagé (L35)');
        assert.doesNotMatch(src, /function sniffImage/, 'copie locale de sniffImage');
    });

    test('Avatar en <img>, sans next/image ; garde isAvatarUrl ; initiales sans photo', () => {
        const src = read('components/ui/Avatar.tsx');
        assert.match(src, /<img\b/, 'AR3 : <img> partout');
        assert.doesNotMatch(src, /next\/image/, 'next/image entrerait dans le layout des cinq routes budgétées (L36)');
        assert.match(src, /isAvatarUrl/, 'seules les URL du bucket avatars sont rendues');
    });

    test('AppLayout et /profile passent par Avatar ; AvatarEditor porte les libellés figés', () => {
        assert.match(read('components/layout/AppLayout.tsx'), /<Avatar\b/, 'AppLayout rend le composant commun');
        const page = read('app/profile/page.tsx');
        assert.match(page, /AvatarEditor/, '/profile rend l’éditeur de photo');
        const editor = read('components/profile/AvatarEditor.tsx');
        assert.match(editor, /Choisir une photo/, 'libellé figé pour l’e2e');
        assert.match(editor, /Supprimer la photo/, 'libellé figé pour l’e2e');
        assert.match(editor, /\/api\/account\/avatar/);
    });
});

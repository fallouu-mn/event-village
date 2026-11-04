/**
 * Lot 7 — 7.0 e : application installable (contrat §4.5, décisions D24 et D25 ; écrivain « PWA », W3).
 *
 * Suite sans serveur : elle lit public/manifest.json, décode les PNG des icônes (en-tête IHDR et pixels, sans
 * dépendance), appelle le VRAI middleware (middleware.ts) dans le processus et lit app/layout.tsx par l'arbre
 * syntaxique de TypeScript (commentaires exclus). La preuve « installable par Chromium » est en e2e
 * (e2e/installable.spec.ts, §11.3) ; cette suite fige ce qui se vérifie sans navigateur.
 *
 * Ce qui est prouvé :
 *  - manifest : JSON valide, id, scope, start_url dans scope, display standalone, short_name ≤ 12, lang,
 *    couleurs #RRGGBB, puis les valeurs exactes du contrat (D24) ;
 *  - icônes : chaque fichier existe sous public/, est un PNG dont les dimensions IHDR égalent `sizes` ; une 192 et
 *    une 512 « any », une « maskable » sur une entrée séparée, PNG de type de couleur 2 (opaque), motif dans le
 *    cercle de sécurité (rayon 40 % : 409 px de diamètre sur 512) ;
 *  - iPhone : public/icons/apple-touch-icon.png 180×180 opaque, désigné par metadata.icons.apple de app/layout.tsx,
 *    aucune balise apple-touch-icon ni mobile-web-app-capable écrite à la main (une seule source, la metadata) ;
 *  - accès public : le middleware laisse passer, par le retour immédiat (aucun client Supabase créé, aucun appel
 *    réseau, aucun Set-Cookie, aucune redirection), /manifest.json, /sw.js, chaque icône, /billet/hors-ligne,
 *    /api/features, /api/halls, /api/halls/<uuid>, /api/restaurants/x/tables et /api/restaurants/x/menu.
 *
 * Mesure « sans Supabase » : pendant l'appel du middleware, `fetch` est remplacé par une fonction qui note chaque
 * requête et répond 401 (aucune requête réelle). Chaque chemin est appelé deux fois : sans cookie, puis avec un faux
 * cookie de session @supabase/ssr (jeton non signé, inutilisable) qui oblige tout passage par Supabase à appeler
 * /auth/v1/user. Le témoin /explore (page publique qui lit la session) prouve que la mesure voit ce passage : il
 * fait un appel et porte l'en-tête x-middleware-override-headers de NextResponse.next({ request }).
 *
 * Rouge avant correctif (fix(7.0e), A3 ; app/layout.tsx par E2) : le manifest n'a ni id, ni scope, ni lang, ni
 * icône maskable, son fond est #0F0F11 ; public/icons/ n'existe pas ; layout.tsx désigne /icon-192x192.png
 * (transparente) comme apple-touch-icon et écrit à la main <link rel="apple-touch-icon"> et
 * <meta name="mobile-web-app-capable"> ; le middleware redirige vers /login /icons/…, /billet/hors-ligne et
 * répond 401 à /api/features, /api/halls, /api/restaurants/x/tables|menu.
 * Verts dès l'écriture (couverture ajoutée, garde-fous) : /manifest.json, /sw.js, /icon-192x192.png,
 * /icon-512x512.png passent déjà ; le témoin /explore ; /api/halls/reserve et /api/restaurants/reserve-table
 * exigent toujours une session (garde-fou contre un préfixe trop large) ; appleWebApp.capable gardé.
 */
import '../helpers/env';
import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import ts from 'typescript';
import { NextRequest } from 'next/server';
import { middleware } from '../../middleware';
import { assertTerrainInvariants } from '../helpers/terrain-invariants';

after(async () => {
    await assertTerrainInvariants('pwa-manifest');
});

const ROOT = process.cwd();
const MANIFEST_REL = 'public/manifest.json';
const LAYOUT_REL = 'app/layout.tsx';
const MASKABLE_SRC = '/icons/icon-maskable-512.png';
const APPLE_TOUCH_SRC = '/icons/apple-touch-icon.png';
const OFFLINE_PATH = '/billet/hors-ligne';

function absPath(rel: string): string {
    return path.join(ROOT, ...rel.split('/'));
}

// ── Manifest ───────────────────────────────────────────────────────────────

interface ManifestIcon { src?: unknown; sizes?: unknown; type?: unknown; purpose?: unknown }

function readManifest(): Record<string, unknown> {
    const file = absPath(MANIFEST_REL);
    assert.ok(fs.existsSync(file), `${MANIFEST_REL} absent (D24 : le manifest reste public/manifest.json)`);
    const raw = fs.readFileSync(file, 'utf8');
    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch (err) {
        assert.fail(`${MANIFEST_REL} n'est pas un JSON valide : ${err instanceof Error ? err.message : String(err)}`);
    }
    assert.ok(parsed && typeof parsed === 'object' && !Array.isArray(parsed), `${MANIFEST_REL} : la racine doit être un objet`);
    return parsed as Record<string, unknown>;
}

function manifestIcons(m: Record<string, unknown>): ManifestIcon[] {
    assert.ok(Array.isArray(m.icons), 'manifest : « icons » doit être un tableau');
    return m.icons as ManifestIcon[];
}

/** Mots de « purpose » (absent = « any », règle du standard Web App Manifest). */
function purposesOf(icon: ManifestIcon): string[] {
    if (icon.purpose === undefined) return ['any'];
    return String(icon.purpose).trim().split(/\s+/).filter(Boolean);
}

/** Chemin d'un `src` d'icône sous public/ (chemin absolu de même origine seulement). */
function publicFileOf(src: string): string {
    assert.ok(src.startsWith('/') && !src.startsWith('//'), `icône « ${src} » : src doit être un chemin absolu de même origine`);
    return absPath(`public${src}`);
}

// ── PNG (en-tête IHDR et pixels, 8 bits par canal, sans entrelacement) ─────

interface Png {
    width: number;
    height: number;
    bitDepth: number;
    colorType: number;
    interlace: number;
    hasTrns: boolean;
    idat: Buffer;
}

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function readPng(file: string): Png {
    assert.ok(fs.existsSync(file), `fichier absent : ${path.relative(ROOT, file).replace(/\\/g, '/')}`);
    const buf = fs.readFileSync(file);
    const rel = path.relative(ROOT, file).replace(/\\/g, '/');
    assert.ok(buf.length > 33 && buf.subarray(0, 8).equals(PNG_SIGNATURE), `${rel} n'est pas un PNG (signature absente)`);
    assert.equal(buf.toString('latin1', 12, 16), 'IHDR', `${rel} : premier bloc différent de IHDR`);
    const png: Png = {
        width: buf.readUInt32BE(16),
        height: buf.readUInt32BE(20),
        bitDepth: buf[24],
        colorType: buf[25],
        interlace: buf[28],
        hasTrns: false,
        idat: Buffer.alloc(0),
    };
    const parts: Buffer[] = [];
    let off = 8;
    while (off + 8 <= buf.length) {
        const len = buf.readUInt32BE(off);
        const type = buf.toString('latin1', off + 4, off + 8);
        const data = buf.subarray(off + 8, off + 8 + len);
        if (type === 'tRNS') png.hasTrns = true;
        if (type === 'IDAT') parts.push(data);
        if (type === 'IEND') break;
        off += 12 + len;
    }
    png.idat = Buffer.concat(parts);
    return png;
}

const CHANNELS: Record<number, number> = { 0: 1, 2: 3, 4: 2, 6: 4 };

/** Pixels décodés (filtres PNG annulés) : `channels` octets par pixel, ligne après ligne. */
function decodePixels(png: Png, rel: string): { channels: number; data: Buffer } {
    const channels = CHANNELS[png.colorType];
    assert.ok(channels, `${rel} : type de couleur ${png.colorType} non décodé par ce test (attendu 0, 2, 4 ou 6)`);
    assert.equal(png.bitDepth, 8, `${rel} : profondeur ${png.bitDepth} bits non décodée par ce test (attendu 8)`);
    assert.equal(png.interlace, 0, `${rel} : PNG entrelacé non décodé par ce test`);
    const raw = zlib.inflateSync(png.idat);
    const stride = png.width * channels;
    assert.equal(raw.length, (stride + 1) * png.height, `${rel} : taille des données décompressées inattendue`);
    const out = Buffer.alloc(stride * png.height);
    for (let y = 0; y < png.height; y++) {
        const filter = raw[y * (stride + 1)];
        const src = y * (stride + 1) + 1;
        const dst = y * stride;
        for (let x = 0; x < stride; x++) {
            const a = x >= channels ? out[dst + x - channels] : 0;
            const b = y > 0 ? out[dst - stride + x] : 0;
            const c = x >= channels && y > 0 ? out[dst - stride + x - channels] : 0;
            const v = raw[src + x];
            let r: number;
            switch (filter) {
                case 0: r = v; break;
                case 1: r = v + a; break;
                case 2: r = v + b; break;
                case 3: r = v + ((a + b) >> 1); break;
                case 4: {
                    const p = a + b - c;
                    const pa = Math.abs(p - a);
                    const pb = Math.abs(p - b);
                    const pc = Math.abs(p - c);
                    r = v + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c);
                    break;
                }
                default:
                    assert.fail(`${rel} : filtre PNG inconnu ${filter} à la ligne ${y}`);
            }
            out[dst + x] = r & 0xff;
        }
    }
    return { channels, data: out };
}

/** Opaque : sans canal alpha ni tRNS, ou alpha à 255 sur chaque pixel. Renvoie la raison sinon. */
function opacityFault(png: Png, rel: string): string | null {
    if (png.colorType === 0 || png.colorType === 2 || png.colorType === 3) {
        return png.hasTrns ? `${rel} : bloc tRNS présent (transparence)` : null;
    }
    const { channels, data } = decodePixels(png, rel);
    let transparent = 0;
    for (let i = channels - 1; i < data.length; i += channels) if (data[i] !== 255) transparent++;
    return transparent === 0 ? null : `${rel} : ${transparent} pixel(s) non opaques (alpha < 255)`;
}

// ── Middleware (appel réel, réseau simulé) ─────────────────────────────────

interface MiddlewareProbe {
    status: number;
    location: string | null;
    setCookie: string | null;
    next: boolean;
    supabaseClient: boolean;
    fetches: string[];
}

function b64url(value: unknown): string {
    return Buffer.from(typeof value === 'string' ? value : JSON.stringify(value)).toString('base64url');
}

/** Faux cookie de session @supabase/ssr : jeton non signé, refusé par le faux réseau (401). */
function fakeSessionCookie(): string {
    const host = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).hostname.split('.')[0];
    const now = Math.floor(Date.now() / 1000);
    const sub = randomUUID();
    const jwt = `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url({ sub, role: 'authenticated', iat: now, exp: now + 3600 })}.${b64url('signature-factice')}`;
    const session = { access_token: jwt, refresh_token: 'jeton-factice', token_type: 'bearer', expires_in: 3600, expires_at: now + 3600, user: { id: sub } };
    return `sb-${host}-auth-token=base64-${b64url(session)}`;
}

async function probeMiddleware(pathname: string, cookie: string | null): Promise<MiddlewareProbe> {
    const fetches: string[] = [];
    const realFetch = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL) => {
        fetches.push(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
        return new Response(JSON.stringify({ code: 401, msg: 'réseau simulé par le test : aucune session' }), {
            status: 401,
            headers: { 'content-type': 'application/json' },
        });
    }) as typeof fetch;
    try {
        const headers: Record<string, string> = cookie ? { cookie } : {};
        const res = await middleware(new NextRequest(`http://127.0.0.1:3000${pathname}`, { headers }));
        return {
            status: res.status,
            location: res.headers.get('location'),
            setCookie: res.headers.get('set-cookie'),
            next: res.headers.get('x-middleware-next') === '1',
            supabaseClient: res.headers.get('x-middleware-override-headers') !== null,
            fetches,
        };
    } finally {
        globalThis.fetch = realFetch;
    }
}

function immediateFaults(label: string, p: MiddlewareProbe): string[] {
    const faults: string[] = [];
    if (p.status !== 200) faults.push(`${label} : statut ${p.status} (attendu 200)`);
    if (p.location) faults.push(`${label} : redirection vers ${p.location}`);
    if (!p.next) faults.push(`${label} : pas de NextResponse.next() (x-middleware-next absent)`);
    if (p.setCookie) faults.push(`${label} : Set-Cookie posé (${p.setCookie.slice(0, 60)}…)`);
    if (p.supabaseClient) faults.push(`${label} : réponse NextResponse.next({ request }) du chemin Supabase (x-middleware-override-headers), pas le retour immédiat`);
    if (p.fetches.length > 0) faults.push(`${label} : ${p.fetches.length} appel(s) réseau (${p.fetches.join(', ')})`);
    return faults;
}

async function assertImmediatePass(pathname: string): Promise<void> {
    const faults = [
        ...immediateFaults(`${pathname} sans cookie`, await probeMiddleware(pathname, null)),
        ...immediateFaults(`${pathname} avec un faux cookie de session`, await probeMiddleware(pathname, fakeSessionCookie())),
    ];
    assert.deepEqual(faults, [], `le middleware doit laisser passer ${pathname} sans session ni appel Supabase :\n  - ${faults.join('\n  - ')}`);
}

// ── app/layout.tsx (arbre syntaxique) ──────────────────────────────────────

function layoutSource(): ts.SourceFile {
    const file = absPath(LAYOUT_REL);
    assert.ok(fs.existsSync(file), `${LAYOUT_REL} absent`);
    return ts.createSourceFile(LAYOUT_REL, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
}

function walk(node: ts.Node, visit: (n: ts.Node) => void): void {
    visit(node);
    node.forEachChild((c) => walk(c, visit));
}

function propName(name: ts.PropertyName): string | null {
    if (ts.isIdentifier(name) || ts.isStringLiteral(name) || ts.isNoSubstitutionTemplateLiteral(name)) return name.text;
    return null;
}

function objectProp(obj: ts.ObjectLiteralExpression, name: string): ts.Expression | undefined {
    for (const p of obj.properties) {
        if (ts.isPropertyAssignment(p) && propName(p.name) === name) return p.initializer;
    }
    return undefined;
}

/** Objet littéral de `export const metadata` (sans `satisfies` ni `as`). */
function metadataObject(sf: ts.SourceFile): ts.ObjectLiteralExpression {
    const found: ts.ObjectLiteralExpression[] = [];
    walk(sf, (n) => {
        if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.name.text === 'metadata' && n.initializer) {
            let init: ts.Expression = n.initializer;
            while (ts.isSatisfiesExpression(init) || ts.isAsExpression(init) || ts.isParenthesizedExpression(init)) init = init.expression;
            if (ts.isObjectLiteralExpression(init)) found.push(init);
        }
    });
    assert.equal(found.length, 1, `${LAYOUT_REL} : « export const metadata = { … } » introuvable ou multiple (D24 : la metadata est la seule source)`);
    return found[0];
}

function stringValue(e: ts.Expression | undefined): string | null {
    if (!e) return null;
    if (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)) return e.text;
    return null;
}

type JsxTag = ts.JsxOpeningElement | ts.JsxSelfClosingElement;

function jsxTagsNamed(sf: ts.SourceFile, name: string): JsxTag[] {
    const out: JsxTag[] = [];
    walk(sf, (n) => {
        if ((ts.isJsxOpeningElement(n) || ts.isJsxSelfClosingElement(n)) && n.tagName.getText(sf) === name) out.push(n);
    });
    return out;
}

function jsxAttrString(sf: ts.SourceFile, el: JsxTag, attr: string): string | null {
    for (const p of el.attributes.properties) {
        if (!ts.isJsxAttribute(p) || p.name.getText(sf) !== attr || !p.initializer) continue;
        if (ts.isStringLiteral(p.initializer)) return p.initializer.text;
        if (ts.isJsxExpression(p.initializer) && p.initializer.expression) {
            const v = stringValue(p.initializer.expression);
            if (v !== null) return v;
            return p.initializer.expression.getText(sf);
        }
    }
    return null;
}

// ── Cas ────────────────────────────────────────────────────────────────────

describe('7.0 e — manifest (public/manifest.json)', () => {
    test('JSON valide : id, scope, start_url dans scope, display standalone, name, short_name ≤ 12, lang, couleurs #RRGGBB', () => {
        const m = readManifest();
        const faults: string[] = [];
        const origin = 'https://app.eventvillage.sn';
        for (const key of ['id', 'scope', 'start_url', 'name', 'short_name', 'lang'] as const) {
            if (typeof m[key] !== 'string' || !(m[key] as string).trim()) faults.push(`« ${key} » absent ou vide`);
        }
        if (typeof m.scope === 'string' && typeof m.start_url === 'string') {
            const scope = new URL(m.scope, origin);
            const start = new URL(m.start_url, origin);
            if (scope.origin !== origin) faults.push(`scope « ${m.scope} » hors de l'origine`);
            if (start.origin !== scope.origin || !start.pathname.startsWith(scope.pathname)) {
                faults.push(`start_url « ${m.start_url} » hors de scope « ${m.scope} »`);
            }
        }
        if (typeof m.id === 'string' && new URL(m.id, origin).origin !== origin) faults.push(`id « ${m.id} » hors de l'origine`);
        if (m.display !== 'standalone') faults.push(`display = ${JSON.stringify(m.display)} (attendu « standalone »)`);
        if (typeof m.short_name === 'string' && Array.from(m.short_name).length > 12) {
            faults.push(`short_name « ${m.short_name} » : ${Array.from(m.short_name).length} caractères (12 au plus)`);
        }
        for (const key of ['theme_color', 'background_color'] as const) {
            if (typeof m[key] !== 'string' || !/^#[0-9A-Fa-f]{6}$/.test(m[key] as string)) faults.push(`${key} = ${JSON.stringify(m[key])} (attendu #RRGGBB)`);
        }
        assert.deepEqual(faults, [], `${MANIFEST_REL} :\n  - ${faults.join('\n  - ')}`);
    });

    test('valeurs du contrat (D24) : id, scope et start_url « / », lang fr, dir ltr, fond clair #F8F9FA, thème #FF5722 gardé, raccourci « Billets hors ligne »', () => {
        const m = readManifest();
        const expected: Record<string, string> = {
            id: '/',
            scope: '/',
            start_url: '/',
            name: 'Event Village',
            short_name: 'EventVillage',
            lang: 'fr',
            dir: 'ltr',
            display: 'standalone',
            background_color: '#F8F9FA',
            theme_color: '#FF5722',
        };
        const faults: string[] = [];
        for (const [k, v] of Object.entries(expected)) {
            const got = typeof m[k] === 'string' ? (m[k] as string) : m[k];
            const same = typeof got === 'string' && /_color$/.test(k) ? got.toUpperCase() === v.toUpperCase() : got === v;
            if (!same) faults.push(`${k} = ${JSON.stringify(m[k])} (attendu ${JSON.stringify(v)})`);
        }
        if (typeof m.description !== 'string' || !m.description.trim()) faults.push('description absente');
        const shortcuts = Array.isArray(m.shortcuts) ? (m.shortcuts as Array<Record<string, unknown>>) : [];
        const offline = shortcuts.find((s) => s && s.url === OFFLINE_PATH);
        if (!offline) faults.push(`aucun raccourci vers ${OFFLINE_PATH} (shortcuts = ${JSON.stringify(m.shortcuts)})`);
        else if (offline.name !== 'Billets hors ligne') faults.push(`raccourci ${OFFLINE_PATH} : name = ${JSON.stringify(offline.name)} (attendu « Billets hors ligne »)`);
        assert.deepEqual(faults, [], `${MANIFEST_REL} :\n  - ${faults.join('\n  - ')}`);
    });
});

describe('7.0 e — icônes du manifest', () => {
    test('chaque icône existe sous public/, est un PNG « image/png » dont les dimensions IHDR égalent « sizes »', () => {
        const icons = manifestIcons(readManifest());
        assert.ok(icons.length > 0, 'manifest : aucune icône');
        const faults: string[] = [];
        for (const icon of icons) {
            const src = typeof icon.src === 'string' ? icon.src : '';
            if (!src) { faults.push(`icône sans src : ${JSON.stringify(icon)}`); continue; }
            if (icon.type !== 'image/png') faults.push(`${src} : type = ${JSON.stringify(icon.type)} (attendu « image/png »)`);
            const sizes = typeof icon.sizes === 'string' ? icon.sizes.trim().split(/\s+/) : [];
            if (sizes.length !== 1 || !/^\d+x\d+$/.test(sizes[0])) { faults.push(`${src} : sizes = ${JSON.stringify(icon.sizes)} (une seule taille LxH attendue)`); continue; }
            const file = publicFileOf(src);
            if (!fs.existsSync(file)) { faults.push(`${src} : fichier public${src} absent`); continue; }
            const png = readPng(file);
            const [w, h] = sizes[0].split('x').map(Number);
            if (png.width !== w || png.height !== h) faults.push(`${src} : IHDR ${png.width}×${png.height}, sizes « ${sizes[0]} »`);
        }
        assert.deepEqual(faults, [], `icônes du manifest :\n  - ${faults.join('\n  - ')}`);
    });

    test('une 192 et une 512 « any », une « maskable » sur une entrée séparée (/icons/icon-maskable-512.png, 512×512)', () => {
        const icons = manifestIcons(readManifest());
        const any192 = icons.filter((i) => i.sizes === '192x192' && purposesOf(i).includes('any'));
        const any512 = icons.filter((i) => i.sizes === '512x512' && purposesOf(i).includes('any'));
        const maskable = icons.filter((i) => purposesOf(i).includes('maskable'));
        const faults: string[] = [];
        if (any192.length === 0) faults.push('aucune icône 192x192 « any »');
        if (any512.length === 0) faults.push('aucune icône 512x512 « any »');
        if (maskable.length === 0) faults.push('aucune icône « maskable »');
        for (const i of maskable) {
            if (purposesOf(i).join(' ') !== 'maskable') faults.push(`${String(i.src)} : purpose « ${String(i.purpose)} » (entrée séparée « maskable » attendue : l'icône rognée ne doit pas servir d'icône normale)`);
        }
        const contractual = maskable.find((i) => i.src === MASKABLE_SRC);
        if (!contractual) faults.push(`aucune entrée maskable pour ${MASKABLE_SRC}`);
        else if (contractual.sizes !== '512x512') faults.push(`${MASKABLE_SRC} : sizes = ${JSON.stringify(contractual.sizes)} (attendu 512x512)`);
        assert.deepEqual(faults, [], `icônes du manifest :\n  - ${faults.join('\n  - ')}`);
    });

    test('icône maskable : PNG de type de couleur 2 (RVB, sans alpha ni tRNS), motif dans le cercle de sécurité de 409 px, fond uni autour', () => {
        const rel = `public${MASKABLE_SRC}`;
        const png = readPng(absPath(rel));
        assert.equal(png.width, 512, `${rel} : largeur ${png.width}`);
        assert.equal(png.height, 512, `${rel} : hauteur ${png.height}`);
        assert.equal(png.colorType, 2, `${rel} : type de couleur ${png.colorType} (attendu 2, RVB opaque)`);
        assert.equal(png.hasTrns, false, `${rel} : bloc tRNS présent`);
        const { channels, data } = decodePixels(png, rel);
        const px = (x: number, y: number) => {
            const o = (y * png.width + x) * channels;
            return [data[o], data[o + 1], data[o + 2]];
        };
        const bg = px(0, 0);
        const close = (a: number[], b: number[]) => a.every((v, i) => Math.abs(v - b[i]) <= 6);
        const cx = png.width / 2;
        const cy = png.height / 2;
        const safe = png.width * 0.4; // 204,8 px : cercle de 409,6 px de diamètre (zone sûre des icônes maskable)
        let outside = 0;
        let firstOutside: string | null = null;
        let insideMotif = 0;
        let insideTotal = 0;
        for (let y = 0; y < png.height; y++) {
            for (let x = 0; x < png.width; x++) {
                const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
                const same = close(px(x, y), bg);
                if (d > safe + 2) {
                    if (!same) {
                        outside++;
                        firstOutside ??= `(${x}, ${y}) = rgb(${px(x, y).join(', ')})`;
                    }
                } else if (d <= safe) {
                    insideTotal++;
                    if (!same) insideMotif++;
                }
            }
        }
        assert.equal(outside, 0, `${rel} : ${outside} pixel(s) hors du cercle de sécurité diffèrent du fond rgb(${bg.join(', ')}), premier ${firstOutside} : le motif serait rogné par le masque du lanceur`);
        assert.ok(insideMotif >= insideTotal * 0.01, `${rel} : aucun motif dans le cercle de sécurité (${insideMotif} pixel(s) différents du fond sur ${insideTotal})`);
    });
});

describe('7.0 e — iPhone (apple-touch-icon et méta de app/layout.tsx)', () => {
    test('public/icons/apple-touch-icon.png : PNG 180×180 opaque', () => {
        const rel = `public${APPLE_TOUCH_SRC}`;
        const png = readPng(absPath(rel));
        assert.equal(`${png.width}×${png.height}`, '180×180', `${rel} : dimensions IHDR`);
        const fault = opacityFault(png, rel);
        assert.equal(fault, null, `apple-touch-icon non opaque (iOS remplit la transparence en noir) : ${fault}`);
    });

    test('metadata seule source : icons.apple = /icons/apple-touch-icon.png, aucune balise apple-touch-icon ni mobile-web-app-capable écrite à la main', () => {
        const sf = layoutSource();
        const meta = metadataObject(sf);
        const faults: string[] = [];
        const icons = objectProp(meta, 'icons');
        const apple = icons && ts.isObjectLiteralExpression(icons) ? stringValue(objectProp(icons, 'apple')) : null;
        if (apple !== APPLE_TOUCH_SRC) faults.push(`metadata.icons.apple = ${JSON.stringify(apple)} (attendu « ${APPLE_TOUCH_SRC} »)`);
        for (const el of jsxTagsNamed(sf, 'link')) {
            const rel = jsxAttrString(sf, el, 'rel');
            if (rel && /apple-touch-icon/i.test(rel)) {
                faults.push(`<link rel="${rel}"> écrit à la main (ligne ${sf.getLineAndCharacterOfPosition(el.getStart(sf)).line + 1})`);
            }
        }
        for (const el of jsxTagsNamed(sf, 'meta')) {
            const name = jsxAttrString(sf, el, 'name');
            if (name && /^(apple-)?mobile-web-app-capable$/i.test(name)) {
                faults.push(`<meta name="${name}"> écrit à la main (ligne ${sf.getLineAndCharacterOfPosition(el.getStart(sf)).line + 1})`);
            }
        }
        assert.deepEqual(faults, [], `${LAYOUT_REL} :\n  - ${faults.join('\n  - ')}`);
    });

    test('garde-fou : metadata.appleWebApp garde capable: true et un titre, metadata.manifest = /manifest.json', () => {
        const meta = metadataObject(layoutSource());
        const appleWebApp = objectProp(meta, 'appleWebApp');
        assert.ok(appleWebApp && ts.isObjectLiteralExpression(appleWebApp), 'metadata.appleWebApp absent');
        const capable = objectProp(appleWebApp, 'capable');
        assert.ok(capable && capable.kind === ts.SyntaxKind.TrueKeyword, 'metadata.appleWebApp.capable doit rester true (méta apple-mobile-web-app-capable)');
        const title = stringValue(objectProp(appleWebApp, 'title'));
        assert.ok(title && title.trim(), 'metadata.appleWebApp.title absent (méta apple-mobile-web-app-title)');
        assert.equal(stringValue(objectProp(meta, 'manifest')), '/manifest.json', 'metadata.manifest doit rester /manifest.json');
    });
});

describe('7.0 e — accès public des ressources (vrai middleware, sans session ni appel Supabase)', () => {
    test('témoin : /explore (page publique qui lit la session) passe par Supabase, et la mesure le voit', async () => {
        const p = await probeMiddleware('/explore', fakeSessionCookie());
        assert.equal(p.status, 200, `/explore : statut ${p.status}`);
        assert.equal(p.supabaseClient, true, '/explore : la réponse devrait venir de NextResponse.next({ request }) (x-middleware-override-headers) : la mesure ne distingue plus le retour immédiat');
        assert.ok(p.fetches.some((u) => u.includes('/auth/v1/user')), `/explore avec un faux cookie de session : aucun appel /auth/v1/user observé (${JSON.stringify(p.fetches)}) : la mesure « aucun appel Supabase » ne prouverait rien`);
    });

    const fixed = [
        '/manifest.json',
        '/sw.js',
        '/icon-192x192.png',
        '/icon-512x512.png',
        MASKABLE_SRC,
        APPLE_TOUCH_SRC,
        OFFLINE_PATH,
        '/api/features',
        '/api/halls',
        '/api/halls/7a1c3e5f-2b4d-4c6e-8f0a-1b2c3d4e5f60',
        '/api/restaurants/x/tables',
        '/api/restaurants/x/menu',
    ];
    for (const pathname of fixed) {
        test(`${pathname} : retour immédiat (200, aucune redirection, aucun Set-Cookie, aucun appel réseau)`, async () => {
            await assertImmediatePass(pathname);
        });
    }

    test('chaque icône déclarée par le manifest (et chaque raccourci) passe par le retour immédiat', async () => {
        const m = readManifest();
        const paths = new Set<string>();
        for (const i of manifestIcons(m)) if (typeof i.src === 'string') paths.add(i.src);
        if (Array.isArray(m.shortcuts)) {
            for (const s of m.shortcuts as Array<Record<string, unknown>>) {
                if (typeof s?.url === 'string') paths.add(new URL(s.url, 'https://x.invalid').pathname);
                if (Array.isArray(s?.icons)) for (const i of s.icons as ManifestIcon[]) if (typeof i.src === 'string') paths.add(i.src);
            }
        }
        assert.ok(paths.size > 0, 'manifest : aucune ressource à vérifier');
        const faults: string[] = [];
        for (const p of Array.from(paths)) {
            faults.push(...immediateFaults(`${p} sans cookie`, await probeMiddleware(p, null)));
            faults.push(...immediateFaults(`${p} avec un faux cookie de session`, await probeMiddleware(p, fakeSessionCookie())));
        }
        assert.deepEqual(faults, [], `ressources du manifest non publiques :\n  - ${faults.join('\n  - ')}`);
    });

    test('garde-fou : /api/halls/reserve et /api/restaurants/reserve-table exigent toujours une session (aucun préfixe trop large)', async () => {
        for (const pathname of ['/api/halls/reserve', '/api/restaurants/reserve-table', `/api/halls/${randomUUID()}/x`]) {
            const p = await probeMiddleware(pathname, null);
            assert.equal(p.status, 401, `${pathname} sans session : statut ${p.status} (attendu 401 du middleware)`);
            assert.equal(p.next, false, `${pathname} sans session : le middleware ne doit pas laisser passer`);
        }
    });
});

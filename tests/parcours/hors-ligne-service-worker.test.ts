/**
 * Lot 7, tâche 7.1 — service worker public/sw.js : cache versionné limité à la page du billet hors ligne et à
 * ses ressources statiques, en liste blanche (contrat section 5.3, D7, D26, D35, D36 ; écrivain W5).
 * Renverse la décision 4 du lot 6 (service worker sans cache) : signalé au rapport.
 *
 * Harnais node:vm (modèle tests/parcours/push-service-worker.test.ts:79-133, étendu) : faux `caches` avec un
 * vrai stockage (Map par nom de cache, match avec ignoreSearch), faux `fetch` qui sert une coquille HTML
 * (balises /_next/static, charge RSC échappée), une CSS avec url(/_next/static/media/…) et les ressources
 * publiques, réponses réseau fabriquées (type basic, url, redirected) ; évènements fetch en objets simples
 * (new Request(url, { mode: 'navigate' }) lève sous Node) ; respondWith exigé synchrone.
 *
 * Cas (tous rouges aujourd'hui : public/sw.js du lot 6 n'a ni écouteur fetch ni cache, SW_VERSION 'lot6-1') :
 *  - aucune interception (ni respondWith, ni fetch, ni put) : /api/… (cors et navigation, réseau coupé
 *    compris), POST /billet/hors-ligne, /tickets?_rsc=1, en-tête RSC (y compris sur la page hors ligne),
 *    Next-Router-Prefetch, /login, /admin/dashboard, /controller/scanner, /partner/dashboard, autre origine ;
 *  - navigation /billet/hors-ligne?id=… servie depuis le cache (même quand le réseau répond autre chose ou
 *    est coupé), revalidation sans rejet ;
 *  - navigation /tickets ou / : réseau coupé → 302 vers /billet/hors-ligne ; réseau en service → réponse du
 *    réseau, rien en cache ; réponse préchargée (navigationPreload) utilisée ;
 *  - ressource statique et ressource publique en cache servies depuis le cache, sans réseau ;
 *  - installation : skipWaiting, coquille téléchargée sans cookie (credentials omit, cache no-cache, redirect
 *    manual), cache ev-hors-ligne-lot7-1 = coquille + ressources découvertes (dont la charge RSC échappée et
 *    les url() de la CSS) + PUBLIC_ASSETS, aucune clé /api/ ;
 *  - coquille redirigée (opaqueredirect, ou redirected vers /login), 401, 403, no-store, non HTML → jamais en
 *    cache ; réseau coupé à l'installation → install résolu, avertissement « [sw lot7-1] » journalisé ;
 *  - PREPARE_OFFLINE : nouvelle découverte ; un ensemble incomplet (ressource en 500) ne remplace rien ;
 *  - complément : /_next/static/ demandé par un onglet de /billet/hors-ligne et absent du cache → ajouté ;
 *    demandé par un autre onglet → pas ajouté ;
 *  - activation : event-village-v1, event-village-runtime, ev-hors-ligne-lot6-x supprimés, cache courant et
 *    cache étranger gardés, navigationPreload.enable() si disponible, clients.claim() ;
 *  - source sans commentaires : un seul `.put(` (dans cachePut), ni addAll ni cache.add, règle /api/ avant
 *    tout respondWith, aucun indexedDB, importScripts, Authorization, credentials: 'include', requestPermission.
 * Fin de suite : assertTerrainInvariants.
 */
import '../helpers/env';
import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { assertTerrainInvariants } from './terrain-helpers';

after(async () => {
    await assertTerrainInvariants('hors-ligne-service-worker');
});

const ROOT = process.cwd();
const SW_FILE = path.join(ROOT, 'public', 'sw.js');
const ORIGIN = 'https://app.eventvillage.sn';
const OFFLINE_PATH = '/billet/hors-ligne';
const CURRENT_CACHE = 'ev-hors-ligne-lot7-1';
const PUBLIC_ASSETS = ['/manifest.json', '/favicon.ico', '/branding/event-village-mark.svg', '/icon-192x192.png', '/icon-512x512.png', '/icons/icon-maskable-512.png', '/icons/apple-touch-icon.png'];
const TICKET_ID = '7b0c6a52-3f1e-4d2a-9c11-5e8f2a4b6c01';

// ── Ressources servies par le faux réseau ──────────────────────────────────

const CSS_PATH = '/_next/static/css/app-3c1f.css';
const FONT_PATH = '/_next/static/media/inter-9a7b.woff2';
const MOTIF_PATH = '/_next/static/media/motif-2c3d.svg';
const WEBPACK_PATH = '/_next/static/chunks/webpack-1a2b.js';
const MAIN_PATH = '/_next/static/chunks/main-app-4d5e.js';
const PAGE_CHUNK = '/_next/static/chunks/app/billet/hors-ligne/page-7f8e.js';
const NEW_CHUNK = '/_next/static/chunks/app/billet/hors-ligne/page-9e0f.js';

function shellHtml(version: string, pageChunk: string = PAGE_CHUNK): string {
    const rsc = pageChunk.replace('/_next/', '');
    return String.raw`<!DOCTYPE html><html lang="fr"><head>
<link rel="stylesheet" href="${CSS_PATH}" data-precedence="next"/>
<link rel="preload" as="font" href="${FONT_PATH}" crossorigin="" type="font/woff2"/>
<script src="${WEBPACK_PATH}" async=""></script><script src="${MAIN_PATH}" async=""></script>
<title>Billet hors ligne</title></head><body><main data-ev-shell="${version}"></main>
<script>self.__next_f.push([1,"2:I[\"8812\",[\"${rsc}\"],\"default\"]\n"])</script></body></html>`;
}

const CSS_TEXT = `@font-face{font-family:Inter;src:url(${FONT_PATH}) format("woff2")}.ev-motif{background:url(${MOTIF_PATH})}`;

function contentType(p: string): string {
    if (p === OFFLINE_PATH || p === '/' || p === '/tickets') return 'text/html; charset=utf-8';
    if (p.endsWith('.css')) return 'text/css';
    if (p.endsWith('.js')) return 'application/javascript';
    if (p.endsWith('.json')) return 'application/manifest+json';
    if (p.endsWith('.svg')) return 'image/svg+xml';
    if (p.endsWith('.woff2')) return 'font/woff2';
    return 'image/png';
}

interface NetInit { status?: number; headers?: Record<string, string>; type?: string; redirected?: boolean }

/** Réponse réseau fabriquée : type, url et redirected fixés (impossible sur un Response construit). */
class NetResponse {
    readonly status: number;
    readonly ok: boolean;
    readonly type: string;
    readonly redirected: boolean;
    readonly headers: Headers;
    readonly statusText = '';
    readonly bodyUsed = false;
    constructor(readonly url: string, private readonly content: string, private readonly init: NetInit = {}) {
        this.status = init.status ?? 200;
        this.ok = this.status >= 200 && this.status < 300;
        this.type = init.type ?? 'basic';
        this.redirected = init.redirected ?? false;
        this.headers = new Headers(init.headers ?? {});
    }
    async text(): Promise<string> { return this.content; }
    async json(): Promise<unknown> { return JSON.parse(this.content); }
    async arrayBuffer(): Promise<ArrayBuffer> { return new TextEncoder().encode(this.content).buffer as ArrayBuffer; }
    async blob(): Promise<Blob> { return new Blob([this.content], { type: this.headers.get('content-type') ?? '' }); }
    clone(): NetResponse { return new NetResponse(this.url, this.content, this.init); }
}

function ok(p: string, body?: string, extra: NetInit = {}): NetResponse {
    const text = body ?? (p === OFFLINE_PATH ? shellHtml('v1') : p === CSS_PATH ? CSS_TEXT : `contenu de ${p}`);
    return new NetResponse(`${ORIGIN}${p}`, text, { status: 200, ...extra, headers: { 'content-type': contentType(p), ...(extra.headers ?? {}) } });
}

/** Réseau : chemin → réponse (fonction appelée à chaque requête) ; absent → 404 ; `down` → échec réseau. */
type Route = () => NetResponse;

function defaultRoutes(): Map<string, Route> {
    const m = new Map<string, Route>();
    for (const p of [OFFLINE_PATH, CSS_PATH, FONT_PATH, MOTIF_PATH, WEBPACK_PATH, MAIN_PATH, PAGE_CHUNK, ...PUBLIC_ASSETS, '/', '/tickets']) {
        m.set(p, () => ok(p, p === '/' || p === '/tickets' ? `<html><body>page ${p} du réseau</body></html>` : undefined));
    }
    return m;
}

// ── Faux stockage de caches ────────────────────────────────────────────────

type Cached = { clone?: () => unknown; text?: () => Promise<string> };

function keyOf(req: unknown): string {
    const raw = typeof req === 'string' ? req : String((req as { url?: unknown })?.url ?? req);
    return new URL(raw, ORIGIN).href;
}

function stripSearch(href: string): string {
    const u = new URL(href);
    return `${u.origin}${u.pathname}`;
}

class FakeCache {
    readonly store = new Map<string, Cached>();
    constructor(readonly name: string, private readonly h: Harness) {}
    async put(req: unknown, res: Cached): Promise<void> {
        const url = keyOf(req);
        this.h.puts.push({ cache: this.name, url });
        this.store.set(url, res);
    }
    async match(req: unknown, opts: { ignoreSearch?: boolean } = {}): Promise<unknown> {
        const url = keyOf(req);
        for (const [k, v] of Array.from(this.store)) {
            if (k === url || (opts.ignoreSearch && stripSearch(k) === stripSearch(url))) return typeof v.clone === 'function' ? v.clone() : v;
        }
        return undefined;
    }
    async keys(): Promise<Request[]> { return Array.from(this.store.keys()).map((u) => new Request(u)); }
    async delete(req: unknown): Promise<boolean> { return this.store.delete(keyOf(req)); }
    async add(): Promise<void> { throw new Error('cache.add interdit : toute écriture passe par cachePut (contrat 5.3)'); }
    async addAll(): Promise<void> { throw new Error('cache.addAll interdit : toute écriture passe par cachePut (contrat 5.3)'); }
}

class FakeCaches {
    readonly map = new Map<string, FakeCache>();
    constructor(private readonly h: Harness) {}
    async open(name: string): Promise<FakeCache> {
        if (!this.map.has(name)) this.map.set(name, new FakeCache(name, this.h));
        return this.map.get(name)!;
    }
    async keys(): Promise<string[]> { return Array.from(this.map.keys()); }
    async has(name: string): Promise<boolean> { return this.map.has(name); }
    async delete(name: string): Promise<boolean> {
        this.h.deleted.push(name);
        return this.map.delete(name);
    }
    async match(req: unknown, opts: { ignoreSearch?: boolean; cacheName?: string } = {}): Promise<unknown> {
        for (const [name, c] of Array.from(this.map)) {
            if (opts.cacheName && opts.cacheName !== name) continue;
            const hit = await c.match(req, opts);
            if (hit) return hit;
        }
        return undefined;
    }
}

// ── Harnais ────────────────────────────────────────────────────────────────

type Listener = (event: unknown) => unknown;

interface FetchCall { url: string; init: Record<string, unknown> }

interface Harness {
    listeners: Map<string, Listener[]>;
    caches: FakeCaches;
    routes: Map<string, Route>;
    down: boolean;
    fetchCalls: FetchCall[];
    puts: Array<{ cache: string; url: string }>;
    deleted: string[];
    skipWaiting: number;
    claimed: number;
    preloadEnabled: number;
    windows: Map<string, string>;
    logs: { log: string[]; warn: string[]; error: string[] };
}

class SwResponse extends Response {
    /** Response.redirect relatif résolu sur l'origine du service worker (comme dans un navigateur). */
    static redirect(url: string | URL, status?: number): Response {
        return Response.redirect(new URL(String(url), ORIGIN).href, status);
    }
}

function loadServiceWorker(opts: { navigationPreload?: boolean } = {}): Harness {
    const source = fs.readFileSync(SW_FILE, 'utf8');
    const h = {
        listeners: new Map(), routes: defaultRoutes(), down: false, fetchCalls: [], puts: [], deleted: [],
        skipWaiting: 0, claimed: 0, preloadEnabled: 0, windows: new Map(), logs: { log: [], warn: [], error: [] },
    } as unknown as Harness;
    h.caches = new FakeCaches(h);
    const record = (kind: 'log' | 'warn' | 'error') => (...args: unknown[]) => { h.logs[kind].push(args.map(String).join(' ')); };
    const registration: Record<string, unknown> = {
        scope: `${ORIGIN}/`,
        showNotification: async () => undefined,
        getNotifications: async () => [],
        pushManager: { subscribe: async () => null, getSubscription: async () => null },
    };
    if (opts.navigationPreload !== false) registration.navigationPreload = { enable: async () => { h.preloadEnabled += 1; }, setHeaderValue: async () => undefined };
    const sandbox: Record<string, unknown> = {
        addEventListener: (type: string, fn: Listener) => { h.listeners.set(type, [...(h.listeners.get(type) ?? []), fn]); },
        skipWaiting: () => { h.skipWaiting += 1; return Promise.resolve(); },
        clients: {
            claim: async () => { h.claimed += 1; },
            matchAll: async () => Array.from(h.windows, ([id, url]) => ({ id, url, type: 'window' })),
            get: async (id: string) => (h.windows.has(id) ? { id, url: h.windows.get(id), type: 'window' } : undefined),
            openWindow: async () => null,
        },
        registration,
        location: new URL(`${ORIGIN}/sw.js`),
        caches: h.caches,
        fetch: async (input: unknown, init: Record<string, unknown> = {}) => {
            const url = keyOf(input);
            h.fetchCalls.push({ url, init: { ...init } });
            if (h.down) throw new TypeError('Failed to fetch');
            const u = new URL(url);
            if (u.origin !== ORIGIN) throw new TypeError('Failed to fetch (autre origine)');
            const route = h.routes.get(u.pathname);
            return route ? route() : new NetResponse(url, 'introuvable', { status: 404, headers: { 'content-type': 'text/plain' } });
        },
        console: { log: record('log'), info: record('log'), debug: record('log'), warn: record('warn'), error: record('error') },
        URL, URLSearchParams, Response: SwResponse, Request, Headers, Blob, TextEncoder, TextDecoder, atob, btoa,
        setTimeout, clearTimeout, queueMicrotask, structuredClone,
    };
    sandbox.self = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(source, sandbox, { filename: 'public/sw.js' });
    return h;
}

async function flush(): Promise<void> {
    for (let i = 0; i < 10; i++) await new Promise((r) => setTimeout(r, 0));
}

interface Dispatched {
    responded: number;
    response: unknown;
    responseError: unknown;
    settled: PromiseSettledResult<unknown>[];
}

/** Dispatch d'un évènement : respondWith doit être appelé pendant l'appel de l'écouteur (synchrone). */
async function dispatch(h: Harness, type: string, event: Record<string, unknown>): Promise<Dispatched> {
    const responses: unknown[] = [];
    const waits: Promise<unknown>[] = [];
    let sync = true;
    let late = 0;
    const ev = {
        ...event,
        respondWith: (p: unknown) => { if (!sync) late += 1; responses.push(p); },
        waitUntil: (p: unknown) => { waits.push(Promise.resolve(p)); },
    };
    for (const fn of h.listeners.get(type) ?? []) fn(ev);
    sync = false;
    let response: unknown;
    let responseError: unknown = null;
    if (responses.length > 0) {
        try {
            response = await Promise.resolve(responses[0]);
        } catch (err) {
            responseError = err; // gardé pour l'assertion du cas (une réponse interceptée qui échoue est un défaut)
        }
    }
    await flush();
    const settled = await Promise.allSettled(waits);
    assert.equal(late, 0, `${type} : respondWith appelé après le retour de l'écouteur (doit être synchrone)`);
    assert.ok(responses.length <= 1, `${type} : respondWith appelé ${responses.length} fois`);
    return { responded: responses.length, response, responseError, settled };
}

interface FetchSpec { method?: string; mode?: string; headers?: Record<string, string>; clientId?: string; preload?: unknown }

function fetchEvent(url: string, spec: FetchSpec = {}): Record<string, unknown> {
    const href = new URL(url, ORIGIN).href;
    const mode = spec.mode ?? 'cors';
    const request = {
        url: href, method: spec.method ?? 'GET', mode, headers: new Headers(spec.headers ?? {}),
        destination: mode === 'navigate' ? 'document' : '', credentials: 'same-origin', redirect: mode === 'navigate' ? 'manual' : 'follow',
        clone() { return { ...request }; },
    };
    return { request, clientId: spec.clientId ?? '', resultingClientId: '', preloadResponse: Promise.resolve(spec.preload) };
}

async function install(h: Harness): Promise<PromiseSettledResult<unknown>[]> {
    return (await dispatch(h, 'install', {})).settled;
}

async function cachedPaths(h: Harness, name = CURRENT_CACHE): Promise<string[]> {
    const c = h.caches.map.get(name);
    if (!c) return [];
    return Array.from(c.store.keys()).map((k) => new URL(k).pathname).sort();
}

async function allCachedUrls(h: Harness): Promise<string[]> {
    const out: string[] = [];
    for (const c of Array.from(h.caches.map.values())) out.push(...Array.from(c.store.keys()));
    return out;
}

async function bodyOf(r: unknown): Promise<string> {
    assert.ok(r && typeof (r as { text?: unknown }).text === 'function', `réponse lisible attendue (reçu ${String(r)})`);
    return (r as { text: () => Promise<string> }).text();
}

function rejected(s: PromiseSettledResult<unknown>[]): string[] {
    return s.filter((x): x is PromiseRejectedResult => x.status === 'rejected').map((x) => String(x.reason));
}

const EXPECTED_AFTER_INSTALL = [OFFLINE_PATH, CSS_PATH, FONT_PATH, MOTIF_PATH, WEBPACK_PATH, MAIN_PATH, PAGE_CHUNK, ...PUBLIC_ASSETS].sort();

async function installed(): Promise<Harness> {
    const h = loadServiceWorker();
    const settled = await install(h);
    assert.deepEqual(rejected(settled), [], 'installation sans rejet');
    assert.deepEqual(await cachedPaths(h), EXPECTED_AFTER_INSTALL, 'précondition : cache rempli à l’installation');
    return h;
}

// ── Liste blanche du gestionnaire fetch ───────────────────────────────────

describe('7.1 public/sw.js : gestionnaire fetch en liste blanche (contrat 5.3)', () => {
    test('aucune interception : API, POST, requêtes RSC et de préchargement, autres pages connectées, autre origine', async () => {
        assert.equal((loadServiceWorker().listeners.get('fetch') ?? []).length, 1, 'un écouteur fetch (liste blanche du contrat 5.3)');
        const h = await installed();
        const cases: Array<[string, string, FetchSpec]> = [
            ['GET /api/tickets/…/offline-codes', `/api/tickets/${TICKET_ID}/offline-codes`, {}],
            ['navigation vers /api/tickets', '/api/tickets', { mode: 'navigate' }],
            ['GET /api/auth/me', '/api/auth/me', {}],
            ['GET /api/push/config', '/api/push/config', {}],
            ['POST /billet/hors-ligne', OFFLINE_PATH, { method: 'POST', mode: 'navigate' }],
            ['/tickets?_rsc=1', '/tickets?_rsc=1', {}],
            ['/tickets avec en-tête RSC', '/tickets', { headers: { RSC: '1' } }],
            ['/billet/hors-ligne avec en-tête RSC', `${OFFLINE_PATH}?id=${TICKET_ID}`, { headers: { RSC: '1' } }],
            ['/tickets avec Next-Router-Prefetch', '/tickets', { headers: { 'Next-Router-Prefetch': '1', RSC: '1' } }],
            ['navigation /login', '/login', { mode: 'navigate' }],
            ['navigation /admin/dashboard', '/admin/dashboard', { mode: 'navigate' }],
            ['navigation /controller/scanner', '/controller/scanner', { mode: 'navigate' }],
            ['navigation /partner/dashboard', '/partner/dashboard', { mode: 'navigate' }],
            ['autre origine', 'https://tile.openstreetmap.org/12/1910/1880.png', { mode: 'no-cors' }],
        ];
        const putsBefore = h.puts.length;
        for (const down of [false, true]) {
            h.down = down;
            for (const [label, url, spec] of cases) {
                const callsBefore = h.fetchCalls.length;
                const d = await dispatch(h, 'fetch', fetchEvent(url, spec));
                const what = `${label}${down ? ' (réseau coupé)' : ''}`;
                assert.equal(d.responded, 0, `${what} : aucun respondWith (le réseau normal répond)`);
                assert.deepEqual(h.fetchCalls.slice(callsBefore).map((c) => c.url), [], `${what} : le service worker ne refait pas la requête`);
                assert.deepEqual(rejected(d.settled), [], `${what} : aucune promesse rejetée`);
            }
        }
        assert.deepEqual(h.puts.slice(putsBefore), [], 'aucune écriture dans le cache pour ces requêtes');
        assert.deepEqual((await allCachedUrls(h)).filter((u) => new URL(u).pathname.startsWith('/api/')), [], 'aucune clé /api/');
    });

    test('navigation /billet/hors-ligne?id=… servie depuis le cache (réseau qui répond autre chose, puis réseau coupé)', async () => {
        const h = await installed();
        h.routes.set(OFFLINE_PATH, () => ok(OFFLINE_PATH, shellHtml('v2')));
        const d = await dispatch(h, 'fetch', fetchEvent(`${OFFLINE_PATH}?id=${TICKET_ID}`, { mode: 'navigate' }));
        assert.equal(d.responded, 1, 'la coquille est servie par le service worker');
        assert.equal(d.responseError, null, `réponse sans erreur : ${String(d.responseError)}`);
        assert.equal(await bodyOf(d.response), shellHtml('v1'), 'cache d’abord : coquille en cache, sans attendre le réseau');
        assert.deepEqual(rejected(d.settled), [], 'revalidation en arrière-plan sans rejet');

        h.down = true;
        const off = await dispatch(h, 'fetch', fetchEvent(`${OFFLINE_PATH}?id=${TICKET_ID}`, { mode: 'navigate' }));
        assert.equal(off.responded, 1, 'hors ligne : coquille servie');
        assert.match(await bodyOf(off.response), /data-ev-shell="v[12]"/, 'hors ligne : la coquille en cache est rendue');
        assert.deepEqual(rejected(off.settled), [], 'hors ligne : l’échec de la revalidation est rattrapé');
    });

    test('navigation /tickets ou / : réseau coupé → 302 vers /billet/hors-ligne ; réseau en service → réponse du réseau, rien en cache ; réponse préchargée utilisée', async () => {
        const h = await installed();
        h.down = true;
        for (const p of ['/tickets', '/']) {
            const d = await dispatch(h, 'fetch', fetchEvent(p, { mode: 'navigate' }));
            assert.equal(d.responded, 1, `${p} hors ligne : repli du service worker`);
            assert.equal(d.responseError, null, `${p} : ${String(d.responseError)}`);
            const r = d.response as Response;
            assert.equal(r.status, 302, `${p} hors ligne : redirection 302`);
            assert.equal(new URL(String(r.headers.get('location')), ORIGIN).pathname, OFFLINE_PATH, `${p} hors ligne : redirection vers ${OFFLINE_PATH}`);
        }
        h.down = false;
        const putsBefore = h.puts.length;
        const online = await dispatch(h, 'fetch', fetchEvent('/tickets', { mode: 'navigate' }));
        assert.equal(online.responded, 1, 'navigation /tickets interceptée (pour pouvoir se replier en cas d’échec)');
        assert.equal(online.responseError, null, `réseau en service : ${String(online.responseError)}`);
        assert.equal(await bodyOf(online.response), '<html><body>page /tickets du réseau</body></html>', 'réseau en service : page du réseau');
        const preload = ok('/tickets', '<html><body>réponse préchargée</body></html>');
        const callsBefore = h.fetchCalls.length;
        const preloaded = await dispatch(h, 'fetch', fetchEvent('/tickets', { mode: 'navigate', preload }));
        assert.equal(preloaded.responded, 1, 'navigation /tickets interceptée');
        assert.equal(await bodyOf(preloaded.response), '<html><body>réponse préchargée</body></html>', 'réponse de navigationPreload utilisée');
        assert.deepEqual(h.fetchCalls.slice(callsBefore).filter((c) => new URL(c.url).pathname === '/tickets'), [], 'pas de second téléchargement de la page quand la réponse préchargée existe');
        assert.deepEqual(h.puts.slice(putsBefore), [], 'la page connectée n’est jamais mise en cache');
        assert.ok(!(await cachedPaths(h)).includes('/tickets'), '/tickets absent du cache');
    });

    test('ressource statique et ressource publique en cache : servies depuis le cache, sans réseau', async () => {
        const h = await installed();
        for (const p of [WEBPACK_PATH, PAGE_CHUNK, '/manifest.json', '/icons/icon-maskable-512.png']) {
            const callsBefore = h.fetchCalls.length;
            const d = await dispatch(h, 'fetch', fetchEvent(p, {}));
            assert.equal(d.responded, 1, `${p} : servi par le service worker`);
            assert.equal(await bodyOf(d.response), `contenu de ${p}`, `${p} : contenu du cache`);
            assert.deepEqual(h.fetchCalls.slice(callsBefore).filter((c) => new URL(c.url).pathname === p), [], `${p} : cache d’abord, aucun appel réseau`);
        }
    });

    test('complément : /_next/static/ demandé par l’onglet de /billet/hors-ligne et absent du cache → ajouté ; par un autre onglet → pas ajouté', async () => {
        const h = await installed();
        const late = '/_next/static/chunks/late-9a1b.js';
        const other = '/_next/static/chunks/other-2c3d.js';
        h.routes.set(late, () => ok(late));
        h.routes.set(other, () => ok(other));
        h.windows.set('onglet-hors-ligne', `${ORIGIN}${OFFLINE_PATH}?id=${TICKET_ID}`);
        h.windows.set('onglet-billets', `${ORIGIN}/tickets`);
        const d = await dispatch(h, 'fetch', fetchEvent(late, { clientId: 'onglet-hors-ligne' }));
        assert.equal(d.responded, 1, 'ressource servie');
        assert.equal(await bodyOf(d.response), `contenu de ${late}`, 'ressource du réseau');
        await flush();
        assert.ok((await cachedPaths(h)).includes(late), `${late} ajouté au cache (complément de la coquille)`);
        await dispatch(h, 'fetch', fetchEvent(other, { clientId: 'onglet-billets' }));
        await flush();
        assert.ok(!(await cachedPaths(h)).includes(other), `${other} demandé par /tickets : pas mis en cache`);
    });
});

// ── Installation, rafraîchissement, activation ────────────────────────────

describe('7.1 public/sw.js : installation, PREPARE_OFFLINE et activation (contrat 5.3)', () => {
    test('installation : skipWaiting, coquille sans cookie, cache ev-hors-ligne-lot7-1 = coquille + ressources découvertes + PUBLIC_ASSETS', async () => {
        const h = loadServiceWorker();
        const settled = await install(h);
        assert.deepEqual(rejected(settled), [], 'installation sans rejet');
        assert.equal(h.skipWaiting, 1, 'skipWaiting à l’installation');
        const shellCalls = h.fetchCalls.filter((c) => new URL(c.url).pathname === OFFLINE_PATH);
        assert.ok(shellCalls.length >= 1, 'la coquille est téléchargée à l’installation');
        for (const c of shellCalls) {
            assert.deepEqual({ credentials: c.init.credentials, cache: c.init.cache, redirect: c.init.redirect },
                { credentials: 'omit', cache: 'no-cache', redirect: 'manual' }, `téléchargement de la coquille sans cookie ni redirection suivie : ${JSON.stringify(c.init)}`);
        }
        assert.deepEqual((await h.caches.keys()).filter((k) => k.startsWith('ev-hors-ligne-')), [CURRENT_CACHE], 'un seul cache versionné ev-hors-ligne-lot7-1');
        assert.deepEqual(await cachedPaths(h), EXPECTED_AFTER_INSTALL,
            'coquille, ressources de la coquille (balises, charge RSC échappée, url() de la CSS) et ressources publiques, rien d’autre');
        assert.deepEqual((await allCachedUrls(h)).filter((u) => /\/api\/|_rsc/.test(u)), [], 'aucune clé /api/ ni _rsc');
        const shell = await (await h.caches.open(CURRENT_CACHE)).match(`${ORIGIN}${OFFLINE_PATH}?id=${TICKET_ID}`, { ignoreSearch: true });
        assert.equal(await bodyOf(shell), shellHtml('v1'), 'coquille en cache retrouvée avec ignoreSearch');
    });

    test('coquille redirigée, 401, 403, no-store ou non HTML : jamais mise en cache ; installation résolue', async () => {
        const variants: Array<[string, () => NetResponse]> = [
            ['redirection non suivie (opaqueredirect)', () => new NetResponse(`${ORIGIN}${OFFLINE_PATH}`, '', { status: 0, type: 'opaqueredirect' })],
            ['réponse redirigée vers /login', () => new NetResponse(`${ORIGIN}/login`, '<html>connexion</html>', { status: 200, redirected: true, headers: { 'content-type': 'text/html' } })],
            ['401', () => new NetResponse(`${ORIGIN}${OFFLINE_PATH}`, '{"error":"Authentification requise."}', { status: 401, headers: { 'content-type': 'application/json' } })],
            ['403', () => new NetResponse(`${ORIGIN}${OFFLINE_PATH}`, '{"error":"Interdit"}', { status: 403, headers: { 'content-type': 'application/json' } })],
            ['Cache-Control: no-store', () => ok(OFFLINE_PATH, shellHtml('v1'), { headers: { 'cache-control': 'private, no-store' } })],
            ['corps non HTML', () => ok(OFFLINE_PATH, '{"tickets":[]}', { headers: { 'content-type': 'application/json' } })],
        ];
        // Témoin (garde-fou contre un succès par absence de cache) : la même installation avec une coquille conforme la met en cache.
        const witness = loadServiceWorker();
        await install(witness);
        assert.ok((await cachedPaths(witness)).includes(OFFLINE_PATH), 'témoin : une coquille conforme est mise en cache à l’installation');
        for (const [label, route] of variants) {
            const h = loadServiceWorker();
            h.routes.set(OFFLINE_PATH, route);
            const settled = await install(h);
            assert.deepEqual(rejected(settled), [], `${label} : installation résolue (le push du lot 6 en dépend)`);
            const urls = await allCachedUrls(h);
            assert.deepEqual(urls.filter((u) => [OFFLINE_PATH, '/login'].includes(new URL(u).pathname)), [], `${label} : coquille absente du cache`);
            assert.deepEqual(urls.filter((u) => /\/api\//.test(u)), [], `${label} : aucune clé /api/`);
        }
    });

    test('réseau coupé à l’installation : install résolu, avertissement « [sw lot7-1] » journalisé, cache vide', async () => {
        const h = loadServiceWorker();
        h.down = true;
        const settled = await install(h);
        assert.deepEqual(rejected(settled), [], 'installation résolue malgré le réseau coupé');
        assert.equal(h.skipWaiting, 1, 'skipWaiting');
        assert.ok(h.logs.warn.some((w) => w.includes('[sw lot7-1]')), `avertissement journalisé avec le préfixe [sw lot7-1] (reçu ${JSON.stringify(h.logs.warn)})`);
        assert.deepEqual(await allCachedUrls(h), [], 'rien en cache');
    });

    test('PREPARE_OFFLINE : nouvelle découverte ; un ensemble incomplet (ressource en 500) ne remplace rien', async () => {
        const prepare = async (h: Harness): Promise<void> => {
            const before = h.fetchCalls.length;
            await dispatch(h, 'message', { data: { type: 'PREPARE_OFFLINE' }, source: { id: 'onglet' } });
            if (!h.fetchCalls.slice(before).some((c) => new URL(c.url).pathname === OFFLINE_PATH)) {
                await dispatch(h, 'message', { data: 'PREPARE_OFFLINE', source: { id: 'onglet' } });
            }
            await flush();
            assert.ok(h.fetchCalls.slice(before).some((c) => new URL(c.url).pathname === OFFLINE_PATH), 'PREPARE_OFFLINE relance le téléchargement de la coquille');
        };

        const broken = await installed();
        broken.routes.set(OFFLINE_PATH, () => ok(OFFLINE_PATH, shellHtml('v2', NEW_CHUNK)));
        broken.routes.set(NEW_CHUNK, () => new NetResponse(`${ORIGIN}${NEW_CHUNK}`, 'erreur', { status: 500, headers: { 'content-type': 'text/plain' } }));
        await prepare(broken);
        assert.deepEqual(await cachedPaths(broken), EXPECTED_AFTER_INSTALL, 'ensemble incomplet : l’ancien ensemble reste entier');
        const kept = await (await broken.caches.open(CURRENT_CACHE)).match(`${ORIGIN}${OFFLINE_PATH}`, { ignoreSearch: true });
        assert.equal(await bodyOf(kept), shellHtml('v1'), 'ensemble incomplet : l’ancienne coquille reste en cache');

        const fresh = await installed();
        fresh.routes.set(OFFLINE_PATH, () => ok(OFFLINE_PATH, shellHtml('v2', NEW_CHUNK)));
        fresh.routes.set(NEW_CHUNK, () => ok(NEW_CHUNK));
        await prepare(fresh);
        assert.ok((await cachedPaths(fresh)).includes(NEW_CHUNK), 'nouvelle ressource de la coquille mise en cache');
        const shell = await (await fresh.caches.open(CURRENT_CACHE)).match(`${ORIGIN}${OFFLINE_PATH}`, { ignoreSearch: true });
        assert.equal(await bodyOf(shell), shellHtml('v2', NEW_CHUNK), 'nouvelle coquille en cache');
    });

    test('activation : anciens caches supprimés (event-village-*, ev-hors-ligne-* autres), courant et étranger gardés, navigationPreload, claim', async () => {
        for (const preload of [true, false]) {
            const h = loadServiceWorker({ navigationPreload: preload });
            for (const name of ['event-village-v1', 'event-village-runtime', 'ev-hors-ligne-lot6-x', CURRENT_CACHE, 'autre-application']) await h.caches.open(name);
            const d = await dispatch(h, 'activate', {});
            assert.deepEqual(rejected(d.settled), [], `activation sans rejet (navigationPreload ${preload ? 'disponible' : 'absent'})`);
            assert.deepEqual([...h.deleted].sort(), ['ev-hors-ligne-lot6-x', 'event-village-runtime', 'event-village-v1'], 'anciens caches supprimés, les autres laissés');
            assert.deepEqual((await h.caches.keys()).sort(), [CURRENT_CACHE, 'autre-application'].sort(), 'cache courant et cache étranger gardés');
            assert.equal(h.claimed, 1, 'clients.claim()');
            assert.equal(h.preloadEnabled, preload ? 1 : 0, 'navigationPreload.enable() quand il est disponible');
        }
    });
});

// ── Contrôle de la source ─────────────────────────────────────────────────

function stripComments(src: string): string {
    return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '$1');
}

/** Texte entre le délimiteur ouvrant à l'indice `open` et son délimiteur fermant (inclus). */
function balanced(src: string, open: number, o: string, c: string): string {
    let depth = 0;
    for (let i = open; i < src.length; i++) {
        if (src[i] === o) depth++;
        else if (src[i] === c && --depth === 0) return src.slice(open, i + 1);
    }
    assert.fail(`public/sw.js : délimiteurs ${o}${c} non équilibrés`);
}

/** Corps d'une fonction nommée (function nom(…) { … } ou const nom = (…) => { … }), null si absente. */
function functionBody(src: string, name: string): { start: number; text: string } | null {
    const def = new RegExp(`(?:async\\s+)?function\\s+${name}\\s*\\(|(?:const|let)\\s+${name}\\s*=`).exec(src);
    if (!def) return null;
    const start = src.indexOf('{', def.index);
    return start < 0 ? null : { start, text: balanced(src, start, '{', '}') };
}

describe('7.1 public/sw.js : source (contrat 5.3)', () => {
    test('un seul .put( dans cachePut, pas d’addAll ; règle /api/ avant tout respondWith ; aucun motif interdit ; constantes', () => {
        const src = stripComments(fs.readFileSync(SW_FILE, 'utf8'));
        assert.match(src, /SW_VERSION\s*=\s*['"]lot7-1['"]/, 'SW_VERSION = \'lot7-1\'');
        assert.match(src, /LEGACY_CACHES\s*=\s*\[[^\]]*['"]event-village-v1['"]/, 'LEGACY_CACHES garde event-village-v1 (ancien cache purgé à l’activation, public/sw.js)');
        assert.match(src, /OFFLINE_PATH\s*=\s*['"]\/billet\/hors-ligne['"]/, 'OFFLINE_PATH = \'/billet/hors-ligne\'');
        // Constantes qui valent '/api/' (ex. const API_PREFIX = '/api/') : acceptées à la place du littéral.
        const apiNames = Array.from(src.matchAll(/(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=\s*['"`]\/api\/['"`]/g)).map((m) => m[1]);
        const mentionsApi = (text: string): number => {
            const hits = [text.search(/['"`]\/api\//), ...apiNames.map((n) => text.search(new RegExp(`\\b${n}\\b`)))].filter((i) => i >= 0);
            return hits.length > 0 ? Math.min(...hits) : -1;
        };

        const puts = Array.from(src.matchAll(/\.put\s*\(/g));
        assert.equal(puts.length, 1, `un seul appel .put( (trouvé ${puts.length})`);
        const cachePut = functionBody(src, 'cachePut');
        assert.ok(cachePut, 'fonction cachePut');
        assert.ok(puts[0].index! > cachePut.start && puts[0].index! < cachePut.start + cachePut.text.length, 'le seul .put( est dans cachePut');
        assert.ok(mentionsApi(cachePut.text) >= 0, 'cachePut revérifie : refus de /api/');
        for (const [re, what] of [[/\.ok\b/, 'response.ok'], [/['"]basic['"]/, 'type basic'], [/redirected/, '!redirected'], [/no-store/i, 'Cache-Control: no-store']] as const) {
            assert.match(cachePut.text, re, `cachePut revérifie : ${what}`);
        }
        assert.doesNotMatch(src, /\.addAll\s*\(/, 'pas d’addAll (toute écriture passe par cachePut)');

        // Écouteur fetch : la règle /api/ (dans l'écouteur ou dans une fonction qu'il appelle avant) précède respondWith.
        const fetchAt = src.search(/addEventListener\s*\(\s*['"]fetch['"]/);
        assert.ok(fetchAt >= 0, 'écouteur fetch');
        const listener = balanced(src, src.indexOf('(', fetchAt), '(', ')');
        const respondAt = listener.search(/respondWith\s*\(/);
        const prefix = respondAt >= 0 ? listener.slice(0, respondAt) : listener;
        const helpers = Array.from(new Set(Array.from(prefix.matchAll(/\b([A-Za-z_$][\w$]*)\s*\(/g)).map((m) => m[1])))
            .map((n) => functionBody(src, n)).filter((b): b is { start: number; text: string } => b !== null);
        const apiFirst = mentionsApi(prefix) >= 0 || helpers.some((b) => {
            const api = mentionsApi(b.text);
            const respond = b.text.search(/respondWith\s*\(/);
            return api >= 0 && (respond < 0 || api < respond);
        });
        assert.ok(apiFirst, 'la règle /api/ est la première décision de l’écouteur fetch, avant tout respondWith');
        for (const [re, what] of [
            [/indexedDB/, 'indexedDB'], [/importScripts\s*\(/, 'importScripts'], [/Authorization/i, 'en-tête Authorization'],
            [/credentials\s*:\s*['"]include['"]/, 'credentials: \'include\''], [/requestPermission/, 'requestPermission'],
        ] as const) {
            assert.doesNotMatch(src, re, `motif interdit dans public/sw.js : ${what}`);
        }
        for (const asset of PUBLIC_ASSETS) assert.ok(src.includes(`'${asset}'`) || src.includes(`"${asset}"`), `PUBLIC_ASSETS contient ${asset}`);
    });
});

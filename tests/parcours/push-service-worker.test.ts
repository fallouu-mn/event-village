/**
 * Lot 6, tâche 6.2 — service worker, enregistrement et client push (contrat F4 « Client », F5 ; décision 3 ;
 * S2 « Canaux »).
 *  - public/sw.js exécuté dans node:vm avec un faux `self` : aucun importScripts ; install → skipWaiting,
 *    installation qui ne rejette jamais ; activate → suppression des seuls caches `event-village-*` (le cache
 *    du lot 7, `ev-hors-ligne-*`, a un autre préfixe) puis clients.claim() ; lot 7 (T12) : l'écouteur `fetch`
 *    existe, l'API n'est jamais interceptée, la liste blanche complète est vérifiée par
 *    tests/parcours/hors-ligne-service-worker.test.ts (contrat 5.3, décision 4 du lot 6 renversée) ;
 *    push : JSON {title, body, url, tag} → showNotification exact (icône et badge
 *    /icon-192x192.png), charge illisible ou absente → notification générique ; notificationclick :
 *    lien interne ouvert ou onglet existant (focus + navigate), lien externe, `//hôte` ou `javascript:` →
 *    /notifications ; pushsubscriptionchange : réabonnement avec la clé de GET /api/push/config puis
 *    POST /api/push/subscriptions, échec journalisé ;
 *  - components/pwa/ServiceWorkerRegister.tsx exécuté (effet appelé, React remplacé par un faux) :
 *    enregistrement immédiat quand `load` est déjà passé, sinon sur `load` { once: true } ; aucun
 *    console.log ; échec en console.warn ;
 *  - lib/push/client.ts : currentPushState (unsupported, denied, unavailable, enabled, disabled) sans
 *    jamais demander l'autorisation ; enablePush demande l'autorisation une fois puis s'abonne
 *    (userVisibleOnly, clé publique de la configuration) et enregistre l'abonnement ; refus → aucun
 *    abonnement ; detachPushSubscription supprime côté serveur puis se désabonne, sans lever ;
 *  - contrôle statique : Notification.requestPermission seulement dans lib/push/client.ts (dans
 *    enablePush), jamais dans un useEffect ; pushManager.subscribe seulement dans lib/push/client.ts et
 *    public/sw.js.
 *
 * Rouge avant correctif : l'ancien public/sw.js met des pages en cache et intercepte `fetch`, n'a ni
 * `push` ni `notificationclick` ni `pushsubscriptionchange` et supprime tout cache d'un autre nom ;
 * ServiceWorkerRegister attend un `load` déjà passé ; lib/push/client.ts n'existe pas.
 */
import '../helpers/env';
import { after, afterEach, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import Module, { createRequire } from 'node:module';
import path from 'node:path';
import vm from 'node:vm';
import { assertNotificationInvariants, fakeBrowserSubscription, loadLotModule, newVapidKeys } from './notif-helpers';

after(async () => {
    await assertNotificationInvariants('push-service-worker');
});

const ROOT = process.cwd();
const SW_FILE = path.join(ROOT, 'public', 'sw.js');
const ORIGIN = 'https://app.eventvillage.sn';
const FALLBACK = { title: 'Event Village', body: 'Nouvelle notification Event Village', url: '/notifications', tag: 'event-village' };

// ── Faux environnement de service worker ───────────────────────────────────

type Listener = (event: unknown) => unknown;

interface FakeClient { url: string; focused: number; navigated: string[]; focus(): Promise<FakeClient>; navigate(url: string): Promise<FakeClient> }

function fakeClient(url: string): FakeClient {
    const c: FakeClient = {
        url, focused: 0, navigated: [],
        async focus() { c.focused += 1; return c; },
        async navigate(u: string) { c.navigated.push(u); return c; },
    };
    return c;
}

interface FetchCall { url: string; method: string; body: string | null }

interface SwHarnessOptions {
    cacheKeys?: string[];
    clients?: FakeClient[];
    fetch?: (url: string, init: { method?: string; body?: unknown }) => Promise<Response>;
    subscribe?: (opts: unknown) => Promise<unknown>;
}

interface SwHarness {
    listeners: Map<string, Listener[]>;
    shown: Array<{ title: string; options: Record<string, unknown> }>;
    deleted: string[];
    opened: string[];
    claimed: number;
    skipWaiting: number;
    cacheOpened: number;
    fetchCalls: FetchCall[];
    subscribeCalls: unknown[];
    logs: { log: string[]; warn: string[]; error: string[] };
    fire(type: string, event: Record<string, unknown>): Promise<PromiseSettledResult<unknown>[]>;
}

function loadServiceWorker(opts: SwHarnessOptions = {}): SwHarness {
    const source = fs.readFileSync(SW_FILE, 'utf8');
    const h: SwHarness = {
        listeners: new Map(), shown: [], deleted: [], opened: [], claimed: 0, skipWaiting: 0, cacheOpened: 0, fetchCalls: [], subscribeCalls: [],
        logs: { log: [], warn: [], error: [] },
        async fire(type, event) {
            const waits: Promise<unknown>[] = [];
            const ev = { ...event, waitUntil: (p: unknown) => { waits.push(Promise.resolve(p)); } };
            for (const fn of h.listeners.get(type) ?? []) fn(ev);
            return Promise.allSettled(waits);
        },
    };
    const keys = [...(opts.cacheKeys ?? [])];
    const record = (kind: 'log' | 'warn' | 'error') => (...args: unknown[]) => { h.logs[kind].push(args.map(String).join(' ')); };
    const sandbox: Record<string, unknown> = {
        addEventListener: (type: string, fn: Listener) => { h.listeners.set(type, [...(h.listeners.get(type) ?? []), fn]); },
        skipWaiting: () => { h.skipWaiting += 1; return Promise.resolve(); },
        clients: {
            claim: async () => { h.claimed += 1; },
            matchAll: async () => opts.clients ?? [],
            openWindow: async (u: string) => { h.opened.push(u); return null; },
        },
        registration: {
            scope: `${ORIGIN}/`,
            showNotification: async (title: string, options: Record<string, unknown>) => { h.shown.push({ title, options: options ?? {} }); },
            getNotifications: async () => [],
            pushManager: {
                subscribe: async (o: unknown) => { h.subscribeCalls.push(o); return opts.subscribe ? opts.subscribe(o) : null; },
                getSubscription: async () => null,
            },
        },
        location: new URL(`${ORIGIN}/sw.js`),
        caches: {
            keys: async () => [...keys],
            delete: async (k: string) => { h.deleted.push(k); return true; },
            open: async () => { h.cacheOpened += 1; return { addAll: async () => undefined, put: async () => undefined, match: async () => undefined }; },
            match: async () => undefined,
        },
        fetch: async (input: unknown, init: { method?: string; body?: unknown } = {}) => {
            const url = new URL(typeof input === 'string' ? input : String((input as { url?: string }).url ?? input), ORIGIN).href;
            h.fetchCalls.push({ url, method: (init.method ?? 'GET').toUpperCase(), body: typeof init.body === 'string' ? init.body : null });
            if (!opts.fetch) throw new Error('fetch inattendu dans le service worker');
            return opts.fetch(url, init);
        },
        console: { log: record('log'), info: record('log'), debug: record('log'), warn: record('warn'), error: record('error') },
        URL, URLSearchParams, Response, Request, Headers, TextEncoder, TextDecoder, atob, btoa, setTimeout, clearTimeout,
    };
    sandbox.self = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(source, sandbox, { filename: 'public/sw.js' });
    return h;
}

function pushEvent(data: string | null): Record<string, unknown> {
    if (data === null) return { data: null };
    return {
        data: {
            text: () => data,
            json: () => JSON.parse(data) as unknown,
            arrayBuffer: () => new TextEncoder().encode(data).buffer,
        },
    };
}

interface FakeNotification { data: { url?: unknown }; closed: number; close(): void }

function clickEvent(url: unknown): { event: Record<string, unknown>; notification: FakeNotification } {
    const notification: FakeNotification = { data: { url }, closed: 0, close() { notification.closed += 1; } };
    return { event: { notification, action: '' }, notification };
}

function abs(u: string): string {
    return new URL(u, ORIGIN).href;
}

function jsonResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

function keyBytes(k: unknown): string {
    if (typeof k === 'string') return k;
    assert.ok(k && typeof (k as { byteLength?: unknown }).byteLength === 'number', `applicationServerKey illisible : ${String(k)}`);
    const view = ArrayBuffer.isView(k) ? new Uint8Array((k as ArrayBufferView).buffer, (k as ArrayBufferView).byteOffset, (k as ArrayBufferView).byteLength) : new Uint8Array(k as ArrayBuffer);
    return Buffer.from(Array.from(view)).toString('base64url');
}

// ── public/sw.js ───────────────────────────────────────────────────────────

describe('6.2 public/sw.js : push et clics (contrat F5, décision 3) ; lot 7 : cache du billet hors ligne en liste blanche', () => {
    test('écouteurs install, activate, fetch (liste blanche du lot 7), push, notificationclick, pushsubscriptionchange ; aucun importScripts ; l’API n’est jamais interceptée', async () => {
        const h = loadServiceWorker();
        for (const type of ['install', 'activate', 'fetch', 'push', 'notificationclick', 'pushsubscriptionchange']) {
            assert.equal((h.listeners.get(type) ?? []).length, 1, `écouteur ${type}`);
        }
        const src = fs.readFileSync(SW_FILE, 'utf8');
        assert.doesNotMatch(src, /importScripts\s*\(/, 'aucun importScripts');
        assert.match(src, /event-village-v1/, 'l’ancien cache est nommé pour être supprimé (tests/e2e-scenarios.test.ts:171-173 reste vrai)');
        // Lot 7 (T12) : « aucun cache ni réponse interceptée » devient la liste blanche du contrat 5.3, vérifiée cas par cas
        // dans tests/parcours/hors-ligne-service-worker.test.ts ; ici, l'API du push reste servie par le réseau.
        for (const url of [`${ORIGIN}/api/push/config`, `${ORIGIN}/api/push/subscriptions`, `${ORIGIN}/api/auth/me`]) {
            const intercepted: unknown[] = [];
            await h.fire('fetch', {
                request: { url, method: 'GET', mode: 'cors', headers: new Headers(), destination: '' },
                clientId: '', preloadResponse: Promise.resolve(undefined),
                respondWith: (r: unknown) => { intercepted.push(r); },
            });
            assert.deepEqual(intercepted, [], `${url} : aucune réponse interceptée (le réseau n’est jamais servi pour /api/)`);
        }
        assert.deepEqual(h.fetchCalls, [], 'le service worker ne refait aucune requête /api/');
    });

    test('install : skipWaiting, installation qui ne rejette jamais ; activate : supprime les seuls caches event-village-* puis clients.claim()', async () => {
        const h = loadServiceWorker({ cacheKeys: ['event-village-v1', 'event-village-runtime', 'autre-application', 'workbox-precache'] });
        const installed = await h.fire('install', {});
        assert.equal(h.skipWaiting, 1, 'skipWaiting à l’installation');
        // Lot 7 (T12) : « aucun cache ouvert à l'installation » devient « l'installation ne rejette jamais » : la pré-mise en
        // cache de la page hors ligne échoue ici (faux fetch qui lève) et doit être rattrapée, sinon le push serait perdu.
        assert.deepEqual(installed.filter((s) => s.status === 'rejected'), [], 'installation sans rejet, même si la pré-mise en cache échoue');
        const settled = await h.fire('activate', {});
        assert.deepEqual(settled.filter((s) => s.status === 'rejected'), [], 'activation sans erreur');
        assert.deepEqual([...h.deleted].sort(), ['event-village-runtime', 'event-village-v1'], 'caches event-village-* supprimés, les autres laissés');
        assert.equal(h.claimed, 1, 'clients.claim() après le nettoyage');
    });

    test('push JSON valide : showNotification(titre, { body, tag, data.url, icon, badge }) exact', async () => {
        const h = loadServiceWorker();
        const payload = { title: 'Rappel : c\'est demain', body: '« Gala Dakar » demain à 20:00, CICAD.', url: '/tickets', tag: 'REMINDER_J1:e:u:20261114T2000Z' };
        const settled = await h.fire('push', pushEvent(JSON.stringify(payload)));
        assert.deepEqual(settled.filter((s) => s.status === 'rejected'), []);
        assert.equal(h.shown.length, 1, 'une notification affichée');
        const { title, options } = h.shown[0];
        assert.equal(title, payload.title);
        assert.deepEqual(
            { body: options.body, tag: options.tag, url: (options.data as { url?: unknown } | undefined)?.url, icon: options.icon, badge: options.badge },
            { body: payload.body, tag: payload.tag, url: payload.url, icon: '/icon-192x192.png', badge: '/icon-192x192.png' });
    });

    test('push illisible ou sans charge : notification générique (titre, texte, /notifications, tag event-village)', async () => {
        for (const ev of [pushEvent('pas du json {'), pushEvent(null)]) {
            const h = loadServiceWorker();
            await h.fire('push', ev);
            assert.equal(h.shown.length, 1, 'une notification est toujours affichée (userVisibleOnly)');
            const { title, options } = h.shown[0];
            assert.deepEqual({ title, body: options.body, tag: options.tag, url: (options.data as { url?: unknown } | undefined)?.url }, FALLBACK);
        }
    });

    test('notificationclick : lien interne ouvert dans une nouvelle fenêtre quand aucun onglet n’est ouvert ; notification fermée', async () => {
        const h = loadServiceWorker({ clients: [] });
        const { event, notification } = clickEvent('/tickets?tab=recus');
        await h.fire('notificationclick', event);
        assert.equal(notification.closed, 1, 'notification fermée');
        assert.deepEqual(h.opened.map(abs), [`${ORIGIN}/tickets?tab=recus`]);
    });

    test('notificationclick : lien externe, //hôte, javascript: ou absent → /notifications', async () => {
        for (const url of ['https://evil.example/phishing', '//evil.example/x', 'javascript:alert(1)', 'mailto:a@b.c', undefined, 42]) {
            const h = loadServiceWorker({ clients: [] });
            const { event } = clickEvent(url);
            await h.fire('notificationclick', event);
            assert.deepEqual(h.opened.map(abs), [`${ORIGIN}/notifications`], `lien ${String(url)} → /notifications`);
        }
    });

    test('notificationclick : un onglet de l’application est ouvert → focus() puis navigate(), aucune nouvelle fenêtre', async () => {
        const tab = fakeClient(`${ORIGIN}/explore`);
        const h = loadServiceWorker({ clients: [tab] });
        const { event } = clickEvent('/events/7b0c6a52-3f1e-4d2a-9c11-5e8f2a4b6c01');
        await h.fire('notificationclick', event);
        assert.equal(tab.focused, 1, 'onglet existant mis au premier plan');
        assert.deepEqual(tab.navigated.map(abs), [`${ORIGIN}/events/7b0c6a52-3f1e-4d2a-9c11-5e8f2a4b6c01`], 'onglet existant dirigé vers le lien');
        assert.deepEqual(h.opened, [], 'aucune nouvelle fenêtre');
    });

    test('pushsubscriptionchange : clé lue par GET /api/push/config, réabonnement userVisibleOnly, POST /api/push/subscriptions', async () => {
        const keys = newVapidKeys();
        const renewed = fakeBrowserSubscription();
        const h = loadServiceWorker({
            fetch: async (url) => {
                if (url === `${ORIGIN}/api/push/config`) return jsonResponse({ enabled: true, publicKey: keys.publicKey });
                if (url === `${ORIGIN}/api/push/subscriptions`) return jsonResponse({ subscribed: true });
                return jsonResponse({ error: 'inattendu' }, 404);
            },
            subscribe: async () => ({ endpoint: renewed.endpoint, toJSON: () => renewed.json, options: { applicationServerKey: null } }),
        });
        const settled = await h.fire('pushsubscriptionchange', { oldSubscription: { endpoint: 'https://fcm.googleapis.com/fcm/send/ancien' }, newSubscription: null });
        assert.deepEqual(settled.filter((s) => s.status === 'rejected'), [], 'réabonnement sans erreur');
        assert.deepEqual(h.fetchCalls.map((c) => `${c.method} ${c.url}`), [`GET ${ORIGIN}/api/push/config`, `POST ${ORIGIN}/api/push/subscriptions`]);
        assert.equal(h.subscribeCalls.length, 1, 'un réabonnement');
        const opts = h.subscribeCalls[0] as { userVisibleOnly?: unknown; applicationServerKey?: unknown };
        assert.equal(opts.userVisibleOnly, true);
        assert.equal(keyBytes(opts.applicationServerKey), keys.publicKey, 'clé publique de la configuration');
        const posted = JSON.parse(h.fetchCalls[1].body ?? '{}') as { endpoint?: string; keys?: unknown };
        assert.equal(posted.endpoint, renewed.endpoint);
        assert.deepEqual(posted.keys, renewed.keys);
    });

    test('pushsubscriptionchange : échec de la configuration journalisé, aucun abonnement envoyé', async () => {
        const h = loadServiceWorker({
            fetch: async () => { throw new Error('réseau indisponible (simulation)'); },
            subscribe: async () => { throw new Error('ne doit pas être appelé'); },
        });
        await h.fire('pushsubscriptionchange', { oldSubscription: null, newSubscription: null });
        assert.ok(h.logs.error.length + h.logs.warn.length >= 1, `échec journalisé : ${JSON.stringify(h.logs)}`);
        assert.equal(h.fetchCalls.filter((c) => c.method === 'POST').length, 0, 'aucun POST');
    });
});

// ── components/pwa/ServiceWorkerRegister.tsx ───────────────────────────────

interface GlobalSnapshot { key: string; descriptor: PropertyDescriptor | undefined }

function replaceGlobals(values: Record<string, unknown>): GlobalSnapshot[] {
    const saved: GlobalSnapshot[] = [];
    for (const [key, value] of Object.entries(values)) {
        saved.push({ key, descriptor: Object.getOwnPropertyDescriptor(globalThis, key) });
        if (value === undefined) delete (globalThis as Record<string, unknown>)[key];
        else Object.defineProperty(globalThis, key, { value, configurable: true, writable: true, enumerable: false });
    }
    return saved;
}

function restoreGlobals(saved: GlobalSnapshot[]): void {
    for (const { key, descriptor } of [...saved].reverse()) {
        if (descriptor) Object.defineProperty(globalThis, key, descriptor);
        else delete (globalThis as Record<string, unknown>)[key];
    }
}

type ModuleLoad = (request: string, parent: unknown, isMain: boolean) => unknown;

/** Charge ServiceWorkerRegister avec un faux React dont useEffect exécute l'effet tout de suite. */
function loadRegisterComponent(): () => unknown {
    const file = path.join(ROOT, 'components', 'pwa', 'ServiceWorkerRegister.tsx');
    const loader = Module as unknown as { _load: ModuleLoad };
    const original = loader._load;
    const fakeReact = {
        useEffect: (fn: () => unknown) => { fn(); },
        useState: <T>(v: T) => [v, () => undefined] as const,
        useRef: <T>(v: T) => ({ current: v }),
    };
    loader._load = function patched(request: string, parent: unknown, isMain: boolean): unknown {
        if (request === 'react') return { ...fakeReact, default: fakeReact };
        return original.call(this, request, parent, isMain);
    };
    try {
        const req = createRequire(path.join(ROOT, 'package.json'));
        const resolved = req.resolve(file);
        delete req.cache[resolved];
        const mod = req(file) as { ServiceWorkerRegister?: () => unknown };
        assert.equal(typeof mod.ServiceWorkerRegister, 'function', 'ServiceWorkerRegister exporté');
        return mod.ServiceWorkerRegister!;
    } finally {
        loader._load = original;
    }
}

interface RegisterScenario {
    readyState: 'loading' | 'interactive' | 'complete';
    register: (url: string) => Promise<unknown>;
}

interface RegisterRun {
    registered: string[];
    /** Enregistrements faits avant l'événement `load` (déclenché ensuite par runRegister). */
    registeredBeforeLoad: string[];
    loadListeners: Array<{ fn: () => void; options: unknown }>;
    logs: { log: string[]; warn: string[]; error: string[] };
}

async function runRegister(scenario: RegisterScenario): Promise<RegisterRun> {
    const run: RegisterRun = { registered: [], registeredBeforeLoad: [], loadListeners: [], logs: { log: [], warn: [], error: [] } };
    const fakeWindow = {
        addEventListener: (type: string, fn: () => void, options?: unknown) => { if (type === 'load') run.loadListeners.push({ fn, options }); },
        removeEventListener: () => undefined,
    };
    const fakeNavigator = { serviceWorker: { register: (url: string) => { run.registered.push(url); return scenario.register(url); } } };
    const saved = replaceGlobals({ window: fakeWindow, document: { readyState: scenario.readyState }, navigator: fakeNavigator });
    const env = process.env as Record<string, string | undefined>;
    const savedNodeEnv = env.NODE_ENV;
    const consoleSaved = { log: console.log, warn: console.warn, error: console.error };
    console.log = (...a: unknown[]) => { run.logs.log.push(a.map(String).join(' ')); };
    console.warn = (...a: unknown[]) => { run.logs.warn.push(a.map(String).join(' ')); };
    console.error = (...a: unknown[]) => { run.logs.error.push(a.map(String).join(' ')); };
    try {
        env.NODE_ENV = 'production';
        const Component = loadRegisterComponent();
        Component();
        await new Promise((r) => setImmediate(r));
        run.registeredBeforeLoad = [...run.registered];
        for (const l of run.loadListeners) l.fn();
        await new Promise((r) => setImmediate(r));
        return run;
    } finally {
        console.log = consoleSaved.log;
        console.warn = consoleSaved.warn;
        console.error = consoleSaved.error;
        if (savedNodeEnv === undefined) delete env.NODE_ENV;
        else env.NODE_ENV = savedNodeEnv;
        restoreGlobals(saved);
    }
}

describe('6.2 ServiceWorkerRegister : enregistrement fiable (contrat F5)', () => {
    test('`load` déjà passé (readyState complete) : enregistrement immédiat de /sw.js, sans console.log', async () => {
        const run = await runRegister({ readyState: 'complete', register: async () => ({ scope: `${ORIGIN}/` }) });
        assert.deepEqual(run.registeredBeforeLoad, ['/sw.js'], 'enregistré sans attendre un `load` qui ne viendra plus');
        assert.deepEqual(run.registered, ['/sw.js'], 'un seul enregistrement');
        assert.deepEqual(run.logs.log, [], 'aucun console.log');
    });

    test('page en cours de chargement : enregistrement sur `load` { once: true }, pas avant', async () => {
        const run = await runRegister({ readyState: 'loading', register: async () => ({ scope: `${ORIGIN}/` }) });
        assert.deepEqual(run.registeredBeforeLoad, [], 'rien avant `load`');
        assert.equal(run.loadListeners.length, 1, 'un écouteur `load`');
        const options = run.loadListeners[0].options as { once?: unknown } | undefined;
        assert.equal(options?.once, true, 'écouteur { once: true }');
        assert.deepEqual(run.registered, ['/sw.js'], 'enregistré au `load`');
    });

    test('échec de l’enregistrement : console.warn, aucun console.log ni console.error', async () => {
        const run = await runRegister({ readyState: 'complete', register: async () => { throw new Error('SecurityError (simulation)'); } });
        await new Promise((r) => setImmediate(r));
        assert.equal(run.registeredBeforeLoad.length, 1, 'enregistrement tenté tout de suite (`load` déjà passé)');
        assert.equal(run.registered.length, 1, 'une seule tentative');
        assert.ok(run.logs.warn.length >= 1, `échec signalé par console.warn : ${JSON.stringify(run.logs)}`);
        assert.deepEqual(run.logs.log, []);
        assert.deepEqual(run.logs.error, []);
    });
});

// ── lib/push/client.ts ─────────────────────────────────────────────────────

interface ClientModule {
    pushSupport: () => unknown;
    currentPushState: () => Promise<string>;
    enablePush: () => Promise<unknown>;
    disablePush: () => Promise<unknown>;
    detachPushSubscription: () => Promise<unknown>;
}

interface BrowserScenario {
    supported: boolean;
    permission: 'default' | 'granted' | 'denied';
    answer: 'granted' | 'denied' | 'default';
    config: { enabled: boolean; publicKey: string | null };
    subscription: { endpoint: string; keys: { p256dh: string; auth: string } } | null;
    deleteFails?: boolean;
}

interface BrowserRecord {
    requestPermission: number;
    subscribe: unknown[];
    unsubscribe: number;
    registered: string[];
    fetches: FetchCall[];
    errors: string[];
}

describe('6.2 lib/push/client.ts : autorisation demandée seulement par enablePush (contrat F4)', () => {
    let client: ClientModule;
    let scenario: BrowserScenario;
    let record: BrowserRecord;
    let saved: GlobalSnapshot[] = [];
    let savedFetch: typeof fetch;
    let savedConsole: { error: typeof console.error; warn: typeof console.warn };
    const keys = newVapidKeys();

    function subscriptionObject(s: NonNullable<BrowserScenario['subscription']>): Record<string, unknown> {
        return {
            endpoint: s.endpoint,
            options: { applicationServerKey: Buffer.from(keys.publicKey, 'base64url'), userVisibleOnly: true },
            toJSON: () => ({ endpoint: s.endpoint, expirationTime: null, keys: s.keys }),
            getKey: (name: string) => Buffer.from(name === 'auth' ? s.keys.auth : s.keys.p256dh, 'base64url'),
            unsubscribe: async () => { record.unsubscribe += 1; return true; },
        };
    }

    before(() => {
        scenario = { supported: true, permission: 'default', answer: 'granted', config: { enabled: true, publicKey: keys.publicKey }, subscription: null };
        record = { requestPermission: 0, subscribe: [], unsubscribe: 0, registered: [], fetches: [], errors: [] };
        const registration = {
            scope: 'http://localhost/',
            pushManager: {
                getSubscription: async () => (scenario.subscription ? subscriptionObject(scenario.subscription) : null),
                subscribe: async (o: unknown) => {
                    record.subscribe.push(o);
                    const fresh = fakeBrowserSubscription();
                    scenario.subscription = { endpoint: fresh.endpoint, keys: fresh.keys };
                    return subscriptionObject(scenario.subscription);
                },
                permissionState: async () => (scenario.permission === 'default' ? 'prompt' : scenario.permission),
            },
        };
        const serviceWorker = {
            register: async (u: string) => { record.registered.push(u); return registration; },
            getRegistration: async () => registration,
            get ready() { return Promise.resolve(registration); },
            controller: {},
        };
        class FakeNotification {
            static get permission(): string { return scenario.permission; }
            static async requestPermission(): Promise<string> {
                record.requestPermission += 1;
                scenario.permission = scenario.answer;
                return scenario.answer;
            }
        }
        class FakePushManager {}
        const fakeWindow = globalThis as unknown as Record<string, unknown>;
        saved = replaceGlobals({
            window: fakeWindow,
            isSecureContext: true,
            navigator: { userAgent: 'Mozilla/5.0 (test lot 6)', get serviceWorker() { return scenario.supported ? serviceWorker : undefined; } },
            Notification: FakeNotification,
            PushManager: FakePushManager,
            ServiceWorkerRegistration: class {},
        });
        savedFetch = globalThis.fetch;
        globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
            const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
            const url = new URL(raw, 'http://localhost').pathname;
            const method = (init?.method ?? 'GET').toUpperCase();
            record.fetches.push({ url, method, body: typeof init?.body === 'string' ? init.body : null });
            if (url === '/api/push/config') return jsonResponse(scenario.config);
            if (url === '/api/push/subscriptions' && method === 'POST') return jsonResponse({ subscribed: true });
            if (url === '/api/push/subscriptions' && method === 'DELETE') {
                if (scenario.deleteFails) throw new Error('réseau indisponible (simulation)');
                return jsonResponse({ removed: true });
            }
            return jsonResponse({ error: 'inattendu' }, 404);
        }) as typeof fetch;
        savedConsole = { error: console.error, warn: console.warn };
        console.error = (...a: unknown[]) => { record.errors.push(a.map(String).join(' ')); };
        console.warn = (...a: unknown[]) => { record.errors.push(a.map(String).join(' ')); };
    });

    after(() => {
        globalThis.fetch = savedFetch;
        console.error = savedConsole.error;
        console.warn = savedConsole.warn;
        restoreGlobals(saved);
    });

    afterEach(() => {
        record.requestPermission = 0;
        record.subscribe = [];
        record.unsubscribe = 0;
        record.registered = [];
        record.fetches = [];
        record.errors = [];
    });

    async function load(): Promise<ClientModule> {
        if (client) return client;
        const mod = await loadLotModule('../../lib/push/client', 'client push du navigateur (contrat F4)');
        for (const name of ['pushSupport', 'currentPushState', 'enablePush', 'disablePush', 'detachPushSubscription']) {
            assert.equal(typeof mod[name], 'function', `lib/push/client.ts : ${name} non exporté (contrat F4)`);
        }
        client = mod as unknown as ClientModule;
        return client;
    }

    function set(s: Partial<BrowserScenario>): void {
        Object.assign(scenario, { supported: true, permission: 'default', answer: 'granted', config: { enabled: true, publicKey: keys.publicKey }, subscription: null, deleteFails: false }, s);
        const g = globalThis as Record<string, unknown>;
        if (scenario.supported) g.PushManager = class FakePushManager {};
        else delete g.PushManager;
    }

    test('currentPushState : unsupported, denied, unavailable, enabled, disabled — sans jamais demander l’autorisation ni s’abonner', async () => {
        const c = await load();
        const existing = fakeBrowserSubscription();
        const cases: Array<[Partial<BrowserScenario>, string]> = [
            [{ supported: false }, 'unsupported'],
            [{ permission: 'denied' }, 'denied'],
            [{ config: { enabled: false, publicKey: null } }, 'unavailable'],
            [{ permission: 'granted', subscription: { endpoint: existing.endpoint, keys: existing.keys } }, 'enabled'],
            [{ permission: 'granted', subscription: null }, 'disabled'],
            [{ permission: 'default', subscription: null }, 'disabled'],
        ];
        for (const [s, expected] of cases) {
            set(s);
            assert.equal(await c.currentPushState(), expected, `état ${JSON.stringify(s)}`);
            if (expected === 'unsupported') assert.ok(!c.pushSupport(), 'pushSupport() faux sans PushManager');
        }
        assert.equal(record.requestPermission, 0, 'aucune demande d’autorisation au chargement ou à la lecture de l’état');
        assert.equal(record.subscribe.length, 0, 'aucun abonnement sans geste de l’utilisateur');
    });

    test('enablePush (geste de l’utilisateur) : une demande d’autorisation, abonnement userVisibleOnly avec la clé publique, POST de l’abonnement', async () => {
        const c = await load();
        set({ permission: 'default', answer: 'granted' });
        await c.enablePush();
        assert.equal(record.requestPermission, 1, 'une seule demande d’autorisation');
        assert.ok(record.registered.includes('/sw.js'), 'service worker /sw.js enregistré');
        assert.equal(record.subscribe.length, 1, 'un abonnement');
        const opts = record.subscribe[0] as { userVisibleOnly?: unknown; applicationServerKey?: unknown };
        assert.equal(opts.userVisibleOnly, true);
        assert.equal(keyBytes(opts.applicationServerKey), keys.publicKey, 'clé publique lue par GET /api/push/config');
        const posts = record.fetches.filter((f) => f.method === 'POST' && f.url === '/api/push/subscriptions');
        assert.equal(posts.length, 1, 'abonnement enregistré côté serveur');
        const body = JSON.parse(posts[0].body ?? '{}') as { endpoint?: string; keys?: unknown };
        assert.equal(body.endpoint, scenario.subscription?.endpoint);
        assert.deepEqual(body.keys, scenario.subscription?.keys);
    });

    test('enablePush refusé par l’utilisateur : aucun abonnement, rien envoyé au serveur', async () => {
        const c = await load();
        set({ permission: 'default', answer: 'denied' });
        let outcome: unknown;
        try {
            outcome = await c.enablePush();
        } catch (err) {
            outcome = err; // un refus peut se signaler par une erreur : seul l'effet est vérifié ici
        }
        assert.equal(record.requestPermission, 1);
        assert.equal(record.subscribe.length, 0, `aucun abonnement après un refus (${String(outcome)})`);
        assert.equal(record.fetches.filter((f) => f.method === 'POST').length, 0, 'rien envoyé au serveur');
    });

    test('detachPushSubscription : DELETE serveur puis unsubscribe() ; échec réseau journalisé sans lever (la déconnexion continue)', async () => {
        const c = await load();
        const sub = fakeBrowserSubscription();
        set({ permission: 'granted', subscription: { endpoint: sub.endpoint, keys: sub.keys } });
        await c.detachPushSubscription();
        const deletes = record.fetches.filter((f) => f.method === 'DELETE' && f.url === '/api/push/subscriptions');
        assert.equal(deletes.length, 1, 'suppression côté serveur');
        assert.deepEqual(JSON.parse(deletes[0].body ?? '{}'), { endpoint: sub.endpoint });
        assert.equal(record.unsubscribe, 1, 'désabonnement du navigateur');
        assert.equal(record.requestPermission, 0);

        set({ permission: 'granted', subscription: { endpoint: sub.endpoint, keys: sub.keys }, deleteFails: true });
        record.errors = [];
        await assert.doesNotReject(() => c.detachPushSubscription(), 'un échec réseau ne bloque pas la déconnexion');
        assert.ok(record.errors.length >= 1, 'échec journalisé');
    });
});

// ── Contrôles statiques ────────────────────────────────────────────────────

function sourceFiles(): string[] {
    const out: string[] = [];
    const walk = (dir: string): void => {
        if (!fs.existsSync(dir)) return;
        for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, ent.name);
            if (ent.isDirectory()) { if (ent.name !== 'node_modules' && !ent.name.startsWith('.')) walk(full); continue; }
            if (/\.(ts|tsx|js|jsx|mjs)$/.test(ent.name)) out.push(full);
        }
    };
    for (const d of ['app', 'components', 'lib', 'hooks', 'public']) walk(path.join(ROOT, d));
    return out;
}

/** Corps de chaque appel `useEffect(…)` (parenthèses appariées, chaînes ignorées sommairement). */
function effectBodies(src: string): string[] {
    const bodies: string[] = [];
    const re = /\buseEffect\s*\(/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(src)) !== null) {
        let depth = 1;
        let i = m.index + m[0].length;
        let quote: string | null = null;
        for (; i < src.length && depth > 0; i++) {
            const ch = src[i];
            if (quote) { if (ch === '\\') i++; else if (ch === quote) quote = null; continue; }
            if (ch === '/' && src[i + 1] === '/') { const nl = src.indexOf('\n', i); i = nl < 0 ? src.length : nl; continue; }
            if (ch === '/' && src[i + 1] === '*') { const end = src.indexOf('*/', i + 2); i = end < 0 ? src.length : end + 1; continue; }
            if (ch === '\'' || ch === '"' || ch === '`') quote = ch;
            else if (ch === '(') depth++;
            else if (ch === ')') depth--;
        }
        bodies.push(src.slice(m.index, i));
    }
    return bodies;
}

/** Corps de la fonction `name` (déclaration ou constante fléchée), accolades appariées. */
function functionBody(src: string, name: string): string | null {
    const start = new RegExp(`(?:function\\s+${name}\\s*\\(|(?:const|let)\\s+${name}\\s*=)`).exec(src);
    if (!start) return null;
    const open = src.indexOf('{', start.index);
    if (open < 0) return null;
    let depth = 0;
    for (let i = open; i < src.length; i++) {
        if (src[i] === '{') depth++;
        else if (src[i] === '}') { depth--; if (depth === 0) return src.slice(start.index, i + 1); }
    }
    return null;
}

describe('6.2 Contrôles statiques : autorisation seulement après un geste (consigne 6.2, contrat F4)', () => {
    test('Notification.requestPermission seulement dans lib/push/client.ts (enablePush) ; pushManager.subscribe seulement dans lib/push/client.ts et public/sw.js ; rien dans un useEffect', () => {
        const clientFile = path.join(ROOT, 'lib', 'push', 'client.ts');
        assert.ok(fs.existsSync(clientFile), 'lib/push/client.ts absent (contrat F4)');
        const clientSrc = fs.readFileSync(clientFile, 'utf8');
        const enable = functionBody(clientSrc, 'enablePush');
        assert.ok(enable, 'enablePush défini dans lib/push/client.ts');
        assert.match(enable, /requestPermission\s*\(/, 'la demande d’autorisation est dans enablePush');
        const outside = clientSrc.replace(enable, '');
        assert.doesNotMatch(outside, /requestPermission\s*\(/, 'aucune demande d’autorisation hors de enablePush');

        const permissionOffenders: string[] = [];
        const subscribeOffenders: string[] = [];
        const effectOffenders: string[] = [];
        const subscribeAllowed = new Set([clientFile, SW_FILE].map((f) => path.normalize(f)));
        for (const file of sourceFiles()) {
            const src = fs.readFileSync(file, 'utf8');
            const rel = path.relative(ROOT, file).replace(/\\/g, '/');
            if (/requestPermission\s*\(/.test(src) && path.normalize(file) !== path.normalize(clientFile)) permissionOffenders.push(rel);
            if (/pushManager\s*\.\s*subscribe\s*\(/.test(src) && !subscribeAllowed.has(path.normalize(file))) subscribeOffenders.push(rel);
            for (const body of effectBodies(src)) {
                if (/requestPermission\s*\(|\benablePush\s*\(|pushManager\s*\.\s*subscribe\s*\(/.test(body)) effectOffenders.push(rel);
            }
        }
        assert.deepEqual(permissionOffenders, [], 'requestPermission hors de lib/push/client.ts');
        assert.deepEqual(subscribeOffenders, [], 'pushManager.subscribe hors de lib/push/client.ts et public/sw.js');
        assert.deepEqual(effectOffenders, [], 'demande d’autorisation ou abonnement dans un useEffect (au chargement)');
    });
});

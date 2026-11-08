/**
 * Lot 9, tâche 9.1 (contrat 4.2, 5.2 ; L18, L22) — ce que le navigateur envoie et garde. Suite SANS BASE :
 *  - readCatalog construit l'URL (fetch simulé) : sans filtre, `/api/events` exact ; q, city, category passés ;
 *    `tous` et les filtres vides jamais envoyés ; `cities` rendu ; readPopular partage le traitement d'erreur ;
 *  - lib/events/city-preference (clé `ev-city`) : accès protégés, valeur revalidée (2 à 80), rien ne lève
 *    (stockage indisponible, navigation privée, rendu serveur) ;
 *  - sources : plus aucun filtre côté navigateur (A28), pas d'AbortController (e2e/support/network.ts:152-161),
 *    HomeDiscovery sous « À l'affiche », pas de géolocalisation.
 *
 * Rouge avant correctif : readCatalog ignore ses filtres et ne rend pas `cities` ; readPopular et le module de
 * la ville n'existent pas (import dynamique, l'échec les nomme) ; les pages filtrent encore. Cas déjà vert, signalé
 * au commit : « sans filtre : URL exacte » (garde-fou de non-régression du lot, code actuel conforme).
 * Suite sans écriture en base : aucun appel aux invariants.
 */
import '../helpers/env';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const CLIENT_PATH = '../../lib/events/catalog-client';
const CITY_PATH = '../../lib/events/city-preference';

interface CatalogFilters { q?: string; city?: string; category?: string }
type CatalogResult =
    | { ok: true; events: Array<{ id: string; title: string }>; cities?: string[] }
    | { ok: false; message: string };

interface CatalogClient {
    readCatalog: (tag: string, filters?: CatalogFilters) => Promise<CatalogResult>;
    readPopular?: (tag: string) => Promise<CatalogResult>;
}

interface CityPreference {
    readLocalCity?: () => string | null;
    writeLocalCity?: (city: string) => void;
}

async function loadClient(): Promise<CatalogClient> {
    return (await import(CLIENT_PATH)) as CatalogClient;
}

async function loadReadPopular(): Promise<NonNullable<CatalogClient['readPopular']>> {
    const client = await loadClient();
    assert.equal(typeof client.readPopular, 'function', 'lib/events/catalog-client doit exporter readPopular (contrat 4.2)');
    return client.readPopular as NonNullable<CatalogClient['readPopular']>;
}

async function loadCity(): Promise<{ read: () => string | null; write: (city: string) => void }> {
    const mod = (await import(CITY_PATH)) as CityPreference;
    assert.equal(typeof mod.readLocalCity, 'function', 'lib/events/city-preference doit exporter readLocalCity (contrat 4.2)');
    assert.equal(typeof mod.writeLocalCity, 'function', 'lib/events/city-preference doit exporter writeLocalCity (contrat 4.2)');
    return { read: mod.readLocalCity as () => string | null, write: mod.writeLocalCity as (city: string) => void };
}

// ── fetch simulé ───────────────────────────────────────────────────────────

interface FetchCall { url: string; init?: RequestInit }

const jsonResponse = (body: unknown, status = 200): Response => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

const CATALOG_BODY = { events: [{ id: 'e1', title: 'Concert à Dakar', city: 'DAKAR' }], cities: ['DAKAR', 'THIÈS'] };

async function withFetch<T>(reply: () => Response, fn: (calls: FetchCall[]) => Promise<T>): Promise<T> {
    const previous = globalThis.fetch;
    const calls: FetchCall[] = [];
    globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
        calls.push({ url: String(input), init });
        return reply();
    }) as typeof fetch;
    try {
        return await fn(calls);
    } finally {
        globalThis.fetch = previous;
    }
}

function onlyCall(calls: FetchCall[]): { raw: string; pathname: string; params: Record<string, string>; init?: RequestInit } {
    assert.equal(calls.length, 1, `une seule requête attendue : ${JSON.stringify(calls.map((c) => c.url))}`);
    const url = new URL(calls[0].url, 'http://local.test');
    return { raw: calls[0].url, pathname: url.pathname, params: Object.fromEntries(url.searchParams), init: calls[0].init };
}

describe('A28 — readCatalog construit la requête du serveur', () => {
    test('sans filtre : /api/events exact, en no-store (déjà vrai, garde-fou)', async () => {
        const { readCatalog } = await loadClient();
        await withFetch(() => jsonResponse(CATALOG_BODY), async (calls) => {
            await readCatalog('t');
            const call = onlyCall(calls);
            assert.equal(call.raw, '/api/events');
            assert.equal(call.init?.cache, 'no-store');
        });
    });

    test('q, city et category sont passés au serveur, encodés', async () => {
        const { readCatalog } = await loadClient();
        await withFetch(() => jsonResponse(CATALOG_BODY), async (calls) => {
            await readCatalog('t', { q: 'Théâtre & co', city: 'SAINT-LOUIS', category: 'CONCERT' });
            const call = onlyCall(calls);
            assert.equal(call.pathname, '/api/events');
            assert.deepEqual(call.params, { q: 'Théâtre & co', city: 'SAINT-LOUIS', category: 'CONCERT' });
            assert.equal(call.init?.cache, 'no-store');
        });
    });

    test('la valeur de l’écran « tous » n’est jamais envoyée', async () => {
        const { readCatalog } = await loadClient();
        await withFetch(() => jsonResponse(CATALOG_BODY), async (calls) => {
            await readCatalog('t', { q: 'jazz', city: 'tous', category: 'tous' });
            assert.deepEqual(onlyCall(calls).params, { q: 'jazz' });
        });
    });

    test('un filtre vide n’est pas envoyé', async () => {
        const { readCatalog } = await loadClient();
        await withFetch(() => jsonResponse(CATALOG_BODY), async (calls) => {
            await readCatalog('t', { q: '', city: 'DAKAR' });
            assert.deepEqual(onlyCall(calls).params, { city: 'DAKAR' });
        });
    });

    test('tous les filtres à « tous » ou vides : URL exacte /api/events', async () => {
        const { readCatalog } = await loadClient();
        await withFetch(() => jsonResponse(CATALOG_BODY), async (calls) => {
            const result = await readCatalog('t', { q: '', city: 'tous', category: 'tous' });
            assert.equal(onlyCall(calls).raw, '/api/events');
            assert.equal(result.ok, true);
            assert.deepEqual(result.ok && result.cities, ['DAKAR', 'THIÈS'], 'cities rendu');
        });
    });

    test('les villes de la réponse sont rendues avec les événements', async () => {
        const { readCatalog } = await loadClient();
        await withFetch(() => jsonResponse(CATALOG_BODY), async () => {
            const result = await readCatalog('t', { city: 'DAKAR' });
            assert.equal(result.ok, true, JSON.stringify(result));
            assert.ok(result.ok);
            assert.deepEqual(result.events.map((e) => e.id), ['e1']);
            assert.deepEqual(result.cities, ['DAKAR', 'THIÈS'], 'cities vient de la réponse');
        });
    });

    test('une panne du serveur avec filtre : erreur rendue, requête bien filtrée', async () => {
        const { readCatalog } = await loadClient();
        await withFetch(() => jsonResponse({ error: 'Impossible de charger les événements.' }, 500), async (calls) => {
            const result = await readCatalog('t', { city: 'DAKAR' });
            assert.deepEqual(result, { ok: false, message: 'Impossible de charger les événements.' });
            assert.deepEqual(onlyCall(calls).params, { city: 'DAKAR' });
        });
    });
});

describe('Populaires — readPopular', () => {
    test('lit /api/events/popular en no-store et rend les événements', async () => {
        const readPopular = await loadReadPopular();
        await withFetch(() => jsonResponse({ events: [{ id: 'p1', title: 'Soirée' }, { title: 'sans id, ignorée' }] }), async (calls) => {
            const result = await readPopular('accueil');
            const call = onlyCall(calls);
            assert.equal(call.raw, '/api/events/popular');
            assert.equal(call.init?.cache, 'no-store');
            assert.equal(result.ok, true, JSON.stringify(result));
            assert.ok(result.ok);
            assert.deepEqual(result.events.map((e) => e.id), ['p1'], 'lecture commune : une ligne invalide est écartée');
        });
    });

    test('500 : message du serveur rendu', async () => {
        const readPopular = await loadReadPopular();
        await withFetch(() => jsonResponse({ error: 'Populaires momentanément indisponibles.', code: 'POPULAR_UNAVAILABLE' }, 500), async () => {
            assert.deepEqual(await readPopular('accueil'), { ok: false, message: 'Populaires momentanément indisponibles.' });
        });
    });

    test('réseau coupé : message de connexion, aucune exception', async () => {
        const readPopular = await loadReadPopular();
        await withFetch(() => { throw new TypeError('fetch failed'); }, async () => {
            assert.deepEqual(await readPopular('accueil'), { ok: false, message: 'Connexion impossible : vérifiez votre réseau, puis réessayez.' });
        });
    });
});

// ── Stockage local simulé ──────────────────────────────────────────────────

class MemoryStorage {
    readonly map = new Map<string, string>();
    getItem(k: string): string | null { return this.map.has(k) ? (this.map.get(k) as string) : null; }
    setItem(k: string, v: string): void { this.map.set(k, String(v)); }
    removeItem(k: string): void { this.map.delete(k); }
}

/** Installe `window.localStorage` et `localStorage` (accès direct ou par window), le temps de `fn`. */
async function withStorage<T>(descriptor: PropertyDescriptor, fn: () => Promise<T> | T): Promise<T> {
    const g = globalThis as unknown as { window?: unknown };
    const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
    const previousStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    const win = {};
    Object.defineProperty(win, 'localStorage', { configurable: true, ...descriptor });
    g.window = win;
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, ...descriptor });
    try {
        return await fn();
    } finally {
        if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow);
        else delete g.window;
        if (previousStorage) Object.defineProperty(globalThis, 'localStorage', previousStorage);
        else delete (globalThis as unknown as { localStorage?: unknown }).localStorage;
    }
}

describe('Ville du visiteur — lib/events/city-preference (clé ev-city)', () => {
    test('écriture puis relecture, sous la clé exacte ev-city', async () => {
        const city = await loadCity();
        const store = new MemoryStorage();
        await withStorage({ value: store }, () => {
            city.write('DAKAR');
            assert.equal(store.map.get('ev-city'), 'DAKAR', 'valeur brute, lue telle quelle par initStorage des captures');
            assert.equal(city.read(), 'DAKAR');
        });
    });

    test('rien d’enregistré : null', async () => {
        const city = await loadCity();
        await withStorage({ value: new MemoryStorage() }, () => {
            assert.equal(city.read(), null);
        });
    });

    test('valeur invalide ignorée : vide, 1 caractère, 81 caractères ; 2 et 80 caractères admis', async () => {
        const city = await loadCity();
        const store = new MemoryStorage();
        await withStorage({ value: store }, () => {
            for (const invalid of ['', 'D', 'X'.repeat(81)]) {
                store.map.set('ev-city', invalid);
                assert.equal(city.read(), null, `« ${invalid.slice(0, 20)} » ignorée`);
            }
            for (const valid of ['AB', 'X'.repeat(80)]) {
                store.map.set('ev-city', valid);
                assert.equal(city.read(), valid, `longueur ${valid.length} admise`);
            }
        });
    });

    test('getItem et setItem qui lèvent : aucune exception, lecture null', async () => {
        const city = await loadCity();
        const broken = {
            getItem(): string | null { throw new Error('stockage indisponible'); },
            setItem(): void { throw new Error('quota dépassé'); },
            removeItem(): void { throw new Error('stockage indisponible'); },
        };
        await withStorage({ value: broken }, () => {
            assert.equal(city.read(), null);
            assert.doesNotThrow(() => city.write('DAKAR'));
        });
    });

    test('l’accès à localStorage lui-même lève (navigation privée) : aucune exception, lecture null', async () => {
        const city = await loadCity();
        await withStorage({ get(): Storage { throw new Error('SecurityError'); } }, () => {
            assert.equal(city.read(), null);
            assert.doesNotThrow(() => city.write('DAKAR'));
        });
    });

    test('rendu serveur (ni window ni localStorage) : aucune exception, lecture null', async () => {
        const city = await loadCity();
        const g = globalThis as unknown as { window?: unknown };
        const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
        const previousStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
        delete g.window;
        Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: undefined });
        try {
            assert.equal(city.read(), null);
            assert.doesNotThrow(() => city.write('DAKAR'));
        } finally {
            if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow);
            if (previousStorage) Object.defineProperty(globalThis, 'localStorage', previousStorage);
            else delete (globalThis as unknown as { localStorage?: unknown }).localStorage;
        }
    });
});

// ── Sources ────────────────────────────────────────────────────────────────

function source(rel: string): string {
    const abs = path.resolve(process.cwd(), rel);
    assert.ok(fs.existsSync(abs), `${rel} absent (tâche 9.1)`);
    return fs.readFileSync(abs, 'utf8');
}

const READ_WITH_FILTERS = /readCatalog\(\s*[^)]*,[^)]*\)/;

describe('A28 — plus aucun filtre côté navigateur', () => {
    test('catalogue : ni matches(), ni comparaison de catégorie ou de ville, filtres passés à readCatalog', () => {
        const src = source('app/explore/page.tsx');
        assert.doesNotMatch(src, /\bmatches\(/, 'filtre texte du navigateur retiré');
        assert.doesNotMatch(src, /\.city\s*===\s*city\b/, 'filtre ville du navigateur retiré');
        assert.doesNotMatch(src, /\.category\s*===\s*category\b/, 'filtre catégorie du navigateur retiré');
        assert.match(src, READ_WITH_FILTERS, 'readCatalog reçoit les filtres');
    });

    test('catalogue : debounce 300 ms, pas d’AbortController, villes de la réponse, vide distingué d’une recherche sans résultat', () => {
        const src = source('app/explore/page.tsx');
        assert.match(src, /\b300\b/, 'debounce de 300 ms sur le texte (contrat 5.2)');
        assert.doesNotMatch(src, /AbortController/, 'une requête annulée est une panne pour la garde e2e (network.ts:152-161)');
        assert.match(src, /\.cities\b/, 'liste des villes tirée de la réponse (C5)');
        assert.match(src, /events\.length === 0 && !serverFiltersActive|!serverFiltersActive && events\.length === 0/, 'le message « aucun événement à venir » ne dépend pas des filtres serveur (contrat 5.2, ligne 283)');
    });

    test('accueil : catégorie envoyée au serveur, shown garde seulement le découpage', () => {
        const src = source('app/page.tsx');
        assert.doesNotMatch(src, /\.category\s*===\s*category\b/, 'filtre catégorie du navigateur retiré de l’accueil');
        assert.match(src, READ_WITH_FILTERS, 'readCatalog reçoit la catégorie');
    });
});

describe('Accueil — sections Populaires et Près de chez vous', () => {
    test('HomeDiscovery : Populaires puis Près de chez vous, lecture par readPopular et readCatalog(« proches »)', () => {
        const src = source('components/events/HomeDiscovery.tsx');
        assert.match(src, /readPopular\(/, 'Populaires lus par readPopular');
        assert.match(src, /readCatalog\(\s*['"]proches['"]/, 'Près de chez vous : readCatalog(« proches », { city })');
        assert.match(src, /aria-labelledby="populaires-titre"/, 'titre relié à la section');
        assert.match(src, /priority=\{false\}/, 'ne déplace pas le LCP');
        const populaires = src.indexOf('Populaires');
        const proches = src.indexOf('Près de chez vous');
        assert.ok(populaires >= 0 && proches >= 0 && populaires < proches, 'Populaires, puis Près de chez vous');
    });

    test('HomeDiscovery : pas de géolocalisation, pas d’accès direct au stockage local', () => {
        const src = source('components/events/HomeDiscovery.tsx');
        assert.doesNotMatch(src, /geolocation/i, 'aucune géolocalisation (consigne)');
        assert.doesNotMatch(src, /localStorage/, 'le stockage passe par lib/events/city-preference');
        assert.match(src, /readLocalCity|writeLocalCity/, 'lib/events/city-preference utilisée');
    });

    test('accueil : HomeDiscovery rendu sous « À l’affiche »', () => {
        const src = source('app/page.tsx');
        assert.match(src, /HomeDiscovery/, 'section branchée sur l’accueil');
        const affiche = src.indexOf('affiche-titre');
        const discovery = src.indexOf('<HomeDiscovery');
        assert.ok(affiche >= 0 && discovery > affiche, '<HomeDiscovery /> après la section « À l’affiche »');
    });

    test('AuthProvider : la ville fait partie du profil', () => {
        assert.match(source('components/providers/AuthProvider.tsx'), /city\?\s*:\s*string\s*\|\s*null/, 'UserProfile.city (contrat 5.2)');
    });
});

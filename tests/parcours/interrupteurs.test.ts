/**
 * Lot 7 — 7.3 : interrupteurs SUPERADMIN des services (contrat §7.1, M1, 3.4, D11, D55 à D57 ; écrivain
 * « Client », W7).
 *
 * features.halls_enabled (salles), features.tables_enabled (tables), features.orders_enabled (commandes de
 * repas : produits, menu, orders), défaut false. Fermés : pages et routes publiques des services en 404 propre
 * ({ error: 'Page introuvable.', code: 'NOT_FOUND' }), sans supprimer ni code ni données. Ordre (D56) : GET
 * publics = interrupteur d'abord ; routes protégées = session, puis interrupteur ; /api/payments/create selon
 * targetType après la session (TICKET et SUBSCRIPTION jamais concernés).
 *  1. réglages : trois clés à false ; finance_setting_set : SUPERADMIN accepté, ADMIN FORBIDDEN, « oui »
 *     INVALID_VALUE (valeur inchangée) ;
 *  2. GET /api/features sans session : { halls, tables, orders } à false, Cache-Control no-store, puis la
 *     valeur basculée ; lib/features/flags : getFeatureFlags() et featureNotFound() ;
 *  3. fermés : GET publics 404 NOT_FOUND sans session ; POST protégés 401 sans session, 403 suspendu, 404
 *     actif (aucune ligne créée) ; GET /api/orders 401 puis 404 ; routes partenaire 404 pour le propriétaire ;
 *     /api/payments/create HALL_RESERVATION, TABLE_RESERVATION, ORDER 404 sans paiement ; TICKET 200 et
 *     SUBSCRIPTION 201 ;
 *  4. ouverts : comportement actuel (lectures 200 avec les données, réservation créée au nom de la session) ;
 *     middleware : GET publics des services et /api/features joignables sans session (D11), /api/orders
 *     toujours protégé ;
 *  5. statique : chaque page de l'inventaire a son layout de garde (composant serveur, notFound() de
 *     next/navigation, getFeatureFlags, bon interrupteur) ; chaque gestionnaire de l'inventaire importe la garde
 *     de lib/features/flags ; les routes à ne pas couper ne renvoient jamais featureNotFound ;
 *  6. aucune donnée supprimée par les bascules.
 *
 * Rouge avant correctif (fix(7.3s), A5 ; clés par fix(7.0a), migration 20261105000001) :
 *  - 1, 2, 3, 4 (bascule) : clés features.* absentes (« réglage features.… absent », UNKNOWN_KEY) ; route
 *    /api/features et lib/features/flags absents ;
 *  - 3 : les GET publics répondent 200, les POST d'un compte actif créent la réservation ou la commande, les
 *    routes partenaire répondent, /api/payments/create crée le paiement ;
 *  - 4 : le middleware répond 401 à un visiteur sur /api/halls et /api/restaurants/… (D11), /api/features
 *    n'est pas public ;
 *  - 5 : aucun layout de garde, aucune route n'importe lib/features/flags.
 * Déjà vrai aujourd'hui (garde-fous, signalés) : 401 sans session et 403 suspendu des POST protégés, 401 de
 * GET /api/orders (session d'abord, acces-securite-urgente inchangée) ; lectures ouvertes en 200 ; /api/orders
 * protégé au middleware ; aucune route « à ne pas couper » n'appelle featureNotFound (vert dès l'écriture) ;
 * données conservées (6). Les cas qui posent un interrupteur restent rouges jusqu'à fix(7.0a) (clés absentes) :
 * l'échec le dit.
 *
 * Les interrupteurs sont posés par withFeatureFlags (finance_setting_set, SUPERADMIN du seed) et remis dans un
 * finally. Hypothèse de lecture (signalée) : la garde lit platform_settings à chaque requête (aucun cache de
 * processus), sinon une bascule ne serait pas visible par le cas suivant.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import ts from 'typescript';
import { NextRequest } from 'next/server';
import { loadFixtures } from '../helpers/fixtures';
import { callMiddleware } from '../helpers/middleware';
import { isModuleNotFound } from '../helpers/notification-invariants';
import { BASE_URL } from './helpers';
import { createSaleEvent, importModule, newBuyer, service, type Buyer } from './paiement-helpers';
import { newPartner, type TestPartner } from './finance-helpers';
import {
    assertTerrainInvariants, FEATURE_FLAG_KEYS, getPlatformSetting, readFeatureFlagSettings, withFeatureFlags,
    type FeatureFlag,
} from './terrain-helpers';

type Handler = (req: NextRequest, ctx?: unknown) => Promise<Response>;
type Row = Record<string, unknown>;
interface Result { status: number; body: Row; text: string; headers: Headers }

const ROOT = process.cwd();
const ALL_CLOSED = { halls: false, tables: false, orders: false } as const;
const ALL_OPEN = { halls: true, tables: true, orders: true } as const;
const NOT_FOUND_BODY = { error: 'Page introuvable.', code: 'NOT_FOUND' };

let partner: TestPartner;
let client: Buyer;
let suspended: Buyer;
let hallId = '';
let tableId = '';
let productId = '';
let dayOffset = 70;

/** Date future distincte à chaque appel (contraintes d'exclusion des salles et des tables). */
function futureDate(): string {
    dayOffset += 1;
    return new Date(Date.now() + dayOffset * 24 * 3600 * 1000).toISOString().slice(0, 10);
}

before(async () => {
    partner = await newPartner('interrupteurs');
    client = await newBuyer('interrupteurs-client');
    suspended = await newBuyer('interrupteurs-suspendu');
    const { error: susErr } = await service.from('users').update({ status: 'SUSPENDU' }).eq('id', suspended.userId);
    assert.equal(susErr, null, `compte suspendu : ${susErr?.message}`);
    const { data: hall, error: hallErr } = await service.from('halls').insert({
        partner_id: partner.partnerId, name: `TEST Salle interrupteur ${randomUUID().slice(0, 8)}`, capacity: 120,
        price_per_day: 50_000, deposit_percentage: 30, city: 'Dakar', is_active: true,
    }).select('id').single();
    assert.equal(hallErr, null, `salle : ${hallErr?.message}`);
    hallId = hall.id;
    const { data: table, error: tableErr } = await service.from('restaurant_tables').insert({
        partner_id: partner.partnerId, table_number: `T-INT-${randomUUID().slice(0, 8)}`, capacity: 6, is_active: true,
    }).select('id').single();
    assert.equal(tableErr, null, `table : ${tableErr?.message}`);
    tableId = table.id;
    const { data: product, error: prodErr } = await service.from('products').insert({
        partner_id: partner.partnerId, name: `TEST Plat interrupteur ${randomUUID().slice(0, 8)}`, price: 4_000, status: 'DISPONIBLE',
    }).select('id').single();
    assert.equal(prodErr, null, `produit : ${prodErr?.message}`);
    productId = product.id;
});

after(async () => {
    await assertTerrainInvariants('interrupteurs');
});

// ── Appels de routes dans le processus ─────────────────────────────────────

/** Contexte de route lisible sous les deux formes en usage (`await params` et `params.id`). */
function routeCtx(params: Record<string, string>): { params: Promise<Record<string, string>> & Record<string, string> } {
    return { params: Object.assign(Promise.resolve(params), params) };
}

async function loadHandler(modPath: string, method: string): Promise<Handler> {
    let mod: Record<string, unknown>;
    try {
        mod = await importModule(modPath);
    } catch (err) {
        if (isModuleNotFound(err, modPath)) {
            assert.fail(`module absent : ${modPath.replace(/^(\.\.\/)+/, '')}.ts (contrat 3.4, fix(7.3s)) — ${String((err as Error).message).split('\n')[0]}`);
        }
        throw err;
    }
    assert.equal(typeof mod[method], 'function', `${modPath.replace(/^(\.\.\/)+/, '')}.ts : ${method} non exporté`);
    return mod[method] as Handler;
}

function request(pathname: string, method: string, opts: { token?: string | null; body?: unknown; headers?: Record<string, string> } = {}): NextRequest {
    const headers: Record<string, string> = { ...(opts.headers ?? {}) };
    if (opts.body !== undefined) headers['content-type'] = 'application/json';
    if (opts.token) headers.authorization = `Bearer ${opts.token}`;
    return new NextRequest(`${BASE_URL}${pathname}`, {
        method, headers, body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    });
}

async function callRoute(modPath: string, method: string, pathname: string, opts: { token?: string | null; body?: unknown; params?: Record<string, string>; headers?: Record<string, string> } = {}): Promise<Result> {
    const handler = await loadHandler(modPath, method);
    const res = await handler(request(pathname, method, opts), opts.params ? routeCtx(opts.params) : undefined);
    const text = await res.text();
    let body: Row = {};
    try {
        body = text ? JSON.parse(text) : {};
    } catch {
        body = { raw: text }; // corps non JSON conservé tel quel pour le message d'échec
    }
    return { status: res.status, body, text, headers: res.headers };
}

function show(r: Result): string {
    return `HTTP ${r.status} ${r.text.slice(0, 300)}`;
}

function assertNotFound(r: Result, what: string): void {
    assert.equal(r.status, 404, `${what} : 404 attendu (interrupteur fermé), obtenu ${show(r)}`);
    assert.deepEqual({ error: r.body.error, code: r.body.code }, NOT_FOUND_BODY, `${what} : corps 404 de featureNotFound attendu, obtenu ${show(r)}`);
}

async function rowsOf(table: 'orders' | 'hall_reservations' | 'table_reservations', clientId: string): Promise<string[]> {
    const { data, error } = await service.from(table).select('id').eq('client_id', clientId);
    assert.equal(error, null, `${table} de ${clientId} : ${error?.message}`);
    return (data ?? []).map((r) => String(r.id));
}

// ── Inventaire (discovery-7-client.md §5.1, contrat §7.1) ─────────────────

interface ProtectedPost { label: string; mod: string; path: string; table: 'orders' | 'hall_reservations' | 'table_reservations'; flag: FeatureFlag; body: () => Row }

const PROTECTED_POSTS: ProtectedPost[] = [
    {
        label: 'POST /api/halls/reserve', mod: '../../app/api/halls/reserve/route', path: '/api/halls/reserve', table: 'hall_reservations', flag: 'halls',
        body: () => ({ hallId, startDate: futureDate(), durationDays: 1 }),
    },
    {
        label: 'POST /api/restaurants/reserve-table', mod: '../../app/api/restaurants/reserve-table/route', path: '/api/restaurants/reserve-table', table: 'table_reservations', flag: 'tables',
        body: () => ({ partnerId: partner.partnerId, reservationDate: futureDate(), reservationTime: '20:00', guestCount: 2, isPlatformPayment: true }),
    },
    {
        label: 'POST /api/orders/create', mod: '../../app/api/orders/create/route', path: '/api/orders/create', table: 'orders', flag: 'orders',
        body: () => ({ partnerId: partner.partnerId, items: [{ id: productId, quantity: 1 }], deliveryMode: 'RETRAIT' }),
    },
];

interface PublicGet { label: string; mod: string; path: () => string; params?: () => Record<string, string>; flag: FeatureFlag; expectId: () => string }

const PUBLIC_GETS: PublicGet[] = [
    { label: 'GET /api/halls', mod: '../../app/api/halls/route', path: () => '/api/halls', flag: 'halls', expectId: () => hallId },
    { label: 'GET /api/halls/[id]', mod: '../../app/api/halls/[id]/route', path: () => `/api/halls/${hallId}`, params: () => ({ id: hallId }), flag: 'halls', expectId: () => hallId },
    {
        label: 'GET /api/restaurants/[id]/tables', mod: '../../app/api/restaurants/[id]/tables/route', path: () => `/api/restaurants/${partner.partnerId}/tables`,
        params: () => ({ id: partner.partnerId }), flag: 'tables', expectId: () => tableId,
    },
    {
        label: 'GET /api/restaurants/[id]/menu', mod: '../../app/api/restaurants/[id]/menu/route', path: () => `/api/restaurants/${partner.partnerId}/menu`,
        params: () => ({ id: partner.partnerId }), flag: 'orders', expectId: () => productId,
    },
];

interface PartnerHandler { file: string; method: string; flag: FeatureFlag; path: string; withId: boolean }

/** Tous les gestionnaires partenaire des services (fichier, méthode, interrupteur). */
const PARTNER_HANDLERS: PartnerHandler[] = [
    { file: 'app/api/partner/halls/route.ts', method: 'GET', flag: 'halls', path: '/api/partner/halls', withId: false },
    { file: 'app/api/partner/halls/route.ts', method: 'POST', flag: 'halls', path: '/api/partner/halls', withId: false },
    { file: 'app/api/partner/halls/[id]/route.ts', method: 'GET', flag: 'halls', path: '/api/partner/halls/:id', withId: true },
    { file: 'app/api/partner/halls/[id]/route.ts', method: 'PUT', flag: 'halls', path: '/api/partner/halls/:id', withId: true },
    { file: 'app/api/partner/halls/[id]/route.ts', method: 'DELETE', flag: 'halls', path: '/api/partner/halls/:id', withId: true },
    { file: 'app/api/partner/halls/reservations/[id]/status/route.ts', method: 'POST', flag: 'halls', path: '/api/partner/halls/reservations/:id/status', withId: true },
    { file: 'app/api/partner/tables/route.ts', method: 'GET', flag: 'tables', path: '/api/partner/tables', withId: false },
    { file: 'app/api/partner/tables/route.ts', method: 'POST', flag: 'tables', path: '/api/partner/tables', withId: false },
    { file: 'app/api/partner/tables/[id]/route.ts', method: 'PATCH', flag: 'tables', path: '/api/partner/tables/:id', withId: true },
    { file: 'app/api/partner/tables/[id]/route.ts', method: 'DELETE', flag: 'tables', path: '/api/partner/tables/:id', withId: true },
    { file: 'app/api/partner/tables/reservations/route.ts', method: 'GET', flag: 'tables', path: '/api/partner/tables/reservations', withId: false },
    { file: 'app/api/partner/tables/reservations/route.ts', method: 'POST', flag: 'tables', path: '/api/partner/tables/reservations', withId: false },
    { file: 'app/api/partner/tables/reservations/[id]/route.ts', method: 'PATCH', flag: 'tables', path: '/api/partner/tables/reservations/:id', withId: true },
    { file: 'app/api/partner/tables/reservations/[id]/route.ts', method: 'DELETE', flag: 'tables', path: '/api/partner/tables/reservations/:id', withId: true },
    { file: 'app/api/partner/orders/route.ts', method: 'GET', flag: 'orders', path: '/api/partner/orders', withId: false },
    { file: 'app/api/partner/orders/[id]/route.ts', method: 'GET', flag: 'orders', path: '/api/partner/orders/:id', withId: true },
    { file: 'app/api/partner/orders/[id]/route.ts', method: 'PATCH', flag: 'orders', path: '/api/partner/orders/:id', withId: true },
    { file: 'app/api/partner/products/route.ts', method: 'GET', flag: 'orders', path: '/api/partner/products', withId: false },
    { file: 'app/api/partner/products/route.ts', method: 'POST', flag: 'orders', path: '/api/partner/products', withId: false },
    { file: 'app/api/partner/products/[id]/route.ts', method: 'GET', flag: 'orders', path: '/api/partner/products/:id', withId: true },
    { file: 'app/api/partner/products/[id]/route.ts', method: 'PATCH', flag: 'orders', path: '/api/partner/products/:id', withId: true },
    { file: 'app/api/partner/products/[id]/route.ts', method: 'DELETE', flag: 'orders', path: '/api/partner/products/:id', withId: true },
    { file: 'app/api/partner/products/[id]/status/route.ts', method: 'POST', flag: 'orders', path: '/api/partner/products/:id/status', withId: true },
];

/** Fichiers de routes qui doivent porter la garde (contrat §7.1). */
const GUARDED_ROUTE_FILES = [
    'app/api/halls/route.ts', 'app/api/halls/[id]/route.ts', 'app/api/halls/reserve/route.ts',
    'app/api/restaurants/[id]/tables/route.ts', 'app/api/restaurants/reserve-table/route.ts', 'app/api/restaurants/[id]/menu/route.ts',
    'app/api/orders/create/route.ts', 'app/api/orders/route.ts', 'app/api/payments/create/route.ts',
    ...Array.from(new Set(PARTNER_HANDLERS.map((h) => h.file))),
];

/** Routes à ne jamais couper (contrat §7.1, D57) : un paiement de salle en cours doit pouvoir se confirmer. */
const NEVER_CUT_FILES = [
    'app/api/webhooks/samirpay/route.ts', 'app/api/payments/[transactionId]/status/route.ts', 'app/api/payments/[transactionId]/cancel/route.ts',
    'app/api/cron/payments-reconcile/route.ts', 'app/api/admin/services/route.ts', 'app/api/partner/stats/route.ts', 'app/api/partner/dashboard/route.ts',
];

/** Layouts de garde (contrat §7.1) et interrupteur(s) attendu(s). */
const GUARD_LAYOUTS: Array<{ file: string; flags: FeatureFlag[] }> = [
    { file: 'app/halls/layout.tsx', flags: ['halls'] },
    { file: 'app/restaurants/[id]/tables/layout.tsx', flags: ['tables'] },
    { file: 'app/restaurants/[id]/menu/layout.tsx', flags: ['orders'] },
    { file: 'app/orders/layout.tsx', flags: ['halls', 'tables', 'orders'] },
    { file: 'app/partner/halls/layout.tsx', flags: ['halls'] },
    { file: 'app/partner/tables/layout.tsx', flags: ['tables'] },
    { file: 'app/partner/orders/layout.tsx', flags: ['orders'] },
    { file: 'app/partner/products/layout.tsx', flags: ['orders'] },
];

// ── Sources sans commentaires (arbre syntaxique) ───────────────────────────

const printer = ts.createPrinter({ removeComments: true });

function codeOf(rel: string): string {
    const abs = path.join(ROOT, ...rel.split('/'));
    assert.ok(fs.existsSync(abs), `${rel} absent`);
    const kind = rel.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
    const sf = ts.createSourceFile(rel, fs.readFileSync(abs, 'utf8'), ts.ScriptTarget.Latest, true, kind);
    return printer.printFile(sf);
}

/** Vrai si le fichier importe un module dont le chemin se termine par lib/features/flags. */
function importsFlags(code: string): boolean {
    return /from\s+["'](?:@\/|(?:\.\.\/)+)lib\/features\/flags["']/.test(code);
}

// ── 1. Réglages ────────────────────────────────────────────────────────────

describe('Interrupteurs — 1. réglages SUPERADMIN features.*', () => {
    test('trois clés à false par défaut', async () => {
        assert.deepEqual(await readFeatureFlagSettings(), { halls: false, tables: false, orders: false },
            'features.halls_enabled, features.tables_enabled, features.orders_enabled : false par défaut (M1)');
    });

    test('finance_setting_set : SUPERADMIN accepté, ADMIN FORBIDDEN, valeur non booléenne INVALID_VALUE (valeur inchangée)', async () => {
        const fx = await loadFixtures();
        for (const [flag, key] of Object.entries(FEATURE_FLAG_KEYS) as Array<[FeatureFlag, string]>) {
            const before0 = await getPlatformSetting(key);
            assert.equal(before0, false, `${key} : précondition false`);
            await withFeatureFlags({ [flag]: true }, async () => {
                assert.equal(await getPlatformSetting(key), true, `${key} : le SUPERADMIN bascule à true`);
            });
            assert.equal(await getPlatformSetting(key), false, `${key} : valeur restaurée`);

            const { data: byAdmin, error: adminErr } = await service.rpc('finance_setting_set', {
                p_key: key, p_value: { value: true }, p_actor: fx.users.ADMIN.id, p_reason: 'test interrupteurs : admin',
            });
            assert.equal(adminErr, null, `${key} par l'ADMIN : ${adminErr?.message}`);
            assert.deepEqual({ ok: (byAdmin as Row)?.ok, code: (byAdmin as Row)?.code }, { ok: false, code: 'FORBIDDEN' }, `${key} par l'ADMIN : ${JSON.stringify(byAdmin)}`);
            assert.equal(await getPlatformSetting(key), false, `${key} : inchangée après le refus de l'ADMIN`);

            const { data: bad, error: badErr } = await service.rpc('finance_setting_set', {
                p_key: key, p_value: { value: 'oui' }, p_actor: fx.users.SUPERADMIN.id, p_reason: 'test interrupteurs : valeur invalide',
            });
            assert.equal(badErr, null, `${key} = « oui » : ${badErr?.message}`);
            assert.deepEqual({ ok: (bad as Row)?.ok, code: (bad as Row)?.code }, { ok: false, code: 'INVALID_VALUE' }, `${key} = « oui » : ${JSON.stringify(bad)}`);
            assert.equal(await getPlatformSetting(key), false, `${key} : inchangée après une valeur invalide`);
        }
    });
});

// ── 2. GET /api/features ───────────────────────────────────────────────────

describe('Interrupteurs — 2. GET /api/features et lib/features/flags', () => {
    test('sans session : les trois valeurs, Cache-Control no-store ; la bascule est lue à la requête suivante', async () => {
        const closed = await callRoute('../../app/api/features/route', 'GET', '/api/features');
        assert.equal(closed.status, 200, `fermés : ${show(closed)}`);
        assert.deepEqual(closed.body, { halls: false, tables: false, orders: false }, `fermés : ${show(closed)}`);
        assert.match(closed.headers.get('cache-control') ?? '', /no-store/, 'Cache-Control: no-store (contrat 3.4)');
        await withFeatureFlags({ halls: true }, async () => {
            const open = await callRoute('../../app/api/features/route', 'GET', '/api/features');
            assert.equal(open.status, 200, `salles ouvertes : ${show(open)}`);
            assert.deepEqual(open.body, { halls: true, tables: false, orders: false }, `salles ouvertes : ${show(open)}`);
        });
        await withFeatureFlags({ tables: true, orders: true }, async () => {
            const open = await callRoute('../../app/api/features/route', 'GET', '/api/features');
            assert.deepEqual(open.body, { halls: false, tables: true, orders: true }, `tables et commandes ouvertes : ${show(open)}`);
        });
    });

    test('lib/features/flags : getFeatureFlags() lit les trois clés, featureNotFound() renvoie le 404 du contrat', async () => {
        const modPath = '../../lib/features/flags';
        let flags: { getFeatureFlags?: () => Promise<Row>; featureNotFound?: (f: FeatureFlag) => Response | Promise<Response> };
        try {
            flags = await importModule(modPath);
        } catch (err) {
            if (isModuleNotFound(err, modPath)) assert.fail(`lib/features/flags.ts absent (contrat 3.4, fix(7.3s)) — ${String((err as Error).message).split('\n')[0]}`);
            throw err;
        }
        assert.equal(typeof flags.getFeatureFlags, 'function', 'getFeatureFlags exporté');
        assert.equal(typeof flags.featureNotFound, 'function', 'featureNotFound exporté');
        assert.deepEqual(await flags.getFeatureFlags!(), { halls: false, tables: false, orders: false }, 'getFeatureFlags() : trois interrupteurs fermés');
        await withFeatureFlags({ orders: true }, async () => {
            assert.deepEqual(await flags.getFeatureFlags!(), { halls: false, tables: false, orders: true }, 'getFeatureFlags() après bascule de features.orders_enabled');
        });
        for (const f of ['halls', 'tables', 'orders'] as const) {
            const res = await flags.featureNotFound!(f);
            assert.equal(res.status, 404, `featureNotFound('${f}') : statut`);
            assert.deepEqual(await res.json(), NOT_FOUND_BODY, `featureNotFound('${f}') : corps`);
        }
    });
});

// ── 3. Interrupteurs fermés ────────────────────────────────────────────────

describe('Interrupteurs — 3. fermés : 404 propre, ordre session puis interrupteur', () => {
    test('GET publics des services sans session → 404 NOT_FOUND (interrupteur d\'abord)', async () => {
        await withFeatureFlags(ALL_CLOSED, async () => {
            for (const g of PUBLIC_GETS) {
                assertNotFound(await callRoute(g.mod, 'GET', g.path(), { params: g.params?.() }), `${g.label} sans session`);
            }
        });
    });

    for (const t of PROTECTED_POSTS) {
        test(`${t.label} : 401 sans session, 403 suspendu, 404 compte actif, aucune ligne créée`, async () => {
            await withFeatureFlags(ALL_CLOSED, async () => {
                const anon = await callRoute(t.mod, 'POST', t.path, { body: t.body() });
                assert.equal(anon.status, 401, `sans session : ${show(anon)}`);
                const sus = await callRoute(t.mod, 'POST', t.path, { token: suspended.accessToken, body: t.body() });
                assert.equal(sus.status, 403, `compte suspendu : ${show(sus)}`);
                assert.equal(sus.body.code, 'ACCOUNT_NOT_ACTIVE', `compte suspendu : ${show(sus)}`);
                const before0 = await rowsOf(t.table, client.userId);
                const active = await callRoute(t.mod, 'POST', t.path, { token: client.accessToken, body: t.body() });
                assertNotFound(active, `${t.label}, compte actif`);
                assert.deepEqual(await rowsOf(t.table, client.userId), before0, `${t.label} : aucune ligne ${t.table} créée`);
            });
        });
    }

    test('GET /api/orders : 401 sans session, 404 pour un compte actif quand les trois interrupteurs sont fermés', async () => {
        await withFeatureFlags(ALL_CLOSED, async () => {
            const anon = await callRoute('../../app/api/orders/route', 'GET', '/api/orders');
            assert.equal(anon.status, 401, `sans session : ${show(anon)}`);
            assertNotFound(await callRoute('../../app/api/orders/route', 'GET', '/api/orders', { token: client.accessToken }), 'GET /api/orders, compte actif');
        });
    });

    test('routes partenaire des services : 404 NOT_FOUND pour le propriétaire, chaque gestionnaire', async () => {
        await withFeatureFlags(ALL_CLOSED, async () => {
            const failures: string[] = [];
            for (const h of PARTNER_HANDLERS) {
                const id = randomUUID();
                const pathname = h.path.replace(':id', id);
                const r = await callRoute(`../../${h.file.replace(/\.ts$/, '')}`, h.method, pathname, {
                    token: partner.accessToken,
                    body: h.method === 'GET' || h.method === 'DELETE' ? undefined : {},
                    params: h.withId ? { id } : undefined,
                });
                if (r.status !== 404 || r.body.code !== 'NOT_FOUND' || r.body.error !== 'Page introuvable.') failures.push(`${h.method} ${h.path} (${h.flag}) : ${show(r)}`);
            }
            assert.deepEqual(failures, [], `gestionnaires partenaire non coupés :\n${failures.join('\n')}`);
        });
    });

    test('/api/payments/create : HALL_RESERVATION, TABLE_RESERVATION, ORDER → 404 sans paiement ; TICKET 200 et SUBSCRIPTION 201', async () => {
        const payer = await newBuyer('interrupteurs-payeur');
        const day = futureDate();
        const { data: resa, error: resaErr } = await service.from('hall_reservations').insert({
            hall_id: hallId, client_id: payer.userId, partner_id: partner.partnerId, start_date: day, end_date: day,
            total_amount: 50_000, deposit_amount: 15_000, balance_amount: 35_000, status: 'EN_ATTENTE', payment_status: 'PENDING',
        }).select('id').single();
        assert.equal(resaErr, null, `réservation de salle : ${resaErr?.message}`);
        const { data: tresa, error: tresaErr } = await service.from('table_reservations').insert({
            partner_id: partner.partnerId, table_id: tableId, client_id: payer.userId, reservation_date: futureDate(), reservation_time: '20:00:00',
            guest_count: 2, deposit_amount: 10_000, is_platform_payment: true, status: 'EN_ATTENTE', payment_status: 'PENDING',
        }).select('id').single();
        assert.equal(tresaErr, null, `réservation de table : ${tresaErr?.message}`);
        const { data: order, error: orderErr } = await service.from('orders').insert({
            order_number: `CMD-INT-${randomUUID()}`, client_id: payer.userId, partner_id: partner.partnerId, subtotal: 4_000, total_amount: 4_000,
            paid_amount: 0, balance_amount: 4_000, payment_type: 'INTEGRAL', delivery_mode: 'RETRAIT', order_status: 'EN_ATTENTE', payment_status: 'PENDING',
        }).select('id').single();
        assert.equal(orderErr, null, `commande : ${orderErr?.message}`);
        const ev = await createSaleEvent('interrupteurs-billet', [{ name: 'Standard', price: 2_000, total: 20 }]);
        const { data: plan, error: planErr } = await service.from('subscription_plans').insert({
            code: `TEST-INT-${randomUUID()}`, name: 'Pack de test (interrupteurs)', description: 'Plan dédié au test des interrupteurs.',
            price: 15_000, billing_period: 'MONTHLY', features: {}, is_active: true,
        }).select('id').single();
        assert.equal(planErr, null, `plan : ${planErr?.message}`);

        const create = (who: Buyer, body: Row) => callRoute('../../app/api/payments/create/route', 'POST', '/api/payments/create', {
            token: who.accessToken, body: { operator: 'WAVE', payerPhone: who.phone9, ...body }, headers: { 'idempotency-key': randomUUID() },
        });
        const targetPayments = async (): Promise<string[]> => {
            const { data, error } = await service.from('payments').select('id, payment_target').eq('client_id', payer.userId)
                .in('payment_target', ['HALL_RESERVATION', 'TABLE_RESERVATION', 'ORDER']);
            assert.equal(error, null, `paiements de services : ${error?.message}`);
            return (data ?? []).map((p) => `${p.payment_target}:${p.id}`);
        };

        await withFeatureFlags(ALL_CLOSED, async () => {
            assertNotFound(await create(payer, { targetType: 'HALL_RESERVATION', targetId: resa.id }), 'paiement HALL_RESERVATION');
            assertNotFound(await create(payer, { targetType: 'TABLE_RESERVATION', targetId: tresa.id }), 'paiement TABLE_RESERVATION');
            assertNotFound(await create(payer, { targetType: 'ORDER', targetId: order.id }), 'paiement ORDER');
            assert.deepEqual(await targetPayments(), [], 'aucun paiement de service créé');
            const ticket = await create(payer, { targetType: 'TICKET', targetId: ev.categories.Standard.id, quantity: 1 });
            assert.equal(ticket.status, 200, `TICKET non concerné : ${show(ticket)}`);
            const sub = await create(partner, { targetType: 'SUBSCRIPTION', targetId: plan.id });
            assert.equal(sub.status, 201, `SUBSCRIPTION non concerné : ${show(sub)}`);
        });
    });
});

// ── 4. Interrupteurs ouverts ───────────────────────────────────────────────

describe('Interrupteurs — 4. ouverts : comportement actuel ; middleware', () => {
    test('lectures publiques 200 avec les données, sans session', async () => {
        await withFeatureFlags(ALL_OPEN, async () => {
            for (const g of PUBLIC_GETS) {
                const r = await callRoute(g.mod, 'GET', g.path(), { params: g.params?.() });
                assert.equal(r.status, 200, `${g.label} ouvert : ${show(r)}`);
                assert.ok(r.text.includes(g.expectId()), `${g.label} ouvert : l'élément de test ${g.expectId()} est servi`);
            }
        });
    });

    test('réservation de salle par un compte actif : créée au nom de la session ; GET /api/orders et route partenaire 200', async () => {
        await withFeatureFlags(ALL_OPEN, async () => {
            const before0 = await rowsOf('hall_reservations', client.userId);
            const r = await callRoute('../../app/api/halls/reserve/route', 'POST', '/api/halls/reserve', { token: client.accessToken, body: { hallId, startDate: futureDate(), durationDays: 1 } });
            assert.ok(r.status >= 200 && r.status < 300, `réservation ouverte : ${show(r)}`);
            assert.equal((await rowsOf('hall_reservations', client.userId)).length, before0.length + 1, 'une réservation de plus pour le compte de la session');
            const orders = await callRoute('../../app/api/orders/route', 'GET', '/api/orders', { token: client.accessToken });
            assert.equal(orders.status, 200, `GET /api/orders ouvert : ${show(orders)}`);
            const mine = await callRoute('../../app/api/partner/halls/route', 'GET', '/api/partner/halls', { token: partner.accessToken });
            assert.equal(mine.status, 200, `GET /api/partner/halls ouvert : ${show(mine)}`);
            assert.ok(mine.text.includes(hallId), 'la salle du partenaire est servie');
        });
    });

    test('middleware : GET publics des services et /api/features sans session (D11) ; /api/orders protégé', async () => {
        const publicPaths = ['/api/features', '/api/halls', `/api/halls/${hallId}`, `/api/restaurants/${partner.partnerId}/tables`, `/api/restaurants/${partner.partnerId}/menu`];
        const blocked: string[] = [];
        for (const p of publicPaths) {
            const r = await callMiddleware(p, []);
            if (!r.passedThrough) blocked.push(`${p} : HTTP ${r.status}${r.location ? ` → ${r.location}` : ''}`);
        }
        assert.deepEqual(blocked, [], `routes publiques refusées par le middleware à un visiteur :\n${blocked.join('\n')}`);
        const orders = await callMiddleware('/api/orders', []);
        assert.equal(orders.passedThrough, false, 'GET /api/orders reste protégé par le middleware');
    });
});

// ── 5. Statique ────────────────────────────────────────────────────────────

describe('Interrupteurs — 5. statique : layouts de garde et gardes des routes', () => {
    test('chaque page de l\'inventaire a son layout de garde (serveur, notFound de next/navigation, getFeatureFlags, bon interrupteur)', () => {
        const problems: string[] = [];
        for (const { file, flags } of GUARD_LAYOUTS) {
            const abs = path.join(ROOT, ...file.split('/'));
            if (!fs.existsSync(abs)) {
                problems.push(`${file} absent`);
                continue;
            }
            const code = codeOf(file);
            if (/^\s*["']use client["']/.test(code)) problems.push(`${file} : composant client ('use client'), la garde doit être serveur`);
            if (!/import\s*\{[^}]*\bnotFound\b[^}]*\}\s*from\s*["']next\/navigation["']/.test(code)) problems.push(`${file} : notFound non importé de next/navigation`);
            if (!/\bnotFound\s*\(\s*\)/.test(code)) problems.push(`${file} : notFound() jamais appelé`);
            if (!importsFlags(code) || !/\bgetFeatureFlags\s*\(/.test(code)) problems.push(`${file} : getFeatureFlags() de lib/features/flags non appelé`);
            if (!/export\s+default\s+async\s+function/.test(code)) problems.push(`${file} : export default async function attendu (composant serveur)`);
            for (const f of flags) if (!new RegExp(`\\.${f}\\b|\\b${f}\\s*[:,}]|\\[["']${f}["']\\]`).test(code)) problems.push(`${file} : interrupteur « ${f} » non lu`);
        }
        assert.deepEqual(problems, [], problems.join('\n'));
    });

    test('chaque gestionnaire de l\'inventaire importe la garde de lib/features/flags', () => {
        const missing = GUARDED_ROUTE_FILES.filter((f) => !importsFlags(codeOf(f)));
        assert.deepEqual(missing, [], `routes sans garde d'interrupteur :\n${missing.join('\n')}`);
    });

    test('routes à ne pas couper (webhook, statut, annulation, cron, supervision, statistiques, tableau de bord) : jamais featureNotFound', () => {
        const cut = NEVER_CUT_FILES.filter((f) => /\bfeatureNotFound\s*\(/.test(codeOf(f)));
        assert.deepEqual(cut, [], `routes coupées à tort :\n${cut.join('\n')}`);
    });
});

// ── 6. Données conservées ──────────────────────────────────────────────────

describe('Interrupteurs — 6. aucune donnée supprimée', () => {
    test('bascules fermé → ouvert → fermé : salles, tables, produits, réservations et commandes du partenaire inchangés', async () => {
        const tables = ['halls', 'restaurant_tables', 'products', 'hall_reservations', 'table_reservations', 'orders'] as const;
        const snapshot = async (): Promise<Record<string, string[]>> => {
            const out: Record<string, string[]> = {};
            for (const t of tables) {
                const { data, error } = await service.from(t).select('id').eq('partner_id', partner.partnerId).order('id');
                assert.equal(error, null, `${t} du partenaire : ${error?.message}`);
                out[t] = (data ?? []).map((r) => String(r.id));
            }
            return out;
        };
        const before0 = await snapshot();
        assert.ok(before0.halls.includes(hallId) && before0.restaurant_tables.includes(tableId) && before0.products.includes(productId), 'précondition : données de test présentes');
        await withFeatureFlags(ALL_OPEN, async () => {
            assert.deepEqual(await snapshot(), before0, 'ouverts : données inchangées');
        });
        await withFeatureFlags(ALL_CLOSED, async () => {
            assert.deepEqual(await snapshot(), before0, 'fermés : données inchangées');
        });
        assert.deepEqual(await snapshot(), before0, 'après restauration : données inchangées');
    });
});

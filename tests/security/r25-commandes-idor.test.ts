/**
 * R25 — Lot 7, tâche 7.3 (contrat §7.1, D5, D10) : commandes et réservations de services.
 *  1. GET /api/orders?userId=<B> (faille IDOR, app/api/orders/route.ts:12-24) : la route lit l'identifiant dans
 *     l'URL dès qu'aucun jeton Bearer n'est envoyé ; c'est le cas de la page (app/orders/page.tsx:34), dont la
 *     session est en cookies. Après correctif : requireActiveSession, client_id = compte de la session,
 *     paramètre ignoré.
 *     - sans session → 401, aucune ligne de B dans la réponse ;
 *     - client A connecté par cookies (comme le navigateur), ?userId=<B> → ses seules lignes ;
 *     - client A connecté par Bearer, ?userId=<B> → ses seules lignes (garde-fou) ;
 *     - le middleware garde /api/orders fermé à un visiteur (garde-fou).
 *  2. Insertion REST sous le JWT d'un client (clé anon + signUp) dans hall_reservations, table_reservations et
 *     orders, à son propre nom → refusée, aucune ligne : les politiques hall_reservations_insert,
 *     table_reservations_insert et orders_insert (supabase/migrations/0003_rls.sql:184,217,250) sont
 *     supprimées par la migration 20261105000006 (D10) ; les écritures passent par les routes serveur.
 *  3. Catalogue : ces trois politiques n'existent plus.
 *
 * Rouge avant correctif (fix(7.3s), A5) :
 *  - 1 : sans session, la route renvoie 200 avec les commandes et réservations de B ; par cookies, idem (le
 *    cookie n'est pas lu) ;
 *  - 2 et 3 : les trois politiques WITH CHECK (client_id = auth.uid() OR is_admin()) laissent passer
 *    l'insertion ;
 *  - 1 (cookies et Bearer) : les interrupteurs features.* (fix(7.0a)) sont ouverts le temps du cas, parce que
 *    GET /api/orders répond 404 quand les trois sont fermés (D55) ; avant fix(7.0a) le cas échoue en nommant le
 *    réglage absent.
 * Déjà vert (garde-fous, signalés) : Bearer de A avec ?userId=<B> (le jeton prime aujourd'hui sur le
 * paramètre) ; middleware.
 *
 * Acteurs testés : comptes jetables (signUpAttacker), clé anon seule. Les lignes de la victime B, la salle et la
 * table du partenaire jetable C, et la bascule des interrupteurs (finance_setting_set, SUPERADMIN du seed) sont
 * préparées par une connexion directe à la base LOCALE (tests/helpers/db.ts, transaction validée), comme r24 :
 * jamais pour l'acteur testé (règle du lot 1A). Pas d'assertTerrainInvariants ici, comme r20 à r24 : la suite
 * n'écrit rien dans la boîte d'envoi et la règle du lot 1A (aucun client privilégié pour l'acteur) prime ;
 * écart à la règle « chaque suite nouvelle », signalé.
 */
import '../helpers/env';
import { before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { NextRequest } from 'next/server';
import { FIXTURE_USERS } from '../helpers/fixture-data';
import { inspect, openConcurrentClient } from '../helpers/db';
import { callMiddleware, sessionCookies, type SessionCookie } from '../helpers/middleware';
import { isModuleNotFound } from '../helpers/notification-invariants';
import { assertDenied, signUpAttacker, type AttackerAccount } from './helpers';

type Row = Record<string, unknown>;

const FLAG_KEYS = ['features.halls_enabled', 'features.tables_enabled', 'features.orders_enabled'] as const;
const ORDERS_ROUTE = '../../app/api/orders/route';

let a: AttackerAccount;
let b: AttackerAccount;
let partnerId = '';
let hallId = '';
let tableId = '';
/** Lignes de B (victime) et de A, préparées en base locale. */
const victimIds: string[] = [];
let attackerOrderId = '';

/** Exécute fn dans une transaction validée sur la base locale (préparation des données, jamais l'acteur). */
async function committed<T>(fn: (q: (sql: string, params?: unknown[]) => Promise<Row[]>) => Promise<T>): Promise<T> {
    const db = await openConcurrentClient({ applicationName: 'ev-test-r25' });
    try {
        const out = await fn(async (sql, params) => (await db.query(sql, params)).rows as Row[]);
        await db.commit();
        return out;
    } finally {
        await db.close();
    }
}

before(async () => {
    a = await signUpAttacker('r25-a');
    b = await signUpAttacker('r25-b');
    const owner = await signUpAttacker('r25-partenaire');
    await committed(async (q) => {
        const [p] = await q(
            `INSERT INTO public.partners (user_id, company_name, commercial_name, city, status, is_verified)
             VALUES ($1, $2, 'R25 Services', 'Dakar', 'VALIDE', true) RETURNING id::text AS id`,
            [owner.userId, `TEST R25 ${randomUUID().slice(0, 8)}`]);
        partnerId = String(p.id);
        const [h] = await q(
            `INSERT INTO public.halls (partner_id, name, capacity, price_per_day, deposit_percentage, city, is_active)
             VALUES ($1, 'Salle R25', 80, 40000, 30, 'Dakar', true) RETURNING id::text AS id`, [partnerId]);
        hallId = String(h.id);
        const [t] = await q(
            `INSERT INTO public.restaurant_tables (partner_id, table_number, capacity, is_active)
             VALUES ($1, $2, 4, true) RETURNING id::text AS id`, [partnerId, `R25-${randomUUID().slice(0, 8)}`]);
        tableId = String(t.id);
        const day = new Date(Date.now() + 90 * 24 * 3600 * 1000).toISOString().slice(0, 10);
        const [bo] = await q(
            `INSERT INTO public.orders (order_number, client_id, partner_id, subtotal, total_amount, paid_amount, balance_amount,
                                        payment_type, delivery_mode, order_status, payment_status)
             VALUES ($1, $2, $3, 7000, 7000, 0, 7000, 'INTEGRAL', 'RETRAIT', 'EN_ATTENTE', 'PENDING') RETURNING id::text AS id`,
            [`CMD-R25-B-${randomUUID()}`, b.userId, partnerId]);
        const [bh] = await q(
            `INSERT INTO public.hall_reservations (hall_id, client_id, partner_id, start_date, end_date, total_amount, deposit_amount,
                                                   balance_amount, status, payment_status)
             VALUES ($1, $2, $3, $4::date, $4::date, 40000, 12000, 28000, 'EN_ATTENTE', 'PENDING') RETURNING id::text AS id`,
            [hallId, b.userId, partnerId, day]);
        const [bt] = await q(
            `INSERT INTO public.table_reservations (partner_id, table_id, client_id, reservation_date, reservation_time, guest_count,
                                                    deposit_amount, is_platform_payment, status, payment_status)
             VALUES ($1, $2, $3, $4::date, '20:00:00', 3, 5000, true, 'EN_ATTENTE', 'PENDING') RETURNING id::text AS id`,
            [partnerId, tableId, b.userId, day]);
        victimIds.push(String(bo.id), String(bh.id), String(bt.id));
        const [ao] = await q(
            `INSERT INTO public.orders (order_number, client_id, partner_id, subtotal, total_amount, paid_amount, balance_amount,
                                        payment_type, delivery_mode, order_status, payment_status)
             VALUES ($1, $2, $3, 3000, 3000, 0, 3000, 'INTEGRAL', 'RETRAIT', 'EN_ATTENTE', 'PENDING') RETURNING id::text AS id`,
            [`CMD-R25-A-${randomUUID()}`, a.userId, partnerId]);
        attackerOrderId = String(ao.id);
    });
});

// ── Interrupteurs (préparation en base locale, restaurés ensuite) ──────────

/** Ouvre les trois interrupteurs le temps de fn (finance_setting_set, SUPERADMIN du seed), puis les remet. */
async function withServicesOpen<T>(fn: () => Promise<T>): Promise<T> {
    const saved = await committed(async (q) => {
        const rows = await q(`SELECT key, value->'value' AS v FROM public.platform_settings WHERE key = ANY($1::text[])`, [FLAG_KEYS]);
        const byKey = new Map(rows.map((r) => [String(r.key), r.v]));
        for (const k of FLAG_KEYS) assert.ok(byKey.has(k), `réglage ${k} absent de platform_settings (migration 20261105000001, fix(7.0a))`);
        return byKey;
    });
    const superadmin = await committed(async (q) => {
        const rows = await q(`SELECT id::text AS id FROM public.users WHERE email = $1`, [FIXTURE_USERS.SUPERADMIN.email]);
        assert.equal(rows.length, 1, 'SUPERADMIN du seed introuvable');
        return String(rows[0].id);
    });
    const set = (key: string, value: unknown, reason: string) => committed(async (q) => {
        const [r] = await q(`SELECT public.finance_setting_set($1::text, $2::jsonb, $3::uuid, $4::text) AS r`,
            [key, JSON.stringify({ value }), superadmin, reason]);
        assert.equal((r.r as Row)?.ok, true, `réglage ${key} refusé : ${JSON.stringify(r.r)}`);
    });
    const applied: string[] = [];
    try {
        for (const k of FLAG_KEYS) {
            await set(k, true, 'test R25 : interrupteurs ouverts');
            applied.push(k);
        }
        return await fn();
    } finally {
        for (const k of applied) await set(k, saved.get(k), 'restauration après le test R25');
    }
}

// ── Appel de la route ──────────────────────────────────────────────────────

async function getOrders(query: string, auth: { cookies?: SessionCookie[]; token?: string } = {}): Promise<{ status: number; body: Row; text: string }> {
    let mod: { GET?: (req: NextRequest) => Promise<Response> };
    try {
        mod = await import(ORDERS_ROUTE);
    } catch (err) {
        if (isModuleNotFound(err, ORDERS_ROUTE)) assert.fail(`app/api/orders/route.ts absent — ${String((err as Error).message).split('\n')[0]}`);
        throw err;
    }
    assert.equal(typeof mod.GET, 'function', 'app/api/orders/route.ts : GET non exporté');
    const headers: Record<string, string> = {};
    if (auth.cookies) headers.cookie = auth.cookies.map((c) => `${c.name}=${c.value}`).join('; ');
    if (auth.token) headers.authorization = `Bearer ${auth.token}`;
    const res = await mod.GET!(new NextRequest(`http://127.0.0.1:3000/api/orders${query}`, { method: 'GET', headers }));
    const text = await res.text();
    let body: Row = {};
    try {
        body = text ? JSON.parse(text) : {};
    } catch {
        body = { raw: text }; // corps non JSON conservé tel quel pour le message d'échec
    }
    return { status: res.status, body, text };
}

function listedIds(body: Row): string[] {
    const list = body.orders;
    assert.ok(Array.isArray(list), `réponse sans liste orders : ${JSON.stringify(body).slice(0, 300)}`);
    return (list as Row[]).map((o) => String(o.id)).sort();
}

async function accessToken(account: AttackerAccount): Promise<string> {
    const { data, error } = await account.client.auth.getSession();
    assert.equal(error, null, `session : ${error?.message}`);
    assert.ok(data.session, 'session ouverte');
    return data.session.access_token;
}

describe('R25 — GET /api/orders : le compte vient de la session, jamais de ?userId= (D5)', () => {
    test('sans session, ?userId=<B> → 401, aucune ligne de B ; le middleware garde la route fermée', async () => {
        const r = await getOrders(`?userId=${b.userId}`);
        assert.equal(r.status, 401, `sans session : HTTP ${r.status} ${r.text.slice(0, 300)}`);
        for (const id of victimIds) assert.ok(!r.text.includes(id), `ligne ${id} de B renvoyée sans session`);
        const mw = await callMiddleware(`/api/orders?userId=${b.userId}`, []);
        assert.equal(mw.passedThrough, false, 'middleware : /api/orders protégé pour un visiteur');
    });

    test('client A connecté par cookies (session du navigateur), ?userId=<B> → ses seules lignes', async () => {
        const cookies = await sessionCookies(a.client);
        await withServicesOpen(async () => {
            const r = await getOrders(`?userId=${b.userId}`, { cookies });
            assert.equal(r.status, 200, `A par cookies : HTTP ${r.status} ${r.text.slice(0, 300)}`);
            assert.deepEqual(listedIds(r.body), [attackerOrderId], 'A ne voit que sa commande');
            for (const id of victimIds) assert.ok(!r.text.includes(id), `ligne ${id} de B renvoyée à A`);
        });
    });

    test('client A connecté par Bearer, ?userId=<B> → ses seules lignes (garde-fou)', async () => {
        const token = await accessToken(a);
        await withServicesOpen(async () => {
            const r = await getOrders(`?userId=${b.userId}`, { token });
            assert.equal(r.status, 200, `A par Bearer : HTTP ${r.status} ${r.text.slice(0, 300)}`);
            assert.deepEqual(listedIds(r.body), [attackerOrderId], 'A ne voit que sa commande');
            for (const id of victimIds) assert.ok(!r.text.includes(id), `ligne ${id} de B renvoyée à A`);
        });
    });
});

describe('R25 — insertions REST dans les réservations et commandes : refusées (D10)', () => {
    test('client connecté : hall_reservations, table_reservations, orders à son nom → refusées, aucune ligne', async () => {
        const day = new Date(Date.now() + 120 * 24 * 3600 * 1000).toISOString().slice(0, 10);
        const cases: Array<{ table: 'hall_reservations' | 'table_reservations' | 'orders'; row: Row }> = [
            {
                table: 'hall_reservations',
                row: { id: randomUUID(), hall_id: hallId, client_id: b.userId, partner_id: partnerId, start_date: day, end_date: day, total_amount: 1, deposit_amount: 0, balance_amount: 1 },
            },
            {
                table: 'table_reservations',
                row: { id: randomUUID(), partner_id: partnerId, table_id: tableId, client_id: b.userId, reservation_date: day, reservation_time: '21:00:00', guest_count: 2, deposit_amount: 0 },
            },
            {
                table: 'orders',
                row: { id: randomUUID(), order_number: `CMD-R25-REST-${randomUUID()}`, client_id: b.userId, partner_id: partnerId, subtotal: 1, total_amount: 1, delivery_mode: 'RETRAIT' },
            },
        ];
        for (const c of cases) {
            const { error } = await b.client.from(c.table).insert(c.row);
            assertDenied(error, `INSERT ${c.table} par un client à son nom`);
            const { data, error: readErr } = await b.client.from(c.table).select('id').eq('id', String(c.row.id));
            assert.equal(readErr, null, `relecture de ${c.table} par B : ${readErr?.message}`);
            assert.deepEqual(data ?? [], [], `${c.table} : aucune ligne créée par REST`);
        }
    });

    test('catalogue : les politiques hall_reservations_insert, table_reservations_insert, orders_insert n\'existent plus', async () => {
        const rows = await inspect(async (db) => (await db.query<{ tablename: string; policyname: string }>(
            `SELECT tablename, policyname FROM pg_policies
              WHERE schemaname = 'public' AND policyname IN ('hall_reservations_insert', 'table_reservations_insert', 'orders_insert')
              ORDER BY policyname`)).rows);
        assert.deepEqual(rows, [], `politiques d'insertion encore présentes : ${JSON.stringify(rows)}`);
    });
});

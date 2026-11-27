/**
 * Contre-vérification du lot 12b — garde-fous éprouvés (attendus VERTS). Base LOCALE, faux SamirPay et faux SMS ; la
 * branche porte aussi les migrations du 12c (voir cv12b-1-trous). Chaque attaque passe par une route serveur avec le
 * jeton de l'attaquant ; la mise en place par les aides du lot.
 *
 *  G1 Accès : commande, suivi, code, nouveau code, annulation, paiement (premier et solde) de la commande d'un autre
 *     compte → 404, rien d'écrit ; « Mes commandes » ne montre que les siennes.
 *  G2 Argent : supplément et frais de zone changés entre le devis et la commande → ORDER_PRICE_CHANGED, rien de créé ;
 *     plafond de 3 commandes non payées tenu par la route.
 *  G3 Annulation sous concurrence : deux annulations simultanées → une seule, un seul remboursement égal au montant
 *     affiché ; annulation pendant l'acceptation de la partenaire → état cohérent, remboursement égal au payé.
 *  G4 Heure et mode : passé, au-delà de 7 jours, hors du quart d'heure, hors horaires, zone inactive ou archivée,
 *     minimum de zone, table d'un autre établissement → refusés, rien de créé.
 *  G5 Code : tables et clé private, déchiffrement et lecture fermés à anon, authenticated (et la clé à service_role) ;
 *     code effacé à une annulation par Event Village pendant « prête » ; jamais dans la cloche ni le journal.
 *  G6 Carte : produit archivé et zone archivée exclus (colonnes du 12c), produit « à vérifier » affiché non commandable,
 *     aucun champ hors de la liste attendue.
 */
import '../helpers/env';
import { after, before, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { BASE_URL } from '../parcours/helpers';
import { inspect, openConcurrentClient } from '../helpers/db';
import { GET as menuGet } from '../../app/api/restaurants/[id]/menu/route';
import { POST as quoteRoute } from '../../app/api/orders/quote/route';
import { POST as createRoute } from '../../app/api/orders/create/route';
import { GET as orderGet } from '../../app/api/orders/[id]/route';
import { GET as codeGet, POST as codePost } from '../../app/api/orders/[id]/code/route';
import { POST as cancelRoute } from '../../app/api/orders/[id]/cancel/route';
import { GET as ordersList } from '../../app/api/orders/route';
import { newTable, setHours } from '../parcours/l11a-helpers';
import {
    codeOf, n, newBuyer, newDeliveryZone, newOption, newPartner, newProduct, newShop, openOrdersService, order, orderBody, partnerAct,
    payOrder, placed, refundsOfOrder, releaseUnpaid, service, startOrderPay, superadminId, toReady, type Buyer, type Row, type TestPartner,
} from '../parcours/l12a-helpers';

let restore: () => Promise<void>;
let partner: TestPartner;
let client: Buyer;
let stranger: Buyer;
let shop: string;
let zone: string;

before(async () => {
    restore = await openOrdersService();
    partner = await newPartner('cv12b-g');
    client = await newBuyer('cv12b-g-client');
    stranger = await newBuyer('cv12b-g-autre');
    shop = await newShop(partner, { depositAllowed: true, depositPercent: 30 });
    zone = await newDeliveryZone(shop, 1_000, 2_000, 'Plateau cv12b');
});

beforeEach(async () => {
    if (client) await releaseUnpaid(client.userId);
    if (stranger) await releaseUnpaid(stranger.userId);
});

after(async () => {
    await releaseUnpaid(client.userId);
    await releaseUnpaid(stranger.userId);
    await restore();
});

function req(path: string, method: string, token: string | null, body?: unknown, headers: Record<string, string> = {}): NextRequest {
    const h: Record<string, string> = { 'content-type': 'application/json', ...headers };
    if (token) h.authorization = `Bearer ${token}`;
    return new NextRequest(`${BASE_URL}${path}`, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) });
}
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
async function reply(res: Response): Promise<{ status: number; body: Row }> {
    const text = await res.text();
    try {
        return { status: res.status, body: text ? (JSON.parse(text) as Row) : {} };
    } catch {
        return { status: res.status, body: { raw: text } };
    }
}
async function sql<T extends Row = Row>(text: string, params: unknown[] = []): Promise<T[]> {
    const c = await openConcurrentClient({ applicationName: 'ev-test-cv12b-g' });
    try {
        await c.query(`SELECT set_config('event_village.product_write', 'on', true)`);
        const { rows } = await c.query<T>(text, params);
        await c.commit();
        return rows;
    } finally {
        await c.close();
    }
}
const brief = (v: unknown, max = 300): string => {
    const s = typeof v === 'string' ? v : JSON.stringify(v);
    return s.length > max ? `${s.slice(0, max)}…` : s;
};
async function ordersCount(clientId: string): Promise<number> {
    const { count, error } = await service.from('orders').select('id', { count: 'exact', head: true }).eq('client_id', clientId).not('venue_id', 'is', null);
    assert.equal(error, null, error?.message);
    return count ?? 0;
}
const create = async (who: Buyer, body: Row) => reply(await createRoute(req('/api/orders/create', 'POST', who.accessToken, body)));
const quote = async (who: Buyer, body: Row) => reply(await quoteRoute(req('/api/orders/quote', 'POST', who.accessToken, body)));
const menu = async (id: string) => reply(await menuGet(req(`/api/restaurants/${id}/menu`, 'GET', null), ctx(id)));

// ── G1 ────────────────────────────────────────────────────────────────────────────────────────────────────────────

describe('G1 — accès à la commande d’un autre compte', () => {
    test('suivi, code, nouveau code, annulation, paiement et solde : 404, rien d’écrit ; Mes commandes : les siennes seulement', async () => {
        const p = await newProduct(partner, shop, { price: 3_000 });
        const id = await placed(client, orderBody(shop, [{ productId: p, quantity: 1 }], { payment: 'ACOMPTE' }));
        await payOrder(client, id);
        await toReady(partner, id);
        const before = await order(id);
        const smsBefore = n(before.code_resends);

        const r = {
            suivi: await reply(await orderGet(req(`/api/orders/${id}`, 'GET', stranger.accessToken), ctx(id))),
            code: await reply(await codeGet(req(`/api/orders/${id}/code`, 'GET', stranger.accessToken), ctx(id))),
            nouveauCode: await reply(await codePost(req(`/api/orders/${id}/code`, 'POST', stranger.accessToken), ctx(id))),
            annulation: await reply(await cancelRoute(req(`/api/orders/${id}/cancel`, 'POST', stranger.accessToken, {}), ctx(id))),
            paiement: await startOrderPay(stranger, id),
            solde: await startOrderPay(stranger, id, { part: 'SOLDE' }),
        };
        const statuses = Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v.status]));
        console.log(`[CV12B] G1. autre compte sur ${id} : ${JSON.stringify(statuses)} ; corps du code : ${brief(r.code.body)}`);
        for (const [k, v] of Object.entries(r)) assert.equal(v.status, 404, `${k} : HTTP ${v.status} ${brief(v.body)}`);
        assert.ok(!JSON.stringify(r).includes(await codeOf(client, id)), 'le code n’apparaît dans aucune réponse à l’autre compte');
        const after = await order(id);
        assert.equal(after.order_state, before.order_state);
        assert.equal(n(after.code_resends), smsBefore, 'aucun nouveau code demandé');
        const { data: pays } = await service.from('payments').select('id').eq('order_id', id).eq('client_id', stranger.userId);
        assert.deepEqual(pays ?? [], [], 'aucun paiement au nom de l’autre compte');

        const list = await reply(await ordersList(req('/api/orders', 'GET', stranger.accessToken)));
        const ids = ((list.body.orders ?? []) as Row[]).map((o) => o.id);
        assert.ok(!ids.includes(id), 'Mes commandes de l’autre compte ne montre pas la commande');
        const mine = await reply(await ordersList(req('/api/orders?userId=' + client.userId, 'GET', stranger.accessToken)));
        assert.ok(!((mine.body.orders ?? []) as Row[]).some((o) => o.id === id), '?userId= ignoré');
    });
});

// ── G2 ────────────────────────────────────────────────────────────────────────────────────────────────────────────

describe('G2 — argent lu en base', () => {
    test('supplément changé entre le devis et la commande : refus avec le nouveau total, rien de créé', async () => {
        const p = await newProduct(partner, shop, { price: 2_000 });
        const opt = await newOption(p, 'Double viande', 500);
        const body = orderBody(shop, [{ productId: p, quantity: 2, optionIds: [opt] }]);
        const q = await quote(client, body);
        assert.equal(q.status, 200, brief(q.body));
        const shown = q.body.quote as Row;
        await sql(`UPDATE public.product_options SET price_delta = 900 WHERE id = $1`, [opt]);
        const before = await ordersCount(client.userId);
        const r = await create(client, { ...body, expectedTotal: shown.total, expectedToPay: shown.toPayNow });
        console.log(`[CV12B] G2. supplément 500 → 900 : devis ${String(shown.total)} ; création HTTP ${r.status} ${brief(r.body)}`);
        assert.equal(r.status, 409);
        assert.equal(r.body.code, 'ORDER_PRICE_CHANGED');
        assert.equal(n(r.body.total), 2 * (2_000 + 900) + Math.ceil((2 * 2_900) * 5 / 100), 'nouveau total calculé en base (frais 5 %)');
        assert.equal(await ordersCount(client.userId), before, 'aucune commande créée');
    });

    test('frais de zone changés entre le devis et la commande : refus, rien de créé', async () => {
        const p = await newProduct(partner, shop, { price: 3_000 });
        const z = await newDeliveryZone(shop, 500, 0, 'Mermoz cv12b');
        const body = orderBody(shop, [{ productId: p, quantity: 1 }], { mode: 'LIVRAISON', zoneId: z, address: 'Rue 10, Mermoz', phone: client.phone9 });
        const q = await quote(client, body);
        assert.equal(q.status, 200, brief(q.body));
        const shown = q.body.quote as Row;
        const { error } = await service.from('order_delivery_zones').update({ fee: 1_500 }).eq('id', z);
        assert.equal(error, null, error?.message);
        const before = await ordersCount(client.userId);
        const r = await create(client, { ...body, expectedTotal: shown.total, expectedToPay: shown.toPayNow });
        console.log(`[CV12B] G2. zone 500 → 1 500 : devis ${String(shown.total)} ; création HTTP ${r.status} ${brief(r.body)}`);
        assert.equal(r.status, 409);
        assert.equal(r.body.code, 'ORDER_PRICE_CHANGED');
        assert.equal(await ordersCount(client.userId), before);
    });

    test('plafond de 3 commandes non payées : la 4e est refusée par la route', async () => {
        const buyer = await newBuyer('cv12b-g-plafond');
        try {
            const p = await newProduct(partner, shop, { price: 1_000 });
            const out: number[] = [];
            let last: Row = {};
            for (let i = 0; i < 4; i += 1) {
                const r = await create(buyer, orderBody(shop, [{ productId: p, quantity: 1 }]));
                out.push(r.status);
                last = r.body;
            }
            console.log(`[CV12B] G2. plafond : statuts ${JSON.stringify(out)} ; 4e : ${brief(last)}`);
            assert.deepEqual(out.slice(0, 3), [201, 201, 201]);
            assert.notEqual(out[3], 201);
            assert.equal(await ordersCount(buyer.userId), 3);
        } finally {
            await releaseUnpaid(buyer.userId);
        }
    });
});

// ── G3 ────────────────────────────────────────────────────────────────────────────────────────────────────────────

describe('G3 — annulation sous concurrence', () => {
    test('deux annulations simultanées : une seule, un remboursement égal au montant affiché', async () => {
        const p = await newProduct(partner, shop, { price: 4_000 });
        const id = await placed(client, orderBody(shop, [{ productId: p, quantity: 1 }]));
        await payOrder(client, id);
        const shown = await reply(await orderGet(req(`/api/orders/${id}`, 'GET', client.accessToken), ctx(id)));
        const a = (shown.body.order as Row).amounts as Row;
        const displayed = n(a.paidGoods ?? a.paid_goods) + n(a.paidFees ?? a.paid_fees);
        const [r1, r2] = await Promise.all([
            reply(await cancelRoute(req(`/api/orders/${id}/cancel`, 'POST', client.accessToken, {}), ctx(id))),
            reply(await cancelRoute(req(`/api/orders/${id}/cancel`, 'POST', client.accessToken, {}), ctx(id))),
        ]);
        const refunds = await refundsOfOrder(id);
        const o = await order(id);
        console.log(`[CV12B] G3. deux annulations : HTTP ${r1.status} / ${r2.status} ; affiché ${displayed} ; remboursements ${brief(refunds.map((f) => n(f.amount)))} ; refunded_amount ${String(o.refunded_amount)}`);
        assert.equal([r1, r2].filter((r) => r.status === 200).length, 1, `une seule annulation acceptée : ${brief([r1.body, r2.body])}`);
        assert.equal(o.order_state, 'ANNULEE_CLIENT');
        assert.equal(refunds.length, 1, 'un seul remboursement');
        assert.equal(n(refunds[0].amount), displayed, 'remboursé = affiché (commande + frais)');
        assert.equal(displayed, 4_000 + 200);
    });

    test('annulation pendant l’acceptation de la partenaire : état cohérent, remboursement égal au payé', async () => {
        const p = await newProduct(partner, shop, { price: 5_000 });
        const id = await placed(client, orderBody(shop, [{ productId: p, quantity: 1 }]));
        await payOrder(client, id);
        const [c, acc] = await Promise.all([
            reply(await cancelRoute(req(`/api/orders/${id}/cancel`, 'POST', client.accessToken, {}), ctx(id))),
            partnerAct(partner, id, { action: 'ACCEPTER' }),
        ]);
        const o = await order(id);
        const refunds = await refundsOfOrder(id);
        const paid = n(o.paid_goods) + n(o.paid_fees);
        console.log(`[CV12B] G3. annulation ∥ acceptation : client HTTP ${c.status}, partenaire HTTP ${acc.status} ; état ${String(o.order_state)} ; payé ${paid} ; remboursements ${brief(refunds.map((f) => n(f.amount)))}`);
        if (o.order_state === 'ANNULEE_CLIENT') {
            assert.equal(c.status, 200);
            assert.equal(refunds.length, 1);
            assert.equal(n(refunds[0].amount), paid);
        } else {
            assert.equal(o.order_state, 'ACCEPTEE');
            assert.notEqual(c.status, 200);
            assert.equal(refunds.length, 0);
        }
    });
});

// ── G4 ────────────────────────────────────────────────────────────────────────────────────────────────────────────

describe('G4 — heure et mode', () => {
    test('passé, au-delà de 7 jours, hors du quart d’heure, hors horaires, zone inactive ou archivée, minimum, table d’un autre établissement : refusés', async () => {
        const p = await newProduct(partner, shop, { price: 1_500 });
        const line = [{ productId: p, quantity: 1 }];
        const q = 15 * 60_000;
        const slot = (ms: number) => new Date(Math.ceil(ms / q) * q).toISOString().slice(0, 16);
        const inactive = await newDeliveryZone(shop, 300, 0, 'Inactive cv12b');
        const archived = await newDeliveryZone(shop, 300, 0, 'Archivée cv12b');
        await service.from('order_delivery_zones').update({ is_active: false }).eq('id', inactive);
        await service.from('order_delivery_zones').update({ is_active: false, archived_at: new Date().toISOString() }).eq('id', archived);
        const otherShop = await newShop(partner);
        const foreignTable = await newTable(partner, otherShop, 4);
        // Établissement ouvert seulement de 03:00 à 04:00 (heure de Dakar) : une heure à 12:00 demain est hors horaires
        const narrow = await newShop(partner);
        const hours = await setHours(partner, narrow, [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({ weekday, opens_at: '03:00', closes_at: '04:00' })));
        assert.equal(hours.ok, true, `horaires : ${JSON.stringify(hours)}`);
        const narrowP = await newProduct(partner, narrow, { price: 1_000 });
        const tomorrowNoon = `${new Date(Date.now() + 86_400_000).toISOString().slice(0, 10)}T12:00`;
        const delivery = { mode: 'LIVRAISON', address: 'Rue 10, Plateau', phone: client.phone9 };

        const cases: Array<[string, Row]> = [
            ['passé', orderBody(shop, line, { scheduledFor: slot(Date.now() - 2 * 3_600_000) })],
            ['au-delà de 7 jours', orderBody(shop, line, { scheduledFor: slot(Date.now() + 8 * 86_400_000) })],
            ['hors du quart d’heure', orderBody(shop, line, { scheduledFor: `${slot(Date.now() + 3 * 3_600_000).slice(0, 14)}07` })],
            ['hors horaires', orderBody(narrow, [{ productId: narrowP, quantity: 1 }], { scheduledFor: tomorrowNoon })],
            ['zone inactive', orderBody(shop, line, { ...delivery, zoneId: inactive })],
            ['zone archivée', orderBody(shop, line, { ...delivery, zoneId: archived })],
            ['minimum de zone', orderBody(shop, line, { ...delivery, zoneId: zone })],
            ['table d’un autre établissement', orderBody(shop, line, { mode: 'SUR_PLACE', onsiteTableId: foreignTable })],
        ];
        const before = await ordersCount(client.userId);
        const seen: string[] = [];
        for (const [label, body] of cases) {
            const r = await create(client, body);
            seen.push(`${label} : HTTP ${r.status} ${String(r.body.code ?? '')} « ${String(r.body.error ?? '')} »`);
        }
        console.log(`[CV12B] G4.\n  ${seen.join('\n  ')}`);
        for (const s of seen) assert.ok(!/HTTP 20\d/.test(s), s);
        assert.equal(await ordersCount(client.userId), before, 'aucune commande créée');
    });
});

// ── G5 ────────────────────────────────────────────────────────────────────────────────────────────────────────────

describe('G5 — code de remise', () => {
    test('tables et clé private, déchiffrement et lecture fermés aux rôles de l’API', async () => {
        const rows = await inspect(async (c) => (await c.query<Row>(`
            SELECT r AS role,
                   has_schema_privilege(r, 'private', 'USAGE') AS schema_usage,
                   has_table_privilege(r, 'private.order_codes', 'SELECT') AS codes_select,
                   has_table_privilege(r, 'private.order_code_enc_key', 'SELECT') AS key_select,
                   has_function_privilege(r, 'private.order_code_decrypt(bytea)', 'EXECUTE') AS decrypt_exec,
                   has_function_privilege(r, 'private.order_issue_code(uuid)', 'EXECUTE') AS issue_exec,
                   has_function_privilege(r, 'public.order_code_reveal(jsonb)', 'EXECUTE') AS reveal_exec
              FROM unnest(ARRAY['anon', 'authenticated', 'service_role']) AS r`)).rows);
        console.log(`[CV12B] G5. droits : ${JSON.stringify(rows)}`);
        for (const r of rows) {
            assert.equal(r.schema_usage, false, `${String(r.role)} : usage de private`);
            assert.equal(r.codes_select, false, `${String(r.role)} : private.order_codes`);
            assert.equal(r.key_select, false, `${String(r.role)} : clé`);
            assert.equal(r.decrypt_exec, false, `${String(r.role)} : déchiffrement`);
            assert.equal(r.issue_exec, false, `${String(r.role)} : émission`);
            assert.equal(r.reveal_exec, r.role === 'service_role', `${String(r.role)} : order_code_reveal`);
        }
        type Rest = { from(t: string): { select(c: string): { limit(n: number): PromiseLike<{ data: unknown[] | null; error: { message: string } | null }> } } };
        const priv = (service as unknown as { schema(s: string): Rest }).schema('private');
        const viaRest = await priv.from('order_codes').select('*').limit(1);
        console.log(`[CV12B] G5. clé de service sur private.order_codes par la REST : ${viaRest.error ? viaRest.error.message : `${viaRest.data?.length} ligne(s)`}`);
        assert.ok(viaRest.error, 'schéma private non servi par la REST');
    });

    test('annulation par Event Village pendant « prête » : code effacé ; jamais dans la cloche ni le journal', async () => {
        const p = await newProduct(partner, shop, { price: 2_500 });
        const id = await placed(client, orderBody(shop, [{ productId: p, quantity: 1 }]));
        await payOrder(client, id);
        await toReady(partner, id);
        const code = await codeOf(client, id);
        const shown = await reply(await codeGet(req(`/api/orders/${id}/code`, 'GET', client.accessToken), ctx(id)));
        assert.equal(shown.body.code, code, 'témoin : code visible par le client');
        const [held] = await inspect(async (c) => (await c.query<Row>(`SELECT count(*)::int AS n FROM private.order_codes WHERE order_id = $1`, [id])).rows);
        const { data: cancel, error } = await service.rpc('order_cancel', {
            p: { order_id: id, actor_id: await superadminId(), origin: 'EVENT_VILLAGE', reason: 'Contrôle de la contre-vérification', partner_fault: false },
        });
        assert.equal(error, null, error?.message);
        assert.equal((cancel as Row).ok, true, JSON.stringify(cancel));
        const [left] = await inspect(async (c) => (await c.query<Row>(`SELECT count(*)::int AS n FROM private.order_codes WHERE order_id = $1`, [id])).rows);
        const after = await reply(await codeGet(req(`/api/orders/${id}/code`, 'GET', client.accessToken), ctx(id)));
        const number = String((await order(id)).order_number);
        const traces = await inspect(async (c) => (await c.query<Row>(`
            SELECT 'cloche' AS src, n.content AS txt FROM public.notifications n WHERE n.user_id = $1
            UNION ALL SELECT 'journal', a.metadata::text || coalesce(a.new_value::text, '') || coalesce(a.old_value::text, '')
              FROM public.audit_logs a WHERE a.object_id = $2::uuid OR a.metadata->>'order_id' = $2
            UNION ALL SELECT 'file', o.template_data::text FROM public.notification_outbox o WHERE o.template_data->>'order_id' = $2`, [client.userId, id])).rows);
        const leaks = traces.filter((t) => typeof t.txt === 'string' && t.txt.replace(number, '').match(new RegExp(`(^|\\D)${code}(\\D|$)`)));
        console.log(`[CV12B] G5. code ${code} : lignes private avant ${String(held.n)}, après annulation ${String(left.n)} ; lecture après : HTTP ${after.status} ${brief(after.body)} ; traces examinées ${traces.length}, contenant le code ${leaks.length} ${brief(leaks)}`);
        assert.equal(held.n, 1);
        assert.equal(left.n, 0, 'code effacé à l’annulation');
        assert.notEqual(after.status, 200);
        assert.deepEqual(leaks, [], 'code dans la cloche, le journal ou la file');
    });
});

// ── G6 ────────────────────────────────────────────────────────────────────────────────────────────────────────────

describe('G6 — carte des plats', () => {
    test('archivés exclus, « à vérifier » non commandable, aucun champ interne', async () => {
        const menuShop = await newShop(partner);
        const kept = await newProduct(partner, menuShop, { price: 1_000, name: 'Gardé cv12b', stock: 3 });
        const gone = await newProduct(partner, menuShop, { price: 1_000, name: 'Archivé cv12b' });
        const review = await newProduct(partner, menuShop, { price: 1_000, name: 'À vérifier cv12b' });
        const z = await newDeliveryZone(menuShop, 400, 0, 'Archivée carte cv12b');
        // Produit vendu une fois puis retiré par la partenaire (fonction du 12c) : archivé
        await placed(client, orderBody(menuShop, [{ productId: gone, quantity: 1 }]));
        await releaseUnpaid(client.userId);
        const { data: removed, error: remErr } = await service.rpc('order_product_remove', { p: { actor_id: partner.userId, product_id: gone } });
        assert.equal(remErr, null, remErr?.message);
        assert.equal((removed as Row).outcome, 'ARCHIVED', JSON.stringify(removed));
        await service.from('order_delivery_zones').update({ is_active: true, archived_at: new Date().toISOString() }).eq('id', z);
        await sql(`UPDATE public.products SET review_state = 'A_VERIFIER', review_words = ARRAY['vin'], review_requested_at = now() WHERE id = $1`, [review]);

        const m = await menu(menuShop);
        assert.equal(m.status, 200, brief(m.body));
        const body = m.body.menu as Row;
        const prods = body.products as Row[];
        const ids = prods.map((x) => x.id);
        const zones = (body.zones as Row[]).map((x) => x.id);
        const r = prods.find((x) => x.id === review);
        const allowed = ['id', 'name', 'description', 'price', 'image', 'categoryId', 'availability', 'regulated', 'inReview', 'orderable', 'daily', 'portionsLeft', 'portionsTotal', 'options'];
        const extra = [...new Set(prods.flatMap((x) => Object.keys(x)))].filter((k) => !allowed.includes(k));
        const { data: raw } = await service.rpc('order_venue_menu', { p_venue_id: menuShop });
        const rawText = JSON.stringify(raw);
        const internal = ['stock_quantity', 'regulated_admin', 'review_words', 'review_note', 'regulated_checked', 'archived_at', 'partner_id', '"stock"'].filter((k) => rawText.includes(k));
        console.log(`[CV12B] G6. produits ${brief(prods.map((x) => `${String(x.name)}:${String(x.orderable)}`))} ; zones ${brief(zones)} ; à vérifier ${brief(r)} ; clés en trop ${brief(extra)} ; champs internes dans la réponse brute ${brief(internal)}`);
        assert.ok(ids.includes(kept));
        assert.ok(!ids.includes(gone), 'produit archivé exclu');
        assert.ok(!zones.includes(z), 'zone archivée exclue');
        assert.ok(r, 'produit à vérifier affiché');
        assert.equal(r!.orderable, false);
        assert.equal(r!.inReview, true);
        assert.deepEqual(extra, []);
        assert.deepEqual(internal, []);
    });
});

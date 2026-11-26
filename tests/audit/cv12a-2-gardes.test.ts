/**
 * Contre-vérification du lot 12a — garde-fous éprouvés de façon indépendante (verts attendus ; un rouge serait un trou).
 * Base LOCALE, faux SamirPay et faux SMS ; mise en place par les aides du lot ; attaques par les routes (jeton de
 * l'attaquant) ou par la REST (clé anon + jeton), jamais par la clé de service. Invariants du lot (o1 à o7) et des
 * livraisons précédentes (financier compris) vérifiés à la fin, après la suite des trous.
 *
 *  G1 Plafond de 3 commandes non payées tenu sous concurrence (6 créations simultanées, 2 établissements).
 *  G2 Dernière portion du plat du jour : deux clients en même temps, une seule commande ; portions rendues une seule fois.
 *  G3 Paiement arrivé après l'annulation par le client, webhook rejoué : remboursé en entier une fois, jamais compté.
 *  G4 F3/F4 : quantités hors bornes ou mal formées, produit d'un autre établissement ou d'une autre partenaire,
 *     supplément d'un autre produit : refusés, aucune commande.
 *  G5 F1/F2 : la partenaire, son livreur et un tiers ne lisent ni n'écrivent rien des commandes par la REST ; clé du code
 *     et fonctions du code inaccessibles ; produits et portions non modifiables par la REST.
 *  G6 Livreur invité qui n'a pas accepté : ne reçoit aucune commande, ne voit rien.
 *  G7 Code de remise : jamais dans une réponse, la boîte d'envoi ni le journal ; 5 essais puis blocage (même le bon code) ;
 *     3 nouveaux codes au plus ; remise avec le dernier code seulement.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { BASE_URL } from '../parcours/helpers';
import { assertLot12aInvariants } from '../helpers/lot12a-invariants';
import { deliverWebhook, paymentById, providerSays } from '../parcours/paiement-helpers';
import { POST as clientCancelRoute } from '../../app/api/orders/[id]/cancel/route';
import { POST as clientCodeRoute } from '../../app/api/orders/[id]/code/route';
import { GET as courierOrdersGet } from '../../app/api/courier/orders/route';
import {
    addCourier, codeOf, n, newBuyer, newDeliveryZone, newOption, newPartner, newProduct, newShop, openOrdersService, order, orderBody,
    orderRoute, partnerAct, payOrder, placed, refundsOfOrder, releaseUnpaid, service, setPortions, startOrderPay, tick, userClient,
    dailySpecialWindowClosed,
    type Buyer, type Row, type TestPartner,
} from '../parcours/l12a-helpers';

let restore: () => Promise<void>;
let partner: TestPartner;
let other: TestPartner;
let shop: string;
let shopB: string;
let zone: string;
const buyers: Buyer[] = [];

async function buyer(label: string): Promise<Buyer> {
    const b = await newBuyer(`cv12a-g-${label}`);
    buyers.push(b);
    return b;
}

before(async () => {
    restore = await openOrdersService();
    partner = await newPartner('cv12a-g');
    other = await newPartner('cv12a-g-autre');
    shop = await newShop(partner, { depositAllowed: true, payOnHandover: true });
    shopB = await newShop(partner);
    zone = await newDeliveryZone(shop, 500, 0);
});

after(async () => {
    for (const b of buyers) await releaseUnpaid(b.userId);
    await restore();
    await assertLot12aInvariants('cv12a-2-gardes');
});

function req(path: string, method: string, token: string | null, body?: unknown): NextRequest {
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (token) headers.authorization = `Bearer ${token}`;
    return new NextRequest(`${BASE_URL}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
}
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
async function reply(res: Response): Promise<{ status: number; body: Row }> {
    return { status: res.status, body: (await res.json()) as Row };
}
async function portionsOf(productId: string): Promise<Row | null> {
    const { data, error } = await service.from('product_daily_portions').select('portions, sold').eq('product_id', productId).maybeSingle();
    assert.equal(error, null, error?.message);
    return data as Row | null;
}

describe('cv12a — garde-fous', () => {
    test('G1 — plafond de 3 non payées sous concurrence : 6 créations simultanées sur 2 établissements, 3 acceptées', async () => {
        const c = await buyer('plafond');
        const pa = await newProduct(partner, shop, { price: 1_000 });
        const pb = await newProduct(partner, shopB, { price: 1_000 });
        const rs = await Promise.all([0, 1, 2, 3, 4, 5].map((i) =>
            orderRoute(c, orderBody(i % 2 ? shop : shopB, [{ productId: i % 2 ? pa : pb, quantity: 1 }]))));
        const statuses = rs.map((r) => r.status).sort();
        assert.deepEqual(statuses, [201, 201, 201, 429, 429, 429], JSON.stringify(rs.map((r) => [r.status, r.body.code])));
        const { count } = await service.from('orders').select('id', { count: 'exact', head: true })
            .eq('client_id', c.userId).eq('order_state', 'EN_ATTENTE_PAIEMENT');
        assert.equal(count, 3);
    });

    test('G2 — dernière portion : deux clients en même temps, une seule commande ; rendue une seule fois à l’expiration', async () => {
        const dish = await newProduct(partner, shop, { price: 2_000, daily: true, name: 'Mafé du jour' });
        assert.equal((await setPortions(partner, dish, 1)).ok, true);
        // Entre minuit moins la préparation et minuit (Dakar), « au plus tôt » tombe le lendemain : la base refuse le plat du
        // jour (règle du lot 12a, même garde que l12a-commandes) ; le test vérifie ce refus, puis s'arrête (run 686, 23 h 42)
        if (dailySpecialWindowClosed()) {
            const late = await orderRoute(await buyer('portion-soir'), orderBody(shop, [{ productId: dish, quantity: 1 }]));
            assert.deepEqual([late.status, late.body.code], [409, 'DAILY_SPECIAL_TODAY_ONLY'], JSON.stringify(late.body));
            return;
        }
        const [a, b] = [await buyer('portion-a'), await buyer('portion-b')];
        const rs = await Promise.all([a, b].map((x) => orderRoute(x, orderBody(shop, [{ productId: dish, quantity: 1 }]))));
        assert.deepEqual(rs.map((r) => r.status).sort(), [201, 409], JSON.stringify(rs.map((r) => [r.status, r.body.code])));
        assert.deepEqual(await portionsOf(dish), { portions: 1, sold: 1 });
        await releaseUnpaid(a.userId);
        await releaseUnpaid(b.userId);
        await tick();
        await tick();
        assert.deepEqual(await portionsOf(dish), { portions: 1, sold: 0 }, 'portion rendue une seule fois');
    });

    test('G3 — paiement arrivé après l’annulation par le client, webhook rejoué : remboursé en entier une seule fois, jamais compté', async () => {
        const c = await buyer('tardif');
        const p = await newProduct(partner, shop, { price: 5_000 });
        const id = await placed(c, orderBody(shop, [{ productId: p, quantity: 1 }]));
        const started = await startOrderPay(c, id);
        assert.equal(started.status, 201, JSON.stringify(started.body));
        assert.equal(n(started.payment!.amount), 5_250, '5 000 + frais 250, relus sur la commande');
        const cancel = await reply(await clientCancelRoute(req(`/api/orders/${id}/cancel`, 'POST', c.accessToken), ctx(id)));
        assert.equal(cancel.status, 200, JSON.stringify(cancel.body));
        providerSays(started.payment!, 'SUCCESS');
        assert.equal((await deliverWebhook(started.payment!)).status, 200);
        assert.equal((await deliverWebhook(started.payment!)).status, 200);
        const o = await order(id);
        const pay = await paymentById(started.payment!.id);
        const refunds = await refundsOfOrder(id);
        assert.deepEqual([o.order_state, n(o.paid_goods), n(o.paid_fees)], ['ANNULEE_CLIENT', 0, 0], 'jamais compté');
        assert.notEqual(pay.status, 'SUCCESS');
        assert.deepEqual(refunds.map((r) => n(r.amount)), [5_250], `un seul remboursement, en entier : ${JSON.stringify(refunds)}`);
    });

    test('G4 — quantités mal formées, produit d’un autre établissement ou d’une autre partenaire, supplément d’un autre produit : refusés', async () => {
        const c = await buyer('quantites');
        const p = await newProduct(partner, shop, { price: 1_000 });
        const q = await newProduct(partner, shop, { price: 1_000 });
        const optOfQ = await newOption(q, 'Sauce', 200);
        const inShopB = await newProduct(partner, shopB, { price: 1_000 });
        const otherShop = await newShop(other);
        const foreign = await newProduct(other, otherShop, { price: 1_000 });
        const accepted: string[] = [];
        for (const quantity of [-1, 0, 2.5, '2.5', 100, '1e2', '99999999999', '+3', ' 3', '0x10']) {
            const r = await orderRoute(c, orderBody(shop, [{ productId: p, quantity }]));
            if (r.status === 201) accepted.push(`quantité ${JSON.stringify(quantity)} : ${JSON.stringify(r.body.order)}`);
        }
        const cases: Array<[string, Array<{ productId: string; quantity: number; optionIds?: string[] }>]> = [
            ['produit d’un autre établissement de la même partenaire', [{ productId: inShopB, quantity: 1 }]],
            ['produit d’une autre partenaire', [{ productId: foreign, quantity: 1 }]],
            ['supplément d’un autre produit', [{ productId: p, quantity: 1, optionIds: [optOfQ] }]],
        ];
        for (const [label, lines] of cases) {
            const r = await orderRoute(c, orderBody(shop, lines));
            if (r.status === 201) accepted.push(`${label} : ${JSON.stringify(r.body.order)}`);
        }
        assert.deepEqual(accepted, []);
        const { count } = await service.from('orders').select('id', { count: 'exact', head: true }).eq('client_id', c.userId);
        assert.equal(count, 0, 'aucune commande créée');
    });

    test('G5 — REST : partenaire, livreur et tiers ne lisent ni n’écrivent les commandes ; clé et fonctions du code inaccessibles', async () => {
        const c = await buyer('rest-client');
        const courier = await buyer('rest-livreur');
        const stranger = await buyer('rest-tiers');
        await addCourier(partner, courier);
        // Fenêtre de fin de soirée (dailySpecialWindowClosed) : un produit ordinaire, le plat du jour serait refusé (run 686) ;
        // les contrôles REST du test portent sur la commande, pas sur le plat du jour
        const lateEvening = dailySpecialWindowClosed();
        const dish = await newProduct(partner, shop, { price: 6_000, daily: !lateEvening });
        if (!lateEvening) assert.equal((await setPortions(partner, dish, 10)).ok, true);
        const id = await placed(c, orderBody(shop, [{ productId: dish, quantity: 1 }],
            { mode: 'LIVRAISON', zoneId: zone, address: 'Villa 3, Ouakam', phone: c.phone9 }));
        await payOrder(c, id);
        assert.equal((await partnerAct(partner, id, { action: 'ACCEPTER' })).status, 200);
        assert.equal((await partnerAct(partner, id, { action: 'CONFIER', courierId: courier.userId })).status, 200);
        const problems: string[] = [];
        for (const [who, token] of [['partenaire', partner.accessToken], ['livreur', courier.accessToken], ['tiers', stranger.accessToken]] as const) {
            const db = userClient(token);
            for (const table of ['orders', 'order_items', 'order_state_history'] as const) {
                const col = table === 'orders' ? 'id' : 'order_id';
                const { data } = await db.from(table).select('*').eq(col, id);
                if ((data ?? []).length) problems.push(`${who} lit ${table} : ${JSON.stringify(data).slice(0, 160)}`);
            }
            const { data: upd } = await db.from('orders').update({ order_state: 'REMISE' }).eq('id', id).select('id');
            if ((upd ?? []).length) problems.push(`${who} écrit orders`);
            const { error: ins } = await db.from('order_items').insert({ order_id: id, product_id: dish, product_name: 'X', quantity: 1, unit_price: 1, total_price: 1 });
            if (!ins) problems.push(`${who} insère une ligne`);
            for (const fn of ['order_code_hash', 'order_issue_code', 'order_view', 'order_partner_action']) {
                const args = fn === 'order_code_hash' ? { p_order_id: id, p_code: '0000' } : fn === 'order_issue_code' ? { p_order_id: id } : { p: { order_id: id, actor_id: partner.userId, as: 'PARTNER', action: 'REMETTRE' } };
                const { data, error } = await db.rpc(fn, args);
                if (!error) problems.push(`${who} appelle ${fn} : ${JSON.stringify(data).slice(0, 120)}`);
            }
            const { data: key } = await db.schema('private').from('order_code_key').select('*');
            if ((key ?? []).length) problems.push(`${who} lit private.order_code_key`);
            const { data: prod } = await db.from('products').update({ is_regulated: false, price: 1 }).eq('id', dish).select('id');
            if ((prod ?? []).length) problems.push(`${who} modifie un produit`);
            const { error: por } = await db.from('product_daily_portions').upsert({ product_id: dish, day: '2026-11-21', portions: 9999, sold: 0 });
            if (!por) problems.push(`${who} écrit des portions`);
        }
        const o = await order(id);
        assert.deepEqual(problems, []);
        assert.equal(o.order_state, 'ACCEPTEE', 'commande inchangée');
        const { data: mine } = await userClient(c.accessToken).from('orders').select('id, code_hash').eq('id', id);
        assert.equal((mine ?? []).length, 1, 'le client lit sa commande');
    });

    test('G6 — livreur invité qui n’a pas accepté : aucune commande confiée, rien de visible', async () => {
        const c = await buyer('attente-client');
        const pending = await buyer('attente-livreur');
        const { data: inv, error } = await service.rpc('order_courier_invite', { p: { actor_id: partner.userId, phone: pending.phoneE164 } });
        assert.equal(error, null, error?.message);
        assert.equal((inv as Row).ok, true, JSON.stringify(inv));
        const p = await newProduct(partner, shop, { price: 3_000 });
        const id = await placed(c, orderBody(shop, [{ productId: p, quantity: 1 }], { mode: 'LIVRAISON', zoneId: zone, address: 'Villa 9, Mermoz', phone: c.phone9 }));
        await payOrder(c, id);
        assert.equal((await partnerAct(partner, id, { action: 'ACCEPTER' })).status, 200);
        const assign = await partnerAct(partner, id, { action: 'CONFIER', courierId: pending.userId });
        assert.deepEqual([assign.status, assign.body.code], [404, 'COURIER_NOT_FOUND'], JSON.stringify(assign.body));
        const list = await reply(await courierOrdersGet(req('/api/courier/orders', 'GET', pending.accessToken)));
        assert.deepEqual([list.status, list.body.orders], [200, []]);
        assert.equal((await order(id)).courier_user_id, null);
    });

    test('G7 — code de remise : absent des réponses, de la boîte d’envoi et du journal ; 5 essais puis blocage ; 3 nouveaux codes au plus', async () => {
        const c = await buyer('code');
        const p = await newProduct(partner, shop, { price: 4_500 });
        const id = await placed(c, orderBody(shop, [{ productId: p, quantity: 1 }]));
        await payOrder(c, id);
        assert.equal((await partnerAct(partner, id, { action: 'ACCEPTER' })).status, 200);
        const ready = await partnerAct(partner, id, { action: 'PRETE' });
        assert.equal(ready.status, 200, JSON.stringify(ready.body));
        const codes = [await codeOf(c, id)];
        assert.ok(!JSON.stringify(ready.body).includes(`"${codes[0]}"`) && !('handover_code' in ready.body), `code dans la réponse : ${JSON.stringify(ready.body)}`);
        const wrong = (code: string) => String((Number(code) + 1) % 10_000).padStart(4, '0');
        const tries: string[] = [];
        for (let i = 0; i < 5; i += 1) {
            const r = await partnerAct(partner, id, { action: 'REMETTRE', code: wrong(codes[0]) });
            tries.push(`${r.status}:${String(r.body.code)}`);
        }
        assert.deepEqual(tries, ['409:WRONG_CODE', '409:WRONG_CODE', '409:WRONG_CODE', '409:WRONG_CODE', '409:CODE_LOCKED']);
        const locked = await partnerAct(partner, id, { action: 'REMETTRE', code: codes[0] });
        assert.deepEqual([locked.status, locked.body.code], [409, 'CODE_LOCKED'], 'même le bon code est refusé après 5 essais');
        for (let i = 0; i < 3; i += 1) {
            const r = await reply(await clientCodeRoute(req(`/api/orders/${id}/code`, 'POST', c.accessToken), ctx(id)));
            assert.equal(r.status, 200, JSON.stringify(r.body));
            codes.push(await codeOf(c, id));
            assert.ok(!JSON.stringify(r.body).includes(`"${codes[codes.length - 1]}"`), `code dans la réponse : ${JSON.stringify(r.body)}`);
        }
        const fourth = await reply(await clientCodeRoute(req(`/api/orders/${id}/code`, 'POST', c.accessToken), ctx(id)));
        assert.deepEqual([fourth.status, fourth.body.code], [429, 'TOO_MANY_CODES']);
        const last = codes[codes.length - 1];
        const stale = codes.slice(0, -1).find((x) => x !== last);
        if (stale) {
            const old = await partnerAct(partner, id, { action: 'REMETTRE', code: stale });
            assert.equal(old.status, 409, `ancien code accepté : ${JSON.stringify(old.body)}`);
        }
        const done = await partnerAct(partner, id, { action: 'REMETTRE', code: last });
        assert.equal(done.status, 200, JSON.stringify(done.body));
        assert.equal((await order(id)).order_state, 'REMISE');
        const { data: outbox } = await service.from('notification_outbox').select('template_data').eq('template_data->>order_id', id);
        const { data: logs } = await service.from('audit_logs').select('old_value, new_value, metadata').eq('object_id', id);
        const { data: sync } = await service.from('notification_outbox').select('*').eq('type', 'ORDER_HANDOVER_CODE').eq('recipient_user_id', c.userId);
        // Nombre de lignes du journal : trou T9 (cv12a-1-trous) ; ici, seulement l'absence du code en clair
        assert.ok((sync ?? []).length >= 1, 'au moins un envoi du code journalisé');
        const stored = JSON.stringify([outbox, logs, sync]);
        const found = codes.filter((x) => stored.includes(`"${x}"`) || new RegExp(`code\\D{0,3}${x}\\b`).test(stored) || stored.includes(`: ${x}.`));
        assert.deepEqual(found, [], `code en clair stocké : ${found.join(', ')}`);
    });
});

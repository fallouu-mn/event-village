/**
 * Lot 12a — commandes : argent et sécurité. Montants calculés à la main dans chaque test, avec les réglages par défaut
 * vérifiés en tête : frais de service 5 % (sur ce qui est payé en ligne), commission 0 %, acompte 30 %, attente de
 * paiement 15 minutes, réponse de la partenaire sous 15 minutes, 3 commandes non payées au plus, retrait 24 h après
 * l'heure prévue (client prévenu 2 h avant), coordonnées masquées 7 jours après la remise, 5 essais du code, 3 nouveaux
 * codes, frais Wave 1,5 %, garde des ventes 48 h après l'heure prévue.
 *
 *  A. Devis et commande : exemples chiffrés (entier, acompte, à la remise), montants envoyés par le navigateur ignorés,
 *     produits réglementés refusés (case de la partenaire, décision de l'administration, insertion directe), stock,
 *     portions du plat du jour (payé en entier, aujourd'hui seulement), minimum de zone, plafond des non payées.
 *  B. Payer et suivre : paiement relu en base, double confirmation sans double effet, étapes et heures, heure estimée,
 *     remise contre code (essais limités, nouveau code), solde en ligne ou sur place (noté, jamais compté), avis.
 *  C. Annuler et rembourser : client avant / après la préparation, partenaire, Event Village, moteur financier (frais
 *     Wave à la charge d'Event Village, grand livre), parrainage régularisé ; tâche planifiée (attente échue, sans
 *     réponse, rappel et clôture d'une commande non retirée, masquage à 7 jours) ; paiement arrivé trop tard.
 *  D. Accès d'autrui : autre partenaire, autre client, livreur d'une autre équipe ou retiré, lectures et écritures REST,
 *     écriture directe refusée par la garde, fiche SUSPENDU en lecture seule.
 *  E. Concurrence : deux paiements, deux confirmations, deux remises, deux annulations simultanées.
 * Faux SamirPay seulement. Base LOCALE. Invariants du lot (o1 à o7) et des livraisons précédentes à la fin.
 */
import '../helpers/env';
import { after, before, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { assertLot12aInvariants } from '../helpers/lot12a-invariants';
import { openConcurrentClient } from '../helpers/db';
import { BASE_URL } from './helpers';
import { deliverWebhook, paymentById, providerSays, service } from './paiement-helpers';
import { GET as clientOrderGet } from '../../app/api/orders/[id]/route';
import { POST as clientCancelRoute } from '../../app/api/orders/[id]/cancel/route';
import { POST as clientCodeRoute } from '../../app/api/orders/[id]/code/route';
import { POST as quoteRoute } from '../../app/api/orders/quote/route';
import { GET as partnerOrdersGet } from '../../app/api/partner/orders/route';
import { GET as partnerOrderGet } from '../../app/api/partner/orders/[id]/route';
import { GET as courierOrdersGet } from '../../app/api/courier/orders/route';
import { POST as adminCancelRoute } from '../../app/api/admin/orders/[id]/cancel/route';
import { POST as cronOrders } from '../../app/api/cron/orders/route';
import { sendOrderRefunds } from '../../lib/orders/booking';
import { confirmCashouts } from './finance-helpers';
import {
    addCourier, allChannels, codeOf, courierAct, smsOfOrder, historyOf, itemsOf, ledgerOfPayment, n, newBuyer, newDeliveryZone, newOption, newPartner,
    newProduct, newShop, openOrdersService, order, orderBody, orderRoute, orderRpc, outboxOf, partnerAct, payOrder, placed, platformSetting,
    refundsOfOrder, releaseUnpaid, setPortions, shiftOrder, startOrderPay, superadminId, tick, toReady, userClient, type Buyer, type Row,
    type TestPartner,
} from './l12a-helpers';

let restore: () => Promise<void>;
let partner: TestPartner;
let other: TestPartner;
let client: Buyer;
let stranger: Buyer;
let courier: Buyer;
let foreignCourier: Buyer;
let shop: string;
let zone: string;

before(async () => {
    restore = await openOrdersService();
    partner = await newPartner('l12a');
    other = await newPartner('l12a-autre');
    client = await newBuyer('l12a-client');
    stranger = await newBuyer('l12a-autre-client');
    courier = await newBuyer('l12a-livreur');
    foreignCourier = await newBuyer('l12a-livreur-autre');
    shop = await newShop(partner, { depositAllowed: true, payOnHandover: true });
    zone = await newDeliveryZone(shop, 1_000, 5_000);
    await addCourier(partner, courier);
    await addCourier(other, foreignCourier);
});

beforeEach(async () => {
    if (client) await releaseUnpaid(client.userId);
});

after(async () => {
    await restore();
    await assertLot12aInvariants('l12a-commandes');
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
async function sql<T extends Row = Row>(text: string, params: unknown[] = []): Promise<T[]> {
    const c = await openConcurrentClient({ applicationName: 'ev-test-l12a-sql' });
    try {
        const { rows } = await c.query<T>(text, params);
        await c.commit();
        return rows;
    } finally {
        await c.close();
    }
}
const delivery = (extra: Row = {}): Row => ({ mode: 'LIVRAISON', zoneId: zone, address: 'Villa 12, route des Almadies', phone: client.phone9, ...extra });

describe('A. Devis et commande : tout calculé en base', () => {
    test('réglages par défaut (décisions du client)', async () => {
        const expected: Record<string, unknown> = {
            'orders.service_fee_rate': 5, 'orders.commission_rate': 0, 'orders.deposit_default_percent': 30, 'orders.hold_minutes': 15,
            'orders.response_minutes': 15, 'orders.max_unpaid_per_client': 3, 'orders.pickup_grace_hours': 24, 'orders.pickup_warning_hours': 2,
            'orders.contact_retention_days': 7, 'orders.code_max_attempts': 5, 'orders.code_resend_max': 3, 'orders.prep_minutes_default': 30,
            'finance.aggregator_fee_rate.WAVE': 1.5, 'finance.payout_delay_hours': 48,
        };
        for (const [key, value] of Object.entries(expected)) assert.equal(await platformSetting(key), value, key);
    });

    test('entier, retrait : 2 × (3 500 + supplément 500) + 2 750 = 10 750 ; frais 537,5 → 538 ; à payer 11 288 ; aucun avis avant le paiement', async () => {
        const a = await newProduct(partner, shop, { price: 3_500, name: 'Thiéboudienne' });
        const sauce = await newOption(a, 'Sauce piment', 500);
        const b = await newProduct(partner, shop, { price: 2_750, name: 'Bissap' });
        const r = await orderRpc(client, orderBody(shop, [{ productId: a, quantity: 2, optionIds: [sauce] }, { productId: b, quantity: 1 }]));
        assert.equal(r.ok, true, JSON.stringify(r));
        const o = await order(String(r.order_id));
        assert.deepEqual([o.order_state, o.order_status, n(o.items_amount), n(o.delivery_fee), n(o.goods_total), o.deposit_percent, n(o.first_goods),
            n(o.service_fee_rate), n(o.first_fee), n(o.total_amount), n(o.paid_amount), n(o.balance_amount), n(o.commission_rate), o.payment_type],
            ['EN_ATTENTE_PAIEMENT', 'EN_ATTENTE', 10_750, 0, 10_750, null, 10_750, 5, 538, 11_288, 0, 10_750, 0, 'INTEGRAL']);
        const lines = await itemsOf(String(r.order_id));
        assert.deepEqual(lines.map((l) => [l.product_name, n(l.base_price), n(l.unit_price), l.quantity, n(l.total_price)]).sort(),
            [['Bissap', 2_750, 2_750, 1, 2_750], ['Thiéboudienne', 3_500, 4_000, 2, 8_000]]);
        assert.deepEqual((lines.find((l) => l.product_name === 'Thiéboudienne')!.options as Row[]).map((x) => [x.name, n(x.price)]), [['Sauce piment', 500]]);
        const hold = Date.parse(String(o.hold_expires_at)) - Date.now();
        assert.ok(hold > 13 * 60_000 && hold <= 15 * 60_000, `produits tenus 15 minutes (${Math.round(hold / 1000)} s)`);
        assert.deepEqual(await outboxOf(client.userId, String(r.order_id)), [], 'aucun avis avant le paiement');
        assert.deepEqual(await historyOf(String(r.order_id)), ['∅→EN_ATTENTE_PAIEMENT (CLIENT)']);
    });

    test('acompte 30 %, livraison : 12 345 + zone 1 000 = 13 345 ; acompte 4 003,5 → 4 004 ; frais 200,2 → 201 ; maintenant 4 205 ; solde 9 341', async () => {
        const p = await newProduct(partner, shop, { price: 12_345 });
        const r = await orderRpc(client, orderBody(shop, [{ productId: p, quantity: 1 }], delivery({ payment: 'ACOMPTE' })));
        assert.equal(r.ok, true, JSON.stringify(r));
        assert.deepEqual([n(r.goods_total), r.deposit_percent, n(r.first_goods), n(r.first_fee), n(r.to_pay_now), n(r.balance_due)],
            [13_345, 30, 4_004, 201, 4_205, 9_341]);
        const o = await order(String(r.order_id));
        assert.deepEqual([o.contact_phone, o.delivery_address, o.zone_id, n(o.delivery_fee)], [client.phoneE164, 'Villa 12, route des Almadies', zone, 1_000]);
    });

    test('à la remise, sur place : 6 000 F ; rien à payer en ligne, frais 0 ; reçue tout de suite et transmise à la partenaire', async () => {
        const p = await newProduct(partner, shop, { price: 3_000 });
        const r = await orderRpc(client, orderBody(shop, [{ productId: p, quantity: 2 }], { mode: 'SUR_PLACE', onsiteLabel: 'Table 7', payment: 'DIFFERE' }));
        assert.equal(r.ok, true, JSON.stringify(r));
        const o = await order(String(r.order_id));
        assert.deepEqual([o.order_state, n(o.first_goods), n(o.first_fee), n(o.goods_total), o.onsite_label], ['RECUE', 0, 0, 6_000, 'Table 7']);
        assert.ok(o.received_at && o.response_due_at, 'reçue et échéance de réponse');
        assert.deepEqual(await outboxOf(client.userId, String(r.order_id)), allChannels('ORDER_RECEIVED'));
        assert.deepEqual(await outboxOf(partner.userId, String(r.order_id)), allChannels('ORDER_NEW'));
        const pay = await startOrderPay(client, String(r.order_id));
        assert.deepEqual([pay.status, pay.body.code], [409, 'NOTHING_TO_PAY']);
    });

    test('montants envoyés par le navigateur ignorés : prix, total, frais et remise dans le corps → mêmes montants relus en base', async () => {
        const p = await newProduct(partner, shop, { price: 4_000 });
        const res = await orderRoute(client, {
            ...orderBody(shop, [{ productId: p, quantity: 2, price: 1, unitPrice: 1, total: 1 } as never]),
            total: 1, totalAmount: 1, subtotal: 1, serviceFee: 0, deliveryFee: 0, discount: 7_999, amount: 1,
        });
        assert.equal(res.status, 201, JSON.stringify(res.body));
        const o = res.body.order as Row;
        assert.deepEqual([n(o.goodsTotal), n(o.serviceFee), n(o.toPayNow)], [8_000, 400, 8_400]);
        const q = await reply(await quoteRoute(req('/api/orders/quote', 'POST', client.accessToken, { ...orderBody(shop, [{ productId: p, quantity: 2 }]), total: 1 })));
        assert.equal(q.status, 200, JSON.stringify(q.body));
        assert.deepEqual([n((q.body.quote as Row).toPayNow)], [8_400]);
    });

    test('produit réglementé (case de la partenaire, alcool) : affiché, jamais commandé, payé ni livré en ligne ; refus en base', async () => {
        const beer = await newProduct(partner, shop, { price: 1_500, name: 'Bière Gazelle', regulated: true, regulatedKind: 'ALCOOL' });
        const r = await orderRpc(client, orderBody(shop, [{ productId: beer, quantity: 1 }]));
        assert.deepEqual([r.ok, r.code], [false, 'REGULATED_PRODUCT'], JSON.stringify(r));
        assert.match(String(r.message), /produit réglementé/);
        const route = await orderRoute(client, orderBody(shop, [{ productId: beer, quantity: 1 }]));
        assert.deepEqual([route.status, route.body.code], [400, 'REGULATED_PRODUCT']);
        const { data: visible } = await userClient(client.accessToken).from('products').select('id, price, is_regulated').eq('id', beer);
        assert.deepEqual((visible ?? []).map((x) => [n(x.price), x.is_regulated]), [[1_500, true]], 'affiché avec son prix');
    });

    test('produit réglementé par l’administration (case de la partenaire non cochée) : refusé ; la partenaire ne peut pas lever la décision', async () => {
        const cig = await newProduct(partner, shop, { price: 2_000, name: 'Cigarettes' });
        const { data: d, error } = await service.rpc('order_product_regulation_decide', { p: { actor_id: await superadminId(), product_id: cig, regulated: true, reason: 'Tabac' } });
        assert.equal(error, null, error?.message);
        assert.equal((d as Row).ok, true, JSON.stringify(d));
        const r = await orderRpc(client, orderBody(shop, [{ productId: cig, quantity: 1 }]));
        assert.deepEqual([r.ok, r.code], [false, 'REGULATED_PRODUCT']);
        const { error: lift } = await service.from('products').update({ regulated_admin: false }).eq('id', cig);
        assert.ok(lift, 'la décision de l’administration ne se change pas par une écriture directe');
        const { data: forbidden } = await service.rpc('order_product_regulation_decide', { p: { actor_id: partner.userId, product_id: cig, regulated: false, reason: 'Pas du tabac' } });
        assert.equal((forbidden as Row).code, 'FORBIDDEN');
    });

    test('ligne d’un produit réglementé insérée directement (même avec le drapeau des fonctions) : refusée par la base', async () => {
        const ok = await newProduct(partner, shop, { price: 1_000 });
        const id = await placed(client, orderBody(shop, [{ productId: ok, quantity: 1 }]));
        const rum = await newProduct(partner, shop, { price: 9_000, regulated: true });
        const c = await openConcurrentClient({ applicationName: 'ev-test-l12a-regle' });
        try {
            await c.query(`SELECT set_config('event_village.order_flow', 'on', true)`);
            await assert.rejects(c.query(`INSERT INTO public.order_items (order_id, product_id, product_name, quantity, unit_price, total_price)
                                          VALUES ($1, $2, 'Rhum', 1, 9000, 9000)`, [id, rum]), /réglementé/);
        } finally {
            await c.close();
        }
    });

    test('produit d’un autre établissement, quantité 0, -1, 2,5 ou 100, supplément d’un autre produit : refusés', async () => {
        const otherShop = await newShop(other);
        const foreign = await newProduct(other, otherShop, { price: 1_000 });
        const mine = await newProduct(partner, shop, { price: 1_000 });
        const opt = await newOption(foreign, 'Frites', 300);
        const cases: Array<[Row, string]> = [
            [orderBody(shop, [{ productId: foreign, quantity: 1 }]), 'PRODUCT_NOT_FOUND'],
            [orderBody(shop, [{ productId: mine, quantity: 0 }]), 'INVALID_QUANTITY'],
            [orderBody(shop, [{ productId: mine, quantity: -1 }]), 'INVALID_QUANTITY'],
            [orderBody(shop, [{ productId: mine, quantity: '2.5' }]), 'INVALID_ITEM'],
            [orderBody(shop, [{ productId: mine, quantity: 100 }]), 'INVALID_QUANTITY'],
            [orderBody(shop, [{ productId: mine, quantity: 1, optionIds: [opt] }]), 'INVALID_OPTION'],
            [orderBody(shop, []), 'EMPTY_CART'],
        ];
        for (const [body, code] of cases) {
            const r = await orderRpc(client, body);
            assert.deepEqual([r.ok, r.code], [false, code], `${JSON.stringify(body.items)} : ${JSON.stringify(r)}`);
        }
    });

    test('stock : 3 en stock, 2 commandés → 1 ; 2 de plus refusés ; annulation → 3 ; jamais rendu deux fois', async () => {
        const p = await newProduct(partner, shop, { price: 1_000, stock: 3 });
        const stock = async (): Promise<number> => n((await service.from('products').select('stock_quantity').eq('id', p).single()).data?.stock_quantity);
        const id = await placed(client, orderBody(shop, [{ productId: p, quantity: 2 }]));
        assert.equal(await stock(), 1);
        const refused = await orderRpc(stranger, orderBody(shop, [{ productId: p, quantity: 2 }]));
        assert.deepEqual([refused.ok, refused.code, refused.message], [false, 'OUT_OF_STOCK', 'Il reste 1 « ' + String((await itemsOf(id))[0].product_name) + ' ».']);
        const c1 = await service.rpc('order_cancel', { p: { order_id: id, actor_id: client.userId, origin: 'CLIENT' } });
        assert.equal((c1.data as Row).ok, true, JSON.stringify(c1));
        assert.equal(await stock(), 3);
        const c2 = await service.rpc('order_cancel', { p: { order_id: id, actor_id: client.userId, origin: 'CLIENT' } });
        assert.equal((c2.data as Row).code, 'NOT_CANCELLABLE');
        const { data: again } = await service.rpc('order_release_stock', { p_order_id: id });
        assert.equal(again, false, 'stock rendu une seule fois');
        assert.equal(await stock(), 3);
    });

    test('plat du jour : 2 portions, 2 vendues, plus rien ; acompte refusé (payé en entier) ; demain refusé ; portions d’hier sans effet', async () => {
        const dish = await newProduct(partner, shop, { price: 2_500, daily: true, name: 'Yassa du jour' });
        assert.equal((await setPortions(partner, dish, 2)).ok, true);
        const r = await orderRpc(client, orderBody(shop, [{ productId: dish, quantity: 2 }], { payment: 'ACOMPTE' }));
        assert.deepEqual([r.ok, r.code], [false, 'DAILY_SPECIAL_FULL_PAYMENT']);
        const tomorrow = new Date(Date.now() + 86_400_000);
        tomorrow.setUTCHours(12, 0, 0, 0);
        const later = await orderRpc(client, orderBody(shop, [{ productId: dish, quantity: 1 }], { scheduledFor: tomorrow.toISOString().slice(0, 16) }));
        assert.deepEqual([later.ok, later.code], [false, 'DAILY_SPECIAL_TODAY_ONLY'], JSON.stringify(later));
        const id = await placed(client, orderBody(shop, [{ productId: dish, quantity: 2 }]));
        const { data: row } = await service.from('product_daily_portions').select('portions, sold').eq('product_id', dish).single();
        assert.deepEqual([n(row?.portions), n(row?.sold)], [2, 2]);
        const none = await orderRpc(stranger, orderBody(shop, [{ productId: dish, quantity: 1 }]));
        assert.deepEqual([none.ok, none.code, none.message], [false, 'NO_PORTIONS_LEFT', 'Plus de « Yassa du jour » aujourd’hui.']);
        const below = await setPortions(partner, dish, 1);
        assert.equal(below.code, 'BELOW_SOLD', 'jamais sous ce qui est déjà vendu');
        assert.equal((await itemsOf(id))[0].portion_day, new Date().toISOString().slice(0, 10));
        // Portions d'hier (posées directement) : le plat ne se commande que pour aujourd'hui
        const dish2 = await newProduct(partner, shop, { price: 2_500, daily: true });
        const c =await openConcurrentClient({ applicationName: 'ev-test-l12a-hier' });
        try {
            await c.query(`SELECT set_config('event_village.order_flow', 'on', true)`);
            await c.query(`INSERT INTO public.product_daily_portions (product_id, day, portions, sold) VALUES ($1, (now() AT TIME ZONE 'Africa/Dakar')::date - 1, 50, 0)`, [dish2]);
            await c.commit();
        } finally {
            await c.close();
        }
        const yesterday = await orderRpc(client, orderBody(shop, [{ productId: dish2, quantity: 1 }]));
        assert.deepEqual([yesterday.ok, yesterday.code], [false, 'NO_PORTIONS_LEFT'], 'le plat d’hier s’est arrêté seul');
    });

    test('minimum de la zone (5 000) : 4 000 refusé ; adresse et téléphone obligatoires pour une livraison ; zone d’un autre établissement refusée', async () => {
        const p = await newProduct(partner, shop, { price: 4_000 });
        const low = await orderRpc(client, orderBody(shop, [{ productId: p, quantity: 1 }], delivery()));
        assert.deepEqual([low.ok, low.code, low.message], [false, 'BELOW_MINIMUM', 'Le minimum de commande pour la zone « Almadies » est de 5 000 F CFA.']);
        const noAddress = await orderRpc(client, orderBody(shop, [{ productId: p, quantity: 2 }], delivery({ address: '' })));
        assert.equal(noAddress.code, 'ADDRESS_REQUIRED');
        const noPhone = await orderRpc(client, orderBody(shop, [{ productId: p, quantity: 2 }], delivery({ phone: '' })));
        assert.equal(noPhone.code, 'PHONE_REQUIRED');
        const otherZone = await newDeliveryZone(await newShop(other), 0);
        const foreignZone = await orderRpc(client, orderBody(shop, [{ productId: p, quantity: 2 }], delivery({ zoneId: otherZone })));
        assert.equal(foreignZone.code, 'ZONE_NOT_FOUND');
    });

    test('au plus 3 commandes non payées par client : la 4e est refusée (verrou par client)', async () => {
        const buyer = await newBuyer('l12a-plafond');
        const p = await newProduct(partner, shop, { price: 1_000 });
        const results = await Promise.all([1, 2, 3, 4].map(() => orderRpc(buyer, orderBody(shop, [{ productId: p, quantity: 1 }]))));
        assert.deepEqual(results.map((r) => r.ok).sort(), [false, true, true, true], JSON.stringify(results.map((r) => r.code)));
        assert.equal(results.find((r) => r.ok === false)!.code, 'TOO_MANY_UNPAID');
        await releaseUnpaid(buyer.userId);
    });

    test('mode non proposé, acompte ou paiement à la remise non acceptés, établissement fermé à la vente ou non validé, sa propre partenaire', async () => {
        const strict = await newShop(partner, { modes: ['RETRAIT'] });
        const p = await newProduct(partner, strict, { price: 1_000 });
        assert.equal((await orderRpc(client, orderBody(strict, [{ productId: p, quantity: 1 }], { mode: 'SUR_PLACE', onsiteLabel: 'Bar' }))).code, 'MODE_NOT_AVAILABLE');
        assert.equal((await orderRpc(client, orderBody(strict, [{ productId: p, quantity: 1 }], { payment: 'ACOMPTE' }))).code, 'DEPOSIT_NOT_ALLOWED');
        assert.equal((await orderRpc(client, orderBody(strict, [{ productId: p, quantity: 1 }], { payment: 'DIFFERE' }))).code, 'PAY_ON_HANDOVER_NOT_ALLOWED');
        const closedShop = await newShop(partner, { ordersOpen: false });
        const q = await newProduct(partner, closedShop, { price: 1_000 });
        assert.equal((await orderRpc(client, orderBody(closedShop, [{ productId: q, quantity: 1 }]))).code, 'VENUE_NOT_AVAILABLE');
        const pending = await newShop(partner, { validate: false });
        const r = await newProduct(partner, pending, { price: 1_000 });
        assert.equal((await orderRpc(client, orderBody(pending, [{ productId: r, quantity: 1 }]))).code, 'VENUE_NOT_AVAILABLE');
        assert.equal((await orderRpc(partner, orderBody(strict, [{ productId: p, quantity: 1 }]))).code, 'OWN_VENUE');
    });
});

describe('B. Payer et suivre la commande', () => {
    test('payée (11 288) : reçue, heure de chaque étape, avis sur les 4 canaux ; vente au grand livre 10 750 après l’heure prévue + 48 h ; frais Wave 169,32', async () => {
        const a = await newProduct(partner, shop, { price: 3_500 });
        const sauce = await newOption(a, 'Sauce', 500);
        const b = await newProduct(partner, shop, { price: 2_750 });
        const id = await placed(client, orderBody(shop, [{ productId: a, quantity: 2, optionIds: [sauce] }, { productId: b, quantity: 1 }]));
        const pay = await payOrder(client, id);
        assert.deepEqual([pay.status, n(pay.amount)], ['SUCCESS', 11_288]);
        const p = await service.from('payments').select('*').eq('id', pay.id).single();
        assert.deepEqual([n(p.data?.facial_amount), n(p.data?.service_fee), n(p.data?.aggregator_fee), n(p.data?.partner_payout_amount),
            n(p.data?.net_event_village_revenue), p.data?.payment_target, p.data?.order_id], [10_750, 538, 169.32, 10_750, 368.68, 'ORDER', id]);
        const o = await order(id);
        assert.deepEqual([o.order_state, n(o.paid_goods), n(o.paid_fees), n(o.paid_amount), n(o.balance_amount), o.payment_status],
            ['RECUE', 10_750, 538, 11_288, 0, 'SUCCESS']);
        assert.ok(o.received_at, 'heure de réception');
        const sale = await sql(`SELECT amount, available_at FROM public.finance_ledger WHERE source_key = $1`, [`VENTE-${pay.id}`]);
        assert.equal(n(sale[0]?.amount), 10_750);
        assert.ok(Date.parse(String(sale[0].available_at)) >= Date.parse(String(o.scheduled_for)) + 48 * 3_600_000 - 1000, 'vente disponible après l’heure prévue + 48 h');
        assert.deepEqual(await outboxOf(client.userId, id), allChannels('ORDER_RECEIVED'));
        assert.deepEqual(await outboxOf(partner.userId, id), allChannels('ORDER_NEW'));
        // Deuxième confirmation (webhook rejoué) : aucun effet
        const again = await service.rpc('order_payment_confirm', { p_payment_id: pay.id, p_source: 'WEBHOOK' });
        assert.equal((again.data as Row).result, 'ALREADY_CONFIRMED');
        assert.equal(n((await order(id)).paid_goods), 10_750);
        assert.equal((await sql(`SELECT count(*)::int AS c FROM public.finance_ledger WHERE source_key = $1`, [`VENTE-${pay.id}`]))[0].c, 1);
    });

    test('suivi en étapes : accepter (heure estimée), préparer, prête, en route, remise contre code ; chaque heure gardée, historique complet, avis qui disent quoi faire', async () => {
        const p = await newProduct(partner, shop, { price: 6_000 });
        const id = await placed(client, orderBody(shop, [{ productId: p, quantity: 1 }], delivery()));
        await payOrder(client, id);
        const acc = await partnerAct(partner, id, { action: 'ACCEPTER', minutes: 40 });
        assert.equal(acc.status, 200, JSON.stringify(acc.body));
        const eta = Date.parse(String((await order(id)).estimated_at)) - Date.now();
        assert.ok(eta > 38 * 60_000 && eta <= 41 * 60_000, `heure estimée dans 40 minutes (${Math.round(eta / 60_000)} min)`);
        assert.equal((await partnerAct(partner, id, { action: 'PREPARER' })).status, 200);
        assert.equal((await partnerAct(partner, id, { action: 'PRETE' })).status, 200);
        assert.equal((await partnerAct(partner, id, { action: 'CONFIER', courierId: courier.userId })).status, 200);
        assert.deepEqual(await outboxOf(courier.userId, id), allChannels('ORDER_COURIER_ASSIGNED'));
        const go = await courierAct(courier, id, { action: 'EN_ROUTE', minutes: 20 });
        assert.equal(go.status, 200, JSON.stringify(go.body));
        const code = await codeOf(client, id);
        assert.match(code, /^\d{4}$/);
        const done = await courierAct(courier, id, { action: 'REMETTRE', code });
        assert.equal(done.status, 200, JSON.stringify(done.body));
        const o = await order(id);
        assert.equal(o.order_state, 'REMISE');
        for (const k of ['received_at', 'accepted_at', 'preparing_at', 'ready_at', 'en_route_at', 'handed_over_at']) assert.ok(o[k], `heure ${k}`);
        assert.ok(Date.parse(String(o.received_at)) <= Date.parse(String(o.accepted_at)) && Date.parse(String(o.en_route_at)) <= Date.parse(String(o.handed_over_at)), 'heures dans l’ordre');
        assert.equal(o.code_hash, null, 'code effacé après la remise');
        assert.deepEqual(await historyOf(id), [
            '∅→EN_ATTENTE_PAIEMENT (CLIENT)', 'EN_ATTENTE_PAIEMENT→RECUE (SYSTEM)', 'RECUE→ACCEPTEE (PARTENAIRE)', 'ACCEPTEE→EN_PREPARATION (PARTENAIRE)',
            'EN_PREPARATION→PRETE (PARTENAIRE)', 'PRETE→EN_ROUTE (LIVREUR)', 'EN_ROUTE→REMISE (LIVREUR)']);
        const box = await outboxOf(client.userId, id);
        for (const t of ['ORDER_RECEIVED', 'ORDER_ACCEPTED', 'ORDER_PREPARING', 'ORDER_READY', 'ORDER_HANDED_OVER']) {
            assert.deepEqual(box.filter((x) => x.startsWith(`${t}:`)), allChannels(t), `${t} sur les 4 canaux`);
        }
        // En route : cloche, push et email en file ; le SMS de l'étape est le code, envoyé tout de suite (jamais en file)
        assert.deepEqual(box.filter((x) => x.startsWith('ORDER_ON_THE_WAY:')), ['ORDER_ON_THE_WAY:EMAIL', 'ORDER_ON_THE_WAY:IN_APP', 'ORDER_ON_THE_WAY:PUSH']);
        const number = String(o.order_number);
        assert.ok((await smsOfOrder(client, id)).includes(`Event Village : votre commande ${number} est en route. Donnez le code ${code} au livreur à son arrivée, pas avant.`),
            'SMS du code au client, texte qui dit quoi faire');
        assert.equal(JSON.stringify(go.body).includes(code), false, 'le code n’est pas rendu au livreur');
        assert.deepEqual(await outboxOf(partner.userId, id), [...allChannels('ORDER_HANDED_OVER_PRO'), ...allChannels('ORDER_NEW')].sort());
        const view = await reply(await clientOrderGet(req(`/api/orders/${id}`, 'GET', client.accessToken), ctx(id)));
        assert.equal(view.status, 200);
        const timeline = (view.body.order as Row).timeline as Row[];
        assert.deepEqual(timeline.map((s) => [s.label, Boolean(s.at)]),
            [['Reçue', true], ['Acceptée', true], ['En préparation', true], ['Prête', true], ['En route', true], ['Livrée', true]]);
        assert.equal(JSON.stringify(view.body).includes(code), false, 'le code n’est jamais rendu par la route');
    });

    test('code de retrait : SMS immédiat au client ; jamais en clair en base (empreinte), ni dans la boîte d’envoi, ni dans une réponse ; envoi journalisé sans le code', async () => {
        const p = await newProduct(partner, shop, { price: 2_000 });
        const id = await placed(client, orderBody(shop, [{ productId: p, quantity: 1 }]));
        await payOrder(client, id);
        for (const action of ['ACCEPTER', 'PREPARER']) assert.equal((await partnerAct(partner, id, { action })).status, 200);
        const ready = await partnerAct(partner, id, { action: 'PRETE' });
        assert.equal(ready.status, 200, JSON.stringify(ready.body));
        const code = await codeOf(client, id);
        const o = await order(id);
        assert.equal(JSON.stringify(ready.body).includes(code), false, 'le code n’est pas rendu à la partenaire');
        assert.deepEqual(Object.keys(ready.body.order as Row).filter((k) => /code|phone/i.test(k)), [], 'ni code ni numéro dans la réponse');
        assert.match(String(o.code_hash), /^[0-9a-f]{64}$/);
        assert.equal(JSON.stringify(o).includes(`"${code}"`), false, 'le code n’est pas dans la ligne de la commande');
        assert.ok((await smsOfOrder(client, id)).includes(`Event Village : votre commande ${String(o.order_number)} vous attend. Donnez le code ${code} au comptoir pour la retirer, à personne d'autre.`));
        const rows = await sql<{ channel: string; has: boolean }>(
            `SELECT channel, template_data ? 'code' AS has FROM public.notification_outbox WHERE type = 'ORDER_READY' AND template_data->>'order_id' = $1`, [id]);
        assert.deepEqual(rows.map((r) => [r.channel, r.has]).sort(), [['EMAIL', false], ['IN_APP', false], ['PUSH', false]], 'cloche, push et email sans le code ; pas de second SMS');
        const log = await sql<{ data: Row; status: string }>(
            `SELECT template_data AS data, status FROM public.notification_outbox WHERE type = 'ORDER_HANDOVER_CODE' AND recipient_user_id = $1 ORDER BY created_at DESC LIMIT 1`, [client.userId]);
        assert.deepEqual([log[0]?.data, log[0]?.status], [{ purpose: 'ORDER_HANDOVER' }, 'SENT'], 'envoi journalisé, sans le code');
        const hits = await sql<{ n: number }>(`SELECT count(*)::int AS n FROM public.notification_outbox WHERE template_data::text LIKE '%' || $1 || '%' AND template_data->>'order_id' = $2`, [code, id]);
        assert.equal(hits[0].n, 0, 'le code n’apparaît dans aucune donnée d’avis de la commande');
    });

    test('codes devinés : 4 erreurs (il reste 1 essai), 5e → bloqué, même le bon code ; nouveau code demandé par le client : l’ancien ne marche plus', async () => {
        const p = await newProduct(partner, shop, { price: 2_000 });
        const id = await placed(client, orderBody(shop, [{ productId: p, quantity: 1 }]));
        await payOrder(client, id);
        await toReady(partner, id);
        const code = await codeOf(client, id);
        const wrong = code === '0000' ? '1111' : '0000';
        const left: unknown[] = [];
        for (let i = 0; i < 4; i += 1) left.push((await partnerAct(partner, id, { action: 'REMETTRE', code: wrong })).body.attempts_left);
        assert.deepEqual(left, [4, 3, 2, 1]);
        const fifth = await partnerAct(partner, id, { action: 'REMETTRE', code: wrong });
        assert.deepEqual([fifth.status, fifth.body.code], [409, 'CODE_LOCKED']);
        const good = await partnerAct(partner, id, { action: 'REMETTRE', code });
        assert.deepEqual([good.status, good.body.code], [409, 'CODE_LOCKED'], 'bloqué même avec le bon code');
        const resend = await reply(await clientCodeRoute(req(`/api/orders/${id}/code`, 'POST', client.accessToken), ctx(id)));
        assert.equal(resend.status, 200, JSON.stringify(resend.body));
        assert.equal(resend.body.resendsLeft, 2);
        const fresh = await codeOf(client, id);
        if (fresh !== code) {
            const old = await partnerAct(partner, id, { action: 'REMETTRE', code });
            assert.equal(old.body.code, 'WRONG_CODE', 'l’ancien code ne marche plus');
        }
        const ok = await partnerAct(partner, id, { action: 'REMETTRE', code: fresh });
        assert.equal(ok.status, 200, JSON.stringify(ok.body));
        const audit = await sql<{ c: number }>(`SELECT count(*)::int AS c FROM public.audit_logs WHERE action = 'ORDER_CODE_REJECTED' AND object_id = $1`, [id]);
        assert.ok(audit[0].c >= 5, 'chaque essai faux journalisé');
    });

    test('acompte puis solde en ligne : 4 205 puis 9 341 + frais 467,05 → 468 = 9 809 ; remise sans solde dû', async () => {
        const p = await newProduct(partner, shop, { price: 12_345 });
        const id = await placed(client, orderBody(shop, [{ productId: p, quantity: 1 }], delivery({ payment: 'ACOMPTE' })));
        const first = await payOrder(client, id);
        assert.equal(n(first.amount), 4_205);
        const early = await startOrderPay(client, id, { part: 'SOLDE' });
        assert.deepEqual([early.status, early.body.code], [409, 'BALANCE_NOT_PAYABLE'], 'le solde se paie après l’acceptation');
        assert.equal((await partnerAct(partner, id, { action: 'ACCEPTER' })).status, 200);
        const second = await payOrder(client, id, { part: 'SOLDE' });
        assert.deepEqual([n(second.amount), n((await service.from('payments').select('facial_amount, service_fee').eq('id', second.id).single()).data?.service_fee)], [9_809, 468]);
        const o = await order(id);
        assert.deepEqual([n(o.paid_goods), n(o.paid_fees), n(o.balance_amount), o.payment_status], [13_345, 669, 0, 'SUCCESS']);
        assert.equal((await partnerAct(partner, id, { action: 'PRETE' })).status, 200);
        assert.equal((await partnerAct(partner, id, { action: 'EN_ROUTE' })).status, 200);
        const done = await partnerAct(partner, id, { action: 'REMETTRE', code: await codeOf(client, id) });
        assert.equal(done.status, 200, JSON.stringify(done.body));
        assert.equal((await order(id)).onsite_amount, null);
    });

    test('acompte, solde payé sur place à la remise : refusé tant qu’il n’est pas déclaré, puis noté 9 341, jamais compté (aucun paiement, grand livre inchangé)', async () => {
        const p = await newProduct(partner, shop, { price: 12_345 });
        const id = await placed(client, orderBody(shop, [{ productId: p, quantity: 1 }], { mode: 'RETRAIT', payment: 'ACOMPTE' }));
        const first = await payOrder(client, id);
        await toReady(partner, id);
        const code = await codeOf(client, id);
        const due = await partnerAct(partner, id, { action: 'REMETTRE', code });
        assert.deepEqual([due.status, due.body.code, due.body.balance_due], [409, 'BALANCE_DUE', 9_341]);
        const ledgerBefore = await ledgerOfPayment(first.id);
        const done = await partnerAct(partner, id, { action: 'REMETTRE', code, balanceReceived: true });
        assert.equal(done.status, 200, JSON.stringify(done.body));
        const o = await order(id);
        assert.deepEqual([o.order_state, n(o.onsite_amount), n(o.paid_goods), o.onsite_recorded_by], ['REMISE', 9_341, 4_004, partner.userId]);
        const { data: pays } = await service.from('payments').select('id').eq('order_id', id);
        assert.equal(pays?.length, 1, 'aucune ligne de paiement pour le solde sur place');
        assert.equal(await ledgerOfPayment(first.id), ledgerBefore);
    });

    test('à la remise (DIFFERE), sur place : servie sans code, 6 000 notés sur place', async () => {
        const p = await newProduct(partner, shop, { price: 3_000 });
        const id = await placed(client, orderBody(shop, [{ productId: p, quantity: 2 }], { mode: 'SUR_PLACE', onsiteLabel: 'Table 2', payment: 'DIFFERE' }));
        await toReady(partner, id);
        const done = await partnerAct(partner, id, { action: 'REMETTRE', balanceReceived: true });
        assert.equal(done.status, 200, JSON.stringify(done.body));
        assert.deepEqual([(await order(id)).order_state, n((await order(id)).onsite_amount)], ['REMISE', 6_000]);
    });

    test('la partenaire ne voit jamais une commande pas encore payée ; refuser demande un motif ; répondre après le délai : annulée et remboursée', async () => {
        const p = await newProduct(partner, shop, { price: 2_000 });
        const unpaid = await placed(client, orderBody(shop, [{ productId: p, quantity: 1 }]));
        const seen = await reply(await partnerOrderGet(req(`/api/partner/orders/${unpaid}`, 'GET', partner.accessToken), ctx(unpaid)));
        assert.equal(seen.status, 404);
        assert.equal((await partnerAct(partner, unpaid, { action: 'ACCEPTER' })).status, 404);
        const id = await placed(client, orderBody(shop, [{ productId: p, quantity: 1 }]));
        await payOrder(client, id);
        assert.equal((await partnerAct(partner, id, { action: 'REFUSER', reason: 'non' })).body.code, 'REASON_REQUIRED');
        await shiftOrder(id, { response_due_at: -1 });
        const late = await partnerAct(partner, id, { action: 'ACCEPTER' });
        assert.deepEqual([late.status, late.body.code], [409, 'RESPONSE_TOO_LATE']);
        assert.deepEqual([(await order(id)).order_state, n((await order(id)).refunded_amount)], ['SANS_REPONSE', 2_100]);
    });
});

describe('C. Annuler, rembourser, tâche planifiée', () => {
    test('client avant la préparation : tout rendu (11 288), frais Wave 169,32 à la charge d’Event Village, vente reprise ; après : refusé', async () => {
        const a = await newProduct(partner, shop, { price: 3_500 });
        const sauce = await newOption(a, 'Sauce', 500);
        const b = await newProduct(partner, shop, { price: 2_750 });
        const id = await placed(client, orderBody(shop, [{ productId: a, quantity: 2, optionIds: [sauce] }, { productId: b, quantity: 1 }]));
        const pay = await payOrder(client, id);
        assert.equal((await partnerAct(partner, id, { action: 'ACCEPTER' })).status, 200);
        const res = await reply(await clientCancelRoute(req(`/api/orders/${id}/cancel`, 'POST', client.accessToken), ctx(id)));
        assert.equal(res.status, 200, JSON.stringify(res.body));
        assert.equal(res.body.message, 'Commande annulée. Vous êtes remboursé de 11 288 F CFA sur votre compte de paiement.');
        const refunds = await refundsOfOrder(id);
        assert.deepEqual(refunds.map((r) => [n(r.amount), n(r.facial_part), n(r.service_part), n(r.aggregator_fee_share), r.aggregator_fee_bearer]),
            [[11_288, 10_750, 538, 169.32, 'EVENT_VILLAGE']]);
        assert.equal(await ledgerOfPayment(pay.id), 0, 'vente reprise au grand livre');
        const o = await order(id);
        assert.deepEqual([o.order_state, n(o.refunded_amount), n(o.refund_percent), o.cancel_origin, o.payment_status], ['ANNULEE_CLIENT', 11_288, 100, 'CLIENT', 'REFUND_PENDING']);
        assert.deepEqual((await outboxOf(client.userId, id)).filter((x) => x.startsWith('ORDER_CANCELLED')), allChannels('ORDER_CANCELLED'));
        assert.deepEqual((await outboxOf(partner.userId, id)).filter((x) => x.startsWith('ORDER_CANCELLED_PRO')), allChannels('ORDER_CANCELLED_PRO'));
        const id2 = await placed(client, orderBody(shop, [{ productId: b, quantity: 1 }]));
        await payOrder(client, id2);
        assert.equal((await partnerAct(partner, id2, { action: 'ACCEPTER' })).status, 200);
        assert.equal((await partnerAct(partner, id2, { action: 'PREPARER' })).status, 200);
        const late = await reply(await clientCancelRoute(req(`/api/orders/${id2}/cancel`, 'POST', client.accessToken), ctx(id2)));
        assert.deepEqual([late.status, late.body.code], [409, 'PREPARATION_STARTED']);
    });

    test('partenaire en préparation (motif) : tout rendu ; Event Village (faute de la partenaire) : tout rendu, faute notée, avis au livreur', async () => {
        const p = await newProduct(partner, shop, { price: 5_000 });
        const id = await placed(client, orderBody(shop, [{ productId: p, quantity: 1 }]));
        await payOrder(client, id);
        await partnerAct(partner, id, { action: 'ACCEPTER' });
        await partnerAct(partner, id, { action: 'PREPARER' });
        const cancel = await partnerAct(partner, id, { action: 'ANNULER', reason: 'Plus de gaz en cuisine' });
        assert.equal(cancel.status, 200, JSON.stringify(cancel.body));
        assert.deepEqual([(await order(id)).order_state, n((await order(id)).refunded_amount), (await order(id)).partner_fault], ['ANNULEE_PARTENAIRE', 5_250, true]);
        const id2 = await placed(client, orderBody(shop, [{ productId: p, quantity: 2 }], delivery()));
        await payOrder(client, id2);
        await partnerAct(partner, id2, { action: 'ACCEPTER' });
        await partnerAct(partner, id2, { action: 'CONFIER', courierId: courier.userId });
        const superadmin = await superadminId();
        const { data: s } = await service.from('users').select('id').eq('id', superadmin).single();
        assert.ok(s);
        const ev = await service.rpc('order_cancel', { p: { order_id: id2, actor_id: superadmin, origin: 'EVENT_VILLAGE', reason: 'Plainte du client confirmée' } });
        assert.equal((ev.data as Row).ok, true, JSON.stringify(ev));
        const o2 = await order(id2);
        // 2 × 5 000 + zone 1 000 = 11 000 ; frais 550 ; tout rendu : 11 550
        assert.deepEqual([o2.order_state, n(o2.refunded_amount), o2.partner_fault, o2.cancel_origin], ['ANNULEE_EV', 11_550, true, 'EVENT_VILLAGE']);
        assert.deepEqual((await outboxOf(courier.userId, id2)).filter((x) => x.startsWith('ORDER_COURIER_CANCELLED')), allChannels('ORDER_COURIER_CANCELLED'));
        const noRight = await reply(await adminCancelRoute(req(`/api/admin/orders/${id}/cancel`, 'POST', client.accessToken, { reason: 'Essai sans droit' }), ctx(id)));
        assert.ok([401, 403].includes(noRight.status), `route d’administration refusée sans droit (HTTP ${noRight.status})`);
    });

    test('parrainage : commission sur le net d’Event Village, régularisée à l’annulation', async () => {
        const sponsor = await newBuyer('l12a-parrain');
        const buyer = await newBuyer('l12a-filleul');
        const { data: cfg } = await service.from('referral_config').select('rate_n1, rate_n2, duration_months')
            .eq('sponsor_status', 'STANDARD').eq('referral_type', 'CLIENT_TO_CLIENT').eq('is_active', true).maybeSingle();
        const { error } = await service.from('referral_relationships').insert({
            sponsor_id: sponsor.userId, referred_id: buyer.userId, referral_type: 'CLIENT_TO_CLIENT', sponsor_status_at_creation: 'STANDARD',
            rate_n1_at_creation: n(cfg?.rate_n1 ?? 5), rate_n2_at_creation: n(cfg?.rate_n2 ?? 2), duration_months: n(cfg?.duration_months ?? 12),
            expires_at: new Date(Date.now() + 365 * 86_400_000).toISOString(), is_active: true,
        });
        assert.equal(error, null, error?.message);
        const p = await newProduct(partner, shop, { price: 20_000 });
        const id = await placed(buyer, orderBody(shop, [{ productId: p, quantity: 1 }]));
        const pay = await payOrder(buyer, id);
        await service.rpc('calculate_referral_commissions', { p_payment_id: pay.id });
        const comm = await sql<{ amount: string }>(`SELECT amount FROM public.referral_commissions WHERE payment_id = $1 AND kind = 'COMMISSION'`, [pay.id]);
        // net Event Village = 1 000 − 1,5 % × 21 000 (315) = 685
        assert.equal(n(comm[0]?.amount), Math.round(685 * n(cfg?.rate_n1 ?? 5)) / 100);
        const c = await service.rpc('order_cancel', { p: { order_id: id, actor_id: buyer.userId, origin: 'CLIENT' } });
        assert.equal((c.data as Row).ok, true);
        // La régularisation suit le remboursement versé (paiement REFUNDED), comme pour les billets et les tables
        await sendOrderRefunds((c.data as Row).cashout_ids);
        await confirmCashouts();
        const regul = await sql<{ s: string }>(`SELECT COALESCE(sum(amount), 0) AS s FROM public.referral_commissions WHERE kind = 'REGULARISATION'
                                                 AND regularizes_id IN (SELECT id FROM public.referral_commissions WHERE payment_id = $1)`, [pay.id]);
        assert.equal(n(regul[0].s), -n(comm[0].amount), 'commission régularisée');
    });

    test('tâche : attente échue → non payée à temps (produits rendus) ; paiement arrivé ensuite : remboursé en entier ; tâche rejouée sans effet', async () => {
        const p = await newProduct(partner, shop, { price: 1_000, stock: 5 });
        const id = await placed(client, orderBody(shop, [{ productId: p, quantity: 2 }]));
        const started = await startOrderPay(client, id);
        assert.equal(started.status, 201, JSON.stringify(started.body));
        await shiftOrder(id, { hold_expires_at: -1 });
        const t = await tick();
        assert.ok(n(t.expired_holds) >= 1, JSON.stringify(t));
        assert.deepEqual([(await order(id)).order_state, n((await service.from('products').select('stock_quantity').eq('id', p).single()).data?.stock_quantity)], ['EXPIREE', 5]);
        providerSays(started.payment!, 'SUCCESS');
        const hook = await deliverWebhook(started.payment!);
        assert.equal(hook.status, 200);
        const pay = await paymentById(started.payment!.id);
        assert.ok(['REFUND_PENDING', 'REFUNDED'].includes(String(pay.status)), `paiement arrivé trop tard remboursé (${pay.status})`);
        assert.deepEqual((await outboxOf(client.userId, id)).filter((x) => x.startsWith('ORDER_PAYMENT_REFUNDED')), allChannels('ORDER_PAYMENT_REFUNDED'));
        assert.equal(n((await order(id)).paid_goods), 0);
        const again = await tick();
        const stillExpired = await order(id);
        assert.equal(stillExpired.order_state, 'EXPIREE');
        assert.ok(n(again.expired_holds) >= 0);
        const cron = await cronOrders(new NextRequest(`${BASE_URL}/api/cron/orders`, { method: 'POST', headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } }));
        assert.equal(cron.status, 200);
        const noSecret = await cronOrders(new NextRequest(`${BASE_URL}/api/cron/orders`, { method: 'POST' }));
        assert.ok([401, 403].includes(noSecret.status), 'tâche refusée sans le secret');
    });

    test('tâche : sans réponse sous 15 minutes → annulée, tout rendu (2 100), avis au client et à la partenaire', async () => {
        const p = await newProduct(partner, shop, { price: 2_000 });
        const id = await placed(client, orderBody(shop, [{ productId: p, quantity: 1 }]));
        await payOrder(client, id);
        await shiftOrder(id, { response_due_at: -1 });
        await tick();
        const o = await order(id);
        assert.deepEqual([o.order_state, n(o.refunded_amount), o.cancel_origin], ['SANS_REPONSE', 2_100, 'SANS_REPONSE']);
        assert.ok((await outboxOf(partner.userId, id)).some((x) => x === 'ORDER_CANCELLED_PRO:SMS'));
    });

    test('tâche : commande prête non retirée — prévenu 2 h avant, puis close 24 h après l’heure prévue, sans remboursement ni stock rendu', async () => {
        const p = await newProduct(partner, shop, { price: 3_000, stock: 4 });
        const id = await placed(client, orderBody(shop, [{ productId: p, quantity: 1 }]));
        await payOrder(client, id);
        await toReady(partner, id);
        await shiftOrder(id, { scheduled_for: -23 * 60, ready_at: -23 * 60 });
        await tick();
        assert.ok((await order(id)).pickup_warned_at, 'client prévenu');
        assert.deepEqual((await outboxOf(client.userId, id)).filter((x) => x.startsWith('ORDER_PICKUP_REMINDER')), allChannels('ORDER_PICKUP_REMINDER'));
        assert.equal((await order(id)).order_state, 'PRETE');
        await shiftOrder(id, { scheduled_for: -25 * 60, ready_at: -25 * 60 });
        await tick();
        const o = await order(id);
        assert.deepEqual([o.order_state, n(o.refunded_amount), o.code_hash], ['NON_RETIREE', 0, null]);
        assert.equal(n((await service.from('products').select('stock_quantity').eq('id', p).single()).data?.stock_quantity), 3, 'produit préparé : stock non rendu');
        assert.deepEqual((await outboxOf(client.userId, id)).filter((x) => x.startsWith('ORDER_NOT_COLLECTED')), allChannels('ORDER_NOT_COLLECTED'));
    });

    test('tâche : adresse et téléphone masqués 7 jours après la remise (pas avant) ; la partenaire ne les voit plus', async () => {
        const p = await newProduct(partner, shop, { price: 6_000 });
        const id = await placed(client, orderBody(shop, [{ productId: p, quantity: 1 }], delivery()));
        await payOrder(client, id);
        await toReady(partner, id);
        await partnerAct(partner, id, { action: 'EN_ROUTE' });
        await partnerAct(partner, id, { action: 'REMETTRE', code: await codeOf(client, id) });
        await shiftOrder(id, { handed_over_at: -6 * 1440, closed_at: -6 * 1440 });
        await tick();
        assert.equal((await order(id)).contact_phone, client.phoneE164, 'gardé avant 7 jours');
        await shiftOrder(id, { handed_over_at: -7 * 1440 - 5, closed_at: -7 * 1440 - 5 });
        await tick();
        const o = await order(id);
        assert.deepEqual([o.delivery_address, o.contact_phone, o.delivery_notes, Boolean(o.contact_masked_at)], [null, null, null, true]);
        const view = await reply(await partnerOrderGet(req(`/api/partner/orders/${id}`, 'GET', partner.accessToken), ctx(id)));
        assert.equal(view.status, 200);
        assert.deepEqual([(view.body.order as Row).contact ?? null, (view.body.order as Row).contact_masked], [null, true]);
    });
});

describe('D. Accès d’autrui', () => {
    test('autre partenaire, autre client, livreur d’une autre équipe : « Commande introuvable » partout', async () => {
        const p = await newProduct(partner, shop, { price: 7_000 });
        const id = await placed(client, orderBody(shop, [{ productId: p, quantity: 1 }], delivery()));
        await payOrder(client, id);
        await partnerAct(partner, id, { action: 'ACCEPTER' });
        await partnerAct(partner, id, { action: 'CONFIER', courierId: courier.userId });
        assert.equal((await partnerAct(other, id, { action: 'ANNULER', reason: 'Pas à moi' })).status, 404);
        assert.equal((await reply(await partnerOrderGet(req(`/api/partner/orders/${id}`, 'GET', other.accessToken), ctx(id)))).status, 404);
        const otherList = await reply(await partnerOrdersGet(req('/api/partner/orders', 'GET', other.accessToken)));
        assert.equal(((otherList.body.orders as Row[]) ?? []).some((o) => o.id === id), false);
        assert.equal((await reply(await clientOrderGet(req(`/api/orders/${id}`, 'GET', stranger.accessToken), ctx(id)))).status, 404);
        assert.equal((await reply(await clientCancelRoute(req(`/api/orders/${id}/cancel`, 'POST', stranger.accessToken), ctx(id)))).status, 404);
        assert.equal((await reply(await clientCodeRoute(req(`/api/orders/${id}/code`, 'POST', stranger.accessToken), ctx(id)))).status, 404);
        const pay = await startOrderPay(stranger, id);
        assert.deepEqual([pay.status, pay.body.code], [404, 'ORDER_NOT_FOUND']);
        assert.equal((await courierAct(foreignCourier, id, { action: 'EN_ROUTE' })).status, 404);
        const foreignList = await reply(await courierOrdersGet(req('/api/courier/orders', 'GET', foreignCourier.accessToken)));
        assert.equal(((foreignList.body.orders as Row[]) ?? []).some((o) => o.id === id), false);
        const cannotAssign = await partnerAct(partner, id, { action: 'CONFIER', courierId: foreignCourier.userId });
        assert.equal(cannotAssign.body.code, 'COURIER_NOT_FOUND', 'un livreur d’une autre équipe ne se voit pas confier la commande');
        const own = await reply(await courierOrdersGet(req('/api/courier/orders', 'GET', courier.accessToken)));
        assert.equal(((own.body.orders as Row[]) ?? []).some((o) => o.id === id), true, 'le livreur de l’équipe la voit');
    });

    test('livreur invité mais pas encore d’accord, puis retiré de l’équipe : plus aucune commande', async () => {
        const late = await newBuyer('l12a-livreur-hesitant');
        const { data: inv } = await service.rpc('order_courier_invite', { p: { actor_id: partner.userId, phone: late.phoneE164 } });
        assert.equal((inv as Row).ok, true, JSON.stringify(inv));
        const p = await newProduct(partner, shop, { price: 7_000 });
        const id = await placed(client, orderBody(shop, [{ productId: p, quantity: 1 }], delivery()));
        await payOrder(client, id);
        await partnerAct(partner, id, { action: 'ACCEPTER' });
        assert.equal((await partnerAct(partner, id, { action: 'CONFIER', courierId: late.userId })).body.code, 'COURIER_NOT_FOUND');
        const extra = await newBuyer('l12a-livreur-retire');
        await addCourier(partner, extra);
        assert.equal((await partnerAct(partner, id, { action: 'CONFIER', courierId: extra.userId })).status, 200);
        const { data: rm } = await service.rpc('order_courier_remove', { p: { actor_id: partner.userId, courier_id: extra.userId } });
        assert.deepEqual([(rm as Row).ok, (rm as Row).orders_unassigned], [true, 1]);
        assert.equal((await courierAct(extra, id, { action: 'EN_ROUTE' })).status, 404);
        assert.equal((await order(id)).courier_user_id, null);
    });

    test('REST : ni la partenaire ni le livreur ne lisent les commandes ; le client lit les siennes ; aucune écriture REST ; livreurs illisibles', async () => {
        const p = await newProduct(partner, shop, { price: 7_000 });
        const id = await placed(client, orderBody(shop, [{ productId: p, quantity: 1 }], delivery()));
        await payOrder(client, id);
        await partnerAct(partner, id, { action: 'ACCEPTER' });
        await partnerAct(partner, id, { action: 'CONFIER', courierId: courier.userId });
        for (const [who, token] of [['partenaire', partner.accessToken], ['livreur', courier.accessToken]] as const) {
            for (const table of ['orders', 'order_items', 'order_state_history']) {
                const col = table === 'orders' ? 'id' : 'order_id';
                const { data } = await userClient(token).from(table).select('*').eq(col, id);
                assert.deepEqual(data ?? [], [], `${who} : aucune lecture REST de ${table}`);
            }
        }
        const { data: mine } = await userClient(client.accessToken).from('orders').select('id').eq('id', id);
        assert.deepEqual((mine ?? []).map((x) => x.id), [id]);
        const { data: couriers } = await userClient(partner.accessToken).from('partner_couriers').select('*');
        assert.deepEqual(couriers ?? [], []);
        const { error: upd } = await userClient(client.accessToken).from('orders').update({ order_state: 'REMISE' }).eq('id', id);
        assert.ok(upd, 'écriture REST refusée');
        const { error: ins } = await userClient(client.accessToken).from('orders').insert({ order_number: 'X', client_id: client.userId, partner_id: partner.partnerId, subtotal: 1, total_amount: 1, delivery_mode: 'RETRAIT' });
        assert.ok(ins, 'insertion REST refusée');
    });

    test('garde : même le rôle de service ne change une commande d’établissement que par les fonctions en base', async () => {
        const p = await newProduct(partner, shop, { price: 7_000 });
        const id = await placed(client, orderBody(shop, [{ productId: p, quantity: 1 }]));
        const { error: upd } = await service.from('orders').update({ order_state: 'REMISE', paid_goods: 7_000 }).eq('id', id);
        assert.match(String(upd?.message), /fonctions en base/);
        const { error: del } = await service.from('orders').delete().eq('id', id);
        assert.ok(del, 'suppression refusée');
        const { error: line } = await service.from('order_items').update({ unit_price: 1, total_price: 1 }).eq('order_id', id);
        assert.ok(line, 'ligne figée');
    });

    test('fiche SUSPENDU : lecture seule (liste 200, toute action 403)', async () => {
        const sus = await newPartner('l12a-suspendue');
        const susShop = await newShop(sus);
        const p = await newProduct(sus, susShop, { price: 2_000 });
        const id = await placed(client, orderBody(susShop, [{ productId: p, quantity: 1 }]));
        await payOrder(client, id);
        const { error } = await service.from('partners').update({ status: 'SUSPENDU' }).eq('id', sus.partnerId);
        assert.equal(error, null, error?.message);
        try {
            const list = await reply(await partnerOrdersGet(req('/api/partner/orders', 'GET', sus.accessToken)));
            assert.equal(list.status, 200, JSON.stringify(list.body));
            const act = await partnerAct(sus, id, { action: 'ACCEPTER' });
            assert.deepEqual([act.status, act.body.code], [403, 'PARTNER_SUSPENDED']);
        } finally {
            await service.from('partners').update({ status: 'VALIDE' }).eq('id', sus.partnerId);
        }
    });
});

describe('E. Concurrence', () => {
    test('deux créations de paiement simultanées : une seule passe ; deux confirmations simultanées : un seul encaissement', async () => {
        const p = await newProduct(partner, shop, { price: 4_000 });
        const id = await placed(client, orderBody(shop, [{ productId: p, quantity: 1 }]));
        const both = await Promise.all([startOrderPay(client, id), startOrderPay(client, id)]);
        assert.deepEqual(both.map((b) => b.status).sort(), [201, 409], JSON.stringify(both.map((b) => b.body)));
        const started = both.find((b) => b.status === 201)!;
        providerSays(started.payment!, 'SUCCESS');
        const confirms = await Promise.all([1, 2].map(() => service.rpc('order_payment_confirm', { p_payment_id: started.payment!.id, p_source: 'WEBHOOK' })));
        assert.deepEqual(confirms.map((c) => (c.data as Row).result).sort(), ['ALREADY_CONFIRMED', 'CONFIRMED']);
        assert.equal(n((await order(id)).paid_goods), 4_000);
    });

    test('deux paiements encaissés pour la même commande : le second est remboursé en entier, jamais compté deux fois', async () => {
        const p = await newProduct(partner, shop, { price: 4_000 });
        const id = await placed(client, orderBody(shop, [{ productId: p, quantity: 1 }]));
        const one = await startOrderPay(client, id);
        assert.equal(one.status, 201);
        const { error } = await service.rpc('payment_release', { p_payment_id: one.payment!.id, p_status: 'FAILED', p_reason: 'TEST' });
        assert.equal(error, null, error?.message);
        const two = await startOrderPay(client, id);
        assert.equal(two.status, 201, JSON.stringify(two.body));
        const results = await Promise.all([one, two].map((x) => service.rpc('order_payment_confirm', { p_payment_id: x.payment!.id, p_source: 'WEBHOOK' })));
        assert.deepEqual(results.map((r) => (r.data as Row).result).sort(), ['CONFIRMED', 'REFUND_REQUIRED']);
        const o = await order(id);
        assert.deepEqual([n(o.paid_goods), n(o.paid_fees)], [4_000, 200]);
    });

    test('deux remises simultanées avec le bon code : une seule ; deux annulations simultanées (client et partenaire) : un seul remboursement', async () => {
        const p = await newProduct(partner, shop, { price: 2_000 });
        const id = await placed(client, orderBody(shop, [{ productId: p, quantity: 1 }]));
        await payOrder(client, id);
        await toReady(partner, id);
        const code = await codeOf(client, id);
        const two = await Promise.all([partnerAct(partner, id, { action: 'REMETTRE', code }), partnerAct(partner, id, { action: 'REMETTRE', code })]);
        assert.deepEqual(two.map((x) => x.status).sort(), [200, 409]);
        assert.equal(two.find((x) => x.status === 409)!.body.code, 'ALREADY_HANDED_OVER');
        const id2 = await placed(client, orderBody(shop, [{ productId: p, quantity: 1 }]));
        await payOrder(client, id2);
        await partnerAct(partner, id2, { action: 'ACCEPTER' });
        const cancels = await Promise.all([
            reply(await clientCancelRoute(req(`/api/orders/${id2}/cancel`, 'POST', client.accessToken), ctx(id2))),
            partnerAct(partner, id2, { action: 'ANNULER', reason: 'Fermeture imprévue' }),
        ]);
        assert.deepEqual(cancels.map((c) => c.status).sort(), [200, 409], JSON.stringify(cancels.map((c) => c.body)));
        const refunds = await refundsOfOrder(id2);
        assert.deepEqual(refunds.map((r) => n(r.amount)), [2_100], 'un seul remboursement');
    });
});

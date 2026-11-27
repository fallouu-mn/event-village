/**
 * Contre-vérification du lot 12c — garde-fous éprouvés de façon indépendante (verts attendus ; un rouge serait un trou).
 * Base LOCALE, faux SamirPay et faux SMS ; attaques par les routes (jeton de l'attaquant) ou par la REST (clé anon, jeton
 * de la partenaire). Fiches et réglages modifiés remis dans leur état (finally).
 *
 *  G1 « À vérifier » : majuscules accentuées, accent aigu à la place du grave, tiret, pluriel, mot dans la description ou
 *     dans un supplément renommé ; la partenaire n'efface pas l'état (route, champ interdit, REST).
 *  G2 Produit à vérifier : refusé au devis et à la création ; produit devenu à vérifier après la commande : paiement
 *     refusé (product_regulated).
 *  G3 Décision : administrateur sans partners.validate refusé à la file et à la décision (403) ; compte partenaire refusé.
 *  G4 Liste des mots : finance_setting_set ne l'écrit pas (clé inconnue), la REST non plus (jeton de la partenaire) ; liste
 *     vide, géante, mal formée refusée même par la fonction appelée directement.
 *  G5 Argent : prix et supplément à centimes, négatifs, géants, en texte refusés par la route ; frais et minimum de zone à
 *     centimes ou négatifs refusés ; zone d'un autre établissement, supplément d'un autre produit, produit d'une autre
 *     partenaire : refusés (identifiants devinés).
 *  G6 Remise avec « reste reçu » (retrait, paiement à la remise) : le code n'est jamais servi à la partenaire, la remise
 *     note le reste sans aucun paiement ni versement Event Village, une deuxième confirmation est refusée, une autre
 *     partenaire ne peut rien.
 *  G7 Fiche SUSPENDU : écritures du catalogue, des zones, des suppléments et des catégories refusées ; lecture gardée ;
 *     fiche remise VALIDE à la fin.
 *  G8 Prix et supplément changés, zone désactivée pendant une commande ouverte non payée : le paiement prend les montants
 *     figés de la commande.
 */
import '../helpers/env';
import { after, before, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { BASE_URL } from '../parcours/helpers';
import { newAdmin, type TestAdmin } from '../parcours/notif-helpers';
import { POST as productsPost } from '../../app/api/partner/products/route';
import { PATCH as productPatch } from '../../app/api/partner/products/[id]/route';
import { POST as optionPost } from '../../app/api/partner/products/[id]/options/route';
import { PATCH as optionPatch } from '../../app/api/partner/products/[id]/options/[optionId]/route';
import { POST as zonePost } from '../../app/api/partner/venues/[id]/zones/route';
import { PATCH as zonePatch, DELETE as zoneDelete } from '../../app/api/partner/venues/[id]/zones/[zoneId]/route';
import { POST as categoriesPost } from '../../app/api/partner/products/categories/route';
import { GET as catalogGet } from '../../app/api/partner/catalog/route';
import { GET as partnerOrderGet } from '../../app/api/partner/orders/[id]/route';
import { POST as regulationPost } from '../../app/api/admin/products/[id]/regulation/route';
import { GET as reviewGet } from '../../app/api/admin/products/review/route';
import {
    codeOf, n, newBuyer, newPartner, newShop, openOrdersService, order, orderBody, orderRpc, partnerAct, placed, releaseUnpaid, service,
    startOrderPay, superadminId, toReady, userClient, type Buyer, type Row, type TestPartner,
} from '../parcours/l12a-helpers';

let restore: () => Promise<void>;
let partner: TestPartner;
let other: TestPartner;
let client: Buyer;
let reviewer: TestAdmin;
let shop: string;
let otherShop: string;

before(async () => {
    restore = await openOrdersService();
    partner = await newPartner('cv12c-g');
    other = await newPartner('cv12c-g-autre');
    client = await newBuyer('cv12c-g-client');
    reviewer = await newAdmin('cv12c-g-verif', ['partners.validate']);
    shop = await newShop(partner, { payOnHandover: true });
    otherShop = await newShop(other);
});

beforeEach(async () => {
    if (client) await releaseUnpaid(client.userId);
});

after(async () => {
    await restore();
});

type Reply = { status: number; body: Row };
function req(path: string, method: string, token: string | null, body?: unknown): NextRequest {
    const headers: Record<string, string> = { 'content-type': 'application/json' };
    if (token) headers.authorization = `Bearer ${token}`;
    return new NextRequest(`${BASE_URL}${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
}
const params = <T extends Record<string, string>>(p: T) => ({ params: Promise.resolve(p) });
async function reply(res: Response): Promise<Reply> {
    return { status: res.status, body: (await res.json()) as Row };
}
async function create(owner: Buyer, body: Row): Promise<Reply> {
    return reply(await productsPost(req('/api/partner/products', 'POST', owner.accessToken, body)));
}
async function createOk(body: Row): Promise<Row> {
    const r = await create(partner, body);
    assert.equal(r.status, 201, `création : ${JSON.stringify(r.body)}`);
    return r.body.product as Row;
}
async function product(id: string): Promise<Row> {
    const { data, error } = await service.from('products').select('*').eq('id', id).maybeSingle();
    assert.equal(error, null, error?.message);
    return (data ?? {}) as Row;
}
async function quote(body: Row): Promise<Row> {
    const { orderInput } = await import('../../lib/orders/booking');
    const { data, error } = await service.rpc('order_quote', { p: orderInput(client.userId, body) });
    assert.equal(error, null, `order_quote : ${error?.message}`);
    return data as Row;
}
async function suspended<T>(who: TestPartner, fn: () => Promise<T>): Promise<T> {
    const { error } = await service.from('partners').update({ status: 'SUSPENDU' }).eq('id', who.partnerId);
    assert.equal(error, null, error?.message);
    try {
        return await fn();
    } finally {
        const { error: back } = await service.from('partners').update({ status: 'VALIDE' }).eq('id', who.partnerId);
        assert.equal(back, null, `fiche non remise VALIDE : ${back?.message}`);
    }
}

describe('G1 — « à vérifier » posé et jamais effacé par la partenaire', () => {
    test('majuscules accentuées, accent aigu, tiret, pluriel, description, supplément renommé', async () => {
        const got: Array<[string, unknown]> = [];
        for (const fields of [
            { name: 'BIÈRE BLONDE 65 CL' }, { name: 'Biére pression' }, { name: 'CHICHA menthe' }, { name: 'Bière-pression maison' },
            { name: 'Vins rouges du Sine' }, { name: 'Thé glacé', description: 'Avec une touche de RHUM ambré' },
        ] as Row[]) {
            const p = await createOk({ venue_id: shop, price: 1_000, ...fields });
            got.push([String(fields.name), p.review_state ?? null]);
        }
        console.log(`[CV12C-G1] ${JSON.stringify(got)}`);
        assert.deepEqual(got.map(([, s]) => s), got.map(() => 'A_VERIFIER'), JSON.stringify(got));

        const clean = await createOk({ venue_id: shop, name: 'Thiakry', price: 1_000 });
        const id = String(clean.id);
        const opt = await reply(await optionPost(req(`/api/partner/products/${id}/options`, 'POST', partner.accessToken, { name: 'Lait caillé', price: 200 }), params({ id })));
        assert.equal(opt.status, 201, JSON.stringify(opt.body));
        const optionId = String((opt.body.option as Row).id);
        const renamed = await reply(await optionPatch(req(`/api/partner/products/${id}/options/${optionId}`, 'PATCH', partner.accessToken, { name: 'Liqueur de bissap' }), params({ id, optionId })));
        assert.equal(renamed.status, 200, JSON.stringify(renamed.body));
        assert.equal((await product(id)).review_state, 'A_VERIFIER', 'supplément renommé avec un mot de la liste');

        const forged = await reply(await productPatch(req(`/api/partner/products/${id}`, 'PATCH', partner.accessToken, { review_state: null, review_words: [] }), params({ id })));
        assert.equal(forged.status, 400, JSON.stringify(forged.body));
        const browser = userClient(partner.accessToken);
        const { error: rest } = await browser.from('products').update({ review_state: null }).eq('id', id);
        const { data: restRows } = await browser.from('products').update({ name: 'Thiakry' }).eq('id', id).select('id');
        assert.ok(rest, 'état « à vérifier » écrit par la REST avec le jeton de la partenaire');
        assert.equal((restRows ?? []).length, 0, 'produit écrit par la REST avec le jeton de la partenaire');
        assert.equal((await product(id)).review_state, 'A_VERIFIER', 'état effacé');
    });
});

describe('G2 — produit à vérifier jamais vendu', () => {
    test('devis et création refusés ; devenu à vérifier après la commande : paiement refusé', async () => {
        const beer = await createOk({ venue_id: shop, name: 'Bière Gazelle', price: 1_000 });
        const body = orderBody(shop, [{ productId: String(beer.id), quantity: 1 }]);
        assert.equal((await quote(body)).code, 'PRODUCT_UNDER_REVIEW');
        assert.equal((await orderRpc(client, body)).code, 'PRODUCT_UNDER_REVIEW');

        const juice = await createOk({ venue_id: shop, name: 'Jus de ditakh', price: 1_000 });
        const jid = String(juice.id);
        const orderId = await placed(client, orderBody(shop, [{ productId: jid, quantity: 1 }]));
        const patched = await reply(await productPatch(req(`/api/partner/products/${jid}`, 'PATCH', partner.accessToken, { description: 'Coupé au gin' }), params({ id: jid })));
        assert.equal(patched.status, 200);
        const pay = await startOrderPay(client, orderId);
        console.log(`[CV12C-G2] paiement d’une commande devenue à vérifier : HTTP ${pay.status} ${JSON.stringify(pay.body).slice(0, 200)}`);
        assert.ok(pay.status >= 400 && !pay.payment, `paiement lancé (HTTP ${pay.status})`);
    });
});

describe('G3 — droit partners.validate', () => {
    test('administrateur sans le droit et partenaire : file et décision refusées', async () => {
        const beer = await createOk({ venue_id: shop, name: 'Bière brune', price: 1_000 });
        const id = String(beer.id);
        const nobody = await newAdmin('cv12c-g-sans-droit', ['events.read', 'partners.read']);
        for (const [who, token] of [['admin sans droit', nobody.accessToken], ['partenaire', partner.accessToken]] as const) {
            const q = await reply(await reviewGet(req('/api/admin/products/review', 'GET', token)));
            assert.ok(q.status === 401 || q.status === 403, `${who} lit la file (HTTP ${q.status})`);
            const d = await reply(await regulationPost(req(`/api/admin/products/${id}/regulation`, 'POST', token, { regulated: false, reason: 'Essai interdit' }), params({ id })));
            assert.ok(d.status === 401 || d.status === 403, `${who} décide (HTTP ${d.status})`);
        }
        const { data } = await service.rpc('order_product_regulation_decide', { p: { actor_id: nobody.userId, product_id: id, regulated: false, reason: 'Essai interdit' } });
        assert.equal((data as Row).code, 'FORBIDDEN');
        assert.equal((await product(id)).review_state, 'A_VERIFIER');
    });
});

describe('G4 — liste des mots', () => {
    test('aucune autre voie d’écriture ; liste vide, géante ou mal formée refusée par la fonction', async () => {
        const superadmin = await superadminId();
        const { data: before } = await service.from('platform_settings').select('value').eq('key', 'orders.review_keywords').single();
        try {
            const { data: generic, error } = await service.rpc('finance_setting_set', { p_key: 'orders.review_keywords', p_value: { value: [] }, p_actor: superadmin, p_reason: 'Essai' });
            console.log(`[CV12C-G4] finance_setting_set : ${JSON.stringify(generic ?? error?.message)}`);
            assert.ok(error || (generic as Row)?.ok !== true, 'liste écrite par finance_setting_set');
            const { data: restRows } = await userClient(partner.accessToken).from('platform_settings').update({ value: { value: [] } }).eq('key', 'orders.review_keywords').select('key');
            assert.equal((restRows ?? []).length, 0, 'liste écrite par la REST');
            for (const value of [[], [''], ['  '], Array.from({ length: 101 }, (_, i) => `mot${i}`), ['x'.repeat(41)], [null], ['bière', 'BIERE'], { a: 1 }, ['vin|rhum'], ['.*']]) {
                const { data } = await service.rpc('order_review_keywords_set', { p_value: { value }, p_actor: superadmin, p_reason: 'Essai de la contre-vérification' });
                assert.equal((data as Row).code, 'INVALID_VALUE', `valeur acceptée : ${JSON.stringify(value).slice(0, 60)}`);
            }
            const { data: after } = await service.from('platform_settings').select('value').eq('key', 'orders.review_keywords').single();
            assert.deepEqual(after!.value, before!.value, 'liste changée');
        } finally {
            await service.rpc('order_review_keywords_set', { p_value: before!.value, p_actor: superadmin, p_reason: 'Fin de la contre-vérification 12c' });
        }
    });
});

describe('G5 — argent et identifiants devinés', () => {
    test('prix, suppléments, frais et minimum bornés et entiers ; objets d’autrui refusés', async () => {
        for (const price of [1500.5, -1, 10_000_001, '1500', null]) {
            const r = await create(partner, { venue_id: shop, name: 'Plat test', price });
            assert.equal(r.status, 400, `prix ${JSON.stringify(price)} accepté (${r.status})`);
        }
        const dish = await createOk({ venue_id: shop, name: 'Mafé', price: 3_000 });
        const id = String(dish.id);
        for (const price of [100.5, -50, 1_000_001, 'deux cents']) {
            const r = await reply(await optionPost(req(`/api/partner/products/${id}/options`, 'POST', partner.accessToken, { name: 'Supplément', price }), params({ id })));
            assert.equal(r.status, 400, `supplément ${JSON.stringify(price)} accepté (${r.status})`);
        }
        for (const z of [{ fee: 500.5, minOrder: 0 }, { fee: -1, minOrder: 0 }, { fee: 100_001, minOrder: 0 }, { fee: 500, minOrder: -1 }, { fee: 500, minOrder: 0.5 }]) {
            const r = await reply(await zonePost(req(`/api/partner/venues/${shop}/zones`, 'POST', partner.accessToken, { name: 'Ouakam', ...z }), params({ id: shop })));
            assert.equal(r.status, 400, `zone ${JSON.stringify(z)} acceptée (${r.status} ${JSON.stringify(r.body)})`);
        }
        // Objets d'une autre partenaire, identifiants devinés
        const theirs = await reply(await create(other, { venue_id: otherShop, name: 'Leur plat', price: 1_000 }));
        const theirId = String((theirs.body.product as Row).id);
        const theirOpt = await reply(await optionPost(req(`/api/partner/products/${theirId}/options`, 'POST', other.accessToken, { name: 'Leur supplément', price: 100 }), params({ id: theirId })));
        const theirOptId = String((theirOpt.body.option as Row).id);
        const theirZone = await reply(await zonePost(req(`/api/partner/venues/${otherShop}/zones`, 'POST', other.accessToken, { name: 'Leur zone', fee: 500, minOrder: 0 }), params({ id: otherShop })));
        assert.ok(theirZone.status === 201 || theirZone.status === 200, JSON.stringify(theirZone.body));
        const theirZoneId = String((theirZone.body.zone as Row).id);
        const attempts: Array<[string, number]> = [];
        attempts.push(['produit', (await reply(await productPatch(req(`/api/partner/products/${theirId}`, 'PATCH', partner.accessToken, { price: 1 }), params({ id: theirId })))).status]);
        attempts.push(['supplément (par leur produit)', (await reply(await optionPatch(req(`/api/partner/products/${theirId}/options/${theirOptId}`, 'PATCH', partner.accessToken, { price: 1 }), params({ id: theirId, optionId: theirOptId })))).status]);
        attempts.push(['supplément (par mon produit)', (await reply(await optionPatch(req(`/api/partner/products/${id}/options/${theirOptId}`, 'PATCH', partner.accessToken, { price: 1 }), params({ id, optionId: theirOptId })))).status]);
        attempts.push(['zone (leur établissement)', (await reply(await zonePatch(req(`/api/partner/venues/${otherShop}/zones/${theirZoneId}`, 'PATCH', partner.accessToken, { fee: 0 }), params({ id: otherShop, zoneId: theirZoneId })))).status]);
        attempts.push(['zone (mon établissement)', (await reply(await zonePatch(req(`/api/partner/venues/${shop}/zones/${theirZoneId}`, 'PATCH', partner.accessToken, { fee: 0 }), params({ id: shop, zoneId: theirZoneId })))).status]);
        attempts.push(['zone retirée', (await reply(await zoneDelete(req(`/api/partner/venues/${shop}/zones/${theirZoneId}`, 'DELETE', partner.accessToken), params({ id: shop, zoneId: theirZoneId })))).status]);
        console.log(`[CV12C-G5] ${JSON.stringify(attempts)}`);
        assert.ok(attempts.every(([, s]) => s === 404 || s === 403), JSON.stringify(attempts));
        const { data: z } = await service.from('order_delivery_zones').select('fee').eq('id', theirZoneId).single();
        const { data: o } = await service.from('product_options').select('price_delta').eq('id', theirOptId).single();
        assert.deepEqual([n(z!.fee), n(o!.price_delta), n((await product(theirId)).price)], [500, 100, 1_000]);
    });
});

describe('G6 — remise avec « reste reçu »', () => {
    test('code jamais servi à la partenaire ; reste noté sans paiement ni versement ; une seule fois ; autre partenaire refusée', async () => {
        const dish = await createOk({ venue_id: shop, name: 'Pastels', price: 2_500 });
        const id = await placed(client, orderBody(shop, [{ productId: String(dish.id), quantity: 2 }], { mode: 'RETRAIT', payment: 'DIFFERE' }));
        await toReady(partner, id);
        const code = await codeOf(client, id);
        const view = await reply(await partnerOrderGet(req(`/api/partner/orders/${id}`, 'GET', partner.accessToken), params({ id })));
        assert.equal(view.status, 200);
        assert.ok(!new RegExp(`\\b${code}\\b`).test(JSON.stringify(view.body)), 'code de remise servi à la partenaire');
        const intruder = await partnerAct(other, id, { action: 'REMETTRE', code, balanceReceived: true });
        assert.equal(intruder.status, 404, JSON.stringify(intruder.body));
        const noBalance = await partnerAct(partner, id, { action: 'REMETTRE', code });
        assert.equal(noBalance.body.code, 'BALANCE_DUE', JSON.stringify(noBalance.body));
        const done = await partnerAct(partner, id, { action: 'REMETTRE', code, balanceReceived: true });
        assert.equal(done.status, 200, JSON.stringify(done.body));
        const again = await partnerAct(partner, id, { action: 'REMETTRE', code, balanceReceived: true });
        assert.ok(again.status >= 400, `deuxième « reste reçu » accepté (${again.status})`);
        const o = await order(id);
        assert.deepEqual([o.order_state, n(o.onsite_amount), n(o.paid_goods), n(o.paid_fees)], ['REMISE', 5_000, 0, 0]);
        const { data: pays } = await service.from('payments').select('id').eq('order_id', id);
        assert.equal((pays ?? []).length, 0, 'paiement Event Village créé pour le reste reçu');
        const { count: logs } = await service.from('audit_logs').select('id', { count: 'exact', head: true }).eq('object_id', id).eq('action', 'ORDER_HANDED_OVER');
        assert.equal(logs, 1, 'remise journalisée plus d’une fois');
    });
});

describe('G7 — fiche SUSPENDU en lecture seule', () => {
    test('catalogue, zones, suppléments, catégories : écritures refusées, lecture gardée', async () => {
        const dish = await createOk({ venue_id: shop, name: 'Yassa', price: 3_000 });
        const id = String(dish.id);
        const results = await suspended(partner, async () => {
            const out: Array<[string, number]> = [];
            out.push(['produit créé', (await create(partner, { venue_id: shop, name: 'Pendant la suspension', price: 1_000 })).status]);
            out.push(['produit modifié', (await reply(await productPatch(req(`/api/partner/products/${id}`, 'PATCH', partner.accessToken, { price: 1 }), params({ id })))).status]);
            out.push(['supplément', (await reply(await optionPost(req(`/api/partner/products/${id}/options`, 'POST', partner.accessToken, { name: 'Oignons', price: 0 }), params({ id })))).status]);
            out.push(['zone', (await reply(await zonePost(req(`/api/partner/venues/${shop}/zones`, 'POST', partner.accessToken, { name: 'Yoff', fee: 500, minOrder: 0 }), params({ id: shop })))).status]);
            out.push(['catégorie', (await reply(await categoriesPost(req('/api/partner/products/categories', 'POST', partner.accessToken, { name: 'Pendant la suspension' })))).status]);
            const read = await reply(await catalogGet(req('/api/partner/catalog', 'GET', partner.accessToken)));
            out.push(['catalogue lu', read.status]);
            return out;
        });
        console.log(`[CV12C-G7] ${JSON.stringify(results)}`);
        assert.deepEqual(results.filter(([k]) => k !== 'catalogue lu').map(([, s]) => s), [403, 403, 403, 403, 403], JSON.stringify(results));
        assert.equal(results.find(([k]) => k === 'catalogue lu')![1], 200);
        assert.equal(n((await product(id)).price), 3_000);
        const { data: fiche } = await service.from('partners').select('status').eq('id', partner.partnerId).single();
        assert.equal(fiche!.status, 'VALIDE', 'fiche non remise VALIDE');
    });
});

describe('G8 — montants figés d’une commande ouverte', () => {
    test('prix, supplément et frais changés, zone retirée avant le paiement : le paiement garde les montants de la commande', async () => {
        const dish = await createOk({ venue_id: shop, name: 'Thiou poisson', price: 4_000 });
        const id = String(dish.id);
        const opt = await reply(await optionPost(req(`/api/partner/products/${id}/options`, 'POST', partner.accessToken, { name: 'Riz en plus', price: 500 }), params({ id })));
        const optionId = String((opt.body.option as Row).id);
        const zone = await reply(await zonePost(req(`/api/partner/venues/${shop}/zones`, 'POST', partner.accessToken, { name: 'Mermoz', fee: 1_000, minOrder: 0 }), params({ id: shop })));
        const zoneId = String((zone.body.zone as Row).id);
        const orderId = await placed(client, orderBody(shop, [{ productId: id, quantity: 1, optionIds: [optionId] }],
            { mode: 'LIVRAISON', zoneId, address: 'Mermoz, villa 12, près de la pharmacie', phone: '771234567' }));
        const before = await order(orderId);
        assert.equal(n(before.goods_total), 5_500);
        await reply(await productPatch(req(`/api/partner/products/${id}`, 'PATCH', partner.accessToken, { price: 9_000 }), params({ id })));
        await reply(await optionPatch(req(`/api/partner/products/${id}/options/${optionId}`, 'PATCH', partner.accessToken, { price: 3_000 }), params({ id, optionId })));
        await reply(await zonePatch(req(`/api/partner/venues/${shop}/zones/${zoneId}`, 'PATCH', partner.accessToken, { fee: 5_000 }), params({ id: shop, zoneId })));
        const removed = await reply(await zoneDelete(req(`/api/partner/venues/${shop}/zones/${zoneId}`, 'DELETE', partner.accessToken), params({ id: shop, zoneId })));
        assert.equal(removed.body.outcome, 'DEACTIVATED', JSON.stringify(removed.body));
        const pay = await startOrderPay(client, orderId);
        assert.equal(pay.status, 200, JSON.stringify(pay.body));
        const after = await order(orderId);
        console.log(`[CV12C-G8] ${JSON.stringify({ goods: n(after.goods_total), fee: n(after.delivery_fee), paiement: pay.payment ? n(pay.payment.amount) : null })}`);
        assert.deepEqual([n(after.goods_total), n(after.delivery_fee)], [5_500, 1_000]);
        assert.equal(n(pay.payment!.amount), 5_500 + Math.ceil(5_500 * 0.05), 'montant du paiement : commande figée + 5 % de frais de service');
        await releaseUnpaid(client.userId);
    });
});

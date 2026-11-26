/**
 * Lot 12c — catalogue de la partenaire, produits « à vérifier », zones de livraison, suppléments, écrans des commandes :
 * argent et accès, par les routes (session de la partenaire, de l'administration) et les fonctions en base. Base LOCALE ;
 * faux SamirPay. Les montants attendus sont calculés à la main dans chaque test.
 *  A. « À vérifier » posé par la base (order_product_save) : mots de la liste sans accents ni majuscules, début de mot,
 *     pluriel ; administrateurs prévenus ; devis et création refusés.
 *  B. Contournements refusés : modification du nom, statut, champ interdit, écriture directe, supplément au nom d'un mot.
 *  C. Décision de l'administration (droit partners.validate) : l'état s'efface, la partenaire est prévenue.
 *  D. Produit devenu « à vérifier » après la commande : acceptation et paiement refusés.
 *  E. Prix, stock, case « réglementé », établissement (choisi à la création, jamais changé), produit d'une autre.
 *  F. Fiche SUSPENDU : lecture seule (route et base).
 *  G. Retrait : jamais vendu supprimé (suppléments, portions), vendu archivé (plus d'erreur 500), exclu du devis.
 *  H. Suppléments : prix entiers bornés, 20 au plus, produit d'une autre, prix figé sur la ligne de commande.
 *  I. Zones : frais et minimum entiers bornés, établissement d'une autre, frais et minimum appliqués au devis, frais figés,
 *     retrait (supprimée, désactivée si une commande ouverte l'utilise, archivée sinon), ordre.
 *  J. Acompte (10 à 90 %), commandes de la partenaire : non transmise invisible, coordonnées seulement commande ouverte,
 *     journée (recette), livreur d'une autre partenaire, code de remise (5 essais, blocage).
 *  K. Liste des mots : super-administrateur seul, valeurs bornées, motif.
 *  L. Migration rejouable ; fonctions fermées à anon et authenticated.
 */
import '../helpers/env';
import { after, before, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { NextRequest } from 'next/server';
import { assertLot12aInvariants } from '../helpers/lot12a-invariants';
import { openConcurrentClient } from '../helpers/db';
import { BASE_URL } from './helpers';
import { newAdmin, type TestAdmin } from './notif-helpers';
import { POST as productsPost } from '../../app/api/partner/products/route';
import { GET as productGet, PATCH as productPatch, DELETE as productDelete } from '../../app/api/partner/products/[id]/route';
import { POST as productStatus } from '../../app/api/partner/products/[id]/status/route';
import { POST as optionPost } from '../../app/api/partner/products/[id]/options/route';
import { PATCH as optionPatch } from '../../app/api/partner/products/[id]/options/[optionId]/route';
import { POST as zonePost, PUT as zonesPut } from '../../app/api/partner/venues/[id]/zones/route';
import { PATCH as zonePatch, DELETE as zoneDelete } from '../../app/api/partner/venues/[id]/zones/[zoneId]/route';
import { PATCH as venueOrdersPatch } from '../../app/api/partner/venues/[id]/orders/route';
import { GET as catalogGet } from '../../app/api/partner/catalog/route';
import { GET as dayGet } from '../../app/api/partner/orders/day/route';
import { GET as partnerOrdersGet } from '../../app/api/partner/orders/route';
import { GET as partnerOrderGet } from '../../app/api/partner/orders/[id]/route';
import { POST as regulationPost } from '../../app/api/admin/products/[id]/regulation/route';
import { GET as reviewGet } from '../../app/api/admin/products/review/route';
import { PUT as keywordsPut } from '../../app/api/admin/products/keywords/route';
import { GET as settingsGet } from '../../app/api/admin/finance-settings/route';
import {
    addCourier, codeOf, itemsOf, n, newBuyer, newPartner, newProduct, newShop, openOrdersService, order, orderBody, orderRpc, outboxOf,
    partnerAct, payOrder, placed, releaseUnpaid, service, setPortions, startOrderPay, superadminId, toReady, userClient, type Buyer, type Row,
    type TestPartner,
} from './l12a-helpers';

let restore: () => Promise<void>;
let partner: TestPartner;
let other: TestPartner;
let client: Buyer;
let reviewer: TestAdmin;
let shop: string;
let otherShop: string;

before(async () => {
    restore = await openOrdersService();
    partner = await newPartner('l12c');
    other = await newPartner('l12c-autre');
    client = await newBuyer('l12c-client');
    reviewer = await newAdmin('l12c-verif', ['partners.validate']);
    shop = await newShop(partner, { depositAllowed: true, payOnHandover: true });
    otherShop = await newShop(other);
});

beforeEach(async () => {
    if (client) await releaseUnpaid(client.userId);
});

after(async () => {
    await restore();
    await assertLot12aInvariants('l12c-catalogue');
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
async function sql<T extends Row = Row>(text: string, values: unknown[] = []): Promise<T[]> {
    const c = await openConcurrentClient({ applicationName: 'ev-test-l12c-sql' });
    try {
        const { rows } = await c.query<T>(text, values);
        await c.commit();
        return rows;
    } finally {
        await c.close();
    }
}
async function rpc(fn: string, p: Row): Promise<Row> {
    const { data, error } = await service.rpc(fn, { p });
    assert.equal(error, null, `${fn} : ${error?.message}`);
    return data as Row;
}
async function quote(body: Row): Promise<Row> {
    const { orderInput } = await import('../../lib/orders/booking');
    return rpc('order_quote', orderInput(client.userId, body));
}
async function createProduct(owner: Buyer, body: Row): Promise<Reply> {
    return reply(await productsPost(req('/api/partner/products', 'POST', owner.accessToken, body)));
}
async function product(id: string): Promise<Row> {
    const { data, error } = await service.from('products').select('*').eq('id', id).maybeSingle();
    assert.equal(error, null, error?.message);
    return (data ?? {}) as Row;
}
async function saved(owner: Buyer, fields: Row, productId: string | null = null): Promise<Row> {
    return rpc('order_product_save', { actor_id: owner.userId, product_id: productId, fields });
}
async function suspend<T>(who: TestPartner, fn: () => Promise<T>): Promise<T> {
    const { error } = await service.from('partners').update({ status: 'SUSPENDU' }).eq('id', who.partnerId);
    assert.equal(error, null, error?.message);
    try {
        return await fn();
    } finally {
        await service.from('partners').update({ status: 'VALIDE' }).eq('id', who.partnerId);
    }
}

describe('A. « à vérifier » posé par la base', () => {
    test('mot de la liste dans le nom : état posé, administrateurs prévenus, devis et création refusés', async () => {
        const r = await createProduct(partner, { venue_id: shop, name: 'Bière Gazelle 65 cl', price: 1_500 });
        assert.equal(r.status, 201, JSON.stringify(r.body));
        const p = r.body.product as Row;
        assert.deepEqual([p.review_state, p.review_words], ['A_VERIFIER', ['bière']]);
        const { data: box } = await service.from('notification_outbox').select('type, channel')
            .eq('recipient_user_id', reviewer.userId).eq('type', 'ADMIN_PRODUCT_REVIEW').eq('template_data->>product_id', String(p.id));
        assert.deepEqual((box ?? []).map((b) => String(b.channel)).sort(), ['EMAIL', 'IN_APP'], 'administrateur partners.validate prévenu (cloche, email)');
        const q = await quote(orderBody(shop, [{ productId: String(p.id), quantity: 1 }]));
        assert.deepEqual([q.ok, q.code], [false, 'PRODUCT_UNDER_REVIEW'], JSON.stringify(q));
        assert.match(String(q.message), /en cours de vérification/);
        const c = await orderRpc(client, orderBody(shop, [{ productId: String(p.id), quantity: 1 }]));
        assert.deepEqual([c.ok, c.code], [false, 'PRODUCT_UNDER_REVIEW']);
    });

    test('comparaison sans accents ni majuscules, mot entier ou pluriel ; description comprise ; « vinaigrette », « gingembre » non', async () => {
        const cases: Array<[Row, string[]]> = [
            [{ name: 'BIERES fraîches' }, ['bière']],
            [{ name: 'Vin de palme' }, ['vin']],
            [{ name: 'Salade, vinaigrette maison' }, []],
            [{ name: 'Jus de gingembre' }, []],
            [{ name: 'Thé à la menthe', description: 'Servi avec un doigt de WHISKY' }, ['whisky']],
            [{ name: 'Sans l’alcool' }, ['alcool']],
            [{ name: 'Chicha et cigarettes' }, ['cigarette', 'chicha']],
        ];
        const got: Array<[string, unknown, unknown]> = [];
        for (const [fields] of cases) {
            const r = await saved(partner, { venue_id: shop, price: 1_000, ...fields });
            assert.equal(r.ok, true, JSON.stringify(r));
            const p = r.product as Row;
            got.push([String(fields.name), p.review_state ?? null, p.review_words ?? null]);
        }
        console.log(`[L12C-A] ${JSON.stringify(got)}`);
        assert.deepEqual(got.map(([, , w]) => w ?? []), cases.map(([, w]) => w));
        assert.deepEqual(got.map(([, s]) => s), cases.map(([, w]) => (w.length ? 'A_VERIFIER' : null)));
    });
});

describe('B. contournements refusés', () => {
    test('nom changé sans le mot, statut changé, champ interdit, écriture directe : l’état reste ; supplément « bière » : à vérifier', async () => {
        const created = await createProduct(partner, { venue_id: shop, name: 'Vin rouge du Sine', price: 6_000 });
        const id = String((created.body.product as Row).id);
        const renamed = await reply(await productPatch(req(`/api/partner/products/${id}`, 'PATCH', partner.accessToken, { name: 'Jus rouge du Sine' }), params({ id })));
        assert.equal(renamed.status, 200, JSON.stringify(renamed.body));
        const forged = await reply(await productPatch(req(`/api/partner/products/${id}`, 'PATCH', partner.accessToken, { review_state: null }), params({ id })));
        assert.deepEqual([forged.status, forged.body.code], [400, 'FIELD_NOT_EDITABLE']);
        for (const status of ['INDISPONIBLE', 'DISPONIBLE']) {
            const s = await reply(await productStatus(req(`/api/partner/products/${id}/status`, 'POST', partner.accessToken, { status }), params({ id })));
            assert.equal(s.status, 200, JSON.stringify(s.body));
        }
        const { error: direct } = await service.from('products').update({ review_state: null, review_words: null, review_requested_at: null }).eq('id', id);
        assert.ok(direct, 'écriture directe de l’état « à vérifier » acceptée');
        const { error: archive } = await service.from('products').update({ archived_at: new Date().toISOString() }).eq('id', id);
        assert.ok(archive, 'archivage par écriture directe accepté');
        const p = await product(id);
        assert.deepEqual([p.name, p.review_state, p.archived_at], ['Jus rouge du Sine', 'A_VERIFIER', null]);

        const clean = await createProduct(partner, { venue_id: shop, name: 'Thiéboudienne', price: 4_500 });
        const cleanId = String((clean.body.product as Row).id);
        assert.equal((clean.body.product as Row).review_state, null);
        assert.equal((await quote(orderBody(shop, [{ productId: cleanId, quantity: 1 }]))).ok, true);
        const opt = await reply(await optionPost(req(`/api/partner/products/${cleanId}/options`, 'POST', partner.accessToken, { name: 'Bière en plus', price: 1_000 }), params({ id: cleanId })));
        assert.deepEqual([opt.status, opt.body.reviewRequested], [201, true], JSON.stringify(opt.body));
        assert.equal((await product(cleanId)).review_state, 'A_VERIFIER');
        assert.equal((await quote(orderBody(shop, [{ productId: cleanId, quantity: 1 }]))).code, 'PRODUCT_UNDER_REVIEW');

        const later = await createProduct(partner, { venue_id: shop, name: 'Yassa poulet', price: 3_500 });
        const laterId = String((later.body.product as Row).id);
        await reply(await productPatch(req(`/api/partner/products/${laterId}`, 'PATCH', partner.accessToken, { description: 'Avec un verre de vin offert' }), params({ id: laterId })));
        assert.deepEqual([(await product(laterId)).review_state, (await product(laterId)).review_words], ['A_VERIFIER', ['vin']], 'mot ajouté par une modification');
    });
});

describe('C. décision de l’administration', () => {
    test('droit partners.validate exigé ; « autoriser » efface l’état (vendable) ; « refuser » le garde réglementé ; partenaire prévenue', async () => {
        const id = String(((await createProduct(partner, { venue_id: shop, name: 'Bière sans alcool', price: 1_200 })).body.product as Row).id);
        const nobody = await newAdmin('l12c-sans-droit', ['events.read']);
        const forbidden = await reply(await regulationPost(req(`/api/admin/products/${id}/regulation`, 'POST', nobody.accessToken, { regulated: false, reason: 'Sans alcool' }), params({ id })));
        assert.equal(forbidden.status, 403, JSON.stringify(forbidden.body));
        const noReason = await reply(await regulationPost(req(`/api/admin/products/${id}/regulation`, 'POST', reviewer.accessToken, { regulated: false, reason: '' }), params({ id })));
        assert.deepEqual([noReason.status, noReason.body.code], [400, 'REASON_REQUIRED']);
        const queue = await reply(await reviewGet(req('/api/admin/products/review', 'GET', reviewer.accessToken)));
        assert.equal(queue.status, 200, JSON.stringify(queue.body));
        assert.ok((queue.body.queue as Row[]).some((x) => x.id === id && (x.words as string[]).includes('bière')), 'produit dans la file, mots trouvés');
        const ok = await reply(await regulationPost(req(`/api/admin/products/${id}/regulation`, 'POST', reviewer.accessToken, { regulated: false, reason: 'Boisson sans alcool vérifiée' }), params({ id })));
        assert.equal(ok.status, 200, JSON.stringify(ok.body));
        const p = await product(id);
        assert.deepEqual([p.review_state, p.review_words, p.regulated_admin], [null, null, false]);
        assert.equal((await quote(orderBody(shop, [{ productId: id, quantity: 2 }]))).ok, true, 'vendable après « autoriser »');
        const { data: told } = await service.from('notification_outbox').select('channel, template_data')
            .eq('recipient_user_id', partner.userId).eq('type', 'PRODUCT_REVIEW_DECIDED').eq('template_data->>product_id', id);
        assert.deepEqual((told ?? []).map((t) => String(t.channel)).sort(), ['EMAIL', 'IN_APP', 'PUSH']);
        assert.equal(String(((told ?? [])[0]?.template_data as Row).decision), 'AUTORISE');
        const history = await reply(await reviewGet(req('/api/admin/products/review', 'GET', reviewer.accessToken)));
        assert.ok((history.body.history as Row[]).some((h) => h.productId === id && h.decision === 'AUTORISE'), 'décision dans l’historique');

        const beer = String(((await createProduct(partner, { venue_id: shop, name: 'Bière blonde', price: 1_500 })).body.product as Row).id);
        const refused = await reply(await regulationPost(req(`/api/admin/products/${beer}/regulation`, 'POST', reviewer.accessToken, { regulated: true, reason: 'Boisson alcoolisée' }), params({ id: beer })));
        assert.equal(refused.status, 200);
        const q = await quote(orderBody(shop, [{ productId: beer, quantity: 1 }]));
        assert.equal(q.code, 'REGULATED_PRODUCT', 'refusé à la vente : réglementé, jamais vendu');
        const renamed = await reply(await productPatch(req(`/api/partner/products/${beer}`, 'PATCH', partner.accessToken, { name: 'Boisson blonde' }), params({ id: beer })));
        assert.equal(renamed.status, 200);
        assert.equal((await quote(orderBody(shop, [{ productId: beer, quantity: 1 }]))).code, 'REGULATED_PRODUCT', 'un nouveau nom ne lève pas un refus');
    });
});

describe('D. produit devenu « à vérifier » après la commande', () => {
    test('commande payable à la remise : acceptation refusée et client remboursé ; commande à payer : paiement refusé', async () => {
        const bissap = String(((await createProduct(partner, { venue_id: shop, name: 'Jus de bissap', price: 1_000 })).body.product as Row).id);
        const id = await placed(client, orderBody(shop, [{ productId: bissap, quantity: 1 }], { mode: 'SUR_PLACE', onsiteLabel: 'Table 3', payment: 'DIFFERE' }));
        assert.equal((await order(id)).order_state, 'RECUE');
        await reply(await productPatch(req(`/api/partner/products/${bissap}`, 'PATCH', partner.accessToken, { name: 'Jus de bissap et bière' }), params({ id: bissap })));
        const acc = await partnerAct(partner, id, { action: 'ACCEPTER' });
        assert.deepEqual([acc.status, acc.body.code], [409, 'REGULATED_ORDER_REFUSED'], JSON.stringify(acc.body));
        assert.equal((await order(id)).order_state, 'REFUSEE');

        const ginger = String(((await createProduct(partner, { venue_id: shop, name: 'Jus de gingembre', price: 1_000 })).body.product as Row).id);
        const toPay = await placed(client, orderBody(shop, [{ productId: ginger, quantity: 2 }]));
        assert.equal((await order(toPay)).order_state, 'EN_ATTENTE_PAIEMENT');
        await reply(await optionPost(req(`/api/partner/products/${ginger}/options`, 'POST', partner.accessToken, { name: 'Rhum', price: 500 }), params({ id: ginger })));
        const pay = await startOrderPay(client, toPay);
        assert.notEqual(pay.status, 201, `paiement d'une commande dont un produit est à vérifier : ${JSON.stringify(pay.body)}`);
    });
});

describe('E. prix, stock, réglementé, établissement', () => {
    test('prix et stock entiers bornés ; sorte exigée ; établissement d’une autre refusé ; établissement jamais changé ; produit d’une autre : 404', async () => {
        for (const price of [2_500.5, 10_000_001, -1]) {
            const r = await createProduct(partner, { venue_id: shop, name: 'Prix faux', price });
            assert.deepEqual([r.status, r.body.code], [400, 'INVALID_INPUT'], `prix ${price} : ${JSON.stringify(r.body)}`);
        }
        assert.equal((await saved(partner, { venue_id: shop, name: 'Prix direct', price: 2.5 })).code, 'INVALID_PRICE');
        assert.equal((await saved(partner, { venue_id: shop, name: 'Stock faux', price: 100, stock_quantity: -3 })).code, 'INVALID_INPUT');
        const noKind = await createProduct(partner, { venue_id: shop, name: 'Boisson forte', price: 3_000, is_regulated: true });
        assert.deepEqual([noKind.status, noKind.body.code], [400, 'REGULATED_KIND_REQUIRED']);
        const regulated = await createProduct(partner, { venue_id: shop, name: 'Boisson forte', price: 3_000, is_regulated: true, regulated_kind: 'ALCOOL' });
        assert.equal(regulated.status, 201);
        assert.equal((await quote(orderBody(shop, [{ productId: String((regulated.body.product as Row).id), quantity: 1 }]))).code, 'REGULATED_PRODUCT');

        const foreignVenue = await createProduct(partner, { venue_id: otherShop, name: 'Plat ailleurs', price: 1_000 });
        assert.deepEqual([foreignVenue.status, foreignVenue.body.code], [404, 'VENUE_NOT_FOUND']);
        const id = String(((await createProduct(partner, { venue_id: shop, name: 'Mafé', price: 3_000 })).body.product as Row).id);
        const move = await reply(await productPatch(req(`/api/partner/products/${id}`, 'PATCH', partner.accessToken, { venue_id: otherShop }), params({ id })));
        assert.deepEqual([move.status, move.body.code], [400, 'FIELD_NOT_EDITABLE']);
        assert.equal((await saved(partner, { venue_id: otherShop }, id)).code, 'VENUE_LOCKED');
        assert.equal((await product(id)).venue_id, shop);
        for (const call of [
            () => productGet(req(`/api/partner/products/${id}`, 'GET', other.accessToken), params({ id })),
            () => productPatch(req(`/api/partner/products/${id}`, 'PATCH', other.accessToken, { price: 1 }), params({ id })),
            () => productDelete(req(`/api/partner/products/${id}`, 'DELETE', other.accessToken), params({ id })),
        ]) {
            assert.equal((await reply(await call())).status, 404);
        }
        assert.equal(n((await product(id)).price), 3_000);
    });
});

describe('F. fiche SUSPENDU : lecture seule', () => {
    test('routes refusées (PARTNER_SUSPENDED), fonctions en base refusées, catalogue lisible', async () => {
        const id = String(((await createProduct(partner, { venue_id: shop, name: 'Pastels', price: 1_000 })).body.product as Row).id);
        const results = await suspend(partner, async () => ({
            create: await createProduct(partner, { venue_id: shop, name: 'Accras', price: 1_000 }),
            option: await reply(await optionPost(req(`/api/partner/products/${id}/options`, 'POST', partner.accessToken, { name: 'Sauce', price: 0 }), params({ id }))),
            zone: await reply(await zonePost(req(`/api/partner/venues/${shop}/zones`, 'POST', partner.accessToken, { name: 'Mermoz', fee: 1_000, minOrder: 0 }), params({ id: shop }))),
            save: await saved(partner, { name: 'Pastels au thon' }, id),
            zoneRpc: await rpc('order_delivery_zone_set', { actor_id: partner.userId, venue_id: shop, name: 'Mermoz', fee: 1_000, min_order: 0 }),
            optionRpc: await rpc('product_option_set', { actor_id: partner.userId, product_id: id, name: 'Sauce', price: 0 }),
            remove: await rpc('order_product_remove', { actor_id: partner.userId, product_id: id }),
            catalog: await reply(await catalogGet(req('/api/partner/catalog', 'GET', partner.accessToken))),
            day: await reply(await dayGet(req('/api/partner/orders/day', 'GET', partner.accessToken))),
        }));
        for (const k of ['create', 'option', 'zone'] as const) {
            assert.deepEqual([results[k].status, results[k].body.code], [403, 'PARTNER_SUSPENDED'], `${k} : ${JSON.stringify(results[k].body)}`);
        }
        for (const k of ['save', 'zoneRpc', 'optionRpc', 'remove'] as const) assert.equal(results[k].code, 'PARTNER_SUSPENDED', `${k} : ${JSON.stringify(results[k])}`);
        assert.equal(results.catalog.status, 200);
        assert.equal(results.catalog.body.partnerStatus, 'SUSPENDU');
        assert.deepEqual([results.day.status, results.day.body.partnerStatus], [200, 'SUSPENDU'], 'journée lisible, bandeau de lecture seule');
        assert.equal((await product(id)).name, 'Pastels');
    });
});

describe('G. retrait d’un produit', () => {
    test('jamais vendu : supprimé (suppléments, portions) ; vendu : archivé, hors de la carte, du devis et des listes', async () => {
        const fresh = String(((await createProduct(partner, { venue_id: shop, name: 'Ceebu yapp du jour', price: 3_000, is_daily_special: true })).body.product as Row).id);
        await reply(await optionPost(req(`/api/partner/products/${fresh}/options`, 'POST', partner.accessToken, { name: 'Piment', price: 0 }), params({ id: fresh })));
        assert.equal((await setPortions(partner, fresh, 20)).ok, true);
        const del = await reply(await productDelete(req(`/api/partner/products/${fresh}`, 'DELETE', partner.accessToken), params({ id: fresh })));
        assert.deepEqual([del.status, del.body.outcome], [200, 'DELETED'], JSON.stringify(del.body));
        assert.deepEqual(await sql('SELECT (SELECT count(*) FROM public.products WHERE id = $1)::int AS p, (SELECT count(*) FROM public.product_options WHERE product_id = $1)::int AS o, (SELECT count(*) FROM public.product_daily_portions WHERE product_id = $1)::int AS d', [fresh]), [{ p: 0, o: 0, d: 0 }]);

        const sold = String(((await createProduct(partner, { venue_id: shop, name: 'Dibi agneau', price: 5_000 })).body.product as Row).id);
        const orderId = await placed(client, orderBody(shop, [{ productId: sold, quantity: 1 }], { mode: 'SUR_PLACE', onsiteLabel: 'Comptoir', payment: 'DIFFERE' }));
        const arch = await reply(await productDelete(req(`/api/partner/products/${sold}`, 'DELETE', partner.accessToken), params({ id: sold })));
        assert.deepEqual([arch.status, arch.body.outcome], [200, 'ARCHIVED'], JSON.stringify(arch.body));
        assert.match(String(arch.body.message), /archivé/);
        assert.ok((await product(sold)).archived_at, 'archivé');
        assert.equal((await itemsOf(orderId)).length, 1, 'ligne de commande gardée');
        assert.equal((await quote(orderBody(shop, [{ productId: sold, quantity: 1 }]))).code, 'PRODUCT_UNAVAILABLE');
        const catalog = await reply(await catalogGet(req('/api/partner/catalog', 'GET', partner.accessToken)));
        assert.ok(!(catalog.body.products as Row[]).some((p) => p.id === sold), 'produit archivé encore au catalogue');
        assert.equal((await reply(await productGet(req(`/api/partner/products/${sold}`, 'GET', partner.accessToken), params({ id: sold })))).status, 404);
        const edit = await reply(await productPatch(req(`/api/partner/products/${sold}`, 'PATCH', partner.accessToken, { price: 1 }), params({ id: sold })));
        assert.deepEqual([edit.status, edit.body.code], [409, 'PRODUCT_ARCHIVED']);
        await partnerAct(partner, orderId, { action: 'REFUSER', reason: 'Fin du test du lot 12c' });
    });
});

describe('H. suppléments', () => {
    test('prix entiers bornés, 20 au plus, produit d’une autre refusé ; le prix figé d’une ligne ne change pas', async () => {
        const dish = String(((await createProduct(partner, { venue_id: shop, name: 'Burger maison', price: 4_000 })).body.product as Row).id);
        for (const price of [1_000_001, -1, 2.5, 'beaucoup']) {
            const r = await reply(await optionPost(req(`/api/partner/products/${dish}/options`, 'POST', partner.accessToken, { name: 'Frites', price }), params({ id: dish })));
            assert.equal(r.status, 400, `supplément à ${String(price)} : ${JSON.stringify(r.body)}`);
        }
        const foreign = await newProduct(other, otherShop, { price: 1_000 });
        const theirs = await reply(await optionPost(req(`/api/partner/products/${foreign}/options`, 'POST', partner.accessToken, { name: 'Frites', price: 300 }), params({ id: foreign })));
        assert.deepEqual([theirs.status, theirs.body.code], [404, 'PRODUCT_NOT_FOUND']);
        const fries = await reply(await optionPost(req(`/api/partner/products/${dish}/options`, 'POST', partner.accessToken, { name: 'Frites', price: 300 }), params({ id: dish })));
        assert.equal(fries.status, 201);
        const friesId = String((fries.body.option as Row).id);
        const id = await placed(client, orderBody(shop, [{ productId: dish, quantity: 2, optionIds: [friesId] }], { mode: 'SUR_PLACE', onsiteLabel: 'Table 9', payment: 'DIFFERE' }));
        const before = (await itemsOf(id))[0];
        assert.deepEqual([n(before.unit_price), n(before.total_price)], [4_300, 8_600]);
        const changed = await reply(await optionPatch(req(`/api/partner/products/${dish}/options/${friesId}`, 'PATCH', partner.accessToken, { price: 900 }), params({ id: dish, optionId: friesId })));
        assert.equal(changed.status, 200, JSON.stringify(changed.body));
        const after = (await itemsOf(id))[0];
        assert.deepEqual([n(after.unit_price), n(after.total_price), (after.options as Row[])[0].price], [4_300, 8_600, 300], 'prix figé sur la ligne');
        const q = await quote(orderBody(shop, [{ productId: dish, quantity: 1, optionIds: [friesId] }], { mode: 'SUR_PLACE', onsiteLabel: 'Table 9' }));
        assert.equal(n(q.items_amount), 4_900, 'nouveau prix pour une nouvelle commande');
        for (let i = 1; i < 20; i += 1) assert.equal((await rpc('product_option_set', { actor_id: partner.userId, product_id: dish, name: `Sauce ${i}`, price: 0 })).ok, true);
        const tooMany = await reply(await optionPost(req(`/api/partner/products/${dish}/options`, 'POST', partner.accessToken, { name: 'Sauce de trop', price: 0 }), params({ id: dish })));
        assert.deepEqual([tooMany.status, tooMany.body.code], [429, 'TOO_MANY_OPTIONS']);
        await partnerAct(partner, id, { action: 'REFUSER', reason: 'Fin du test du lot 12c' });
    });
});

describe('I. zones de livraison', () => {
    test('bornes, établissement d’une autre, nom unique ; frais et minimum appliqués ; frais figés ; retrait selon les commandes ; ordre', async () => {
        const venue = await newShop(partner, { modes: ['LIVRAISON', 'RETRAIT'], payOnHandover: true });
        const bad: Array<[Row, string]> = [
            [{ name: 'A', fee: 1_000, minOrder: 0 }, 'INVALID_ZONE'], [{ name: 'Fann', fee: 100_001, minOrder: 0 }, 'INVALID_FEE'],
            [{ name: 'Fann', fee: 2.5, minOrder: 0 }, 'INVALID_FEE'], [{ name: 'Fann', fee: 1_000, minOrder: 10_000_001 }, 'INVALID_MINIMUM'],
            [{ name: 'Fann', fee: -5, minOrder: 0 }, 'INVALID_FEE'],
        ];
        for (const [body, code] of bad) {
            const r = await reply(await zonePost(req(`/api/partner/venues/${venue}/zones`, 'POST', partner.accessToken, body), params({ id: venue })));
            assert.deepEqual([r.status, r.body.code], [400, code], JSON.stringify(body));
        }
        const theirs = await reply(await zonePost(req(`/api/partner/venues/${otherShop}/zones`, 'POST', partner.accessToken, { name: 'Fann', fee: 1_000, minOrder: 0 }), params({ id: otherShop })));
        assert.deepEqual([theirs.status, theirs.body.code], [404, 'VENUE_NOT_FOUND']);
        const fann = await reply(await zonePost(req(`/api/partner/venues/${venue}/zones`, 'POST', partner.accessToken, { name: 'Fann', fee: 1_500, minOrder: 10_000 }), params({ id: venue })));
        assert.equal(fann.status, 201, JSON.stringify(fann.body));
        const fannId = String((fann.body.zone as Row).id);
        const twin = await reply(await zonePost(req(`/api/partner/venues/${venue}/zones`, 'POST', partner.accessToken, { name: 'fann', fee: 0, minOrder: 0 }), params({ id: venue })));
        assert.deepEqual([twin.status, twin.body.code], [409, 'ZONE_EXISTS']);

        const dish = await newProduct(partner, venue, { price: 5_000 });
        const delivery = (qty: number, extra: Row = {}) => orderBody(venue, [{ productId: dish, quantity: qty }], { mode: 'LIVRAISON', zoneId: fannId, address: 'Rue 10, Fann Résidence', phone: client.phone9, ...extra });
        assert.equal((await quote(delivery(1))).code, 'BELOW_MINIMUM');
        const q = await quote(delivery(2));
        assert.deepEqual([n(q.items_amount), n(q.delivery_fee), n(q.goods_total)], [10_000, 1_500, 11_500]);

        const openOrder = await placed(client, delivery(2, { payment: 'DIFFERE' }));
        assert.equal(n((await order(openOrder)).delivery_fee), 1_500);
        await reply(await zonePatch(req(`/api/partner/venues/${venue}/zones/${fannId}`, 'PATCH', partner.accessToken, { fee: 2_000 }), params({ id: venue, zoneId: fannId })));
        assert.equal(n((await order(openOrder)).delivery_fee), 1_500, 'frais figés sur la commande');
        assert.equal(n((await quote(delivery(2))).delivery_fee), 2_000);
        const off = await reply(await zoneDelete(req(`/api/partner/venues/${venue}/zones/${fannId}`, 'DELETE', partner.accessToken), params({ id: venue, zoneId: fannId })));
        assert.deepEqual([off.status, off.body.outcome], [200, 'DEACTIVATED'], JSON.stringify(off.body));
        assert.deepEqual(await sql('SELECT is_active, archived_at IS NULL AS visible FROM public.order_delivery_zones WHERE id = $1', [fannId]), [{ is_active: false, visible: true }]);
        assert.equal((await quote(delivery(2))).code, 'ZONE_NOT_FOUND', 'zone désactivée : plus proposée');
        await partnerAct(partner, openOrder, { action: 'REFUSER', reason: 'Fin du test du lot 12c' });
        const archived = await reply(await zoneDelete(req(`/api/partner/venues/${venue}/zones/${fannId}`, 'DELETE', partner.accessToken), params({ id: venue, zoneId: fannId })));
        assert.deepEqual([archived.status, archived.body.outcome], [200, 'ARCHIVED'], JSON.stringify(archived.body));

        const ids: string[] = [];
        for (const name of ['Mermoz', 'Ouakam', 'Ngor']) {
            const z = await reply(await zonePost(req(`/api/partner/venues/${venue}/zones`, 'POST', partner.accessToken, { name, fee: 1_000, minOrder: 0 }), params({ id: venue })));
            ids.push(String((z.body.zone as Row).id));
        }
        const unused = await reply(await zoneDelete(req(`/api/partner/venues/${venue}/zones/${ids[2]}`, 'DELETE', partner.accessToken), params({ id: venue, zoneId: ids[2] })));
        assert.equal(unused.body.outcome, 'DELETED');
        const reorder = await reply(await zonesPut(req(`/api/partner/venues/${venue}/zones`, 'PUT', partner.accessToken, { zoneIds: [ids[1], ids[0]] }), params({ id: venue })));
        assert.equal(reorder.status, 200, JSON.stringify(reorder.body));
        const order2 = await sql<{ id: string }>('SELECT id FROM public.order_delivery_zones WHERE venue_id = $1 AND archived_at IS NULL ORDER BY sort_order', [venue]);
        assert.deepEqual(order2.map((r) => r.id), [ids[1], ids[0]]);
        const partial = await reply(await zonesPut(req(`/api/partner/venues/${venue}/zones`, 'PUT', partner.accessToken, { zoneIds: [ids[0]] }), params({ id: venue })));
        assert.deepEqual([partial.status, partial.body.code], [409, 'INVALID_ORDER']);
        const catalog = await reply(await catalogGet(req('/api/partner/catalog', 'GET', partner.accessToken)));
        const zones = ((catalog.body.venues as Row[]).find((v) => v.id === venue)?.zones ?? []) as Row[];
        assert.deepEqual(zones.map((z) => z.name), ['Ouakam', 'Mermoz'], 'zone archivée cachée, ordre suivi');
    });
});

describe('J. acompte, commandes de la partenaire', () => {
    test('acompte de 10 à 90 % ; part en ligne calculée en base', async () => {
        for (const depositPercent of [5, 95, 33.5]) {
            const r = await reply(await venueOrdersPatch(req(`/api/partner/venues/${shop}/orders`, 'PATCH', partner.accessToken, { depositAllowed: true, depositPercent }), params({ id: shop })));
            assert.equal(r.status, 400, `acompte ${depositPercent} : ${JSON.stringify(r.body)}`);
        }
        const ok = await reply(await venueOrdersPatch(req(`/api/partner/venues/${shop}/orders`, 'PATCH', partner.accessToken, { depositAllowed: true, depositPercent: 40 }), params({ id: shop })));
        assert.equal(ok.status, 200, JSON.stringify(ok.body));
        const dish = await newProduct(partner, shop, { price: 10_000 });
        const q = await quote(orderBody(shop, [{ productId: dish, quantity: 1 }], { payment: 'ACOMPTE' }));
        assert.deepEqual([n(q.first_goods), n(q.balance_due)], [4_000, 6_000]);
    });

    test('commande non transmise invisible ; coordonnées seulement pendant la commande ouverte ; journée ; livreur d’une autre refusé', async () => {
        const dish = await newProduct(partner, shop, { price: 2_500 });
        const unpaid = await placed(client, orderBody(shop, [{ productId: dish, quantity: 1 }]));
        const list = await reply(await partnerOrdersGet(req('/api/partner/orders', 'GET', partner.accessToken)));
        assert.ok(!(list.body.orders as Row[]).some((o) => o.id === unpaid), 'commande non payée visible de la partenaire');
        assert.equal((await reply(await partnerOrderGet(req(`/api/partner/orders/${unpaid}`, 'GET', partner.accessToken), params({ id: unpaid })))).status, 404);
        await releaseUnpaid(client.userId);

        const dayBefore = (await reply(await dayGet(req('/api/partner/orders/day', 'GET', partner.accessToken)))).body.day as Row;
        const id = await placed(client, orderBody(shop, [{ productId: dish, quantity: 2 }], { mode: 'SUR_PLACE', onsiteLabel: 'Table 1', payment: 'DIFFERE', phone: client.phone9 }));
        const open = await reply(await partnerOrderGet(req(`/api/partner/orders/${id}`, 'GET', partner.accessToken), params({ id })));
        assert.equal(((open.body.order as Row).contact as Row | undefined)?.phone, client.phoneE164, 'téléphone pendant la commande ouverte');
        const foreignCourier = await newBuyer('l12c-livreur-autre');
        await addCourier(other, foreignCourier);
        for (const body of [{ action: 'ACCEPTER' }, { action: 'PRETE' }, { action: 'REMETTRE', balanceReceived: true }]) {
            const r = await partnerAct(partner, id, body);
            assert.equal(r.status, 200, `${body.action} : ${JSON.stringify(r.body)}`);
        }
        const closed = await reply(await partnerOrderGet(req(`/api/partner/orders/${id}`, 'GET', partner.accessToken), params({ id })));
        assert.deepEqual([(closed.body.order as Row).contact ?? null, (closed.body.order as Row).contactHidden], [null, true], 'coordonnées après la fin');
        const closedList = await reply(await partnerOrdersGet(req('/api/partner/orders?filter=closed', 'GET', partner.accessToken)));
        const inList = (closedList.body.orders as Row[]).find((o) => o.id === id);
        assert.ok(inList && !('contact' in inList), 'coordonnées dans la liste des terminées');
        const day = (await reply(await dayGet(req('/api/partner/orders/day', 'GET', partner.accessToken)))).body.day as Row;
        assert.deepEqual([n(day.handedToday) - n(dayBefore.handedToday), n(day.revenueToday) - n(dayBefore.revenueToday), n(day.onsiteToday) - n(dayBefore.onsiteToday)], [1, 5_000, 5_000]);

        const delivery = await newShop(partner, { modes: ['LIVRAISON'], payOnHandover: true });
        const created = await rpc('order_delivery_zone_set', { actor_id: partner.userId, venue_id: delivery, name: 'Point E', fee: 500, min_order: 0 });
        assert.equal(created.ok, true, JSON.stringify(created));
        const zone = String((created.zone as Row).id);
        const meal = await newProduct(partner, delivery, { price: 3_000 });
        const toDeliver = await placed(client, orderBody(delivery, [{ productId: meal, quantity: 1 }], { mode: 'LIVRAISON', zoneId: zone, address: 'Villa 2, Point E', phone: client.phone9, payment: 'DIFFERE' }));
        assert.equal((await partnerAct(partner, toDeliver, { action: 'ACCEPTER' })).status, 200);
        const confier = await partnerAct(partner, toDeliver, { action: 'CONFIER', courierId: foreignCourier.userId });
        assert.deepEqual([confier.status, confier.body.code], [404, 'COURIER_NOT_FOUND']);
        await partnerAct(partner, toDeliver, { action: 'ANNULER', reason: 'Fin du test du lot 12c' });
    });

    test('code de remise : 5 essais, puis blocage même avec le bon code', async () => {
        const dish = await newProduct(partner, shop, { price: 2_000 });
        const id = await placed(client, orderBody(shop, [{ productId: dish, quantity: 1 }]));
        await payOrder(client, id);
        await toReady(partner, id);
        const good = await codeOf(client, id);
        const wrong = good === '0000' ? '1111' : '0000';
        const left: unknown[] = [];
        for (let i = 0; i < 5; i += 1) left.push((await partnerAct(partner, id, { action: 'REMETTRE', code: wrong })).body.attempts_left ?? 'bloqué');
        assert.deepEqual(left, [4, 3, 2, 1, 'bloqué']);
        const locked = await partnerAct(partner, id, { action: 'REMETTRE', code: good });
        assert.deepEqual([locked.status, locked.body.code], [409, 'CODE_LOCKED']);
        assert.equal((await order(id)).order_state, 'PRETE');
        await partnerAct(partner, id, { action: 'ANNULER', reason: 'Fin du test du lot 12c' });
    });
});

describe('K. liste des mots', () => {
    test('super-administrateur seul, valeurs bornées, motif exigé ; un mot ajouté s’applique aux produits suivants', async () => {
        const superadmin = await superadminId();
        const { data: before } = await service.from('platform_settings').select('value').eq('key', 'orders.review_keywords').single();
        const original = (before!.value as { value: string[] }).value;
        try {
            const sa = await newAdmin('l12c-super', [], { role: 'SUPERADMIN' });
            const generic = await reply(await settingsGet(req('/api/admin/finance-settings', 'GET', sa.accessToken)));
            assert.equal(generic.status, 200, JSON.stringify(generic.body).slice(0, 300));
            assert.ok(!(generic.body.settings as Row[]).some((s) => s.key === 'orders.review_keywords'), 'liste des mots sur la page générique des réglages');
            const notSuper = await reply(await keywordsPut(req('/api/admin/products/keywords', 'PUT', reviewer.accessToken, { keywords: ['bière'], reason: 'Essai' })));
            assert.equal(notSuper.status, 403, JSON.stringify(notSuper.body));
            const set = async (value: unknown, actor = superadmin, reason = 'Essai du lot 12c'): Promise<Row> => {
                const { data, error } = await service.rpc('order_review_keywords_set', { p_value: { value }, p_actor: actor, p_reason: reason });
                assert.equal(error, null, error?.message);
                return data as Row;
            };
            for (const value of [['a'], ['Bière', 'biere'], [], Array.from({ length: 101 }, (_, i) => `mot${i}`), [12], ['vin;rouge'], 'bière']) {
                assert.equal((await set(value)).code, 'INVALID_VALUE', JSON.stringify(value));
            }
            assert.equal((await set(['bière'], reviewer.userId)).code, 'FORBIDDEN');
            assert.equal((await set(['bière'], superadmin, '')).code, 'REASON_REQUIRED');
            assert.equal((await set([...original, 'bissap fermenté'])).ok, true);
            const p = (await saved(partner, { venue_id: shop, name: 'Bissap fermenté maison', price: 1_000 })).product as Row;
            assert.deepEqual(p.review_words, ['bissap fermenté']);
            const { data: hist } = await service.from('platform_settings_history').select('reason').eq('key', 'orders.review_keywords').order('changed_at', { ascending: false }).limit(1);
            assert.equal(String(hist?.[0]?.reason), 'Essai du lot 12c', 'motif historisé');
        } finally {
            const { error } = await service.rpc('order_review_keywords_set', { p_value: { value: original }, p_actor: superadmin, p_reason: 'Fin de l’essai du lot 12c' });
            assert.equal(error, null, error?.message);
        }
    });
});

describe('L. migration et droits', () => {
    test('migrations 20261224… rejouées : aucune erreur, réglage déjà changé gardé, droits inchangés', async () => {
        const files = readdirSync(join(process.cwd(), 'supabase', 'migrations')).filter((f) => f.startsWith('202612240')).sort();
        assert.equal(files.length, 4, files.join(', '));
        const c = await openConcurrentClient({ applicationName: 'ev-test-l12c-rejeu', statementTimeoutMs: 120_000 });
        try {
            await c.query(`UPDATE public.platform_settings SET value = '{"value": ["mot-essai"]}' WHERE key = 'orders.review_keywords'`);
            for (const f of files) await c.query(readFileSync(join(process.cwd(), 'supabase', 'migrations', f), 'utf8'));
            const { rows } = await c.query<{ value: unknown; types: number; anon: boolean; auth: boolean; svc: boolean }>(`
                SELECT (SELECT value FROM public.platform_settings WHERE key = 'orders.review_keywords') AS value,
                       (SELECT count(*)::int FROM public.notification_types WHERE type IN ('ADMIN_PRODUCT_REVIEW', 'PRODUCT_REVIEW_DECIDED')) AS types,
                       has_function_privilege('anon', 'public.order_product_save(jsonb)', 'EXECUTE') AS anon,
                       has_function_privilege('authenticated', 'public.order_delivery_zone_set(jsonb)', 'EXECUTE') AS auth,
                       has_function_privilege('service_role', 'public.order_quote_compute(jsonb)', 'EXECUTE') AS svc`);
            assert.deepEqual(rows[0], { value: { value: ['mot-essai'] }, types: 2, anon: false, auth: false, svc: true });
        } finally {
            await c.close();
        }
    });

    test('fonctions du lot fermées à anon et authenticated ; aucune écriture REST des zones ni des suppléments', async () => {
        const browser = userClient(partner.accessToken);
        for (const fn of ['order_product_save', 'order_product_remove', 'order_delivery_zone_set', 'order_delivery_zone_remove', 'order_delivery_zones_reorder',
            'product_option_set', 'product_option_remove', 'order_partner_day', 'order_review_keywords_valid']) {
            const { error } = await browser.rpc(fn, { p: { actor_id: partner.userId } });
            assert.ok(error, `${fn} exécutable par la session du navigateur`);
        }
        const { error: kw } = await browser.rpc('order_review_keywords_set', { p_value: { value: ['x'] }, p_actor: partner.userId, p_reason: 'x' });
        assert.ok(kw, 'order_review_keywords_set exécutable par la session du navigateur');
        const { error: z } = await browser.from('order_delivery_zones').insert({ venue_id: shop, name: 'Pirate', fee: 0, min_order: 0 });
        assert.ok(z, 'zone écrite par la REST');
        const anyProduct = await newProduct(partner, shop, { price: 1_000 });
        const { error: o } = await browser.from('product_options').insert({ product_id: anyProduct, name: 'Pirate', price_delta: 0 });
        assert.ok(o, 'supplément écrit par la REST');
        await browser.from('products').update({ name: 'Nom pirate' }).eq('id', anyProduct);
        assert.notEqual((await product(anyProduct)).name, 'Nom pirate', 'produit écrit par la REST');
    });
});

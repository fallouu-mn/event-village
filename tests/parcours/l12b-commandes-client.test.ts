/**
 * Lot 12b — commandes : écrans du client, côté serveur (base LOCALE, faux SamirPay, faux SMS).
 *
 *  A. Carte des plats (GET /api/restaurants/[id]/menu → order_venue_menu) : contenu (catégories, suppléments actifs, plat
 *     du jour et portions, épuisé, indisponible, réglementé affiché avec son prix et jamais commandable, zones, tables),
 *     aucun champ interne, aucune photo extérieure ; rien pour une partenaire suspendue, un établissement suspendu, non
 *     ouvert à la commande, un identifiant partiel ou inconnu, ni service fermé (404).
 *  B. REST des produits : suite à part, tests/parcours/l12b-produits-rest.test.ts.
 *  C. Code de remise visible (GET /api/orders/[id]/code) : le code du SMS, pour le client de la commande seulement (autre
 *     client, partenaire, livreur : 404) ; jamais dans une autre réponse ; sans cache ; nouveau code → le nouveau ; effacé
 *     à la remise et à la fin ; tables private fermées à la clé de service.
 *  D. Argent à la création : prix changé entre le devis et la commande, total forgé → refus ORDER_PRICE_CHANGED, rien de
 *     créé (ni commande, ni stock pris) ; double clic, deux requêtes simultanées et rejeu avec la même clé → une seule
 *     commande.
 *  E. Paiement : montant affiché faux → aucun paiement ; même clé → même paiement ; autre demande pendant l'attente →
 *     « paiement déjà en attente » ; entier puis acompte et solde jusqu'au bout (faux SamirPay et vrai webhook).
 *  F. Réglementé à chaque étape : carte (non commandable), devis, commande, paiement après une décision de
 *     l'administration.
 *  G. Mes commandes (GET /api/orders) : état détaillé, groupe, lien de suivi ; jamais payée à temps rangée à part ; rien
 *     d'un autre compte.
 */
import '../helpers/env';
import { after, before, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { NextRequest } from 'next/server';
import { assertLot12aInvariants } from '../helpers/lot12a-invariants';
import { openConcurrentClient } from '../helpers/db';
import { BASE_URL } from './helpers';
import { GET as menuGet } from '../../app/api/restaurants/[id]/menu/route';
import { POST as quoteRoute } from '../../app/api/orders/quote/route';
import { POST as createRoute } from '../../app/api/orders/create/route';
import { GET as clientOrderGet } from '../../app/api/orders/[id]/route';
import { GET as codeGet, POST as codePost } from '../../app/api/orders/[id]/code/route';
import { POST as cancelRoute } from '../../app/api/orders/[id]/cancel/route';
import { GET as ordersList } from '../../app/api/orders/route';
import { GET as partnerOrderGet } from '../../app/api/partner/orders/[id]/route';
import { GET as partnerOrdersGet } from '../../app/api/partner/orders/route';
import { GET as courierOrdersGet } from '../../app/api/courier/orders/route';
import { decideVenue, newTable } from './l11a-helpers';
import { etaLabel } from '../../lib/orders/client-view';
import {
    addCourier, codeOf, courierAct, dailySpecialWindowClosed, n, newBuyer, newDeliveryZone, newOption, newPartner, newProduct, newShop,
    openOrdersService, order, orderBody, partnerAct, payOrder, placed, platformSetting, releaseUnpaid, service, setPlatformSetting,
    setPortions, shiftOrder, startOrderPay, superadminId, toReady, type Buyer, type Row, type TestPartner,
} from './l12a-helpers';
import { deliverWebhook, providerSays } from './paiement-helpers';

let restore: () => Promise<void>;
let partner: TestPartner;
let client: Buyer;
let stranger: Buyer;
let courier: Buyer;
let shop: string;
let zone: string;

before(async () => {
    restore = await openOrdersService();
    partner = await newPartner('l12b');
    client = await newBuyer('l12b-client');
    stranger = await newBuyer('l12b-autre');
    courier = await newBuyer('l12b-livreur');
    shop = await newShop(partner, { depositAllowed: true, depositPercent: 30, payOnHandover: true });
    zone = await newDeliveryZone(shop, 1_000, 2_000, 'Plateau');
    await addCourier(partner, courier);
});

beforeEach(async () => {
    if (client) await releaseUnpaid(client.userId);
    if (stranger) await releaseUnpaid(stranger.userId);
});

after(async () => {
    await restore();
    await assertLot12aInvariants('l12b-commandes-client');
});

// ── Aides ─────────────────────────────────────────────────────────────────────────────────────────────────────────

function req(path: string, method: string, token: string | null, body?: unknown, headers: Record<string, string> = {}): NextRequest {
    const h: Record<string, string> = { 'content-type': 'application/json', ...headers };
    if (token) h.authorization = `Bearer ${token}`;
    return new NextRequest(`${BASE_URL}${path}`, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) });
}
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
async function reply(res: Response): Promise<{ status: number; body: Row; text: string; headers: Headers }> {
    const text = await res.text();
    let body: Row = {};
    try {
        body = text ? (JSON.parse(text) as Row) : {};
    } catch {
        body = { raw: text }; // corps non JSON gardé pour le message d'échec
    }
    return { status: res.status, body, text, headers: res.headers };
}
const menu = async (id: string) => reply(await menuGet(req(`/api/restaurants/${id}/menu`, 'GET', null), ctx(id)));
const quote = async (who: Buyer, body: Row) => reply(await quoteRoute(req('/api/orders/quote', 'POST', who.accessToken, body)));
const create = async (who: Buyer, body: Row, key?: string) =>
    reply(await createRoute(req('/api/orders/create', 'POST', who.accessToken, body, key ? { 'idempotency-key': key } : {})));
const revealCode = async (who: Buyer, id: string) => reply(await codeGet(req(`/api/orders/${id}/code`, 'GET', who.accessToken), ctx(id)));

async function sql<T extends Row = Row>(text: string, params: unknown[] = []): Promise<T[]> {
    const c = await openConcurrentClient({ applicationName: 'ev-test-l12b-sql' });
    try {
        const { rows } = await c.query<T>(text, params);
        await c.commit();
        return rows;
    } finally {
        await c.close();
    }
}
async function ordersOf(clientId: string): Promise<number> {
    const { count, error } = await service.from('orders').select('id', { count: 'exact', head: true }).eq('client_id', clientId).not('venue_id', 'is', null);
    assert.equal(error, null, error?.message);
    return count ?? 0;
}
async function paymentsOf(orderId: string): Promise<Row[]> {
    const { data, error } = await service.from('payments').select('id, status, amount, client_idempotency_key').eq('order_id', orderId);
    assert.equal(error, null, error?.message);
    return (data ?? []) as Row[];
}
async function setPartnerStatus(p: TestPartner, status: 'VALIDE' | 'SUSPENDU'): Promise<void> {
    const { error } = await service.from('partners').update({ status }).eq('id', p.partnerId);
    assert.equal(error, null, error?.message);
}
async function decideRegulated(productId: string, regulated: boolean): Promise<void> {
    const { data, error } = await service.rpc('order_product_regulation_decide', {
        p: { actor_id: await superadminId(), product_id: productId, regulated, reason: 'Contrôle du lot 12b' },
    });
    assert.equal(error, null, error?.message);
    assert.equal((data as Row).ok, true, JSON.stringify(data));
}
const products = (body: Row): Row[] => (((body.menu as Row)?.products ?? []) as Row[]);
const productOf = (body: Row, id: string): Row | undefined => products(body).find((p) => p.id === id);

/** Commande payée en entier, à retirer, jusqu'à « prête » : rend son identifiant et le code du SMS. */
async function readyPickup(who: Buyer = client): Promise<{ id: string; code: string }> {
    const p = await newProduct(partner, shop, { price: 2_000 });
    const id = await placed(who, orderBody(shop, [{ productId: p, quantity: 1 }]));
    await payOrder(who, id);
    await toReady(partner, id);
    return { id, code: await codeOf(who, id) };
}

// ── A. Carte des plats ────────────────────────────────────────────────────────────────────────────────────────────

describe('A. Carte des plats publique', () => {
    test('contenu servi par la base : suppléments actifs, plat du jour et portions, épuisé, indisponible, réglementé avec son prix, zones et tables', async () => {
        const { data: cat, error: catErr } = await service.from('product_categories').insert({ partner_id: partner.partnerId, name: 'Plats', sort_order: 1 }).select('id').single();
        assert.equal(catErr, null, catErr?.message);
        const dish = await newProduct(partner, shop, { price: 3_500, name: 'Yassa poulet l12b' });
        await service.from('products').update({ category_id: cat!.id, description: 'Oignons confits, citron' }).eq('id', dish);
        const sauce = await newOption(dish, 'Piment', 200);
        const hidden = await newOption(dish, 'Ancien supplément', 300);
        await service.from('product_options').update({ is_active: false }).eq('id', hidden);
        const daily = await newProduct(partner, shop, { price: 4_500, name: 'Thiéboudienne du jour l12b', daily: true });
        await setPortions(partner, daily, 12);
        const empty = await newProduct(partner, shop, { price: 1_000, name: 'Pastels l12b', stock: 0 });
        const off = await newProduct(partner, shop, { price: 1_500, name: 'Fataya l12b', status: 'INDISPONIBLE' });
        const beer = await newProduct(partner, shop, { price: 1_200, name: 'Gazelle l12b', regulated: true });
        const table = await newTable(partner, shop, 4, { number: '7' });

        const r = await menu(shop);
        assert.equal(r.status, 200, r.text);
        assert.match(r.headers.get('cache-control') ?? '', /no-store/);
        const m = r.body.menu as Row;
        assert.equal((m.venue as Row).id, shop);
        const ordering = m.ordering as Row;
        assert.deepEqual([...(ordering.modes as string[])].sort(), ['LIVRAISON', 'RETRAIT', 'SUR_PLACE']);
        assert.equal(ordering.depositPercent, 30);
        assert.equal(ordering.payOnHandover, true);
        assert.equal(ordering.asapAvailable, true, 'ouvert 24 h sur 24 : « tout de suite » possible');
        assert.ok((ordering.windows as unknown[]).length >= 1, 'fenêtres pour choisir une heure');

        const d = productOf(r.body, dish)!;
        assert.deepEqual([d.price, d.orderable, d.availability, d.categoryId, d.description], [3_500, true, 'DISPONIBLE', cat!.id, 'Oignons confits, citron']);
        assert.deepEqual((d.options as Row[]).map((o) => [o.id, o.name, o.price]), [[sauce, 'Piment', 200]], 'supplément inactif jamais servi');
        const ds = productOf(r.body, daily)!;
        if (!dailySpecialWindowClosed()) assert.deepEqual([ds.daily, ds.portionsLeft, ds.portionsTotal, ds.orderable], [true, 12, 12, true]);
        assert.deepEqual([productOf(r.body, empty)!.availability, productOf(r.body, empty)!.orderable], ['EPUISE', false], 'épuisé visible, non commandable');
        assert.deepEqual([productOf(r.body, off)!.availability, productOf(r.body, off)!.orderable], ['INDISPONIBLE', false]);
        const b = productOf(r.body, beer)!;
        assert.deepEqual([b.price, b.regulated, b.inReview, b.orderable], [1_200, true, false, false], 'réglementé : prix affiché, jamais commandable');
        assert.ok((m.zones as Row[]).some((z) => z.id === zone && z.fee === 1_000 && z.minOrder === 2_000), 'zone, frais et minimum');
        assert.ok((m.spots as Row[]).some((s) => s.id === table && s.label === '7'), 'table pour une commande sur place');
        assert.ok((m.categories as Row[]).some((c) => c.id === cat!.id && c.name === 'Plats'));
        // Aucun champ interne ni photo venue d'un site extérieur
        for (const word of ['stock_quantity', 'stockQuantity', 'regulated_admin', 'regulated_checked', 'is_regulated', 'review_words', 'partner_id', 'owner', 'unsplash', 'sold']) {
            assert.ok(!r.text.includes(word), `champ ou valeur interne servi : ${word}`);
        }
        assert.equal(d.image, null, 'produit sans photo : aucune image de remplacement');
    });

    test('rien pour une partenaire suspendue, un établissement suspendu ou non ouvert à la commande, un identifiant partiel ou inconnu, ni service fermé', async () => {
        const other = await newPartner('l12b-susp');
        const otherShop = await newShop(other);
        await newProduct(other, otherShop, { price: 1_000, name: 'Plat caché l12b' });
        const suspendedShop = await newShop(partner);
        await newProduct(partner, suspendedShop, { price: 1_000, name: 'Plat caché l12b' });
        assert.equal((await decideVenue(suspendedShop, 'SUSPENDRE', 'Contrôle d’hygiène en cours.')).ok, true);
        const closedShop = await newShop(partner, { ordersOpen: false });
        await newProduct(partner, closedShop, { price: 1_000, name: 'Plat caché l12b' });
        await setPartnerStatus(other, 'SUSPENDU');
        try {
            const out: Row = {};
            for (const [label, id] of [['partenaire suspendue', otherShop], ['établissement suspendu', suspendedShop], ['fermé à la commande', closedShop],
                ['partiel', shop.slice(0, 8)], ['inconnu', randomUUID()], ['illisible', 'rest-terrou-bi'], ['partenaire au lieu de l’établissement', partner.partnerId]] as const) {
                const r = await menu(id);
                out[label] = `${r.status}${r.text.includes('Plat caché l12b') ? ' FUITE' : ''}`;
            }
            assert.deepEqual(out, Object.fromEntries(Object.keys(out).map((k) => [k, '404'])));
        } finally {
            await setPartnerStatus(other, 'VALIDE');
        }
        const before = await platformSetting('features.orders_enabled');
        await setPlatformSetting('features.orders_enabled', false, 'test du lot 12b');
        try {
            assert.equal((await menu(shop)).status, 404, 'service fermé');
            const { data, error } = await service.rpc('order_venue_menu', { p_venue_id: shop });
            assert.equal(error, null, error?.message);
            assert.equal(data, null, 'la base ne sert rien non plus');
        } finally {
            await setPlatformSetting('features.orders_enabled', before, 'test du lot 12b');
        }
    });
});

// B. REST des produits : tests/parcours/l12b-produits-rest.test.ts (suite à part, prouvée rouge sur main)

describe('A bis. Correctifs après contre-vérification : fermeture annoncée, heure estimée servie par la base', () => {
    test('idée 9 : la carte rend la fin de la fermeture en cours (fermetures qui se suivent réunies), plus rien une fois levée', async () => {
        const closedShop = await newShop(partner);
        await newProduct(partner, closedShop, { price: 1_500, name: 'Yassa l12b-cv' });
        const rows = await sql<{ id: string; ends: string }>(`
            WITH t AS (SELECT date_trunc('hour', public.hall_dakar_now()) AS h)
            INSERT INTO public.venue_closures (venue_id, starts_at, ends_at, reason)
            SELECT $1, t.h - interval '1 hour', t.h + interval '5 hours', 'Travaux (l12b-cv)' FROM t
            UNION ALL
            SELECT $1, t.h + interval '5 hours', t.h + interval '29 hours', 'Travaux, suite (l12b-cv)' FROM t
            RETURNING id, to_char(ends_at, 'YYYY-MM-DD"T"HH24:MI') AS ends`, [closedShop]);
        try {
            const res = await menu(closedShop);
            assert.equal(res.status, 200, res.text);
            const ordering = (res.body.menu as Row).ordering as Row;
            const last = rows.map((r) => r.ends).sort().at(-1);
            console.log(`[L12B-CV] idée 9 : fermetures ${JSON.stringify(rows.map((r) => r.ends))} ; carte : closedUntil=${String(ordering.closedUntil)}, asapAvailable=${String(ordering.asapAvailable)}`);
            assert.equal(ordering.closedUntil, last, 'fin de la fermeture, la suivante comprise');
            assert.equal(ordering.asapAvailable, false);
        } finally {
            await sql('UPDATE public.venue_closures SET cancelled_at = now() WHERE id = ANY ($1::uuid[])', [rows.map((r) => r.id)]);
        }
        const after = await menu(closedShop);
        assert.equal(((after.body.menu as Row).ordering as Row).closedUntil, null, 'fermeture levée : plus d’annonce');
    });

    test('idée 10 : le devis rend l’heure prévue (« tout de suite » : maintenant + préparation), mise en mots « Prête vers … »', async () => {
        const p = await newProduct(partner, shop, { price: 2_000 });
        const q = await quote(client, orderBody(shop, [{ productId: p, quantity: 1 }]));
        assert.equal(q.status, 200, q.text);
        const at = (q.body.quote as Row).scheduledFor;
        const prep = Number((q.body.quote as Row).prepMinutes);
        const ahead = (Date.parse(String(at)) - Date.now()) / 60_000;
        console.log(`[L12B-CV] idée 10 : heure prévue ${String(at)}, préparation ${prep} min, dans ${ahead.toFixed(1)} min ; ${String(etaLabel('RETRAIT', at, new Date().toISOString().slice(0, 10)))}`);
        assert.ok(Number.isFinite(ahead) && ahead > prep - 2 && ahead < prep + 3, `heure prévue ≈ maintenant + ${prep} min`);
        assert.match(String(etaLabel('RETRAIT', at, new Date().toISOString().slice(0, 10))), /^Prête (demain )?vers \d{1,2} h/);
    });
});

// ── C. Code de remise visible ─────────────────────────────────────────────────────────────────────────────────────

describe('C. Code de remise dans la commande', () => {
    test('retrait : le code du SMS, pour le client seulement ; sans cache ; jamais dans une autre réponse ; effacé à la remise', async () => {
        const { id, code } = await readyPickup();
        const mine = await revealCode(client, id);
        assert.equal(mine.status, 200, mine.text);
        assert.equal(mine.body.code, code, 'le code affiché est celui du SMS');
        assert.match(mine.headers.get('cache-control') ?? '', /no-store/);
        assert.match(mine.headers.get('cache-control') ?? '', /private/);
        // Autre client, partenaire, livreur : introuvable
        for (const who of [stranger, partner, courier]) {
            const r = await revealCode(who, id);
            assert.equal(r.status, 404, `${who.email} : ${r.text}`);
            assert.ok(!r.text.includes(code));
        }
        // Jamais dans les autres réponses (suivi du client, fiche et liste de la partenaire)
        const codeField = new RegExp(`"(?:code|handover_code)"\\s*:\\s*"${code}"`);
        const views = [
            await reply(await clientOrderGet(req(`/api/orders/${id}`, 'GET', client.accessToken), ctx(id))),
            await reply(await partnerOrderGet(req(`/api/partner/orders/${id}`, 'GET', partner.accessToken), ctx(id))),
            await reply(await partnerOrdersGet(req('/api/partner/orders', 'GET', partner.accessToken))),
        ];
        for (const v of views) assert.doesNotMatch(v.text, codeField);
        // Ni la clé de service par l'API, ni la table chiffrée en clair
        const { data: viaApi, error: apiErr } = await service.schema('private').from('order_codes').select('*');
        assert.ok(apiErr !== null || (viaApi ?? []).length === 0, 'tables private lisibles par la clé de service');
        const [row] = await sql<{ n: number; plain: boolean }>(
            `SELECT count(*)::int AS n, bool_or(position(convert_to($2, 'UTF8') in code_enc) > 0) AS plain FROM private.order_codes WHERE order_id = $1`, [id, code]);
        assert.equal(row.n, 1, 'code gardé chiffré');
        assert.notEqual(row.plain, true, 'jamais en clair');
        // Remise : code effacé, plus affiché
        const done = await partnerAct(partner, id, { action: 'REMETTRE', code });
        assert.equal(done.status, 200, JSON.stringify(done.body));
        const [gone] = await sql<{ n: number }>(`SELECT count(*)::int AS n FROM private.order_codes WHERE order_id = $1`, [id]);
        assert.equal(gone.n, 0, 'effacé à la remise');
        const after = await revealCode(client, id);
        assert.equal(after.status, 409, after.text);
        assert.equal(after.body.code, 'NO_CODE_YET');
    });

    test('nouveau code : le nouveau s’affiche, l’ancien plus ; fin de la commande : effacé', async () => {
        const { id, code } = await readyPickup();
        const res = await reply(await codePost(req(`/api/orders/${id}/code`, 'POST', client.accessToken), ctx(id)));
        assert.equal(res.status, 200, res.text);
        const fresh = await codeOf(client, id);
        const shown = await revealCode(client, id);
        assert.equal(shown.body.code, fresh);
        if (fresh !== code) assert.notEqual(shown.body.code, code);
        // Fin par la partenaire (annulation avec motif) : code effacé
        const cancel = await partnerAct(partner, id, { action: 'ANNULER', reason: 'Rupture d’un ingrédient' });
        assert.equal(cancel.status, 200, JSON.stringify(cancel.body));
        const [gone] = await sql<{ n: number }>(`SELECT count(*)::int AS n FROM private.order_codes WHERE order_id = $1`, [id]);
        assert.equal(gone.n, 0, 'effacé à la fin');
        assert.equal((await revealCode(client, id)).status, 409);
    });

    test('livraison : visible en route pour le client, jamais pour le livreur (liste comprise)', async () => {
        const p = await newProduct(partner, shop, { price: 3_000 });
        const id = await placed(client, orderBody(shop, [{ productId: p, quantity: 1 }], { mode: 'LIVRAISON', zoneId: zone, address: 'Rue 10, Plateau', phone: client.phone9 }));
        await payOrder(client, id);
        for (const body of [{ action: 'ACCEPTER' }, { action: 'PRETE' }, { action: 'CONFIER', courierId: courier.userId }]) {
            const r = await partnerAct(partner, id, body);
            assert.equal(r.status, 200, JSON.stringify(r.body));
        }
        assert.equal((await revealCode(client, id)).status, 409, 'pas de code avant le départ');
        assert.equal((await courierAct(courier, id, { action: 'EN_ROUTE', minutes: 20 })).status, 200);
        const code = await codeOf(client, id);
        assert.equal((await revealCode(client, id)).body.code, code);
        assert.equal((await revealCode(courier, id)).status, 404);
        const list = await reply(await courierOrdersGet(req('/api/courier/orders', 'GET', courier.accessToken)));
        assert.doesNotMatch(list.text, new RegExp(`"(?:code|handover_code)"\\s*:\\s*"${code}"`));
        assert.equal((await courierAct(courier, id, { action: 'REMETTRE', code })).status, 200);
        assert.equal((await revealCode(client, id)).status, 409, 'effacé à la livraison');
    });
});

// ── D. Argent à la création ───────────────────────────────────────────────────────────────────────────────────────

describe('D. Création au prix affiché, une seule fois', () => {
    test('prix changé entre le devis et la commande : refus avec le nouveau prix, rien de créé (ni commande, ni stock pris) ; au bon prix : créée', async () => {
        const p = await newProduct(partner, shop, { price: 2_000, stock: 5 });
        const body = orderBody(shop, [{ productId: p, quantity: 2 }]);
        const q = await quote(client, body);
        assert.equal(q.status, 200, q.text);
        const shown = q.body.quote as Row;
        // 2 × 2 000 = 4 000 ; frais 5 % = 200 ; total 4 200
        assert.deepEqual([shown.goodsTotal, shown.serviceFee, shown.total, shown.toPayNow], [4_000, 200, 4_200, 4_200]);
        await service.from('products').update({ price: 2_500 }).eq('id', p);
        const before = await ordersOf(client.userId);
        const r = await create(client, { ...body, expectedTotal: shown.total, expectedToPay: shown.toPayNow }, `l12b-prix-${randomUUID()}`);
        assert.equal(r.status, 409, r.text);
        assert.equal(r.body.code, 'ORDER_PRICE_CHANGED');
        // 2 × 2 500 = 5 000 ; frais 250 ; total 5 250
        assert.equal(r.body.error, 'Le prix de votre commande a changé : 5 250 F CFA. Vérifiez avant de payer.');
        assert.deepEqual([r.body.total, r.body.toPayNow], [5_250, 5_250]);
        assert.equal(await ordersOf(client.userId), before, 'aucune commande créée');
        const { data: prod } = await service.from('products').select('stock_quantity').eq('id', p).single();
        assert.equal(prod!.stock_quantity, 5, 'aucun stock pris');
        const ok = await create(client, { ...body, expectedTotal: 5_250, expectedToPay: 5_250 }, `l12b-prix-${randomUUID()}`);
        assert.equal(ok.status, 201, ok.text);
        assert.equal(n((await order(String((ok.body.order as Row).id))).goods_total), 5_000);
    });

    test('total forgé par le navigateur : refusé, rien de créé ; un prix envoyé dans les lignes est ignoré', async () => {
        const p = await newProduct(partner, shop, { price: 3_000 });
        const before = await ordersOf(client.userId);
        const forged = await create(client, { ...orderBody(shop, [{ productId: p, quantity: 1, price: 1, unitPrice: 1 } as never]), expectedTotal: 1, expectedToPay: 1 });
        assert.equal(forged.status, 409, forged.text);
        assert.equal(await ordersOf(client.userId), before);
        const real = await create(client, { ...orderBody(shop, [{ productId: p, quantity: 1, price: 1 } as never]) });
        assert.equal(real.status, 201, real.text);
        assert.equal((real.body.order as Row).goodsTotal, 3_000, 'prix de la base, jamais celui de la requête');
    });

    test('double clic, deux requêtes simultanées et rejeu avec la même clé : une seule commande', async () => {
        const p = await newProduct(partner, shop, { price: 1_500 });
        const body = orderBody(shop, [{ productId: p, quantity: 1 }]);
        const key = `l12b-double-${randomUUID()}`;
        const before = await ordersOf(client.userId);
        const [a, b] = await Promise.all([create(client, body, key), create(client, body, key)]);
        assert.ok([a.status, b.status].every((s) => s === 200 || s === 201), `${a.text} | ${b.text}`);
        assert.equal((a.body.order as Row).id, (b.body.order as Row).id, 'même commande');
        const replay = await create(client, body, key);
        assert.equal(replay.status, 200, replay.text);
        assert.equal(replay.body.duplicate, true);
        assert.equal((replay.body.order as Row).id, (a.body.order as Row).id);
        assert.equal(await ordersOf(client.userId), before + 1, 'une seule commande');
        // Clé d'un autre compte : jamais sa commande
        const theirs = await create(stranger, body, key);
        assert.equal(theirs.status, 201, theirs.text);
        assert.notEqual((theirs.body.order as Row).id, (a.body.order as Row).id);
        // Clé illisible : refusée avant la base
        assert.equal((await create(client, body, 'x')).status, 400);
    });
});

// ── E. Paiement ───────────────────────────────────────────────────────────────────────────────────────────────────

describe('E. Paiement de la commande', () => {
    test('montant affiché faux : aucun paiement ; même clé : même paiement ; autre demande pendant l’attente : paiement déjà en attente', async () => {
        const p = await newProduct(partner, shop, { price: 4_000 });
        const id = await placed(client, orderBody(shop, [{ productId: p, quantity: 1 }]));
        // 4 000 + 200 de frais = 4 200
        const wrong = await startOrderPay(client, id, { expectedAmount: 4_000 });
        assert.equal(wrong.status, 409, JSON.stringify(wrong.body));
        assert.equal(wrong.body.code, 'ORDER_PRICE_CHANGED');
        assert.equal(wrong.body.error, 'Le montant à payer a changé : 4 200 F CFA. Vérifiez avant de payer.');
        assert.deepEqual(await paymentsOf(id), [], 'aucun paiement créé');
        const key = `l12b-pay-${randomUUID()}`;
        const pay = async (k: string | null) => {
            const { POST } = await import('../../app/api/payments/create/route');
            return reply(await POST(req('/api/payments/create', 'POST', client.accessToken,
                { targetType: 'ORDER', targetId: id, operator: 'WAVE', payerPhone: client.phone9, expectedAmount: 4_200 }, k ? { 'idempotency-key': k } : {})));
        };
        const [first, second] = await Promise.all([pay(key), pay(key)]);
        assert.ok([first.status, second.status].every((s) => s === 200 || s === 201), `${first.text} | ${second.text}`);
        const pid = first.body.payment_id ?? first.body.id;
        assert.equal(second.body.payment_id ?? second.body.id, pid, 'même paiement');
        const rows = await paymentsOf(id);
        assert.equal(rows.length, 1, 'un seul paiement');
        assert.deepEqual([n(rows[0].amount), rows[0].client_idempotency_key], [4_200, key]);
        const other = await pay(`l12b-pay-${randomUUID()}`);
        assert.equal(other.status, 409, other.text);
        assert.equal(other.body.code, 'PAYMENT_PENDING');
        assert.equal(other.body.payment_id, pid);
        assert.equal((await paymentsOf(id)).length, 1);
    });

    test('clé liée à sa commande (contre-vérification) : la même clé pour une autre commande est refusée, rien de créé pour elle', async () => {
        await releaseUnpaid(client.userId);
        const p = await newProduct(partner, shop, { price: 1_000 });
        const first = await placed(client, orderBody(shop, [{ productId: p, quantity: 1 }]));
        const second = await placed(client, orderBody(shop, [{ productId: p, quantity: 1 }]));
        const key = `l12b-lie-${randomUUID()}`;
        const pay = async (orderId: string) => {
            const { POST } = await import('../../app/api/payments/create/route');
            return reply(await POST(req('/api/payments/create', 'POST', client.accessToken,
                { targetType: 'ORDER', targetId: orderId, operator: 'WAVE', payerPhone: client.phone9, expectedAmount: 1_050 }, { 'idempotency-key': key })));
        };
        const a = await pay(first);
        assert.equal(a.status, 201, a.text);
        const b = await pay(second);
        console.log(`[L12B] clé de paiement réutilisée pour une autre commande : HTTP ${b.status} ${b.text}`);
        assert.equal(b.status, 409, b.text);
        assert.equal(b.body.code, 'IDEMPOTENCY_KEY_REUSED');
        assert.equal(b.body.error, 'Cette demande de paiement ne correspond pas à cette commande : rechargez la page et réessayez.');
        assert.equal(b.body.payment_id, undefined, 'jamais le paiement de l’autre commande');
        assert.deepEqual(await paymentsOf(second), [], 'aucun paiement pour la seconde commande');
        const again = await pay(first);
        assert.ok(again.status === 200 || again.status === 201, again.text);
        assert.equal(again.body.payment_id ?? again.body.id, a.body.payment_id ?? a.body.id, 'même commande, même clé : même paiement');
        await releaseUnpaid(client.userId);
    });

    test('acompte de 30 % puis solde : 10 000 → acompte 3 000 + 150 ; solde 7 000 + 350 ; vrai webhook ; plus rien à payer', async () => {
        const p = await newProduct(partner, shop, { price: 10_000 });
        const body = orderBody(shop, [{ productId: p, quantity: 1 }], { payment: 'ACOMPTE' });
        const q = await quote(client, body);
        const shown = q.body.quote as Row;
        assert.deepEqual([shown.goodsTotal, shown.depositPercent, shown.serviceFee, shown.toPayNow, shown.balanceDue, shown.total], [10_000, 30, 150, 3_150, 7_000, 10_150]);
        const made = await create(client, { ...body, expectedTotal: shown.total, expectedToPay: shown.toPayNow }, `l12b-acompte-${randomUUID()}`);
        assert.equal(made.status, 201, made.text);
        const id = String((made.body.order as Row).id);
        await payOrder(client, id, { expectedAmount: 3_150 });
        assert.equal((await order(id)).order_state, 'RECUE');
        assert.equal((await partnerAct(partner, id, { action: 'ACCEPTER' })).status, 200);
        const started = await startOrderPay(client, id, { part: 'SOLDE' });
        assert.equal(started.status, 201, JSON.stringify(started.body));
        assert.equal(n(started.payment!.amount), 7_350);
        providerSays(started.payment!, 'SUCCESS');
        assert.equal((await deliverWebhook(started.payment!)).status, 200);
        const o = await order(id);
        assert.deepEqual([n(o.paid_goods), n(o.balance_amount)], [10_000, 0]);
        const view = await reply(await clientOrderGet(req(`/api/orders/${id}`, 'GET', client.accessToken), ctx(id)));
        assert.equal(((view.body.order as Row).amounts as Row).balance_due, 0);
        const again = await startOrderPay(client, id, { part: 'SOLDE' });
        assert.equal(again.status, 409, JSON.stringify(again.body));
        assert.equal(again.body.code, 'ALREADY_PAID');
    });

    test('annulation avant la préparation : tout rendu, message du serveur', async () => {
        const p = await newProduct(partner, shop, { price: 2_000 });
        const id = await placed(client, orderBody(shop, [{ productId: p, quantity: 1 }]));
        await payOrder(client, id);
        const r = await reply(await cancelRoute(req(`/api/orders/${id}/cancel`, 'POST', client.accessToken), ctx(id)));
        assert.equal(r.status, 200, r.text);
        assert.equal(r.body.message, 'Commande annulée. Vous êtes remboursé de 2 100 F CFA sur votre compte de paiement.');
        assert.equal((await reply(await cancelRoute(req(`/api/orders/${id}/cancel`, 'POST', stranger.accessToken), ctx(id)))).status, 404, 'commande d’un autre compte');
    });
});

// ── F. Réglementé à chaque étape ──────────────────────────────────────────────────────────────────────────────────

describe('F. Produit réglementé', () => {
    test('carte : non commandable ; devis et commande refusés ; devenu réglementé après la commande : paiement refusé', async () => {
        const beer = await newProduct(partner, shop, { price: 1_200, regulated: true });
        assert.equal(productOf((await menu(shop)).body, beer)!.orderable, false);
        const q = await quote(client, orderBody(shop, [{ productId: beer, quantity: 1 }]));
        assert.equal(q.status, 400, q.text);
        assert.equal(q.body.code, 'REGULATED_PRODUCT');
        const before = await ordersOf(client.userId);
        const c = await create(client, orderBody(shop, [{ productId: beer, quantity: 1 }]), `l12b-regl-${randomUUID()}`);
        assert.equal(c.status, 400, c.text);
        assert.equal(await ordersOf(client.userId), before);
        // Décision de l'administration après la commande
        const juice = await newProduct(partner, shop, { price: 1_000, name: 'Boisson à vérifier l12b' });
        const id = await placed(client, orderBody(shop, [{ productId: juice, quantity: 1 }]));
        await decideRegulated(juice, true);
        const m = productOf((await menu(shop)).body, juice)!;
        assert.deepEqual([m.regulated, m.orderable, m.price], [true, false, 1_000], 'décision de l’administration : non commandable, prix gardé');
        const pay = await startOrderPay(client, id, { expectedAmount: 1_050 });
        assert.equal(pay.status, 400, JSON.stringify(pay.body));
        assert.equal(pay.body.code, 'REGULATED_PRODUCT');
        assert.deepEqual(await paymentsOf(id), []);
    });
});

// ── G. Mes commandes ──────────────────────────────────────────────────────────────────────────────────────────────

describe('G. Mes commandes', () => {
    test('état détaillé, groupe et lien de suivi ; jamais payée à temps rangée à part ; rien d’un autre compte', async () => {
        const p = await newProduct(partner, shop, { price: 2_000 });
        const open = await placed(client, orderBody(shop, [{ productId: p, quantity: 2 }]));
        const late = await placed(client, orderBody(shop, [{ productId: p, quantity: 1 }]));
        await shiftOrder(late, { hold_expires_at: -1 });
        const theirs = await placed(stranger, orderBody(shop, [{ productId: p, quantity: 1 }]));
        const r = await reply(await ordersList(req('/api/orders', 'GET', client.accessToken)));
        assert.equal(r.status, 200, r.text);
        const list = r.body.orders as Row[];
        const o = list.find((x) => x.id === open)!;
        assert.deepEqual([o.type, o.status, o.statusLabel, o.group, o.detailsUrl, o.venueId, o.itemCount], ['FOOD_ORDER', 'EN_ATTENTE_PAIEMENT', 'En attente de paiement', 'EN_COURS', `/orders/${open}`, shop, 2]);
        assert.equal(list.find((x) => x.id === late)!.group, 'NON_PAYEE');
        assert.ok(!r.text.includes(theirs), 'commande d’un autre compte');
        // Suivi d'une commande d'un autre compte : introuvable
        assert.equal((await reply(await clientOrderGet(req(`/api/orders/${theirs}`, 'GET', client.accessToken), ctx(theirs)))).status, 404);
    });
});

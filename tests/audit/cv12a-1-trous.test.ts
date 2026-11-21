/**
 * Contre-vérification du lot 12a (commandes : argent et sécurité) — trous trouvés à la lecture du code, un test par trou.
 * VERT = attaque bloquée ; ROUGE = trou (docs/audit-lot12a.md, avec la sortie brute du run). Branche lot12a/cv-rouges,
 * jamais fusionnée. Base LOCALE, faux SamirPay et faux SMS. La mise en place (comptes, établissements, produits, décision
 * de l'administration, horloge) passe par les aides du lot ; chaque ATTAQUE passe par une route serveur avec le jeton de
 * l'attaquant, ou par la REST avec la clé anon et ce jeton ; jamais par la clé de service.
 *
 *  T1 Commande jamais payée (annulée par le client avant le paiement, ou échue) : listée et lisible par la partenaire,
 *     avec l'adresse et le téléphone du client (order_partner_list, order_view « PARTNER » : seul EN_ATTENTE_PAIEMENT est
 *     exclu).
 *  T2 Solde payé en ligne sans le contrôle d'une commande payable (order_payment_create et order_payment_confirm, part
 *     SOLDE : order_payable_refusal jamais appelé) : produit devenu réglementé, fiche de la partenaire suspendue.
 *  T3 Même produit répété sur plusieurs lignes : « 1 à 99 » contrôlé par ligne seulement ; 297 portions du plat du jour
 *     tenues par une seule commande non payée.
 *  T4 Invitation d'un livreur : le prénom du titulaire de n'importe quel numéro rendu à la partenaire.
 *  T5 Tableau de bord et métriques de la partenaire : commandes jamais payées listées (lecture directe par le rôle de
 *     service).
 *  T6 Nouveau code de remise demandé avec le service fermé (POST /api/orders/[id]/code sans interrupteur) : SMS envoyé.
 *  T7 Aides internes (code en clair, clôture, remise, stock, historique) appelables en RPC par la clé de service :
 *     contournent les contrôles d'acteur et d'état des fonctions publiques (contrôle du catalogue, aucune attaque).
 *  T2d Commande payable à la remise dont un produit devient réglementé : acceptée et remise (contrôle au seul paiement).
 *  T8 GET /api/partner/products/[id] (route de l'ancien code, gardée) : produit non publié d'une autre partenaire lu.
 *  T9 Envoi immédiat du code : un seul journal par commande (clé ORDER_HANDOVER_CODE:<commande>, ON CONFLICT DO NOTHING) ;
 *     les nouveaux codes envoyés ensuite ne laissent aucune trace.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { BASE_URL } from '../parcours/helpers';
import { openConcurrentClient } from '../helpers/db';
import { deliverWebhook, paymentById, providerSays } from '../parcours/paiement-helpers';
import { GET as partnerOrdersGet } from '../../app/api/partner/orders/route';
import { GET as partnerOrderGet } from '../../app/api/partner/orders/[id]/route';
import { POST as clientCancelRoute } from '../../app/api/orders/[id]/cancel/route';
import { POST as clientCodeRoute } from '../../app/api/orders/[id]/code/route';
import { POST as couriersPost } from '../../app/api/partner/couriers/route';
import { GET as partnerMetricsGet } from '../../app/api/partner/metrics/route';
import { GET as partnerDashboardGet } from '../../app/api/partner/dashboard/route';
import { GET as partnerProductGet } from '../../app/api/partner/products/[id]/route';
import {
    n, newBuyer, newDeliveryZone, newPartner, newProduct, newShop, openOrdersService, order, orderBody, orderRoute, partnerAct,
    payOrder, placed, releaseUnpaid, service, setPlatformSetting, setPortions, shiftOrder, smsOfOrder, startOrderPay, superadminId,
    toReady, type Buyer, type Row, type TestPartner,
} from '../parcours/l12a-helpers';

let restore: () => Promise<void>;
let partner: TestPartner;
let shop: string;
let zone: string;
const buyers: Buyer[] = [];

async function buyer(label: string, opts: { firstName?: string } = {}): Promise<Buyer> {
    const b = await newBuyer(`cv12a-${label}`, opts);
    buyers.push(b);
    return b;
}

before(async () => {
    restore = await openOrdersService();
    partner = await newPartner('cv12a');
    shop = await newShop(partner, { depositAllowed: true, payOnHandover: true });
    zone = await newDeliveryZone(shop, 1_000, 0);
});

after(async () => {
    for (const b of buyers) await releaseUnpaid(b.userId);
    await restore();
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
    const c = await openConcurrentClient({ applicationName: 'ev-test-cv12a' });
    try {
        const { rows } = await c.query<T>(text, params);
        await c.commit();
        return rows;
    } finally {
        await c.close();
    }
}

/** Décision de l'administration (mise en place) : produit réglementé. */
async function regulate(productId: string): Promise<void> {
    const { data, error } = await service.rpc('order_product_regulation_decide', {
        p: { actor_id: await superadminId(), product_id: productId, regulated: true, reason: 'Bière : produit réglementé' },
    });
    assert.equal(error, null, error?.message);
    assert.equal((data as Row).ok, true, JSON.stringify(data));
}

/** Commande avec acompte, acompte payé, acceptée par la partenaire (solde à payer). */
async function acceptedDeposit(owner: TestPartner, venue: string, client: Buyer, productId: string): Promise<string> {
    const id = await placed(client, orderBody(venue, [{ productId, quantity: 1 }], { payment: 'ACOMPTE' }));
    await payOrder(client, id);
    const acc = await partnerAct(owner, id, { action: 'ACCEPTER' });
    assert.equal(acc.status, 200, `ACCEPTER : ${JSON.stringify(acc.body)}`);
    const o = await order(id);
    assert.equal(o.order_state, 'ACCEPTEE');
    assert.ok(n(o.paid_goods) > 0 && n(o.paid_goods) < n(o.goods_total), `acompte payé, solde dû : ${o.paid_goods}/${o.goods_total}`);
    return id;
}

describe('cv12a — trous', () => {
    test('T1 — commande jamais payée (annulée avant paiement, puis échue) : ni listée ni lisible par la partenaire, ni son adresse ni son téléphone', async () => {
        const client = await buyer('t1');
        const p = await newProduct(partner, shop, { price: 4_000 });
        const delivery = { mode: 'LIVRAISON', zoneId: zone, address: 'Villa 7, cité Keur Gorgui', phone: client.phone9 };
        const cancelled = await placed(client, orderBody(shop, [{ productId: p, quantity: 1 }], delivery));
        const res = await reply(await clientCancelRoute(req(`/api/orders/${cancelled}/cancel`, 'POST', client.accessToken), ctx(cancelled)));
        assert.equal(res.status, 200, JSON.stringify(res.body));
        const expired = await placed(client, orderBody(shop, [{ productId: p, quantity: 1 }], delivery));
        await shiftOrder(expired, { hold_expires_at: -1 });
        const { error } = await service.rpc('order_expire_hold', { p_order_id: expired });
        assert.equal(error, null, error?.message);
        const [a, b] = [await order(cancelled), await order(expired)];
        assert.deepEqual([a.order_state, n(a.paid_goods), b.order_state, n(b.paid_goods)], ['ANNULEE_CLIENT', 0, 'EXPIREE', 0], 'jamais payées');

        const leaks: string[] = [];
        for (const filter of ['open', 'closed']) {
            const list = await reply(await partnerOrdersGet(req(`/api/partner/orders?filter=${filter}`, 'GET', partner.accessToken)));
            assert.equal(list.status, 200, JSON.stringify(list.body));
            for (const o of (list.body.orders as Row[] | undefined) ?? []) {
                if (o.id === cancelled || o.id === expired) leaks.push(`liste ${filter} : ${JSON.stringify({ id: o.id, state: o.state, contact: o.contact })}`);
            }
        }
        for (const id of [cancelled, expired]) {
            const one = await reply(await partnerOrderGet(req(`/api/partner/orders/${id}`, 'GET', partner.accessToken), ctx(id)));
            const seen = one.body.order as Row | undefined;
            if (one.status !== 404) leaks.push(`GET /api/partner/orders/${id} : HTTP ${one.status} ${JSON.stringify({ state: seen?.state, contact: seen?.contact })}`);
        }
        assert.deepEqual(leaks, [], `commandes jamais payées vues par la partenaire : ${leaks.join(' | ')}`);
    });

    test('T2a — solde en ligne refusé quand un produit de la commande est devenu réglementé (décision de l’administration après l’acompte)', async () => {
        const client = await buyer('t2a');
        const beer = await newProduct(partner, shop, { price: 10_000, name: 'Bière locale' });
        const id = await acceptedDeposit(partner, shop, client, beer);
        await regulate(beer);
        const solde = await startOrderPay(client, id, { part: 'SOLDE' });
        assert.notEqual(solde.status, 201,
            `solde d'une commande au produit réglementé ouvert au paiement en ligne : HTTP ${solde.status} ${JSON.stringify({ amount: solde.payment?.amount, facial: solde.payment?.facial_amount, status: solde.payment?.status })}`);
    });

    test('T2b — solde en ligne refusé quand la fiche de la partenaire est suspendue (comme la première part)', async () => {
        const client = await buyer('t2b');
        const sus = await newPartner('cv12a-suspendue');
        const susShop = await newShop(sus, { depositAllowed: true });
        const dish = await newProduct(sus, susShop, { price: 8_000 });
        const id = await acceptedDeposit(sus, susShop, client, dish);
        const { error } = await service.from('partners').update({ status: 'SUSPENDU' }).eq('id', sus.partnerId);
        assert.equal(error, null, error?.message);
        let solde: Awaited<ReturnType<typeof startOrderPay>>;
        try {
            solde = await startOrderPay(client, id, { part: 'SOLDE' });
        } finally {
            await service.from('partners').update({ status: 'VALIDE' }).eq('id', sus.partnerId);
        }
        assert.notEqual(solde.status, 201,
            `solde payé en ligne à une partenaire suspendue : HTTP ${solde.status} ${JSON.stringify({ amount: solde.payment?.amount, status: solde.payment?.status })}`);
    });

    test('T2c — solde confirmé après que le produit est devenu réglementé : remboursé, jamais compté (comme la première part)', async () => {
        const client = await buyer('t2c');
        const beer = await newProduct(partner, shop, { price: 12_000, name: 'Vin de palme' });
        const id = await acceptedDeposit(partner, shop, client, beer);
        const before = await order(id);
        const started = await startOrderPay(client, id, { part: 'SOLDE' });
        assert.equal(started.status, 201, `paiement du solde : ${JSON.stringify(started.body)}`);
        await regulate(beer);
        providerSays(started.payment!, 'SUCCESS');
        const hook = await deliverWebhook(started.payment!);
        assert.equal(hook.status, 200, `webhook : HTTP ${hook.status}`);
        const after = await order(id);
        const pay = await paymentById(started.payment!.id);
        assert.ok(n(after.paid_goods) === n(before.paid_goods) && pay.status !== 'SUCCESS',
            `solde d'un produit devenu réglementé encaissé : paid_goods ${before.paid_goods} → ${after.paid_goods} sur ${after.goods_total}, paiement ${pay.status}, payment_status ${after.payment_status}`);
    });

    test('T2d — commande payable à la remise dont un produit devient réglementé : la partenaire ne peut plus l’accepter ni la remettre', async () => {
        const client = await buyer('t2d');
        const beer = await newProduct(partner, shop, { price: 7_000, name: 'Bière blonde' });
        const id = await placed(client, orderBody(shop, [{ productId: beer, quantity: 1 }], { mode: 'SUR_PLACE', onsiteLabel: 'Table 4', payment: 'DIFFERE' }));
        assert.equal((await order(id)).order_state, 'RECUE', 'payable à la remise : reçue tout de suite');
        await regulate(beer);
        const acc = await partnerAct(partner, id, { action: 'ACCEPTER' });
        const steps = [`ACCEPTER ${acc.status} ${String(acc.body.code ?? (acc.body.order as Row | undefined)?.state)}`];
        if (acc.status === 200) {
            for (const body of [{ action: 'PRETE' }, { action: 'REMETTRE', balanceReceived: true }]) {
                const r = await partnerAct(partner, id, body);
                steps.push(`${body.action} ${r.status} ${String(r.body.code ?? (r.body.order as Row | undefined)?.state)}`);
            }
        }
        const o = await order(id);
        assert.notEqual(acc.status, 200,
            `produit réglementé accepté puis remis par la plateforme : ${steps.join(' → ')} ; état final ${o.order_state}, noté sur place ${o.onsite_amount}`);
    });

    test('T3 — même produit sur plusieurs lignes : plus de 99 unités refusées (pas 297 portions du plat du jour tenues sans payer)', async () => {
        const hoarder = await buyer('t3');
        const dish = await newProduct(partner, shop, { price: 1_500, daily: true, name: 'Yassa du jour' });
        const set = await setPortions(partner, dish, 300);
        assert.equal(set.ok, true, JSON.stringify(set));
        const r = await orderRoute(hoarder, orderBody(shop, [1, 2, 3].map(() => ({ productId: dish, quantity: 99 }))));
        const [row] = await sql<{ portions: number; sold: number }>(
            'SELECT portions, sold FROM public.product_daily_portions WHERE product_id = $1 AND day = (now() AT TIME ZONE \'Africa/Dakar\')::date', [dish]);
        assert.notEqual(r.status, 201,
            `3 lignes × 99 du même plat acceptées : ${row?.sold}/${row?.portions} portions tenues par une commande non payée (HTTP ${r.status}, état ${String((r.body.order as Row | undefined)?.state)})`);
    });

    test('T4 — invitation d’un livreur : le prénom d’un compte quelconque n’est pas rendu à la partenaire à partir de son seul numéro', async () => {
        const target = await buyer('t4', { firstName: 'Ndeye-Sokhna' });
        const res = await reply(await couriersPost(req('/api/partner/couriers', 'POST', partner.accessToken, { phone: target.phone9 })));
        const shown = (res.body.invitation as Row | undefined)?.firstName;
        assert.ok(shown === undefined || shown === null,
            `prénom du titulaire du numéro rendu à la partenaire avant tout accord : HTTP ${res.status} ${JSON.stringify(res.body)}`);
    });

    test('T5 — tableau de bord et métriques de la partenaire : aucune commande jamais payée', async () => {
        const client = await buyer('t5');
        const fresh = await newPartner('cv12a-tableau');
        const freshShop = await newShop(fresh);
        const p = await newProduct(fresh, freshShop, { price: 3_000 });
        const unpaid = await placed(client, orderBody(freshShop, [{ productId: p, quantity: 1 }]));
        assert.equal((await order(unpaid)).order_state, 'EN_ATTENTE_PAIEMENT');
        const seen: string[] = [];
        const metrics = await reply(await partnerMetricsGet(req('/api/partner/metrics', 'GET', fresh.accessToken)));
        assert.equal(metrics.status, 200, JSON.stringify(metrics.body));
        const listed = ((metrics.body.recentOrders as Row[] | undefined) ?? []).filter((o) => o.id === unpaid);
        if (listed.length) seen.push(`GET /api/partner/metrics recentOrders : ${JSON.stringify(listed)}`);
        // Tableau de bord : même lecture (partner-dashboard.service.ts) ; une panne sans rapport n'est pas comptée comme le trou
        const dash = await reply(await partnerDashboardGet(req('/api/partner/dashboard', 'GET', fresh.accessToken)));
        if (dash.status !== 200) console.log(`[cv12a T5] tableau de bord HTTP ${dash.status} : ${JSON.stringify(dash.body).slice(0, 200)}`);
        else if (JSON.stringify(dash.body).includes(unpaid)) seen.push('GET /api/partner/dashboard : commande non payée dans recentOrders');
        assert.deepEqual(seen, [], `commande jamais payée montrée à la partenaire : ${seen.join(' | ')}`);
    });

    test('T6 — service des commandes fermé : POST /api/orders/[id]/code répond 404, aucun SMS', async () => {
        const client = await buyer('t6');
        const p = await newProduct(partner, shop, { price: 2_500 });
        const id = await placed(client, orderBody(shop, [{ productId: p, quantity: 1 }]));
        await payOrder(client, id);
        await toReady(partner, id);
        const before = (await smsOfOrder(client, id)).length;
        await setPlatformSetting('features.orders_enabled', false, 'contre-vérification du lot 12a');
        let res: { status: number; body: Row };
        try {
            res = await reply(await clientCodeRoute(req(`/api/orders/${id}/code`, 'POST', client.accessToken), ctx(id)));
        } finally {
            await setPlatformSetting('features.orders_enabled', true, 'contre-vérification du lot 12a');
        }
        const afterCount = (await smsOfOrder(client, id)).length;
        assert.equal(res.status, 404, `service fermé, nouveau code envoyé quand même : HTTP ${res.status} ${JSON.stringify(res.body)} ; SMS de la commande ${before} → ${afterCount}`);
    });

    test('T8 — GET /api/partner/products/[id] : le produit non publié d’une autre partenaire n’est pas lisible', async () => {
        const rival = await newPartner('cv12a-rivale');
        const rivalShop = await newShop(rival);
        const secret = await newProduct(rival, rivalShop, { price: 9_900, name: 'Plat en préparation (non publié)', status: 'INDISPONIBLE', stock: 42 });
        const res = await reply(await partnerProductGet(req(`/api/partner/products/${secret}`, 'GET', partner.accessToken), ctx(secret)));
        const p = res.body.product as Row | undefined;
        assert.equal(res.status, 404,
            `produit non publié d'une autre partenaire lu : HTTP ${res.status} ${JSON.stringify(p ? { id: p.id, partner_id: p.partner_id, name: p.name, status: p.status, stock_quantity: p.stock_quantity, price: p.price } : res.body)}`);
    });

    test('T9 — chaque SMS de code de remise est journalisé (code de retrait, puis nouveau code demandé par le client)', async () => {
        const client = await buyer('t9');
        const p = await newProduct(partner, shop, { price: 3_500 });
        const id = await placed(client, orderBody(shop, [{ productId: p, quantity: 1 }]));
        await payOrder(client, id);
        await toReady(partner, id);
        const resend = await reply(await clientCodeRoute(req(`/api/orders/${id}/code`, 'POST', client.accessToken), ctx(id)));
        assert.equal(resend.status, 200, JSON.stringify(resend.body));
        const sent = (await smsOfOrder(client, id)).filter((m) => /code/i.test(m) && /\b\d{4}\b/.test(m.replace(/CMD-\S+/g, '')));
        assert.equal(sent.length, 2, `SMS de code reçus : ${JSON.stringify(sent)}`);
        const { data: journal, error } = await service.from('notification_outbox')
            .select('idempotency_key, status, created_at').eq('type', 'ORDER_HANDOVER_CODE').eq('recipient_user_id', client.userId);
        assert.equal(error, null, error?.message);
        assert.equal((journal ?? []).length, sent.length,
            `${sent.length} SMS de code envoyés, ${(journal ?? []).length} ligne(s) au journal : ${JSON.stringify(journal)}`);
    });

    test('T7 — aides internes des commandes non appelables en RPC par la clé de service (contrôle du catalogue)', async () => {
        const internal = ['order_issue_code', 'order_code_hash', 'order_code_delivery', 'order_close_apply', 'order_handover_apply',
            'order_set_en_route', 'order_release_stock', 'order_log_state', 'order_refund_payment'];
        const rows = await sql<{ fn: string; service: boolean }>(
            `SELECT p.oid::regprocedure::text AS fn, has_function_privilege('service_role', p.oid, 'EXECUTE') AS service
               FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace AND p.proname = ANY($1::text[]) ORDER BY 1`, [internal]);
        const open = rows.filter((r) => r.service).map((r) => r.fn);
        assert.deepEqual(open, [],
            `exécutables par service_role, donc appelables par POST /rest/v1/rpc/… avec la clé de service, sans contrôle d'acteur ni d'état : ${open.join(', ')}`);
    });
});

/**
 * Lot 8, tâche 8.0 — canaux de vente par catégorie (contrat, sections 3.1 à 3.4, 4.1 et 4.3 ; décisions L5 à L14).
 *  - sale_online (vendue en ligne) est la source de vérité, is_visible en reste le miroir écrit par trigger ;
 *    sale_counter (vendue au guichet) est indépendante ;
 *  - en ligne : contrôle dans ticket_sale_problems, donc sous verrou dans checkout_create_payment et
 *    free_tickets_claim : `SALE_CHECK_FAILED` + problème `CATEGORY_NOT_SOLD_ONLINE`, panier mixte refusé en entier ;
 *  - guichet : `CATEGORY_NOT_SOLD_AT_COUNTER`, HTTP 409, à la vente comme au devis ; le rejeu d'une vente déjà
 *    faite passe avant ce contrôle ;
 *  - instantané à la vente : stock_reservations.sale_online_at_checkout puis tickets.sale_decision (jsonb
 *    immuable, illisible par anon et authenticated) : un paiement en cours pendant une coupure est honoré (L8) ;
 *  - lecteurs : GET du guichet (`on_site_only`), page publique et catalogue, pilotage, RLS, public_category_stock.
 *
 * Chaque test appelle l'API ou la RPC réelle sur un événement neuf : un canal est coupé par UPDATE en
 * service_role après la création (L15, helpers inchangés). Le comptage des appels SamirPay se fait par
 * numéro de payeur neuf, jamais globalement.
 *
 * Rouge avant correctif : la migration 20261106000001 n'existe pas. Le contrôle de schéma, premier geste de
 * chaque test (saleEvent), échoue en nommant chaque colonne, trigger et fonction absents, sans erreur Postgres
 * brute. Sans ce contrôle, les cas restent faux pour la bonne raison : ticket_sale_problems répond
 * CATEGORY_NOT_VISIBLE, counter_sale et counter_sale_quote vendent une catégorie sans filtre de canal,
 * le GET du guichet filtre sur is_active seul (app/api/controller/counter-sale/route.ts:38-39).
 *
 * after() : assertRecetteInvariants exige aussi M3 (payment_duplicate_of) et M4 (uncapped_amount) ; il reste
 * donc rouge après fix(8.0s) tant que fix(8.2a) et fix(8.2c) ne sont pas livrés. Le contrôle de schéma des
 * tests, lui, ne porte que sur M1.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { inspect } from '../helpers/db';
import { assertRecetteInvariants, missingRecetteSchema } from '../helpers/recette-invariants';
import { cart, categoryState, checkout, eventTickets, initCalls, newBuyer, paymentsOf, service, type Buyer, type CategorySpec, type SaleEvent } from './paiement-helpers';
import { buyConfirmed, jsonRequest, newPartner, type TestPartner } from './finance-helpers';
import { authed, createTimedEvent, newController, openShift, shiftRow, type RouteResult } from './acces-helpers';
import { findItem, invoke, listAt, pilotageOk, routeHandler, show } from './pilotage-helpers';

type Row = Record<string, unknown>;
type Items = Array<[string, number]>;

const M1 = '20261106000001';
const COUNTER_ROUTE = '../../app/api/controller/counter-sale/route';
const QUOTE_ROUTE = '../../app/api/controller/counter-sale/quote/route';

/** Spécification d'une catégorie : canaux coupés APRÈS la création (L15). */
type Spec = CategorySpec & { online?: boolean; counter?: boolean };

let partner: TestPartner;

before(async () => {
    partner = await newPartner('canaux');
});

after(async () => {
    await assertRecetteInvariants('canaux-vente');
});

// ── Schéma ─────────────────────────────────────────────────────────────────

let schemaChecked = false;

/** Objets de M1 absents, nommés (colonnes et triggers de l'instantané par l'aide commune, le reste ici). */
async function missingM1(): Promise<string[]> {
    const common = (await missingRecetteSchema()).filter((m) => m.includes(M1));
    const local = await inspect(async (db) => {
        const wantedTriggers = [['trg_ticket_categories_channels', 'ticket_categories'], ['trg_tickets_sale_decision_guard', 'tickets']];
        const t = await db.query<{ name: string }>(
            `SELECT c.relname || '.' || tg.tgname AS name FROM pg_trigger tg
               JOIN pg_class c ON c.oid = tg.tgrelid JOIN pg_namespace n ON n.oid = c.relnamespace
              WHERE n.nspname = 'public' AND NOT tg.tgisinternal`);
        const triggers = new Set(t.rows.map((r) => r.name));
        const f = await db.query<{ proname: string }>(
            `SELECT p.proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
              WHERE n.nspname = 'public' AND p.proname = 'ticket_counter_channel_problems'`);
        return [
            ...wantedTriggers.filter(([name, table]) => !triggers.has(`${table}.${name}`)).map(([name, table]) => `trigger ${name} absent de public.${table} — contrat 2.4, migration ${M1}`),
            ...(f.rows.length === 0 ? [`fonction public.ticket_counter_channel_problems absente — contrat 2.2, migration ${M1}`] : []),
        ];
    });
    return [...common, ...local];
}

async function assertChannelsSchema(): Promise<void> {
    if (schemaChecked) return;
    const missing = await missingM1();
    assert.deepEqual(missing, [], `schéma des canaux de vente incomplet (migration ${M1}) :\n${missing.join('\n')}`);
    schemaChecked = true;
}

// ── Mise en place ──────────────────────────────────────────────────────────

/** Coupe ou rouvre un canal, en service_role, et relit la catégorie. */
async function setChannels(categoryId: string, patch: { sale_online?: boolean; sale_counter?: boolean; is_visible?: boolean }): Promise<Row> {
    const { data, error } = await service.from('ticket_categories').update(patch).eq('id', categoryId)
        .select('id, is_visible, sale_online, sale_counter').single();
    assert.equal(error, null, `réglage des canaux de ${categoryId} : ${error?.message}`);
    return data as Row;
}

/** Événement neuf du partenaire de la suite, dans la fenêtre de scan (vendable en ligne et au guichet). */
async function saleEvent(label: string, specs: Spec[], opts: { status?: string } = {}): Promise<SaleEvent> {
    await assertChannelsSchema();
    const ev = await createTimedEvent(partner.partnerId, `canaux ${label}`, specs.map(({ online: _online, counter: _counter, ...spec }) => spec), opts);
    for (const s of specs) {
        const patch: { sale_online?: boolean; sale_counter?: boolean } = {};
        if (s.online === false) patch.sale_online = false;
        if (s.counter === false) patch.sale_counter = false;
        if (Object.keys(patch).length > 0) await setChannels(ev.categories[s.name].id, patch);
    }
    return ev;
}

interface CashDesk { seller: Buyer; shiftId: string }

/** Contrôleur affecté avec la permission espèces et sa caisse ouverte. */
async function cashDesk(ev: SaleEvent, label: string): Promise<CashDesk> {
    const seller = await newController(partner, ev.eventId, { canAcceptCash: true, label: `canaux-${label}` });
    const res = await openShift(seller, ev.eventId);
    assert.equal(res.status, 200, `ouverture de la caisse : ${show(res)}`);
    const { data, error } = await service.from('controller_shifts').select('id')
        .eq('controller_id', seller.userId).eq('event_id', ev.eventId).eq('status', 'OUVERT');
    assert.equal(error, null, `caisse du vendeur : ${error?.message}`);
    assert.equal((data ?? []).length, 1, 'une caisse OUVERT pour le vendeur');
    return { seller, shiftId: String(data![0].id) };
}

// ── Appels ─────────────────────────────────────────────────────────────────

async function rpc(name: string, args: Row): Promise<Row> {
    const { data, error } = await service.rpc(name, args);
    assert.equal(error, null, `${name} : ${error?.message}`);
    assert.ok(data !== null && typeof data === 'object', `${name} : réponse inattendue ${JSON.stringify(data)}`);
    return data as Row;
}

function rpcItems(ev: SaleEvent, items: Items): Array<{ category_id: string; quantity: number }> {
    return items.map(([name, quantity]) => ({ category_id: ev.categories[name].id, quantity }));
}

function routeItems(ev: SaleEvent, items: Items): Array<{ categoryId: string; quantity: number }> {
    return items.map(([name, quantity]) => ({ categoryId: ev.categories[name].id, quantity }));
}

/** Paramètres de checkout_create_payment, comme lib/payments/checkout.service.ts, sans passer par la route. */
function checkoutParams(buyer: Buyer, ev: SaleEvent, items: Items): Row {
    const id = randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase();
    return {
        client_id: buyer.userId,
        event_id: ev.eventId,
        partner_id: partner.partnerId,
        items: items.map(([name, quantity]) => ({ category_id: ev.categories[name].id, quantity, unit_price: ev.categories[name].price })),
        operator: 'WAVE',
        payer_phone: buyer.phone9,
        callback_token_hash: createHash('sha256').update(randomUUID()).digest('hex'),
        client_idempotency_key: randomUUID(),
        transaction_id: `TX-EV-TEST-${id}`,
        external_order_id: `ORD-EV-TEST-${id}`,
        hold_minutes: 15,
        metadata: { target_type: 'TICKET', event_id: ev.eventId, test: 'lot8-canaux' },
    };
}

async function counterSale(desk: CashDesk, ev: SaleEvent, items: Items, key: string = randomUUID()): Promise<RouteResult> {
    const handler = await routeHandler(COUNTER_ROUTE, 'POST', 'POST /api/controller/counter-sale');
    return invoke(handler, authed('/api/controller/counter-sale', 'POST', desk.seller, { eventId: ev.eventId, items: routeItems(ev, items) }, { 'idempotency-key': key }));
}

async function counterQuote(desk: CashDesk, ev: SaleEvent, items: Items): Promise<RouteResult> {
    const handler = await routeHandler(QUOTE_ROUTE, 'POST', 'POST /api/controller/counter-sale/quote');
    return invoke(handler, authed('/api/controller/counter-sale/quote', 'POST', desk.seller, { eventId: ev.eventId, items: routeItems(ev, items) }));
}

async function directCounterSale(desk: CashDesk, ev: SaleEvent, items: Items): Promise<Row> {
    return rpc('counter_sale', { p: { seller_id: desk.seller.userId, event_id: ev.eventId, items: rpcItems(ev, items), buyer_phone: null, idempotency_key: randomUUID() } });
}

async function directCounterQuote(desk: CashDesk, ev: SaleEvent, items: Items): Promise<Row> {
    return rpc('counter_sale_quote', { p: { seller_id: desk.seller.userId, event_id: ev.eventId, items: rpcItems(ev, items) } });
}

async function claimFreeRoute(buyer: Buyer, categoryId: string, quantity: number): Promise<RouteResult> {
    const handler = await routeHandler('../../app/api/tickets/claim-free/route', 'POST', 'POST /api/tickets/claim-free');
    return invoke(handler, authed('/api/tickets/claim-free', 'POST', buyer, { categoryId, quantity }));
}

async function publicSheet(eventId: string): Promise<Row> {
    const handler = await routeHandler('../../app/api/events/[id]/route', 'GET', 'GET /api/events/[id]');
    const params = { id: eventId };
    const res = await invoke(handler, jsonRequest(`/api/events/${eventId}`, 'GET', null), { params: Object.assign(Promise.resolve(params), params) });
    assert.equal(res.status, 200, `fiche publique : ${show(res)}`);
    assert.ok(res.body.event && typeof res.body.event === 'object', `fiche publique : objet event attendu, ${show(res)}`);
    return res.body.event as Row;
}

async function catalogEntry(eventId: string): Promise<Row> {
    const handler = await routeHandler('../../app/api/events/route', 'GET', 'GET /api/events');
    const res = await invoke(handler, jsonRequest('/api/events', 'GET', null));
    assert.equal(res.status, 200, `catalogue : ${show(res)}`);
    assert.ok(Array.isArray(res.body.events), `catalogue : events[] attendu, ${show(res)}`);
    const entry = (res.body.events as Row[]).find((e) => e.id === eventId);
    assert.ok(entry, `événement ${eventId} absent du catalogue`);
    return entry;
}

// ── Lectures et assertions ─────────────────────────────────────────────────

function onlineProblem(ev: SaleEvent, name: string): Row {
    return { category_id: ev.categories[name].id, code: 'CATEGORY_NOT_SOLD_ONLINE', message: `La catégorie « ${name} » n'est pas vendue en ligne.` };
}

async function reservationsOf(categoryId: string): Promise<Row[]> {
    const { data, error } = await service.from('stock_reservations').select('*').eq('category_id', categoryId);
    assert.equal(error, null, `réservations de ${categoryId} : ${error?.message}`);
    return (data ?? []) as Row[];
}

async function ticketsOfPayment(paymentId: string): Promise<Row[]> {
    const { data, error } = await service.from('tickets').select('*').eq('payment_id', paymentId).order('created_at');
    assert.equal(error, null, `billets du paiement ${paymentId} : ${error?.message}`);
    return (data ?? []) as Row[];
}

function samirPayCallsOf(buyer: Buyer): number {
    return initCalls().filter((c) => c.args.telephone === buyer.phone9).length;
}

/** Aucun effet en ligne : ni paiement, ni réservation, ni appel SamirPay (compté par numéro neuf), stock intact. */
async function assertNoOnlineEffect(buyer: Buyer, ev: SaleEvent, label: string): Promise<void> {
    assert.deepEqual((await paymentsOf(buyer.userId)).map((p) => p.id), [], `${label} : aucun paiement`);
    assert.equal(samirPayCallsOf(buyer), 0, `${label} : aucun appel SamirPay pour ce numéro`);
    for (const [name, c] of Object.entries(ev.categories)) {
        assert.deepEqual(await reservationsOf(c.id), [], `${label} : aucune réservation sur ${name}`);
        const state = await categoryState(c.id);
        assert.deepEqual([state.sold, state.held], [0, 0], `${label} : stock de ${name} intact`);
    }
}

interface Snapshot { tickets: string[]; sold: Record<string, number>; expected: number; payments: string[] }

async function snapshot(ev: SaleEvent, desk: CashDesk): Promise<Snapshot> {
    const sold: Record<string, number> = {};
    for (const [name, c] of Object.entries(ev.categories)) sold[name] = (await categoryState(c.id)).sold;
    const { data, error } = await service.from('payments').select('id').eq('shift_id', desk.shiftId).order('created_at');
    assert.equal(error, null, `paiements de la caisse : ${error?.message}`);
    return {
        tickets: (await eventTickets(ev.eventId)).map((t) => String(t.id)).sort(),
        sold,
        expected: Number((await shiftRow(desk.shiftId)).expected_cash_total),
        payments: (data ?? []).map((p) => String(p.id)),
    };
}

async function assertNothingSold(ev: SaleEvent, desk: CashDesk, before: Snapshot, label: string): Promise<void> {
    assert.deepEqual(await snapshot(ev, desk), before, `${label} : rien vendu (billets, stock, caisse, paiements)`);
}

function assertCounterRefusedReply(reply: Row, ev: SaleEvent, refused: string, label: string): void {
    assert.equal(reply.ok, false, `${label} : refus attendu, ${JSON.stringify(reply)}`);
    assert.equal(reply.code, 'CATEGORY_NOT_SOLD_AT_COUNTER', `${label} : code attendu, ${JSON.stringify(reply)}`);
    assert.ok(JSON.stringify(reply.problems ?? null).includes(ev.categories[refused].id), `${label} : problems cite la catégorie refusée, ${JSON.stringify(reply)}`);
}

function assertCounterRefusedRoute(res: RouteResult, ev: SaleEvent, refused: string, label: string): void {
    assert.equal(res.status, 409, `${label} : HTTP 409 attendu, ${show(res)}`);
    assert.equal(res.body.code, 'CATEGORY_NOT_SOLD_AT_COUNTER', `${label} : code attendu, ${show(res)}`);
    assert.ok(typeof res.body.error === 'string' && res.body.error.trim().length > 0, `${label} : message français attendu, ${show(res)}`);
    assert.ok(JSON.stringify(res.body.problems ?? null).includes(ev.categories[refused].id), `${label} : problems cite la catégorie refusée, ${show(res)}`);
}

function assertDecision(tickets: Row[], expected: { source: string; sale_online: boolean; sale_counter: boolean }, label: string): void {
    assert.ok(tickets.length > 0, `${label} : au moins un billet`);
    for (const t of tickets) {
        const d = t.sale_decision as Row | null | undefined;
        assert.ok(d && typeof d === 'object', `${label} : sale_decision attendue, reçu ${JSON.stringify(t.sale_decision)}`);
        const { decided_at: decidedAt, ...rest } = d;
        assert.deepEqual(rest, expected, `${label} : décision figée à la vente`);
        assert.ok(Number.isFinite(Date.parse(String(decidedAt))), `${label} : decided_at daté, reçu ${JSON.stringify(decidedAt)}`);
    }
}

// ── Vente en ligne ─────────────────────────────────────────────────────────

describe('8.0 Vente en ligne refusée si sale_online est faux', () => {
    test('1. checkout_create_payment en appel direct : ok false, CATEGORY_NOT_SOLD_ONLINE, aucun paiement, aucune réservation', async () => {
        const ev = await saleEvent('direct', [{ name: 'Presse', price: 3000, total: 10, online: false }]);
        const buyer = await newBuyer('canaux-direct');
        const reply = await rpc('checkout_create_payment', { p: checkoutParams(buyer, ev, [['Presse', 1]]) });
        assert.equal(reply.ok, false, `appel direct refusé : ${JSON.stringify(reply)}`);
        assert.deepEqual(reply.problems, [onlineProblem(ev, 'Presse')], `problème exact : ${JSON.stringify(reply)}`);
        await assertNoOnlineEffect(buyer, ev, 'appel direct');
    });

    test('2. POST /api/checkout : 400, code dans le corps, aucun appel SamirPay', async () => {
        const ev = await saleEvent('route', [{ name: 'Presse', price: 3000, total: 10, online: false }]);
        const buyer = await newBuyer('canaux-route');
        const res = await checkout(buyer, cart(ev.eventId, [[ev.categories.Presse.id, 1]], buyer));
        assert.equal(res.status, 400, `checkout refusé : HTTP ${res.status} ${JSON.stringify(res.body)}`);
        assert.equal(res.body.code, 'SALE_CHECK_FAILED', `code de tête : ${JSON.stringify(res.body)}`);
        assert.deepEqual(res.body.problems, [onlineProblem(ev, 'Presse')], `problème exact : ${JSON.stringify(res.body)}`);
        await assertNoOnlineEffect(buyer, ev, 'POST /api/checkout');
    });

    test('2 bis. panier mixte : refusé en entier, seule la catégorie fautive est citée, aucune réservation sur l’autre', async () => {
        const ev = await saleEvent('mixte', [
            { name: 'Ouverte', price: 3000, total: 10 },
            { name: 'Presse', price: 3000, total: 10, online: false },
        ]);
        const buyer = await newBuyer('canaux-mixte');
        const res = await checkout(buyer, cart(ev.eventId, [[ev.categories.Ouverte.id, 2], [ev.categories.Presse.id, 1]], buyer));
        assert.equal(res.status, 400, `panier mixte refusé : HTTP ${res.status} ${JSON.stringify(res.body)}`);
        assert.deepEqual(res.body.problems, [onlineProblem(ev, 'Presse')], `seule la catégorie fautive : ${JSON.stringify(res.body)}`);
        await assertNoOnlineEffect(buyer, ev, 'panier mixte');
    });

    test('3. free_tickets_claim direct et /api/tickets/claim-free : refus, aucun billet, stock inchangé', async () => {
        const ev = await saleEvent('gratuit', [{ name: 'Libre', price: 0, total: 20, online: false }]);
        const buyer = await newBuyer('canaux-gratuit');
        const category = ev.categories.Libre.id;

        const direct = await rpc('free_tickets_claim', { p_user_id: buyer.userId, p_event_id: ev.eventId, p_items: [{ category_id: category, quantity: 1 }] });
        assert.equal(direct.ok, false, `appel direct refusé : ${JSON.stringify(direct)}`);
        assert.equal(direct.code, 'SALE_CHECK_FAILED', `code de tête : ${JSON.stringify(direct)}`);
        assert.deepEqual(direct.problems, [onlineProblem(ev, 'Libre')], `problème exact : ${JSON.stringify(direct)}`);

        const route = await claimFreeRoute(buyer, category, 1);
        assert.equal(route.status, 400, `claim-free refusé : ${show(route)}`);
        assert.equal(route.body.code, 'SALE_CHECK_FAILED', `code de tête : ${show(route)}`);
        assert.deepEqual(route.body.problems, [onlineProblem(ev, 'Libre')], `problème exact : ${show(route)}`);

        const viaCheckout = await checkout(buyer, { eventId: ev.eventId, items: [{ categoryId: category, quantity: 1 }] });
        assert.equal(viaCheckout.status, 400, `panier gratuit au checkout refusé : HTTP ${viaCheckout.status} ${JSON.stringify(viaCheckout.body)}`);
        assert.deepEqual(viaCheckout.body.problems, [onlineProblem(ev, 'Libre')], `problème exact : ${JSON.stringify(viaCheckout.body)}`);

        assert.deepEqual(await eventTickets(ev.eventId), [], 'aucun billet émis');
        assert.equal((await categoryState(category)).sold, 0, 'stock inchangé');
    });
});

// ── Guichet ────────────────────────────────────────────────────────────────

describe('8.0 Vente au guichet refusée si sale_counter est faux', () => {
    test('4. counter_sale direct et route : CATEGORY_NOT_SOLD_AT_COUNTER, 409, rien vendu, caisse inchangée', async () => {
        const ev = await saleEvent('guichet', [{ name: 'Web', price: 3000, total: 10, counter: false }]);
        const desk = await cashDesk(ev, 'guichet');
        const before = await snapshot(ev, desk);

        assertCounterRefusedReply(await directCounterSale(desk, ev, [['Web', 1]]), ev, 'Web', 'counter_sale direct');
        await assertNothingSold(ev, desk, before, 'counter_sale direct');

        assertCounterRefusedRoute(await counterSale(desk, ev, [['Web', 1]]), ev, 'Web', 'POST /api/controller/counter-sale');
        await assertNothingSold(ev, desk, before, 'POST /api/controller/counter-sale');
    });

    test('4 bis. panier mixte au guichet : refusé en entier, seule la catégorie fautive est citée', async () => {
        const ev = await saleEvent('guichet-mixte', [
            { name: 'Ouverte', price: 3000, total: 10 },
            { name: 'Web', price: 3000, total: 10, counter: false },
        ]);
        const desk = await cashDesk(ev, 'guichet-mixte');
        const before = await snapshot(ev, desk);
        const res = await counterSale(desk, ev, [['Ouverte', 1], ['Web', 1]]);
        assertCounterRefusedRoute(res, ev, 'Web', 'panier mixte au guichet');
        assert.ok(!JSON.stringify(res.body.problems).includes(ev.categories.Ouverte.id), `la catégorie vendable n'est pas citée : ${show(res)}`);
        await assertNothingSold(ev, desk, before, 'panier mixte au guichet');
    });

    test('5. counter_sale_quote direct et route : même code, 409, aucun total', async () => {
        const ev = await saleEvent('devis', [{ name: 'Web', price: 3000, total: 10, counter: false }]);
        const desk = await cashDesk(ev, 'devis');

        const direct = await directCounterQuote(desk, ev, [['Web', 2]]);
        assertCounterRefusedReply(direct, ev, 'Web', 'counter_sale_quote direct');
        assert.ok(!('total' in direct) && !('lines' in direct), `aucun total au devis direct : ${JSON.stringify(direct)}`);

        const route = await counterQuote(desk, ev, [['Web', 2]]);
        assertCounterRefusedRoute(route, ev, 'Web', 'POST /api/controller/counter-sale/quote');
        assert.ok(!('total' in route.body) && !('lines' in route.body), `aucun total au devis : ${show(route)}`);
    });
});

// ── Témoins ────────────────────────────────────────────────────────────────

describe('8.0 Les deux canaux sont indépendants', () => {
    test('6. sale_online faux, sale_counter vrai : vendue au guichet, décision figée', async () => {
        const ev = await saleEvent('sur-place', [{ name: 'Presse', price: 3000, total: 10, online: false }]);
        const desk = await cashDesk(ev, 'sur-place');
        const quote = await counterQuote(desk, ev, [['Presse', 2]]);
        assert.equal(quote.status, 200, `devis : ${show(quote)}`);
        assert.equal(quote.body.total, 6000, `total du devis : ${show(quote)}`);
        const res = await counterSale(desk, ev, [['Presse', 2]]);
        assert.equal(res.status, 200, `vente au guichet : ${show(res)}`);
        const tickets = await ticketsOfPayment(String(res.body.payment_id));
        assert.equal(tickets.length, 2, 'deux billets');
        assert.ok(tickets.every((t) => t.sale_channel === 'COUNTER'), 'canal COUNTER');
        assertDecision(tickets, { source: 'CATEGORIE', sale_online: false, sale_counter: true }, 'vente au guichet');
    });

    test('6 bis. sale_online vrai, sale_counter faux : vendue en ligne, décision lue sur la réservation', async () => {
        const ev = await saleEvent('en-ligne', [{ name: 'Web', price: 3000, total: 10, counter: false }]);
        const buyer = await newBuyer('canaux-en-ligne');
        const { tickets } = await buyConfirmed(buyer, ev, [['Web', 1]]);
        assert.equal(tickets.length, 1, 'un billet');
        assert.equal(tickets[0].sale_channel, 'ONLINE', 'canal ONLINE');
        assertDecision(tickets, { source: 'RESERVATION', sale_online: true, sale_counter: false }, 'vente en ligne');
    });

    test('6 ter. aucun canal : refusée en ligne, au devis et au guichet', async () => {
        const ev = await saleEvent('aucun', [{ name: 'Invites', price: 3000, total: 10, online: false, counter: false }]);
        const desk = await cashDesk(ev, 'aucun');
        const buyer = await newBuyer('canaux-aucun');
        const before = await snapshot(ev, desk);

        const online = await checkout(buyer, cart(ev.eventId, [[ev.categories.Invites.id, 1]], buyer));
        assert.equal(online.status, 400, `refus en ligne : HTTP ${online.status} ${JSON.stringify(online.body)}`);
        assert.deepEqual(online.body.problems, [onlineProblem(ev, 'Invites')], `problème exact : ${JSON.stringify(online.body)}`);
        await assertNoOnlineEffect(buyer, ev, 'aucun canal, en ligne');

        assertCounterRefusedRoute(await counterQuote(desk, ev, [['Invites', 1]]), ev, 'Invites', 'aucun canal, devis');
        assertCounterRefusedRoute(await counterSale(desk, ev, [['Invites', 1]]), ev, 'Invites', 'aucun canal, guichet');
        await assertNothingSold(ev, desk, before, 'aucun canal, guichet');
    });

    test('7. rejeu d’une vente au guichet après coupure de sale_counter : même vente ; une clé neuve est refusée', async () => {
        const ev = await saleEvent('rejeu', [{ name: 'Standard', price: 3000, total: 10 }]);
        const desk = await cashDesk(ev, 'rejeu');
        const key = randomUUID();
        const first = await counterSale(desk, ev, [['Standard', 1]], key);
        assert.equal(first.status, 200, `première vente : ${show(first)}`);
        await setChannels(ev.categories.Standard.id, { sale_counter: false });
        const before = await snapshot(ev, desk);

        const replay = await counterSale(desk, ev, [['Standard', 1]], key);
        assert.equal(replay.status, 200, `rejeu : ${show(replay)}`);
        assert.equal(replay.body.replayed, true, `rejeu signalé : ${show(replay)}`);
        assert.equal(replay.body.payment_id, first.body.payment_id, `même vente : ${show(first)} | ${show(replay)}`);
        assert.deepEqual(replay.body.ticket_ids, first.body.ticket_ids, 'mêmes billets');
        await assertNothingSold(ev, desk, before, 'rejeu');

        assertCounterRefusedRoute(await counterSale(desk, ev, [['Standard', 1]]), ev, 'Standard', 'clé neuve après la coupure');
        await assertNothingSold(ev, desk, before, 'clé neuve après la coupure');
    });
});

// ── Instantané ─────────────────────────────────────────────────────────────

describe('8.0 Paiement en cours pendant une coupure (L8) : la décision est celle du checkout', () => {
    test('8. payment_confirm émet après la coupure de sale_online : source RESERVATION, sale_online vrai', async () => {
        const ev = await saleEvent('en-cours', [{ name: 'Standard', price: 3000, total: 10 }]);
        const buyer = await newBuyer('canaux-en-cours');
        const res = await checkout(buyer, cart(ev.eventId, [[ev.categories.Standard.id, 2]], buyer));
        assert.equal(res.status, 200, `checkout : HTTP ${res.status} ${JSON.stringify(res.body)}`);
        assert.ok(res.payment, 'paiement créé');
        const [reservation] = await reservationsOf(ev.categories.Standard.id);
        assert.equal(reservation?.sale_online_at_checkout, true, `décision figée au checkout : ${JSON.stringify(reservation)}`);

        await setChannels(ev.categories.Standard.id, { sale_online: false });
        const confirmed = await rpc('payment_confirm', { p_payment_id: res.payment.id, p_source: 'TEST' });
        assert.equal(confirmed.result, 'CONFIRMED', `billets émis : ${JSON.stringify(confirmed)}`);
        assert.equal(confirmed.ticket_count, 2, `deux billets : ${JSON.stringify(confirmed)}`);

        const tickets = await ticketsOfPayment(res.payment.id);
        assert.equal(tickets.length, 2, 'deux billets en base');
        assertDecision(tickets, { source: 'RESERVATION', sale_online: true, sale_counter: true }, 'paiement en cours');
    });

    test('9. réservation échue honorée sur stock libre après la coupure : même décision', async () => {
        const ev = await saleEvent('echue', [{ name: 'Standard', price: 3000, total: 10 }]);
        const buyer = await newBuyer('canaux-echue');
        const res = await checkout(buyer, cart(ev.eventId, [[ev.categories.Standard.id, 1]], buyer));
        assert.equal(res.status, 200, `checkout : HTTP ${res.status} ${JSON.stringify(res.body)}`);
        assert.ok(res.payment, 'paiement créé');

        await setChannels(ev.categories.Standard.id, { sale_online: false });
        const { error: expErr } = await service.from('stock_reservations').update({ expires_at: new Date(Date.now() - 60_000).toISOString() }).eq('payment_id', res.payment.id);
        assert.equal(expErr, null, `réservation échue : ${expErr?.message}`);
        const { error: rpcErr } = await service.rpc('stock_reservations_expire');
        assert.equal(rpcErr, null, `stock_reservations_expire : ${rpcErr?.message}`);
        const [reservation] = await reservationsOf(ev.categories.Standard.id);
        assert.equal(reservation?.status, 'EXPIRED', `précondition, réservation échue : ${JSON.stringify(reservation)}`);

        const confirmed = await rpc('payment_confirm', { p_payment_id: res.payment.id, p_source: 'TEST' });
        assert.equal(confirmed.result, 'CONFIRMED', `billet émis sur stock libre : ${JSON.stringify(confirmed)}`);
        assertDecision(await ticketsOfPayment(res.payment.id), { source: 'RESERVATION', sale_online: true, sale_counter: true }, 'réservation échue honorée');
    });
});

// ── Lecteurs ───────────────────────────────────────────────────────────────

describe('8.0 Lecteurs des réglages', () => {
    test('10. GET du guichet : catégorie à sale_counter faux absente, on_site_only vrai si non vendue en ligne', async () => {
        const ev = await saleEvent('lecture-guichet', [
            { name: 'Les deux', price: 3000, total: 10 },
            { name: 'Presse', price: 2000, total: 10, online: false },
            { name: 'Web', price: 1000, total: 10, counter: false },
            { name: 'Invites', price: 1500, total: 10, online: false, counter: false },
        ]);
        const desk = await cashDesk(ev, 'lecture-guichet');
        const handler = await routeHandler(COUNTER_ROUTE, 'GET', 'GET /api/controller/counter-sale');
        const res = await invoke(handler, authed(`/api/controller/counter-sale?event_id=${ev.eventId}`, 'GET', desk.seller));
        assert.equal(res.status, 200, `GET du guichet : ${show(res)}`);
        const rows = (res.body.categories ?? []) as Row[];
        assert.deepEqual(rows.map((c) => [c.name, c.on_site_only]).sort(), [['Les deux', false], ['Presse', true]], `catégories du guichet : ${show(res)}`);
    });

    test('11. page publique et catalogue : catégorie non vendue en ligne absente, prix « à partir de » sans elle', async () => {
        const ev = await saleEvent('lecture-publique', [
            { name: 'Presse', price: 1000, total: 10 },
            { name: 'Web', price: 12_000, total: 10, counter: false },
            { name: 'Normale', price: 8000, total: 30 },
        ]);
        assert.equal(Number((await catalogEntry(ev.eventId)).price), 1000, 'témoin : avant la coupure, le prix le plus bas est celui de Presse');

        await setChannels(ev.categories.Presse.id, { sale_online: false });

        const sheet = await publicSheet(ev.eventId);
        const names = ((sheet.categories ?? []) as Row[]).map((c) => String(c.name)).sort();
        assert.deepEqual(names, ['Normale', 'Web'], `fiche publique, sale_counter faux n'y change rien : ${JSON.stringify(sheet.categories)}`);
        assert.ok(!JSON.stringify(sheet).includes('Presse'), 'aucune trace de la catégorie sur la fiche');

        const entry = await catalogEntry(ev.eventId);
        assert.equal(Number(entry.price), 8000, `prix « à partir de » = 8 000 F, sans Presse : ${JSON.stringify(entry)}`);
        assert.ok(!JSON.stringify(entry).includes('Presse'), 'aucune trace de la catégorie au catalogue');
    });

    test('12. pilotage : sale_online et sale_counter servis par catégorie, is_visible conservé', async () => {
        const ev = await saleEvent('pilotage', [
            { name: 'Presse', price: 2000, total: 10, online: false },
            { name: 'Web', price: 1000, total: 10, counter: false },
        ]);
        const body = await pilotageOk(partner, ev.eventId, 'sales', 'le partenaire propriétaire');
        const rows = listAt(body, 'by_category', 'ventes par catégorie');
        const presse = findItem(rows, 'category_id', ev.categories.Presse.id, 'Presse');
        const web = findItem(rows, 'category_id', ev.categories.Web.id, 'Web');
        assert.deepEqual([presse.sale_online, presse.sale_counter, presse.is_visible], [false, true, false], `Presse : ${JSON.stringify(presse)}`);
        assert.deepEqual([web.sale_online, web.sale_counter, web.is_visible], [true, false, true], `Web : ${JSON.stringify(web)}`);
    });
});

// ── Miroir ─────────────────────────────────────────────────────────────────

describe('8.0 Miroir is_visible ↔ sale_online', () => {
    async function insertCategory(eventId: string, name: string, flags: { is_visible?: boolean; sale_online?: boolean }): Promise<Row> {
        const { data, error } = await service.from('ticket_categories').insert({
            event_id: eventId, name, price: 1000, total_quantity: 5, sold_quantity: 0, is_active: true, max_per_order: 5, ...flags,
        }).select('id, is_visible, sale_online, sale_counter').single();
        assert.equal(error, null, `catégorie ${name} : ${error?.message}`);
        return data as Row;
    }

    const pair = (row: Row): [unknown, unknown] => [row.is_visible, row.sale_online];

    test('13. INSERT is_visible faux, INSERT sale_online faux, UPDATE de l’un, UPDATE de l’autre', async () => {
        const ev = await saleEvent('miroir', [{ name: 'Base', price: 1000, total: 5 }], { status: 'BROUILLON' });

        const defaults = await insertCategory(ev.eventId, 'Par defaut', {});
        assert.deepEqual(pair(defaults), [true, true], `défauts : ${JSON.stringify(defaults)}`);
        assert.equal(defaults.sale_counter, true, 'sale_counter vrai par défaut');
        assert.deepEqual(pair(await insertCategory(ev.eventId, 'Masquee', { is_visible: false })), [false, false], 'INSERT is_visible faux');
        assert.deepEqual(pair(await insertCategory(ev.eventId, 'Hors ligne', { sale_online: false })), [false, false], 'INSERT sale_online faux');

        const id = String(defaults.id);
        assert.deepEqual(pair(await setChannels(id, { is_visible: false })), [false, false], 'UPDATE is_visible faux');
        assert.deepEqual(pair(await setChannels(id, { is_visible: true })), [true, true], 'UPDATE is_visible vrai');
        assert.deepEqual(pair(await setChannels(id, { sale_online: false })), [false, false], 'UPDATE sale_online faux');
        assert.deepEqual(pair(await setChannels(id, { sale_online: true })), [true, true], 'UPDATE sale_online vrai');
        await setChannels(id, { sale_online: false });
        assert.deepEqual(pair(await setChannels(id, { sale_online: true, is_visible: false })), [true, true], 'UPDATE des deux : sale_online qui change gagne');

        const counterOff = await setChannels(id, { sale_counter: false });
        assert.deepEqual([...pair(counterOff), counterOff.sale_counter], [true, true, false], 'sale_counter ne touche pas au miroir');
    });

    test('13 bis. UPDATE SET sale_online = false retire la ligne de public_category_stock ; la remise à vrai la rétablit', async () => {
        const ev = await saleEvent('stock-public', [{ name: 'Standard', price: 1000, total: 40 }]);
        const category = ev.categories.Standard.id;
        const line = async (): Promise<Row[]> => {
            const { data, error } = await service.from('public_category_stock').select('category_id, availability').eq('category_id', category);
            assert.equal(error, null, `public_category_stock : ${error?.message}`);
            return (data ?? []) as Row[];
        };
        assert.equal((await line()).length, 1, 'précondition : catégorie publique, une ligne de stock public');

        await setChannels(category, { sale_counter: false });
        assert.equal((await line()).length, 1, 'sale_counter faux : la ligne reste');

        await setChannels(category, { sale_online: false });
        assert.deepEqual(await line(), [], 'sale_online faux : ligne retirée (UPDATE OF du trigger de synchronisation, contrat 2.4 point 5)');

        await setChannels(category, { sale_online: true });
        assert.deepEqual(await line(), [{ category_id: category, availability: 'AVAILABLE' }], 'sale_online vrai : ligne rétablie');
    });
});

// ── Droits ─────────────────────────────────────────────────────────────────

describe('8.0 Droits sur les colonnes', () => {
    test('14. anon lit une catégorie publique, pas une catégorie coupée en ligne ; tickets.sale_decision illisible par anon et authenticated', async () => {
        const ev = await saleEvent('anon', [
            { name: 'Ouverte', price: 1000, total: 10 },
            { name: 'Presse', price: 1000, total: 10, online: false },
        ]);
        const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
        const { data, error } = await anon.from('ticket_categories').select('id, name, sale_online').in('id', [ev.categories.Ouverte.id, ev.categories.Presse.id]);
        assert.equal(error, null, `lecture anon (GRANT de colonne, contrat 2.4 point 1) : ${error?.message}`);
        assert.deepEqual(data, [{ id: ev.categories.Ouverte.id, name: 'Ouverte', sale_online: true }], `anon ne voit que la catégorie vendue en ligne : ${JSON.stringify(data)}`);

        const rights = await inspect(async (db) => (await db.query<Record<string, boolean>>(
            `SELECT has_column_privilege('anon', 'public.tickets', 'sale_decision', 'SELECT') AS anon_decision,
                    has_column_privilege('authenticated', 'public.tickets', 'sale_decision', 'SELECT') AS auth_decision,
                    has_column_privilege('anon', 'public.ticket_categories', 'sale_online', 'SELECT') AS anon_online,
                    has_column_privilege('authenticated', 'public.ticket_categories', 'sale_online', 'SELECT') AS auth_online`)).rows[0]);
        assert.deepEqual(rights, { anon_decision: false, auth_decision: false, anon_online: true, auth_online: true }, `privilèges de colonne : ${JSON.stringify(rights)}`);
    });

    test('15. UPDATE tickets SET sale_decision refusé (EV422), service_role compris ; billet gratuit figé en CATEGORIE', async () => {
        const ev = await saleEvent('immuable', [{ name: 'Libre', price: 0, total: 5 }]);
        const buyer = await newBuyer('canaux-immuable');
        const claimed = await rpc('free_tickets_claim', { p_user_id: buyer.userId, p_event_id: ev.eventId, p_items: [{ category_id: ev.categories.Libre.id, quantity: 1 }] });
        assert.equal(claimed.ok, true, `billet gratuit : ${JSON.stringify(claimed)}`);
        const [ticketId] = claimed.ticket_ids as string[];

        const read = async (): Promise<Row> => {
            const { data, error } = await service.from('tickets').select('*').eq('id', ticketId).single();
            assert.equal(error, null, `billet ${ticketId} : ${error?.message}`);
            return data as Row;
        };
        const before = await read();
        assert.equal(before.sale_channel, 'FREE', 'canal FREE');
        assertDecision([before], { source: 'CATEGORIE', sale_online: true, sale_counter: true }, 'billet gratuit');

        const { error } = await service.from('tickets').update({ sale_decision: { source: 'CATEGORIE', sale_online: false, sale_counter: false } }).eq('id', ticketId);
        assert.equal(error?.code, 'EV422', `UPDATE direct de sale_decision : ${JSON.stringify(error)}`);
        assert.deepEqual((await read()).sale_decision, before.sale_decision, 'décision inchangée');
    });
});

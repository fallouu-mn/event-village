/**
 * Lot 9 ter, tâche 9t.19 (consigne 5 : affichage du stock au public ; consigne 6 : « 10 SIMPLE → SIMPLE complet, VIP en
 * vente », « 20 VIP → carte Complet », « hausse à 15 → carte et fiche disponibles sans rechargement », « paiement abandonné
 * → place rendue après la garde ») — carte du catalogue avec `stock` (« Complet », « Dernières places »), « À partir de »
 * sur les catégories qui ont encore des places, « Complet » avant « Vente sur place uniquement », ordre date → complet après
 * → heure → id, résumé public `public_event_state.stock_level` juste et diffusé, Populaires frais, message de jauge
 * (contrat 5.D, D.2.1 à D.2.6 ; arbitrages 22 et 23 ; X6, ED5, ED6 ; rectifications 7, 9, 10 et 11 de D).
 *
 * Montage S : newPartner('stock9ter'), createEventInStatus(…, [SIMPLE 5 000 F ×10, VIP 15 000 F ×20], 'PUBLIE',
 * { capacity: 30, startsInHours: 48 }), guichet laissé par défaut (vrai), seuil par défaut 10 ; achats buyConfirmed
 * (10 au plus par compte) ; carte par GET /api/events?q=<jeton>, fiche par GET /api/events/[id] ; modifications par PATCH
 * …/categories/[categoryId] et PUT /api/partner/events/[id] avec le jeton de la partenaire ; temps réel : client anon
 * (subscribeCollect). S1 à S4 se suivent sur le même événement ; S5 rejoue S1 à S4 sur un événement à lui, abonné.
 *
 * Rouge avant correctif (S-K fix(9t.19), migration 20261110000011 ; E-D fix(9t.19e) ; E-B fix(9t.19-EB)) :
 *  - S1, S2, S7, S12 : clé `stock` absente de la carte (lib/events/catalog.server.ts:165-187) ;
 *  - S3 : « Vente sur place uniquement » au lieu de « Complet » (catalog.server.ts:109) ;
 *  - S4 : refus de jauge sans « Augmentez d’abord la capacité totale » (M/20261106000001:869-872, M/20261109000008:1941-1944) ;
 *  - S5 : S1 et S2 n'émettent rien (min_price sur les catégories épuisées, aucune colonne stock_level) ;
 *  - S6 : clé `stock` absente, aucun départage à date égale (app/api/events/route.ts:47) ;
 *  - S8 : getPopularRanking et readPopularCards absentes, cartes en cache 60 s (popular.service.ts:41-51) ;
 *  - S9 : sans verrou du résumé, has_purchasable reste vrai ; colonne stock_level absente ;
 *  - S10 : colonne stock_level absente, la reprise du seuil ne recalcule que les tranches ;
 *  - S11 : badges, aide de catégorie et relecture de l'accueil absents.
 * S12 : vert attendu une fois la clé servie (rouge aujourd'hui seulement par `stock`).
 * after() : assertLot9terInvariants.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { openConcurrentClient, waitForLockWaiters } from '../helpers/db';
import { assertLot9terInvariants } from '../helpers/lot9ter-invariants';
import {
    RECEIVE_TIMEOUT_MS, anonClient, disposeClients, subscribeCollect, waitForEvent, type Collector, type ReceivedChange,
} from '../helpers/realtime';
import { routeContext } from './helpers';
import { cart, checkout, cronRequest, importModule, newBuyer, service, sleep, type CategorySpec } from './paiement-helpers';
import { buyConfirmed, jsonRequest, newPartner, superadminId, type TestPartner } from './finance-helpers';
import { advanceEventTo, createDraftEvent, createEventInStatus, shiftEventDates, type DraftEvent } from './cycle-helpers';
import { invoke, routeHandler, show, type Row } from './pilotage-helpers';

const SIMPLE = 'SIMPLE';
const VIP = 'VIP';
const MONTAGE_S: CategorySpec[] = [
    { name: SIMPLE, price: 5_000, total: 10, maxPerOrder: 10 },
    { name: VIP, price: 15_000, total: 20, maxPerOrder: 10 },
];
const TOKEN = `stock9ter${randomUUID().replace(/-/g, '').slice(0, 8)}`;
const CATALOG_ROUTE = '../../app/api/events/route';
const SHEET_ROUTE = '../../app/api/events/[id]/route';
const CATEGORY_ROUTE = '../../app/api/partner/events/[id]/categories/[categoryId]/route';
const EVENT_ROUTE = '../../app/api/partner/events/[id]/route';
const POPULAR_SERVICE = '../../lib/events/popular.service';
const THRESHOLD_KEY = 'access.low_stock_threshold';
const GAUGE_TEXT = 'Augmentez d’abord la capacité totale de l’événement (actuellement 30).';
const CATEGORY_HELP = 'Pour vendre des places supplémentaires à un autre prix, créez une nouvelle catégorie.';
/** Colonnes de public_event_state (contrat O1 du lot 5 + stock_level, D.2.2 (1)) ; de public_category_stock (inchangées). */
const STATE_COLUMNS = ['event_id', 'status', 'title', 'start_at', 'end_at', 'location', 'city', 'image_url', 'min_price', 'has_purchasable', 'updated_at', 'stock_level'];
const STOCK_COLUMNS = ['category_id', 'event_id', 'availability', 'remaining_hint', 'updated_at'];
/** Clés actuelles de la carte (CatalogEventDto, lib/events/catalog.server.ts:63-85), plus `stock`. */
const CARD_KEYS = [
    'id', 'slug', 'title', 'subtitle', 'imageUrl', 'dateFormatted', 'dayNumber', 'monthShort', 'timeFormatted', 'venue', 'category',
    'categoryLabel', 'city', 'price', 'priceFormatted', 'onSaleSoon', 'saleLabel', 'endFormatted', 'status', 'stock',
];
const SETTLE_MS = 1_500;

let partner: TestPartner;
let evS: DraftEvent;
let live: DraftEvent;
let buyerSeq = 0;
let pulse = 0;

before(async () => {
    partner = await newPartner('stock9ter');
    evS = await stockEvent('montage-S');
    live = await createEventInStatus(partner, 'stock9ter-vivacite', [{ name: 'Standard', price: 3_000, total: 30 }], 'PUBLIE',
        { startsInHours: 96, title: title('vivacite') });
});

after(async () => {
    await assertLot9terInvariants('stock-public-9ter');
});

// ── Outils locaux ──────────────────────────────────────────────────────────

function title(label: string): string {
    return `TEST ${TOKEN} ${label}`;
}

function ctx(params: Record<string, string>): { params: Promise<Record<string, string>> & Record<string, string> } {
    return { params: Object.assign(Promise.resolve(params), params) };
}

function priceLabel(n: number): string {
    return `À partir de ${n.toLocaleString('fr-FR')} F CFA`;
}

function stockEvent(label: string, categories: CategorySpec[] = MONTAGE_S, opts: { capacity?: number; startsInHours?: number; durationHours?: number } = {}): Promise<DraftEvent> {
    return createEventInStatus(partner, `stock9ter-${label}`, categories, 'PUBLIE', { capacity: 30, startsInHours: 48, title: title(label), ...opts });
}

/** Achat confirmé de `n` billets d'une catégorie, par paquets de 10 au plus (un compte neuf par paquet). */
async function buy(ev: DraftEvent, category: string, n: number): Promise<void> {
    for (let left = n; left > 0; left -= 10) {
        buyerSeq += 1;
        const qty = Math.min(10, left);
        const { tickets } = await buyConfirmed(await newBuyer(`stock9ter-${buyerSeq}`), ev, [[category, qty]]);
        assert.equal(tickets.length, qty, `${qty} billet(s) ${category} émis`);
    }
}

async function catalog(): Promise<Row[]> {
    const handler = await routeHandler(CATALOG_ROUTE, 'GET', 'GET /api/events');
    const res = await invoke(handler, jsonRequest(`/api/events?q=${TOKEN}`, 'GET', null));
    assert.equal(res.status, 200, `catalogue : ${show(res)}`);
    return (res.body.events ?? []) as Row[];
}

async function card(eventId: string): Promise<Row> {
    const entry = (await catalog()).find((e) => e.id === eventId);
    assert.ok(entry, `événement ${eventId} au catalogue (q=${TOKEN})`);
    return entry;
}

async function sheet(eventId: string): Promise<Row> {
    const handler = await routeHandler(SHEET_ROUTE, 'GET', 'GET /api/events/[id]');
    const res = await invoke(handler, jsonRequest(`/api/events/${eventId}`, 'GET', null), ctx({ id: eventId }));
    assert.equal(res.status, 200, `fiche publique : ${show(res)}`);
    return res.body.event as Row;
}

function sheetCategory(s: Row, name: string): Row {
    const hit = ((s.categories ?? []) as Row[]).find((c) => c.name === name);
    assert.ok(hit, `catégorie ${name} sur la fiche : ${JSON.stringify(s.categories)}`);
    return hit;
}

function cardView(c: Row): Row {
    return { price: c.price, saleLabel: c.saleLabel, stock: c.stock === undefined ? '(clé stock absente)' : c.stock };
}

async function patchCategory(eventId: string, categoryId: string, body: Row) {
    const handler = await routeHandler(CATEGORY_ROUTE, 'PATCH', 'PATCH /api/partner/events/[id]/categories/[categoryId]');
    return invoke(handler, jsonRequest(`/api/partner/events/${eventId}/categories/${categoryId}`, 'PATCH', partner.accessToken, body),
        routeContext({ id: eventId, categoryId }));
}

async function putEvent(eventId: string, patch: Row) {
    const { data, error } = await service.from('events').select('updated_at').eq('id', eventId).single();
    assert.equal(error, null, `événement ${eventId} : ${error?.message}`);
    const handler = await routeHandler(EVENT_ROUTE, 'PUT', 'PUT /api/partner/events/[id]');
    return invoke(handler, jsonRequest(`/api/partner/events/${eventId}`, 'PUT', partner.accessToken, { patch, expected_updated_at: data.updated_at }),
        routeContext({ id: eventId }));
}

async function totalOf(categoryId: string): Promise<number> {
    const { data, error } = await service.from('ticket_categories').select('total_quantity').eq('id', categoryId).single();
    assert.equal(error, null, `catégorie ${categoryId} : ${error?.message}`);
    return Number(data.total_quantity);
}

/** Hausse de SIMPLE à 15 refusée par la jauge, jauge à 35, puis hausse acceptée. */
async function raiseSimpleTo15(ev: DraftEvent): Promise<void> {
    const simple = ev.categories[SIMPLE].id;
    const refused = await patchCategory(ev.eventId, simple, { total_quantity: 15 });
    assert.equal(refused.status, 409, `hausse au-delà de la jauge : ${show(refused)}`);
    assert.equal(refused.body.code, 'QUOTA_ABOVE_CAPACITY', show(refused));
    assert.ok(String(refused.body.error).includes(GAUGE_TEXT), `le refus dit quoi faire (« ${GAUGE_TEXT} ») : ${show(refused)}`);
    assert.equal(await totalOf(simple), 10, 'quota relu : 10');
    const gauge = await putEvent(ev.eventId, { capacity: 35 });
    assert.equal(gauge.status, 200, `jauge à 35 : ${show(gauge)}`);
    const raised = await patchCategory(ev.eventId, simple, { total_quantity: 15 });
    assert.equal(raised.status, 200, `hausse à 15 : ${show(raised)}`);
}

async function stateRow(eventId: string): Promise<Row | null> {
    const { data, error } = await service.from('public_event_state').select('has_purchasable, min_price, stock_level').eq('event_id', eventId).maybeSingle();
    assert.equal(error, null, `public_event_state.stock_level (migration 20261110000011) : ${error?.message}`);
    return (data ?? null) as Row | null;
}

function carriesData(e: ReceivedChange): boolean {
    return Object.keys(e.new).length > 0 || Object.keys(e.old).length > 0;
}

async function stateSentinel(collector: Collector): Promise<void> {
    pulse += 1;
    const newTitle = `${live.title} · signal ${pulse}`;
    const { error } = await service.from('events').update({ title: newTitle }).eq('id', live.eventId);
    assert.equal(error, null, `titre de l’événement de vivacité : ${error?.message}`);
    await waitForEvent(collector, (e) => e.new.event_id === live.eventId && e.new.title === newTitle, RECEIVE_TIMEOUT_MS, 'sentinelle : titre de l’événement de vivacité');
}

function readSource(rel: string): string {
    const file = path.join(process.cwd(), rel);
    assert.ok(fs.existsSync(file), `${rel} absent`);
    const src = fs.readFileSync(file, 'utf8');
    return src.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' ')).replace(/(^|[^:\\'"`])\/\/[^\n]*/g, '$1')
        .replace(/[’‘]/g, '\'').replace(/[  ]/g, ' ');
}

// ── Cas ────────────────────────────────────────────────────────────────────

describe('9t.19 — stock au public : carte, fiche, temps réel, ordre', () => {
    test('10 SIMPLE vendues : SIMPLE complète sur la fiche, VIP en vente, la carte passe à 15 000 F sans badge', async () => {
        await buy(evS, SIMPLE, 10);
        assert.deepEqual(cardView(await card(evS.eventId)), { price: 15_000, saleLabel: priceLabel(15_000), stock: null }, 'carte après S1');
        const s = await sheet(evS.eventId);
        assert.equal(sheetCategory(s, SIMPLE).availability, 'SOLD_OUT', 'fiche : SIMPLE épuisée');
        assert.equal(sheetCategory(s, VIP).availability, 'AVAILABLE', 'fiche : VIP en vente');
        assert.equal(s.purchasable, true, 'fiche achetable');
    });

    test('15 VIP de plus : carte « Dernières places », fiche « Plus que 5 places » sur VIP', async () => {
        await buy(evS, VIP, 15);
        assert.deepEqual(cardView(await card(evS.eventId)), { price: 15_000, saleLabel: priceLabel(15_000), stock: 'LOW' }, 'carte après S2');
        const vip = sheetCategory(await sheet(evS.eventId), VIP);
        assert.deepEqual({ availability: vip.availability, remainingHint: vip.remainingHint }, { availability: 'LOW', remainingHint: 5 }, 'fiche : VIP, plus que 5 places');
    });

    test('5 VIP de plus : carte « Complet », plus de prix', async () => {
        await buy(evS, VIP, 5);
        assert.deepEqual(cardView(await card(evS.eventId)), { price: null, saleLabel: 'Complet', stock: 'SOLD_OUT' }, 'carte après S3 (aujourd’hui « Vente sur place uniquement »)');
        const s = await sheet(evS.eventId);
        assert.deepEqual({ isFullySoldOut: s.isFullySoldOut, purchasable: s.purchasable }, { isFullySoldOut: true, purchasable: false }, 'fiche : tout est vendu');
    });

    test('hausse de SIMPLE à 15 : la jauge bloque et dit quoi faire ; jauge à 35 puis hausse : carte et fiche disponibles', async () => {
        await raiseSimpleTo15(evS);
        assert.deepEqual(cardView(await card(evS.eventId)), { price: 5_000, saleLabel: priceLabel(5_000), stock: 'LOW' }, 'carte après S4');
        const s = await sheet(evS.eventId);
        const simple = sheetCategory(s, SIMPLE);
        assert.deepEqual({ availability: simple.availability, remainingHint: simple.remainingHint, purchasable: s.purchasable },
            { availability: 'LOW', remainingHint: 5, purchasable: true }, 'fiche après S4');
    });

    test('temps réel : la carte et la fiche changent sans rechargement à chaque transition, et rien ne part sans changement', async () => {
        const ev = await stockEvent('temps-reel');
        const simple = ev.categories[SIMPLE].id;
        const anon = anonClient();
        try {
            const state = subscribeCollect(anon, { table: 'public_event_state' }, { label: 'anon public_event_state (accueil)' });
            const stock = subscribeCollect(anon, { table: 'public_category_stock', filter: `event_id=eq.${ev.eventId}` }, { label: 'anon public_category_stock' });
            await Promise.all([state.ready, stock.ready]);
            await stateSentinel(state);
            const mine = (e: ReceivedChange): boolean => carriesData(e) && e.new.event_id === ev.eventId;

            await buy(ev, SIMPLE, 10);
            await waitForEvent(state, (e) => mine(e) && Number(e.new.min_price) === 15_000, RECEIVE_TIMEOUT_MS, 'S1 : min_price 15 000 diffusé');
            await waitForEvent(stock, (e) => e.new.category_id === simple && e.new.availability === 'SOLD_OUT', RECEIVE_TIMEOUT_MS, 'S1 : tranche SIMPLE épuisée');
            assert.deepEqual(cardView(await card(ev.eventId)), { price: 15_000, saleLabel: priceLabel(15_000), stock: null }, 'carte relue sur le signal de S1');

            const mark = state.events.length;
            await buy(ev, VIP, 1);
            await stateSentinel(state);
            await sleep(SETTLE_MS);
            assert.deepEqual(state.events.slice(mark).filter(mine).map((e) => e.new), [], 'une vente VIP sans changement d’état (19 restantes) : aucun signal');

            await buy(ev, VIP, 14);
            await waitForEvent(state, (e) => mine(e) && e.new.stock_level === 'LOW', RECEIVE_TIMEOUT_MS, 'S2 : stock_level LOW diffusé');
            await buy(ev, VIP, 5);
            await waitForEvent(state, (e) => mine(e) && e.new.stock_level === 'SOLD_OUT' && e.new.has_purchasable === false, RECEIVE_TIMEOUT_MS,
                'S3 : stock_level SOLD_OUT, has_purchasable faux diffusés');
            await raiseSimpleTo15(ev);
            await waitForEvent(state, (e) => mine(e) && Number(e.new.min_price) === 5_000 && e.new.stock_level === 'LOW', RECEIVE_TIMEOUT_MS,
                'S4 : min_price 5 000 et stock_level LOW diffusés');
            await waitForEvent(stock, (e) => e.new.category_id === simple && e.new.availability === 'LOW', RECEIVE_TIMEOUT_MS, 'S4 : tranche SIMPLE LOW');
            const s = await sheet(ev.eventId);
            assert.equal(sheetCategory(s, SIMPLE).availability, 'LOW', 'fiche relue sur le signal de S4');

            for (const e of state.events.filter(mine)) {
                const extra = Object.keys(e.new).filter((k) => !STATE_COLUMNS.includes(k));
                assert.deepEqual(extra, [], `public_event_state : colonnes hors contrat diffusées à anon ${JSON.stringify(e.new)}`);
            }
            for (const e of stock.events.filter(carriesData)) {
                const extra = Object.keys(e.new).filter((k) => !STOCK_COLUMNS.includes(k));
                assert.deepEqual(extra, [], `public_category_stock : colonnes hors contrat diffusées à anon ${JSON.stringify(e.new)}`);
            }
        } finally {
            await disposeClients(anon);
        }
    });

    test('ordre : à date égale, un événement complet vient après les événements en vente, et reste listé jusqu’à sa fin', async () => {
        const base = new Date(Date.now() + 5 * 24 * 3600_000);
        const at = (dayOffset: number, hour: number): number =>
            (Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate() + dayOffset, hour) - Date.now()) / 3600_000;
        const one: CategorySpec[] = [{ name: SIMPLE, price: 5_000, total: 1, maxPerOrder: 10 }];
        const full = await stockEvent('ordre-complet', one, { startsInHours: at(0, 18), durationHours: 3 });
        const onSale = await stockEvent('ordre-en-vente', [{ name: SIMPLE, price: 5_000, total: 20, maxPerOrder: 10 }], { startsInHours: at(0, 20), durationHours: 3 });
        const nextDay = await stockEvent('ordre-lendemain', [{ name: SIMPLE, price: 5_000, total: 20, maxPerOrder: 10 }], { startsInHours: at(1, 18), durationHours: 3 });
        await buy(full, SIMPLE, 1);
        const ids = [onSale.eventId, full.eventId, nextDay.eventId];
        const listed = (await catalog()).filter((e) => ids.includes(String(e.id)));
        assert.deepEqual(listed.map((e) => e.id), ids, 'en vente (20:00), complet (18:00, même jour), lendemain');
        assert.equal(listed[1].stock, 'SOLD_OUT', `l’événement complet porte stock SOLD_OUT : ${JSON.stringify(listed[1])}`);

        await shiftEventDates(full.eventId, { startsInHours: -1, durationHours: 4 });
        assert.ok((await catalog()).some((e) => e.id === full.eventId), 'complet et en cours : toujours listé');
        await shiftEventDates(full.eventId, { startsInHours: -6, durationHours: 4 });
        assert.ok(!(await catalog()).some((e) => e.id === full.eventId), 'complet et fini : absent');
    });

    test('paiement abandonné : la place revient sur la carte et la fiche après la durée de garde', async () => {
        const ev = await stockEvent('garde', [
            { name: SIMPLE, price: 5_000, total: 2, maxPerOrder: 10 },
            { name: VIP, price: 15_000, total: 1, maxPerOrder: 10 },
        ]);
        await buy(ev, VIP, 1);
        const buyer = await newBuyer('stock9ter-garde');
        const pending = await checkout(buyer, cart(ev.eventId, [[ev.categories[SIMPLE].id, 2]], buyer));
        assert.equal(pending.status, 200, `panier en cours de paiement : HTTP ${pending.status} ${JSON.stringify(pending.body)}`);
        assert.ok(pending.payment, 'paiement créé');
        assert.equal(cardView(await card(ev.eventId)).stock, 'SOLD_OUT', 'places retenues : carte « Complet »');
        assert.equal((await sheet(ev.eventId)).hasHeldSeats, true, 'fiche : places retenues par un paiement en cours');

        const anon = anonClient();
        try {
            const state = subscribeCollect(anon, { table: 'public_event_state', filter: `event_id=eq.${ev.eventId}` }, { label: 'anon public_event_state (garde)' });
            await state.ready;
            const { error } = await service.from('stock_reservations').update({ expires_at: new Date(Date.now() - 1_000).toISOString() }).eq('payment_id', pending.payment.id);
            assert.equal(error, null, `réservation échue : ${error?.message}`);
            const { GET: cron } = await importModule('../../app/api/cron/stock-reservations/route');
            const res: Response = await cron(cronRequest('/api/cron/stock-reservations'));
            assert.equal(res.status, 200, 'cron des réservations');
            await waitForEvent(state, (e) => e.new.event_id === ev.eventId && e.new.has_purchasable === true, RECEIVE_TIMEOUT_MS, 'signal : place rendue');
        } finally {
            await disposeClients(anon);
        }
        assert.deepEqual(cardView(await card(ev.eventId)), { price: 5_000, saleLabel: priceLabel(5_000), stock: 'LOW' }, 'carte après la garde');
        assert.equal((await sheet(ev.eventId)).purchasable, true, 'fiche achetable');
    });

    test('Populaires : une catégorie épuisée apparaît aussitôt, le classement reste en cache', async () => {
        const mod = (await import(POPULAR_SERVICE)) as unknown as {
            getPopularRanking?: (deps?: { now?: () => number; read?: () => Promise<string[]> }) => Promise<string[]>;
            readPopularCards?: (ids: string[]) => Promise<Row[]>;
            getPopularEvents: () => Promise<Row[]>;
        };
        assert.equal(typeof mod.getPopularRanking, 'function', 'lib/events/popular.service doit exporter getPopularRanking (lot 9 ter, consigne 5 : le cache porte le classement)');
        assert.equal(typeof mod.readPopularCards, 'function', 'lib/events/popular.service doit exporter readPopularCards (lot 9 ter, consigne 5)');
        const getPopularRanking = mod.getPopularRanking!;
        const ev = await stockEvent('populaires', [{ name: SIMPLE, price: 5_000, total: 12, maxPerOrder: 10 }]);
        let reads = 0;
        const read = async (): Promise<string[]> => {
            reads += 1;
            return [ev.eventId];
        };
        const t0 = Date.now();
        assert.deepEqual(await getPopularRanking({ now: () => t0, read }), [ev.eventId], 'classement lu une fois, gardé 60 s');
        const first = (await mod.getPopularEvents()).find((c) => c.id === ev.eventId);
        assert.ok(first, 'carte de l’événement dans Populaires (classement en cache)');
        assert.equal(first.stock, null, 'avant la vente : aucun badge');
        await buy(ev, SIMPLE, 12);
        assert.ok(Date.now() - t0 < 60_000, 'garde-fou : la vente tient dans les 60 s du cache');
        const second = (await mod.getPopularEvents()).find((c) => c.id === ev.eventId);
        assert.ok(second, 'carte toujours servie');
        assert.equal(second.stock, 'SOLD_OUT', 'la catégorie épuisée apparaît aussitôt sur la carte');
        assert.deepEqual(await getPopularRanking({ now: () => t0 + 59_000, read }), [ev.eventId], 'classement servi par le cache');
        assert.equal(reads, 1, 'le classement n’est pas relu dans les 60 s');
    });

    test('course : deux ventes simultanées de deux catégories laissent un résumé juste', async () => {
        const ev = await stockEvent('course', [
            { name: SIMPLE, price: 5_000, total: 2, maxPerOrder: 10 },
            { name: VIP, price: 15_000, total: 2, maxPerOrder: 10 },
        ]);
        await buy(ev, SIMPLE, 1);
        await buy(ev, VIP, 1);
        const t1 = await openConcurrentClient({ applicationName: 'ev-test-stock9ter-t1' });
        const t2 = await openConcurrentClient({ applicationName: 'ev-test-stock9ter-t2' });
        try {
            await t1.query('UPDATE public.ticket_categories SET total_quantity = sold_quantity WHERE id = $1', [ev.categories[SIMPLE].id]);
            await t1.query('SET CONSTRAINTS ALL IMMEDIATE');
            await t2.query('UPDATE public.ticket_categories SET total_quantity = sold_quantity WHERE id = $1', [ev.categories[VIP].id]);
            const done = t2.query('SET CONSTRAINTS ALL IMMEDIATE').then(() => 'done' as const);
            const waiting = waitForLockWaiters([t2.pid], 2_000).then(() => 'waiting' as const, (err: unknown) => ({ err }));
            const first = await Promise.race([done, waiting]);
            if (typeof first === 'object') assert.fail(`T2 ni terminé ni en attente de verrou après 2 s : ${String(first.err)}`);
            await t1.commit();
            await done;
            await t2.commit();
        } finally {
            await t1.close();
            await t2.close();
        }
        const row = await stateRow(ev.eventId);
        assert.deepEqual(row && { has_purchasable: row.has_purchasable, stock_level: row.stock_level }, { has_purchasable: false, stock_level: 'SOLD_OUT' },
            `résumé public après les deux ventes : ${JSON.stringify(row)}`);
    });

    test('seuil changé par le SUPERADMIN : la tranche de l’événement est recalculée dans la même transaction', async () => {
        const ev = await stockEvent('seuil', [{ name: SIMPLE, price: 5_000, total: 8, maxPerOrder: 10 }]);
        assert.equal((await stateRow(ev.eventId))?.stock_level, 'LOW', '8 places restantes, seuil 10 : LOW');
        const sa = await superadminId();
        const setThreshold = async (value: unknown, reason: string): Promise<void> => {
            const { data, error } = await service.rpc('finance_setting_set', { p_key: THRESHOLD_KEY, p_value: { value }, p_actor: sa, p_reason: reason });
            assert.equal(error, null, `finance_setting_set(${THRESHOLD_KEY}) : ${error?.message}`);
            assert.equal((data as Row | null)?.ok, true, `seuil ${JSON.stringify(value)} : ${JSON.stringify(data)}`);
        };
        const { data: savedRow, error } = await service.from('platform_settings').select('value').eq('key', THRESHOLD_KEY).single();
        assert.equal(error, null, `réglage ${THRESHOLD_KEY} : ${error?.message}`);
        const saved = (savedRow.value as { value?: unknown }).value;
        await setThreshold(5, 'test du lot 9 ter (stock public)');
        try {
            assert.equal((await stateRow(ev.eventId))?.stock_level, 'AVAILABLE', 'seuil 5 : AVAILABLE');
        } finally {
            await setThreshold(saved, 'restauration après un test du lot 9 ter (stock public)');
        }
        assert.equal((await stateRow(ev.eventId))?.stock_level, 'LOW', 'seuil restauré : LOW');
    });

    test('écrans : badges hors de l’affiche, aide de catégorie, relecture des sections de l’accueil', () => {
        const cardSrc = readSource('components/events/EventCard.tsx');
        const image = cardSrc.indexOf('<Image');
        assert.ok(image >= 0, 'affiche de la carte (<Image)');
        const posterEnd = cardSrc.indexOf('</div>', image);
        assert.ok(posterEnd > image, 'bloc de l’affiche fermé');
        const complete = cardSrc.search(/<Badge\s+variant="danger"\s*>\s*Complet\s*<\/Badge>/);
        const last = cardSrc.search(/<Badge\s+variant="warning"\s*>\s*Dernières places\s*<\/Badge>/);
        assert.ok(complete > posterEnd, 'EventCard : badge « Complet » (danger) dans le corps de la carte, jamais sur l’affiche');
        assert.ok(last > posterEnd, 'EventCard : badge « Dernières places » (warning) dans le corps de la carte, jamais sur l’affiche');
        assert.match(cardSrc, /\bstock\??\s*:/, 'EventCard : prop `stock`');
        const ticketing = readSource('components/events/EventTicketing.tsx');
        assert.ok(ticketing.includes(CATEGORY_HELP.replace(/[’]/g, '\'')), `EventTicketing : aide « ${CATEGORY_HELP} »`);
        const discovery = readSource('components/events/HomeDiscovery.tsx');
        assert.ok(/\bliveTick\b/.test(discovery), 'HomeDiscovery lit liveTick');
        assert.ok(!/\buseRealtimeRefresh\b/.test(discovery), 'HomeDiscovery n’ouvre aucun abonnement (useRealtimeRefresh)');
        assert.match(readSource('app/page.tsx'), /<HomeDiscovery\b[^>]*\bliveTick=\{/, 'app/page.tsx passe liveTick à HomeDiscovery');
    });

    test('non-régression : un événement sans épuisement ni seuil garde sa carte et son ordre', async () => {
        const plain: CategorySpec[] = [{ name: SIMPLE, price: 5_000, total: 20, maxPerOrder: 10 }];
        const a = await stockEvent('regression-a', plain, { startsInHours: 72 });
        const b = await stockEvent('regression-b', plain, { startsInHours: 96 });
        const counter = await createDraftEvent(partner, 'stock9ter-guichet-seul', [{ name: 'Guichet', price: 2_000, total: 20 }], { title: title('guichet seul'), startsInHours: 72 });
        const { error } = await service.from('ticket_categories').update({ sale_online: false, sale_counter: true }).eq('id', counter.categories.Guichet.id);
        assert.equal(error, null, `canaux de la catégorie : ${error?.message}`);
        await advanceEventTo(counter.eventId, 'PUBLIE', { partnerUserId: partner.userId });

        const list = await catalog();
        const ca = list.find((e) => e.id === a.eventId);
        assert.ok(ca, 'événement A au catalogue');
        assert.deepEqual(Object.keys(ca).sort(), [...CARD_KEYS].sort(), 'clés actuelles de la carte, plus `stock`');
        assert.deepEqual(cardView(ca), { price: 5_000, saleLabel: priceLabel(5_000), stock: null }, 'carte sans badge');
        const ids = list.map((e) => e.id);
        assert.ok(ids.indexOf(a.eventId) < ids.indexOf(b.eventId), 'ordre des dates gardé');
        const cc = list.find((e) => e.id === counter.eventId);
        assert.ok(cc, 'événement guichet seul au catalogue');
        assert.deepEqual(cardView(cc), { price: null, saleLabel: 'Vente sur place uniquement', stock: null },
            'guichet seul avec places : « Vente sur place uniquement » (cycle9bis-soumission-fiche:187-205), aucun badge');
    });
});

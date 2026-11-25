/**
 * Lot 11c-a — tables d'un événement (« Table VIP, 6 places, 150 000 F ») : une table est un lot de N billets vendu par
 * le moteur des billets (paiement de cible TICKET, frais de service finance.service_fee_rate, aucune commission).
 *
 *  A. Réglages et service : event_tables_setting_set et PUT /api/admin/finance-settings ; service fermé (404, offre
 *     vide).
 *  B. Configuration : création d'un type et de ses tables, jauge en places (QUOTA_ABOVE_CAPACITY, CAPACITY_REQUIRED),
 *     paiement en entier seulement ; un type de table n'est jamais un billet (achat, modification, écritures directes).
 *  C. Vente : devis, achat sans plan (plus petite table libre), N billets reliés et prix répartis au franc près, avis ;
 *     plan montré et double vente impossible (concurrente puis séquentielle) ; paiement tardif remboursé ; limite par
 *     compte.
 *  D. Gardes : table vendue (retrait, renumérotation), prix figé, événement en attente de validation, fiche suspendue,
 *     événement suspendu ; une place ne se rembourse jamais seule.
 *  E. Remboursements : annulation de l'événement, report de plus de 24 h (table entière, à la demande du titulaire).
 *  F. « Ma table », porte, parrainage, avis à l'administration.
 * Défauts D4, D5, D6 relevés à l'écriture de ces tests (alors marqués « todo »), corrigés ensuite : tests ordinaires.
 * Montants calculés à la main (taux de frais relu dans les réglages). Faux SamirPay seulement. Base LOCALE.
 * Fin de suite : interrupteur remis à sa valeur d'origine, puis invariants du lot (a) à (e).
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { checkLot11cInvariants } from '../helpers/lot11c-invariants';
import { randomSenegalPhone, routeContext } from './helpers';
import { cart, checkout, newBuyer, paymentById, service, type Buyer } from './paiement-helpers';
import { buyConfirmed, getSetting, jsonRequest, newPartner, superadminId, type TestPartner } from './finance-helpers';
import { platformSetting } from './l10a-helpers';
import { advanceEventTo, rpcCancel } from './cycle-helpers';
import { newAdmin } from './notif-helpers';
import { PUT as financeSettingsPut } from '../../app/api/admin/finance-settings/route';
import { POST as ticketRefundRoute } from '../../app/api/tickets/[id]/refund/route';
import {
    bookingById, bookingOfPayment, bookingsOfTable, buyTable, categoryRow, confirmByWebhook, createTableType, createdTableType, doorList,
    myTable, myTables, newTablesEvent, outbox, patchTableType, platformRefunds, postpone, reservationsOfPayment, saveTables, show, showPlan,
    switchEventTablesService, tableCategoriesOf, tableCheckout, tableOffer, tableQuote, tableRefund, tablesForSave, ticketById, transferSeat,
    transferStatus, vipType, withEventTablesSetting, type Reply, type Row,
} from './l11c-helpers';

const PRICE = 150_000;
const SEATS = 6;
const TAKEN = 'Cette table vient d’être prise, choisissez-en une autre.';

const n = (v: unknown): number => Number(v);
const sum = (rows: Row[], key: string): number => rows.reduce((s, r) => s + n(r[key]), 0);

let restore: () => Promise<void>;
let partner: TestPartner;
/** Frais de service des billets (finance.service_fee_rate, en %), relus en tête : fee(prix) = arrondi supérieur au franc. */
let feeRate: number;
const fee = (price: number): number => Math.ceil(price * feeRate / 100);

before(async () => {
    restore = await switchEventTablesService(true);
    partner = await newPartner('l11c-tables');
    feeRate = n(await getSetting('finance.service_fee_rate'));
    assert.ok(Number.isFinite(feeRate) && feeRate >= 0, `taux de frais de service lisible : ${feeRate}`);
});

after(async () => {
    if (restore) await restore();
    await checkLot11cInvariants('l11c-tables');
});

/** Prix attendus des N billets d'une table : division entière, les premiers portent le reste (triés). */
function split(amount: number, seats: number): number[] {
    const base = Math.floor(amount / seats);
    const rest = amount - base * seats;
    return Array.from({ length: seats }, (_, i) => base + (i < rest ? 1 : 0)).sort((a, b) => a - b);
}

function sorted(rows: Row[], key: string): number[] {
    return rows.map((r) => n(r[key])).sort((a, b) => a - b);
}

function typeOf(offer: Reply, typeId: string): Row {
    const t = ((offer.body.types ?? []) as Row[]).find((x) => x.id === typeId);
    assert.ok(t, `type ${typeId} dans l'offre : ${show(offer)}`);
    return t!;
}

/** Événement publié de la partenaire de la suite, avec un type VIP (6 places, 150 000 F) de `count` tables. */
async function vipEvent(label: string, count = 3, opts: { capacity?: number } = {}): Promise<{ eventId: string; title: string; typeId: string; tables: Array<{ id: string; number: number }> }> {
    const ev = await newTablesEvent(partner, label, { capacity: opts.capacity ?? 100 });
    const t = await createdTableType(partner, ev.eventId, vipType(), count);
    return { eventId: ev.eventId, title: ev.title, typeId: t.typeId, tables: t.tables };
}

// ── A. Réglages et service ────────────────────────────────────────────────────────────────────────────────────────

describe('A. Réglages du lot et service fermé', () => {
    test('réglages : event_tables_setting_set (finance_setting_set les ignore) ; PUT /api/admin/finance-settings change l’interrupteur (200, puis remis) et refuse 11 tables par compte (400)', async () => {
        const { data: viaFinance, error: fErr } = await service.rpc('finance_setting_set', {
            p_key: 'features.event_tables_enabled', p_value: { value: true }, p_actor: await superadminId(), p_reason: 'test du lot 11c-a',
        });
        assert.equal(fErr, null, fErr?.message);
        assert.equal((viaFinance as Row).code, 'UNKNOWN_KEY', `finance_setting_set ne connaît pas les clés du lot : ${JSON.stringify(viaFinance)}`);
        const max = n(await platformSetting('event_tables.max_per_account'));
        assert.ok(Number.isInteger(max) && max >= 1 && max <= 10, `event_tables.max_per_account entre 1 et 10 : ${max}`);

        const superadmin = await newAdmin('l11c-reglages', [], { role: 'SUPERADMIN' });
        const put = async (key: string, value: unknown): Promise<Reply> => {
            const res = await financeSettingsPut(jsonRequest('/api/admin/finance-settings', 'PUT', superadmin.accessToken, { key, value, reason: 'Essai du lot 11c-a' }));
            return { status: res.status, body: (await res.json()) as Row };
        };
        const initial = await platformSetting('features.event_tables_enabled');
        assert.equal(initial, true, 'service ouvert par la suite');
        const off = await put('features.event_tables_enabled', false);
        try {
            assert.equal(off.status, 200, `interrupteur fermé par la route : ${show(off)}`);
            assert.equal(await platformSetting('features.event_tables_enabled'), false, 'valeur changée en base');
        } finally {
            const on = await put('features.event_tables_enabled', true);
            assert.equal(on.status, 200, `interrupteur remis par la route : ${show(on)}`);
        }
        assert.equal(await platformSetting('features.event_tables_enabled'), true, 'valeur remise');

        const eleven = await put('event_tables.max_per_account', 11);
        assert.equal(eleven.status, 400, `11 tables par compte refusées : ${show(eleven)}`);
        assert.equal(eleven.body.code, 'INVALID_VALUE', show(eleven));
        assert.equal(n(await platformSetting('event_tables.max_per_account')), max, 'valeur inchangée');
    });

    test('service fermé : POST d’un type → 404 SERVICE_UNAVAILABLE ; offre open false, listes vides ; rouvert : offre ouverte', async () => {
        const ev = await vipEvent('ferme', 2);
        const close = await switchEventTablesService(false);
        try {
            const r = await createTableType(partner, ev.eventId, vipType(), 1);
            assert.equal(r.status, 404, `service fermé : ${show(r)}`);
            assert.equal(r.body.code, 'SERVICE_UNAVAILABLE', show(r));
            const offer = await tableOffer(ev.eventId);
            assert.equal(offer.status, 200, show(offer));
            assert.deepEqual([offer.body.open, offer.body.types, offer.body.tables, offer.body.zones], [false, [], [], []], `offre fermée : ${show(offer)}`);
            const buyer = await newBuyer('l11c-ferme');
            const c = await tableCheckout(buyer, ev.eventId, ev.typeId);
            assert.equal(c.status, 404, `achat, service fermé : ${show(c)}`);
            assert.equal(c.body.code, 'SERVICE_UNAVAILABLE', show(c));
        } finally {
            await close();
        }
        const offer = await tableOffer(ev.eventId);
        assert.equal(offer.body.open, true, `offre rouverte : ${show(offer)}`);
        assert.equal(n(typeOf(offer, ev.typeId).remaining_tables), 2, show(offer));
    });
});

// ── B. Configuration ──────────────────────────────────────────────────────────────────────────────────────────────

describe('B. Types de tables et jauge en places', () => {
    test('création d’un type (6 places, 150 000 F, 3 tables) : 201, tables 1, 2, 3 ; catégorie TABLE jamais vendue en ligne ni au guichet', async () => {
        const ev = await newTablesEvent(partner, 'creation');
        const r = await createTableType(partner, ev.eventId, vipType({ onsite_note: 'Minimum 2 bouteilles sur place' }), 3);
        assert.equal(r.status, 201, show(r));
        assert.deepEqual(((r.body.tables ?? []) as Row[]).map((t) => n(t.number)), [1, 2, 3], show(r));
        const type = await categoryRow(String((r.body.type as Row).id));
        assert.deepEqual(
            [type.kind, n(type.seats_per_unit), n(type.price), n(type.total_quantity), n(type.sold_quantity), type.sale_online, type.sale_counter, type.payment_mode, n(type.max_per_order)],
            ['TABLE', SEATS, PRICE, 3, 0, false, false, 'FULL', 1], `type en base : ${JSON.stringify(type)}`);
        assert.equal(type.onsite_note, 'Minimum 2 bouteilles sur place');
        const second = await createTableType(partner, ev.eventId, vipType({ name: 'Carré', seats: 4, price: 80_000 }), 2);
        assert.equal(second.status, 201, show(second));
        assert.deepEqual(((second.body.tables ?? []) as Row[]).map((t) => n(t.number)), [4, 5], 'numéros suivants libres de l’événement');
    });

    test('jauge en places : capacité trop petite → 409 QUOTA_ABOVE_CAPACITY (message en places, rien d’écrit) ; capacité absente → CAPACITY_REQUIRED ; acompte → 400 PAYMENT_MODE_UNAVAILABLE', async () => {
        // 20 billets + 2 tables de 6 places = 32 places > capacité 30
        const ev = await newTablesEvent(partner, 'jauge', { capacity: 30, tickets: 20 });
        const over = await createTableType(partner, ev.eventId, vipType(), 2);
        assert.equal(over.status, 409, show(over));
        assert.equal(over.body.code, 'QUOTA_ABOVE_CAPACITY', show(over));
        const msg = String(over.body.error);
        assert.match(msg, /32 places/, `total en places : ${msg}`);
        assert.match(msg, /20 en billets/, msg);
        assert.match(msg, /12 aux tables/, msg);
        assert.match(msg, /actuellement 30/, msg);
        assert.deepEqual(await tableCategoriesOf(ev.eventId), [], 'aucun type écrit (tout ou rien)');
        const fits = await createTableType(partner, ev.eventId, vipType(), 1);
        assert.equal(fits.status, 201, `20 + 6 = 26 places ≤ 30 : ${show(fits)}`);

        const open = await newTablesEvent(partner, 'sans-capacite', { capacity: null });
        const noCap = await createTableType(partner, open.eventId, vipType(), 1);
        assert.equal(noCap.status, 409, show(noCap));
        assert.equal(noCap.body.code, 'CAPACITY_REQUIRED', show(noCap));

        const deposit = await createTableType(partner, ev.eventId, vipType({ payment_mode: 'DEPOSIT' }), 1);
        assert.equal(deposit.status, 400, show(deposit));
        assert.equal(deposit.body.code, 'PAYMENT_MODE_UNAVAILABLE', show(deposit));
    });

    test('un type de table n’est jamais vendu comme billet : /api/checkout → CATEGORY_NOT_SOLD_ONLINE ; ticket_category_update → TABLE_TYPE ; écritures directes par la clé de service → EVT11', async () => {
        const ev = await vipEvent('jamais-billet', 2);
        const buyer = await newBuyer('l11c-billet');
        const res = await checkout(buyer, cart(ev.eventId, [[ev.typeId, 1]], buyer));
        assert.equal(res.status, 400, `achat du type comme billet : HTTP ${res.status} ${JSON.stringify(res.body)}`);
        const codes = ((res.body.problems ?? []) as Row[]).map((p) => p.code);
        assert.ok(codes.includes('CATEGORY_NOT_SOLD_ONLINE'), `CATEGORY_NOT_SOLD_ONLINE : ${JSON.stringify(res.body)}`);
        assert.equal(res.payment, null, 'aucun paiement');

        const { data: upd, error: updErr } = await service.rpc('ticket_category_update', {
            p: { event_id: ev.eventId, category_id: ev.typeId, actor_id: partner.userId, patch: { price: 1_000 } },
        });
        assert.equal(updErr, null, updErr?.message);
        assert.equal((upd as Row).code, 'TABLE_TYPE', `ticket_category_update sur un type : ${JSON.stringify(upd)}`);

        const expectEvt11 = (what: string, error: { code?: string; message?: string } | null): void => {
            assert.ok(error, `${what} : écriture acceptée`);
            assert.equal(error!.code, 'EVT11', `${what} : ${error!.code} ${error!.message}`);
        };
        const ins = await service.from('ticket_categories').insert({
            event_id: ev.eventId, name: `TEST direct ${randomUUID().slice(0, 6)}`, price: 10_000, total_quantity: 1, sold_quantity: 0,
            kind: 'TABLE', seats_per_unit: 4, sale_online: false, sale_counter: false, is_visible: false, max_per_order: 1,
        }).select('id');
        expectEvt11('insertion d’un type de table', ins.error);
        expectEvt11('prix d’un type de table', (await service.from('ticket_categories').update({ price: 1_000 }).eq('id', ev.typeId).select('id')).error);
        expectEvt11('numéro d’une table', (await service.from('event_tables').update({ number: 99 }).eq('id', ev.tables[0].id).select('id')).error);
        expectEvt11('plan montré', (await service.from('event_table_plans').upsert({ event_id: ev.eventId, plan_enabled: true }).select('event_id')).error);
        const seat = await service.from('tickets').insert({
            event_id: ev.eventId, category_id: ev.typeId, user_id: buyer.userId, ticket_number: `TCK-TEST-${randomUUID().slice(0, 10)}`,
            price: 25_000, service_fee: 0, qr_code: `EV-QR-${randomUUID().replace(/-/g, '')}`, status: 'VALIDE',
        }).select('id');
        expectEvt11('billet d’un type de table sans vente', seat.error);
        const booking = await service.from('event_table_bookings').insert({
            event_id: ev.eventId, event_table_id: ev.tables[0].id, category_id: ev.typeId, payment_id: randomUUID(), holder_id: buyer.userId,
            seats: SEATS, table_number: 1,
        }).select('id');
        expectEvt11('vente de table écrite directement', booking.error);
        assert.equal(n((await categoryRow(ev.typeId)).price), PRICE, 'prix inchangé');
    });
});

// ── C. Vente ──────────────────────────────────────────────────────────────────────────────────────────────────────

describe('C. Devis et achat d’une table', () => {
    test('devis : prix 150 000, 25 000 par personne, frais = arrondi supérieur du taux, total ; opérateur inconnu refusé', async () => {
        const ev = await vipEvent('devis', 2);
        const q = await tableQuote(ev.eventId, { typeId: ev.typeId });
        assert.equal(q.status, 200, show(q));
        const expectedFee = fee(PRICE); // 5 % : 7 500
        assert.deepEqual([n(q.body.price), n(q.body.seats), n(q.body.price_per_person), q.body.price_per_person_exact, n(q.body.service_fee), n(q.body.total)],
            [PRICE, SEATS, 25_000, true, expectedFee, PRICE + expectedFee], show(q));
        const wave = await tableQuote(ev.eventId, { typeId: ev.typeId, tableId: ev.tables[1].id, operator: 'WAVE' });
        assert.equal(wave.status, 200, show(wave));
        assert.equal(n(wave.body.total), PRICE + expectedFee, 'frais de service indépendants de l’opérateur');
        assert.deepEqual([n((wave.body.table as Row).number), (wave.body.table as Row).state], [2, 'LIBRE'], show(wave));
        const bad = await tableQuote(ev.eventId, { typeId: ev.typeId, operator: 'MTN' });
        assert.equal(bad.status, 400, show(bad));

        const odd = await createdTableType(partner, ev.eventId, vipType({ name: 'Table impaire', price: 100_001 }), 1);
        const q2 = await tableQuote(ev.eventId, { typeId: odd.typeId });
        assert.deepEqual([n(q2.body.price_per_person), q2.body.price_per_person_exact], [16_667, false], `100 001 / 6 arrondi au franc : ${show(q2)}`);
    });

    test('achat sans plan : la plus petite table libre (1), attente puis paiement confirmé → 1 vente ACTIVE, 6 billets VALIDE reliés, prix répartis, avis EVENT_TABLE_CONFIRMED ; choix d’une table sans plan → 400 TABLE_CHOICE_UNAVAILABLE', async () => {
        const ev = await vipEvent('sans-plan', 3);
        const buyer = await newBuyer('l11c-achat');
        const started = await tableCheckout(buyer, ev.eventId, ev.typeId);
        assert.equal(started.status, 200, show(started));
        const expectedFee = fee(PRICE);
        assert.equal(n(started.payment!.amount), PRICE + expectedFee, 'montant relu en base : prix + frais');
        assert.deepEqual([started.payment!.status, started.payment!.payment_target, n(started.payment!.facial_amount), n(started.payment!.service_fee)],
            ['PENDING', 'TICKET', PRICE, expectedFee], JSON.stringify(started.payment));
        assert.deepEqual([n((started.body.table as Row).number), n((started.body.table as Row).seats)], [1, SEATS], show(started));
        assert.ok(started.body.expires_at, 'fin de la garde de la table');
        const held = await reservationsOfPayment(started.payment!.id);
        assert.deepEqual(held.map((r) => [r.status, r.event_table_id, n(r.quantity)]), [['ACTIVE', ev.tables[0].id, 1]], 'attente de la table 1');
        const pendingOffer = await tableOffer(ev.eventId);
        assert.equal(n(typeOf(pendingOffer, ev.typeId).remaining_tables), 2, `table en attente comptée prise : ${show(pendingOffer)}`);

        const payment = await confirmByWebhook(started.payment!);
        assert.equal(payment.status, 'SUCCESS', JSON.stringify(payment.metadata));
        const booking = await bookingOfPayment(payment.id);
        assert.ok(booking, 'vente écrite');
        assert.deepEqual([booking!.status, booking!.event_table_id, n(booking!.table_number), n(booking!.seats), booking!.holder_id],
            ['ACTIVE', ev.tables[0].id, 1, SEATS, buyer.userId], JSON.stringify(booking));
        const { data: tickets, error } = await service.from('tickets').select('*').eq('payment_id', payment.id);
        assert.equal(error, null, error?.message);
        const seats = (tickets ?? []) as Row[];
        assert.equal(seats.length, SEATS, '6 billets');
        assert.ok(seats.every((t) => t.status === 'VALIDE' && t.event_table_booking_id === booking!.id && t.user_id === buyer.userId && t.category_id === ev.typeId),
            `billets VALIDE reliés à la vente : ${JSON.stringify(seats.map((t) => [t.status, t.event_table_booking_id, t.user_id]))}`);
        assert.deepEqual(sorted(seats, 'price'), split(PRICE, SEATS), 'prix de la table réparti (25 000 chacun)');
        assert.equal(sum(seats, 'price'), PRICE, 'Σ prix = prix de la table');
        assert.deepEqual(sorted(seats, 'service_fee'), split(expectedFee, SEATS), 'frais répartis au franc près');
        const type = await categoryRow(ev.typeId);
        assert.deepEqual([n(type.sold_quantity), n(type.held_quantity)], [1, 0], 'une table vendue, aucune en attente');

        const notices = await outbox({ type: 'EVENT_TABLE_CONFIRMED', userId: buyer.userId });
        assert.ok(notices.length >= 1, 'avis EVENT_TABLE_CONFIRMED en file pour l’acheteuse');
        assert.ok(notices.every((r) => (r.template_data as Row).payment_id === payment.id), JSON.stringify(notices.map((r) => r.template_data)));
        assert.deepEqual(await outbox({ type: 'PURCHASE_CONFIRMED', userId: buyer.userId }), [], 'aucun avis d’achat de billets pour une table');

        const offer = await tableOffer(ev.eventId);
        assert.equal(n(typeOf(offer, ev.typeId).remaining_tables), 2, show(offer));
        const other = await newBuyer('l11c-choix');
        const choice = await tableCheckout(other, ev.eventId, ev.typeId, { tableId: ev.tables[2].id });
        assert.equal(choice.status, 400, show(choice));
        assert.equal(choice.body.code, 'TABLE_CHOICE_UNAVAILABLE', show(choice));
        assert.equal(choice.payment, null, 'aucun paiement');
    });

    test('répartition au franc près : 100 001 F pour 6 places → cinq billets à 16 667 et un à 16 666 ; frais idem', async () => {
        const ev = await newTablesEvent(partner, 'franc');
        const odd = await createdTableType(partner, ev.eventId, vipType({ price: 100_001 }), 1);
        const bought = await buyTable(await newBuyer('l11c-franc'), ev.eventId, odd.typeId);
        assert.deepEqual(sorted(bought.tickets, 'price'), [16_666, 16_667, 16_667, 16_667, 16_667, 16_667], 'prix répartis');
        assert.equal(sum(bought.tickets, 'price'), 100_001);
        assert.deepEqual(sorted(bought.tickets, 'service_fee'), split(fee(100_001), SEATS), 'frais répartis');
        assert.equal(sum(bought.tickets, 'service_fee'), n(bought.payment.service_fee));
    });

    test('double vente impossible : plan montré, deux acheteurs simultanés sur la même table → un seul l’obtient, l’autre 409 TABLE_TAKEN ; ensuite (attente puis vente) → TABLE_TAKEN', async () => {
        const ev = await vipEvent('double', 3);
        await showPlan(partner, ev.eventId);
        const target = ev.tables[1];
        const [a, b] = [await newBuyer('l11c-double-a'), await newBuyer('l11c-double-b')];
        const results = await Promise.all([tableCheckout(a, ev.eventId, ev.typeId, { tableId: target.id }), tableCheckout(b, ev.eventId, ev.typeId, { tableId: target.id })]);
        const won = results.filter((r) => r.status === 200);
        const lost = results.filter((r) => r.status !== 200);
        assert.equal(won.length, 1, `un seul achat accepté : ${results.map(show).join(' | ')}`);
        assert.equal(lost.length, 1, results.map(show).join(' | '));
        assert.deepEqual([lost[0].status, lost[0].body.code, lost[0].body.error], [409, 'TABLE_TAKEN', TAKEN], show(lost[0]));
        assert.equal(lost[0].payment, null, 'aucun paiement pour le perdant');
        assert.equal(n((won[0].body.table as Row).number), target.number, 'table choisie');

        const plan = await tableOffer(ev.eventId);
        const state = ((plan.body.tables ?? []) as Row[]).find((t) => t.id === target.id);
        assert.equal(state?.state, 'PRISE', `table en attente grisée sur le plan : ${show(plan)}`);
        const c = await newBuyer('l11c-double-c');
        const third = await tableCheckout(c, ev.eventId, ev.typeId, { tableId: target.id });
        assert.deepEqual([third.status, third.body.code, third.body.error], [409, 'TABLE_TAKEN', TAKEN], show(third));

        const paid = await confirmByWebhook(won[0].payment!);
        assert.equal(paid.status, 'SUCCESS');
        const d = await newBuyer('l11c-double-d');
        const fourth = await tableCheckout(d, ev.eventId, ev.typeId, { tableId: target.id });
        assert.deepEqual([fourth.status, fourth.body.code], [409, 'TABLE_TAKEN'], show(fourth));
        const sold = await bookingsOfTable(target.id);
        assert.deepEqual(sold.map((x) => [x.status, x.holder_id]), [['ACTIVE', paid.client_id]], 'une seule vente de la table');
        const free = await tableCheckout(c, ev.eventId, ev.typeId, { tableId: ev.tables[2].id });
        assert.equal(free.status, 200, `une autre table reste libre : ${show(free)}`);
    });

    test('paiement tardif : attente échue, table vendue à un autre, puis succès chez SamirPay → REFUND_PENDING, aucune vente, remboursement entier', async () => {
        const ev = await vipEvent('tardif', 1);
        const late = await newBuyer('l11c-tardif');
        const started = await tableCheckout(late, ev.eventId, ev.typeId);
        assert.equal(started.status, 200, show(started));
        const { error: upErr } = await service.from('stock_reservations').update({ expires_at: new Date(Date.now() - 60_000).toISOString() }).eq('payment_id', started.payment!.id);
        assert.equal(upErr, null, upErr?.message);
        const { error: expErr } = await service.rpc('stock_reservations_expire');
        assert.equal(expErr, null, expErr?.message);
        assert.deepEqual((await reservationsOfPayment(started.payment!.id)).map((r) => r.status), ['EXPIRED']);
        const rival = await buyTable(await newBuyer('l11c-tardif-rival'), ev.eventId, ev.typeId);
        assert.equal(rival.booking.event_table_id, ev.tables[0].id, 'la table libérée est revendue');

        const paid = await confirmByWebhook(started.payment!);
        assert.equal(paid.status, 'REFUND_PENDING', `paiement tardif : ${paid.status} ${JSON.stringify(paid.metadata)}`);
        assert.match(String((paid.metadata as Row).refund_reason), /table/, JSON.stringify(paid.metadata));
        assert.equal(await bookingOfPayment(paid.id), null, 'aucune vente pour le paiement tardif');
        const { data: tk } = await service.from('tickets').select('id').eq('payment_id', paid.id);
        assert.deepEqual(tk ?? [], [], 'aucun billet');
        const refunds = await platformRefunds(paid.id);
        assert.deepEqual(refunds.map((r) => n(r.amount)), [PRICE + fee(PRICE)], 'remboursement entier, frais compris');
        assert.deepEqual((await bookingsOfTable(ev.tables[0].id)).map((x) => x.holder_id), [rival.payment.client_id], 'la vente du rival reste seule');
    });

    test('limite par compte : event_tables.max_per_account = 1 → la 2e table → 409 TABLE_LIMIT', async () => {
        const ev = await vipEvent('limite', 3);
        const buyer = await newBuyer('l11c-limite');
        await withEventTablesSetting('event_tables.max_per_account', 1, async () => {
            await buyTable(buyer, ev.eventId, ev.typeId);
            const second = await tableCheckout(buyer, ev.eventId, ev.typeId);
            assert.equal(second.status, 409, show(second));
            assert.equal(second.body.code, 'TABLE_LIMIT', show(second));
            assert.equal(second.payment, null, 'aucun paiement');
        });
    });
});

// ── D. Gardes ─────────────────────────────────────────────────────────────────────────────────────────────────────

describe('D. Gardes de la configuration et de la vente', () => {
    test('table vendue : PUT qui la retire ou la renumérote → 409 TABLE_SOLD ; prix d’un type vendu → 409 PRICE_LOCKED_AFTER_SALES ; nom modifiable', async () => {
        const ev = await vipEvent('vendue', 3);
        const bought = await buyTable(await newBuyer('l11c-vendue'), ev.eventId, ev.typeId);
        const soldId = String(bought.booking.event_table_id);
        const all = await tablesForSave(partner, ev.eventId);
        const removed = await saveTables(partner, ev.eventId, { plan_enabled: false, tables: all.filter((t) => t.id !== soldId), zones: [] });
        assert.deepEqual([removed.status, removed.body.code], [409, 'TABLE_SOLD'], show(removed));
        const renumbered = await saveTables(partner, ev.eventId, { plan_enabled: false, tables: all.map((t) => (t.id === soldId ? { ...t, number: 42 } : t)), zones: [] });
        assert.deepEqual([renumbered.status, renumbered.body.code], [409, 'TABLE_SOLD'], show(renumbered));
        const freeRemoved = await saveTables(partner, ev.eventId, { plan_enabled: false, tables: all.filter((t) => t.id !== ev.tables[2].id), zones: [] });
        assert.equal(freeRemoved.status, 200, `une table libre se retire : ${show(freeRemoved)}`);
        assert.equal(n((await categoryRow(ev.typeId)).total_quantity), 2, 'nombre de tables du type recalculé');

        const price = await patchTableType(partner, ev.eventId, ev.typeId, { price: 120_000 });
        assert.deepEqual([price.status, price.body.code], [409, 'PRICE_LOCKED_AFTER_SALES'], show(price));
        const seats = await patchTableType(partner, ev.eventId, ev.typeId, { seats: 8 });
        assert.deepEqual([seats.status, seats.body.code], [409, 'PRICE_LOCKED_AFTER_SALES'], show(seats));
        const name = await patchTableType(partner, ev.eventId, ev.typeId, { name: 'Table VIP Or' });
        assert.equal(name.status, 200, show(name));
        assert.equal(n((await categoryRow(ev.typeId)).price), PRICE, 'prix inchangé');
    });

    test('événement EN_ATTENTE → 409 WITHDRAW_TO_EDIT ; fiche partenaire SUSPENDU → 403 PARTNER_SUSPENDED', async () => {
        const pending = await newTablesEvent(partner, 'en-attente', { status: 'EN_ATTENTE' });
        const r = await createTableType(partner, pending.eventId, vipType(), 1);
        assert.deepEqual([r.status, r.body.code], [409, 'WITHDRAW_TO_EDIT'], show(r));

        const owner = await newPartner('l11c-suspendue');
        const ev = await newTablesEvent(owner, 'fiche-suspendue');
        const t = await createdTableType(owner, ev.eventId, vipType(), 1);
        const { error } = await service.from('partners').update({ status: 'SUSPENDU' }).eq('id', owner.partnerId);
        assert.equal(error, null, error?.message);
        try {
            const add = await createTableType(owner, ev.eventId, vipType(), 1);
            assert.deepEqual([add.status, add.body.code], [403, 'PARTNER_SUSPENDED'], show(add));
            const patch = await patchTableType(owner, ev.eventId, t.typeId, { name: 'Autre nom' });
            assert.deepEqual([patch.status, patch.body.code], [403, 'PARTNER_SUSPENDED'], show(patch));
            const save = await saveTables(owner, ev.eventId, { plan_enabled: false, tables: [], zones: [] });
            assert.deepEqual([save.status, save.body.code], [403, 'PARTNER_SUSPENDED'], show(save));
            assert.equal(n((await categoryRow(t.typeId)).total_quantity), 1, 'tables inchangées');
        } finally {
            const { error: back } = await service.from('partners').update({ status: 'VALIDE' }).eq('id', owner.partnerId);
            assert.equal(back, null, back?.message);
        }
    });

    test('événement SUSPENDU : achat → 409 EVENT_SUSPENDED, offre fermée ; configuration → 409 EVENT_SUSPENDED', async () => {
        const ev = await vipEvent('evt-suspendu', 2);
        await advanceEventTo(ev.eventId, 'SUSPENDU', { partnerUserId: partner.userId });
        const buyer = await newBuyer('l11c-suspendu');
        const c = await tableCheckout(buyer, ev.eventId, ev.typeId);
        assert.deepEqual([c.status, c.body.code], [409, 'EVENT_SUSPENDED'], show(c));
        assert.equal(c.payment, null, 'aucun paiement');
        const offer = await tableOffer(ev.eventId);
        assert.equal(offer.body.open, false, show(offer));
        assert.equal((offer.body.refusal as Row | null)?.code, 'EVENT_SUSPENDED', show(offer));
        const add = await createTableType(partner, ev.eventId, vipType(), 1);
        assert.deepEqual([add.status, add.body.code], [409, 'EVENT_SUSPENDED'], show(add));
    });

    test('une place ne se rembourse pas seule : ticket_refund_request (organisatrice, titulaire) → TABLE_SEAT_NOT_ALONE ; route du porteur : rien de remboursé', async () => {
        const ev = await vipEvent('place-seule', 1);
        const holder = await newBuyer('l11c-place');
        const bought = await buyTable(holder, ev.eventId, ev.typeId);
        const seat = bought.tickets[0];
        for (const actor of [partner.userId, holder.userId, await superadminId()]) {
            const { data, error } = await service.rpc('ticket_refund_request', { p_ticket_id: seat.id, p_actor: actor, p_reason: 'Essai du lot 11c-a' });
            assert.equal(error, null, error?.message);
            assert.equal((data as Row).code, 'TABLE_SEAT_NOT_ALONE', `acteur ${actor} : ${JSON.stringify(data)}`);
        }
        const res = await ticketRefundRoute(jsonRequest(`/api/tickets/${String(seat.id)}/refund`, 'POST', holder.accessToken, { confirm: true }), routeContext({ id: String(seat.id) }));
        assert.notEqual(res.status, 200, `route du porteur : HTTP ${res.status}`);
        assert.deepEqual(await platformRefunds(bought.payment.id), [], 'aucun remboursement');
        assert.equal((await ticketById(String(seat.id))).status, 'VALIDE', 'place toujours valable');
        assert.equal((await bookingById(String(bought.booking.id))).status, 'ACTIVE');
    });

    // Défaut D4 relevé à l'écriture des tests (route du porteur en 500), corrigé : refus connu de la route
    test('POST /api/tickets/[id]/refund sur une place de table : 409 TABLE_SEAT_NOT_ALONE (pas une erreur 500)', async () => {
        const ev = await vipEvent('place-route', 1);
        const holder = await newBuyer('l11c-place-route');
        const bought = await buyTable(holder, ev.eventId, ev.typeId);
        const id = String(bought.tickets[0].id);
        const res = await ticketRefundRoute(jsonRequest(`/api/tickets/${id}/refund`, 'POST', holder.accessToken, { confirm: true }), routeContext({ id }));
        const body = (await res.json()) as Row;
        assert.deepEqual([res.status, body.code], [409, 'TABLE_SEAT_NOT_ALONE'], JSON.stringify(body));
    });

    // Défaut D5 relevé à l'écriture des tests (retrait en 500), corrigé : l'attente close perd sa table (ON DELETE SET NULL),
    // un paiement arrivé ensuite est remboursé en entier (payment_confirm : « table retirée »)
    test('retrait d’une table jamais vendue dont une attente a échu : 200, table retirée ; le paiement arrivé ensuite est remboursé', async () => {
        const ev = await vipEvent('attente-echue', 2);
        const buyer = await newBuyer('l11c-attente-echue');
        const started = await tableCheckout(buyer, ev.eventId, ev.typeId);
        assert.equal(started.status, 200, show(started));
        await service.from('stock_reservations').update({ expires_at: new Date(Date.now() - 60_000).toISOString() }).eq('payment_id', started.payment!.id);
        await service.rpc('stock_reservations_expire');
        const all = await tablesForSave(partner, ev.eventId);
        const r = await saveTables(partner, ev.eventId, { plan_enabled: false, tables: all.filter((t) => t.id !== ev.tables[0].id), zones: [] });
        assert.equal(r.status, 200, show(r));
        const { data: left, error: leftErr } = await service.from('event_tables').select('id').eq('id', ev.tables[0].id);
        assert.equal(leftErr, null, leftErr?.message);
        assert.deepEqual(left, [], 'table retirée');
        const { data: confirmed, error: confErr } = await service.rpc('payment_confirm', { p_payment_id: started.payment!.id, p_source: 'TEST' });
        assert.equal(confErr, null, confErr?.message);
        assert.equal((confirmed as Row).result, 'REFUND_REQUIRED', `paiement après le retrait de la table : ${JSON.stringify(confirmed)}`);
        assert.equal(sum(await platformRefunds(started.payment!.id), 'amount'), PRICE + fee(PRICE), 'remboursé en entier');
    });
});

// ── E. Remboursements ─────────────────────────────────────────────────────────────────────────────────────────────

describe('D bis. Défauts relevés à l’écriture des tests (D7, D8), corrigés', () => {
    test('D7 : un billet ordinaire ne devient jamais une place de table (catégorie changée vers un type de table par la clé de service : EVT11)', async () => {
        const ev = await newTablesEvent(partner, 'd7-categorie', { capacity: 100 });
        const t = await createdTableType(partner, ev.eventId, vipType(), 1);
        const buyer = await newBuyer('l11c-d7');
        const { tickets } = await buyConfirmed(buyer, { eventId: ev.eventId, categories: { Entrée: { id: ev.ticketCategoryId, price: 5_000, total: 20 } } }, [['Entrée', 1]]);
        const { error } = await service.from('tickets').update({ category_id: t.typeId }).eq('id', String(tickets[0].id));
        assert.ok(error, 'changement de catégorie vers un type de table accepté');
        assert.equal(error!.code, 'EVT11', `${error!.code} ${error!.message}`);
        assert.equal((await ticketById(String(tickets[0].id))).category_id, ev.ticketCategoryId, 'catégorie inchangée');
    });

    test('D8 : un type de table arrêté garde ses tables vendues dans la jauge (billets en plus au-delà : QUOTA_ABOVE_CAPACITY)', async () => {
        // Capacité 40 : 20 billets + 1 table vendue de 6 places (type arrêté ensuite) = 26 ; 15 billets de plus = 41 > 40
        const ev = await newTablesEvent(partner, 'd8-jauge', { capacity: 40 });
        const t = await createdTableType(partner, ev.eventId, vipType(), 1);
        await buyTable(await newBuyer('l11c-d8'), ev.eventId, t.typeId);
        const stop = await patchTableType(partner, ev.eventId, t.typeId, { is_active: false });
        assert.equal(stop.status, 200, show(stop));
        const { data, error } = await service.rpc('ticket_category_create', { p: {
            event_id: ev.eventId, actor_id: partner.userId,
            category: { name: `Balcon ${Date.now() % 10_000}`, price: 3_000, total_quantity: 15, max_per_order: 5 },
        } });
        assert.equal(error, null, error?.message);
        assert.equal((data as Row).code, 'QUOTA_ABOVE_CAPACITY', `jauge contournée en arrêtant un type vendu : ${JSON.stringify(data)}`);
    });
});

describe('E. Annulation et report', () => {
    test('annulation de l’événement : paiement de la table remboursé en entier (PLATEFORME), 6 billets REMBOURSEMENT_EN_COURS', async () => {
        const ev = await vipEvent('annulation', 2);
        const bought = await buyTable(await newBuyer('l11c-annulation'), ev.eventId, ev.typeId);
        const call = await rpcCancel(ev.eventId, partner.userId, {
            publicNotice: 'Soirée annulée : votre table vous est remboursée en entier.', internalReason: 'Annulation de test (lot 11c-a)', confirmTitle: ev.title,
        });
        assert.equal(call.error, null, call.error?.message);
        assert.equal(call.data?.ok, true, JSON.stringify(call.data));
        const refunds = await platformRefunds(bought.payment.id);
        assert.equal(sum(refunds, 'amount'), n(bought.payment.amount), `remboursé = total payé (${n(bought.payment.amount)}) : ${JSON.stringify(refunds)}`);
        assert.equal(n(bought.payment.amount), PRICE + fee(PRICE));
        const seats = (await Promise.all(bought.tickets.map((t) => ticketById(String(t.id))))).map((t) => t.status);
        assert.deepEqual(seats, Array(SEATS).fill('REMBOURSEMENT_EN_COURS'), 'places en remboursement');
    });

    // Défaut D6 relevé à l'écriture des tests (vente restée ACTIVE), corrigé : trg_events_tables_cancelled
    test('annulation de l’événement : la vente de la table est close (REFUNDED, EVENT_CANCELLED)', async () => {
        const ev = await vipEvent('annulation-vente', 1);
        const bought = await buyTable(await newBuyer('l11c-annulation-vente'), ev.eventId, ev.typeId);
        const call = await rpcCancel(ev.eventId, partner.userId, {
            publicNotice: 'Soirée annulée : votre table vous est remboursée en entier.', internalReason: 'Annulation de test (lot 11c-a)', confirmTitle: ev.title,
        });
        assert.equal(call.data?.ok, true, JSON.stringify(call.data));
        const b = await bookingById(String(bought.booking.id));
        assert.deepEqual([b.status, b.refund_origin], ['REFUNDED', 'EVENT_CANCELLED'], JSON.stringify(b));
    });

    test('report de plus de 24 h : le titulaire rembourse la table entière (200, total), vente REFUNDED, type −1, transfert annulé ; 2e appel 409 ALREADY_REFUNDED ; autre compte 404 ; place entrée → 409 TABLE_SEAT_USED', async () => {
        const ev = await vipEvent('report', 3);
        const holder = await newBuyer('l11c-report');
        const used = await newBuyer('l11c-report-entre');
        const a = await buyTable(holder, ev.eventId, ev.typeId);
        const c = await buyTable(used, ev.eventId, ev.typeId);
        const transferId = await transferSeat(String(a.tickets[0].id), holder, randomSenegalPhone('76'));
        const early = await tableRefund(holder, String(a.booking.id));
        assert.deepEqual([early.status, early.body.code], [409, 'POSTPONEMENT_REFUND_CLOSED'], `avant le report : ${show(early)}`);

        const newStart = await postpone(partner, ev.eventId, 48);
        const mine = await myTables(holder);
        const item = ((mine.body.items ?? []) as Row[]).find((x) => x.booking_id === a.booking.id);
        assert.ok(item, show(mine));
        const refundWindow = item!.refund as Row;
        assert.deepEqual([refundWindow.open, n(refundWindow.amount), Date.parse(String(refundWindow.until))], [true, PRICE + fee(PRICE), newStart.getTime()], JSON.stringify(refundWindow));

        const stranger = await tableRefund(used, String(a.booking.id));
        assert.deepEqual([stranger.status, stranger.body.code], [404, 'NOT_FOUND'], `table d’un autre compte : ${show(stranger)}`);
        const noConfirm = await tableRefund(holder, String(a.booking.id), {});
        assert.equal(noConfirm.status, 400, show(noConfirm));

        const { error: useErr } = await service.from('tickets').update({ status: 'UTILISE' }).eq('id', String(c.tickets[0].id));
        assert.equal(useErr, null, useErr?.message);
        const seatUsed = await tableRefund(used, String(c.booking.id));
        assert.deepEqual([seatUsed.status, seatUsed.body.code], [409, 'TABLE_SEAT_USED'], show(seatUsed));
        assert.deepEqual(await platformRefunds(c.payment.id), [], 'aucun remboursement pour une table entrée');

        assert.equal(n((await categoryRow(ev.typeId)).sold_quantity), 2, 'deux tables vendues avant le remboursement');
        const ok = await tableRefund(holder, String(a.booking.id));
        assert.equal(ok.status, 200, show(ok));
        assert.equal(n(ok.body.amount), PRICE + fee(PRICE), `table entière, frais compris : ${show(ok)}`);
        const b = await bookingById(String(a.booking.id));
        assert.deepEqual([b.status, b.refund_origin], ['REFUNDED', 'POSTPONEMENT'], JSON.stringify(b));
        assert.equal(n((await categoryRow(ev.typeId)).sold_quantity), 1, 'sold_quantity du type −1');
        assert.equal(await transferStatus(transferId), 'CANCELLED', 'transfert en attente annulé');
        const states = (await Promise.all(a.tickets.map((t) => ticketById(String(t.id))))).map((t) => String(t.status));
        assert.ok(states.every((s) => ['REMBOURSEMENT_EN_COURS', 'REMBOURSE'].includes(s)), `places remboursées : ${states.join(', ')}`);
        const refunds = await platformRefunds(a.payment.id);
        assert.equal(sum(refunds, 'amount'), PRICE + fee(PRICE), JSON.stringify(refunds));
        const { data: cashouts, error: cErr } = await service.from('cashouts').select('*').eq('idempotency_key', `REFUND-${a.payment.id}`);
        assert.equal(cErr, null, cErr?.message);
        assert.deepEqual((cashouts ?? []).map((x) => [x.beneficiary_user_id, x.phone_number, n(x.amount)]), [[holder.userId, holder.phone9, PRICE + fee(PRICE)]], 'versé au compte qui a payé');

        const again = await tableRefund(holder, String(a.booking.id));
        assert.deepEqual([again.status, again.body.code], [409, 'ALREADY_REFUNDED'], show(again));
        assert.equal(sum(await platformRefunds(a.payment.id), 'amount'), PRICE + fee(PRICE), 'aucun second remboursement');
        const offer = await tableOffer(ev.eventId);
        assert.equal(n(typeOf(offer, ev.typeId).remaining_tables), 2, `la table remboursée revient en vente : ${show(offer)}`);
    });

    test('report de moins de 24 h : 409 POSTPONEMENT_REFUND_CLOSED, rien de remboursé', async () => {
        const ev = await vipEvent('report-court', 1);
        const holder = await newBuyer('l11c-report-court');
        const a = await buyTable(holder, ev.eventId, ev.typeId);
        await postpone(partner, ev.eventId, 23);
        const r = await tableRefund(holder, String(a.booking.id));
        assert.deepEqual([r.status, r.body.code], [409, 'POSTPONEMENT_REFUND_CLOSED'], show(r));
        assert.deepEqual(await platformRefunds(a.payment.id), []);
        assert.equal((await bookingById(String(a.booking.id))).status, 'ACTIVE');
    });
});

// ── F. « Ma table », porte, parrainage, avis ──────────────────────────────────────────────────────────────────────

describe('F. Ma table, porte, parrainage, avis à l’administration', () => {
    test('« Ma table » : la table, 6 places à envoyer, lien WhatsApp sans jeton (seule adresse : /events/<id>) ; une place transférée → EN_ATTENTE ; table d’un autre compte → 404', async () => {
        const ev = await vipEvent('ma-table', 2);
        const holder = await newBuyer('l11c-ma-table');
        const a = await buyTable(holder, ev.eventId, ev.typeId);
        const mine = await myTables(holder);
        assert.equal(mine.status, 200, show(mine));
        const item = ((mine.body.items ?? []) as Row[]).find((x) => x.booking_id === a.booking.id);
        assert.ok(item, show(mine));
        assert.deepEqual(item!.counts, { sent: 0, pending: 0, to_send: SEATS, entered: 0 }, JSON.stringify(item!.counts));
        assert.deepEqual([n(item!.table_number), n(item!.seats), n(item!.total)], [1, SEATS, PRICE + fee(PRICE)], JSON.stringify(item));

        const appUrl = String(process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/+$/, '');
        assert.ok(appUrl, 'NEXT_PUBLIC_APP_URL définie');
        const wa = String(item!.whatsapp_url);
        assert.ok(wa.startsWith('https://wa.me/?text='), wa);
        const text = decodeURIComponent(wa.slice('https://wa.me/?text='.length));
        assert.deepEqual(text.match(/https?:\/\/\S+/g), [`${appUrl}/events/${ev.eventId}`], `seule adresse du message : ${text}`);
        assert.ok(!/[?&]t=/.test(text), `aucun jeton : ${text}`);
        for (const t of a.tickets) {
            assert.ok(!text.includes(String(t.qr_code)) && !text.includes(String(t.ticket_number)) && !text.includes(String(t.id)), 'ni code, ni numéro, ni identifiant de billet');
        }

        const other = await newBuyer('l11c-ma-table-autre');
        const foreign = await myTable(other, String(a.booking.id));
        assert.deepEqual([foreign.status, foreign.body.code], [404, 'NOT_FOUND'], show(foreign));
        const own = await myTable(holder, String(a.booking.id));
        assert.equal(own.status, 200, show(own));
        assert.equal((own.body.table as Row).booking_id, a.booking.id);

        const to = randomSenegalPhone('76');
        await transferSeat(String(a.tickets[0].id), holder, to);
        const later = await myTables(holder);
        const it = ((later.body.items ?? []) as Row[]).find((x) => x.booking_id === a.booking.id)!;
        const seat = ((it.seats_detail ?? []) as Row[]).find((s) => s.ticket_id === a.tickets[0].id);
        assert.equal(seat?.state, 'EN_ATTENTE', `place transférée en attente : ${JSON.stringify(it.seats_detail)}`);
        assert.deepEqual(it.counts, { sent: 0, pending: 1, to_send: SEATS - 1, entered: 0 }, JSON.stringify(it.counts));
        assert.ok(!JSON.stringify(it).includes(to.slice(4)), 'numéro de l’invité jamais rendu en entier');
    });

    test('porte : la propriétaire voit les tables vendues (« Awa A. »), jamais de téléphone ; un client quelconque → 403', async () => {
        const ev = await vipEvent('porte', 2);
        const holder = await newBuyer('l11c-porte', { firstName: 'Awa', lastName: 'Aidara' });
        await buyTable(holder, ev.eventId, ev.typeId);
        const door = await doorList(partner, ev.eventId);
        assert.equal(door.status, 200, show(door));
        const items = (door.body.items ?? []) as Row[];
        assert.deepEqual(items.map((x) => [n(x.table_number), x.holder, n(x.seats), n(x.entered)]), [[1, 'Awa A.', SEATS, 0]], show(door));
        const raw = JSON.stringify(door.body);
        for (const secret of [holder.phone9, holder.phoneE164, holder.email, 'Aidara']) assert.ok(!raw.includes(secret), `la liste ne contient pas « ${secret} »`);
        const stranger = await doorList(await newBuyer('l11c-porte-intrus'), ev.eventId);
        assert.deepEqual([stranger.status, stranger.body.code], [403, 'FORBIDDEN'], show(stranger));
    });

    test('parrainage : la vente d’une table rapporte au parrain sa commission N1, comme un billet (taux × revenu net)', async () => {
        const ev = await vipEvent('parrainage', 1);
        const sponsor = await newBuyer('l11c-parrain', { firstName: 'Ibrahima', lastName: 'Parrain' });
        const filleul = await newBuyer('l11c-filleul', { firstName: 'Khady', lastName: 'Filleule' });
        const { error } = await service.from('referral_relationships').insert({
            sponsor_id: sponsor.userId, referred_id: filleul.userId, referral_type: 'CLIENT_TO_CLIENT', sponsor_status_at_creation: 'STANDARD',
            rate_n1_at_creation: 5, rate_n2_at_creation: 2, duration_months: 12, expires_at: new Date(Date.now() + 365 * 24 * 3600_000).toISOString(), is_active: true,
        });
        assert.equal(error, null, `relation de parrainage : ${error?.message}`);
        const bought = await buyTable(filleul, ev.eventId, ev.typeId);
        const pay = await paymentById(bought.payment.id);
        const net = n(pay.net_event_village_revenue);
        assert.ok(net > 0, `paiement de table éligible (revenu net ${net})`);
        const { data, error: cErr } = await service.from('referral_commissions').select('*').eq('payment_id', pay.id);
        assert.equal(cErr, null, cErr?.message);
        const rows = (data ?? []) as Row[];
        assert.deepEqual(rows.map((r) => [r.generation, r.sponsor_id, n(r.amount)]), [['N1', sponsor.userId, Math.round(net * 5) / 100]], `commission N1 = 5 % de ${net} : ${JSON.stringify(rows)}`);
    });

    test('avis à l’administration : un type ajouté sur un événement PUBLIE met ADMIN_EVENT_TABLES_CHANGED en file, jamais ADMIN_EVENT_CHANGED', async () => {
        const ev = await newTablesEvent(partner, 'avis-admin');
        const ticketAlerts = (await outbox({ type: 'ADMIN_EVENT_CHANGED', eventId: ev.eventId })).length;
        const tablesBefore = (await outbox({ type: 'ADMIN_EVENT_TABLES_CHANGED', eventId: ev.eventId })).length;
        await createdTableType(partner, ev.eventId, vipType(), 2);
        const changed = await outbox({ type: 'ADMIN_EVENT_TABLES_CHANGED', eventId: ev.eventId });
        assert.ok(changed.length > tablesBefore, 'ADMIN_EVENT_TABLES_CHANGED en file');
        assert.equal((await outbox({ type: 'ADMIN_EVENT_CHANGED', eventId: ev.eventId })).length, ticketAlerts, 'aucune alerte de catégorie de billets pour un type de table');

        const draft = await newTablesEvent(partner, 'avis-brouillon', { status: 'BROUILLON' });
        await createdTableType(partner, draft.eventId, vipType(), 1);
        assert.deepEqual(await outbox({ type: 'ADMIN_EVENT_TABLES_CHANGED', eventId: draft.eventId }), [], 'brouillon : aucun avis');
    });
});

/**
 * Lot 9 bis, tâche 4 (R20, §76 ; contrat 5.4, B22, 4.1) — ventes au guichet à l'annulation : jamais remboursées par la
 * plateforme ; l'écran d'annulation donne leur nombre et leur montant (event_cancellation_impact.counter) ; une liste
 * « Espèces à rembourser par l'organisateur », calculée en direct (paiements hors plateforme SUCCESS de l'événement),
 * permet à la seule propriétaire de cocher « Remboursé », idempotent, irréversible, journalisé (CASH_REFUND_MARKED) ;
 * l'admin lit sans case ; le suivi compte les espèces (event_cancellation_progress.counter_cash).
 *
 * Rouge avant correctif : l'impact ne lit que les billets VALIDE (M/20261102000003:724) — les billets du guichet sont
 * UTILISE, aucun champ `counter` ; les routes GET /api/partner/events/[id]/cash-refunds et
 * POST …/cash-refunds/[paymentId] n'existent pas (l'import dynamique les nomme) ; le suivi n'a pas `counter_cash`.
 * Vert dès l'écriture (témoin, signalé) : l'annulation ne crée aucun versement pour un paiement au guichet
 * (M/20261106000003:388-406) ; garde-fou : la liste et le marquage, rouges, portent la règle §76.
 * Caisse ouverte avec le PIN régisseur (A11) : PIN généré par la propriétaire puis passé à l'ouverture (aide locale,
 * indépendante de l'adaptation de acces-helpers.ts par RC).
 * Les cas se suivent sur une même vente (avant l'annulation, annulation, marquage, lecture admin, suivi).
 * Fin de suite : assertLot9bisInvariants (w21 : aucune marque d'espèces sur un paiement en ligne).
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { assertLot9bisInvariants } from '../helpers/lot9bis-invariants';
import { service, type Buyer, type SaleEvent } from './paiement-helpers';
import { jsonRequest, newPartner, paymentRow, type TestPartner } from './finance-helpers';
import { authed, createTimedEvent, newController, type RouteResult } from './acces-helpers';
import { assertRpcOk, eventStatus, rpcCancel, type RpcCall, type RpcBody } from './cycle-helpers';
import { invoke, routeHandler, show } from './pilotage-helpers';
import { newAdminWith } from './terrain-helpers';

type Row = Record<string, unknown>;

const PRICE = 3_000;
const CASH_LIST_ROUTE = '../../app/api/partner/events/[id]/cash-refunds/route';
const CASH_MARK_ROUTE = '../../app/api/partner/events/[id]/cash-refunds/[paymentId]/route';
const PIN_ROUTE = '../../app/api/partner/events/[id]/regisseur-pin/route';
const OPEN_ROUTE = '../../app/api/controller/shifts/open/route';
const COUNTER_ROUTE = '../../app/api/controller/counter-sale/route';
const MARK_HINT = 'table event_cash_refund_marks (migration 20261109000006_lot9bis_argent, contrat 5.4)';

let partner: TestPartner;
let stranger: TestPartner;
let ev: SaleEvent;
let seller: Buyer;
let shiftId: string;
/** Paiements des deux ventes au guichet, dans l'ordre : 1 billet, puis 2. */
let sales: Row[] = [];

before(async () => {
    partner = await newPartner('guichet-annul');
    stranger = await newPartner('guichet-etranger');
    ev = await createTimedEvent(partner.partnerId, 'guichet-annul', [{ name: 'Standard', price: PRICE, total: 30 }]);
    seller = await newController(partner, ev.eventId, { canAcceptCash: true, label: 'guichet-annul' });
    shiftId = await openShiftWithPin(seller, ev.eventId);
    for (const quantity of [1, 2]) {
        const res = await counterSale(seller, quantity);
        assert.equal(res.status, 200, `vente au guichet de ${quantity} billet(s) : ${show(res)}`);
    }
    const { data, error } = await service.from('payments').select('*').eq('shift_id', shiftId).order('created_at');
    assert.equal(error, null, `paiements de la caisse : ${error?.message}`);
    sales = (data ?? []) as Row[];
    assert.equal(sales.length, 2, `deux ventes au guichet rattachées à la caisse (trouvé ${sales.length})`);
    assert.deepEqual(sales.map((p) => [p.is_platform_payment, p.status, Number(p.amount)]), [[false, 'SUCCESS', PRICE], [false, 'SUCCESS', 2 * PRICE]],
        'ventes hors plateforme de 1 et 2 billets');
});

after(async () => {
    await assertLot9bisInvariants('lot9bis-guichet-annulation');
});

// ── Outils locaux ──────────────────────────────────────────────────────────

function ctx(params: Record<string, string>): { params: Promise<Record<string, string>> & Record<string, string> } {
    return { params: Object.assign(Promise.resolve(params), params) };
}

/** Caisse OUVERT du vendeur : PIN régisseur généré par la propriétaire, puis ouverture avec le PIN (A11, B51). */
async function openShiftWithPin(user: Buyer, eventId: string): Promise<string> {
    const pinHandler = await routeHandler(PIN_ROUTE, 'POST', 'POST /api/partner/events/[id]/regisseur-pin');
    const pinRes = await invoke(pinHandler, authed(`/api/partner/events/${eventId}/regisseur-pin`, 'POST', partner, { confirm: true }), ctx({ id: eventId }));
    assert.equal(pinRes.status, 200, `génération du PIN régisseur : ${show(pinRes)}`);
    const pin = String(pinRes.body.pin ?? '');
    assert.match(pin, /^\d{6}$/, `PIN renvoyé en clair une fois : ${show(pinRes)}`);
    const openHandler = await routeHandler(OPEN_ROUTE, 'POST', 'POST /api/controller/shifts/open');
    const res = await invoke(openHandler, authed('/api/controller/shifts/open', 'POST', user, {
        eventId, event_id: eventId, openingFloat: 0, opening_float_amount: 0, pin, regisseurPin: pin, regisseur_pin: pin,
    }));
    assert.equal(res.status, 200, `ouverture de la caisse avec le PIN : ${show(res)}`);
    const { data, error } = await service.from('controller_shifts').select('id').eq('controller_id', user.userId).eq('event_id', eventId).eq('status', 'OUVERT');
    assert.equal(error, null, `caisse ouverte : ${error?.message}`);
    assert.equal((data ?? []).length, 1, 'une caisse OUVERT du vendeur');
    return String(data![0].id);
}

async function counterSale(user: Buyer, quantity: number): Promise<RouteResult> {
    const handler = await routeHandler(COUNTER_ROUTE, 'POST', 'POST /api/controller/counter-sale');
    return invoke(handler, authed('/api/controller/counter-sale', 'POST', user,
        { eventId: ev.eventId, items: [{ categoryId: ev.categories.Standard.id, quantity }] }, { 'idempotency-key': randomUUID() }));
}

async function rpcJson(name: string, p: Row): Promise<RpcCall> {
    const { data, error } = await service.rpc(name, { p });
    return { data: (data ?? null) as RpcBody | null, error };
}

async function cashList(user: Buyer, eventId: string = ev.eventId): Promise<RouteResult> {
    const handler = await routeHandler(CASH_LIST_ROUTE, 'GET', 'GET /api/partner/events/[id]/cash-refunds (contrat 4.1, fix(9b.4))');
    return invoke(handler, jsonRequest(`/api/partner/events/${eventId}/cash-refunds`, 'GET', user.accessToken), ctx({ id: eventId }));
}

async function cashMark(user: Buyer, paymentId: string, note?: string): Promise<RouteResult> {
    const handler = await routeHandler(CASH_MARK_ROUTE, 'POST', 'POST /api/partner/events/[id]/cash-refunds/[paymentId] (contrat 4.1, fix(9b.4))');
    const body: Row = note === undefined ? {} : { note };
    return invoke(handler, jsonRequest(`/api/partner/events/${ev.eventId}/cash-refunds/${paymentId}`, 'POST', user.accessToken, body),
        ctx({ id: ev.eventId, paymentId }));
}

async function marks(): Promise<Row[]> {
    const { data, error } = await service.from('event_cash_refund_marks').select('*').eq('event_id', ev.eventId);
    assert.equal(error, null, `${MARK_HINT} : ${error?.message} (code ${error?.code})`);
    return (data ?? []) as Row[];
}

async function markAudits(paymentId: string): Promise<Row[]> {
    const { data, error } = await service.from('audit_logs').select('*').eq('action', 'CASH_REFUND_MARKED')
        .or(`object_id.eq.${paymentId},metadata->>payment_id.eq.${paymentId}`);
    assert.equal(error, null, `journal CASH_REFUND_MARKED : ${error?.message}`);
    return (data ?? []) as Row[];
}

function items(r: RouteResult): Row[] {
    assert.equal(r.status, 200, show(r));
    assert.ok(Array.isArray(r.body.items), `liste « items » attendue : ${show(r)}`);
    return r.body.items as Row[];
}

function itemOf(list: Row[], paymentId: unknown): Row {
    const it = list.find((i) => i.payment_id === paymentId);
    assert.ok(it, `vente ${String(paymentId)} absente de la liste : ${JSON.stringify(list)}`);
    return it;
}

function reference(paymentId: unknown): string {
    return String(paymentId).slice(0, 8).toUpperCase();
}

// ── Cas ────────────────────────────────────────────────────────────────────

describe('R20 — ventes au guichet à l’annulation', () => {
    test('R20 reproduit : impact avant l’annulation → counter = { sales: 2, tickets: 3, total: 3 × prix }', async () => {
        const impact = assertRpcOk(await rpcJson('event_cancellation_impact', { event_id: ev.eventId, actor_id: partner.userId }), 'event_cancellation_impact (propriétaire)');
        const counter = impact.counter as Row | undefined;
        assert.ok(counter && typeof counter === 'object', `R20 : impact sans les ventes au guichet (champ counter absent) : ${JSON.stringify(impact)}`);
        assert.deepEqual({ sales: Number(counter.sales), tickets: Number(counter.tickets), total: Number(counter.total) },
            { sales: 2, tickets: 3, total: 3 * PRICE }, `ventes au guichet : ${JSON.stringify(counter)}`);
    });

    test('avant l’annulation : GET cash-refunds → 409 EVENT_NOT_CANCELLED ; POST marquage → 409, aucune marque', async () => {
        const list = await cashList(partner);
        assert.equal(list.status, 409, `liste d'un événement non annulé : ${show(list)}`);
        assert.equal(list.body.code, 'EVENT_NOT_CANCELLED', show(list));
        const mark = await cashMark(partner, String(sales[0].id));
        assert.equal(mark.status, 409, `marquage sur un événement non annulé : ${show(mark)}`);
        assert.equal(mark.body.code, 'EVENT_NOT_CANCELLED', show(mark));
        assert.deepEqual(await marks(), [], 'aucune marque');
    });

    test('annulation : aucun versement pour les ventes au guichet ; GET cash-refunds → deux ventes (référence du reçu, billets, montant), total, can_mark', async () => {
        const { data: title, error } = await service.from('events').select('title').eq('id', ev.eventId).single();
        assert.equal(error, null, error?.message);
        assertRpcOk(await rpcCancel(ev.eventId, partner.userId, {
            publicNotice: 'Événement annulé par l’organisateur : les espèces sont rendues à la billetterie.',
            internalReason: 'Annulation de test du lot 9 bis (guichet)',
            confirmTitle: String(title.title),
        }), 'annulation par la propriétaire');
        assert.equal(await eventStatus(ev.eventId), 'ANNULE');

        const { data: cashouts, error: cErr } = await service.from('cashouts').select('id').in('payment_id', sales.map((p) => String(p.id)));
        assert.equal(cErr, null, cErr?.message);
        assert.deepEqual(cashouts ?? [], [], '§76 : aucun versement Mobile Money pour une vente au guichet');
        for (const p of sales) assert.equal((await paymentRow(String(p.id))).status, 'SUCCESS', 'paiement au guichet inchangé');

        const res = await cashList(partner);
        const list = items(res);
        assert.equal(list.length, 2, `deux ventes : ${show(res)}`);
        for (let i = 0; i < sales.length; i += 1) {
            const p = sales[i];
            const it = itemOf(list, p.id);
            assert.equal(Number(it.ticket_count), i + 1, `billets de la vente ${i + 1}`);
            assert.equal(Number(it.amount), Number(p.amount), `montant de la vente ${i + 1}`);
            assert.equal(it.reference, reference(p.id), 'référence du reçu COUNTER_RECEIPT');
            assert.equal(it.refunded_at ?? null, null, 'pas encore remboursée');
        }
        assert.equal(Number(res.body.count), 2, show(res));
        assert.equal(Number(res.body.total), 3 * PRICE, show(res));
        assert.equal(Number(res.body.refunded_count), 0, show(res));
        assert.equal(res.body.can_mark, true, 'la propriétaire peut cocher');
    });

    test('marquage : la propriétaire coche (marque, audit CASH_REFUND_MARKED) ; second appel 200 ALREADY_MARKED, un seul audit ; admin → 403 ; partenaire étrangère → 404 ; paiement hors liste → 404', async () => {
        const first = String(sales[0].id);
        const ok = await cashMark(partner, first, 'Espèces rendues à la billetterie');
        assert.equal(ok.status, 200, `marquage par la propriétaire : ${show(ok)}`);
        let rows = await marks();
        assert.equal(rows.length, 1, `une marque : ${JSON.stringify(rows)}`);
        assert.equal(rows[0].payment_id, first);
        assert.equal(rows[0].marked_by, partner.userId, 'marquée par la propriétaire');
        assert.equal((await markAudits(first)).length, 1, 'une ligne d’audit CASH_REFUND_MARKED');

        const again = await cashMark(partner, first);
        assert.equal(again.status, 200, `second marquage : ${show(again)}`);
        assert.equal(again.body.code, 'ALREADY_MARKED', show(again));
        rows = await marks();
        assert.equal(rows.length, 1, 'toujours une seule marque (irréversible, idempotent)');
        assert.equal((await markAudits(first)).length, 1, 'aucun second audit');

        const admin = await newAdminWith(['events.read', 'events.write', 'refunds.manage'], { label: 'guichet-admin' });
        const byAdmin = await cashMark(admin, String(sales[1].id));
        assert.equal(byAdmin.status, 403, `marquage par un admin : ${show(byAdmin)}`);
        const byStranger = await cashMark(stranger, String(sales[1].id));
        assert.equal(byStranger.status, 404, `marquage par une partenaire étrangère : ${show(byStranger)}`);
        const outOfList = await cashMark(partner, randomUUID());
        assert.equal(outOfList.status, 404, `paiement hors liste : ${show(outOfList)}`);
        const strangerList = await cashList(stranger);
        assert.equal(strangerList.status, 404, `liste lue par une partenaire étrangère : ${show(strangerList)}`);
        assert.deepEqual((await marks()).map((m) => m.payment_id), [first], 'aucune autre marque');
    });

    test('lecture admin (events.read) : liste sans case (can_mark = false), première vente « Remboursé le … par … »', async () => {
        const reader = await newAdminWith(['events.read'], { label: 'guichet-lecteur' });
        const res = await cashList(reader);
        const list = items(res);
        assert.equal(list.length, 2, show(res));
        assert.equal(res.body.can_mark, false, `l'admin lit sans case à cocher : ${show(res)}`);
        const marked = itemOf(list, sales[0].id);
        assert.ok(marked.refunded_at, `date de remboursement servie : ${JSON.stringify(marked)}`);
        assert.ok(marked.refunded_by, `auteur du remboursement servi : ${JSON.stringify(marked)}`);
        assert.equal(itemOf(list, sales[1].id).refunded_at ?? null, null, 'seconde vente non remboursée');
        assert.equal(Number(res.body.refunded_count), 1, show(res));
        assert.equal(Number(res.body.refunded_total), PRICE, show(res));
    });

    test('suivi de l’annulation : counter_cash = { count: 2, total: 3 × prix, refunded_count: 1, refunded_total: prix }', async () => {
        const progress = assertRpcOk(await rpcJson('event_cancellation_progress', { event_id: ev.eventId, actor_id: partner.userId }), 'event_cancellation_progress (propriétaire)');
        const cash = progress.counter_cash as Row | undefined;
        assert.ok(cash && typeof cash === 'object', `suivi sans les espèces du guichet (counter_cash absent) : ${JSON.stringify(progress)}`);
        assert.deepEqual(
            { count: Number(cash.count), total: Number(cash.total), refunded_count: Number(cash.refunded_count), refunded_total: Number(cash.refunded_total) },
            { count: 2, total: 3 * PRICE, refunded_count: 1, refunded_total: PRICE },
            JSON.stringify(cash));
    });
});

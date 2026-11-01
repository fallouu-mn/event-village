/**
 * Lot 4.4 (contrats A et D, étape 5) — fenêtre de scan et statut de l'événement.
 *  - fenêtre : début − access.scan_window_before_hours (défaut 6 h), fin (fin_event_end) +
 *    access.scan_window_after_hours (défaut 6 h) ; avant → event_not_open, après → event_ended ;
 *    dans la fenêtre (5 h avant le début, en cours, 5 h après la fin) → valid ;
 *  - statut : autre que PUBLIE (VALIDE non publié, BROUILLON) → event_not_open, ANNULE → event_cancelled,
 *    SUSPENDU → event_suspended, TERMINE → event_ended ; billet jamais composté ;
 *  - fenêtre réglable par les réglages access.* (finance_setting_set) ;
 *  - encaissement espèces refusé sur un événement ANNULE (billet « à régler sur place » scanné
 *    cash_required avant l'annulation, caisse ouverte) : ni paiement, ni compostage, commande impayée.
 * Billets gratuits émis directement (prix 0, aucun contrôle de paiement) pour isoler la règle de date :
 * le checkout refuse un événement passé.
 * Rouge avant correctif : app/api/controller/scan/route.ts:165-193 ne lit aucune date et accepte
 * VALIDE (lib/events/event-status.ts:14), L14-16 n'accepte pas le corps du contrat ; les réglages
 * access.* n'existent pas (finance_setting_set refuse la clé) ; PUT L466-469 n'arrête que TERMINE et
 * SUSPENDU ; generateTicketCode n'existe pas (lib/security/totp.ts).
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { assertAccessInvariants } from '../helpers/access-invariants';
import { newPartner, type TestPartner } from './finance-helpers';
import { newBuyer, service, type Buyer, type SaleEvent } from './paiement-helpers';
import {
    assignController, cashCheckin, createCashOrderTickets, createTimedEvent, newController, openShift, scan, scansOf,
    shiftRow, ticketPayload, ticketRow, withAccessSettings, type RouteResult,
} from './acces-helpers';
import { advanceEventTo } from './cycle-helpers';

type Row = Record<string, unknown>;

let partner: TestPartner;
let controller: Buyer;
let buyer: Buyer;

function show(r: RouteResult): string {
    return `HTTP ${r.status} ${JSON.stringify(r.body).slice(0, 400)}`;
}

/** Événement à horaire précis avec une catégorie gratuite, contrôleur affecté. */
async function freeEvent(label: string, opts: { startsInHours: number; durationHours?: number; status?: string }): Promise<SaleEvent> {
    const ev = await createTimedEvent(partner.partnerId, label, [{ name: 'Entrée libre', price: 0, total: 20 }], opts);
    await assignController(partner, controller.userId, ev.eventId, false);
    return ev;
}

/** Billet gratuit VALIDE émis directement (comme free_tickets_claim, sans paiement). */
async function freeTicket(ev: SaleEvent): Promise<string> {
    const cat = ev.categories['Entrée libre'];
    const { data, error } = await service.from('tickets').insert({
        event_id: ev.eventId, category_id: cat.id, user_id: buyer.userId, price: 0, status: 'VALIDE',
        ticket_number: `TCK-FENETRE-${randomUUID().replace(/-/g, '').slice(0, 10).toUpperCase()}`,
        qr_code: `EV-QR-${randomUUID().replace(/-/g, '')}`,
    }).select('id').single();
    assert.equal(error, null, `billet gratuit : ${error?.message}`);
    const { data: c } = await service.from('ticket_categories').select('sold_quantity').eq('id', cat.id).single();
    await service.from('ticket_categories').update({ sold_quantity: Number(c?.sold_quantity ?? 0) + 1 }).eq('id', cat.id);
    return data.id as string;
}

async function scanFresh(ev: SaleEvent): Promise<{ r: RouteResult; ticketId: string }> {
    const ticketId = await freeTicket(ev);
    const r = await scan(controller, { eventId: ev.eventId, payload: await ticketPayload(ticketId) });
    return { r, ticketId };
}

async function expectRefused(ev: SaleEvent, expected: string, label: string): Promise<void> {
    const { r, ticketId } = await scanFresh(ev);
    assert.equal(r.status, 200, `${label} : ${show(r)}`);
    assert.equal(r.body.result, expected, `${label} : ${show(r)}`);
    const t = await ticketRow(ticketId);
    assert.equal(t.status, 'VALIDE', `${label} : billet non composté`);
    assert.deepEqual((await scansOf(ticketId)).filter((s) => s.accepted === true), [], `${label} : aucune ligne acceptée`);
}

async function expectValid(ev: SaleEvent, label: string): Promise<void> {
    const { r, ticketId } = await scanFresh(ev);
    assert.equal(r.status, 200, `${label} : ${show(r)}`);
    assert.equal(r.body.result, 'valid', `${label} : ${show(r)}`);
    assert.equal((await ticketRow(ticketId)).status, 'UTILISE', `${label} : billet composté`);
}

before(async () => {
    partner = await newPartner('accesfenetre');
    controller = await newController(partner, null, { label: 'fenetre' });
    buyer = await newBuyer('accesfenetre');
});

after(async () => {
    await assertAccessInvariants('acces-fenetre');
});

describe('4.4 Fenêtre de scan (réglages par défaut : 6 h avant, 6 h après)', () => {
    test('8 h avant le début → event_not_open', async () => {
        await expectRefused(await freeEvent('avant', { startsInHours: 8 }), 'event_not_open', 'événement dans 8 h');
    });

    test('5 h avant le début, en cours, 5 h après la fin → valid', async () => {
        await expectValid(await freeEvent('bientot', { startsInHours: 5 }), 'événement dans 5 h');
        await expectValid(await freeEvent('encours', { startsInHours: -1, durationHours: 4 }), 'événement en cours');
        await expectValid(await freeEvent('finirecente', { startsInHours: -9, durationHours: 4 }), 'événement fini il y a 5 h');
    });

    test('fin + 6 h dépassée → event_ended', async () => {
        await expectRefused(await freeEvent('fini', { startsInHours: -11, durationHours: 4 }), 'event_ended', 'événement fini il y a 7 h');
    });
});

describe('4.4 Statut de l’événement', () => {
    test('non PUBLIE (VALIDE non publié, BROUILLON) → event_not_open', async () => {
        await expectRefused(await freeEvent('nonpublie', { startsInHours: 1, status: 'VALIDE' }), 'event_not_open', 'événement VALIDE non publié');
        await expectRefused(await freeEvent('brouillon', { startsInHours: 1, status: 'BROUILLON' }), 'event_not_open', 'événement BROUILLON');
    });

    test('ANNULE → event_cancelled ; SUSPENDU → event_suspended ; TERMINE → event_ended', async () => {
        await expectRefused(await freeEvent('annule', { startsInHours: 1, status: 'ANNULE' }), 'event_cancelled', 'événement ANNULE');
        await expectRefused(await freeEvent('suspendu', { startsInHours: 1, status: 'SUSPENDU' }), 'event_suspended', 'événement SUSPENDU');
        // Lot 5 (contrat D7) : TERMINE reste scannable jusqu'à la fermeture de la fenêtre ; la fin manuelle
        // exige un début passé (D4). Événement TERMINE fini il y a 7 h (fenêtre de 6 h fermée).
        await expectRefused(await freeEvent('termine', { startsInHours: -11, durationHours: 4, status: 'TERMINE' }), 'event_ended', 'événement TERMINE, fenêtre fermée');
    });
});

describe('4.4 Fenêtre réglable', () => {
    test('access.scan_window_before_hours : un événement dans 8 h s’ouvre avec 10 h, pas avec 6 h', async () => {
        const ev = await freeEvent('reglageavant', { startsInHours: 8 });
        await withAccessSettings({ 'access.scan_window_before_hours': 6 }, () => expectRefused(ev, 'event_not_open', 'fenêtre de 6 h avant'));
        await withAccessSettings({ 'access.scan_window_before_hours': 10 }, () => expectValid(ev, 'fenêtre de 10 h avant'));
    });

    test('access.scan_window_after_hours : un événement fini il y a 3 h se ferme avec 2 h, reste ouvert avec 6 h', async () => {
        const ev = await freeEvent('reglageapres', { startsInHours: -7, durationHours: 4 });
        await withAccessSettings({ 'access.scan_window_after_hours': 2 }, () => expectRefused(ev, 'event_ended', 'fenêtre de 2 h après'));
        await withAccessSettings({ 'access.scan_window_after_hours': 6 }, () => expectValid(ev, 'fenêtre de 6 h après'));
    });
});

describe('4.4 Encaissement sur un événement annulé', () => {
    test('billet « à régler sur place » scanné cash_required, puis événement ANNULE → encaissement refusé, rien d’écrit', async () => {
        const ev = await createTimedEvent(partner.partnerId, 'caisseannule', [{ name: 'Tribune', price: 3000, total: 10 }]);
        const cashier = await newController(partner, ev.eventId, { canAcceptCash: true, label: 'caisseannule' });
        const order = await createCashOrderTickets(buyer, partner, ev, 'Tribune', 1);
        const ticketId = order.ticketIds[0];

        const opened = await openShift(cashier, ev.eventId);
        assert.equal(opened.status, 200, `ouverture de caisse : ${show(opened)}`);
        const { data: shifts, error: shErr } = await service.from('controller_shifts').select('id')
            .eq('controller_id', cashier.userId).eq('event_id', ev.eventId).eq('status', 'OUVERT');
        assert.equal(shErr, null, shErr?.message);
        assert.equal(shifts?.length, 1, 'une caisse ouverte');
        const shiftId = String(shifts![0].id);

        const scanned = await scan(cashier, { eventId: ev.eventId, payload: await ticketPayload(ticketId) });
        assert.equal(scanned.body.result, 'cash_required', `scan avant annulation : ${show(scanned)}`);
        assert.equal(Number(scanned.body.amount_due ?? (scanned.body.ticket as Row | undefined)?.amount_due), 3000, `montant dû = prix du billet : ${show(scanned)}`);
        assert.equal(typeof scanned.body.scan_id, 'string', 'scan_id du scan cash_required');

        // Lot 5 (contrats D3 et D6) : le statut ne change plus par UPDATE ; l'annulation réelle (event_cancel)
        // annule aussi, dans la même transaction, le billet « à régler sur place » jamais payé.
        await advanceEventTo(ev.eventId, 'ANNULE');

        const r = await cashCheckin(cashier, { scanId: scanned.body.scan_id, eventId: ev.eventId });
        assert.ok(r.status < 500, `refus métier, pas une erreur serveur : ${show(r)}`);
        assert.notEqual(r.body.result, 'valid', `encaissement sur un événement annulé : ${show(r)}`);
        assert.ok(['event_cancelled', 'cancelled'].includes(String(r.body.result)) || /CANCEL/.test(String(r.body.code ?? '')), `refus motivé par l’annulation : ${show(r)}`);

        const t = await ticketRow(ticketId);
        assert.equal(t.status, 'ANNULE', 'billet annulé par l’annulation, jamais composté');
        assert.equal(t.payment_id, null, 'aucun paiement rattaché au billet');
        const { data: orderRow } = await service.from('orders').select('payment_status, paid_amount').eq('id', order.orderId).single();
        assert.notEqual(orderRow?.payment_status, 'SUCCESS', 'commande toujours impayée');
        assert.equal(Number(orderRow?.paid_amount ?? 0), 0, 'rien d’encaissé sur la commande');
        const { data: pays, error: payErr } = await service.from('payments').select('id').eq('shift_id', shiftId);
        assert.equal(payErr, null, payErr?.message);
        assert.deepEqual(pays, [], 'aucun paiement hors plateforme rattaché à la caisse');
        assert.equal(Number((await shiftRow(shiftId)).expected_cash_total), 0, 'total attendu de la caisse inchangé');

        const again = await scan(cashier, { eventId: ev.eventId, payload: await ticketPayload(ticketId) });
        assert.equal(again.body.result, 'event_cancelled', `scan après annulation : ${show(again)}`);
    });
});

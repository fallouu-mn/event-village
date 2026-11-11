/**
 * Lot 9 bis, tâche 37 (R72, R78 ; contrat 5.37, B77, B79, X11, 11.1 N23 à N25, 11.2 M4) — fin de l'événement, fonds
 * et rapport, scans regroupés :
 *  1. events_finish_overdue sans caisse ouverte → EVENT_FINISHED (in-app) à la partenaire, aucun SHIFT_OPEN_AT_END ;
 *  2. avec une caisse ouverte → SHIFT_OPEN_AT_END (tâche 22) et pas d'EVENT_FINISHED (un seul avis par cas, X11), puis
 *     la clôture de la dernière caisse → CLOSING_REPORT_READY (in-app) à la partenaire ;
 *  3. ventes disponibles (finance.payout_hold_enabled = false), événement TERMINE, deux passages de l'envoyeur
 *     (notification_daily_checks) → FUNDS_AVAILABLE une seule fois ;
 *  4. événement SUSPENDU dont la fin est passée : aucun FUNDS_AVAILABLE (gel B14) ;
 *  5. R78 : une commande de 4 billets scannée → une seule ligne in-app TICKET_SCANNED pour l'acheteur,
 *     `ticket_count` = 4 (regroupement par commande, 2 min).
 * Caisse ouverte avec le PIN régisseur (A11) : PIN généré par la propriétaire puis passé à l'ouverture.
 *
 * Rouge avant correctif : aucun avis au passage à TERMINE (M/20261103000005:1320), aucun type EVENT_FINISHED,
 * CLOSING_REPORT_READY ni FUNDS_AVAILABLE (registre), un avis TICKET_SCANNED par billet (M/20261103000005:874-887).
 * Le cas 4 est vert aujourd'hui (aucun FUNDS_AVAILABLE nulle part) : garde-fou, le cas 3 rouge. after() : la garde de
 * schéma du lot 9 bis nomme les objets absents jusqu'à M12 (attendu).
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { assertLot9bisInvariants } from '../helpers/lot9bis-invariants';
import { finishOverdueEvents } from '../helpers/lifecycle-invariants';
import { newBuyer, service, type Buyer, type CategorySpec } from './paiement-helpers';
import { buyConfirmed, jsonRequest, newPartner, superadminId, withSettings, type TestPartner } from './finance-helpers';
import { authed, newController, scan, ticketPayload, type RouteResult } from './acces-helpers';
import { advanceEventTo, assertRpcOk, createDraftEvent, eventStatus, rpcTransition, shiftEventDates, type DraftEvent } from './cycle-helpers';
import { addMinutes, dispatchAt, flushNotifications, outboxRows, type OutboxRow } from './notif-helpers';
import { invoke, routeHandler, show } from './pilotage-helpers';

const STANDARD = 'Standard';
const CATEGORIES: CategorySpec[] = [{ name: STANDARD, price: 3_000, total: 40, maxPerOrder: 10 }];
const PIN_ROUTE = '../../app/api/partner/events/[id]/regisseur-pin/route';
const OPEN_ROUTE = '../../app/api/controller/shifts/open/route';
const CLOSE_ROUTE = '../../app/api/controller/shifts/close/route';

let partner: TestPartner;

before(async () => {
    partner = await newPartner('msg-fin');
});

after(async () => {
    await assertLot9bisInvariants('messages-fin-9bis');
});

// ── Outils locaux ──────────────────────────────────────────────────────────

function ctx(params: Record<string, string>): { params: Promise<Record<string, string>> & Record<string, string> } {
    return { params: Object.assign(Promise.resolve(params), params) };
}

/** Événement PUBLIE de la partenaire, début dans une heure (fenêtre de scan et de caisse ouverte). */
async function publishedEvent(label: string): Promise<DraftEvent> {
    const ev = await createDraftEvent(partner, `msg-fin ${label}`, CATEGORIES, { title: `Fin ${label} ${randomBytes(2).toString('hex')}`, startsInHours: 1 });
    await advanceEventTo(ev.eventId, 'PUBLIE', { partnerUserId: partner.userId });
    return ev;
}

/** Dates passées (fin il y a 3 heures), puis passage du cron de fin : l'événement est TERMINE. */
async function endAndFinish(ev: DraftEvent): Promise<void> {
    await shiftEventDates(ev.eventId, { startsInHours: -5, durationHours: 2 });
    const out = await finishOverdueEvents();
    assert.ok(out.ids.includes(ev.eventId), `events_finish_overdue termine l'événement : ${JSON.stringify(out)}`);
    assert.equal(await eventStatus(ev.eventId), 'TERMINE', 'événement TERMINE');
}

/** Caisse OUVERT du contrôleur : PIN régisseur généré par la propriétaire puis passé à l'ouverture (A11). */
async function openShiftWithPin(seller: Buyer, eventId: string): Promise<string> {
    const pinHandler = await routeHandler(PIN_ROUTE, 'POST', 'POST /api/partner/events/[id]/regisseur-pin');
    const pinRes = await invoke(pinHandler, authed(`/api/partner/events/${eventId}/regisseur-pin`, 'POST', partner, { confirm: true }), ctx({ id: eventId }));
    assert.equal(pinRes.status, 200, `génération du PIN régisseur : ${show(pinRes)}`);
    const pin = String(pinRes.body.pin ?? '');
    assert.match(pin, /^\d{6}$/, `PIN renvoyé en clair une fois : ${show(pinRes)}`);
    const openHandler = await routeHandler(OPEN_ROUTE, 'POST', 'POST /api/controller/shifts/open');
    const res = await invoke(openHandler, authed('/api/controller/shifts/open', 'POST', seller, {
        eventId, event_id: eventId, openingFloat: 0, opening_float_amount: 0, pin, regisseurPin: pin, regisseur_pin: pin,
    }));
    assert.equal(res.status, 200, `ouverture de la caisse avec le PIN : ${show(res)}`);
    const { data, error } = await service.from('controller_shifts').select('id').eq('controller_id', seller.userId).eq('event_id', eventId).eq('status', 'OUVERT');
    assert.equal(error, null, `caisse ouverte : ${error?.message}`);
    assert.equal((data ?? []).length, 1, 'une caisse OUVERT du contrôleur');
    return String(data![0].id);
}

async function closeShift(caller: Buyer, shiftId: string): Promise<RouteResult> {
    const { data, error } = await service.from('controller_shifts').select('expected_cash_total').eq('id', shiftId).single();
    assert.equal(error, null, `caisse ${shiftId} : ${error?.message}`);
    const handler = await routeHandler(CLOSE_ROUTE, 'POST', 'POST /api/controller/shifts/close');
    return invoke(handler, jsonRequest('/api/controller/shifts/close', 'POST', caller.accessToken,
        { shiftId, declaredCashTotal: Number(data.expected_cash_total ?? 0) }));
}

/** Avis d'un type à la partenaire pour cet événement. */
async function partnerRows(type: string, eventId: string): Promise<OutboxRow[]> {
    return outboxRows({ type, eventId, userId: partner.userId });
}

function describeRows(rows: OutboxRow[]): string {
    return JSON.stringify(rows.map((r) => [r.type, r.channel, r.status, r.reason, r.template_data.ticket_count ?? null]));
}

// ── R72 : fin, rapport, fonds ──────────────────────────────────────────────

describe('9b.37 R72 : avis in-app à la partenaire à la fin de l\'événement, quand le rapport est prêt et quand les fonds sont disponibles', () => {
    test('fin sans caisse ouverte : EVENT_FINISHED en in-app à la partenaire, aucun SHIFT_OPEN_AT_END', async () => {
        const ev = await publishedEvent('Sans caisse');
        await endAndFinish(ev);
        const rows = await partnerRows('EVENT_FINISHED', ev.eventId);
        assert.ok(rows.some((r) => r.channel === 'IN_APP'), `EVENT_FINISHED à la partenaire : ${describeRows(rows)}`);
        assert.deepEqual(await partnerRows('SHIFT_OPEN_AT_END', ev.eventId), [], 'aucune caisse ouverte : aucun avis de caisse');
    });

    test('fin avec une caisse ouverte : SHIFT_OPEN_AT_END sans EVENT_FINISHED, puis la clôture de la caisse donne CLOSING_REPORT_READY', async () => {
        const ev = await publishedEvent('Avec caisse');
        const controller = await newController(partner, ev.eventId, { canAcceptCash: true, label: 'fin-caisse' });
        const shiftId = await openShiftWithPin(controller, ev.eventId);
        await endAndFinish(ev);
        const open = await partnerRows('SHIFT_OPEN_AT_END', ev.eventId);
        assert.ok(open.some((r) => r.channel === 'IN_APP'), `SHIFT_OPEN_AT_END à la partenaire (tâche 22) : ${describeRows(open)}`);
        assert.deepEqual(await partnerRows('EVENT_FINISHED', ev.eventId), [], 'un seul avis par cas (X11) : pas d\'EVENT_FINISHED avec une caisse ouverte');
        assert.deepEqual(await partnerRows('CLOSING_REPORT_READY', ev.eventId), [], 'rapport pas encore prêt : une caisse est ouverte');

        const closed = await closeShift(controller, shiftId);
        assert.equal(closed.status, 200, `clôture de la caisse : ${show(closed)}`);
        const ready = await partnerRows('CLOSING_REPORT_READY', ev.eventId);
        assert.equal(ready.filter((r) => r.channel === 'IN_APP').length, 1, `CLOSING_REPORT_READY une fois, en in-app : ${describeRows(ready)}`);
    });

    test('ventes disponibles, événement TERMINE : FUNDS_AVAILABLE une seule fois après deux passages de l\'envoyeur', async () => {
        const ev = await publishedEvent('Fonds');
        await withSettings({ 'finance.payout_hold_enabled': false }, async () => {
            await buyConfirmed(await newBuyer('fin-fonds'), ev, [[STANDARD, 2]]);
        });
        await endAndFinish(ev);
        await flushNotifications({ eventIds: [ev.eventId] });
        await dispatchAt(addMinutes(new Date(), 2), { eventIds: [ev.eventId] });
        const rows = await partnerRows('FUNDS_AVAILABLE', ev.eventId);
        assert.equal(rows.filter((r) => r.channel === 'IN_APP').length, 1, `FUNDS_AVAILABLE une seule fois, en in-app : ${describeRows(rows)}`);
    });

    test('événement SUSPENDU dont la fin est passée : aucun FUNDS_AVAILABLE (fonds gelés, B14)', async () => {
        const ev = await publishedEvent('Gele');
        await withSettings({ 'finance.payout_hold_enabled': false }, async () => {
            await buyConfirmed(await newBuyer('fin-gele'), ev, [[STANDARD, 1]]);
        });
        assertRpcOk(await rpcTransition(ev.eventId, await superadminId(), 'SUSPENDU', 'Signalement en cours'), 'suspension');
        await shiftEventDates(ev.eventId, { startsInHours: -5, durationHours: 2 });
        await flushNotifications({ eventIds: [ev.eventId] });
        await dispatchAt(addMinutes(new Date(), 2), { eventIds: [ev.eventId] });
        assert.equal(await eventStatus(ev.eventId), 'SUSPENDU', 'événement toujours SUSPENDU');
        assert.deepEqual(await partnerRows('FUNDS_AVAILABLE', ev.eventId), [], 'aucun avis de fonds pour un événement suspendu');
    });
});

// ── R78 : scans regroupés par commande ─────────────────────────────────────

describe('9b.37 R78 : les avis de scan d\'une même commande sont regroupés', () => {
    test('commande de 4 billets scannée : une seule ligne in-app TICKET_SCANNED, ticket_count = 4', async () => {
        const ev = await publishedEvent('Scans');
        const controller = await newController(partner, ev.eventId, { label: 'fin-scan' });
        const buyer = await newBuyer('fin-scan');
        const purchase = await buyConfirmed(buyer, ev, [[STANDARD, 4]]);
        assert.equal(purchase.tickets.length, 4, 'une commande de 4 billets');
        for (const t of purchase.tickets) {
            const r = await scan(controller, { eventId: ev.eventId, payload: await ticketPayload(String(t.id)) });
            assert.equal(r.body.result, 'valid', `scan du billet ${String(t.id)} : ${show(r)}`);
        }
        const rows = await outboxRows({ type: 'TICKET_SCANNED', eventId: ev.eventId, userId: buyer.userId, channel: 'IN_APP' });
        assert.equal(rows.length, 1, `une seule ligne in-app pour la commande : ${describeRows(rows)}`);
        assert.equal(Number(rows[0].template_data.ticket_count), 4, `ticket_count = 4 : ${describeRows(rows)}`);
    });
});

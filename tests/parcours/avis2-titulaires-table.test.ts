/**
 * Lot « Avis », phase 2, sous-lot 2b (écart A1 de docs/avis-inventaire.md) — le titulaire d'une table d'événement qui a
 * envoyé toutes ses places (plus aucun billet) est prévenu du report, de la suspension, de la reprise et de la clôture,
 * comme un détenteur, une fois par compte, sous le plafond de 2 SMS d'avis par heure, avec le lien « Ma table ». Base
 * LOCALE, faux SamirPay et faux SMS.
 *
 *  1. Report de 48 h : event_notice_recipient_count compte le titulaire ; EVENT_CHANGED sur les 4 canaux, une ligne par
 *     canal, booking_id et refund_open dans les données ; lien rendu « Ma table » ; le SMS PART à l'envoi (avant :
 *     NO_VALID_TICKET) ; un titulaire qui garde une place reçoit l'avis une seule fois, sans booking_id (chemin des
 *     détenteurs) ; une fois la table remboursée, plus aucun avis.
 *  2. Suspension, reprise, nouvelle suspension : avis d'état au titulaire (booking_id, « Ma table ») ; deux SMS d'avis
 *     partis dans l'heure → le troisième est sauté (LAST_HOUR_CAP), la cloche part quand même (test « une fois »).
 *  3. Clôture d'un événement suspendu fini : EVENT_CLOSED_HOLDER au titulaire sans billet (booking_id).
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { assertNotificationInvariants } from '../helpers/notification-invariants';
import { checkLot11cInvariants } from '../helpers/lot11c-invariants';
import { newBuyer, service, type Buyer } from './paiement-helpers';
import { newPartner, superadminId, type TestPartner } from './finance-helpers';
import {
    buyTable, createdTableType, newTablesEvent, postpone, show, switchEventTablesService, tableRefund, transferSeat, vipType, type Row,
} from './l11c-helpers';
import { assertRpcOk, rpcTransition, shiftEventDates } from './cycle-helpers';
import { dispatchAt, nowOutsideNight, outboxRows, smsMark, smsTo, type OutboxRow } from './notif-helpers';
import { renderNotification } from '../../lib/notifications/catalog';

const CTX = { appUrl: 'https://app.eventvillage.sn' };
const ALL = ['EMAIL', 'IN_APP', 'PUSH', 'SMS'];

let restore: () => Promise<void>;
let partner: TestPartner;
let admin: string;

before(async () => {
    restore = await switchEventTablesService(true);
    partner = await newPartner('avis2-tables');
    admin = await superadminId();
});

after(async () => {
    if (restore) await restore();
    await checkLot11cInvariants('avis2-titulaires-table');
    await assertNotificationInvariants('avis2-titulaires-table');
});

/** Envoie `count` places de la table (toutes par défaut) à des comptes neufs, transferts acceptés. */
async function giveSeats(holder: Buyer, tickets: Row[], label: string, count = tickets.length): Promise<void> {
    for (const [i, seat] of tickets.slice(0, count).entries()) {
        const guest = await newBuyer(`${label}-invite${i}`);
        const transferId = await transferSeat(String(seat.id), holder, guest.phoneE164);
        const { data, error } = await service.rpc('ticket_transfer_accept', { p: { transfer_id: transferId, actor_id: guest.userId } });
        assert.equal(error, null, error?.message);
        assert.equal((data as Row | null)?.ok, true, JSON.stringify(data));
    }
}

/** Table de 2 places achetée par un compte neuf qui envoie toutes ses places : le titulaire et sa vente. */
async function holderWithoutTicket(eventId: string, typeId: string, label: string): Promise<{ holder: Buyer; bookingId: string }> {
    const holder = await newBuyer(label);
    const bought = await buyTable(holder, eventId, typeId);
    await giveSeats(holder, bought.tickets, label);
    const { data, error } = await service.from('tickets').select('id').eq('event_id', eventId).eq('user_id', holder.userId).in('status', ['VALIDE', 'UTILISE']);
    assert.equal(error, null, error?.message);
    assert.deepEqual(data, [], 'précondition : le titulaire n’a plus aucun billet');
    return { holder, bookingId: String(bought.booking.id) };
}

const channels = (rows: OutboxRow[]): string[] => rows.map((r) => r.channel).sort();
const describeRows = (rows: OutboxRow[]): string => JSON.stringify(rows.map((r) => [r.type, r.channel, r.status, r.reason, r.template_data.booking_id ?? null]));

describe('2b.1 — report de 48 h : le titulaire sans billet est prévenu, une fois, lien « Ma table »', () => {
    test('aperçu compté, 4 canaux, SMS envoyé, titulaire avec une place prévenu une fois, table remboursée : plus rien', async () => {
        const ev = await newTablesEvent(partner, 'avis2-report', { capacity: 100 });
        const t = await createdTableType(partner, ev.eventId, vipType({ seats: 2 }), 2);
        const { holder, bookingId } = await holderWithoutTicket(ev.eventId, t.typeId, 'avis2-titulaire');
        // Témoin : titulaire qui garde une place (déjà prévenu comme détenteur)
        const keeper = await newBuyer('avis2-garde');
        const kept = await buyTable(keeper, ev.eventId, t.typeId);
        await giveSeats(keeper, kept.tickets, 'avis2-garde', 1);

        // Aperçu « Prévenir » : détenteurs distincts + le titulaire sans billet
        const { data: holders, error: hErr } = await service.from('tickets').select('user_id').eq('event_id', ev.eventId).eq('status', 'VALIDE');
        assert.equal(hErr, null, hErr?.message);
        const distinct = new Set((holders ?? []).map((h) => String(h.user_id)));
        assert.ok(!distinct.has(holder.userId), 'précondition : le titulaire n’est pas détenteur');
        const { data: count, error: cErr } = await service.rpc('event_notice_recipient_count', { p_event: ev.eventId, p_multi: false });
        assert.equal(cErr, null, cErr?.message);
        assert.equal(Number(count), distinct.size + 1, `aperçu : ${distinct.size} détenteurs + le titulaire sans billet`);

        await postpone(partner, ev.eventId, 48);

        const rows = await outboxRows({ type: 'EVENT_CHANGED', eventId: ev.eventId, userId: holder.userId });
        assert.deepEqual(channels(rows), ALL, `une ligne par canal pour le titulaire : ${describeRows(rows)}`);
        for (const r of rows) {
            assert.equal(r.template_data.booking_id, bookingId, `booking_id (${r.channel})`);
            assert.equal(r.template_data.refund_open, true, `remboursement de la table ouvert (${r.channel})`);
        }
        const inApp = renderNotification('EVENT_CHANGED', 'IN_APP', rows.find((r) => r.channel === 'IN_APP')!.template_data, CTX);
        assert.equal(inApp.channel === 'IN_APP' && inApp.actionUrl, `/tickets?tab=tables#table-${bookingId}`, 'lien « Ma table »');

        const keeperRows = await outboxRows({ type: 'EVENT_CHANGED', eventId: ev.eventId, userId: keeper.userId });
        assert.deepEqual(channels(keeperRows), ALL, `titulaire avec une place : une seule fois par canal : ${describeRows(keeperRows)}`);
        for (const r of keeperRows) assert.equal(r.template_data.booking_id, undefined, 'chemin des détenteurs, sans booking_id');

        // L'envoi accepte le titulaire d'une table active (avant : SKIPPED NO_VALID_TICKET)
        const sms = rows.find((r) => r.channel === 'SMS')!;
        assert.equal(sms.status, 'PENDING', `SMS en attente : ${describeRows([sms])}`);
        const mark = smsMark(holder.phoneE164);
        const at = new Date(Math.max(Date.parse(sms.due_at), Date.now()) + 1_000);
        await dispatchAt(at, { ids: [sms.id] });
        const [sent] = await outboxRows({ ids: [sms.id] });
        assert.equal(sent.status, 'SENT', `SMS du titulaire envoyé : ${sent.status} ${sent.reason ?? ''}`);
        const received = smsTo(holder.phoneE164, mark);
        assert.equal(received.length, 1, 'un SMS reçu');
        assert.match(received[0].message, /reporté au/, received[0].message);

        // Table remboursée (report) : plus titulaire d'une table active, plus aucun avis
        const refunded = await tableRefund(holder, bookingId);
        assert.equal(refunded.status, 200, `remboursement de la table : ${show(refunded)}`);
        await postpone(partner, ev.eventId, 2);
        const afterRefund = await outboxRows({ type: 'EVENT_CHANGED', eventId: ev.eventId, userId: holder.userId });
        assert.equal(afterRefund.length, rows.length, `aucun avis après le remboursement de la table : ${describeRows(afterRefund)}`);
    });
});

describe('2b.2 — suspension, reprise : avis au titulaire sans billet, plafond de 2 SMS par heure', () => {
    test('suspension et reprise prévenues (« Ma table ») ; troisième SMS dans l’heure sauté, cloche gardée', async () => {
        const ev = await newTablesEvent(partner, 'avis2-suspension', { capacity: 100 });
        const t = await createdTableType(partner, ev.eventId, vipType({ seats: 2 }), 1);
        const { holder, bookingId } = await holderWithoutTicket(ev.eventId, t.typeId, 'avis2-susp');

        assertRpcOk(await rpcTransition(ev.eventId, admin, 'SUSPENDU', 'Vérification des avis'), 'suspension');
        const suspended = await outboxRows({ type: 'EVENT_SUSPENDED_HOLDER', eventId: ev.eventId, userId: holder.userId });
        assert.deepEqual(channels(suspended), ALL, `suspension : une ligne par canal : ${describeRows(suspended)}`);
        for (const r of suspended) assert.equal(r.template_data.booking_id, bookingId, `booking_id (${r.channel})`);
        const susApp = renderNotification('EVENT_SUSPENDED_HOLDER', 'IN_APP', suspended.find((r) => r.channel === 'IN_APP')!.template_data, CTX);
        assert.equal(susApp.channel === 'IN_APP' && susApp.actionUrl, `/tickets?tab=tables#table-${bookingId}`);
        const at = await nowOutsideNight();
        await dispatchAt(at, { ids: suspended.filter((r) => r.channel === 'SMS').map((r) => r.id) });

        assertRpcOk(await rpcTransition(ev.eventId, admin, 'PUBLIE'), 'reprise');
        const reactivated = await outboxRows({ type: 'EVENT_REACTIVATED_HOLDER', eventId: ev.eventId, userId: holder.userId });
        assert.deepEqual(channels(reactivated), ALL, `reprise : une ligne par canal : ${describeRows(reactivated)}`);
        for (const r of reactivated) assert.equal(r.template_data.booking_id, bookingId, `booking_id (${r.channel})`);
        const reaApp = renderNotification('EVENT_REACTIVATED_HOLDER', 'IN_APP', reactivated.find((r) => r.channel === 'IN_APP')!.template_data, CTX);
        assert.equal(reaApp.channel === 'IN_APP' && reaApp.actionUrl, `/tickets?tab=tables#table-${bookingId}`);
        // Heure recalculée après la reprise : la ligne de la reprise est due maintenant (créée après la première heure)
        await dispatchAt(await nowOutsideNight(), { ids: reactivated.filter((r) => r.channel === 'SMS').map((r) => r.id) });
        const sentSms = await outboxRows({ eventId: ev.eventId, userId: holder.userId, channel: 'SMS', status: 'SENT' });
        assert.equal(sentSms.length, 2, `deux SMS d'avis partis : ${describeRows(sentSms)}`);

        assertRpcOk(await rpcTransition(ev.eventId, admin, 'SUSPENDU', 'Nouvelle vérification'), 'nouvelle suspension');
        const again = (await outboxRows({ type: 'EVENT_SUSPENDED_HOLDER', eventId: ev.eventId, userId: holder.userId }))
            .filter((r) => !suspended.some((s) => s.id === r.id));
        assert.deepEqual(channels(again), ALL, `nouvelle suspension : une ligne par canal : ${describeRows(again)}`);
        const capped = again.find((r) => r.channel === 'SMS')!;
        assert.deepEqual([capped.status, capped.reason], ['SKIPPED', 'LAST_HOUR_CAP'], `troisième SMS dans l'heure sauté : ${describeRows([capped])}`);
        assert.equal(again.find((r) => r.channel === 'IN_APP')!.status, 'PENDING', 'la cloche part quand même');
    });
});

describe('2b.3 — clôture d’un événement suspendu fini : le titulaire sans billet est prévenu', () => {
    test('EVENT_CLOSED_HOLDER au titulaire sans billet, booking_id, lien « Ma table »', async () => {
        const ev = await newTablesEvent(partner, 'avis2-cloture', { capacity: 100 });
        const t = await createdTableType(partner, ev.eventId, vipType({ seats: 2 }), 1);
        const { holder, bookingId } = await holderWithoutTicket(ev.eventId, t.typeId, 'avis2-clos');
        assertRpcOk(await rpcTransition(ev.eventId, admin, 'SUSPENDU', 'Vérification avant clôture'), 'suspension');
        await shiftEventDates(ev.eventId, { startsInHours: -6, durationHours: 4 });
        assertRpcOk(await rpcTransition(ev.eventId, admin, 'TERMINE', 'Clôture après vérification'), 'clôture');
        const closed = await outboxRows({ type: 'EVENT_CLOSED_HOLDER', eventId: ev.eventId, userId: holder.userId });
        assert.deepEqual(channels(closed), ALL, `clôture : une ligne par canal : ${describeRows(closed)}`);
        for (const r of closed) assert.equal(r.template_data.booking_id, bookingId, `booking_id (${r.channel})`);
        const app = renderNotification('EVENT_CLOSED_HOLDER', 'IN_APP', closed.find((r) => r.channel === 'IN_APP')!.template_data, CTX);
        assert.equal(app.channel === 'IN_APP' && app.actionUrl, `/tickets?tab=tables#table-${bookingId}`);
    });
});

/**
 * Lot 6, tâche 6.5 — annulation des rappels PENDING dans la même transaction que leur cause (contrat I4,
 * B3 pour l'acceptation d'un transfert, I2 pour la nouvelle clé ; décision 23 ; S2 groupe Rappels).
 * Horloge simulée par `now` de scheduleAt / dispatchAt seulement (jamais dans le passé), planification et
 * envoi filtrés par événement ; envois comptés par numéro neuf et par texte exact (G3).
 *  1. Suspension (event_transition) : les rappels PENDING de l'événement passent CANCELLED EVENT_SUSPENDU
 *     dans la transaction de la transition (xmin de chaque ligne = txid, mod 2^32, de la ligne SUSPENDU de
 *     event_status_history) ; EVENT_CHANGED et les autres types restent PENDING ; pendant la suspension,
 *     rien n'est planifié ; réactivation dans la tolérance → rappel non recréé (clé existante), rien
 *     n'est envoyé ; le H-3 du lendemain est de nouveau planifié.
 *  2. Annulation (event_cancel) : CANCELLED EVENT_ANNULE, EVENT_CHANGED CANCELLED NO_LONGER_RELEVANT, dans
 *     la transaction de l'annulation ; plus rien n'est planifié.
 *  3. Fin (TERMINE) : REMINDER_H3 et CONTROLLER_REMINDER CANCELLED EVENT_TERMINE, EVENT_CHANGED
 *     NO_LONGER_RELEVANT (lignes PENDING écrites par le service_role après le passage des dates dans le
 *     passé : déplacer les dates annule déjà les rappels par EVENT_RESCHEDULED, cas 4 et 5).
 *  4. Date changée par event_update : CANCELLED EVENT_RESCHEDULED dans la transaction de l'édition (xmin de
 *     la ligne = xmin de l'événement) ; nouvelle clé (nouveau début) au passage suivant ; un seul SMS.
 *  5. Date changée par un UPDATE du service_role : même effet ; un UPDATE qui ne touche pas au début ne
 *     touche aucun rappel ; nouvelle clé dans la tolérance.
 *  6. Transfert réclamé (POST /api/tickets/transfers/[id]/claim, contrat B4) : rappels PENDING de l'ancien
 *     porteur CANCELLED NO_LONGER_HOLDER dans la transaction de l'acceptation (xmin = xmin du transfert),
 *     sauf s'il garde un billet VALIDE ; le nouveau porteur reçoit les rappels à venir (J-1 dans la
 *     tolérance, car la réclamation précède l'échéance ; H-3), l'ancien plus rien.
 *  7. Garde-fous (transaction annulée, connexion directe) : trg_notif_cancel_on_status désactivé → la
 *     suspension laisse les lignes PENDING et le contrôle le relève ; trg_notif_cancel_on_reschedule
 *     désactivé → même chose pour un changement de date ; trigger réactivé → contrôle vide (contre-épreuve).
 *
 * Rouge avant correctif : scheduleReminders (lib/notifications/reminders.ts), la RPC de planification, la
 * boîte d'envoi et les triggers trg_notif_cancel_on_status / trg_notif_cancel_on_reschedule n'existent pas
 * (migration 20261103000004) ; la route de réclamation par identifiant non plus (contrat B4) : scheduleAt
 * échoue « planificateur des rappels (contrat I3) absent », insertOutboxRow échoue (table absente).
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import type { Client } from 'pg';
import type { NextRequest } from 'next/server';
import { inRolledBackTransaction, inspect } from '../helpers/db';
import { routeContext } from './helpers';
import { importModule, newBuyer, service, type Buyer, type CategorySpec } from './paiement-helpers';
import { buyConfirmed, newPartner, superadminId, type TestPartner } from './finance-helpers';
import { authed, ticketRow } from './acces-helpers';
import { advanceEventTo, eventStatus, shiftEventDates } from './cycle-helpers';
import {
    assertNotificationInvariants, createReminderEvent, dakarAt, dakarDay, deleteOutboxRows, dispatchAt, insertOutboxRow,
    loadLotModule, markPhoneVerified, outboxRows, scheduleAt, smsMark, smsTo,
    type OutboxChannel, type OutboxRow, type ReminderEvent, type ScheduleReport,
} from './notif-helpers';

after(async () => {
    await assertNotificationInvariants('notif-rappels-annulation');
});

type Row = Record<string, unknown>;
type ReminderType = 'REMINDER_J1' | 'REMINDER_H3' | 'CONTROLLER_REMINDER';
type Handler = (req: NextRequest, ctx?: unknown) => Promise<Response>;

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/+$/, '');
const LOCATION = 'Salle Sorano';
const CITY = 'Dakar';
const STANDARD = 'Standard';
const FREE = 'Entree libre';
const CATEGORIES: CategorySpec[] = [{ name: STANDARD, price: 5_000, total: 50 }, { name: FREE, price: 0, total: 50 }];
const REMINDER_TYPES: ReminderType[] = ['REMINDER_J1', 'REMINDER_H3', 'CONTROLLER_REMINDER'];
const J1_CHANNELS: OutboxChannel[] = ['EMAIL', 'IN_APP', 'PUSH', 'SMS'];
const H3_CHANNELS: OutboxChannel[] = ['IN_APP', 'PUSH', 'SMS'];
const EVENT_DAY = dakarDay(3);
const EVE = dakarDay(2);
const NEXT_DAY = dakarDay(4);
const TRANSFER_ROUTE = '../../app/api/tickets/[id]/transfer/route';
const CLAIM_ROUTE = '../../app/api/tickets/transfers/[id]/claim/route';

let partner: TestPartner;

before(async () => {
    assert.ok(APP_URL.startsWith('http'), 'NEXT_PUBLIC_APP_URL absente de .env.test');
    partner = await newPartner('rappels-annul');
});

// ── Outils locaux ──────────────────────────────────────────────────────────

function startKey(d: Date): string {
    const iso = d.toISOString();
    return `${iso.slice(0, 4)}${iso.slice(5, 7)}${iso.slice(8, 10)}T${iso.slice(11, 13)}${iso.slice(14, 16)}Z`;
}

function shortTitle(prefix: string): string {
    const t = `${prefix} ${randomBytes(3).toString('hex')}`;
    assert.ok(t.length <= 25 && /^[A-Za-z0-9 ]+$/.test(t), `titre de test « ${t} » : 25 caractères GSM-7 au plus`);
    return t;
}

async function reminderEvent(prefix: string): Promise<ReminderEvent> {
    return createReminderEvent(partner, `annul-${prefix}`, {
        startDate: EVENT_DAY, startTime: '20:00', categories: CATEGORIES, title: shortTitle(prefix), location: LOCATION, city: CITY,
    });
}

/** Billet gratuit (0 F, canal FREE) émis directement par le service_role, stock vendu + 1. */
async function giveFreeTicket(ev: ReminderEvent, holder: Buyer): Promise<string> {
    const cat = ev.categories[FREE];
    const { data, error } = await service.from('tickets').insert({
        event_id: ev.eventId, category_id: cat.id, user_id: holder.userId, price: 0, status: 'VALIDE', sale_channel: 'FREE',
        ticket_number: `TCK-RAPA-${randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase()}`,
        qr_code: `EV-QR-RAPA-${randomUUID()}`,
    }).select('id').single();
    assert.equal(error, null, `billet gratuit : ${error?.message}`);
    const { data: c, error: cErr } = await service.from('ticket_categories').select('sold_quantity').eq('id', cat.id).single();
    assert.equal(cErr, null, `stock : ${cErr?.message}`);
    const { error: uErr } = await service.from('ticket_categories').update({ sold_quantity: Number(c.sold_quantity) + 1 }).eq('id', cat.id);
    assert.equal(uErr, null, `stock vendu : ${uErr?.message}`);
    return data.id as string;
}

async function holderWithTicket(ev: ReminderEvent, label: string): Promise<Buyer> {
    const holder = await newBuyer(`rapa-${label}`);
    await giveFreeTicket(ev, holder);
    return holder;
}

function createdOf(r: ScheduleReport, type: ReminderType): number {
    const v = r.created?.[type];
    assert.equal(typeof v, 'number', `rapport de planification : created.${type} numérique attendu (${JSON.stringify(r)})`);
    return v;
}

/**
 * Lignes d'un rappel pour un compte et un début donné : une par canal, clé `<TYPE>:<event>:<user>:<début>:<canal>`,
 * template_data.start_at = ce début. Statut exigé si fourni.
 */
async function keyRows(type: ReminderType, eventId: string, userId: string, start: Date, channels: OutboxChannel[], status?: string): Promise<OutboxRow[]> {
    const group = `${type}:${eventId}:${userId}:${startKey(start)}`;
    const rows = await outboxRows({ type, eventId, userId, keyPrefix: `${group}:` });
    assert.deepEqual(rows.map((r) => r.channel).sort(), [...channels].sort(), `${group} : une ligne par canal (reçu ${JSON.stringify(rows.map((r) => `${r.channel}:${r.status}`))})`);
    for (const r of rows) {
        assert.equal(r.group_key, group, `${group} : group_key`);
        assert.equal(r.idempotency_key, `${group}:${r.channel}`, `${group} : clé d'idempotence`);
        assert.equal(Date.parse(String(r.template_data.start_at)), start.getTime(), `${group} : template_data.start_at`);
        if (status) assert.equal(r.status, status, `${group} ${r.channel} : statut ${r.status} (motif ${r.reason})`);
    }
    return rows;
}

async function rowsById(ids: string[]): Promise<OutboxRow[]> {
    const rows = await outboxRows({ ids });
    assert.equal(rows.length, ids.length, `lignes relues : ${rows.length} / ${ids.length}`);
    return rows;
}

interface StatusLine { id: string; status: string; reason: string | null; finished_at?: string | null }

/** Lignes qui ne sont pas CANCELLED avec le motif attendu (vide = annulation complète). */
function cancellationGaps(rows: StatusLine[], reason: string): string[] {
    return rows.filter((r) => r.status !== 'CANCELLED' || r.reason !== reason || !r.finished_at)
        .map((r) => `${r.id} : ${r.status}${r.reason ? ` ${r.reason}` : ''}${r.finished_at ? '' : ' (finished_at absent)'}`);
}

async function assertCancelled(ids: string[], reason: string, what: string): Promise<void> {
    const gaps = cancellationGaps(await rowsById(ids), reason);
    assert.deepEqual(gaps, [], `${what} : lignes non annulées avec le motif ${reason} :\n${gaps.join('\n')}`);
}

async function assertStillPending(ids: string[], what: string): Promise<void> {
    const rows = await rowsById(ids);
    assert.deepEqual(rows.filter((r) => r.status !== 'PENDING').map((r) => `${r.id} ${r.type} ${r.status} ${r.reason}`), [], `${what} : lignes restées PENDING attendues`);
}

/** xmin (texte) des lignes d'une table, lu par la connexion directe. */
async function xminOf(table: 'notification_outbox' | 'events' | 'ticket_transfers', ids: string[]): Promise<Map<string, string>> {
    const rows = await inspect(async (db) => (await db.query<{ id: string; xmin: string }>(
        `SELECT id::text AS id, xmin::text AS xmin FROM public.${table} WHERE id = ANY($1::uuid[])`, [ids])).rows);
    assert.equal(rows.length, ids.length, `xmin de ${table} : ${rows.length} / ${ids.length} ligne(s)`);
    return new Map(rows.map((r) => [r.id, r.xmin]));
}

/** txid (mod 2^32) de la dernière ligne d'historique vers `status`. */
async function historyTxid(eventId: string, status: string): Promise<string> {
    const rows = await inspect(async (db) => (await db.query<{ t: string }>(
        `SELECT (txid % 4294967296)::text AS t FROM public.event_status_history
          WHERE event_id = $1 AND new_status::text = $2 ORDER BY created_at DESC, id DESC LIMIT 1`, [eventId, status])).rows);
    assert.equal(rows.length, 1, `ligne d'historique ${status} de l'événement ${eventId}`);
    return rows[0].t;
}

async function assertSameTransaction(outboxIds: string[], expectedXmin: string, what: string): Promise<void> {
    const xmins = await xminOf('notification_outbox', outboxIds);
    const off = Array.from(xmins.entries()).filter(([, x]) => x !== expectedXmin).map(([id, x]) => `${id} (xmin ${x})`);
    assert.deepEqual(off, [], `${what} : rappels annulés hors de la transaction de la cause (xmin attendu ${expectedXmin})`);
}

/** Ligne PENDING écrite par le service_role (échéance dans 30 jours : jamais réservée par l'envoyeur). */
async function pendingRow(ev: ReminderEvent, userId: string, type: string, family: 'ESSENTIAL' | 'OPTIONAL', topic: string | null): Promise<OutboxRow> {
    return insertOutboxRow({
        type, family, topic, channel: 'IN_APP', recipient_user_id: userId, event_id: ev.eventId,
        template_data: { event_id: ev.eventId, title: ev.title, start_at: ev.startAt.toISOString(), location: LOCATION, city: CITY },
    });
}

function j1Sms(title: string, start: Date): string {
    return `Event Village : rappel, ${title} demain à ${start.toISOString().slice(11, 16)}, ${LOCATION}. Vos billets : ${APP_URL}/tickets`;
}

function remindersSmsTo(phone: string, since: number): string[] {
    return smsTo(phone, since).map((m) => m.message).filter((m) => /rappel/i.test(m));
}

async function invoke(handler: Handler, req: NextRequest, ctx?: unknown): Promise<{ status: number; body: Row }> {
    const res = await handler(req, ctx);
    const text = await res.text();
    let body: Row;
    try {
        body = text ? (JSON.parse(text) as Row) : {};
    } catch (err) {
        body = { raw: text, parseError: (err as Error).message };
    }
    return { status: res.status, body };
}

/**
 * Transfert par les routes : initiation par le porteur vers le numéro vérifié du destinataire, puis
 * réclamation par le destinataire (contrat B4). Renvoie l'id du transfert réclamé.
 */
async function transferTo(owner: Buyer, ticketId: string, to: Buyer): Promise<string> {
    const { POST: initiate } = (await importModule(TRANSFER_ROUTE)) as { POST: Handler };
    const init = await invoke(initiate, authed(`/api/tickets/${ticketId}/transfer`, 'POST', owner, { recipient: to.phoneE164 }), routeContext({ id: ticketId }));
    assert.equal(init.status, 200, `initiation du transfert : HTTP ${init.status} ${JSON.stringify(init.body).slice(0, 300)}`);
    const { data, error } = await service.from('ticket_transfers').select('id').eq('ticket_id', ticketId).eq('status', 'PENDING');
    assert.equal(error, null, `transfert PENDING : ${error?.message}`);
    assert.equal((data ?? []).length, 1, 'un transfert PENDING');
    const transferId = String(data![0].id);
    const mod = await loadLotModule(CLAIM_ROUTE, 'route de réclamation POST /api/tickets/transfers/[id]/claim (contrat B4)');
    assert.equal(typeof mod.POST, 'function', 'POST exporté par la route de réclamation');
    const claim = await invoke(mod.POST as Handler, authed(`/api/tickets/transfers/${transferId}/claim`, 'POST', to), routeContext({ id: transferId }));
    assert.equal(claim.status, 200, `réclamation : HTTP ${claim.status} ${JSON.stringify(claim.body).slice(0, 300)}`);
    assert.equal((await ticketRow(ticketId)).user_id, to.userId, 'billet au nouveau porteur');
    return transferId;
}

async function rpcOk(name: string, p: Row, what: string): Promise<Row> {
    const { data, error } = await service.rpc(name, { p });
    assert.equal(error, null, `${what} : ${error?.message} (code ${error?.code})`);
    assert.equal((data as Row | null)?.ok, true, `${what} refusé : ${JSON.stringify(data)}`);
    return data as Row;
}

// ── Transitions ────────────────────────────────────────────────────────────

describe('6.5 Rappels annulés par la transition de l’événement (contrat I4)', () => {
    test('suspension : rappels PENDING → CANCELLED EVENT_SUSPENDU dans la même transaction ; réactivation dans la tolérance → pas recréés, rien envoyé', async () => {
        const ev = await reminderEvent('Suspendu');
        const holder = await holderWithTicket(ev, 'suspendu');
        const r = await scheduleAt(dakarAt(EVE, '10:00'), [ev.eventId]);
        assert.ok(createdOf(r, 'REMINDER_J1') >= 1, 'J-1 planifié');
        const j1 = await keyRows('REMINDER_J1', ev.eventId, holder.userId, ev.startAt, J1_CHANNELS, 'PENDING');
        const ids = j1.map((x) => x.id);
        const synthetic: string[] = [];
        try {
            const changed = await pendingRow(ev, holder.userId, 'EVENT_CHANGED', 'OPTIONAL', 'EVENT_UPDATES');
            const witness = await pendingRow(ev, holder.userId, 'PURCHASE_CONFIRMED', 'ESSENTIAL', null);
            synthetic.push(changed.id, witness.id);

            await advanceEventTo(ev.eventId, 'SUSPENDU', { suspendReason: 'Suspension de test du lot 6 (rappels)' });
            await assertCancelled(ids, 'EVENT_SUSPENDU', 'suspension');
            await assertSameTransaction(ids, await historyTxid(ev.eventId, 'SUSPENDU'), 'suspension');
            await assertStillPending([changed.id], 'suspension : EVENT_CHANGED n’est annulé que par ANNULE ou TERMINE');
            await assertStillPending([witness.id], 'suspension : les autres types ne sont pas touchés');

            const during = await scheduleAt(dakarAt(EVE, '10:02'), [ev.eventId]);
            assert.equal(createdOf(during, 'REMINDER_J1'), 0, 'événement SUSPENDU : rien n’est planifié');

            await advanceEventTo(ev.eventId, 'PUBLIE');
            assert.equal(await eventStatus(ev.eventId), 'PUBLIE', 'réactivé');
            const again = await scheduleAt(dakarAt(EVE, '10:05'), [ev.eventId]);
            assert.equal(createdOf(again, 'REMINDER_J1'), 0, 'réactivation dans la tolérance : rappel annulé non recréé (clé existante)');
            await keyRows('REMINDER_J1', ev.eventId, holder.userId, ev.startAt, J1_CHANNELS, 'CANCELLED');

            const mark = smsMark(holder.phoneE164);
            await dispatchAt(dakarAt(EVE, '10:06'), { eventIds: [ev.eventId] });
            assert.deepEqual(remindersSmsTo(holder.phoneE164, mark), [], 'aucun SMS de rappel J-1 après la suspension');
            await assertCancelled(ids, 'EVENT_SUSPENDU', 'après l’envoyeur');

            const h3 = await scheduleAt(dakarAt(EVENT_DAY, '17:00'), [ev.eventId]);
            assert.ok(createdOf(h3, 'REMINDER_H3') >= 1, 'événement réactivé : le H-3 à venir est planifié');
            await keyRows('REMINDER_H3', ev.eventId, holder.userId, ev.startAt, H3_CHANNELS, 'PENDING');
        } finally {
            await deleteOutboxRows(synthetic);
        }
    });

    test('annulation (event_cancel) : CANCELLED EVENT_ANNULE et EVENT_CHANGED NO_LONGER_RELEVANT dans la transaction de l’annulation', async () => {
        const ev = await reminderEvent('Annule');
        const holder = await holderWithTicket(ev, 'annule');
        const r = await scheduleAt(dakarAt(EVE, '10:00'), [ev.eventId]);
        assert.ok(createdOf(r, 'REMINDER_J1') >= 1, 'J-1 planifié');
        const ids = (await keyRows('REMINDER_J1', ev.eventId, holder.userId, ev.startAt, J1_CHANNELS, 'PENDING')).map((x) => x.id);
        const synthetic: string[] = [];
        try {
            const changed = await pendingRow(ev, holder.userId, 'EVENT_CHANGED', 'OPTIONAL', 'EVENT_UPDATES');
            const witness = await pendingRow(ev, holder.userId, 'PURCHASE_CONFIRMED', 'ESSENTIAL', null);
            synthetic.push(changed.id, witness.id);

            await advanceEventTo(ev.eventId, 'ANNULE', { internalReason: 'Annulation de test du lot 6 (rappels)' });
            await assertCancelled(ids, 'EVENT_ANNULE', 'annulation');
            await assertCancelled([changed.id], 'NO_LONGER_RELEVANT', 'annulation : changement en attente');
            const txid = await historyTxid(ev.eventId, 'ANNULE');
            await assertSameTransaction([...ids, changed.id], txid, 'annulation');
            await assertStillPending([witness.id], 'annulation : les autres types ne sont pas touchés par ce trigger');

            const later = await scheduleAt(dakarAt(EVENT_DAY, '17:00'), [ev.eventId]);
            assert.equal(createdOf(later, 'REMINDER_H3'), 0, 'événement ANNULE : aucun H-3');
            assert.deepEqual(await outboxRows({ type: 'REMINDER_H3', eventId: ev.eventId }), [], 'aucune ligne H-3');
        } finally {
            await deleteOutboxRows(synthetic);
        }
    });

    test('fin (TERMINE) : REMINDER_H3 et CONTROLLER_REMINDER PENDING → CANCELLED EVENT_TERMINE, EVENT_CHANGED → NO_LONGER_RELEVANT', async () => {
        const ev = await reminderEvent('Termine');
        const holder = await holderWithTicket(ev, 'termine');
        await shiftEventDates(ev.eventId, { startsInHours: -3 });
        const synthetic: string[] = [];
        try {
            const h3 = await pendingRow(ev, holder.userId, 'REMINDER_H3', 'OPTIONAL', 'REMINDERS');
            const ctrl = await pendingRow(ev, holder.userId, 'CONTROLLER_REMINDER', 'OPTIONAL', 'REMINDERS');
            const changed = await pendingRow(ev, holder.userId, 'EVENT_CHANGED', 'OPTIONAL', 'EVENT_UPDATES');
            const witness = await pendingRow(ev, holder.userId, 'PURCHASE_CONFIRMED', 'ESSENTIAL', null);
            synthetic.push(h3.id, ctrl.id, changed.id, witness.id);

            await advanceEventTo(ev.eventId, 'TERMINE');
            await assertCancelled([h3.id, ctrl.id], 'EVENT_TERMINE', 'fin de l’événement');
            await assertCancelled([changed.id], 'NO_LONGER_RELEVANT', 'fin : changement en attente');
            await assertSameTransaction([h3.id, ctrl.id, changed.id], await historyTxid(ev.eventId, 'TERMINE'), 'fin');
            await assertStillPending([witness.id], 'fin : les autres types ne sont pas touchés par ce trigger');
        } finally {
            await deleteOutboxRows(synthetic);
        }
    });
});

// ── Changement de date ─────────────────────────────────────────────────────

describe('6.5 Rappels annulés par un changement de date (contrat I4, I2)', () => {
    test('event_update (début déplacé d’un jour) : CANCELLED EVENT_RESCHEDULED dans la transaction de l’édition ; nouvelle clé au passage suivant, un seul SMS', async () => {
        const ev = await reminderEvent('Report');
        const holder = await holderWithTicket(ev, 'report');
        const r = await scheduleAt(dakarAt(EVE, '10:00'), [ev.eventId]);
        assert.ok(createdOf(r, 'REMINDER_J1') >= 1, 'J-1 planifié pour l’ancienne date');
        const oldIds = (await keyRows('REMINDER_J1', ev.eventId, holder.userId, ev.startAt, J1_CHANNELS, 'PENDING')).map((x) => x.id);

        const { data: cur, error } = await service.from('events').select('updated_at').eq('id', ev.eventId).single();
        assert.equal(error, null, `version de l'événement : ${error?.message}`);
        await rpcOk('event_update', {
            event_id: ev.eventId, actor_id: partner.userId, expected_updated_at: cur.updated_at,
            patch: { start_date: NEXT_DAY, end_date: NEXT_DAY },
        }, 'event_update (début déplacé d’un jour)');
        await assertCancelled(oldIds, 'EVENT_RESCHEDULED', 'édition de la date');
        const eventXmin = (await xminOf('events', [ev.eventId])).get(ev.eventId)!;
        await assertSameTransaction(oldIds, eventXmin, 'édition de la date');

        const newStart = dakarAt(NEXT_DAY, '20:00');
        const stale = await scheduleAt(dakarAt(EVE, '10:05'), [ev.eventId]);
        assert.equal(createdOf(stale, 'REMINDER_J1'), 0, 'ancienne échéance : rien de nouveau');
        const fresh = await scheduleAt(dakarAt(EVENT_DAY, '10:00'), [ev.eventId]);
        assert.ok(createdOf(fresh, 'REMINDER_J1') >= 1, 'veille du nouveau début : J-1 créé');
        const newRows = await keyRows('REMINDER_J1', ev.eventId, holder.userId, newStart, J1_CHANNELS, 'PENDING');
        assert.ok(newRows.every((x) => !oldIds.includes(x.id)), 'nouvelles lignes, nouvelle clé');
        await assertCancelled(oldIds, 'EVENT_RESCHEDULED', 'anciennes lignes');

        const mark = smsMark(holder.phoneE164);
        await dispatchAt(dakarAt(EVENT_DAY, '10:00'), { eventIds: [ev.eventId] });
        assert.deepEqual(remindersSmsTo(holder.phoneE164, mark), [j1Sms(ev.title, newStart)], 'un seul SMS de rappel, pour la nouvelle date');
    });

    test('UPDATE du service_role : un UPDATE sans changement du début ne touche rien ; l’heure de début changée → CANCELLED EVENT_RESCHEDULED ; nouvelle clé dans la tolérance', async () => {
        const ev = await reminderEvent('Horaire');
        const holder = await holderWithTicket(ev, 'horaire');
        const r = await scheduleAt(dakarAt(EVE, '10:00'), [ev.eventId]);
        assert.ok(createdOf(r, 'REMINDER_J1') >= 1, 'J-1 planifié');
        const oldIds = (await keyRows('REMINDER_J1', ev.eventId, holder.userId, ev.startAt, J1_CHANNELS, 'PENDING')).map((x) => x.id);

        const { error: dErr } = await service.from('events').update({ description: 'Description modifiée par le service_role (lot 6).' }).eq('id', ev.eventId);
        assert.equal(dErr, null, `UPDATE de la description : ${dErr?.message}`);
        await assertStillPending(oldIds, 'UPDATE sans changement du début');

        const { error: tErr } = await service.from('events').update({ start_time: '21:00:00' }).eq('id', ev.eventId);
        assert.equal(tErr, null, `UPDATE de l'heure de début : ${tErr?.message}`);
        await assertCancelled(oldIds, 'EVENT_RESCHEDULED', 'UPDATE de l’heure de début par le service_role');
        const eventXmin = (await xminOf('events', [ev.eventId])).get(ev.eventId)!;
        await assertSameTransaction(oldIds, eventXmin, 'UPDATE de l’heure de début');

        const newStart = dakarAt(EVENT_DAY, '21:00');
        const again = await scheduleAt(dakarAt(EVE, '10:05'), [ev.eventId]);
        assert.ok(createdOf(again, 'REMINDER_J1') >= 1, 'même veille, nouveau début : nouvelle clé créée dans la tolérance');
        await keyRows('REMINDER_J1', ev.eventId, holder.userId, newStart, J1_CHANNELS, 'PENDING');
    });
});

// ── Transfert ──────────────────────────────────────────────────────────────

describe('6.5 Billet transféré : rappels de l’ancien et du nouveau porteur (contrat I4, B3)', () => {
    test('ancien porteur sans autre billet → CANCELLED NO_LONGER_HOLDER (transaction de l’acceptation) ; porteur qui garde un billet → intact ; nouveaux porteurs → rappels à venir', async () => {
        const ev = await reminderEvent('Transfert');
        const alone = await newBuyer('rapa-seul');
        const keeper = await newBuyer('rapa-garde');
        const toAlone = await newBuyer('rapa-dest1', { firstName: 'Mariama', lastName: 'Destinataire' });
        const toKeeper = await newBuyer('rapa-dest2', { firstName: 'Ousmane', lastName: 'Destinataire' });
        await markPhoneVerified(toAlone.userId);
        await markPhoneVerified(toKeeper.userId);
        const pAlone = await buyConfirmed(alone, ev, [[STANDARD, 1]]);
        const pKeeper = await buyConfirmed(keeper, ev, [[STANDARD, 2]]);

        const r = await scheduleAt(dakarAt(EVE, '10:00'), [ev.eventId]);
        assert.ok(createdOf(r, 'REMINDER_J1') >= 1, 'J-1 planifié');
        const aloneIds = (await keyRows('REMINDER_J1', ev.eventId, alone.userId, ev.startAt, J1_CHANNELS, 'PENDING')).map((x) => x.id);
        const keeperIds = (await keyRows('REMINDER_J1', ev.eventId, keeper.userId, ev.startAt, J1_CHANNELS, 'PENDING')).map((x) => x.id);

        const transferId = await transferTo(alone, String(pAlone.tickets[0].id), toAlone);
        await assertCancelled(aloneIds, 'NO_LONGER_HOLDER', 'ancien porteur sans autre billet');
        const transferXmin = (await xminOf('ticket_transfers', [transferId])).get(transferId)!;
        await assertSameTransaction(aloneIds, transferXmin, 'acceptation du transfert');

        await transferTo(keeper, String(pKeeper.tickets[0].id), toKeeper);
        await assertStillPending(keeperIds, 'porteur qui garde un billet VALIDE');

        // Réclamations antérieures à l'échéance (heure réelle < veille 10:00) : J-1 dû aux nouveaux porteurs.
        const mAlone = smsMark(alone.phoneE164);
        const mTo = smsMark(toAlone.phoneE164);
        const j1 = await scheduleAt(dakarAt(EVE, '10:05'), [ev.eventId]);
        assert.ok(createdOf(j1, 'REMINDER_J1') >= 1, 'J-1 des nouveaux porteurs créé dans la tolérance');
        await keyRows('REMINDER_J1', ev.eventId, toAlone.userId, ev.startAt, J1_CHANNELS, 'PENDING');
        await keyRows('REMINDER_J1', ev.eventId, toKeeper.userId, ev.startAt, J1_CHANNELS, 'PENDING');
        await keyRows('REMINDER_J1', ev.eventId, alone.userId, ev.startAt, J1_CHANNELS, 'CANCELLED');

        await dispatchAt(dakarAt(EVE, '10:05'), { eventIds: [ev.eventId] });
        assert.deepEqual(remindersSmsTo(alone.phoneE164, mAlone), [], 'ancien porteur : plus aucun rappel');
        assert.deepEqual(remindersSmsTo(toAlone.phoneE164, mTo), [j1Sms(ev.title, ev.startAt)], 'nouveau porteur : un SMS de rappel, texte exact');

        const h3 = await scheduleAt(dakarAt(EVENT_DAY, '17:00'), [ev.eventId]);
        assert.ok(createdOf(h3, 'REMINDER_H3') >= 1, 'H-3 planifié');
        for (const u of [toAlone, toKeeper, keeper]) await keyRows('REMINDER_H3', ev.eventId, u.userId, ev.startAt, H3_CHANNELS, 'PENDING');
        assert.deepEqual(await outboxRows({ type: 'REMINDER_H3', eventId: ev.eventId, userId: alone.userId }), [], 'ancien porteur : aucun H-3');
    });
});

// ── Garde-fous ─────────────────────────────────────────────────────────────

describe('6.5 Garde-fous de détection (transaction annulée)', () => {
    async function statusLines(db: Client, ids: string[]): Promise<StatusLine[]> {
        return (await db.query<StatusLine>(
            'SELECT id::text AS id, status, reason, finished_at::text AS finished_at FROM public.notification_outbox WHERE id = ANY($1::uuid[]) ORDER BY id', [ids])).rows;
    }

    test('trigger de transition désactivé → la suspension laisse les rappels PENDING et le contrôle le relève ; idem pour la date ; trigger actif → contrôle vide', async () => {
        const ev = await reminderEvent('Garde Fou');
        const holder = await holderWithTicket(ev, 'garde-fou');
        const r = await scheduleAt(dakarAt(EVE, '10:00'), [ev.eventId]);
        assert.ok(createdOf(r, 'REMINDER_J1') >= 1, 'J-1 planifié');
        const ids = (await keyRows('REMINDER_J1', ev.eventId, holder.userId, ev.startAt, J1_CHANNELS, 'PENDING')).map((x) => x.id);
        const admin = await superadminId();

        await inRolledBackTransaction(async (db) => {
            // Les triggers de contrainte différés du lot 5 (état public, stock) laisseraient des événements en attente
            // sur events, et ALTER TABLE refuse alors de s'exécuter (55006, run 61) : ils sont exécutés immédiatement.
            await db.query('SET CONSTRAINTS ALL IMMEDIATE');
            await db.query('ALTER TABLE public.event_status_history DISABLE TRIGGER trg_notif_cancel_on_status');
            const t = await db.query<{ r: Row }>('SELECT public.event_transition($1::jsonb) AS r',
                [JSON.stringify({ event_id: ev.eventId, actor_id: admin, to_status: 'SUSPENDU', reason: 'Garde-fou du lot 6 (rappels)' })]);
            assert.equal(t.rows[0].r.ok, true, `suspension dans la transaction : ${JSON.stringify(t.rows[0].r)}`);
            const st = await db.query<{ s: string }>('SELECT status::text AS s FROM public.events WHERE id = $1', [ev.eventId]);
            assert.equal(st.rows[0].s, 'SUSPENDU', 'événement suspendu dans la transaction');
            const detected = cancellationGaps(await statusLines(db, ids), 'EVENT_SUSPENDU');
            assert.equal(detected.length, ids.length, `trigger désactivé : le contrôle relève chaque rappel resté actif (${detected.join(' | ')})`);

            await db.query('ALTER TABLE public.event_status_history ENABLE TRIGGER trg_notif_cancel_on_status');
            await db.query('ALTER TABLE public.events DISABLE TRIGGER trg_notif_cancel_on_reschedule');
            await db.query("UPDATE public.events SET start_date = start_date + 1, end_date = end_date + 1 WHERE id = $1", [ev.eventId]);
            const detectedDate = cancellationGaps(await statusLines(db, ids), 'EVENT_RESCHEDULED');
            assert.equal(detectedDate.length, ids.length, `trigger de date désactivé : le contrôle relève chaque rappel resté actif (${detectedDate.join(' | ')})`);

            await db.query('ALTER TABLE public.events ENABLE TRIGGER trg_notif_cancel_on_reschedule');
            await db.query("UPDATE public.events SET start_date = start_date + 1, end_date = end_date + 1 WHERE id = $1", [ev.eventId]);
            assert.deepEqual(cancellationGaps(await statusLines(db, ids), 'EVENT_RESCHEDULED'), [], 'contre-épreuve : trigger actif, contrôle vide');
        });
        await assertStillPending(ids, 'après ROLLBACK : rien n’a changé');
        assert.equal(await eventStatus(ev.eventId), 'PUBLIE', 'après ROLLBACK : événement PUBLIE');
    });
});

/**
 * Lot 6, tâche 6.6 — notifications des contrôleurs (contrat G2, G3, G4, J2.1, J2.4, J2.12, E1, E7 ;
 * décisions 20, 39, 40 ; S2 groupe Pros).
 *  1. Affectation (trigger trg_event_controllers_notify, AFTER INSERT) : une in-app et un push par
 *     affectation (clé de l'affectation), un SMS agrégé par transaction (clé
 *     `CONTROLLER_ASSIGNED_SMS:<compte>:tx<txid>`) avec l'événement, la date et le point d'entrée ; par la
 *     route PATCH /api/partner/team/assignments (une instruction pour N affectations) : un seul SMS
 *     « et N-1 autres », réponse `notification: 'QUEUED'` sans `sms_sent`.
 *  2. Retrait (AFTER DELETE, route DELETE /api/partner/team/all) : de même, et les rappels contrôleur
 *     PENDING de (événement, compte) passent CANCELLED NO_LONGER_ASSIGNED ; ceux d'un autre contrôleur
 *     restent PENDING.
 *  3. Suppressions en cascade (brouillon supprimé ; compte supprimé, transaction annulée) : aucune
 *     erreur, aucune ligne de retrait (technique de lot5_cycle.sql:316).
 *  4. Caisse fermée par un tiers (shift_close) : SHIFT_CLOSED_BY_OTHER au contrôleur quand le partenaire
 *     ou un admin ferme sa caisse ; rien quand il la ferme lui-même.
 *  5. Activation : RPC notification_controller_activated → CONTROLLER_ACTIVATED (in-app, SMS) une fois.
 *  6. Invitation d'un nouveau compte : SMS synchrone avec le code (seule exception de longueur), journal
 *     CONTROLLER_INVITE (origine SYNC_LOG) sans le code, SMS d'affectation SKIPPED COVERED_BY_INVITATION
 *     (aucun second SMS) ; activation par POST /api/controller/setup : phone_verified_at posé (B1),
 *     CONTROLLER_ACTIVATED mis en file.
 *
 * Rouge avant correctif : boîte d'envoi, registre, trigger trg_event_controllers_notify,
 * notif_upsert_aggregated_sms et notification_controller_activated absents (migrations 20261103000002 et
 * …06) ; les routes d'équipe envoient leurs SMS et in-app directement (assignments/route.ts:242-249,
 * all/route.ts:251-259), shift_close ne prévient pas le contrôleur, l'invitation ne journalise rien.
 *
 * Interprétations retenues : dates des textes attendus par smsDateTime (lib/notifications/sms-format.ts) ;
 * dans un SMS agrégé, l'événement nommé est l'un des événements de la requête (ordre non fixé par le
 * contrat) ; un compte supprimé est supprimé dans une transaction annulée (aucune trace laissée).
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { NextRequest } from 'next/server';
import { inRolledBackTransaction } from '../helpers/db';
import { signInAs } from '../helpers/fixtures';
import { getFakes } from '../fakes';
import { BASE_URL, randomSenegalPhone } from './helpers';
import { importModule, service, type Buyer } from './paiement-helpers';
import { newPartner, type TestPartner } from './finance-helpers';
import { authed, newController, openShift, type RouteResult } from './acces-helpers';
import { advanceEventTo, createDraftEvent, type DraftEvent } from './cycle-helpers';
import {
    assertNotificationInvariants, deleteOutboxRows, dispatchAt, insertOutboxRow, loadLotModule, noonDakarTomorrow,
    outboxRows, smsMark, smsTo, type OutboxChannel, type OutboxRow,
} from './notif-helpers';

after(async () => {
    await assertNotificationInvariants('notif-controleurs');
});

type Row = Record<string, unknown>;
type Handler = (req: NextRequest, ctx?: unknown) => Promise<Response>;

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/+$/, '');
const ENTRY = 'Porte Nord';

let partner: TestPartner;

before(async () => {
    assert.ok(APP_URL.startsWith('http'), 'NEXT_PUBLIC_APP_URL absente de .env.test');
    partner = await newPartner('notif-ctrl');
});

// ── Outils locaux ──────────────────────────────────────────────────────────

async function invoke(handler: Handler, req: NextRequest, ctx?: unknown): Promise<RouteResult> {
    const res = await handler(req, ctx);
    const text = await res.text();
    let body: Row = {};
    try {
        body = text ? JSON.parse(text) : {};
    } catch (err) {
        body = { raw: text, parseError: (err as Error).message };
    }
    return { status: res.status, body };
}

function bearerRequest(path: string, method: string, token: string, body?: unknown): NextRequest {
    return new NextRequest(`${BASE_URL}${path}`, {
        method, headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: body === undefined ? undefined : JSON.stringify(body),
    });
}

function show(res: RouteResult): string {
    return `HTTP ${res.status} ${JSON.stringify(res.body).slice(0, 400)}`;
}

let ipSeq = 0;
function freshIp(): string {
    ipSeq += 1;
    return `198.19.${(process.pid % 200) + 1}.${(ipSeq % 250) + 1}`;
}

function shortTitle(prefix: string): string {
    const t = `${prefix} ${randomBytes(2).toString('hex')}`;
    assert.ok(t.length <= 25 && /^[A-Za-z0-9 ]+$/.test(t), `titre de test « ${t} » : 25 caractères GSM-7 au plus`);
    return t;
}

interface CtrlEvent extends DraftEvent { startAtIso: string }

/** Événement PUBLIE du partenaire de la suite, au titre court ; startAtIso = début (Dakar = UTC). */
async function ctrlEvent(label: string, startsInHours = 72): Promise<CtrlEvent> {
    const ev = await createDraftEvent(partner, label, [{ name: 'Standard', price: 5_000, total: 20 }], { title: shortTitle(label), startsInHours });
    await advanceEventTo(ev.eventId, 'PUBLIE', { partnerUserId: partner.userId });
    const { data, error } = await service.from('events').select('start_date, start_time').eq('id', ev.eventId).single();
    assert.equal(error, null, `dates de l'événement : ${error?.message}`);
    const time = String(data.start_time).length === 5 ? `${data.start_time}:00` : String(data.start_time);
    return { ...ev, startAtIso: new Date(`${data.start_date}T${time}Z`).toISOString() };
}

async function smsDateTime(): Promise<(iso: string) => string> {
    const mod = await loadLotModule('../../lib/notifications/sms-format', 'formats SMS (contrat F2.2)');
    assert.equal(typeof mod.smsDateTime, 'function', 'lib/notifications/sms-format.ts : smsDateTime non exporté');
    return mod.smsDateTime as (iso: string) => string;
}

async function groupRows(type: string, group: string, channels: OutboxChannel[], recipient: string): Promise<OutboxRow[]> {
    const rows = await outboxRows({ type, keyPrefix: `${group}:` });
    assert.deepEqual(rows.map((r) => r.channel).sort(), [...channels].sort(),
        `${group} : une ligne par canal ${channels.join(', ')} (reçu ${JSON.stringify(rows.map((r) => `${r.channel}:${r.status}:${r.reason ?? ''}`))})`);
    for (const r of rows) {
        assert.equal(r.group_key, group, `${group} : group_key`);
        assert.equal(r.idempotency_key, `${group}:${r.channel}`, `${group} : clé d'idempotence`);
        assert.equal(r.recipient_user_id, recipient, `${group} ${r.channel} : destinataire`);
    }
    return rows;
}

/** Ligne SMS agrégée unique d'un compte : type, préfixe `<PRÉFIXE>:<compte>:tx`, clé `…:SMS`. */
async function aggregatedSms(type: string, prefix: string, userId: string): Promise<OutboxRow> {
    const rows = await outboxRows({ type, channel: 'SMS', keyPrefix: `${prefix}:${userId}:tx` });
    assert.equal(rows.length, 1, `${prefix} : un seul SMS agrégé pour la requête (trouvé ${JSON.stringify(rows.map((r) => r.idempotency_key))})`);
    const r = rows[0];
    assert.match(r.idempotency_key, new RegExp(`^${prefix}:${userId}:tx\\d+:SMS$`), `${prefix} : clé à txid`);
    assert.equal(r.recipient_user_id, userId, `${prefix} : destinataire`);
    return r;
}

function eventsOf(r: OutboxRow): Row[] {
    const events = r.template_data.events;
    assert.ok(Array.isArray(events), `${r.idempotency_key} : template_data.events (liste) attendu : ${JSON.stringify(r.template_data)}`);
    return events as Row[];
}

async function deliver(rows: OutboxRow[], now: Date = new Date()): Promise<OutboxRow[]> {
    const ids = rows.map((r) => r.id);
    await dispatchAt(now, { ids });
    return outboxRows({ ids });
}

function byChannel(rows: OutboxRow[], channel: OutboxChannel): OutboxRow {
    const r = rows.find((x) => x.channel === channel);
    assert.ok(r, `ligne ${channel} absente (${JSON.stringify(rows.map((x) => x.idempotency_key))})`);
    return r;
}

async function assertInApp(rows: OutboxRow[], expected: { userId: string; title: string; contains: string[] }): Promise<void> {
    const r = byChannel(rows, 'IN_APP');
    assert.equal(r.status, 'SENT', `${r.idempotency_key} : IN_APP SENT (statut ${r.status}, motif ${r.reason})`);
    assert.ok(r.notification_id, `${r.idempotency_key} : notification_id`);
    const { data, error } = await service.from('notifications').select('*').eq('id', r.notification_id).single();
    assert.equal(error, null, `notification : ${error?.message}`);
    const n = data as Row;
    assert.equal(n.user_id, expected.userId, `${r.idempotency_key} : destinataire`);
    assert.equal(n.title, expected.title, `${r.idempotency_key} : titre (G4)`);
    for (const part of expected.contains) assert.ok(String(n.content).includes(part), `${r.idempotency_key} : contenu « ${n.content} » sans « ${part} »`);
    assert.equal((n.metadata as Row | null)?.actionUrl, '/controller/scanner', `${r.idempotency_key} : lien`);
}

function smsMessages(phone: string, since: number): string[] {
    return smsTo(phone, since).map((m) => m.message);
}

async function controllerWithoutAssignment(label: string): Promise<Buyer> {
    return newController(partner, null, { label });
}

// ── 1. Affectation ─────────────────────────────────────────────────────────

describe('6.6 Contrôleur — affectation (trg_event_controllers_notify, J2.4)', () => {
    test('une affectation (une instruction) : in-app et push de l’affectation, un SMS agrégé au texte exact (événement, date, point d’entrée)', async () => {
        const ev = await ctrlEvent('Affect');
        const ctrl = await controllerWithoutAssignment('affect-1');
        const { data, error } = await service.from('event_controllers')
            .insert({ event_id: ev.eventId, user_id: ctrl.userId, can_accept_cash: true, created_by: partner.userId, entry_point: ENTRY })
            .select('id').single();
        assert.equal(error, null, `affectation : ${error?.message}`);
        const assignmentId = String(data.id);
        const perAssignment = await groupRows('CONTROLLER_ASSIGNED', `CONTROLLER_ASSIGNED:${assignmentId}`, ['IN_APP', 'PUSH'], ctrl.userId);
        const sms = await aggregatedSms('CONTROLLER_ASSIGNED', 'CONTROLLER_ASSIGNED_SMS', ctrl.userId);
        assert.equal(sms.actor_id, partner.userId, 'SMS : compte déclencheur = created_by (quota par compte)');
        assert.equal(eventsOf(sms).length, 1, `SMS : un événement dans template_data.events (${JSON.stringify(sms.template_data)})`);
        const mark = smsMark(ctrl.phoneE164);
        const sent = await deliver([...perAssignment, sms]);
        const dh = (await smsDateTime())(ev.startAtIso);
        assert.equal(byChannel(sent, 'SMS').status, 'SENT', `SMS d'affectation SENT (${byChannel(sent, 'SMS').reason})`);
        assert.deepEqual(smsMessages(ctrl.phoneE164, mark), [`Event Village : affectation à l'entrée de ${ev.title}, ${dh}, point ${ENTRY}. ${APP_URL}/login`],
            'un SMS au texte exact (G3)');
        await assertInApp(sent, { userId: ctrl.userId, title: 'Nouvelle affectation', contains: [ev.title, ENTRY, 'Encaissement des espèces autorisé'] });
    });

    test('trois affectations par PATCH /api/partner/team/assignments : trois in-app, trois push, un seul SMS « et 2 autres » ; notification QUEUED', async () => {
        const evs = [await ctrlEvent('Lot A'), await ctrlEvent('Lot B'), await ctrlEvent('Lot C')];
        const ctrl = await controllerWithoutAssignment('affect-3');
        const { PATCH } = await importModule('../../app/api/partner/team/assignments/route');
        const mark = smsMark(ctrl.phoneE164);
        const res = await invoke(PATCH as Handler, authed('/api/partner/team/assignments', 'PATCH', partner,
            { controller_id: ctrl.userId, event_ids: evs.map((e) => e.eventId), can_accept_cash: false }));
        assert.equal(res.status, 200, `affectations : ${show(res)}`);
        assert.equal(res.body.notification, 'QUEUED', `réponse : notification QUEUED (J2.4) : ${show(res)}`);
        assert.ok(!('sms_sent' in res.body), `réponse : plus de sms_sent : ${show(res)}`);
        assert.deepEqual(smsMessages(ctrl.phoneE164, mark), [], 'aucun SMS envoyé par la route');
        const { data, error } = await service.from('event_controllers').select('id, event_id').eq('user_id', ctrl.userId);
        assert.equal(error, null, `affectations : ${error?.message}`);
        assert.equal((data ?? []).length, 3, 'trois affectations');
        const rows: OutboxRow[] = [];
        for (const a of data ?? []) rows.push(...await groupRows('CONTROLLER_ASSIGNED', `CONTROLLER_ASSIGNED:${a.id}`, ['IN_APP', 'PUSH'], ctrl.userId));
        const sms = await aggregatedSms('CONTROLLER_ASSIGNED', 'CONTROLLER_ASSIGNED_SMS', ctrl.userId);
        assert.deepEqual(eventsOf(sms).map((e) => String(e.event_id)).sort(), evs.map((e) => e.eventId).sort(), 'SMS agrégé : les trois événements');
        await deliver([...rows, sms]);
        const fmt = await smsDateTime();
        const candidates = evs.map((e) => `Event Village : affectation à l'entrée de ${e.title}, ${fmt(e.startAtIso)}, et 2 autres. ${APP_URL}/login`);
        const got = smsMessages(ctrl.phoneE164, mark);
        assert.equal(got.length, 1, `un seul SMS pour trois affectations (décision 20) : ${JSON.stringify(got)}`);
        assert.ok(candidates.includes(got[0]), `texte du SMS agrégé : « ${got[0]} » (attendu l'un de ${JSON.stringify(candidates)})`);
    });
});

// ── 2. Retrait ─────────────────────────────────────────────────────────────

describe('6.6 Contrôleur — retrait d’affectation (J2.4, I4)', () => {
    test('DELETE /api/partner/team/all : CONTROLLER_UNASSIGNED par affectation, un SMS agrégé, rappels PENDING du compte annulés NO_LONGER_ASSIGNED', async () => {
        const evs = [await ctrlEvent('Retrait A'), await ctrlEvent('Retrait B'), await ctrlEvent('Retrait C')];
        const ctrl = await controllerWithoutAssignment('retrait');
        const other = await controllerWithoutAssignment('retrait-temoin');
        const { data: inserted, error } = await service.from('event_controllers')
            .insert([...evs.map((e) => ({ event_id: e.eventId, user_id: ctrl.userId, can_accept_cash: false, created_by: partner.userId })),
                { event_id: evs[0].eventId, user_id: other.userId, can_accept_cash: false, created_by: partner.userId }])
            .select('id, event_id, user_id');
        assert.equal(error, null, `affectations : ${error?.message}`);
        const mine = (inserted ?? []).filter((a) => a.user_id === ctrl.userId);
        const reminder = await insertOutboxRow({
            type: 'CONTROLLER_REMINDER', family: 'OPTIONAL', topic: 'REMINDERS', channel: 'IN_APP', recipient_user_id: ctrl.userId, event_id: evs[0].eventId,
            group_key: `CONTROLLER_REMINDER:${evs[0].eventId}:${ctrl.userId}:TEST${randomUUID().slice(0, 8)}`, template_data: { event_id: evs[0].eventId },
        });
        const witness = await insertOutboxRow({
            type: 'CONTROLLER_REMINDER', family: 'OPTIONAL', topic: 'REMINDERS', channel: 'IN_APP', recipient_user_id: other.userId, event_id: evs[0].eventId,
            group_key: `CONTROLLER_REMINDER:${evs[0].eventId}:${other.userId}:TEST${randomUUID().slice(0, 8)}`, template_data: { event_id: evs[0].eventId },
        });
        try {
            const mark = smsMark(ctrl.phoneE164);
            const { DELETE } = await importModule('../../app/api/partner/team/all/route');
            const res = await invoke(DELETE as Handler, authed(`/api/partner/team/all?controllerId=${ctrl.userId}`, 'DELETE', partner));
            assert.equal(res.status, 200, `retrait : ${show(res)}`);
            assert.equal(res.body.notification, 'QUEUED', `réponse : notification QUEUED : ${show(res)}`);
            assert.deepEqual(smsMessages(ctrl.phoneE164, mark), [], 'aucun SMS envoyé par la route');
            const rows: OutboxRow[] = [];
            for (const a of mine) rows.push(...await groupRows('CONTROLLER_UNASSIGNED', `CONTROLLER_UNASSIGNED:${a.id}`, ['IN_APP', 'PUSH'], ctrl.userId));
            const sms = await aggregatedSms('CONTROLLER_UNASSIGNED', 'CONTROLLER_UNASSIGNED_SMS', ctrl.userId);
            assert.equal(eventsOf(sms).length, 3, 'SMS agrégé : trois événements retirés');
            const [r] = await outboxRows({ ids: [reminder.id] });
            assert.equal(r.status, 'CANCELLED', `rappel contrôleur PENDING : CANCELLED dans la transaction du retrait (${r.status})`);
            assert.equal(r.reason, 'NO_LONGER_ASSIGNED', `motif : ${r.reason}`);
            const [w] = await outboxRows({ ids: [witness.id] });
            assert.equal(w.status, 'PENDING', 'rappel d’un autre contrôleur du même événement : inchangé');
            const sent = await deliver([...rows, sms]);
            const candidates = evs.map((e) => `Event Village : votre affectation à l'entrée de ${e.title} est retirée, et 2 autres.`);
            const got = smsMessages(ctrl.phoneE164, mark);
            assert.equal(got.length, 1, `un seul SMS pour trois retraits : ${JSON.stringify(got)}`);
            assert.ok(candidates.includes(got[0]), `texte du SMS de retrait : « ${got[0]} » (attendu l'un de ${JSON.stringify(candidates)})`);
            await assertInApp(sent.filter((x) => x.group_key === `CONTROLLER_UNASSIGNED:${mine[0].id}`), {
                userId: ctrl.userId, title: 'Affectation retirée', contains: [evs.find((e) => e.eventId === mine[0].event_id)!.title],
            });
        } finally {
            await deleteOutboxRows([witness.id]);
        }
    });

    test('suppressions en cascade : brouillon supprimé, compte supprimé (transaction annulée) → aucune erreur, aucune ligne de retrait', async () => {
        const draft = await createDraftEvent(partner, 'ctrl-cascade', [{ name: 'Standard', price: 1_000, total: 5 }], { title: shortTitle('Cascade'), startsInHours: 72 });
        const ctrlA = await controllerWithoutAssignment('cascade-ev');
        const { data: a, error } = await service.from('event_controllers')
            .insert({ event_id: draft.eventId, user_id: ctrlA.userId, can_accept_cash: false, created_by: partner.userId }).select('id').single();
        assert.equal(error, null, `affectation au brouillon : ${error?.message}`);
        await groupRows('CONTROLLER_ASSIGNED', `CONTROLLER_ASSIGNED:${a.id}`, ['IN_APP', 'PUSH'], ctrlA.userId);
        const { error: delErr } = await service.from('events').delete().eq('id', draft.eventId);
        assert.equal(delErr, null, `suppression du brouillon (cascade sur event_controllers) : ${delErr?.message} (code ${delErr?.code})`);
        assert.deepEqual(await outboxRows({ type: 'CONTROLLER_UNASSIGNED', keyPrefix: `CONTROLLER_UNASSIGNED:${a.id}:` }), [], 'cascade d’un événement : aucun avis de retrait');

        const ev = await ctrlEvent('Cascade cpt');
        const ctrlB = await controllerWithoutAssignment('cascade-compte');
        const { data: b, error: bErr } = await service.from('event_controllers')
            .insert({ event_id: ev.eventId, user_id: ctrlB.userId, can_accept_cash: false, created_by: partner.userId }).select('id').single();
        assert.equal(bErr, null, `affectation : ${bErr?.message}`);
        await groupRows('CONTROLLER_ASSIGNED', `CONTROLLER_ASSIGNED:${b.id}`, ['IN_APP', 'PUSH'], ctrlB.userId);
        const out = await inRolledBackTransaction(async (db) => {
            await db.query('DELETE FROM auth.users WHERE id = $1', [ctrlB.userId]);
            const left = await db.query<{ n: number }>('SELECT count(*)::int AS n FROM public.event_controllers WHERE id = $1', [b.id]);
            const unassigned = await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM public.notification_outbox WHERE idempotency_key LIKE $1`, [`CONTROLLER_UNASSIGNED:${b.id}:%`]);
            return { left: left.rows[0].n, unassigned: unassigned.rows[0].n };
        });
        assert.equal(out.left, 0, 'cascade du compte : affectation supprimée');
        assert.equal(out.unassigned, 0, 'cascade du compte : aucun avis de retrait (le trigger ignore la cascade)');
    });
});

// ── 3. Caisse fermée par un tiers ──────────────────────────────────────────

describe('6.6 Contrôleur — caisse fermée par un tiers (shift_close, J2.1)', () => {
    test('fermée par le partenaire ou par un admin : SHIFT_CLOSED_BY_OTHER (in-app, push) au contrôleur ; fermée par lui-même : rien', async () => {
        const ev = await ctrlEvent('Caisse', 1);
        const cashiers: Array<{ ctrl: Buyer; shiftId: string; expected: number }> = [];
        for (const label of ['caisse-part', 'caisse-admin', 'caisse-soi']) {
            const ctrl = await newController(partner, ev.eventId, { canAcceptCash: true, label });
            const res = await openShift(ctrl, ev.eventId);
            assert.equal(res.status, 200, `ouverture (${label}) : ${show(res)}`);
            const { data, error } = await service.from('controller_shifts').select('id, expected_cash_total').eq('controller_id', ctrl.userId).eq('status', 'OUVERT');
            assert.equal(error, null, `caisse : ${error?.message}`);
            cashiers.push({ ctrl, shiftId: String(data![0].id), expected: Number(data![0].expected_cash_total) });
        }
        const admin = await signInAs('SUPERADMIN');
        const { POST } = await importModule('../../app/api/controller/shifts/close/route');
        const close = async (who: { accessToken: string }, c: { shiftId: string; expected: number }): Promise<RouteResult> => invoke(POST as Handler,
            bearerRequest('/api/controller/shifts/close', 'POST', who.accessToken, { shiftId: c.shiftId, declaredCashTotal: c.expected }));
        const r1 = await close(partner, cashiers[0]);
        assert.equal(r1.status, 200, `fermeture par le partenaire : ${show(r1)}`);
        const r2 = await close(admin, cashiers[1]);
        assert.equal(r2.status, 200, `fermeture par un admin : ${show(r2)}`);
        const r3 = await close(cashiers[2].ctrl, cashiers[2]);
        assert.equal(r3.status, 200, `fermeture par le contrôleur : ${show(r3)}`);

        const byPartner = await groupRows('SHIFT_CLOSED_BY_OTHER', `SHIFT_CLOSED_BY_OTHER:${cashiers[0].shiftId}`, ['IN_APP', 'PUSH'], cashiers[0].ctrl.userId);
        const byAdmin = await groupRows('SHIFT_CLOSED_BY_OTHER', `SHIFT_CLOSED_BY_OTHER:${cashiers[1].shiftId}`, ['IN_APP', 'PUSH'], cashiers[1].ctrl.userId);
        assert.deepEqual(await outboxRows({ type: 'SHIFT_CLOSED_BY_OTHER', keyPrefix: `SHIFT_CLOSED_BY_OTHER:${cashiers[2].shiftId}:` }), [], 'fermée par le contrôleur lui-même : aucun avis');
        const sent = await deliver([...byPartner, ...byAdmin]);
        await assertInApp(sent.filter((r) => r.recipient_user_id === cashiers[0].ctrl.userId), { userId: cashiers[0].ctrl.userId, title: 'Caisse fermée', contains: [ev.title, 'organisateur'] });
        await assertInApp(sent.filter((r) => r.recipient_user_id === cashiers[1].ctrl.userId), { userId: cashiers[1].ctrl.userId, title: 'Caisse fermée', contains: [ev.title, 'administration'] });
    });
});

// ── 4. Activation et invitation ────────────────────────────────────────────

describe('6.6 Contrôleur — activation et invitation d’un nouveau compte (J2.12, E7)', () => {
    test('notification_controller_activated : CONTROLLER_ACTIVATED (in-app, SMS) une seule fois, SMS exact', async () => {
        const ctrl = await controllerWithoutAssignment('active');
        const call = async () => service.rpc('notification_controller_activated', { p: { user_id: ctrl.userId } });
        const first = await call();
        assert.equal(first.error, null, `notification_controller_activated : ${first.error?.message} (code ${first.error?.code})`);
        assert.equal((first.data as Row | null)?.ok, true, `réponse : ${JSON.stringify(first.data)}`);
        const rows = await groupRows('CONTROLLER_ACTIVATED', `CONTROLLER_ACTIVATED:${ctrl.userId}`, ['IN_APP', 'SMS'], ctrl.userId);
        const again = await call();
        assert.equal(again.error, null, `second appel : ${again.error?.message}`);
        assert.equal((await outboxRows({ type: 'CONTROLLER_ACTIVATED', userId: ctrl.userId })).length, 2, 'second appel : aucune ligne de plus');
        const mark = smsMark(ctrl.phoneE164);
        const sent = await deliver(rows);
        assert.deepEqual(smsMessages(ctrl.phoneE164, mark), ['Event Village : votre compte est activé. Vous pouvez vous connecter et scanner les billets.'], 'SMS exact (G3)');
        await assertInApp(sent, { userId: ctrl.userId, title: 'Compte activé', contains: ['scanner'] });
    });

    test('invitation d’un nouveau compte : SMS synchrone avec le code, journal sans code, aucun second SMS d’affectation ; setup → phone_verified_at et CONTROLLER_ACTIVATED', async () => {
        const ev = await ctrlEvent('Invitation');
        const phone = randomSenegalPhone('76');
        const { POST } = await importModule('../../app/api/partner/team/invite/route');
        const res = await invoke(POST as Handler, authed('/api/partner/team/invite', 'POST', partner,
            { phone, event_ids: [ev.eventId], first_name: 'Moussa' }, { 'x-forwarded-for': `${freshIp()}, 10.0.0.1` }));
        assert.ok(res.status === 200 || res.status === 201, `invitation : ${show(res)}`);
        assert.equal(res.body.is_new_user, true, `nouveau compte : ${show(res)}`);
        assert.equal(res.body.sms_sent, true, `SMS d'invitation synchrone envoyé : ${show(res)}`);
        const invites = getFakes().sms.messagesTo(phone);
        assert.equal(invites.length, 1, 'un SMS synchrone : l’invitation');
        const code = invites[0].message.match(/\b(\d{6})\b/)?.[1];
        assert.ok(code, `code d'activation dans le SMS : « ${invites[0].message} »`);
        assert.ok(invites[0].message.includes(`${APP_URL}/controller/setup?phone=`), `lien d'activation : « ${invites[0].message} »`);

        const logs = await outboxRows({ type: 'CONTROLLER_INVITE', phone });
        assert.equal(logs.length, 1, `journal de l'invitation (contrat E7) : ${JSON.stringify(logs.map((l) => l.idempotency_key))}`);
        const log = logs[0];
        assert.equal(log.origin, 'SYNC_LOG', 'journal : origine SYNC_LOG');
        assert.equal(log.channel, 'SMS', 'journal : canal SMS');
        assert.equal(log.status, 'SENT', `journal : SENT (${log.status} ${log.reason})`);
        assert.match(log.idempotency_key, /^CONTROLLER_INVITE:[0-9a-f-]{36}:SMS$/, `journal : clé <type>:<otp_codes.id>:SMS (${log.idempotency_key})`);
        const otpId = log.idempotency_key.split(':')[1];
        const { data: otp, error: otpErr } = await service.from('otp_codes').select('id, purpose').eq('id', otpId).maybeSingle();
        assert.equal(otpErr, null, `otp_codes : ${otpErr?.message}`);
        assert.equal(otp?.purpose, 'CONTROLLER_SETUP', `référence du journal : le code d'activation enregistré (${JSON.stringify(otp)})`);
        const logged = JSON.stringify(log);
        assert.ok(!logged.includes(code!), 'journal : le code d’activation n’est jamais stocké');
        assert.ok(!/controller\/setup/.test(JSON.stringify(log.template_data)), 'journal : le lien d’activation n’est pas stocké');

        const { data: user, error: uErr } = await service.from('users').select('id, phone_verified_at').eq('phone', phone).single();
        assert.equal(uErr, null, `compte créé : ${uErr?.message}`);
        const userId = String(user.id);
        const { data: asg, error: aErr } = await service.from('event_controllers').select('id').eq('user_id', userId).eq('event_id', ev.eventId).single();
        assert.equal(aErr, null, `affectation : ${aErr?.message}`);
        const perAssignment = await groupRows('CONTROLLER_ASSIGNED', `CONTROLLER_ASSIGNED:${asg.id}`, ['IN_APP', 'PUSH'], userId);
        const sms = await aggregatedSms('CONTROLLER_ASSIGNED', 'CONTROLLER_ASSIGNED_SMS', userId);
        const sent = await deliver([...perAssignment, sms]);
        const smsRow = byChannel(sent, 'SMS');
        assert.equal(smsRow.status, 'SKIPPED', `SMS d'affectation après l'invitation : SKIPPED (${smsRow.status})`);
        assert.equal(smsRow.reason, 'COVERED_BY_INVITATION', `motif : ${smsRow.reason}`);
        assert.equal(getFakes().sms.messagesTo(phone).length, 1, 'aucun second SMS (décision 20)');
        assert.equal(byChannel(sent, 'IN_APP').status, 'SENT', 'in-app d’affectation livrée');

        const { POST: setup } = await importModule('../../app/api/controller/setup/route');
        const s = await invoke(setup as Handler, new NextRequest(`${BASE_URL}/api/controller/setup`, {
            method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': `${freshIp()}, 10.0.0.1` },
            body: JSON.stringify({ phone, otp_code: code, new_password: `Ctrl#${randomBytes(6).toString('hex')}-2026` }),
        }));
        assert.equal(s.status, 200, `activation du compte : ${show(s)}`);
        const { data: after1, error: vErr } = await service.from('users').select('phone_verified_at').eq('id', userId).single();
        assert.equal(vErr, null, `phone_verified_at : ${vErr?.message} (colonne du contrat B1)`);
        assert.ok(after1.phone_verified_at, 'setup : users.phone_verified_at posé (contrat B1)');
        const activated = await groupRows('CONTROLLER_ACTIVATED', `CONTROLLER_ACTIVATED:${userId}`, ['IN_APP', 'SMS'], userId);
        const mark = smsMark(phone);
        await deliver(activated, noonDakarTomorrow());
        assert.deepEqual(smsMessages(phone, mark), ['Event Village : votre compte est activé. Vous pouvez vous connecter et scanner les billets.'], 'SMS d’activation exact, par la boîte d’envoi');
    });
});

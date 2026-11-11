/**
 * Lot 7, tâche 7.0 b — rappels des billets gratuits sans SMS (contrat, section 4.2 ; M2.7 ; D17).
 * Règle : les rappels J-1 et H-3 d'un porteur qui ne détient, pour l'événement, que des billets gratuits
 * (prix 0 ou canal FREE / INVITATION) ne partent jamais par SMS quand notif.free_ticket_reminder_sms = NEVER
 * (défaut) : la ligne SMS est SKIPPED FREE_TICKETS_ONLY dès la planification (instantané ENQUEUE), les autres
 * canaux sont créés normalement, et template_data.free_only dit ce qui a été décidé. SAME_AS_PAID traite ces
 * porteurs comme ceux d'un billet payant. La confirmation des billets gratuits (FREE_TICKETS_CONFIRMED, famille
 * ESSENTIAL) garde son SMS.
 *
 * Horloge simulée : scheduleAt / dispatchAt (jamais dans le passé), sur des jours futurs tirés au hasard ;
 * événements à 20:00 (Dakar) : J-1 dû la veille à 10:00, H-3 à 17:00. Planifications et envois filtrés par
 * événement. Comptage par numéro neuf (newBuyer). Le réglage est posé explicitement dans chaque cas
 * (withNotifSettings), jamais lu de l'état laissé par une autre suite.
 *  1. billet FREE (0 F) avec NEVER : J-1 (I P M S) et H-3 (I P S) créés, IN_APP et PUSH en attente, SMS SKIPPED
 *     FREE_TICKETS_ONLY, free_only = true ; après les envois : aucun SMS ;
 *  2. invitation (INVITATION) et billet à 0 F vendu en ligne (ONLINE) : idem ;
 *  3. billet gratuit et billet payant du même événement : SMS du J-1 SENT, free_only = false ;
 *  4. SAME_AS_PAID : SMS du J-1 SENT pour un porteur gratuit seulement ;
 *  5. (couverture, vert dès l'écriture) FREE_TICKETS_CONFIRMED garde son SMS sous NEVER ;
 *  6. gratuit sur A, payant sur B (même porteur, même jour) : rappel de A sans SMS, rappel de B avec SMS.
 *
 * Rouge avant correctif : le réglage notif.free_ticket_reminder_sms n'existe pas (withNotifSettings échoue
 * « réglage absent », fix(7.0a)) ; puis, avant fix(7.0b), la planification met le SMS en attente pour tous les
 * porteurs et n'écrit pas free_only.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomInt } from 'node:crypto';
import { NextRequest } from 'next/server';
import { BASE_URL } from './helpers';
import { importModule, newBuyer, type Buyer, type CategorySpec } from './paiement-helpers';
import { buyConfirmed, newPartner, type TestPartner } from './finance-helpers';
import {
    createReminderEvent, dakarAt, dakarDay, dispatchAt, outboxRows, scheduleAt, smsMark, smsTo, withNotifSettings,
    type NotifSettingKey, type OutboxChannel, type OutboxRow, type ReminderEvent,
} from './notif-helpers';
import { assertTerrainInvariants, issueFreeTicket } from './terrain-helpers';

after(async () => {
    await assertTerrainInvariants('rappels-gratuits');
});

type Row = Record<string, unknown>;
type FreePolicy = 'NEVER' | 'SAME_AS_PAID';

const STANDARD = 'Standard';
const FREE = 'Entree libre';
const CATEGORIES: CategorySpec[] = [{ name: STANDARD, price: 5_000, total: 50 }, { name: FREE, price: 0, total: 50 }];
const J1_CHANNELS: OutboxChannel[] = ['EMAIL', 'IN_APP', 'PUSH', 'SMS'];
const H3_CHANNELS: OutboxChannel[] = ['EMAIL', 'IN_APP', 'PUSH', 'SMS']; // lot 9 bis (G.49, B97, 5.50) : EMAIL au registre

/** Réglages des rappels au défaut du contrat (I1 du lot 6), politique des billets gratuits posée par cas. */
function settings(policy: FreePolicy): Partial<Record<NotifSettingKey, unknown>> {
    return {
        'notif.reminder_j1_enabled': true,
        'notif.reminder_j1_hour': 10,
        'notif.j1_sms': 'ALWAYS',
        'notif.reminder_h3_enabled': true,
        'notif.reminder_h3_hours': 3,
        'notif.h3_sms': 'IF_NO_PUSH',
        'notif.sms_quiet_start': 22,
        'notif.sms_quiet_end': 8,
        'notif.free_ticket_reminder_sms': policy,
    };
}

let partner: TestPartner;

before(async () => {
    partner = await newPartner('rappels-gratuits');
});

// ── Outils locaux ──────────────────────────────────────────────────────────

const usedOffsets = new Set<number>();
function randomEventDay(): string {
    for (;;) {
        const offset = 60 + randomInt(0, 900);
        if ([-1, 0, 1].some((d) => usedOffsets.has(offset + d))) continue;
        usedOffsets.add(offset);
        return dakarDay(offset);
    }
}

function dayPlus(day: string, n: number): string {
    return dakarDay(n, new Date(`${day}T12:00:00.000Z`));
}

function shortTitle(prefix: string): string {
    const t = `${prefix} ${randomBytes(3).toString('hex')}`;
    assert.ok(t.length <= 25 && /^[A-Za-z0-9 ]+$/.test(t), `titre de test « ${t} » : 25 caractères GSM-7 au plus`);
    return t;
}

async function freeEvent(label: string, day: string): Promise<ReminderEvent> {
    return createReminderEvent(partner, `gratuits-${label}`, {
        startDate: day, startTime: '20:00', categories: CATEGORIES, title: shortTitle('Gratuit'), location: 'Salle Sorano', city: 'Dakar',
    });
}

function byChannel(rows: OutboxRow[], what: string): Record<OutboxChannel, OutboxRow> {
    const out = {} as Record<OutboxChannel, OutboxRow>;
    for (const r of rows) {
        assert.equal(out[r.channel], undefined, `${what} : deux lignes ${r.channel}`);
        out[r.channel] = r;
    }
    return out;
}

async function reminderRows(type: 'REMINDER_J1' | 'REMINDER_H3', ev: ReminderEvent, user: Buyer, channels: OutboxChannel[], what: string): Promise<Record<OutboxChannel, OutboxRow>> {
    const rows = await outboxRows({ type, eventId: ev.eventId, userId: user.userId });
    assert.deepEqual(rows.map((r) => r.channel).sort(), [...channels].sort(), `${what} : une ligne par canal ${channels.join(', ')} (reçu ${JSON.stringify(rows.map((r) => `${r.channel}:${r.status}:${r.reason ?? ''}`))})`);
    return byChannel(rows, what);
}

function show(r: OutboxRow): string {
    return JSON.stringify({ type: r.type, channel: r.channel, status: r.status, reason: r.reason, free_only: r.template_data.free_only, decision: r.decision });
}

/** SMS d'un rappel sans SMS : SKIPPED FREE_TICKETS_ONLY dès l'insertion, free_only = true sur chaque ligne. */
function assertFreeOnlySkip(rows: Record<OutboxChannel, OutboxRow>, what: string): void {
    const sms = rows.SMS;
    assert.equal(sms.status, 'SKIPPED', `${what} : SMS SKIPPED attendu (${show(sms)})`);
    assert.equal(sms.reason, 'FREE_TICKETS_ONLY', `${what} : motif FREE_TICKETS_ONLY (${show(sms)})`);
    const d = (sms.decision ?? {}) as Row;
    assert.equal(d.stage, 'ENQUEUE', `${what} : décidé à la planification (${show(sms)})`);
    assert.equal(d.reason, 'FREE_TICKETS_ONLY', `${what} : instantané de décision (${show(sms)})`);
    assert.ok(sms.finished_at, `${what} : finished_at posé`);
    for (const ch of ['IN_APP', 'PUSH'] as const) {
        assert.equal(rows[ch].status, 'PENDING', `${what} : ${ch} créé et en attente (${show(rows[ch])})`);
    }
    for (const r of Object.values(rows)) assert.equal(r.template_data.free_only, true, `${what} : template_data.free_only = true sur ${r.channel} (${show(r)})`);
}

async function scheduleJ1(evs: ReminderEvent[], day: string): Promise<void> {
    await scheduleAt(dakarAt(dayPlus(day, -1), '10:00:30'), evs.map((e) => e.eventId));
}

async function dispatchJ1(evs: ReminderEvent[], day: string): Promise<void> {
    await dispatchAt(dakarAt(dayPlus(day, -1), '10:01'), { eventIds: evs.map((e) => e.eventId) });
}

async function scheduleAndDispatchH3(evs: ReminderEvent[], day: string): Promise<void> {
    await scheduleAt(dakarAt(day, '17:00:30'), evs.map((e) => e.eventId));
    await dispatchAt(dakarAt(day, '17:01'), { eventIds: evs.map((e) => e.eventId) });
    await dispatchAt(dakarAt(day, '17:02:05'), { eventIds: evs.map((e) => e.eventId) });
}

function j1Sms(phone: string, since: number): string[] {
    return smsTo(phone, since).map((m) => m.message).filter((m) => /^Event Village : rappel, /.test(m));
}

/** Porteur neuf d'un billet à 0 F de l'événement, canal donné (FREE, INVITATION ou ONLINE à prix 0). */
async function freeHolder(ev: ReminderEvent, label: string, channel: 'FREE' | 'INVITATION' | 'ONLINE'): Promise<Buyer> {
    const holder = await newBuyer(`grat-${label}`);
    await issueFreeTicket(ev.eventId, ev.categories[FREE].id, holder, { saleChannel: channel });
    return holder;
}

/** Cas 1 et 2 : J-1 et H-3 sans SMS, aucun SMS après les envois. */
async function assertNoReminderSms(ev: ReminderEvent, day: string, holders: Array<[Buyer, string]>): Promise<void> {
    const marks = new Map(holders.map(([h]) => [h.userId, smsMark(h.phoneE164)]));
    await scheduleJ1([ev], day);
    for (const [h, what] of holders) assertFreeOnlySkip(await reminderRows('REMINDER_J1', ev, h, J1_CHANNELS, `J-1 ${what}`), `J-1 ${what}`);
    await dispatchJ1([ev], day);
    for (const [h, what] of holders) {
        const j1 = await reminderRows('REMINDER_J1', ev, h, J1_CHANNELS, `J-1 ${what} après l'envoi`);
        assert.equal(j1.SMS.status, 'SKIPPED', `J-1 ${what} : le SMS reste SKIPPED`);
        assert.equal(j1.IN_APP.status, 'SENT', `J-1 ${what} : rappel dans l'application envoyé (${show(j1.IN_APP)})`);
    }
    await scheduleAndDispatchH3([ev], day);
    for (const [h, what] of holders) {
        const h3 = await reminderRows('REMINDER_H3', ev, h, H3_CHANNELS, `H-3 ${what}`);
        assert.equal(h3.SMS.status, 'SKIPPED', `H-3 ${what} : SMS SKIPPED (${show(h3.SMS)})`);
        assert.equal(h3.SMS.reason, 'FREE_TICKETS_ONLY', `H-3 ${what} : motif FREE_TICKETS_ONLY (${show(h3.SMS)})`);
        assert.equal(h3.SMS.template_data.free_only, true, `H-3 ${what} : free_only`);
        assert.equal(h3.IN_APP.status, 'SENT', `H-3 ${what} : rappel dans l'application envoyé (${show(h3.IN_APP)})`);
        assert.deepEqual(smsTo(h.phoneE164, marks.get(h.userId)), [], `${what} : aucun SMS de rappel (J-1 ni H-3)`);
    }
}

// ── Cas ────────────────────────────────────────────────────────────────────

describe('7.0 b Rappels d’un porteur de billets gratuits seulement : jamais par SMS avec NEVER (D17)', () => {
    test('billet FREE à 0 F : J-1 et H-3 créés (application et push), SMS SKIPPED FREE_TICKETS_ONLY, free_only ; aucun SMS', async () => {
        await withNotifSettings(settings('NEVER'), async () => {
            const day = randomEventDay();
            const ev = await freeEvent('free', day);
            const holder = await freeHolder(ev, 'free', 'FREE');
            await assertNoReminderSms(ev, day, [[holder, 'billet FREE']]);
        });
    });

    test('invitation (INVITATION) et billet à 0 F vendu en ligne (ONLINE) : idem', async () => {
        await withNotifSettings(settings('NEVER'), async () => {
            const day = randomEventDay();
            const ev = await freeEvent('invitation', day);
            const invitee = await freeHolder(ev, 'invitation', 'INVITATION');
            const zeroOnline = await freeHolder(ev, 'zero-en-ligne', 'ONLINE');
            await assertNoReminderSms(ev, day, [[invitee, 'invitation'], [zeroOnline, 'billet à 0 F vendu en ligne']]);
        });
    });

    test('billet gratuit et billet payant du même événement : SMS du J-1 envoyé, free_only = false', async () => {
        await withNotifSettings(settings('NEVER'), async () => {
            const day = randomEventDay();
            const ev = await freeEvent('mixte', day);
            const holder = await freeHolder(ev, 'mixte', 'FREE');
            await buyConfirmed(holder, ev, [[STANDARD, 1]]);
            const mark = smsMark(holder.phoneE164);
            await scheduleJ1([ev], day);
            const j1 = await reminderRows('REMINDER_J1', ev, holder, J1_CHANNELS, 'J-1 gratuit + payant');
            assert.equal(j1.SMS.status, 'PENDING', `SMS en attente : ${show(j1.SMS)}`);
            assert.equal(j1.SMS.template_data.free_only, false, `free_only = false : ${show(j1.SMS)}`);
            await dispatchJ1([ev], day);
            const after1 = await reminderRows('REMINDER_J1', ev, holder, J1_CHANNELS, 'J-1 gratuit + payant après l’envoi');
            assert.equal(after1.SMS.status, 'SENT', `SMS du J-1 : ${show(after1.SMS)}`);
            assert.equal(j1Sms(holder.phoneE164, mark).length, 1, 'un SMS de rappel J-1');
        });
    });

    test('SAME_AS_PAID : porteur d’un billet gratuit seulement, SMS du J-1 envoyé', async () => {
        await withNotifSettings(settings('SAME_AS_PAID'), async () => {
            const day = randomEventDay();
            const ev = await freeEvent('comme-payant', day);
            const holder = await freeHolder(ev, 'comme-payant', 'FREE');
            const mark = smsMark(holder.phoneE164);
            await scheduleJ1([ev], day);
            const j1 = await reminderRows('REMINDER_J1', ev, holder, J1_CHANNELS, 'J-1 SAME_AS_PAID');
            assert.equal(j1.SMS.status, 'PENDING', `SMS en attente : ${show(j1.SMS)}`);
            assert.equal(j1.SMS.template_data.free_only, true, `free_only décrit le porteur, quelle que soit la politique : ${show(j1.SMS)}`);
            await dispatchJ1([ev], day);
            const after1 = await reminderRows('REMINDER_J1', ev, holder, J1_CHANNELS, 'J-1 SAME_AS_PAID après l’envoi');
            assert.equal(after1.SMS.status, 'SENT', `SMS du J-1 : ${show(after1.SMS)}`);
            assert.equal(j1Sms(holder.phoneE164, mark).length, 1, 'un SMS de rappel J-1');
        });
    });

    test('FREE_TICKETS_CONFIRMED garde son SMS sous NEVER (couverture : déjà vrai)', async () => {
        await withNotifSettings(settings('NEVER'), async () => {
            const day = randomEventDay();
            const ev = await freeEvent('confirmation', day);
            const holder = await newBuyer('grat-confirmation');
            const mark = smsMark(holder.phoneE164);
            const { POST } = await importModule('../../app/api/tickets/claim-free/route') as { POST: (req: NextRequest) => Promise<Response> };
            const res = await POST(new NextRequest(`${BASE_URL}/api/tickets/claim-free`, {
                method: 'POST',
                headers: { 'content-type': 'application/json', authorization: `Bearer ${holder.accessToken}` },
                body: JSON.stringify({ categoryId: ev.categories[FREE].id, quantity: 1 }),
            }));
            assert.equal(res.status, 200, `billet gratuit : HTTP ${res.status} ${JSON.stringify(await res.json())}`);
            const rows = await outboxRows({ type: 'FREE_TICKETS_CONFIRMED', userId: holder.userId, channel: 'SMS' });
            assert.equal(rows.length, 1, `une ligne SMS de confirmation : ${JSON.stringify(rows.map((r) => r.idempotency_key))}`);
            await dispatchAt(new Date(), { ids: rows.map((r) => r.id) });
            const [done] = await outboxRows({ ids: [rows[0].id] });
            assert.equal(done.status, 'SENT', `confirmation des billets gratuits : ${show(done)}`);
            const sms = smsTo(holder.phoneE164, mark).map((m) => m.message);
            assert.equal(sms.length, 1, 'un SMS de confirmation');
            assert.match(sms[0], /^Event Village : 1 billet gratuit pour /, `texte de la confirmation : ${sms[0]}`);
        });
    });

    test('gratuit sur A, payant sur B (même porteur, même jour) : rappel de A sans SMS, rappel de B avec SMS', async () => {
        await withNotifSettings(settings('NEVER'), async () => {
            const day = randomEventDay();
            const a = await freeEvent('a-gratuit', day);
            const b = await freeEvent('b-payant', day);
            const holder = await freeHolder(a, 'a-b', 'FREE');
            await buyConfirmed(holder, b, [[STANDARD, 1]]);
            const mark = smsMark(holder.phoneE164);
            await scheduleJ1([a, b], day);
            assertFreeOnlySkip(await reminderRows('REMINDER_J1', a, holder, J1_CHANNELS, 'J-1 de A (gratuit)'), 'J-1 de A (gratuit)');
            const jb = await reminderRows('REMINDER_J1', b, holder, J1_CHANNELS, 'J-1 de B (payant)');
            assert.equal(jb.SMS.status, 'PENDING', `J-1 de B : SMS en attente (${show(jb.SMS)})`);
            assert.equal(jb.SMS.template_data.free_only, false, `J-1 de B : free_only = false (${show(jb.SMS)})`);
            await dispatchJ1([a, b], day);
            const sb = await reminderRows('REMINDER_J1', b, holder, J1_CHANNELS, 'J-1 de B après l’envoi');
            assert.equal(sb.SMS.status, 'SENT', `J-1 de B : ${show(sb.SMS)}`);
            const sms = j1Sms(holder.phoneE164, mark);
            assert.equal(sms.length, 1, `un seul SMS de rappel (celui de B) : ${JSON.stringify(sms)}`);
            assert.ok(sms[0].includes(b.title), `le SMS reçu est celui de B (« ${b.title} ») : ${sms[0]}`);
        });
    });
});

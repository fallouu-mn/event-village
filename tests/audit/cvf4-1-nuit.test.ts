/**
 * Contre-vérification de la finition 4 — point 2 : la nuit (plage 01:00 → 07:00, heure de Dakar, réglage).
 *
 * Attendu (consigne) : un message urgent n'est jamais reporté ni perdu ; un message non urgent reporté part à la fin de la
 * plage et revérifie tout (événement commencé, annulé, préférence coupée) ; la plage suit le réglage.
 *
 *  T1 (trou) : avis « événement suspendu » au porteur (EVENT_SUSPENDED_HOLDER, famille OPTIONAL donc DEFER) préparé à 02:00,
 *     événement ANNULÉ à 04:00 : à 07:00 le SMS « … est suspendu pour le moment. Vos billets restent valables » part quand
 *     même. notification_outbox_claim (20261125000002_f4_nuit.sql:203-250) ne revérifie l'état de l'événement que pour les
 *     rappels, EVENT_CHANGED, CATEGORY_SOLD_OUT et ENTRY_THANKS ; notif_cancel_on_status (20261109000009_lot9bis_messages.sql:
 *     941-963) n'annule pas ces avis à l'annulation.
 *  T2 (trou) : avis « événement de nouveau en ligne » (EVENT_REACTIVATED_HOLDER) d'une soirée qui commence à 02:00, préparé à
 *     01:30 : reporté à 07:00, puis envoyé à 07:00, cinq heures après le début (et après la fin). Aucune revérification
 *     « événement commencé » pour ce type.
 *  G1 (garde-fou) : merci du lendemain (ENTRY_THANKS) d'un événement annulé : annulé à l'envoi.
 *  G2 (garde-fou) : avis urgent à 02:00 (SCAN_REFUSALS_ALERT, SEND) : part tout de suite, rien n'est reporté.
 *
 * Lignes écrites directement (même méthode que tests/parcours/f4-messages.test.ts) pour placer l'avis dans la nuit : la CI
 * ne choisit pas son heure. Horloges simulées dans le futur, envoyeur limité aux lignes de la suite (ids).
 */
import '../helpers/env';
import { before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { writeLocal } from '../helpers/db';
import { getFakes } from '../fakes';
import { createPartnerEvent, newPartner, type TestPartner } from '../parcours/finance-helpers';
import { newBuyer, type Buyer } from '../parcours/paiement-helpers';
import { advanceEventTo } from '../parcours/cycle-helpers';
import { createReminderEvent, dakarAt, dakarDay, dispatchAt, insertOutboxRow, outboxRows, type OutboxRow } from '../parcours/notif-helpers';
import { NOTIFICATION_CATALOG } from '../../lib/notifications/catalog';

type Any = Record<string, unknown>;
const CAT = NOTIFICATION_CATALOG as unknown as Record<string, { sample: Any }>;

let partner: TestPartner;
let holder: Buyer;

before(async () => {
    partner = await newPartner('cvf4nuit');
    holder = await newBuyer('cvf4-porteur');
});

async function eventData(eventId: string): Promise<Any> {
    return writeLocal(async (c) => (await c.query<{ d: Any }>('SELECT public.notif_event_data($1::uuid) AS d', [eventId])).rows[0].d);
}

const row = async (id: string): Promise<OutboxRow> => (await outboxRows({ ids: [id] }))[0];
const decision = (r: OutboxRow): { outcome?: string; reason?: string } => (r.decision ?? {}) as { outcome?: string; reason?: string };
const smsCount = (): number => getFakes().sms.messagesTo(holder.phoneE164).length;
const lastSms = (): string => {
    const all = getFakes().sms.messagesTo(holder.phoneE164);
    return all.length > 0 ? all[all.length - 1].message : '(aucun SMS)';
};

describe('cvf4 point 2 — la nuit', () => {
    test('T1 : avis « suspendu » reporté la nuit, événement annulé avant 07:00 → ne doit pas partir à 07:00', async () => {
        const ev = await createPartnerEvent(partner.partnerId, 'cvf4-t1', [{ name: 'Standard', price: 5_000, total: 50 }]);
        const day = dakarDay(3);
        const data = await eventData(ev.eventId);
        const sms = await insertOutboxRow({
            type: 'EVENT_SUSPENDED_HOLDER', family: 'OPTIONAL', topic: 'EVENT_UPDATES', channel: 'SMS',
            recipient_user_id: holder.userId, event_id: ev.eventId, template_data: data,
            due_at: dakarAt(day, '02:00').toISOString(), next_attempt_at: dakarAt(day, '02:00').toISOString(),
        });
        const push = await insertOutboxRow({
            type: 'EVENT_SUSPENDED_HOLDER', family: 'OPTIONAL', topic: 'EVENT_UPDATES', channel: 'PUSH',
            group_key: sms.group_key, recipient_user_id: holder.userId, event_id: ev.eventId, template_data: data,
            due_at: dakarAt(day, '02:00').toISOString(), next_attempt_at: dakarAt(day, '02:00').toISOString(),
        });
        const ids = [sms.id, push.id];

        // 02:00 : suspension annoncée, SMS et push reportés à 07:00 (comportement voulu par le lot)
        await dispatchAt(dakarAt(day, '02:00'), { ids });
        const deferred = await row(sms.id);
        assert.equal(deferred.status, 'PENDING', `précondition : reporté (${deferred.status} ${deferred.reason ?? ''})`);
        assert.equal(decision(deferred).outcome, 'DEFER', 'précondition : décision DEFER');

        // 04:00 : l'administration annule l'événement (suspendu puis annulé : chemin réel des RPC de transition)
        await advanceEventTo(ev.eventId, 'SUSPENDU');
        await advanceEventTo(ev.eventId, 'ANNULE', { cancelFrom: 'SUSPENDU' });

        // 07:00 : fin de la plage — l'avis « suspendu, vos billets restent valables » ne doit plus partir
        const before = smsCount();
        await dispatchAt(dakarAt(day, '07:00'), { ids });
        const out = await outboxRows({ ids });
        const sent = smsCount() > before ? lastSms() : '(aucun SMS)';
        for (const r of out) {
            assert.notEqual(r.status, 'SENT',
                `${r.channel} EVENT_SUSPENDED_HOLDER envoyé à 07:00 pour un événement ANNULÉ (${r.status} ${r.reason ?? ''}) ; SMS reçu : « ${sent} »`);
        }
    });

    test('T2 : avis « de nouveau en ligne » d’une soirée qui commence à 02:00, préparé à 01:30 → ne doit pas partir à 07:00', async () => {
        const day = dakarDay(4);
        const ev = await createReminderEvent(partner, 'cvf4-t2', { startDate: day, startTime: '02:00', durationHours: 4 });
        const data = await eventData(ev.eventId);
        const sms = await insertOutboxRow({
            type: 'EVENT_REACTIVATED_HOLDER', family: 'OPTIONAL', topic: 'EVENT_UPDATES', channel: 'SMS',
            recipient_user_id: holder.userId, event_id: ev.eventId, template_data: data,
            due_at: dakarAt(day, '01:30').toISOString(), next_attempt_at: dakarAt(day, '01:30').toISOString(),
        });
        await dispatchAt(dakarAt(day, '01:30'), { ids: [sms.id] });
        const deferred = await row(sms.id);
        assert.equal(decision(deferred).outcome, 'DEFER', `précondition : reporté (${JSON.stringify(deferred.decision)})`);
        assert.equal(Date.parse(deferred.next_attempt_at), dakarAt(day, '07:00').getTime(), 'précondition : reporté à 07:00');

        const before = smsCount();
        await dispatchAt(dakarAt(day, '07:00'), { ids: [sms.id] });
        const r = await row(sms.id);
        const sent = smsCount() > before ? lastSms() : '(aucun SMS)';
        assert.notEqual(r.status, 'SENT',
            `EVENT_REACTIVATED_HOLDER envoyé à 07:00 pour une soirée commencée à 02:00 (début ${ev.startAt.toISOString()}) : « ${sent} »`);
    });

    test('G1 : merci du lendemain d’un événement annulé → annulé à l’envoi', async () => {
        const ev = await createPartnerEvent(partner.partnerId, 'cvf4-g1', [{ name: 'Standard', price: 5_000, total: 50 }]);
        await advanceEventTo(ev.eventId, 'ANNULE');
        const day = dakarDay(2);
        const data = { ...(await eventData(ev.eventId)), organizer: 'Finance cvf4' };
        const ids: string[] = [];
        for (const channel of ['IN_APP', 'SMS'] as const) {
            ids.push((await insertOutboxRow({
                type: 'ENTRY_THANKS', family: 'OPTIONAL', topic: 'AFTER_EVENT', channel,
                recipient_user_id: holder.userId, event_id: ev.eventId, template_data: data,
                due_at: dakarAt(day, '11:00').toISOString(), next_attempt_at: dakarAt(day, '11:00').toISOString(),
            })).id);
        }
        await dispatchAt(dakarAt(day, '11:00'), { ids });
        for (const r of await outboxRows({ ids })) {
            assert.equal(r.status, 'CANCELLED', `${r.channel} : ${r.status} ${r.reason ?? ''}`);
            assert.equal(r.reason, 'NO_LONGER_RELEVANT');
        }
    });

    test('G2 : avis urgent à 02:00 (refus en série à une porte) → part tout de suite', async () => {
        const ev = await createPartnerEvent(partner.partnerId, 'cvf4-g2', [{ name: 'Standard', price: 5_000, total: 50 }]);
        const day = dakarDay(2);
        const r0 = await insertOutboxRow({
            type: 'SCAN_REFUSALS_ALERT', family: 'ESSENTIAL', channel: 'SMS', recipient_user_id: partner.userId, event_id: ev.eventId,
            template_data: { ...CAT.SCAN_REFUSALS_ALERT.sample, ...(await eventData(ev.eventId)) },
            due_at: dakarAt(day, '02:00').toISOString(), next_attempt_at: dakarAt(day, '02:00').toISOString(),
        });
        await dispatchAt(dakarAt(day, '02:00'), { ids: [r0.id] });
        const r = await row(r0.id);
        assert.equal(r.status, 'SENT', `${r.status} ${r.reason ?? ''} ${JSON.stringify(r.decision)}`);
    });
});

/**
 * Finition 4 — messages : chaque étape annoncée (décisions du client du 19/11), en base locale.
 *
 *  Ventes (point 2) : premier billet → FIRST_TICKET_SOLD et une cloche (NEW_ORDER), pas de SMS groupé ; achat suivant dans
 *  les 15 minutes → ajouté à la même cloche (order_count) ; SMS groupé (SALES_UPDATE_SMS) dû au plus tôt 30 minutes après
 *  le SMS du premier billet ; cloche partie → la vente suivante attend 15 minutes après elle ; événement complet → un seul
 *  avis qui nomme la dernière catégorie ; catégorie complète encore en attente → remplacée ; résumé du matin à 9 h
 *  (PARTNER_DAILY_SUMMARY) avec les ventes de la veille, une seule fois.
 *  Remboursement (point 4) : lancé par l'organisatrice → REFUND_REQUESTED sur les 4 canaux, by = ORGANIZER ; aucun avis
 *  groupé « demandé par un client ».
 *  Nuit (point 1) : SMS facultatif préparé à 03:00 → reporté à 07:00 (en attente, aucune tentative, aucun budget), envoyé à
 *  07:00 ; push facultatif reporté ; SMS urgent envoyé tout de suite ; rappel à moins de 30 minutes du début annulé.
 *  Envoyeur (point 4) : la limite par compte déclencheur ne vaut que pour les numéros saisis à la main.
 * Horloges simulées dans le futur, lignes de la suite seulement (filtres par identifiant ou par événement).
 */
import '../helpers/env';
import { before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { writeLocal } from '../helpers/db';
import { getFakes } from '../fakes';
import { buyConfirmed, createPartnerEvent, newPartner, type Purchase, type TestPartner } from './finance-helpers';
import { newBuyer, service, type Buyer } from './paiement-helpers';
import { dakarAt, dakarDay, dispatchAt, insertOutboxRow, outboxRows, type OutboxRow } from './notif-helpers';
import { smsActorLimited } from '../../lib/notifications/dispatcher';

type SaleEvent = Awaited<ReturnType<typeof createPartnerEvent>>;
const MIN = 60_000;

let partner: TestPartner;
let ev: SaleEvent;
let buyer: Buyer;
let first: Purchase;

before(async () => {
    partner = await newPartner('f4msg');
    ev = await createPartnerEvent(partner.partnerId, 'f4-ventes', [{ name: 'Standard', price: 5_000, total: 100 }]);
    buyer = await newBuyer('f4-acheteur');
});

const rows = (type: string, channel?: OutboxRow['channel'], eventId: string = ev.eventId): Promise<OutboxRow[]> =>
    outboxRows({ type, eventId, channel });
const td = (r: OutboxRow, k: string): number => Number(r.template_data[k]);

describe('point 2 — ventes de l’organisatrice', () => {
    test('premier achat : premier billet et une cloche, aucun SMS groupé', async () => {
        first = await buyConfirmed(buyer, ev, [['Standard', 2]]);
        assert.ok((await rows('FIRST_TICKET_SOLD', 'SMS')).length === 1, 'SMS « premier billet vendu » gardé');
        const bells = await rows('NEW_ORDER', 'IN_APP');
        assert.equal(bells.length, 1, 'une cloche');
        assert.deepEqual([td(bells[0], 'ticket_count'), td(bells[0], 'order_count'), td(bells[0], 'total')], [2, 1, 10_000]);
        assert.deepEqual(await rows('SALES_UPDATE_SMS'), [], 'la vente du premier billet n’est pas recomptée par SMS');
    });

    test('achat suivant dans les 15 minutes : même cloche ; SMS groupé dû 30 minutes après le premier billet', async () => {
        await buyConfirmed(buyer, ev, [['Standard', 1]]);
        const bells = await rows('NEW_ORDER', 'IN_APP');
        assert.equal(bells.length, 1, 'toujours une seule cloche');
        assert.deepEqual([td(bells[0], 'ticket_count'), td(bells[0], 'order_count'), td(bells[0], 'total')], [3, 2, 15_000]);
        const push = await rows('NEW_ORDER', 'PUSH');
        assert.ok(push.length === 1 && td(push[0], 'ticket_count') === 3, 'le push suit la cloche');
        const sms = await rows('SALES_UPDATE_SMS', 'SMS');
        const firstSms = (await rows('FIRST_TICKET_SOLD', 'SMS'))[0];
        assert.equal(sms.length, 1, 'un SMS groupé en attente');
        assert.equal(td(sms[0], 'ticket_count'), 1);
        assert.ok(Date.parse(sms[0].due_at) >= Date.parse(firstSms.due_at) + 30 * MIN - 1_000, `SMS groupé dû ${sms[0].due_at}, premier billet ${firstSms.due_at}`);
    });

    test('cloche partie : la vente suivante attend 15 minutes après elle ; le SMS groupé s’allonge', async () => {
        const before1 = await rows('NEW_ORDER');
        await dispatchAt(new Date(), { ids: before1.map((r) => r.id) });
        const sent = (await rows('NEW_ORDER', 'IN_APP'))[0];
        assert.equal(sent.status, 'SENT', `cloche envoyée (${sent.status} ${sent.reason ?? ''})`);
        await buyConfirmed(buyer, ev, [['Standard', 1]]);
        const bells = await rows('NEW_ORDER', 'IN_APP');
        assert.equal(bells.length, 2, 'une nouvelle cloche');
        const next = bells.find((b) => b.id !== sent.id)!;
        assert.equal(next.status, 'PENDING');
        assert.ok(Math.abs(Date.parse(next.due_at) - (Date.parse(sent.due_at) + 15 * MIN)) < 2_000, `due 15 min après la précédente : ${next.due_at} / ${sent.due_at}`);
        const sms = await rows('SALES_UPDATE_SMS', 'SMS');
        assert.equal(sms.length, 1);
        assert.equal(td(sms[0], 'ticket_count'), 2, 'le SMS groupé compte les deux ventes');
    });

    test('événement complet : un seul avis, qui nomme la dernière catégorie', async () => {
        const ev2 = await createPartnerEvent(partner.partnerId, 'f4-complet', [{ name: 'Unique', price: 5_000, total: 2 }]);
        await buyConfirmed(buyer, ev2, [['Unique', 2]]);
        const full = await rows('EVENT_SOLD_OUT', 'IN_APP', ev2.eventId);
        assert.equal(full.length, 1, 'événement complet');
        assert.equal(full[0].template_data.category, 'Unique');
        assert.deepEqual(await rows('CATEGORY_SOLD_OUT', undefined, ev2.eventId), [], 'aucun avis « catégorie complète » en plus');
    });

    test('deux catégories : la catégorie complète encore en attente est remplacée par « événement complet »', async () => {
        const ev3 = await createPartnerEvent(partner.partnerId, 'f4-complet2', [{ name: 'A', price: 5_000, total: 1 }, { name: 'B', price: 5_000, total: 1 }]);
        await buyConfirmed(buyer, ev3, [['A', 1]]);
        const cat = await rows('CATEGORY_SOLD_OUT', undefined, ev3.eventId);
        assert.ok(cat.length > 0, 'catégorie A complète');
        await buyConfirmed(buyer, ev3, [['B', 1]]);
        assert.equal((await rows('EVENT_SOLD_OUT', 'IN_APP', ev3.eventId)).length, 1);
        await dispatchAt(new Date(), { ids: cat.map((r) => r.id) });
        const after = await outboxRows({ ids: cat.map((r) => r.id) });
        for (const r of after.filter((x) => x.status !== 'SKIPPED')) {
            assert.equal(r.status, 'CANCELLED', `${r.channel} : ${r.status} ${r.reason ?? ''}`);
            assert.equal(r.reason, 'SUPERSEDED');
        }
    });

    test('résumé du matin : le lendemain à 9 h, ventes de la veille, une seule fois', async () => {
        const tomorrow = dakarDay(1);
        for (const at of ['09:05', '09:06']) {
            const { data, error } = await service.rpc('notification_daily_checks', { p: { now: dakarAt(tomorrow, at).toISOString() } });
            assert.equal(error, null, error?.message);
            assert.equal((data as { ok?: boolean }).ok, true);
        }
        const summary = (await outboxRows({ type: 'PARTNER_DAILY_SUMMARY', userId: partner.userId, channel: 'IN_APP' }));
        assert.equal(summary.length, 1, `un seul résumé : ${summary.length}`);
        const d = summary[0].template_data;
        assert.equal(d.day, dakarDay(0));
        assert.deepEqual([Number(d.sold_count), Number(d.sold_amount), Number(d.event_count)], [8, 40_000, 3]);
        assert.equal(summary[0].topic, 'SALES_SUMMARY');
        const channels = (await outboxRows({ type: 'PARTNER_DAILY_SUMMARY', userId: partner.userId })).map((r) => r.channel).sort();
        assert.deepEqual(channels, ['EMAIL', 'IN_APP', 'PUSH', 'SMS']);
    });

    test('remboursement lancé par l’organisatrice : le client prévenu sur les 4 canaux ; aucun avis « demandé par un client »', async () => {
        const ticketId = String(first.tickets[0].id);
        const { data, error } = await service.rpc('ticket_refund_request', { p_ticket_id: ticketId, p_actor: partner.userId, p_reason: 'Finition 4 : remboursement par l’organisatrice' });
        assert.equal(error, null, error?.message);
        assert.equal((data as { ok?: boolean }).ok, true, JSON.stringify(data));
        const req = await outboxRows({ type: 'REFUND_REQUESTED', userId: buyer.userId, eventId: ev.eventId });
        assert.deepEqual(req.map((r) => r.channel).sort(), ['EMAIL', 'IN_APP', 'PUSH', 'SMS'], 'SMS et push en plus');
        assert.ok(req.every((r) => r.template_data.by === 'ORGANIZER'), 'auteur : l’organisatrice');
        assert.deepEqual(await rows('PARTNER_REFUND_REQUESTS'), [], 'pas d’avis groupé quand ce n’est pas le client');
    });
});

describe('point 1 — la nuit (01:00 → 07:00, heure de Dakar)', () => {
    const day = dakarDay(5);
    const optionalUsed = async (): Promise<number> => writeLocal(async (c) =>
        Number((await c.query<{ n: number }>('SELECT public.notif_sms_optional_used($1::date) AS n', [day])).rows[0].n));
    const smsCount = (): number => getFakes().sms.messagesTo(partner.phoneE164).length;

    test('SMS facultatif préparé à 03:00 : reporté à 07:00, sans tentative ni budget ; envoyé à 07:00', async () => {
        const row = await insertOutboxRow({
            type: 'SALES_UPDATE_SMS', family: 'OPTIONAL', topic: 'PRO_ACTIVITY', channel: 'SMS', recipient_user_id: partner.userId, event_id: ev.eventId,
            template_data: { ticket_count: 3, total: 15_000, since: dakarAt(day, '00:40').toISOString() },
            due_at: dakarAt(day, '03:00').toISOString(), next_attempt_at: dakarAt(day, '03:00').toISOString(),
        });
        const used0 = await optionalUsed();
        const sms0 = smsCount();
        await dispatchAt(dakarAt(day, '03:00'), { ids: [row.id] });
        const deferred = (await outboxRows({ ids: [row.id] }))[0];
        assert.equal(deferred.status, 'PENDING', 'jamais « non envoyé »');
        assert.equal((deferred.decision as { outcome?: string }).outcome, 'DEFER');
        assert.equal((deferred.decision as { reason?: string }).reason, 'NIGHT');
        assert.equal(Date.parse(String(deferred.next_attempt_at)), dakarAt(day, '07:00').getTime(), 'reporté à 07:00');
        assert.equal(Number(deferred.attempts), 0, 'aucune tentative');
        assert.equal(await optionalUsed(), used0, 'aucun budget consommé');
        assert.equal(smsCount(), sms0, 'aucun SMS la nuit');
        await dispatchAt(dakarAt(day, '06:59'), { ids: [row.id] });
        assert.equal((await outboxRows({ ids: [row.id] }))[0].status, 'PENDING');
        await dispatchAt(dakarAt(day, '07:00'), { ids: [row.id] });
        const sent = (await outboxRows({ ids: [row.id] }))[0];
        assert.equal(sent.status, 'SENT', `${sent.status} ${sent.reason ?? ''}`);
        assert.equal(smsCount(), sms0 + 1);
    });

    test('push facultatif préparé à 03:00 : reporté aussi', async () => {
        const row = await insertOutboxRow({
            type: 'NEW_ORDER', family: 'OPTIONAL', topic: 'PRO_ACTIVITY', channel: 'PUSH', recipient_user_id: partner.userId, event_id: ev.eventId,
            template_data: { payment_id: ev.eventId, ticket_count: 1, total: 5_000 },
            due_at: dakarAt(day, '03:10').toISOString(), next_attempt_at: dakarAt(day, '03:10').toISOString(),
        });
        await dispatchAt(dakarAt(day, '03:10'), { ids: [row.id] });
        const r = (await outboxRows({ ids: [row.id] }))[0];
        assert.equal(r.status, 'PENDING');
        assert.equal((r.decision as { outcome?: string }).outcome, 'DEFER');
    });

    test('SMS urgent préparé à 03:00 : part tout de suite', async () => {
        const row = await insertOutboxRow({
            type: 'PASSWORD_CHANGED', family: 'ESSENTIAL', channel: 'SMS', recipient_user_id: partner.userId,
            due_at: dakarAt(day, '03:20').toISOString(), next_attempt_at: dakarAt(day, '03:20').toISOString(),
        });
        await dispatchAt(dakarAt(day, '03:20'), { ids: [row.id] });
        const r = (await outboxRows({ ids: [row.id] }))[0];
        assert.equal(r.status, 'SENT', `${r.status} ${r.reason ?? ''}`);
    });

    test('rappel à moins de 30 minutes du début : annulé ; à 3 h du début : pas pour ce motif', async () => {
        const startIso = await writeLocal(async (c) =>
            new Date((await c.query<{ s: Date }>('SELECT public.event_start_at($1::uuid) AS s', [ev.eventId])).rows[0].s).toISOString());
        const start = Date.parse(startIso);
        const reminder = async (minutesBefore: number): Promise<OutboxRow> => insertOutboxRow({
            type: 'REMINDER_H3', family: 'OPTIONAL', topic: 'REMINDERS', channel: 'IN_APP', recipient_user_id: buyer.userId, event_id: ev.eventId,
            template_data: { start_at: startIso, sms_policy: 'ALWAYS' },
            due_at: new Date(start - minutesBefore * MIN).toISOString(), next_attempt_at: new Date(start - minutesBefore * MIN).toISOString(),
        });
        const close = await reminder(25);
        await dispatchAt(new Date(start - 25 * MIN), { ids: [close.id] });
        const c1 = (await outboxRows({ ids: [close.id] }))[0];
        assert.equal(c1.status, 'CANCELLED');
        assert.equal(c1.reason, 'TOO_CLOSE_TO_START');
        const far = await reminder(180);
        await dispatchAt(new Date(start - 180 * MIN), { ids: [far.id] });
        assert.notEqual((await outboxRows({ ids: [far.id] }))[0].reason, 'TOO_CLOSE_TO_START');
    });
});

describe('registre = catalogue : politique de nuit et canaux', () => {
    test('notification_types.night_policy et channels égaux au catalogue, type par type', async () => {
        const { NOTIFICATION_CATALOG } = await import('../../lib/notifications/catalog');
        const cat = NOTIFICATION_CATALOG as unknown as Record<string, { nightPolicy: string; channels: readonly string[]; syncOnly: boolean }>;
        const reg = await writeLocal(async (c) => (await c.query<{ type: string; night_policy: string; channels: string[] }>(
            'SELECT type, night_policy, channels FROM public.notification_types ORDER BY type')).rows);
        const diff: string[] = [];
        for (const r of reg) {
            const t = cat[r.type];
            if (!t) { diff.push(`${r.type} absent du catalogue`); continue; }
            if (t.nightPolicy !== r.night_policy) diff.push(`${r.type} : nuit ${r.night_policy} en base, ${t.nightPolicy} au catalogue`);
            if ([...r.channels].sort().join(',') !== [...t.channels].sort().join(',')) diff.push(`${r.type} : canaux ${r.channels} en base, ${t.channels} au catalogue`);
        }
        assert.deepEqual(diff, []);
        assert.equal(reg.length, Object.keys(cat).length, 'même nombre de types');
    });
});

describe('point 4 — limite de 30 SMS par compte déclencheur', () => {
    test('levée pour les destinataires connus, gardée pour les numéros saisis à la main', () => {
        const actor = 'f5a1c3e7-0000-4000-8000-000000000001';
        for (const type of ['TICKET_CANCELLED', 'TICKET_REFUNDED_HOLDER', 'TRANSFER_REVOKED', 'REFUND_REQUESTED', 'CONTROLLER_ASSIGNED']) {
            assert.equal(smsActorLimited({ type, actor_id: actor }), false, type);
        }
        for (const type of ['CONTROLLER_INVITATION', 'INVITATION_RECEIVED', 'TRANSFER_OFFERED']) {
            assert.equal(smsActorLimited({ type, actor_id: actor }), true, type);
        }
        assert.equal(smsActorLimited({ type: 'CONTROLLER_INVITATION', actor_id: null }), false, 'sans déclencheur : aucune limite par compte');
    });
});

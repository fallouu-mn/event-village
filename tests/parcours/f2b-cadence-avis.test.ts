/**
 * Finition 2b (D, E-28) — cadence des avis de lieu ET de date : au plus un SMS par détenteur et par événement par heure
 * glissante, changements regroupés ; à moins d'une heure du début, l'avis part tout de suite, au plus 2 SMS par
 * détenteur dans cette dernière heure. La réponse de l'enregistrement donne l'heure réelle de l'avis par SMS (pour la
 * fenêtre « Prévenir » et le bilan).
 *  a. Date : un avis parti, la fin changée de nouveau 11 minutes après : retenu (réponse : retenu, heure = départ + 1 h,
 *     rien en attente) ; rien ne part avant l'heure ; à l'heure, UN avis de date part.
 *  b. Lieu et date dans la même heure : regroupés dans un seul SMS à l'heure dite.
 *  c. Dernière heure : deux changements, deux SMS tout de suite ; le troisième : aucun SMS (écarté, LAST_HOUR_CAP), la
 *     notification dans l'application part.
 *  d. Première modification : avis dans la fenêtre de 10 minutes (heure rendue), un SMS pour le détenteur.
 * Rouge avant le correctif : le second avis de date part 10 minutes après, sans retenue ; trois SMS dans la dernière
 * heure ; réponse sans heure de l'avis par SMS. Sortie brute `[F2B-D5]`.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { newBuyer, service, type Buyer, type SaleEvent } from './paiement-helpers';
import { newPartner, type TestPartner } from './finance-helpers';
import { createTimedEvent } from './acces-helpers';
import { dispatchAt } from './notif-helpers';
import { assertFinition1Invariants } from '../helpers/finition1-invariants';
import { FREE, freeTicket, show, type Reply, type Row } from '../audit/cvf1-helpers';
import { putEvent } from '../audit/cvf2a-helpers';

const DAKAR = { latitude: 14.6928, longitude: -17.4467 };
let P: TestPartner;

before(async () => {
    P = await newPartner('f2b-cadence');
});

after(async () => {
    await assertFinition1Invariants('f2b-cadence-avis');
});

interface Outbox { id: string; channel: string; status: string; reason: string | null; template_data: Row; sent_at: string | null; due_at: string }

async function rowsOf(eventId: string, userId: string): Promise<Outbox[]> {
    const { data, error } = await service.from('notification_outbox')
        .select('id, channel, status, reason, template_data, sent_at, due_at')
        .eq('event_id', eventId).eq('type', 'EVENT_CHANGED').eq('recipient_user_id', userId).order('created_at').order('id');
    assert.equal(error, null, error?.message);
    return (data ?? []) as Outbox[];
}

function brief(rows: Outbox[]): string {
    return rows.map((r) => `${r.channel}:${r.status}${r.reason ? `(${r.reason})` : ''}:${JSON.stringify(r.template_data.changed_fields ?? [])}`).join(' | ');
}

async function published(label: string, startsInHours: number): Promise<{ ev: SaleEvent; holder: Buyer }> {
    const ev = await createTimedEvent(P.partnerId, `f2b-${label}`, [{ name: FREE, price: 0, total: 20 }], { startsInHours, durationHours: 4, status: 'PUBLIE' });
    const { error } = await service.from('events').update(DAKAR).eq('id', ev.eventId);
    assert.equal(error, null, `repère (montage) : ${error?.message}`);
    const holder = await newBuyer(`f2b-${label}-detenteur`);
    await freeTicket(ev, holder);
    return { ev, holder };
}

/** Fin de l'événement décalée de `minutes` (date et heure de Dakar, UTC), par la route de la partenaire. */
async function shiftEnd(eventId: string, minutes: number): Promise<Reply> {
    const { data, error } = await service.from('events').select('end_date, end_time').eq('id', eventId).single();
    assert.equal(error, null, error?.message);
    const end = new Date(`${data.end_date}T${String(data.end_time).slice(0, 8)}Z`).getTime() + minutes * 60_000;
    const iso = new Date(end).toISOString();
    const r = await putEvent(P.accessToken, eventId, { end_date: iso.slice(0, 10), end_time: iso.slice(11, 16) });
    assert.equal(r.status, 200, `fin décalée de ${minutes} min : ${show(r)}`);
    return r;
}

async function move(eventId: string, patch: Row): Promise<Reply> {
    const r = await putEvent(P.accessToken, eventId, patch);
    assert.equal(r.status, 200, `modification (${JSON.stringify(patch)}) : ${show(r)}`);
    return r;
}

const minutes = (n: number) => new Date(Date.now() + n * 60_000);
const smsOf = (rows: Outbox[]) => rows.filter((r) => r.channel === 'SMS');

describe('d. première modification : fenêtre de 10 minutes, heure rendue', () => {
    test('fin décalée : SMS dans 10 minutes, un détenteur', async () => {
        const { ev } = await published('cadence-fenetre', 48);
        const before = Date.now();
        const r = await shiftEnd(ev.eventId, 15);
        console.log(`[F2B-D5] première modification → ${show(r).slice(0, 400)}`);
        assert.equal(r.body.sms_notice_held, false, show(r));
        assert.equal(r.body.sms_notice_immediate, false, show(r));
        assert.equal(r.body.sms_recipients, 1, show(r));
        const at = Date.parse(String(r.body.sms_notice_at));
        assert.ok(at >= before + 9 * 60_000 && at <= Date.now() + 11 * 60_000, `heure de l'avis = maintenant + 10 minutes : ${r.body.sms_notice_at}`);
    });
});

describe('a. date : au plus un SMS par heure glissante', () => {
    test('avis parti, fin changée 11 minutes après : retenu, un avis à l’heure', async () => {
        const { ev, holder } = await published('cadence-date', 48);
        await shiftEnd(ev.eventId, 15);
        await dispatchAt(minutes(11), { eventIds: [ev.eventId] });
        const sent1 = smsOf(await rowsOf(ev.eventId, holder.userId)).filter((r) => r.status === 'SENT');
        assert.equal(sent1.length, 1, 'précondition : premier avis de date parti');
        const sentAt1 = Date.parse(String(sent1[0].sent_at));

        const again = await shiftEnd(ev.eventId, 15);
        console.log(`[F2B-D5] seconde modification de la fin → ${show(again).slice(0, 400)}`);
        assert.equal(again.body.sms_notice_held, true, `avis de date retenu par la cadence : ${show(again)}`);
        assert.ok(Math.abs(Date.parse(String(again.body.sms_notice_at)) - (sentAt1 + 3_600_000)) < 2_000,
            `heure de l'avis retenu = départ du premier + 1 h : ${again.body.sms_notice_at} / ${sent1[0].sent_at}`);
        const during = await rowsOf(ev.eventId, holder.userId);
        assert.deepEqual(smsOf(during).filter((r) => r.status === 'PENDING'), [], `rien en attente pendant la retenue : ${brief(during)}`);

        await dispatchAt(new Date(sentAt1 + 30 * 60_000), { eventIds: [ev.eventId] });
        assert.equal(smsOf(await rowsOf(ev.eventId, holder.userId)).filter((r) => r.status !== 'CANCELLED').length, 1, 'SMS parti avant l’heure');

        await dispatchAt(new Date(sentAt1 + 61 * 60_000), { eventIds: [ev.eventId] });
        const rows = await rowsOf(ev.eventId, holder.userId);
        console.log(`[F2B-D5] cadence de date : ${brief(rows)}`);
        const sms = smsOf(rows).filter((r) => r.status !== 'CANCELLED');
        assert.equal(sms.length, 2, brief(rows));
        assert.equal(sms[1].status, 'SENT', brief(rows));
        assert.ok(/end_(date|time)/.test(JSON.stringify(sms[1].template_data.changed_fields)), brief(rows));
        assert.ok(Date.parse(String(sms[1].sent_at)) - sentAt1 >= 3_600_000, 'deux avis à moins d’une heure');
    });
});

describe('b. lieu et date dans la même heure : un seul SMS', () => {
    test('lieu puis fin changés pendant la retenue : regroupés', async () => {
        const { ev, holder } = await published('cadence-mixte', 48);
        await shiftEnd(ev.eventId, 15);
        await dispatchAt(minutes(11), { eventIds: [ev.eventId] });
        const sentAt1 = Date.parse(String(smsOf(await rowsOf(ev.eventId, holder.userId)).find((r) => r.status === 'SENT')?.sent_at));
        assert.ok(Number.isFinite(sentAt1), 'précondition : premier avis parti');
        const place = await move(ev.eventId, { location: 'Salle des fêtes de Grand Dakar' });
        const date = await shiftEnd(ev.eventId, 15);
        assert.equal(place.body.sms_notice_held, true, show(place));
        assert.equal(date.body.sms_notice_held, true, show(date));
        await dispatchAt(new Date(sentAt1 + 61 * 60_000), { eventIds: [ev.eventId] });
        const rows = await rowsOf(ev.eventId, holder.userId);
        console.log(`[F2B-D5] lieu et date regroupés : ${brief(rows)}`);
        const sms = smsOf(rows).filter((r) => r.status === 'SENT');
        assert.equal(sms.length, 2, brief(rows));
        const fields = JSON.stringify(sms[1].template_data.changed_fields);
        assert.ok(fields.includes('location') && /end_(date|time)/.test(fields), `un seul SMS pour le lieu et la date : ${fields}`);
    });
});

describe('c. dernière heure : tout de suite, deux SMS au plus', () => {
    test('trois changements à moins d’une heure du début : deux SMS, le troisième écarté, l’application prévenue', async () => {
        const { ev, holder } = await published('cadence-derniere-heure', 40 / 60);
        for (let i = 1; i <= 3; i++) {
            const r = await shiftEnd(ev.eventId, 10);
            console.log(`[F2B-D5] dernière heure, changement ${i} → ${show(r).slice(0, 300)}`);
            if (i < 3) {
                assert.equal(r.body.sms_notice_immediate, true, show(r));
                assert.equal(r.body.sms_recipients, 1, show(r));
            } else {
                assert.equal(r.body.sms_recipients, 0, `plafond de la dernière heure : ${show(r)}`);
            }
            await dispatchAt(new Date(), { eventIds: [ev.eventId] });
        }
        const rows = await rowsOf(ev.eventId, holder.userId);
        console.log(`[F2B-D5] dernière heure : ${brief(rows)}`);
        assert.equal(smsOf(rows).filter((r) => r.status === 'SENT').length, 2, brief(rows));
        assert.equal(smsOf(rows).filter((r) => r.status === 'SKIPPED' && r.reason === 'LAST_HOUR_CAP').length, 1, brief(rows));
        assert.equal(rows.filter((r) => r.channel === 'IN_APP').length, 3, `l’application prévenue à chaque changement : ${brief(rows)}`);
    });
});

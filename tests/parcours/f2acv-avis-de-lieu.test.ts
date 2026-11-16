/**
 * Correctifs de la contre-vérification de la finition 2a, T3 et T4 — changement de lieu.
 *  a. Position annoncée posée à la validation (event_place_notices) ; l'alerte « lieu » de l'administration suit la même
 *     règle : des petits pas de 150 m qui éloignent le repère de plus de 200 m de la position annoncée l'alertent.
 *  b. Repère revenu à moins de 200 m de la position annoncée pendant la fenêtre : l'avis est annulé sur tous les canaux
 *     (SMS, application, push, email), aucune notification ne part.
 *  c. Cadence : un SMS « change de lieu » parti, le repère est ramené à sa place 11 minutes plus tard : l'avis est retenu
 *     (réponse : retenu, heure du départ), rien n'est en attente, rien ne part avant l'heure ; à l'heure, UN avis part
 *     (SMS, application, push), une heure au moins après le premier, et la position annoncée devient le repère actuel.
 *  d. Même cadence pour un changement de lieu par le nom du lieu (texte).
 *  e. Le bandeau du formulaire le dit avant d'enregistrer ; le résumé d'enregistrement donne l'heure de l'avis.
 * Rouge avant le correctif : table event_place_notices absente, alerte contournée par les petits pas, avis du retour
 * envoyé, deux SMS en moins d'une heure, notification dans l'application et push à chaque déplacement. Sortie brute
 * `[F2ACV-T34]`.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { newBuyer, service, type Buyer, type SaleEvent } from './paiement-helpers';
import { newPartner, type TestPartner } from './finance-helpers';
import { createTimedEvent } from './acces-helpers';
import { advanceEventTo, createDraftEvent } from './cycle-helpers';
import { dispatchAt } from './notif-helpers';
import { assertFinition1Invariants } from '../helpers/finition1-invariants';
import { FREE, freeTicket, show, type Reply, type Row } from '../audit/cvf1-helpers';
import { putEvent } from '../audit/cvf2a-helpers';

const DAKAR = { latitude: 14.6928, longitude: -17.4467 };
const NORTH_150M = 0.00135;
const NORTH_300M = 0.0027;

let P: TestPartner;

before(async () => {
    P = await newPartner('f2acv-lieu');
});

after(async () => {
    await assertFinition1Invariants('f2acv-avis-de-lieu');
});

interface Outbox { id: string; channel: string; status: string; reason: string | null; recipient_user_id: string | null; template_data: Row; sent_at: string | null; due_at: string }

async function rowsOf(eventId: string, userId: string): Promise<Outbox[]> {
    const { data, error } = await service.from('notification_outbox')
        .select('id, channel, status, reason, recipient_user_id, template_data, sent_at, due_at')
        .eq('event_id', eventId).eq('type', 'EVENT_CHANGED').eq('recipient_user_id', userId).order('created_at').order('id');
    assert.equal(error, null, error?.message);
    return (data ?? []) as Outbox[];
}

function brief(rows: Outbox[]): string {
    return rows.map((r) => `${r.channel}:${r.status}${r.reason ? `(${r.reason})` : ''}:${JSON.stringify(r.template_data.changed_fields ?? [])}`).join(' | ');
}

async function announced(eventId: string): Promise<Row | null> {
    const { data, error } = await service.from('event_place_notices').select('*').eq('event_id', eventId).maybeSingle();
    assert.equal(error, null, `event_place_notices : ${error?.message}`);
    return (data ?? null) as Row | null;
}

async function publishedWithHolder(label: string): Promise<{ ev: SaleEvent; holder: Buyer }> {
    const ev = await createTimedEvent(P.partnerId, `f2acv-${label}`, [{ name: FREE, price: 0, total: 20 }], { startsInHours: 48, status: 'PUBLIE' });
    const { error } = await service.from('events').update(DAKAR).eq('id', ev.eventId);
    assert.equal(error, null, `repère (montage) : ${error?.message}`);
    const holder = await newBuyer(`f2acv-${label}-detenteur`);
    await freeTicket(ev, holder);
    return { ev, holder };
}

async function move(eventId: string, patch: Row): Promise<Reply> {
    const r = await putEvent(P.accessToken, eventId, patch);
    assert.equal(r.status, 200, `modification (${JSON.stringify(patch)}) : ${show(r)}`);
    return r;
}

const minutes = (n: number) => new Date(Date.now() + n * 60_000);

/**
 * Position annoncée égale au repère, à 10⁻⁶ degré près (une dizaine de centimètres) : le repère passe par les données du
 * message (nombre décimal, 15 chiffres significatifs), 14.695500000000001 y devient 14.6955.
 */
function near(a: Row | null, latitude: number, longitude: number): boolean {
    return Math.abs(Number(a?.announced_latitude) - latitude) < 1e-6 && Math.abs(Number(a?.announced_longitude) - longitude) < 1e-6;
}

describe('a. position annoncée et alerte de l’administration', () => {
    test('posée à la validation : le repère validé', async () => {
        const d = await createDraftEvent(P, 'f2acv-lieu-validation', [{ name: 'Standard', price: 0, total: 10 }], { startsInHours: 72, position: DAKAR });
        assert.equal(await announced(d.eventId).then((a) => a?.announced_latitude ?? null), null, 'précondition : rien d’annoncé pour un brouillon');
        await advanceEventTo(d.eventId, 'VALIDE', { partnerUserId: P.userId });
        const a = await announced(d.eventId);
        console.log(`[F2ACV-T34] validation → position annoncée ${JSON.stringify(a)}`);
        assert.ok(near(a, DAKAR.latitude, DAKAR.longitude), JSON.stringify(a));
    });

    test('petits pas de 150 m (600 m en tout) : alerte « lieu » à l’administration dès 200 m de la position annoncée', async () => {
        const ev = await createTimedEvent(P.partnerId, 'f2acv-lieu-alerte', [{ name: FREE, price: 0, total: 10 }], { startsInHours: 48, status: 'PUBLIE' });
        await service.from('events').update(DAKAR).eq('id', ev.eventId);
        const alerts = async () => {
            const { data, error } = await service.from('notification_outbox').select('template_data').eq('event_id', ev.eventId).eq('type', 'ADMIN_EVENT_CHANGED');
            assert.equal(error, null, error?.message);
            return (data ?? []).filter((r) => JSON.stringify((r.template_data as Row).changes ?? []).includes('PLACE')).length;
        };
        const counts: number[] = [];
        for (let step = 1; step <= 4; step++) {
            await move(ev.eventId, { latitude: DAKAR.latitude + step * NORTH_150M, longitude: DAKAR.longitude });
            counts.push(await alerts());
        }
        console.log(`[F2ACV-T34] alertes « lieu » après chaque pas de 150 m : ${JSON.stringify(counts)}`);
        assert.equal(counts[0], 0, 'alerte pour un premier pas de 150 m (moins de 200 m de la position annoncée)');
        assert.ok(counts[3] >= 1, `aucune alerte « lieu » pour un repère déplacé de 600 m par petits pas : ${JSON.stringify(counts)}`);
    });
});

describe('b. repère revenu pendant la fenêtre : avis annulé sur tous les canaux', () => {
    test('aller de 300 m puis retour : SMS, application, push, email annulés ; rien ne part', async () => {
        const { ev, holder } = await publishedWithHolder('lieu-retour');
        const out = await move(ev.eventId, { latitude: DAKAR.latitude + NORTH_300M, longitude: DAKAR.longitude });
        console.log(`[F2ACV-T34] aller (300 m) → ${show(out).slice(0, 200)}`);
        assert.ok(typeof out.body.place_notice_at === 'string', `heure de l'avis de lieu rendue : ${show(out)}`);
        const pending = await rowsOf(ev.eventId, holder.userId);
        console.log(`[F2ACV-T34] après l'aller : ${brief(pending)}`);
        // SMS et application en attente (fenêtre de 10 minutes) ; push et email : en attente, ou écartés dès l'écriture
        // (pas d'abonnement, adresse non vérifiée), jamais partis
        for (const ch of ['SMS', 'IN_APP']) {
            assert.deepEqual(pending.filter((r) => r.channel === ch).map((r) => r.status), ['PENDING'], `${ch} de l'avis de lieu en attente : ${brief(pending)}`);
        }
        assert.ok(pending.some((r) => r.channel === 'PUSH'), `push de l'avis de lieu regroupé : ${brief(pending)}`);
        assert.ok(pending.every((r) => r.status === 'PENDING' || r.status === 'SKIPPED'), `rien n'est parti tout de suite : ${brief(pending)}`);
        await move(ev.eventId, { latitude: DAKAR.latitude, longitude: DAKAR.longitude });
        await dispatchAt(minutes(11), { eventIds: [ev.eventId] });
        const rows = await rowsOf(ev.eventId, holder.userId);
        console.log(`[F2ACV-T34] après le retour et l'envoyeur : ${brief(rows)}`);
        assert.deepEqual(rows.filter((r) => r.status !== 'CANCELLED' && r.status !== 'SKIPPED').map((r) => `${r.channel}:${r.status}`), [],
            `avis parti (ou encore en attente) malgré le retour : ${brief(rows)}`);
        assert.ok(rows.filter((r) => r.status === 'CANCELLED').every((r) => r.reason === 'NO_LONGER_RELEVANT'), brief(rows));
        assert.ok(rows.some((r) => r.channel === 'SMS' && r.status === 'CANCELLED'), `SMS de l'avis annulé : ${brief(rows)}`);
    });
});

describe('c. cadence : au plus un avis de lieu par heure glissante, regroupé', () => {
    test('aller, SMS parti, retour 11 minutes après : retenu ; un avis à l’heure, une heure après le premier', async () => {
        const { ev, holder } = await publishedWithHolder('lieu-cadence');
        const first = await move(ev.eventId, { latitude: DAKAR.latitude + NORTH_300M, longitude: DAKAR.longitude });
        assert.equal(first.body.place_notice_held, false, show(first));
        await dispatchAt(minutes(11), { eventIds: [ev.eventId] });
        const sent1 = (await rowsOf(ev.eventId, holder.userId)).filter((r) => r.channel === 'SMS' && r.status === 'SENT');
        assert.equal(sent1.length, 1, 'précondition : premier SMS parti');
        const a1 = await announced(ev.eventId);
        console.log(`[F2ACV-T34] après le premier avis : ${JSON.stringify(a1)}`);
        assert.ok(near(a1, DAKAR.latitude + NORTH_300M, DAKAR.longitude), `position annoncée = repère du premier avis : ${JSON.stringify(a1)}`);

        const back = await move(ev.eventId, { latitude: DAKAR.latitude, longitude: DAKAR.longitude });
        console.log(`[F2ACV-T34] retour (300 m de la position annoncée) → ${show(back).slice(0, 260)}`);
        assert.equal(back.body.place_notice_held, true, `avis de lieu retenu par la cadence : ${show(back)}`);
        const heldUntil = Date.parse(String(back.body.place_notice_at));
        const sentAt1 = Date.parse(String(sent1[0].sent_at));
        assert.ok(Math.abs(heldUntil - (sentAt1 + 3_600_000)) < 2_000, `heure de l'avis retenu = départ du premier + 1 h (${back.body.place_notice_at}, ${sent1[0].sent_at})`);
        const afterBack = await rowsOf(ev.eventId, holder.userId);
        assert.deepEqual(afterBack.filter((r) => r.status === 'PENDING').map((r) => r.channel), [], `rien en attente pendant la retenue : ${brief(afterBack)}`);

        await dispatchAt(new Date(sentAt1 + 30 * 60_000), { eventIds: [ev.eventId] });
        assert.equal((await rowsOf(ev.eventId, holder.userId)).filter((r) => r.channel === 'SMS' && r.status !== 'CANCELLED').length, 1, 'SMS parti avant l’heure');

        await dispatchAt(new Date(sentAt1 + 61 * 60_000), { eventIds: [ev.eventId] });
        const rows = await rowsOf(ev.eventId, holder.userId);
        console.log(`[F2ACV-T34] cadence, boîte d'envoi du détenteur : ${brief(rows)}`);
        const sms = rows.filter((r) => r.channel === 'SMS' && r.status !== 'CANCELLED');
        assert.equal(sms.length, 2, `deux avis de lieu en tout : ${brief(rows)}`);
        assert.equal(sms[1].status, 'SENT', brief(rows));
        assert.ok(JSON.stringify(sms[1].template_data.changed_fields).includes('position'), brief(rows));
        assert.ok(Date.parse(String(sms[1].sent_at)) - Date.parse(String(sms[0].sent_at)) >= 3_600_000, 'deux SMS « change de lieu » à moins d’une heure');
        assert.equal(rows.filter((r) => r.channel === 'PUSH').length, 2, `une notification push par avis, pas par déplacement : ${brief(rows)}`);
        assert.equal(rows.filter((r) => r.channel === 'IN_APP').length, 2, `une notification dans l'application par avis : ${brief(rows)}`);
        const a2 = await announced(ev.eventId);
        assert.ok(near(a2, DAKAR.latitude, DAKAR.longitude), `position annoncée = repère du second avis : ${JSON.stringify(a2)}`);
        assert.equal(a2?.held_until ?? null, null, 'retenue vidée');
    });
});

describe('d. même cadence pour le nom du lieu', () => {
    test('nom du lieu changé, SMS parti, changé encore 11 minutes après : retenu', async () => {
        const { ev, holder } = await publishedWithHolder('lieu-nom');
        await move(ev.eventId, { location: 'Salle des fêtes de Grand Dakar' });
        await dispatchAt(minutes(11), { eventIds: [ev.eventId] });
        const again = await move(ev.eventId, { location: 'Centre culturel de Pikine' });
        console.log(`[F2ACV-T34] second changement du nom du lieu → ${show(again).slice(0, 260)}`);
        assert.equal(again.body.place_notice_held, true, show(again));
        assert.equal(again.body.notified_holders, 0, `personne n'est prévenu tout de suite : ${show(again)}`);
        const rows = await rowsOf(ev.eventId, holder.userId);
        assert.deepEqual(rows.filter((r) => r.status === 'PENDING').map((r) => r.channel), [], brief(rows));
        assert.equal(rows.filter((r) => r.channel === 'SMS').length, 1, brief(rows));
    });
});

describe('e. formulaire', () => {
    test('bandeau : « Déplacer le repère de plus de 200 m prévient les détenteurs de billets par SMS. » ; résumé : heure de l’avis', () => {
        const src = fs.readFileSync(path.join(process.cwd(), 'components', 'events', 'EventForm.tsx'), 'utf8');
        assert.ok(src.includes('<li>Déplacer le repère de plus de 200 m prévient les détenteurs de billets par SMS.</li>'), 'phrase du bandeau');
        assert.ok(!src.includes('affiche et position : modifiables librement'), 'le bandeau ne dit plus la position modifiable librement');
        assert.ok(src.includes('Le changement de lieu sera annoncé aux détenteurs de billets à ${placeAt} : un seul avis de changement de lieu part par heure.'), 'résumé d’un avis retenu');
    });
});

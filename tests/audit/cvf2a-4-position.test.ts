/**
 * Contre-vérification de la finition 2a, attaque 4 — position du lieu.
 *  a. Demi-position, position hors du Sénégal, valeurs non numériques, retrait après validation (VALIDE, PUBLIE,
 *     SUSPENDU), par chaque route (création, modification) et chaque fonction (event_create, event_update) : refusés,
 *     la position enregistrée ne change pas.
 *  b. Règle des 200 m, déplacer le repère plusieurs fois :
 *     - petits pas de 150 m dans la même direction (600 m au total) : les détenteurs doivent être prévenus une fois le
 *       lieu déplacé de plus de 200 m (sinon l'avis est contourné) ;
 *     - aller-retour de 300 m répété quatre fois dans l'heure (chaque SMS parti avant le pas suivant) : pas de rafale de
 *       SMS aux détenteurs ;
 *     - aller-retour de 300 m dans la même fenêtre de 10 minutes : le repère revient à sa place, aucun SMS « change de
 *       lieu » ne doit partir.
 * Sortie brute `[CVF2A-4]`.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { newBuyer, service, type SaleEvent } from '../parcours/paiement-helpers';
import { newPartner, type TestPartner } from '../parcours/finance-helpers';
import { createTimedEvent } from '../parcours/acces-helpers';
import { createDraftEvent } from '../parcours/cycle-helpers';
import { dispatchAt } from '../parcours/notif-helpers';
import { assertFinition1Invariants } from '../helpers/finition1-invariants';
import { FREE, api, freeTicket, show, type Reply, type Row } from './cvf1-helpers';
import { putEvent, versionOf } from './cvf2a-helpers';

const DAKAR = { latitude: 14.6928, longitude: -17.4467 };
/** Degrés de latitude pour un déplacement vers le nord (1° ≈ 111,2 km). */
const NORTH_150M = 0.00135;
const NORTH_300M = 0.0027;

let P: TestPartner;

before(async () => {
    P = await newPartner('cvf2a-position');
});

after(async () => {
    await assertFinition1Invariants('cvf2a-4-position');
});

function list(lines: string[]): string {
    return lines.map((l) => `  - ${l}`).join('\n');
}

async function positionOf(eventId: string): Promise<[number | null, number | null]> {
    const { data, error } = await service.from('events').select('latitude, longitude').eq('id', eventId).single();
    assert.equal(error, null, error?.message);
    return [data!.latitude === null ? null : Number(data!.latitude), data!.longitude === null ? null : Number(data!.longitude)];
}

async function rpc(name: string, p: Row): Promise<Row> {
    const { data, error } = await service.rpc(name, { p });
    if (error) return { ok: false, code: 'SQL_ERROR', message: error.message };
    return (data ?? {}) as Row;
}

async function publishedAt(label: string, status: 'VALIDE' | 'PUBLIE' | 'SUSPENDU', cats = [{ name: FREE, price: 0, total: 20 }]): Promise<SaleEvent> {
    const ev = await createTimedEvent(P.partnerId, `cvf2a-pos-${label}`, cats, { startsInHours: 48, status });
    const { error } = await service.from('events').update(DAKAR).eq('id', ev.eventId);
    assert.equal(error, null, `repère (montage) : ${error?.message}`);
    return ev;
}

describe('a. demi-position, hors du Sénégal, retrait après validation : routes et fonctions', () => {
    test('création (route et event_create) : demi-position, hors du Sénégal, non numérique refusées', async () => {
        const day = new Date(Date.now() + 12 * 86_400_000).toISOString().slice(0, 10);
        const body = (pos: Row) => ({ title: 'Position piégée', category: 'CONCERT', start_date: day, start_time: '20:00', location: 'Salle de test', city: 'Dakar', ...pos });
        const witness = await api('POST', 'partner/events', { token: P.accessToken, body: body(DAKAR) });
        assert.ok(witness.status >= 200 && witness.status < 300, `précondition : création avec un repère à Dakar acceptée (${show(witness)})`);
        const cases: Array<[string, Row]> = [
            ['latitude seule', { latitude: 14.7 }],
            ['longitude seule', { longitude: -17.4 }],
            ['latitude et longitude nulle', { latitude: 14.7, longitude: null }],
            ['Paris', { latitude: 48.8566, longitude: 2.3522 }],
            ['au large (océan)', { latitude: 14.7, longitude: -18.5 }],
            ['latitude 1e308', { latitude: 1e308, longitude: -17.4 }],
            ['chaînes de caractères', { latitude: '14.7', longitude: '-17.4' }],
            ['bornes inversées', { latitude: -17.4, longitude: 14.7 }],
        ];
        const breaches: string[] = [];
        for (const [label, pos] of cases) {
            const r = await api('POST', 'partner/events', { token: P.accessToken, body: body(pos) });
            console.log(`[CVF2A-4] POST events ${label} → ${show(r).slice(0, 180)}`);
            if (r.status < 400) breaches.push(`route, ${label} : ${show(r).slice(0, 160)}`);
        }
        const rpcWitness = await rpc('event_create', { actor_id: P.userId, event: { ...body(DAKAR), start_time: '20:00:00' } });
        assert.equal(rpcWitness.ok, true, `précondition : event_create avec un repère à Dakar acceptée (${JSON.stringify(rpcWitness).slice(0, 300)})`);
        const rpcCases: Array<[string, Row]> = [
            ['latitude seule', { latitude: 14.7 }],
            ['latitude et longitude nulle', { latitude: 14.7, longitude: null }],
            ['Paris', { latitude: 48.85, longitude: 2.35 }],
            ['NaN', { latitude: 'NaN', longitude: 'NaN' }],
            ['Infinity', { latitude: 'Infinity', longitude: '-Infinity' }],
        ];
        for (const [label, pos] of rpcCases) {
            const r = await rpc('event_create', { actor_id: P.userId, event: { ...body(pos), start_time: '20:00:00' } });
            console.log(`[CVF2A-4] event_create ${label} → ${JSON.stringify(r).slice(0, 180)}`);
            if (r.ok === true) breaches.push(`event_create, ${label} : ${JSON.stringify(r).slice(0, 160)}`);
        }
        assert.deepEqual(breaches, [], `position invalide acceptée à la création :\n${list(breaches)}`);
    });

    test('modification (route et event_update) d’un brouillon : demi-position, hors du Sénégal, non numérique refusées, repère inchangé', async () => {
        const d = await createDraftEvent(P, 'cvf2a-pos-brouillon', [{ name: 'Standard', price: 0, total: 10 }], { startsInHours: 72, position: DAKAR });
        const breaches: string[] = [];
        const cases: Array<[string, Row]> = [
            ['latitude seule', { latitude: 14.75 }],
            ['longitude seule', { longitude: -17.3 }],
            ['latitude nulle seule', { latitude: null }],
            ['latitude et longitude nulle', { latitude: 14.75, longitude: null }],
            ['Paris', { latitude: 48.8566, longitude: 2.3522 }],
            ['Mauritanie', { latitude: 18.08, longitude: -15.97 }],
            ['chaînes de caractères', { latitude: '14.75', longitude: '-17.3' }],
        ];
        for (const [label, patch] of cases) {
            const r = await putEvent(P.accessToken, d.eventId, patch);
            console.log(`[CVF2A-4] PUT ${label} → ${show(r).slice(0, 180)}`);
            if (r.status < 400) breaches.push(`route, ${label} : ${show(r).slice(0, 160)}`);
            // Une chaîne lisible (« 14.75 ») est convertie par la base : ce cas ne vise que la route (schéma partagé)
            if (label === 'chaînes de caractères') continue;
            const b = await rpc('event_update', { event_id: d.eventId, actor_id: P.userId, patch, expected_updated_at: await versionOf(d.eventId) });
            console.log(`[CVF2A-4] event_update ${label} → ${JSON.stringify(b).slice(0, 180)}`);
            if (b.ok === true) breaches.push(`event_update, ${label} : ${JSON.stringify(b).slice(0, 160)}`);
        }
        for (const [label, patch] of [['NaN', { latitude: 'NaN', longitude: 'NaN' }], ['Infinity', { latitude: 'Infinity', longitude: 'Infinity' }]] as const) {
            const b = await rpc('event_update', { event_id: d.eventId, actor_id: P.userId, patch, expected_updated_at: await versionOf(d.eventId) });
            console.log(`[CVF2A-4] event_update ${label} → ${JSON.stringify(b).slice(0, 180)}`);
            if (b.ok === true) breaches.push(`event_update, ${label} : ${JSON.stringify(b).slice(0, 160)}`);
        }
        assert.deepEqual(breaches, [], `position invalide acceptée à la modification :\n${list(breaches)}`);
        assert.deepEqual(await positionOf(d.eventId), [DAKAR.latitude, DAKAR.longitude], 'repère du brouillon changé');
    });

    test('retrait du repère après validation (VALIDE, PUBLIE, SUSPENDU), par la route et par event_update : refusé', async () => {
        const breaches: string[] = [];
        for (const status of ['VALIDE', 'PUBLIE', 'SUSPENDU'] as const) {
            const ev = await publishedAt(`retrait-${status.toLowerCase()}`, status);
            for (const [label, patch] of [['les deux nuls', { latitude: null, longitude: null }], ['latitude nulle seule', { latitude: null }], ['longitude nulle seule', { longitude: null }]] as const) {
                const r = await putEvent(P.accessToken, ev.eventId, patch);
                console.log(`[CVF2A-4] ${status} : PUT ${label} → ${show(r).slice(0, 180)}`);
                if (r.status < 400) breaches.push(`${status}, route, ${label} : ${show(r).slice(0, 160)}`);
                const b = await rpc('event_update', { event_id: ev.eventId, actor_id: P.userId, patch, expected_updated_at: await versionOf(ev.eventId) });
                console.log(`[CVF2A-4] ${status} : event_update ${label} → ${JSON.stringify(b).slice(0, 180)}`);
                if (b.ok === true) breaches.push(`${status}, event_update, ${label} : ${JSON.stringify(b).slice(0, 160)}`);
            }
            const pos = await positionOf(ev.eventId);
            if (pos[0] === null || pos[1] === null) breaches.push(`${status} : repère retiré (${JSON.stringify(pos)})`);
        }
        assert.deepEqual(breaches, [], `repère retiré après validation :\n${list(breaches)}`);
    });
});

// ── Règle des 200 m ────────────────────────────────────────────────────────

interface Outbox { id: string; channel: string; status: string; recipient_user_id: string | null; template_data: Row; created_at: string }

async function changeRows(eventId: string): Promise<Outbox[]> {
    const { data, error } = await service.from('notification_outbox').select('id, channel, status, recipient_user_id, template_data, created_at')
        .eq('event_id', eventId).eq('type', 'EVENT_CHANGED').order('created_at');
    assert.equal(error, null, error?.message);
    return (data ?? []) as Outbox[];
}

function brief(rows: Outbox[]): string {
    return rows.map((r) => `${r.channel}:${r.status}:${JSON.stringify((r.template_data as Row).changed_fields ?? [])}`).join(' | ');
}

/** SMS « changement » d'un détenteur, hors lignes annulées. */
function smsOf(rows: Outbox[], userId: string): Outbox[] {
    return rows.filter((r) => r.channel === 'SMS' && r.recipient_user_id === userId && r.status !== 'CANCELLED');
}

async function move(eventId: string, latitude: number): Promise<Reply> {
    const r = await putEvent(P.accessToken, eventId, { latitude, longitude: DAKAR.longitude });
    assert.equal(r.status, 200, `déplacement du repère (${latitude}) : ${show(r)}`);
    return r;
}

/** Passage de l'envoyeur 11 minutes plus tard (fenêtre de regroupement de 10 minutes écoulée) pour cet événement. */
async function elevenMinutesLater(eventId: string): Promise<void> {
    await dispatchAt(new Date(Date.now() + 11 * 60_000), { eventIds: [eventId] });
}

describe('b. règle des 200 m : déplacer le repère plusieurs fois', () => {
    test('petits pas de 150 m dans la même direction (600 m au total) : les détenteurs sont prévenus', async () => {
        const ev = await publishedAt('petits-pas', 'PUBLIE');
        const holders = [await newBuyer('cvf2a-pos-pas-1'), await newBuyer('cvf2a-pos-pas-2')];
        for (const h of holders) await freeTicket(ev, h);
        const notified: number[] = [];
        for (let step = 1; step <= 4; step++) {
            const r = await move(ev.eventId, DAKAR.latitude + step * NORTH_150M);
            notified.push(Number(r.body.notified_holders ?? 0));
            console.log(`[CVF2A-4] pas ${step} (${step * 150} m du lieu d'origine, 150 m du précédent) → ${show(r).slice(0, 160)}`);
        }
        const rows = await changeRows(ev.eventId);
        const pos = await positionOf(ev.eventId);
        console.log(`[CVF2A-4] petits pas : détenteurs prévenus par pas ${JSON.stringify(notified)} ; repère final ${JSON.stringify(pos)} (≈ 600 m au nord) ; boîte d'envoi : ${brief(rows) || 'vide'}`);
        const sms = holders.map((h) => smsOf(rows, h.userId).length);
        assert.ok(sms.every((n) => n >= 1), `lieu déplacé d'environ 600 m par petits pas de 150 m : aucun détenteur prévenu (SMS par détenteur ${JSON.stringify(sms)}, prévenus par pas ${JSON.stringify(notified)})`);
    });

    test('aller-retour de 300 m quatre fois dans l’heure, chaque SMS parti avant le pas suivant : pas de rafale', async () => {
        const ev = await publishedAt('rafale', 'PUBLIE');
        const holder = await newBuyer('cvf2a-pos-rafale');
        await freeTicket(ev, holder);
        for (let i = 1; i <= 4; i++) {
            const r = await move(ev.eventId, i % 2 === 1 ? DAKAR.latitude + NORTH_300M : DAKAR.latitude);
            console.log(`[CVF2A-4] déplacement ${i} (${i % 2 === 1 ? 'aller' : 'retour'}, 300 m) → ${show(r).slice(0, 160)}`);
            await elevenMinutesLater(ev.eventId);
            const pending = smsOf(await changeRows(ev.eventId), holder.userId).filter((s) => s.status === 'PENDING');
            assert.deepEqual(pending.map((s) => s.id), [], `précondition : le SMS du déplacement ${i} est parti avant le suivant (${brief(pending)})`);
        }
        const rows = await changeRows(ev.eventId);
        const sms = smsOf(rows, holder.userId);
        const push = rows.filter((r) => r.channel === 'PUSH' && r.recipient_user_id === holder.userId);
        console.log(`[CVF2A-4] rafale : ${sms.length} SMS et ${push.length} notifications push au détenteur pour 4 déplacements (repère revenu à sa place) ; ${brief(rows)}`);
        assert.ok(sms.some((s) => s.status === 'SENT'), `précondition : un SMS « changement » est bien parti (${brief(sms)})`);
        assert.ok(sms.length <= 2, `rafale : ${sms.length} SMS « change de lieu » au même détenteur en moins d'une heure pour un repère revenu à sa place (${brief(sms)})`);
    });

    test('aller-retour de 300 m dans la même fenêtre de 10 minutes : aucun SMS « change de lieu »', async () => {
        const ev = await publishedAt('aller-retour', 'PUBLIE');
        const holder = await newBuyer('cvf2a-pos-retour');
        await freeTicket(ev, holder);
        await move(ev.eventId, DAKAR.latitude + NORTH_300M);
        await move(ev.eventId, DAKAR.latitude);
        await elevenMinutesLater(ev.eventId);
        const rows = await changeRows(ev.eventId);
        const pos = await positionOf(ev.eventId);
        const sent = smsOf(rows, holder.userId).filter((s) => JSON.stringify((s.template_data as Row).changed_fields ?? []).includes('position'));
        console.log(`[CVF2A-4] aller-retour dans la fenêtre : repère final ${JSON.stringify(pos)} ; boîte d'envoi : ${brief(rows)}`);
        assert.deepEqual(pos, [DAKAR.latitude, DAKAR.longitude], 'précondition : repère revenu à sa place');
        assert.deepEqual(sent.map((s) => `${s.status}:${JSON.stringify((s.template_data as Row).changed_fields)}`), [], 'SMS « change de lieu » envoyé alors que le repère est revenu à sa place');
    });
});

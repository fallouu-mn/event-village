/**
 * Lot 9 bis, tâche 32 (R14, R26 ; contrat 5.32, B71, 11.2 M1) — le changement de date ou de lieu devient un message
 * indispensable (famille ESSENTIAL, sujet NULL), envoyé malgré la plage de nuit, la préférence et le budget des SMS
 * optionnels, et regroupé sur 10 minutes :
 *  1. changement de lieu, envoyeur à 23:00 à Dakar → SMS SENT, texte exact ;
 *  2. préférence EVENT_UPDATES/SMS coupée (ligne notification_preferences d'avant le lot) → SMS PENDING puis SENT ;
 *  3. budget des SMS optionnels à 0 (notif.sms_optional_daily_cap) → SMS SENT ;
 *  4. R26 : changement de lieu à t, envoyeur à t + 1 min (rien ne part), changement d'heure ensuite, envoyeur à
 *     t + 11 min → un seul SMS, champs unis (« change : {date}, {lieu}. Billets toujours valables. ») ;
 *  5. famille de chaque ligne créée = ESSENTIAL, sujet NULL ;
 *  6. début à moins d'une heure → SMS dû tout de suite (`due_at` = maintenant) ;
 *  témoin : titre seul → SMS SKIPPED TITLE_ONLY (vert aujourd'hui, règle gardée).
 * Horloge : seulement `now` de dispatchAt, jamais dans le passé ; aucune route n'accepte d'heure. Envois comptés par
 * numéro neuf (newBuyer) et par texte exact.
 *
 * Rouge avant correctif : EVENT_CHANGED est OPTIONAL/EVENT_UPDATES (registre M/20261103000002:90,
 * lib/notifications/catalog.ts:668) : SKIPPED QUIET_HOURS la nuit (M/20261105000002:302-303), PREFERENCE_DISABLED à
 * l'écriture (M/20261103000002:557-559), SMS_OPTIONAL_CAP (M/20261105000002:362-363) ; la ligne SMS est due tout de
 * suite (M/20261108000001:456-476) : le premier changement part à t + 1, le second crée une autre ligne (deux SMS).
 *
 * Lot 9 bis, tâche 36 (R18, R95 ; contrat 5.36, B76, 11.1 N21 et N22) — alerte in-app aux admins `events.read` quand,
 * après validation, le titre, l'affiche, le lieu ou la date changent, ou qu'une catégorie est ajoutée ; accusé in-app
 * à la partenaire à la soumission. Cas : titre changé sur un PUBLIE, affiche changée, catégorie créée sur un PUBLIE →
 * ADMIN_EVENT_CHANGED à l'admin `events.read` ; témoins : description seule, catégorie créée sur un BROUILLON, admin
 * sans permission → rien ; soumission (BROUILLON → EN_ATTENTE) → EVENT_SUBMITTED_ACK à la propriétaire. Rouge : types
 * absents (event_update ne prévient que les porteurs, M/20261108000001:248, :495-500 ; ticket_category_create
 * n'alerte personne, M/20261106000001:835-890 ; soumission : admins seulement, M/20261103000005:1233-1236).
 * after() : la garde de schéma du lot 9 bis nomme les objets absents jusqu'à M12 (attendu, contrat section 10).
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { assertLot9bisInvariants } from '../helpers/lot9bis-invariants';
import { smsDateTime } from '../../lib/notifications/sms-format';
import { routeContext } from './helpers';
import { newBuyer, service, type Buyer, type CategorySpec } from './paiement-helpers';
import { buyConfirmed, jsonRequest, newPartner, type TestPartner } from './finance-helpers';
import { type RouteResult } from './acces-helpers';
import { advanceEventTo, assertRpcOk, createDraftEvent, posterUrl, rpcTransition, type DraftEvent } from './cycle-helpers';
import {
    addMinutes, dakarAt, dakarDay, dispatchAt, noonDakarTomorrow, outboxRows, smsMark, smsTo, withNotifSettings, type OutboxRow,
} from './notif-helpers';
import { invoke, routeHandler, show } from './pilotage-helpers';
import { newAdminWith } from './terrain-helpers';
import type { TestAdmin } from './notif-helpers';

type Row = Record<string, unknown>;

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/+$/, '');
const STANDARD = 'Standard';
const CATEGORIES: CategorySpec[] = [{ name: STANDARD, price: 3_000, total: 40, maxPerOrder: 10 }];
const EVENT_ROUTE = '../../app/api/partner/events/[id]/route';
const CATEGORIES_ROUTE = '../../app/api/partner/events/[id]/categories/route';
const EVENT_DAY = dakarDay(3);

let partner: TestPartner;

before(async () => {
    assert.ok(APP_URL.startsWith('http'), 'NEXT_PUBLIC_APP_URL absente de .env.test');
    partner = await newPartner('msg-changement');
});

after(async () => {
    await assertLot9bisInvariants('messages-changement-9bis');
});

// ── Outils locaux ──────────────────────────────────────────────────────────

/** Titre court, GSM-7, jamais tronqué par smsVar (20 caractères au plus). */
function shortTitle(prefix: string): string {
    const t = `${prefix} ${randomBytes(2).toString('hex')}`;
    assert.ok(t.length <= 20 && /^[A-Za-z0-9 ]+$/.test(t), `titre de test « ${t} » : 20 caractères GSM-7 au plus`);
    return t;
}

/** Nouveau lieu court, GSM-7, sans point final (20 caractères au plus). */
function newPlace(): string {
    return `Salle ${randomBytes(3).toString('hex')}`;
}

/**
 * Événement PUBLIE de la partenaire, le jour J+3 de 20:00 à 23:30 (heure de Dakar), et un porteur d'un billet payé.
 * `startsInHours` : début dans N heures à la place (dates de createDraftEvent, durée 3 h).
 */
async function eventWithHolder(label: string, opts: { startsInHours?: number } = {}): Promise<{ ev: DraftEvent; holder: Buyer }> {
    const ev = await createDraftEvent(partner, `msg-chg ${label}`, CATEGORIES, {
        title: shortTitle(label), startsInHours: opts.startsInHours ?? 96, durationHours: 3,
    });
    if (opts.startsInHours === undefined) {
        const { data, error } = await service.from('events')
            .update({ start_date: EVENT_DAY, start_time: '20:00:00', end_date: EVENT_DAY, end_time: '23:30:00' })
            .eq('id', ev.eventId).select('id');
        assert.equal(error, null, `dates de l'événement ${label} : ${error?.message}`);
        assert.equal((data ?? []).length, 1, `dates de l'événement ${label} : aucune ligne modifiée`);
    }
    await advanceEventTo(ev.eventId, 'PUBLIE', { partnerUserId: partner.userId });
    const holder = await newBuyer(`chg-${label.replace(/\s+/g, '').slice(0, 10)}`);
    await buyConfirmed(holder, ev, [[STANDARD, 1]]);
    return { ev, holder };
}

async function eventRow(eventId: string): Promise<Row> {
    const { data, error } = await service.from('events').select('*').eq('id', eventId).single();
    assert.equal(error, null, `événement ${eventId} : ${error?.message}`);
    return data as Row;
}

async function putEvent(user: Buyer, eventId: string, patch: Row): Promise<RouteResult> {
    const handler = await routeHandler(EVENT_ROUTE, 'PUT', 'PUT /api/partner/events/[id]');
    const expected = String((await eventRow(eventId)).updated_at);
    return invoke(handler, jsonRequest(`/api/partner/events/${eventId}`, 'PUT', user.accessToken, { patch, expected_updated_at: expected }), routeContext({ id: eventId }));
}

async function putOk(user: Buyer, eventId: string, patch: Row, what: string): Promise<void> {
    const res = await putEvent(user, eventId, patch);
    assert.equal(res.status, 200, `${what} : ${show(res)}`);
}

/** Lignes SMS EVENT_CHANGED du porteur pour l'événement. */
async function changeSms(ev: DraftEvent, holder: Buyer): Promise<OutboxRow[]> {
    return outboxRows({ type: 'EVENT_CHANGED', eventId: ev.eventId, userId: holder.userId, channel: 'SMS' });
}

function describeRows(rows: OutboxRow[]): string {
    return JSON.stringify(rows.map((r) => [r.channel, r.status, r.reason, r.family, r.topic, r.due_at]));
}

function placeText(ev: DraftEvent, place: string): string {
    return `Event Village : ${ev.title} change de lieu : ${place}. Vos billets restent valables. ${APP_URL}/tickets`;
}

// ── R14 : indispensable ────────────────────────────────────────────────────

describe('9b.32 R14 : changement de date ou de lieu indispensable (nuit, préférence, budget)', () => {
    test('changement de lieu, envoyeur à 23:00 à Dakar : SMS SENT, texte exact (aucune plage de nuit)', async () => {
        const { ev, holder } = await eventWithHolder('Nuit');
        const place = newPlace();
        const mark = smsMark(holder.phoneE164);
        await putOk(partner, ev.eventId, { location: place }, 'changement de lieu');

        await dispatchAt(dakarAt(dakarDay(1), '23:00'), { eventIds: [ev.eventId] });
        const rows = await changeSms(ev, holder);
        assert.deepEqual(rows.map((r) => [r.status, r.reason]), [['SENT', null]], `SMS envoyé à 23:00 (indispensable) : ${describeRows(rows)}`);
        assert.deepEqual(smsTo(holder.phoneE164, mark).map((m) => m.message), [placeText(ev, place)], 'un SMS remis, texte exact');
    });

    test('préférence EVENT_UPDATES/SMS coupée : SMS PENDING à l\'écriture puis SENT', async () => {
        const { ev, holder } = await eventWithHolder('Pref');
        const { error } = await service.from('notification_preferences').upsert(
            { user_id: holder.userId, topic: 'EVENT_UPDATES', channel: 'SMS', enabled: false, updated_at: new Date().toISOString() },
            { onConflict: 'user_id,topic,channel' });
        assert.equal(error, null, `préférence coupée (ligne d'avant le lot) : ${error?.message}`);
        const place = newPlace();
        const mark = smsMark(holder.phoneE164);
        await putOk(partner, ev.eventId, { location: place }, 'changement de lieu');

        const written = await changeSms(ev, holder);
        assert.deepEqual(written.map((r) => [r.status, r.reason]), [['PENDING', null]], `ligne écrite en attente, jamais SKIPPED PREFERENCE_DISABLED : ${describeRows(written)}`);
        await dispatchAt(noonDakarTomorrow(), { eventIds: [ev.eventId] });
        const sent = await changeSms(ev, holder);
        assert.deepEqual(sent.map((r) => r.status), ['SENT'], `SMS envoyé malgré la préférence : ${describeRows(sent)}`);
        assert.deepEqual(smsTo(holder.phoneE164, mark).map((m) => m.message), [placeText(ev, place)], 'un SMS remis, texte exact');
    });

    test('budget des SMS optionnels à 0 : SMS SENT (jamais SMS_OPTIONAL_CAP)', async () => {
        const { ev, holder } = await eventWithHolder('Budget');
        const place = newPlace();
        const mark = smsMark(holder.phoneE164);
        await withNotifSettings({ 'notif.sms_optional_daily_cap': 0 }, async () => {
            await putOk(partner, ev.eventId, { location: place }, 'changement de lieu');
            await dispatchAt(noonDakarTomorrow(), { eventIds: [ev.eventId] });
        });
        const rows = await changeSms(ev, holder);
        assert.deepEqual(rows.map((r) => [r.status, r.reason]), [['SENT', null]], `SMS envoyé, budget optionnel ignoré : ${describeRows(rows)}`);
        assert.deepEqual(smsTo(holder.phoneE164, mark).map((m) => m.message), [placeText(ev, place)], 'un SMS remis, texte exact');
    });

    test('famille de chaque ligne EVENT_CHANGED créée : ESSENTIAL, sujet NULL', async () => {
        const { ev, holder } = await eventWithHolder('Famille');
        await putOk(partner, ev.eventId, { location: newPlace() }, 'changement de lieu');
        const rows = await outboxRows({ type: 'EVENT_CHANGED', eventId: ev.eventId, userId: holder.userId });
        assert.ok(rows.length >= 2, `lignes du porteur (SMS et application au moins) : ${describeRows(rows)}`);
        assert.deepEqual(Array.from(new Set(rows.map((r) => `${r.family}:${r.topic}`))), ['ESSENTIAL:null'], `famille indispensable, sans sujet (B71) : ${describeRows(rows)}`);
    });

    test('témoin : titre seul → SMS SKIPPED TITLE_ONLY (rien ne part par SMS)', async () => {
        const { ev, holder } = await eventWithHolder('Titre');
        await putOk(partner, ev.eventId, { title: `${ev.title} bis` }, 'changement de titre');
        const rows = await changeSms(ev, holder);
        assert.deepEqual(rows.map((r) => [r.status, r.reason]), [['SKIPPED', 'TITLE_ONLY']], `titre seul : aucun SMS (M/20261108000001:485-490) : ${describeRows(rows)}`);
    });
});

// ── R26 : regroupement sur 10 minutes ──────────────────────────────────────

describe('9b.32 R26 : SMS de changement regroupé sur 10 minutes, sauf début à moins d\'une heure', () => {
    test('lieu à t, envoyeur à t + 1 min, heure changée ensuite, envoyeur à t + 11 min : un seul SMS, champs unis', async () => {
        const { ev, holder } = await eventWithHolder('Regroupe');
        const place = newPlace();
        const mark = smsMark(holder.phoneE164);
        const t0 = new Date();
        await putOk(partner, ev.eventId, { location: place }, 'premier changement (lieu)');
        const first = await changeSms(ev, holder);
        assert.equal(first.length, 1, `une ligne SMS après le premier changement : ${describeRows(first)}`);
        const due = Date.parse(first[0].due_at);
        assert.ok(due >= t0.getTime() + 9 * 60_000 && due <= Date.now() + 11 * 60_000, `SMS dû à t + 10 min (B71) : ${first[0].due_at}`);

        await dispatchAt(addMinutes(t0, 1), { eventIds: [ev.eventId] });
        assert.deepEqual(smsTo(holder.phoneE164, mark), [], 'rien ne part par SMS à t + 1 min');
        await putOk(partner, ev.eventId, { start_time: '21:00' }, 'second changement (heure)');
        await dispatchAt(addMinutes(t0, 11), { eventIds: [ev.eventId] });

        const rows = await changeSms(ev, holder);
        assert.deepEqual(rows.map((r) => r.status), ['SENT'], `une seule ligne SMS, fusionnée puis envoyée : ${describeRows(rows)}`);
        const newStart = smsDateTime(`${EVENT_DAY}T21:00:00.000Z`);
        assert.deepEqual(smsTo(holder.phoneE164, mark).map((m) => m.message),
            [`Event Village : ${ev.title} change : ${newStart}, ${place}. Billets toujours valables. ${APP_URL}/tickets`],
            'un seul SMS, date et lieu unis (R26)');
    });

    test('début à moins d\'une heure : SMS dû tout de suite', async () => {
        const { ev, holder } = await eventWithHolder('Bientot', { startsInHours: 50 / 60 });
        const before = Date.now();
        await putOk(partner, ev.eventId, { location: newPlace() }, 'changement de lieu');
        const afterPut = Date.now();
        const rows = await changeSms(ev, holder);
        assert.equal(rows.length, 1, `une ligne SMS : ${describeRows(rows)}`);
        const due = Date.parse(rows[0].due_at);
        assert.ok(due >= before - 60_000 && due <= afterPut + 60_000, `début dans moins d'une heure : SMS dû maintenant, sans délai de 10 min : ${rows[0].due_at}`);
        assert.equal(rows[0].family, 'ESSENTIAL', 'famille indispensable');
    });
});

// ── R18, R95 : alerte admin après validation, accusé de soumission ──────────

describe('9b.36 R18 et R95 : ADMIN_EVENT_CHANGED aux admins events.read après validation ; EVENT_SUBMITTED_ACK à la soumission', () => {
    let reader: TestAdmin;
    let bare: TestAdmin;

    before(async () => {
        reader = await newAdminWith(['events.read'], { label: 'chg-lecteur' });
        bare = await newAdminWith([], { label: 'chg-sansperm' });
    });

    async function eventInStatus(label: string, status: 'BROUILLON' | 'PUBLIE'): Promise<DraftEvent> {
        const ev = await createDraftEvent(partner, `msg-chg ${label}`, CATEGORIES, { title: shortTitle(label), startsInHours: 96 });
        if (status === 'PUBLIE') await advanceEventTo(ev.eventId, 'PUBLIE', { partnerUserId: partner.userId });
        return ev;
    }

    /** Alertes ADMIN_EVENT_CHANGED de cet admin pour cet événement (colonne event_id ou données). */
    async function alerts(admin: TestAdmin, eventId: string): Promise<OutboxRow[]> {
        return (await outboxRows({ type: 'ADMIN_EVENT_CHANGED', userId: admin.userId }))
            .filter((r) => r.event_id === eventId || r.template_data.event_id === eventId);
    }

    async function postCategory(eventId: string, name: string): Promise<RouteResult> {
        const handler = await routeHandler(CATEGORIES_ROUTE, 'POST', 'POST /api/partner/events/[id]/categories');
        return invoke(handler, jsonRequest(`/api/partner/events/${eventId}/categories`, 'POST', partner.accessToken,
            { name, price: 5_000, total_quantity: 10, max_per_order: 4 }), routeContext({ id: eventId }));
    }

    function assertAlerted(rows: OutboxRow[], what: string): void {
        assert.ok(rows.some((r) => r.channel === 'IN_APP'), `${what} : ADMIN_EVENT_CHANGED en in-app à l'admin events.read : ${describeRows(rows)}`);
    }

    test('titre changé sur un PUBLIE : alerte à l\'admin events.read, rien à l\'admin sans permission', async () => {
        const ev = await eventInStatus('Titre admin', 'PUBLIE');
        await putOk(partner, ev.eventId, { title: `${ev.title} bis` }, 'changement de titre');
        assertAlerted(await alerts(reader, ev.eventId), 'titre changé');
        assert.deepEqual(await alerts(bare, ev.eventId), [], 'rien à l\'admin sans events.read');
    });

    test('affiche changée sur un PUBLIE : alerte à l\'admin events.read', async () => {
        const ev = await eventInStatus('Affiche admin', 'PUBLIE');
        await putOk(partner, ev.eventId, { image_url: posterUrl(partner.partnerId) }, 'changement d\'affiche');
        assertAlerted(await alerts(reader, ev.eventId), 'affiche changée');
    });

    test('catégorie créée sur un PUBLIE : alerte à l\'admin events.read', async () => {
        const ev = await eventInStatus('Categorie admin', 'PUBLIE');
        const res = await postCategory(ev.eventId, 'Carre or');
        assert.equal(res.status, 201, `création de la catégorie : ${show(res)}`);
        assertAlerted(await alerts(reader, ev.eventId), 'catégorie ajoutée');
    });

    test('témoins : description seule sur un PUBLIE, catégorie créée sur un BROUILLON → aucune alerte', async () => {
        const published = await eventInStatus('Desc admin', 'PUBLIE');
        await putOk(partner, published.eventId, { description: 'Description corrigée, rien d\'autre.' }, 'description seule');
        assert.deepEqual(await outboxRows({ type: 'ADMIN_EVENT_CHANGED', eventId: published.eventId }), [], 'description seule : aucune alerte');
        const draft = await eventInStatus('Brouillon admin', 'BROUILLON');
        const res = await postCategory(draft.eventId, 'Carre or');
        assert.equal(res.status, 201, `création de la catégorie du brouillon : ${show(res)}`);
        assert.deepEqual(await alerts(reader, draft.eventId), [], 'catégorie d\'un brouillon : aucune alerte');
    });

    test('soumission (BROUILLON → EN_ATTENTE) : EVENT_SUBMITTED_ACK en in-app à la propriétaire', async () => {
        const ev = await eventInStatus('Soumission', 'BROUILLON');
        assertRpcOk(await rpcTransition(ev.eventId, partner.userId, 'EN_ATTENTE'), 'soumission');
        const rows = await outboxRows({ type: 'EVENT_SUBMITTED_ACK', eventId: ev.eventId, userId: partner.userId });
        assert.ok(rows.some((r) => r.channel === 'IN_APP'), `accusé de soumission à la propriétaire : ${describeRows(rows)}`);
    });
});

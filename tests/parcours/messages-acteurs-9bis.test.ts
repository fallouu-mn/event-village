/**
 * Lot 9 bis, tâche 33 (R15, R33 ; contrat 5.33, B72, 11.1 N13 à N17) — partenaire, admins et contrôleurs prévenus :
 *  1. un admin annule → EVENT_CANCELLED_BY_ADMIN à la propriétaire, IN_APP et SMS, dans la transaction de
 *     l'annulation (avant tout versement : aucun CANCEL_REFUNDS_DONE ni BLOCKED encore) ; SMS exact, motif = avis
 *     public, jamais le motif interne ;
 *  2. la partenaire annule → ADMIN_EVENT_CANCELLED à l'admin `events.read`, rien à l'admin sans permission ;
 *  3. contrôleur affecté (affectation acceptée) : SMS CONTROLLER_EVENT_CANCELLED à l'annulation (texte exact) ;
 *     contrôleur invité qui n'a pas accepté (POST /api/partner/team/invite, R37) : rien ;
 *  4. contrôleur affecté : CONTROLLER_EVENT_STATUS en in-app seulement à la suspension et à la reprise ;
 *  5. contrôleur affecté : changement de lieu → CONTROLLER_EVENT_CHANGED in-app tout de suite, SMS dû dans 10 min.
 * Lot 9 bis, tâche 35 (R24, décision ; contrat 5.35, B75) — témoin vert dès l'écriture : à la suspension et à la
 * reprise, aucune ligne SMS EVENT_SUSPENDED_HOLDER ni EVENT_REACTIVATED_HOLDER pour le porteur (in-app et push seuls) ;
 * la suite définitive (annulation) part en SMS (EVENT_CANCELLED). Statut au rapport : « non corrigé, décision ».
 * Garde-fou : la même suite prouve en rouge les avis qui manquent (tâche 33).
 *
 * Rouge avant correctif : aucun de ces types n'existe ; le trigger d'annulation ne vise que les porteurs
 * (M/20261103000005:1293-1318), rien à la suspension ni à la reprise pour les contrôleurs (:1260-1291), rien au
 * changement (M/20261108000001:431-437). after() : la garde de schéma du lot 9 bis nomme les objets absents jusqu'à M12.
 * Envois comptés par compte neuf et par texte exact, jamais globalement.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { assertLot9bisInvariants } from '../helpers/lot9bis-invariants';
import { smsDateTime } from '../../lib/notifications/sms-format';
import { routeContext } from './helpers';
import { newBuyer, service, type Buyer, type CategorySpec } from './paiement-helpers';
import { buyConfirmed, jsonRequest, newPartner, superadminId, type TestPartner } from './finance-helpers';
import { authed, newController, type RouteResult } from './acces-helpers';
import { advanceEventTo, assertRpcOk, createDraftEvent, rpcCancel, rpcTransition, type DraftEvent } from './cycle-helpers';
import { flushNotifications, outboxRows, smsMark, smsTo, type OutboxRow } from './notif-helpers';
import { invoke, routeHandler, show } from './pilotage-helpers';
import { newAdminWith } from './terrain-helpers';

type Row = Record<string, unknown>;

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/+$/, '');
const STANDARD = 'Standard';
const CATEGORIES: CategorySpec[] = [{ name: STANDARD, price: 3_000, total: 40, maxPerOrder: 10 }];
const EVENT_ROUTE = '../../app/api/partner/events/[id]/route';
const INVITE_ROUTE = '../../app/api/partner/team/invite/route';
const PUBLIC_NOTICE = 'Salle indisponible ce soir';
const INTERNAL_REASON = 'Contrat de salle rompu';

let partner: TestPartner;

before(async () => {
    assert.ok(APP_URL.startsWith('http'), 'NEXT_PUBLIC_APP_URL absente de .env.test');
    partner = await newPartner('msg-acteurs');
});

after(async () => {
    await assertLot9bisInvariants('messages-acteurs-9bis');
});

// ── Outils locaux ──────────────────────────────────────────────────────────

/** Titre court, GSM-7, jamais tronqué par smsVar (20 caractères au plus). */
function shortTitle(prefix: string): string {
    const t = `${prefix} ${randomBytes(2).toString('hex')}`;
    assert.ok(t.length <= 20 && /^[A-Za-z0-9 ]+$/.test(t), `titre de test « ${t} » : 20 caractères GSM-7 au plus`);
    return t;
}

async function publishedEvent(label: string): Promise<DraftEvent> {
    const ev = await createDraftEvent(partner, `msg-act ${label}`, CATEGORIES, { title: shortTitle(label), startsInHours: 96 });
    await advanceEventTo(ev.eventId, 'PUBLIE', { partnerUserId: partner.userId });
    return ev;
}

async function eventRow(eventId: string): Promise<Row> {
    const { data, error } = await service.from('events').select('*').eq('id', eventId).single();
    assert.equal(error, null, `événement ${eventId} : ${error?.message}`);
    return data as Row;
}

/** Début de l'événement (Dakar = UTC+0), au format des SMS (smsDateTime). */
async function smsStart(eventId: string): Promise<string> {
    const ev = await eventRow(eventId);
    const time = String(ev.start_time).length === 5 ? `${String(ev.start_time)}:00` : String(ev.start_time);
    return smsDateTime(`${String(ev.start_date)}T${time}.000Z`);
}

function cancelInput(ev: DraftEvent): { publicNotice: string; internalReason: string; confirmTitle: string } {
    return { publicNotice: PUBLIC_NOTICE, internalReason: INTERNAL_REASON, confirmTitle: ev.title };
}

async function putEvent(user: Buyer, eventId: string, patch: Row): Promise<RouteResult> {
    const handler = await routeHandler(EVENT_ROUTE, 'PUT', 'PUT /api/partner/events/[id]');
    const expected = String((await eventRow(eventId)).updated_at);
    return invoke(handler, jsonRequest(`/api/partner/events/${eventId}`, 'PUT', user.accessToken, { patch, expected_updated_at: expected }), routeContext({ id: eventId }));
}

/** Lignes d'un type pour ce destinataire et cet événement. */
async function rowsOf(type: string, eventId: string, userId: string): Promise<OutboxRow[]> {
    return outboxRows({ type, eventId, userId });
}

function channels(rows: OutboxRow[]): string[] {
    return rows.map((r) => r.channel).sort();
}

function describeRows(rows: OutboxRow[]): string {
    return JSON.stringify(rows.map((r) => [r.type, r.channel, r.status, r.reason, r.due_at]));
}

// ── R15 : partenaire et admins ─────────────────────────────────────────────

describe('9b.33 R15 : partenaire prévenue d\'une annulation par un admin, admins prévenus d\'une annulation par la partenaire', () => {
    test('un admin annule : EVENT_CANCELLED_BY_ADMIN à la partenaire (IN_APP et SMS) avant tout versement, SMS exact avec l\'avis public', async () => {
        const ev = await publishedEvent('Annul admin');
        const buyer = await newBuyer('act-acheteur');
        await buyConfirmed(buyer, ev, [[STANDARD, 1]]);
        const mark = smsMark(partner.phoneE164);

        assertRpcOk(await rpcCancel(ev.eventId, await superadminId(), cancelInput(ev)), 'annulation par un admin');

        const rows = await rowsOf('EVENT_CANCELLED_BY_ADMIN', ev.eventId, partner.userId);
        assert.ok(channels(rows).includes('IN_APP') && channels(rows).includes('SMS'),
            `EVENT_CANCELLED_BY_ADMIN à la partenaire, in-app et SMS, dès l'annulation : ${describeRows(rows)}`);
        assert.deepEqual(await outboxRows({ type: ['CANCEL_REFUNDS_DONE', 'CANCEL_REFUNDS_BLOCKED'], eventId: ev.eventId }), [],
            'prévenue avant tout versement : les avis de fin des remboursements n\'existent pas encore');

        await flushNotifications({ eventIds: [ev.eventId] });
        const texts = smsTo(partner.phoneE164, mark).map((m) => m.message);
        assert.deepEqual(texts, [`Event Village : ${ev.title} annulé par l'administration. Motif : ${PUBLIC_NOTICE}. ${APP_URL}/partner/events`],
            'un SMS à la partenaire, texte exact (11.1 N13)');
        assert.ok(!texts.join(' ').includes(INTERNAL_REASON), 'le motif interne n\'est jamais envoyé');
    });

    test('la partenaire annule : ADMIN_EVENT_CANCELLED à l\'admin events.read, rien à l\'admin sans permission', async () => {
        const ev = await publishedEvent('Annul part');
        const reader = await newAdminWith(['events.read'], { label: 'act-lecteur' });
        const bare = await newAdminWith([], { label: 'act-sansperm' });

        assertRpcOk(await rpcCancel(ev.eventId, partner.userId, cancelInput(ev)), 'annulation par la partenaire');

        const toReader = await rowsOf('ADMIN_EVENT_CANCELLED', ev.eventId, reader.userId);
        assert.ok(channels(toReader).includes('IN_APP'), `ADMIN_EVENT_CANCELLED en in-app à l'admin events.read : ${describeRows(toReader)}`);
        assert.deepEqual(await rowsOf('ADMIN_EVENT_CANCELLED', ev.eventId, bare.userId), [], 'rien à l\'admin sans events.read');
        assert.deepEqual(await rowsOf('EVENT_CANCELLED_BY_ADMIN', ev.eventId, partner.userId), [], 'pas d\'avis « annulé par l\'administration » quand la partenaire annule');
    });
});

// ── R33 : contrôleurs ──────────────────────────────────────────────────────

describe('9b.33 R33 : contrôleurs affectés prévenus (annulation et changement par SMS, suspension et reprise en in-app)', () => {
    test('annulation : SMS CONTROLLER_EVENT_CANCELLED au contrôleur affecté, texte exact ; rien au contrôleur invité qui n\'a pas accepté', async () => {
        const ev = await publishedEvent('Ctrl annul');
        const controller = await newController(partner, ev.eventId, { label: 'act-annul' });
        const invited = await newBuyer('act-invite', { firstName: 'Moussa', lastName: 'Invite' });
        const inviteHandler = await routeHandler(INVITE_ROUTE, 'POST', 'POST /api/partner/team/invite');
        const invite = await invoke(inviteHandler, authed('/api/partner/team/invite', 'POST', partner,
            { event_ids: [ev.eventId], phone: invited.phoneE164, confirm_promotion: true }));
        // 201 à la création de l'invitation, comme dette-retrait-controleur.test.ts:295 (contrat de RC, inchangé par fix(9b.26)).
        assert.equal(invite.status, 201, `invitation d'un client comme contrôleur : ${show(invite)}`);
        const mark = smsMark(controller.phoneE164);
        const invitedMark = smsMark(invited.phoneE164);
        const date = await smsStart(ev.eventId);

        assertRpcOk(await rpcCancel(ev.eventId, partner.userId, cancelInput(ev)), 'annulation par la partenaire');

        const rows = await rowsOf('CONTROLLER_EVENT_CANCELLED', ev.eventId, controller.userId);
        assert.ok(channels(rows).includes('SMS'), `CONTROLLER_EVENT_CANCELLED par SMS au contrôleur affecté : ${describeRows(rows)}`);
        assert.deepEqual(await rowsOf('CONTROLLER_EVENT_CANCELLED', ev.eventId, invited.userId), [],
            'rien au contrôleur invité tant qu\'il n\'a pas accepté (affectations acceptées seulement, R37)');
        await flushNotifications({ eventIds: [ev.eventId] });
        assert.deepEqual(smsTo(controller.phoneE164, mark).map((m) => m.message),
            [`Event Village : ${ev.title} du ${date} est annulé. Votre affectation à l'entrée est retirée.`],
            'un SMS au contrôleur, texte exact (11.1 N15)');
        assert.deepEqual(smsTo(invited.phoneE164, invitedMark).filter((m) => m.message.includes(ev.title)), [], 'aucun SMS d\'annulation au compte invité');
    });

    test('suspension puis reprise : CONTROLLER_EVENT_STATUS en in-app seulement, à chaque transition', async () => {
        const ev = await publishedEvent('Ctrl susp');
        const controller = await newController(partner, ev.eventId, { label: 'act-susp' });
        const admin = await superadminId();
        assertRpcOk(await rpcTransition(ev.eventId, admin, 'SUSPENDU', 'Signalement en cours'), 'suspension');
        assertRpcOk(await rpcTransition(ev.eventId, admin, 'PUBLIE'), 'reprise');

        const rows = await rowsOf('CONTROLLER_EVENT_STATUS', ev.eventId, controller.userId);
        assert.equal(rows.filter((r) => r.channel === 'IN_APP').length, 2, `deux avis in-app (suspension, reprise) : ${describeRows(rows)}`);
        assert.deepEqual(rows.filter((r) => r.channel === 'SMS'), [], 'aucun SMS à la suspension ni à la reprise');
    });

    test('changement de lieu : CONTROLLER_EVENT_CHANGED en in-app tout de suite et par SMS dû dans 10 minutes', async () => {
        const ev = await publishedEvent('Ctrl lieu');
        const controller = await newController(partner, ev.eventId, { label: 'act-lieu' });
        const before = Date.now();
        const res = await putEvent(partner, ev.eventId, { location: `Salle ${randomBytes(3).toString('hex')}` });
        const afterPut = Date.now();
        assert.equal(res.status, 200, `changement de lieu : ${show(res)}`);

        const rows = await rowsOf('CONTROLLER_EVENT_CHANGED', ev.eventId, controller.userId);
        const inApp = rows.filter((r) => r.channel === 'IN_APP');
        const sms = rows.filter((r) => r.channel === 'SMS');
        assert.equal(inApp.length, 1, `un avis in-app : ${describeRows(rows)}`);
        assert.ok(Date.parse(inApp[0].due_at) <= afterPut + 60_000, `in-app immédiat : ${inApp[0].due_at}`);
        assert.equal(sms.length, 1, `une ligne SMS : ${describeRows(rows)}`);
        assert.equal(sms[0].status, 'PENDING', `SMS en attente : ${describeRows(sms)}`);
        const due = Date.parse(sms[0].due_at);
        assert.ok(due >= before + 9 * 60_000 && due <= afterPut + 11 * 60_000, `SMS dû dans 10 minutes (regroupé comme EVENT_CHANGED) : ${sms[0].due_at}`);
    });
});

// ── R24 : suspension et reprise sans SMS pour les porteurs (décision) ──────

describe('9b.35 R24 : suspension et reprise en in-app et push pour les porteurs, sans SMS ; la suite définitive part en SMS', () => {
    test('témoin (décision) : aucune ligne SMS à la suspension ni à la reprise ; l\'annulation qui suit part en SMS', async () => {
        const ev = await publishedEvent('Porteur susp');
        const holder = await newBuyer('act-porteur');
        await buyConfirmed(holder, ev, [[STANDARD, 1]]);
        const admin = await superadminId();
        assertRpcOk(await rpcTransition(ev.eventId, admin, 'SUSPENDU', 'Signalement en cours'), 'suspension');
        assertRpcOk(await rpcTransition(ev.eventId, admin, 'PUBLIE'), 'reprise');

        const statusRows = await outboxRows({ type: ['EVENT_SUSPENDED_HOLDER', 'EVENT_REACTIVATED_HOLDER'], eventId: ev.eventId, userId: holder.userId });
        assert.deepEqual(Array.from(new Set(statusRows.map((r) => r.type))).sort(), ['EVENT_REACTIVATED_HOLDER', 'EVENT_SUSPENDED_HOLDER'],
            `le porteur est prévenu de la suspension et de la reprise : ${describeRows(statusRows)}`);
        assert.deepEqual(statusRows.filter((r) => r.channel === 'SMS'), [], 'aucun SMS à la suspension ni à la reprise (décision R24)');

        assertRpcOk(await rpcCancel(ev.eventId, admin, cancelInput(ev)), 'annulation');
        const cancelled = await outboxRows({ type: 'EVENT_CANCELLED', eventId: ev.eventId, userId: holder.userId, channel: 'SMS' });
        assert.equal(cancelled.length, 1, `la suite définitive (annulation) part en SMS : ${describeRows(cancelled)}`);
    });
});

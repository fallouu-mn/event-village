/**
 * Lot 9 bis, tâche 26 (R37, R38, R39, R40, R41 ; contrat 5.26, 4.3, B62 à B64, 11.1 N12) — équipe de contrôle :
 *  1. R37 : un client existant invité (avec `confirm_promotion`) doit accepter lui-même : aucune affectation ni rôle
 *     avant, une invitation PENDING de 72 h dans `controller_invitations`, `CONTROLLER_INVITATION` par SMS ;
 *     acceptation par GET puis POST /api/account/controller-invitations → rôle CONTROLEUR et affectation
 *     (`CONTROLLER_ASSIGNED` gardé) ; refus → DECLINED, rien d'autre ; un tiers ne peut pas répondre (404).
 *  2. R38 : « Renvoyer » vers un compte déjà activé → 409 ALREADY_ACTIVATED au texte du contrat, avant le quota
 *     (compteur `invite_phone` du numéro inchangé).
 *  3. R39 : un compte temporaire dont le prénom n'est pas « Contrôleur » est lu `PENDING_ACTIVATION` (état réel de
 *     auth.users) ; un compte activé `ACTIVATED`.
 *  4. R40 : compte temporaire retiré puis réinvité : un nouveau code part, l'activation (`/api/controller/setup`) passe.
 *  5. R41 : droit d'encaisser par événement : `can_accept_cash` global refusé (400 INVALID_FIELD, rien ne change) ;
 *     une liste sans droit ne retire pas les espèces d'un événement ; `assignments: [{ event_id, can_accept_cash }]`
 *     respecté événement par événement.
 * Rouge avant correctif : rôle et affectation posés tout de suite (`invite/route.ts:214-221`) ; routes
 * /api/account/controller-invitations et table controller_invitations absentes ; « prévenu … par SMS » sans SMS pour un
 * compte activé (`:439-440`), quota consommé avant (`:94-104`) ; état deviné au prénom (`team/all/route.ts:186`) ;
 * marque d'activation remise à false au retrait (`team/controller/[controllerId]/route.ts:104-107`) : aucun code à la
 * réinvitation ; un seul booléen pour toutes les affectations (`assignments/route.ts:28`, `:224-236`).
 * Fin de suite : assertLot9bisInvariants.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { assertLot9bisInvariants } from '../helpers/lot9bis-invariants';
import { getFakes } from '../fakes';
import { jsonRequest as publicRequest, randomSenegalPhone, routeContext, STRONG_PASSWORD } from './helpers';
import { newBuyer, service, type Buyer, type CategorySpec, type SaleEvent } from './paiement-helpers';
import { jsonRequest, newPartner, type TestPartner } from './finance-helpers';
import {
    assignController, createTimedEvent, myControllerInvitations, newController, respondControllerInvitation, respondControllerInvitations,
    type RouteResult,
} from './acces-helpers';
import { dispatchAt, outboxRows, smsMark, smsTo } from './notif-helpers';
import { invoke, routeHandler, show } from './pilotage-helpers';

type Row = Record<string, unknown>;

const HOUR = 3600_000;
const CATEGORIES: CategorySpec[] = [{ name: 'Standard', price: 3_000, total: 20 }];
const INVITE_ROUTE = '../../app/api/partner/team/invite/route';
const TEAM_ALL_ROUTE = '../../app/api/partner/team/all/route';
const ASSIGNMENTS_ROUTE = '../../app/api/partner/team/assignments/route';
const REMOVE_ROUTE = '../../app/api/partner/team/controller/[controllerId]/route';
const SETUP_ROUTE = '../../app/api/controller/setup/route';

let partner: TestPartner;
let evA: SaleEvent;
let evB: SaleEvent;
let appUrl: string;

before(async () => {
    partner = await newPartner('equipe-9bis');
    evA = await createTimedEvent(partner.partnerId, 'equipe-a', CATEGORIES, { startsInHours: 48 });
    evB = await createTimedEvent(partner.partnerId, 'equipe-b', CATEGORIES, { startsInHours: 72 });
    appUrl = String(process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/+$/, '');
    assert.ok(appUrl, 'NEXT_PUBLIC_APP_URL définie (.env.test)');
});

after(async () => {
    await assertLot9bisInvariants('cycle9bis-equipe');
});

// ── Outils locaux ──────────────────────────────────────────────────────────

async function invite(body: Row): Promise<RouteResult> {
    const handler = await routeHandler(INVITE_ROUTE, 'POST', 'POST /api/partner/team/invite');
    return invoke(handler, jsonRequest('/api/partner/team/invite', 'POST', partner.accessToken, body));
}

async function patchAssignments(body: Row): Promise<RouteResult> {
    const handler = await routeHandler(ASSIGNMENTS_ROUTE, 'PATCH', 'PATCH /api/partner/team/assignments');
    return invoke(handler, jsonRequest('/api/partner/team/assignments', 'PATCH', partner.accessToken, body));
}

async function teamMember(userId: string): Promise<Row> {
    const handler = await routeHandler(TEAM_ALL_ROUTE, 'GET', 'GET /api/partner/team/all');
    const res = await invoke(handler, jsonRequest('/api/partner/team/all', 'GET', partner.accessToken));
    assert.equal(res.status, 200, `équipe : ${show(res)}`);
    const m = ((res.body.members ?? []) as Row[]).find((x) => x.user_id === userId);
    assert.ok(m, `membre ${userId} dans l'équipe : ${show(res).slice(0, 400)}`);
    return m;
}

async function rolesOf(userId: string): Promise<string[]> {
    const { data, error } = await service.from('user_roles').select('role').eq('user_id', userId);
    assert.equal(error, null, `rôles : ${error?.message}`);
    return (data ?? []).map((r) => String(r.role)).sort();
}

async function cashByEvent(userId: string): Promise<Record<string, boolean>> {
    const { data, error } = await service.from('event_controllers').select('event_id, can_accept_cash').eq('user_id', userId);
    assert.equal(error, null, `affectations : ${error?.message}`);
    return Object.fromEntries((data ?? []).map((a) => [String(a.event_id), a.can_accept_cash === true]));
}

async function invitationsOf(userId: string): Promise<Row[]> {
    const { data, error } = await service.from('controller_invitations').select('*').eq('user_id', userId).order('created_at');
    assert.equal(error, null, `controller_invitations (migration 20261109000008_lot9bis_cycle, R37) : ${error?.message} (code ${error?.code})`);
    return (data ?? []) as Row[];
}

async function invitePhoneHits(phone: string): Promise<number> {
    const { data, error } = await service.from('quota_counters').select('hits').eq('scope', 'invite_phone').eq('bucket', phone);
    assert.equal(error, null, `quota_counters : ${error?.message}`);
    return (data ?? []).reduce((sum, r) => sum + Number(r.hits), 0);
}

function codesTo(phone: string, since: number): string[] {
    return getFakes().sms.messagesTo(phone).slice(since).map((m) => m.message.match(/\b(\d{6})\b/)?.[1]).filter((c): c is string => Boolean(c));
}

/** Compte temporaire créé par l'invitation (prénom saisi « Amadou », jamais activé) ; rend son identifiant. */
async function temporaryController(phone: string, eventId: string): Promise<string> {
    const res = await invite({ phone, event_ids: [eventId], first_name: 'Amadou', last_name: 'Ba' });
    assert.equal(res.status, 201, `compte temporaire créé par l'invitation : ${show(res)}`);
    const { data, error } = await service.from('users').select('id').eq('phone', phone).single();
    assert.equal(error, null, `compte du ${phone} : ${error?.message}`);
    return String(data.id);
}

// ── 1. R37 : consentement du titulaire ─────────────────────────────────────

describe('R37 — un client existant invité comme contrôleur doit accepter lui-même', () => {
    test('invitation confirmée par la partenaire : ni rôle ni affectation, invitation PENDING de 72 h, CONTROLLER_INVITATION par SMS', async () => {
        const client = await newBuyer('equipe-client', { firstName: 'Fatou', lastName: 'Cliente' });
        const res = await invite({ phone: client.phoneE164, event_ids: [evA.eventId], confirm_promotion: true });
        assert.ok(res.status === 200 || res.status === 201, show(res));
        assert.match(String(res.body.message ?? ''), /doit l[’']accepter dans l[’']application avant d[’']être affecté/, `réponse à la partenaire (contrat 4.3) : ${show(res)}`);
        assert.ok(!(await rolesOf(client.userId)).includes('CONTROLEUR'), 'aucun rôle CONTROLEUR avant l’acceptation (aujourd’hui posé tout de suite)');
        assert.deepEqual(await cashByEvent(client.userId), {}, 'aucune affectation avant l’acceptation');
        const invs = await invitationsOf(client.userId);
        assert.equal(invs.length, 1, `une invitation : ${JSON.stringify(invs)}`);
        assert.equal(invs[0].status, 'PENDING', JSON.stringify(invs[0]));
        const ttl = Date.parse(String(invs[0].expires_at)) - Date.parse(String(invs[0].created_at));
        assert.ok(Math.abs(ttl - 72 * HOUR) < 60_000, `expire 72 h après sa création (D15) : ${JSON.stringify(invs[0])}`);

        const sms = await outboxRows({ type: 'CONTROLLER_INVITATION', userId: client.userId, channel: 'SMS' });
        assert.equal(sms.length, 1, `un SMS CONTROLLER_INVITATION : ${JSON.stringify(sms.map((r) => r.status))}`);
        const mark = smsMark(client.phoneE164);
        await dispatchAt(new Date(), { ids: [sms[0].id] });
        const sent = smsTo(client.phoneE164, mark).map((m) => m.message);
        assert.equal(sent.length, 1, `SMS remis : ${JSON.stringify(sent)}`);
        assert.match(sent[0], /^Event Village : .+ vous invite à scanner les billets de .+\. Répondez sur /, `texte (11.1 N12) : ${sent[0]}`);
        assert.ok(sent[0].endsWith(`${appUrl}/invitations`), `lien vers /invitations : ${sent[0]}`);
        assert.ok(sent[0].length <= 160, `un segment GSM-7 : ${sent[0].length} caractères`);

        const list = await myControllerInvitations(client);
        assert.equal(list.status, 200, show(list));
        const item = ((list.body.items ?? []) as Row[])[0];
        assert.ok(item && typeof item.company === 'string' && Array.isArray(item.events), `liste du titulaire { id, company, events, expires_at } : ${show(list)}`);
        assert.deepEqual((item.events as Row[]).map((e) => e.id), [evA.eventId], 'événements de l’invitation');
    });

    test('acceptation par le titulaire : rôle CONTROLEUR, affectation, CONTROLLER_ASSIGNED gardé ; un tiers ne répond pas (404)', async () => {
        const client = await newBuyer('equipe-accepte', { firstName: 'Awa', lastName: 'Accepte' });
        const res = await invite({ phone: client.phoneE164, event_ids: [evA.eventId], confirm_promotion: true });
        assert.ok(res.status === 200 || res.status === 201, show(res));
        const [inv] = await invitationsOf(client.userId);
        assert.ok(inv, 'invitation créée');
        const stranger = await newBuyer('equipe-tiers');
        const foreign = await respondControllerInvitation(stranger, String(inv.id), true);
        assert.equal(foreign.status, 404, `un tiers ne répond pas à l’invitation d’autrui : ${show(foreign)}`);
        assert.equal((await invitationsOf(client.userId))[0].status, 'PENDING', 'invitation intacte après la tentative du tiers');

        await respondControllerInvitations(client, true);
        assert.ok((await rolesOf(client.userId)).includes('CONTROLEUR'), 'rôle CONTROLEUR après l’acceptation');
        assert.deepEqual(Object.keys(await cashByEvent(client.userId)), [evA.eventId], 'affectation après l’acceptation');
        assert.equal((await invitationsOf(client.userId))[0].status, 'ACCEPTED');
        const assigned = await outboxRows({ type: 'CONTROLLER_ASSIGNED', userId: client.userId, channel: 'SMS' });
        assert.equal(assigned.length, 1, 'CONTROLLER_ASSIGNED gardé à l’acceptation (D9)');
    });

    test('refus par le titulaire : DECLINED, ni rôle ni affectation', async () => {
        const client = await newBuyer('equipe-refuse', { firstName: 'Khady', lastName: 'Refuse' });
        const res = await invite({ phone: client.phoneE164, event_ids: [evA.eventId], confirm_promotion: true });
        assert.ok(res.status === 200 || res.status === 201, show(res));
        await respondControllerInvitations(client, false);
        assert.equal((await invitationsOf(client.userId))[0]?.status, 'DECLINED');
        assert.ok(!(await rolesOf(client.userId)).includes('CONTROLEUR'), 'aucun rôle');
        assert.deepEqual(await cashByEvent(client.userId), {}, 'aucune affectation');
    });
});

// ── 2. R38 : renvoi vers un compte activé ──────────────────────────────────

describe('R38 — « Renvoyer le SMS » vers un compte déjà activé', () => {
    test('409 ALREADY_ACTIVATED « Ce contrôleur a déjà activé son compte : aucun SMS n’est renvoyé. », avant le quota, aucun SMS', async () => {
        const ctrl = await newController(partner, evA.eventId, { label: 'equipe-active' });
        const hits = await invitePhoneHits(ctrl.phoneE164);
        const mark = smsMark(ctrl.phoneE164);
        const res = await invite({ phone: ctrl.phoneE164, event_ids: [evA.eventId], resend: true });
        assert.equal(res.status, 409, `renvoi vers un compte activé : 409 attendu (aujourd’hui 200 « prévenu … par SMS ») : ${show(res)}`);
        assert.equal(res.body.code, 'ALREADY_ACTIVATED', show(res));
        assert.equal(res.body.error, 'Ce contrôleur a déjà activé son compte : aucun SMS n’est renvoyé.', show(res));
        assert.equal(await invitePhoneHits(ctrl.phoneE164), hits, 'quota du numéro intact (refus avant le quota)');
        assert.equal(getFakes().sms.messagesTo(ctrl.phoneE164).length, mark, 'aucun SMS');
    });
});

// ── 3. R39 : état réel du compte ───────────────────────────────────────────

describe('R39 — état du compte lu dans auth.users, pas deviné au prénom', () => {
    test('compte temporaire au prénom « Amadou » → PENDING_ACTIVATION ; compte activé → ACTIVATED', async () => {
        const phone = randomSenegalPhone('76');
        const tempId = await temporaryController(phone, evA.eventId);
        const temp = await teamMember(tempId);
        assert.equal(temp.account_state, 'PENDING_ACTIVATION', `état réel du compte temporaire (aujourd’hui pending_activation ${JSON.stringify(temp.pending_activation)}) : ${JSON.stringify(temp)}`);
        const active = await newController(partner, evA.eventId, { label: 'equipe-etat' });
        assert.equal((await teamMember(active.userId)).account_state, 'ACTIVATED');
    });
});

// ── 4. R40 : retrait puis réinvitation d'un compte temporaire ──────────────

describe('R40 — compte temporaire retiré puis réinvité : un nouveau code, activation possible', () => {
    test('réinvitation → un code d’activation au numéro ; /api/controller/setup avec ce code → 200', async () => {
        const phone = randomSenegalPhone('76');
        const tempId = await temporaryController(phone, evA.eventId);
        const remove = await routeHandler(REMOVE_ROUTE, 'DELETE', 'DELETE /api/partner/team/controller/[controllerId]');
        const removed = await invoke(remove, jsonRequest(`/api/partner/team/controller/${tempId}`, 'DELETE', partner.accessToken), routeContext({ controllerId: tempId }));
        assert.equal(removed.status, 200, `retrait : ${show(removed)}`);

        const since = getFakes().sms.messagesTo(phone).length;
        let again = await invite({ phone, event_ids: [evA.eventId], first_name: 'Amadou', last_name: 'Ba' });
        if (again.body.requires_confirmation === true) again = await invite({ phone, event_ids: [evA.eventId], first_name: 'Amadou', last_name: 'Ba', confirm_promotion: true });
        assert.ok(again.status === 200 || again.status === 201, `réinvitation : ${show(again)}`);
        const codes = codesTo(phone, since);
        assert.equal(codes.length, 1, `un code d’activation à la réinvitation (aujourd’hui aucun : marque d’activation remise à false au retrait) : ${JSON.stringify(getFakes().sms.messagesTo(phone).slice(since).map((m) => m.message))}`);
        const setup = await routeHandler(SETUP_ROUTE, 'POST', 'POST /api/controller/setup');
        const res = await invoke(setup, publicRequest('/api/controller/setup', { phone, otp_code: codes[0], new_password: STRONG_PASSWORD }));
        assert.equal(res.status, 200, `activation avec le nouveau code : ${show(res)}`);
    });
});

// ── 5. R41 : droit d'encaisser par événement ───────────────────────────────

describe('R41 — droit d’encaisser réglé événement par événement', () => {
    async function twoAssignments(label: string): Promise<Buyer> {
        const ctrl = await newController(partner, evA.eventId, { canAcceptCash: true, label });
        await assignController(partner, ctrl.userId, evB.eventId, false);
        assert.deepEqual(await cashByEvent(ctrl.userId), { [evA.eventId]: true, [evB.eventId]: false }, 'précondition : A avec espèces, B sans');
        return ctrl;
    }

    test('can_accept_cash global → 400 INVALID_FIELD, rien ne change', async () => {
        const ctrl = await twoAssignments('cash-global');
        const res = await patchAssignments({ controller_id: ctrl.userId, event_ids: [evA.eventId, evB.eventId], can_accept_cash: true });
        assert.equal(res.status, 400, `booléen global refusé (aujourd’hui 200 et B reçoit les espèces) : ${show(res)}`);
        assert.equal(res.body.code, 'INVALID_FIELD', show(res));
        assert.deepEqual(await cashByEvent(ctrl.userId), { [evA.eventId]: true, [evB.eventId]: false }, 'droits inchangés');
    });

    test('« Gérer » sans champ d’espèces : A garde ses espèces (aujourd’hui remises à false sur toutes les affectations)', async () => {
        const ctrl = await twoAssignments('cash-absent');
        const res = await patchAssignments({ controller_id: ctrl.userId, event_ids: [evA.eventId, evB.eventId] });
        assert.ok(res.status < 500, show(res));
        assert.deepEqual(await cashByEvent(ctrl.userId), { [evA.eventId]: true, [evB.eventId]: false }, `droit d’encaisser de A conservé : ${show(res)}`);
    });

    test('assignments [{ A, false }, { B, true }] → 200, A sans espèces, B avec', async () => {
        const ctrl = await twoAssignments('cash-liste');
        const res = await patchAssignments({
            controller_id: ctrl.userId,
            assignments: [{ event_id: evA.eventId, can_accept_cash: false }, { event_id: evB.eventId, can_accept_cash: true }],
        });
        assert.equal(res.status, 200, show(res));
        assert.deepEqual(await cashByEvent(ctrl.userId), { [evA.eventId]: false, [evB.eventId]: true },
            `liste par événement respectée (aujourd’hui ignorée : event_ids vide, affectations retirées) : ${show(res)}`);
    });
});

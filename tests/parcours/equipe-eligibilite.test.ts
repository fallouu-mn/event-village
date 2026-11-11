/**
 * Lot 8, tâche 8.2 v — affectation d'un contrôleur selon le statut de l'événement. Cas portés de
 * tests/legacy/controller-event-status-hotfix.test.ts (tableau 12.1, ligne 10) et de
 * tests/legacy/security-fixes.test.ts (ligne 21, T2.3).
 * Routes : POST /api/partner/team/invite et PATCH /api/partner/team/assignments.
 *  1. T1, T2, T3, ANNULE, T5 (invitation) : BROUILLON, EN_ATTENTE, SUSPENDU, TERMINE, ANNULE → 400 avec
 *     INELIGIBLE_EVENT_ASSIGNMENT_ERROR ; aucun compte créé, aucune affectation, aucun SMS ;
 *  2. T4 : VALIDE et PUBLIE → 201, deux affectations (témoin) ;
 *  3. T7 : événement déjà affecté → 200, une seule ligne ;
 *  4. T5, T10 (PATCH) : mêmes statuts refusés, affectations existantes intactes, y compris celle que la liste
 *     demandée omet (le refus passe avant tout retrait) ;
 *  5. anti-contournement, forme { controllerId, eventId } : brouillon 400, événement d'un autre 403, publié 200 ;
 *  6. T12 : retrait d'une affectation sur un événement devenu SUSPENDU ou TERMINE → 200, seule l'affectation gardée
 *     reste ;
 *  7. security-fixes T2.3 : compte CLIENT par PATCH → requires_confirmation sans aucun effet, puis confirm_promotion
 *     → rôle CONTROLEUR, compte ACTIF, affectation créée. Lot 9 bis (R37, T49, règle changée) : confirm_promotion crée
 *     une invitation, le rôle et l'affectation suivent l'acceptation du titulaire (rouge jusqu'à fix(9b.26)).
 *
 *  8. T6 (invitation) : événement d'un autre partenaire → 403 « propriétaire », seul ou mêlé à un événement à soi ;
 *     aucun compte créé, aucune affectation, aucun SMS. Ajouté avant la suppression du legacy : T6 était annoncé couvert
 *     par pilotage-equipe-caisse:112, qui vise une autre route ; retirer ce contrôle ne faisait échouer aucun test.
 *
 * Non portés, déjà couverts : T11 (même code que T6 par la normalisation eventId vers event_ids, cas 5), T8 et T9 (scan,
 * acces-fenetre:116, dont le contrat a changé : 200 { result }).
 * Écarts au legacy : événements atteints par les RPC de transition ; ANNULE ajouté (même règle, jamais testé) ;
 * T1 à T3 visent un numéro neuf pour prouver qu'aucun compte n'est créé.
 *
 * Annoncée verte dès l'écriture (port, section 12.1) : tout rouge est une anomalie à instruire (8.3 d). Suite verte
 * à l'écriture : assertTerrainInvariants, pas assertRecetteInvariants (Conventions).
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { PATCH as assignmentsRoute } from '../../app/api/partner/team/assignments/route';
import { POST as inviteRoute } from '../../app/api/partner/team/invite/route';
import { INELIGIBLE_EVENT_ASSIGNMENT_ERROR } from '../../lib/events/event-status';
import { getFakes } from '../fakes';
import { randomSenegalPhone } from './helpers';
import { newBuyer, service, type CategorySpec, type SaleEvent } from './paiement-helpers';
import { newPartner, type TestPartner } from './finance-helpers';
import { assignController, authed, createTimedEvent, freshSession, newController, respondControllerInvitations, type RouteResult } from './acces-helpers';
import { advanceEventTo, createEventInStatus, type EventStatus } from './cycle-helpers';
import { assertTerrainInvariants } from './terrain-helpers';

type Row = Record<string, unknown>;

const INELIGIBLE: EventStatus[] = ['BROUILLON', 'EN_ATTENTE', 'SUSPENDU', 'TERMINE', 'ANNULE'];
const CATEGORIES: CategorySpec[] = [{ name: 'Standard', price: 5000, total: 20 }];

let partnerA: TestPartner;
let partnerB: TestPartner;
let evValide: SaleEvent;
let evPublie: SaleEvent;
let evB: SaleEvent;
const closed = {} as Record<EventStatus, SaleEvent>;

async function eventIn(status: EventStatus): Promise<SaleEvent> {
    if (status === 'TERMINE') return createTimedEvent(partnerA.partnerId, 'eligibilite-termine', CATEGORIES, { startsInHours: -3, durationHours: 2, status });
    return createEventInStatus(partnerA, `eligibilite-${status}`, CATEGORIES, status, { startsInHours: 72 });
}

before(async () => {
    partnerA = await newPartner('eligibilite-a');
    partnerB = await newPartner('eligibilite-b');
    evValide = await eventIn('VALIDE');
    evPublie = await eventIn('PUBLIE');
    evB = await createEventInStatus(partnerB, 'eligibilite-b', CATEGORIES, 'PUBLIE', { startsInHours: 72 });
    for (const status of INELIGIBLE) closed[status] = await eventIn(status);
});

after(async () => {
    await assertTerrainInvariants('equipe-eligibilite');
});

function show(r: RouteResult): string {
    return `HTTP ${r.status} ${JSON.stringify(r.body).slice(0, 400)}`;
}

async function invite(partner: TestPartner, body: Row): Promise<RouteResult> {
    const res = await inviteRoute(authed('/api/partner/team/invite', 'POST', partner, body));
    return { status: res.status, body: await res.json() as Row };
}

async function patchAssignments(partner: TestPartner, body: Row): Promise<RouteResult> {
    const res = await assignmentsRoute(authed('/api/partner/team/assignments', 'PATCH', partner, body));
    return { status: res.status, body: await res.json() as Row };
}

async function assignedEvents(userId: string): Promise<string[]> {
    const { data, error } = await service.from('event_controllers').select('event_id').eq('user_id', userId);
    assert.equal(error, null, `affectations de ${userId} : ${error?.message}`);
    return (data ?? []).map((a) => String(a.event_id)).sort();
}

async function accountsWithPhone(phone: string): Promise<Row[]> {
    const { data, error } = await service.from('users').select('id, role, status').in('phone', [phone, phone.replace('+', '')]);
    assert.equal(error, null, `comptes du ${phone} : ${error?.message}`);
    return (data ?? []) as Row[];
}

async function rolesOf(userId: string): Promise<string[]> {
    const { data, error } = await service.from('user_roles').select('role').eq('user_id', userId);
    assert.equal(error, null, `rôles de ${userId} : ${error?.message}`);
    return (data ?? []).map((r) => String(r.role)).sort();
}

async function accountOf(userId: string): Promise<{ role: unknown; status: unknown }> {
    const { data, error } = await service.from('users').select('role, status').eq('id', userId).single();
    assert.equal(error, null, `compte ${userId} : ${error?.message}`);
    return { role: data.role, status: data.status };
}

function assertIneligible(r: RouteResult, label: string): void {
    assert.equal(r.status, 400, `${label} : ${show(r)}`);
    assert.equal(r.body.error, INELIGIBLE_EVENT_ASSIGNMENT_ERROR, `${label} : message standard attendu, ${show(r)}`);
}

// ── Invitation ─────────────────────────────────────────────────────────────

describe('8.2 v — POST /api/partner/team/invite selon le statut de l’événement', () => {
    for (const status of INELIGIBLE) {
        test(`événement ${status} : 400, aucun compte créé, aucune affectation, aucun SMS`, async () => {
            const phone = randomSenegalPhone('76');
            const r = await invite(partnerA, { phone, event_ids: [closed[status].eventId], first_name: 'Amadou', last_name: 'Ba' });
            assertIneligible(r, `invitation sur un événement ${status}`);
            assert.deepEqual(await accountsWithPhone(phone), [], 'aucun compte créé pour ce numéro');
            assert.equal(getFakes().sms.messagesTo(phone).length, 0, 'aucun SMS envoyé à ce numéro');
            const { data, error } = await service.from('event_controllers').select('id').eq('event_id', closed[status].eventId);
            assert.equal(error, null, `affectations de l’événement : ${error?.message}`);
            assert.deepEqual(data ?? [], [], 'aucune affectation sur cet événement');
        });
    }

    test('T4 : VALIDE et PUBLIE → 201, deux affectations (témoin)', async () => {
        const phone = randomSenegalPhone('76');
        const r = await invite(partnerA, { phone, event_ids: [evValide.eventId, evPublie.eventId], first_name: 'Amadou', last_name: 'Ba' });
        assert.equal(r.status, 201, show(r));
        assert.equal(r.body.success, true, show(r));
        const accounts = await accountsWithPhone(phone);
        assert.equal(accounts.length, 1, 'un compte créé pour ce numéro');
        assert.deepEqual(await assignedEvents(String(accounts[0].id)), [evValide.eventId, evPublie.eventId].sort(), 'les deux événements sont affectés');
    });

    test('T6 : événement d’un autre partenaire → 403, aucun compte créé, aucune affectation, aucun SMS', async () => {
        const cases: Array<{ label: string; eventIds: string[] }> = [
            { label: 'seul', eventIds: [evB.eventId] },
            { label: 'mêlé à un événement à soi', eventIds: [evValide.eventId, evB.eventId] },
        ];
        for (const { label, eventIds } of cases) {
            const phone = randomSenegalPhone('76');
            const r = await invite(partnerA, { phone, event_ids: eventIds, first_name: 'Amadou', last_name: 'Ba' });
            assert.equal(r.status, 403, `${label} : ${show(r)}`);
            assert.match(String(r.body.error), /propriétaire/i, `${label} : ${show(r)}`);
            assert.deepEqual(await accountsWithPhone(phone), [], `${label} : aucun compte créé pour ce numéro`);
            assert.equal(getFakes().sms.messagesTo(phone).length, 0, `${label} : aucun SMS envoyé à ce numéro`);
        }
        const { data, error } = await service.from('event_controllers').select('id').eq('event_id', evB.eventId);
        assert.equal(error, null, `affectations de l’événement du partenaire B : ${error?.message}`);
        assert.deepEqual(data ?? [], [], 'aucune affectation sur l’événement du partenaire B');
    });

    test('T7 : événement déjà affecté → 200, aucune seconde ligne', async () => {
        const controller = await newController(partnerA, evValide.eventId, { label: 'idempotent' });
        const r = await invite(partnerA, { phone: controller.phoneE164, event_ids: [evValide.eventId] });
        assert.equal(r.status, 200, show(r));
        assert.equal(r.body.success, true, show(r));
        assert.equal(r.body.is_new_user, false, show(r));
        assert.deepEqual(await assignedEvents(controller.userId), [evValide.eventId], 'exactement une ligne pour ce couple');
    });
});

// ── Affectations ───────────────────────────────────────────────────────────

describe('8.2 v — PATCH /api/partner/team/assignments selon le statut de l’événement', () => {
    for (const status of INELIGIBLE) {
        test(`événement ${status} ajouté à la liste : 400, affectations intactes`, async () => {
            const controller = await newController(partnerA, evValide.eventId, { label: `patch-${status.toLowerCase()}` });
            await assignController(partnerA, controller.userId, evPublie.eventId, false);
            const kept = [evValide.eventId, evPublie.eventId].sort();
            assertIneligible(await patchAssignments(partnerA, { controller_id: controller.userId, event_ids: [...kept, closed[status].eventId] }), `liste complétée par ${status}`);
            assert.deepEqual(await assignedEvents(controller.userId), kept, 'liste complétée refusée : rien n’a changé');
            assertIneligible(await patchAssignments(partnerA, { controller_id: controller.userId, event_ids: [closed[status].eventId] }), `liste réduite à ${status}`);
            assert.deepEqual(await assignedEvents(controller.userId), kept, 'liste réduite refusée : aucune affectation retirée');
        });
    }

    test('anti-contournement { controllerId, eventId } : brouillon 400, événement d’un autre 403, publié 200', async () => {
        const controller = await newController(partnerA, null, { label: 'contournement' });
        assertIneligible(await patchAssignments(partnerA, { controllerId: controller.userId, eventId: closed.BROUILLON.eventId }), 'brouillon');
        const foreign = await patchAssignments(partnerA, { controllerId: controller.userId, eventId: evB.eventId });
        assert.equal(foreign.status, 403, `événement d’un autre partenaire : ${show(foreign)}`);
        assert.match(String(foreign.body.error), /propriétaire/i, show(foreign));
        assert.deepEqual(await assignedEvents(controller.userId), [], 'aucune affectation après les deux refus');
        const allowed = await patchAssignments(partnerA, { controllerId: controller.userId, eventId: evPublie.eventId });
        assert.equal(allowed.status, 200, `événement publié : ${show(allowed)}`);
        assert.equal(allowed.body.success, true, show(allowed));
        assert.deepEqual(await assignedEvents(controller.userId), [evPublie.eventId], 'événement publié affecté');
    });

    test('T12 : retrait d’affectations sur des événements devenus SUSPENDU et TERMINE → 200, seule l’affectation gardée reste', async () => {
        const controller = await newController(partnerA, evValide.eventId, { label: 'retrait-clos' });
        const toSuspend = await eventIn('PUBLIE');
        const toFinish = await createTimedEvent(partnerA.partnerId, 'eligibilite-fin', CATEGORIES, { startsInHours: -3, durationHours: 2 });
        await assignController(partnerA, controller.userId, toSuspend.eventId, false);
        await assignController(partnerA, controller.userId, toFinish.eventId, false);
        await advanceEventTo(toSuspend.eventId, 'SUSPENDU', { partnerUserId: partnerA.userId });
        await advanceEventTo(toFinish.eventId, 'TERMINE', { partnerUserId: partnerA.userId });

        const r = await patchAssignments(partnerA, { controller_id: controller.userId, event_ids: [evValide.eventId] });
        assert.equal(r.status, 200, show(r));
        assert.equal(r.body.success, true, show(r));
        assert.deepEqual([...(r.body.removed as string[])].sort(), [toSuspend.eventId, toFinish.eventId].sort(), `retraits annoncés : ${show(r)}`);
        assert.deepEqual(r.body.added, [], `aucun ajout : ${show(r)}`);
        assert.deepEqual(await assignedEvents(controller.userId), [evValide.eventId], 'seule l’affectation gardée reste');
    });

    test('security-fixes T2.3 : compte CLIENT → requires_confirmation sans aucun effet, puis confirm_promotion → rôle CONTROLEUR, ACTIF, affecté', async () => {
        const customer = await newBuyer('eligibilite-client', { firstName: 'Fatou', lastName: 'Cliente' });
        const asked = await patchAssignments(partnerA, { controller_id: customer.userId, event_ids: [evPublie.eventId] });
        assert.equal(asked.status, 200, show(asked));
        assert.equal(asked.body.requires_confirmation, true, show(asked));
        assert.equal(asked.body.code, 'EXISTING_ACCOUNT', show(asked));
        assert.ok(!JSON.stringify(asked.body).includes(customer.phoneE164), `le numéro du titulaire ne doit pas être renvoyé : ${show(asked)}`);
        assert.ok(!JSON.stringify(asked.body).includes(customer.email), `l’email du titulaire ne doit pas être renvoyé : ${show(asked)}`);
        assert.ok(!(await rolesOf(customer.userId)).includes('CONTROLEUR'), 'sans confirmation : aucun rôle CONTROLEUR');
        assert.equal((await accountOf(customer.userId)).role, 'CLIENT', 'sans confirmation : rôle inchangé');
        assert.deepEqual(await assignedEvents(customer.userId), [], 'sans confirmation : aucune affectation');

        const confirmed = await patchAssignments(partnerA, { controller_id: customer.userId, event_ids: [evPublie.eventId], confirm_promotion: true });
        assert.equal(confirmed.status, 200, show(confirmed));
        assert.equal(confirmed.body.success, true, show(confirmed));
        // Lot 9 bis (R37, T49, règle changée) : la confirmation de la partenaire crée une invitation ; rien avant l'acceptation du titulaire.
        assert.ok(!(await rolesOf(customer.userId)).includes('CONTROLEUR'), 'avec confirmation de la partenaire seule : aucun rôle CONTROLEUR (invitation en attente)');
        assert.deepEqual(await assignedEvents(customer.userId), [], 'avec confirmation de la partenaire seule : aucune affectation');
        await respondControllerInvitations(await freshSession(customer), true);
        assert.ok((await rolesOf(customer.userId)).includes('CONTROLEUR'), 'après l’acceptation du titulaire : rôle CONTROLEUR');
        assert.deepEqual(await accountOf(customer.userId), { role: 'CONTROLEUR', status: 'ACTIF' }, 'compte promu, toujours ACTIF');
        assert.deepEqual(await assignedEvents(customer.userId), [evPublie.eventId], 'après l’acceptation du titulaire : affecté');
    });
});

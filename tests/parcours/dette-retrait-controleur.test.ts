/**
 * Lot 5, tâche 5.0 — dette du lot 4, C3 et C5 : retrait d'un contrôleur sans faux succès. Contrat :
 * sections C3 et C5 de la conception du lot 5.
 *  C3. DELETE /api/partner/team/controller/[id] :
 *    - un admin doit fournir ?partnerId=, sinon 400 PARTNER_SCOPE_REQUIRED ; avec partnerId, retrait
 *      réel des affectations de ce partenaire ;
 *    - si rien n'est retiré (contrôleur hors de l'équipe de ce partenaire, partenaire B compris)
 *      → 404 CONTROLLER_NOT_IN_TEAM, sans SMS ni notification ;
 *    - la RPC atomic_partner_remove_controller refuse p_partner_id NULL.
 *  C5. DELETE /api/partner/team/[eventId]?assignmentId= : l'affectation doit appartenir à eventId,
 *    sinon 404 ASSIGNMENT_NOT_FOUND ; une affectation absente donne aussi 404 (plus de 200 « déjà
 *    retirée »).
 *
 * Rouge avant correctif :
 *  - app/api/partner/team/controller/[controllerId]/route.ts:45-57 : partnerId n'est résolu que pour un
 *    PARTENAIRE ; un admin appelle la RPC avec p_partner_id NULL (l.62-65), qui ne supprime rien
 *    (supabase/migrations/20260906000001_atomic_partner_remove_controller.sql:25-35, NULL > 0 faux) ;
 *    la route envoie quand même SMS et notification et répond 200 (l.115-162) ; ?partnerId= est ignoré ;
 *  - la RPC ne vérifie jamais l'appartenance à l'équipe de l'appelant : partenaire B → 200, SMS et
 *    notification « retiré » au contrôleur de A ; contrôleur inexistant → 200 ;
 *  - app/api/partner/team/[eventId]/route.ts:94 : eventId lu puis jamais utilisé ; l.104-108 : lecture
 *    par id seul, l.110-112 : 200 « Assignation déjà retirée. » si rien n'est trouvé ; l.122-125 :
 *    DELETE par id seul (l'affectation d'un autre événement est retirée).
 *
 * Interprétation retenue (contrat muet) : la RPC « refuse » p_partner_id NULL par une erreur levée ou
 * par une réponse { ok: false } ; dans les deux cas, rien n'est retiré.
 * La suite crée ses partenaires A et B, leurs événements, ses contrôleurs et son admin (sans profil
 * partenaire).
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { assertLifecycleInvariants } from '../helpers/lifecycle-invariants';
import { getFakes } from '../fakes';
import { routeContext } from './helpers';
import { importModule, newBuyer, service, type Buyer, type SaleEvent } from './paiement-helpers';
import { newPartner, type TestPartner } from './finance-helpers';
import { assignController, authed, createTimedEvent, newController, type RouteResult } from './acces-helpers';

const CONTROLLER_ROUTE = '../../app/api/partner/team/controller/[controllerId]/route';
const ASSIGNMENT_ROUTE = '../../app/api/partner/team/[eventId]/route';

let partnerA: TestPartner;
let partnerB: TestPartner;
let evA1: SaleEvent;
let evA2: SaleEvent;
let evB: SaleEvent;
let admin: Buyer;

before(async () => {
    partnerA = await newPartner('dette-retrait-a');
    partnerB = await newPartner('dette-retrait-b');
    evA1 = await createTimedEvent(partnerA.partnerId, 'retrait-a1', [{ name: 'Standard', price: 3000, total: 10 }], { startsInHours: 48 });
    evA2 = await createTimedEvent(partnerA.partnerId, 'retrait-a2', [{ name: 'Standard', price: 3000, total: 10 }], { startsInHours: 48 });
    evB = await createTimedEvent(partnerB.partnerId, 'retrait-b', [{ name: 'Standard', price: 3000, total: 10 }], { startsInHours: 48 });
    admin = await newBuyer('retrait-admin', { firstName: 'Aminata', lastName: 'Administratrice' });
    const { error } = await service.from('user_roles').upsert([{ user_id: admin.userId, role: 'ADMIN' }], { onConflict: 'user_id,role' });
    assert.equal(error, null, `rôle ADMIN : ${error?.message}`);
    const { data: own, error: ownErr } = await service.from('partners').select('id').eq('user_id', admin.userId);
    assert.equal(ownErr, null, `profil partenaire de l’admin : ${ownErr?.message}`);
    assert.deepEqual(own ?? [], [], 'précondition : l’admin n’a aucun profil partenaire');
});

after(async () => {
    await assertLifecycleInvariants('dette-retrait-controleur');
});

// ── Outils locaux ──────────────────────────────────────────────────────────

type Row = Record<string, unknown>;
type Handler = (req: NextRequest, ctx?: unknown) => Promise<Response>;

async function invoke(handler: Handler, req: NextRequest, ctx?: unknown): Promise<RouteResult> {
    const res = await handler(req, ctx);
    const text = await res.text();
    let body: Row = {};
    try {
        body = text ? JSON.parse(text) : {};
    } catch {
        body = { raw: text };
    }
    return { status: res.status, body };
}

function show(res: RouteResult): string {
    return `HTTP ${res.status} ${JSON.stringify(res.body)}`;
}

async function removeController(user: Buyer, controllerId: string, query = ''): Promise<RouteResult> {
    const { DELETE } = await importModule(CONTROLLER_ROUTE);
    return invoke(DELETE as Handler, authed(`/api/partner/team/controller/${controllerId}${query}`, 'DELETE', user), routeContext({ controllerId }));
}

async function removeAssignment(user: Buyer, eventId: string, assignmentId: string): Promise<RouteResult> {
    const { DELETE } = await importModule(ASSIGNMENT_ROUTE);
    return invoke(DELETE as Handler, authed(`/api/partner/team/${eventId}?assignmentId=${assignmentId}`, 'DELETE', user), routeContext({ eventId }));
}

async function assignmentsOf(userId: string): Promise<Array<{ id: string; event_id: string }>> {
    const { data, error } = await service.from('event_controllers').select('id, event_id').eq('user_id', userId);
    assert.equal(error, null, `affectations de ${userId} : ${error?.message}`);
    return ((data ?? []) as Array<{ id: string; event_id: string }>).sort((a, b) => a.id.localeCompare(b.id));
}

async function assignmentId(userId: string, eventId: string): Promise<string> {
    const row = (await assignmentsOf(userId)).find((a) => a.event_id === eventId);
    assert.ok(row, `affectation de ${userId} à ${eventId} attendue`);
    return row.id;
}

async function rolesOf(userId: string): Promise<string[]> {
    const { data, error } = await service.from('user_roles').select('role').eq('user_id', userId);
    assert.equal(error, null, `rôles de ${userId} : ${error?.message}`);
    return (data ?? []).map((r) => String(r.role)).sort();
}

async function notificationIds(userId: string): Promise<string[]> {
    const { data, error } = await service.from('notifications').select('id').eq('user_id', userId);
    assert.equal(error, null, `notifications de ${userId} : ${error?.message}`);
    return (data ?? []).map((n) => String(n.id)).sort();
}

interface Trace { assignments: Array<{ id: string; event_id: string }>; roles: string[]; sms: number; notifications: string[] }

async function trace(ctrl: Buyer): Promise<Trace> {
    return {
        assignments: await assignmentsOf(ctrl.userId),
        roles: await rolesOf(ctrl.userId),
        sms: getFakes().sms.messagesTo(ctrl.phoneE164).length,
        notifications: await notificationIds(ctrl.userId),
    };
}

/** Refus sans aucun effet : affectations, rôles, SMS et notifications du contrôleur inchangés. */
async function assertUntouched(ctrl: Buyer, before: Trace, label: string): Promise<void> {
    const now = await trace(ctrl);
    assert.deepEqual(now.assignments, before.assignments, `${label} : affectations intactes`);
    assert.deepEqual(now.roles, before.roles, `${label} : rôles intacts`);
    assert.equal(now.sms, before.sms, `${label} : aucun SMS envoyé au contrôleur`);
    assert.deepEqual(now.notifications, before.notifications, `${label} : aucune notification au contrôleur`);
}

// ── C3 ─────────────────────────────────────────────────────────────────────

describe('C3 — retrait d’un contrôleur : retrait réel ou refus explicite', () => {
    test('admin sans ?partnerId= → 400 PARTNER_SCOPE_REQUIRED ; rien retiré, ni SMS ni notification', async () => {
        const ctrl = await newController(partnerA, evA1.eventId, { label: 'ret-admin-sans' });
        const before = await trace(ctrl);
        const res = await removeController(admin, ctrl.userId);
        assert.equal(res.status, 400, `admin sans partnerId : ${show(res)}`);
        assert.equal(res.body.code, 'PARTNER_SCOPE_REQUIRED', `code PARTNER_SCOPE_REQUIRED : ${show(res)}`);
        await assertUntouched(ctrl, before, 'admin sans partnerId');
    });

    test('admin avec ?partnerId=A → retrait réel des affectations de A seulement (celle de B reste)', async () => {
        const ctrl = await newController(partnerA, evA1.eventId, { label: 'ret-admin-avec' });
        await assignController(partnerA, ctrl.userId, evA2.eventId, false);
        await assignController(partnerB, ctrl.userId, evB.eventId, false);
        assert.equal((await assignmentsOf(ctrl.userId)).length, 3, 'précondition : trois affectations (A1, A2, B)');
        const res = await removeController(admin, ctrl.userId, `?partnerId=${partnerA.partnerId}`);
        assert.equal(res.status, 200, `admin avec partnerId : ${show(res)}`);
        const left = await assignmentsOf(ctrl.userId);
        assert.deepEqual(left.map((a) => a.event_id), [evB.eventId], `seule l’affectation chez B reste : ${JSON.stringify(left)}`);
        assert.ok((await rolesOf(ctrl.userId)).includes('CONTROLEUR'), 'rôle CONTROLEUR conservé (encore affecté chez B)');
    });

    test('partenaire B qui vise le contrôleur de A → 404 CONTROLLER_NOT_IN_TEAM ; rien retiré, ni SMS ni notification', async () => {
        const ctrl = await newController(partnerA, evA1.eventId, { label: 'ret-par-b' });
        const before = await trace(ctrl);
        const res = await removeController(partnerB, ctrl.userId);
        assert.equal(res.status, 404, `partenaire B sur le contrôleur de A : ${show(res)}`);
        assert.equal(res.body.code, 'CONTROLLER_NOT_IN_TEAM', `code CONTROLLER_NOT_IN_TEAM : ${show(res)}`);
        await assertUntouched(ctrl, before, 'partenaire B');
    });

    test('contrôleur inexistant → 404 CONTROLLER_NOT_IN_TEAM (plus de 200)', async () => {
        const res = await removeController(partnerA, randomUUID());
        assert.equal(res.status, 404, `contrôleur inexistant : ${show(res)}`);
        assert.equal(res.body.code, 'CONTROLLER_NOT_IN_TEAM', `code CONTROLLER_NOT_IN_TEAM : ${show(res)}`);
    });

    test('RPC atomic_partner_remove_controller : p_partner_id NULL refusé, rien retiré', async () => {
        const ctrl = await newController(partnerA, evA1.eventId, { label: 'ret-rpc-null' });
        const before = await trace(ctrl);
        const { data, error } = await service.rpc('atomic_partner_remove_controller', { p_partner_id: null, p_controller_id: ctrl.userId });
        const refused = error !== null || (data as Row | null)?.ok === false;
        assert.ok(refused, `p_partner_id NULL accepté : ${JSON.stringify(data)}`);
        const now = await trace(ctrl);
        assert.deepEqual(now.assignments, before.assignments, 'affectations intactes');
        assert.deepEqual(now.roles, before.roles, 'rôles intacts');
    });

    test('garde-fou : le partenaire A retire son contrôleur → 200, affectations de A supprimées', async () => {
        const ctrl = await newController(partnerA, evA1.eventId, { label: 'ret-par-a' });
        await assignController(partnerA, ctrl.userId, evA2.eventId, false);
        const res = await removeController(partnerA, ctrl.userId);
        assert.equal(res.status, 200, `retrait par le partenaire propriétaire : ${show(res)}`);
        assert.deepEqual(await assignmentsOf(ctrl.userId), [], 'plus aucune affectation');
    });
});

// ── C5 ─────────────────────────────────────────────────────────────────────

describe('C5 — DELETE /api/partner/team/[eventId] : l’affectation doit appartenir à l’événement de l’URL', () => {
    test('affectation de A2 appelée sous l’URL de A1 (même propriétaire) → 404 ASSIGNMENT_NOT_FOUND, affectation intacte', async () => {
        const ctrl = await newController(partnerA, evA1.eventId, { label: 'aff-croisee' });
        await assignController(partnerA, ctrl.userId, evA2.eventId, false);
        const onA2 = await assignmentId(ctrl.userId, evA2.eventId);
        const before = await trace(ctrl);
        const res = await removeAssignment(partnerA, evA1.eventId, onA2);
        assert.equal(res.status, 404, `affectation d’un autre événement : ${show(res)}`);
        assert.equal(res.body.code, 'ASSIGNMENT_NOT_FOUND', `code ASSIGNMENT_NOT_FOUND : ${show(res)}`);
        await assertUntouched(ctrl, before, 'affectation d’un autre événement');
    });

    test('affectation absente → 404 (plus de 200 « déjà retirée »)', async () => {
        const res = await removeAssignment(partnerA, evA1.eventId, randomUUID());
        assert.equal(res.status, 404, `affectation absente : ${show(res)}`);
        assert.equal(res.body.code, 'ASSIGNMENT_NOT_FOUND', `code ASSIGNMENT_NOT_FOUND : ${show(res)}`);
    });

    test('garde-fou : bonne URL → 200, affectation retirée, l’autre affectation reste', async () => {
        const ctrl = await newController(partnerA, evA1.eventId, { label: 'aff-bonne' });
        await assignController(partnerA, ctrl.userId, evA2.eventId, false);
        const onA2 = await assignmentId(ctrl.userId, evA2.eventId);
        const res = await removeAssignment(partnerA, evA2.eventId, onA2);
        assert.equal(res.status, 200, `retrait de l’affectation : ${show(res)}`);
        assert.deepEqual((await assignmentsOf(ctrl.userId)).map((a) => a.event_id), [evA1.eventId], 'seule l’affectation à A1 reste');
    });
});

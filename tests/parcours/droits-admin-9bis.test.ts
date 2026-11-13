/**
 * Lot 9 bis, tâche 11 (R71 ; contrat 5.11, B33, 4.2) — seul le SUPERADMIN crée ou promeut un admin : l'ajout ET le
 * retrait du rôle ADMIN, et la suspension d'un compte ADMIN, sont réservés au SUPERADMIN (403
 * ADMIN_ROLE_SUPERADMIN_ONLY « Seul un superadmin peut créer un administrateur ou changer ce rôle. », contrôlé AVANT
 * toute création de compte GoTrue). Même règle en base dans user_roles_set (acteur en paramètre).
 *
 * Acteurs : un ADMIN muni de users.write (la permission de la route), un SUPERADMIN. Cibles : comptes neufs.
 *
 * Rouge avant correctif (fix(9b.11)) : POST /api/admin/users ne refuse que la cible SUPERADMIN, en lisant le rôle
 * hérité users.role (app/api/admin/users/route.ts:121) ; PATCH et user_roles_set n'interdisent que SUPERADMIN
 * (M/20261102000002:449-451) ; la suspension d'un ADMIN par un ADMIN passe (route.ts:300-302) : 200 partout.
 * Verts dès l'écriture (témoins, signalés) : le SUPERADMIN crée, promeut, rétrograde et suspend ; l'ADMIN users.write
 * donne toujours le rôle CONTROLEUR. Leur garde-fou : les cas rouges du même fichier.
 * Fin de suite : assertLot9bisInvariants.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { assertLot9bisInvariants } from '../helpers/lot9bis-invariants';
import { randomEmail, randomSenegalPhone } from './helpers';
import { newBuyer, service, type Buyer } from './paiement-helpers';
import { jsonRequest } from './finance-helpers';
import type { RouteResult } from './acces-helpers';
import { invoke, routeHandler, show } from './pilotage-helpers';
import { newAdminWith } from './terrain-helpers';
import type { TestAdmin } from './notif-helpers';

after(async () => {
    await assertLot9bisInvariants('droits-admin-9bis');
});

const ROUTE = '../../app/api/admin/users/route';
const ONLY_SUPER = 'Seul un superadmin peut créer un administrateur ou changer ce rôle.';
const REASON = 'Test lot 9 bis : rôle administrateur réservé au superadmin';

let writer: TestAdmin;
let superadmin: TestAdmin;

before(async () => {
    writer = await newAdminWith(['users.read', 'users.write'], { label: 'r71-ecrit' });
    superadmin = await newAdminWith([], { role: 'SUPERADMIN', label: 'r71-super' });
});

function sameQuotes(v: unknown): string {
    return String(v ?? '').replace(/’/g, '\'');
}

async function postUser(token: string, body: Record<string, unknown>): Promise<RouteResult> {
    return invoke(await routeHandler(ROUTE, 'POST', 'POST /api/admin/users'), jsonRequest('/api/admin/users', 'POST', token, body));
}

async function patchUser(token: string, body: Record<string, unknown>): Promise<RouteResult> {
    return invoke(await routeHandler(ROUTE, 'PATCH', 'PATCH /api/admin/users'), jsonRequest('/api/admin/users', 'PATCH', token, body));
}

async function rolesOf(userId: string): Promise<string[]> {
    const { data, error } = await service.from('user_roles').select('role').eq('user_id', userId);
    assert.equal(error, null, `rôles : ${error?.message}`);
    return (data ?? []).map((r) => String(r.role)).sort();
}

async function statusOf(userId: string): Promise<string> {
    const { data, error } = await service.from('users').select('status').eq('id', userId).single();
    assert.equal(error, null, `statut : ${error?.message}`);
    return String(data.status);
}

async function accountsFor(phone: string, email: string): Promise<number> {
    const byPhone = await service.from('users').select('id', { count: 'exact', head: true }).in('phone', [phone, phone.replace(/^\+/, '')]);
    assert.equal(byPhone.error, null, `comptes par numéro : ${byPhone.error?.message}`);
    const byEmail = await service.from('users').select('id', { count: 'exact', head: true }).eq('email', email);
    assert.equal(byEmail.error, null, `comptes par email : ${byEmail.error?.message}`);
    return (byPhone.count ?? 0) + (byEmail.count ?? 0);
}

function newUserBody(role: string): Record<string, unknown> {
    // Lot 9 quinquies (A2, modification signalée) : plus de mot de passe saisi par l'admin (lien d'activation par SMS)
    return { firstName: 'Mame', lastName: 'Diarra', phone: randomSenegalPhone('76'), email: randomEmail('r71'), role };
}

function assertSuperOnly(res: RouteResult, what: string): void {
    assert.equal(res.status, 403, `R71 : ${what} → 403 attendu, ${show(res)}`);
    assert.equal(res.body.code, 'ADMIN_ROLE_SUPERADMIN_ONLY', `${what} : code du refus, ${show(res)}`);
    assert.equal(sameQuotes(res.body.error), sameQuotes(ONLY_SUPER), `${what} : texte du refus (contrat 4.2), ${show(res)}`);
}

async function anotherAdmin(label: string): Promise<TestAdmin> {
    return newAdminWith(['events.read'], { label });
}

describe('R71 — POST /api/admin/users : créer un administrateur', () => {
    test('ADMIN users.write crée un compte ADMIN → 403 ADMIN_ROLE_SUPERADMIN_ONLY, aucun compte GoTrue ni profil créé', async () => {
        const body = newUserBody('ADMIN');
        const res = await postUser(writer.accessToken, body);
        if (res.status === 200 && typeof res.body.userId === 'string') {
            assert.fail(`R71 : un ADMIN a créé un administrateur (compte ${res.body.userId}, rôles ${JSON.stringify(await rolesOf(res.body.userId))}) : ${show(res)}`);
        }
        assertSuperOnly(res, 'création d’un ADMIN par un ADMIN');
        assert.equal(await accountsFor(String(body.phone), String(body.email)), 0, 'refus avant createUser : aucun compte');
    });

    test('ADMIN users.write crée un compte SUPERADMIN → 403, aucun compte (règle existante, même refus)', async () => {
        const body = newUserBody('SUPERADMIN');
        const res = await postUser(writer.accessToken, body);
        assert.equal(res.status, 403, `création d’un SUPERADMIN par un ADMIN : ${show(res)}`);
        assert.equal(await accountsFor(String(body.phone), String(body.email)), 0, 'aucun compte');
    });

    test('témoin (vert dès l’écriture) : le SUPERADMIN crée un ADMIN → 200, rôle ADMIN dans user_roles', async () => {
        const res = await postUser(superadmin.accessToken, newUserBody('ADMIN'));
        assert.equal(res.status, 200, `création d’un ADMIN par le SUPERADMIN : ${show(res)}`);
        assert.ok((await rolesOf(String(res.body.userId))).includes('ADMIN'), 'rôle ADMIN posé');
    });
});

describe('R71 — PATCH /api/admin/users : promouvoir, rétrograder, suspendre un administrateur', () => {
    test('ADMIN users.write promeut un client ADMIN → 403 ADMIN_ROLE_SUPERADMIN_ONLY, rôles inchangés', async () => {
        const target = await newBuyer('r71-promu');
        const before = await rolesOf(target.userId);
        const res = await patchUser(writer.accessToken, { userId: target.userId, roles: ['CLIENT', 'ADMIN'] });
        assertSuperOnly(res, 'promotion ADMIN par un ADMIN');
        assert.deepEqual(await rolesOf(target.userId), before, 'rôles inchangés');
    });

    test('ADMIN users.write retire le rôle ADMIN à un autre admin → 403, rôles inchangés', async () => {
        const target = await anotherAdmin('r71-retrait');
        const before = await rolesOf(target.userId);
        assert.ok(before.includes('ADMIN'), 'précondition : la cible est ADMIN');
        const res = await patchUser(writer.accessToken, { userId: target.userId, roles: ['CLIENT'] });
        assertSuperOnly(res, 'retrait du rôle ADMIN par un ADMIN');
        assert.deepEqual(await rolesOf(target.userId), before, 'rôles inchangés');
    });

    test('ADMIN users.write suspend un compte ADMIN → 403 ADMIN_ROLE_SUPERADMIN_ONLY, statut inchangé (B33)', async () => {
        const target = await anotherAdmin('r71-suspendu');
        const res = await patchUser(writer.accessToken, { userId: target.userId, status: 'SUSPENDU', reason: REASON });
        assertSuperOnly(res, 'suspension d’un ADMIN par un ADMIN');
        assert.equal(await statusOf(target.userId), 'ACTIF', 'compte toujours ACTIF');
    });

    test('témoin (vert dès l’écriture) : ADMIN users.write donne le rôle CONTROLEUR à un client → 200', async () => {
        const target: Buyer = await newBuyer('r71-controleur');
        const res = await patchUser(writer.accessToken, { userId: target.userId, roles: ['CLIENT', 'CONTROLEUR'] });
        assert.equal(res.status, 200, `rôle CONTROLEUR par un ADMIN users.write : ${show(res)}`);
        assert.deepEqual(await rolesOf(target.userId), ['CLIENT', 'CONTROLEUR']);
    });

    test('témoin (vert dès l’écriture) : le SUPERADMIN promeut, rétrograde et suspend un ADMIN → 200', async () => {
        const target = await newBuyer('r71-super-cible');
        const up = await patchUser(superadmin.accessToken, { userId: target.userId, roles: ['CLIENT', 'ADMIN'] });
        assert.equal(up.status, 200, `promotion par le SUPERADMIN : ${show(up)}`);
        assert.ok((await rolesOf(target.userId)).includes('ADMIN'), 'ADMIN ajouté');
        const susp = await patchUser(superadmin.accessToken, { userId: target.userId, status: 'SUSPENDU', reason: REASON });
        assert.equal(susp.status, 200, `suspension d’un ADMIN par le SUPERADMIN : ${show(susp)}`);
        assert.equal(await statusOf(target.userId), 'SUSPENDU');
        const back = await patchUser(superadmin.accessToken, { userId: target.userId, status: 'ACTIF', reason: REASON });
        assert.equal(back.status, 200, `réactivation par le SUPERADMIN : ${show(back)}`);
        const down = await patchUser(superadmin.accessToken, { userId: target.userId, roles: ['CLIENT'] });
        assert.equal(down.status, 200, `rétrogradation par le SUPERADMIN : ${show(down)}`);
        assert.deepEqual(await rolesOf(target.userId), ['CLIENT'], 'ADMIN retiré');
    });
});

describe('R71 — user_roles_set en direct (acteur en paramètre)', () => {
    async function rolesSet(userId: string, actorId: string, roles: string[]): Promise<Record<string, unknown>> {
        const { data, error } = await service.rpc('user_roles_set', { p: { user_id: userId, actor_id: actorId, roles } });
        assert.equal(error, null, `user_roles_set : ${error?.message}`);
        return data as Record<string, unknown>;
    }

    test('acteur ADMIN : ajout du rôle ADMIN → ADMIN_ROLE_SUPERADMIN_ONLY, retrait → même refus ; rôles inchangés', async () => {
        const client = await newBuyer('r71-rpc-client');
        const add = await rolesSet(client.userId, writer.userId, ['CLIENT', 'ADMIN']);
        assert.equal(add.ok, false, `R71 : ajout du rôle ADMIN par un ADMIN en base : ${JSON.stringify(add)}`);
        assert.equal(add.code, 'ADMIN_ROLE_SUPERADMIN_ONLY', JSON.stringify(add));
        assert.deepEqual(await rolesOf(client.userId), ['CLIENT'], 'rôles inchangés');

        const admin = await anotherAdmin('r71-rpc-admin');
        const before = await rolesOf(admin.userId);
        const remove = await rolesSet(admin.userId, writer.userId, ['CLIENT']);
        assert.equal(remove.ok, false, `R71 : retrait du rôle ADMIN par un ADMIN en base : ${JSON.stringify(remove)}`);
        assert.equal(remove.code, 'ADMIN_ROLE_SUPERADMIN_ONLY', JSON.stringify(remove));
        assert.deepEqual(await rolesOf(admin.userId), before, 'rôles inchangés');
    });

    test('témoin (vert dès l’écriture) : acteur SUPERADMIN → ajout puis retrait du rôle ADMIN acceptés', async () => {
        const client = await newBuyer('r71-rpc-super');
        const add = await rolesSet(client.userId, superadmin.userId, ['CLIENT', 'ADMIN']);
        assert.equal(add.ok, true, JSON.stringify(add));
        const remove = await rolesSet(client.userId, superadmin.userId, ['CLIENT']);
        assert.equal(remove.ok, true, JSON.stringify(remove));
        assert.deepEqual(await rolesOf(client.userId), ['CLIENT']);
    });
});

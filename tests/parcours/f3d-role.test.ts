/**
 * Finition 3d (recours et suppléance) — point 3, changer le rôle d'un compte (SUPERADMIN seulement).
 *
 * POST /api/admin/users/[id]/role { role: CLIENT | ADMIN | SUPERADMIN, reason, confirm_staff_promotion? } :
 *  - client → ADMIN, ADMIN → client, ADMIN → SUPERADMIN, SUPERADMIN → ADMIN ; rien d'autre (deux temps) ;
 *  - SUPERADMIN seulement ; mot de passe et code administrateur saisis depuis moins de 10 minutes (contrôlés par la route
 *    et revérifiés en base) ; motif obligatoire ; journal ADMIN_ROLE_CHANGED (motif) ;
 *  - contrôleur promu : la confirmation de la finition 1 (retrait des équipes) d'abord, rien ne change avant l'accord ;
 *  - retrait d'un rôle d'administration : droits effacés, sessions révoquées ;
 *  - promotion en SUPERADMIN : alerte (SMS et cloche) à chaque SUPERADMIN actif ;
 *  - jamais le dernier SUPERADMIN actif retiré ;
 *  - plus aucun autre chemin pour donner ou retirer ADMIN ou SUPERADMIN : PATCH /api/admin/users refuse (409
 *    ROLE_SCREEN_REQUIRED), la création d'un compte SUPERADMIN aussi, et la base refuse le rôle SUPERADMIN hors de
 *    admin_role_change.
 * Fin de suite : assertFinition3dInvariants.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { inRolledBackTransaction, inspect, writeLocal } from '../helpers/db';
import { assertFinition3dInvariants } from '../helpers/finition3d-invariants';
import { newPartner } from './finance-helpers';
import { newAdmin, type TestAdmin } from './notif-helpers';
import { newBuyer, service, type Buyer } from './paiement-helpers';
import { createTimedEvent, newController } from './acces-helpers';
import { callRoute, confirmIdentity, show } from './f3d-helpers';
import { randomEmail, randomSenegalPhone } from './helpers';

const ROLE_ROUTE = '../../app/api/admin/users/[id]/role/route';
let boss: TestAdmin;

function sessionIdOf(token: string): string {
    return String((JSON.parse(Buffer.from(token.split('.')[1] ?? '', 'base64url').toString('utf8')) as { session_id?: string }).session_id);
}

async function changeRole(actor: Buyer, targetId: string, body: Record<string, unknown>) {
    return callRoute(ROLE_ROUTE, 'POST', `/api/admin/users/${targetId}/role`, actor.accessToken, body, { id: targetId });
}

async function rolesOf(userId: string): Promise<string[]> {
    const { data, error } = await service.from('user_roles').select('role').eq('user_id', userId);
    assert.equal(error, null, error?.message);
    return (data ?? []).map((r) => String(r.role)).sort();
}

async function sessionsOf(userId: string): Promise<number> {
    return inspect(async (c) => Number((await c.query(`SELECT count(*)::int AS n FROM auth.sessions WHERE user_id = $1`, [userId])).rows[0].n));
}

before(async () => {
    boss = await newAdmin('f3d-role-boss', [], { role: 'SUPERADMIN' });
    await confirmIdentity(boss);
});

after(async () => {
    await assertFinition3dInvariants('f3d-role');
});

describe('3. changer le rôle : qui peut, et avec quelles preuves', () => {
    test('un ADMIN, même muni de users.write : 403 SUPERADMIN_ONLY', async () => {
        const admin = await newAdmin('f3d-role-admin', ['users.read', 'users.write']);
        const target = await newBuyer('f3d-role-cible-a');
        const r = await changeRole(admin, target.userId, { role: 'ADMIN', reason: 'Renfort pour la saison' });
        assert.deepEqual([r.status, r.body.code], [403, 'SUPERADMIN_ONLY'], show(r));
        assert.deepEqual(await rolesOf(target.userId), ['CLIENT']);
    });

    test('SUPERADMIN sans mot de passe récent : 403 PASSWORD_CONFIRMATION_REQUIRED ; puis sans code récent : 403 ADMIN_CODE_CONFIRMATION_REQUIRED', async () => {
        const other = await newAdmin('f3d-role-boss-b', [], { role: 'SUPERADMIN' });
        const target = await newBuyer('f3d-role-cible-b');
        const r1 = await changeRole(other, target.userId, { role: 'ADMIN', reason: 'Renfort pour la saison' });
        assert.deepEqual([r1.status, r1.body.code], [403, 'PASSWORD_CONFIRMATION_REQUIRED'], show(r1));
        await confirmIdentity(other);
        await writeLocal((c) => c.query(`UPDATE public.admin_devices SET sms_verified_at = now() - interval '11 minutes' WHERE user_id = $1`, [other.userId]));
        const r2 = await changeRole(other, target.userId, { role: 'ADMIN', reason: 'Renfort pour la saison' });
        assert.deepEqual([r2.status, r2.body.code], [403, 'ADMIN_CODE_CONFIRMATION_REQUIRED'], show(r2));
        assert.deepEqual(await rolesOf(target.userId), ['CLIENT']);
    });

    test('motif absent : 400 REASON_REQUIRED', async () => {
        const target = await newBuyer('f3d-role-cible-c');
        const r = await changeRole(boss, target.userId, { role: 'ADMIN', reason: '  ' });
        assert.deepEqual([r.status, r.body.code], [400, 'REASON_REQUIRED'], show(r));
    });
});

describe('3. les quatre changements permis, et ce qu’ils font vraiment', () => {
    let promoted: Buyer;

    test('client → ADMIN : rôle donné, aucun droit, journal avec le motif ; la réponse dit le rôle obtenu', async () => {
        promoted = await newBuyer('f3d-role-promu');
        const r = await changeRole(boss, promoted.userId, { role: 'ADMIN', reason: 'Renfort pour la saison' });
        assert.equal(r.status, 200, show(r));
        assert.deepEqual([r.body.role_before, r.body.role_after], ['CLIENT', 'ADMIN']);
        assert.deepEqual(await rolesOf(promoted.userId), ['ADMIN', 'CLIENT']);
        const { data: perms } = await service.from('admin_permissions').select('permission').eq('user_id', promoted.userId);
        assert.deepEqual(perms ?? [], [], 'un nouvel administrateur n’a aucun droit');
        const { data: audits } = await service.from('audit_logs').select('user_id, metadata').eq('action', 'ADMIN_ROLE_CHANGED').eq('object_id', promoted.userId);
        assert.equal((audits ?? []).length, 1);
        assert.deepEqual([audits![0].user_id, (audits![0].metadata as Record<string, unknown>).reason], [boss.userId, 'Renfort pour la saison']);
    });

    test('ADMIN → SUPERADMIN : alerte à chaque SUPERADMIN actif (l’auteur compris), jamais au compte promu', async () => {
        const r = await changeRole(boss, promoted.userId, { role: 'SUPERADMIN', reason: 'Seconde personne de confiance' });
        assert.equal(r.status, 200, show(r));
        assert.deepEqual(await rolesOf(promoted.userId), ['CLIENT', 'SUPERADMIN']);
        const { data: alerts } = await service.from('notification_outbox').select('recipient_user_id, channel').eq('type', 'SUPERADMIN_PROMOTED')
            .like('group_key', `SUPERADMIN_PROMOTED:${promoted.userId}:%`);
        const recipients = new Set((alerts ?? []).map((a) => String(a.recipient_user_id)));
        assert.ok(recipients.has(boss.userId), 'l’auteur doit recevoir l’alerte');
        assert.ok(!recipients.has(promoted.userId), 'le compte promu ne reçoit pas l’alerte');
        const { count } = await service.from('user_roles').select('user_id', { count: 'exact', head: true }).eq('role', 'SUPERADMIN');
        assert.ok(recipients.size >= 1 && recipients.size <= Number(count), `destinataires : ${recipients.size}`);
        assert.ok((alerts ?? []).some((a) => a.channel === 'SMS'), 'alerte SMS absente');
    });

    test('SUPERADMIN → ADMIN (un autre SUPERADMIN reste) : rôle retiré, aucun droit, sessions révoquées', async () => {
        const r = await changeRole(boss, promoted.userId, { role: 'ADMIN', reason: 'Fin de la mission' });
        assert.equal(r.status, 200, show(r));
        assert.deepEqual(await rolesOf(promoted.userId), ['ADMIN', 'CLIENT']);
        assert.equal(await sessionsOf(promoted.userId), 0, 'sessions du compte retiré non révoquées');
    });

    test('ADMIN → client : rôle et droits retirés, sessions révoquées', async () => {
        const admin = await newAdmin('f3d-role-retire', ['events.read', 'events.write']);
        const r = await changeRole(boss, admin.userId, { role: 'CLIENT', reason: 'Départ de l’équipe' });
        assert.equal(r.status, 200, show(r));
        assert.deepEqual(await rolesOf(admin.userId), ['CLIENT']);
        const { data: perms } = await service.from('admin_permissions').select('permission').eq('user_id', admin.userId);
        assert.deepEqual(perms ?? [], []);
        assert.equal(await sessionsOf(admin.userId), 0);
    });
});

describe('3. refus : changements interdits, dernier SUPERADMIN, organisatrice', () => {
    test('client → SUPERADMIN d’un coup : 409 TRANSITION_NOT_ALLOWED (deux temps)', async () => {
        const target = await newBuyer('f3d-role-sauter');
        const r = await changeRole(boss, target.userId, { role: 'SUPERADMIN', reason: 'Trop vite' });
        assert.deepEqual([r.status, r.body.code], [409, 'TRANSITION_NOT_ALLOWED'], show(r));
        assert.deepEqual(await rolesOf(target.userId), ['CLIENT']);
    });

    test('compte d’organisatrice → ADMIN : 409 PARTNER_ACCOUNT', async () => {
        const partner = await newPartner('f3d-role-orga');
        const r = await changeRole(boss, partner.userId, { role: 'ADMIN', reason: 'Essai interdit' });
        assert.deepEqual([r.status, r.body.code], [409, 'PARTNER_ACCOUNT'], show(r));
    });

    test('son propre rôle : refusé (sauf quitter le rôle de SUPERADMIN)', async () => {
        const r = await changeRole(boss, boss.userId, { role: 'CLIENT', reason: 'Je pars' });
        assert.deepEqual([r.status, r.body.code], [409, 'SELF_ROLE_CHANGE'], show(r));
    });

    test('dernier SUPERADMIN actif : jamais retiré (transaction annulée, les autres SUPERADMIN suspendus)', async () => {
        const sessionId = sessionIdOf(boss.accessToken);
        const reply = await inRolledBackTransaction(async (c) => {
            await c.query(`UPDATE public.users SET status = 'SUSPENDU'
                            WHERE id IN (SELECT user_id FROM public.user_roles WHERE role::text = 'SUPERADMIN') AND id <> $1`, [boss.userId]);
            const { rows } = await c.query(`SELECT public.admin_role_change($1::jsonb) AS r`, [JSON.stringify({
                actor_id: boss.userId, user_id: boss.userId, role: 'ADMIN', reason: 'Je quitte le rôle',
                session_id: sessionId, device_key: `ses:${sessionId}`,
            })]);
            return rows[0].r as Record<string, unknown>;
        });
        assert.equal(reply.code, 'LAST_SUPERADMIN', JSON.stringify(reply));
    });

    test('contrôleur promu : confirmation de la finition 1 d’abord (rien ne change), puis retrait des équipes', async () => {
        const partner = await newPartner('f3d-role-equipe');
        const ev = await createTimedEvent(partner.partnerId, 'f3d-role-equipe', [{ name: 'Standard', price: 2_000, total: 10 }]);
        const controller = await newController(partner, ev.eventId, { label: 'f3d-role-equipe' });
        const first = await changeRole(boss, controller.userId, { role: 'ADMIN', reason: 'Passe dans l’équipe Event Village' });
        assert.deepEqual([first.status, first.body.code, first.body.requires_confirmation], [200, 'STAFF_PROMOTION_CONFIRMATION', true], show(first));
        assert.match(String(first.body.message), /équipe/i, 'texte de la confirmation de la finition 1 attendu');
        assert.ok((await rolesOf(controller.userId)).includes('CONTROLEUR'), 'rien ne change avant l’accord');
        const second = await changeRole(boss, controller.userId, { role: 'ADMIN', reason: 'Passe dans l’équipe Event Village', confirm_staff_promotion: true });
        assert.equal(second.status, 200, show(second));
        assert.deepEqual(await rolesOf(controller.userId), ['ADMIN', 'CLIENT']);
    });
});

describe('3. aucun autre chemin pour donner ou retirer un rôle d’administration', () => {
    test('PATCH /api/admin/users avec le rôle ADMIN : 409 ROLE_SCREEN_REQUIRED, rien ne change', async () => {
        const target = await newBuyer('f3d-role-patch');
        const r = await callRoute('../../app/api/admin/users/route', 'PATCH', '/api/admin/users', boss.accessToken, { userId: target.userId, roles: ['CLIENT', 'ADMIN'] });
        assert.deepEqual([r.status, r.body.code], [409, 'ROLE_SCREEN_REQUIRED'], show(r));
        assert.deepEqual(await rolesOf(target.userId), ['CLIENT']);
    });

    test('création d’un compte SUPERADMIN : 409 ROLE_SCREEN_REQUIRED', async () => {
        const r = await callRoute('../../app/api/admin/users/route', 'POST', '/api/admin/users', boss.accessToken, {
            firstName: 'Awa', lastName: 'Directe', phone: randomSenegalPhone('77'), email: randomEmail('f3d-sa'), role: 'SUPERADMIN',
        });
        assert.deepEqual([r.status, r.body.code], [409, 'ROLE_SCREEN_REQUIRED'], show(r));
    });

    test('en base : user_roles_set ne donne ni ne retire SUPERADMIN hors de admin_role_change', async () => {
        const target = await newBuyer('f3d-role-base');
        const { data, error } = await service.rpc('user_roles_set', { p: { user_id: target.userId, actor_id: boss.userId, roles: ['CLIENT', 'SUPERADMIN'] } });
        assert.equal(error, null, error?.message);
        assert.equal((data as { code?: string }).code, 'ROLE_SCREEN_REQUIRED', JSON.stringify(data));
        assert.deepEqual(await rolesOf(target.userId), ['CLIENT']);
    });
});

/**
 * Contre-vérification de la finition 3d, attaque 3 — « Changer le rôle » (POST /api/admin/users/[id]/role ;
 * admin_role_change ; garde de user_roles_set).
 *  a. Par un ADMIN (même muni de users.write, identité confirmée) : refus, rôles inchangés.
 *  b. Par un SUPERADMIN sans mot de passe récent, puis sans code récent : refus, rôles inchangés, rien au journal.
 *  c. Dernier SUPERADMIN (les autres SUPERADMIN actifs suspendus le temps du test, puis remis) : deux retraits croisés
 *     simultanés, deux départs simultanés, le dernier qui se retire lui-même : il reste toujours un SUPERADMIN actif.
 *  d. Promotion en SUPERADMIN : alerte à chaque SUPERADMIN actif ; aucun autre chemin (création d'un compte, PATCH par la
 *     liste `roles` ou par l'ancien champ `role`).
 *  e. Réponse « fait » alors que rien n'a changé : deux SUPERADMIN changent le même compte en même temps dans deux sens
 *     opposés ; « déjà ce rôle ».
 *  f. Contrôleur promu ADMIN : affectations retirées, rôle CONTROLEUR retiré, invitations en attente annulées.
 *  g. Autre chemin vers le rôle ADMIN : création d'un compte administrateur par un SUPERADMIN sans mot de passe ni code
 *     récents (l'écran « Changer le rôle » les exige pour faire d'un client un ADMIN).
 * Sortie brute `[CVF3D-3]`.
 */
import '../helpers/env';
import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { assertFinition3dInvariants } from '../helpers/finition3d-invariants';
import { createTimedEvent, newController } from '../parcours/acces-helpers';
import { newPartner, type TestPartner } from '../parcours/finance-helpers';
import { randomEmail } from '../parcours/helpers';
import { newAdmin } from '../parcours/notif-helpers';
import { newBuyer, service } from '../parcours/paiement-helpers';
import { rolesOf } from './cvf1-helpers';
import {
    activeSuperadmins, ageDeviceCode, auditCount, call, confirmIdentity, confirmPasswordOnly, outboxRows, randomSenegalPhone,
    reactivate, show, superadmin, suspendOtherSuperadmins, type Reply, type Row, type TestAdmin,
} from './cvf3d-helpers';

const changeRole = (actor: TestAdmin, targetId: string, body: Row): Promise<Reply> =>
    call('POST', 'admin/users/[id]/role', { token: actor.accessToken, path: `/api/admin/users/${targetId}/role`, params: { id: targetId }, body });

async function assignmentsOf(userId: string): Promise<string[]> {
    const { data, error } = await service.from('event_controllers').select('event_id').eq('user_id', userId);
    assert.equal(error, null, error?.message);
    return (data ?? []).map((r) => String(r.event_id)).sort();
}

async function pendingInvitation(partner: TestPartner, userId: string, eventId: string): Promise<string> {
    const { data, error } = await service.from('controller_invitations').insert({
        partner_id: partner.partnerId, user_id: userId, created_by: partner.userId,
        assignments: [{ event_id: eventId, can_accept_cash: false }],
    }).select('id').single();
    assert.equal(error, null, `invitation en attente (montage) : ${error?.message}`);
    return String(data!.id);
}

after(async () => {
    await assertFinition3dInvariants('cvf3d-3-role');
});

describe('3. qui change un rôle, et avec quelles preuves', () => {
    test('a. ADMIN muni de users.write, identité confirmée : 403, rôles inchangés', async () => {
        const admin = await newAdmin('cvf3d3-a', ['users.read', 'users.write']);
        await confirmIdentity(admin);
        const client = await newBuyer('cvf3d3-a-client');
        const r1 = await changeRole(admin, client.userId, { role: 'ADMIN', reason: 'Contre-vérification' });
        const r2 = await changeRole(admin, admin.userId, { role: 'SUPERADMIN', reason: 'Contre-vérification' });
        console.log(`[CVF3D-3a] ADMIN → client en ADMIN : ${show(r1)} ; ADMIN → lui-même en SUPERADMIN : ${show(r2)}`);
        assert.deepEqual([r1.status, r1.body.code], [403, 'SUPERADMIN_ONLY'], show(r1));
        assert.deepEqual([r2.status, r2.body.code], [403, 'SUPERADMIN_ONLY'], show(r2));
        assert.deepEqual(await rolesOf(client.userId), ['CLIENT']);
        assert.deepEqual(await rolesOf(admin.userId), ['ADMIN', 'CLIENT']);
    });

    test('b. SUPERADMIN sans mot de passe récent, puis sans code récent : 403, rôles inchangés, rien au journal', async () => {
        const sa = await superadmin('cvf3d3-b', false);
        const target = await newAdmin('cvf3d3-b-cible', ['events.read']);
        const noPassword = await changeRole(sa, target.userId, { role: 'SUPERADMIN', reason: 'Contre-vérification' });
        await confirmPasswordOnly(sa.accessToken);
        await ageDeviceCode(sa.userId, 11);
        const noCode = await changeRole(sa, target.userId, { role: 'CLIENT', reason: 'Contre-vérification' });
        console.log(`[CVF3D-3b] sans mot de passe : ${show(noPassword)} ; sans code récent : ${show(noCode)}`);
        assert.deepEqual([noPassword.status, noPassword.body.code], [403, 'PASSWORD_CONFIRMATION_REQUIRED'], show(noPassword));
        assert.deepEqual([noCode.status, noCode.body.code], [403, 'ADMIN_CODE_CONFIRMATION_REQUIRED'], show(noCode));
        assert.deepEqual(await rolesOf(target.userId), ['ADMIN', 'CLIENT']);
        assert.equal(await auditCount('ADMIN_ROLE_CHANGED', target.userId), 0);
    });
});

describe('3. dernier SUPERADMIN', () => {
    test('c. retraits croisés simultanés, départs simultanés, dernier qui se retire : toujours un SUPERADMIN actif', async () => {
        // Montage avant toute suspension (identités confirmées pour de vrai, valables 10 minutes)
        const cross = [[await superadmin('cvf3d3-c-x1a'), await superadmin('cvf3d3-c-x1b')], [await superadmin('cvf3d3-c-x2a'), await superadmin('cvf3d3-c-x2b')]];
        const selfs = [[await superadmin('cvf3d3-c-s1a'), await superadmin('cvf3d3-c-s1b')], [await superadmin('cvf3d3-c-s2a'), await superadmin('cvf3d3-c-s2b')]];
        const alone = await superadmin('cvf3d3-c-seul');
        const out: string[] = [];
        const remaining: number[] = [];
        let suspended: string[] = [];
        try {
            for (const [a, b] of cross) {
                suspended = await suspendOtherSuperadmins([a.userId, b.userId]);
                const replies = await Promise.all([
                    changeRole(a, b.userId, { role: 'ADMIN', reason: 'Retrait croisé simultané' }),
                    changeRole(b, a.userId, { role: 'ADMIN', reason: 'Retrait croisé simultané' }),
                ]);
                const left = await activeSuperadmins();
                remaining.push(left.length);
                out.push(`croisé : ${replies.map(show).join(' | ')} ; SUPERADMIN actifs ensuite : ${left.length}`);
                await reactivate(suspended);
                suspended = [];
            }
            for (const [a, b] of selfs) {
                suspended = await suspendOtherSuperadmins([a.userId, b.userId]);
                const replies = await Promise.all([
                    changeRole(a, a.userId, { role: 'ADMIN', reason: 'Départ simultané' }),
                    changeRole(b, b.userId, { role: 'ADMIN', reason: 'Départ simultané' }),
                ]);
                const left = await activeSuperadmins();
                remaining.push(left.length);
                out.push(`départs : ${replies.map(show).join(' | ')} ; SUPERADMIN actifs ensuite : ${left.length}`);
                await reactivate(suspended);
                suspended = [];
            }
            suspended = await suspendOtherSuperadmins([alone.userId]);
            const last = await changeRole(alone, alone.userId, { role: 'ADMIN', reason: 'Je pars' });
            const left = await activeSuperadmins();
            remaining.push(left.length);
            out.push(`dernier qui se retire : ${show(last)} ; SUPERADMIN actifs ensuite : ${left.length}`);
            await reactivate(suspended);
            suspended = [];
            assert.deepEqual([last.status, last.body.code], [409, 'LAST_SUPERADMIN'], show(last));
        } finally {
            await reactivate(suspended);
            console.log(`[CVF3D-3c] ${out.join('\n[CVF3D-3c] ')}`);
        }
        assert.ok(remaining.every((n) => n >= 1), `aucun SUPERADMIN actif après un des scénarios : ${remaining.join(', ')}`);
    });
});

describe('3. nomination d\'un SUPERADMIN', () => {
    test('d. promotion : alerte à chaque SUPERADMIN actif ; création et PATCH : aucun autre chemin', async () => {
        const boss = await superadmin('cvf3d3-d');
        const target = await newAdmin('cvf3d3-d-cible', ['events.read']);
        const expected = (await activeSuperadmins()).filter((id) => id !== target.userId);
        const r = await changeRole(boss, target.userId, { role: 'SUPERADMIN', reason: 'Contre-vérification : nomination' });
        const rows = await outboxRows('SUPERADMIN_PROMOTED');
        const mine = rows.filter((x) => String((x.group_key as string | null) ?? '').startsWith(`SUPERADMIN_PROMOTED:${target.userId}:`));
        const recipients = new Set(mine.map((x) => String(x.recipient_user_id)));
        const sms = new Set(mine.filter((x) => x.channel === 'SMS').map((x) => String(x.recipient_user_id)));
        const missing = expected.filter((id) => !recipients.has(id));
        const other = await newAdmin('cvf3d3-d-autre', ['events.read']);
        const viaCreate = await call('POST', 'admin/users', { token: boss.accessToken, body: { firstName: 'Awa', lastName: 'Directe', phone: randomSenegalPhone('77'), email: randomEmail('cvf3d3-sa'), role: 'SUPERADMIN' } });
        const viaRoles = await call('PATCH', 'admin/users', { token: boss.accessToken, body: { userId: other.userId, roles: ['CLIENT', 'ADMIN', 'SUPERADMIN'] } });
        const viaRole = await call('PATCH', 'admin/users', { token: boss.accessToken, body: { userId: other.userId, role: 'SUPERADMIN' } });
        console.log(`[CVF3D-3d] promotion : ${show(r)} ; SUPERADMIN actifs à prévenir : ${expected.length} ; prévenus : ${recipients.size} (SMS : ${sms.size}) ; non prévenus : ${missing.length} ; promu prévenu : ${recipients.has(target.userId) ? 'OUI' : 'non'}`);
        console.log(`[CVF3D-3d] création d'un SUPERADMIN : ${show(viaCreate)} ; PATCH roles : ${show(viaRoles)} ; PATCH role : ${show(viaRole)}`);
        assert.equal(r.status, 200, show(r));
        assert.deepEqual(missing, [], 'SUPERADMIN actifs non prévenus');
        assert.ok(sms.has(boss.userId), 'SMS d\'alerte absent pour l\'auteur');
        assert.ok(!recipients.has(target.userId), 'le promu est prévenu de sa propre nomination');
        for (const x of [viaCreate, viaRoles, viaRole]) assert.deepEqual([x.status, x.body.code], [409, 'ROLE_SCREEN_REQUIRED'], show(x));
        assert.deepEqual(await rolesOf(other.userId), ['ADMIN', 'CLIENT']);
    });
});

describe('3. la réponse dit ce qui s\'est passé', () => {
    test('e. deux SUPERADMIN changent le même ADMIN en même temps dans deux sens : une seule réponse « fait », conforme à la base ; « déjà ce rôle » refusé', async () => {
        const s1 = await superadmin('cvf3d3-e1');
        const s2 = await superadmin('cvf3d3-e2');
        const target = await newAdmin('cvf3d3-e-cible', ['events.read']);
        const [down, up] = await Promise.all([
            changeRole(s1, target.userId, { role: 'CLIENT', reason: 'Sens 1' }),
            changeRole(s2, target.userId, { role: 'SUPERADMIN', reason: 'Sens 2' }),
        ]);
        const roles = await rolesOf(target.userId);
        const done = [down, up].filter((r) => r.status === 200);
        const same = await changeRole(s1, s2.userId, { role: 'SUPERADMIN', reason: 'Déjà ce rôle' });
        console.log(`[CVF3D-3e] vers client : ${show(down)} ; vers SUPERADMIN : ${show(up)} ; rôles en base : ${roles.join(', ')} ; déjà ce rôle : ${show(same)}`);
        assert.equal(done.length, 1, `réponses « fait » : ${done.length}`);
        assert.deepEqual([...(done[0].body.roles as string[])].sort(), roles, 'la réponse ne dit pas les rôles en base');
        assert.deepEqual([same.status, same.body.code], [409, 'NO_CHANGE'], show(same));
    });
});

describe('3. contrôleur promu', () => {
    test('f. contrôleur promu ADMIN : affectations retirées, rôle CONTROLEUR retiré, invitations en attente annulées', async () => {
        const boss = await superadmin('cvf3d3-f');
        const p1 = await newPartner('cvf3d3-f-p1');
        const p2 = await newPartner('cvf3d3-f-p2');
        const e1 = await createTimedEvent(p1.partnerId, 'cvf3d3-f-e1', [{ name: 'Standard', price: 2_000, total: 10 }]);
        const e2 = await createTimedEvent(p2.partnerId, 'cvf3d3-f-e2', [{ name: 'Standard', price: 2_000, total: 10 }]);
        const ctrl = await newController(p1, e1.eventId, { label: 'cvf3d3-f' });
        const inv = await pendingInvitation(p2, ctrl.userId, e2.eventId);
        const first = await changeRole(boss, ctrl.userId, { role: 'ADMIN', reason: 'Rejoint l\'équipe Event Village' });
        const between = { roles: await rolesOf(ctrl.userId), assignments: await assignmentsOf(ctrl.userId) };
        const second = await changeRole(boss, ctrl.userId, { role: 'ADMIN', reason: 'Rejoint l\'équipe Event Village', confirm_staff_promotion: true });
        const roles = await rolesOf(ctrl.userId);
        const assignments = await assignmentsOf(ctrl.userId);
        const { data: invRow, error } = await service.from('controller_invitations').select('status').eq('id', inv).single();
        assert.equal(error, null, error?.message);
        console.log(`[CVF3D-3f] sans accord : ${show(first)} (rôles ${between.roles.join(', ')}, affectations ${between.assignments.length}) ; avec accord : ${show(second)} ; rôles : ${roles.join(', ')} ; affectations : ${assignments.length} ; invitation de P2 : ${String(invRow?.status)}`);
        assert.equal(first.body.code, 'STAFF_PROMOTION_CONFIRMATION', show(first));
        assert.ok(between.roles.includes('CONTROLEUR') && between.assignments.length === 1, 'rien ne change avant l\'accord');
        assert.equal(second.status, 200, show(second));
        assert.deepEqual(roles, ['ADMIN', 'CLIENT']);
        assert.deepEqual(assignments, [], 'affectations restantes');
        assert.equal(invRow?.status, 'CANCELLED', 'invitation en attente non annulée');
    });
});

describe('3. autre chemin vers le rôle ADMIN', () => {
    test('g. création d\'un compte ADMIN par un SUPERADMIN sans mot de passe ni code récents : refusée', async () => {
        const sa = await superadmin('cvf3d3-g', false);
        await ageDeviceCode(sa.userId, 120);
        const viaScreen = await changeRole(sa, (await newBuyer('cvf3d3-g-client')).userId, { role: 'ADMIN', reason: 'Témoin : écran du rôle' });
        const phone = randomSenegalPhone('77');
        const created = await call('POST', 'admin/users', { token: sa.accessToken, body: { firstName: 'Fatou', lastName: 'Creee', phone, role: 'ADMIN' } });
        const newId = typeof created.body.userId === 'string' ? created.body.userId : null;
        const roles = newId ? await rolesOf(newId) : [];
        console.log(`[CVF3D-3g] SUPERADMIN (code de l'appareil vieux de 2 h, aucun mot de passe redemandé) : écran « Changer le rôle » ${show(viaScreen)} ; création d'un compte ADMIN ${show(created)} ; rôles du compte créé : ${roles.join(', ') || '—'}`);
        assert.equal(viaScreen.status, 403, `témoin : ${show(viaScreen)}`);
        assert.ok(!roles.includes('ADMIN'), `rôle ADMIN donné sans mot de passe ni code récents, par la création d'un compte (${newId})`);
    });
});

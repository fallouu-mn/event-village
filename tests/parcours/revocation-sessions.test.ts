/**
 * Lot 1C.3 — déconnexion forcée réelle.
 * auth.admin.signOut(userId) était sans effet (la méthode attend un JWT). Désormais les sessions
 * et jetons de rafraîchissement sont révoqués en base. Preuve : après l'action, le jeton de
 * rafraîchissement déjà détenu ne donne plus de nouvelle session.
 *  - retrait du dernier rôle CONTROLEUR par un partenaire ;
 *  - retrait de rôle et suspension par un admin (PATCH /api/admin/users) ;
 *  - anonymisation ;
 *  - déconnexion globale demandée par l'utilisateur (/api/auth/sign-out-global).
 * Témoin : sans action, le même jeton se rafraîchit.
 */
import '../helpers/env';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { NextRequest } from 'next/server';
import { getServiceRoleClient } from '../../lib/supabase/server';
import { grantUserRoles } from '../../lib/auth/roles';
import { bearer, loadFixtures, signInAs } from '../helpers/fixtures';
import { DELETE as removeController } from '../../app/api/partner/team/controller/[controllerId]/route';
import { PATCH as adminPatchUser, DELETE as adminDeleteUser } from '../../app/api/admin/users/route';
import { POST as signOutGlobal } from '../../app/api/auth/sign-out-global/route';
import { BASE_URL, jsonRequest, randomEmail, randomSenegalPhone, routeContext, STRONG_PASSWORD } from './helpers';

const anon = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });

interface Session { userId: string; accessToken: string; refreshToken: string }

async function newSession(label: string, roles: ('CONTROLEUR' | 'PARTENAIRE')[] = []): Promise<Session> {
    const service = getServiceRoleClient();
    const email = randomEmail(label);
    const phone = randomSenegalPhone('76');
    const { data, error } = await service.auth.admin.createUser({ email, phone, password: STRONG_PASSWORD, email_confirm: true, phone_confirm: true });
    assert.equal(error, null, `création : ${error?.message}`);
    const userId = data.user!.id;
    const { error: upErr } = await service.from('users').update({ phone }).eq('id', userId);
    assert.equal(upErr, null, `profil : ${upErr?.message}`);
    if (roles.length) await grantUserRoles(userId, roles);
    const { data: s, error: signErr } = await anon().auth.signInWithPassword({ email, password: STRONG_PASSWORD });
    assert.equal(signErr, null, `connexion : ${signErr?.message}`);
    return { userId, accessToken: s.session!.access_token, refreshToken: s.session!.refresh_token };
}

async function refreshWorks(refreshToken: string): Promise<{ ok: boolean; error?: string }> {
    const { data, error } = await anon().auth.refreshSession({ refresh_token: refreshToken });
    return { ok: !error && !!data.session, error: error?.message };
}

describe('Révocation des sessions', () => {
    test('témoin : sans action, le jeton de rafraîchissement donne une nouvelle session', async () => {
        const s = await newSession('temoin');
        const r = await refreshWorks(s.refreshToken);
        assert.ok(r.ok, `rafraîchissement témoin refusé : ${r.error}`);
    });

    test('retrait du dernier rôle CONTROLEUR par le partenaire → sessions révoquées', async () => {
        const fx = await loadFixtures();
        const partnerA = await signInAs('PARTNER_A');
        const s = await newSession('ctrl-retire', ['CONTROLEUR']);
        const { error } = await getServiceRoleClient().from('event_controllers').insert({
            event_id: fx.events.A_PUBLIE.id, user_id: s.userId, created_by: fx.users.PARTNER_A.id, can_accept_cash: false,
        });
        assert.equal(error, null, `affectation : ${error?.message}`);
        const res = await removeController(
            new NextRequest(`${BASE_URL}/api/partner/team/controller/${s.userId}`, { method: 'DELETE', headers: bearer(partnerA.accessToken) }),
            routeContext({ controllerId: s.userId })
        );
        assert.equal(res.status, 200, `retrait : HTTP ${res.status} ${JSON.stringify(await res.json())}`);
        const r = await refreshWorks(s.refreshToken);
        assert.ok(!r.ok, 'le jeton de rafraîchissement donne encore une session après le retrait du rôle');
    });

    test('retrait de rôle par un admin → sessions révoquées', async () => {
        const superadmin = await signInAs('SUPERADMIN');
        const s = await newSession('admin-retire', ['CONTROLEUR']);
        const res = await adminPatchUser(jsonRequest('/api/admin/users', { userId: s.userId, role: 'CLIENT' }, bearer(superadmin.accessToken), 'PATCH'));
        assert.equal(res.status, 200, `PATCH : HTTP ${res.status} ${JSON.stringify(await res.json())}`);
        assert.ok(!(await refreshWorks(s.refreshToken)).ok, 'session encore rafraîchissable après retrait de rôle');
    });

    test('suspension par un admin → sessions révoquées', async () => {
        const superadmin = await signInAs('SUPERADMIN');
        const s = await newSession('admin-suspend');
        const res = await adminPatchUser(jsonRequest('/api/admin/users', { userId: s.userId, status: 'SUSPENDU' }, bearer(superadmin.accessToken), 'PATCH'));
        assert.equal(res.status, 200, `PATCH : HTTP ${res.status} ${JSON.stringify(await res.json())}`);
        assert.ok(!(await refreshWorks(s.refreshToken)).ok, 'session encore rafraîchissable après suspension');
    });

    test('anonymisation → sessions révoquées', async () => {
        const superadmin = await signInAs('SUPERADMIN');
        const s = await newSession('anonymise');
        const res = await adminDeleteUser(new NextRequest(`${BASE_URL}/api/admin/users?userId=${s.userId}`, { method: 'DELETE', headers: bearer(superadmin.accessToken) }));
        assert.equal(res.status, 200, `anonymisation : HTTP ${res.status} ${JSON.stringify(await res.json())}`);
        assert.ok(!(await refreshWorks(s.refreshToken)).ok, 'session encore rafraîchissable après anonymisation');
    });

    test('déconnexion globale demandée par l’utilisateur → toutes ses sessions révoquées', async () => {
        const s = await newSession('signout-global');
        const res = await signOutGlobal(new NextRequest(`${BASE_URL}/api/auth/sign-out-global`, { method: 'POST', headers: bearer(s.accessToken) }));
        assert.equal(res.status, 200, `sign-out-global : HTTP ${res.status} ${JSON.stringify(await res.json())}`);
        assert.ok(!(await refreshWorks(s.refreshToken)).ok, 'session encore rafraîchissable après déconnexion globale');
    });
});

/**
 * Lot 1B.8 — PATCH /api/admin/users met à jour user_roles (ajout et retrait), source des
 * politiques RLS, et journalise le changement.
 *  - retrait : un contrôleur affecté à A_PUBLIE est rétrogradé CLIENT par un SUPERADMIN ;
 *    sa session ne lit plus les billets de l'événement et is_controller() devient faux ;
 *  - ajout : un CLIENT promu CONTROLEUR obtient is_controller().
 */
import '../helpers/env';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getServiceRoleClient } from '../../lib/supabase/server';
import { grantUserRoles } from '../../lib/auth/roles';
import { bearer, loadFixtures, signInAs } from '../helpers/fixtures';
import { PATCH as adminPatchUser } from '../../app/api/admin/users/route';
import { jsonRequest, randomEmail, STRONG_PASSWORD } from './helpers';

async function newAccount(label: string): Promise<{ userId: string; client: SupabaseClient }> {
    const service = getServiceRoleClient();
    const email = randomEmail(label);
    const { data, error } = await service.auth.admin.createUser({ email, password: STRONG_PASSWORD, email_confirm: true });
    assert.equal(error, null, `création du compte : ${error?.message}`);
    const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
    const { error: signErr } = await client.auth.signInWithPassword({ email, password: STRONG_PASSWORD });
    assert.equal(signErr, null, `connexion : ${signErr?.message}`);
    return { userId: data.user!.id, client };
}

async function rolesOf(userId: string): Promise<string[]> {
    const { data, error } = await getServiceRoleClient().from('user_roles').select('role').eq('user_id', userId);
    assert.equal(error, null, `rôles : ${error?.message}`);
    return (data || []).map((r) => r.role as string).sort();
}

async function isController(client: SupabaseClient): Promise<boolean> {
    const { data, error } = await client.rpc('is_controller');
    assert.equal(error, null, `is_controller : ${error?.message}`);
    return data === true;
}

describe('Changement de rôle par un admin', () => {
    test('rôle CONTROLEUR retiré par PATCH → user_roles mis à jour, la RLS ne l’accorde plus', async () => {
        const fx = await loadFixtures();
        const superadmin = await signInAs('SUPERADMIN');
        const target = await newAccount('role-retire');
        await grantUserRoles(target.userId, ['CONTROLEUR']);
        const { error: assignErr } = await getServiceRoleClient().from('event_controllers').insert({
            event_id: fx.events.A_PUBLIE.id, user_id: target.userId, created_by: fx.users.PARTNER_A.id, can_accept_cash: false,
        });
        assert.equal(assignErr, null, `affectation : ${assignErr?.message}`);

        const { data: beforeTickets } = await target.client.from('tickets').select('id').eq('event_id', fx.events.A_PUBLIE.id);
        assert.ok((beforeTickets || []).length > 0, 'précondition : le contrôleur affecté lit les billets de son événement');
        assert.equal(await isController(target.client), true, 'précondition : is_controller() vrai');

        const res = await adminPatchUser(jsonRequest('/api/admin/users', { userId: target.userId, role: 'CLIENT' }, bearer(superadmin.accessToken), 'PATCH'));
        const body = await res.json();
        assert.equal(res.status, 200, `PATCH : HTTP ${res.status} ${JSON.stringify(body)}`);

        assert.deepEqual(await rolesOf(target.userId), ['CLIENT'], 'user_roles ne doit plus contenir CONTROLEUR');
        assert.equal(await isController(target.client), false, 'is_controller() doit être faux');
        const { data: afterTickets, error } = await target.client.from('tickets').select('id').eq('event_id', fx.events.A_PUBLIE.id);
        assert.equal(error, null, `lecture des billets : ${error?.message}`);
        assert.deepEqual(afterTickets, [], 'la RLS ne doit plus donner accès aux billets de l’événement');

        const { data: audit } = await getServiceRoleClient().from('audit_logs').select('action, new_value').eq('object_id', target.userId).eq('action', 'UPDATE_USER');
        assert.ok((audit || []).some((a) => JSON.stringify(a.new_value).includes('"roles"')), 'changement de rôles journalisé (UPDATE_USER avec roles)');
    });

    test('rôle CONTROLEUR ajouté par PATCH → user_roles et is_controller()', async () => {
        const superadmin = await signInAs('SUPERADMIN');
        const target = await newAccount('role-ajoute');
        assert.equal(await isController(target.client), false, 'précondition');

        const res = await adminPatchUser(jsonRequest('/api/admin/users', { userId: target.userId, role: 'CONTROLEUR' }, bearer(superadmin.accessToken), 'PATCH'));
        const body = await res.json();
        assert.equal(res.status, 200, `PATCH : HTTP ${res.status} ${JSON.stringify(body)}`);
        assert.deepEqual(await rolesOf(target.userId), ['CLIENT', 'CONTROLEUR']);
        assert.equal(await isController(target.client), true);
    });
});

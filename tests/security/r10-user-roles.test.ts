/**
 * R10 — Lot 1B.5 : les politiques de user_roles ne se référencent plus elles-mêmes
 * (erreur 42P17 « infinite recursion detected in policy »).
 *  - un compte authenticated lit ses propres rôles ;
 *  - un ADMIN lit les rôles des autres comptes ;
 *  - personne n'écrit dans user_roles par REST, pas même un ADMIN pour s'attribuer SUPERADMIN.
 * (Clé anon + signInWithPassword uniquement.)
 */
import '../helpers/env';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { assertDenied, signInFixture } from './helpers';

describe('R10 — politiques de user_roles', () => {
    test('un compte authenticated lit ses propres rôles sans erreur 42P17', async () => {
        const client = await signInFixture('CLIENT');
        const { data, error } = await client.client.from('user_roles').select('role').eq('user_id', client.userId);
        assert.equal(error, null, `lecture de ses rôles : ${error?.code} ${error?.message}`);
        assert.deepEqual((data || []).map((r) => r.role), ['CLIENT']);
    });

    test('un CLIENT ne lit pas les rôles des autres comptes', async () => {
        const client = await signInFixture('CLIENT');
        const { data, error } = await client.client.from('user_roles').select('user_id, role');
        assert.equal(error, null, `lecture des rôles : ${error?.code} ${error?.message}`);
        const foreign = (data || []).filter((r) => r.user_id !== client.userId);
        assert.deepEqual(foreign, [], 'rôles de tiers lisibles par un CLIENT');
    });

    test('un ADMIN lit les rôles des autres comptes', async () => {
        const admin = await signInFixture('ADMIN');
        const client = await signInFixture('CLIENT');
        const { data, error } = await admin.client.from('user_roles').select('role').eq('user_id', client.userId);
        assert.equal(error, null, `lecture admin des rôles : ${error?.code} ${error?.message}`);
        assert.deepEqual((data || []).map((r) => r.role), ['CLIENT']);
    });

    test("un ADMIN ne s'attribue pas SUPERADMIN par REST", async () => {
        const admin = await signInFixture('ADMIN');
        const { error } = await admin.client.from('user_roles').insert({ user_id: admin.userId, role: 'SUPERADMIN' });
        assertDenied(error, 'auto-attribution de SUPERADMIN par un ADMIN');
        const { data: isSuper, error: rpcErr } = await admin.client.rpc('is_superadmin');
        assert.equal(rpcErr, null, `is_superadmin : ${rpcErr?.message}`);
        assert.equal(isSuper, false);
    });

    test("un CLIENT ne s'attribue aucun rôle par REST", async () => {
        const client = await signInFixture('CLIENT_BIS');
        const { error } = await client.client.from('user_roles').insert({ user_id: client.userId, role: 'PARTENAIRE' });
        assertDenied(error, 'auto-attribution de PARTENAIRE par un CLIENT');
    });
});

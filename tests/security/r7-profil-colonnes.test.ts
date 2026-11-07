/**
 * R7 — Lot 1B.2 : par l'API REST, un utilisateur ne modifie de son profil que prénom, nom
 * et photo. status, role, referral_status, referral_code, phone et email sont refusés.
 * (Clé anon + signUp / signInWithPassword uniquement.)
 */
import '../helpers/env';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { assertDenied, signInFixture, signUpAttacker, uniqueSuffix } from './helpers';
import { randomSenegalPhone } from '../parcours/helpers';

describe('R7 — colonnes protégées de public.users', () => {
    test('compte SUSPENDU qui tente status = ACTIF → refusé, statut inchangé', async () => {
        const suspended = await signInFixture('SUSPENDED');
        const { error } = await suspended.client.from('users').update({ status: 'ACTIF' }).eq('id', suspended.userId).select('status');
        assertDenied(error, 'réactivation de son propre compte (status)');
        const { data: after, error: readErr } = await suspended.client.from('users').select('status').eq('id', suspended.userId).single();
        assert.equal(readErr, null, `relecture du profil : ${readErr?.message}`);
        assert.equal(after.status, 'SUSPENDU');
    });

    test('CLIENT qui change son téléphone par REST → refusé', async () => {
        const client = await signUpAttacker('r7-phone');
        const phone = randomSenegalPhone('78');
        const { error } = await client.client.from('users').update({ phone }).eq('id', client.userId).select('phone');
        assertDenied(error, 'changement de téléphone par REST');
        const { data: after } = await client.client.from('users').select('phone').eq('id', client.userId).single();
        assert.notEqual(after?.phone, phone);
    });

    test('CLIENT qui change son email, son rôle, son statut de parrainage ou son code → refusé', async () => {
        const client = await signUpAttacker('r7-cols');
        const attempts: Record<string, unknown> = {
            email: `r7-${uniqueSuffix().toLowerCase()}@test.eventvillage.local`,
            role: 'SUPERADMIN',
            referral_status: 'AMBASSADEUR',
            referral_code: `R7${uniqueSuffix()}`,
            status: 'SUSPENDU',
        };
        for (const [column, value] of Object.entries(attempts)) {
            const { error } = await client.client.from('users').update({ [column]: value }).eq('id', client.userId).select('id');
            assertDenied(error, `modification de users.${column}`);
        }
    });

    test('CLIENT qui change son prénom, son nom et sa photo → accepté', async () => {
        const client = await signUpAttacker('r7-ok');
        const patch = { first_name: 'Prénom-R7', last_name: 'Nom-R7', avatar_url: 'https://example.invalid/avatar-r7.png' };
        const { data, error } = await client.client.from('users').update(patch).eq('id', client.userId).select('first_name, last_name, avatar_url');
        assert.equal(error, null, `mise à jour autorisée refusée : ${error?.message}`);
        assert.deepEqual(data, [patch]);
    });
});

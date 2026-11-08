/**
 * R7 — Lot 1B.2, renforcé au lot 9 (L32, AR3) : par l'API REST, un utilisateur ne modifie plus rien de son profil.
 * status, role, referral_status, referral_code, phone, email, et désormais prénom, nom et photo sont refusés.
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

    test('CLIENT qui change son prénom, son nom et sa photo par REST → refusé, la route est seule à écrire', async () => {
        const client = await signUpAttacker('r7-ok');
        const patch = { first_name: 'Prénom-R7', last_name: 'Nom-R7', avatar_url: 'https://example.invalid/avatar-r7.png' };
        const { error } = await client.client.from('users').update(patch).eq('id', client.userId).select('first_name, last_name, avatar_url');
        assertDenied(error, 'modification du prénom, du nom et de la photo par REST');
        const { data: after, error: readErr } = await client.client.from('users').select('first_name').eq('id', client.userId).single(); assert.ok(!readErr && after && after.first_name !== patch.first_name, `prénom modifié ou illisible : ${readErr?.message ?? after?.first_name}`);
    });
});

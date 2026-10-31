/**
 * Lot 1A.1 (R1) — l'inscription publique ne doit conférer AUCUN privilège.
 *
 * Attaques simulées avec la seule clé anon :
 *  - signUp avec options.data.role / roles = SUPERADMIN, ADMIN, PARTENAIRE, CONTROLEUR ;
 *  - signUp avec options.data.phone = numéro de bootstrap SUPERADMIN (publié dans le dépôt) ;
 *  - signUp avec un téléphone arbitraire en métadonnée (appropriation d'un numéro).
 * Régression : deux comptes sans téléphone doivent pouvoir être créés.
 */
import '../helpers/env';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { signUpAttacker } from './helpers';

const ELEVATED_ROLES = ['SUPERADMIN', 'ADMIN', 'PARTENAIRE', 'CONTROLEUR'] as const;

/** Téléphone unique en métadonnée : isole l'élévation de rôle du défaut « téléphone vide » (testé à part). */
function uniqueMetaPhone(): string {
    return `+22176${Math.floor(1_000_000 + Math.random() * 8_999_999)}`;
}

async function rpcBool(client: Awaited<ReturnType<typeof signUpAttacker>>['client'], fn: string, args?: Record<string, unknown>): Promise<boolean> {
    const { data, error } = await client.rpc(fn, args);
    assert.equal(error, null, `${fn} doit rester appelable (aide RLS) : ${error?.message}`);
    return data === true;
}

describe('R1 — inscription : aucune élévation de rôle par les métadonnées', () => {
    for (const role of ELEVATED_ROLES) {
        test(`signUp avec data.role=${role} et data.roles=[${role}] → compte CLIENT sans privilège`, async () => {
            const attacker = await signUpAttacker(`role-${role.toLowerCase()}`, { role, roles: [role], first_name: 'Attaquant', phone: uniqueMetaPhone() });

            assert.equal(await rpcBool(attacker.client, 'is_admin'), false, 'is_admin() doit être faux');
            assert.equal(await rpcBool(attacker.client, 'is_superadmin'), false, 'is_superadmin() doit être faux');
            assert.equal(await rpcBool(attacker.client, 'is_controller'), false, 'is_controller() doit être faux');
            assert.equal(await rpcBool(attacker.client, 'has_role', { p_role: role }), false, `has_role(${role}) doit être faux`);
            assert.equal(await rpcBool(attacker.client, 'has_role', { p_role: 'CLIENT' }), true, 'has_role(CLIENT) doit être vrai');

            const { data: me, error } = await attacker.client.from('users').select('role').eq('id', attacker.userId).single();
            assert.equal(error, null, `lecture de son propre profil : ${error?.message}`);
            assert.equal(me.role, 'CLIENT');
        });
    }

    test('signUp avec data.phone = numéro de bootstrap SUPERADMIN → aucun privilège', async () => {
        for (const phone of ['773780756', '+221773780756', '770000000']) {
            const attacker = await signUpAttacker('bootstrap-phone', { phone });
            assert.equal(await rpcBool(attacker.client, 'is_superadmin'), false, `téléphone ${phone} en métadonnée : is_superadmin() doit être faux`);
            assert.equal(await rpcBool(attacker.client, 'is_admin'), false, `téléphone ${phone} en métadonnée : is_admin() doit être faux`);
        }
    });

    test('un téléphone fourni en métadonnée n\'est pas recopié dans users.phone (pas d\'appropriation de numéro)', async () => {
        const claimed = `+22177${Math.floor(1_000_000 + Math.random() * 8_999_999)}`;
        const attacker = await signUpAttacker('phone-squat', { phone: claimed });
        const { data: me, error } = await attacker.client.from('users').select('phone').eq('id', attacker.userId).single();
        assert.equal(error, null, `lecture de son propre profil : ${error?.message}`);
        assert.equal(me.phone, null, `users.phone doit rester vide (métadonnée non vérifiée), obtenu ${me.phone}`);
    });

    test('régression : deux comptes sans téléphone se créent sans erreur', async () => {
        const first = await signUpAttacker('sans-tel-1');
        const second = await signUpAttacker('sans-tel-2');
        assert.notEqual(first.userId, second.userId);
    });
});

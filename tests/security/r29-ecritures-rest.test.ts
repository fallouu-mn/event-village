/**
 * R29 — Lot 9 ter, tâche 9t.1 (consigne 0.1, arbitrages 1 et 2 ; contrat 5.A, A.1.5 suite 3, X22) : aucune écriture
 * REST dans le schéma public, même pour un administrateur. Point de vue d'un attaquant : clé anon et comptes de
 * fixture connectés par mot de passe, ou compte neuf inscrit publiquement (règle du lot 1A).
 *  1. client neuf : insérer une fiche partenaire VALIDE à son nom → 42501 ;
 *  2. PARTNER_A : PATCH de sa fiche filtré sur un identifiant inexistant → 42501 ;
 *  3. ADMIN : écritures REST refusées (42501) sur partners, subscription_plans, ticket_categories, referral_config,
 *     referral_commissions, payments, refunds, withdrawals, platform_settings, campaigns, sponsored_promotions ;
 *  4. SUPERADMIN : suppression dans admin_permissions et dans partners refusée (42501).
 *
 * Chaque écriture vise un identifiant inexistant (ZERO_UUID) ou une clé étrangère inexistante : aujourd'hui la
 * politique laisse passer et rien n'est écrit (0 ligne, ou 23503 sur la clé étrangère) ; après la migration
 * 20261110000001_lot9ter_rls, le contrôle de privilège échoue avant toute lecture (42501). Aucun effet en base, au
 * run « avant » comme au run « après ». Code strict 42501 (pas DENIED_CODES) : un refus par objet absent ou par
 * colonne inconnue ne prouve rien ici.
 *
 * Rouge avant correctif (fix(9t.1)) :
 *  - 1 : 23503 (partners_insert_auth laisse passer, M/0003_rls.sql:112-113 ; la clé étrangère échoue ensuite) ;
 *  - 2 : aucune erreur, 0 ligne (partners_update_owner, M/0003_rls.sql:115-116) ;
 *  - 3 : aucune erreur, 0 ligne (politiques 2, 4, 16 à 20, 22 à 25 du tableau A du contrat) ;
 *  - 4 : aucune erreur, 0 ligne (politiques 5 et 21).
 *
 * Suite des tests de sécurité : aucun appel d'invariants (règle de tests/security, contrat A.1.5) ; aucune écriture
 * effective, sauf le compte neuf du cas 1 (inscription publique, comme les autres suites R).
 */
import '../helpers/env';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import type { PostgrestError } from '@supabase/supabase-js';
import { ZERO_UUID, signInFixture, signUpAttacker } from './helpers';

/** Refus strict par le contrôle de privilège (42501). */
function assertPrivilegeDenied(error: PostgrestError | null, what: string): void {
    assert.ok(error, `${what} : écriture REST acceptée (aucune erreur) alors qu’elle doit être refusée par les droits (42501)`);
    assert.equal(error.code, '42501', `${what} : refus 42501 attendu, obtenu code=${error.code} message=${error.message}`);
}

/** Cibles des écritures d'un ADMIN : colonne sensible écrite et clé du filtre (X22 pour sponsored_promotions). */
const ADMIN_TARGETS: ReadonlyArray<{ table: string; key: 'id' | 'key'; patch: Record<string, unknown> }> = [
    { table: 'partners', key: 'id', patch: { status: 'VALIDE' } },
    { table: 'subscription_plans', key: 'id', patch: { price: 0 } },
    { table: 'ticket_categories', key: 'id', patch: { price: 0 } },
    { table: 'referral_config', key: 'id', patch: { rate_n1: 50 } },
    { table: 'referral_commissions', key: 'id', patch: { status: 'AVAILABLE' } },
    { table: 'payments', key: 'id', patch: { status: 'SUCCESS' } },
    { table: 'refunds', key: 'id', patch: { status: 'PROCESSED' } },
    { table: 'withdrawals', key: 'id', patch: { status: 'PAID' } },
    { table: 'platform_settings', key: 'key', patch: { value: { value: 0 } } },
    { table: 'campaigns', key: 'id', patch: { status: 'SENT' } },
    { table: 'sponsored_promotions', key: 'id', patch: { status: 'APPROUVEE' } },
];

describe('R29 — aucune écriture REST dans public (0.1, lot 9 ter)', () => {
    test('client neuf : insérer une fiche partenaire VALIDE à son nom est refusé', async () => {
        const attacker = await signUpAttacker('r29-fiche');
        const { error } = await attacker.client.from('partners').insert({
            user_id: attacker.userId,
            company_name: 'Sonde 9 ter',
            status: 'VALIDE',
            is_verified: true,
            subscription_plan_id: ZERO_UUID,
        });
        assertPrivilegeDenied(error, 'client neuf : INSERT partners (fiche VALIDE à son nom)');
        const { data: own, error: readErr } = await attacker.client.from('partners').select('id').eq('user_id', attacker.userId);
        assert.equal(readErr, null, `relecture de ses fiches : ${readErr?.message}`);
        assert.deepEqual(own ?? [], [], 'aucune fiche partenaire créée');
    });

    test('PARTNER_A : PATCH de sa fiche filtré sur un identifiant inexistant → 42501', async () => {
        const a = await signInFixture('PARTNER_A');
        const { error } = await a.client.from('partners').update({ status: 'VALIDE' }).eq('id', ZERO_UUID);
        assertPrivilegeDenied(error, 'PARTNER_A : PATCH partners (status)');
    });

    test('ADMIN : écritures REST refusées sur partners, subscription_plans, ticket_categories, referral_config, referral_commissions, payments, refunds, withdrawals, platform_settings, campaigns, sponsored_promotions', async () => {
        const admin = await signInFixture('ADMIN');
        for (const target of ADMIN_TARGETS) {
            const upd = await admin.client.from(target.table).update(target.patch).eq(target.key, ZERO_UUID);
            assertPrivilegeDenied(upd.error, `ADMIN : PATCH ${target.table} (${Object.keys(target.patch).join(', ')})`);
            const del = await admin.client.from(target.table).delete().eq(target.key, ZERO_UUID);
            assertPrivilegeDenied(del.error, `ADMIN : DELETE ${target.table}`);
        }
    });

    test('SUPERADMIN : admin_permissions et partners (suppression) refusés', async () => {
        const superadmin = await signInFixture('SUPERADMIN');
        const perms = await superadmin.client.from('admin_permissions').delete().eq('user_id', ZERO_UUID);
        assertPrivilegeDenied(perms.error, 'SUPERADMIN : DELETE admin_permissions');
        const partners = await superadmin.client.from('partners').delete().eq('id', ZERO_UUID);
        assertPrivilegeDenied(partners.error, 'SUPERADMIN : DELETE partners');
    });
});

/**
 * Lot 3 (contrat, section E) — relations de parrainage : seule l'inscription serveur
 * (app/api/auth/register/route.ts) crée une relation parrain → filleul, avec les taux de referral_config.
 *
 * Défaut constaté : la politique referral_relationships_insert (0003_rls.sql L313-314,
 * WITH CHECK referred_id = auth.uid()) n'a jamais été retirée, et aucun REVOKE ne la neutralise.
 * Un client connecté peut donc se déclarer filleul d'un complice avec des taux et une durée de son
 * choix (rate_n1_at_creation n'a aucun CHECK : jusqu'à 999,99 %). La commission calculée ensuite
 * sur ses achats est retirable.
 *
 * Règle du lot 1A : clé anon et signUp / signInWithPassword uniquement (anon-uniquement.test.ts).
 */
import '../helpers/env';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { assertDenied, signUpAttacker, uniqueSuffix, ZERO_UUID, type AttackerAccount } from './helpers';

interface Terms { n1: number; n2: number; months: number }

function relationRow(sponsor: AttackerAccount, referred: AttackerAccount, terms: Terms): Record<string, unknown> {
    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + terms.months);
    return {
        sponsor_id: sponsor.userId,
        referred_id: referred.userId,
        referral_type: 'CLIENT_TO_CLIENT',
        sponsor_status_at_creation: 'STANDARD',
        rate_n1_at_creation: terms.n1,
        rate_n2_at_creation: terms.n2,
        duration_months: terms.months,
        expires_at: expiresAt.toISOString(),
        is_active: true,
    };
}

/** Relations où le compte est filleul, telles que la politique de lecture les lui montre. */
async function ownRelations(account: AttackerAccount): Promise<unknown[]> {
    const { data, error } = await account.client
        .from('referral_relationships')
        .select('id, sponsor_id, rate_n1_at_creation, rate_n2_at_creation, duration_months')
        .eq('referred_id', account.userId);
    assert.equal(error, null, `lecture de ses propres relations : ${error?.message}`);
    return data ?? [];
}

describe('R13 — relations de parrainage : aucune création par le client', () => {
    test('CLIENT connecté : se déclarer filleul d’un complice avec des taux arbitraires (99,99 % / 50 %, 100 ans) → refusé', async () => {
        const accomplice = await signUpAttacker('r13-complice');
        const attacker = await signUpAttacker('r13-filleul');
        const { error } = await attacker.client
            .from('referral_relationships')
            .insert(relationRow(accomplice, attacker, { n1: 99.99, n2: 50, months: 1200 }));
        assertDenied(error, 'INSERT referral_relationships (taux 99,99 % / 50 %, 1 200 mois)');
        assert.deepEqual(await ownRelations(attacker), [], 'aucune relation ne doit être enregistrée pour ce compte');
    });

    test('CLIENT connecté : même avec la grille du CDC (5 % / 2 %, 12 mois) → refusé, seule l’inscription serveur crée la relation', async () => {
        const sponsor = await signUpAttacker('r13-parrain-cdc');
        const attacker = await signUpAttacker('r13-filleul-cdc');
        const { error } = await attacker.client
            .from('referral_relationships')
            .insert(relationRow(sponsor, attacker, { n1: 5, n2: 2, months: 12 }));
        assertDenied(error, 'INSERT referral_relationships (taux de la grille)');
        assert.deepEqual(await ownRelations(attacker), [], 'aucune relation ne doit être enregistrée pour ce compte');
    });

    test('CLIENT connecté : insertion directe d’une commission disponible à son profit → refusée', async () => {
        const sponsor = await signUpAttacker('r13-commission');
        const { error } = await sponsor.client.from('referral_commissions').insert({
            sponsor_id: sponsor.userId,
            referred_id: sponsor.userId,
            generation: 'N1',
            referral_type: 'CLIENT_TO_CLIENT',
            payment_id: ZERO_UUID,
            eligible_net_revenue: 1000,
            commission_rate: 50,
            amount: 500,
            status: 'AVAILABLE',
            idempotency_key: `R13-${uniqueSuffix()}`,
        });
        assertDenied(error, 'INSERT referral_commissions');
    });
});

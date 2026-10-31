/**
 * R15 — Lot 4.0 : le statut ambassadeur (users.referral_status) fixe les taux de commission ; un
 * compte ADMIN connecté (clé anon + signInWithPassword) ne peut le changer par aucune voie REST.
 *  - update / upsert : bloqués depuis le lot 1B.2 (privilèges UPDATE par colonne,
 *    20261031000003_lot1b2_users_colonnes_protegees.sql:17-18) ; gardé ici en non-régression ;
 *  - suppression puis recréation de la ligne avec referral_status = AMBASSADEUR : ouverte.
 *    Rouge avant correctif : la politique users_admin_manage FOR ALL USING (is_admin())
 *    (0003_rls.sql:92-93) laisse tout ADMIN supprimer et insérer des lignes de public.users, et les
 *    privilèges INSERT / DELETE de authenticated n'ont jamais été retirés (seul UPDATE l'a été).
 * La cible est un compte jetable créé par inscription publique.
 */
import '../helpers/env';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import { assertDenied, signInFixture, signUpAttacker } from './helpers';

type UserRow = Record<string, unknown> & { id: string; referral_status: string };

async function profileOf(client: SupabaseClient, userId: string): Promise<UserRow | null> {
    const { data, error } = await client.from('users').select('*').eq('id', userId).maybeSingle();
    assert.equal(error, null, `lecture du profil ${userId} : ${error?.code} ${error?.message}`);
    return (data as UserRow | null) ?? null;
}

describe('R15 — statut ambassadeur hors de portée d’un ADMIN par REST', () => {
    test('un ADMIN ne passe pas un compte AMBASSADEUR par update ni par upsert', async () => {
        const admin = await signInFixture('ADMIN');
        const target = await signUpAttacker('r15-upd');
        const original = await profileOf(admin.client, target.userId);
        assert.ok(original, 'profil de la cible lisible par un ADMIN');
        assert.equal(original!.referral_status, 'STANDARD');

        const upd = await admin.client.from('users').update({ referral_status: 'AMBASSADEUR' }).eq('id', target.userId).select('id');
        assert.ok(upd.error || (upd.data ?? []).length === 0, `update accepté : ${JSON.stringify(upd.data)}`);

        const ups = await admin.client.from('users').upsert({ ...original!, referral_status: 'AMBASSADEUR' }, { onConflict: 'id' }).select('id');
        assert.ok(ups.error || (ups.data ?? []).length === 0, `upsert accepté : ${JSON.stringify(ups.data)}`);

        assert.equal((await profileOf(admin.client, target.userId))?.referral_status, 'STANDARD', 'statut inchangé');
    });

    test('un ADMIN ne supprime pas la ligne d’un compte et ne la recrée pas AMBASSADEUR (users_admin_manage)', async () => {
        const admin = await signInFixture('ADMIN');
        const target = await signUpAttacker('r15-del');
        const original = await profileOf(admin.client, target.userId);
        assert.ok(original, 'profil de la cible lisible par un ADMIN');
        try {
            const del = await admin.client.from('users').delete().eq('id', target.userId).select('id');
            assert.ok(del.error || (del.data ?? []).length === 0, `suppression acceptée : ${JSON.stringify(del.data)}`);
            assert.ok(await profileOf(admin.client, target.userId), 'la ligne du compte existe toujours');

            const ins = await admin.client.from('users').insert({ ...original!, referral_status: 'AMBASSADEUR' }).select('id');
            assertDenied(ins.error, 'insertion d’une ligne public.users par un ADMIN');

            assert.equal((await profileOf(admin.client, target.userId))?.referral_status, 'STANDARD', 'statut inchangé');
        } finally {
            // Compte jetable : si la suppression a réussi (défaut), la ligne est remise telle quelle.
            if (!(await profileOf(admin.client, target.userId))) {
                await admin.client.from('users').insert(original!);
            }
        }
    });
});

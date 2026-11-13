/**
 * Lot 1A.1 — bootstrap SUPERADMIN par procédure serveur (et non plus par le téléphone de
 * l'inscription) : promotion d'un compte existant, refus si un SUPERADMIN existe sans
 * option explicite, journalisation.
 */
import '../helpers/env';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { getServiceRoleClient } from '../../lib/supabase/server';
import { bootstrapSuperadmin } from '../../lib/admin/bootstrap-superadmin';
import { randomEmail, STRONG_PASSWORD } from './helpers';

const service = getServiceRoleClient();

/**
 * Compte existant à promouvoir. Lot 9 quater (A2) : l'inscription publique de GoTrue est fermée ; le compte est créé par
 * le service_role, comme toute création de l'application, puis la session est ouverte avec la clé anon (modification
 * signalée au rapport : avant, signUp public).
 */
async function signUp(email: string) {
    const { data, error } = await service.auth.admin.createUser({ email, password: STRONG_PASSWORD, email_confirm: true });
    assert.equal(error, null, `création du compte : ${error?.message}`);
    const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
        auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error: signInErr } = await anon.auth.signInWithPassword({ email, password: STRONG_PASSWORD });
    assert.equal(signInErr, null, `connexion : ${signInErr?.message}`);
    return { anon, userId: data.user!.id };
}

describe('Bootstrap SUPERADMIN (scripts/bootstrap-superadmin.ts)', () => {
    test('refus quand un SUPERADMIN existe déjà et que l\'option n\'est pas donnée', async () => {
        const email = randomEmail('bootstrap-refus');
        await signUp(email);
        await assert.rejects(() => bootstrapSuperadmin({ email, operator: 'suite de tests' }), /SUPERADMIN existe déjà/);
    });

    test('promotion explicite d\'un compte existant : rôle, droits RLS et journal', async () => {
        const email = randomEmail('bootstrap-ok');
        const { anon, userId } = await signUp(email);

        const res = await bootstrapSuperadmin({ email, operator: 'suite de tests', allowWhenSuperadminExists: true });
        assert.equal(res.userId, userId);

        const { data: roles } = await service.from('user_roles').select('role').eq('user_id', userId);
        assert.ok((roles || []).some((r) => r.role === 'SUPERADMIN'), 'user_roles doit contenir SUPERADMIN');

        const { data: isSuper, error } = await anon.rpc('is_superadmin');
        assert.equal(error, null);
        assert.equal(isSuper, true, 'is_superadmin() vrai pour le compte promu');

        const { data: audit } = await service.from('audit_logs').select('action').eq('object_id', userId).eq('action', 'SUPERADMIN_BOOTSTRAP');
        assert.equal(audit?.length, 1, 'promotion journalisée');
    });

    test('compte inexistant : refus explicite', async () => {
        await assert.rejects(
            () => bootstrapSuperadmin({ email: randomEmail('inexistant'), operator: 'suite de tests', allowWhenSuperadminExists: true }),
            /Aucun compte ne correspond/
        );
    });
});

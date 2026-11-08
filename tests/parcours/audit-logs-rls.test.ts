/**
 * Lot 9, tâche 9.3, A24 — la lecture du journal d'audit est réservée au SUPERADMIN, en base aussi.
 *
 * La route GET /api/admin/audit répond 403 à un ADMIN (admin-audit-lot9), mais la politique
 * audit_logs_superadmin_read (0003_rls.sql:355) avait pour condition is_admin(), vraie pour ADMIN et SUPERADMIN :
 * un ADMIN lisait donc tout le journal en appelant PostgREST avec son propre jeton, sans passer par la route.
 *
 * Les acteurs passent par la clé anon et leur jeton ; le service_role ne sert qu'à poser une ligne témoin, pour
 * qu'un résultat vide prouve un refus et non une table vide.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { getServiceRoleClient } from '../../lib/supabase/server';
import { signInAs } from '../helpers/fixtures';
import { assertLot9Invariants } from '../helpers/lot9-invariants';

let witnessId: string;

function asActor(accessToken: string) {
    return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { headers: { Authorization: `Bearer ${accessToken}` } },
    });
}

async function readWitness(role: 'SUPERADMIN' | 'ADMIN' | 'CLIENT'): Promise<string[]> {
    const { accessToken } = await signInAs(role);
    const { data, error } = await asActor(accessToken).from('audit_logs').select('id').eq('id', witnessId);
    assert.equal(error, null, `lecture de la ligne témoin par ${role} : ${error?.message}`);
    return (data ?? []).map((r) => String((r as { id: string }).id));
}

before(async () => {
    witnessId = randomUUID();
    const { error } = await getServiceRoleClient().from('audit_logs').insert({
        id: witnessId, user_role: 'SYSTEM', action: 'TEST_A24_RLS', object_type: 'tests', metadata: { suite: 'audit-logs-rls' },
    });
    assert.equal(error, null, `ligne témoin : ${error?.message}`);
});

after(async () => {
    await assertLot9Invariants('audit-logs-rls');
});

describe('A24 — audit_logs en lecture directe (PostgREST)', () => {
    test('SUPERADMIN lit la ligne témoin (la ligne existe et la politique la laisse passer)', async () => {
        assert.deepEqual(await readWitness('SUPERADMIN'), [witnessId]);
    });

    test('ADMIN ne lit rien du journal, même avec son propre jeton', async () => {
        assert.deepEqual(await readWitness('ADMIN'), [], 'audit_logs lisible par un ADMIN en REST direct : la RLS doit réserver la lecture au SUPERADMIN');
    });

    test('CLIENT ne lit rien du journal', async () => {
        assert.deepEqual(await readWitness('CLIENT'), []);
    });
});

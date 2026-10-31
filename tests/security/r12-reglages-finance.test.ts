/**
 * R12 — Lot 3.1 (contrat A) : les réglages financiers (clés finance.*) ne s'écrivent que par la RPC
 * finance_setting_set, réservée au serveur et au SUPERADMIN. Un compte ADMIN connecté (clé anon +
 * signInWithPassword) ne peut ni créer, ni modifier, ni supprimer une clé finance.* par REST, ni
 * appeler la RPC en se faisant passer pour le SUPERADMIN, ni écrire l'historique.
 * Rouge avant correctif : les clés finance.* n'existent pas, et la politique
 * platform_settings_admin_write (0007_superadmin_complete.sql:112-113, USING is_admin()) laisse tout
 * ADMIN écrire n'importe quelle clé.
 */
import '../helpers/env';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import { assertDenied, signInFixture, uniqueSuffix } from './helpers';

const KEY = 'finance.service_fee_rate';

async function readValue(client: SupabaseClient, key: string): Promise<unknown> {
    const { data, error } = await client.from('platform_settings').select('key, value').eq('key', key).maybeSingle();
    assert.equal(error, null, `lecture de ${key} : ${error?.code} ${error?.message}`);
    return data ? (data as { value: unknown }).value : undefined;
}

describe('R12 — réglages financiers', () => {
    test('un ADMIN ne modifie pas une clé finance.* par REST (update ni upsert)', async () => {
        const admin = await signInFixture('ADMIN');
        const original = await readValue(admin.client, KEY);
        assert.ok(original !== undefined, `${KEY} absente : le lot 3 crée les clés finance.*`);
        try {
            const upd = await admin.client.from('platform_settings').update({ value: { value: 49 } }).eq('key', KEY).select('key');
            assert.ok(upd.error || (upd.data ?? []).length === 0, `update accepté : ${JSON.stringify(upd.data)}`);
            const ups = await admin.client.from('platform_settings').upsert({ key: KEY, value: { value: 49 } }, { onConflict: 'key' }).select('key');
            assert.ok(ups.error || (ups.data ?? []).length === 0, `upsert accepté : ${JSON.stringify(ups.data)}`);
            assert.deepEqual(await readValue(admin.client, KEY), original, 'valeur inchangée');
        } finally {
            const now = await readValue(admin.client, KEY);
            if (JSON.stringify(now) !== JSON.stringify(original)) {
                await admin.client.from('platform_settings').update({ value: original }).eq('key', KEY);
            }
        }
    });

    test('un ADMIN ne crée pas de clé finance.* par REST', async () => {
        const admin = await signInFixture('ADMIN');
        const key = `finance.r12_${uniqueSuffix().toLowerCase()}`;
        const { error } = await admin.client.from('platform_settings').insert({ key, value: { value: 1 }, description: 'R12' });
        try {
            assertDenied(error, `création de ${key} par un ADMIN`);
        } finally {
            if (!error) await admin.client.from('platform_settings').delete().eq('key', key);
        }
    });

    test('un ADMIN ne supprime pas une clé finance.* par REST', async () => {
        const admin = await signInFixture('ADMIN');
        const original = await readValue(admin.client, KEY);
        assert.ok(original !== undefined, `${KEY} absente : le lot 3 crée les clés finance.*`);
        const del = await admin.client.from('platform_settings').delete().eq('key', KEY).select('key');
        try {
            assert.ok(del.error || (del.data ?? []).length === 0, `suppression acceptée : ${JSON.stringify(del.data)}`);
            assert.ok((await readValue(admin.client, KEY)) !== undefined, `${KEY} supprimée par un ADMIN`);
        } finally {
            if ((await readValue(admin.client, KEY)) === undefined) {
                await admin.client.from('platform_settings').insert({ key: KEY, value: original });
            }
        }
    });

    test('un ADMIN n’appelle pas finance_setting_set, même en se déclarant SUPERADMIN', async () => {
        const admin = await signInFixture('ADMIN');
        const superadmin = await signInFixture('SUPERADMIN');
        for (const actor of [admin.userId, superadmin.userId]) {
            const { error } = await admin.client.rpc('finance_setting_set', { p_key: KEY, p_value: { value: 12 }, p_actor: actor, p_reason: 'R12' });
            assertDenied(error, `finance_setting_set appelée par un ADMIN (p_actor ${actor === admin.userId ? 'ADMIN' : 'SUPERADMIN'})`);
        }
    });

    test('un ADMIN n’écrit pas l’historique des réglages', async () => {
        const admin = await signInFixture('ADMIN');
        const { error } = await admin.client.from('platform_settings_history').insert({ key: KEY, old_value: { value: 5 }, new_value: { value: 0 }, changed_by: admin.userId, reason: 'R12' });
        assertDenied(error, 'écriture directe de platform_settings_history par un ADMIN');
    });
});

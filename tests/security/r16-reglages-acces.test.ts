/**
 * R16 — Lot 4 (contrat A) : les réglages access.* ne s'écrivent, comme les finance.* (R12), que par la
 * RPC finance_setting_set, réservée au serveur et au SUPERADMIN. Un compte ADMIN connecté (clé anon +
 * signInWithPassword) ne peut ni modifier, ni créer, ni supprimer une clé access.* par REST.
 * Garde-fou : la politique est posée par la migration 20261101000009 (lot 4) ; ce test le vérifie.
 */
import '../helpers/env';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import { assertDenied, signInFixture, uniqueSuffix } from './helpers';

const KEY = 'access.scan_window_before_hours';

async function readValue(client: SupabaseClient, key: string): Promise<unknown> {
    const { data, error } = await client.from('platform_settings').select('key, value').eq('key', key).maybeSingle();
    assert.equal(error, null, `lecture de ${key} : ${error?.code} ${error?.message}`);
    return data ? (data as { value: unknown }).value : undefined;
}

describe('R16 — réglages du contrôle d’accès', () => {
    test('un ADMIN ne modifie pas une clé access.* par REST (update ni upsert)', async () => {
        const admin = await signInFixture('ADMIN');
        const original = await readValue(admin.client, KEY);
        assert.ok(original !== undefined, `${KEY} absente : le lot 4 crée les clés access.*`);
        try {
            const upd = await admin.client.from('platform_settings').update({ value: { value: 48 } }).eq('key', KEY).select('key');
            assert.ok(upd.error || (upd.data ?? []).length === 0, `update accepté : ${JSON.stringify(upd.data)}`);
            const ups = await admin.client.from('platform_settings').upsert({ key: KEY, value: { value: 48 } }, { onConflict: 'key' }).select('key');
            assert.ok(ups.error || (ups.data ?? []).length === 0, `upsert accepté : ${JSON.stringify(ups.data)}`);
            assert.deepEqual(await readValue(admin.client, KEY), original, 'valeur inchangée');
        } finally {
            const now = await readValue(admin.client, KEY);
            if (JSON.stringify(now) !== JSON.stringify(original)) {
                await admin.client.from('platform_settings').update({ value: original }).eq('key', KEY);
            }
        }
    });

    test('un ADMIN ne crée ni ne supprime de clé access.* par REST', async () => {
        const admin = await signInFixture('ADMIN');
        const key = `access.r16_${uniqueSuffix().toLowerCase()}`;
        const { error } = await admin.client.from('platform_settings').insert({ key, value: { value: 1 }, description: 'R16' });
        try {
            assertDenied(error, `création de ${key} par un ADMIN`);
        } finally {
            if (!error) await admin.client.from('platform_settings').delete().eq('key', key);
        }
        const original = await readValue(admin.client, KEY);
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
});

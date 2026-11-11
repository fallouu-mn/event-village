/**
 * R22 — Lot 6 (contrat I1.4) : les réglages notif.* ne s'écrivent, comme les finance.* (R12) et les
 * access.* (R16), que par la RPC finance_setting_set, réservée au serveur et au SUPERADMIN. Un compte
 * ADMIN ou SUPERADMIN connecté (clé anon + signInWithPassword) ne peut ni modifier, ni créer, ni
 * supprimer une clé notif.* par REST.
 *
 * Rouge avant correctif : la politique platform_settings_admin_write (20261101000009_lot4_reglages_acces.sql)
 * n'exclut que finance.% et access.% : un ADMIN crée librement une clé notif.* par REST ; les 9 clés du
 * contrat I1 n'existent pas encore (migration 20261103000003), d'où l'échec des cas qui les lisent.
 * Pas d'assertNotificationInvariants ici : la règle du lot 1A (clé anon seule, aucune connexion
 * privilégiée dans tests/security) l'interdit ; la suite n'écrit rien dans la boîte d'envoi.
 * Lot 7 (7.0 a, T5) : liste des clés à jour (10) : notif.sms_daily_alert supprimée (D15),
 * notif.sms_optional_daily_cap et notif.free_ticket_reminder_sms ajoutées (M1) ; rouge jusqu'à fix(7.0a).
 * Lot 9 bis (R31, T55) : 11 clés, + notif.sms_essential_daily_alert (contrat 12.1) ; rouge jusqu'à M01 (clé absente).
 */
import '../helpers/env';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import { assertDenied, signInFixture, uniqueSuffix } from './helpers';

const KEY = 'notif.reminder_h3_hours';
const KEYS = [
    'notif.reminder_j1_enabled', 'notif.reminder_j1_hour', 'notif.reminder_h3_enabled', 'notif.reminder_h3_hours',
    'notif.j1_sms', 'notif.h3_sms', 'notif.sms_quiet_start', 'notif.sms_quiet_end',
    'notif.sms_optional_daily_cap', 'notif.free_ticket_reminder_sms', 'notif.sms_essential_daily_alert',
];

async function readValue(client: SupabaseClient, key: string): Promise<unknown> {
    const { data, error } = await client.from('platform_settings').select('key, value').eq('key', key).maybeSingle();
    assert.equal(error, null, `lecture de ${key} : ${error?.code} ${error?.message}`);
    return data ? (data as { value: unknown }).value : undefined;
}

describe('R22 — réglages des notifications', () => {
    test('un ADMIN ne modifie aucune des 11 clés notif.* par REST (update ni upsert)', async () => {
        const admin = await signInFixture('ADMIN');
        for (const key of KEYS) {
            const original = await readValue(admin.client, key);
            assert.ok(original !== undefined, `${key} absente : les lots 6 et 7 créent les clés notif.* (migrations 20261103000003, 20261105000001)`);
            try {
                const upd = await admin.client.from('platform_settings').update({ value: { value: 99 } }).eq('key', key).select('key');
                assert.ok(upd.error || (upd.data ?? []).length === 0, `${key} : update accepté : ${JSON.stringify(upd.data)}`);
                const ups = await admin.client.from('platform_settings').upsert({ key, value: { value: 99 } }, { onConflict: 'key' }).select('key');
                assert.ok(ups.error || (ups.data ?? []).length === 0, `${key} : upsert accepté : ${JSON.stringify(ups.data)}`);
                assert.deepEqual(await readValue(admin.client, key), original, `${key} : valeur inchangée`);
            } finally {
                const now = await readValue(admin.client, key);
                if (JSON.stringify(now) !== JSON.stringify(original)) {
                    await admin.client.from('platform_settings').update({ value: original }).eq('key', key);
                }
            }
        }
    });

    test('un ADMIN et un SUPERADMIN ne créent pas de clé notif.* par REST', async () => {
        for (const who of ['ADMIN', 'SUPERADMIN'] as const) {
            const account = await signInFixture(who);
            const key = `notif.r22_${uniqueSuffix().toLowerCase()}`;
            const { error } = await account.client.from('platform_settings').insert({ key, value: { value: 1 }, description: 'R22' });
            try {
                assertDenied(error, `création de ${key} par un ${who}`);
            } finally {
                if (!error) await account.client.from('platform_settings').delete().eq('key', key);
            }
        }
    });

    test('un ADMIN ne supprime pas de clé notif.* par REST', async () => {
        const admin = await signInFixture('ADMIN');
        const original = await readValue(admin.client, KEY);
        assert.ok(original !== undefined, `${KEY} absente : le lot 6 crée les clés notif.* (migration 20261103000003)`);
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

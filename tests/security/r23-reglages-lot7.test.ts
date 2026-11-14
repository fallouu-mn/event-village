/**
 * R23 — Lot 7 (contrat, section 4.1, M1.5) : les réglages du lot 7 (notif.sms_optional_daily_cap,
 * notif.free_ticket_reminder_sms, interrupteurs features.*) ne s'écrivent, comme les finance.*, access.* et
 * notif.* (R12, R16, R22), que par la RPC finance_setting_set, réservée au serveur et au SUPERADMIN. Un ADMIN
 * connecté (clé anon + signInWithPassword) ne peut ni modifier (update, upsert), ni créer, ni supprimer ces
 * clés par REST : la politique platform_settings_admin_write exclut aussi features.%.
 * Témoin : le SUPERADMIN modifie notif.sms_optional_daily_cap et features.halls_enabled par la route
 * PUT /api/admin/finance-settings (jeton de sa session), valeur restaurée ensuite par la même route.
 *
 * Rouge avant correctif (fix(7.0a), migration 20261105000001) : les trois clés n'existent pas (les cas qui
 * les lisent échouent en le disant) ; la politique n'exclut pas features.% : un ADMIN crée librement une
 * clé features.* par REST ; la route refuse les clés features.* (schéma finance|access|notif) et
 * finance_setting_set répond UNKNOWN_KEY.
 * Pas d'assertTerrainInvariants ici : la règle du lot 1A (clé anon seule, aucune connexion privilégiée dans
 * tests/security) l'interdit ; la suite n'écrit rien dans la boîte d'envoi.
 */
import '../helpers/env';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import { NextRequest } from 'next/server';
import { assertDenied, signInFixture, stepUpFixture, uniqueSuffix } from './helpers';

const KEYS = ['notif.sms_optional_daily_cap', 'notif.free_ticket_reminder_sms', 'features.halls_enabled'] as const;
/** Valeur d'écriture de mauvaise foi, différente de toute valeur admise. */
const FORGED: Record<(typeof KEYS)[number], unknown> = {
    'notif.sms_optional_daily_cap': 999_999,
    'notif.free_ticket_reminder_sms': 'SAME_AS_PAID',
    'features.halls_enabled': true,
};

async function readValue(client: SupabaseClient, key: string): Promise<unknown> {
    const { data, error } = await client.from('platform_settings').select('key, value').eq('key', key).maybeSingle();
    assert.equal(error, null, `lecture de ${key} : ${error?.code} ${error?.message}`);
    return data ? (data as { value: unknown }).value : undefined;
}

async function accessToken(client: SupabaseClient): Promise<string> {
    const { data, error } = await client.auth.getSession();
    assert.equal(error, null, `session : ${error?.message}`);
    assert.ok(data.session?.access_token, 'jeton de session attendu');
    return data.session!.access_token;
}

describe('R23 — réglages du lot 7 (budget SMS optionnel, billets gratuits, interrupteurs)', () => {
    test('un ADMIN ne modifie aucune des clés du lot 7 par REST (update ni upsert), aucune ligne touchée', async () => {
        const admin = await signInFixture('ADMIN');
        for (const key of KEYS) {
            const original = await readValue(admin.client, key);
            assert.ok(original !== undefined, `${key} absente : le lot 7 crée cette clé (migration 20261105000001)`);
            try {
                const upd = await admin.client.from('platform_settings').update({ value: { value: FORGED[key] } }).eq('key', key).select('key');
                assert.ok(upd.error || (upd.data ?? []).length === 0, `${key} : update accepté : ${JSON.stringify(upd.data)}`);
                const ups = await admin.client.from('platform_settings').upsert({ key, value: { value: FORGED[key] } }, { onConflict: 'key' }).select('key');
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

    test('un ADMIN ne crée pas de clé features.* ni notif.* par REST', async () => {
        const admin = await signInFixture('ADMIN');
        for (const prefix of ['features', 'notif'] as const) {
            const key = `${prefix}.r23_${uniqueSuffix().toLowerCase()}`;
            const { error } = await admin.client.from('platform_settings').insert({ key, value: { value: true }, description: 'R23' });
            try {
                assertDenied(error, `création de ${key} par un ADMIN`);
                assert.equal(await readValue(admin.client, key), undefined, `${key} : aucune ligne créée`);
            } finally {
                if (!error) await admin.client.from('platform_settings').delete().eq('key', key);
            }
        }
    });

    test('un ADMIN ne supprime aucune des clés du lot 7 par REST', async () => {
        const admin = await signInFixture('ADMIN');
        for (const key of KEYS) {
            const original = await readValue(admin.client, key);
            assert.ok(original !== undefined, `${key} absente : le lot 7 crée cette clé (migration 20261105000001)`);
            const del = await admin.client.from('platform_settings').delete().eq('key', key).select('key');
            try {
                assert.ok(del.error || (del.data ?? []).length === 0, `${key} : suppression acceptée : ${JSON.stringify(del.data)}`);
                assert.ok((await readValue(admin.client, key)) !== undefined, `${key} supprimée par un ADMIN`);
            } finally {
                if ((await readValue(admin.client, key)) === undefined) {
                    await admin.client.from('platform_settings').insert({ key, value: original });
                }
            }
        }
    });

    test('témoin : le SUPERADMIN modifie notif.sms_optional_daily_cap et features.halls_enabled par PUT /api/admin/finance-settings (puis restaure)', async () => {
        const superadmin = await signInFixture('SUPERADMIN');
        // Lot 9 quinquies (A3, A4 ; modification signalée au rapport) : la route de l'administration exige le second facteur
        await stepUpFixture('SUPERADMIN');
        const token = await accessToken(superadmin.client);
        const { PUT } = (await import('../../app/api/admin/finance-settings/route')) as { PUT: (req: NextRequest) => Promise<Response> };
        const put = async (key: string, value: unknown) => {
            const res = await PUT(new NextRequest('http://localhost:3000/api/admin/finance-settings', {
                method: 'PUT',
                headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
                body: JSON.stringify({ key, value, reason: 'témoin R23, lot 7' }),
            }));
            return { status: res.status, body: (await res.json()) as Record<string, unknown> };
        };
        const changes: Array<[string, (v: unknown) => unknown]> = [
            ['notif.sms_optional_daily_cap', (v) => (v === 650 ? 651 : 650)],
            ['features.halls_enabled', (v) => !(v as { value?: unknown } | undefined)?.value],
        ];
        for (const [key, next] of changes) {
            const original = await readValue(superadmin.client, key);
            assert.ok(original !== undefined, `${key} absente : le lot 7 crée cette clé (migration 20261105000001)`);
            const inner = (original as { value?: unknown }).value;
            const target = key === 'features.halls_enabled' ? next(original) : next(inner);
            const res = await put(key, target);
            try {
                assert.equal(res.status, 200, `${key} = ${JSON.stringify(target)} par le SUPERADMIN : HTTP ${res.status} ${JSON.stringify(res.body)}`);
                assert.deepEqual(await readValue(superadmin.client, key), { value: target }, `${key} : valeur appliquée`);
            } finally {
                if (JSON.stringify(await readValue(superadmin.client, key)) !== JSON.stringify(original)) {
                    const back = await put(key, inner);
                    assert.equal(back.status, 200, `${key} : restauration HTTP ${back.status} ${JSON.stringify(back.body)}`);
                }
            }
        }
    });
});

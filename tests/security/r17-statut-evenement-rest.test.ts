/**
 * R17 — Lot 5, sécurité urgente A7 : un ADMIN connecté (clé anon + signInWithPassword) ne change pas
 * events.status par l'API REST, ni par UPDATE ni par UPSERT. Le statut ne change que par une
 * transition (RPC event_transition, section D4 du contrat) : la garde D3 (trigger BEFORE UPDATE,
 * ERRCODE EV422) refuse toute autre modification, y compris par la politique events_admin_manage.
 *
 * Rouge avant correctif : events_admin_manage (FOR ALL USING is_admin() WITH CHECK is_admin(),
 * supabase/migrations/20261031000005_lot1b4_partenaire_ecritures.sql:21-22) laisse l'ADMIN écrire
 * n'importe quel statut par REST, et aucun trigger ne garde events.status.
 *
 * Cible : le brouillon du seed A_BROUILLON, vers des statuts non publics (VALIDE, EN_ATTENTE), pour ne
 * rien exposer pendant le test. Si une écriture passe (base non corrigée), l'ADMIN remet le statut
 * d'origine dans un finally, par le même chemin REST que l'attaque.
 * (Clé anon + signInWithPassword uniquement.)
 */
import '../helpers/env';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import { FIXTURE_EVENTS } from '../helpers/fixture-data';
import { signInFixture } from './helpers';

type Row = Record<string, unknown>;

async function adminAndDraft(): Promise<{ client: SupabaseClient; row: Row }> {
    const admin = await signInFixture('ADMIN');
    const { data, error } = await admin.client.from('events').select('*').eq('slug', FIXTURE_EVENTS.A_BROUILLON.slug).single();
    assert.equal(error, null, `lecture du brouillon A_BROUILLON par l’ADMIN : ${error?.message}`);
    const row = data as Row;
    assert.equal(row.status, 'BROUILLON', 'précondition : A_BROUILLON est un brouillon');
    return { client: admin.client, row };
}

async function statusOf(client: SupabaseClient, id: unknown): Promise<string> {
    const { data, error } = await client.from('events').select('status').eq('id', id as string).single();
    assert.equal(error, null, `relecture du statut : ${error?.message}`);
    return String(data.status);
}

/** Remise en état si l'écriture a été acceptée (base non corrigée). */
async function restoreStatus(client: SupabaseClient, id: unknown, original: string): Promise<void> {
    if (await statusOf(client, id) === original) return;
    const { error } = await client.from('events').update({ status: original }).eq('id', id as string);
    assert.equal(error, null, `remise en état du statut ${original} : ${error?.message}`);
    assert.equal(await statusOf(client, id), original, 'remise en état du statut du brouillon du seed');
}

describe('R17 — events.status non modifiable par REST, même par un ADMIN', () => {
    test('ADMIN : UPDATE events.status BROUILLON → VALIDE par REST → refusé (garde EV422), statut inchangé', async () => {
        const { client, row } = await adminAndDraft();
        try {
            const res = await client.from('events').update({ status: 'VALIDE' }).eq('id', row.id as string).select('id, status');
            const now = await statusOf(client, row.id);
            assert.equal(now, 'BROUILLON', `statut changé par REST : ${now} (réponse ${JSON.stringify(res.data)})`);
            assert.ok(res.error, `la base doit refuser la mise à jour du statut, reçu ${JSON.stringify(res.data)}`);
        } finally {
            await restoreStatus(client, row.id, 'BROUILLON');
        }
    });

    test('ADMIN : UPSERT de la ligne complète avec status EN_ATTENTE par REST → statut inchangé', async () => {
        const { client, row } = await adminAndDraft();
        try {
            const res = await client.from('events').upsert({ ...row, status: 'EN_ATTENTE' }, { onConflict: 'id' }).select('id, status');
            const now = await statusOf(client, row.id);
            assert.equal(now, 'BROUILLON', `statut changé par UPSERT REST : ${now} (réponse ${JSON.stringify(res.data)}, erreur ${res.error?.message ?? 'aucune'})`);
            const written = (res.data ?? []) as Row[];
            assert.ok(!written.some((r) => r.status === 'EN_ATTENTE'), `UPSERT annoncé comme écrit avec EN_ATTENTE : ${JSON.stringify(written)}`);
        } finally {
            await restoreStatus(client, row.id, 'BROUILLON');
        }
    });
});

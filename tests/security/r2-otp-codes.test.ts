/**
 * Lot 1A.2 (R2) — la table otp_codes ne doit être ni lisible ni modifiable par l'API publique.
 *
 * Lot 1C.4 : le refus doit être un refus de PRIVILÈGE (42501). Les requêtes n'utilisent que des
 * colonnes présentes avant et après le hachage des codes (id, phone, expires_at, verified) : une
 * erreur « colonne inexistante » ne peut plus passer pour un refus.
 */
import '../helpers/env';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import type { PostgrestError } from '@supabase/supabase-js';
import { anonClient, signInFixture } from './helpers';

const OTP_ROW = () => ({
    phone: `+22170${Math.floor(1_000_000 + Math.random() * 8_999_999)}`,
    expires_at: new Date(Date.now() + 600_000).toISOString(),
    verified: false,
});

function assertPrivilegeDenied(error: PostgrestError | null, what: string): void {
    assert.ok(error, `${what} : l'opération a été ACCEPTÉE alors qu'elle doit être refusée`);
    assert.ok(
        error.code === '42501' || /permission denied/i.test(error.message),
        `${what} : refus de privilège attendu (42501), obtenu code=${error.code} message=${error.message}`
    );
}

describe('R2 — otp_codes inaccessible par anon et authenticated', () => {
    test('anon : lecture refusée', async () => {
        const { error } = await anonClient().from('otp_codes').select('id, phone').limit(5);
        assertPrivilegeDenied(error, 'anon SELECT otp_codes');
    });

    test('anon : insertion refusée', async () => {
        const { error } = await anonClient().from('otp_codes').insert(OTP_ROW());
        assertPrivilegeDenied(error, 'anon INSERT otp_codes');
    });

    test('authenticated (compte CLIENT gratuit) : lecture, insertion, modification et suppression refusées', async () => {
        const { client } = await signInFixture('CLIENT');
        assertPrivilegeDenied((await client.from('otp_codes').select('id, phone').limit(5)).error, 'authenticated SELECT otp_codes');
        assertPrivilegeDenied((await client.from('otp_codes').insert(OTP_ROW())).error, 'authenticated INSERT otp_codes');
        assertPrivilegeDenied((await client.from('otp_codes').update({ verified: true }).eq('verified', false)).error, 'authenticated UPDATE otp_codes');
        assertPrivilegeDenied((await client.from('otp_codes').delete().eq('verified', false)).error, 'authenticated DELETE otp_codes');
    });
});

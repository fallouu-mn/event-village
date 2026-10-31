/**
 * Lot 1A.2 (R2) — la table otp_codes ne doit être ni lisible ni modifiable par l'API publique.
 */
import '../helpers/env';
import { describe, test } from 'node:test';
import { anonClient, assertDenied, signInFixture } from './helpers';

const OTP_ROW = () => ({
    phone: `+22170${Math.floor(1_000_000 + Math.random() * 8_999_999)}`,
    code: '123456',
    expires_at: new Date(Date.now() + 600_000).toISOString(),
    verified: false,
});

describe('R2 — otp_codes inaccessible par anon et authenticated', () => {
    test('anon : lecture refusée', async () => {
        const { error } = await anonClient().from('otp_codes').select('phone, code').limit(5);
        assertDenied(error, 'anon SELECT otp_codes');
    });

    test('anon : insertion refusée', async () => {
        const { error } = await anonClient().from('otp_codes').insert(OTP_ROW());
        assertDenied(error, 'anon INSERT otp_codes');
    });

    test('authenticated (compte CLIENT gratuit) : lecture, insertion, modification et suppression refusées', async () => {
        const { client } = await signInFixture('CLIENT');
        assertDenied((await client.from('otp_codes').select('phone, code').limit(5)).error, 'authenticated SELECT otp_codes');
        assertDenied((await client.from('otp_codes').insert(OTP_ROW())).error, 'authenticated INSERT otp_codes');
        assertDenied((await client.from('otp_codes').update({ verified: true }).eq('verified', false)).error, 'authenticated UPDATE otp_codes');
        assertDenied((await client.from('otp_codes').delete().eq('verified', false)).error, 'authenticated DELETE otp_codes');
    });
});

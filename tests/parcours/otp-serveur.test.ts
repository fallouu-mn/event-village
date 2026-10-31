/**
 * Lot 1A.2 — les parcours OTP serveur fonctionnent toujours après la fermeture de otp_codes
 * aux rôles API : inscription client → code reçu par SMS (faux adaptateur) → vérification
 * par la route serveur, en passant par la table otp_codes (cache mémoire vidé).
 */
import '../helpers/env';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getServiceRoleClient } from '../../lib/supabase/server';
import { otpMemoryCache } from '../../lib/sms/otp-cache';
import { POST as registerClient } from '../../app/api/auth/register/route';
import { POST as verifyOtp } from '../../app/api/auth/verify-otp/route';
import { getFakes } from '../fakes';
import { jsonRequest, randomEmail, randomSenegalPhone, STRONG_PASSWORD } from './helpers';

test('inscription client → OTP par SMS → vérification serveur via la table otp_codes', async () => {
    const { sms } = getFakes();
    const phone = randomSenegalPhone('77');
    const res = await registerClient(jsonRequest('/api/auth/register', {
        firstName: 'Mariama',
        lastName: 'Otp',
        phone,
        email: randomEmail('otp'),
        password: STRONG_PASSWORD,
        confirmPassword: STRONG_PASSWORD,
    }));
    const body = await res.json();
    assert.equal(res.status, 200, `inscription : HTTP ${res.status} ${JSON.stringify(body)}`);

    const received = sms.messagesTo(phone);
    assert.equal(received.length, 1, 'un SMS OTP envoyé (faux adaptateur)');
    const code = received[0].message.match(/\b(\d{6})\b/)?.[1];
    assert.ok(code, `code OTP lisible dans le SMS : ${received[0].message}`);

    // Force le chemin base de données (otp_codes) au lieu du cache mémoire du processus.
    otpMemoryCache.delete(phone);

    const verify = await verifyOtp(jsonRequest('/api/auth/verify-otp', { phone, otpCode: code }));
    const verifyBody = await verify.json();
    assert.equal(verify.status, 200, `vérification OTP : HTTP ${verify.status} ${JSON.stringify(verifyBody)}`);

    const { data: row, error } = await getServiceRoleClient()
        .from('otp_codes')
        .select('verified')
        .eq('phone', phone)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
    assert.equal(error, null, `lecture otp_codes (service_role) : ${error?.message}`);
    assert.equal(row.verified, true, 'le code doit être marqué vérifié par la route serveur');
});

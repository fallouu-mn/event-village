/**
 * Lot 1C.4 — codes OTP hachés (HMAC-SHA256, secret serveur OTP_HASH_SECRET).
 *  - Après émission, aucune colonne de otp_codes ne contient le code en clair ; l'empreinte est
 *    un hexadécimal de 64 caractères.
 *  - La vérification fonctionne, y compris depuis une autre instance (rien en mémoire).
 *  - OTP_HASH_SECRET est obligatoire (lib/env.ts), sans valeur de repli.
 */
import '../helpers/env';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { getServiceRoleClient } from '../../lib/supabase/server';
import { getServerEnv, resetServerEnvCache } from '../../lib/env';
import { POST as sendOtp } from '../../app/api/auth/send-otp/route';
import { POST as verifyOtp } from '../../app/api/auth/verify-otp/route';
import { getFakes } from '../fakes';
import { jsonRequest, randomSenegalPhone } from './helpers';

function lastCodeTo(phone: string): string {
    const codes = getFakes().sms.messagesTo(phone).map((m) => m.message.match(/\b(\d{6})\b/)?.[1]).filter((c): c is string => Boolean(c));
    assert.ok(codes.length > 0, `aucun code reçu au ${phone}`);
    return codes[codes.length - 1];
}

describe('Codes OTP hachés', () => {
    test('après émission, aucune colonne ne contient le code en clair ; la vérification fonctionne depuis une autre instance', async () => {
        const phone = randomSenegalPhone('76');
        const sent = await sendOtp(jsonRequest('/api/auth/send-otp', { phone }));
        assert.equal(sent.status, 200, `send-otp : HTTP ${sent.status} ${JSON.stringify(await sent.json())}`);
        const code = lastCodeTo(phone);

        const { data: row, error } = await getServiceRoleClient()
            .from('otp_codes')
            .select('*')
            .eq('phone', phone)
            .order('created_at', { ascending: false })
            .limit(1)
            .single();
        assert.equal(error, null, `lecture de otp_codes : ${error?.message}`);
        const clear = Object.entries(row as Record<string, unknown>).filter(([, v]) => v !== null && String(v).includes(code));
        assert.deepEqual(clear.map(([k]) => k), [], `colonnes contenant le code en clair : ${clear.map(([k]) => k).join(', ')}`);
        assert.match(String((row as Record<string, unknown>).code_hash), /^[0-9a-f]{64}$/, 'empreinte HMAC-SHA256 en hexadécimal');

        (globalThis as { otpMemoryCache?: Map<string, unknown> }).otpMemoryCache?.clear();
        const wrong = await verifyOtp(jsonRequest('/api/auth/verify-otp', { phone, otpCode: code === '000000' ? '111111' : '000000' }));
        assert.equal(wrong.status, 400, 'un code faux est refusé');
        const ok = await verifyOtp(jsonRequest('/api/auth/verify-otp', { phone, otpCode: code }));
        assert.equal(ok.status, 200, `verify-otp : HTTP ${ok.status} ${JSON.stringify(await ok.json())}`);
    });

    test('OTP_HASH_SECRET est obligatoire, sans valeur de repli', () => {
        const saved = process.env.OTP_HASH_SECRET;
        delete process.env.OTP_HASH_SECRET;
        resetServerEnvCache();
        try {
            assert.throws(() => getServerEnv(), /OTP_HASH_SECRET/, 'getServerEnv doit refuser un environnement sans OTP_HASH_SECRET');
        } finally {
            if (saved !== undefined) process.env.OTP_HASH_SECRET = saved;
            resetServerEnvCache();
        }
    });
});

/**
 * Lot 1A.2 — les parcours OTP serveur fonctionnent toujours après la fermeture de otp_codes
 * aux rôles API.
 *
 * 1. Chemin base de données : /api/auth/send-otp écrit le code dans otp_codes (service_role),
 *    /api/auth/verify-otp le relit (cache mémoire du processus vidé) et le marque vérifié.
 * 2. Inscription client : /api/auth/register → SMS → /api/auth/verify-otp.
 *
 * Défaut préexistant, hors périmètre du lot 1A : /api/auth/register et /api/partner/register
 * insèrent une colonne user_id absente de otp_codes ; l'insertion échoue sans vérification
 * d'erreur et leur code ne vit que dans le cache mémoire du processus (cas 2). Signalé dans
 * docs/lot1a-rapport.md.
 */
import '../helpers/env';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { getServiceRoleClient } from '../../lib/supabase/server';
import { otpMemoryCache } from '../../lib/sms/otp-cache';
import { POST as sendOtp } from '../../app/api/auth/send-otp/route';
import { POST as registerClient } from '../../app/api/auth/register/route';
import { POST as verifyOtp } from '../../app/api/auth/verify-otp/route';
import { getFakes } from '../fakes';
import { jsonRequest, randomEmail, randomSenegalPhone, STRONG_PASSWORD } from './helpers';

function codeFromLastSms(phone: string): string {
    const received = getFakes().sms.messagesTo(phone);
    assert.ok(received.length >= 1, `un SMS envoyé au ${phone} (faux adaptateur)`);
    const code = received[received.length - 1].message.match(/\b(\d{6})\b/)?.[1];
    assert.ok(code, `code OTP lisible dans le SMS : ${received[received.length - 1].message}`);
    return code;
}

describe('Parcours OTP serveur', () => {
    test('send-otp → otp_codes (service_role) → verify-otp par la base, cache mémoire vidé', async () => {
        const phone = randomSenegalPhone('76');
        const res = await sendOtp(jsonRequest('/api/auth/send-otp', { phone }));
        const body = await res.json();
        assert.equal(res.status, 200, `send-otp : HTTP ${res.status} ${JSON.stringify(body)}`);
        const code = codeFromLastSms(phone);

        const service = getServiceRoleClient();
        const { data: stored, error } = await service.from('otp_codes').select('id, verified').eq('phone', phone).eq('code', code).single();
        assert.equal(error, null, `code persisté dans otp_codes : ${error?.message}`);
        assert.equal(stored.verified, false);

        otpMemoryCache.delete(phone);
        const verify = await verifyOtp(jsonRequest('/api/auth/verify-otp', { phone, otpCode: code }));
        const verifyBody = await verify.json();
        assert.equal(verify.status, 200, `verify-otp : HTTP ${verify.status} ${JSON.stringify(verifyBody)}`);

        const { data: after } = await service.from('otp_codes').select('verified').eq('id', stored.id).single();
        assert.equal(after?.verified, true, 'le code doit être marqué vérifié par la route serveur');
    });

    test('inscription client → OTP par SMS → verify-otp', async () => {
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
        const code = codeFromLastSms(phone);

        const verify = await verifyOtp(jsonRequest('/api/auth/verify-otp', { phone, otpCode: code }));
        const verifyBody = await verify.json();
        assert.equal(verify.status, 200, `verify-otp : HTTP ${verify.status} ${JSON.stringify(verifyBody)}`);
    });
});

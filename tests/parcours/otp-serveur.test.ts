/**
 * Parcours OTP serveur (lots 1A.2 et 1B.7).
 *
 * Le code OTP vit en base (otp_codes, service_role) : la vérification ne dépend plus de la
 * mémoire du processus qui a émis le code. Pour simuler une seconde instance, le cache
 * mémoire historique (globalThis.otpMemoryCache, s'il existe encore) est vidé entre l'émission
 * et la vérification.
 *  1. /api/auth/send-otp → otp_codes → /api/auth/verify-otp.
 *  2. /api/auth/register → otp_codes → /api/auth/verify-otp (lot 1B.7).
 *  3. /api/partner/register → otp_codes → /api/auth/verify-otp (lot 1B.7).
 */
import '../helpers/env';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { getServiceRoleClient } from '../../lib/supabase/server';
import { POST as sendOtp } from '../../app/api/auth/send-otp/route';
import { POST as registerClient } from '../../app/api/auth/register/route';
import { POST as registerPartner } from '../../app/api/partner/register/route';
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

/** Simule une autre instance : plus rien en mémoire du processus émetteur. */
function forgetProcessMemory(): void {
    (globalThis as { otpMemoryCache?: Map<string, unknown> }).otpMemoryCache?.clear();
}

async function assertStoredUnverified(phone: string, code: string): Promise<string> {
    const { data, error } = await getServiceRoleClient().from('otp_codes').select('id, verified').eq('phone', phone).eq('code', code).maybeSingle();
    assert.equal(error, null, `lecture de otp_codes : ${error?.message}`);
    assert.ok(data, `le code envoyé au ${phone} doit être persisté dans otp_codes`);
    assert.equal(data.verified, false);
    return data.id as string;
}

async function verifyFromAnotherInstance(phone: string, code: string, storedId: string): Promise<void> {
    forgetProcessMemory();
    const verify = await verifyOtp(jsonRequest('/api/auth/verify-otp', { phone, otpCode: code }));
    const body = await verify.json();
    assert.equal(verify.status, 200, `verify-otp : HTTP ${verify.status} ${JSON.stringify(body)}`);
    const { data: after } = await getServiceRoleClient().from('otp_codes').select('verified').eq('id', storedId).single();
    assert.equal(after?.verified, true, 'le code doit être marqué vérifié en base');
}

describe('Parcours OTP serveur', () => {
    test('send-otp → otp_codes → verify-otp depuis une autre instance', async () => {
        const phone = randomSenegalPhone('76');
        const res = await sendOtp(jsonRequest('/api/auth/send-otp', { phone }));
        const body = await res.json();
        assert.equal(res.status, 200, `send-otp : HTTP ${res.status} ${JSON.stringify(body)}`);
        const code = codeFromLastSms(phone);
        await verifyFromAnotherInstance(phone, code, await assertStoredUnverified(phone, code));
    });

    test('inscription client → otp_codes → verify-otp depuis une autre instance', async () => {
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
        await verifyFromAnotherInstance(phone, code, await assertStoredUnverified(phone, code));
    });

    test('inscription partenaire → otp_codes → verify-otp depuis une autre instance', async () => {
        const phone = randomSenegalPhone('78');
        const res = await registerPartner(jsonRequest('/api/partner/register', {
            companyName: 'OTP Test SARL',
            description: 'Organisateur fictif créé par la suite de tests OTP.',
            address: '3 rue des Codes',
            city: 'Dakar',
            activities: ['ORGANISATEUR'],
            firstName: 'Ousmane',
            lastName: 'Otp',
            phone,
            email: randomEmail('otp-partenaire'),
            password: STRONG_PASSWORD,
            confirmPassword: STRONG_PASSWORD,
            idCardUrl: 'tests/cni-fictive.pdf',
            businessDocUrl: 'tests/rccm-fictif.pdf',
        }));
        const body = await res.json();
        assert.ok(res.status < 300, `inscription partenaire : HTTP ${res.status} ${JSON.stringify(body)}`);
        const code = codeFromLastSms(phone);
        await verifyFromAnotherInstance(phone, code, await assertStoredUnverified(phone, code));
    });
});

/**
 * Parcours OTP serveur (lots 1A.2 et 1B.7).
 *
 * Le code OTP vit en base (otp_codes, service_role) : la vérification ne dépend plus de la
 * mémoire du processus qui a émis le code. Pour simuler une seconde instance, le cache
 * mémoire historique (globalThis.otpMemoryCache, s'il existe encore) est vidé entre l'émission
 * et la vérification.
 *  1. /api/auth/send-otp → otp_codes → /api/auth/verify-otp.
 *  2. /api/auth/register/start → otp_codes → /api/auth/register (lot 1B.7 ; lot 7, T18, D1 : le code
 *     d'inscription est vérifié et consommé par /api/auth/register avant la création du compte, plus par
 *     /api/auth/verify-otp ; même preuve « vérifiable depuis une autre instance », rouge jusqu'à fix(7.3s)).
 *  3. /api/partner/register → otp_codes → /api/auth/verify-otp (lot 1B.7).
 */
import '../helpers/env';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { getServiceRoleClient } from '../../lib/supabase/server';
import { POST as sendOtp } from '../../app/api/auth/send-otp/route';
// Lot 9 bis (R53, T38) : l'inscription partenaire passe par registerPartnerTwoStep (deux appels de la route).
import { POST as verifyOtp } from '../../app/api/auth/verify-otp/route';
import { getFakes } from '../fakes';
import { freshRegisterIp, jsonRequest, randomEmail, randomSenegalPhone, registerPartnerTwoStep, STRONG_PASSWORD, uploadRegistrationDocuments } from './helpers';
import { registerStart, registerSubmit } from './terrain-helpers';

/** Code du dernier SMS contenant un code à 6 chiffres (l'inscription partenaire envoie ensuite un avis sans code). */
function codeFromLastSms(phone: string): string {
    const received = getFakes().sms.messagesTo(phone);
    assert.ok(received.length >= 1, `un SMS envoyé au ${phone} (faux adaptateur)`);
    const withCode = received.map((m) => m.message.match(/\b(\d{6})\b/)?.[1]).filter((c): c is string => Boolean(c));
    assert.ok(withCode.length >= 1, `aucun code OTP dans les SMS envoyés : ${received.map((m) => m.message).join(' | ')}`);
    return withCode[withCode.length - 1];
}

/** Simule une autre instance : plus rien en mémoire du processus émetteur. */
function forgetProcessMemory(): void {
    (globalThis as { otpMemoryCache?: Map<string, unknown> }).otpMemoryCache?.clear();
}

/**
 * Dernier code non consommé du numéro, persisté en base. Depuis le lot 1C.4 le code n'est plus
 * stocké en clair : la ligne est retrouvée par numéro (le plus récent), sa correspondance avec
 * le code envoyé étant prouvée par la vérification qui suit.
 */
async function assertStoredUnverified(phone: string, _code: string): Promise<string> {
    const { data, error } = await getServiceRoleClient()
        .from('otp_codes')
        .select('id, verified')
        .eq('phone', phone)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
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

    test('A35 : un refus du fournisseur SMS reste au journal, la réponse garde un texte fixe', async () => {
        const phone = randomSenegalPhone('76');
        getFakes().sms.failNext('Requête refusée par le fournisseur SMS (HTTP 400).');
        const res = await sendOtp(jsonRequest('/api/auth/send-otp', { phone }));
        const body = await res.json();
        assert.equal(res.status, 502, `send-otp : HTTP ${res.status} ${JSON.stringify(body)}`);
        assert.ok(typeof body.error === 'string' && body.error.length > 0, 'un message pour l’utilisateur');
        assert.doesNotMatch(body.error, /fournisseur|HTTP \d+/i, `texte fournisseur à l’écran : ${body.error}`);
    });

    test('inscription client (numéro d’abord) → otp_codes → /api/auth/register depuis une autre instance', async () => {
        const phone = randomSenegalPhone('77');
        const start = await registerStart(phone);
        assert.equal(start.status, 200, `démarrage de l'inscription : HTTP ${start.status} ${JSON.stringify(start.body)}`);
        const code = codeFromLastSms(phone);
        const storedId = await assertStoredUnverified(phone, code);
        forgetProcessMemory();
        const res = await registerSubmit({
            phone,
            code,
            firstName: 'Mariama',
            lastName: 'Otp',
            email: randomEmail('otp'),
            password: STRONG_PASSWORD,
        });
        assert.equal(res.status, 200, `inscription : HTTP ${res.status} ${JSON.stringify(res.body)}`);
        const { data: after } = await getServiceRoleClient().from('otp_codes').select('verified').eq('id', storedId).single();
        assert.equal(after?.verified, true, 'le code doit être marqué vérifié en base');
    });

    test('inscription partenaire → otp_codes → code vérifié depuis une autre instance (appel 2 de la route, lot 9 bis R53)', async () => {
        const phone = randomSenegalPhone('78');
        const body = {
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
            ...(await uploadRegistrationDocuments()),
        };
        // Lot 9 bis (T38) : l'appel 1 envoie le code et ne crée rien ; le code est persisté non vérifié, puis l'appel 2,
        // fait comme depuis une autre instance (mémoire du processus vidée), le vérifie en base et crée le compte.
        // Même adresse neuve pour les deux appels (quota PARTNER_REGISTER_PER_IP_HOUR hors du seau « unknown »).
        const ip = freshRegisterIp();
        const first = await registerPartnerTwoStep(body, { stopAfterFirst: true, headers: ip });
        assert.ok(first.first.status < 300, `inscription partenaire, appel 1 : HTTP ${first.first.status} ${JSON.stringify(first.first.body)}`);
        const code = codeFromLastSms(phone);
        const storedId = await assertStoredUnverified(phone, code);
        forgetProcessMemory();
        const { POST: register } = await import('../../app/api/partner/register/route');
        const second = await register(jsonRequest('/api/partner/register', { ...body, otpCode: code }, ip));
        const secondBody = await second.json();
        assert.ok(second.status < 300, `inscription partenaire, appel 2 avec le code : HTTP ${second.status} ${JSON.stringify(secondBody)}`);
        const { data: after } = await getServiceRoleClient().from('otp_codes').select('verified').eq('id', storedId).single();
        assert.equal(after?.verified, true, 'le code doit être marqué vérifié en base');
    });
});

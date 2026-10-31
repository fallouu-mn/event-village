/**
 * Lot 3 (F) — objet des codes OTP (point ouvert n° 9 du lot 1C : « un code d'inscription pourrait
 * servir à une autre vérification du même numéro dans ses 10 minutes » ; CDC §153).
 *  - otp_codes.purpose (LOGIN, REGISTER, CONTROLLER_SETUP, WITHDRAWAL…) ; storeOtp(phone, code,
 *    expiresAt, purpose) et checkStoredOtp / verifyStoredOtp(phone, code, purpose) : un code émis
 *    pour un objet est refusé pour un autre, sans être consommé ;
 *  - deux codes d'objets différents du même numéro coexistent (un nouveau code de retrait n'invalide
 *    pas le code de connexion en attente, et inversement) ;
 *  - routes : un code de connexion (/api/auth/send-otp) ne valide pas un retrait ; un code de retrait
 *    (/api/withdrawals/otp) n'ouvre pas de session (/api/auth/verify-otp).
 * Le module otp-store et les nouvelles routes sont importés dynamiquement (nouvelles signatures).
 */
import '../helpers/env';
import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { POST as sendOtp } from '../../app/api/auth/send-otp/route';
import { POST as verifyOtp } from '../../app/api/auth/verify-otp/route';
import { getFakes } from '../fakes';
import { assertFinanceInvariants } from '../helpers/finance-invariants';
import { randomSenegalPhone } from './helpers';
import { importModule, newBuyer, service } from './paiement-helpers';
import { balanceOf, buyConfirmed, createPartnerEvent, jsonRequest, newPartner, withSettings, type TestPartner } from './finance-helpers';

after(async () => {
    await assertFinanceInvariants('otp-objet');
});

const TEN_MINUTES = 10 * 60 * 1000;

function smsCodes(phoneE164: string): string[] {
    return getFakes().sms.messagesTo(phoneE164)
        .map((m) => m.message.match(/\b(\d{6})\b/)?.[1])
        .filter((c): c is string => Boolean(c));
}

function lastCode(phoneE164: string, before: number): string {
    const codes = smsCodes(phoneE164);
    assert.ok(codes.length > before, `aucun nouveau code reçu au ${phoneE164}`);
    return codes[codes.length - 1];
}

/** Partenaire dont une vente en ligne est disponible tout de suite (retrait de 5 000 F possible). */
async function fundedPartner(label: string): Promise<TestPartner> {
    const partner = await newPartner(label);
    const ev = await createPartnerEvent(partner.partnerId, label, [{ name: 'Standard', price: 10_000, total: 10 }]);
    const buyer = await newBuyer(`${label}-ach`);
    await withSettings({ 'finance.payout_hold_enabled': false }, () => buyConfirmed(buyer, ev, [['Standard', 1]]));
    assert.equal((await balanceOf(partner.userId, 'ORGANISATEUR')).available, 10_000, 'fonds disponibles du partenaire de test');
    return partner;
}

async function withdrawalOtp(user: TestPartner): Promise<string> {
    const { POST } = await importModule('../../app/api/withdrawals/otp/route');
    const before = smsCodes(user.phoneE164).length;
    const res: Response = await POST(jsonRequest('/api/withdrawals/otp', 'POST', user.accessToken, { account: 'ORGANISATEUR' }));
    const body = await res.json();
    assert.equal(res.status, 200, `envoi du code de retrait : HTTP ${res.status} ${JSON.stringify(body)}`);
    return lastCode(user.phoneE164, before);
}

async function postWithdrawal(user: TestPartner, otpCode: string): Promise<{ status: number; body: Record<string, unknown> }> {
    const { POST } = await importModule('../../app/api/withdrawals/request/route');
    const res: Response = await POST(jsonRequest('/api/withdrawals/request', 'POST', user.accessToken, {
        account: 'ORGANISATEUR', amount: 5_000, method: 'MOBILE_MONEY', operator: 'WAVE', phoneNumber: user.phone9, otpCode,
    }, { 'idempotency-key': randomUUID() }));
    return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

async function withdrawalCount(userId: string): Promise<number> {
    const { data, error } = await service.from('withdrawals').select('id').eq('user_id', userId);
    assert.equal(error, null, `retraits : ${error?.message}`);
    return data?.length ?? 0;
}

describe('Objet des codes OTP', () => {
    test('storeOtp / verifyStoredOtp : un code LOGIN est refusé pour WITHDRAWAL sans être consommé, puis accepté pour LOGIN', async () => {
        const store = await importModule('../../lib/auth/otp-store');
        const phone = randomSenegalPhone('76');
        await store.storeOtp(phone, '482913', new Date(Date.now() + TEN_MINUTES), 'LOGIN');

        const { data: row, error } = await service.from('otp_codes').select('purpose, verified').eq('phone', phone).order('created_at', { ascending: false }).limit(1).single();
        assert.equal(error, null, `lecture de otp_codes.purpose : ${error?.message}`);
        assert.equal(row.purpose, 'LOGIN', 'objet du code enregistré');

        const cross = await store.verifyStoredOtp(phone, '482913', 'WITHDRAWAL');
        assert.equal(cross.ok, false, `un code de connexion ne vaut pas pour un retrait : ${JSON.stringify(cross)}`);
        const own = await store.verifyStoredOtp(phone, '482913', 'LOGIN');
        assert.equal(own.ok, true, `le code reste valable pour son objet : ${JSON.stringify(own)}`);
    });

    test('un code REGISTER et un code WITHDRAWAL du même numéro coexistent ; chacun ne vaut que pour son objet', async () => {
        const store = await importModule('../../lib/auth/otp-store');
        const phone = randomSenegalPhone('77');
        const expires = new Date(Date.now() + TEN_MINUTES);
        await store.storeOtp(phone, '314159', expires, 'REGISTER');
        await store.storeOtp(phone, '271828', expires, 'WITHDRAWAL');

        assert.equal((await store.checkStoredOtp(phone, '314159', 'WITHDRAWAL')).ok, false, 'code d’inscription refusé pour un retrait');
        assert.equal((await store.checkStoredOtp(phone, '271828', 'REGISTER')).ok, false, 'code de retrait refusé pour une inscription');
        assert.equal((await store.verifyStoredOtp(phone, '314159', 'REGISTER')).ok, true, 'le code d’inscription n’est pas remplacé par le code de retrait émis après lui');
        assert.equal((await store.verifyStoredOtp(phone, '271828', 'WITHDRAWAL')).ok, true, 'le code de retrait est valable pour le retrait');
    });

    test('route de retrait : un code de connexion est refusé, le code WITHDRAWAL est accepté, le code de connexion reste valable pour la connexion', async () => {
        const partner = await fundedPartner('otp-route');
        const before = smsCodes(partner.phoneE164).length;
        const sent = await sendOtp(jsonRequest('/api/auth/send-otp', 'POST', null, { phone: partner.phoneE164 }));
        assert.equal(sent.status, 200, `send-otp : HTTP ${sent.status} ${JSON.stringify(await sent.json())}`);
        const loginCode = lastCode(partner.phoneE164, before);

        const refused = await postWithdrawal(partner, loginCode);
        assert.ok(refused.status >= 400 && refused.status < 500, `code de connexion pour un retrait : HTTP ${refused.status} ${JSON.stringify(refused.body)}`);
        assert.equal(await withdrawalCount(partner.userId), 0, 'aucun retrait avec un code d’un autre objet');
        assert.equal((await balanceOf(partner.userId, 'ORGANISATEUR')).available, 10_000, 'solde intact');

        const withdrawalCode = await withdrawalOtp(partner);
        const { data: row, error } = await service.from('otp_codes').select('purpose').eq('phone', partner.phoneE164).order('created_at', { ascending: false }).limit(1).single();
        assert.equal(error, null, `otp_codes.purpose : ${error?.message}`);
        assert.equal(row.purpose, 'WITHDRAWAL', 'code de retrait enregistré avec son objet');

        const accepted = await postWithdrawal(partner, withdrawalCode);
        assert.equal(accepted.status, 200, `même demande avec le code de retrait : HTTP ${accepted.status} ${JSON.stringify(accepted.body)}`);
        assert.equal(await withdrawalCount(partner.userId), 1, 'retrait créé');

        const login = await verifyOtp(jsonRequest('/api/auth/verify-otp', 'POST', null, { phone: partner.phoneE164, otpCode: loginCode, isLogin: true }));
        assert.equal(login.status, 200, `le code de connexion n'a été ni consommé ni remplacé : HTTP ${login.status} ${JSON.stringify(await login.json())}`);
    });

    test('verify-otp : un code WITHDRAWAL n’ouvre pas de session', async () => {
        const partner = await fundedPartner('otp-session');
        const withdrawalCode = await withdrawalOtp(partner);
        const res = await verifyOtp(jsonRequest('/api/auth/verify-otp', 'POST', null, { phone: partner.phoneE164, otpCode: withdrawalCode, isLogin: true }));
        const body = (await res.json()) as Record<string, unknown>;
        assert.ok(res.status >= 400, `code de retrait présenté à la connexion : HTTP ${res.status} ${JSON.stringify(body)}`);
        assert.equal(body.token_hash, undefined, 'aucun jeton de session');
        const { data: row } = await service.from('otp_codes').select('verified').eq('phone', partner.phoneE164).eq('purpose', 'WITHDRAWAL').order('created_at', { ascending: false }).limit(1).single();
        assert.equal(row?.verified, false, 'le code de retrait n’est pas consommé par la connexion');
    });
});

/**
 * Lot 9 quinquies, A5 (T1) et A6 (AUTH-14, T4) — codes SMS de connexion et de récupération.
 *
 * A5 : compte suspendu : la demande de code (connexion, « Mot de passe oublié ») et la vérification refusent AVANT tout
 *      SMS et avant tout lien de session : « Votre compte est suspendu. » suivi du contact du support (réglages support.*,
 *      B1), ou du lien {lien}/aide quand aucun contact n'est renseigné.
 * A6 : la vérification du code ne rend que le jeton de session et l'identifiant du compte : ni adresse (technique ou non),
 *      ni numéro, ni ligne du compte.
 * Rouge avant correctif : SMS envoyé au compte suspendu (200), lien de session créé ; réponse de verify-otp avec `user`
 * complet, `email`, `phone`.
 */
import '../helpers/env';
import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { inspect, writeLocal } from '../helpers/db';
import { assertLot9quinquiesInvariants } from '../helpers/lot9quinquies-invariants';
import { getFakes } from '../fakes';
import { jsonRequest } from './helpers';
import { newBuyer, service } from './paiement-helpers';

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/+$/, '');

after(async () => {
    await assertLot9quinquiesInvariants('lot9quinquies-codes');
});

function ip(): Record<string, string> {
    const b = randomBytes(2);
    return { 'x-forwarded-for': `198.18.${b[0]}.${(b[1] % 250) + 1}` };
}

async function call(route: string, path: string, body: Record<string, unknown>): Promise<{ status: number; body: Record<string, unknown> }> {
    const mod = (await import(route)) as { POST: (req: ReturnType<typeof jsonRequest>) => Promise<Response> };
    const res = await mod.POST(jsonRequest(path, body, ip()));
    return { status: res.status, body: (await res.json().catch(() => ({}))) as Record<string, unknown> };
}

const sendOtp = (body: Record<string, unknown>) => call('../../app/api/auth/send-otp/route', '/api/auth/send-otp', body);
const verifyOtp = (body: Record<string, unknown>) => call('../../app/api/auth/verify-otp/route', '/api/auth/verify-otp', body);

function lastCode(phone: string): string {
    const m = getFakes().sms.messagesTo(phone).at(-1)?.message.match(/\b(\d{6})\b/);
    assert.ok(m, `aucun code reçu au ${phone}`);
    return m[1];
}

async function otpRows(phone: string): Promise<number> {
    return inspect(async (c) => Number((await c.query('SELECT count(*)::int AS n FROM public.otp_codes WHERE phone = $1', [phone])).rows[0].n));
}

async function suspend(userId: string): Promise<void> {
    const { error } = await service.from('users').update({ status: 'SUSPENDU' }).eq('id', userId);
    assert.equal(error, null, `suspension : ${error?.message}`);
}

async function withSupportWhatsapp<T>(value: string, fn: () => Promise<T>): Promise<T> {
    const before = await inspect(async (c) => (await c.query(`SELECT value FROM public.platform_settings WHERE key = 'support.whatsapp'`)).rows[0]?.value);
    assert.ok(before !== undefined, 'réglage support.whatsapp absent (migration 20261112000003)');
    await writeLocal((c) => c.query(`UPDATE public.platform_settings SET value = $1::jsonb WHERE key = 'support.whatsapp'`, [JSON.stringify({ value })]));
    try {
        return await fn();
    } finally {
        await writeLocal((c) => c.query(`UPDATE public.platform_settings SET value = $1::jsonb WHERE key = 'support.whatsapp'`, [JSON.stringify(before)]));
    }
}

describe('A5 — compte suspendu : refus avant tout SMS et tout lien de session', () => {
    test('demande d\'un code de connexion et de récupération : 403 « Votre compte est suspendu. » + contact, aucun SMS, aucun code', async () => {
        const user = await newBuyer('a5-demande');
        await suspend(user.userId);
        const smsBefore = getFakes().sms.messagesTo(user.phoneE164).length;
        const codesBefore = await otpRows(user.phoneE164);
        await withSupportWhatsapp('+221771234567', async () => {
            for (const purpose of ['LOGIN', 'PASSWORD_RESET']) {
                const r = await sendOtp({ phone: user.phoneE164, purpose });
                console.log(`[A5] send-otp ${purpose} : ${r.status} ${JSON.stringify(r.body)}`);
                assert.equal(r.status, 403, `${purpose} : refus ${JSON.stringify(r.body)}`);
                assert.equal(r.body.code, 'ACCOUNT_SUSPENDED');
                assert.match(String(r.body.error), /^Votre compte est suspendu\. Support : WhatsApp 77 123 45 67\. Aide : /, `${purpose} : texte et contact`);
                assert.ok(String(r.body.error).includes(`${APP_URL}/aide`), `${purpose} : lien de la page d'aide`);
            }
        });
        assert.equal(getFakes().sms.messagesTo(user.phoneE164).length, smsBefore, 'aucun SMS envoyé');
        assert.equal(await otpRows(user.phoneE164), codesBefore, 'aucun code enregistré');
    });

    test('sans contact renseigné : le refus donne le lien {lien}/aide', async () => {
        const user = await newBuyer('a5-aide');
        await suspend(user.userId);
        await withSupportWhatsapp('', async () => {
            const r = await sendOtp({ phone: user.phoneE164, purpose: 'LOGIN' });
            assert.equal(r.status, 403, JSON.stringify(r.body));
            const contact = await inspect(async (c) => (await c.query(`SELECT count(*)::int AS n FROM public.platform_settings WHERE key IN ('support.phone', 'support.email') AND value->>'value' <> ''`)).rows[0].n);
            if (Number(contact) === 0) assert.equal(r.body.error, `Votre compte est suspendu. Aide et contact : ${APP_URL}/aide`);
            else assert.ok(String(r.body.error).startsWith('Votre compte est suspendu. Support : '), String(r.body.error));
        });
    });

    test('vérification : code reçu avant la suspension, refus 403 sans jeton de session', async () => {
        const user = await newBuyer('a5-verif');
        const sent = await sendOtp({ phone: user.phoneE164, purpose: 'LOGIN' });
        assert.equal(sent.status, 200, JSON.stringify(sent.body));
        const code = lastCode(user.phoneE164);
        await suspend(user.userId);
        const r = await verifyOtp({ phone: user.phoneE164, otpCode: code, isLogin: true, purpose: 'LOGIN' });
        console.log(`[A5] verify-otp après suspension : ${r.status} ${JSON.stringify(r.body)}`);
        assert.equal(r.status, 403, JSON.stringify(r.body));
        assert.equal(r.body.code, 'ACCOUNT_SUSPENDED');
        assert.ok(String(r.body.error).startsWith('Votre compte est suspendu.'), String(r.body.error));
        assert.equal(r.body.token_hash, undefined, 'aucun jeton de session');
    });
});

describe('A6 — la vérification du code ne rend que le jeton et l\'identifiant', () => {
    test('réponse de verify-otp : { success, verified, token_hash, user: { id } }, aucune adresse ni numéro', async () => {
        const user = await newBuyer('a6-reponse');
        const sent = await sendOtp({ phone: user.phoneE164, purpose: 'LOGIN' });
        assert.equal(sent.status, 200, JSON.stringify(sent.body));
        const r = await verifyOtp({ phone: user.phoneE164, otpCode: lastCode(user.phoneE164), isLogin: true, purpose: 'LOGIN' });
        console.log(`[A6] verify-otp : ${r.status} clés ${JSON.stringify(Object.keys(r.body))}`);
        assert.equal(r.status, 200, JSON.stringify(r.body));
        assert.deepEqual(Object.keys(r.body).sort(), ['success', 'token_hash', 'user', 'verified'], 'seuls le jeton, l\'identifiant et les drapeaux');
        assert.deepEqual(r.body.user, { id: user.userId }, 'identifiant seul');
        assert.equal(typeof r.body.token_hash, 'string');
        const raw = JSON.stringify(r.body);
        assert.ok(!raw.includes('@'), `aucune adresse dans la réponse : ${raw}`);
        assert.ok(!raw.includes(user.phoneE164.slice(4)), `aucun numéro dans la réponse : ${raw}`);
    });
});

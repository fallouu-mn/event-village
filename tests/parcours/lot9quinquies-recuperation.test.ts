/**
 * Lot 9 quinquies, A8 — contre-vérification du lot 9 quater, point 1 : récupération du mot de passe.
 *
 * L'autorisation ouverte par le code « Mot de passe oublié » est liée à la SESSION ouverte par ce code (pas au compte),
 * consommée une seule fois, valable 10 minutes. Une autre session du même compte (session volée, déjà ouverte) ne peut
 * pas choisir le mot de passe pendant ce délai.
 * Cas :
 *  1. code demandé et vérifié, puis tentative depuis une autre session (ouverte avant le code) → 403, mot de passe
 *     inchangé ; la session ouverte par le code réussit ensuite ;
 *  2. une seule fois : après l'usage, aucune autre tentative n'aboutit ;
 *  3. validité de 10 minutes : l'autorisation enregistrée expire 10 minutes après la vérification du code.
 * Rouge avant correctif : autorisation par compte (15 min), la session volée choisit le mot de passe (200).
 */
import '../helpers/env';
import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { NextRequest } from 'next/server';
import { inspect } from '../helpers/db';
import { assertLot9quinquiesInvariants } from '../helpers/lot9quinquies-invariants';
import { getFakes } from '../fakes';
import { BASE_URL, jsonRequest, STRONG_PASSWORD } from './helpers';
import { newBuyer, type Buyer } from './paiement-helpers';
import { gotrueEmail } from '../helpers/gotrue-email';

after(async () => {
    await assertLot9quinquiesInvariants('lot9quinquies-recuperation');
});

function anon() {
    return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
}

function ip(): Record<string, string> {
    const b = randomBytes(2);
    return { 'x-forwarded-for': `198.19.${b[0]}.${(b[1] % 250) + 1}` };
}

async function post(route: string, req: NextRequest): Promise<{ status: number; body: Record<string, unknown> }> {
    const mod = (await import(route)) as { POST: (r: NextRequest) => Promise<Response> };
    const res = await mod.POST(req);
    return { status: res.status, body: (await res.json().catch(() => ({}))) as Record<string, unknown> };
}

function reset(token: string, password: string): Promise<{ status: number; body: Record<string, unknown> }> {
    return post('../../app/api/auth/reset-password/route', new NextRequest(`${BASE_URL}/api/auth/reset-password`, {
        method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify({ password }),
    }));
}

async function signInWith(email: string, password: string): Promise<boolean> {
    const { error } = await anon().auth.signInWithPassword({ email: await gotrueEmail(email), password });
    return error === null;
}

/** Code « Mot de passe oublié » demandé et vérifié ; rend le jeton de la session à ouvrir (non ouverte). */
async function recoveryCode(user: Buyer): Promise<string> {
    const since = getFakes().sms.messagesTo(user.phoneE164).length;
    const sent = await post('../../app/api/auth/send-otp/route', jsonRequest('/api/auth/send-otp', { phone: user.phoneE164, purpose: 'PASSWORD_RESET' }, ip()));
    assert.equal(sent.status, 200, JSON.stringify(sent.body));
    const code = getFakes().sms.messagesTo(user.phoneE164).slice(since).map((m) => m.message.match(/\b(\d{6})\b/)?.[1]).filter(Boolean).pop();
    assert.ok(code, 'code « Mot de passe oublié » reçu');
    const verified = await post('../../app/api/auth/verify-otp/route', jsonRequest('/api/auth/verify-otp', { phone: user.phoneE164, otpCode: code, purpose: 'PASSWORD_RESET' }, ip()));
    assert.equal(verified.status, 200, JSON.stringify(verified.body));
    assert.equal(typeof verified.body.token_hash, 'string', 'jeton de la session de récupération');
    return String(verified.body.token_hash);
}

async function openSession(tokenHash: string): Promise<string> {
    const opened = await anon().auth.verifyOtp({ token_hash: tokenHash, type: 'magiclink' });
    assert.equal(opened.error, null, `session ouverte par le code : ${opened.error?.message}`);
    return opened.data.session!.access_token;
}

const newPassword = (): string => `Recup#${randomBytes(5).toString('hex')}A1`; // valable avant et après A7

describe('A8 — l\'autorisation de récupération est liée à la session ouverte par le code', () => {
    test('code vérifié puis tentative depuis une autre session (déjà ouverte) : refus, mot de passe inchangé ; la session du code réussit', async () => {
        const user = await newBuyer('a8-vol');
        const stolen = user.accessToken; // session ouverte avant le code (connexion par mot de passe)
        const tokenHash = await recoveryCode(user);
        const attempt = await reset(stolen, newPassword());
        console.log(`[A8] tentative depuis la session volée : ${attempt.status} ${JSON.stringify(attempt.body)}`);
        assert.equal(attempt.status, 403, `session volée : ${JSON.stringify(attempt.body)}`);
        assert.equal(attempt.body.code, 'RECOVERY_SESSION_REQUIRED');
        assert.equal(await signInWith(user.email, STRONG_PASSWORD), true, 'mot de passe inchangé');

        const recovery = await openSession(tokenHash);
        const chosen = newPassword();
        const ok = await reset(recovery, chosen);
        assert.equal(ok.status, 200, `session ouverte par le code : ${JSON.stringify(ok.body)}`);
        assert.equal(await signInWith(user.email, chosen), true, 'le nouveau mot de passe ouvre une session');
    });

    test('une seule fois : après l\'usage, une nouvelle session ne peut plus choisir le mot de passe', async () => {
        const user = await newBuyer('a8-unique');
        const tokenHash = await recoveryCode(user);
        const recovery = await openSession(tokenHash);
        assert.equal((await reset(recovery, newPassword())).status, 200, 'premier usage');
        const after = await anon().auth.signInWithPassword({ email: await gotrueEmail(user.email), password: STRONG_PASSWORD });
        assert.notEqual(after.error, null, 'l\'ancien mot de passe ne marche plus');
        const left = await inspect(async (c) => Number((await c.query('SELECT count(*)::int AS n FROM public.account_recovery_grants WHERE user_id = $1', [user.userId])).rows[0].n));
        assert.equal(left, 0, 'autorisation supprimée à l\'usage');
    });

    test('validité : l\'autorisation enregistrée expire 10 minutes après la vérification du code', async () => {
        const user = await newBuyer('a8-duree');
        await recoveryCode(user);
        const row = await inspect(async (c) => (await c.query('SELECT extract(epoch FROM (expires_at - issued_at))::int AS s FROM public.account_recovery_grants WHERE user_id = $1', [user.userId])).rows[0]);
        assert.ok(row, 'autorisation enregistrée');
        assert.equal(Number(row.s), 600, `durée de l'autorisation : ${row.s} s`);
    });
});

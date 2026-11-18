/**
 * Correctifs de la contre-vérification 2b, suite de la 6.8 — « Mot de passe oublié » (POST /api/auth/reset-password)
 * ferme toutes les sessions du compte ; comme « Déconnecter tous mes appareils », il supprime aussi les abonnements push
 * du compte : un appareil déconnecté (téléphone volé, partagé) ne reçoit plus les notifications du compte.
 * Cas :
 *  1. code SMS « Mot de passe oublié » vérifié, session de récupération : mot de passe posé, plus aucun abonnement push ;
 *  2. lien reçu par email (sans session) : mot de passe posé, plus aucun abonnement push.
 * Rouge avant correctif : la route révoque les sessions sans toucher à push_subscriptions (l'autre appareil reste abonné).
 */
import '../helpers/env';
import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { NextRequest } from 'next/server';
import { assertLot9quinquiesInvariants } from '../helpers/lot9quinquies-invariants';
import { getFakes } from '../fakes';
import { BASE_URL, jsonRequest } from './helpers';
import { newBuyer, service, type Buyer } from './paiement-helpers';
import { markEmailVerified } from './notif-helpers';

const pushRowsToDelete: string[] = [];

after(async () => {
    if (pushRowsToDelete.length > 0) await service.from('push_subscriptions').delete().in('id', pushRowsToDelete);
    await assertLot9quinquiesInvariants('cvf2b-reinit-push');
});

function ip(): Record<string, string> {
    const b = randomBytes(2);
    return { 'x-forwarded-for': `198.18.${b[0]}.${(b[1] % 250) + 1}` };
}

async function post(route: string, req: NextRequest): Promise<{ status: number; body: Record<string, unknown> }> {
    const mod = (await import(route)) as { POST: (r: NextRequest) => Promise<Response> };
    const res = await mod.POST(req);
    return { status: res.status, body: (await res.json().catch(() => ({}))) as Record<string, unknown> };
}

function resetRequest(body: unknown, token?: string): NextRequest {
    return new NextRequest(`${BASE_URL}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...ip(), ...(token ? { authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(body),
    });
}

const RESET_ROUTE = '../../app/api/auth/reset-password/route';
const newPassword = (): string => `Reinit#${randomBytes(5).toString('hex')}A1`;

/** Abonnement push d'un AUTRE appareil du compte (téléphone partagé). */
async function otherDeviceSubscribed(userId: string, label: string): Promise<void> {
    const { data, error } = await service.from('push_subscriptions').insert({
        user_id: userId, endpoint: `https://push.invalid/cvf2b-reinit/${randomUUID()}`, p256dh: randomBytes(65).toString('base64url'),
        auth: randomBytes(16).toString('base64url'), vapid_key_id: randomBytes(12).toString('base64url'), user_agent: `Autre appareil (${label})`,
    }).select('id').single();
    assert.equal(error, null, `abonnement de l'autre appareil : ${error?.message}`);
    pushRowsToDelete.push((data as { id: string }).id);
}

async function subscriptionsOf(userId: string): Promise<Array<{ id: string; user_agent: string | null }>> {
    const { data, error } = await service.from('push_subscriptions').select('id, user_agent').eq('user_id', userId);
    assert.equal(error, null, `abonnements du compte : ${error?.message}`);
    return (data ?? []) as Array<{ id: string; user_agent: string | null }>;
}

/** Code « Mot de passe oublié » demandé, vérifié, puis session de récupération ouverte ; rend son jeton d'accès. */
async function recoverySession(user: Buyer): Promise<string> {
    const since = getFakes().sms.messagesTo(user.phoneE164).length;
    const sent = await post('../../app/api/auth/send-otp/route', jsonRequest('/api/auth/send-otp', { phone: user.phoneE164, purpose: 'PASSWORD_RESET' }, ip()));
    assert.equal(sent.status, 200, JSON.stringify(sent.body));
    const code = getFakes().sms.messagesTo(user.phoneE164).slice(since).map((m) => m.message.match(/\b(\d{6})\b/)?.[1]).filter(Boolean).pop();
    assert.ok(code, 'code « Mot de passe oublié » reçu');
    const verified = await post('../../app/api/auth/verify-otp/route', jsonRequest('/api/auth/verify-otp', { phone: user.phoneE164, otpCode: code, purpose: 'PASSWORD_RESET' }, ip()));
    assert.equal(verified.status, 200, JSON.stringify(verified.body));
    const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
    const opened = await anon.auth.verifyOtp({ token_hash: String(verified.body.token_hash), type: 'magiclink' });
    assert.equal(opened.error, null, `session ouverte par le code : ${opened.error?.message}`);
    return opened.data.session!.access_token;
}

const SUBJECT = 'Choisir un nouveau mot de passe — Event Village';

describe('« Mot de passe oublié » supprime les abonnements push du compte (comme la 6.8)', () => {
    test('1. code SMS : mot de passe posé, l’autre appareil n’est plus abonné', async () => {
        const user = await newBuyer('cvf2b-reinit-sms');
        await otherDeviceSubscribed(user.userId, 'code SMS');
        const recovery = await recoverySession(user);
        const ok = await post(RESET_ROUTE, resetRequest({ password: newPassword() }, recovery));
        assert.equal(ok.status, 200, JSON.stringify(ok.body));
        const left = await subscriptionsOf(user.userId);
        console.log(`[CVF2B-REINIT] 1. code SMS : abonnements push restants : ${JSON.stringify(left)}`);
        assert.deepEqual(left, [], `après « Mot de passe oublié » (code SMS), l'autre appareil reste abonné aux notifications du compte : ${JSON.stringify(left)}`);
    });

    test('2. lien email : mot de passe posé sans session, l’autre appareil n’est plus abonné', async () => {
        const user = await newBuyer('cvf2b-reinit-email');
        await markEmailVerified(user.userId);
        await otherDeviceSubscribed(user.userId, 'lien email');
        const since = getFakes().email.messagesTo(user.email).length;
        const asked = await post('../../app/api/auth/forgot-password/route', jsonRequest('/api/auth/forgot-password', { email: user.email }, ip()));
        assert.equal(asked.status, 200, JSON.stringify(asked.body));
        const mail = getFakes().email.messagesTo(user.email).slice(since).find((m) => m.subject === SUBJECT);
        const token = mail ? /reset-password\?t=([A-Za-z0-9_-]+)/.exec(`${mail.text ?? ''} ${mail.html}`)?.[1] : undefined;
        assert.ok(token, 'lien /reset-password?t=… reçu');
        const ok = await post(RESET_ROUTE, resetRequest({ token, password: newPassword() }));
        assert.equal(ok.status, 200, JSON.stringify(ok.body));
        const left = await subscriptionsOf(user.userId);
        console.log(`[CVF2B-REINIT] 2. lien email : abonnements push restants : ${JSON.stringify(left)}`);
        assert.deepEqual(left, [], `après « Mot de passe oublié » (lien email), l'autre appareil reste abonné aux notifications du compte : ${JSON.stringify(left)}`);
    });
});

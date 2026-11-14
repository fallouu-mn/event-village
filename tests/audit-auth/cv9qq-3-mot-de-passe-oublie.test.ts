/**
 * Contre-vérification du lot 9 quinquies, attaque 3 — « Mot de passe oublié » (A8 par code SMS, B2 par lien email).
 *
 *  a. session ouverte AVANT le code (volée), RAFRAÎCHIE après la vérification du code : elle ne choisit pas le mot de passe ;
 *  b. lien email : réutilisé (409), remplacé par un lien plus récent (410), modifié (refusé) ;
 *  c. lien d'un autre compte : l'adresse vérifiée d'une victime mise « en attente » sur le compte de l'attaquant ne lui
 *     donne aucun lien ; le lien de la victime, présenté avec la session de l'attaquant, ne touche que la victime ;
 *  d. lien valable d'un compte suspendu après l'envoi : refusé, mot de passe inchangé.
 */
import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { NextRequest } from 'next/server';
import { inspect } from '../helpers/db';
import { assertLot9quinquiesInvariants } from '../helpers/lot9quinquies-invariants';
import { getFakes } from '../fakes';
import { BASE_URL, STRONG_PASSWORD } from '../parcours/helpers';
import { newBuyer, service, type Buyer } from '../parcours/paiement-helpers';
import { markEmailVerified } from '../parcours/notif-helpers';
import { anonClient, freshIp, post, type Reply } from './cv9qq-helpers';

after(async () => {
    await assertLot9quinquiesInvariants('cv9qq-3-mot-de-passe-oublie');
});

const SUBJECT = 'Choisir un nouveau mot de passe — Event Village';
const phrase = (): string => `nouvelle phrase ${randomBytes(4).toString('hex')}`;

async function resetWithSession(token: string, password: string): Promise<Reply> {
    const { POST } = await import('../../app/api/auth/reset-password/route');
    const res = await POST(new NextRequest(`${BASE_URL}/api/auth/reset-password`, {
        method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}`, 'x-forwarded-for': freshIp() }, body: JSON.stringify({ password }),
    }));
    return { status: res.status, body: (await res.json().catch(() => ({}))) as Record<string, unknown> };
}

async function resetWithLink(token: string, password: string, bearerOf?: string): Promise<Reply> {
    const { POST } = await import('../../app/api/auth/reset-password/route');
    const headers: Record<string, string> = { 'content-type': 'application/json', 'x-forwarded-for': freshIp() };
    if (bearerOf) headers.authorization = `Bearer ${bearerOf}`;
    const res = await POST(new NextRequest(`${BASE_URL}/api/auth/reset-password`, { method: 'POST', headers, body: JSON.stringify({ token, password }) }));
    return { status: res.status, body: (await res.json().catch(() => ({}))) as Record<string, unknown> };
}

async function canSignIn(email: string, password: string): Promise<boolean> {
    return (await anonClient().auth.signInWithPassword({ email, password })).error === null;
}

async function emailLink(u: { email: string }): Promise<string> {
    const since = getFakes().email.messagesTo(u.email).length;
    const r = await post('auth/forgot-password', { email: u.email });
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const mail = getFakes().email.messagesTo(u.email).slice(since).find((m) => m.subject === SUBJECT);
    const token = mail ? /reset-password\?t=([A-Za-z0-9_-]+)/.exec(`${mail.text ?? ''} ${mail.html}`)?.[1] : undefined;
    assert.ok(token, 'lien reçu');
    return token;
}

async function verifiedBuyer(label: string): Promise<Buyer> {
    const u = await newBuyer(label);
    await markEmailVerified(u.userId);
    return u;
}

describe('Attaque 3 — mot de passe oublié', () => {
    test('a. session ouverte avant le code puis rafraîchie après sa vérification : refus, mot de passe inchangé', async () => {
        const u = await newBuyer('cv9qq-rafraichie');
        const gotrue = anonClient();
        const { data: s } = await gotrue.auth.signInWithPassword({ email: u.email, password: STRONG_PASSWORD });
        assert.ok(s.session, 'session de l\'attaquant');
        const since = getFakes().sms.messagesTo(u.phoneE164).length;
        assert.equal((await post('auth/send-otp', { phone: u.phoneE164, purpose: 'PASSWORD_RESET' })).status, 200);
        const code = getFakes().sms.messagesTo(u.phoneE164).slice(since).at(-1)?.message.match(/\b(\d{6})\b/)?.[1];
        assert.ok(code, 'code');
        const verified = await post('auth/verify-otp', { phone: u.phoneE164, otpCode: code, purpose: 'PASSWORD_RESET' });
        assert.equal(verified.status, 200, JSON.stringify(verified.body));
        const { data: refreshed, error } = await gotrue.auth.refreshSession({ refresh_token: s.session!.refresh_token });
        assert.equal(error, null, `rafraîchissement : ${error?.message}`);
        const attempt = await resetWithSession(refreshed.session!.access_token, phrase());
        console.log(`[CV9QQ-3a] session d'avant le code, rafraîchie après : ${attempt.status} ${String(attempt.body.code ?? '')}`);
        assert.equal(attempt.status, 403, JSON.stringify(attempt.body));
        assert.equal(await canSignIn(u.email, STRONG_PASSWORD), true, 'mot de passe inchangé');
    });

    test('b. lien email : réutilisé, remplacé, modifié', async () => {
        const u = await verifiedBuyer('cv9qq-lien');
        const first = await emailLink(u);
        const second = await emailLink(u);
        const old = await resetWithLink(first, phrase());
        const tampered = await resetWithLink(`${second.slice(0, -2)}${second.endsWith('AA') ? 'BB' : 'AA'}`, phrase());
        const chosen = phrase();
        const ok = await resetWithLink(second, chosen);
        const reused = await resetWithLink(second, phrase());
        console.log(`[CV9QQ-3b] lien remplacé : ${old.status} ${String(old.body.code)} ; lien modifié : ${tampered.status} ${String(tampered.body.code)} ; bon lien : ${ok.status} ; réutilisé : ${reused.status} ${String(reused.body.code)}`);
        assert.deepEqual([old.status, old.body.code], [410, 'RESET_LINK_EXPIRED']);
        assert.ok(tampered.status >= 400 && tampered.status < 500, `lien modifié accepté : ${JSON.stringify(tampered.body)}`);
        assert.equal(ok.status, 200, JSON.stringify(ok.body));
        assert.deepEqual([reused.status, reused.body.code], [409, 'RESET_LINK_USED']);
        assert.equal(await canSignIn(u.email, chosen), true, 'seul le bon lien a servi');
    });

    test('c. lien d\'un autre compte : l\'attaquant n\'obtient rien par l\'adresse de la victime ; le lien de la victime ne touche que la victime', async () => {
        const victim = await verifiedBuyer('cv9qq-victime');
        const attacker = await newBuyer('cv9qq-attaquant');
        const { error } = await service.from('users').update({ email_pending: victim.email }).eq('id', attacker.userId);
        console.log(`[CV9QQ-3c] adresse vérifiée de la victime mise en attente sur le compte de l'attaquant : ${error ? `refusé par la base (${error.code})` : 'acceptée'}`);
        await post('auth/forgot-password', { email: victim.email });
        const owners = await inspect(async (c) => (await c.query<{ user_id: string }>(
            `SELECT DISTINCT user_id FROM public.password_reset_links WHERE user_id = ANY($1::uuid[])`, [[victim.userId, attacker.userId]])).rows.map((r) => r.user_id));
        assert.deepEqual(owners, [victim.userId], 'un lien pour la seule victime, aucun pour le compte qui a mis l\'adresse en attente');

        const link = await emailLink(victim);
        const chosen = phrase();
        const r = await resetWithLink(link, chosen, attacker.accessToken);
        assert.equal(r.status, 200, JSON.stringify(r.body));
        assert.equal(await canSignIn(attacker.email, STRONG_PASSWORD), true, 'mot de passe de l\'attaquant inchangé');
        assert.equal(await canSignIn(victim.email, chosen), true, 'seul le compte du lien a changé');
    });

    test('d. lien valable d\'un compte suspendu après l\'envoi : refusé, mot de passe inchangé', async () => {
        const u = await verifiedBuyer('cv9qq-suspendu');
        const link = await emailLink(u);
        const { error } = await service.from('users').update({ status: 'SUSPENDU' }).eq('id', u.userId);
        assert.equal(error, null, error?.message);
        const r = await resetWithLink(link, phrase());
        console.log(`[CV9QQ-3d] lien d'un compte suspendu : ${r.status} ${String(r.body.code ?? '')}`);
        assert.equal(r.status, 403, JSON.stringify(r.body));
        const { data } = await service.auth.admin.getUserById(u.userId);
        assert.ok(data.user, 'compte');
        const { error: reactErr } = await service.from('users').update({ status: 'ACTIF' }).eq('id', u.userId);
        assert.equal(reactErr, null, reactErr?.message);
        assert.equal(await canSignIn(u.email, STRONG_PASSWORD), true, 'mot de passe inchangé');
    });
});

/**
 * Lot 9 quinquies, B2 (AUTH-08, T5) — « Mot de passe oublié » par email passe par l'application et Resend : lien à usage
 * unique de 60 minutes, modèle en français, même expéditeur que les autres emails, réponse neutre. GoTrue n'envoie plus
 * aucun email.
 * Cas :
 *  1. adresse vérifiée : réponse neutre, un email en français avec le lien ; le lien pose le mot de passe (sans session),
 *     les autres sessions sont fermées, l'avis « mot de passe modifié » part ; le lien ne sert qu'une fois ;
 *  2. adresse inconnue et adresse non vérifiée : même réponse, aucun email ;
 *  3. lien expiré (60 min) : refus 410 ;
 *  4. GoTrue : /auth/v1/recover vers une adresse vérifiée est refusé, aucun jeton enregistré.
 * Rouge avant correctif : route absente ; l'écran appelle resetPasswordForEmail (email de GoTrue, SMTP de Supabase).
 */
import '../helpers/env';
import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { NextRequest } from 'next/server';
import { inspect, writeLocal } from '../helpers/db';
import { assertLot9quinquiesInvariants } from '../helpers/lot9quinquies-invariants';
import { getFakes } from '../fakes';
import { BASE_URL, randomEmail, STRONG_PASSWORD } from './helpers';
import { newBuyer, service } from './paiement-helpers';
import { markEmailVerified, outboxRows } from './notif-helpers';

after(async () => {
    await assertLot9quinquiesInvariants('lot9quinquies-recuperation-email');
});

type Handler = (req: NextRequest) => Promise<Response>;

async function post(path: string, body: unknown): Promise<{ status: number; body: Record<string, unknown> }> {
    const mod = (await import(`../../app${path}/route`)) as { POST: Handler };
    const res = await mod.POST(new NextRequest(`${BASE_URL}${path}`, {
        method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': `198.51.100.${(randomBytes(1)[0] % 250) + 1}` }, body: JSON.stringify(body),
    }));
    return { status: res.status, body: (await res.json().catch(() => ({}))) as Record<string, unknown> };
}

const SUBJECT = 'Choisir un nouveau mot de passe — Event Village';
const newPhrase = (): string => `nouvelle phrase ${randomBytes(4).toString('hex')}`;

async function verifiedUser(label: string): Promise<{ userId: string; email: string; token: string }> {
    const user = await newBuyer(label);
    await markEmailVerified(user.userId);
    return { userId: user.userId, email: user.email, token: user.accessToken };
}

function linkTokenIn(address: string, since: number): string | null {
    const mail = getFakes().email.messagesTo(address).slice(since).find((m) => m.subject === SUBJECT);
    return mail ? (/reset-password\?t=([A-Za-z0-9_-]+)/.exec(`${mail.text ?? ''} ${mail.html}`)?.[1] ?? null) : null;
}

describe('B2 — « Mot de passe oublié » par email via l\'application et Resend', () => {
    test('adresse vérifiée : email en français, lien de 60 min à usage unique, mot de passe posé sans session, autres sessions fermées, avis', async () => {
        const u = await verifiedUser('b2-ok');
        const since = getFakes().email.messagesTo(u.email).length;
        const r = await post('/api/auth/forgot-password', { email: u.email.toUpperCase() });
        assert.equal(r.status, 200, JSON.stringify(r.body));
        const mail = getFakes().email.messagesTo(u.email).slice(since).find((m) => m.subject === SUBJECT);
        assert.ok(mail, `email « ${SUBJECT} » reçu`);
        assert.ok(mail.html.includes('Ce lien est valable 60 minutes et ne sert qu’une fois.'), 'modèle en français, durée dite');
        const token = linkTokenIn(u.email, since);
        assert.ok(token, 'lien /reset-password?t=…');
        const before = (await outboxRows({ type: 'PASSWORD_CHANGED', userId: u.userId })).length;
        const chosen = newPhrase();
        const ok = await post('/api/auth/reset-password', { token, password: chosen });
        assert.equal(ok.status, 200, JSON.stringify(ok.body));
        const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
        assert.equal((await anon.auth.signInWithPassword({ email: u.email, password: chosen })).error, null, 'nouveau mot de passe');
        assert.notEqual((await anon.auth.signInWithPassword({ email: u.email, password: STRONG_PASSWORD })).error, null, 'ancien refusé');
        assert.equal((await anon.auth.getUser(u.token)).data.user, null, 'ancienne session fermée');
        assert.ok((await outboxRows({ type: 'PASSWORD_CHANGED', userId: u.userId })).length > before, 'avis PASSWORD_CHANGED');
        const again = await post('/api/auth/reset-password', { token, password: newPhrase() });
        assert.deepEqual([again.status, again.body.code], [409, 'RESET_LINK_USED'], JSON.stringify(again.body));
    });

    test('adresse inconnue ou non vérifiée : même réponse neutre, aucun email', async () => {
        const unknown = randomEmail('b2-inconnue');
        const pending = await newBuyer('b2-attente');
        const pendingAddress = randomEmail('b2-attente');
        await service.from('users').update({ email_pending: pendingAddress }).eq('id', pending.userId);
        const a = await post('/api/auth/forgot-password', { email: unknown });
        const b = await post('/api/auth/forgot-password', { email: pendingAddress });
        const known = await verifiedUser('b2-neutre');
        const c = await post('/api/auth/forgot-password', { email: known.email });
        assert.deepEqual([a.status, b.status, c.status], [200, 200, 200]);
        assert.deepEqual(a.body, c.body, 'même corps pour un compte inconnu et un compte réel');
        assert.deepEqual(b.body, c.body, 'même corps pour une adresse non vérifiée');
        assert.equal(getFakes().email.messagesTo(unknown).length, 0, 'aucun email à une adresse inconnue');
        assert.equal(getFakes().email.messagesTo(pendingAddress).filter((m) => m.subject === SUBJECT).length, 0, 'aucun lien à une adresse non vérifiée');
    });

    test('lien expiré : refus 410, mot de passe inchangé', async () => {
        const u = await verifiedUser('b2-expire');
        const since = getFakes().email.messagesTo(u.email).length;
        await post('/api/auth/forgot-password', { email: u.email });
        const token = linkTokenIn(u.email, since);
        assert.ok(token);
        await writeLocal((c) => c.query(`UPDATE public.password_reset_links SET expires_at = now() - interval '1 minute' WHERE user_id = $1`, [u.userId]));
        const r = await post('/api/auth/reset-password', { token, password: newPhrase() });
        assert.deepEqual([r.status, r.body.code], [410, 'RESET_LINK_EXPIRED'], JSON.stringify(r.body));
    });

    test('GoTrue n\'envoie plus aucun email : /auth/v1/recover vers une adresse vérifiée refusé, aucun jeton', async () => {
        const u = await verifiedUser('b2-gotrue');
        const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/recover`, {
            method: 'POST', headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, 'content-type': 'application/json' }, body: JSON.stringify({ email: u.email }),
        });
        console.log(`[B2] /recover : HTTP ${res.status} ${(await res.text()).slice(0, 120)}`);
        const token = await inspect(async (c) => (await c.query(`SELECT COALESCE(recovery_token, '') AS t FROM auth.users WHERE id = $1`, [u.userId])).rows[0].t);
        assert.equal(token, '', 'aucun jeton de récupération enregistré par GoTrue');
    });
});

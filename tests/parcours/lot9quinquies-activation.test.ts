/**
 * Lot 9 quinquies, A2 (AUTH-02, T2) — comptes créés par un admin : l'admin ne saisit plus de mot de passe. Le titulaire
 * reçoit un SMS avec un lien d'activation à usage unique (24 h), où il choisit son mot de passe selon la règle commune.
 * L'admin voit « Activation en attente » et peut renvoyer le lien.
 * Cas :
 *  1. un mot de passe envoyé par l'admin est refusé (400 PASSWORD_NOT_ALLOWED), rien n'est créé ;
 *  2. le SUPERADMIN crée un ADMIN sans mot de passe : 200, SMS « votre compte est créé… » avec le lien, un segment ;
 *     liste : activation PENDING ; aucune connexion avant l'activation (mot de passe, code SMS) ;
 *  3. renvoi du lien : l'ancien n'est plus valable (410), le nouveau sert ; mot de passe faible refusé ; activation :
 *     200, connexion avec le mot de passe choisi, numéro prouvé, aucun avis PASSWORD_CHANGED ; lien déjà servi : 409 ;
 *     liste : plus d'activation en attente.
 * Rouge avant correctif : le mot de passe de l'admin est accepté, aucun SMS, aucune route d'activation.
 */
import '../helpers/env';
import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { NextRequest } from 'next/server';
import { assertLot9quinquiesInvariants } from '../helpers/lot9quinquies-invariants';
import { getFakes } from '../fakes';
import { bearer, signInAs } from '../helpers/fixtures';
import { BASE_URL, randomSenegalPhone } from './helpers';
import { service } from './paiement-helpers';
import { outboxRows } from './notif-helpers';

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/+$/, '');
/** Exemples publics de la règle (A7), jamais des secrets : une phrase acceptée, un mot de passe évident refusé. */
const PHRASE_SAMPLE = 'mon jardin de baobabs';
const OBVIOUS_SAMPLE = 'dakar12345';

after(async () => {
    await assertLot9quinquiesInvariants('lot9quinquies-activation');
});

type Handler = (req: NextRequest) => Promise<Response>;

async function route(path: string, method: string, body: unknown, headers: Record<string, string> = {}): Promise<{ status: number; body: Record<string, unknown> }> {
    const mod = (await import(`../../app${path}/route`)) as Record<string, Handler>;
    const res = await mod[method](new NextRequest(`${BASE_URL}${path}`, {
        method,
        headers: { 'content-type': 'application/json', 'x-forwarded-for': `203.0.113.${(randomBytes(1)[0] % 250) + 1}`, ...headers },
        ...(method === 'GET' ? {} : { body: JSON.stringify(body) }),
    }));
    return { status: res.status, body: (await res.json().catch(() => ({}))) as Record<string, unknown> };
}

function lastActivationToken(phone: string): string {
    const sms = getFakes().sms.messagesTo(phone).at(-1)?.message ?? '';
    const m = /\/activation\?t=([A-Za-z0-9_-]+)$/.exec(sms);
    assert.ok(m, `aucun lien d'activation reçu au ${phone} : « ${sms} »`);
    return m[1];
}

async function signIn(email: string, password: string): Promise<boolean> {
    const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
    return (await anon.auth.signInWithPassword({ email, password })).error === null;
}

describe('A2 — comptes créés par un admin : activation par lien', () => {
    test('un mot de passe envoyé par l\'admin est refusé (400 PASSWORD_NOT_ALLOWED), rien n\'est créé', async () => {
        const sa = await signInAs('SUPERADMIN');
        const phone = randomSenegalPhone('76');
        const r = await route('/api/admin/users', 'POST', { firstName: 'Awa', lastName: 'Refus', phone, password: `Choisi par admin ${randomBytes(4).toString('hex')}`, role: 'CLIENT' }, bearer(sa.accessToken));
        assert.deepEqual([r.status, r.body.code, r.body.field], [400, 'PASSWORD_NOT_ALLOWED', 'password'], JSON.stringify(r.body));
        const { count } = await service.from('users').select('id', { count: 'exact', head: true }).eq('phone', phone);
        assert.equal(count ?? 0, 0, 'aucun compte');
    });

    test('création d\'un ADMIN sans mot de passe, lien par SMS, attente, renvoi, activation, connexion', async () => {
        const sa = await signInAs('SUPERADMIN');
        const phone = randomSenegalPhone('76');
        const created = await route('/api/admin/users', 'POST', { firstName: 'Fatou', lastName: 'Activation', phone, role: 'ADMIN' }, bearer(sa.accessToken));
        console.log(`[A2] création : ${created.status} ${JSON.stringify(created.body)}`);
        assert.equal(created.status, 200, JSON.stringify(created.body));
        assert.equal(created.body.activation, 'SENT');
        const userId = String(created.body.userId);
        const sms = getFakes().sms.messagesTo(phone).at(-1)?.message ?? '';
        assert.match(sms, new RegExp(`^Event Village : votre compte est créé\\. Choisissez votre mot de passe sous 24 h : ${APP_URL.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/activation\\?t=[A-Za-z0-9_-]{22}$`), `SMS : ${sms}`);
        const first = lastActivationToken(phone);

        const list = await route('/api/admin/users', 'GET', null, bearer(sa.accessToken));
        const row = (list.body.users as Array<Record<string, unknown>>).find((u) => u.id === userId);
        assert.equal(row?.activation, 'PENDING', 'liste : « Activation en attente »');

        const { data: auth } = await service.auth.admin.getUserById(userId);
        const loginPwd = await route('/api/auth/login', 'POST', { identifier: phone, password: `Essai au hasard ${randomBytes(4).toString('hex')}` });
        assert.deepEqual([loginPwd.status, loginPwd.body.code], [403, 'ACCOUNT_NOT_ACTIVATED'], `connexion avant activation : ${JSON.stringify(loginPwd.body)}`);
        const otp = await route('/api/auth/send-otp', 'POST', { phone, purpose: 'LOGIN' });
        assert.deepEqual([otp.status, otp.body.code], [403, 'ACCOUNT_NOT_ACTIVATED'], `code avant activation : ${JSON.stringify(otp.body)}`);

        const resent = await route('/api/admin/users/activation', 'POST', { userId }, bearer(sa.accessToken));
        assert.deepEqual([resent.status, resent.body.activation], [200, 'SENT'], JSON.stringify(resent.body));
        const second = lastActivationToken(phone);
        assert.notEqual(second, first);
        const old = await route('/api/auth/activate', 'POST', { token: first, password: PHRASE_SAMPLE });
        assert.deepEqual([old.status, old.body.code], [410, 'ACTIVATION_EXPIRED'], `ancien lien : ${JSON.stringify(old.body)}`);

        const weak = await route('/api/auth/activate', 'POST', { token: second, password: OBVIOUS_SAMPLE });
        assert.deepEqual([weak.status, weak.body.field], [400, 'password'], `mot de passe faible : ${JSON.stringify(weak.body)}`);

        const before = (await outboxRows({ type: 'PASSWORD_CHANGED', userId })).length;
        const chosen = `mon jardin de baobabs ${randomBytes(3).toString('hex')}`;
        const ok = await route('/api/auth/activate', 'POST', { token: second, password: chosen });
        assert.equal(ok.status, 200, `activation : ${JSON.stringify(ok.body)}`);
        assert.equal(await signIn(String(auth.user?.email), chosen), true, 'connexion avec le mot de passe choisi');
        const { data: profile } = await service.from('users').select('phone_verified_at').eq('id', userId).single();
        assert.ok(profile?.phone_verified_at, 'numéro prouvé par le lien reçu par SMS');
        assert.equal((await outboxRows({ type: 'PASSWORD_CHANGED', userId })).length, before, 'aucun avis « mot de passe modifié » pour l\'activation');

        const again = await route('/api/auth/activate', 'POST', { token: second, password: chosen });
        assert.deepEqual([again.status, again.body.code], [409, 'ACTIVATION_USED'], JSON.stringify(again.body));
        const listAfter = await route('/api/admin/users', 'GET', null, bearer(sa.accessToken));
        assert.equal((listAfter.body.users as Array<Record<string, unknown>>).find((u) => u.id === userId)?.activation ?? null, null, 'plus d\'activation en attente');
    });
});

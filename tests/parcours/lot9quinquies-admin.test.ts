/**
 * Lot 9 quinquies, A3 (AUTH-05) et A4 (AUTH-04) — second facteur et sessions de l'administration.
 *
 * A3 : code SMS demandé aux ADMIN et au SUPERADMIN à l'ouverture de l'administration sur un nouvel appareil et après
 *      12 h ; texte « Event Village : code administrateur {code}. Ne le donnez à personne. Valable 10 minutes. » ; le
 *      premier SUPERADMIN y est soumis comme les autres.
 * A4 : après 30 minutes sans activité sur /admin, le mot de passe est redemandé ; après 12 h, mot de passe et code ; les
 *      sessions des clients ne changent pas ; cookies Secure en production (HTTPS).
 * Les sessions de cette suite sont ouvertes directement auprès de GoTrue SANS l'aide stepUpTestSession (aucune saisie
 * enregistrée) : c'est le cas réel d'un mot de passe volé utilisé par l'API.
 * Rouge avant correctif : l'administration répond 200 à une session qui n'a jamais saisi de code.
 */
import '../helpers/env';
import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { NextRequest } from 'next/server';
import { writeLocal } from '../helpers/db';
import { assertLot9quinquiesInvariants } from '../helpers/lot9quinquies-invariants';
import { getFakes } from '../fakes';
import { BASE_URL, randomEmail, randomSenegalPhone, STRONG_PASSWORD } from './helpers';
import { service } from './paiement-helpers';
import { smsSegments } from '../../lib/notifications/sms-format';

after(async () => {
    await assertLot9quinquiesInvariants('lot9quinquies-admin');
});

type Handler = (req: NextRequest) => Promise<Response>;
interface RawAccount { userId: string; phone: string; email: string; token: string; sessionId: string }

/** Compte et session ouverts sans aucune saisie enregistrée (ni mot de passe applicatif, ni code). */
async function rawAccount(role: 'ADMIN' | 'SUPERADMIN' | 'CLIENT', permissions: string[] = []): Promise<RawAccount> {
    const email = randomEmail(`a3-${role.toLowerCase()}`);
    const phone = randomSenegalPhone('77');
    const { data, error } = await service.auth.admin.createUser({ email, phone, password: STRONG_PASSWORD, email_confirm: true, phone_confirm: true });
    assert.equal(error, null, error?.message);
    const userId = data.user!.id;
    const { error: upErr } = await service.from('users').update({ phone, first_name: 'Aminata', last_name: 'Securite', status: 'ACTIF', phone_verified_at: new Date().toISOString() }).eq('id', userId);
    assert.equal(upErr, null, upErr?.message);
    if (role !== 'CLIENT') {
        const { error: rErr } = await service.from('user_roles').upsert([{ user_id: userId, role }], { onConflict: 'user_id,role' });
        assert.equal(rErr, null, rErr?.message);
        for (const permission of permissions) await service.from('admin_permissions').upsert({ user_id: userId, permission }, { onConflict: 'user_id,permission' });
    }
    const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: s, error: sErr } = await anon.auth.signInWithPassword({ email, password: STRONG_PASSWORD });
    assert.equal(sErr, null, sErr?.message);
    const token = s.session!.access_token;
    const sessionId = String((JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8')) as { session_id: string }).session_id);
    return { userId, phone, email, token, sessionId };
}

async function call(path: string, method: string, token: string, body?: unknown): Promise<{ status: number; body: Record<string, unknown>; setCookie: string[] }> {
    const mod = (await import(`../../app${path}/route`)) as Record<string, Handler>;
    const res = await mod[method](new NextRequest(`${BASE_URL}${path}`, {
        method,
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', 'x-forwarded-for': `198.51.100.${(randomBytes(1)[0] % 250) + 1}` },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }));
    return { status: res.status, body: (await res.json().catch(() => ({}))) as Record<string, unknown>, setCookie: res.headers.getSetCookie() };
}

const adminList = (a: RawAccount) => call('/api/admin/users', 'GET', a.token);

async function passStepUp(a: RawAccount): Promise<string> {
    const pwd = await call('/api/admin/step-up', 'POST', a.token, { password: STRONG_PASSWORD });
    assert.equal(pwd.status, 200, `mot de passe : ${JSON.stringify(pwd.body)}`);
    const before = getFakes().sms.messagesTo(a.phone).length;
    const send = await call('/api/admin/step-up/sms', 'POST', a.token, {});
    assert.equal(send.status, 200, `envoi du code : ${JSON.stringify(send.body)}`);
    const sms = getFakes().sms.messagesTo(a.phone).slice(before).map((m) => m.message);
    assert.equal(sms.length, 1, 'un SMS');
    const code = /code administrateur (\d{6})\./.exec(sms[0])?.[1];
    assert.ok(code, `code dans le SMS : ${sms[0]}`);
    const verify = await call('/api/admin/step-up/sms', 'POST', a.token, { code });
    assert.equal(verify.status, 200, `vérification : ${JSON.stringify(verify.body)}`);
    assert.deepEqual(verify.setCookie.filter((c) => c.startsWith('ev_admin_device=')), [], 'client par jeton : aucun cookie d\'appareil');
    return sms[0];
}

async function sql(text: string, params: unknown[]): Promise<void> {
    await writeLocal(async (c) => { await c.query(text, params); });
}

describe('A3 — code SMS administrateur sur un nouvel appareil', () => {
    test('ADMIN, session jamais confirmée : 403 mot de passe, puis 403 code SMS, puis 200 ; texte du SMS, un segment', async () => {
        const admin = await rawAccount('ADMIN', ['users.read']);
        const first = await adminList(admin);
        console.log(`[A3] session sans saisie : ${first.status} ${JSON.stringify(first.body)}`);
        assert.deepEqual([first.status, first.body.code], [403, 'ADMIN_PASSWORD_REQUIRED'], JSON.stringify(first.body));
        const pwd = await call('/api/admin/step-up', 'POST', admin.token, { password: STRONG_PASSWORD });
        assert.deepEqual([pwd.status, pwd.body.required], [200, 'ADMIN_SMS_REQUIRED'], JSON.stringify(pwd.body));
        const second = await adminList(admin);
        assert.deepEqual([second.status, second.body.code, second.body.reason], [403, 'ADMIN_SMS_REQUIRED', 'NEW_DEVICE'], JSON.stringify(second.body));
        const sms = await passStepUp(admin);
        assert.match(sms, /^Event Village : code administrateur \d{6}\. Ne le donnez à personne\. Valable 10 minutes\.$/);
        assert.deepEqual([smsSegments(sms).encoding, smsSegments(sms).segments], ['GSM7', 1]);
        assert.equal((await adminList(admin)).status, 200, 'administration ouverte après le code');
    });

    test('le premier SUPERADMIN y est soumis comme les autres', async () => {
        const sa = await rawAccount('SUPERADMIN');
        assert.equal((await adminList(sa)).body.code, 'ADMIN_PASSWORD_REQUIRED');
        await passStepUp(sa);
        assert.equal((await adminList(sa)).status, 200);
    });

    test('un compte admin ne peut pas agir ailleurs sans code (routes de compte), un client si', async () => {
        const admin = await rawAccount('ADMIN', ['users.read']);
        const notif = await call('/api/notifications', 'GET', admin.token);
        assert.equal(notif.status, 403, `admin sans code sur /api/notifications : ${JSON.stringify(notif.body)}`);
        const client = await rawAccount('CLIENT');
        const own = await call('/api/notifications', 'GET', client.token);
        assert.equal(own.status, 200, `les sessions des clients ne changent pas : ${JSON.stringify(own.body)}`);
    });

    test('le code administrateur n\'ouvre jamais de session (verify-otp le refuse)', async () => {
        const admin = await rawAccount('ADMIN');
        await call('/api/admin/step-up', 'POST', admin.token, { password: STRONG_PASSWORD });
        const before = getFakes().sms.messagesTo(admin.phone).length;
        await call('/api/admin/step-up/sms', 'POST', admin.token, {});
        const code = /code administrateur (\d{6})/.exec(getFakes().sms.messagesTo(admin.phone).slice(before)[0]?.message ?? '')?.[1];
        assert.ok(code);
        const { POST } = (await import('../../app/api/auth/verify-otp/route')) as { POST: Handler };
        const res = await POST(new NextRequest(`${BASE_URL}/api/auth/verify-otp`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ phone: admin.phone, otpCode: code, isLogin: true }) }));
        const body = (await res.json()) as Record<string, unknown>;
        assert.notEqual(res.status, 200, `code administrateur accepté comme code de connexion : ${JSON.stringify(body)}`);
        assert.equal(body.token_hash, undefined);
    });
});

describe('A4 — sessions de l\'administration', () => {
    test('30 minutes sans activité : mot de passe redemandé (IDLE), puis la session repart', async () => {
        const admin = await rawAccount('ADMIN', ['users.read']);
        await passStepUp(admin);
        assert.equal((await adminList(admin)).status, 200);
        await sql(`UPDATE public.admin_session_activity SET last_activity_at = now() - interval '31 minutes', password_at = now() - interval '31 minutes' WHERE session_id = $1`, [admin.sessionId]);
        await sql(`UPDATE public.password_confirmations SET confirmed_at = now() - interval '31 minutes' WHERE session_id = $1`, [admin.sessionId]);
        const idle = await adminList(admin);
        assert.deepEqual([idle.status, idle.body.code, idle.body.reason], [403, 'ADMIN_PASSWORD_REQUIRED', 'IDLE'], JSON.stringify(idle.body));
        const pwd = await call('/api/admin/step-up', 'POST', admin.token, { password: STRONG_PASSWORD });
        assert.deepEqual([pwd.status, pwd.body.required], [200, null], JSON.stringify(pwd.body));
        assert.equal((await adminList(admin)).status, 200, 'même page, même session : rien n\'est perdu');
    });

    test('après 12 heures : mot de passe et code SMS', async () => {
        const admin = await rawAccount('ADMIN', ['users.read']);
        await passStepUp(admin);
        await sql(`UPDATE public.admin_devices SET sms_verified_at = now() - interval '13 hours' WHERE user_id = $1`, [admin.userId]);
        await sql(`UPDATE public.password_confirmations SET confirmed_at = now() - interval '13 hours' WHERE session_id = $1`, [admin.sessionId]);
        await sql(`UPDATE public.admin_session_activity SET last_activity_at = now(), password_at = now() - interval '13 hours' WHERE session_id = $1`, [admin.sessionId]);
        const r = await adminList(admin);
        assert.deepEqual([r.status, r.body.code, r.body.reason], [403, 'ADMIN_PASSWORD_REQUIRED', 'SESSION_12H'], JSON.stringify(r.body));
        const pwd = await call('/api/admin/step-up', 'POST', admin.token, { password: STRONG_PASSWORD });
        assert.equal(pwd.body.required, 'ADMIN_SMS_REQUIRED', 'puis le code (12 h)');
        const sms = await adminList(admin);
        assert.deepEqual([sms.body.code, sms.body.reason], ['ADMIN_SMS_REQUIRED', 'DEVICE_12H']);
    });

    test('cookies Secure en production (application en HTTPS), pas en local', async () => {
        const mod = (await import('../../lib/supabase/cookie-options')) as { secureCookies(): boolean };
        const previous = process.env.NEXT_PUBLIC_APP_URL;
        try {
            process.env.NEXT_PUBLIC_APP_URL = 'https://app.eventvillage.sn';
            assert.equal(mod.secureCookies(), true);
            process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
            assert.equal(mod.secureCookies(), false);
        } finally {
            process.env.NEXT_PUBLIC_APP_URL = previous;
        }
    });
});

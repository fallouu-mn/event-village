/**
 * Contre-vérification du lot 9 quinquies — aides communes aux suites `tests/audit-auth/cv9qq-*.test.ts`.
 *
 * Chaque suite rejoue une attaque contre ce que le lot a ajouté. Les comptes sont créés sur la base LOCALE (service_role,
 * comme les suites du lot) ; les attaques passent par les vraies routes de l'application, par GoTrue ou par PostgREST
 * avec la clé publique, comme un attaquant.
 */
import '../helpers/env';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { NextRequest } from 'next/server';
import { BASE_URL, randomEmail, randomSenegalPhone, STRONG_PASSWORD } from '../parcours/helpers';
import { service } from '../parcours/paiement-helpers';

export type Handler = (req: NextRequest, ctx?: unknown) => Promise<Response>;
export interface Reply { status: number; body: Record<string, unknown> }

export function freshIp(): string {
    const b = randomBytes(3);
    return `203.0.${b[0]}.${(b[1] % 250) + 1}`;
}

export function anonClient(): SupabaseClient {
    return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
}

export function userClient(token: string): SupabaseClient {
    return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { headers: { Authorization: `Bearer ${token}` } },
    });
}

export function sessionIdOf(token: string): string {
    return String((JSON.parse(Buffer.from(token.split('.')[1] ?? '', 'base64url').toString('utf8')) as { session_id?: string }).session_id);
}

/** Appel direct d'une route de l'application (chemin réel, segments dynamiques passés en `params`). */
export async function callRoute(
    rel: string,
    method: string,
    opts: { token?: string; body?: unknown; cookie?: string; params?: Record<string, string>; url?: string; headers?: Record<string, string> } = {},
): Promise<Reply | null> {
    const mod = (await import(`../../app/api/${rel}/route`)) as Record<string, Handler | undefined>;
    const handler = mod[method];
    if (typeof handler !== 'function') return null;
    const headers: Record<string, string> = { 'content-type': 'application/json', 'x-forwarded-for': freshIp() };
    if (opts.token) headers.authorization = `Bearer ${opts.token}`;
    if (opts.cookie) headers.cookie = opts.cookie;
    Object.assign(headers, opts.headers ?? {});
    const params = opts.params ?? {};
    const res = await handler(new NextRequest(opts.url ?? `${BASE_URL}/api/${rel}`, {
        method,
        headers,
        ...(method === 'GET' || (method === 'DELETE' && opts.body === undefined) ? {} : { body: JSON.stringify(opts.body ?? {}) }),
    }), { params: Object.assign(Promise.resolve(params), params) });
    const text = await res.text();
    let body: Record<string, unknown> = {};
    try { body = text ? JSON.parse(text) as Record<string, unknown> : {}; } catch { body = { raw: text.slice(0, 200) }; }
    return { status: res.status, body };
}

export async function post(rel: string, body: unknown, token?: string): Promise<Reply> {
    const r = await callRoute(rel, 'POST', { body, token });
    assert.ok(r, `POST /api/${rel} absent`);
    return r;
}

export interface Account { userId: string; phone: string; email: string; token: string; sessionId: string }

/**
 * Compte neuf (email et numéro confirmés chez GoTrue, numéro prouvé), session ouverte directement chez GoTrue SANS
 * aucune saisie enregistrée par l'application (ni mot de passe redemandé, ni code administrateur).
 */
export async function rawAccount(label: string, role: 'ADMIN' | 'SUPERADMIN' | 'CLIENT', permissions: readonly string[] = []): Promise<Account> {
    const email = randomEmail(`cv9qq-${label}`);
    const phone = randomSenegalPhone('77');
    const { data, error } = await service.auth.admin.createUser({ email, phone, password: STRONG_PASSWORD, email_confirm: true, phone_confirm: true });
    assert.equal(error, null, error?.message);
    const userId = data.user!.id;
    const { error: upErr } = await service.from('users').update({ phone, first_name: 'Contre', last_name: 'Verification', status: 'ACTIF', phone_verified_at: new Date().toISOString() }).eq('id', userId);
    assert.equal(upErr, null, upErr?.message);
    if (role !== 'CLIENT') {
        const { error: rErr } = await service.from('user_roles').upsert([{ user_id: userId, role }], { onConflict: 'user_id,role' });
        assert.equal(rErr, null, rErr?.message);
        for (const permission of permissions) {
            const { error: pErr } = await service.from('admin_permissions').upsert({ user_id: userId, permission }, { onConflict: 'user_id,permission' });
            assert.equal(pErr, null, `${permission} : ${pErr?.message}`);
        }
    }
    const { data: s, error: sErr } = await anonClient().auth.signInWithPassword({ email, password: STRONG_PASSWORD });
    assert.equal(sErr, null, sErr?.message);
    const token = s.session!.access_token;
    return { userId, phone, email, token, sessionId: sessionIdOf(token) };
}

/** Nouvelle session du même compte, ouverte chez GoTrue sans saisie enregistrée par l'application. */
export async function newSession(email: string, password: string = STRONG_PASSWORD): Promise<{ token: string; sessionId: string }> {
    const { data, error } = await anonClient().auth.signInWithPassword({ email, password });
    assert.equal(error, null, error?.message);
    return { token: data.session!.access_token, sessionId: sessionIdOf(data.session!.access_token) };
}

export const STEP_UP_CODES = new Set(['ADMIN_PASSWORD_REQUIRED', 'ADMIN_SMS_REQUIRED']);

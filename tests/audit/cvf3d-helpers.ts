/**
 * Contre-vérification de la finition 3d (recours et suppléance de l'administration) — aides communes aux suites
 * tests/audit/cvf3d-*. Aucune aide ne corrige quoi que ce soit : elles montent des comptes, appellent les routes réelles
 * de l'application (adresse IP de test tirée au hasard, pour que les quotas par adresse ne se mêlent pas) et lisent la base
 * LOCALE (tests/helpers/db : hôte vérifié).
 */
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { inspect, writeLocal } from '../helpers/db';
import { gotrueEmail } from '../helpers/gotrue-email';
import { stepUpTestSession } from '../helpers/admin-step-up';
import { confirmIdentity, lastSmsCode, smsTo } from '../parcours/f3d-helpers';
import { STRONG_PASSWORD, randomSenegalPhone } from '../parcours/helpers';
import { newAdmin, type TestAdmin } from '../parcours/notif-helpers';
import { service } from '../parcours/paiement-helpers';
import { api, userClient, type Reply, type Row } from './cvf1-helpers';

export type { Reply, Row, TestAdmin };
export { confirmIdentity, lastSmsCode, smsTo, randomSenegalPhone, STRONG_PASSWORD };

/** Adresse de test (TEST-NET-3, RFC 5737), différente à chaque appel. */
function testIp(): string {
    return `203.0.113.${1 + Math.floor(Math.random() * 250)}`;
}

/**
 * Appel d'une route réelle. `rel` : chemin du fichier sous app/api (segments entre crochets) ; `path` : adresse réelle si
 * la route a des segments dynamiques ; `params` : ces segments.
 */
export async function call(method: string, rel: string, opts: {
    token?: string | null; body?: unknown; params?: Record<string, string>; path?: string; headers?: Record<string, string>;
} = {}): Promise<Reply> {
    return api(method, rel, { ...opts, headers: { 'x-forwarded-for': testIp(), ...(opts.headers ?? {}) } });
}

export function show(r: Reply): string {
    return `HTTP ${r.status} ${JSON.stringify(r.body).slice(0, 600)}`;
}

export function sessionIdOf(token: string): string {
    const claims = JSON.parse(Buffer.from(token.split('.')[1] ?? '', 'base64url').toString('utf8')) as { session_id?: string };
    assert.ok(claims.session_id, 'jeton sans session_id');
    return claims.session_id;
}

export interface OpenSession { token: string; refresh: string; sessionId: string }

/**
 * Nouvelle session GoTrue du compte (mot de passe), SANS le code administrateur ni le mot de passe redemandé : c'est la
 * session d'une personne qui vient de se connecter et qui est devant la fenêtre du code.
 */
export async function freshSession(email: string, password: string = STRONG_PASSWORD): Promise<OpenSession> {
    const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const { data, error } = await anon.auth.signInWithPassword({ email: await gotrueEmail(email), password });
    assert.equal(error, null, `connexion de ${email} : ${error?.message}`);
    assert.ok(data.session, `connexion de ${email} : session absente`);
    return { token: data.session.access_token, refresh: data.session.refresh_token, sessionId: sessionIdOf(data.session.access_token) };
}

/** Nouvelle session qui a passé le code administrateur (comme newAdmin), avec son jeton de rafraîchissement. */
export async function steppedUpSession(email: string): Promise<OpenSession> {
    const s = await freshSession(email);
    await stepUpTestSession(s.token);
    return s;
}

/** Rafraîchissement d'une session par son jeton de rafraîchissement : rend l'erreur de GoTrue, ou null s'il a réussi. */
export async function refreshError(refresh: string): Promise<string | null> {
    const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const { data, error } = await anon.auth.refreshSession({ refresh_token: refresh });
    if (error) return `${error.status ?? ''} ${error.message}`;
    return data.session ? null : 'aucune session rendue';
}

/** SUPERADMIN neuf ; `identity` : mot de passe et code administrateur saisis pour de vrai (10 minutes). */
export async function superadmin(label: string, identity = true): Promise<TestAdmin> {
    const sa = await newAdmin(label, [], { role: 'SUPERADMIN' });
    if (identity) await confirmIdentity(sa);
    return sa;
}

/** Recule le code administrateur des appareils du compte de `minutes` (la session garde le code de moins de 12 h). */
export async function ageDeviceCode(userId: string, minutes: number): Promise<void> {
    await writeLocal(async (c) => {
        const r = await c.query(`UPDATE public.admin_devices SET sms_verified_at = now() - make_interval(mins => $2) WHERE user_id = $1`, [userId, minutes]);
        assert.ok((r.rowCount ?? 0) > 0, 'aucun appareil admin à vieillir');
    });
}

/** Mot de passe saisi de nouveau pour la session (POST /api/admin/step-up), sans le code. */
export async function confirmPasswordOnly(token: string, password: string = STRONG_PASSWORD): Promise<void> {
    const r = await call('POST', 'admin/step-up', { token, body: { password } });
    assert.equal(r.status, 200, `mot de passe redemandé : ${show(r)}`);
}

export async function phoneOf(userId: string): Promise<string | null> {
    const { data, error } = await service.from('users').select('phone').eq('id', userId).single();
    assert.equal(error, null, error?.message);
    return (data?.phone as string | null) ?? null;
}

/** Numéro de connexion chez GoTrue (auth.users.phone, sans « + »). */
export async function authPhoneOf(userId: string): Promise<string | null> {
    return inspect(async (c) => {
        const r = await c.query(`SELECT phone FROM auth.users WHERE id = $1`, [userId]);
        return r.rows.length ? ((r.rows[0].phone as string | null) ?? null) : null;
    });
}

export function digits(phone: string | null): string {
    return (phone ?? '').replace(/\D/g, '');
}

export async function sessionsOf(userId: string): Promise<number> {
    return inspect(async (c) => Number((await c.query(`SELECT count(*)::int AS n FROM auth.sessions WHERE user_id = $1`, [userId])).rows[0].n));
}

export async function devicesOf(userId: string): Promise<number> {
    return inspect(async (c) => Number((await c.query(`SELECT count(*)::int AS n FROM public.admin_devices WHERE user_id = $1`, [userId])).rows[0].n));
}

/**
 * Pouvoir d'administration d'un jeton par la REST : nombre de comptes d'autres personnes que la table `users` lui rend
 * (politique users_select_policy : son compte, ou is_admin()). 0 pour un client ; plus de 0 pour une session admin admise.
 */
export async function othersSeen(token: string, ownId: string): Promise<{ n: number; error: string | null }> {
    const { data, error } = await userClient(token).from('users').select('id').neq('id', ownId).limit(20);
    return { n: (data ?? []).length, error: error ? `${error.code ?? ''} ${error.message}` : null };
}

export async function auditCount(action: string, objectId: string): Promise<number> {
    const { count, error } = await service.from('audit_logs').select('id', { count: 'exact', head: true }).eq('action', action).eq('object_id', objectId);
    assert.equal(error, null, error?.message);
    return count ?? 0;
}

export async function outboxRows(type: string, filter: { userId?: string; phone?: string; groupKey?: string } = {}): Promise<Row[]> {
    let q = service.from('notification_outbox').select('id, type, channel, recipient_user_id, recipient_phone, group_key, status, template_data').eq('type', type);
    if (filter.userId) q = q.eq('recipient_user_id', filter.userId);
    if (filter.phone) q = q.eq('recipient_phone', filter.phone);
    if (filter.groupKey) q = q.eq('group_key', filter.groupKey);
    const { data, error } = await q;
    assert.equal(error, null, error?.message);
    return (data ?? []) as Row[];
}

/** Textes écrits sur la console pendant `fn` (journal du serveur), pour y chercher un secret. */
export async function captureConsole<T>(fn: () => Promise<T>): Promise<{ value: T; text: string }> {
    const lines: string[] = [];
    const saved = { log: console.log, error: console.error, warn: console.warn, info: console.info, debug: console.debug };
    const grab = (...args: unknown[]): void => {
        lines.push(args.map((a) => {
            if (typeof a === 'string') return a;
            if (a instanceof Error) return `${a.message} ${a.stack ?? ''}`;
            try { return JSON.stringify(a); } catch { return String(a); }
        }).join(' '));
    };
    console.log = grab; console.error = grab; console.warn = grab; console.info = grab; console.debug = grab;
    try {
        const value = await fn();
        return { value, text: lines.join('\n') };
    } finally {
        Object.assign(console, saved);
    }
}

/**
 * Met au statut SUSPENDU tous les SUPERADMIN actifs sauf `keep` (écriture validée : deux connexions concurrentes doivent la
 * voir) ; rend les comptes suspendus, à remettre par reactivate() dans un finally. Les suites tournent l'une après l'autre
 * (scripts/run-tests.mjs) : aucune autre suite ne voit cet état.
 */
export async function suspendOtherSuperadmins(keep: string[]): Promise<string[]> {
    return writeLocal(async (c) => {
        const r = await c.query(
            `UPDATE public.users u SET status = 'SUSPENDU'
              WHERE u.status::text = 'ACTIF' AND NOT (u.id = ANY ($1::uuid[]))
                AND u.id IN (SELECT r.user_id FROM public.user_roles r WHERE r.role::text = 'SUPERADMIN')
          RETURNING u.id::text AS id`, [keep]);
        return r.rows.map((x) => String(x.id));
    });
}

export async function reactivate(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    await writeLocal((c) => c.query(`UPDATE public.users SET status = 'ACTIF' WHERE id = ANY ($1::uuid[])`, [ids]));
}

export async function activeSuperadmins(among?: string[]): Promise<string[]> {
    return inspect(async (c) => {
        const r = await c.query(
            `SELECT u.id::text AS id FROM public.users u JOIN public.user_roles r ON r.user_id = u.id
              WHERE r.role::text = 'SUPERADMIN' AND u.status::text = 'ACTIF' AND ($1::uuid[] IS NULL OR u.id = ANY ($1::uuid[]))
              ORDER BY 1`, [among ?? null]);
        return r.rows.map((x) => String(x.id));
    });
}

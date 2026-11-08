/**
 * Lot 9, tâche 9.2 (contrat 4.3, 5.3 ; L24, L25 ; AR2) — profil du client : PATCH /api/account/profile.
 *  - prénom, nom, email validés par Zod ; email en minuscules ; domaine @eventvillage.sn refusé ; email vidé : email
 *    technique du numéro rétabli, jamais NULL ;
 *  - auth.users n'est écrit que par auth.admin.updateUserById, avant la RPC account_profile_finalize ; email_exists et
 *    l'unique de public.users donnent 409 EMAIL_TAKEN ; RPC en échec : l'API est rappelée vers la valeur relue dans
 *    public.users ; compensation en échec : 500 ACCOUNT_SYNC_FAILED, ligne ACCOUNT_AUTH_DESYNC, réparation par un nouvel
 *    enregistrement ;
 *  - la connexion suit : par le nouvel email, par le numéro ; l'ancien email est refusé ;
 *  - un compte ne touche jamais à un autre, quel que soit le corps.
 *
 * Rouge avant correctif : la route app/api/account/profile n'existe pas (import dynamique, l'échec la nomme), ni la RPC ;
 * après les tests, assertLot9Invariants reste rouge tant que M2 et M4 ne sont pas livrés.
 *
 * Verts dès l'écriture, signalés : les deux cas du middleware (règle générale des /api/*) ; le cas « SUPPOSÉ email_exists »
 * ne dépend pas du code du lot : il lit GoTrue, et son message d'échec tranche le SUPPOSÉ du contrat au run « avant ».
 *
 * Les pannes passent par globalThis.fetch (le client serveur lit le fetch global à chaque requête, voir
 * messages-bruts.test.ts). Chaque test travaille sur des comptes neufs : les invariants (v) lisent toute la base, et la
 * suite répare elle-même le compte qu'elle laisse désynchronisé (v6).
 */
import '../helpers/env';
import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { NextRequest } from 'next/server';
import { POST as resolvePhone } from '../../app/api/auth/resolve-phone/route';
import { assertLot9Invariants } from '../helpers/lot9-invariants';
import { callMiddleware, sessionCookies } from '../helpers/middleware';
import { authed } from './acces-helpers';
import { BASE_URL, jsonRequest, randomEmail, STRONG_PASSWORD } from './helpers';
import { importModule, newBuyer, service, type Buyer } from './paiement-helpers';

after(async () => {
    await assertLot9Invariants('compte-profil');
});

const PROFILE_PATH = '/api/account/profile';
const SENTINEL = 'SENTINELLE_PROFIL';
const CODE_RE = /^[A-Z][A-Z0-9]*(_[A-Z0-9]+)+$/;

interface Reply { status: number; body: Record<string, unknown>; text: string; headers: Headers }

async function reply(res: Response): Promise<Reply> {
    const text = await res.text();
    let body: Record<string, unknown> = {};
    try {
        body = text ? JSON.parse(text) as Record<string, unknown> : {};
    } catch (err) {
        assert.fail(`réponse non JSON (${err instanceof Error ? err.message : String(err)}) : ${text.slice(0, 200)}`);
    }
    return { status: res.status, body, text, headers: res.headers };
}

async function route(): Promise<(req: NextRequest) => Promise<Response>> {
    const mod = await importModule('../../app/api/account/profile/route');
    assert.equal(typeof mod.PATCH, 'function', 'app/api/account/profile/route doit exporter PATCH (contrat 4.3)');
    return mod.PATCH;
}

async function patchProfile(user: Buyer, body: unknown): Promise<Reply> {
    return reply(await (await route())(authed(PROFILE_PATH, 'PATCH', user, body)));
}

interface Identity { first_name: string; last_name: string; email: string | null; phone: string | null }

async function profileOf(userId: string): Promise<Identity> {
    const { data, error } = await service.from('users').select('first_name, last_name, email, phone').eq('id', userId).single();
    assert.equal(error, null, `profil : ${error?.message}`);
    return data as Identity;
}

async function authEmailOf(userId: string): Promise<string | undefined> {
    const { data, error } = await service.auth.admin.getUserById(userId);
    assert.equal(error, null, `auth.users : ${error?.message}`);
    return data.user?.email;
}

function anonClient(): SupabaseClient {
    return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function signInError(email: string): Promise<string | null> {
    const { error } = await anonClient().auth.signInWithPassword({ email, password: STRONG_PASSWORD });
    return error ? error.message : null;
}

/** Connexion comme l'écran : numéro → resolve-phone → email → mot de passe. */
async function loginByPhone(phone: string): Promise<{ status: number; signInError: string | null; email: unknown }> {
    const from = `203.0.113.${randomBytes(1)[0] % 250 + 1}`;
    const res = await reply(await resolvePhone(jsonRequest('/api/auth/resolve-phone', { phone }, { 'x-forwarded-for': `${from}, 10.0.0.1` })));
    if (res.status !== 200) return { status: res.status, signInError: null, email: res.body.email };
    return { status: 200, signInError: await signInError(String(res.body.email)), email: res.body.email };
}

async function auditRows(userId: string, action: string): Promise<Array<Record<string, unknown>>> {
    const { data, error } = await service.from('audit_logs').select('*').eq('user_id', userId).eq('action', action);
    assert.equal(error, null, `audit_logs : ${error?.message}`);
    return (data ?? []) as Array<Record<string, unknown>>;
}

function freshEmail(label: string): string {
    return randomEmail(`profil-${label}`);
}

function technicalEmail(phone: string): string {
    return `${phone.replace('+', '')}@eventvillage.sn`;
}

function valid(user: Buyer, email: string): Record<string, unknown> {
    return { first_name: user.firstName, last_name: user.lastName, email };
}

/** Détache l'email du profil de celui d'authentification : public.users reçoit `value`, auth.users garde le sien. */
async function setProfileEmail(userId: string, value: string): Promise<void> {
    const { error } = await service.from('users').update({ email: value }).eq('id', userId);
    assert.equal(error, null, `email du profil : ${error?.message}`);
}

// ── Pannes et écoute des appels sortants ───────────────────────────────────

interface Hit { path: string; method: string; body: Record<string, unknown> | null }
type Pass = () => Promise<Response>;

interface Rule {
    name: string;
    match: (url: URL, method: string) => boolean;
    /** Défaut : panne 500 à chaque passage. */
    reply?: (pass: Pass, n: number) => Promise<Response> | Response;
}

function fault(): Response {
    return new Response(JSON.stringify({ message: `relation "x" ${SENTINEL}`, code: '42P01', msg: SENTINEL }), {
        status: 500,
        headers: { 'content-type': 'application/json' },
    });
}

const adminUserUpdate = (userId: string): Rule['match'] => (url, method) => method === 'PUT' && url.pathname === `/auth/v1/admin/users/${userId}`;
const finalizeRpc: Rule['match'] = (url, method) => method === 'POST' && url.pathname === '/rest/v1/rpc/account_profile_finalize';

/** Exécute `fn` avec les règles posées sur fetch ; passages comptés par règle, journal d'erreurs capturé. */
async function intercept<T>(rules: Rule[], fn: () => Promise<T>): Promise<{ result: T; hits: Record<string, Hit[]>; logged: string[] }> {
    const previousFetch = globalThis.fetch;
    const previousError = console.error;
    const logged: string[] = [];
    const hits: Record<string, Hit[]> = Object.fromEntries(rules.map((r) => [r.name, [] as Hit[]]));
    globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
        const href = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
        const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
        const url = new URL(href);
        const rule = rules.find((r) => r.match(url, method));
        if (!rule) return previousFetch(input, init);
        hits[rule.name].push({ path: url.pathname, method, body: typeof init?.body === 'string' ? JSON.parse(init.body) as Record<string, unknown> : null });
        const pass: Pass = () => previousFetch(input, init);
        return rule.reply ? rule.reply(pass, hits[rule.name].length) : fault();
    }) as typeof fetch;
    console.error = (...args: unknown[]): void => {
        logged.push(args.map((a) => (a instanceof Error ? a.message : typeof a === 'string' ? a : JSON.stringify(a))).join(' '));
    };
    try {
        return { result: await fn(), hits, logged };
    } finally {
        globalThis.fetch = previousFetch;
        console.error = previousError;
    }
}

function assertCleanFailure(r: Reply, what: string): void {
    assert.equal(r.text.includes(SENTINEL), false, `${what} : texte de la base renvoyé au navigateur : ${r.text.slice(0, 300)}`);
    assert.equal(typeof r.body.error, 'string', `${what} : message absent : ${r.text.slice(0, 300)}`);
    assert.match(String(r.body.code), CODE_RE, `${what} : code stable attendu : ${r.text.slice(0, 300)}`);
}

// ── Enregistrement ─────────────────────────────────────────────────────────

describe('PATCH /api/account/profile — enregistrement', () => {
    test('prénom, nom, email : 200, public.users et auth.users à jour, réponse sans cache, audit sans valeur', async () => {
        const a = await newBuyer('profil-ok');
        const email = freshEmail('ok');
        const r = await patchProfile(a, { first_name: '  Fatou ', last_name: ' Ndiaye  ', email });
        assert.equal(r.status, 200, r.text);
        assert.deepEqual(r.body, { ok: true, email_technical: false });
        assert.match(r.headers.get('cache-control') ?? '', /no-store/, 'réponse non mise en cache');
        const row = await profileOf(a.userId);
        assert.equal(row.first_name, 'Fatou');
        assert.equal(row.last_name, 'Ndiaye');
        assert.equal(row.email, email);
        assert.equal(await authEmailOf(a.userId), email, 'auth.users.email suit public.users.email (D-cpt C2)');
        const audit = await auditRows(a.userId, 'ACCOUNT_PROFILE_UPDATED');
        assert.equal(audit.length, 1, 'une ligne d’audit par enregistrement');
        const fields = (audit[0].metadata as { fields?: unknown }).fields;
        assert.ok(Array.isArray(fields) && fields.includes('email'), `metadata.fields : ${JSON.stringify(audit[0].metadata)}`);
        const dump = JSON.stringify(audit[0]);
        for (const value of [email, 'Fatou', 'Ndiaye']) assert.equal(dump.includes(value), false, `valeur « ${value} » au journal : ${dump}`);
    });

    test('email saisi en majuscules : enregistré en minuscules dans les deux tables', async () => {
        const a = await newBuyer('profil-maj');
        const email = freshEmail('maj');
        const r = await patchProfile(a, valid(a, email.toUpperCase()));
        assert.equal(r.status, 200, r.text);
        assert.equal((await profileOf(a.userId)).email, email);
        assert.equal(await authEmailOf(a.userId), email);
    });

    test('email inchangé : aucun appel à l’API d’authentification, prénom enregistré', async () => {
        const a = await newBuyer('profil-inchange');
        const { result, hits } = await intercept([{ name: 'put', match: adminUserUpdate(a.userId), reply: (pass) => pass() }],
            () => patchProfile(a, { first_name: 'Mariama', last_name: a.lastName, email: a.email }));
        assert.equal(result.status, 200, result.text);
        assert.equal(hits.put.length, 0, 'aucune écriture de auth.users pour un email inchangé');
        assert.equal((await profileOf(a.userId)).first_name, 'Mariama');
    });

    test('appel à l’API d’authentification : updateUserById avec email et email_confirm, une seule fois', async () => {
        const a = await newBuyer('profil-api');
        const email = freshEmail('api');
        const { result, hits } = await intercept([{ name: 'put', match: adminUserUpdate(a.userId), reply: (pass) => pass() }],
            () => patchProfile(a, valid(a, email)));
        assert.equal(result.status, 200, result.text);
        assert.equal(hits.put.length, 1, `appels : ${JSON.stringify(hits.put)}`);
        assert.equal(hits.put[0].body?.email, email);
        assert.equal(hits.put[0].body?.email_confirm, true);
    });

    test('la connexion suit : nouvel email accepté, ancien refusé, connexion par numéro intacte', async () => {
        const a = await newBuyer('profil-login');
        const email = freshEmail('login');
        const r = await patchProfile(a, valid(a, email));
        assert.equal(r.status, 200, r.text);
        assert.equal(await signInError(email), null, 'connexion par le nouvel email');
        assert.notEqual(await signInError(a.email), null, 'l’ancien email ne doit plus ouvrir de session');
        const byPhone = await loginByPhone(a.phoneE164);
        assert.equal(byPhone.status, 200, `resolve-phone : ${JSON.stringify(byPhone)}`);
        assert.equal(byPhone.email, email, 'resolve-phone rend le nouvel email');
        assert.equal(byPhone.signInError, null, 'connexion par le numéro après le changement d’email');
    });
});

describe('PATCH /api/account/profile — email vidé (L24)', () => {
    test('email vide : email technique du numéro rétabli dans les deux tables, connexion possible, email_technical vrai', async () => {
        const a = await newBuyer('profil-vide');
        const r = await patchProfile(a, valid(a, ''));
        assert.equal(r.status, 200, r.text);
        assert.deepEqual(r.body, { ok: true, email_technical: true });
        const expected = technicalEmail(a.phoneE164);
        assert.equal((await profileOf(a.userId)).email, expected, 'jamais NULL');
        assert.equal(await authEmailOf(a.userId), expected);
        const byPhone = await loginByPhone(a.phoneE164);
        assert.equal(byPhone.signInError, null, `connexion par le numéro : ${JSON.stringify(byPhone)}`);
    });

    test('email vide alors qu’il est déjà technique : aucun appel à l’API', async () => {
        const a = await newBuyer('profil-vide2');
        const first = await patchProfile(a, valid(a, ''));
        assert.equal(first.status, 200, first.text);
        const { result, hits } = await intercept([{ name: 'put', match: adminUserUpdate(a.userId), reply: (pass) => pass() }],
            () => patchProfile(a, valid(a, '')));
        assert.equal(result.status, 200, result.text);
        assert.equal(hits.put.length, 0);
        assert.equal(result.body.email_technical, true);
    });

    test('email vide sans numéro : 400 INVALID_FIELD sur email, rien d’écrit', async () => {
        const a = await newBuyer('profil-sansnum');
        const { error } = await service.from('users').update({ phone: null }).eq('id', a.userId);
        assert.equal(error, null, `retrait du numéro : ${error?.message}`);
        const r = await patchProfile(a, valid(a, ''));
        assert.equal(r.status, 400, r.text);
        assert.equal(r.body.code, 'INVALID_FIELD', r.text);
        assert.equal(r.body.field, 'email', r.text);
        assert.equal((await profileOf(a.userId)).email, a.email);
        assert.equal(await authEmailOf(a.userId), a.email);
    });
});

describe('PATCH /api/account/profile — refus de validation', () => {
    test('champs invalides : 400 INVALID_FIELD et champ nommé, rien d’écrit, aucun appel à l’API', async () => {
        const a = await newBuyer('profil-zod');
        const before = await profileOf(a.userId);
        const cases: Array<[string, Record<string, unknown>, string]> = [
            ['prénom d’un caractère', { first_name: 'A', last_name: 'Diop', email: a.email }, 'first_name'],
            ['prénom d’un caractère après trim', { first_name: '  A  ', last_name: 'Diop', email: a.email }, 'first_name'],
            ['prénom de 81 caractères', { first_name: 'x'.repeat(81), last_name: 'Diop', email: a.email }, 'first_name'],
            ['nom d’un caractère', { first_name: 'Awa', last_name: 'B', email: a.email }, 'last_name'],
            ['nom absent', { first_name: 'Awa', email: a.email }, 'last_name'],
            ['email mal formé', { first_name: 'Awa', last_name: 'Diop', email: 'pas-un-email' }, 'email'],
            ['email absent', { first_name: 'Awa', last_name: 'Diop' }, 'email'],
            ['domaine réservé', { first_name: 'Awa', last_name: 'Diop', email: '221770000000@eventvillage.sn' }, 'email'],
            ['domaine réservé en majuscules', { first_name: 'Awa', last_name: 'Diop', email: 'QUELQUUN@EVENTVILLAGE.SN' }, 'email'],
        ];
        const { result, hits } = await intercept([{ name: 'put', match: adminUserUpdate(a.userId), reply: (pass) => pass() }], async () => {
            const out: Array<[string, string, Reply]> = [];
            for (const [what, body, field] of cases) out.push([what, field, await patchProfile(a, body)]);
            return out;
        });
        for (const [what, field, r] of result) {
            assert.equal(r.status, 400, `${what} : ${r.text}`);
            assert.equal(r.body.code, 'INVALID_FIELD', `${what} : ${r.text}`);
            assert.equal(r.body.field, field, `${what} : ${r.text}`);
            assert.equal(typeof r.body.error, 'string', `${what} : message absent`);
        }
        assert.equal(hits.put.length, 0, 'aucune écriture de auth.users sur un refus');
        assert.deepEqual(await profileOf(a.userId), before, 'profil inchangé');
        assert.equal(await authEmailOf(a.userId), a.email);
    });

    test('corps illisible : 400 INVALID_BODY', async () => {
        const a = await newBuyer('profil-corps');
        const req = new NextRequest(`${BASE_URL}${PROFILE_PATH}`, {
            method: 'PATCH',
            headers: { 'content-type': 'application/json', authorization: `Bearer ${a.accessToken}` },
            body: 'pas du json',
        });
        const r = await reply(await (await route())(req));
        assert.equal(r.status, 400, r.text);
        assert.equal(r.body.code, 'INVALID_BODY', r.text);
    });
});

describe('PATCH /api/account/profile — unicité de l’email', () => {
    test('email d’un autre compte, même casse puis casse différente : 409 EMAIL_TAKEN, rien d’écrit', async () => {
        const a = await newBuyer('profil-pris-a');
        const b = await newBuyer('profil-pris-b');
        for (const email of [b.email, b.email.toUpperCase()]) {
            const r = await patchProfile(a, { first_name: 'Modifiee', last_name: a.lastName, email });
            assert.equal(r.status, 409, `${email} : ${r.text}`);
            assert.equal(r.body.code, 'EMAIL_TAKEN', `${email} : ${r.text}`);
            assertCleanFailure(r, 'email pris');
        }
        const row = await profileOf(a.userId);
        assert.equal(row.first_name, a.firstName, 'le prénom n’est pas enregistré sur un refus');
        assert.equal(row.email, a.email);
        assert.equal(await authEmailOf(a.userId), a.email);
        assert.equal((await auditRows(a.userId, 'ACCOUNT_PROFILE_UPDATED')).length, 0);
    });

    test('email présent seulement dans auth.users : 409 EMAIL_TAKEN par email_exists, sans compensation ni RPC', async () => {
        const a = await newBuyer('profil-auth-a');
        const ghost = await newBuyer('profil-auth-b');
        await setProfileEmail(ghost.userId, freshEmail('decale'));
        const { result, hits } = await intercept([
            { name: 'put', match: adminUserUpdate(a.userId), reply: (pass) => pass() },
            { name: 'rpc', match: finalizeRpc, reply: (pass) => pass() },
        ], () => patchProfile(a, valid(a, ghost.email)));
        assert.equal(result.status, 409, result.text);
        assert.equal(result.body.code, 'EMAIL_TAKEN', result.text);
        assert.equal(hits.put.length, 1, 'rien n’a été écrit : aucune compensation');
        assert.equal(hits.rpc.length, 0, 'la RPC n’est pas appelée après un refus de l’API');
        assert.equal(await authEmailOf(a.userId), a.email);
    });

    test('email présent seulement dans public.users : 409 EMAIL_TAKEN par la RPC, API rappelée vers l’ancienne valeur', async () => {
        const a = await newBuyer('profil-pub-a');
        const other = await newBuyer('profil-pub-b');
        const taken = freshEmail('public');
        await setProfileEmail(other.userId, taken);
        const { result, hits } = await intercept([{ name: 'put', match: adminUserUpdate(a.userId), reply: (pass) => pass() }],
            () => patchProfile(a, valid(a, taken)));
        assert.equal(result.status, 409, result.text);
        assert.equal(result.body.code, 'EMAIL_TAKEN', result.text);
        assert.equal(hits.put.length, 2, `aller puis compensation : ${JSON.stringify(hits.put)}`);
        assert.equal(hits.put[1].body?.email, a.email, 'compensation vers la valeur de public.users');
        assert.equal(await authEmailOf(a.userId), a.email);
        assert.equal((await profileOf(a.userId)).email, a.email);
    });

    test('deux comptes vers le même email en même temps : un seul gagne, l’autre 409 et garde son email partout', async () => {
        const a = await newBuyer('profil-course-a');
        const b = await newBuyer('profil-course-b');
        const email = freshEmail('course');
        const [ra, rb] = await Promise.all([patchProfile(a, valid(a, email)), patchProfile(b, valid(b, email))]);
        assert.deepEqual([ra.status, rb.status].sort(), [200, 409], `${ra.text} / ${rb.text}`);
        const [winner, loser, lost] = ra.status === 200 ? [a, b, rb] : [b, a, ra];
        assert.equal(lost.body.code, 'EMAIL_TAKEN', lost.text);
        assert.equal((await profileOf(winner.userId)).email, email);
        assert.equal(await authEmailOf(winner.userId), email);
        assert.equal((await profileOf(loser.userId)).email, loser.email);
        assert.equal(await authEmailOf(loser.userId), loser.email);
    });

    test('profil modifié entre la lecture et la RPC : 409 EMAIL_CONFLICT, auth.users aligné sur la valeur relue', async () => {
        const a = await newBuyer('profil-conflit');
        const wanted = freshEmail('voulu');
        const concurrent = freshEmail('concurrent');
        const { result, hits } = await intercept([
            { name: 'put', match: adminUserUpdate(a.userId), reply: (pass) => pass() },
            {
                name: 'rpc',
                match: finalizeRpc,
                reply: async (pass) => {
                    await setProfileEmail(a.userId, concurrent);
                    return pass();
                },
            },
        ], () => patchProfile(a, valid(a, wanted)));
        assert.equal(result.status, 409, result.text);
        assert.equal(result.body.code, 'EMAIL_CONFLICT', result.text);
        assert.equal(hits.rpc.length, 1);
        assert.equal(hits.put.length, 2, 'compensation après le conflit');
        assert.equal(hits.put[1].body?.email, concurrent, 'valeur relue à l’instant de la compensation, pas celle du début');
        assert.equal(await authEmailOf(a.userId), concurrent);
        assert.equal((await profileOf(a.userId)).email, concurrent);
    });
});

describe('PATCH /api/account/profile — droits', () => {
    test('A ne modifie que lui-même : id, user_id et userId du corps ignorés', async () => {
        const a = await newBuyer('profil-droit-a');
        const b = await newBuyer('profil-droit-b');
        const bBefore = await profileOf(b.userId);
        const email = freshEmail('droit');
        const r = await patchProfile(a, { first_name: 'Prenoma', last_name: 'Noma', email, id: b.userId, user_id: b.userId, userId: b.userId });
        assert.equal(r.status, 200, r.text);
        assert.equal((await profileOf(a.userId)).email, email);
        assert.deepEqual(await profileOf(b.userId), bBefore, 'B n’est pas modifié');
        assert.equal(await authEmailOf(b.userId), b.email, 'auth.users de B intact');
    });

    test('sans session : 401 AUTH_REQUIRED', async () => {
        const req = new NextRequest(`${BASE_URL}${PROFILE_PATH}`, {
            method: 'PATCH',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ first_name: 'Awa', last_name: 'Diop', email: 'a@example.invalid' }),
        });
        const r = await reply(await (await route())(req));
        assert.equal(r.status, 401, r.text);
        assert.equal(r.body.code, 'AUTH_REQUIRED', r.text);
    });

    test('compte suspendu : 403 ACCOUNT_NOT_ACTIVE, rien d’écrit', async () => {
        const a = await newBuyer('profil-susp');
        const { error } = await service.from('users').update({ status: 'SUSPENDU' }).eq('id', a.userId);
        assert.equal(error, null, `suspension : ${error?.message}`);
        const r = await patchProfile(a, { first_name: 'Modifiee', last_name: a.lastName, email: freshEmail('susp') });
        assert.equal(r.status, 403, r.text);
        assert.equal(r.body.code, 'ACCOUNT_NOT_ACTIVE', r.text);
        assert.equal((await profileOf(a.userId)).first_name, a.firstName);
        assert.equal(await authEmailOf(a.userId), a.email);
    });

    test('middleware : 401 sans session (déjà vrai, garde-fou)', async () => {
        const result = await callMiddleware(PROFILE_PATH, []);
        assert.equal(result.status, 401, JSON.stringify(result));
        assert.equal(result.passedThrough, false);
    });

    test('middleware : une session passe (déjà vrai, garde-fou)', async () => {
        const a = await newBuyer('profil-mw');
        const client = anonClient();
        const { error } = await client.auth.signInWithPassword({ email: a.email, password: STRONG_PASSWORD });
        assert.equal(error, null, `connexion : ${error?.message}`);
        const result = await callMiddleware(PROFILE_PATH, await sessionCookies(client));
        assert.equal(result.passedThrough, true, JSON.stringify(result));
    });
});

describe('PATCH /api/account/profile — pannes (AR2, L28)', () => {
    test('API d’authentification en panne : 500 PROFILE_SAVE_FAILED, public.users inchangé, RPC non appelée', async () => {
        const a = await newBuyer('profil-panne-api');
        const { result, hits, logged } = await intercept([
            { name: 'put', match: adminUserUpdate(a.userId) },
            { name: 'rpc', match: finalizeRpc, reply: (pass) => pass() },
        ], () => patchProfile(a, { first_name: 'Modifiee', last_name: a.lastName, email: freshEmail('panne') }));
        assert.equal(result.status, 500, result.text);
        assert.equal(result.body.code, 'PROFILE_SAVE_FAILED', result.text);
        assertCleanFailure(result, 'panne de l’API');
        assert.equal(hits.put.length, 1);
        assert.equal(hits.rpc.length, 0);
        assert.ok(logged.length >= 1, 'panne journalisée');
        const row = await profileOf(a.userId);
        assert.equal(row.first_name, a.firstName);
        assert.equal(row.email, a.email);
    });

    test('RPC en panne : 500 PROFILE_SAVE_FAILED, API rappelée vers l’ancien email, les deux tables alignées', async () => {
        const a = await newBuyer('profil-panne-rpc');
        const email = freshEmail('rpc');
        const { result, hits } = await intercept([
            { name: 'put', match: adminUserUpdate(a.userId), reply: (pass) => pass() },
            { name: 'rpc', match: finalizeRpc },
        ], () => patchProfile(a, valid(a, email)));
        assert.equal(result.status, 500, result.text);
        assert.equal(result.body.code, 'PROFILE_SAVE_FAILED', result.text);
        assertCleanFailure(result, 'panne de la RPC');
        assert.equal(hits.rpc.length, 1, 'RPC appelée une seule fois, sans nouvel essai');
        assert.equal(hits.put.length, 2, `aller puis compensation : ${JSON.stringify(hits.put)}`);
        assert.equal(hits.put[0].body?.email, email);
        assert.equal(hits.put[1].body?.email, a.email, 'compensation vers la valeur de public.users');
        assert.equal(hits.put[1].body?.email_confirm, true);
        assert.equal(await authEmailOf(a.userId), a.email);
        assert.equal((await profileOf(a.userId)).email, a.email);
        assert.equal((await auditRows(a.userId, 'ACCOUNT_AUTH_DESYNC')).length, 0, 'compensation réussie : aucune désynchronisation');
    });

    test('compensation en échec : 500 ACCOUNT_SYNC_FAILED, ligne ACCOUNT_AUTH_DESYNC, journal sans email, réparation par un nouvel enregistrement', async () => {
        const a = await newBuyer('profil-desync');
        const email = freshEmail('desync');
        const { result, hits, logged } = await intercept([
            { name: 'put', match: adminUserUpdate(a.userId), reply: (pass, n) => (n === 1 ? pass() : fault()) },
            { name: 'rpc', match: finalizeRpc },
        ], () => patchProfile(a, valid(a, email)));
        assert.equal(result.status, 500, result.text);
        assert.equal(result.body.code, 'ACCOUNT_SYNC_FAILED', result.text);
        assertCleanFailure(result, 'compensation en échec');
        assert.equal(hits.put.length, 2, 'un seul essai de compensation, sans boucle');
        assert.ok(logged.some((l) => l.includes('[account-sync]')), `journal attendu : ${logged.join(' | ')}`);
        assert.equal(logged.some((l) => l.includes(email) || l.includes(a.email)), false, `email en clair au journal : ${logged.join(' | ')}`);

        assert.equal((await profileOf(a.userId)).email, a.email, 'public.users garde l’ancienne valeur');
        assert.equal(await authEmailOf(a.userId), email, 'auth.users porte la nouvelle valeur (contrat, état laissé)');
        const desync = await auditRows(a.userId, 'ACCOUNT_AUTH_DESYNC');
        assert.equal(desync.length, 1, 'ligne de repérage pour le support');
        assert.equal((desync[0].metadata as { step?: unknown }).step, 'compensation', JSON.stringify(desync[0].metadata));
        assert.equal(typeof (desync[0].metadata as { label?: unknown }).label, 'string', JSON.stringify(desync[0].metadata));
        assert.equal((await auditRows(a.userId, 'ACCOUNT_PROFILE_UPDATED')).length, 0, 'la RPC a été annulée');

        const repaired = await patchProfile(a, valid(a, email));
        assert.equal(repaired.status, 200, `réparation : ${repaired.text}`);
        assert.equal((await profileOf(a.userId)).email, email);
        assert.equal(await authEmailOf(a.userId), email);
        assert.equal(await signInError(email), null, 'connexion après réparation');
    });

    test('changement d’email : le numéro reste le même dans le profil et dans l’authentification', async () => {
        const a = await newBuyer('profil-num');
        const r = await patchProfile(a, valid(a, freshEmail('num')));
        assert.equal(r.status, 200, r.text);
        assert.equal((await profileOf(a.userId)).phone, a.phoneE164, 'numéro du profil inchangé');
        const { data, error } = await service.auth.admin.getUserById(a.userId);
        assert.equal(error, null, `auth.users : ${error?.message}`);
        assert.equal(data.user?.phone, a.phoneE164.replace('+', ''), 'numéro d’authentification inchangé');
    });
});

describe('Hypothèse de GoTrue (SUPPOSÉ du contrat, section 13)', () => {
    test('SUPPOSÉ : updateUserById vers un email pris renvoie error.code = email_exists', async () => {
        const a = await newBuyer('profil-gotrue-a');
        const b = await newBuyer('profil-gotrue-b');
        const { error } = await service.auth.admin.updateUserById(a.userId, { email: b.email, email_confirm: true });
        assert.ok(error, 'GoTrue accepte un email déjà pris : le refus 409 EMAIL_TAKEN du contrat ne peut pas reposer sur l’API');
        assert.equal(error.code, 'email_exists',
            `SUPPOSÉ INFIRMÉ (contrat, section 13) : GoTrue ne renvoie pas email_exists mais code=${String(error.code)}, status=${String(error.status)}, message=${error.message} ; la table de codes de fix(9.2s) doit reprendre ce code`);
    });
});

describe('Écran du profil (contrat 5.3)', () => {
    function read(rel: string): string {
        const abs = path.resolve(process.cwd(), rel);
        assert.ok(fs.existsSync(abs), `${rel} absent (contrat 5.3, fix(9.2e))`);
        return fs.readFileSync(abs, 'utf8');
    }

    test('ProfileForm : route, libellé figé pour l’e2e, email technique masqué', () => {
        const src = read('components/profile/ProfileForm.tsx');
        assert.match(src, /\/api\/account\/profile/, 'le formulaire appelle la route');
        assert.match(src, /Enregistrer le profil/, 'libellé figé pour l’e2e');
        assert.match(src, /isDeliverableEmail/, 'email technique masqué (D-cpt C8)');
    });

    test('/profile affiche le formulaire et ne montre plus l’email technique', () => {
        const src = read('app/profile/page.tsx');
        assert.match(src, /ProfileForm/, 'ProfileForm rendu par /profile');
        if (/\{profile\.email\}/.test(src)) {
            assert.match(src, /isDeliverableEmail\(profile\.email\)/, 'email brut affiché sans filtre : l’email technique apparaîtrait à l’écran (D-cpt C8)');
        }
    });
});

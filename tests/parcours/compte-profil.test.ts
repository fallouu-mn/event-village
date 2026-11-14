/**
 * Lot 9, tâche 9.2 (contrat 4.3, 5.3 ; L24, L25 ; AR2) — profil du client : PATCH /api/account/profile.
 *  - prénom, nom, email validés par Zod ; email en minuscules ; domaine @eventvillage.sn refusé ; email vidé : email
 *    technique du numéro rétabli, jamais NULL ;
 *  - la RPC account_identity_taken (AM1) et l'unique de public.users donnent 409 EMAIL_TAKEN ; RPC en échec : l'API est
 *    rappelée vers la valeur relue dans public.users ; compensation en échec : 500 ACCOUNT_SYNC_FAILED, ligne
 *    ACCOUNT_AUTH_DESYNC, réparation ; la connexion suit ; un compte ne touche jamais à un autre, quel que soit le corps.
 * Lot 9 bis (T36 ; R87, R57, R58 ; contrat 4.6) : une adresse saisie n'est plus écrite tout de suite. Le PATCH, après la
 * confirmation du mot de passe (R57, confirmPassword), la met en attente (users.email_pending) et envoie un lien ; il
 * n'appelle plus l'API d'authentification (sauf adresse vidée) et garde le refus EMAIL_TAKEN. auth.users et public.users
 * ne changent qu'à la validation du lien (POST /api/account/email/verify). Chaque garantie de l'ancienne écriture (deux
 * tables alignées, minuscules, un seul appel à l'API avec email_confirm, connexion par la nouvelle adresse et refus de
 * l'ancienne, AM1, compensation, désynchronisation et réparation, course, conflit) est déplacée à l'étape de validation,
 * avec les mêmes assertions. Connexion par numéro : POST /api/auth/login (R58), plus resolve-phone. Rouge jusqu'à
 * fix(9b.48) (M10, routes de validation), fix(9b.13) (confirmation du mot de passe) et fix(9b.14) (connexion).
 * Verts dès l'écriture, signalés : les deux cas du middleware ; le constat AM1 (GoTrue seul, sans code du lot).
 * Les pannes passent par globalThis.fetch (le client serveur lit le fetch global à chaque requête, voir messages-bruts.test.ts).
 * Comptes neufs à chaque test : les invariants (v) lisent toute la base ; la suite répare le compte désynchronisé (v6).
 */
import '../helpers/env';
import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { NextRequest } from 'next/server';
import { getFakes } from '../fakes';
import { assertLot9Invariants } from '../helpers/lot9-invariants';
import { callMiddleware, sessionCookies } from '../helpers/middleware';
import { authed } from './acces-helpers';
import { BASE_URL, confirmPassword, jsonRequest, randomEmail, STRONG_PASSWORD } from './helpers';
import { importModule, newBuyer, service, type Buyer } from './paiement-helpers';
import { gotrueEmail, profileEmailBehindGotrue } from '../helpers/gotrue-email';

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

/**
 * Contre-vérification du lot 9 quinquies (point 2 ; aide modifiée, signalée au rapport) : l'adresse de GoTrue ne suit plus
 * le profil ; l'aide contrôle que GoTrue garde l'adresse technique d'empreinte et rend l'adresse du profil.
 */
async function authEmailOf(userId: string): Promise<string | undefined> {
    return profileEmailBehindGotrue(userId);
}

function anonClient(): SupabaseClient {
    return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function signInError(email: string): Promise<string | null> {
    const { error } = await anonClient().auth.signInWithPassword({ email: await gotrueEmail(email), password: STRONG_PASSWORD });
    return error ? error.message : null;
}

/** Connexion comme l'écran (lot 9 bis, R58, T36) : numéro + mot de passe → POST /api/auth/login, correspondance faite côté serveur. */
async function loginByPhone(phone: string): Promise<{ status: number; signInError: string | null }> {
    const from = `203.0.113.${randomBytes(1)[0] % 250 + 1}`;
    const mod = await importModule('../../app/api/auth/login/route'); assert.equal(typeof mod.POST, 'function', 'R58 : app/api/auth/login/route.ts doit exporter POST (contrat 4.2)');
    const res = await reply(await mod.POST(jsonRequest('/api/auth/login', { identifier: phone, password: STRONG_PASSWORD }, { 'x-forwarded-for': `${from}, 10.0.0.1` })));
    if (res.status !== 200) return { status: res.status, signInError: null };
    return { status: 200, signInError: res.body.ok === true ? null : `réponse inattendue de /api/auth/login : ${res.text}` };
}

async function auditRows(userId: string, action: string): Promise<Array<Record<string, unknown>>> {
    const { data, error } = await service.from('audit_logs').select('*').eq('user_id', userId).eq('action', action);
    assert.equal(error, null, `audit_logs : ${error?.message}`);
    return (data ?? []) as Array<Record<string, unknown>>;
}

function freshEmail(label: string): string {
    return randomEmail(`profil-${label}`);
}

/**
 * Lot 9 quater (A4 : AUD-19) : adresse technique rétablie quand l'adresse est vidée = celle tirée de l'identifiant du
 * compte (technical_email_for), plus jamais du numéro (modification signalée au rapport).
 */
function technicalEmail(userId: string): string {
    return `u${userId.replace(/-/g, '')}@comptes.eventvillage.invalid`;
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
/** Lot 9 bis (T36) : la RPC de finalisation interceptée est celle de la validation du lien (M10). */
const finalizeRpc: Rule['match'] = (url, method) => method === 'POST' && url.pathname === '/rest/v1/rpc/email_verification_finalize';
const identityRpc: Rule['match'] = (url, method) => method === 'POST' && url.pathname === '/rest/v1/rpc/account_identity_taken';
/** AM1 : la vérification préalable répond « libre » une fois (l'email est pris juste après elle) ; les appels suivants sont réels. */
const identityFreeOnce: NonNullable<Rule['reply']> = (pass, n) => (n === 1
    ? new Response(JSON.stringify({ email_taken: false, phone_taken: false }), { status: 200, headers: { 'content-type': 'application/json' } })
    : pass());

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
    test('prénom, nom, email : 200, adresse en attente et lien ; à la validation, public.users et auth.users à jour ; réponse sans cache, audit sans valeur', async () => {
        const a = await newBuyer('profil-ok');
        const email = freshEmail('ok');
        const since = mailCount(email);
        const r = await patchEmail(a, { first_name: '  Fatou ', last_name: ' Ndiaye  ', email });
        assert.equal(r.status, 200, r.text);
        assert.deepEqual(r.body, { ok: true, email_technical: false, email_pending: email, email_verification: 'SENT' }, 'réponse (contrat 4.6)');
        assert.match(r.headers.get('cache-control') ?? '', /no-store/, 'réponse non mise en cache');
        const before = await profileOf(a.userId);
        assert.deepEqual([before.first_name, before.last_name, before.email], ['Fatou', 'Ndiaye', a.email], 'nom enregistré ; adresse inchangée avant le lien (R87)');
        assert.equal(await authEmailOf(a.userId), a.email, 'auth.users inchangé avant le lien (R87)');
        assert.equal((await verifyLink(linkToken(email, since))).status, 200, 'validation du lien');
        assert.deepEqual([(await profileOf(a.userId)).email, await authEmailOf(a.userId)], [email, email], 'auth.users.email suit public.users.email (D-cpt C2)');
        const audit = await auditRows(a.userId, 'ACCOUNT_PROFILE_UPDATED');
        assert.equal(audit.length, 1, 'une ligne d’audit par enregistrement');
        const fields = (audit[0].metadata as { fields?: unknown }).fields; assert.ok(Array.isArray(fields) && fields.includes('email'), `metadata.fields : ${JSON.stringify(audit[0].metadata)}`);
        const dump = JSON.stringify(audit[0]);
        for (const value of [email, 'Fatou', 'Ndiaye']) assert.equal(dump.includes(value), false, `valeur « ${value} » au journal : ${dump}`);
    });

    test('email saisi en majuscules : en attente en minuscules, puis enregistré en minuscules dans les deux tables à la validation', async () => {
        const a = await newBuyer('profil-maj');
        const email = freshEmail('maj');
        assert.equal((await verifyLink(await pendingLink(a, email.toUpperCase()))).status, 200, 'validation du lien');
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

    test('appel à l’API d’authentification : aucun au PATCH ; à la validation, updateUserById avec email et email_confirm, une seule fois', async () => {
        const a = await newBuyer('profil-api');
        const email = freshEmail('api');
        const put = (): Rule => ({ name: 'put', match: adminUserUpdate(a.userId), reply: (pass) => pass() });
        const pending = await intercept([put()], () => pendingLink(a, email));
        assert.equal(pending.hits.put.length, 0, `aucune écriture de auth.users au PATCH (R87) : ${JSON.stringify(pending.hits.put)}`);
        const { result, hits } = await intercept([put()], () => verifyLink(pending.result));
        assert.equal(result.status, 200, result.text);
        assert.equal(hits.put.length, 1, `appels : ${JSON.stringify(hits.put)}`);
        assert.deepEqual([hits.put[0].body?.email, hits.put[0].body?.email_confirm], [email, true], 'email et email_confirm');
    });

    test('la connexion suit la validation : avant, l’ancienne adresse ouvre la session et la nouvelle non ; après, l’inverse ; connexion par numéro intacte', async () => {
        const a = await newBuyer('profil-login');
        const email = freshEmail('login');
        const token = await pendingLink(a, email);
        assert.notEqual(await signInError(email), null, 'adresse en attente : pas encore un identifiant de connexion (R87)');
        assert.equal(await signInError(a.email), null, 'l’ancienne adresse reste l’identifiant jusqu’à la validation');
        const v = await verifyLink(token);
        assert.equal(v.status, 200, v.text);
        assert.equal(await signInError(email), null, 'connexion par le nouvel email');
        assert.notEqual(await signInError(a.email), null, 'l’ancien email ne doit plus ouvrir de session');
        const byPhone = await loginByPhone(a.phoneE164);
        assert.equal(byPhone.status, 200, `connexion par numéro (/api/auth/login, R58) : ${JSON.stringify(byPhone)}`);
        assert.equal(byPhone.signInError, null, 'connexion par le numéro après le changement d’email');
    });
});

describe('PATCH /api/account/profile — email vidé (L24)', () => {
    test('email vide : email technique du numéro rétabli dans les deux tables, rien en attente ni vérifié, aucun lien, connexion possible, email_technical vrai', async () => {
        const a = await newBuyer('profil-vide');
        const since = getFakes().email.sent.length;
        const r = await patchEmail(a, valid(a, ''));
        assert.equal(r.status, 200, r.text);
        assert.deepEqual([r.body.ok, r.body.email_technical, r.body.email_pending], [true, true, null], `réponse (contrat 4.6 : + email_pending) : ${r.text}`);
        assert.notEqual(r.body.email_verification, 'SENT', 'aucun lien pour une adresse vidée');
        assert.equal(getFakes().email.sent.length, since, 'aucun email tenté');
        const expected = technicalEmail(a.userId);
        assert.equal((await profileOf(a.userId)).email, expected, 'jamais NULL');
        assert.equal(await authEmailOf(a.userId), expected);
        assert.deepEqual(await pendingOf(a.userId), { email_pending: null, email_verified_at: null }, 'adresse vidée : rien en attente ni vérifié (D-ema 2.1)');
        const byPhone = await loginByPhone(a.phoneE164);
        assert.equal(byPhone.signInError, null, `connexion par le numéro : ${JSON.stringify(byPhone)}`);
    });

    test('email vide alors qu’il est déjà technique : aucun appel à l’API', async () => {
        const a = await newBuyer('profil-vide2');
        const first = await patchEmail(a, valid(a, ''));
        assert.equal(first.status, 200, first.text);
        const { result, hits } = await intercept([{ name: 'put', match: adminUserUpdate(a.userId), reply: (pass) => pass() }],
            () => patchProfile(a, valid(a, '')));
        assert.equal(result.status, 200, result.text);
        assert.equal(hits.put.length, 0);
        assert.equal(result.body.email_technical, true);
        assert.equal(result.body.email_pending, null, 'rien en attente (contrat 4.6)');
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

describe('PATCH /api/account/profile et validation du lien — unicité de l’email', () => {
    test('email d’un autre compte, même casse puis casse différente : 409 EMAIL_TAKEN, rien d’écrit, aucun lien', async () => {
        const a = await newBuyer('profil-pris-a');
        const b = await newBuyer('profil-pris-b');
        const since = mailCount(b.email);
        for (const email of [b.email, b.email.toUpperCase()]) {
            const { result: r, hits } = await intercept([{ name: 'put', match: adminUserUpdate(a.userId), reply: (pass) => pass() }],
                () => patchEmail(a, { first_name: 'Modifiee', last_name: a.lastName, email }));
            assert.equal(r.status, 409, `${email} : ${r.text}`);
            assert.equal(r.body.code, 'EMAIL_TAKEN', `${email} : ${r.text}`);
            assert.equal(hits.put.length, 0, `${email} : email pris à la vérification préalable, aucun appel à l’API (AM1)`);
            assertCleanFailure(r, 'email pris');
        }
        const row = await profileOf(a.userId);
        assert.equal(row.first_name, a.firstName, 'le prénom n’est pas enregistré sur un refus');
        assert.equal(row.email, a.email);
        assert.equal(await authEmailOf(a.userId), a.email);
        assert.equal((await auditRows(a.userId, 'ACCOUNT_PROFILE_UPDATED')).length, 0);
        assert.equal(mailCount(b.email), since, 'aucun lien envoyé à l’adresse d’un autre compte');
    });

    // Contre-vérification du lot 9 quinquies (point 2 ; test réécrit, signalé au rapport) : une adresse ne peut plus être
    // « prise dans auth.users seulement » : GoTrue ne garde que l'adresse technique d'empreinte de chaque compte. Avant :
    // l'API refusait (adresse déjà chez GoTrue), 409 EMAIL_TAKEN sans compensation ni RPC (AM1).
    test('adresse écrite chez GoTrue pour un autre compte : remplacée par son adresse technique ; la validation aboutit, l’autre compte n’a rien', async () => {
        const a = await newBuyer('profil-auth-a');
        const ghost = await newBuyer('profil-auth-b');
        const email = freshEmail('decale');
        const token = await pendingLink(a, email);
        const { error } = await service.auth.admin.updateUserById(ghost.userId, { email, email_confirm: true });
        assert.equal(error, null, `écriture de l’adresse chez GoTrue pour un autre compte : ${error?.message}`);
        assert.equal(await authEmailOf(ghost.userId), ghost.email, 'GoTrue garde l’adresse technique de l’autre compte ; son profil est intact');
        const { result, hits } = await intercept([
            { name: 'identity', match: identityRpc, reply: identityFreeOnce },
            { name: 'put', match: adminUserUpdate(a.userId), reply: (pass) => pass() },
            { name: 'rpc', match: finalizeRpc, reply: (pass) => pass() },
        ], () => verifyLink(token));
        assert.equal(result.status, 200, result.text);
        assert.ok(hits.identity.length >= 1, 'vérification préalable account_identity_taken absente');
        assert.equal(hits.rpc.length, 1, 'RPC de validation appelée');
        assert.equal(await authEmailOf(a.userId), email, 'le profil de A porte l’adresse validée');
        assert.equal(await authEmailOf(ghost.userId), ghost.email, 'l’autre compte n’a rien');
    });

    test('adresse prise dans public.users seulement, après l’envoi du lien : 409 EMAIL_TAKEN par la RPC de validation, API rappelée vers l’ancienne valeur', async () => {
        const a = await newBuyer('profil-pub-a');
        const other = await newBuyer('profil-pub-b');
        const taken = freshEmail('public');
        const token = await pendingLink(a, taken);
        await setProfileEmail(other.userId, taken);
        // AM1 : la vérification préalable voit public.users ; vue libre une fois, pour atteindre le refus de la RPC de validation.
        const { result, hits } = await intercept([
            { name: 'identity', match: identityRpc, reply: identityFreeOnce },
            { name: 'put', match: adminUserUpdate(a.userId), reply: (pass) => pass() },
        ], () => verifyLink(token));
        assert.equal(result.status, 409, result.text);
        assert.equal(result.body.code, 'EMAIL_TAKEN', result.text);
        assert.equal(hits.put.length, 2, `aller puis compensation : ${JSON.stringify(hits.put)}`);
        assert.equal(hits.put[1].body?.email, a.email, 'compensation vers la valeur de public.users');
        assert.equal(await authEmailOf(a.userId), a.email);
        assert.equal((await profileOf(a.userId)).email, a.email);
    });

    test('deux comptes valident la même adresse en même temps : un seul gagne, l’autre 409 et garde son email partout', async () => {
        const a = await newBuyer('profil-course-a');
        const b = await newBuyer('profil-course-b');
        const email = freshEmail('course');
        const [ta, tb] = [await pendingLink(a, email), await pendingLink(b, email)];
        const [ra, rb] = await Promise.all([verifyLink(ta), verifyLink(tb)]);
        assert.deepEqual([ra.status, rb.status].sort(), [200, 409], `${ra.text} / ${rb.text}`);
        const [winner, loser, lost] = ra.status === 200 ? [a, b, rb] : [b, a, ra];
        assert.equal(lost.body.code, 'EMAIL_TAKEN', lost.text);
        assert.equal((await profileOf(winner.userId)).email, email);
        assert.equal(await authEmailOf(winner.userId), email);
        assert.equal((await profileOf(loser.userId)).email, loser.email);
        assert.equal(await authEmailOf(loser.userId), loser.email);
    });

    test('profil modifié entre la lecture et la RPC de validation : 409 EMAIL_CONFLICT, auth.users aligné sur la valeur relue', async () => {
        const a = await newBuyer('profil-conflit');
        const wanted = freshEmail('voulu');
        const concurrent = freshEmail('concurrent');
        const token = await pendingLink(a, wanted);
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
        ], () => verifyLink(token));
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
        const r = await patchEmail(a, { first_name: 'Prenoma', last_name: 'Noma', email, id: b.userId, user_id: b.userId, userId: b.userId });
        assert.equal(r.status, 200, r.text);
        assert.equal((await pendingOf(a.userId)).email_pending, email, 'adresse en attente sur le compte de la session');
        assert.equal((await profileOf(a.userId)).email, a.email, 'adresse de connexion de A inchangée avant le lien');
        assert.equal((await pendingOf(b.userId)).email_pending, null, 'rien en attente sur B');
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
});

describe('PATCH /api/account/profile — droits (middleware)', () => {
    test('middleware : 401 sans session (déjà vrai, garde-fou)', async () => {
        const result = await callMiddleware(PROFILE_PATH, []);
        assert.equal(result.status, 401, JSON.stringify(result));
        assert.equal(result.passedThrough, false);
    });

    test('middleware : une session passe (déjà vrai, garde-fou)', async () => {
        const a = await newBuyer('profil-mw');
        const client = anonClient();
        const { error } = await client.auth.signInWithPassword({ email: await gotrueEmail(a.email), password: STRONG_PASSWORD });
        assert.equal(error, null, `connexion : ${error?.message}`);
        const result = await callMiddleware(PROFILE_PATH, await sessionCookies(client));
        assert.equal(result.passedThrough, true, JSON.stringify(result));
    });
});

describe('Validation du lien — pannes (AR2, L28, déplacées du PATCH au lot 9 bis)', () => {
    test('API d’authentification en panne : 500 sans texte de la base, public.users inchangé, RPC non appelée, le lien sert encore', async () => {
        const a = await newBuyer('profil-panne-api');
        const email = freshEmail('panne');
        const token = await pendingLink(a, email);
        const { result, hits, logged } = await intercept([
            { name: 'put', match: adminUserUpdate(a.userId) },
            { name: 'rpc', match: finalizeRpc, reply: (pass) => pass() },
        ], () => verifyLink(token));
        assert.equal(result.status, 500, result.text);
        assertCleanFailure(result, 'panne de l’API');
        assert.equal(hits.put.length, 1);
        assert.equal(hits.rpc.length, 0);
        assert.ok(logged.length >= 1, 'panne journalisée');
        const row = await profileOf(a.userId);
        assert.equal(row.email, a.email);
        assert.equal((await pendingOf(a.userId)).email_pending, email, 'adresse toujours en attente');
        assert.equal((await verifyLink(token)).status, 200, 'le lien n’a pas servi : une nouvelle validation passe');
        assert.equal(await authEmailOf(a.userId), email, 'après la nouvelle validation, auth.users suit');
    });

    test('RPC en panne : 500 sans texte de la base, API rappelée vers l’ancien email, les deux tables alignées', async () => {
        const a = await newBuyer('profil-panne-rpc');
        const email = freshEmail('rpc');
        const token = await pendingLink(a, email);
        const { result, hits } = await intercept([
            { name: 'put', match: adminUserUpdate(a.userId), reply: (pass) => pass() },
            { name: 'rpc', match: finalizeRpc },
        ], () => verifyLink(token));
        assert.equal(result.status, 500, result.text);
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

    test('compensation en échec : 500 ACCOUNT_SYNC_FAILED, ligne ACCOUNT_AUTH_DESYNC, journal sans email, réparation par une nouvelle validation', async () => {
        const a = await newBuyer('profil-desync');
        const email = freshEmail('desync');
        const token = await pendingLink(a, email);
        const { result, hits, logged } = await intercept([
            { name: 'put', match: adminUserUpdate(a.userId), reply: (pass, n) => (n === 1 ? pass() : fault()) },
            { name: 'rpc', match: finalizeRpc },
        ], () => verifyLink(token));
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
        assert.equal((await auditRows(a.userId, 'ACCOUNT_EMAIL_VERIFIED')).length, 0, 'la RPC a été annulée');
        const repaired = await verifyLink(token);
        assert.equal(repaired.status, 200, `réparation : ${repaired.text}`);
        assert.equal((await profileOf(a.userId)).email, email);
        assert.equal(await authEmailOf(a.userId), email);
        assert.equal(await signInError(email), null, 'connexion après réparation');
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

describe('Validation du lien — numéro et GoTrue', () => {
    test('changement d’email : le numéro reste le même dans le profil et dans l’authentification', async () => {
        const a = await newBuyer('profil-num');
        const v = await verifyLink(await pendingLink(a, freshEmail('num')));
        assert.equal(v.status, 200, v.text);
        assert.equal((await profileOf(a.userId)).phone, a.phoneE164, 'numéro du profil inchangé');
        const { data, error } = await service.auth.admin.getUserById(a.userId);
        assert.equal(error, null, `auth.users : ${error?.message}`);
        assert.equal(data.user?.phone, a.phoneE164.replace('+', ''), 'numéro d’authentification inchangé');
    });

    test('constat AM1 : updateUserById vers un email pris échoue et laisse auth.users inchangé, sans figer le code d’erreur', async () => {
        const a = await newBuyer('profil-gotrue-a');
        const b = await newBuyer('profil-gotrue-b');
        const { error } = await service.auth.admin.updateUserById(a.userId, { email: b.email, email_confirm: true });
        assert.ok(error, 'GoTrue accepte un email déjà pris : le refus 409 EMAIL_TAKEN du contrat ne peut pas reposer sur l’API');
        assert.equal(await authEmailOf(a.userId), a.email, 'auth.users modifié malgré l’échec de l’appel');
        assert.equal(await authEmailOf(b.userId), b.email, 'le titulaire de l’email ne doit pas être touché');
    });
});

// ── Lot 9 bis (T36 ; R87, R57) : adresse en attente, lien de vérification ──

const VERIFY_ROUTE = '../../app/api/account/email/verify/route';
const VERIFY_SUBJECT = 'Vérifiez votre adresse email — Event Village';
const TOKEN_RE = /\/verify-email\?t=([A-Za-z0-9_-]+)/;

// R57 : mot de passe confirmé une fois par session avant un changement d'adresse (10 minutes, quota par compte).
const confirmedSessions = new Map<string, Promise<void>>();

/** PATCH d'un changement d'adresse comme l'écran : mot de passe confirmé (R57, une fois par session), puis la route. */
async function patchEmail(user: Buyer, body: Record<string, unknown>): Promise<Reply> {
    if (!confirmedSessions.has(user.accessToken)) confirmedSessions.set(user.accessToken, confirmPassword(user, STRONG_PASSWORD));
    await confirmedSessions.get(user.accessToken);
    return patchProfile(user, body);
}

/** Emails enregistrés par le faux Resend pour cette adresse (repère à passer à linkToken). */
function mailCount(address: string): number {
    return getFakes().email.messagesTo(address).length;
}

/** Jeton du dernier email de vérification reçu par `address` après les `since` premiers. */
function linkToken(address: string, since: number): string {
    const mails = getFakes().email.messagesTo(address).slice(since).filter((m) => m.subject === VERIFY_SUBJECT);
    assert.ok(mails.length > 0, `aucun email de vérification reçu par ${address} (R87, sujet « ${VERIFY_SUBJECT} »)`);
    const last = mails[mails.length - 1];
    const m = TOKEN_RE.exec(last.text ?? '') ?? TOKEN_RE.exec(last.html);
    assert.ok(m, 'email de vérification sans lien /verify-email?t=…');
    return m[1];
}

/** Adresse mise en attente par le PATCH (200 et email_pending en minuscules exigés) ; rend le jeton du lien reçu. */
async function pendingLink(user: Buyer, typed: string): Promise<string> {
    const email = typed.toLowerCase();
    const since = mailCount(email);
    const r = await patchEmail(user, valid(user, typed));
    assert.equal(r.status, 200, r.text);
    assert.equal(r.body.email_pending, email, `adresse en attente, en minuscules (R87, contrat 4.6) : ${r.text}`);
    assert.equal((await pendingOf(user.userId)).email_pending, email, 'users.email_pending');
    return linkToken(email, since);
}

/** POST /api/account/email/verify { token } : route publique, aucune session. */
async function verifyLink(token: string): Promise<Reply> {
    let mod: { POST?: (req: NextRequest) => Promise<Response> };
    try {
        mod = await importModule(VERIFY_ROUTE);
    } catch (err) {
        assert.fail(`R87 : route POST /api/account/email/verify absente (contrat 4.6, fix(9b.48)) : ${err instanceof Error ? err.message.split('\n')[0] : String(err)}`);
    }
    assert.equal(typeof mod.POST, 'function', 'app/api/account/email/verify/route.ts : POST non exporté');
    return reply(await mod.POST!(jsonRequest('/api/account/email/verify', { token })));
}

async function pendingOf(userId: string): Promise<{ email_pending: string | null; email_verified_at: string | null }> {
    const { data, error } = await service.from('users').select('email_pending, email_verified_at').eq('id', userId).single();
    assert.equal(error, null, `adresse en attente : ${error?.message} — colonnes users.email_pending et users.email_verified_at (M10, lot 9 bis)`);
    return data as { email_pending: string | null; email_verified_at: string | null };
}

/**
 * Lot 9, tâche 9.2 (contrat 4.3, 5.3 ; L26 à L31 ; AR2) — changement de numéro : POST /api/account/phone/start et /confirm.
 *  - code au NOUVEAU numéro, objet PHONE_CHANGE, qui n'ouvre aucune session et ne vaut pour rien d'autre ;
 *  - numéro unique sous ses deux formes (+221… et 221…), refus avant tout SMS facturé ; quota par compte ;
 *  - ordre de confirm : session, code, API d'authentification, RPC account_phone_finalize ; compensation vers la valeur
 *    relue dans public.users ; compensation en échec : ACCOUNT_SYNC_FAILED, ACCOUNT_AUTH_DESYNC, réparation par un
 *    nouvel essai vers le même numéro ;
 *  - phone_verified_at remis à maintenant ; billets du compte inchangés ; email technique réécrit vers le nouveau numéro ;
 *  - toutes les autres sessions révoquées, la session courante gardée (session_id du JWT validé ; 401 s'il manque) ;
 *  - SMS PHONE_CHANGED à l'ANCIEN numéro seul, un segment GSM-7, texte exact.
 *
 * Rouge avant correctif : les routes n'existent pas (import dynamique, l'échec les nomme), ni la RPC, ni l'objet
 * PHONE_CHANGE ; après les tests, assertLot9Invariants reste rouge tant que M2 et M4 ne sont pas livrés.
 *
 * Verts dès l'écriture, signalés : les quatre cas du middleware ; les deux cas « SUPPOSÉ » (session_id dans le JWT, code
 * phone_exists) ne dépendent pas du code du lot : ils lisent GoTrue, et leur message d'échec tranche le SUPPOSÉ du
 * contrat au run « avant ».
 *
 * Comptage : SMS par numéro neuf (smsMark, smsTo), jamais globalement. Chaque test travaille sur un compte neuf ; le test
 * de compensation en échec répare le compte qu'il laisse désynchronisé (v4, v6).
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
import { POST as verifyOtp } from '../../app/api/auth/verify-otp/route';
import { inspect } from '../helpers/db';
import { assertLot9Invariants } from '../helpers/lot9-invariants';
import { callMiddleware, sessionCookies } from '../helpers/middleware';
import { getFakes } from '../fakes';
import { authed } from './acces-helpers';
import { createPartnerEvent, newPartner, type TestPartner } from './finance-helpers';
import { BASE_URL, jsonRequest, randomSenegalPhone, STRONG_PASSWORD } from './helpers';
import { flushNotifications, markPhoneVerified, outboxRows, smsMark, smsTo, withEnv } from './notif-helpers';
import { importModule, newBuyer, service, type Buyer } from './paiement-helpers';
import { issueFreeTicket, registerClientFlow } from './terrain-helpers';

after(async () => {
    await assertLot9Invariants('compte-numero');
});

const START_PATH = '/api/account/phone/start';
const CONFIRM_PATH = '/api/account/phone/confirm';
const SENTINEL = 'SENTINELLE_NUMERO';
const CODE_RE = /^[A-Z][A-Z0-9]*(_[A-Z0-9]+)+$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const PHONE_CHANGED_TEXT = 'Event Village : le numéro de votre compte a été modifié. Si ce n\'est pas vous, contactez le support.';
const TEN_MINUTES = 10 * 60 * 1000;

/** Alphabet GSM-7 de base et extension : calcul indépendant du code testé (GSM 03.38). */
const GSM7_BASIC = new Set(Array.from('@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&\'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà'));
const GSM7_EXTENSION = new Set(Array.from('\f^{}\\[~]|€'));

function gsm7Septets(text: string): number {
    let septets = 0;
    for (const ch of Array.from(text)) {
        assert.ok(GSM7_BASIC.has(ch) || GSM7_EXTENSION.has(ch), `caractère hors GSM-7 : « ${ch} » dans ${text}`);
        septets += GSM7_EXTENSION.has(ch) ? 2 : 1;
    }
    return septets;
}

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

type Handler = (req: NextRequest) => Promise<Response>;

async function startRoute(): Promise<Handler> {
    const mod = await importModule('../../app/api/account/phone/start/route');
    assert.equal(typeof mod.POST, 'function', 'app/api/account/phone/start/route doit exporter POST (contrat 4.3)');
    return mod.POST;
}

async function confirmRoute(): Promise<Handler> {
    const mod = await importModule('../../app/api/account/phone/confirm/route');
    assert.equal(typeof mod.POST, 'function', 'app/api/account/phone/confirm/route doit exporter POST (contrat 4.3)');
    return mod.POST;
}

async function postStart(user: Buyer, body: unknown): Promise<Reply> {
    return reply(await (await startRoute())(authed(START_PATH, 'POST', user, body)));
}

async function postConfirm(user: Buyer, body: unknown): Promise<Reply> {
    return reply(await (await confirmRoute())(authed(CONFIRM_PATH, 'POST', user, body)));
}

function codesTo(phone: string, since = 0): string[] {
    return getFakes().sms.messagesTo(phone).slice(since)
        .map((m) => m.message.match(/\b(\d{6})\b/)?.[1])
        .filter((c): c is string => Boolean(c));
}

/** Démarre le changement (200 exigé) et rend le code reçu par SMS au nouveau numéro. */
async function askCode(user: Buyer, phone: string): Promise<string> {
    const since = smsMark(phone);
    const r = await postStart(user, { phone });
    assert.equal(r.status, 200, `démarrage du changement : ${r.text}`);
    const codes = codesTo(phone, since);
    assert.equal(codes.length, 1, `un code attendu au ${phone}, reçu ${codes.length}`);
    return codes[0];
}

/** Changement complet (200 exigé). */
async function changeNumber(user: Buyer, phone: string): Promise<Reply> {
    const code = await askCode(user, phone);
    const r = await postConfirm(user, { phone, code });
    assert.equal(r.status, 200, `confirmation du changement : ${r.text}`);
    return r;
}

interface Identity { phone: string | null; email: string | null; phone_verified_at: string | null }

async function profileOf(userId: string): Promise<Identity> {
    const { data, error } = await service.from('users').select('phone, email, phone_verified_at').eq('id', userId).single();
    assert.equal(error, null, `profil : ${error?.message}`);
    return data as Identity;
}

async function authOf(userId: string): Promise<{ phone: string | undefined; email: string | undefined }> {
    const { data, error } = await service.auth.admin.getUserById(userId);
    assert.equal(error, null, `auth.users : ${error?.message}`);
    return { phone: data.user?.phone, email: data.user?.email };
}

const digits = (phone: string): string => phone.replace(/[^0-9]/g, '');
const technicalEmail = (phone: string): string => `${digits(phone)}@eventvillage.sn`;

function anonClient(): SupabaseClient {
    return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
}

interface Session { accessToken: string; refreshToken: string; client: SupabaseClient }

async function openSession(email: string): Promise<Session> {
    const client = anonClient();
    const { data, error } = await client.auth.signInWithPassword({ email, password: STRONG_PASSWORD });
    assert.equal(error, null, `connexion : ${error?.message}`);
    return { accessToken: data.session!.access_token, refreshToken: data.session!.refresh_token, client };
}

async function refreshWorks(refreshToken: string): Promise<boolean> {
    const { data, error } = await anonClient().auth.refreshSession({ refresh_token: refreshToken });
    return !error && !!data.session;
}

async function sessionCount(userId: string): Promise<number> {
    return inspect(async (db) => Number((await db.query<{ n: string }>('SELECT count(*) AS n FROM auth.sessions WHERE user_id = $1', [userId])).rows[0].n));
}

const onSession = (user: Buyer, session: Session): Buyer => ({ ...user, accessToken: session.accessToken });

async function auditRows(userId: string, action: string): Promise<Array<Record<string, unknown>>> {
    const { data, error } = await service.from('audit_logs').select('*').eq('user_id', userId).eq('action', action);
    assert.equal(error, null, `audit_logs : ${error?.message}`);
    return (data ?? []) as Array<Record<string, unknown>>;
}

const phoneChangedKey = (userId: string): string => `PHONE_CHANGED:${userId}:`;
const phoneChangedRows = (userId: string): ReturnType<typeof outboxRows> => outboxRows({ type: 'PHONE_CHANGED', keyPrefix: phoneChangedKey(userId) });

async function otpRow(phone: string, purpose: string): Promise<{ verified: boolean; attempts: number } | null> {
    const { data, error } = await service.from('otp_codes').select('verified, attempts').eq('phone', phone).eq('purpose', purpose)
        .order('created_at', { ascending: false }).limit(1).maybeSingle();
    assert.equal(error, null, `otp_codes : ${error?.message}`);
    return data as { verified: boolean; attempts: number } | null;
}

/** Compte dont l'email d'authentification est l'email technique du numéro (inscription sans email). */
async function technicalAccount(label: string): Promise<Buyer> {
    const phoneE164 = randomSenegalPhone('77');
    const email = technicalEmail(phoneE164);
    const { data, error } = await service.auth.admin.createUser({
        email, phone: phoneE164, password: STRONG_PASSWORD, email_confirm: true, phone_confirm: true,
        user_metadata: { first_name: 'Awa', last_name: `Technique${label.replace(/[^a-z]/gi, '').slice(0, 8)}` },
    });
    assert.equal(error, null, `création du compte technique : ${error?.message}`);
    const userId = data.user!.id;
    const { error: upErr } = await service.from('users').update({ phone: phoneE164, email, status: 'ACTIF' }).eq('id', userId);
    assert.equal(upErr, null, `profil : ${upErr?.message}`);
    const s = await openSession(email);
    return { userId, accessToken: s.accessToken, email, phoneE164, phone9: phoneE164.slice(4), firstName: 'Awa', lastName: 'Technique' };
}

/** Connexion comme l'écran : numéro → resolve-phone → email → mot de passe. */
async function loginByPhone(phone: string): Promise<{ status: number; signInError: string | null }> {
    const from = `203.0.113.${randomBytes(1)[0] % 250 + 1}`;
    const res = await reply(await resolvePhone(jsonRequest('/api/auth/resolve-phone', { phone }, { 'x-forwarded-for': `${from}, 10.0.0.1` })));
    if (res.status !== 200) return { status: res.status, signInError: null };
    const { error } = await anonClient().auth.signInWithPassword({ email: String(res.body.email), password: STRONG_PASSWORD });
    return { status: 200, signInError: error ? error.message : null };
}

// ── Pannes et écoute des appels sortants ───────────────────────────────────

interface Hit { path: string; method: string; body: Record<string, unknown> | null }
type Pass = () => Promise<Response>;

interface Rule {
    name: string;
    match: (url: URL, method: string, authorization: string | null) => boolean;
    /** Défaut : panne 500 à chaque passage. */
    reply?: (pass: Pass, n: number) => Promise<Response> | Response;
}

function fault(): Response {
    return new Response(JSON.stringify({ message: `relation "x" ${SENTINEL}`, code: '42P01', msg: SENTINEL }), {
        status: 500,
        headers: { 'content-type': 'application/json' },
    });
}

const passThrough: NonNullable<Rule['reply']> = (pass) => pass();
const adminUpdate = (userId: string): Rule['match'] => (url, method) => method === 'PUT' && url.pathname === `/auth/v1/admin/users/${userId}`;
const adminRead = (userId: string): Rule['match'] => (url, method) => method === 'GET' && url.pathname === `/auth/v1/admin/users/${userId}`;
const finalizeRpc: Rule['match'] = (url, method) => method === 'POST' && url.pathname === '/rest/v1/rpc/account_phone_finalize';

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
        const authorization = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined)).get('authorization');
        const rule = rules.find((r) => r.match(url, method, authorization));
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

async function assertNothingChanged(user: Buyer, what: string, oldEmail = user.email): Promise<void> {
    const row = await profileOf(user.userId);
    assert.equal(row.phone, user.phoneE164, `${what} : numéro du profil modifié`);
    assert.equal(row.email, oldEmail, `${what} : email du profil modifié`);
    const auth = await authOf(user.userId);
    assert.equal(auth.phone, digits(user.phoneE164), `${what} : numéro d'authentification modifié`);
    assert.equal(auth.email, oldEmail, `${what} : email d'authentification modifié`);
    assert.equal((await auditRows(user.userId, 'ACCOUNT_PHONE_CHANGED')).length, 0, `${what} : audit de changement écrit`);
    assert.equal((await phoneChangedRows(user.userId)).length, 0, `${what} : SMS PHONE_CHANGED mis en file`);
}

// ── Démarrage ──────────────────────────────────────────────────────────────

describe('POST /api/account/phone/start', () => {
    test('un code de 6 chiffres au nouveau numéro, objet PHONE_CHANGE, aucun SMS à l’ancien, journal sans le code, compte inchangé', async () => {
        const a = await newBuyer('num-start');
        const next = randomSenegalPhone('78');
        const oldMark = smsMark(a.phoneE164);
        const newMark = smsMark(next);
        const r = await postStart(a, { phone: next.slice(4) });
        assert.equal(r.status, 200, r.text);
        assert.equal(r.body.ok, true, r.text);
        assert.equal(typeof r.body.message, 'string', r.text);
        assert.match(r.headers.get('cache-control') ?? '', /no-store/, 'réponse non mise en cache');
        const codes = codesTo(next, newMark);
        assert.equal(codes.length, 1, 'un seul SMS au nouveau numéro, saisi sans indicatif');
        assert.equal(smsTo(a.phoneE164, oldMark).length, 0, 'aucun SMS à l’ancien numéro au démarrage');
        const row = await otpRow(next, 'PHONE_CHANGE');
        assert.deepEqual(row, { verified: false, attempts: 0 }, 'code enregistré avec son objet');
        const logged = await outboxRows({ type: 'OTP_PHONE_CHANGE', userId: a.userId });
        assert.equal(logged.length, 1, 'envoi journalisé (D-cpt 2, sync_only)');
        assert.equal(logged[0].status, 'SENT');
        assert.equal(logged[0].origin, 'SYNC_LOG');
        assert.equal(logged[0].family, 'ESSENTIAL');
        assert.equal(logged[0].actor_id, a.userId);
        assert.deepEqual(logged[0].template_data, { purpose: 'PHONE_CHANGE' }, 'jamais le code dans le journal');
        await assertNothingChanged(a, 'démarrage');
    });

    test('numéro déjà pris sous la forme +221… puis 221… : 409 PHONE_TAKEN sans aucun SMS', async () => {
        const a = await newBuyer('num-pris');
        const plus = await newBuyer('num-pris-plus');
        const bare = await newBuyer('num-pris-nu');
        const { error } = await service.from('users').update({ phone: digits(bare.phoneE164) }).eq('id', bare.userId);
        assert.equal(error, null, `forme sans + : ${error?.message}`);
        for (const taken of [plus.phoneE164, bare.phoneE164]) {
            const mark = smsMark(taken);
            const r = await postStart(a, { phone: taken });
            assert.equal(r.status, 409, `${taken} : ${r.text}`);
            assert.equal(r.body.code, 'PHONE_TAKEN', `${taken} : ${r.text}`);
            assert.equal(smsTo(taken, mark).length, 0, `aucun SMS facturé au ${taken}`);
        }
    });

    test('même numéro : 400 PHONE_UNCHANGED sans SMS', async () => {
        const a = await newBuyer('num-meme');
        const mark = smsMark(a.phoneE164);
        const r = await postStart(a, { phone: a.phoneE164 });
        assert.equal(r.status, 400, r.text);
        assert.equal(r.body.code, 'PHONE_UNCHANGED', r.text);
        assert.equal(smsTo(a.phoneE164, mark).length, 0);
    });

    test('mauvais format, numéro absent : 400 INVALID_FIELD ; corps illisible : 400 INVALID_BODY', async () => {
        const a = await newBuyer('num-format');
        for (const body of [{ phone: '123' }, { phone: '+33612345678' }, {}]) {
            const r = await postStart(a, body);
            assert.equal(r.status, 400, `${JSON.stringify(body)} : ${r.text}`);
            assert.equal(r.body.code, 'INVALID_FIELD', `${JSON.stringify(body)} : ${r.text}`);
        }
        const req = new NextRequest(`${BASE_URL}${START_PATH}`, {
            method: 'POST',
            headers: { 'content-type': 'application/json', authorization: `Bearer ${a.accessToken}` },
            body: 'pas du json',
        });
        const r = await reply(await (await startRoute())(req));
        assert.equal(r.status, 400, r.text);
        assert.equal(r.body.code, 'INVALID_BODY', r.text);
    });

    test('quota du compte, numéros différents : au-delà de 2, 429 PHONE_CHANGE_RATE_LIMITED et aucun SMS', async () => {
        const a = await newBuyer('num-quota');
        await withEnv({ PHONE_CHANGE_PER_ACCOUNT_DAY: '2' }, async () => {
            const phones = [randomSenegalPhone('78'), randomSenegalPhone('78'), randomSenegalPhone('78')];
            const marks = phones.map(smsMark);
            const results: Reply[] = [];
            for (const phone of phones) results.push(await postStart(a, { phone }));
            assert.deepEqual(results.map((r) => r.status), [200, 200, 429], results.map((r) => r.text).join(' / '));
            assert.equal(results[2].body.code, 'PHONE_CHANGE_RATE_LIMITED', results[2].text);
            assert.equal(smsTo(phones[0], marks[0]).length, 1);
            assert.equal(smsTo(phones[1], marks[1]).length, 1);
            assert.equal(smsTo(phones[2], marks[2]).length, 0, 'aucun SMS au-delà du quota du compte');
        });
    });

    test('sans session : 401 AUTH_REQUIRED ; compte suspendu : 403 ACCOUNT_NOT_ACTIVE ; aucun SMS', async () => {
        const next = randomSenegalPhone('78');
        const mark = smsMark(next);
        const req = new NextRequest(`${BASE_URL}${START_PATH}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ phone: next }) });
        const anon = await reply(await (await startRoute())(req));
        assert.equal(anon.status, 401, anon.text);
        assert.equal(anon.body.code, 'AUTH_REQUIRED', anon.text);
        const a = await newBuyer('num-susp');
        const { error } = await service.from('users').update({ status: 'SUSPENDU' }).eq('id', a.userId);
        assert.equal(error, null, `suspension : ${error?.message}`);
        const suspended = await postStart(a, { phone: next });
        assert.equal(suspended.status, 403, suspended.text);
        assert.equal(suspended.body.code, 'ACCOUNT_NOT_ACTIVE', suspended.text);
        assert.equal(smsTo(next, mark).length, 0);
    });
});

// ── Code ───────────────────────────────────────────────────────────────────

describe('POST /api/account/phone/confirm — le code', () => {
    test('code d’un autre objet (LOGIN) : 400 INVALID_CODE, non consommé, rien de changé', async () => {
        const store = await importModule('../../lib/auth/otp-store');
        const a = await newBuyer('num-objet');
        const next = randomSenegalPhone('78');
        await store.storeOtp(next, '482913', new Date(Date.now() + TEN_MINUTES), 'LOGIN');
        const r = await postConfirm(a, { phone: next, code: '482913' });
        assert.equal(r.status, 400, r.text);
        assert.equal(r.body.code, 'INVALID_CODE', r.text);
        assert.deepEqual(await otpRow(next, 'LOGIN'), { verified: false, attempts: 0 }, 'le code de connexion reste intact');
        await assertNothingChanged(a, 'code d’un autre objet');
    });

    test('un code PHONE_CHANGE n’ouvre aucune session par /api/auth/verify-otp et n’y est pas consommé', async () => {
        const a = await newBuyer('num-session');
        const next = randomSenegalPhone('78');
        const code = await askCode(a, next);
        const res = await reply(await verifyOtp(jsonRequest('/api/auth/verify-otp', { phone: next, otpCode: code, isLogin: true })));
        assert.ok(res.status >= 400, `code de changement présenté à la connexion : ${res.text}`);
        assert.equal(res.body.token_hash, undefined, 'aucun jeton de session');
        assert.deepEqual(await otpRow(next, 'PHONE_CHANGE'), { verified: false, attempts: 0 });
    });

    test('code faux : 400 INVALID_CODE, essai compté ; expiré : 400 CODE_EXPIRED ; format : 400 INVALID_FIELD non compté', async () => {
        const a = await newBuyer('num-faux');
        const next = randomSenegalPhone('78');
        const code = await askCode(a, next);
        const wrong = code === '000000' ? '111111' : '000000';
        const format = await postConfirm(a, { phone: next, code: '12' });
        assert.equal(format.status, 400, format.text);
        assert.equal(format.body.code, 'INVALID_FIELD', format.text);
        assert.deepEqual(await otpRow(next, 'PHONE_CHANGE'), { verified: false, attempts: 0 }, 'un format invalide ne compte pas');
        const r = await postConfirm(a, { phone: next, code: wrong });
        assert.equal(r.status, 400, r.text);
        assert.equal(r.body.code, 'INVALID_CODE', r.text);
        assert.deepEqual(await otpRow(next, 'PHONE_CHANGE'), { verified: false, attempts: 1 });
        const { error } = await service.from('otp_codes').update({ expires_at: new Date(Date.now() - 1000).toISOString() }).eq('phone', next).eq('purpose', 'PHONE_CHANGE');
        assert.equal(error, null, `expiration : ${error?.message}`);
        const late = await postConfirm(a, { phone: next, code });
        assert.equal(late.status, 400, late.text);
        assert.equal(late.body.code, 'CODE_EXPIRED', late.text);
        await assertNothingChanged(a, 'code faux ou expiré');
    });

    test('5 essais : le 5e faux répond 429 TOO_MANY_ATTEMPTS, le bon code est ensuite refusé', async () => {
        const a = await newBuyer('num-essais');
        const next = randomSenegalPhone('78');
        const code = await askCode(a, next);
        const wrong = code === '000000' ? '111111' : '000000';
        const statuses: number[] = [];
        for (let i = 0; i < 4; i += 1) statuses.push((await postConfirm(a, { phone: next, code: wrong })).status);
        assert.deepEqual(statuses, [400, 400, 400, 400]);
        const fifth = await postConfirm(a, { phone: next, code: wrong });
        assert.equal(fifth.status, 429, fifth.text);
        assert.equal(fifth.body.code, 'TOO_MANY_ATTEMPTS', fifth.text);
        const good = await postConfirm(a, { phone: next, code });
        assert.equal(good.status, 429, `le bon code après 5 essais : ${good.text}`);
        await assertNothingChanged(a, 'après 5 essais');
    });

    test('quota de vérification par numéro : 429 OTP_VERIFY_RATE_LIMITED', async () => {
        const a = await newBuyer('num-verif');
        const next = randomSenegalPhone('78');
        const code = await askCode(a, next);
        const wrong = code === '000000' ? '111111' : '000000';
        await withEnv({ VERIFY_OTP_PER_PHONE_15MIN: '2' }, async () => {
            const results: Reply[] = [];
            for (let i = 0; i < 3; i += 1) results.push(await postConfirm(a, { phone: next, code: wrong }));
            assert.deepEqual(results.map((r) => r.status), [400, 400, 429], results.map((r) => r.text).join(' / '));
            assert.equal(results[2].body.code, 'OTP_VERIFY_RATE_LIMITED', results[2].text);
        });
        assert.deepEqual(await otpRow(next, 'PHONE_CHANGE'), { verified: false, attempts: 2 }, 'le 3e appel n’atteint pas le code');
    });

    test('même numéro à la confirmation : 400 PHONE_UNCHANGED, code non consommé', async () => {
        const store = await importModule('../../lib/auth/otp-store');
        const a = await newBuyer('num-meme-conf');
        await store.storeOtp(a.phoneE164, '482913', new Date(Date.now() + TEN_MINUTES), 'PHONE_CHANGE');
        const r = await postConfirm(a, { phone: a.phoneE164, code: '482913' });
        assert.equal(r.status, 400, r.text);
        assert.equal(r.body.code, 'PHONE_UNCHANGED', r.text);
        assert.deepEqual(await otpRow(a.phoneE164, 'PHONE_CHANGE'), { verified: false, attempts: 0 });
    });

    test('sans session : 401 AUTH_REQUIRED ; compte suspendu : 403 ACCOUNT_NOT_ACTIVE', async () => {
        const next = randomSenegalPhone('78');
        const req = new NextRequest(`${BASE_URL}${CONFIRM_PATH}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ phone: next, code: '123456' }) });
        const anon = await reply(await (await confirmRoute())(req));
        assert.equal(anon.status, 401, anon.text);
        assert.equal(anon.body.code, 'AUTH_REQUIRED', anon.text);
        const a = await newBuyer('num-conf-susp');
        const { error } = await service.from('users').update({ status: 'SUSPENDU' }).eq('id', a.userId);
        assert.equal(error, null, `suspension : ${error?.message}`);
        const suspended = await postConfirm(a, { phone: next, code: '123456' });
        assert.equal(suspended.status, 403, suspended.text);
        assert.equal(suspended.body.code, 'ACCOUNT_NOT_ACTIVE', suspended.text);
    });
});

// ── Succès ─────────────────────────────────────────────────────────────────

describe('POST /api/account/phone/confirm — succès', () => {
    test('les deux tables à jour, phone_verified_at remis à maintenant, billets inchangés, audit masqué', async () => {
        const a = await newBuyer('num-ok');
        await markPhoneVerified(a.userId, new Date(Date.now() - 30 * 24 * 3600_000));
        const partner = await newPartner('num-ok-pro');
        const ev = await createPartnerEvent(partner.partnerId, 'numero-billets', [{ name: 'Entrée', price: 0, total: 10 }]);
        const ticketId = await issueFreeTicket(ev.eventId, ev.categories['Entrée'].id, a);
        const columns = 'id, user_id, ticket_number, qr_code, status, security_version';
        const { data: ticketBefore, error: tErr } = await service.from('tickets').select(columns).eq('id', ticketId).single();
        assert.equal(tErr, null, `billet : ${tErr?.message}`);

        const next = randomSenegalPhone('78');
        const startedAt = Date.now();
        const r = await changeNumber(a, next);
        assert.equal(r.body.ok, true, r.text);

        const row = await profileOf(a.userId);
        assert.equal(row.phone, next, 'public.users.phone au format +221…');
        const auth = await authOf(a.userId);
        assert.equal(auth.phone, digits(next), 'auth.users.phone sans +');
        assert.ok(Date.parse(String(row.phone_verified_at)) >= startedAt - 5_000, `phone_verified_at récent : ${row.phone_verified_at}`);
        assert.equal((await otpRow(next, 'PHONE_CHANGE'))?.verified, true, 'code consommé');

        const { data: ticketAfter, error: afterErr } = await service.from('tickets').select(columns).eq('id', ticketId).single();
        assert.equal(afterErr, null, `billet : ${afterErr?.message}`);
        assert.deepEqual(ticketAfter, ticketBefore, 'le billet reste au compte, identique');
        assert.equal((ticketAfter as { user_id: string }).user_id, a.userId);

        const audit = await auditRows(a.userId, 'ACCOUNT_PHONE_CHANGED');
        assert.equal(audit.length, 1, 'une ligne d’audit');
        const meta = audit[0].metadata as Record<string, unknown>;
        assert.equal(meta.sms_queued, true, JSON.stringify(meta));
        assert.equal(typeof meta.sessions_revoked, 'number', JSON.stringify(meta));
        assert.equal(typeof meta.old_phone_masked, 'string', JSON.stringify(meta));
        assert.equal(typeof meta.new_phone_masked, 'string', JSON.stringify(meta));
        const dump = JSON.stringify(audit[0]);
        for (const phone of [a.phone9, next.slice(4)]) assert.equal(dump.includes(phone), false, `numéro en clair au journal : ${dump}`);
    });

    test('appel à l’API : phone et phone_confirm, sans email pour un compte à email réel ; email inchangé partout', async () => {
        const a = await newBuyer('num-reel');
        const next = randomSenegalPhone('78');
        const code = await askCode(a, next);
        const { result, hits } = await intercept([{ name: 'put', match: adminUpdate(a.userId), reply: passThrough }], () => postConfirm(a, { phone: next, code }));
        assert.equal(result.status, 200, result.text);
        assert.equal(hits.put.length, 1, `un seul appel : ${JSON.stringify(hits.put)}`);
        assert.equal(digits(String(hits.put[0].body?.phone)), digits(next));
        assert.equal(hits.put[0].body?.phone_confirm, true);
        assert.equal(hits.put[0].body?.email, undefined, 'un email réel n’est pas réécrit');
        assert.equal((await profileOf(a.userId)).email, a.email);
        assert.equal((await authOf(a.userId)).email, a.email);
    });

    test('connexion : le nouveau numéro et le mot de passe ouvrent une session, l’ancien numéro répond 404', async () => {
        const a = await newBuyer('num-login');
        const next = randomSenegalPhone('78');
        await changeNumber(a, next);
        const byNew = await loginByPhone(next);
        assert.deepEqual(byNew, { status: 200, signInError: null }, 'connexion par le nouveau numéro');
        const byOld = await loginByPhone(a.phoneE164);
        assert.equal(byOld.status, 404, 'l’ancien numéro ne correspond plus à aucun compte');
    });

    test('email technique : réécrit vers le nouveau numéro dans les deux tables, connexion possible', async () => {
        const a = await technicalAccount('tech-ok');
        const next = randomSenegalPhone('78');
        const code = await askCode(a, next);
        const { result, hits } = await intercept([{ name: 'put', match: adminUpdate(a.userId), reply: passThrough }], () => postConfirm(a, { phone: next, code }));
        assert.equal(result.status, 200, result.text);
        assert.equal(hits.put[0].body?.email, technicalEmail(next));
        assert.equal(hits.put[0].body?.email_confirm, true);
        assert.equal((await profileOf(a.userId)).email, technicalEmail(next));
        assert.equal((await authOf(a.userId)).email, technicalEmail(next));
        assert.deepEqual(await loginByPhone(next), { status: 200, signInError: null });
    });

    test('email technique : l’ancien numéro peut de nouveau s’inscrire (D-cpt C3)', async () => {
        const a = await technicalAccount('tech-libre');
        const next = randomSenegalPhone('78');
        await changeNumber(a, next);
        const flow = await registerClientFlow({
            phone: a.phoneE164, firstName: 'Nouvelle', lastName: 'Titulaire',
            headers: { 'x-forwarded-for': `203.0.113.${randomBytes(1)[0] % 250 + 1}, 10.0.0.1` },
        });
        assert.ok(flow.userId && flow.userId !== a.userId, `nouveau compte attendu sur l’ancien numéro : ${JSON.stringify(flow.register)}`);
    });

    test('users.email NULL et email d’authentification technique : le profil reçoit le nouvel email technique', async () => {
        const a = await technicalAccount('tech-null');
        const { error } = await service.from('users').update({ email: null }).eq('id', a.userId);
        assert.equal(error, null, `email NULL : ${error?.message}`);
        const next = randomSenegalPhone('78');
        await changeNumber(a, next);
        assert.equal((await profileOf(a.userId)).email, technicalEmail(next));
        assert.equal((await authOf(a.userId)).email, technicalEmail(next));
        assert.deepEqual(await loginByPhone(next), { status: 200, signInError: null });
    });

    test('A ne change que son numéro : user_id et id du corps ignorés', async () => {
        const a = await newBuyer('num-droit-a');
        const b = await newBuyer('num-droit-b');
        const next = randomSenegalPhone('78');
        const since = smsMark(next);
        const started = await postStart(a, { phone: next, user_id: b.userId, id: b.userId });
        assert.equal(started.status, 200, started.text);
        const r = await postConfirm(a, { phone: next, code: codesTo(next, since)[0], user_id: b.userId, id: b.userId });
        assert.equal(r.status, 200, r.text);
        assert.equal((await profileOf(a.userId)).phone, next);
        assert.equal((await profileOf(b.userId)).phone, b.phoneE164, 'B garde son numéro');
        assert.equal((await authOf(b.userId)).phone, digits(b.phoneE164));
    });

    test('rejeu du même code après succès : 400 PHONE_UNCHANGED, un seul SMS et un seul audit', async () => {
        const a = await newBuyer('num-rejeu');
        const next = randomSenegalPhone('78');
        const code = await askCode(a, next);
        assert.equal((await postConfirm(a, { phone: next, code })).status, 200);
        const again = await postConfirm(a, { phone: next, code });
        assert.equal(again.status, 400, again.text);
        assert.equal(again.body.code, 'PHONE_UNCHANGED', again.text);
        assert.equal((await phoneChangedRows(a.userId)).length, 1);
        assert.equal((await auditRows(a.userId, 'ACCOUNT_PHONE_CHANGED')).length, 1);
    });
});

// ── Sessions ───────────────────────────────────────────────────────────────

describe('Révocation des autres sessions (AR2)', () => {
    test('depuis S1 : S2 et la session d’origine révoquées, S1 gardée et toujours rafraîchissable', async () => {
        const a = await newBuyer('num-s');
        const s1 = await openSession(a.email);
        const s2 = await openSession(a.email);
        assert.equal(await sessionCount(a.userId), 3, 'précondition : trois sessions ouvertes');
        const next = randomSenegalPhone('78');
        await changeNumber(onSession(a, s1), next);
        assert.equal(await refreshWorks(s2.refreshToken), false, 'S2 encore rafraîchissable après le changement');
        assert.equal(await refreshWorks(s1.refreshToken), true, 'la session courante doit survivre');
        assert.equal(await sessionCount(a.userId), 1, 'seule la session courante reste');
        const audit = await auditRows(a.userId, 'ACCOUNT_PHONE_CHANGED');
        assert.equal((audit[0].metadata as { sessions_revoked?: unknown }).sessions_revoked, 2, JSON.stringify(audit[0].metadata));
    });

    test('session par cookies (navigateur) : la session courante est reconnue et gardée', async () => {
        const a = await newBuyer('num-cookies');
        const s1 = await openSession(a.email);
        const s2 = await openSession(a.email);
        const next = randomSenegalPhone('78');
        const code = await askCode(a, next);
        const cookies = await sessionCookies(s1.client);
        const req = new NextRequest(`${BASE_URL}${CONFIRM_PATH}`, {
            method: 'POST',
            headers: { 'content-type': 'application/json', cookie: cookies.map((c) => `${c.name}=${c.value}`).join('; ') },
            body: JSON.stringify({ phone: next, code }),
        });
        const r = await reply(await (await confirmRoute())(req));
        assert.equal(r.status, 200, r.text);
        assert.equal(await refreshWorks(s2.refreshToken), false, 'S2 révoquée');
        assert.equal(await refreshWorks(s1.refreshToken), true, 'la session des cookies doit survivre');
    });

    for (const [what, edit] of [
        ['session_id absent', (p: Record<string, unknown>) => { delete p.session_id; }],
        ['session_id qui n’est pas un uuid', (p: Record<string, unknown>) => { p.session_id = 'pas-un-uuid'; }],
    ] as const) {
        test(`jeton validé avec ${what} : 401 SESSION_REQUIRED avant la consommation du code, aucune révocation, rien d’écrit`, async () => {
            const a = await newBuyer('num-sansid');
            const s1 = await openSession(a.email);
            const s2 = await openSession(a.email);
            const next = randomSenegalPhone('78');
            const code = await askCode(a, next);
            const [header, payload, signature] = s1.accessToken.split('.');
            const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as Record<string, unknown>;
            edit(claims);
            const forged = `${header}.${Buffer.from(JSON.stringify(claims)).toString('base64url')}.${signature}`;
            const { data: userData, error: userErr } = await service.auth.admin.getUserById(a.userId);
            assert.equal(userErr, null, `auth.users : ${userErr?.message}`);
            // Seul GoTrue valide le jeton : la réponse de getUser pour ce jeton est simulée, le contrôle testé est celui de la charge.
            const { result, hits } = await intercept([
                {
                    name: 'user',
                    match: (url, method, authorization) => method === 'GET' && url.pathname === '/auth/v1/user' && authorization === `Bearer ${forged}`,
                    reply: () => new Response(JSON.stringify(userData.user), { status: 200, headers: { 'content-type': 'application/json' } }),
                },
                { name: 'put', match: adminUpdate(a.userId), reply: passThrough },
                { name: 'rpc', match: finalizeRpc, reply: passThrough },
            ], () => postConfirm({ ...a, accessToken: forged }, { phone: next, code }));
            assert.equal(result.status, 401, result.text);
            assert.equal(result.body.code, 'SESSION_REQUIRED', result.text);
            assert.ok(hits.user.length >= 1, 'le jeton forgé n’a pas atteint la validation : le test ne prouverait rien');
            assert.equal(hits.put.length, 0);
            assert.equal(hits.rpc.length, 0);
            assert.deepEqual(await otpRow(next, 'PHONE_CHANGE'), { verified: false, attempts: 0 }, 'le code n’est pas consommé');
            assert.equal(await sessionCount(a.userId), 3, 'jamais de révocation totale par défaut');
            assert.equal(await refreshWorks(s2.refreshToken), true, 'S2 intacte');
            await assertNothingChanged(a, 'session_id invalide');
        });
    }
});

// ── SMS à l'ancien numéro ──────────────────────────────────────────────────

describe('SMS PHONE_CHANGED (L30)', () => {
    test('une ligne vers l’ancien numéro, sans compte ni acteur ; texte exact, un segment GSM-7 ; rien au nouveau numéro', async () => {
        const a = await newBuyer('num-sms');
        const next = randomSenegalPhone('78');
        await changeNumber(a, next);
        const rows = await phoneChangedRows(a.userId);
        assert.equal(rows.length, 1, 'une ligne dans la boîte d’envoi');
        assert.equal(rows[0].recipient_phone, a.phoneE164, 'destinataire : l’ANCIEN numéro');
        assert.equal(rows[0].recipient_user_id, null, 'sans user_id : l’envoyeur viserait le nouveau numéro');
        assert.equal(rows[0].actor_id, null, 'sans actor_id');
        assert.equal(rows[0].family, 'ESSENTIAL');
        assert.equal(rows[0].channel, 'SMS');
        assert.equal((await outboxRows({ type: 'PHONE_CHANGED', phone: next })).length, 0, 'aucune ligne vers le nouveau numéro');

        const oldMark = smsMark(a.phoneE164);
        const newMark = smsMark(next);
        await flushNotifications({ ids: rows.map((r) => r.id) });
        const delivered = smsTo(a.phoneE164, oldMark);
        assert.equal(delivered.length, 1, 'un SMS à l’ancien numéro');
        assert.equal(delivered[0].message, PHONE_CHANGED_TEXT);
        assert.ok(gsm7Septets(delivered[0].message) <= 160, 'un seul segment GSM-7');
        assert.doesNotMatch(delivered[0].message, /\d{6}/, 'aucun code dans le SMS');
        assert.equal(smsTo(next, newMark).length, 0, 'aucun SMS au nouveau numéro');
    });

    for (const [what, oldPhone] of [
        ['absent', (): string | null => null],
        ['hors format', (): string | null => `+33${randomSenegalPhone('76').slice(4)}`],
    ] as const) {
        test(`ancien numéro ${what} : changement accepté, aucun SMS, sms_queued faux`, async () => {
            const a = await newBuyer('num-sansold');
            const previous = oldPhone();
            const { error } = await service.from('users').update({ phone: previous }).eq('id', a.userId);
            assert.equal(error, null, `ancien numéro : ${error?.message}`);
            const next = randomSenegalPhone('78');
            await changeNumber(a, next);
            assert.equal((await profileOf(a.userId)).phone, next);
            assert.equal((await phoneChangedRows(a.userId)).length, 0, 'aucun SMS sans ancien numéro valable');
            const audit = await auditRows(a.userId, 'ACCOUNT_PHONE_CHANGED');
            assert.equal(audit.length, 1);
            assert.equal((audit[0].metadata as { sms_queued?: unknown }).sms_queued, false, JSON.stringify(audit[0].metadata));
        });
    }
});

// ── Numéro pris, courses ───────────────────────────────────────────────────

describe('Numéro pris et courses', () => {
    test('numéro pris entre start et confirm : 409 PHONE_TAKEN par phone_exists, sans compensation ni RPC, code consommé', async () => {
        const a = await newBuyer('num-entre-a');
        const b = await newBuyer('num-entre-b');
        const next = randomSenegalPhone('78');
        const code = await askCode(a, next);
        const { error: authErr } = await service.auth.admin.updateUserById(b.userId, { phone: next, phone_confirm: true });
        assert.equal(authErr, null, `numéro pris par B : ${authErr?.message}`);
        const { error: upErr } = await service.from('users').update({ phone: next }).eq('id', b.userId);
        assert.equal(upErr, null, `profil de B : ${upErr?.message}`);
        const { result, hits } = await intercept([
            { name: 'put', match: adminUpdate(a.userId), reply: passThrough },
            { name: 'rpc', match: finalizeRpc, reply: passThrough },
        ], () => postConfirm(a, { phone: next, code }));
        assert.equal(result.status, 409, result.text);
        assert.equal(result.body.code, 'PHONE_TAKEN', result.text);
        assert.equal(hits.put.length, 1, 'rien n’a été écrit : aucune compensation');
        assert.equal(hits.rpc.length, 0);
        assert.equal((await otpRow(next, 'PHONE_CHANGE'))?.verified, true, 'code consommé');
        await assertNothingChanged(a, 'numéro pris entre start et confirm');
    });

    test('numéro présent seulement dans auth.users : start passe, confirm répond 409 PHONE_TAKEN par phone_exists', async () => {
        const a = await newBuyer('num-auth-a');
        const ghost = await newBuyer('num-auth-b');
        const { error } = await service.from('users').update({ phone: null }).eq('id', ghost.userId);
        assert.equal(error, null, `retrait du numéro du profil : ${error?.message}`);
        const code = await askCode(a, ghost.phoneE164);
        const r = await postConfirm(a, { phone: ghost.phoneE164, code });
        assert.equal(r.status, 409, r.text);
        assert.equal(r.body.code, 'PHONE_TAKEN', r.text);
        await assertNothingChanged(a, 'numéro présent seulement dans auth.users');
    });

    test('numéro présent seulement dans public.users après start : 409 PHONE_TAKEN par la RPC, API rappelée, tables alignées', async () => {
        const a = await newBuyer('num-pub-a');
        const b = await newBuyer('num-pub-b');
        const next = randomSenegalPhone('78');
        const code = await askCode(a, next);
        const { error } = await service.from('users').update({ phone: next }).eq('id', b.userId);
        assert.equal(error, null, `profil de B : ${error?.message}`);
        const { result, hits } = await intercept([{ name: 'put', match: adminUpdate(a.userId), reply: passThrough }], () => postConfirm(a, { phone: next, code }));
        assert.equal(result.status, 409, result.text);
        assert.equal(result.body.code, 'PHONE_TAKEN', result.text);
        assert.equal(hits.put.length, 2, `aller puis compensation : ${JSON.stringify(hits.put)}`);
        assert.equal(digits(String(hits.put[1].body?.phone)), digits(a.phoneE164), 'compensation vers l’ancien numéro');
        await assertNothingChanged(a, 'numéro pris dans public.users');
    });

    test('deux confirmations simultanées vers deux numéros : un seul gagnant, 409 PHONE_CONFLICT, un SMS, auth aligné sur le gagnant', async () => {
        const a = await newBuyer('num-course');
        const first = randomSenegalPhone('78');
        const second = randomSenegalPhone('78');
        const firstCode = await askCode(a, first);
        const secondCode = await askCode(a, second);
        // Barrière : les deux confirmations ont lu l'ancien numéro avant que l'une des RPC ne parte.
        let arrived = 0;
        let open!: () => void;
        const gate = new Promise<void>((resolve) => { open = resolve; });
        const { result, hits } = await intercept([{
            name: 'rpc',
            match: finalizeRpc,
            reply: async (pass) => {
                arrived += 1;
                if (arrived === 2) open();
                let timer: NodeJS.Timeout | undefined;
                await Promise.race([gate, new Promise<void>((resolve) => { timer = setTimeout(resolve, 8_000); })]);
                clearTimeout(timer);
                return pass();
            },
        }], () => Promise.all([postConfirm(a, { phone: first, code: firstCode }), postConfirm(a, { phone: second, code: secondCode })]));
        assert.equal(hits.rpc.length, 2, 'les deux confirmations atteignent la RPC');
        const [r1, r2] = result;
        assert.deepEqual([r1.status, r2.status].sort(), [200, 409], `${r1.text} / ${r2.text}`);
        const [winner, lost] = r1.status === 200 ? [first, r2] : [second, r1];
        assert.equal(lost.body.code, 'PHONE_CONFLICT', lost.text);
        assert.equal((await profileOf(a.userId)).phone, winner);
        assert.equal((await authOf(a.userId)).phone, digits(winner), 'auth.users aligné sur le gagnant (compensation sur la valeur relue)');
        assert.equal((await phoneChangedRows(a.userId)).length, 1, 'un seul SMS à l’ancien numéro');
        assert.equal((await auditRows(a.userId, 'ACCOUNT_PHONE_CHANGED')).length, 1);
    });
});

// ── Pannes ─────────────────────────────────────────────────────────────────

describe('Pannes de la confirmation (AR2, L28)', () => {
    test('lecture de l’API en panne : 500 PHONE_CHANGE_FAILED, code non consommé, rien d’écrit', async () => {
        const a = await newBuyer('num-panne-lect');
        const next = randomSenegalPhone('78');
        const code = await askCode(a, next);
        const { result, hits } = await intercept([
            { name: 'get', match: adminRead(a.userId) },
            { name: 'put', match: adminUpdate(a.userId), reply: passThrough },
        ], () => postConfirm(a, { phone: next, code }));
        assert.equal(result.status, 500, result.text);
        assert.equal(result.body.code, 'PHONE_CHANGE_FAILED', result.text);
        assertCleanFailure(result, 'lecture de l’API');
        assert.ok(hits.get.length >= 1, 'panne atteinte');
        assert.equal(hits.put.length, 0);
        assert.deepEqual(await otpRow(next, 'PHONE_CHANGE'), { verified: false, attempts: 0 }, 'le code n’est pas consommé');
        await assertNothingChanged(a, 'panne de lecture');
    });

    test('écriture de l’API en panne : 500 PHONE_CHANGE_FAILED, public.users inchangé, code consommé, RPC non appelée', async () => {
        const a = await newBuyer('num-panne-put');
        const next = randomSenegalPhone('78');
        const code = await askCode(a, next);
        const { result, hits, logged } = await intercept([
            { name: 'put', match: adminUpdate(a.userId) },
            { name: 'rpc', match: finalizeRpc, reply: passThrough },
        ], () => postConfirm(a, { phone: next, code }));
        assert.equal(result.status, 500, result.text);
        assert.equal(result.body.code, 'PHONE_CHANGE_FAILED', result.text);
        assertCleanFailure(result, 'écriture de l’API');
        assert.equal(hits.put.length, 1, 'aucune compensation : rien n’a été écrit');
        assert.equal(hits.rpc.length, 0);
        assert.ok(logged.length >= 1, 'panne journalisée');
        assert.equal((await otpRow(next, 'PHONE_CHANGE'))?.verified, true, 'code consommé');
        await assertNothingChanged(a, 'panne d’écriture');
    });

    for (const kind of ['réel', 'technique'] as const) {
        const account = (): Promise<Buyer> => (kind === 'réel' ? newBuyer('num-rpc') : technicalAccount('rpc'));

        test(`RPC en panne, email ${kind} : 500 PHONE_CHANGE_FAILED, API rappelée vers les anciennes valeurs, sessions et SMS intacts`, async () => {
            const a = await account();
            const s2 = await openSession(a.email);
            const next = randomSenegalPhone('78');
            const code = await askCode(a, next);
            const before = await sessionCount(a.userId);
            const { result, hits } = await intercept([
                { name: 'put', match: adminUpdate(a.userId), reply: passThrough },
                { name: 'rpc', match: finalizeRpc },
            ], () => postConfirm(a, { phone: next, code }));
            assert.equal(result.status, 500, result.text);
            assert.equal(result.body.code, 'PHONE_CHANGE_FAILED', result.text);
            assertCleanFailure(result, 'panne de la RPC');
            assert.equal(hits.rpc.length, 1, 'RPC appelée une seule fois, sans nouvel essai');
            assert.equal(hits.put.length, 2, `aller puis compensation : ${JSON.stringify(hits.put)}`);
            assert.equal(digits(String(hits.put[1].body?.phone)), digits(a.phoneE164), 'compensation vers le numéro relu');
            assert.equal(hits.put[1].body?.phone_confirm, true);
            if (kind === 'technique') {
                assert.equal(hits.put[0].body?.email, technicalEmail(next));
                assert.equal(hits.put[1].body?.email, a.email, 'compensation vers l’email relu');
                assert.equal(hits.put[1].body?.email_confirm, true);
            }
            await assertNothingChanged(a, 'panne de la RPC');
            assert.equal(await sessionCount(a.userId), before, 'aucune session révoquée');
            assert.equal(await refreshWorks(s2.refreshToken), true);
            assert.equal((await auditRows(a.userId, 'ACCOUNT_AUTH_DESYNC')).length, 0, 'compensation réussie : aucune désynchronisation');
        });

        test(`compensation en échec, email ${kind} : 500 ACCOUNT_SYNC_FAILED, ACCOUNT_AUTH_DESYNC, ni audit ni SMS ; un nouvel essai vers le même numéro répare`, async () => {
            const a = await account();
            const s1 = await openSession(a.email);
            const s2 = await openSession(a.email);
            const next = randomSenegalPhone('78');
            const code = await askCode(onSession(a, s1), next);
            const before = await sessionCount(a.userId);
            const { result, hits, logged } = await intercept([
                { name: 'put', match: adminUpdate(a.userId), reply: (pass, n) => (n === 1 ? pass() : fault()) },
                { name: 'rpc', match: finalizeRpc },
            ], () => postConfirm(onSession(a, s1), { phone: next, code }));
            assert.equal(result.status, 500, result.text);
            assert.equal(result.body.code, 'ACCOUNT_SYNC_FAILED', result.text);
            assert.match(String(result.body.error), /Réessayez avec le même numéro/, result.text);
            assertCleanFailure(result, 'compensation en échec');
            assert.equal(hits.put.length, 2, 'un seul essai de compensation, sans boucle');
            assert.ok(logged.some((l) => l.includes('[account-sync]')), `journal attendu : ${logged.join(' | ')}`);
            for (const secret of [a.phone9, next.slice(4), a.email]) {
                assert.equal(logged.some((l) => l.includes(secret)), false, `« ${secret} » en clair au journal : ${logged.join(' | ')}`);
            }

            assert.equal((await profileOf(a.userId)).phone, a.phoneE164, 'public.users garde l’ancien numéro');
            assert.equal((await authOf(a.userId)).phone, digits(next), 'auth.users porte le nouveau (contrat, état laissé)');
            const desync = await auditRows(a.userId, 'ACCOUNT_AUTH_DESYNC');
            assert.equal(desync.length, 1, 'ligne de repérage pour le support');
            assert.equal((desync[0].metadata as { step?: unknown }).step, 'compensation', JSON.stringify(desync[0].metadata));
            assert.equal((await auditRows(a.userId, 'ACCOUNT_PHONE_CHANGED')).length, 0, 'la RPC a été annulée');
            assert.equal((await phoneChangedRows(a.userId)).length, 0, 'aucun SMS');
            assert.equal(await sessionCount(a.userId), before, 'aucune session révoquée');

            // Réparation exigée par le contrat, qui rétablit aussi (v4) et (v6) pour ce compte.
            await changeNumber(onSession(a, s1), next);
            assert.equal((await profileOf(a.userId)).phone, next);
            assert.equal((await authOf(a.userId)).phone, digits(next));
            assert.equal((await auditRows(a.userId, 'ACCOUNT_PHONE_CHANGED')).length, 1);
            const rows = await phoneChangedRows(a.userId);
            assert.equal(rows.length, 1, 'un SMS à l’ancien numéro, à la réparation');
            assert.equal(rows[0].recipient_phone, a.phoneE164);
            assert.equal(await refreshWorks(s2.refreshToken), false, 'les autres sessions tombent à la réparation');
            assert.deepEqual(await loginByPhone(next), { status: 200, signInError: null }, 'connexion après réparation');
        });
    }

    test('numéro relu NULL à la compensation : traité comme un échec, 500 ACCOUNT_SYNC_FAILED et ACCOUNT_AUTH_DESYNC', async () => {
        const a = await newBuyer('num-null');
        const { error } = await service.from('users').update({ phone: null }).eq('id', a.userId);
        assert.equal(error, null, `retrait du numéro : ${error?.message}`);
        const next = randomSenegalPhone('78');
        const code = await askCode(a, next);
        const { result } = await intercept([{ name: 'rpc', match: finalizeRpc }], () => postConfirm(a, { phone: next, code }));
        assert.equal(result.status, 500, result.text);
        assert.equal(result.body.code, 'ACCOUNT_SYNC_FAILED', result.text);
        assert.equal((await auditRows(a.userId, 'ACCOUNT_AUTH_DESYNC')).length, 1);
        assert.equal((await profileOf(a.userId)).phone, null, 'public.users inchangé');
    });
});

// ── Transferts en attente (L29, D-cpt 2) ───────────────────────────────────

describe('Transferts en attente', () => {
    let partner: TestPartner | undefined;

    async function pendingTransfer(toPhone: string, sender: Buyer): Promise<string> {
        partner ??= await newPartner('num-transferts');
        const ev = await createPartnerEvent(partner.partnerId, 'numero-transferts', [{ name: 'Entrée', price: 0, total: 10 }]);
        const ticketId = await issueFreeTicket(ev.eventId, ev.categories['Entrée'].id, sender);
        const { data, error } = await service.rpc('ticket_transfer_initiate', {
            p: { ticket_id: ticketId, actor_id: sender.userId, recipient: toPhone, expires_at: new Date(Date.now() + 48 * 3600_000).toISOString() },
        });
        assert.equal(error, null, `ticket_transfer_initiate : ${error?.message}`);
        const body = data as { ok?: boolean; transfer_id?: string };
        assert.equal(body.ok, true, `transfert refusé : ${JSON.stringify(data)}`);
        return String(body.transfer_id);
    }

    async function incomingIds(user: Buyer): Promise<string[]> {
        const mod = await importModule('../../app/api/tickets/transfers/incoming/route');
        const r = await reply(await mod.GET(authed('/api/tickets/transfers/incoming', 'GET', user)));
        assert.equal(r.status, 200, r.text);
        return (r.body.items as Array<{ transfer_id: string }>).map((i) => i.transfer_id);
    }

    test('transfert vers l’ancien numéro : plus visible et non reciblé ; vers le nouveau : visible après le changement', async () => {
        const a = await newBuyer('num-tr-a');
        await markPhoneVerified(a.userId);
        const sender = await newBuyer('num-tr-exp');
        const next = randomSenegalPhone('78');
        const toOld = await pendingTransfer(a.phoneE164, sender);
        const toNew = await pendingTransfer(next, sender);
        assert.deepEqual(await incomingIds(a), [toOld], 'précondition : seul le transfert vers l’ancien numéro est visible');
        await changeNumber(a, next);
        assert.deepEqual(await incomingIds(a), [toNew], 'visible : le transfert vers le numéro désormais prouvé');
        const { data, error } = await service.from('ticket_transfers').select('to_phone_or_email, status').eq('id', toOld).single();
        assert.equal(error, null, `transfert : ${error?.message}`);
        assert.deepEqual(data, { to_phone_or_email: a.phoneE164, status: 'PENDING' }, 'le transfert visait un numéro : pas de reciblage');
    });
});

// ── Middleware, hypothèses, écran ──────────────────────────────────────────

describe('Middleware (rappel A41)', () => {
    for (const routePath of [START_PATH, CONFIRM_PATH]) {
        test(`${routePath} : 401 sans session (déjà vrai, garde-fou)`, async () => {
            const result = await callMiddleware(routePath, []);
            assert.equal(result.status, 401, JSON.stringify(result));
            assert.equal(result.passedThrough, false);
        });

        test(`${routePath} : une session passe (déjà vrai, garde-fou)`, async () => {
            const a = await newBuyer('num-mw');
            const s = await openSession(a.email);
            const result = await callMiddleware(routePath, await sessionCookies(s.client));
            assert.equal(result.passedThrough, true, JSON.stringify(result));
        });
    }
});

describe('Hypothèses de GoTrue (SUPPOSÉ du contrat, section 13)', () => {
    test('SUPPOSÉ : le JWT porte session_id, uuid d’une ligne de auth.sessions du compte', async () => {
        const a = await newBuyer('num-jwt');
        const claims = JSON.parse(Buffer.from(a.accessToken.split('.')[1], 'base64url').toString('utf8')) as Record<string, unknown>;
        assert.match(String(claims.session_id), UUID_RE,
            `SUPPOSÉ INFIRMÉ (contrat, section 13, AR2) : le JWT ne porte pas de session_id exploitable (revendications : ${Object.keys(claims).join(', ')}) ; sans lui, /confirm répond 401 SESSION_REQUIRED à tout le monde`);
        const found = await inspect(async (db) => (await db.query('SELECT 1 FROM auth.sessions WHERE id = $1 AND user_id = $2', [claims.session_id, a.userId])).rows.length);
        assert.equal(found, 1, 'SUPPOSÉ INFIRMÉ : session_id du JWT absent de auth.sessions : la révocation « sauf celle-ci » viserait une mauvaise ligne');
    });

    test('SUPPOSÉ : updateUserById vers un numéro pris renvoie error.code = phone_exists', async () => {
        const a = await newBuyer('num-gotrue-a');
        const b = await newBuyer('num-gotrue-b');
        const { error } = await service.auth.admin.updateUserById(a.userId, { phone: b.phoneE164, phone_confirm: true });
        assert.ok(error, 'GoTrue accepte un numéro déjà pris : le refus 409 PHONE_TAKEN du contrat ne peut pas reposer sur l’API');
        assert.equal(error.code, 'phone_exists',
            `SUPPOSÉ INFIRMÉ (contrat, section 13) : GoTrue ne renvoie pas phone_exists mais code=${String(error.code)}, status=${String(error.status)}, message=${error.message} ; la table de codes de fix(9.2s) doit reprendre ce code`);
    });
});

describe('Écran du changement de numéro (contrat 5.3)', () => {
    function read(rel: string): string {
        const abs = path.resolve(process.cwd(), rel);
        assert.ok(fs.existsSync(abs), `${rel} absent (contrat 5.3, fix(9.2e))`);
        return fs.readFileSync(abs, 'utf8');
    }

    test('PhoneChangeDialog : les deux routes, le code, le libellé figé pour l’e2e', () => {
        const dialog = read('components/profile/PhoneChangeDialog.tsx');
        assert.match(dialog, /\/api\/account\/phone\/start/);
        assert.match(dialog, /\/api\/account\/phone\/confirm/);
        assert.match(dialog, /OtpInput/, 'saisie du code par le composant commun');
        assert.match(read('app/profile/page.tsx') + read('components/profile/ProfileForm.tsx'), /Changer de numéro/, 'libellé figé pour l’e2e');
    });
});

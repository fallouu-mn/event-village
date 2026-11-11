/**
 * Lot 9 bis, tâche 14 (R58 ; contrat 5.14, B36, 4.2) — resolve-phone ne rend plus ni identifiant, ni email, ni statut, ni
 * rôle ; la correspondance numéro → email se fait côté serveur, pendant la connexion.
 *  - POST /api/auth/resolve-phone : 200 `{ success: true }` ou 404, rien d'autre (L7 du lot 9 gardée, A15) ;
 *  - POST /api/auth/login `{ identifier, password }` (nouvelle, publique sous /api/auth) : numéro ou email + mot de passe
 *    → 200 `{ ok: true }` et cookies de session @supabase/ssr qui ouvrent /api/auth/me ; la connexion par mot de passe
 *    compte comme une saisie récente (ligne password_confirmations de la session, R57) ; numéro inconnu et mauvais mot de
 *    passe → MÊME corps 401 INVALID_CREDENTIALS « Identifiant ou mot de passe incorrect. » ; quota par IP
 *    (PASSWORD_LOGIN_PER_IP_HOUR) → 429 ; quota_reserve sans EXECUTE → 503 ; route publique à travers le middleware.
 *
 * Rouge avant correctif (fix(9b.14)) : resolve-phone rend email, userId, status et role sans session
 * (app/api/auth/resolve-phone/route.ts:66-72) ; la route /api/auth/login n'existe pas.
 * Vert dès l'écriture (témoin, signalé) : le middleware laisse passer /api/auth/login sans session (préfixe public
 * /api/auth, middleware.ts:7) ; garde-fou : le cas rouge de la route elle-même.
 * Fin de suite : assertLot9bisInvariants.
 */
import '../helpers/env';
import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { Client } from 'pg';
import { NextRequest } from 'next/server';
import { resetServerEnvCache } from '../../lib/env';
import { callMiddleware } from '../helpers/middleware';
import { assertLot9bisInvariants } from '../helpers/lot9bis-invariants';
import { BASE_URL, jsonRequest, randomSenegalPhone, STRONG_PASSWORD } from './helpers';
import { importModule, newBuyer, service } from './paiement-helpers';
import type { RouteResult } from './acces-helpers';
import { show } from './pilotage-helpers';

after(async () => {
    await assertLot9bisInvariants('connexion-serveur');
});

const LOGIN_ROUTE = '../../app/api/auth/login/route';
const INVALID_TEXT = 'Identifiant ou mot de passe incorrect.';

interface LoginReply extends RouteResult {
    cookies: Array<{ name: string; value: string }>;
}

function freshIp(): string {
    const h = () => randomBytes(2).toString('hex');
    return `2001:db8:${h()}:${h()}::${1 + (randomBytes(2).readUInt16BE(0) % 9000)}`;
}

async function withEnv<T>(overrides: Record<string, string>, fn: () => Promise<T>): Promise<T> {
    const saved = new Map<string, string | undefined>();
    for (const [k, v] of Object.entries(overrides)) {
        saved.set(k, process.env[k]);
        process.env[k] = v;
    }
    resetServerEnvCache();
    try {
        return await fn();
    } finally {
        saved.forEach((v, k) => {
            if (v === undefined) delete process.env[k];
            else process.env[k] = v;
        });
        resetServerEnvCache();
    }
}

async function parse(res: Response): Promise<Record<string, unknown>> {
    const text = await res.text();
    try {
        return text ? JSON.parse(text) as Record<string, unknown> : {};
    } catch {
        return { raw: text.slice(0, 1000) };
    }
}

async function login(identifier: string, password: string, from = freshIp()): Promise<LoginReply> {
    let mod: { POST?: (req: NextRequest) => Promise<Response> };
    try {
        mod = await importModule(LOGIN_ROUTE);
    } catch (err) {
        assert.fail(`R58 : route POST /api/auth/login absente (app/api/auth/login/route.ts, contrat 4.2) : ${err instanceof Error ? err.message.split('\n')[0] : String(err)}`);
    }
    assert.equal(typeof mod.POST, 'function', 'app/api/auth/login/route.ts : POST non exporté');
    const res = await mod.POST!(jsonRequest('/api/auth/login', { identifier, password }, { 'x-forwarded-for': `${from}, 10.0.0.1` }));
    const cookies = res.headers.getSetCookie()
        .map((line) => line.split(';')[0])
        .map((pair) => ({ name: pair.slice(0, pair.indexOf('=')), value: pair.slice(pair.indexOf('=') + 1) }))
        .filter((c) => c.name && c.value);
    return { status: res.status, body: await parse(res), cookies };
}

async function resolvePhone(phone: string): Promise<RouteResult> {
    const mod = await importModule('../../app/api/auth/resolve-phone/route');
    const res: Response = await mod.POST(jsonRequest('/api/auth/resolve-phone', { phone }, { 'x-forwarded-for': `${freshIp()}, 10.0.0.1` }));
    return { status: res.status, body: await parse(res) };
}

/** Jeton d'accès porté par les cookies @supabase/ssr (valeur éventuellement découpée en .0, .1…, préfixe base64-). */
function accessTokenOf(cookies: Array<{ name: string; value: string }>): string {
    const auth = cookies.filter((c) => /^sb-.+-auth-token(\.\d+)?$/.test(c.name))
        .sort((a, b) => a.name.localeCompare(b.name, 'en', { numeric: true }));
    assert.ok(auth.length > 0, `cookie sb-…-auth-token attendu : ${cookies.map((c) => c.name).join(', ')}`);
    let raw = decodeURIComponent(auth.map((c) => c.value).join(''));
    if (raw.startsWith('base64-')) raw = Buffer.from(raw.slice('base64-'.length), 'base64url').toString('utf8');
    const session = JSON.parse(raw) as { access_token?: string };
    assert.ok(session.access_token, 'jeton d’accès dans le cookie de session');
    return session.access_token;
}

async function me(cookies: Array<{ name: string; value: string }>): Promise<RouteResult> {
    const mod = await importModule('../../app/api/auth/me/route');
    const res: Response = await mod.GET(new NextRequest(`${BASE_URL}/api/auth/me`, {
        method: 'GET', headers: { cookie: cookies.map((c) => `${c.name}=${c.value}`).join('; ') },
    }));
    return { status: res.status, body: await parse(res) };
}

function sameQuotes(v: unknown): string {
    return String(v ?? '').replace(/’/g, '\'');
}

describe('R58 — resolve-phone ne révèle plus rien du compte', () => {
    test('numéro connu : 200 { success: true }, sans email, userId, status ni role', async () => {
        const buyer = await newBuyer('r58-resolve');
        const res = await resolvePhone(buyer.phoneE164);
        assert.equal(res.status, 200, show(res));
        assert.equal(res.body.success, true, show(res));
        for (const key of ['email', 'userId', 'status', 'role']) {
            assert.equal(key in res.body, false, `R58 : resolve-phone rend encore « ${key} » : ${show(res)}`);
        }
        assert.ok(!JSON.stringify(res.body).includes(buyer.userId), 'aucun identifiant du compte');
    });

    test('témoin : numéro inconnu → 404', async () => {
        const res = await resolvePhone(randomSenegalPhone('78'));
        assert.equal(res.status, 404, show(res));
    });
});

describe('R58 — POST /api/auth/login (connexion côté serveur)', () => {
    test('numéro + mot de passe → 200 { ok: true }, cookies de session qui ouvrent /api/auth/me ; la connexion vaut saisie récente (R57)', async () => {
        const buyer = await newBuyer('r58-numero');
        const res = await login(buyer.phoneE164, STRONG_PASSWORD);
        assert.equal(res.status, 200, `connexion par numéro : ${show(res)}`);
        assert.deepEqual(res.body, { ok: true }, 'réponse sans donnée du compte');
        const who = await me(res.cookies);
        assert.equal(who.status, 200, `/api/auth/me avec les cookies posés : ${show(who)}`);
        assert.equal((who.body.user as Record<string, unknown> | undefined)?.id, buyer.userId, 'session du bon compte');
        const token = accessTokenOf(res.cookies);
        const sid = (JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8')) as { session_id?: string }).session_id;
        const { data, error } = await service.from('password_confirmations').select('user_id').eq('session_id', String(sid)).maybeSingle();
        assert.equal(error, null, `password_confirmations : ${error?.message}`);
        assert.equal(data?.user_id, buyer.userId, 'la connexion par mot de passe compte comme une saisie récente (contrat 4.2)');
    });

    test('email + mot de passe → 200', async () => {
        const buyer = await newBuyer('r58-email');
        const res = await login(buyer.email, STRONG_PASSWORD);
        assert.equal(res.status, 200, `connexion par email : ${show(res)}`);
        assert.equal((await me(res.cookies)).status, 200, 'session ouverte');
    });

    test('numéro inconnu et mauvais mot de passe : même réponse 401 INVALID_CREDENTIALS, aucun cookie', async () => {
        const buyer = await newBuyer('r58-refus');
        const unknown = await login(randomSenegalPhone('78'), STRONG_PASSWORD);
        const wrong = await login(buyer.phoneE164, `${STRONG_PASSWORD}-faux`);
        assert.equal(unknown.status, 401, `numéro inconnu : ${show(unknown)}`);
        assert.equal(wrong.status, 401, `mauvais mot de passe : ${show(wrong)}`);
        assert.equal(unknown.body.code, 'INVALID_CREDENTIALS', show(unknown));
        assert.equal(sameQuotes(unknown.body.error), sameQuotes(INVALID_TEXT), show(unknown));
        assert.deepEqual(unknown.body, wrong.body, 'aucune énumération : corps identiques');
        assert.equal(unknown.cookies.length + wrong.cookies.length, 0, 'aucun cookie de session');
    });

    test('quota PASSWORD_LOGIN_PER_IP_HOUR par IP → 429', async () => {
        await withEnv({ PASSWORD_LOGIN_PER_IP_HOUR: '2', CLIENT_IP_SOURCE: 'x-forwarded-for' }, async () => {
            const buyer = await newBuyer('r58-quota');
            const from = freshIp();
            const statuses: number[] = [];
            for (let i = 0; i < 3; i += 1) statuses.push((await login(buyer.phoneE164, `${STRONG_PASSWORD}-faux-${i}`, from)).status);
            assert.deepEqual(statuses, [401, 401, 429], `deux essais puis refus du quota : ${statuses.join(', ')}`);
        });
    });

    test('quota_reserve sans EXECUTE (garde indisponible) → 503, aucune session ouverte', async () => {
        const buyer = await newBuyer('r58-garde');
        await importModule(LOGIN_ROUTE).catch((err: unknown) => {
            assert.fail(`R58 : route POST /api/auth/login absente : ${err instanceof Error ? err.message.split('\n')[0] : String(err)}`);
        });
        const db = new Client({ connectionString: process.env.SUPABASE_DB_URL });
        await db.connect();
        let res: LoginReply | null = null;
        try {
            await db.query('REVOKE EXECUTE ON FUNCTION public.quota_reserve(jsonb) FROM service_role');
            res = await login(buyer.phoneE164, STRONG_PASSWORD);
        } finally {
            try {
                await db.query('GRANT EXECUTE ON FUNCTION public.quota_reserve(jsonb) TO service_role');
            } finally {
                await db.end();
            }
        }
        assert.ok(res, 'appel de la route fait');
        assert.equal(res.status, 503, `garde indisponible : ${show(res)}`);
        assert.equal(res.cookies.length, 0, 'aucun cookie de session');
    });

    test('témoin (vert dès l’écriture) : /api/auth/login est publique à travers le middleware', async () => {
        const res = await callMiddleware('/api/auth/login', []);
        assert.ok(res.passedThrough, `middleware : /api/auth/login doit passer sans session (HTTP ${res.status}, ${res.location ?? 'sans redirection'})`);
    });
});

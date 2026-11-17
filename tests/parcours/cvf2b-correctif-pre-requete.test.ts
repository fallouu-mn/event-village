/**
 * Contre-vérification 2B, correctif des points 6.6 et 6.7 — jeton d'une session fermée refusé par la base.
 * Migration 20261121000001_cvf2b_jeton_session_revoquee.sql : securite.db_pre_request, branchée par
 * `ALTER ROLE authenticator SET pgrst.db_pre_request`, appelée par PostgREST avant chaque requête de l'API REST.
 *  1. Branchement : réglage posé sur authenticator, fonction SECURITY DEFINER à search_path vide, exécutable par les
 *     rôles de l'API, hors du schéma exposé ; index de clé primaire de auth.sessions.
 *  2. REST : jeton valide servi (table et RPC) ; jeton d'une session fermée (« Se déconnecter » d'un appareil) refusé
 *     (401, SESSION_FERMEE) en table et en RPC ; l'autre session du même compte reste servie ; après la révocation de
 *     toutes les sessions (« Déconnecter tous mes appareils »), plus rien ; jeton rafraîchi de la même session servi.
 *  3. REST : sans jeton (clé anon seule), jeton anon et rôle de service servis ; jeton authenticated sans session_id
 *     refusé (fabriqué avec le secret JWT de l'instance locale).
 *  4. Coût : plan de la lecture (EXPLAIN ANALYZE) et mesure en boucle (10 000 appels) ; chiffre imprimé `[CVF2B-PRE]`.
 *  5. Temps réel : un jeton court (échéance à +25 s, même secret) abonné à postgres_changes ne reçoit plus rien après
 *     son échéance (témoin anon qui reçoit le même changement), le serveur coupe le canal.
 * Écrit en base : comptes, un partenaire et un événement publié (vivacité du temps réel). after() → invariants.
 */
import '../helpers/env';
import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { inRolledBackTransaction, inspect } from '../helpers/db';
import { gotrueEmail } from '../helpers/gotrue-email';
import { assertFinition1Invariants } from '../helpers/finition1-invariants';
import { assertLifecycleInvariants } from '../helpers/lifecycle-invariants';
import { anonClient, disposeClients, produceUntilReceived, subscribeCollect, waitForEvent, RECEIVE_TIMEOUT_MS } from '../helpers/realtime';
import { newBuyer, service, type Buyer } from './paiement-helpers';
import { newPartner } from './finance-helpers';
import { createEventInStatus } from './cycle-helpers';
import { STRONG_PASSWORD } from './helpers';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

after(async () => {
    await assertLifecycleInvariants('cvf2b-correctif-pre-requete');
    await assertFinition1Invariants('cvf2b-correctif-pre-requete');
});

// ── Outils ─────────────────────────────────────────────────────────────────────────────────────────────────────────

const anonAuth = () => createClient(SUPABASE_URL, ANON, { auth: { persistSession: false, autoRefreshToken: false } });

async function session(buyer: Buyer): Promise<{ access: string; refresh: string; sessionId: string }> {
    const { data, error } = await anonAuth().auth.signInWithPassword({ email: await gotrueEmail(buyer.email), password: STRONG_PASSWORD });
    assert.equal(error, null, `connexion : ${error?.message}`);
    const access = data.session!.access_token;
    return { access, refresh: data.session!.refresh_token, sessionId: String(claimsOf(access).session_id) };
}

function claimsOf(token: string): Record<string, unknown> {
    return JSON.parse(Buffer.from(token.split('.')[1] ?? '', 'base64url').toString('utf8')) as Record<string, unknown>;
}

interface RestAnswer { status: number; code: string | null; body: string }

/** Requête REST brute ; `token` null : clé anon seule, sans en-tête Authorization. */
async function rest(pathAndQuery: string, token: string | null, init: { method?: string; body?: unknown; apikey?: string } = {}): Promise<RestAnswer> {
    const headers: Record<string, string> = { apikey: init.apikey ?? ANON };
    if (token) headers.authorization = `Bearer ${token}`;
    if (init.body !== undefined) headers['content-type'] = 'application/json';
    const r = await fetch(`${SUPABASE_URL}/rest/v1/${pathAndQuery}`, {
        method: init.method ?? 'GET', headers, body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
    const body = await r.text();
    let code: string | null = null;
    try {
        code = (JSON.parse(body) as { code?: string }).code ?? null;
    } catch { /* corps non JSON */ }
    return { status: r.status, code, body: body.slice(0, 300) };
}

const profile = (userId: string, token: string | null) => rest(`users?select=id&id=eq.${userId}`, token);
const rpcIsController = (token: string) => rest('rpc/is_controller', token, { method: 'POST', body: {} });

function assertServed(r: RestAnswer, what: string): void {
    assert.equal(r.status, 200, `${what} : HTTP ${r.status} ${r.body}`);
}

function assertClosed(r: RestAnswer, what: string): void {
    assert.equal(r.status, 401, `${what} : HTTP ${r.status} ${r.body}`);
    assert.equal(r.code, 'SESSION_FERMEE', `${what} : code ${r.code} ${r.body}`);
}

// ── Secret JWT de l'instance locale (jetons fabriqués : sans session_id, échéance courte) ────────────────────────────

const DEMO_SECRET = 'super-secret-jwt-token-with-at-least-32-characters-long';

function signs(secret: string, token: string): boolean {
    const [h, p, s] = token.split('.');
    if (!h || !p || !s) return false;
    return createHmac('sha256', secret).update(`${h}.${p}`).digest('base64url') === s;
}

/** Secret qui signe la clé anon de l'instance (variables, `supabase status -o env`, puis secret de démonstration). */
function localJwtSecret(): string {
    const candidates: string[] = [];
    for (const v of [process.env.SUPABASE_JWT_SECRET, process.env.JWT_SECRET]) if (v) candidates.push(v);
    try {
        const out = execFileSync('supabase', ['status', '-o', 'env'], { timeout: 30_000, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
        const m = /^JWT_SECRET="?([^"\r\n]+)"?$/m.exec(out);
        if (m) candidates.push(m[1]);
    } catch { /* CLI absente : candidats suivants */ }
    candidates.push(DEMO_SECRET);
    const found = candidates.find((c) => signs(c, ANON));
    assert.ok(found, 'précondition : aucun secret connu ne signe la clé anon de l’instance locale (jetons fabriqués impossibles)');
    return found;
}

function mint(secret: string, payload: Record<string, unknown>): string {
    const enc = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
    const head = `${enc({ alg: 'HS256', typ: 'JWT' })}.${enc(payload)}`;
    return `${head}.${createHmac('sha256', secret).update(head).digest('base64url')}`;
}

// ── 1. Branchement ─────────────────────────────────────────────────────────────────────────────────────────────────

describe('1. branchement de la pré-requête', () => {
    test('réglage pgrst.db_pre_request sur authenticator ; fonction SECURITY DEFINER, search_path vide, hors du schéma exposé', async () => {
        const rows = await inspect(async (db) => (await db.query<{ setting: string | null; secdef: boolean; config: string; anon: boolean; auth: boolean; svc: boolean; pkey: boolean }>(`
            SELECT (SELECT string_agg(c, ' ') FROM pg_db_role_setting rs, unnest(rs.setconfig) c
                     WHERE rs.setrole = 'authenticator'::regrole AND rs.setdatabase = 0 AND c LIKE 'pgrst.db_pre_request=%') AS setting,
                   p.prosecdef AS secdef, COALESCE(array_to_string(p.proconfig, ' '), '') AS config,
                   has_function_privilege('anon', p.oid, 'EXECUTE') AS anon,
                   has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth,
                   has_function_privilege('service_role', p.oid, 'EXECUTE') AS svc,
                   EXISTS (SELECT 1 FROM pg_index i JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = i.indkey[0]
                            WHERE i.indrelid = 'auth.sessions'::regclass AND i.indisunique AND i.indnatts = 1 AND a.attname = 'id') AS pkey
              FROM pg_proc p WHERE p.oid = 'securite.db_pre_request()'::regprocedure`)).rows);
        console.log(`[CVF2B-PRE] 1. ${JSON.stringify(rows)}`);
        assert.equal(rows.length, 1, 'fonction securite.db_pre_request() absente');
        const f = rows[0];
        assert.equal(f.setting, 'pgrst.db_pre_request=securite.db_pre_request');
        assert.equal(f.secdef, true);
        assert.match(f.config, /search_path=(""|)$/);
        assert.ok(f.anon && f.auth && f.svc, 'exécutable par anon, authenticated et service_role (PostgREST l’appelle sous le rôle de la requête)');
        assert.ok(f.pkey, 'index unique sur auth.sessions(id)');
    });
});

// ── 2-3. REST ──────────────────────────────────────────────────────────────────────────────────────────────────────

describe('2-3. API REST', () => {
    test('2. jeton valide servi ; session fermée refusée (table et RPC) ; l’autre session servie ; révocation totale ; rafraîchi servi', async () => {
        const buyer = await newBuyer('cvf2b-pre-rest');
        const a = await session(buyer);
        const b = await session(buyer);
        assert.notEqual(a.sessionId, b.sessionId, 'deux sessions distinctes');

        assertServed(await profile(buyer.userId, a.access), 'session A, profil');
        assertServed(await profile(buyer.userId, b.access), 'session B, profil');
        assertServed(await rpcIsController(b.access), 'session B, RPC');

        // « Se déconnecter » sur l'appareil B : sa session est supprimée par GoTrue
        const { error: outErr } = await service.auth.admin.signOut(b.access, 'local');
        assert.equal(outErr, null, `déconnexion de B : ${outErr?.message}`);
        const bTable = await profile(buyer.userId, b.access);
        const bRpc = await rpcIsController(b.access);
        const aStill = await profile(buyer.userId, a.access);
        console.log(`[CVF2B-PRE] 2. B fermée — table : ${bTable.status} ${bTable.body} ; RPC : ${bRpc.status} ; A : ${aStill.status}`);
        assertClosed(bTable, 'jeton de la session fermée B, table');
        assertClosed(bRpc, 'jeton de la session fermée B, RPC');
        assertServed(aStill, 'session A après la fermeture de B');
        assert.ok(aStill.body.includes(buyer.userId), `A lit son profil : ${aStill.body}`);

        // Rafraîchissement de A : nouveau jeton, même session, servi
        const { data: refreshed, error: refErr } = await anonAuth().auth.refreshSession({ refresh_token: a.refresh });
        assert.equal(refErr, null, `rafraîchissement : ${refErr?.message}`);
        const a2 = refreshed.session!.access_token;
        assert.equal(claimsOf(a2).session_id, a.sessionId, 'même session après rafraîchissement');
        assertServed(await profile(buyer.userId, a2), 'jeton rafraîchi de A');

        // « Déconnecter tous mes appareils » : toutes les sessions du compte supprimées
        const { error: revErr } = await service.rpc('revoke_user_sessions', { p_user_id: buyer.userId });
        assert.equal(revErr, null, `révocation : ${revErr?.message}`);
        assertClosed(await profile(buyer.userId, a.access), 'ancien jeton de A après la révocation totale');
        assertClosed(await profile(buyer.userId, a2), 'jeton rafraîchi de A après la révocation totale');
        assertClosed(await rpcIsController(a2), 'RPC avec le jeton de A après la révocation totale');
    });

    test('3. sans jeton, anon et rôle de service servis ; jeton authenticated sans session_id refusé', async () => {
        const noToken = await rest('public_event_state?select=event_id&limit=1', null);
        const anonToken = await rest('public_event_state?select=event_id&limit=1', ANON);
        const svc = await rest('users?select=id&limit=1', SERVICE_KEY, { apikey: SERVICE_KEY });
        console.log(`[CVF2B-PRE] 3. sans jeton : ${noToken.status} ; anon : ${anonToken.status} ; service : ${svc.status}`);
        assertServed(noToken, 'clé anon seule, sans Authorization');
        assertServed(anonToken, 'jeton anon');
        assertServed(svc, 'rôle de service');

        const buyer = await newBuyer('cvf2b-pre-sans-sid');
        const real = claimsOf((await session(buyer)).access);
        const withoutSid: Record<string, unknown> = { ...real };
        delete withoutSid.session_id;
        const now = Math.floor(Date.now() / 1000);
        const forged = mint(localJwtSecret(), { ...withoutSid, iat: now, exp: now + 300 });
        const r = await profile(buyer.userId, forged);
        console.log(`[CVF2B-PRE] 3. jeton authenticated sans session_id : ${r.status} ${r.body}`);
        assertClosed(r, 'jeton authenticated sans session_id');
    });
});

// ── 4. Coût ────────────────────────────────────────────────────────────────────────────────────────────────────────

describe('4. coût de la pré-requête', () => {
    test('plan de la lecture et mesure en boucle (10 000 appels)', async () => {
        const buyer = await newBuyer('cvf2b-pre-cout');
        const s = await session(buyer);
        const claims = JSON.stringify(claimsOf(s.access));
        assert.match(s.sessionId, /^[0-9a-f-]{36}$/i);
        const N = 10_000;
        const result = await inRolledBackTransaction(async (db) => {
            await db.query(`SELECT set_config('request.jwt.claims', $1, true)`, [claims]);
            const plan = (await db.query<{ 'QUERY PLAN': string }>(
                `EXPLAIN (ANALYZE, BUFFERS) SELECT 1 FROM auth.sessions s
                  WHERE s.id = '${s.sessionId}'::uuid AND s.user_id::text = '${buyer.userId}'
                    AND (s.not_after IS NULL OR s.not_after > now())`)).rows.map((r) => r['QUERY PLAN']);
            const sessions = (await db.query<{ n: string }>('SELECT count(*)::text AS n FROM auth.sessions')).rows[0].n;
            await db.query('CREATE TEMP TABLE cvf2b_mesure (avec_ms float8, temoin_ms float8) ON COMMIT DROP');
            await db.query(`DO $$
                DECLARE t0 timestamptz; t1 timestamptz; t2 timestamptz;
                BEGIN
                    t0 := clock_timestamp();
                    FOR i IN 1..${N} LOOP PERFORM securite.db_pre_request(); END LOOP;
                    t1 := clock_timestamp();
                    FOR i IN 1..${N} LOOP PERFORM auth.jwt(); END LOOP;
                    t2 := clock_timestamp();
                    INSERT INTO cvf2b_mesure VALUES (extract(epoch FROM t1 - t0) * 1000, extract(epoch FROM t2 - t1) * 1000);
                END $$`);
            const m = (await db.query<{ avec_ms: number; temoin_ms: number }>('SELECT avec_ms, temoin_ms FROM cvf2b_mesure')).rows[0];
            // Sous le rôle de la requête, comme PostgREST : session valide acceptée
            await db.query('SET LOCAL ROLE authenticated');
            await db.query('SELECT securite.db_pre_request()');
            return { plan, sessions, m };
        });
        const perCall = (result.m.avec_ms * 1000) / N;
        const baseline = (result.m.temoin_ms * 1000) / N;
        console.log(`[CVF2B-PRE] 4. plan (auth.sessions : ${result.sessions} ligne(s)) :\n  ${result.plan.join('\n  ')}`);
        console.log(`[CVF2B-PRE] 4. coût : ${perCall.toFixed(1)} µs par appel de securite.db_pre_request (${N} appels, ${result.m.avec_ms.toFixed(1)} ms) ; témoin auth.jwt() seul : ${baseline.toFixed(1)} µs ; part de la lecture de la session : ${(perCall - baseline).toFixed(1)} µs`);
        assert.ok(perCall < 1000, `coût par appel trop élevé : ${perCall.toFixed(1)} µs`);
    });
});

// ── 5. Temps réel ──────────────────────────────────────────────────────────────────────────────────────────────────

describe('5. temps réel : jeton échu', () => {
    test('un abonnement postgres_changes ne reçoit plus rien après l’échéance de son jeton (témoin anon qui reçoit)', async () => {
        const secret = localJwtSecret();
        const partner = await newPartner('cvf2b-pre-rt');
        const live = await createEventInStatus(partner, 'cvf2b-pre-rt', [{ name: 'Standard', price: 3000, total: 10 }], 'PUBLIE', { startsInHours: 96 });
        let pulse = 0;
        const retitle = async (): Promise<string> => {
            pulse += 1;
            const title = `${live.title} · cvf2b ${pulse}`;
            const { error } = await service.from('events').update({ title }).eq('id', live.eventId);
            assert.equal(error, null, `titre : ${error?.message}`);
            return title;
        };
        const target = { table: 'public_event_state', filter: `event_id=eq.${live.eventId}` };

        const witness = anonClient();
        let short: SupabaseClient | null = null;
        try {
            const w = subscribeCollect(witness, target, { label: 'témoin anon' });
            await produceUntilReceived(w, retitle, (e) => e.new.event_id === live.eventId, { what: 'vivacité du témoin' });

            const buyer = await newBuyer('cvf2b-pre-rt-acheteur');
            const real = claimsOf((await session(buyer)).access);
            const now = Math.floor(Date.now() / 1000);
            const exp = now + 25;
            const token = mint(secret, { ...real, iat: now, exp });
            short = createClient(SUPABASE_URL, ANON, { accessToken: async () => token });
            const c = subscribeCollect(short, target, { label: `jeton court (échéance ${new Date(exp * 1000).toISOString()})` });
            const first = await produceUntilReceived(c, retitle, (e) => e.new.event_id === live.eventId, { what: 'vivacité du jeton court', timeoutMs: 20_000 });
            assert.ok(first.receivedAt < exp * 1000, 'précondition : le jeton court reçoit avant son échéance');

            // Échéance passée (+8 s de marge : minuterie du serveur, horloges)
            await sleep(Math.max(0, exp * 1000 - Date.now()) + 8_000);
            c.clear();
            const title = await retitle();
            await waitForEvent(w, (e) => e.new.title === title, RECEIVE_TIMEOUT_MS, 'le témoin reçoit le changement fait après l’échéance');
            await sleep(3_000);
            const leaked = c.events.filter((e) => e.new.title === title);
            console.log(`[CVF2B-PRE] 5. après l'échéance : témoin reçu ; jeton court : ${leaked.length} message(s) ; états du canal : ${c.states.join(' → ')}`);
            assert.equal(leaked.length, 0, `le jeton échu reçoit encore les changements : ${JSON.stringify(leaked.map((e) => e.new))}`);
        } finally {
            await disposeClients(witness, ...(short ? [short] : []));
        }
    });
});


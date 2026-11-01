/**
 * Lot 5, tâche 5.0 — dette du lot 4, C4 et C6 : rôles changés en une transaction, compteur OTP atomique.
 * Contrat : sections C4 et C6 de la conception du lot 5.
 *  C4. RPC user_roles_set(p) { user_id, roles text[], actor_id } : remplace l'ensemble des rôles en une
 *      transaction ; si le trigger controller_removal_guard refuse (caisse ouverte), rien n'est modifié.
 *      setUserRoles l'appelle, l'erreur 409 remonte telle quelle (PATCH /api/admin/users).
 *  C6. RPC otp_check(p) { phone|user_id, purpose, code_hash } : verrou sur la ligne du code, incrément
 *      atomique de attempts, refus au-delà de 5, consommation en cas de succès ; deux vérifications
 *      parallèles avec un mauvais code ne dépassent jamais la limite ; tous les vérificateurs
 *      l'utilisent (lib/auth/otp-store.ts) ; POST /api/withdrawals/request a en plus un quota par
 *      compte (WITHDRAWAL_REQUEST_PER_USER_HOUR, défaut 10).
 *
 * Rouge avant correctif :
 *  - lib/auth/roles.ts:113-120 : INSERT des rôles ajoutés puis DELETE des rôles retirés, en deux requêtes ;
 *    le DELETE refusé par controller_removal_guard (supabase/migrations/20261101000011_lot4_caisse.sql:277-307)
 *    laisse les rôles ajoutés en place ; PATCH /api/admin/users répond 409 mais ADMIN est accordé
 *    (app/api/admin/users/route.ts:285-295) ; la RPC user_roles_set n'existe pas ;
 *  - lib/auth/otp-store.ts:67-85 : lecture de attempts puis UPDATE attempts + 1 sans verrou ; N essais
 *    simultanés lisent la même valeur et n'écrivent qu'un +1 (écritures perdues) : le compteur reste
 *    sous 5 et le bon code est ensuite accepté (rouge par concurrence, à constater au run rouge) ; la RPC
 *    otp_check n'existe pas ;
 *  - app/api/withdrawals/request/route.ts:35-99 : aucun reserveQuota.
 *
 * Interprétations retenues (contrat muet) :
 *  - refus de user_roles_set = erreur EV409 (ou message CONTROLLER_HAS_OPEN_SHIFT), ou { ok: false,
 *    code: 'CONTROLLER_HAS_OPEN_SHIFT' } ;
 *  - refus de otp_check = { ok: false, code } avec les raisons existantes (INVALID, EXPIRED,
 *    TOO_MANY_ATTEMPTS), lues dans `code` (ou `reason`) ;
 *  - le quota des retraits est réservé avant la vérification du code (dépassement → 429) ; la suite
 *    règle WITHDRAWAL_REQUEST_PER_USER_HOUR à 3 dans son processus.
 * La suite crée ses comptes, son partenaire, son événement et sa caisse.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { NextRequest } from 'next/server';
import { resetServerEnvCache } from '../../lib/env';
import { inspect } from '../helpers/db';
import { bearer, signInAs } from '../helpers/fixtures';
import { assertLifecycleInvariants } from '../helpers/lifecycle-invariants';
import { jsonRequest as rawJsonRequest, randomSenegalPhone } from './helpers';
import { importModule, newBuyer, service, type Buyer, type SaleEvent } from './paiement-helpers';
import { jsonRequest, newPartner, superadminId, type TestPartner } from './finance-helpers';
import { createTimedEvent, newController, openShift, type RouteResult } from './acces-helpers';

const ROOT = process.cwd();
const OTP_STORE = '../../lib/auth/otp-store';
const MAX_ATTEMPTS = 5;

let partner: TestPartner;
let ev: SaleEvent;

before(async () => {
    partner = await newPartner('dette-roles');
    ev = await createTimedEvent(partner.partnerId, 'dette-roles', [{ name: 'Standard', price: 3000, total: 10 }]);
});

after(async () => {
    await assertLifecycleInvariants('dette-roles-otp');
});

// ── Outils locaux ──────────────────────────────────────────────────────────

type Row = Record<string, unknown>;
type Handler = (req: NextRequest, ctx?: unknown) => Promise<Response>;

async function invoke(handler: Handler, req: NextRequest): Promise<RouteResult> {
    const res = await handler(req);
    const text = await res.text();
    let body: Row = {};
    try {
        body = text ? JSON.parse(text) : {};
    } catch {
        body = { raw: text };
    }
    return { status: res.status, body };
}

function show(res: RouteResult): string {
    return `HTTP ${res.status} ${JSON.stringify(res.body)}`;
}

function stripComments(src: string): string {
    return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '$1');
}

function source(rel: string): string {
    return stripComments(fs.readFileSync(path.resolve(ROOT, rel), 'utf8'));
}

async function rolesOf(userId: string): Promise<string[]> {
    const { data, error } = await service.from('user_roles').select('role').eq('user_id', userId);
    assert.equal(error, null, `rôles de ${userId} : ${error?.message}`);
    return (data ?? []).map((r) => String(r.role)).sort();
}

async function legacyRoleOf(userId: string): Promise<string> {
    const { data, error } = await service.from('users').select('role').eq('id', userId).single();
    assert.equal(error, null, `users.role de ${userId} : ${error?.message}`);
    return String(data.role);
}

/** Contrôleur affecté avec sa caisse OUVERT : le trigger controller_removal_guard refuse le retrait de CONTROLEUR. */
async function controllerWithOpenShift(label: string): Promise<Buyer> {
    const ctrl = await newController(partner, ev.eventId, { canAcceptCash: true, label });
    const res = await openShift(ctrl, ev.eventId);
    assert.equal(res.status, 200, `ouverture de caisse (${label}) : ${show(res)}`);
    return ctrl;
}

/** Retire un rôle accordé à tort par le code d'avant le correctif (le trigger ne garde que CONTROLEUR). */
async function dropRoleIfPresent(userId: string, role: string): Promise<void> {
    if (!(await rolesOf(userId)).includes(role)) return;
    const { error } = await service.from('user_roles').delete().eq('user_id', userId).eq('role', role);
    assert.equal(error, null, `remise en état : retrait du rôle ${role} : ${error?.message}`);
}

interface RpcReply { data: Row | null; error: { message: string; code?: string } | null }

async function rpc(name: string, p: Row): Promise<RpcReply> {
    const { data, error } = await service.rpc(name, { p });
    return { data: (data ?? null) as Row | null, error };
}

function isOpenShiftRefusal(reply: RpcReply): boolean {
    if (reply.error) return reply.error.code === 'EV409' || /CONTROLLER_HAS_OPEN_SHIFT/.test(reply.error.message);
    return reply.data?.ok === false && reply.data.code === 'CONTROLLER_HAS_OPEN_SHIFT';
}

function refusalCode(reply: RpcReply): unknown {
    return reply.data?.code ?? reply.data?.reason;
}

async function otpRow(id: string): Promise<{ attempts: number; verified: boolean }> {
    const { data, error } = await service.from('otp_codes').select('attempts, verified').eq('id', id).single();
    assert.equal(error, null, `otp_codes ${id} : ${error?.message}`);
    return { attempts: Number(data.attempts), verified: data.verified === true };
}

interface OtpFixture { phone: string; good: string; wrong: string; id: string }

async function newOtp(): Promise<OtpFixture> {
    const store = await importModule(OTP_STORE);
    const phone = randomSenegalPhone('77');
    const good = String(100000 + Math.floor(Math.random() * 800000));
    const wrong = good === '999999' ? '999998' : '999999';
    const id = String(await store.storeOtp(phone, good, new Date(Date.now() + 10 * 60_000), 'WITHDRAWAL'));
    return { phone, good, wrong, id };
}

async function otpCheck(phone: string, code: string): Promise<RpcReply> {
    const store = await importModule(OTP_STORE);
    return rpc('otp_check', { phone, purpose: 'WITHDRAWAL', code_hash: store.hashOtpCode(phone, code) });
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

/** Les quotas sont comptés sur des fenêtres fixes : on évite de chevaucher deux fenêtres. */
async function alignWindow(windowSecs: number, neededMs: number): Promise<void> {
    const w = windowSecs * 1000;
    const left = w - (Date.now() % w);
    if (left < neededMs) await new Promise((resolve) => setTimeout(resolve, left + 300));
}

// ── Catalogue et contrôles statiques ───────────────────────────────────────

describe('C4 et C6 — RPC du contrat', () => {
    test('user_roles_set et otp_check : SECURITY DEFINER, search_path = public, service_role seul', async () => {
        const names = ['user_roles_set', 'otp_check'];
        const rows = await inspect(async (db) => (await db.query<{ name: string; secdef: boolean; config: string[] | null; anon: boolean; auth: boolean }>(
            `SELECT p.proname AS name, p.prosecdef AS secdef, p.proconfig AS config,
                    has_function_privilege('anon', p.oid, 'EXECUTE') AS anon,
                    has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth
               FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
              WHERE n.nspname = 'public' AND p.proname = ANY($1::text[])`, [names])).rows);
        const missing = names.filter((n) => !rows.some((r) => r.name === n));
        assert.deepEqual(missing, [], `fonctions absentes : ${missing.join(', ')}`);
        for (const r of rows) {
            assert.equal(r.secdef, true, `${r.name} : SECURITY DEFINER`);
            assert.ok((r.config ?? []).some((c) => /^search_path=public$/.test(c)), `${r.name} : search_path = public (${JSON.stringify(r.config)})`);
            assert.equal(r.anon, false, `${r.name} : non exécutable par anon`);
            assert.equal(r.auth, false, `${r.name} : non exécutable par authenticated`);
        }
    });

    test('setUserRoles passe par user_roles_set (plus d’INSERT puis DELETE séparés) ; otp-store passe par otp_check (plus d’UPDATE de attempts)', () => {
        const roles = source('lib/auth/roles.ts');
        const start = roles.indexOf('export async function setUserRoles');
        assert.ok(start >= 0, 'setUserRoles présente dans lib/auth/roles.ts');
        const next = roles.indexOf('\nexport ', start + 1);
        const body = roles.slice(start, next < 0 ? undefined : next);
        assert.match(body, /['"`]user_roles_set['"`]/, 'setUserRoles appelle la RPC user_roles_set');
        assert.doesNotMatch(body, /\.from\(\s*['"`]user_roles['"`]\s*\)\s*\.\s*(insert|delete|upsert)\s*\(/, 'setUserRoles n’écrit plus user_roles par requêtes séparées');

        const otp = source('lib/auth/otp-store.ts');
        assert.match(otp, /['"`]otp_check['"`]/, 'lib/auth/otp-store.ts appelle la RPC otp_check');
        assert.doesNotMatch(otp, /\.update\(\s*\{\s*attempts\s*:/, 'lib/auth/otp-store.ts n’incrémente plus attempts par lecture puis écriture');
    });
});

// ── C4 ─────────────────────────────────────────────────────────────────────

describe('C4 — user_roles_set : tout ou rien', () => {
    test('RPC : remplace l’ensemble des rôles d’un compte (CLIENT → CLIENT + PARTENAIRE)', async () => {
        const user = await newBuyer('roles-rpc-ok');
        assert.deepEqual(await rolesOf(user.userId), ['CLIENT'], 'précondition : rôle CLIENT seul');
        const reply = await rpc('user_roles_set', { user_id: user.userId, roles: ['CLIENT', 'PARTENAIRE'], actor_id: await superadminId() });
        assert.equal(reply.error, null, `user_roles_set : ${reply.error?.message} (code ${reply.error?.code})`);
        assert.equal(reply.data?.ok, true, `user_roles_set refusé : ${JSON.stringify(reply.data)}`);
        assert.deepEqual(await rolesOf(user.userId), ['CLIENT', 'PARTENAIRE'], 'ensemble exact des rôles');
    });

    test('RPC : retrait de CONTROLEUR (caisse ouverte) + ajout d’ADMIN → refus CONTROLLER_HAS_OPEN_SHIFT, aucun rôle modifié', async () => {
        const ctrl = await controllerWithOpenShift('roles-rpc-refus');
        const before = await rolesOf(ctrl.userId);
        assert.ok(before.includes('CONTROLEUR'), 'précondition : rôle CONTROLEUR');
        try {
            const reply = await rpc('user_roles_set', { user_id: ctrl.userId, roles: ['CLIENT', 'ADMIN'], actor_id: await superadminId() });
            assert.ok(isOpenShiftRefusal(reply), `refus CONTROLLER_HAS_OPEN_SHIFT attendu : ${JSON.stringify(reply)}`);
            assert.deepEqual(await rolesOf(ctrl.userId), before, 'aucun rôle modifié (ADMIN non accordé, CONTROLEUR conservé)');
        } finally {
            await dropRoleIfPresent(ctrl.userId, 'ADMIN');
        }
    });

    test('PATCH /api/admin/users (SUPERADMIN, roles: [ADMIN]) sur un contrôleur à caisse ouverte → 409 CONTROLLER_HAS_OPEN_SHIFT ; rôles et users.role inchangés', async () => {
        const ctrl = await controllerWithOpenShift('roles-route-refus');
        const before = await rolesOf(ctrl.userId);
        const legacyBefore = await legacyRoleOf(ctrl.userId);
        const superadmin = await signInAs('SUPERADMIN');
        try {
            const { PATCH } = await importModule('../../app/api/admin/users/route');
            const res = await invoke(PATCH as Handler, rawJsonRequest('/api/admin/users', { userId: ctrl.userId, roles: ['ADMIN'] }, bearer(superadmin.accessToken), 'PATCH'));
            assert.equal(res.status, 409, `changement de rôles refusé : ${show(res)}`);
            assert.equal(res.body.code, 'CONTROLLER_HAS_OPEN_SHIFT', `code CONTROLLER_HAS_OPEN_SHIFT : ${show(res)}`);
            assert.deepEqual(await rolesOf(ctrl.userId), before, 'aucun rôle modifié : ADMIN ne doit pas être accordé par une requête refusée');
            assert.equal(await legacyRoleOf(ctrl.userId), legacyBefore, 'users.role inchangé');
        } finally {
            await dropRoleIfPresent(ctrl.userId, 'ADMIN');
        }
    });
});

// ── C6 ─────────────────────────────────────────────────────────────────────

describe('C6 — otp_check : compteur atomique, limite de 5 essais, consommation', () => {
    test('5 essais faux comptés un par un ; le 6ᵉ et le bon code ensuite → TOO_MANY_ATTEMPTS ; attempts = 5', async () => {
        const otp = await newOtp();
        for (let i = 1; i <= MAX_ATTEMPTS; i += 1) {
            const r = await otpCheck(otp.phone, otp.wrong);
            assert.equal(r.error, null, `essai faux ${i} : ${r.error?.message} (code ${r.error?.code})`);
            assert.equal(r.data?.ok, false, `essai faux ${i} accepté : ${JSON.stringify(r.data)}`);
            assert.equal((await otpRow(otp.id)).attempts, i, `attempts après l’essai faux ${i}`);
        }
        const sixth = await otpCheck(otp.phone, otp.wrong);
        assert.equal(refusalCode(sixth), 'TOO_MANY_ATTEMPTS', `6ᵉ essai : ${JSON.stringify(sixth)}`);
        const good = await otpCheck(otp.phone, otp.good);
        assert.equal(good.data?.ok, false, `bon code accepté après 5 essais faux : ${JSON.stringify(good)}`);
        assert.equal(refusalCode(good), 'TOO_MANY_ATTEMPTS', `bon code après la limite : ${JSON.stringify(good)}`);
        const row = await otpRow(otp.id);
        assert.equal(row.attempts, MAX_ATTEMPTS, 'compteur exact : jamais au-delà de 5');
        assert.equal(row.verified, false, 'code non consommé');
    });

    test('bon code → accepté et consommé (verified) ; le même code rejoué → refusé', async () => {
        const otp = await newOtp();
        const first = await otpCheck(otp.phone, otp.good);
        assert.equal(first.error, null, `otp_check : ${first.error?.message} (code ${first.error?.code})`);
        assert.equal(first.data?.ok, true, `bon code refusé : ${JSON.stringify(first.data)}`);
        assert.equal((await otpRow(otp.id)).verified, true, 'code consommé par otp_check');
        const replay = await otpCheck(otp.phone, otp.good);
        assert.equal(replay.data?.ok, false, `code consommé rejoué accepté : ${JSON.stringify(replay)}`);
    });

    test('10 essais faux simultanés (RPC) : attempts = 5 exactement, au plus 5 refus INVALID, puis le bon code refusé', async () => {
        const otp = await newOtp();
        const replies = await Promise.all(Array.from({ length: 10 }, () => otpCheck(otp.phone, otp.wrong)));
        for (const r of replies) assert.equal(r.error, null, `otp_check : ${r.error?.message} (code ${r.error?.code})`);
        assert.ok(replies.every((r) => r.data?.ok === false), `essai faux accepté : ${JSON.stringify(replies.map((r) => r.data))}`);
        const invalid = replies.filter((r) => refusalCode(r) === 'INVALID').length;
        assert.ok(invalid <= MAX_ATTEMPTS, `au plus ${MAX_ATTEMPTS} comparaisons refusées INVALID (trouvé ${invalid})`);
        assert.equal((await otpRow(otp.id)).attempts, MAX_ATTEMPTS, 'compteur exact sous concurrence');
        const good = await otpCheck(otp.phone, otp.good);
        assert.equal(good.data?.ok, false, `bon code accepté après la rafale : ${JSON.stringify(good)}`);
    });

    test('10 essais faux simultanés par verifyStoredOtp (vérificateur du retrait) : attempts = 5, puis le bon code refusé (TOO_MANY_ATTEMPTS)', async () => {
        const store = await importModule(OTP_STORE);
        const otp = await newOtp();
        const results = (await Promise.all(Array.from({ length: 10 }, () => store.verifyStoredOtp(otp.phone, otp.wrong, 'WITHDRAWAL')))) as Array<{ ok: boolean; reason?: string }>;
        assert.ok(results.every((r) => r.ok === false), `essai faux accepté : ${JSON.stringify(results)}`);
        assert.equal((await otpRow(otp.id)).attempts, MAX_ATTEMPTS, `compteur exact sous concurrence (écritures perdues sinon) : ${JSON.stringify(results)}`);
        const good = (await store.verifyStoredOtp(otp.phone, otp.good, 'WITHDRAWAL')) as { ok: boolean; reason?: string };
        assert.deepEqual(good, { ok: false, reason: 'TOO_MANY_ATTEMPTS' }, `bon code après 10 essais faux simultanés : ${JSON.stringify(good)}`);
    });

    test('POST /api/withdrawals/request : quota par compte (WITHDRAWAL_REQUEST_PER_USER_HOUR = 3) → 4ᵉ demande en 429', async () => {
        const LIMIT = 3;
        await withEnv({ WITHDRAWAL_REQUEST_PER_USER_HOUR: String(LIMIT) }, async () => {
            const user = await newBuyer('retrait-quota');
            const { POST } = await importModule('../../app/api/withdrawals/request/route');
            await alignWindow(3600, 20_000);
            const results: RouteResult[] = [];
            for (let i = 0; i <= LIMIT; i += 1) {
                const body = { account: 'PARRAINAGE', amount: 1000, method: 'MOBILE_MONEY', operator: 'WAVE', phoneNumber: user.phone9, otpCode: '000000' };
                results.push(await invoke(POST as Handler, jsonRequest('/api/withdrawals/request', 'POST', user.accessToken, body, { 'idempotency-key': randomUUID() })));
            }
            const statuses = results.map((r) => r.status).join(', ');
            assert.ok(results.slice(0, LIMIT).every((r) => r.status !== 429), `refus avant la limite : ${statuses}`);
            assert.equal(results[LIMIT].status, 429, `demande ${LIMIT + 1} au-delà du quota par compte : ${results.map(show).join(' | ')}`);
            const { data, error } = await service.from('withdrawals').select('id').eq('user_id', user.userId);
            assert.equal(error, null, `retraits du compte : ${error?.message}`);
            assert.deepEqual(data ?? [], [], 'aucun retrait créé');
        });
    });
});

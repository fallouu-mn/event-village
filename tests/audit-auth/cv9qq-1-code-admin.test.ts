/**
 * Contre-vérification du lot 9 quinquies, attaque 1 — code administrateur (A3) et sessions de l'administration (A4).
 *
 * L'attaquant a le mot de passe d'un ADMIN (toutes les permissions) et ouvre une session directement chez GoTrue : il n'a
 * jamais saisi le code administrateur. Il essaie :
 *  a. toutes les routes de l'application qui authentifient l'utilisateur (hors /api/auth et la fenêtre de sécurité
 *     elle-même), avec le seul jeton : aucune ne doit répondre 2xx (exceptions nommées et motivées ci-dessous) ;
 *  b. PostgREST avec le seul jeton : aucune lecture des données des autres comptes ;
 *  c. le cookie d'appareil d'un AUTRE admin (copié) avec sa propre session : code exigé ;
 *  d. un appareil « déjà vu » dont le code date de plus de 12 heures : code exigé ;
 *  e. le code administrateur : 5 essais faux, puis le bon code est refusé (code brûlé).
 */
import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { writeLocal } from '../helpers/db';
import { assertLot9quinquiesInvariants } from '../helpers/lot9quinquies-invariants';
import { getFakes } from '../fakes';
import { STRONG_PASSWORD } from '../parcours/helpers';
import { ADMIN_PERMISSIONS } from '../../lib/admin/permissions';
import { deviceKeyOfValue } from '../../lib/admin/step-up';
import { callRoute, rawAccount, STEP_UP_CODES, userClient, type Account } from './cv9qq-helpers';

after(async () => {
    await assertLot9quinquiesInvariants('cv9qq-1-code-admin');
});

const ROOT = path.join(process.cwd(), 'app', 'api');
const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;
/** Préfixes hors champ : connexion et récupération (publiques), la fenêtre de sécurité elle-même, tâches et avis signés. */
const OUT_OF_SCOPE = [/^auth\//, /^admin\/step-up/, /^cron\//, /^webhooks\//, /^csp-report$/];
/** Une route est « authentifiée » si elle lit l'utilisateur par l'une de ces aides. */
const AUTH_HELPERS = /requireActiveSession|verifyAdminAuth|getAuthenticatedUser|getAuthenticatedSession/;
/**
 * Réponses 2xx admises sans le code, avec leur motif : aucune ne donne accès à l'administration ni n'agit sur un tiers.
 *  - POST account/password-confirm : vérifie le mot de passe saisi (c'est une moitié de l'étape de sécurité) ;
 *  - GET referrals/my-stats : statistiques de parrainage du compte lui-même.
 */
const ADMITTED_WITHOUT_CODE = new Set(['POST account/password-confirm', 'GET referrals/my-stats']);

function routes(): string[] {
    const out: string[] = [];
    const walk = (dir: string) => {
        for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, e.name);
            if (e.isDirectory()) walk(full);
            else if (e.name === 'route.ts') out.push(path.relative(ROOT, dir).split(path.sep).join('/'));
        }
    };
    walk(ROOT);
    return out.sort();
}

function concrete(rel: string): { url: string; params: Record<string, string> } {
    const params: Record<string, string> = {};
    const segs = rel.split('/').map((s) => {
        const m = /^\[(\w+)\]$/.exec(s);
        if (!m) return s;
        params[m[1]] = randomUUID();
        return params[m[1]];
    });
    return { url: `http://127.0.0.1:3000/api/${segs.join('/')}`, params };
}

async function sql(text: string, params: unknown[]): Promise<void> {
    await writeLocal(async (c) => { await c.query(text, params); });
}

/** Mot de passe saisi pour la session (la moitié « mot de passe » de l'étape), sans le code. */
async function passwordOnly(a: { userId: string; sessionId: string }, at = 'now()'): Promise<void> {
    await sql(`INSERT INTO public.admin_session_activity (session_id, user_id, last_activity_at, password_at) VALUES ($1, $2, now(), ${at})
               ON CONFLICT (session_id) DO UPDATE SET last_activity_at = now(), password_at = EXCLUDED.password_at`, [a.sessionId, a.userId]);
}

async function verifiedDevice(userId: string, cookieValue: string, verifiedAt = 'now()'): Promise<void> {
    await sql(`INSERT INTO public.admin_devices (user_id, device_key, sms_verified_at) VALUES ($1, $2, ${verifiedAt})
               ON CONFLICT (user_id, device_key) DO UPDATE SET sms_verified_at = EXCLUDED.sms_verified_at`, [userId, deviceKeyOfValue(cookieValue)]);
}

const adminList = (token: string, cookie?: string) => callRoute('admin/users', 'GET', { token, cookie });

describe('Attaque 1 — ouvrir l\'administration ou une route de compte d\'un ADMIN sans le code', () => {
    let admin: Account;

    test('a. toutes les routes authentifiées, jeton seul : aucune réponse 2xx (hors exceptions motivées)', async () => {
        admin = await rawAccount('admin-routes', 'ADMIN', ADMIN_PERMISSIONS);
        const opened: string[] = [];
        const other: string[] = [];
        let refused = 0;
        for (const rel of routes()) {
            if (OUT_OF_SCOPE.some((re) => re.test(rel))) continue;
            if (!AUTH_HELPERS.test(fs.readFileSync(path.join(ROOT, rel, 'route.ts'), 'utf8'))) continue;
            for (const method of METHODS) {
                const { url, params } = concrete(rel);
                const r = await callRoute(rel, method, { token: admin.token, params, url });
                if (!r) continue;
                const key = `${method} ${rel}`;
                if (r.status === 403 && STEP_UP_CODES.has(String(r.body.code))) refused += 1;
                else if (r.status >= 200 && r.status < 300) opened.push(`${key} → ${r.status}`);
                else other.push(`${key} → ${r.status} ${String(r.body.code ?? '')}`);
            }
        }
        console.log(`[CV9QQ-1a] refusées par l'étape de sécurité : ${refused}`);
        console.log(`[CV9QQ-1a] autres refus (avant l'étape) : ${other.join(' ; ') || 'aucun'}`);
        console.log(`[CV9QQ-1a] 2xx sans le code : ${opened.join(' ; ') || 'aucune'}`);
        const unexpected = opened.filter((o) => !ADMITTED_WITHOUT_CODE.has(o.split(' → ')[0]));
        assert.deepEqual(unexpected, [], `routes ouvertes à un ADMIN sans code :\n${unexpected.join('\n')}`);
        assert.ok(refused > 30, `au moins les routes d'administration refusées par l'étape (${refused})`);
    });

    test('b. PostgREST, jeton seul : aucune donnée d\'un autre compte (comptes, paiements, retraits, journal d\'audit)', async () => {
        const a = admin ?? await rawAccount('admin-rest', 'ADMIN', ADMIN_PERMISSIONS);
        const db = userClient(a.token);
        const read: string[] = [];
        for (const [table, column] of [['users', 'id'], ['payments', 'id'], ['withdrawals', 'id'], ['audit_logs', 'id'], ['otp_codes', 'id']] as const) {
            const { data, error } = await db.from(table).select(column).limit(5);
            const others = table === 'users' ? (data ?? []).filter((r) => (r as Record<string, unknown>).id !== a.userId) : (data ?? []);
            read.push(`${table}: ${error ? `refus ${error.code}` : `${others.length} ligne(s)`}`);
        }
        console.log(`[CV9QQ-1b] lectures REST d'un ADMIN sans code : ${read.join(' ; ')}`);
        const leaks = read.filter((r) => /: [1-9]\d* ligne/.test(r));
        assert.deepEqual(leaks, [], `PostgREST sert à un ADMIN qui n'a jamais saisi le code les données des autres comptes :\n${leaks.join('\n')}`);
    });

    test('c. cookie d\'appareil d\'un autre admin copié : code exigé ; témoin : son propriétaire passe', async () => {
        const owner = await rawAccount('admin-proprio', 'ADMIN', ['users.read']);
        const thief = await rawAccount('admin-voleur', 'ADMIN', ['users.read']);
        const value = randomBytes(32).toString('base64url');
        await verifiedDevice(owner.userId, value);
        await passwordOnly(owner);
        await passwordOnly(thief);
        const ownerTry = await adminList(owner.token, `ev_admin_device=${value}`);
        assert.equal(ownerTry?.status, 200, `témoin : le propriétaire de l'appareil passe (${JSON.stringify(ownerTry?.body).slice(0, 160)})`);
        const copied = await adminList(thief.token, `ev_admin_device=${value}`);
        assert.deepEqual([copied?.status, copied?.body.code], [403, 'ADMIN_SMS_REQUIRED'], `cookie copié : ${JSON.stringify(copied?.body)}`);
        const forged = await adminList(thief.token, `ev_admin_device=${randomBytes(32).toString('base64url')}`);
        assert.deepEqual([forged?.status, forged?.body.code], [403, 'ADMIN_SMS_REQUIRED'], `cookie inventé : ${JSON.stringify(forged?.body)}`);
    });

    test('d. appareil « déjà vu » dont le code date de plus de 12 h : code exigé', async () => {
        const a = await rawAccount('admin-12h', 'ADMIN', ['users.read']);
        const value = randomBytes(32).toString('base64url');
        await verifiedDevice(a.userId, value, `now() - interval '13 hours'`);
        await passwordOnly(a);
        const r = await adminList(a.token, `ev_admin_device=${value}`);
        assert.deepEqual([r?.status, r?.body.code, r?.body.reason], [403, 'ADMIN_SMS_REQUIRED', 'DEVICE_12H'], JSON.stringify(r?.body));
        const session = await callRoute('account/payments', 'GET', { token: a.token, cookie: `ev_admin_device=${value}` });
        assert.deepEqual([session?.status, session?.body.code], [403, 'ADMIN_SMS_REQUIRED'], `route de compte : ${JSON.stringify(session?.body)}`);
    });

    test('e. code administrateur : 5 essais faux, puis le bon code est refusé', async () => {
        const a = await rawAccount('admin-code', 'ADMIN', ['users.read']);
        const pwd = await callRoute('admin/step-up', 'POST', { token: a.token, body: { password: STRONG_PASSWORD } });
        assert.equal(pwd?.status, 200, JSON.stringify(pwd?.body));
        const since = getFakes().sms.messagesTo(a.phone).length;
        const sent = await callRoute('admin/step-up/sms', 'POST', { token: a.token, body: {} });
        assert.equal(sent?.status, 200, JSON.stringify(sent?.body));
        const code = /code administrateur (\d{6})\./.exec(getFakes().sms.messagesTo(a.phone).slice(since).at(-1)?.message ?? '')?.[1];
        assert.ok(code, 'code reçu');
        const wrong = code === '000000' ? '111111' : '000000';
        const statuses: number[] = [];
        for (let i = 0; i < 5; i += 1) statuses.push((await callRoute('admin/step-up/sms', 'POST', { token: a.token, body: { code: wrong } }))!.status);
        const last = await callRoute('admin/step-up/sms', 'POST', { token: a.token, body: { code } });
        console.log(`[CV9QQ-1e] 5 faux : ${statuses.join(',')} ; bon code ensuite : ${last?.status} ${String(last?.body.code ?? '')}`);
        assert.notEqual(last?.status, 200, 'le bon code passe après 5 essais faux');
        const still = await adminList(a.token);
        assert.deepEqual([still?.status, still?.body.code], [403, 'ADMIN_SMS_REQUIRED'], JSON.stringify(still?.body));
    });
});

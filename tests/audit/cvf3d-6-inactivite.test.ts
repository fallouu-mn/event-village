/**
 * Contre-vérification de la finition 3d, attaque 6 — règle des 30 minutes d'inactivité d'un compte admin hors de
 * l'administration, et routes de compte d'un admin qui n'a pas passé le code.
 *  a. Routes de compte sans le code : toutes les routes de app/api qui lisent une session, hors administration (/api/admin,
 *     inventaire de f3b-securite) et hors routes partenaire et contrôleur (/api/partner, /api/controller,
 *     /api/withdrawals, /api/finance : inventaire de f3d-securite), lues sur le disque, chaque méthode exportée, appelées
 *     avec la session d'un ADMIN qui a redonné son mot de passe mais pas le code : aucune ne doit servir (2xx). Exceptions
 *     nommées et justifiées (ALLOWED), non appelées.
 *  b. Admin inactif depuis 31 minutes : refusé par les routes partenaire (témoin), mais par la REST et le temps réel ?
 *  c. Relecture automatique (en-tête x-ev-input-age) sur une route contrôleur : servie sans compter comme activité, puis
 *     refusée après 31 minutes sans saisie.
 * Sortie brute `[CVF3D-6]`.
 */
import '../helpers/env';
import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { inspect, writeLocal } from '../helpers/db';
import { assertFinition3dInvariants } from '../helpers/finition3d-invariants';
import { disposeClients, RECEIVE_TIMEOUT_MS, signedInClient, subscribeCollect, waitForEvent } from '../helpers/realtime';
import { newPartner } from '../parcours/finance-helpers';
import { newAdmin } from '../parcours/notif-helpers';
import {
    call, confirmPasswordOnly, freshSession, othersSeen, sessionIdOf, show, STRONG_PASSWORD, type Reply,
} from './cvf3d-helpers';

const API = path.join(process.cwd(), 'app', 'api');
const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;
/** Dossiers dont l'inventaire est fait ailleurs (administration, routes partenaire et contrôleur) ou sans session (tâches, webhooks). */
const ELSEWHERE = new Set(['admin', 'partner', 'controller', 'withdrawals', 'finance', 'cron', 'webhooks', 'dev']);
const SESSION_RE = /requireActiveSession|getServerSessionUser|getAuthenticatedUser|getAuthenticatedSession|getAuthenticatedUserId|verifyAdminAuth|adminStepUpRefusal/;
/** Routes de compte permises sans le code, et pourquoi (non appelées : la déconnexion fermerait la session du test). */
const ALLOWED = new Map<string, string>([
    ['auth/me#GET', 'qui suis-je : la fenêtre du code en a besoin pour s\'afficher'],
    ['account/password-confirm#POST', 'mot de passe saisi dans la fenêtre du code'],
    ['auth/sign-out-global#POST', 'déconnexion de tous les appareils : protège le compte'],
]);
const STEP_UP = new Set(['ADMIN_SMS_REQUIRED', 'ADMIN_PASSWORD_REQUIRED', 'AUTH_REQUIRED']);

function routeFiles(dir: string): string[] {
    if (!fs.existsSync(dir)) return [];
    const out: string[] = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) out.push(...routeFiles(full));
        else if (entry.name === 'route.ts') out.push(full);
    }
    return out.sort();
}

async function ageSession(token: string, minutes: number): Promise<void> {
    const sessionId = sessionIdOf(token);
    await writeLocal(async (c) => {
        const r = await c.query(
            `UPDATE public.admin_session_activity SET last_activity_at = now() - make_interval(mins => $2), password_at = now() - make_interval(mins => $2)
              WHERE session_id = $1`, [sessionId, minutes]);
        assert.equal(r.rowCount, 1, 'session admin introuvable dans admin_session_activity');
        await c.query(`UPDATE public.password_confirmations SET confirmed_at = now() - make_interval(mins => $2) WHERE session_id = $1`, [sessionId, minutes]);
    });
}

async function idleMinutes(token: string): Promise<number> {
    return inspect(async (c) => Number((await c.query(
        `SELECT extract(epoch FROM now() - last_activity_at) / 60 AS m FROM public.admin_session_activity WHERE session_id = $1`, [sessionIdOf(token)])).rows[0].m));
}

after(async () => {
    await assertFinition3dInvariants('cvf3d-6-inactivite');
});

describe('6. routes de compte d\'un admin sans le code', () => {
    test('a. chaque route qui lit une session, hors administration et routes partenaire et contrôleur : rien n\'est servi sans le code', async () => {
        const admin = await newAdmin('cvf3d6-a', ['events.read', 'users.read']);
        const s = await freshSession(admin.email);
        await confirmPasswordOnly(s.token, STRONG_PASSWORD);
        const served: string[] = [];
        const other: string[] = [];
        const refused: string[] = [];
        const skipped: string[] = [];
        for (const file of routeFiles(API)) {
            const rel = path.relative(API, path.dirname(file)).split(path.sep).join('/');
            if (ELSEWHERE.has(rel.split('/')[0] ?? '')) continue;
            const text = fs.readFileSync(file, 'utf8');
            if (!SESSION_RE.test(text)) continue;
            const segments = rel.split('/');
            if (segments.some((x) => x.startsWith('[...'))) { skipped.push(`${rel} (segment attrape-tout)`); continue; }
            const params: Record<string, string> = {};
            const url = '/api/' + segments.map((x) => {
                const m = /^\[(.+)\]$/.exec(x);
                if (!m) return x;
                params[m[1]] = randomUUID();
                return params[m[1]];
            }).join('/');
            for (const method of METHODS) {
                if (!new RegExp(`export\\s+(async\\s+)?function\\s+${method}\\b|export\\s+const\\s+${method}\\b`).test(text)) continue;
                const key = `${rel}#${method}`;
                if (ALLOWED.has(key)) { skipped.push(`${key} (${ALLOWED.get(key)})`); continue; }
                const r: Reply = await call(method, rel, { token: s.token, path: url, params, body: ['POST', 'PUT', 'PATCH'].includes(method) ? {} : undefined });
                const line = `${method} /api/${rel} → ${r.status} ${String(r.body.code ?? '')}`;
                if (r.status >= 200 && r.status < 300) served.push(`${line} ${JSON.stringify(r.body).slice(0, 160)}`);
                else if ((r.status === 401 || r.status === 403) && STEP_UP.has(String(r.body.code))) refused.push(line);
                else other.push(line);
            }
        }
        console.log(`[CVF3D-6a] refusées faute de code : ${refused.length} ; exceptions non appelées : ${skipped.join(' ; ')}`);
        console.log(`[CVF3D-6a] autres réponses (rien de servi) : ${other.length === 0 ? 'aucune' : other.join(' | ')}`);
        console.log(`[CVF3D-6a] SERVIES sans le code : ${served.length === 0 ? 'aucune' : served.join(' | ')}`);
        assert.ok(refused.length > 30, `trop peu de routes refusées : ${refused.length}`);
        assert.deepEqual(served, [], `routes de compte servies à un admin sans le code :\n${served.join('\n')}`);
    });
});

describe('6. inactivité de 31 minutes hors des routes de l\'application', () => {
    test('b. admin inactif depuis 31 minutes : refusé par les routes partenaire (témoin) ; REST et temps réel refusés aussi', async () => {
        const admin = await newAdmin('cvf3d6-b', ['events.read']);
        const before = await othersSeen(admin.accessToken, admin.userId);
        await ageSession(admin.accessToken, 31);
        const route = await call('GET', 'partner/team/organizers', { token: admin.accessToken });
        const restIdle = await othersSeen(admin.accessToken, admin.userId);

        const witness = await signedInClient('ADMIN');
        const idleRt = await signedInClient({ email: admin.email });
        let receivedByIdle = false;
        try {
            const { data } = await idleRt.auth.getSession();
            await ageSession(String(data.session?.access_token), 31);
            const feed = subscribeCollect(witness, { table: 'admin_signals' }, { label: 'témoin (ADMIN actif)' });
            const spy = subscribeCollect(idleRt, { table: 'admin_signals' }, { label: 'ADMIN inactif depuis 31 minutes' });
            await Promise.all([feed.ready, spy.ready]);
            const sentinel = (await newPartner('cvf3d6-signal')).partnerId;
            await waitForEvent(feed, (e) => e.new.ref_id === sentinel, RECEIVE_TIMEOUT_MS, 'le témoin reçoit la sentinelle');
            await new Promise((r) => setTimeout(r, 3_000));
            receivedByIdle = spy.events.some((e) => e.new.ref_id === sentinel);
        } finally {
            await disposeClients(witness, idleRt);
        }
        console.log(`[CVF3D-6b] avant : ${before.n} compte(s) d'autrui par la REST ; après 31 minutes sans activité : route partenaire ${show(route)} ; REST ${restIdle.n} compte(s) d'autrui${restIdle.error ? ` (${restIdle.error})` : ''} ; temps réel : signal d'administration reçu ${receivedByIdle ? 'OUI' : 'non'}`);
        assert.ok(before.n > 0, 'témoin : un admin actif lit les comptes d\'autrui');
        assert.deepEqual([route.status, route.body.code, route.body.reason], [403, 'ADMIN_PASSWORD_REQUIRED', 'IDLE'], show(route));
        assert.equal(restIdle.n, 0, `admin inactif depuis 31 minutes : ${restIdle.n} compte(s) d'autrui encore lus par la REST`);
        assert.equal(receivedByIdle, false, 'admin inactif depuis 31 minutes : signal d\'administration reçu en temps réel');
    });

    test('c. relecture automatique sur une route contrôleur : servie sans compter comme activité, puis refusée à 31 minutes', async () => {
        const admin = await newAdmin('cvf3d6-c', ['events.read']);
        await ageSession(admin.accessToken, 29);
        const auto = await call('GET', 'controller/assignments', { token: admin.accessToken, headers: { 'x-ev-input-age': '120' } });
        const idleAfterAuto = await idleMinutes(admin.accessToken);
        await ageSession(admin.accessToken, 31);
        const late = await call('GET', 'controller/assignments', { token: admin.accessToken, headers: { 'x-ev-input-age': '120' } });
        console.log(`[CVF3D-6c] à 29 minutes, relecture automatique : ${show(auto)} ; inactivité ensuite : ${idleAfterAuto.toFixed(1)} min ; à 31 minutes : ${show(late)}`);
        assert.equal(auto.status, 200, show(auto));
        assert.ok(idleAfterAuto >= 28.5, `la relecture automatique a compté comme activité (${idleAfterAuto.toFixed(1)} min)`);
        assert.deepEqual([late.status, late.body.code], [403, 'ADMIN_PASSWORD_REQUIRED'], show(late));
    });
});

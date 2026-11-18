/**
 * Finition 3d (recours et suppléance) — point 1, sécurité d'abord : la règle des 30 minutes d'inactivité de
 * l'administration s'applique aussi aux routes partenaire et contrôleur utilisées par un compte ADMIN ou SUPERADMIN.
 *
 * 1. Inventaire de TOUTES les routes de `app/api/partner`, `app/api/controller`, `app/api/withdrawals` et `app/api/finance`
 *    (fichiers route.ts lus sur le disque, chaque méthode exportée ; ces deux derniers dossiers sont des routes partenaire
 *    ouvertes aux admins par serverIsPartner) : un admin dont la session est restée 31 minutes sans activité est refusé
 *    partout (403 ADMIN_PASSWORD_REQUIRED, raison IDLE), avant toute lecture ou écriture. Seules exceptions : les routes qui
 *    ne lisent aucune session (inscription d'une partenaire, envoi de ses pièces, activation d'un contrôleur), dont le
 *    test vérifie qu'elles n'appellent vraiment aucune fonction de session. Une route ajoutée plus tard entre d'office.
 * 2. Écart trouvé en lisant les routes : GET /api/controller/assignments lisait la session sans aucun contrôle du second
 *    facteur d'un compte admin (ni code de l'appareil, ni mot de passe de moins de 12 h, ni inactivité).
 * 3. Activité : un appel accepté sur une route contrôleur compte comme activité (comme dans l'administration) ; un appel
 *    automatique (relecture sans saisie de la personne depuis plus d'une minute, en-tête `x-ev-input-age` posé par la
 *    fenêtre de sécurité) ne compte pas, dans l'administration comme ailleurs : une page laissée ouverte ne garde plus la
 *    session éveillée (écart de la finition 3b : « À faire aujourd'hui » relu toutes les 60 s).
 * 4. Périmètre : les routes d'un client (ses billets) gardent la règle des 12 heures seulement ; un contrôleur qui n'est
 *    pas admin n'est pas concerné.
 * Fin de suite : assertFinition3dInvariants.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { NextRequest } from 'next/server';
import { inspect, writeLocal } from '../helpers/db';
import { assertFinition3dInvariants } from '../helpers/finition3d-invariants';
import { jsonRequest } from './finance-helpers';
import { newAdmin, type TestAdmin } from './notif-helpers';
import { importModule, newBuyer, service } from './paiement-helpers';

type Handler = (req: NextRequest, ctx?: { params: Promise<Record<string, string>> }) => Promise<Response>;
const METHODS = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const;
const API = path.join(process.cwd(), 'app', 'api');
const AREAS = ['partner', 'controller', 'withdrawals', 'finance'] as const;

/** Routes sans session (chemin relatif à app/api) : le test vérifie qu'elles ne lisent vraiment aucune session. */
const NO_SESSION = new Set(['partner/register', 'partner/documents/upload', 'controller/setup']);
const SESSION_FUNCTIONS = /requireActiveSession|getServerSessionUser|getAuthenticatedUser|getAuthenticatedSession|verifyAdminAuth/;

function sessionIdOf(token: string): string {
    const claims = JSON.parse(Buffer.from(token.split('.')[1] ?? '', 'base64url').toString('utf8')) as { session_id?: string };
    assert.ok(claims.session_id, 'jeton sans session_id');
    return claims.session_id;
}

/** Recule l'activité (et le mot de passe) de la session de `minutes`. */
async function ageSession(admin: TestAdmin, minutes: number): Promise<void> {
    const sessionId = sessionIdOf(admin.accessToken);
    await writeLocal(async (c) => {
        const r = await c.query(
            `UPDATE public.admin_session_activity SET last_activity_at = now() - make_interval(mins => $2), password_at = now() - make_interval(mins => $2)
              WHERE session_id = $1`, [sessionId, minutes]);
        assert.equal(r.rowCount, 1, 'session admin introuvable dans admin_session_activity');
        await c.query(`UPDATE public.password_confirmations SET confirmed_at = now() - make_interval(mins => $2) WHERE session_id = $1`, [sessionId, minutes]);
    });
}

/** Minutes écoulées depuis la dernière activité enregistrée de la session. */
async function idleMinutes(admin: TestAdmin): Promise<number> {
    const sessionId = sessionIdOf(admin.accessToken);
    return inspect(async (c) => {
        const r = await c.query(`SELECT extract(epoch FROM now() - last_activity_at) / 60 AS m FROM public.admin_session_activity WHERE session_id = $1`, [sessionId]);
        assert.equal(r.rows.length, 1, 'session admin introuvable');
        return Number(r.rows[0].m);
    });
}

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

/** « partner/events/[id]/cash-refunds »… */
function routeKey(file: string): string {
    return path.relative(API, path.dirname(file)).split(path.sep).join('/');
}

function urlOf(key: string): { url: string; params: Record<string, string> } {
    const params: Record<string, string> = {};
    const url = key.split('/').map((seg) => {
        const m = /^\[(.+)\]$/.exec(seg);
        if (!m) return seg;
        params[m[1]] = randomUUID();
        return params[m[1]];
    }).join('/');
    return { url: `/api/${url}`, params };
}

let idleAdmin: TestAdmin;
let idleSuper: TestAdmin;

before(async () => {
    idleAdmin = await newAdmin('f3d-inactif', ['events.read', 'events.write', 'access.operate', 'refunds.manage']);
    idleSuper = await newAdmin('f3d-inactif-super', [], { role: 'SUPERADMIN' });
    await ageSession(idleAdmin, 31);
    await ageSession(idleSuper, 31);
});

after(async () => {
    await assertFinition3dInvariants('f3d-securite');
});

describe('1. inventaire : chaque route partenaire et contrôleur refuse un compte admin resté 30 minutes sans activité', () => {
    test('toutes les routes et méthodes : 403 ADMIN_PASSWORD_REQUIRED (IDLE), sauf les routes sans session', async () => {
        const files = AREAS.flatMap((a) => routeFiles(path.join(API, a)));
        assert.ok(files.length >= 80, `inventaire trop court : ${files.length} routes lues`);
        const breaches: string[] = [];
        let calls = 0;
        for (const file of files) {
            const key = routeKey(file);
            if (NO_SESSION.has(key)) {
                assert.doesNotMatch(fs.readFileSync(file, 'utf8'), SESSION_FUNCTIONS, `${key} lit une session : elle doit entrer dans l'inventaire`);
                continue;
            }
            const mod = (await importModule(`../../app/api/${key}/route`)) as Partial<Record<typeof METHODS[number], Handler>>;
            for (const method of METHODS) {
                const handler = mod[method];
                if (typeof handler !== 'function') continue;
                for (const who of [idleAdmin, idleSuper]) {
                    const { url, params } = urlOf(key);
                    const body = method === 'GET' || method === 'DELETE' ? undefined : {};
                    const res = await handler(jsonRequest(url, method, who.accessToken, body), { params: Promise.resolve(params) });
                    calls++;
                    const payload = (await res.json().catch(() => null)) as { code?: string; reason?: string } | null;
                    if (res.status !== 403 || payload?.code !== 'ADMIN_PASSWORD_REQUIRED' || payload?.reason !== 'IDLE') {
                        breaches.push(`${method} /api/${key} (${who.role}) → HTTP ${res.status} ${JSON.stringify(payload).slice(0, 160)}`);
                    }
                }
            }
        }
        console.log(`[F3D-SECURITE] ${files.length} routes, ${calls} appels d'une session inactive, ${breaches.length} écart(s)`);
        assert.deepEqual(breaches, [], `route qui laisse passer une session admin inactive :\n${breaches.join('\n')}`);
    });
});

describe('2. écart : GET /api/controller/assignments contrôle le second facteur d’un compte admin', () => {
    test('appareil sans code administrateur : 403 ADMIN_SMS_REQUIRED (avant : 200)', async () => {
        const admin = await newAdmin('f3d-sans-code', ['access.operate']);
        await writeLocal((c) => c.query(`DELETE FROM public.admin_devices WHERE user_id = $1`, [admin.userId]));
        const { GET } = (await importModule('../../app/api/controller/assignments/route')) as { GET: Handler };
        const res = await GET(jsonRequest('/api/controller/assignments', 'GET', admin.accessToken));
        const body = (await res.json()) as { code?: string };
        assert.deepEqual([res.status, body.code], [403, 'ADMIN_SMS_REQUIRED'], JSON.stringify(body));
    });

    test('un contrôleur qui n’est pas admin lit toujours ses affectations (200)', async () => {
        const controller = await newBuyer('f3d-controleur');
        const { error } = await service.from('user_roles').upsert([{ user_id: controller.userId, role: 'CONTROLEUR' }], { onConflict: 'user_id,role' });
        assert.equal(error, null, error?.message);
        const { GET } = (await importModule('../../app/api/controller/assignments/route')) as { GET: Handler };
        const res = await GET(jsonRequest('/api/controller/assignments', 'GET', controller.accessToken));
        assert.equal(res.status, 200, await res.text());
    });
});

describe('3. activité : un appel accepté compte, une relecture automatique ne compte pas', () => {
    test('route contrôleur acceptée : l’activité de la session admin est mise à jour', async () => {
        const admin = await newAdmin('f3d-actif-controleur', ['access.operate']);
        await ageSession(admin, 25);
        const { GET } = (await importModule('../../app/api/controller/profile/route')) as { GET: Handler };
        const res = await GET(jsonRequest('/api/controller/profile', 'GET', admin.accessToken));
        assert.equal(res.status, 200, await res.text());
        assert.ok(await idleMinutes(admin) < 1, 'activité non mise à jour par la route contrôleur');
    });

    test('relecture automatique (x-ev-input-age: 600) dans l’administration : acceptée, mais l’activité ne bouge pas', async () => {
        const admin = await newAdmin('f3d-releve-admin', ['events.write']);
        await ageSession(admin, 25);
        const { GET } = (await importModule('../../app/api/admin/todo/route')) as { GET: Handler };
        const res = await GET(jsonRequest('/api/admin/todo', 'GET', admin.accessToken, undefined, { 'x-ev-input-age': '600' }));
        assert.equal(res.status, 200, await res.text());
        const idle = await idleMinutes(admin);
        assert.ok(idle > 24, `une relecture automatique a compté comme activité (inactivité ${idle.toFixed(1)} min)`);
    });

    test('relecture automatique sur une route contrôleur : acceptée, l’activité ne bouge pas', async () => {
        const admin = await newAdmin('f3d-releve-controleur', ['access.operate']);
        await ageSession(admin, 25);
        const { GET } = (await importModule('../../app/api/controller/profile/route')) as { GET: Handler };
        const res = await GET(jsonRequest('/api/controller/profile', 'GET', admin.accessToken, undefined, { 'x-ev-input-age': '600' }));
        assert.equal(res.status, 200, await res.text());
        const idle = await idleMinutes(admin);
        assert.ok(idle > 24, `une relecture automatique a compté comme activité (inactivité ${idle.toFixed(1)} min)`);
    });

    test('saisie récente (x-ev-input-age: 5) : l’appel compte comme activité', async () => {
        const admin = await newAdmin('f3d-saisie', ['events.write']);
        await ageSession(admin, 25);
        const { GET } = (await importModule('../../app/api/admin/todo/route')) as { GET: Handler };
        const res = await GET(jsonRequest('/api/admin/todo', 'GET', admin.accessToken, undefined, { 'x-ev-input-age': '5' }));
        assert.equal(res.status, 200, await res.text());
        assert.ok(await idleMinutes(admin) < 1, 'un appel après une saisie récente doit compter comme activité');
    });
});

describe('4. périmètre', () => {
    test('route client d’un compte admin inactif (ses billets) : règle des 12 heures seulement, pas de refus IDLE', async () => {
        const { GET } = (await importModule('../../app/api/tickets/route')) as { GET: Handler };
        const res = await GET(jsonRequest('/api/tickets', 'GET', idleAdmin.accessToken));
        const body = (await res.json().catch(() => null)) as { code?: string } | null;
        assert.notEqual(body?.code, 'ADMIN_PASSWORD_REQUIRED', `route client refusée pour inactivité : HTTP ${res.status}`);
    });
});

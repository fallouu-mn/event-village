/**
 * Lot 8, tâche 8.1 (contrat 5.2, 5.5, L20) — deuxième verrou de la page de développement : le middleware rend 404
 * sur `/dev`, `/dev/…` et `/api/dev/…` hors du mode d'essai (NODE_ENV=development et EV_INTEGRATIONS=fake), avec
 * ou sans session, et laisse passer sans session dans ce mode. Le motif est ancré : `/developpeurs` n'est pas touché.
 *
 * Dans ce processus, tests/helpers/env.ts gèle EV_INTEGRATIONS à `fake` : seul NODE_ENV change, le temps d'un test
 * et rétabli dans un `finally`. Le cas « développement sans fake » passe par un processus fils à l'environnement
 * explicite. Le premier verrou (pageExtensions) et le build sont prouvés par l'e2e (`fake-prod`, `fumee`).
 *
 * Écart signalé : suite sans écriture métier (lecture du middleware et connexion d'un compte du seed), elle
 * n'appelle donc pas assertRecetteInvariants.
 *
 * Rouge aujourd'hui : `/dev…` n'a pas de garde, le middleware redirige ou répond 401 ; en mode d'essai il ne laisse
 * pas passer. Déjà vert, annoncé : `/developpeurs` et voisins suivent le sort d'une page inconnue (garde-fou du
 * motif ancré, il deviendrait rouge avec un test par préfixe).
 */
import '../helpers/env';
import { before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { FIXTURE_USERS, TEST_PASSWORD } from '../helpers/fixture-data';
import { callMiddleware, sessionCookies, type SessionCookie } from '../helpers/middleware';

const ROOT = process.cwd();
const DEV_PATHS = ['/dev', '/dev/', '/dev/paiements', `/dev/paiements/${randomUUID()}`, '/api/dev/samirpay/validate', '/api/dev/samirpay/refuse'];
/** Chemins voisins : seul un motif non ancré les toucherait. */
const NEIGHBOUR_PATHS = ['/developpeurs', '/devenir-partenaire', '/dev-paiements', '/api/developpeurs', '/api/device'];

function withNodeEnv<T>(value: string, fn: () => Promise<T>): Promise<T> {
    const env = process.env as Record<string, string | undefined>;
    const previous = env.NODE_ENV;
    env.NODE_ENV = value;
    return fn().finally(() => { env.NODE_ENV = previous; });
}

let adminCookies: SessionCookie[] = [];

before(async () => {
    const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
        auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error } = await client.auth.signInWithPassword({ email: FIXTURE_USERS.SUPERADMIN.email, password: TEST_PASSWORD });
    assert.equal(error, null, `connexion du superadmin du seed : ${error?.message}`);
    adminCookies = await sessionCookies(client);
});

async function assert404(pathname: string, cookies: SessionCookie[], label: string): Promise<void> {
    const r = await callMiddleware(pathname, cookies);
    assert.equal(r.status, 404, `${label} ${pathname} : HTTP ${r.status}${r.location ? ` vers ${r.location}` : ''}${r.passedThrough ? ' (laissé passer)' : ''}`);
    assert.equal(r.passedThrough, false, `${label} ${pathname} : laissé passer`);
    assert.equal(r.location, null, `${label} ${pathname} : aucune redirection`);
}

describe('hors du mode d’essai : 404', () => {
    test('en test (NODE_ENV=test, EV_INTEGRATIONS=fake), sans session', async () => {
        await withNodeEnv('test', async () => {
            for (const p of DEV_PATHS) await assert404(p, [], 'sans session');
        });
    });

    test('en production, sans session', async () => {
        await withNodeEnv('production', async () => {
            for (const p of DEV_PATHS) await assert404(p, [], 'production');
        });
    });

    test('avec une session de superadmin : toujours 404, en test comme en production', async () => {
        for (const nodeEnv of ['test', 'production']) {
            await withNodeEnv(nodeEnv, async () => {
                for (const p of DEV_PATHS) await assert404(p, adminCookies, `superadmin (${nodeEnv})`);
            });
        }
    });

    test('développement sans EV_INTEGRATIONS=fake : 404', async () => {
        const script = `
const { NextRequest } = require('next/server');
const { middleware } = require(${JSON.stringify(`${ROOT.replace(/\\/g, '/')}/middleware.ts`)});
(async () => {
    const out = {};
    for (const p of ${JSON.stringify(DEV_PATHS)}) {
        const res = await middleware(new NextRequest('http://127.0.0.1:3000' + p));
        out[p] = res.status;
    }
    console.log('@@' + JSON.stringify(out));
})().catch((e) => { console.log('@@' + JSON.stringify({ thrown: String(e && e.message ? e.message : e) })); });
`;
        const env: Record<string, string> = {
            NODE_ENV: 'development',
            EV_INTEGRATIONS: 'real',
            NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:9',
            NEXT_PUBLIC_SUPABASE_ANON_KEY: randomBytes(24).toString('hex'),
        };
        for (const key of ['PATH', 'Path', 'SystemRoot', 'TEMP', 'TMP']) if (process.env[key]) env[key] = process.env[key] as string;
        const stdout = await new Promise<string>((resolve, reject) => {
            const child = spawn(process.execPath, ['--import', 'tsx', '-e', script], { cwd: ROOT, env: env as NodeJS.ProcessEnv, stdio: ['ignore', 'pipe', 'pipe'] });
            let out = '';
            let err = '';
            const timer = setTimeout(() => child.kill('SIGKILL'), 45_000);
            child.stdout.on('data', (c) => { out += String(c); });
            child.stderr.on('data', (c) => { err += String(c); });
            child.on('error', reject);
            child.on('close', (code) => {
                clearTimeout(timer);
                if (code === 0) resolve(out);
                else reject(new Error(`fils en échec (code ${code}) : ${err.slice(0, 500)}`));
            });
        });
        const line = stdout.split(/\r?\n/).find((l) => l.startsWith('@@'));
        assert.ok(line, `le fils n'a rien rendu : ${stdout.slice(0, 300)}`);
        const statuses = JSON.parse(line.slice(2)) as Record<string, unknown>;
        assert.equal(statuses.thrown, undefined, String(statuses.thrown));
        for (const p of DEV_PATHS) assert.equal(statuses[p], 404, `${p} en développement réel : HTTP ${String(statuses[p])}`);
    });
});

describe('en mode d’essai (development et fake) : passage sans session', () => {
    test('les chemins de développement passent sans session, sans redirection', async () => {
        await withNodeEnv('development', async () => {
            for (const p of DEV_PATHS) {
                const r = await callMiddleware(p, []);
                assert.equal(r.passedThrough, true, `${p} : HTTP ${r.status}${r.location ? ` vers ${r.location}` : ''}`);
                assert.equal(r.location, null, `${p} : aucune redirection`);
            }
        });
    });
});

describe('motif ancré (déjà vert, garde-fou)', () => {
    test('/developpeurs et les chemins voisins suivent le sort d’une page inconnue, dans chaque mode', async () => {
        const unknownPage = `/page-inconnue-${randomBytes(4).toString('hex')}`;
        const unknownApi = `/api/route-inconnue-${randomBytes(4).toString('hex')}`;
        for (const nodeEnv of ['test', 'development', 'production']) {
            await withNodeEnv(nodeEnv, async () => {
                const page = await callMiddleware(unknownPage, []);
                const api = await callMiddleware(unknownApi, []);
                for (const p of NEIGHBOUR_PATHS) {
                    const r = await callMiddleware(p, []);
                    const reference = p.startsWith('/api/') ? api : page;
                    assert.notEqual(r.status, 404, `${p} (${nodeEnv}) touché par la garde de /dev`);
                    assert.equal(r.status, reference.status, `${p} (${nodeEnv}) : HTTP ${r.status}, page inconnue ${reference.status}`);
                    assert.equal(r.passedThrough, reference.passedThrough, `${p} (${nodeEnv})`);
                }
            });
        }
    });
});

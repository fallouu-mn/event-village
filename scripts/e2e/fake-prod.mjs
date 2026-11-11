#!/usr/bin/env node
/**
 * Lot 8 (contrat 15.3, décision L29) — preuve contre le vrai build que le mode simulé est impossible hors développement.
 * Phase « fake-prod » de scripts/e2e/run-e2e.mjs : script node, pas Playwright, durée écrite dans phases.tsv.
 *
 * Lance `next start` sur le build de la CI, port 3199, avec l'environnement de `.env.e2e` plus `EV_INTEGRATIONS=fake`,
 * deux fois : `NODE_ENV=production`, puis `NODE_ENV=development`. Second cas : lib/env.ts lit l'environnement à
 * l'exécution et le laisse passer, alors que le code compilé a `process.env.NODE_ENV` figé à « production ».
 * `EV_DEV_FAKE_SERVICES_URL` est fournie et locale : un refus ne vient donc pas d'une variable manquante.
 *
 * Pour chaque lancement, l'un des deux résultats suivants est exigé :
 *  - le serveur sort en erreur au démarrage et sa sortie cite EV_INTEGRATIONS (une autre cause, port occupé ou build
 *    absent, est un ÉCHEC : elle ne prouverait rien) ;
 *  - ou, serveur démarré : GET /login rend 200 (le serveur répond vraiment) ; POST /api/auth/register/start d'un numéro
 *    neuf rend autre chose que 2xx et aucun SMS n'arrive au faux MTarget ; GET /dev/paiements et
 *    POST /api/dev/samirpay/validate rendent 404, sans session.
 *
 * Lot 9 bis (I3, I5, T12) : troisième lancement, « réel sans https ». `NODE_ENV=production`, EV_INTEGRATIONS
 * absente, SAMIRPAY_API_URL=https://samirpay.invalid/api (hors boucle locale, « .invalid » ne se résout jamais),
 * NEXT_PUBLIC_APP_URL=http://localhost:3199 : le serveur doit sortir en erreur au démarrage avec le refus
 * « [réel] Refus de démarrer … NEXT_PUBLIC_APP_URL … » (lib/integrations/real-mode.ts, instrumentation.ts). Un serveur
 * démarré est un ÉCHEC, comme une autre cause d'arrêt. Les deux lancements précédents sont inchangés.
 *
 * Sortie brute [FAKE-PROD], reprise au rapport. Code 0 si les trois lancements sont conformes, 1 sinon, 2 si les
 * préconditions manquent. L'application e2e du port 3000 n'est pas touchée : même build, autre processus.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { assertLocalServices, fail, loadE2eEnv, parseEnvFile, requireLocalUrl, ROOT } from './env.mjs';

const TAG = 'FAKE-PROD';
const PORT = 3199;
const BASE = `http://127.0.0.1:${PORT}`;
const READY_TIMEOUT_MS = 60_000;
const STOP_TIMEOUT_MS = 10_000;
const REQUEST_TIMEOUT_MS = 30_000;
const OUTPUT_TAIL_LINES = 40;

loadE2eEnv(TAG);
assertLocalServices(TAG);
const fake = requireLocalUrl(TAG, 'E2E_FAKE_SERVICES_URL');
if (!fs.existsSync(path.join(ROOT, '.next', 'BUILD_ID'))) fail(TAG, 'build absent (.next/BUILD_ID).');

const require = createRequire(import.meta.url);
const nextBin = require.resolve('next/dist/bin/next');

function log(line) {
    console.log(`[${TAG}] ${line}`);
}

/** Fichiers que Next charge selon NODE_ENV : leurs clés absentes de `.env.e2e` sont neutralisées (règle de start-app.mjs). */
const ENV_FILES = {
    production: ['.env.production.local', '.env.local', '.env.production', '.env'],
    development: ['.env.development.local', '.env.local', '.env.development', '.env'],
};

function childEnv(nodeEnv) {
    const env = {
        ...process.env,
        NODE_ENV: nodeEnv,
        EV_INTEGRATIONS: 'fake',
        EV_DEV_FAKE_SERVICES_URL: fake.origin,
        NEXT_TELEMETRY_DISABLED: '1',
        HOSTNAME: '127.0.0.1',
        PORT: String(PORT),
    };
    for (const name of ENV_FILES[nodeEnv]) {
        const file = path.join(ROOT, name);
        if (!fs.existsSync(file)) continue;
        for (const key of Object.keys(parseEnvFile(file))) {
            if (env[key] === undefined) env[key] = '';
        }
    }
    return env;
}

/**
 * Lot 9 bis (I3) : mode réel au sens de A9 (ni essai, ni EV_INTEGRATIONS=fake, SamirPay hors boucle locale) avec une
 * adresse publique en http. Une clé EV_INTEGRATIONS venue d'un fichier vaut « real » (même lecture que l'absence,
 * lib/integrations/registry.ts) : la chaîne vide serait refusée par lib/env.ts, pour une autre raison.
 */
function realEnv() {
    const env = {
        ...process.env,
        NODE_ENV: 'production',
        SAMIRPAY_API_URL: 'https://samirpay.invalid/api',
        NEXT_PUBLIC_APP_URL: `http://localhost:${PORT}`,
        NEXT_TELEMETRY_DISABLED: '1',
        HOSTNAME: '127.0.0.1',
        PORT: String(PORT),
    };
    for (const key of ['EV_INTEGRATIONS', 'EV_DEV_FAKE_SERVICES_URL', 'EV_ESSAI_SIMULATION']) delete env[key];
    for (const name of ENV_FILES.production) {
        const file = path.join(ROOT, name);
        if (!fs.existsSync(file)) continue;
        for (const key of Object.keys(parseEnvFile(file))) {
            if (env[key] === undefined) env[key] = '';
        }
    }
    if (env.EV_INTEGRATIONS !== undefined) env.EV_INTEGRATIONS = 'real';
    return env;
}

function startServer(nodeEnv, env = childEnv(nodeEnv)) {
    const child = spawn(process.execPath, [nextBin, 'start', '-H', '127.0.0.1', '-p', String(PORT)], {
        cwd: ROOT, env, stdio: ['ignore', 'pipe', 'pipe'],
    });
    const state = { child, output: [], exit: null };
    const collect = (chunk) => { state.output.push(...chunk.toString('utf8').split(/\r?\n/).filter(Boolean)); };
    child.stdout.on('data', collect);
    child.stderr.on('data', collect);
    state.exited = new Promise((resolve) => {
        child.on('error', (err) => {
            state.exit = { code: null, signal: null, error: err.message };
            resolve();
        });
        child.on('exit', (code, signal) => {
            state.exit = { code, signal, error: null };
            resolve();
        });
    });
    return state;
}

async function stopServer(state) {
    if (state.exit) return;
    state.child.kill('SIGTERM');
    const stopped = await Promise.race([
        state.exited.then(() => true),
        new Promise((resolve) => { setTimeout(() => resolve(false), STOP_TIMEOUT_MS); }),
    ]);
    if (!stopped) {
        log(`serveur encore en marche ${STOP_TIMEOUT_MS / 1000} s après SIGTERM : SIGKILL`);
        state.child.kill('SIGKILL');
        await state.exited;
    }
}

/** Vrai dès que le port répond, quel que soit le statut ; faux si le serveur s'est arrêté avant. */
async function waitUntilServing(state) {
    const deadline = Date.now() + READY_TIMEOUT_MS;
    let lastError = 'aucune tentative';
    while (Date.now() < deadline) {
        if (state.exit) return false;
        try {
            await fetch(`${BASE}/login`, { redirect: 'manual', signal: AbortSignal.timeout(2_000) });
            return true;
        } catch (err) {
            // Connexion refusée tant que le serveur démarre : on réessaie, la dernière cause est citée à l'expiration
            lastError = err instanceof Error ? `${err.name} : ${err.message}` : String(err);
            await new Promise((resolve) => { setTimeout(resolve, 250); });
        }
    }
    throw new Error(`le serveur n'a ni répondu ni quitté en ${READY_TIMEOUT_MS / 1000} s (dernier essai : ${lastError})`);
}

async function request(method, url, body) {
    const res = await fetch(`${BASE}${url}`, {
        method,
        redirect: 'manual',
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        ...(body === undefined ? {} : { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }),
    });
    const text = await res.text();
    const location = res.headers.get('location');
    return { status: res.status, detail: `${text.replace(/\s+/g, ' ').slice(0, 160)}${location ? ` (vers ${location})` : ''}` };
}

/** SMS reçus par le faux MTarget pour ce numéro. */
async function smsCount(digits) {
    const res = await fetch(`${fake.origin}/__test/sms?to=${digits}&limit=200`, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    const text = await res.text();
    if (!res.ok) throw new Error(`faux MTarget /__test/sms : HTTP ${res.status} ${text.slice(0, 200)}`);
    const list = JSON.parse(text).messages;
    if (!Array.isArray(list)) throw new Error(`faux MTarget /__test/sms : liste absente ${text.slice(0, 200)}`);
    return list.length;
}

/** Numéro sénégalais à 9 chiffres dérivé de l'horloge : neuf à chaque appel, aucun compte du seed. */
function freshPhone() {
    return `77${String(Date.now()).slice(-7)}`;
}

/** Contrôles sur un serveur démarré : une ligne par contrôle, la liste des écarts en retour. */
async function probe(nodeEnv) {
    const problems = [];
    const check = (label, ok, detail) => {
        log(`${nodeEnv} : ${ok ? 'OK' : 'ÉCHEC'} ${label} ${detail}`);
        if (!ok) problems.push(`${label} ${detail}`);
    };

    const login = await request('GET', '/login');
    check('GET /login répond (témoin)', login.status === 200, `HTTP ${login.status}`);

    const phone = freshPhone();
    const digits = `221${phone}`;
    const before = await smsCount(digits);
    const start = await request('POST', '/api/auth/register/start', { phone });
    check('POST /api/auth/register/start, numéro neuf, refusé', start.status < 200 || start.status >= 300, `HTTP ${start.status} ${start.detail}`);
    const sent = (await smsCount(digits)) - before;
    check('aucun SMS au faux MTarget', sent === 0, `${sent} SMS`);

    const page = await request('GET', '/dev/paiements');
    check('GET /dev/paiements', page.status === 404, `HTTP ${page.status} ${page.detail.slice(0, 80)}`);
    const action = await request('POST', '/api/dev/samirpay/validate', {});
    check('POST /api/dev/samirpay/validate', action.status === 404, `HTTP ${action.status} ${action.detail.slice(0, 80)}`);
    return problems;
}

async function runMode(nodeEnv) {
    log(`═══ ${nodeEnv} : next start -p ${PORT}, EV_INTEGRATIONS=fake ═══`);
    const state = startServer(nodeEnv);
    let problems;
    try {
        if (await waitUntilServing(state)) {
            problems = await probe(nodeEnv);
        } else {
            const refused = state.exit.code !== 0 && state.output.some((l) => l.includes('EV_INTEGRATIONS'));
            log(`${nodeEnv} : serveur arrêté au démarrage (code ${state.exit.code}, signal ${state.exit.signal}${state.exit.error ? `, ${state.exit.error}` : ''})`);
            problems = refused ? [] : ['serveur arrêté au démarrage sans citer EV_INTEGRATIONS : cette sortie ne prouve pas le refus'];
        }
    } catch (err) {
        problems = [err instanceof Error ? err.message : String(err)];
    } finally {
        await stopServer(state);
    }
    if (problems.length > 0) {
        log(`${nodeEnv} : ÉCHEC, ${problems.length} écart(s) ; fin de la sortie du serveur :`);
        for (const line of state.output.slice(-OUTPUT_TAIL_LINES)) log(`  ${line}`);
    } else {
        log(`${nodeEnv} : conforme`);
    }
    return problems;
}

/** Lot 9 bis (I3, I5) : en réel, adresse publique en http → refus de démarrer exigé ; un serveur démarré est un échec. */
async function runRealWithoutHttps() {
    const label = 'réel sans https';
    log(`═══ ${label} : next start -p ${PORT}, EV_INTEGRATIONS absente, SAMIRPAY_API_URL hors boucle locale, NEXT_PUBLIC_APP_URL en http ═══`);
    const state = startServer('production', realEnv());
    let problems;
    try {
        if (await waitUntilServing(state)) {
            problems = ['serveur démarré en réel avec NEXT_PUBLIC_APP_URL en http : le refus de démarrer (I3) n\'a pas eu lieu'];
        } else {
            const refused = state.exit.code !== 0 && state.output.some((l) => l.includes('Refus de démarrer') && l.includes('NEXT_PUBLIC_APP_URL'));
            log(`${label} : serveur arrêté au démarrage (code ${state.exit.code}, signal ${state.exit.signal}${state.exit.error ? `, ${state.exit.error}` : ''})`);
            problems = refused ? [] : ['serveur arrêté au démarrage sans le refus « [réel] Refus de démarrer » citant NEXT_PUBLIC_APP_URL : cette sortie ne prouve pas le refus'];
        }
    } catch (err) {
        problems = [err instanceof Error ? err.message : String(err)];
    } finally {
        await stopServer(state);
    }
    if (problems.length > 0) {
        log(`${label} : ÉCHEC, ${problems.length} écart(s) ; fin de la sortie du serveur :`);
        for (const line of state.output.slice(-OUTPUT_TAIL_LINES)) log(`  ${line}`);
    } else {
        log(`${label} : conforme`);
    }
    return problems;
}

const failures = [];
for (const nodeEnv of ['production', 'development']) {
    for (const problem of await runMode(nodeEnv)) failures.push(`${nodeEnv} : ${problem}`);
}
for (const problem of await runRealWithoutHttps()) failures.push(`réel sans https : ${problem}`);
log(failures.length === 0 ? 'résultat : OK, simulé impossible sur le build dans les deux lancements, et réel sans https refusé' : `résultat : ÉCHEC\n${failures.map((f) => `[${TAG}]   ${f}`).join('\n')}`);
process.exit(failures.length === 0 ? 0 : 1);

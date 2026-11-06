/**
 * Lot 8, tâche 8.1 (contrat 5.2, 5.5, L21, L22, L25) — npm run cron:local.
 *
 * Deux niveaux, sans base :
 *  - règles pures de scripts/dev/cron-local.core.mjs (import dynamique, module absent avant fix(8.1s)) ;
 *  - entrée scripts/dev/cron-local.mjs dans un processus fils, avec un dossier de travail TEMPORAIRE qui porte un
 *    `.env.local` fabriqué (le `.env.local` du dépôt n'est jamais lu) et un faux serveur d'application local.
 *
 * API figée par cette suite (au-delà du contrat, pour S1) :
 *  - parseSchedule(sql) rend `{ name, expr, route, timeoutMs }[]`, dans l'ordre du fichier ;
 *  - createCronRunner({ tasks, call, log }) rend `{ tick(date) }`, tick rendant `{ started: string[], skipped: string[] }` :
 *    le contrat exige « pas de recouvrement » sans attente réelle, il faut donc une boucle pilotable ;
 *  - schedule-crons.sql est lu depuis l'emplacement du script (import.meta.url), `.env.local` et `.logs/` depuis
 *    le dossier de travail ;
 *  - cron-local.mjs --list n'appelle rien, --once <tâche> fait un seul appel puis rend la main.
 *
 * Rouge aujourd'hui : tous les tests, scripts/dev/ n'existe pas ; chaque échec nomme le fichier attendu.
 */
import '../helpers/env';
import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';

const ROOT = process.cwd();
const CORE_FILE = path.join(ROOT, 'scripts', 'dev', 'cron-local.core.mjs');
const ENTRY_FILE = path.join(ROOT, 'scripts', 'dev', 'cron-local.mjs');
const SCHEDULE_FILE = path.join(ROOT, 'supabase', 'ops', 'schedule-crons.sql');
const CRON_ROUTES = path.join(ROOT, 'app', 'api', 'cron');
// Chemin calculé : le module n'existe pas avant le correctif, et le typecheck de la CI passe avant les tests.
const CORE_PATH = '../../scripts/dev/cron-local.core.mjs';

interface CronTask { name: string; expr: string; route: string; timeoutMs: number }
interface TickResult { started: string[]; skipped: string[] }
interface Core {
    parseSchedule(sql: string): CronTask[];
    cronMatches(expr: string, date: Date): boolean;
    assertCronAllowed(env: Record<string, string | undefined>): unknown;
    createCronRunner(p: { tasks: CronTask[]; call: (task: CronTask) => Promise<unknown>; log: (line: string) => void }): { tick(date: Date): TickResult };
}

async function loadCore(): Promise<Core> {
    assert.ok(fs.existsSync(CORE_FILE), 'scripts/dev/cron-local.core.mjs absent : livré par fix(8.1s)');
    return (await import(CORE_PATH)) as Core;
}

const EXPECTED: CronTask[] = [
    { name: 'ev_notifications_dispatch', expr: '* * * * *', route: '/api/cron/notifications-dispatch', timeoutMs: 55000 },
    { name: 'ev_reminders', expr: '1-59/5 * * * *', route: '/api/cron/reminders', timeoutMs: 60000 },
    { name: 'ev_payments_reconcile', expr: '*/5 * * * *', route: '/api/cron/payments-reconcile', timeoutMs: 60000 },
    { name: 'ev_events_finish', expr: '3-59/15 * * * *', route: '/api/cron/events-finish', timeoutMs: 60000 },
    { name: 'ev_stock_reservations', expr: '7 * * * *', route: '/api/cron/stock-reservations', timeoutMs: 60000 },
    { name: 'ev_ticket_transfers', expr: '17 * * * *', route: '/api/cron/ticket-transfers', timeoutMs: 60000 },
    { name: 'ev_moratoriums', expr: '27 * * * *', route: '/api/cron/moratoriums', timeoutMs: 60000 },
    { name: 'ev_referral_commissions', expr: '37 * * * *', route: '/api/cron/referral-commissions', timeoutMs: 60000 },
];

const TUNNEL = 'https://mot-mot-mot-mot.trycloudflare.com';

function secret(): string {
    return randomBytes(24).toString('hex');
}

function allowed(over: Record<string, string | undefined> = {}): Record<string, string | undefined> {
    return { NODE_ENV: 'development', CRON_SECRET: secret(), NEXT_PUBLIC_APP_URL: 'http://localhost:3000', ...over };
}

describe('assertCronAllowed : refus', () => {
    const CASES: Array<[string, Record<string, string | undefined>, RegExp]> = [
        ['NODE_ENV=production', { NODE_ENV: 'production' }, /NODE_ENV/],
        ['NODE_ENV=test', { NODE_ENV: 'test' }, /NODE_ENV/],
        ['CRON_SECRET absent', { CRON_SECRET: undefined }, /CRON_SECRET/],
        ['CRON_SECRET vide', { CRON_SECRET: '' }, /CRON_SECRET/],
        ['URL absente', { NEXT_PUBLIC_APP_URL: undefined }, /NEXT_PUBLIC_APP_URL/],
        ['URL illisible', { NEXT_PUBLIC_APP_URL: 'pas-une-url' }, /NEXT_PUBLIC_APP_URL/],
        ['URL distante', { NEXT_PUBLIC_APP_URL: 'https://app.example.org' }, /NEXT_PUBLIC_APP_URL/],
        ['domaine de production', { NEXT_PUBLIC_APP_URL: 'https://eventvillage.sn' }, /NEXT_PUBLIC_APP_URL/],
        ['identifiant trompeur http://localhost@evil.com', { NEXT_PUBLIC_APP_URL: 'http://localhost@evil.com' }, /NEXT_PUBLIC_APP_URL/],
        ['hôte piégé http://localhost.evil.com', { NEXT_PUBLIC_APP_URL: 'http://localhost.evil.com' }, /NEXT_PUBLIC_APP_URL/],
        ['tunnel non déclaré', { NEXT_PUBLIC_APP_URL: TUNNEL }, /EV_DEV_TUNNEL_URL/],
        ['tunnel différent', { NEXT_PUBLIC_APP_URL: TUNNEL, EV_DEV_TUNNEL_URL: 'https://autre-adresse.trycloudflare.com' }, /EV_DEV_TUNNEL_URL/],
        ['tunnel en http', { NEXT_PUBLIC_APP_URL: 'http://mot-mot.trycloudflare.com', EV_DEV_TUNNEL_URL: 'http://mot-mot.trycloudflare.com' }, /https/],
        ['tunnel hors trycloudflare.com', { NEXT_PUBLIC_APP_URL: 'https://essai.example.org', EV_DEV_TUNNEL_URL: 'https://essai.example.org' }, /trycloudflare\.com/],
        ['domaine racine trycloudflare.com', { NEXT_PUBLIC_APP_URL: 'https://trycloudflare.com', EV_DEV_TUNNEL_URL: 'https://trycloudflare.com' }, /trycloudflare\.com/],
        ['tunnel piégé', { NEXT_PUBLIC_APP_URL: 'https://x.trycloudflare.com.evil.com', EV_DEV_TUNNEL_URL: 'https://x.trycloudflare.com.evil.com' }, /trycloudflare\.com/],
        ['tunnel à identifiant', { NEXT_PUBLIC_APP_URL: 'https://x.trycloudflare.com@evil.com', EV_DEV_TUNNEL_URL: 'https://x.trycloudflare.com@evil.com' }, /trycloudflare\.com/],
    ];

    for (const [label, over, message] of CASES) {
        test(`refus : ${label}`, async () => {
            const core = await loadCore();
            const env = allowed(over);
            assert.throws(() => core.assertCronAllowed(env), message, label);
        });
    }

    test('aucun refus ne cite la valeur de CRON_SECRET', async () => {
        const core = await loadCore();
        const value = secret();
        for (const [label, over] of CASES) {
            if ('CRON_SECRET' in over) continue;
            let message = '';
            try {
                core.assertCronAllowed(allowed({ ...over, CRON_SECRET: value }));
            } catch (err) {
                message = err instanceof Error ? err.message : String(err);
            }
            assert.ok(message, `${label} : refus attendu`);
            assert.ok(!message.includes(value), `${label} : le secret figure dans le message`);
        }
    });
});

describe('assertCronAllowed : accepté', () => {
    const CASES: Array<[string, Record<string, string | undefined>]> = [
        ['NODE_ENV absent', { NODE_ENV: undefined }],
        ['development sur localhost', {}],
        ['development sur 127.0.0.1', { NEXT_PUBLIC_APP_URL: 'http://127.0.0.1:3000' }],
        ['tunnel déclaré, https, trycloudflare.com', { NEXT_PUBLIC_APP_URL: TUNNEL, EV_DEV_TUNNEL_URL: TUNNEL }],
        ['tunnel déclaré avec une barre finale', { NEXT_PUBLIC_APP_URL: `${TUNNEL}/`, EV_DEV_TUNNEL_URL: TUNNEL }],
    ];
    for (const [label, over] of CASES) {
        test(`accepté : ${label}`, async () => {
            const core = await loadCore();
            assert.doesNotThrow(() => core.assertCronAllowed(allowed(over)), label);
        });
    }
});

describe('parseSchedule : schedule-crons.sql, source unique', () => {
    test('les 8 tâches HTTP exactes, purge SQL exclue', async () => {
        const core = await loadCore();
        const tasks = core.parseSchedule(fs.readFileSync(SCHEDULE_FILE, 'utf8'));
        assert.deepEqual(tasks, EXPECTED);
        assert.ok(!tasks.some((t) => t.name === 'ev_cron_history_purge'), 'la purge est du SQL local, pas une route');
    });

    test('chaque route existe sous app/api/cron', async () => {
        const core = await loadCore();
        for (const task of core.parseSchedule(fs.readFileSync(SCHEDULE_FILE, 'utf8'))) {
            const dir = path.join(CRON_ROUTES, task.route.replace('/api/cron/', ''));
            assert.ok(fs.existsSync(path.join(dir, 'route.ts')), `route absente : ${task.route}`);
        }
    });

    test('la liste vient du texte reçu : rien n’est recopié dans le script', async () => {
        const core = await loadCore();
        const sql = fs.readFileSync(SCHEDULE_FILE, 'utf8').replace("'17 * * * *'", "'19 * * * *'");
        const moved = core.parseSchedule(sql).find((t) => t.name === 'ev_ticket_transfers');
        assert.equal(moved?.expr, '19 * * * *', 'parseSchedule doit lire le SQL reçu');
    });

    test('un fichier sans tâche est refusé plutôt que de rendre une liste vide', async () => {
        const core = await loadCore();
        assert.throws(() => core.parseSchedule('SELECT 1;'), /schedule-crons|tâche/i);
    });
});

describe('cronMatches : minute en UTC', () => {
    const at = (minute: number): Date => new Date(Date.UTC(2026, 10, 6, 10, minute, 42));

    test('forme * : chaque minute', async () => {
        const core = await loadCore();
        for (const m of [0, 1, 37, 59]) assert.equal(core.cronMatches('* * * * *', at(m)), true, `minute ${m}`);
    });

    test('forme */n', async () => {
        const core = await loadCore();
        for (const m of [0, 5, 55]) assert.equal(core.cronMatches('*/5 * * * *', at(m)), true, `minute ${m}`);
        for (const m of [1, 4, 59]) assert.equal(core.cronMatches('*/5 * * * *', at(m)), false, `minute ${m}`);
    });

    test('forme a-b/n', async () => {
        const core = await loadCore();
        for (const m of [1, 6, 56]) assert.equal(core.cronMatches('1-59/5 * * * *', at(m)), true, `minute ${m}`);
        for (const m of [0, 5, 59]) assert.equal(core.cronMatches('1-59/5 * * * *', at(m)), false, `minute ${m}`);
        for (const m of [3, 18, 33, 48]) assert.equal(core.cronMatches('3-59/15 * * * *', at(m)), true, `minute ${m}`);
        for (const m of [0, 2, 4, 58]) assert.equal(core.cronMatches('3-59/15 * * * *', at(m)), false, `minute ${m}`);
    });

    test('forme valeur', async () => {
        const core = await loadCore();
        assert.equal(core.cronMatches('7 * * * *', at(7)), true);
        for (const m of [0, 6, 8, 17]) assert.equal(core.cronMatches('7 * * * *', at(m)), false, `minute ${m}`);
    });

    test('motif inconnu refusé, jamais ignoré', async () => {
        const core = await loadCore();
        for (const expr of ['1,2 * * * *', 'abc * * * *', '*/0 * * * *', '60 * * * *', '5-1/2 * * * *', '* *', '', '30 3 * * *', '0 0 1 * *', '* * * * 1']) {
            assert.throws(() => core.cronMatches(expr, at(0)), Error, `motif refusé : « ${expr} »`);
        }
    });

    test('la minute lue est celle d’UTC, quel que soit le fuseau du poste', async () => {
        const core = await loadCore();
        const previous = process.env.TZ;
        process.env.TZ = 'Asia/Kolkata'; // UTC+5:30 : la minute locale diffère de la minute UTC
        try {
            const date = new Date(Date.UTC(2026, 10, 6, 10, 7, 0));
            assert.equal(date.getMinutes(), 37, 'préalable : le fuseau change la minute locale');
            assert.equal(core.cronMatches('7 * * * *', date), true, 'minute UTC 7');
            assert.equal(core.cronMatches('37 * * * *', date), false, 'minute locale 37 ignorée');
        } finally {
            if (previous === undefined) delete process.env.TZ;
            else process.env.TZ = previous;
        }
    });
});

describe('createCronRunner : aucun recouvrement d’une même tâche', () => {
    const date = (minute: number): Date => new Date(Date.UTC(2026, 10, 6, 10, minute, 0));
    /** Laisse passer les microtâches : le lancement d'un appel peut être différé d'un tour. */
    const nextTurn = (): Promise<void> => new Promise((resolve) => { setImmediate(resolve); });

    function pendingCalls(): { calls: Map<string, Array<{ resolve: () => void; reject: (e: Error) => void }>>; call: (t: CronTask) => Promise<void> } {
        const calls = new Map<string, Array<{ resolve: () => void; reject: (e: Error) => void }>>();
        return {
            calls,
            call: (t) => new Promise<void>((resolve, reject) => {
                calls.set(t.name, [...(calls.get(t.name) ?? []), { resolve, reject }]);
            }),
        };
    }

    test('une tâche encore en cours est ignorée et journalisée, puis repart une fois terminée', async () => {
        const core = await loadCore();
        const { calls, call } = pendingCalls();
        const log: string[] = [];
        const runner = core.createCronRunner({ tasks: EXPECTED, call, log: (line) => log.push(line) });

        assert.deepEqual(runner.tick(date(0)), { started: ['ev_notifications_dispatch', 'ev_payments_reconcile'], skipped: [] });
        await nextTurn();
        const second = runner.tick(date(1));
        assert.deepEqual(second, { started: ['ev_reminders'], skipped: ['ev_notifications_dispatch'] });
        await nextTurn();
        assert.equal(calls.get('ev_notifications_dispatch')?.length, 1, 'un seul appel en cours');
        assert.ok(log.some((l) => l.includes('ev_notifications_dispatch') && /ignor/i.test(l)), `passage ignoré non journalisé : ${log.join(' | ')}`);

        calls.get('ev_notifications_dispatch')?.[0].resolve();
        await nextTurn();
        assert.deepEqual(runner.tick(date(2)), { started: ['ev_notifications_dispatch'], skipped: [] });
        await nextTurn();
        assert.equal(calls.get('ev_notifications_dispatch')?.length, 2, 'la tâche repart après la fin du premier appel');
    });

    test('un appel en échec libère la tâche : la boucle ne s’arrête pas', async () => {
        const core = await loadCore();
        const { calls, call } = pendingCalls();
        const runner = core.createCronRunner({ tasks: EXPECTED, call, log: () => undefined });
        runner.tick(date(2));
        await nextTurn();
        calls.get('ev_notifications_dispatch')?.[0].reject(new Error('connexion refusée'));
        await nextTurn();
        assert.deepEqual(runner.tick(date(4)), { started: ['ev_notifications_dispatch'], skipped: [] });
    });

    test('rien à lancer : aucun appel', async () => {
        const core = await loadCore();
        const { calls, call } = pendingCalls();
        const runner = core.createCronRunner({ tasks: EXPECTED.filter((t) => t.name === 'ev_moratoriums'), call, log: () => undefined });
        assert.deepEqual(runner.tick(date(26)), { started: [], skipped: [] });
        await nextTurn();
        assert.equal(calls.size, 0);
    });
});

// ── Entrée en processus fils ───────────────────────────────────────────────

interface Hit { method: string; url: string; authorization: string | undefined; host: string | undefined; body: string }

interface FakeApp {
    port: number;
    hits: Hit[];
    close(): Promise<void>;
}

/** Faux serveur d'application : écoute IPv4 et IPv6, car `localhost` peut se résoudre vers l'une ou l'autre. */
async function fakeApp(reply: { status: number; body: string } = { status: 200, body: '{"ok":true}' }): Promise<FakeApp> {
    const hits: Hit[] = [];
    const server = http.createServer((req, res) => {
        let body = '';
        req.setEncoding('utf8');
        req.on('data', (c) => { body += String(c); });
        req.on('end', () => {
            hits.push({ method: req.method ?? '', url: req.url ?? '', authorization: req.headers.authorization, host: req.headers.host, body });
            res.writeHead(reply.status, { 'content-type': 'application/json' });
            res.end(reply.body);
        });
    });
    await new Promise<void>((resolve) => { server.listen(0, resolve); });
    return {
        port: (server.address() as AddressInfo).port,
        hits,
        close: () => new Promise<void>((resolve) => { server.close(() => { resolve(); }); }),
    };
}

interface EntryResult { code: number | null; stdout: string; stderr: string }

const WORK_DIRS: string[] = [];

function workDir(envLocal: string): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ev-cron-local-'));
    WORK_DIRS.push(dir);
    fs.writeFileSync(path.join(dir, '.env.local'), envLocal);
    return dir;
}

after(() => {
    for (const dir of WORK_DIRS) fs.rmSync(dir, { recursive: true, force: true });
});

function runEntry(args: string[], cwd: string, env: Record<string, string> = {}): Promise<EntryResult> {
    assert.ok(fs.existsSync(ENTRY_FILE), 'scripts/dev/cron-local.mjs absent : livré par fix(8.1s)');
    const childEnv: Record<string, string> = { ...env };
    for (const key of ['PATH', 'Path', 'SystemRoot', 'TEMP', 'TMP']) if (process.env[key]) childEnv[key] = process.env[key] as string;
    return new Promise((resolve, reject) => {
        const child = spawn(process.execPath, [ENTRY_FILE, ...args], { cwd, env: childEnv as NodeJS.ProcessEnv, stdio: ['ignore', 'pipe', 'pipe'] });
        let stdout = '';
        let stderr = '';
        const timer = setTimeout(() => child.kill('SIGKILL'), 30_000);
        child.stdout.on('data', (c) => { stdout += String(c); });
        child.stderr.on('data', (c) => { stderr += String(c); });
        child.on('error', reject);
        child.on('close', (code) => {
            clearTimeout(timer);
            resolve({ code, stdout, stderr });
        });
    });
}

function envFile(lines: Record<string, string>): string {
    return Object.entries(lines).map(([k, v]) => `${k}=${v}`).join('\n');
}

function logOf(cwd: string): string {
    const file = path.join(cwd, '.logs', 'cron-local.log');
    assert.ok(fs.existsSync(file), `.logs/cron-local.log absent du dossier de travail`);
    return fs.readFileSync(file, 'utf8');
}

describe('scripts/dev/cron-local.mjs', () => {
    test('--once : un POST {} avec le secret de .env.local, journal sans le secret', async () => {
        const app = await fakeApp();
        const cron = secret();
        try {
            const cwd = workDir(envFile({ CRON_SECRET: cron, NEXT_PUBLIC_APP_URL: `http://localhost:${app.port}`, EV_DEV_APP_PORT: String(app.port) }));
            const r = await runEntry(['--once', 'ev_reminders'], cwd);
            assert.equal(r.code, 0, `sortie ${r.code}\n${r.stdout}\n${r.stderr}`);
            assert.equal(app.hits.length, 1, `un seul appel : ${JSON.stringify(app.hits.map((h) => h.url))}`);
            const hit = app.hits[0];
            assert.equal(hit.method, 'POST');
            assert.equal(hit.url, '/api/cron/reminders');
            assert.equal(hit.authorization, `Bearer ${cron}`);
            assert.equal(hit.body, '{}');
            const log = logOf(cwd);
            assert.match(log, /ev_reminders/);
            assert.match(log, /200/);
            for (const [name, text] of [['journal', log], ['stdout', r.stdout], ['stderr', r.stderr]]) {
                assert.ok(!text.includes(cron), `le secret figure dans ${name}`);
                assert.doesNotMatch(text, /Bearer/, `l'en-tête figure dans ${name}`);
            }
        } finally {
            await app.close();
        }
    });

    test('--once : le corps de la réponse est tronqué à 300 caractères au journal', async () => {
        const app = await fakeApp({ status: 200, body: 'x'.repeat(1000) });
        try {
            const cwd = workDir(envFile({ CRON_SECRET: secret(), NEXT_PUBLIC_APP_URL: `http://localhost:${app.port}`, EV_DEV_APP_PORT: String(app.port) }));
            const r = await runEntry(['--once', 'ev_reminders'], cwd);
            assert.equal(r.code, 0, `sortie ${r.code}\n${r.stderr}`);
            const log = logOf(cwd);
            assert.ok(log.includes('x'.repeat(300)), 'corps journalisé jusqu’à 300 caractères');
            assert.ok(!log.includes('x'.repeat(301)), 'corps tronqué à 300 caractères');
        } finally {
            await app.close();
        }
    });

    test('tunnel déclaré : l’appel reste local, le secret ne traverse jamais le tunnel (L21)', async () => {
        const app = await fakeApp();
        try {
            const cwd = workDir(envFile({ CRON_SECRET: secret(), NEXT_PUBLIC_APP_URL: TUNNEL, EV_DEV_TUNNEL_URL: TUNNEL, EV_DEV_APP_PORT: String(app.port) }));
            const r = await runEntry(['--once', 'ev_payments_reconcile'], cwd);
            assert.equal(r.code, 0, `sortie ${r.code}\n${r.stdout}\n${r.stderr}`);
            assert.equal(app.hits.length, 1, 'l’appel doit arriver à l’application locale');
            assert.equal(app.hits[0].url, '/api/cron/payments-reconcile');
            assert.equal(app.hits[0].host, `localhost:${app.port}`);
        } finally {
            await app.close();
        }
    });

    test('--list : les 8 tâches, aucun appel', async () => {
        const app = await fakeApp();
        try {
            const cwd = workDir(envFile({ CRON_SECRET: secret(), NEXT_PUBLIC_APP_URL: `http://localhost:${app.port}`, EV_DEV_APP_PORT: String(app.port) }));
            const r = await runEntry(['--list'], cwd);
            assert.equal(r.code, 0, `sortie ${r.code}\n${r.stderr}`);
            for (const task of EXPECTED) assert.ok(r.stdout.includes(task.name), `${task.name} absente de --list`);
            assert.ok(!r.stdout.includes('ev_cron_history_purge'), 'la purge SQL ne figure pas dans --list');
            assert.equal(app.hits.length, 0);
        } finally {
            await app.close();
        }
    });

    test('--once sur une tâche inconnue : refus, aucun appel', async () => {
        const app = await fakeApp();
        try {
            const cwd = workDir(envFile({ CRON_SECRET: secret(), NEXT_PUBLIC_APP_URL: `http://localhost:${app.port}`, EV_DEV_APP_PORT: String(app.port) }));
            const r = await runEntry(['--once', 'ev_cron_history_purge'], cwd);
            assert.notEqual(r.code, 0, 'refus attendu');
            assert.equal(app.hits.length, 0);
        } finally {
            await app.close();
        }
    });

    for (const [status, help] of [[401, /CRON_SECRET diffère du serveur/], [503, /CRON_SECRET absent/]] as const) {
        test(`HTTP ${status} : aide affichée`, async () => {
            const app = await fakeApp({ status, body: '{"error":"refus"}' });
            try {
                const cwd = workDir(envFile({ CRON_SECRET: secret(), NEXT_PUBLIC_APP_URL: `http://localhost:${app.port}`, EV_DEV_APP_PORT: String(app.port) }));
                const r = await runEntry(['--once', 'ev_reminders'], cwd);
                assert.match(`${r.stdout}${r.stderr}`, help, `${r.stdout}\n${r.stderr}`);
            } finally {
                await app.close();
            }
        });
    }

    test('connexion refusée : aide affichée', async () => {
        const app = await fakeApp();
        await app.close();
        const cwd = workDir(envFile({ CRON_SECRET: secret(), NEXT_PUBLIC_APP_URL: `http://localhost:${app.port}`, EV_DEV_APP_PORT: String(app.port) }));
        const r = await runEntry(['--once', 'ev_reminders'], cwd);
        assert.match(`${r.stdout}${r.stderr}`, /application non démarrée/, `${r.stdout}\n${r.stderr}`);
    });

    test('l’entrée applique les refus : production, URL distante et secret absent, aucun appel', async () => {
        const app = await fakeApp();
        try {
            const port = String(app.port);
            const cases: Array<[string, string, Record<string, string>, RegExp]> = [
                ['production', envFile({ CRON_SECRET: secret(), NEXT_PUBLIC_APP_URL: `http://localhost:${port}`, EV_DEV_APP_PORT: port }), { NODE_ENV: 'production' }, /NODE_ENV/],
                ['URL distante', envFile({ CRON_SECRET: secret(), NEXT_PUBLIC_APP_URL: 'https://eventvillage.sn', EV_DEV_APP_PORT: port }), {}, /NEXT_PUBLIC_APP_URL/],
                ['secret absent', envFile({ NEXT_PUBLIC_APP_URL: `http://localhost:${port}`, EV_DEV_APP_PORT: port }), {}, /CRON_SECRET/],
            ];
            for (const [label, content, env, message] of cases) {
                const r = await runEntry(['--once', 'ev_reminders'], workDir(content), env);
                assert.notEqual(r.code, 0, `${label} : refus attendu`);
                assert.match(`${r.stdout}${r.stderr}`, message, label);
                assert.equal(app.hits.length, 0, `${label} : aucun appel`);
            }
        } finally {
            await app.close();
        }
    });
});

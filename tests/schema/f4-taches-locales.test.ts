/**
 * Finition 4 (demande de l'utilisateur du 19/11) — déclencheur local des tâches planifiées pour la recette sur poste :
 * npm run taches (= scripts/dev/cron-local.mjs, déjà lancé par npm run cron:local).
 *
 *  1. npm run taches existe et lance le même script que cron:local ; les tâches viennent de schedule-crons.sql (mêmes
 *     routes que pg_cron, rien de recopié) ;
 *  2. assertLocalTarget : seule l'application locale (http://localhost, 127.0.0.1, [::1], sans identifiants) est admise ;
 *  3. drain() attend la fin des appels en cours ; inFlight() les nomme ;
 *  4. en processus fils (sans base, dossier de travail temporaire avec un .env.local fabriqué) : la liste des tâches est
 *     affichée en clair au démarrage, et SIGINT arrête proprement (bilan, code 0). Sous Windows, un processus fils ne
 *     reçoit pas SIGINT : ce cas ne tourne qu'en CI (Linux).
 */
import '../helpers/env';
import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = process.cwd();
const ENTRY_FILE = path.join(ROOT, 'scripts', 'dev', 'cron-local.mjs');
const CORE_FILE = path.join(ROOT, 'scripts', 'dev', 'cron-local.core.mjs');
const SCHEDULE_FILE = path.join(ROOT, 'supabase', 'ops', 'schedule-crons.sql');

interface Task { name: string; expr: string; route: string; timeoutMs: number }
interface Core {
    parseSchedule(sql: string): Task[];
    assertLocalTarget(origin: string): void;
    createCronRunner(o: { tasks: Task[]; call: (t: Task) => Promise<unknown>; log: (l: string) => void }): {
        tick(d: Date): { started: string[]; skipped: string[] };
        inFlight(): string[];
        drain(): Promise<void>;
    };
}

async function core(): Promise<Core> {
    return (await import(pathToFileURL(CORE_FILE).href)) as Core;
}

describe('npm run taches', () => {
    test('le script existe et lance le même déclencheur que cron:local', () => {
        const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')) as { scripts: Record<string, string> };
        assert.equal(pkg.scripts.taches, 'node scripts/dev/cron-local.mjs');
        assert.equal(pkg.scripts.taches, pkg.scripts['cron:local']);
    });

    test('mêmes routes que pg_cron : chaque tâche HTTP de schedule-crons.sql, rien de recopié', async () => {
        const c = await core();
        const sql = fs.readFileSync(SCHEDULE_FILE, 'utf8');
        const tasks = c.parseSchedule(sql);
        const routes = [...sql.matchAll(/'(\/api\/cron\/[a-z0-9-]+)'/g)].map((m) => m[1]);
        assert.deepEqual(tasks.map((t) => t.route), routes);
        const entry = fs.readFileSync(ENTRY_FILE, 'utf8');
        for (const t of tasks) assert.ok(!entry.includes(t.route), `${t.route} recopiée dans le script`);
    });
});

describe('assertLocalTarget : localhost seulement', () => {
    for (const ok of ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://[::1]:3000']) {
        test(`accepté : ${ok}`, async () => {
            (await core()).assertLocalTarget(ok);
        });
    }
    for (const bad of [
        'https://localhost:3000', 'http://localhost.evil.com', 'http://localhost@evil.com', 'http://user:pw@localhost:3000',
        'http://exemple.trycloudflare.com', 'https://app.eventvillage.sn', 'http://10.0.0.5:3000', 'pas une adresse',
    ]) {
        test(`refusé : ${bad}`, async () => {
            const c = await core();
            assert.throws(() => c.assertLocalTarget(bad), /adresse des appels refusée/);
        });
    }
});

describe('arrêt propre : appels en cours attendus', () => {
    test('drain() attend la fin des appels en cours ; inFlight() les nomme', async () => {
        const c = await core();
        let release: () => void = () => undefined;
        const gate = new Promise<void>((r) => { release = r; });
        const runner = c.createCronRunner({
            tasks: [{ name: 'ev_notifications_dispatch', expr: '* * * * *', route: '/api/cron/notifications-dispatch', timeoutMs: 1000 }],
            call: () => gate,
            log: () => undefined,
        });
        runner.tick(new Date('2026-11-19T10:00:00Z'));
        await Promise.resolve();
        assert.deepEqual(runner.inFlight(), ['ev_notifications_dispatch']);
        let drained = false;
        const d = runner.drain().then(() => { drained = true; });
        await new Promise((r) => setTimeout(r, 20));
        assert.equal(drained, false, 'drain() rendu avant la fin de l’appel en cours');
        release();
        await d;
        assert.equal(drained, true);
        assert.deepEqual(runner.inFlight(), []);
    });
});

const DIRS: string[] = [];
after(() => { for (const d of DIRS) fs.rmSync(d, { recursive: true, force: true }); });

describe('processus fils', () => {
    test('démarrage : tâches affichées en clair ; SIGINT : arrêt propre, bilan, code 0', { skip: process.platform === 'win32' ? 'SIGINT non transmis à un processus fils sous Windows' : false }, async () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ev-taches-'));
        DIRS.push(dir);
        const secret = randomBytes(24).toString('hex');
        fs.writeFileSync(path.join(dir, '.env.local'), `CRON_SECRET=${secret}\nNEXT_PUBLIC_APP_URL=http://localhost:3999\nEV_DEV_APP_PORT=3999\n`);
        const env: Record<string, string> = {};
        for (const key of ['PATH', 'Path', 'SystemRoot', 'TEMP', 'TMP']) if (process.env[key]) env[key] = process.env[key] as string;
        const child = spawn(process.execPath, [ENTRY_FILE], { cwd: dir, env: env as NodeJS.ProcessEnv, stdio: ['ignore', 'pipe', 'pipe'] });
        let out = '';
        child.stdout.on('data', (c) => { out += String(c); });
        child.stderr.on('data', (c) => { out += String(c); });
        const code = await new Promise<number | null>((resolve, reject) => {
            const kill = setTimeout(() => child.kill('SIGKILL'), 20_000);
            const wait = setInterval(() => {
                if (/Ctrl\+C pour arrêter/.test(out) && /POST \/api\/cron\/notifications-dispatch/.test(out)) {
                    clearInterval(wait);
                    child.kill('SIGINT');
                }
            }, 50);
            child.on('error', reject);
            child.on('close', (c) => { clearTimeout(kill); clearInterval(wait); resolve(c); });
        });
        assert.equal(code, 0, `sortie ${code}\n${out}`);
        assert.match(out, /appels vers http:\/\/localhost:3999/);
        assert.match(out, /arrêt demandé \(SIGINT\)/);
        assert.match(out, /arrêté proprement : 0 appels lancés/);
        assert.ok(!out.includes(secret), 'le secret apparaît dans la sortie');
    });
});

/**
 * Lot 6, tâche 6.9 — planification indépendante de l'hébergeur (contrat M1 à M4, décisions 55 et 56).
 * Mode opératoire de tests/schema/hotfix-scripts.test.ts : script du dépôt lu sur le disque, lignes
 * `BEGIN;` / `COMMIT;` retirées, exécution sur la base LOCALE dans une transaction TOUJOURS annulée
 * (inRolledBackTransaction) : aucune tâche pg_cron ne survit (sinon pg_net appellerait l'envoyeur pendant
 * les suites suivantes), aucune requête pg_net ne part (sa file n'est traitée qu'après validation).
 *  - sonde d'abord : pg_available_extensions (pg_cron, pg_net, supabase_vault), shared_preload_libraries,
 *    rôle et base ; pg_cron ou pg_net indisponible → échec explicite (point à remonter à l'utilisateur,
 *    aucun contournement) ;
 *  - supabase/ops/schedule-crons.sql et unschedule-crons.sql : présents, encadrés par BEGIN/COMMIT, hors
 *    des migrations ; aucun secret ni en-tête en clair ; aucune migration ne planifie de tâche ni ne crée
 *    pg_cron / pg_net (décision 55) ;
 *  - sans secrets Vault : le script échoue (« Secret Vault ev_app_url absent ») ;
 *  - avec les secrets (URL `http://app.invalid`, secret aléatoire de 32 octets) et deux tâches fabriquées
 *    (`ev_event_change_notifications`, ancienne ; `autre_tache`, étrangère) : script exécuté deux fois →
 *    exactement les 9 tâches `ev_%` (noms, expressions, actives, sans doublon), chaque commande vise son
 *    chemin et lit Vault, délai pg_net explicite, aucune commande ne contient le secret ni l'URL ;
 *    l'ancienne tâche a disparu, la tâche étrangère est intacte ; les chemins planifiés = les routes
 *    app/api/cron/* présentes sur le disque ;
 *  - la commande de l'envoyeur, exécutée dans la transaction, met en file pg_net l'URL complète, l'en-tête
 *    `Authorization: Bearer <secret de Vault>` et le délai de 55 s (étape sautée avec un message si la file
 *    de pg_net n'a pas ces colonnes) ;
 *  - unschedule-crons.sql deux fois → plus aucune tâche `ev_%`, la tâche étrangère intacte ;
 *  - après la suite, hors transaction : aucune tâche `ev_%` planifiée sur la base ;
 *  - docs/deploiement-projet-neuf.md (M4) : procédure Vault + scripts, 9 tâches, nouvelles routes et
 *    variables, plus d'exemple avec le secret en clair ni de route supprimée.
 *
 * Rouge avant correctif : supabase/ops/ n'existe pas ; les routes /api/cron/notifications-dispatch et
 * /api/cron/reminders n'existent pas et /api/cron/event-change-notifications existe encore ; la
 * documentation donne un exemple pg_cron avec `Bearer <CRON_SECRET>` en clair (:126).
 * Déjà vert (couverture ajoutée, garde-fou de la décision 55) : aucune migration ne planifie de tâche ni ne
 * crée pg_cron / pg_net.
 */
import '../helpers/env';
import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import type { Client } from 'pg';
import { inRolledBackTransaction, inspect } from '../helpers/db';
import { assertNotificationInvariants } from '../helpers/notification-invariants';

const ROOT = process.cwd();
const OPS_DIR = path.join(ROOT, 'supabase', 'ops');
const SCHEDULE_FILE = path.join(OPS_DIR, 'schedule-crons.sql');
const UNSCHEDULE_FILE = path.join(OPS_DIR, 'unschedule-crons.sql');
const MIGRATIONS_DIR = path.join(ROOT, 'supabase', 'migrations');
const CRON_ROUTES_DIR = path.join(ROOT, 'app', 'api', 'cron');
const DEPLOY_DOC = path.join(ROOT, 'docs', 'deploiement-projet-neuf.md');
const TEST_APP_URL = 'http://app.invalid';

interface ExpectedJob { jobname: string; schedule: string; path: string | null; timeoutMs: number | null }

/** Tâches attendues (contrat M1) : 8 routes et la purge de l'historique de pg_cron. */
const EXPECTED_JOBS: ExpectedJob[] = [
    { jobname: 'ev_notifications_dispatch', schedule: '* * * * *', path: '/api/cron/notifications-dispatch', timeoutMs: 55_000 },
    { jobname: 'ev_reminders', schedule: '1-59/5 * * * *', path: '/api/cron/reminders', timeoutMs: 60_000 },
    { jobname: 'ev_payments_reconcile', schedule: '*/5 * * * *', path: '/api/cron/payments-reconcile', timeoutMs: 60_000 },
    { jobname: 'ev_events_finish', schedule: '3-59/15 * * * *', path: '/api/cron/events-finish', timeoutMs: 60_000 },
    { jobname: 'ev_stock_reservations', schedule: '7 * * * *', path: '/api/cron/stock-reservations', timeoutMs: 60_000 },
    { jobname: 'ev_ticket_transfers', schedule: '17 * * * *', path: '/api/cron/ticket-transfers', timeoutMs: 60_000 },
    { jobname: 'ev_moratoriums', schedule: '27 * * * *', path: '/api/cron/moratoriums', timeoutMs: 60_000 },
    { jobname: 'ev_referral_commissions', schedule: '37 * * * *', path: '/api/cron/referral-commissions', timeoutMs: 60_000 },
    { jobname: 'ev_cron_history_purge', schedule: '30 3 * * *', path: null, timeoutMs: null },
];

interface CronJob { jobname: string; schedule: string; command: string; active: boolean }

after(async () => {
    // Garde-fou : rien ne reste planifié sur la base partagée (la transaction du test est annulée).
    const left = await inspect(async (db) => {
        const reg = await db.query<{ t: string | null }>(`SELECT to_regclass('cron.job')::text AS t`);
        if (!reg.rows[0]?.t) return [] as string[];
        const r = await db.query<{ jobname: string }>(`SELECT jobname FROM cron.job WHERE jobname LIKE 'ev\\_%' ESCAPE '\\' ORDER BY jobname`);
        return r.rows.map((x) => x.jobname);
    });
    console.log(`[planification-crons] tâches ev_% planifiées après la suite : ${left.length}`);
    assert.deepEqual(left, [], `tâches pg_cron restées planifiées sur la base locale : ${left.join(', ')}`);
    await assertNotificationInvariants('planification-crons');
});

// ── Outils locaux ──────────────────────────────────────────────────────────

interface Probe {
    extensions: Array<{ name: string; default_version: string | null; installed_version: string | null }>;
    preload: string;
    role: string;
    database: string;
}

async function probe(db: Client): Promise<Probe> {
    const ext = await db.query<{ name: string; default_version: string | null; installed_version: string | null }>(
        `SELECT name, default_version, installed_version FROM pg_available_extensions
          WHERE name IN ('pg_cron', 'pg_net', 'supabase_vault') ORDER BY name`);
    const preload = await db.query<{ shared_preload_libraries: string }>('SHOW shared_preload_libraries');
    const who = await db.query<{ role: string; database: string }>('SELECT current_user AS role, current_database() AS database');
    return {
        extensions: ext.rows,
        preload: preload.rows[0]?.shared_preload_libraries ?? '',
        role: who.rows[0]?.role ?? '',
        database: who.rows[0]?.database ?? '',
    };
}

/** Échec explicite si pg_cron ou pg_net manquent (contrat M3.1 : point à remonter, aucun contournement). */
function assertProbe(p: Probe): void {
    console.log(`[planification-crons] sonde : ${JSON.stringify(p)}`);
    const available = new Set(p.extensions.map((e) => e.name));
    const missing = ['pg_cron', 'pg_net'].filter((n) => !available.has(n));
    assert.deepEqual(missing, [],
        `extensions indisponibles sur la base locale : ${missing.join(', ')} — la planification (supabase/ops/schedule-crons.sql) ` +
        'ne peut pas être testée : point à remonter à l’utilisateur (image Postgres de Supabase), aucun contournement');
    const preload = p.preload.split(',').map((s) => s.trim());
    assert.ok(preload.includes('pg_cron'),
        `pg_cron n’est pas dans shared_preload_libraries (« ${p.preload} ») : CREATE EXTENSION pg_cron échouerait — point à remonter à l’utilisateur`);
    assert.ok(available.has('supabase_vault'), 'supabase_vault indisponible : les secrets ev_app_url et ev_cron_secret ne peuvent pas être lus');
}

/** Corps d'un script encadré par `BEGIN;` … `COMMIT;` (lignes seules), comme hotfix-scripts.test.ts. */
function innerScript(file: string): string {
    assert.ok(fs.existsSync(file), `${path.relative(ROOT, file)} absent (contrat M1/M2 : script d'exploitation, pas une migration)`);
    const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
    const begin = lines.findIndex((l) => /^\s*BEGIN\s*;\s*$/i.test(l));
    const commit = lines.map((l) => /^\s*COMMIT\s*;\s*$/i.test(l)).lastIndexOf(true);
    assert.ok(begin >= 0 && commit > begin, `${path.relative(ROOT, file)} doit être encadré par BEGIN; … COMMIT;`);
    return lines.slice(begin + 1, commit).join('\n');
}

function cronRoutePaths(): string[] {
    return fs.readdirSync(CRON_ROUTES_DIR, { withFileTypes: true })
        .filter((d) => d.isDirectory() && fs.existsSync(path.join(CRON_ROUTES_DIR, d.name, 'route.ts')))
        .map((d) => `/api/cron/${d.name}`)
        .sort();
}

async function cronJobs(db: Client): Promise<CronJob[]> {
    const r = await db.query<CronJob>('SELECT jobname, schedule, command, active FROM cron.job ORDER BY jobname, jobid');
    return r.rows;
}

function evJobs(jobs: CronJob[]): CronJob[] {
    return jobs.filter((j) => j.jobname.startsWith('ev_'));
}

// ── Sonde (M3.1) ───────────────────────────────────────────────────────────

describe('6.9 Planification par pg_cron et pg_net (contrat M)', () => {
    test('sonde : pg_cron et pg_net disponibles, pg_cron préchargé, Vault disponible (échec explicite sinon)', async () => {
        const p = await inspect((db) => probe(db));
        assertProbe(p);
    });

    test('scripts d’exploitation : présents, encadrés, hors des migrations, sans secret ni en-tête en clair ; aucune migration ne planifie', () => {
        const schedule = innerScript(SCHEDULE_FILE);
        const unschedule = innerScript(UNSCHEDULE_FILE);
        assert.match(schedule, /cron\.schedule\s*\(/, 'schedule-crons.sql planifie par cron.schedule');
        assert.match(schedule, /net\.http_post\s*\(/, 'schedule-crons.sql appelle les routes par net.http_post');
        assert.match(schedule, /vault\.decrypted_secrets/, 'URL et secret lus dans Vault');
        assert.doesNotMatch(schedule, /'Bearer [^']/, 'aucun jeton écrit après « Bearer » : il est lu dans Vault');
        assert.doesNotMatch(schedule, /\b[0-9a-f]{32,}\b/i, 'aucune valeur secrète (chaîne hexadécimale) dans le script');
        assert.doesNotMatch(schedule, /vault\.create_secret\s*\(/, 'le script ne crée pas les secrets (opérateur, contrat M1)');
        assert.match(unschedule, /cron\.unschedule\s*\(/, 'unschedule-crons.sql retire les tâches par cron.unschedule');
        assert.doesNotMatch(unschedule, /vault\.|DROP\s+EXTENSION/i, 'le script d’arrêt laisse les secrets et les extensions (M2)');

        const offenders: string[] = [];
        for (const f of fs.readdirSync(MIGRATIONS_DIR).filter((n) => n.endsWith('.sql')).sort()) {
            const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, f), 'utf8').replace(/--[^\n]*/g, '');
            if (/cron\.schedule\s*\(/i.test(sql)) offenders.push(`${f} : cron.schedule`);
            if (/CREATE\s+EXTENSION[^;]*\b(pg_cron|pg_net)\b/i.test(sql)) offenders.push(`${f} : CREATE EXTENSION pg_cron/pg_net`);
        }
        assert.deepEqual(offenders, [], `une migration planifie ou crée pg_cron / pg_net (décision 55) : ${offenders.join(' ; ')}`);
    });

    test('schedule-crons.sql : refus sans secrets ; deux exécutions → exactement les 9 tâches, sans secret en clair ; unschedule-crons.sql deux fois → aucune', async () => {
        const schedule = innerScript(SCHEDULE_FILE);
        const unschedule = innerScript(UNSCHEDULE_FILE);
        const secret = randomBytes(32).toString('hex');
        const routes = cronRoutePaths();

        const result = await inRolledBackTransaction(async (db) => {
            // 1. Sonde, dans la transaction même.
            assertProbe(await probe(db));
            const existing = await db.query<{ name: string }>(
                `SELECT name FROM vault.decrypted_secrets WHERE name IN ('ev_app_url', 'ev_cron_secret')`);
            assert.deepEqual(existing.rows, [], `la base locale contient déjà des secrets Vault ev_* (${JSON.stringify(existing.rows)}) : base de test neuve attendue`);

            // 2. Sans les secrets : exception attendue.
            await db.query('SAVEPOINT sans_secrets');
            let refusal: string | null = null;
            try {
                await db.query(schedule);
            } catch (err) {
                refusal = (err as Error).message;
            }
            await db.query('ROLLBACK TO SAVEPOINT sans_secrets');
            assert.ok(refusal, 'sans secret Vault, le script doit échouer');
            assert.match(refusal, /Secret Vault ev_app_url absent/, `message du refus : ${refusal}`);

            // 3. Secrets de test (opérateur simulé).
            await db.query(`SELECT vault.create_secret($1, 'ev_app_url')`, [TEST_APP_URL]);
            await db.query(`SELECT vault.create_secret($1, 'ev_cron_secret')`, [secret]);

            // 4. Tâches fabriquées : ancienne tâche du lot 5 et tâche étrangère.
            await db.query('CREATE EXTENSION IF NOT EXISTS pg_cron');
            await db.query(`SELECT cron.schedule('ev_event_change_notifications', '*/5 * * * *', 'SELECT 1')`);
            await db.query(`SELECT cron.schedule('autre_tache', '0 4 * * *', 'SELECT 42')`);
            const foreignBefore = (await cronJobs(db)).find((j) => j.jobname === 'autre_tache');
            assert.ok(foreignBefore, 'tâche étrangère fabriquée');

            // 5. Deux exécutions (idempotence).
            await db.query(schedule);
            await db.query(schedule);
            const afterSchedule = await cronJobs(db);

            // 7. Commande de l'envoyeur exécutée : requête mise en file par pg_net (jamais envoyée : ROLLBACK).
            const queueCols = await db.query<{ column_name: string }>(
                `SELECT column_name FROM information_schema.columns WHERE table_schema = 'net' AND table_name = 'http_request_queue'`);
            const cols = new Set(queueCols.rows.map((c) => c.column_name));
            let queued: Record<string, unknown> | null = null;
            const dispatchJob = afterSchedule.find((j) => j.jobname === 'ev_notifications_dispatch');
            if (dispatchJob && ['url', 'headers', 'timeout_milliseconds', 'method'].every((c) => cols.has(c))) {
                const before = await db.query<{ m: string | null }>('SELECT max(id)::text AS m FROM net.http_request_queue');
                await db.query(dispatchJob.command);
                const q = await db.query(
                    `SELECT method, url, headers, timeout_milliseconds FROM net.http_request_queue
                      WHERE ($1::bigint IS NULL OR id > $1::bigint) ORDER BY id`, [before.rows[0]?.m ?? null]);
                queued = { rows: q.rows };
            } else {
                console.log(`[planification-crons] étape 7 sautée : net.http_request_queue sans les colonnes attendues (${Array.from(cols).join(', ') || 'table absente'})`);
            }

            // 8. Script d'arrêt, deux fois.
            await db.query(unschedule);
            await db.query(unschedule);
            const afterUnschedule = await cronJobs(db);
            return { foreignBefore, afterSchedule, afterUnschedule, queued };
        });

        // 6. Exactement les tâches attendues.
        const jobs = evJobs(result.afterSchedule);
        console.log(`[planification-crons] tâches après deux exécutions : ${JSON.stringify(jobs.map((j) => [j.jobname, j.schedule, j.active]))}`);
        const names = jobs.map((j) => j.jobname);
        assert.deepEqual([...names].sort(), EXPECTED_JOBS.map((e) => e.jobname).sort(), 'exactement les 9 tâches ev_% attendues, sans doublon');
        assert.equal(new Set(names).size, names.length, `aucun doublon : ${names.join(', ')}`);
        for (const e of EXPECTED_JOBS) {
            const j = jobs.find((x) => x.jobname === e.jobname)!;
            assert.equal(j.schedule, e.schedule, `${e.jobname} : expression « ${e.schedule} »`);
            assert.equal(j.active, true, `${e.jobname} : active`);
            assert.ok(!j.command.includes(secret), `${e.jobname} : le secret n’apparaît pas dans la commande`);
            assert.ok(!j.command.includes(TEST_APP_URL) && !j.command.includes('app.invalid'), `${e.jobname} : l’URL de l’application n’apparaît pas dans la commande`);
            if (e.path) {
                assert.ok(j.command.includes(`'${e.path}'`), `${e.jobname} : chemin ${e.path} dans la commande (${j.command})`);
                assert.match(j.command, /net\.http_post\s*\(/, `${e.jobname} : appel par net.http_post`);
                assert.match(j.command, /vault\.decrypted_secrets/, `${e.jobname} : URL et secret lus dans Vault à chaque exécution`);
                assert.match(j.command, /'ev_app_url'/, `${e.jobname} : secret ev_app_url`);
                assert.match(j.command, /'ev_cron_secret'/, `${e.jobname} : secret ev_cron_secret`);
                assert.match(j.command, /'Bearer '\s*\|\|/, `${e.jobname} : en-tête Authorization construit depuis Vault`);
                assert.match(j.command, new RegExp(`timeout_milliseconds\\s*:=\\s*${e.timeoutMs}\\b`), `${e.jobname} : délai pg_net de ${e.timeoutMs} ms`);
            } else {
                assert.match(j.command, /DELETE\s+FROM\s+cron\.job_run_details/i, `${e.jobname} : purge de l’historique de pg_cron`);
                assert.match(j.command, /7 days/, `${e.jobname} : historique gardé 7 jours`);
            }
        }
        assert.ok(!result.afterSchedule.some((j) => j.jobname === 'ev_event_change_notifications'), 'ancienne tâche ev_event_change_notifications retirée');
        const foreign = result.afterSchedule.filter((j) => j.jobname === 'autre_tache');
        assert.deepEqual(foreign, [result.foreignBefore], 'tâche étrangère intacte (nom, expression, commande, état)');

        const plannedPaths = EXPECTED_JOBS.filter((e) => e.path).map((e) => e.path!).sort();
        assert.deepEqual(plannedPaths, routes, `chemins planifiés = routes app/api/cron/* du disque (aucune tâche vers une route absente, aucune route sans tâche) — disque : ${routes.join(', ')}`);

        if (result.queued) {
            const rows = result.queued.rows as Array<{ method: string; url: string; headers: Record<string, string>; timeout_milliseconds: number }>;
            assert.equal(rows.length, 1, `une requête pg_net mise en file par la commande de l’envoyeur : ${JSON.stringify(rows)}`);
            assert.equal(rows[0].method, 'POST', 'méthode POST');
            assert.equal(rows[0].url, `${TEST_APP_URL}/api/cron/notifications-dispatch`, 'URL complète lue dans Vault');
            assert.equal(rows[0].headers.Authorization, `Bearer ${secret}`, 'en-tête Authorization = Bearer <secret de Vault>');
            assert.equal(Number(rows[0].timeout_milliseconds), 55_000, 'délai de 55 s (l’envoyeur travaille 45 s au plus)');
        }

        assert.deepEqual(evJobs(result.afterUnschedule), [], 'unschedule-crons.sql : plus aucune tâche ev_%');
        assert.deepEqual(result.afterUnschedule.filter((j) => j.jobname === 'autre_tache'), [result.foreignBefore], 'unschedule-crons.sql : tâche étrangère intacte');
    });

    test('docs/deploiement-projet-neuf.md : procédure Vault et scripts, 9 tâches, nouvelles routes et variables, plus de secret en clair (M4)', () => {
        const doc = fs.readFileSync(DEPLOY_DOC, 'utf8');
        for (const needle of [
            'supabase/ops/schedule-crons.sql', 'supabase/ops/unschedule-crons.sql', 'vault.create_secret', 'ev_app_url', 'ev_cron_secret',
            'cron.job_run_details', '/api/cron/notifications-dispatch', '/api/cron/reminders',
            'VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'VAPID_SUBJECT', 'MTARGET_TIMEOUT_MS',
            ...EXPECTED_JOBS.map((e) => e.jobname),
        ]) {
            assert.ok(doc.includes(needle), `la documentation de déploiement cite « ${needle} »`);
        }
        assert.ok(!doc.includes("'Bearer <CRON_SECRET>'"), 'plus d’exemple pg_cron avec le secret en clair dans la commande');
        assert.doesNotMatch(doc, /net\.http_(get|post)\(\s*url\s*:=\s*'https?:\/\//, 'plus d’URL écrite en clair dans une commande pg_net');
        assert.ok(!doc.includes('/api/cron/event-change-notifications'), 'la route supprimée n’est plus documentée');
    });
});

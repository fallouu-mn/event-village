#!/usr/bin/env node
/**
 * Lot 8 (8.1, contrat 5.2) — npm run cron:local : appelle les routes /api/cron/* aux fréquences de
 * supabase/ops/schedule-crons.sql, en développement seulement.
 * Finition 4 : aussi lancé par npm run taches (recette sur poste). Chaque appel est annoncé en clair (« lancé : … »),
 * l'adresse appelée est contrôlée (localhost seulement, assertLocalTarget), et Ctrl+C arrête proprement : plus aucun
 * nouvel appel, attente de la fin des appels en cours, bilan, code 0 ; un second Ctrl+C force l'arrêt (code 130).
 * schedule-crons.sql (pg_cron) reste la planification de la préproduction et de la production.
 *
 *   npm run taches  (ou npm run cron:local)  boucle calée sur la minute
 *   node scripts/dev/cron-local.mjs --list           liste des tâches, aucun appel
 *   node scripts/dev/cron-local.mjs --once <tâche>   un seul appel, puis fin (code 1 si l'appel échoue)
 *   Sous PowerShell 5.1, npm run cron:local -- --list perd le « -- » : passer par node directement.
 *
 * Les appels partent toujours vers http://localhost:<EV_DEV_APP_PORT> : CRON_SECRET ne traverse jamais le
 * tunnel, même déclaré (L21). Journal : console et .logs/cron-local.log, jamais l'en-tête.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertCronAllowed, assertLocalTarget, createCronRunner, parseSchedule } from './cron-local.core.mjs';
import { loadLocalEnv, portOf } from './env-local.mjs';

const TAG = 'cron-local';
const SCHEDULE_FILE = fileURLToPath(new URL('../../supabase/ops/schedule-crons.sql', import.meta.url));
const BODY_LOG_LIMIT = 300;
const MINUTE_MS = 60_000;
/** Marge après le changement de minute : un minuteur en avance relirait la minute précédente. */
const TICK_MARGIN_MS = 50;

function parseArgs(argv) {
    if (argv.length === 0) return { mode: 'loop' };
    if (argv.length === 1 && argv[0] === '--list') return { mode: 'list' };
    if (argv.length === 2 && argv[0] === '--once') return { mode: 'once', task: argv[1] };
    throw new Error('Options admises : --list, ou --once <tâche>.');
}

function openLog(cwd) {
    const dir = path.join(cwd, '.logs');
    fs.mkdirSync(dir, { recursive: true });
    const file = path.join(dir, 'cron-local.log');
    return (line) => {
        const stamped = `${new Date().toISOString()} ${line}`;
        console.log(`[${TAG}] ${stamped}`);
        fs.appendFileSync(file, `${stamped}\n`);
    };
}

const HELP_BY_STATUS = new Map([
    [401, 'CRON_SECRET diffère du serveur : redémarrez l\'application après avoir changé .env.local.'],
    [503, 'CRON_SECRET absent du serveur : ajoutez-le à .env.local, puis redémarrez l\'application.'],
]);

function connectionCode(err) {
    const cause = err instanceof Error ? err.cause : undefined;
    return cause?.code ?? cause?.errors?.[0]?.code ?? null;
}

/** Un appel, journalisé. Rend vrai si la route a répondu 2xx ; ne lève jamais : la boucle continue. */
async function callTask(task, { origin, secret, log, stats }) {
    const started = Date.now();
    if (stats) stats.launched += 1;
    log(`lancé : ${task.name} → POST ${origin}${task.route}`);
    try {
        const res = await fetch(`${origin}${task.route}`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' },
            body: '{}',
            signal: AbortSignal.timeout(task.timeoutMs),
        });
        const body = (await res.text()).replaceAll(secret, '***').replace(/\s+/g, ' ').slice(0, BODY_LOG_LIMIT);
        log(`${task.name} HTTP ${res.status} ${Date.now() - started} ms ${body}`);
        const help = HELP_BY_STATUS.get(res.status);
        if (help) log(`${task.name} aide : ${help}`);
        if (stats) stats[res.ok ? 'ok' : 'failed'] += 1;
        return res.ok;
    } catch (err) {
        const elapsed = `${Date.now() - started} ms`;
        if (err instanceof Error && err.name === 'TimeoutError') {
            log(`${task.name} délai de ${task.timeoutMs} ms dépassé (${elapsed})`);
        } else if (connectionCode(err) === 'ECONNREFUSED') {
            log(`${task.name} connexion refusée (${elapsed}) ; aide : application non démarrée, lancez npm run dev`);
        } else {
            log(`${task.name} appel impossible (${elapsed}) : ${connectionCode(err) ?? (err instanceof Error ? err.message : String(err))}`);
        }
        if (stats) stats.failed += 1;
        return false;
    }
}

function runLoop(tasks, target) {
    const stats = { launched: 0, ok: 0, failed: 0 };
    const runner = createCronRunner({ tasks, call: (task) => callTask(task, { ...target, stats }), log: target.log });
    let lastMinute = Math.floor(Date.now() / MINUTE_MS);
    let timer = null;
    let stopping = false;
    const arm = () => {
        timer = setTimeout(() => {
            if (stopping) return;
            const minute = Math.floor(Date.now() / MINUTE_MS);
            if (minute !== lastMinute) {
                lastMinute = minute;
                runner.tick(new Date());
            }
            arm();
        }, MINUTE_MS - (Date.now() % MINUTE_MS) + TICK_MARGIN_MS);
    };
    // Finition 4 : arrêt propre au premier Ctrl+C (ou SIGTERM), forcé au second
    const stop = (signal) => {
        if (stopping) {
            target.log(`arrêt forcé (${signal}) : ${runner.inFlight().join(', ') || 'aucun appel'} interrompu`);
            process.exit(130);
        }
        stopping = true;
        if (timer) clearTimeout(timer);
        const inFlight = runner.inFlight();
        target.log(inFlight.length > 0
            ? `arrêt demandé (${signal}) : plus aucun nouvel appel ; attente de la fin de ${inFlight.join(', ')} (Ctrl+C de nouveau pour forcer)`
            : `arrêt demandé (${signal}) : aucun appel en cours`);
        runner.drain().then(() => {
            target.log(`arrêté proprement : ${stats.launched} appels lancés, ${stats.ok} réussis, ${stats.failed} en échec`);
            process.exitCode = 0;
        });
    };
    process.on('SIGINT', () => stop('SIGINT'));
    process.on('SIGTERM', () => stop('SIGTERM'));
    target.log(`${tasks.length} tâches, appels vers ${target.origin} ; Ctrl+C pour arrêter`);
    for (const task of tasks) target.log(`  ${task.name}  ${task.expr}  POST ${task.route}`);
    arm();
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    const cwd = process.cwd();
    loadLocalEnv({ cwd });
    assertCronAllowed(process.env);
    const tasks = parseSchedule(fs.readFileSync(SCHEDULE_FILE, 'utf8'));

    if (args.mode === 'list') {
        for (const task of tasks) console.log(`${task.name}  ${task.expr}  ${task.route}`);
        return 0;
    }
    const target = {
        origin: `http://localhost:${portOf(process.env, 'EV_DEV_APP_PORT', 3000)}`,
        secret: process.env.CRON_SECRET,
        log: openLog(cwd),
    };
    // Finition 4 : jamais d'appel hors de l'application locale
    assertLocalTarget(target.origin);
    if (args.mode === 'once') {
        const task = tasks.find((t) => t.name === args.task);
        if (!task) throw new Error(`Tâche inconnue : ${args.task}. Liste : node scripts/dev/cron-local.mjs --list`);
        return (await callTask(task, target)) ? 0 : 1;
    }
    runLoop(tasks, target);
    return null;
}

main().then(
    (code) => { if (code !== null) process.exitCode = code; },
    (err) => {
        console.error(`[${TAG}] refus : ${err instanceof Error ? err.message : String(err)}`);
        process.exitCode = 1;
    },
);

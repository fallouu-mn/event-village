#!/usr/bin/env node
/**
 * Lot 8 (8.1, contrat 5.2) — npm run cron:local : appelle les routes /api/cron/* aux fréquences de
 * supabase/ops/schedule-crons.sql, en développement seulement.
 *
 *   npm run cron:local                     boucle calée sur la minute
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
import { assertCronAllowed, createCronRunner, parseSchedule } from './cron-local.core.mjs';
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
async function callTask(task, { origin, secret, log }) {
    const started = Date.now();
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
        return false;
    }
}

function runLoop(tasks, target) {
    const runner = createCronRunner({ tasks, call: (task) => callTask(task, target), log: target.log });
    let lastMinute = Math.floor(Date.now() / MINUTE_MS);
    const arm = () => {
        setTimeout(() => {
            const minute = Math.floor(Date.now() / MINUTE_MS);
            if (minute !== lastMinute) {
                lastMinute = minute;
                runner.tick(new Date());
            }
            arm();
        }, MINUTE_MS - (Date.now() % MINUTE_MS) + TICK_MARGIN_MS);
    };
    target.log(`${tasks.length} tâches, appels vers ${target.origin} ; Ctrl+C pour arrêter`);
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

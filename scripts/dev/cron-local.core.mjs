/**
 * Lot 8 (8.1, L21, L25) — règles pures de npm run cron:local, testées sans réseau par
 * tests/schema/essai-cron-local.test.ts. Aucune entrée-sortie ici.
 *
 * supabase/ops/schedule-crons.sql reste la source unique des tâches : rien n'est recopié.
 */

const TASK_LINE = /\(\s*'(ev_[a-z0-9_]+)'\s*,\s*'([^']+)'\s*,\s*'(\/api\/cron\/[a-z0-9-]+)'\s*,\s*(\d+)\s*\)/g;

/**
 * Tâches HTTP du fichier de planification, dans son ordre. La purge SQL n'a pas de route : elle n'y figure pas.
 * @param {string} sql
 * @returns {{ name: string, expr: string, route: string, timeoutMs: number }[]}
 */
export function parseSchedule(sql) {
    const tasks = Array.from(sql.matchAll(TASK_LINE), (m) => ({ name: m[1], expr: m[2], route: m[3], timeoutMs: Number(m[4]) }));
    if (tasks.length === 0) throw new Error('schedule-crons.sql : aucune tâche lue, format inattendu.');
    return tasks;
}

function integer(text) {
    return /^\d{1,2}$/.test(text) ? Number(text) : null;
}

/** Prédicat du champ minute. Formes admises : `*`, `*\/n`, `a-b/n`, valeur. Tout le reste est refusé, jamais ignoré. */
function minuteMatcher(field, expr) {
    const refuse = () => new Error(`Motif cron non pris en charge : « ${expr} ».`);
    if (field === '*') return () => true;
    const every = /^\*\/(\d+)$/.exec(field);
    if (every) {
        const step = integer(every[1]);
        if (step === null || step < 1 || step > 59) throw refuse();
        return (minute) => minute % step === 0;
    }
    const range = /^(\d+)-(\d+)\/(\d+)$/.exec(field);
    if (range) {
        const [from, to, step] = [integer(range[1]), integer(range[2]), integer(range[3])];
        if (from === null || to === null || step === null || from > to || to > 59 || step < 1) throw refuse();
        return (minute) => minute >= from && minute <= to && (minute - from) % step === 0;
    }
    const value = integer(field);
    if (value === null || value > 59) throw refuse();
    return (minute) => minute === value;
}

/** Vrai si la tâche tombe à cette minute, lue en UTC. Heure, jour, mois et jour de semaine doivent valoir `*`. */
export function cronMatches(expr, date) {
    const fields = expr.trim().split(/\s+/);
    if (fields.length !== 5 || fields.slice(1).some((f) => f !== '*')) {
        throw new Error(`Motif cron non pris en charge : « ${expr} ».`);
    }
    return minuteMatcher(fields[0], expr)(date.getUTCMinutes());
}

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);
const TUNNEL_SUFFIX = '.trycloudflare.com';

function parseUrl(value) {
    return value && URL.canParse(value) ? new URL(value) : null;
}

function hasCredentials(url) {
    return url.username !== '' || url.password !== '';
}

/**
 * Refus de lancer les tâches : mauvais NODE_ENV, secret absent, URL ni locale ni tunnel déclaré. Le contrôle
 * passe par `new URL().hostname` : `http://localhost@evil.com` et `localhost.evil.com` sont refusés. Le tunnel
 * sert à cette seule garde : les appels partent toujours vers l'application locale (L21).
 * @param {Record<string, string | undefined>} env
 */
export function assertCronAllowed(env) {
    if (env.NODE_ENV && env.NODE_ENV !== 'development') {
        throw new Error(`NODE_ENV=${env.NODE_ENV} : cron:local ne tourne qu'en développement.`);
    }
    if (!env.CRON_SECRET) throw new Error('CRON_SECRET absent de .env.local.');

    const app = parseUrl(env.NEXT_PUBLIC_APP_URL);
    if (!app) throw new Error('NEXT_PUBLIC_APP_URL absente ou illisible.');
    if (LOCAL_HOSTS.has(app.hostname) && !hasCredentials(app)) return;

    if (!env.EV_DEV_TUNNEL_URL) {
        throw new Error('NEXT_PUBLIC_APP_URL n\'est pas locale et aucun tunnel n\'est déclaré par EV_DEV_TUNNEL_URL : refus.');
    }
    const tunnel = parseUrl(env.EV_DEV_TUNNEL_URL);
    if (!tunnel) throw new Error('EV_DEV_TUNNEL_URL illisible.');
    if (tunnel.protocol !== 'https:') throw new Error('EV_DEV_TUNNEL_URL doit être en https.');
    if (hasCredentials(tunnel) || !tunnel.hostname.endsWith(TUNNEL_SUFFIX) || tunnel.hostname === TUNNEL_SUFFIX.slice(1)) {
        throw new Error('EV_DEV_TUNNEL_URL doit être une adresse <nom>.trycloudflare.com.');
    }
    if (hasCredentials(app) || app.origin !== tunnel.origin) {
        throw new Error('NEXT_PUBLIC_APP_URL diffère du tunnel déclaré par EV_DEV_TUNNEL_URL : refus.');
    }
}

/**
 * Boucle pilotable : `tick(date)` lance les tâches dues et ignore celles encore en cours (aucun recouvrement).
 * Un appel en échec libère sa tâche : la boucle ne s'arrête pas.
 * @param {{
 *   tasks: { name: string, expr: string, route: string, timeoutMs: number }[],
 *   call: (task: object) => Promise<unknown>,
 *   log: (line: string) => void,
 * }} options
 * @returns {{ tick: (date: Date) => { started: string[], skipped: string[] } }}
 */
export function createCronRunner({ tasks, call, log }) {
    const running = new Set();
    return {
        tick(date) {
            const started = [];
            const skipped = [];
            for (const task of tasks) {
                if (!cronMatches(task.expr, date)) continue;
                if (running.has(task.name)) {
                    skipped.push(task.name);
                    log(`${task.name} : passage ignoré, l'appel précédent est encore en cours`);
                    continue;
                }
                running.add(task.name);
                started.push(task.name);
                Promise.resolve()
                    .then(() => call(task))
                    .catch((err) => log(`${task.name} : échec de l'appel (${err instanceof Error ? err.message : String(err)})`))
                    .finally(() => running.delete(task.name));
            }
            return { started, skipped };
        },
    };
}

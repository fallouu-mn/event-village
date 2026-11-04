/**
 * Connexion directe à la base Postgres LOCALE, réservée aux tests de catalogue
 * (tests/schema) : RLS activée sur chaque table, privilèges EXECUTE des fonctions,
 * privilèges par défaut. Ces informations ne sont pas exposées par l'API REST.
 *
 * Garanties :
 *  - SUPABASE_DB_URL doit pointer sur localhost / 127.0.0.1 (vérifié par tests/helpers/env.ts
 *    au démarrage, revérifié ici) ;
 *  - `inspect` exécute les requêtes dans une transaction READ ONLY, éventuellement sous
 *    `SET LOCAL ROLE anon | authenticated` pour observer exactement les droits de ces rôles ;
 *  - `inRolledBackTransaction` permet un DDL d'essai qui est TOUJOURS annulé (ROLLBACK).
 *  - Lot 7 : `openConcurrentClient` ouvre une connexion locale vérifiée, en transaction, que le test
 *    valide (`commit`) ou annule (`rollback`) explicitement ; elle sert aux courses déterministes (deux
 *    transactions tenues en même temps) et aux insertions en masse. `waitForLockWaiters` attend que des
 *    connexions soient bloquées sur un verrou (pg_stat_activity.wait_event_type = 'Lock').
 */
import './env';
import assert from 'node:assert/strict';
import { Client, type QueryResult, type QueryResultRow } from 'pg';

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]']);

export type ApiRole = 'anon' | 'authenticated';

function localDbUrl(): string {
    const url = process.env.SUPABASE_DB_URL;
    if (!url) {
        throw new Error('SUPABASE_DB_URL absent de .env.test (URL Postgres de l\'instance locale, voir .env.test.example).');
    }
    const host = new URL(url).hostname;
    if (!LOCAL_HOSTS.has(host)) {
        throw new Error(`SUPABASE_DB_URL ne pointe pas sur une base locale (hôte : ${host}).`);
    }
    return url;
}

async function withClient<T>(fn: (client: Client) => Promise<T>): Promise<T> {
    const client = new Client({ connectionString: localDbUrl() });
    await client.connect();
    try {
        return await fn(client);
    } finally {
        await client.end();
    }
}

/** Exécute des requêtes de lecture dans une transaction READ ONLY, éventuellement sous un rôle API. */
export async function inspect<T>(fn: (client: Client) => Promise<T>, role?: ApiRole): Promise<T> {
    return withClient(async (client) => {
        await client.query('BEGIN TRANSACTION READ ONLY');
        try {
            if (role) await client.query(`SET LOCAL ROLE ${role}`);
            return await fn(client);
        } finally {
            await client.query('ROLLBACK');
        }
    });
}

/** Exécute un essai (DDL compris) dans une transaction systématiquement annulée. */
export async function inRolledBackTransaction<T>(fn: (client: Client) => Promise<T>): Promise<T> {
    return withClient(async (client) => {
        await client.query('BEGIN');
        try {
            return await fn(client);
        } finally {
            await client.query('ROLLBACK');
        }
    });
}

// ── Lot 7 : transactions concurrentes (courses déterministes) ──────────────

/** Connexion locale tenue en transaction, validée ou annulée explicitement par le test. */
export interface ConcurrentClient {
    /** pid du processus serveur (pg_backend_pid()), pour waitForLockWaiters et pg_stat_activity. */
    readonly pid: number;
    /** Vrai tant que la transaction n'a été ni validée ni annulée. */
    readonly open: boolean;
    /** Requête dans la transaction ouverte (échec explicite si elle est close). */
    query<R extends QueryResultRow = QueryResultRow>(sql: string, params?: unknown[]): Promise<QueryResult<R>>;
    /** COMMIT puis fermeture de la connexion. */
    commit(): Promise<void>;
    /** ROLLBACK puis fermeture de la connexion. */
    rollback(): Promise<void>;
    /** ROLLBACK si la transaction est encore ouverte, puis fermeture (idempotent ; pour un finally). */
    close(): Promise<void>;
}

export interface ConcurrentClientOptions {
    /** `SET LOCAL lock_timeout` en millisecondes (défaut : aucun, l'attente dure jusqu'au COMMIT de l'autre). */
    lockTimeoutMs?: number;
    /** `SET LOCAL statement_timeout` en millisecondes (défaut : 60 000, garde-fou contre un blocage infini). */
    statementTimeoutMs?: number;
    /** Nom visible dans pg_stat_activity.application_name (défaut : 'ev-test-concurrent'). */
    applicationName?: string;
}

/**
 * Ouvre une connexion à la base LOCALE (hôte vérifié par localDbUrl), puis `BEGIN`. Le test choisit
 * l'issue : `commit()` (écritures conservées, comme une RPC appelée par l'API) ou `rollback()`. Toujours
 * appeler `close()` dans un `finally` : une transaction oubliée est annulée et la connexion fermée.
 */
export async function openConcurrentClient(opts: ConcurrentClientOptions = {}): Promise<ConcurrentClient> {
    const client = new Client({ connectionString: localDbUrl(), application_name: opts.applicationName ?? 'ev-test-concurrent' });
    await client.connect();
    let open = false;
    let ended = false;
    const end = async (): Promise<void> => {
        if (ended) return;
        ended = true;
        await client.end();
    };
    try {
        await client.query('BEGIN');
        open = true;
        await client.query(`SET LOCAL statement_timeout = ${Math.trunc(opts.statementTimeoutMs ?? 60_000)}`);
        if (opts.lockTimeoutMs !== undefined) await client.query(`SET LOCAL lock_timeout = ${Math.trunc(opts.lockTimeoutMs)}`);
    } catch (err) {
        await end();
        throw err;
    }
    const { rows } = await client.query<{ pid: number }>('SELECT pg_backend_pid() AS pid');
    const pid = Number(rows[0].pid);
    const finish = async (sql: 'COMMIT' | 'ROLLBACK'): Promise<void> => {
        assert.ok(open, `connexion concurrente ${pid} : transaction déjà close, ${sql} impossible`);
        open = false;
        try {
            await client.query(sql);
        } finally {
            await end();
        }
    };
    return {
        pid,
        get open() { return open; },
        async query<R extends QueryResultRow = QueryResultRow>(sql: string, params?: unknown[]): Promise<QueryResult<R>> {
            assert.ok(open, `connexion concurrente ${pid} : transaction close, requête refusée (${sql.slice(0, 80)})`);
            return client.query<R>(sql, params);
        },
        commit: () => finish('COMMIT'),
        rollback: () => finish('ROLLBACK'),
        async close(): Promise<void> {
            if (open) {
                open = false;
                try {
                    await client.query('ROLLBACK');
                } finally {
                    await end();
                }
                return;
            }
            await end();
        },
    };
}

/** Connexion en attente de verrou, telle que lue dans pg_stat_activity. */
export interface LockWaiter {
    pid: number;
    wait_event_type: string;
    wait_event: string | null;
    state: string | null;
    query: string;
}

/** Sélection des connexions attendues : liste de pid, ou texte de requête (connexions de PostgREST, pid inconnu). */
export type LockWaiterSelector = number[] | { queryLike: string; count?: number };

/**
 * Attend (sondage toutes les 25 ms, au plus `timeoutMs`) que les connexions choisies soient bloquées sur
 * un verrou (`wait_event_type = 'Lock'`) : tous les pid de la liste, ou au moins `count` (défaut 1)
 * connexions dont la requête contient `queryLike` (ILIKE, motif entouré de %). Renvoie ces connexions.
 * Délai dépassé : échec explicite avec l'état observé de chaque connexion visée.
 */
export async function waitForLockWaiters(selector: LockWaiterSelector, timeoutMs = 10_000): Promise<LockWaiter[]> {
    const byPid = Array.isArray(selector);
    if (byPid) assert.ok(selector.length > 0, 'waitForLockWaiters : au moins un pid attendu');
    const wanted = byPid ? selector.length : Math.max(1, selector.count ?? 1);
    const client = new Client({ connectionString: localDbUrl(), application_name: 'ev-test-lock-watch' });
    await client.connect();
    try {
        const deadline = Date.now() + timeoutMs;
        let last: LockWaiter[] = [];
        for (;;) {
            const res = byPid
                ? await client.query<LockWaiter>(
                    `SELECT pid, COALESCE(wait_event_type, '') AS wait_event_type, wait_event, state, left(query, 300) AS query
                       FROM pg_stat_activity WHERE pid = ANY($1::int[]) ORDER BY pid`, [selector])
                : await client.query<LockWaiter>(
                    `SELECT pid, COALESCE(wait_event_type, '') AS wait_event_type, wait_event, state, left(query, 300) AS query
                       FROM pg_stat_activity
                      WHERE datname = current_database() AND pid <> pg_backend_pid() AND query ILIKE $1
                      ORDER BY pid`, [`%${selector.queryLike}%`]);
            last = res.rows.map((r) => ({ ...r, pid: Number(r.pid) }));
            const waiting = last.filter((r) => r.wait_event_type === 'Lock');
            if (byPid ? waiting.length === wanted : waiting.length >= wanted) return waiting;
            if (Date.now() >= deadline) {
                const what = byPid ? `pid ${selector.join(', ')}` : `${wanted} connexion(s) « ${selector.queryLike} »`;
                const seen = last.map((r) => `pid ${r.pid} : ${r.wait_event_type || 'aucune attente'}${r.wait_event ? `/${r.wait_event}` : ''} (${r.state ?? '?'}) ${r.query}`);
                assert.fail(`waitForLockWaiters : ${what} non bloquée(s) sur un verrou après ${timeoutMs} ms ; état observé :\n${seen.join('\n') || '(aucune connexion trouvée)'}`);
            }
            await new Promise((resolve) => setTimeout(resolve, 25));
        }
    } finally {
        await client.end();
    }
}

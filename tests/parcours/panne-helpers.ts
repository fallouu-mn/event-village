/**
 * Lot 9, tâche 9.3 (A26, A32, A34) — pannes simulées de PostgREST et d'Auth, patron de messages-bruts.test.ts:75-107.
 * Le client serveur passe par noStoreFetch, qui lit le fetch global à chaque requête : `during` remplace fetch pour la
 * seule cible, répond 500 avec le corps de PostgREST portant la sentinelle, et compte ses passages. Une panne jamais
 * atteinte fait échouer le test. console.error et console.warn sont capturés : une panne doit se lire au journal.
 *
 * Ce module n'enregistre aucun test (node:test) : les suites l'importent sans se dédoubler.
 */
import '../helpers/env';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

export const SENTINEL = 'SENTINELLE_SECRETE';
export const CODE_RE = /^[A-Z][A-Z0-9]*(_[A-Z0-9]+)+$/;

function postgresTextRe(): RegExp {
    const rel = 'tests/parcours/dette-interface-lot7.test.ts';
    const m = /^export const POSTGRES_TEXT_RE = \/(.+)\/([a-z]*);$/m.exec(fs.readFileSync(path.join(process.cwd(), rel), 'utf8'));
    assert.ok(m, `${rel} : export de POSTGRES_TEXT_RE introuvable (T15)`);
    return new RegExp(m[1], m[2]);
}

export const POSTGRES_TEXT_RE = postgresTextRe();

export interface Reply {
    status: number;
    body: Record<string, unknown>;
    text: string;
}

export async function reply(res: Response): Promise<Reply> {
    const text = await res.text();
    let body: Record<string, unknown> = {};
    if (text) {
        try {
            body = JSON.parse(text) as Record<string, unknown>;
        } catch (err) {
            assert.fail(`réponse non JSON (${res.status}) : ${text.slice(0, 200)} (${err instanceof Error ? err.message : String(err)})`);
        }
    }
    return { status: res.status, body, text };
}

export type Target = (url: URL, method: string) => boolean;

/** GET sur `/rest/v1/<name>`, éventuellement filtré sur la valeur du paramètre select. */
export const table = (name: string, select?: (value: string) => boolean): Target => (url, method) =>
    method === 'GET' && url.pathname === `/rest/v1/${name}` && (!select || select(url.searchParams.get('select') ?? ''));

/** GET sur `/rest/v1/<name>` filtré par `<column>=eq.<value>` : vise une lecture de la route, pas celle de la session. */
export const tableWhere = (name: string, column: string, value: string): Target => (url, method) =>
    method === 'GET' && url.pathname === `/rest/v1/${name}` && url.searchParams.get(column) === `eq.${value}`;

export interface Outage<T> {
    result: T;
    hits: number;
    logged: string[];
}

/** Exécute `fn` pendant la panne de `target` ; journal capturé, panne atteinte exigée. */
export async function during<T>(target: Target, fn: () => Promise<T>): Promise<Outage<T>> {
    const previousFetch = globalThis.fetch;
    const previousError = console.error;
    const previousWarn = console.warn;
    const logged: string[] = [];
    let hits = 0;
    globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
        const href = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
        const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
        if (!target(new URL(href), method)) return previousFetch(input, init);
        hits++;
        return new Response(JSON.stringify({ message: `relation "x" ${SENTINEL}`, code: '42P01', details: SENTINEL, hint: SENTINEL }), {
            status: 500,
            headers: { 'content-type': 'application/json' },
        });
    }) as typeof fetch;
    const capture = (...args: unknown[]): void => {
        logged.push(args.map((a) => (a instanceof Error ? a.message : String(a))).join(' '));
    };
    console.error = capture;
    console.warn = capture;
    try {
        const result = await fn();
        assert.ok(hits >= 1, 'la panne simulée n\'a pas été atteinte : le test ne prouverait rien');
        return { result, hits, logged };
    } finally {
        globalThis.fetch = previousFetch;
        console.error = previousError;
        console.warn = previousWarn;
    }
}

/** Réponse d'échec propre : ni texte de base ni SQLSTATE, message et code applicatif, jamais success: true. */
export function assertClean(r: Reply, what: string): void {
    assert.ok(!r.text.includes(SENTINEL), `${what} : texte de la base renvoyé au navigateur : ${r.text.slice(0, 300)}`);
    assert.doesNotMatch(r.text, POSTGRES_TEXT_RE, `${what} : texte de Postgres ou de PostgREST dans la réponse : ${r.text.slice(0, 300)}`);
    assert.equal(typeof r.body.error, 'string', `${what} : message d'erreur absent : ${r.text.slice(0, 300)}`);
    assert.equal(typeof r.body.code, 'string', `${what} : code stable absent : ${r.text.slice(0, 300)}`);
    assert.match(String(r.body.code), CODE_RE, `${what} : code « ${String(r.body.code)} » : code applicatif attendu, jamais un SQLSTATE`);
    assert.notEqual(r.body.success, true, `${what} : success: true sur une panne`);
}

/** Contexte de route lisible sous les deux formes en usage (`await params` et `params.id`). */
export function routeCtx<T extends Record<string, string>>(params: T): { params: Promise<T> & T } {
    return { params: Object.assign(Promise.resolve(params), params) };
}

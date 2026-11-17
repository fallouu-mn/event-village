/**
 * Contre-vérification de la finition 2b et du lot « déconnexion sans réseau », attaques 5 et 6 — aides communes, SANS base :
 * aucun import d'aide qui ouvre une connexion (la suite 5 reste sans base).
 *  - lecture des sources (fins de ligne LF, commentaires retirés, texte équilibré) ;
 *  - navigateur simulé dans Node : faux localStorage / sessionStorage (partagés entre « onglets » comme dans un vrai
 *    navigateur), fenêtre (EventTarget : online, storage, ev:offline-lots-changed), faux IndexedDB en mémoire (le strict
 *    nécessaire de l'API utilisée par lib/tickets/offline-store.ts et offline-lots.ts : ouverture, magasins, index,
 *    transactions qui se valident quand plus aucune requête n'est en cours), aucune dépendance nouvelle ;
 *  - deux « onglets » du même navigateur : deux clients @supabase/ssr sur le même pot de cookies, en mode navigateur
 *    (window et document définis le temps de la construction) pour que auth-js ouvre son BroadcastChannel ; le
 *    BroadcastChannel de Node délivre les messages entre instances du même processus, comme entre onglets.
 * Limites (dites aux rapports) : pas de React (les écouteurs d'AuthProvider sont lus dans le code), pas de vrai service
 * worker (public/sw.js est exécuté dans node:vm par la suite 6), pas de rollback d'une transaction annulée dans le faux
 * IndexedDB (aucun test n'en dépend), pas d'exclusion mutuelle entre transactions (les tests ordonnent eux-mêmes).
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createBrowserClient } from '@supabase/ssr';
import type { Session } from '@supabase/supabase-js';

export const ROOT = process.cwd();

/** Fichier lu en fins de ligne LF (copie de travail Windows en CRLF, CI en LF). */
export const read = (file: string): string => fs.readFileSync(path.join(ROOT, file), 'utf8').replace(/\r\n/g, '\n');

/** Source sans commentaires (même règle que tests/parcours/f2b-brouillon-local.test.ts). */
export function stripComments(src: string): string {
    return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '$1');
}

/** Texte équilibré `(` … `)` ou `{` … `}` qui commence à l'indice `open` (délimiteur ouvrant). */
export function balanced(src: string, open: number, pair: '()' | '{}'): string {
    const [o, c] = pair.split('');
    assert.equal(src[open], o, `balanced : délimiteur ouvrant « ${o} » attendu à l'indice ${open}`);
    let depth = 0;
    for (let i = open; i < src.length; i++) {
        if (src[i] === o) depth++;
        else if (src[i] === c) {
            depth--;
            if (depth === 0) return src.slice(open, i + 1);
        }
    }
    return assert.fail('balanced : délimiteurs non équilibrés');
}

/** Tous les fichiers .ts/.tsx/.js sous les dossiers donnés (node_modules et .next exclus). */
export function sourceFiles(dirs: string[]): string[] {
    const out: string[] = [];
    const walk = (rel: string) => {
        const abs = path.join(ROOT, rel);
        if (!fs.existsSync(abs)) return;
        for (const e of fs.readdirSync(abs, { withFileTypes: true })) {
            if (e.name === 'node_modules' || e.name === '.next') continue;
            const r = `${rel}/${e.name}`;
            if (e.isDirectory()) walk(r);
            else if (/\.(?:ts|tsx|js|mjs)$/.test(e.name)) out.push(r);
        }
    };
    for (const d of dirs) walk(d);
    return out.sort();
}

/**
 * Écouteur onAuthStateChange d'AuthProvider (texte sans commentaires) et ses branches : SIGNED_OUT, SIGNED_IN d'un autre
 * compte. Rend aussi le corps de signOut.
 */
export function authProviderParts(): { listener: string; signedOut: string; signedInOther: string | null; signOut: string; full: string } {
    const full = stripComments(read('components/providers/AuthProvider.tsx'));
    const at = full.search(/onAuthStateChange\(/);
    assert.ok(at >= 0, 'AuthProvider : écouteur onAuthStateChange introuvable');
    const listener = balanced(full, full.indexOf('(', at), '()');
    const so = listener.search(/if \(event === 'SIGNED_OUT'\) \{/);
    assert.ok(so >= 0, 'AuthProvider : branche SIGNED_OUT introuvable');
    const signedOut = balanced(listener, listener.indexOf('{', so), '{}');
    const si = listener.search(/else if \(event === 'SIGNED_IN'[^{]*\{/);
    const signedInOther = si >= 0 ? listener.slice(si, si + listener.slice(si).indexOf('{')) + balanced(listener, listener.indexOf('{', si), '{}') : null;
    const s = full.search(/const signOut = async \((?:scope\?: 'partout')?\) => \{/);
    assert.ok(s >= 0, 'AuthProvider : signOut introuvable');
    const signOut = balanced(full, full.indexOf('{', full.indexOf('=>', s)), '{}');
    return { listener, signedOut, signedInOther, signOut, full };
}

// ── Stockage web simulé ─────────────────────────────────────────────────────────────────────────────────────────────
export class FakeStorage {
    map = new Map<string, string>();
    get length(): number { return this.map.size; }
    key(i: number): string | null { return [...this.map.keys()][i] ?? null; }
    getItem(k: string): string | null { return this.map.get(k) ?? null; }
    setItem(k: string, v: string): void { this.map.set(k, String(v)); }
    removeItem(k: string): void { this.map.delete(k); }
    clear(): void { this.map.clear(); }
    keys(): string[] { return [...this.map.keys()].sort(); }
}

export interface FakeWindow extends EventTarget {
    localStorage: FakeStorage;
    sessionStorage: FakeStorage;
    location: URL;
}

const g = globalThis as unknown as Record<string, unknown>;

/** Fenêtre simulée (globalThis.window) : stockages et événements. `document` n'est PAS défini (auth-js reste en mode serveur). */
export function installWindow(localStorage = new FakeStorage()): FakeWindow {
    const w = new EventTarget() as FakeWindow;
    w.localStorage = localStorage;
    w.sessionStorage = new FakeStorage();
    w.location = new URL('http://127.0.0.1:3000/');
    g.window = w;
    return w;
}

export function uninstallWindow(): void {
    delete g.window;
    delete g.document;
}

// ── Faux IndexedDB en mémoire ──────────────────────────────────────────────────────────────────────────────────────
type Row = Record<string, unknown>;
interface StoreData { keyPath: string; indexes: Map<string, string>; rows: Map<string, Row> }

interface FakeRequest<T = unknown> {
    result: T | undefined;
    error: unknown;
    onsuccess: ((ev: unknown) => void) | null;
    onerror: ((ev: unknown) => void) | null;
}

class FakeTx {
    pending = 0;
    activity = 0;
    done = false;
    error: unknown = null;
    oncomplete: ((ev: unknown) => void) | null = null;
    onabort: ((ev: unknown) => void) | null = null;
    constructor(readonly stores: Map<string, StoreData>, readonly scope: string[], readonly mode: string) {
        this.check();
    }
    private check(): void {
        const seen = this.activity;
        setTimeout(() => {
            if (!this.done && this.pending === 0 && this.activity === seen) {
                this.done = true;
                this.oncomplete?.({});
            }
        }, 0);
    }
    request<T>(fn: () => T): FakeRequest<T> {
        if (this.done) throw new Error('TransactionInactiveError : transaction terminée');
        const r: FakeRequest<T> = { result: undefined, error: null, onsuccess: null, onerror: null };
        this.pending++;
        this.activity++;
        setTimeout(() => {
            this.pending--;
            if (this.done) {
                r.error = new Error('AbortError');
                r.onerror?.({});
                return;
            }
            try {
                r.result = fn();
                r.onsuccess?.({});
            } catch (err) {
                r.error = err;
                r.onerror?.({});
                this.abort(err);
                return;
            }
            this.check();
        }, 0);
        return r;
    }
    abort(err?: unknown): void {
        if (this.done) throw new Error('InvalidStateError : transaction déjà terminée');
        this.done = true;
        this.error = err ?? new Error('AbortError');
        setTimeout(() => this.onabort?.({}), 0);
    }
    objectStore(name: string) {
        if (!this.scope.includes(name)) throw new Error(`NotFoundError : magasin ${name} hors de la transaction`);
        const data = this.stores.get(name)!;
        const tx = this;
        const writable = () => { if (tx.mode !== 'readwrite') throw new Error('ReadOnlyError'); };
        const sorted = (rows: Row[], by: string) => rows.sort((a, b) => String(a[by]).localeCompare(String(b[by]), 'en', { numeric: true }));
        return {
            get: (key: string) => tx.request(() => (data.rows.has(key) ? structuredClone(data.rows.get(key)) : undefined)),
            getAll: () => tx.request(() => sorted([...data.rows.values()].map((r) => structuredClone(r)), data.keyPath)),
            put: (value: Row) => tx.request(() => { writable(); const k = String(value[data.keyPath]); data.rows.set(k, structuredClone(value)); return k; }),
            delete: (key: string) => tx.request(() => { writable(); data.rows.delete(key); return undefined; }),
            clear: () => tx.request(() => { writable(); data.rows.clear(); return undefined; }),
            index: (iname: string) => {
                const kp = data.indexes.get(iname);
                if (!kp) throw new Error(`NotFoundError : index ${iname}`);
                return {
                    getAll: (query?: unknown) => tx.request(() => {
                        const all = [...data.rows.values()].filter((r) => query === undefined || r[kp] === query).map((r) => structuredClone(r));
                        return all.sort((a, b) => (Number(a[kp]) - Number(b[kp])) || String(a[kp]).localeCompare(String(b[kp])));
                    }),
                };
            },
        };
    }
}

class FakeDb {
    onversionchange: ((ev: unknown) => void) | null = null;
    readonly objectStoreNames: { contains: (n: string) => boolean };
    constructor(readonly stores: Map<string, StoreData>) {
        this.objectStoreNames = { contains: (n: string) => stores.has(n) };
    }
    createObjectStore(name: string, opts: { keyPath: string }) {
        const data: StoreData = { keyPath: opts.keyPath, indexes: new Map(), rows: new Map() };
        this.stores.set(name, data);
        return { createIndex: (iname: string, keyPath: string) => { data.indexes.set(iname, keyPath); } };
    }
    transaction(names: string | string[], mode: string = 'readonly'): FakeTx {
        const scope = Array.isArray(names) ? names : [names];
        for (const n of scope) if (!this.stores.has(n)) throw new Error(`NotFoundError : magasin ${n}`);
        return new FakeTx(this.stores, scope, mode);
    }
    close(): void {}
}

export class FakeIndexedDB {
    readonly dbs = new Map<string, Map<string, StoreData>>();
    readonly opened: string[] = [];
    open(name: string, _version?: number) {
        this.opened.push(name);
        const req: FakeRequest<FakeDb> & { onupgradeneeded: ((ev: unknown) => void) | null; onblocked: ((ev: unknown) => void) | null } = {
            result: undefined, error: null, onsuccess: null, onerror: null, onupgradeneeded: null, onblocked: null,
        };
        setTimeout(() => {
            const fresh = !this.dbs.has(name);
            if (fresh) this.dbs.set(name, new Map());
            const db = new FakeDb(this.dbs.get(name)!);
            req.result = db;
            if (fresh) req.onupgradeneeded?.({});
            req.onsuccess?.({});
        }, 0);
        return req;
    }
    /** Tous les enregistrements d'un magasin (preuve brute). */
    rows(db: string, store: string): Row[] {
        return [...(this.dbs.get(db)?.get(store)?.rows.values() ?? [])].map((r) => structuredClone(r));
    }
}

/** Installe le faux IndexedDB (une seule fois par processus : offline-store garde sa base ouverte en mémoire). */
export function installIndexedDB(): FakeIndexedDB {
    if (!(g.indexedDB instanceof FakeIndexedDB)) g.indexedDB = new FakeIndexedDB();
    return g.indexedDB as FakeIndexedDB;
}

// ── Lots hors ligne fabriqués (forme du contrat 3.1) ───────────────────────────────────────────────────────────────
export function lotResponse(ticketId: string, now = Date.now()): Row {
    const iso = (ms: number) => new Date(now + ms).toISOString();
    const digits = 6;
    const count = 4;
    return {
        ticket_id: ticketId,
        secret_version: 1,
        prefix: 'EVT1',
        step_seconds: 30,
        digits,
        first_counter: Math.floor(now / 30_000),
        count,
        codes: '123456654321111111222222',
        first_step_at: iso(0),
        last_step_at: iso(count * 30_000),
        valid_until: iso(6 * 3_600_000),
        expires_at: iso(6 * 3_600_000),
        scan_opens_at: iso(-3_600_000),
        scan_closes_at: iso(6 * 3_600_000),
        complete: true,
        next_from: null,
        refresh_after: null,
        server_time: iso(0),
        ticket: { ticket_number: 'EV-CVF2B-0001', category: 'Standard', event_title: 'Soirée CVF2B', event_start_at: iso(3_600_000), location: 'Dakar', city: 'Dakar' },
    };
}

export function storedLot(ticketId: string): Row {
    return { ...lotResponse(ticketId), offsetMs: 0, downloadedAtDevice: Date.now(), downloadedAtServer: Date.now() };
}

// ── Deux onglets du même navigateur (auth-js en mode navigateur, BroadcastChannel) ────────────────────────────────
export interface Tab {
    client: ReturnType<typeof createBrowserClient>;
    events: string[];
}

export function cookieJarOptions(jar: Map<string, string>) {
    return {
        getAll: () => Array.from(jar, ([name, value]) => ({ name, value })),
        setAll: (cookies: Array<{ name: string; value: string }>) => {
            for (const c of cookies) {
                if (c.value) jar.set(c.name, c.value);
                else jar.delete(c.name);
            }
        },
    };
}

export const sessionCookieNames = (jar: Map<string, string>): string[] => [...jar.keys()].filter((k) => /^sb-.+-auth-token/.test(k));

/**
 * Ouvre `n` onglets sur le même pot de cookies. window et document sont définis pendant la construction (auth-js ouvre
 * alors son BroadcastChannel et lit window.location) ; rafraîchissement automatique et lecture de l'adresse coupés (aucun
 * minuteur, aucun appel réseau). `close` ferme les canaux (sinon Node ne s'arrête pas) et retire les globales.
 */
export function openTabs(n: number, jar: Map<string, string>): { tabs: Tab[]; close: () => void } {
    const hadWindow = 'window' in g;
    if (!hadWindow) installWindow();
    const hadDocument = 'document' in g;
    if (!hadDocument) g.document = { cookie: '', visibilityState: 'hidden' };
    const tabs: Tab[] = [];
    for (let i = 0; i < n; i++) {
        const client = createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
            isSingleton: false,
            cookies: cookieJarOptions(jar),
            auth: { autoRefreshToken: false, detectSessionInUrl: false },
        });
        const events: string[] = [];
        client.auth.onAuthStateChange((event) => { events.push(event); });
        tabs.push({ client, events });
    }
    const close = () => {
        for (const t of tabs) {
            const bc = (t.client.auth as unknown as { broadcastChannel?: { close(): void } | null }).broadcastChannel;
            try { bc?.close(); } catch { /* déjà fermé */ }
        }
        if (!hadDocument) delete g.document;
        if (!hadWindow) delete g.window;
    };
    return { tabs, close };
}

/** Session fabriquée (aucun appel réseau) : jeton à une heure de l'échéance. */
export function fakeSession(userId: string): Session {
    const now = Math.floor(Date.now() / 1000);
    return {
        access_token: `cvf2b.${Buffer.from(JSON.stringify({ sub: userId, exp: now + 3600 })).toString('base64url')}.signature`,
        refresh_token: `rt-${userId.slice(0, 8)}`,
        expires_in: 3600,
        expires_at: now + 3600,
        token_type: 'bearer',
        user: { id: userId, aud: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() },
    } as Session;
}

/** Attend qu'une condition soit vraie (au plus `ms`). */
export async function waitFor(cond: () => boolean, ms = 3_000): Promise<boolean> {
    const end = Date.now() + ms;
    while (Date.now() < end) {
        if (cond()) return true;
        await new Promise((r) => setTimeout(r, 10));
    }
    return cond();
}

/** Brouillon / clé / valeur courts pour les sorties brutes. */
export const brief = (v: unknown, n = 300): string => {
    const s = typeof v === 'string' ? v : JSON.stringify(v);
    return s.length > n ? `${s.slice(0, n)}…` : s;
};

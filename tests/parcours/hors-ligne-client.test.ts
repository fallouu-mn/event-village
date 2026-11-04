/**
 * Lot 7, tâche 7.1 — côté client du billet hors ligne : choix du code avec l'écart d'horloge, besoin de
 * retéléchargement, purge (contrat section 5.1 « hors-ligne-client », 5.2 « Règles », D26, D31, D34, D35 ;
 * écrivain W5).
 *
 * Fonctions pures de lib/tickets/offline-clock.ts (aucune IndexedDB, D34) :
 *  - offsetFromFetch(serverTime, t0, t1) = Date.parse(serverTime) − (t0 + t1) / 2 ;
 *  - pickOfflineCode(lot, deviceNow) : code du pas de l'heure du serveur (deviceNow + lot.offsetMs) ; un
 *    téléphone en avance ou en retard de 5 min, ou de 20 s, affiche le code de l'heure du serveur ; avant
 *    scan_opens_at → { state: 'not_yet' } ; à partir de valid_until → { state: 'expired' } ; horloge reculée
 *    sous downloadedAtDevice − 60 s → { state: 'clock_changed' } ; jamais de code hors du lot ;
 *  - needsDownload(lot, offline) : lot absent, autre version, expiré, incomplet à moins de 24 h de sa fin → vrai ;
 *    lot complet et à jour, ou incomplet à plus de 24 h → faux.
 * Contrôles statiques (fichiers des écrans, E2) :
 *  - AuthProvider appelle clearOfflineStore dans signOut, sur SIGNED_OUT et sur SIGNED_IN d'un autre compte,
 *    et n'appelle pas /api/auth/me hors ligne (navigator.onLine) ;
 *  - TransferModal supprime le lot local au succès ; OfflineTicketsSync purge les lots expirés, se relance sur
 *    `online` et lit /api/tickets ;
 *  - lib/tickets/offline-store.ts : base event-village-offline v1, magasins lots et meta, index ticketId et
 *    expiresAt, aucune dépendance (idb, dexie, localforage), erreur journalisée « [hors-ligne] » ;
 *  - page /billet/hors-ligne : composant client statique, id lu par window.location.search, aucun
 *    useSearchParams, import() ni next/dynamic, qrcode.react importé statiquement, aucun appel /api/ (D26).
 *
 * Forme du lot local (contrat 5.2) : réponse 3.1 + offsetMs, downloadedAtDevice, downloadedAtServer ; les
 * instants locaux sont des millisecondes (nombres). État de succès de pickOfflineCode : non nommé par le
 * contrat ; le test exige payload et counter exacts et un état hors des trois états d'échec.
 *
 * Rouge aujourd'hui : lib/tickets/offline-clock.ts, lib/tickets/offline-store.ts,
 * components/tickets/OfflineTicketsSync.tsx et app/billet/hors-ligne/page.tsx n'existent pas ;
 * AuthProvider (components/providers/AuthProvider.tsx:92-127) et TransferModal ne purgent rien.
 * Fin de suite : assertTerrainInvariants.
 */
import '../helpers/env';
import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { loadLotModule } from './notif-helpers';
import { assertTerrainInvariants } from './terrain-helpers';

type Row = Record<string, unknown>;

const ROOT = process.cwd();
const STEP = 20_000;
const MIN = 60_000;
const HOUR = 3600_000;
const TICKET_ID = '3b9f0c2e-7d41-4a8e-9c55-1f2e3d4c5b6a';
const FAILURE_STATES = ['not_yet', 'expired', 'clock_changed'];

after(async () => {
    await assertTerrainInvariants('hors-ligne-client');
});

// ── Module et lots fabriqués ──────────────────────────────────────────────

interface ClockModule {
    pickOfflineCode: (lot: Row, deviceNow: number) => Row;
    offsetFromFetch: (serverTime: string, t0: number, t1: number) => number;
    needsDownload: (lot: Row | null | undefined, offline: Row) => boolean;
}

async function clock(): Promise<ClockModule> {
    const mod = await loadLotModule('../../lib/tickets/offline-clock', 'module de l’horloge hors ligne (contrat 5.2, D34, fix(7.1e))');
    for (const name of ['pickOfflineCode', 'offsetFromFetch', 'needsDownload']) {
        assert.equal(typeof mod[name], 'function', `lib/tickets/offline-clock.ts : ${name} non exporté (contrat 5.1)`);
    }
    return mod as unknown as ClockModule;
}

/** Code fabriqué de l'indice i (distinct d'un indice à l'autre sur un lot de moins de 10 000 codes). */
function codeFor(i: number): string {
    return String(100000 + ((i * 7919) % 900000)).padStart(6, '0');
}

interface LotSpec {
    /** Instant du serveur au téléchargement (ms). */
    serverAt: number;
    /** Écart enregistré : heure du serveur − heure du téléphone (ms). */
    offsetMs: number;
    /** Premier pas du lot (aligné sur 20 s). */
    firstStepAt: number;
    count: number;
    scanOpensAt?: number;
    scanClosesAt?: number;
    complete?: boolean;
    secretVersion?: number;
}

function makeLot(s: LotSpec): Row {
    assert.equal(s.firstStepAt % STEP, 0, 'lot fabriqué : premier pas aligné');
    const lastStep = s.firstStepAt + (s.count - 1) * STEP;
    const validUntil = lastStep + STEP;
    const scanOpens = s.scanOpensAt ?? s.firstStepAt;
    const scanCloses = s.scanClosesAt ?? validUntil;
    const complete = s.complete ?? true;
    let codes = '';
    for (let i = 0; i < s.count; i++) codes += codeFor(i);
    return {
        ticket_id: TICKET_ID, secret_version: s.secretVersion ?? 1, prefix: 'EVT1', step_seconds: 20, digits: 6,
        first_counter: s.firstStepAt / STEP, count: s.count, codes,
        first_step_at: new Date(s.firstStepAt).toISOString(), last_step_at: new Date(lastStep).toISOString(),
        valid_until: new Date(validUntil).toISOString(), expires_at: new Date(Math.min(scanCloses, validUntil)).toISOString(),
        scan_opens_at: new Date(scanOpens).toISOString(), scan_closes_at: new Date(scanCloses).toISOString(),
        complete, next_from: complete ? null : new Date(validUntil).toISOString(),
        refresh_after: complete ? null : new Date(validUntil - 24 * HOUR).toISOString(),
        server_time: new Date(s.serverAt).toISOString(),
        ticket: { ticket_number: 'TCK-HL-TEST', category: 'Entrée', event_title: 'Soirée de test', event_start_at: new Date(scanOpens).toISOString(), location: 'CICAD', city: 'Dakar' },
        offsetMs: s.offsetMs, downloadedAtDevice: s.serverAt - s.offsetMs, downloadedAtServer: s.serverAt,
    };
}

/** Résultat attendu pour l'heure du serveur `serverNow` : compteur et charge utile du QR. */
function expected(lot: Row, serverNow: number): { counter: number; payload: string } {
    const counter = Math.floor(serverNow / STEP);
    const i = counter - Number(lot.first_counter);
    assert.ok(i >= 0 && i < Number(lot.count), 'attente fabriquée : instant dans le lot');
    return { counter, payload: `EVT1:${TICKET_ID}:${codeFor(i)}` };
}

function assertCode(r: Row, exp: { counter: number; payload: string }, label: string): void {
    assert.ok(r && typeof r === 'object', `${label} : résultat objet attendu`);
    assert.ok(!FAILURE_STATES.includes(String(r.state)), `${label} : un code est attendu, reçu l'état ${String(r.state)} (${JSON.stringify(r)})`);
    assert.deepEqual({ counter: r.counter, payload: r.payload }, exp, `${label} : code de l'heure du serveur (${JSON.stringify(r)})`);
}

function assertState(r: Row, state: string, label: string): void {
    assert.equal(r?.state, state, `${label} : état ${state} attendu (${JSON.stringify(r)})`);
    assert.ok(!r.payload, `${label} : aucun QR (jamais de code hors du lot ni figé)`);
}

// Instant du serveur de référence : 12/12/2026 19:00:00 Dakar (UTC+0), aligné sur un pas.
const S = Date.UTC(2026, 11, 12, 19, 0, 0);

// ── Fonctions pures ────────────────────────────────────────────────────────

describe('7.1 lib/tickets/offline-clock.ts : écart d’horloge et choix du code', () => {
    test('offsetFromFetch(serverTime, t0, t1) = serverTime − milieu de l’aller-retour', async () => {
        const { offsetFromFetch } = await clock();
        const iso = new Date(S).toISOString();
        assert.equal(offsetFromFetch(iso, S + 5 * MIN - 400, S + 5 * MIN + 400), -5 * MIN, 'téléphone en avance de 5 min');
        assert.equal(offsetFromFetch(iso, S - 5 * MIN - 400, S - 5 * MIN + 400), 5 * MIN, 'téléphone en retard de 5 min');
        assert.equal(offsetFromFetch(iso, S - 1000, S + 3000), -1000, 'aller-retour asymétrique : milieu de [t0 ; t1]');
    });

    test('téléphone en avance ou en retard de 5 min : le code affiché est celui de l’heure du serveur', async () => {
        const { pickOfflineCode, offsetFromFetch } = await clock();
        for (const skew of [5 * MIN, -5 * MIN]) {
            const label = `téléphone ${skew > 0 ? 'en avance' : 'en retard'} de 5 min`;
            const t0 = S + skew - 300;
            const t1 = S + skew + 300;
            const offsetMs = offsetFromFetch(new Date(S).toISOString(), t0, t1);
            assert.equal(offsetMs, -skew, `${label} : écart enregistré`);
            const lot = makeLot({ serverAt: S, offsetMs, firstStepAt: S - STEP, count: 720 });
            for (const later of [0, 95_000, 3 * MIN + 7_000, 2 * HOUR]) {
                const deviceNow = t1 + later;
                assertCode(pickOfflineCode(lot, deviceNow), expected(lot, deviceNow + offsetMs), `${label}, ${later / 1000} s après le téléchargement`);
            }
            // Sans écart appliqué, le compteur serait celui de l'heure du téléphone : 15 pas d'écart, refusé au scan (±1 pas).
            const shown = pickOfflineCode(lot, t1 + 95_000);
            assert.notEqual(shown.counter, Math.floor((t1 + 95_000) / STEP), `${label} : le compteur n'est pas celui de l'heure du téléphone`);
        }
    });

    test('écart de ±20 s appliqué ; le code change à chaque frontière de pas de l’heure du serveur', async () => {
        const { pickOfflineCode } = await clock();
        for (const offsetMs of [20_000, -20_000]) {
            const lot = makeLot({ serverAt: S, offsetMs, firstStepAt: S - STEP, count: 360 });
            const deviceNow = S - offsetMs + 30_000;
            assertCode(pickOfflineCode(lot, deviceNow), expected(lot, S + 30_000), `écart ${offsetMs / 1000} s`);
            assertCode(pickOfflineCode(lot, deviceNow + STEP), expected(lot, S + 30_000 + STEP), `écart ${offsetMs / 1000} s, pas suivant`);
            const boundary = S + 40_000 - offsetMs;
            assertCode(pickOfflineCode(lot, boundary - 1), expected(lot, S + 39_999), `écart ${offsetMs / 1000} s, juste avant la frontière`);
            assertCode(pickOfflineCode(lot, boundary), expected(lot, S + 40_000), `écart ${offsetMs / 1000} s, à la frontière`);
        }
    });

    test('avant scan_opens_at → not_yet ; à partir de valid_until → expired ; jamais de code hors du lot', async () => {
        const { pickOfflineCode } = await clock();
        // Téléchargé la veille, 20 h avant l'ouverture du scan : le lot commence à l'ouverture.
        const opens = S + 20 * HOUR;
        const lot = makeLot({ serverAt: S, offsetMs: 0, firstStepAt: opens, count: 1080, scanOpensAt: opens });
        assertState(pickOfflineCode(lot, S + 10 * MIN), 'not_yet', 'la veille');
        assertState(pickOfflineCode(lot, opens - 1000), 'not_yet', 'une seconde avant l’ouverture');
        assertCode(pickOfflineCode(lot, opens), expected(lot, opens), 'à l’ouverture');
        const validUntil = Date.parse(String(lot.valid_until));
        assertCode(pickOfflineCode(lot, validUntil - 1), expected(lot, validUntil - 1), 'dernier pas du lot');
        assertState(pickOfflineCode(lot, validUntil), 'expired', 'à valid_until');
        assertState(pickOfflineCode(lot, validUntil + 3 * HOUR), 'expired', 'trois heures après valid_until');
    });

    test('horloge reculée sous downloadedAtDevice − 60 s → clock_changed ; à − 59 s, encore un code', async () => {
        const { pickOfflineCode } = await clock();
        // Le lot couvre S − 30 min à S + 3 h 30 : seul le recul de l'horloge peut expliquer un refus.
        const lot = makeLot({ serverAt: S, offsetMs: 0, firstStepAt: S - 30 * MIN, count: 720 });
        const downloadedAtDevice = Number(lot.downloadedAtDevice);
        assertState(pickOfflineCode(lot, downloadedAtDevice - 61_000), 'clock_changed', 'horloge reculée de 61 s');
        assertState(pickOfflineCode(lot, downloadedAtDevice - 10 * MIN), 'clock_changed', 'horloge reculée de 10 min');
        assertCode(pickOfflineCode(lot, downloadedAtDevice - 59_000), expected(lot, downloadedAtDevice - 59_000), 'horloge reculée de 59 s (tolérance)');
    });

    test('needsDownload : absent, autre version, expiré, incomplet à moins de 24 h → vrai ; à jour → faux', async () => {
        const { needsDownload } = await clock();
        const now = Date.now();
        const first = Math.floor(now / STEP) * STEP - STEP;
        const offline = (v: number): Row => ({
            secret_version: v, available: true, reason: null,
            available_from: new Date(now - HOUR).toISOString(), available_until: new Date(now + 60 * HOUR).toISOString(),
        });
        const complete = makeLot({ serverAt: now, offsetMs: 0, firstStepAt: first, count: (10 * HOUR) / STEP, complete: true });
        const expiredLot = makeLot({ serverAt: now - 12 * HOUR, offsetMs: 0, firstStepAt: first - 12 * HOUR, count: (6 * HOUR) / STEP, complete: true });
        const shortTail = makeLot({ serverAt: now - 25 * HOUR, offsetMs: 0, firstStepAt: first - 25 * HOUR, count: (48 * HOUR) / STEP, complete: false });
        const longTail = makeLot({ serverAt: now, offsetMs: 0, firstStepAt: first, count: (48 * HOUR) / STEP, complete: false });
        assert.equal(needsDownload(null, offline(1)), true, 'aucun lot local');
        assert.equal(needsDownload(undefined, offline(1)), true, 'aucun lot local (undefined)');
        assert.equal(needsDownload(complete, offline(2)), true, 'lot d’une autre version du secret');
        assert.equal(needsDownload(expiredLot, offline(1)), true, 'lot expiré');
        assert.equal(needsDownload(shortTail, offline(1)), true, 'lot incomplet dont la fin est à moins de 24 h');
        assert.equal(needsDownload(complete, offline(1)), false, 'lot complet de la version courante');
        assert.equal(needsDownload(longTail, offline(1)), false, 'lot incomplet dont la fin est à plus de 24 h');
    });
});

// ── Contrôles statiques ────────────────────────────────────────────────────

function read(rel: string, what: string): string {
    const abs = path.resolve(ROOT, rel);
    assert.ok(fs.existsSync(abs), `${rel} absent (${what})`);
    return fs.readFileSync(abs, 'utf8');
}

function stripComments(src: string): string {
    return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '$1');
}

/** Texte de `(` … `)` équilibré qui suit l'indice `open` (indice de la parenthèse ouvrante). */
function balanced(src: string, open: number, pair: '()' | '{}' = '()'): string {
    const [o, c] = pair.split('');
    assert.equal(src[open], o, 'balanced : délimiteur ouvrant attendu');
    let depth = 0;
    for (let i = open; i < src.length; i++) {
        if (src[i] === o) depth++;
        else if (src[i] === c) {
            depth--;
            if (depth === 0) return src.slice(open, i + 1);
        }
    }
    assert.fail('balanced : délimiteurs non équilibrés');
}

/** Noms importés depuis lib/tickets/offline-store (import nommé). */
function storeImports(src: string): string[] {
    const m = /import\s*\{([^}]*)\}\s*from\s*['"](?:@\/|(?:\.\.\/)+)lib\/tickets\/offline-store['"]/.exec(src);
    if (!m) return [];
    return m[1].split(',').map((s) => s.trim().split(/\s+as\s+/).pop()!.trim()).filter(Boolean);
}

describe('7.1 Purge du stockage local (contrat 5.1, 5.2)', () => {
    test('AuthProvider : clearOfflineStore dans signOut, sur SIGNED_OUT et sur SIGNED_IN d’un autre compte ; pas de /api/auth/me hors ligne', () => {
        const src = stripComments(read('components/providers/AuthProvider.tsx', 'fournisseur de session'));
        assert.ok(storeImports(src).includes('clearOfflineStore'), 'AuthProvider importe clearOfflineStore de lib/tickets/offline-store');
        const signOutAt = src.search(/const\s+signOut\s*=\s*(useCallback\s*\(\s*)?async\s*\(\s*\)\s*=>\s*\{/);
        assert.ok(signOutAt >= 0, 'fonction signOut lisible dans AuthProvider');
        const signOutBody = balanced(src, src.indexOf('{', src.indexOf('=>', signOutAt)), '{}');
        assert.match(signOutBody, /clearOfflineStore\s*\(/, 'signOut purge le stockage hors ligne avant la déconnexion');
        assert.ok(signOutBody.search(/clearOfflineStore\s*\(/) < signOutBody.search(/\.auth\.signOut\s*\(/), 'purge avant supabase.auth.signOut() (au cas où l’événement n’arrive pas)');
        const listenerAt = src.search(/onAuthStateChange\s*\(/);
        assert.ok(listenerAt >= 0, 'écouteur onAuthStateChange');
        const listener = balanced(src, src.indexOf('(', listenerAt));
        assert.match(listener, /SIGNED_OUT/, 'écouteur : cas SIGNED_OUT');
        assert.match(listener, /SIGNED_IN/, 'écouteur : cas SIGNED_IN');
        assert.match(listener, /clearOfflineStore\s*\(/, 'écouteur : purge du stockage hors ligne');
        assert.match(listener, /!==?/, 'écouteur : SIGNED_IN purge seulement pour un autre compte (comparaison des identifiants)');
        assert.match(src, /navigator\.onLine/, 'pas d’appel /api/auth/me quand navigator.onLine est faux');
    });

    test('TransferModal supprime le lot local au succès ; OfflineTicketsSync purge les lots expirés, se relance sur online, lit /api/tickets', () => {
        const modal = stripComments(read('components/tickets/TransferModal.tsx', 'modale de transfert'));
        const imported = storeImports(modal);
        assert.ok(imported.length > 0, 'TransferModal importe lib/tickets/offline-store');
        assert.ok(imported.some((name) => new RegExp(`\\b${name}\\s*\\(`).test(modal.replace(/import[^;]*;/g, ''))), `TransferModal appelle ${imported.join(', ')} (suppression du lot au succès)`);

        const sync = stripComments(read('components/tickets/OfflineTicketsSync.tsx', 'synchronisation des billets hors ligne (contrat 5.2, fix(7.1e))'));
        const names = storeImports(sync);
        assert.ok(names.some((n) => /purge|expir/i.test(n) && new RegExp(`\\b${n}\\s*\\(`).test(sync.replace(/import[^;]*;/g, ''))),
            `OfflineTicketsSync appelle une purge des lots expirés de offline-store (importés : ${names.join(', ') || 'aucun'})`);
        assert.match(sync, /addEventListener\s*\(\s*['"]online['"]/, 'relance sur l’événement online');
        assert.match(sync, /['"`]\/api\/tickets['"`?]/, 'lecture de /api/tickets (champ offline du serveur, rien calculé dans le navigateur)');
        assert.match(sync, /needsDownload\s*\(/, 'téléchargement seulement si needsDownload (quota)');
    });

    test('lib/tickets/offline-store.ts : base event-village-offline v1, magasins lots et meta, index, aucune dépendance, erreurs journalisées', () => {
        const src = stripComments(read('lib/tickets/offline-store.ts', 'stockage IndexedDB (contrat 5.2, D34, fix(7.1e))'));
        assert.match(src, /indexedDB\.open\s*\(\s*['"`]event-village-offline['"`]\s*,\s*1\s*\)/, 'indexedDB.open(\'event-village-offline\', 1)');
        for (const store of ['lots', 'meta']) assert.match(src, new RegExp(`createObjectStore\\s*\\(\\s*['"\`]${store}['"\`]`), `magasin ${store}`);
        for (const index of ['ticketId', 'expiresAt']) assert.match(src, new RegExp(`createIndex\\s*\\(\\s*['"\`]${index}['"\`]`), `index ${index}`);
        assert.match(src, /export\s+(async\s+)?function\s+clearOfflineStore\b|export\s+const\s+clearOfflineStore\b/, 'clearOfflineStore exporté');
        assert.match(src, /currentUserId/, 'meta.currentUserId : seuls les lots du compte courant sont affichés');
        assert.doesNotMatch(src, /from\s+['"](idb|idb-keyval|dexie|localforage|fake-indexeddb)['"]/, 'aucune bibliothèque IndexedDB (D34)');
        assert.match(src, /console\.warn\s*\(\s*['"`]\[hors-ligne\]/, 'erreur IndexedDB journalisée par console.warn(\'[hors-ligne] …\')');
        assert.doesNotMatch(src, /catch\s*(\([^)]*\))?\s*\{\s*\}/, 'aucun catch vide');
        const pkg = JSON.parse(read('package.json', 'manifeste npm')) as { dependencies?: Row; devDependencies?: Row };
        const deps = Object.keys({ ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) });
        assert.deepEqual(deps.filter((d) => ['idb', 'idb-keyval', 'dexie', 'localforage', 'fake-indexeddb'].includes(d)), [], 'aucune dépendance IndexedDB ajoutée');
    });

    test('page /billet/hors-ligne : client statique, id par window.location.search, ni useSearchParams ni import() ni next/dynamic, qrcode.react statique, aucun /api/', () => {
        const files = ['app/billet/hors-ligne/page.tsx', 'components/tickets/offline/OfflineTicketView.tsx'];
        const page = stripComments(read(files[0], 'page publique du billet hors ligne (D26, fix(7.1e))'));
        assert.match(page, /^\s*['"]use client['"]/, 'composant client');
        const sources = files.map((f) => stripComments(read(f, 'écran du billet hors ligne (contrat 5.2)'))).join('\n');
        assert.match(sources, /window\.location\.search/, 'id lu par window.location.search');
        assert.doesNotMatch(sources, /useSearchParams/, 'aucun useSearchParams (page prérendue statiquement)');
        assert.doesNotMatch(sources, /\bimport\s*\(/, 'aucun import() dynamique (morceau absent du cache hors ligne)');
        assert.doesNotMatch(sources, /next\/dynamic/, 'aucun next/dynamic');
        assert.match(sources, /import\s*\{[^}]*\bQRCodeSVG\b[^}]*\}\s*from\s*['"]qrcode\.react['"]/, 'qrcode.react importé statiquement');
        assert.doesNotMatch(sources, /['"`]\/api\//, 'aucun appel /api/ : toutes les données viennent d’IndexedDB');
        assert.match(sources, /pickOfflineCode\s*\(/, 'code choisi par pickOfflineCode (écart d’horloge appliqué)');
    });
});

/**
 * Lot 7, tâche 7.2, amendement A10 (demande de l'utilisateur du 04/11 : « quand je scanne quelqu'un et que je
 * quitte l'application et je reviens, les données sont parties ») — reprise de la session de contrôle sur
 * /controller/scanner et /partner/scan après un retour d'arrière-plan, une navigation aller-retour, un
 * rechargement, ou la fermeture puis la réouverture de l'application installée.
 *
 * Contrôles statiques (lecture des fichiers) et appels du module pur lib/scan/scan-session.ts avec une mémoire
 * locale simulée : aucune base nécessaire, sauf les invariants de fin de suite (assertTerrainInvariants).
 *  1. mémoire de la session (événement, affectation, mode, onglet) : clé par compte, sans identifiant de compte en
 *     clair, aucune autre donnée que des identifiants et des choix d'écran, oubliée après 24 h, valeur hors format
 *     effacée ;
 *  2. scan en attente de verdict : un seul par compte, effacé seulement par sa clé, oublié après 2 minutes (et
 *     rendu comme « expiré » pour que l'écran le dise) ; verdict reçu ou non selon la nature de l'échec ;
 *  3. déconnexion : toute la mémoire du contrôle effacée (tous comptes), le reste de l'appareil intact ; appel avant
 *     supabase.auth.signOut() dans AuthProvider, l'en-tête du contrôleur et le scanner, et sur SIGNED_OUT ;
 *  4. retour dans l'application : useScannerReturn écoute visibilitychange (visible) et pageshow ; les deux écrans
 *     l'utilisent et relisent sur le serveur les chiffres et l'historique (/api/controller/scans), et le scanner
 *     la caisse (/api/controller/shifts/active) et les affectations ;
 *  5. scan en attente repris : clé et requête gardées avant l'envoi, renvoyées avec la MÊME clé
 *     (pending.key), effacées au verdict ; « Résultat retrouvé » sur les deux composants de résultat ;
 *  6. caméra : plus de redémarrage d'office au retour au premier plan, écran « Reprendre le contrôle », démarrage
 *     différé (autoStart) pour une session retrouvée ; double décodeur ZXing + jsQR et arrêt réel des pistes gardés ;
 *  7. partenaire : plus de liste de session tenue dans la page, chiffres servis par le serveur ; middleware ouvert
 *     au partenaire pour la seule lecture GET /api/controller/scans (chemin exact).
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { assertTerrainInvariants } from './terrain-helpers';

after(async () => {
    await assertTerrainInvariants('scanner-reprise');
});

const ROOT = process.cwd();
const SESSION_MODULE = 'lib/scan/scan-session.ts';
const MEMORY_MODULE = 'lib/scan/scan-memory.ts';
const SCANNER_PAGE = 'app/controller/scanner/page.tsx';
const PARTNER_PAGE = 'app/partner/scan/page.tsx';
const CAMERA = 'components/scan/CameraQrScanner.tsx';
const OVERLAY = 'components/scan/CombatFlashOverlay.tsx';
const PANEL = 'components/scan/ScanResultPanel.tsx';
const AUTH_PROVIDER = 'components/providers/AuthProvider.tsx';
const CONTROLLER_LAYOUT = 'app/controller/layout.tsx';
const MIDDLEWARE = 'middleware.ts';

function read(file: string): string {
    const abs = path.resolve(ROOT, file);
    assert.ok(fs.existsSync(abs), `fichier attendu absent : ${file}`);
    return fs.readFileSync(abs, 'utf8');
}

/** Commentaires retirés (bloc et ligne ; un « // » précédé d'un caractère non blanc, comme dans une URL, est gardé). */
function code(file: string): string {
    return read(file).replace(/\/\*[\s\S]*?\*\//g, (b) => b.replace(/[^\n]/g, '')).replace(/(^|\s)\/\/.*$/gm, '$1');
}

/** Corps équilibré qui commence au premier `open` à partir de `from`. */
function balanced(src: string, from: number, open = '{', close = '}'): string {
    const start = src.indexOf(open, from);
    assert.ok(start >= 0, `« ${open} » introuvable après la position ${from}`);
    let depth = 0;
    for (let i = start; i < src.length; i++) {
        if (src[i] === open) depth += 1;
        else if (src[i] === close) {
            depth -= 1;
            if (depth === 0) return src.slice(start, i + 1);
        }
    }
    throw new Error(`« ${open} » non refermé après la position ${from}`);
}

/** Corps de la fonction déclarée par `const <name> = …` (useCallback ou flèche). */
function functionBody(src: string, name: string): string {
    const at = src.search(new RegExp(`const\\s+${name}\\s*=`));
    assert.ok(at >= 0, `fonction ${name} introuvable`);
    return balanced(src, src.indexOf('=>', at));
}

// ── Mémoire locale simulée (window.localStorage) ──────────────────────────

class MemoryStorage {
    private readonly map = new Map<string, string>();
    get length(): number { return this.map.size; }
    key(i: number): string | null { return Array.from(this.map.keys())[i] ?? null; }
    getItem(k: string): string | null { return this.map.has(k) ? (this.map.get(k) as string) : null; }
    setItem(k: string, v: string): void { this.map.set(k, String(v)); }
    removeItem(k: string): void { this.map.delete(k); }
    clear(): void { this.map.clear(); }
    keys(): string[] { return Array.from(this.map.keys()); }
}

type SessionModule = typeof import('../../lib/scan/scan-session');

let store: MemoryStorage;
let mod: SessionModule;
const ACCOUNT_A = '3f1d2c4b-5a6e-4f70-8a91-b2c3d4e5f601';
const ACCOUNT_B = '9a8b7c6d-5e4f-4a3b-9c2d-1e0f9a8b7c6d';
const EVENT_ID = '11111111-2222-4333-8444-555555555555';
const OTHER_EVENT = '66666666-7777-4888-9999-000000000000';
const ASSIGNMENT_ID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const KEY_1 = '0b6f1e2a-3c4d-4e5f-8a6b-7c8d9e0f1a2b';
const KEY_2 = '1c7a2f3b-4d5e-4f60-9b7c-8d9e0f1a2b3c';

before(async () => {
    store = new MemoryStorage();
    (globalThis as unknown as { window: { localStorage: MemoryStorage } }).window = { localStorage: store };
    mod = await import('../../lib/scan/scan-session');
});

// ── 1. Session retenue ─────────────────────────────────────────────────────

describe('A10 — mémoire de la session (événement et mode) sur l’appareil', () => {
    test('clé par compte, sans identifiant de compte en clair ; deux comptes ne se mélangent pas ; surfaces distinctes', () => {
        store.clear();
        mod.saveScanSession('controleur', ACCOUNT_A, { eventId: EVENT_ID, assignmentId: ASSIGNMENT_ID, mode: 'manual', area: 'caisse' });
        mod.saveScanSession('controleur', ACCOUNT_B, { eventId: OTHER_EVENT, assignmentId: null, mode: 'camera', area: 'controle' });
        const keys = store.keys();
        assert.equal(keys.length, 2, `une clé par compte : ${JSON.stringify(keys)}`);
        for (const k of keys) {
            assert.ok(k.startsWith('ev-scan-session:'), `préfixe de la mémoire du contrôle : ${k}`);
            assert.ok(!k.includes(ACCOUNT_A) && !k.includes(ACCOUNT_B), `identifiant de compte en clair dans la clé : ${k}`);
        }
        const a = mod.readScanSession('controleur', ACCOUNT_A);
        const b = mod.readScanSession('controleur', ACCOUNT_B);
        assert.equal(a?.eventId, EVENT_ID);
        assert.equal(a?.mode, 'manual');
        assert.equal(a?.area, 'caisse');
        assert.equal(a?.assignmentId, ASSIGNMENT_ID);
        assert.equal(b?.eventId, OTHER_EVENT);
        assert.equal(mod.readScanSession('partenaire', ACCOUNT_A), null, 'la session du contrôleur n’est pas celle du partenaire');
    });

    test('valeur écrite : identifiants et choix d’écran seulement (aucune donnée personnelle)', () => {
        store.clear();
        mod.saveScanSession('partenaire', ACCOUNT_A, { eventId: EVENT_ID, assignmentId: null, mode: 'camera', area: 'controle' });
        const [k] = store.keys();
        const value = JSON.parse(store.getItem(k) as string) as Record<string, unknown>;
        assert.deepEqual(Object.keys(value).sort(), ['area', 'assignmentId', 'eventId', 'mode', 'savedAt'], `champs écrits : ${JSON.stringify(value)}`);
    });

    test('oubliée après 24 h sans usage ; valeur hors format effacée', () => {
        store.clear();
        mod.saveScanSession('controleur', ACCOUNT_A, { eventId: EVENT_ID, assignmentId: ASSIGNMENT_ID, mode: 'camera', area: 'controle' });
        assert.ok(mod.readScanSession('controleur', ACCOUNT_A, Date.now() + mod.SCAN_SESSION_MAX_AGE_MS - 60_000), 'session de moins de 24 h reprise');
        assert.equal(mod.readScanSession('controleur', ACCOUNT_A, Date.now() + mod.SCAN_SESSION_MAX_AGE_MS + 60_000), null, 'session de plus de 24 h oubliée');
        assert.equal(store.length, 0, 'session trop ancienne effacée de l’appareil');
        assert.equal(mod.SCAN_SESSION_MAX_AGE_MS, 24 * 60 * 60_000);

        mod.saveScanSession('controleur', ACCOUNT_A, { eventId: EVENT_ID, assignmentId: ASSIGNMENT_ID, mode: 'camera', area: 'controle' });
        const [k] = store.keys();
        store.setItem(k, JSON.stringify({ eventId: 'pas-un-uuid', mode: 'camera', area: 'controle', savedAt: Date.now() }));
        assert.equal(mod.readScanSession('controleur', ACCOUNT_A), null, 'valeur hors format refusée');
        assert.equal(store.length, 0, 'valeur hors format effacée');
        store.setItem(k, '{illisible');
        assert.equal(mod.readScanSession('controleur', ACCOUNT_A), null, 'JSON illisible refusé');
        assert.equal(store.length, 0, 'JSON illisible effacé');
    });
});

// ── 2. Scan en attente ─────────────────────────────────────────────────────

describe('A10 — scan en attente de verdict (même clé au retour, 2 minutes au plus)', () => {
    test('enregistré, relu, puis effacé seulement par sa propre clé', () => {
        store.clear();
        const request = { eventId: EVENT_ID, payload: `EVT1:${OTHER_EVENT}:123456` };
        mod.savePendingScan('controleur', ACCOUNT_A, { key: KEY_1, eventId: EVENT_ID, request, createdAt: Date.now() });
        const read1 = mod.readPendingScan('controleur', ACCOUNT_A);
        assert.equal(read1.pending?.key, KEY_1, 'scan en attente relu avec sa clé');
        assert.deepEqual(read1.pending?.request, request);
        assert.equal(mod.pendingPayload(read1.pending as NonNullable<typeof read1.pending>), request.payload);
        mod.clearPendingScan('controleur', ACCOUNT_A, KEY_2);
        assert.equal(mod.readPendingScan('controleur', ACCOUNT_A).pending?.key, KEY_1, 'une autre clé n’efface pas le scan en attente');
        mod.clearPendingScan('controleur', ACCOUNT_A, KEY_1);
        assert.equal(mod.readPendingScan('controleur', ACCOUNT_A).pending, null, 'effacé par sa clé');
        assert.equal(mod.readPendingScan('controleur', ACCOUNT_B).pending, null);
    });

    test('saisie manuelle : numéro et pièce vérifiée gardés ; requête incomplète refusée', () => {
        store.clear();
        const request = { eventId: EVENT_ID, manualTicketNumber: 'TCK-20261104-ABCDEF', identityVerified: true };
        mod.savePendingScan('partenaire', ACCOUNT_A, { key: KEY_1, eventId: EVENT_ID, request, createdAt: Date.now() });
        const read1 = mod.readPendingScan('partenaire', ACCOUNT_A);
        assert.deepEqual(read1.pending?.request, request);
        assert.equal(mod.pendingPayload(read1.pending as NonNullable<typeof read1.pending>), null, 'aucun QR pour une saisie manuelle');
        const [k] = store.keys();
        store.setItem(k, JSON.stringify({ key: KEY_1, eventId: EVENT_ID, request: { eventId: EVENT_ID, manualTicketNumber: 'X', identityVerified: false }, createdAt: Date.now() }));
        assert.equal(mod.readPendingScan('partenaire', ACCOUNT_A).pending, null, 'saisie manuelle sans pièce vérifiée jamais renvoyée');
        assert.equal(store.length, 0);
    });

    test('plus de 2 minutes : oublié sans renvoi, rendu comme « expiré » (l’écran le dit)', () => {
        store.clear();
        const createdAt = Date.now();
        mod.savePendingScan('controleur', ACCOUNT_A, { key: KEY_1, eventId: EVENT_ID, request: { eventId: EVENT_ID, payload: 'EVT1:x:123456' }, createdAt });
        assert.equal(mod.PENDING_SCAN_MAX_AGE_MS, 2 * 60_000);
        assert.ok(mod.readPendingScan('controleur', ACCOUNT_A, createdAt + mod.PENDING_SCAN_MAX_AGE_MS - 1_000).pending, 'moins de 2 minutes : renvoyé');
        const late = mod.readPendingScan('controleur', ACCOUNT_A, createdAt + mod.PENDING_SCAN_MAX_AGE_MS + 1_000);
        assert.equal(late.pending, null, 'plus de 2 minutes : jamais renvoyé');
        assert.equal(late.expired?.key, KEY_1, 'plus de 2 minutes : rendu comme expiré');
        assert.equal(store.length, 0, 'scan expiré effacé');
    });

    test('verdict reçu : tout résultat sur le billet, les refus de la requête, hors ligne avant envoi ; non reçu : réseau, délai, 5xx, hors ligne après un envoi', () => {
        const base = { message: 'm', httpStatus: 200 } as const;
        assert.equal(mod.isVerdictReceived({ ...base, result: 'valid' }), true);
        assert.equal(mod.isVerdictReceived({ ...base, result: 'already_used' }), true);
        assert.equal(mod.isVerdictReceived({ ...base, result: 'payment_required' }), true);
        for (const failure of ['bad_request', 'forbidden', 'rate_limited', 'auth'] as const) {
            assert.equal(mod.isVerdictReceived({ ...base, result: 'server_error', failure }), true, `${failure} : rien n’a été traité, rien à renvoyer`);
        }
        assert.equal(mod.isVerdictReceived({ ...base, result: 'network_error', failure: 'offline', httpStatus: null, attempts: 0 }), true, 'hors ligne avant tout envoi : rien n’est parti');
        assert.equal(mod.isVerdictReceived({ ...base, result: 'network_error', failure: 'offline', httpStatus: null, attempts: 1 }), false, 'hors ligne après un envoi : traité peut-être');
        for (const failure of ['network', 'timeout', 'server'] as const) {
            assert.equal(mod.isVerdictReceived({ ...base, result: 'network_error', failure, httpStatus: null, attempts: 3 }), false, `${failure} : verdict non reçu`);
        }
    });

    for (const file of [SCANNER_PAGE, PARTNER_PAGE]) {
        test(`${file} : gardé pour un renvoi seulement si l’application a été quittée pendant l’envoi`, () => {
            const src = code(file);
            assert.match(src, /useScannerReturn\s*\(\s*handleReturn\s*,\s*awayRef\s*\)/, 'useScannerReturn signale la sortie (awayRef)');
            const run = functionBody(src, 'runScan');
            assert.match(run, /awayRef\.current\s*=\s*document\.visibilityState\s*===\s*['"]hidden['"]/, 'awayRef remis à zéro au début de l’envoi');
            assert.ok(run.search(/awayRef\.current\s*=/) < run.search(/postScan\s*\(/), 'remise à zéro avant l’envoi');
            assert.match(run, /!verdict\s*&&\s*awayRef\.current/, 'renvoi au retour seulement après une sortie pendant l’envoi');
        });
    }
    test('useScannerReturn : sortie relevée sur visibilitychange (hidden) et pagehide', () => {
        const src = code(SESSION_MODULE);
        assert.match(src, /else\s+awayRef\.current\s*=\s*true/, 'visibilitychange vers hidden : sortie relevée');
        assert.match(src, /addEventListener\s*\(\s*['"]pagehide['"]/, 'pagehide : sortie relevée');
    });
});

// ── 3. Déconnexion ─────────────────────────────────────────────────────────

describe('A10 — mémoire du contrôle effacée à la déconnexion', () => {
    test('clearAllScanMemory efface la session et le scan en attente de tous les comptes, rien d’autre', () => {
        store.clear();
        store.setItem('ev-theme', 'dark');
        store.setItem('ev_scanner_auto_return_ms', '3000');
        mod.saveScanSession('controleur', ACCOUNT_A, { eventId: EVENT_ID, assignmentId: ASSIGNMENT_ID, mode: 'camera', area: 'controle' });
        mod.saveScanSession('partenaire', ACCOUNT_B, { eventId: EVENT_ID, assignmentId: null, mode: 'manual', area: 'controle' });
        mod.savePendingScan('controleur', ACCOUNT_A, { key: KEY_1, eventId: EVENT_ID, request: { eventId: EVENT_ID, payload: 'EVT1:x:123456' }, createdAt: Date.now() });
        mod.clearAllScanMemory();
        assert.deepEqual(store.keys().sort(), ['ev-theme', 'ev_scanner_auto_return_ms'], `clés restantes : ${JSON.stringify(store.keys())}`);
    });

    test('appel avant supabase.auth.signOut() : AuthProvider (signOut et SIGNED_OUT), en-tête du contrôleur, scanner', () => {
        const faults: string[] = [];
        for (const file of [AUTH_PROVIDER, CONTROLLER_LAYOUT, SCANNER_PAGE]) {
            const src = code(file);
            if (!/import\s*\{[^}]*\bclearAllScanMemory\b[^}]*\}\s*from\s*['"]@\/lib\/scan\/scan-(?:memory|session)['"]/.test(src)) {
                faults.push(`${file} : clearAllScanMemory non importée de lib/scan/scan-memory`);
            }
            for (const name of file === AUTH_PROVIDER ? ['signOut'] : ['handleLogout']) {
                const body = functionBody(src, name);
                const clear = body.search(/clearAllScanMemory\s*\(/);
                const out = body.search(/\.auth\.signOut\s*\(/);
                if (clear < 0) faults.push(`${file} : ${name} n’efface pas la mémoire du contrôle`);
                else if (out >= 0 && clear > out) faults.push(`${file} : ${name} efface la mémoire après supabase.auth.signOut()`);
            }
        }
        const auth = code(AUTH_PROVIDER);
        const listener = balanced(auth, auth.search(/onAuthStateChange\s*\(/), '(', ')');
        const signedOut = listener.indexOf("'SIGNED_OUT'");
        assert.ok(signedOut >= 0, 'écouteur SIGNED_OUT');
        if (!/clearAllScanMemory\s*\(/.test(balanced(listener, signedOut))) faults.push(`${AUTH_PROVIDER} : SIGNED_OUT n’efface pas la mémoire du contrôle`);
        assert.deepEqual(faults, [], faults.join('\n'));
    });
});

// ── 4. Retour dans l'application ──────────────────────────────────────────

describe('A10 — retour dans l’application : chiffres, historique et caisse relus sur le serveur', () => {
    test('useScannerReturn écoute visibilitychange (visible) et pageshow (page restaurée)', () => {
        const src = code(SESSION_MODULE);
        const hook = functionBody(src.replace(/export\s+function\s+useScannerReturn/, 'const useScannerReturn = () =>'), 'useScannerReturn');
        assert.match(hook, /addEventListener\s*\(\s*['"]visibilitychange['"]/, 'écoute de visibilitychange');
        assert.match(hook, /visibilityState\s*===\s*['"]visible['"]/, 'retour au premier plan seulement (visible)');
        assert.match(hook, /addEventListener\s*\(\s*['"]pageshow['"]/, 'écoute de pageshow');
        assert.match(hook, /removeEventListener\s*\(\s*['"]visibilitychange['"]/, 'écouteur visibilitychange retiré au démontage');
        assert.match(hook, /removeEventListener\s*\(\s*['"]pageshow['"]/, 'écouteur pageshow retiré au démontage');
    });

    test('scanner : au retour, affectations, chiffres (/api/controller/scans), caisse (/api/controller/shifts/active) et scan en attente', () => {
        const src = code(SCANNER_PAGE);
        assert.match(src, /useScannerReturn\s*\(\s*handleReturn\s*,\s*awayRef\s*\)/, 'useScannerReturn(handleReturn, awayRef)');
        const body = functionBody(src, 'handleReturn');
        for (const call of ['fetchAssignments', 'fetchStats', 'fetchActiveShift']) {
            assert.match(body, new RegExp(`\\b${call}\\s*\\(`), `handleReturn appelle ${call}`);
        }
        assert.match(body, /resumePending\w*(?:\.current)?\s*\(/, 'handleReturn renvoie le scan en attente');
        assert.match(functionBody(src, 'fetchStats'), /\/api\/controller\/scans\?event_id=/, 'chiffres et historique lus sur /api/controller/scans');
        assert.match(functionBody(src, 'fetchActiveShift'), /\/api\/controller\/shifts\/active\?event_id=/, 'caisse lue sur /api/controller/shifts/active');
        assert.match(functionBody(src, 'fetchAssignments'), /quiet/, 'relecture des affectations au retour sans écran d’erreur');
    });

    test('scanner : montage (rechargement, réouverture) relit les chiffres et renvoie le scan en attente', () => {
        const src = code(SCANNER_PAGE);
        const effect = src.slice(src.search(/if\s*\(\s*!started\s*\|\|\s*!eventId\s*\)\s*return;/));
        const head = effect.slice(0, 600);
        assert.match(head, /fetchStats\s*\(/, 'chiffres relus au départ du contrôle');
        assert.match(head, /resumePending\w*(?:\.current)?\s*\(\s*['"]montage['"]/, 'scan en attente renvoyé au montage');
    });

    test('scan partenaire : useScannerReturn, chiffres et historique sur /api/controller/scans, au montage et après chaque scan', () => {
        const src = code(PARTNER_PAGE);
        assert.match(src, /useScannerReturn\s*\(\s*handleReturn\s*,\s*awayRef\s*\)/, 'useScannerReturn(handleReturn, awayRef)');
        const body = functionBody(src, 'handleReturn');
        assert.match(body, /\bfetchStats\s*\(/, 'chiffres relus au retour');
        assert.match(body, /\bfetchEvents\s*\(/, 'événements relus au retour (encore ouverts au contrôle ?)');
        assert.match(body, /resumePending\w*\s*\(/, 'scan en attente renvoyé au retour');
        assert.match(functionBody(src, 'fetchStats'), /\/api\/controller\/scans\?event_id=/, 'historique lu sur le serveur');
        assert.match(functionBody(src, 'runScan'), /scheduleStats\s*\(/, 'chiffres relus après chaque scan');
    });
});

// ── 5. Scan en attente repris ─────────────────────────────────────────────

describe('A10 — scan coupé par la sortie : renvoyé au retour avec la même clé', () => {
    for (const file of [SCANNER_PAGE, PARTNER_PAGE]) {
        test(`${file} : clé gardée avant l’envoi, même clé à l’envoi, effacée au verdict, renvoi avec pending.key`, () => {
            const src = code(file);
            const run = functionBody(src, 'runScan');
            const save = run.search(/savePendingScan\s*\(/);
            const post = run.search(/postScan\s*\(/);
            assert.ok(save >= 0, 'savePendingScan dans runScan');
            assert.ok(post > save, 'scan en attente enregistré AVANT l’envoi');
            assert.match(run, /postScan\s*\([^)]*\{\s*key\s*:\s*scanKey/, 'postScan reçoit la clé enregistrée');
            assert.match(run, /const\s+verdict\s*=\s*isVerdictReceived\s*\(/, 'verdict reçu ou non (isVerdictReceived)');
            assert.ok(run.search(/clearPendingScan\s*\(\s*SURFACE\s*,\s*account\s*,\s*scanKey\s*\)/) > run.search(/postScan\s*\(/), 'effacé après la réponse (verdict, ou incident vu à l’écran)');
            const resume = functionBody(src, 'resumePendingScan');
            assert.match(resume, /readPendingScan\s*\(/, 'scan en attente relu');
            assert.match(resume, /runScan\w*(?:\.current)?\s*\(\s*pending\.request\s*,[^,]*,\s*pending\.key\s*,\s*pending\.createdAt\s*\)/, 'renvoi avec la requête et la clé d’origine');
            assert.match(resume, /busyRef\.current/, 'jamais renvoyé pendant un autre scan');
            assert.match(resume, /navigator\.onLine\s*===\s*false/, 'hors ligne : gardé jusqu’au retour du réseau');
            assert.match(resume, /expired/, 'scan trop ancien signalé');
        });
    }

    test('« Résultat retrouvé » sur le plein écran et la carte de résultat (data-scan-recovered)', () => {
        for (const file of [OVERLAY, PANEL]) {
            const src = code(file);
            assert.match(src, /recoveredAt\??\s*:/, `${file} : prop recoveredAt`);
            assert.match(src, /data-scan-recovered/, `${file} : attribut data-scan-recovered`);
            assert.match(src, /Résultat retrouvé/, `${file} : ligne « Résultat retrouvé »`);
        }
        assert.match(code(SCANNER_PAGE), /recoveredAt=\{\s*shown\?\.recoveredAt/, 'le scanner passe recoveredAt au plein écran');
        assert.match(code(PARTNER_PAGE), /recoveredAt=\{\s*shown\?\.recoveredAt/, 'le scan partenaire passe recoveredAt à la carte');
    });
});

// ── 6. Session reprise et caméra ──────────────────────────────────────────

describe('A10 — même événement et même mode repris ; caméra relancée par « Reprendre le contrôle »', () => {
    test('scanner : session relue, reprise seulement si l’affectation existe et que l’événement est ouvert, sinon message', () => {
        const src = code(SCANNER_PAGE);
        assert.match(src, /readScanSession\s*\(\s*SURFACE/, 'session retenue relue');
        assert.match(src, /saveScanSession\s*\(\s*SURFACE\s*,\s*accountId\s*,\s*\{\s*eventId:\s*selectedEventId,\s*assignmentId:\s*selectedAssignmentId,\s*mode:\s*inputMode,\s*area\s*\}\s*\)/,
            'mémoire écrite : identifiants et choix d’écran seulement');
        const restore = src.slice(src.indexOf('readScanSession('), src.indexOf('readScanSession(') + 2600);
        assert.match(restore, /isEventEligibleForController\s*\(/, 'événement encore ouvert au contrôle');
        assert.match(restore, /setRestoreNotice\s*\(/, 'message quand la session n’est pas reprise');
        assert.match(restore, /clearScanSession\s*\(/, 'session non reprise effacée');
        assert.match(restore, /setInputMode\s*\(\s*memory\.mode\s*\)/, 'même mode');
        assert.match(restore, /setArea\s*\(\s*memory\.area\s*\)/, 'même onglet');
        assert.match(restore, /setStarted\s*\(\s*true\s*\)/, 'contrôle repris sans repasser par l’écran de choix');
        assert.match(functionBody(src, 'backToStart'), /clearScanSession\s*\(/, 'changement d’événement voulu : session oubliée');
    });

    test('scan partenaire : session relue, événement encore publié exigé, choix explicite sinon', () => {
        const src = code(PARTNER_PAGE);
        assert.match(src, /readScanSession\s*\(\s*SURFACE/, 'session retenue relue');
        assert.match(src, /saveScanSession\s*\(\s*SURFACE\s*,\s*accountId\s*,\s*\{\s*eventId,\s*assignmentId:\s*null,\s*mode:\s*scanMode,\s*area:\s*'controle'\s*\}\s*\)/,
            'mémoire écrite : identifiants et mode seulement');
        assert.match(src, /setScanMode\s*\(\s*memory\.mode\s*\)/, 'même mode');
        assert.match(src, /setRestoreNotice\s*\(/, 'message quand la session n’est pas reprise');
    });

    test('caméra : plus de redémarrage sans geste au retour, « Reprendre le contrôle », démarrage différé d’une session retrouvée', () => {
        const src = code(CAMERA);
        const visibility = balanced(src, src.search(/const\s+onVisibility\s*=/));
        assert.match(visibility, /stopCamera\s*\(/, 'arrière-plan : caméra libérée (D48)');
        assert.ok(!/startCamera\w*(?:\.current)?\s*\(/.test(visibility), 'retour au premier plan : aucune relance de la caméra sans geste');
        assert.match(src, /autoStart\s*\?\s*:\s*boolean/, 'prop autoStart');
        assert.match(src, /if\s*\(\s*autoStartRef\.current\s*\)\s*void\s+startCameraRef\.current\s*\(/, 'démarrage au montage seulement si autoStart');
        assert.match(src, /Reprendre le contrôle/, 'bouton « Reprendre le contrôle »');
        assert.match(src, /data-scan-camera=\{\s*phase\s*\}/, 'phase de la caméra exposée (data-scan-camera)');
        assert.match(src, /getTracks\s*\(\s*\)/, 'pistes réellement arrêtées');
        assert.match(src, /import\s*\(\s*['"]jsqr['"]\s*\)/, 'jsQR gardé (double décodeur)');
        assert.match(src, /@zxing\/browser/, 'ZXing gardé (double décodeur)');
        assert.ok(!/navigator\.vibrate\s*\(/.test(src), 'aucune vibration dans la caméra (D50)');
        for (const file of [SCANNER_PAGE, PARTNER_PAGE]) {
            const page = code(file);
            assert.match(page, /autoStart=\{\s*!resumeGate\s*\}/, `${file} : caméra différée pour une session retrouvée`);
            assert.match(page, /onResume=\{/, `${file} : le geste « Reprendre le contrôle » lève l’attente`);
        }
    });
});

// ── 7. Partenaire : chiffres du serveur ───────────────────────────────────

describe('A10 — scan partenaire : plus de liste tenue dans la page ; middleware ouvert à la seule lecture des chiffres', () => {
    test('aucun historique ni compteur local ; ScanHistoryList avec les chiffres servis', () => {
        const src = code(PARTNER_PAGE);
        assert.ok(!/Scans de la session/.test(src), 'liste « Scans de la session » supprimée');
        assert.ok(!/\bsetHistory\b|\bsetValidated\b|\bsetRefused\b/.test(src), 'aucun compteur ni historique tenu dans la page');
        assert.match(src, /<ScanHistoryList\b/, 'historique servi par le serveur (ScanHistoryList)');
    });

    test('middleware : GET /api/controller/scans dans la voie de contrôle partagée, chemin exact', () => {
        const src = code(MIDDLEWARE);
        const shared = /const\s+isSharedControlApi\s*=([\s\S]*?);/.exec(src);
        assert.ok(shared, 'isSharedControlApi introuvable');
        assert.match(shared[1], /pathname\s*===\s*['"]\/api\/controller\/scans['"]/, '/api/controller/scans partagé (chemin exact)');
        assert.ok(!/startsWith\s*\(\s*['"]\/api\/controller\/scans/.test(shared[1]), 'aucun préfixe /api/controller/scans… ouvert au partenaire');
    });

    test('module de mémoire : aucune donnée personnelle écrite (ni nom, ni téléphone, ni porteur)', () => {
        const src = code(SESSION_MODULE) + code(MEMORY_MODULE);
        assert.ok(!/\b(?:holder|phone|first_name|last_name|email)\b/i.test(src), 'aucun champ personnel dans la mémoire du contrôle');
    });
});

/**
 * Lot 7, tâche 7.2 (écran) — interface du scanner : aucun son, contrastes du résultat plein écran, vibrations
 * distinctes, clé d'idempotence et relances côté client, états réseau, thème sombre, caisse sur le système de
 * design, chiffres servis par le serveur (contrat, sections 6.1 et 6.2 ; décisions D39, D44, D45, D46, D47,
 * D50, D51, D52). Contrôles statiques (lecture des fichiers) et appels des modules purs dans le processus
 * (lib/hardware/feedback.ts, components/scan/scan-client.ts avec un fetch simulé) : aucune base nécessaire,
 * sauf les invariants de fin de suite.
 *  1. aucun son dans l'espace contrôleur (app/controller, app/partner/scan, components/scan, components/shifts,
 *     lib/hardware, lib/scanner, lib/scan) : ni Audio, ni AudioContext, ni synthèse vocale, ni balise audio, ni
 *     fichier audio ; public/sounds et lib/hardware/wolof-audio.ts supprimés ; aucun fichier audio sous public/ ;
 *     la préférence orpheline `event_village_wolof_muted` est retirée au démarrage du scanner (D52) ;
 *  2. jetons --scan-* de app/globals.css : chaque paire texte (-fg) / fond (-bg) ≥ 7:1 (calcul WCAG 2.x dans le
 *     test), valeurs identiques en clair et en sombre (D51) ; CombatFlashOverlay n'utilise que ces jetons, sans
 *     backdrop-blur, drop-shadow, zoom-, animate-bounce ni texte à opacité réduite ;
 *  3. lib/hardware/feedback.ts : vibrationPattern(catégorie) = [60] pour accepte, [120,60,120,60,120] pour
 *     deja_utilise, refuse et evenement_annule, [250,100,250] pour hors_fenetre, null pour
 *     technique (D47, D50) ; plus aucune vibration à la lecture dans CameraQrScanner.tsx ;
 *  4. components/scan/scan-client.ts : une clé crypto.randomUUID() par lecture envoyée dans Idempotency-Key,
 *     délais d'annulation (AbortController) de 4 000, 6 000 et 8 000 ms, relance avec la même clé sur coupure
 *     réseau, délai dépassé et 5xx seulement, jamais sur 4xx, Retry-After respecté ;
 *  5. états « Envoi… », « Réseau lent », « Hors ligne », attributs data-scan-state (pending|slow|offline|result)
 *     et data-scan-result, marques performance.mark('ev-scan:read'|'ev-scan:pending'|'ev-scan:result') ;
 *  6. app/controller/layout.tsx porte la classe `dark` et colorScheme: 'dark' (D45) ;
 *  7. ShiftModals sur Modal et Field, aucun `step=`, montants par lib/format, `import type` depuis
 *     lib/shifts/shift.service, aucun calcul d'écart ni de total dans le navigateur (D46), ShiftStatusBanner
 *     (code mort) supprimé ;
 *  8. plus de compteur de refus local (refusedCountMap) : historique et compteurs lus sur /api/controller/scans.
 * Rouge avant correctif (fix(7.2e)) : lib/hardware/wolof-audio.ts (new Audio), lib/hardware/feedback.ts
 * (AudioContext, oscillateurs), public/sounds/** ; aucun jeton --scan-* ; CombatFlashOverlay en palette brute
 * (bg-emerald-600, backdrop-blur-xs, drop-shadow, zoom-in-95, opacity-75) ; motifs de vibration du lot 4 et
 * navigator.vibrate(80) à la lecture (CameraQrScanner.tsx:163-170) ; scan-client sans clé, sans délai ni relance
 * (:114-128) ; aucun état réseau ; app/controller/layout.tsx sans thème sombre ; ShiftModals fait main
 * (step="500" :205, step="100" :383, écart calculé :274-276, import de valeur depuis shift.service :9) ;
 * refusedCountMap (app/controller/scanner/page.tsx:86).
 * Lot 8 : 8.2 e (renvoi seulement, contrat 7.1, L45) ; 8.2 v (cas portés de tests/legacy, déjà verts). Rouge avant
 * fix(8.2e-c) : postScan ignore replayOnly (components/scan/scan-client.ts:227-229) ; `not_processed` hors de l'union
 * jusqu'à fix(8.2e-s).
 * Interprétations (contrat muet, à reprendre au rapport) :
 *  - les jetons de texte se nomment --scan-<x>-fg, en face de --scan-<x>-bg (convention -fg / -bg des jetons
 *    du lot 5, app/globals.css:52-67) ; les cinq fonds attendus : accept, used, refuse, window, tech (cash retiré par A16, lot 9) ;
 *  - vibrationPattern reçoit le nom de catégorie du tableau du contrat (§6.2) ;
 *  - aucune vibration ailleurs que dans lib/hardware/feedback.ts (D50 : la vibration de lecture est supprimée).
 */
import '../helpers/env';
import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { detectScannerSupport } from '../../lib/scanner/support';
import { importModule } from './paiement-helpers';
import { assertTerrainInvariants } from './terrain-helpers';

after(async () => {
    await assertTerrainInvariants('scanner-interface');
});

const ROOT = process.cwd();

const CONTROLLER_SPACE = [
    'app/controller', 'app/partner/scan', 'components/scan', 'components/shifts', 'lib/hardware', 'lib/scanner', 'lib/scan',
];
const SOURCE_EXT = /\.(ts|tsx|js|jsx|mjs|cjs|css)$/;
const AUDIO_EXT = /\.(mp3|wav|ogg|m4a|aac|opus)$/i;

const SCANNER_PAGE = 'app/controller/scanner/page.tsx';
const PARTNER_SCAN_PAGE = 'app/partner/scan/page.tsx';
const OVERLAY = 'components/scan/CombatFlashOverlay.tsx';
const CAMERA = 'components/scan/CameraQrScanner.tsx';
const SCAN_CLIENT = 'components/scan/scan-client.ts';
const FEEDBACK = 'lib/hardware/feedback.ts';
const SHIFT_MODALS = 'components/shifts/ShiftModals.tsx';
const CONTROLLER_LAYOUT = 'app/controller/layout.tsx';
const GLOBALS = 'app/globals.css';

function rel(abs: string): string {
    return path.relative(ROOT, abs).replace(/\\/g, '/');
}

function exists(file: string): boolean {
    return fs.existsSync(path.resolve(ROOT, file));
}

function read(file: string): string {
    const abs = path.resolve(ROOT, file);
    assert.ok(fs.existsSync(abs), `fichier attendu absent : ${file}`);
    return fs.readFileSync(abs, 'utf8');
}

/** Fichiers d'un dossier (récursif) ; dossier absent : liste vide. */
function walk(dir: string, keep: (f: string) => boolean): string[] {
    const abs = path.resolve(ROOT, dir);
    if (!fs.existsSync(abs)) return [];
    if (fs.statSync(abs).isFile()) return keep(abs) ? [rel(abs)] : [];
    const out: string[] = [];
    const visit = (d: string) => {
        for (const e of fs.readdirSync(d, { withFileTypes: true })) {
            const full = path.join(d, e.name);
            if (e.isDirectory()) visit(full);
            else if (keep(full)) out.push(rel(full));
        }
    };
    visit(abs);
    return out.sort();
}

/**
 * Commentaires retirés (bloc et ligne ; un « // » précédé d'un caractère non blanc, comme dans une URL, est
 * gardé). Les sauts de ligne des blocs sont conservés : les numéros de ligne des fautes restent exacts.
 */
function stripComments(src: string): string {
    return src.replace(/\/\*[\s\S]*?\*\//g, (block) => block.replace(/[^\n]/g, '')).replace(/(^|\s)\/\/.*$/gm, '$1');
}

/** Lignes fautives `fichier:ligne (motif) extrait` d'une liste de fichiers. */
function offenders(files: string[], patterns: Array<[RegExp, string]>): string[] {
    const out: string[] = [];
    for (const f of files) {
        const lines = stripComments(fs.readFileSync(path.resolve(ROOT, f), 'utf8')).split(/\r?\n/);
        lines.forEach((line, i) => {
            for (const [re, why] of patterns) if (re.test(line)) out.push(`${f}:${i + 1} (${why}) ${line.trim().slice(0, 160)}`);
        });
    }
    return out;
}

/**
 * Page du scanner et modules qu'elle peut utiliser (components/scan, lib/scan, lib/hardware, lib/scanner) : un
 * écran découpé en composants ou en modules reste couvert.
 */
function scannerFiles(): string[] {
    return [SCANNER_PAGE, ...['components/scan', 'lib/scan', 'lib/hardware', 'lib/scanner'].flatMap((d) => walk(d, (f) => SOURCE_EXT.test(f)))];
}

function scannerSources(): string {
    return stripComments(scannerFiles().map(read).join('\n'));
}

// ── 1. Aucun son ───────────────────────────────────────────────────────────

describe('7.2 — aucun son dans l’espace contrôleur (D52)', () => {
    test('aucun Audio, AudioContext, webkitAudioContext, HTMLAudioElement, synthèse vocale, balise <audio> ni fichier audio cité', () => {
        const files = CONTROLLER_SPACE.flatMap((d) => walk(d, (f) => SOURCE_EXT.test(f)));
        assert.ok(files.includes(SCANNER_PAGE), `la page du scanner est dans le périmètre lu : ${files.length} fichier(s)`);
        const found = offenders(files, [
            [/\bnew\s+Audio\s*\(/, 'new Audio'],
            [/\bAudioContext\b/, 'AudioContext'],
            [/webkitAudioContext/, 'webkitAudioContext'],
            [/HTMLAudioElement/, 'HTMLAudioElement'],
            [/speechSynthesis/, 'speechSynthesis'],
            [/SpeechSynthesisUtterance/, 'SpeechSynthesisUtterance'],
            [/<audio\b/, 'balise audio'],
            [/\.(mp3|wav|ogg|m4a|aac|opus)\b/i, 'fichier audio'],
        ]);
        assert.deepEqual(found, [], `son encore présent dans l’espace contrôleur :\n${found.join('\n')}`);
    });

    test('public/sounds et lib/hardware/wolof-audio.ts supprimés ; aucun fichier audio sous public/', () => {
        assert.equal(exists('public/sounds'), false, 'public/sounds doit être supprimé (6 fichiers .mp3 du lot 4)');
        assert.equal(exists('lib/hardware/wolof-audio.ts'), false, 'lib/hardware/wolof-audio.ts doit être supprimé');
        const audio = walk('public', (f) => AUDIO_EXT.test(f));
        assert.deepEqual(audio, [], `fichiers audio sous public/ :\n${audio.join('\n')}`);
    });

    test('plus aucun appel du module audio ni bouton de son ; la préférence event_village_wolof_muted est retirée au démarrage du scanner', () => {
        const files = ['app', 'components', 'lib', 'hooks'].flatMap((d) => walk(d, (f) => /\.(ts|tsx)$/.test(f)));
        const found = offenders(files, [
            [/hardware\/wolof-audio/, 'import du module audio'],
            [/toggle-wolof-mute-btn|repeat-wolof-btn/, 'bouton de son'],
            [/\b(playWolofAudio|repeatLastWolofAudio|toggleWolofMuted|playAudioFeedback)\b/, 'lecture de son'],
        ]);
        assert.deepEqual(found, [], `restes de l’audio :\n${found.join('\n')}`);
        const src = stripComments(CONTROLLER_SPACE.flatMap((d) => walk(d, (f) => SOURCE_EXT.test(f))).map(read).join('\n'));
        assert.ok(/removeItem\(\s*['"]event_village_wolof_muted['"]\s*\)/.test(src),
            'le scanner retire la clé localStorage event_village_wolof_muted au démarrage (D52)');
    });
});

// ── 2. Contrastes du résultat plein écran ──────────────────────────────────

type Rgb = [number, number, number];

function parseColor(value: string, what: string): Rgb {
    const v = value.trim();
    let m = /^#([0-9a-f]{6})$/i.exec(v);
    if (m) return [0, 2, 4].map((i) => parseInt(m![1].slice(i, i + 2), 16)) as Rgb;
    m = /^#([0-9a-f]{3})$/i.exec(v);
    if (m) return [0, 1, 2].map((i) => parseInt(m![1][i] + m![1][i], 16)) as Rgb;
    m = /^(?:rgb\(\s*)?(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})\s*\)?$/.exec(v);
    if (m) return [Number(m[1]), Number(m[2]), Number(m[3])];
    assert.fail(`${what} : valeur de couleur illisible « ${value} » (#RRGGBB, #RGB, « r g b » ou rgb(r, g, b) attendus)`);
}

/** Rapport de contraste WCAG 2.x. */
function contrast(a: Rgb, b: Rgb): number {
    const lum = (c: Rgb) => {
        const [r, g, bl] = c.map((x) => {
            const s = x / 255;
            return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
        });
        return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
    };
    const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
}

/** Toutes les déclarations --scan-* de app/globals.css (clair, sombre et tout autre bloc), par nom. */
function scanTokens(): Map<string, string[]> {
    const css = read(GLOBALS).replace(/\/\*[\s\S]*?\*\//g, '');
    const out = new Map<string, string[]>();
    for (const m of Array.from(css.matchAll(/(--scan-[a-z0-9-]+)\s*:\s*([^;]+);/g))) {
        const list = out.get(m[1]) ?? [];
        list.push(m[2].trim());
        out.set(m[1], list);
    }
    return out;
}

const SCAN_TONES = ['accept', 'used', 'refuse', 'window', 'tech'] as const;

describe('7.2 — jetons --scan-* : texte ≥ 7:1, identiques en clair et en sombre (D51)', () => {
    test('les cinq paires --scan-<x>-fg / --scan-<x>-bg existent et chacune atteint 7:1', () => {
        const tokens = scanTokens();
        const ratios: string[] = [];
        for (const tone of SCAN_TONES) {
            const bg = tokens.get(`--scan-${tone}-bg`);
            const fg = tokens.get(`--scan-${tone}-fg`);
            assert.ok(bg && fg, `jetons --scan-${tone}-bg et --scan-${tone}-fg attendus dans ${GLOBALS} (trouvés : ${Array.from(tokens.keys()).join(', ') || 'aucun'})`);
            const ratio = contrast(parseColor(fg[0], `--scan-${tone}-fg`), parseColor(bg[0], `--scan-${tone}-bg`));
            ratios.push(`${tone} ${ratio.toFixed(2)}:1`);
            assert.ok(ratio >= 7, `--scan-${tone}-fg sur --scan-${tone}-bg : ${ratio.toFixed(2)}:1 < 7:1 (${fg[0]} / ${bg[0]})`);
        }
        console.log(`[SCANNER-CONTRASTES] ${ratios.join(' ; ')}`);
    });

    test('chaque jeton --scan-* a la même valeur partout (clair et sombre)', () => {
        const tokens = scanTokens();
        assert.ok(tokens.size > 0, `aucun jeton --scan-* dans ${GLOBALS}`);
        for (const [name, values] of Array.from(tokens.entries())) {
            const distinct = Array.from(new Set(values.map((v) => v.replace(/\s+/g, ' ').toLowerCase())));
            assert.equal(distinct.length, 1, `${name} : valeurs différentes selon le thème (${values.join(' | ')}) ; D51 les veut identiques`);
        }
    });

    test('CombatFlashOverlay n’utilise que les jetons du scanner : ni palette brute, ni flou, ni ombre portée, ni zoom, ni rebond, ni texte atténué', () => {
        const src = stripComments(read(OVERLAY));
        for (const tone of SCAN_TONES) {
            assert.ok(new RegExp(`scan-${tone}\\b`).test(src), `${OVERLAY} : jeton scan-${tone} utilisé (fond du résultat)`);
        }
        const palette = 'slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose';
        const found = offenders([OVERLAY], [
            [new RegExp(`\\b(?:bg|text|border|ring|from|via|to|fill|stroke|shadow|outline|decoration)-(?:${palette})-\\d{2,3}\\b`), 'couleur de palette brute'],
            [/\b(?:bg|text|border)-(?:white|black)\b/, 'blanc ou noir en dur'],
            [/#[0-9a-fA-F]{3,8}\b/, 'couleur hexadécimale'],
            [/backdrop-blur/, 'backdrop-blur'],
            [/drop-shadow/, 'drop-shadow'],
            [/\bzoom-/, 'zoom'],
            [/animate-bounce/, 'animate-bounce'],
            [/\bopacity-\d/, 'opacité réduite'],
            [/\btext-[a-z0-9-]+\/\d{1,3}\b/, 'texte à opacité réduite'],
            [/\bbg-(?:white|black)\/\d/, 'voile semi-transparent'],
        ]);
        assert.deepEqual(found, [], `${OVERLAY} hors des jetons du scanner :\n${found.join('\n')}`);
        assert.equal((src.match(/role\s*=\s*["']alert["']/g) ?? []).length, 1, `${OVERLAY} : un seul role="alert"`);
    });
});

// ── 3. Vibrations ──────────────────────────────────────────────────────────

describe('7.2 — vibrations distinctes, aucune pour un incident technique (D47, D50)', () => {
    test('vibrationPattern : accepte [60] ; deja_utilise, refuse, evenement_annule [120,60,120,60,120] ; hors_fenetre [250,100,250] ; technique null', async () => {
        const mod = await importModule('../../lib/hardware/feedback');
        assert.equal(typeof mod.vibrationPattern, 'function', `${FEEDBACK} : vibrationPattern(catégorie) exportée (contrat 6.1, test 3)`);
        const expected: Record<string, number[] | null> = {
            accepte: [60],
            deja_utilise: [120, 60, 120, 60, 120],
            refuse: [120, 60, 120, 60, 120],
            evenement_annule: [120, 60, 120, 60, 120],
            hors_fenetre: [250, 100, 250],
            technique: null,
        };
        for (const [category, pattern] of Object.entries(expected)) {
            assert.deepEqual(mod.vibrationPattern(category), pattern, `vibrationPattern('${category}')`);
        }
        assert.notDeepEqual(mod.vibrationPattern('accepte'), mod.vibrationPattern('refuse'), 'accepté et refusé : motifs différents');
    });

    test('plus de vibration à la lecture dans CameraQrScanner ; navigator.vibrate seulement dans lib/hardware/feedback.ts', () => {
        assert.ok(!/\bvibrate\s*\(/.test(stripComments(read(CAMERA))), `${CAMERA} : la vibration de 80 ms à la lecture est supprimée (D50)`);
        const files = CONTROLLER_SPACE.flatMap((d) => walk(d, (f) => SOURCE_EXT.test(f))).filter((f) => f !== FEEDBACK);
        const found = offenders(files, [[/\.vibrate\s*\(/, 'vibration hors du module de retour']]);
        assert.deepEqual(found, [], `vibrations hors de ${FEEDBACK} :\n${found.join('\n')}`);
    });
});

// ── 4. Client du scan : clé, délais, relances ──────────────────────────────

interface FetchCall { url: string; key: string | null; signal: unknown; at: number; body: unknown }
type FetchStep = { status: number; body?: Record<string, unknown>; headers?: Record<string, string> } | 'network';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const VALID_BODY = { result: 'valid', scan_id: '00000000-0000-4000-8000-000000000001', message: 'Entrée validée', replayed: false };

/**
 * Lance postScan avec un fetch simulé qui rejoue `steps` dans l'ordre (le dernier se répète), un navigator en
 * ligne et un window minimal ; rétablit les globaux ensuite. Renvoie le résultat et les appels observés.
 */
async function withFakeFetch(steps: FetchStep[], run: (client: Record<string, (...a: unknown[]) => Promise<Record<string, unknown>>>) => Promise<Record<string, unknown>[]>): Promise<{ outcomes: Record<string, unknown>[]; calls: FetchCall[] }> {
    const client = await importModule('../../components/scan/scan-client');
    assert.equal(typeof client.postScan, 'function', `${SCAN_CLIENT} : postScan exporté`);
    const calls: FetchCall[] = [];
    const saved = {
        fetch: Object.getOwnPropertyDescriptor(globalThis, 'fetch'),
        navigator: Object.getOwnPropertyDescriptor(globalThis, 'navigator'),
        window: Object.getOwnPropertyDescriptor(globalThis, 'window'),
    };
    Object.defineProperty(globalThis, 'fetch', {
        configurable: true, writable: true,
        value: async (input: unknown, init: { headers?: HeadersInit; signal?: unknown; body?: unknown } = {}) => {
            const step = steps[Math.min(calls.length, steps.length - 1)];
            calls.push({ url: String(input), key: new Headers(init.headers ?? {}).get('idempotency-key'), signal: init.signal, at: Date.now(), body: typeof init.body === 'string' ? JSON.parse(init.body) : null });
            if (step === 'network') throw new TypeError('fetch failed (réseau coupé simulé)');
            return new Response(JSON.stringify(step.body ?? {}), { status: step.status, headers: { 'content-type': 'application/json', ...(step.headers ?? {}) } });
        },
    });
    Object.defineProperty(globalThis, 'navigator', { configurable: true, writable: true, value: { onLine: true, userAgent: 'node-test' } });
    Object.defineProperty(globalThis, 'window', { configurable: true, writable: true, value: globalThis });
    try {
        const outcomes = await run(client);
        return { outcomes, calls };
    } finally {
        for (const [name, desc] of Object.entries(saved)) {
            if (desc) Object.defineProperty(globalThis, name, desc);
            else delete (globalThis as unknown as Record<string, unknown>)[name];
        }
    }
}

function request(): Record<string, unknown> {
    return { eventId: randomUUID(), payload: `EVT1:${randomUUID()}:123456` };
}

function assertSameKey(calls: FetchCall[], label: string): void {
    assert.ok(calls.length > 0, `${label} : aucun appel`);
    assert.ok(calls.every((c) => typeof c.key === 'string' && UUID.test(c.key)), `${label} : en-tête Idempotency-Key = UUID à chaque envoi (${calls.map((c) => c.key).join(', ')})`);
    assert.equal(new Set(calls.map((c) => c.key)).size, 1, `${label} : la relance garde la même clé (${calls.map((c) => c.key).join(', ')})`);
}

describe('7.2 — components/scan/scan-client.ts : clé par lecture, délais, relances (D39, contrat 6.1 test 4)', () => {
    test('source : crypto.randomUUID(), AbortController, délais [4000, 6000, 8000], en-tête Idempotency-Key, Retry-After lu', () => {
        const src = stripComments(read(SCAN_CLIENT));
        assert.ok(/crypto\.randomUUID\(\)/.test(src), `${SCAN_CLIENT} : clé crypto.randomUUID()`);
        assert.ok(/\bAbortController\b/.test(src), `${SCAN_CLIENT} : AbortController (délai maximal par essai)`);
        assert.ok(/\[\s*4_?000\s*,\s*6_?000\s*,\s*8_?000\s*\]/.test(src), `${SCAN_CLIENT} : délais par essai de 4 000, 6 000 et 8 000 ms`);
        assert.ok(/['"]Idempotency-Key['"]/i.test(src), `${SCAN_CLIENT} : en-tête Idempotency-Key envoyé`);
        assert.ok(/retry-after/i.test(src), `${SCAN_CLIENT} : en-tête Retry-After lu`);
    });

    test('une clé UUID neuve par lecture, envoyée avec un signal d’annulation', async () => {
        const { outcomes, calls } = await withFakeFetch([{ status: 200, body: VALID_BODY }], async (c) => [await c.postScan(request()), await c.postScan(request())]);
        assert.deepEqual(outcomes.map((o) => o.result), ['valid', 'valid'], 'deux lectures acceptées');
        assert.equal(calls.length, 2, 'un envoi par lecture (pas de relance après un 200)');
        assert.ok(calls.every((c) => typeof c.key === 'string' && UUID.test(c.key)), `Idempotency-Key = UUID (${calls.map((c) => c.key).join(', ')})`);
        assert.notEqual(calls[0].key, calls[1].key, 'deux lectures : deux clés différentes');
        assert.ok(calls.every((c) => c.signal instanceof AbortSignal), 'chaque envoi porte le signal d’un AbortController (délai maximal)');
    });

    test('coupure réseau puis succès : relance automatique avec la même clé, verdict valid', async () => {
        const { outcomes, calls } = await withFakeFetch(['network', { status: 200, body: VALID_BODY }], async (c) => [await c.postScan(request())]);
        assert.equal(calls.length, 2, `relance après une coupure réseau (appels : ${calls.length})`);
        assertSameKey(calls, 'coupure réseau');
        assert.equal(outcomes[0].result, 'valid', `verdict de la relance : ${JSON.stringify(outcomes[0])}`);
    });

    test('503 puis succès : relance avec la même clé ; 503 avec Retry-After: 1 → relance au plus tôt 1 s après', async () => {
        const first = await withFakeFetch([{ status: 503, body: { result: 'server_error', error: 'Contrôle momentanément indisponible.' } }, { status: 200, body: VALID_BODY }], async (c) => [await c.postScan(request())]);
        assert.equal(first.calls.length, 2, `relance après un 503 (appels : ${first.calls.length})`);
        assertSameKey(first.calls, '503');
        assert.equal(first.outcomes[0].result, 'valid', JSON.stringify(first.outcomes[0]));
        const paced = await withFakeFetch([{ status: 503, body: { result: 'server_error' }, headers: { 'Retry-After': '1' } }, { status: 200, body: VALID_BODY }], async (c) => [await c.postScan(request())]);
        assert.equal(paced.calls.length, 2, `relance après un 503 avec Retry-After (appels : ${paced.calls.length})`);
        assertSameKey(paced.calls, '503 avec Retry-After');
        const waited = paced.calls[1].at - paced.calls[0].at;
        assert.ok(waited >= 950, `Retry-After: 1 respecté : relance ${waited} ms après le refus (≥ 1 000 ms attendu)`);
    });

    test('4xx jamais relancés : 400, 403, 409 et 429 → un seul envoi (avec sa clé) ; 429 → rate_limited', async () => {
        for (const status of [400, 403, 409, 429]) {
            const body = status === 429 ? { result: 'rate_limited', retry_after_seconds: 2 } : status === 409 ? { result: 'already_used', code: 'CASH_ALREADY_PROCESSED' } : { error: 'Refus.' };
            const { outcomes, calls } = await withFakeFetch([{ status, body, headers: status === 429 ? { 'Retry-After': '2' } : {} }, { status: 200, body: VALID_BODY }], async (c) => [await c.postScan(request())]);
            assert.equal(calls.length, 1, `HTTP ${status} : aucune relance (appels : ${calls.length})`);
            assertSameKey(calls, `HTTP ${status}`);
            assert.notEqual(outcomes[0].result, 'valid', `HTTP ${status} : jamais le verdict d’une relance`);
            if (status === 429) assert.equal(outcomes[0].result, 'rate_limited', `429 : rate_limited, ${JSON.stringify(outcomes[0])}`);
        }
    });

    test('réseau coupé à chaque essai : trois essais (délais de 4, 6 et 8 s), même clé, puis incident technique network_error', async () => {
        const { outcomes, calls } = await withFakeFetch(['network'], async (c) => [await c.postScan(request())]);
        assert.equal(calls.length, 3, `trois essais au plus (appels : ${calls.length})`);
        assertSameKey(calls, 'coupures répétées');
        assert.equal(outcomes[0].result, 'network_error', `incident technique, jamais un verdict sur le billet : ${JSON.stringify(outcomes[0])}`);
    });
});

// ── 4 bis. Lot 8, tâche 8.2 e : renvoi seulement (contrat 7.1, L45) ─────────

const NOT_PROCESSED_BODY = { result: 'not_processed', replayed: false, code: 'REPLAY_NOT_FOUND', message: 'Scan non traité : aucune entrée enregistrée. Scannez le billet de nouveau.' };

/** Texte de chaque appel de runScan (runScan ou runScanRef.current) : ses arguments de premier niveau. */
function runScanCalls(src: string): string[][] {
    const calls: string[][] = [];
    for (const m of Array.from(src.matchAll(/\brunScan(?:Ref\.current)?\s*\(/g))) {
        const args: string[] = [];
        let depth = 0;
        let start = m.index + m[0].length;
        for (let i = start; i < src.length; i++) {
            const ch = src[i];
            if ('([{'.includes(ch)) depth += 1;
            else if (')]}'.includes(ch) && depth > 0) depth -= 1;
            else if (ch === ',' && depth === 0) {
                args.push(src.slice(start, i).trim());
                start = i + 1;
            } else if (ch === ')') {
                args.push(src.slice(start, i).trim());
                break;
            }
        }
        calls.push(args);
    }
    return calls;
}

describe('8.2 e — renvoi seulement côté client (contrat 7.1, L45)', () => {
    test('postScan(..., { replayOnly: true }) envoie { eventId, replayOnly: true }, sans le code, à chaque relance et avec la clé d’origine', async () => {
        const req = request();
        const key = randomUUID();
        const { outcomes, calls } = await withFakeFetch(
            ['network', { status: 503, body: { result: 'server_error' } }, { status: 200, body: NOT_PROCESSED_BODY }],
            async (c) => [await c.postScan(req, { key, replayOnly: true })]);
        assert.equal(calls.length, 3, `deux relances (appels : ${calls.length})`);
        assert.ok(calls.every((c) => c.key === key), `clé d’origine à chaque envoi : ${calls.map((c) => c.key).join(', ')}`);
        calls.forEach((call, i) => assert.deepEqual(call.body, { eventId: req.eventId, replayOnly: true }, `essai ${i + 1} : corps du renvoi`));
        assert.equal(outcomes[0].result, 'not_processed', `verdict du renvoi : ${JSON.stringify(outcomes[0])}`);
    });

    test('saisie manuelle reprise : le numéro de billet n’est pas renvoyé non plus', async () => {
        const req = { eventId: randomUUID(), manualTicketNumber: 'TCK-RENVOI', identityVerified: true };
        const { calls } = await withFakeFetch([{ status: 200, body: VALID_BODY }], async (c) => [await c.postScan(req, { key: randomUUID(), replayOnly: true })]);
        assert.deepEqual(calls[0].body, { eventId: req.eventId, replayOnly: true }, 'corps du renvoi d’une saisie manuelle');
    });

    test('(V) postScan normal : corps inchangé, aucun indicateur, relance comprise ; replayOnly: false pareil', async () => {
        const req = request();
        const { calls } = await withFakeFetch(['network', { status: 200, body: VALID_BODY }], async (c) => [await c.postScan(req)]);
        assert.equal(calls.length, 2, `une relance (appels : ${calls.length})`);
        for (const call of calls) assert.deepEqual(call.body, req, 'corps de la lecture, sans replayOnly');
        const off = await withFakeFetch([{ status: 200, body: VALID_BODY }], async (c) => [await c.postScan(req, { replayOnly: false })]);
        assert.deepEqual(off.calls[0].body, req, 'replayOnly: false : corps de la lecture, sans replayOnly');
    });

    test('not_processed : incident technique, verdict reçu (aucune boucle de renvoi), ni refus de billet ni vibration', async () => {
        const { outcomes } = await withFakeFetch([{ status: 200, body: NOT_PROCESSED_BODY }], async (c) => [await c.postScan(request(), { replayOnly: true })]);
        const outcome = outcomes[0];
        assert.equal(outcome.result, 'not_processed', `résultat lu par le client : ${JSON.stringify(outcome)}`);
        assert.equal(outcome.failure, undefined, `réponse 200 du contrat, pas une panne : ${JSON.stringify(outcome)}`);
        const client = await importModule('../../components/scan/scan-client');
        assert.equal(client.isTechnicalOutcome(outcome), true, 'incident technique');
        assert.equal(client.isTicketRefusal(outcome), false, 'jamais compté comme refus de billet');
        assert.equal(client.categoryFor(outcome), 'technique', 'catégorie technique : écran neutre, aucune vibration');
        const session = await importModule('../../lib/scan/scan-session');
        assert.equal(session.isVerdictReceived(outcome), true, 'verdict reçu : le scan en attente est effacé, jamais renvoyé en boucle');
    });

    for (const file of [SCANNER_PAGE, PARTNER_SCAN_PAGE]) {
        test(`${file} : runScan envoie replayOnly seulement pour un scan repris (4e paramètre renseigné)`, () => {
            const src = stripComments(read(file));
            const start = src.search(/const\s+runScan\s*=\s*useCallback\(/);
            assert.ok(start >= 0, `${file} : runScan introuvable`);
            const run = src.slice(start, src.indexOf('const runScanRef', start));
            const params = /async\s*\(([^)]*)\)/.exec(run)?.[1].split(',').map((p) => p.trim()) ?? [];
            assert.equal(params.length, 4, `${file} : paramètres de runScan : ${params.join(' ; ')}`);
            const name = /^\w+/.exec(params[3])?.[0];
            // Contrat 7.1 : `createdAt !== undefined`. Le code nomme ce paramètre recoveredAt, avec null par défaut : le
            // comparer à undefined marquerait TOUTE lecture comme un renvoi, et plus aucun billet ne serait composté.
            const absent = /=\s*null$/.test(params[3]) ? 'null' : 'undefined';
            assert.match(run, new RegExp(`postScan\\s*\\(\\s*request\\s*,\\s*\\{[^}]*\\breplayOnly\\s*:\\s*${name}\\s*!==\\s*${absent}\\b`),
                `${file} : postScan(request, { …, replayOnly: ${name} !== ${absent} })`);
        });

        test(`(V) ${file} : seule la reprise passe l’heure de la lecture d’origine à runScan`, () => {
            const calls = runScanCalls(stripComments(read(file)));
            assert.ok(calls.length >= 3, `${file} : appels de runScan trouvés : ${calls.length}`);
            const withHour = calls.filter((args) => args.length >= 4);
            assert.deepEqual(withHour.map((args) => args[3]), ['pending.createdAt'], `${file} : un seul appel à quatre arguments, celui de resumePendingScan`);
        });
    }
});

// ── 5. États réseau et marques de mesure ───────────────────────────────────

describe('7.2 — états « Envoi… », « Réseau lent », « Hors ligne » et marques de mesure (contrat 6.1 test 5)', () => {
    test('textes des trois états réseau présents dans le scanner', () => {
        const src = scannerSources();
        assert.ok(/Envoi(?:…|\.\.\.)/.test(src), 'état « Envoi… »');
        assert.ok(/Réseau lent/.test(src), 'état « Réseau lent »');
        assert.ok(/Hors ligne/.test(src), 'état « Hors ligne »');
    });

    test('attributs data-scan-state (pending, slow, offline, result) et data-scan-result', () => {
        const src = scannerSources();
        assert.ok(/data-scan-state/.test(src), 'attribut data-scan-state');
        for (const state of ['pending', 'slow', 'offline', 'result']) {
            assert.ok(new RegExp(`['"\`]${state}['"\`]`).test(src), `valeur « ${state} » de data-scan-state`);
        }
        assert.ok(/data-scan-result/.test(src), 'attribut data-scan-result');
    });

    test('marques performance.mark ev-scan:read, ev-scan:pending, ev-scan:result', () => {
        const src = scannerSources();
        assert.ok(/performance\.mark\s*\(/.test(src), 'performance.mark appelé');
        for (const mark of ['ev-scan:read', 'ev-scan:pending', 'ev-scan:result']) {
            assert.ok(src.includes(`'${mark}'`) || src.includes(`"${mark}"`) || src.includes(`\`${mark}\``), `marque ${mark}`);
        }
    });
});

// ── 6. Thème sombre forcé ──────────────────────────────────────────────────

describe('7.2 — thème sombre forcé sur /controller/* (D45)', () => {
    test('app/controller/layout.tsx : classe dark et colorScheme: \'dark\'', () => {
        const src = stripComments(read(CONTROLLER_LAYOUT));
        const classTokens = Array.from(src.matchAll(/className\s*=\s*\{?\s*["'`]([^"'`]*)["'`]/g)).flatMap((m) => m[1].split(/\s+/));
        assert.ok(classTokens.includes('dark'), `${CONTROLLER_LAYOUT} : classe « dark » sur la racine`);
        assert.ok(/colorScheme\s*:\s*['"]dark['"]/.test(src), `${CONTROLLER_LAYOUT} : style colorScheme: 'dark'`);
    });
});

// ── 7. Caisse sur le système de design ─────────────────────────────────────

describe('7.2 — ShiftModals sur le système de design, chiffres du serveur (D46)', () => {
    test('Modal et Field, montants par lib/format, import type depuis shift.service, ShiftStatusBanner supprimé', () => {
        const src = stripComments(read(SHIFT_MODALS));
        assert.ok(/from\s+['"]@\/components\/ui\/Modal['"]/.test(src), `${SHIFT_MODALS} : modales sur components/ui/Modal`);
        assert.ok(/from\s+['"]@\/components\/ui\/Field['"]/.test(src), `${SHIFT_MODALS} : champs sur components/ui/Field`);
        assert.ok(/from\s+['"]@\/lib\/format['"]/.test(src), `${SHIFT_MODALS} : montants et dates par lib/format`);
        const imports = Array.from(src.matchAll(/import\s+(type\s+)?[^;]*?from\s+['"]@\/lib\/shifts\/shift\.service['"]/g));
        assert.ok(imports.length > 0, `${SHIFT_MODALS} : types importés de lib/shifts/shift.service`);
        assert.ok(imports.every((m) => Boolean(m[1])), `${SHIFT_MODALS} : import type seulement depuis lib/shifts/shift.service (aucun code serveur dans le navigateur)`);
        assert.ok(!/\bShiftStatusBanner\b/.test(src), `${SHIFT_MODALS} : ShiftStatusBanner (code mort, remplacé par ScannerShiftBanner) supprimé`);
    });

    test('aucun step= sur les montants, aucun toLocaleString, aucun calcul d’écart ni de total attendu dans le navigateur', () => {
        const found = offenders([SHIFT_MODALS], [
            [/\bstep\s*=/, 'step sur un montant (refuse 2 750 F)'],
            [/toLocaleString\s*\(/, 'format local hors lib/format'],
            [/\b\w*(?:declared|expected|opening|float|counted)\w*\s*[-+]\s*\w*(?:declared|expected|opening|float|counted)\w*/i, 'écart ou total calculé dans le navigateur'],
        ]);
        assert.deepEqual(found, [], `${SHIFT_MODALS} :\n${found.join('\n')}`);
    });
});

// ── 7 bis. Lot 8, tâche 8.2 v : cas portés de tests/legacy (déjà verts, annoncés) ──

describe('8.2 v — cas portés de camera-qr-scanner et scanner-security-hardening (V, garde-fous)', () => {
    const camera = { mediaDevices: { getUserMedia: async () => ({}) } };

    test('detectScannerSupport : contexte sûr, getUserMedia et BarcodeDetector → native', () => {
        const r = detectScannerSupport({ isSecureContext: true, navigator: camera, BarcodeDetector: class {} });
        assert.deepEqual(r, { mode: 'native', hasGetUserMedia: true, hasBarcodeDetector: true, isSecureContext: true });
    });

    test('detectScannerSupport : getUserMedia sans BarcodeDetector (Safari, Firefox) → zxing', () => {
        const r = detectScannerSupport({ isSecureContext: true, navigator: camera });
        assert.deepEqual(r, { mode: 'zxing', hasGetUserMedia: true, hasBarcodeDetector: false, isSecureContext: true });
    });

    test('detectScannerSupport : contexte non sûr, ou sans getUserMedia, ou hors navigateur → manual_only, avec la raison', () => {
        const insecure = detectScannerSupport({ isSecureContext: false, location: { protocol: 'http:', hostname: '192.168.1.50' }, navigator: camera, BarcodeDetector: class {} });
        assert.equal(insecure.mode, 'manual_only', 'contexte non sûr');
        assert.equal(insecure.isSecureContext, false, 'contexte non sûr');
        assert.match(insecure.reason ?? '', /HTTPS requis/, 'contexte non sûr : raison affichée');
        const noCamera = detectScannerSupport({ isSecureContext: true, navigator: {} });
        assert.equal(noCamera.mode, 'manual_only', 'sans getUserMedia');
        assert.equal(noCamera.hasGetUserMedia, false, 'sans getUserMedia');
        assert.match(noCamera.reason ?? '', /getUserMedia/, 'sans getUserMedia : raison affichée');
        const server = detectScannerSupport(null);
        assert.equal(server.mode, 'manual_only', 'hors navigateur');
        assert.equal(server.isSecureContext, false, 'hors navigateur');
    });

    test('constantes caméra : cadence de lecture entre 120 et 150 ms, veille après 3 min sans lecture (D48)', async () => {
        const mod = await importModule('../../components/scan/CameraQrScanner');
        assert.ok(mod.CAMERA_SCAN_THROTTLE_MS >= 120 && mod.CAMERA_SCAN_THROTTLE_MS <= 150, `CAMERA_SCAN_THROTTLE_MS = ${mod.CAMERA_SCAN_THROTTLE_MS}`);
        assert.equal(mod.CAMERA_INACTIVITY_TIMEOUT_MS, 180_000, 'veille de la caméra : 3 min (D48 ; la valeur de 45 s du test legacy est périmée)');
    });
});

// ── 8. Chiffres servis par le serveur ──────────────────────────────────────

describe('7.2 — historique et compteurs lus sur /api/controller/scans (D42, règle du lot 5)', () => {
    test('plus de refusedCountMap ; le scanner lit /api/controller/scans', () => {
        const src = scannerSources();
        assert.ok(!/refusedCountMap/.test(src), `${SCANNER_PAGE} : compteur de refus local supprimé`);
        assert.ok(/\/api\/controller\/scans(?=[?'"`])/.test(src), 'historique et compteurs lus sur /api/controller/scans');
    });
});

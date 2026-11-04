/**
 * Lot 7 (contrat, section 11.6 ; tâche 7.5, décisions D76 et D83) — projet Playwright « perf » : premier affichage
 * utile et JavaScript chargé, sur mobile en 4G simulée et processeur ralenti ×4, pour l'accueil, la page
 * événement, Mes billets et le scanner (comptes et données du seed de démonstration).
 *
 * Conditions : contexte NEUF par passage (cache vide), service workers bloqués, SANS context.route (le routage
 * de Playwright désactive le cache et passe par le domaine Fetch de CDP : la mesure serait faussée) ; hôtes
 * externes bloqués par CDP `Network.setBlockedURLs` (tuiles OpenStreetMap, images Unsplash) ; réseau
 * `Network.emulateNetworkConditions` 4G (D83) et `Emulation.setCPUThrottlingRate { rate: 4 }`. Aucune horloge.
 * Contrôle de cohérence BLOQUANT : le plus gros fichier /_next/static/ met au moins taille ÷ débit entre
 * requestStart et responseEnd, sinon « bridage non appliqué ».
 *
 * Mesures (script d'initialisation, sans toucher au produit) : FCP, LCP (relus à + 3 s, avant toute interaction ;
 * un FCP ou un LCP que Chromium n'émet pas est expliqué dans la colonne note_fcp_lcp du TSV),
 * premier affichage utile (premier requestAnimationFrame après l'apparition du marqueur de l'écran),
 * JavaScript transféré (encodedBodySize des /_next/static/**.js) (a) arrivé avant le marqueur et (b) à + 3 s,
 * CSS, total, et recoupement par les réponses réseau (taille du corps reçue). Scanner : deux relevés, avant la
 * caméra (marqueur de l'écran) puis caméra lancée (flux vidéo en lecture, repli ZXing sans BarcodeDetector)
 * et JavaScript à + 3 s. 5 passages par écran : médiane et maximum.
 * Sorties : .e2e-captures/perf/perf.tsv (une ligne par passage, puis médiane et maximum) et perf.txt
 * (lignes ajoutées : le dossier est vidé au début de `npm run e2e`, scripts/e2e/run-e2e.mjs).
 *
 * Ce qui bloque : bridage non appliqué ; marqueur introuvable ; JS (a) au-dessus du budget post-build de la
 * route (scripts/js-budget.json, écrit par fix(7.5)) + 20 Ko — tant que ce fichier est absent ou n'a pas la
 * route, la mesure est seulement imprimée (mesure « avant », commit test(e2e)[7]).
 * Ce qui avertit ([PERF-AVERTISSEMENT]) : premier affichage utile médian > 3 s, LCP médian > 4 s.
 *
 * Marqueurs (vague F, fix(7.7)) : balisage des écrans committés du lot 7. Scanner : écran « Commencer le contrôle »
 * (ScannerStartScreen, D49) : bouton radio d'un événement à contrôler ou bouton « Commencer le contrôle » ; les
 * identifiants du lot 6 (#scanner-event-title, #scanner-event-select) n'existent plus et sont retirés. Un marqueur
 * introuvable fait échouer le passage avec la liste des sélecteurs.
 */
import fs from 'node:fs';
import path from 'node:path';
import type { Browser, Page, TestInfo } from '@playwright/test';
import { test, expect, projectContextOptions } from './support/fixtures';
import { requireStorageState, type RoleKey } from './support/accounts';
import { readDemoIds } from './support/demo-ids';
import { cdpNetworkConditions, NET_4G } from './support/devices';
import { installFakeCamera } from './support/fake-camera';
import { appendPerfFile, fmtMs, median } from './support/terrain';

const PASSES = 5;
const BUDGET_FILE = path.resolve(process.cwd(), 'scripts', 'js-budget.json');
const BUDGET_TOLERANCE = 20_000; // octets (1 Ko = 1 000 octets, comme scripts/js-budget.mjs)
const BLOCKED_URLS = ['*tile.openstreetmap.org*', '*unsplash.com*'];

interface Screen {
    id: string;
    libelle: string;
    role: 'anonyme' | RoleKey;
    path: () => string;
    /** Route de scripts/js-budget.json. */
    budgetRoute: string;
    /** Marqueur d'affichage utile : premier sélecteur visible, ou bouton dont le texte contient l'une des chaînes. */
    selectors: string[];
    buttonTexts?: string[];
    camera?: boolean;
}

const SCREENS: Screen[] = [
    {
        id: 'accueil', libelle: 'Accueil', role: 'anonyme', path: () => '/', budgetRoute: '/',
        selectors: ['section[aria-labelledby="affiche-titre"] h3', 'section[aria-labelledby="affiche-titre"] .border-dashed'],
    },
    {
        id: 'evenement', libelle: 'Page événement', role: 'anonyme', path: () => `/events/${readDemoIds().events.ceSoir.id}`, budgetRoute: '/events/[id]',
        selectors: ['main h1', 'h1'],
    },
    {
        id: 'mes-billets', libelle: 'Mes billets', role: 'client', path: () => '/tickets', budgetRoute: '/tickets',
        selectors: ['article[aria-label^="Billet pour"]', 'main .border-dashed'],
    },
    {
        id: 'scanner', libelle: 'Scanner', role: 'controleur', path: () => '/controller/scanner', budgetRoute: '/controller/scanner',
        selectors: ['fieldset input[type="radio"]'], buttonTexts: ['commencer le contrôle'], camera: true,
    },
];

interface PerfState {
    fcp: number | null;
    lcp: number | null;
    lcpCount: number;
    useful: number | null;
    usefulBy: string | null;
    /** Premier passage de la page à l'état masqué (0 : masquée dès le chargement) ; null : jamais masquée. */
    hiddenAt: number | null;
    /** Documents chargés dans l'onglet depuis le début du passage (> 1 : navigation complète ou rechargement). */
    docs: number | null;
    observers: string | null;
}

/** Script d'initialisation (sérialisé : aucune référence extérieure). */
function installPerfProbe(arg: { selectors: string[]; buttonTexts: string[] }): void {
    const state: PerfState = { fcp: null, lcp: null, lcpCount: 0, useful: null, usefulBy: null, hiddenAt: null, docs: null, observers: null };
    (window as unknown as { __evPerf: PerfState }).__evPerf = state;
    try {
        const n = Number(window.sessionStorage.getItem('__evPerfDocs') ?? '0') + 1;
        window.sessionStorage.setItem('__evPerfDocs', String(n));
        state.docs = n;
    } catch (err) {
        console.warn(`[e2e][perf] compteur de documents indisponible : ${err instanceof Error ? err.message : String(err)}`);
    }
    if (document.visibilityState === 'hidden') state.hiddenAt = 0;
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden' && state.hiddenAt === null) state.hiddenAt = performance.now();
    }, true);
    try {
        performance.setResourceTimingBufferSize(2000);
    } catch (err) {
        console.warn(`[e2e][perf] tampon Resource Timing non agrandi : ${err instanceof Error ? err.message : String(err)}`);
    }
    try {
        new PerformanceObserver((list) => {
            for (const e of list.getEntries()) if (e.name === 'first-contentful-paint' && state.fcp === null) state.fcp = e.startTime;
        }).observe({ type: 'paint', buffered: true });
        new PerformanceObserver((list) => {
            const entries = list.getEntries();
            state.lcpCount += entries.length;
            const last = entries[entries.length - 1];
            if (last) state.lcp = last.startTime;
        }).observe({ type: 'largest-contentful-paint', buffered: true });
        state.observers = 'paint,largest-contentful-paint';
    } catch (err) {
        state.observers = `indisponibles : ${err instanceof Error ? err.message : String(err)}`;
        console.warn(`[e2e][perf] observateurs de performance indisponibles : ${err instanceof Error ? err.message : String(err)}`);
    }
    let found = false;
    const visible = (el: Element): boolean => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0;
    };
    const check = (): void => {
        if (found) return;
        let hit: string | null = null;
        for (const sel of arg.selectors) {
            const el = document.querySelector(sel);
            if (el && visible(el)) { hit = sel; break; }
        }
        if (!hit && arg.buttonTexts.length > 0) {
            for (const b of Array.from(document.querySelectorAll('button'))) {
                const t = (b.textContent ?? '').toLowerCase();
                const needle = arg.buttonTexts.find((x) => t.includes(x));
                if (needle && visible(b)) { hit = `bouton « ${needle} »`; break; }
            }
        }
        if (!hit) return;
        found = true;
        state.usefulBy = hit;
        requestAnimationFrame(() => { state.useful = performance.now(); });
    };
    const start = (): void => {
        new MutationObserver(check).observe(document.documentElement, { childList: true, subtree: true, attributes: true, characterData: true });
        check();
    };
    if (document.documentElement) start();
    else document.addEventListener('readystatechange', start, { once: true });
}

function setThemeBeforeLoad(value: string): void {
    try {
        window.localStorage.setItem('ev-theme', value);
    } catch (err) {
        console.warn(`[e2e][perf] thème non posé sur ${window.location.href} : ${err instanceof Error ? err.message : String(err)}`);
    }
}

interface ResourceSnapshot {
    jsBeforeUseful: number;
    js: number;
    css: number;
    total: number;
    biggest: { name: string; bytes: number; ms: number } | null;
}

interface PaintReading {
    state: PerfState;
    /** first-contentful-paint lu dans la chronologie (performance.getEntriesByName), indépendant de l'observateur. */
    fcpTimeline: number | null;
    paints: string[];
    navType: string | null;
    path: string;
    visibility: string;
}

/** FCP et LCP relus à + 3 s (avant toute interaction) : les entrées livrées après le marqueur sont comprises. */
async function readPaint(page: Page): Promise<PaintReading> {
    return page.evaluate(() => {
        const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
        const fcp = performance.getEntriesByName('first-contentful-paint')[0];
        return {
            state: { ...(window as unknown as { __evPerf: PerfState }).__evPerf },
            fcpTimeline: fcp ? fcp.startTime : null,
            paints: performance.getEntriesByType('paint').map((e) => `${e.name}@${Math.round(e.startTime)}`),
            navType: nav ? nav.type : null,
            path: window.location.pathname,
            visibility: document.visibilityState,
        };
    });
}

/** Explication d'un FCP ou d'un LCP absent, écrite dans le TSV (colonne note_fcp_lcp). */
function paintNote(p: PaintReading, fcp: number | null, lcp: number | null): string | null {
    if (fcp !== null && lcp !== null) return null;
    const missing = [fcp === null ? 'FCP' : null, lcp === null ? 'LCP' : null].filter(Boolean).join(' et ');
    return `${missing} non émis par Chromium à + 3 s : chronologie paint [${p.paints.join(', ') || 'vide'}], `
        + `entrées LCP ${p.state.lcpCount}, observateurs ${p.state.observers ?? 'non créés'}, `
        + `page masquée ${p.state.hiddenAt === null ? 'jamais' : `à ${Math.round(p.state.hiddenAt)} ms`} (état ${p.visibility}), `
        + `documents chargés ${p.state.docs ?? '?'}, navigation ${p.navType ?? '?'} vers ${p.path}`;
}

interface PassResult {
    pass: number;
    fcp: number | null;
    lcp: number | null;
    note: string | null;
    useful: number | null;
    usefulBy: string | null;
    jsBeforeUseful: number | null;
    js3s: number | null;
    css: number | null;
    total: number | null;
    jsNetwork: number | null;
    cameraMs: number | null;
    jsCamera: number | null;
    biggest: { name: string; bytes: number; ms: number; minMs: number } | null;
    error: string | null;
}

function readBudgets(): Record<string, number> {
    if (!fs.existsSync(BUDGET_FILE)) return {};
    const parsed = JSON.parse(fs.readFileSync(BUDGET_FILE, 'utf8')) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error(`${BUDGET_FILE} : objet { "<route>": <octets> } attendu`);
    return parsed as Record<string, number>;
}

async function snapshot(page: Page, usefulAt: number | null): Promise<ResourceSnapshot> {
    return page.evaluate((useful) => {
        const entries = performance.getEntriesByType('resource') as PerformanceResourceTiming[];
        let jsBeforeUseful = 0;
        let js = 0;
        let css = 0;
        let total = 0;
        let biggest: { name: string; bytes: number; ms: number } | null = null;
        const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
        if (nav) total += nav.encodedBodySize;
        for (const e of entries) {
            let p = '';
            try {
                p = new URL(e.name).pathname;
            } catch (err) {
                console.warn(`[e2e][perf] URL de ressource illisible : ${err instanceof Error ? err.message : String(err)}`);
                continue;
            }
            total += e.encodedBodySize;
            if (!p.startsWith('/_next/static/')) continue;
            if (p.endsWith('.js')) {
                js += e.encodedBodySize;
                if (useful !== null && e.responseEnd <= useful) jsBeforeUseful += e.encodedBodySize;
            } else if (p.endsWith('.css')) {
                css += e.encodedBodySize;
            }
            if (!biggest || e.encodedBodySize > biggest.bytes) biggest = { name: p, bytes: e.encodedBodySize, ms: e.responseEnd - e.requestStart };
        }
        return { jsBeforeUseful, js, css, total, biggest };
    }, usefulAt);
}

async function onePass(browser: Browser, testInfo: TestInfo, screen: Screen, pass: number): Promise<PassResult> {
    const out: PassResult = {
        pass, fcp: null, lcp: null, note: null, useful: null, usefulBy: null, jsBeforeUseful: null, js3s: null, css: null, total: null,
        jsNetwork: null, cameraMs: null, jsCamera: null, biggest: null, error: null,
    };
    const context = await browser.newContext({
        ...projectContextOptions(testInfo),
        serviceWorkers: 'block',
        colorScheme: 'light',
        storageState: screen.role === 'anonyme' ? { cookies: [], origins: [] } : requireStorageState(screen.role),
    });
    try {
        await context.addInitScript({ content: 'window.__name = window.__name || function (f) { return f; };' });
        await context.addInitScript(setThemeBeforeLoad, 'light');
        if (screen.camera) await context.addInitScript(installFakeCamera, { mode: 'camera' as const });
        await context.addInitScript(installPerfProbe, { selectors: screen.selectors, buttonTexts: screen.buttonTexts ?? [] });
        const page = await context.newPage();
        const cdp = await context.newCDPSession(page);
        await cdp.send('Network.enable');
        await cdp.send('Network.setBlockedURLs', { urls: BLOCKED_URLS });
        await cdp.send('Network.emulateNetworkConditions', cdpNetworkConditions(NET_4G));
        await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });

        const networkSizes: Array<Promise<number>> = [];
        page.on('response', (r) => {
            const req = r.request();
            if (req.resourceType() !== 'script') return;
            let p = '';
            try {
                p = new URL(r.url()).pathname;
            } catch (err) {
                console.warn(`[e2e][perf] URL de script illisible : ${err instanceof Error ? err.message : String(err)}`);
                return;
            }
            if (!p.startsWith('/_next/static/')) return;
            networkSizes.push(req.sizes().then((s) => s.responseBodySize));
        });

        await page.goto(screen.path(), { waitUntil: 'commit', timeout: 120_000 });
        try {
            await page.waitForFunction(() => (window as unknown as { __evPerf?: PerfState }).__evPerf?.useful != null, null, { timeout: 90_000 });
        } catch (err) {
            throw new Error(`marqueur d'affichage utile introuvable en 90 s (sélecteurs : ${screen.selectors.join(' | ')}${screen.buttonTexts ? ` ; boutons : ${screen.buttonTexts.join(' | ')}` : ''}) : ${err instanceof Error ? err.message.split('\n')[0] : String(err)}`);
        }
        const state = await page.evaluate(() => ({ ...(window as unknown as { __evPerf: PerfState }).__evPerf }));
        Object.assign(out, { fcp: state.fcp, lcp: state.lcp, useful: state.useful, usefulBy: state.usefulBy });
        const first = await snapshot(page, state.useful);
        out.jsBeforeUseful = first.jsBeforeUseful;
        await page.waitForTimeout(3_000); // (b) : JavaScript chargé à + 3 s (contrat 11.6)
        // FCP et LCP relus ici, toujours avant toute interaction (run 72 : scanner sans FCP ni LCP sur les 5
        // passages quand ils n'étaient lus qu'à l'apparition du marqueur) ; repli FCP sur la chronologie
        const paint = await readPaint(page);
        out.fcp = paint.state.fcp ?? paint.fcpTimeline ?? out.fcp;
        out.lcp = paint.state.lcp ?? out.lcp;
        out.note = paintNote(paint, out.fcp, out.lcp);
        if (state.fcp === null || state.lcp === null) {
            console.log(`[PERF] ${screen.id} passage ${pass} : à l'apparition du marqueur, FCP ${fmtMs(state.fcp)} ms et LCP ${fmtMs(state.lcp)} ms ; `
                + `à + 3 s : FCP ${fmtMs(out.fcp)} ms, LCP ${fmtMs(out.lcp)} ms${out.note ? ` — ${out.note}` : ''}`);
        }
        const later = await snapshot(page, state.useful);
        out.js3s = later.js;
        out.css = later.css;
        out.total = later.total;
        out.jsNetwork = (await Promise.all(networkSizes)).reduce((a, b) => a + b, 0);
        if (later.biggest) out.biggest = { ...later.biggest, minMs: (later.biggest.bytes / NET_4G.downloadThroughput) * 1000 };

        if (screen.camera) {
            const start = page.getByRole('button', { name: /commencer le contr[ôo]le/i });
            if (await start.count() > 0 && await start.first().isVisible()) await start.first().click();
            const handle = await page.waitForFunction(
                () => (Array.from(document.querySelectorAll('video')).some((v) => v.readyState >= 2) ? performance.now() : false),
                null, { timeout: 60_000 },
            ).catch((err: unknown) => {
                throw new Error(`caméra simulée jamais en lecture en 60 s : ${err instanceof Error ? err.message.split('\n')[0] : String(err)}`);
            });
            out.cameraMs = Number(await handle.jsonValue());
            await page.waitForTimeout(3_000);
            out.jsCamera = (await snapshot(page, null)).js;
        }
    } catch (err) {
        out.error = err instanceof Error ? err.message.split('\n')[0] : String(err);
    } finally {
        await context.close();
    }
    return out;
}

const TSV_HEADER = 'ecran\tpassage\tfcp_ms\tlcp_ms\tutile_ms\tmarqueur\tjs_avant_utile_o\tjs_3s_o\tcss_o\ttotal_o\tjs_reseau_o\tcamera_ms\tjs_camera_o\tplus_gros_fichier\tfichier_o\tfichier_ms\tfichier_min_ms\terreur\tnote_fcp_lcp';

function num(v: number | null): string {
    return v === null ? '' : String(Math.round(v));
}

function row(screen: Screen, label: string, r: Omit<PassResult, 'pass'>): string {
    return [screen.id, label, num(r.fcp), num(r.lcp), num(r.useful), r.usefulBy ?? '', num(r.jsBeforeUseful), num(r.js3s), num(r.css), num(r.total),
        num(r.jsNetwork), num(r.cameraMs), num(r.jsCamera), r.biggest?.name ?? '', num(r.biggest?.bytes ?? null), num(r.biggest?.ms ?? null),
        num(r.biggest?.minMs ?? null), r.error ?? '', (r.note ?? '').replace(/\s+/g, ' ')].join('\t');
}

function aggregate(results: PassResult[], pick: (r: PassResult) => number | null): { med: number | null; max: number | null } {
    const values = results.map(pick).filter((v): v is number => v !== null);
    return { med: median(values), max: values.length ? Math.max(...values) : null };
}

for (const screen of SCREENS) {
    test(`${screen.libelle} : premier affichage utile et JavaScript chargé, 4G simulée et processeur ×4 (5 passages)`, async ({ browser }, testInfo) => {
        test.setTimeout(10 * 60_000);
        const budgets = readBudgets();
        const results: PassResult[] = [];
        for (let pass = 1; pass <= PASSES; pass++) {
            const r = await onePass(browser, testInfo, screen, pass);
            results.push(r);
            appendPerfFile('perf.tsv', TSV_HEADER, [row(screen, String(pass), r)]);
            console.log(`[PERF] ${screen.id} passage ${pass} : ${r.error ? `ÉCHEC ${r.error}` : `FCP ${fmtMs(r.fcp)} ms, LCP ${fmtMs(r.lcp)} ms, utile ${fmtMs(r.useful)} ms (${r.usefulBy}), JS (a) ${r.jsBeforeUseful} o, JS (b) ${r.js3s} o, CSS ${r.css} o, total ${r.total} o${screen.camera ? `, caméra ${fmtMs(r.cameraMs)} ms, JS caméra ${r.jsCamera} o` : ''}`}`);
        }
        const keys: Array<[keyof Omit<PassResult, 'pass' | 'usefulBy' | 'biggest' | 'error' | 'note'>, string]> = [
            ['fcp', 'fcp'], ['lcp', 'lcp'], ['useful', 'utile'], ['jsBeforeUseful', 'js (a)'], ['js3s', 'js (b)'], ['css', 'css'], ['total', 'total'],
            ['jsNetwork', 'js réseau'], ['cameraMs', 'caméra'], ['jsCamera', 'js caméra'],
        ];
        const med: Omit<PassResult, 'pass'> = { fcp: null, lcp: null, note: null, useful: null, usefulBy: null, jsBeforeUseful: null, js3s: null, css: null, total: null, jsNetwork: null, cameraMs: null, jsCamera: null, biggest: null, error: null };
        const max: Omit<PassResult, 'pass'> = { ...med };
        for (const [k] of keys) {
            const a = aggregate(results, (r) => r[k]);
            med[k] = a.med;
            max[k] = a.max;
        }
        appendPerfFile('perf.tsv', TSV_HEADER, [row(screen, 'mediane', med), row(screen, 'max', max)]);
        const ko = (v: number | null) => (v === null ? '—' : `${(v / 1000).toFixed(1).replace('.', ',')} Ko`);
        const budget = Object.prototype.hasOwnProperty.call(budgets, screen.budgetRoute) ? budgets[screen.budgetRoute] : null;
        const lines = [
            `${screen.libelle} (${screen.path()}, ${screen.role}) — ${PASSES} passages, ${NET_4G.nom}, processeur ×4`,
            `  premier affichage utile : médiane ${fmtMs(med.useful)} ms, max ${fmtMs(max.useful)} ms ; FCP médiane ${fmtMs(med.fcp)} ms ; LCP médiane ${fmtMs(med.lcp)} ms, max ${fmtMs(max.lcp)} ms`,
            `  JavaScript (a) avant le marqueur : médiane ${ko(med.jsBeforeUseful)}, max ${ko(max.jsBeforeUseful)} ; (b) à + 3 s : médiane ${ko(med.js3s)} ; CSS ${ko(med.css)} ; total ${ko(med.total)} ; recoupement réseau ${ko(med.jsNetwork)}`,
            ...(screen.camera ? [`  caméra en lecture : médiane ${fmtMs(med.cameraMs)} ms ; JavaScript à + 3 s caméra lancée : médiane ${ko(med.jsCamera)}, max ${ko(max.jsCamera)}`] : []),
            ...results.filter((r) => r.note).map((r) => `  passage ${r.pass} : ${r.note}`),
            `  budget post-build ${screen.budgetRoute} : ${budget === null ? 'aucun (mesure seule)' : `${ko(budget)} + ${ko(BUDGET_TOLERANCE)} de tolérance`}`,
        ];
        appendPerfFile('perf.txt', null, lines);
        console.log(lines.map((l) => `[PERF] ${l}`).join('\n'));
        if (med.useful !== null && med.useful > 3_000) console.log(`[PERF-AVERTISSEMENT] ${screen.id} : premier affichage utile médian ${fmtMs(med.useful)} ms > 3 000 ms`);
        if (med.lcp !== null && med.lcp > 4_000) console.log(`[PERF-AVERTISSEMENT] ${screen.id} : LCP médian ${fmtMs(med.lcp)} ms > 4 000 ms`);

        // Bloquant : chaque passage a abouti, avec un bridage effectivement appliqué
        for (const r of results) {
            expect.soft(r.error, `${screen.id} passage ${r.pass} : mesure complète`).toBeNull();
            if (r.error) continue;
            expect.soft(r.jsBeforeUseful ?? 0, `${screen.id} passage ${r.pass} : du JavaScript /_next/static/ arrivé avant le marqueur`).toBeGreaterThan(0);
            expect.soft(r.biggest, `${screen.id} passage ${r.pass} : au moins un fichier /_next/static/ mesuré`).not.toBeNull();
            if (r.biggest) {
                expect.soft(r.biggest.ms >= r.biggest.minMs,
                    `${screen.id} passage ${r.pass} : bridage non appliqué (${r.biggest.name}, ${r.biggest.bytes} o en ${Math.round(r.biggest.ms)} ms < ${Math.round(r.biggest.minMs)} ms au débit simulé)`).toBe(true);
            }
        }
        if (budget !== null) {
            expect.soft((max.jsBeforeUseful ?? Number.POSITIVE_INFINITY) <= budget + BUDGET_TOLERANCE,
                `${screen.id} : JavaScript (a) maximal ${ko(max.jsBeforeUseful)} au-dessus du budget ${screen.budgetRoute} ${ko(budget)} + ${ko(BUDGET_TOLERANCE)}`).toBe(true);
        }
    });
}

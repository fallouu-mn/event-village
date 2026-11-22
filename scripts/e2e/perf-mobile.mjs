#!/usr/bin/env node
/**
 * Design 1b (lot PERF) — performance mobile MESURÉE en CI, étape bloquante du job e2e (.github/workflows/verify.yml,
 * après `npm run e2e` : l'application tourne déjà sur http://localhost:3000, base seedée, états de connexion dans .auth/).
 *
 * Texte de l'utilisateur : « Lighthouse mobile ≥ 90 sur accueil, fiche et Mes billets ; affichage principal < 2,5 s et
 * aucun saut de mise en page (CLS < 0,1) sur un Android moyen en 4G simulée ; réaction au toucher < 200 ms. »
 *
 * Ce que fait le script (seuils, médiane et verdicts : module pur scripts/e2e/perf-mobile-seuils.mjs) :
 *  1. Session du client de MESURE (design 1e : Awa Sow, compte dédié semé une fois avec 10 billets à venir et 30 passés,
 *     jamais touché par l'e2e : même liste au job perf et au run complet) : .auth/mesure.json rejoué une fois sur « Mes billets » ; la page
 *     doit rester sur /tickets (sinon : session refusée, échec explicite). L'état de connexion est ensuite PORTÉ d'une
 *     mesure à la suivante (cookies relus après chaque passage) : si le jeton d'accès est renouvelé par l'application,
 *     le passage suivant utilise le nouveau, jamais un jeton de rafraîchissement déjà consommé.
 *  2. Lighthouse 13 (préréglage mobile PAR DÉFAUT : écran mobile, « Android moyen » en 4G lente SIMULÉE, processeur ×4),
 *     catégorie performance seule, 3 passages par page : accueil `/`, fiche `/events/<ceSoir>`, Mes billets
 *     `/tickets?tab=a-venir` connecté. Navigateur : le Chromium COMPLET installé par Playwright
 *     (`chromium.executablePath()`), lancé ici avec un profil neuf par passage (cache vide) et un port de débogage ;
 *     cookies de session posés par CDP (`Storage.setCookies`) avant le passage, relus après (`Storage.getCookies`).
 *     Lighthouse ne vide pas les cookies (clearStorageTypes par défaut) ; l'URL finale de Mes billets est contrôlée.
 *  3. CLS réel : 3 chargements par page avec Playwright (vue mobile 390 × 844, 4G simulée par CDP « Slow 4G »,
 *     processeur ×4), PerformanceObserver « layout-shift » (sans hadRecentInput) pendant le chargement + 3 s.
 *  4. Réaction au toucher : Playwright (vue mobile tactile, processeur ×4), touchers réels sur l'accueil (puces de
 *     filtre « Catégorie ») et sur Mes billets (onglets « Filtrer mes billets »), durée de chaque interaction par
 *     l'API Event Timing (PerformanceObserver type « event », durationThreshold 16, interactionId), plus une mesure
 *     témoin (de l'appui à l'image qui suit le clic). Replis si les pages changent (autres lots du design 1b) : premier
 *     `button[aria-pressed]` visible, puis premier `role=tab` visible ; rien de touchable = échec explicite.
 *
 * Sorties (.e2e-captures/perf/, publiées dans ci-results runs/<n>/perf/) :
 *  - lighthouse.tsv : une ligne par page et par passage (Lighthouse et chargement réel côte à côte), puis la médiane ;
 *  - toucher.tsv : une ligne par toucher ;
 *  - lighthouse.txt : rapport lisible en français, « OK » / « HORS SEUIL » par mesure, verdict final ;
 *  - lighthouse-resume.json : résumé de chaque passage (mesures, élément du LCP, éléments qui bougent, plus grosses
 *    ressources) ; lighthouse-<page>.json.gz : rapport Lighthouse complet du passage médian, sans captures d'écran
 *    (le tout < 2 Mo, sinon les .json.gz sont retirés).
 * Code de sortie : 0 si tous les seuils sont tenus, 1 sinon (ou application injoignable, ou temps imparti dépassé).
 *
 * `--dry` : vérifie la configuration (Lighthouse, Chromium complet, WebSocket, fichiers de la CI : .env.e2e,
 * demo-ids.json, .auth/mesure.json) puis fait un ESSAI COMPLET de la mécanique sur une page locale servie par le script
 * (Lighthouse avec cookie transmis, chargement réel avec CLS, touchers mesurés) : sans l'application ni la base.
 * Code 0 si la mécanique fonctionne (les fichiers propres à la CI peuvent manquer en local : signalé, non bloquant).
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { createRequire } from 'node:module';
import { startH2Proxy } from './h2-proxy.mjs';
import {
    PASSAGES, REFERENCE_CPU, SEUILS, calibratedCpuMultiplier, renderWorkFromTrace, TOUCHER_TSV_HEADER, TSV_HEADER, clsSessionWindows, finalPathMatches, fmtBytes, fmtCls, fmtMs, median,
    texteRapport, toucherRows, tsvRows, verdictPage, verdictToucher,
} from './perf-mobile-seuils.mjs';

const TAG = 'perf-mobile';
const ROOT = process.cwd();
const DRY = process.argv.includes('--dry');
const require = createRequire(import.meta.url);

const PERF_DIR = path.join(ROOT, '.e2e-captures', 'perf');
const DEMO_IDS_FILE = path.join(ROOT, '.e2e-captures', 'demo-ids.json');
const CLIENT_STATE_FILE = path.join(ROOT, '.auth', 'mesure.json');
const ENV_FILE = path.join(ROOT, process.env.EV_E2E_ENV_FILE || '.env.e2e');

/** Temps imparti (l'étape CI a timeout-minutes: 15 ; 5 passages depuis le 18/11) : au-delà, les passages restants sont notés en erreur. */
const BUDGET_MS = 13 * 60_000;
/** Chien de garde : rapport partiel écrit et sortie 1, avant que la CI ne coupe l'étape. */
const WATCHDOG_MS = 14 * 60_000;
const LIGHTHOUSE_TIMEOUT_MS = 150_000;
const TOUCHERS_PAR_PAGE = 5;
const HOST_RESOLVER = '--host-resolver-rules=MAP localhost 127.0.0.1';
/** Hôtes externes bloqués, comme e2e/perf.spec.ts (tuiles de carte, photos de démonstration). */
const BLOCKED_URLS = ['*tile.openstreetmap.org*', '*tiles.stadiamaps.com*', '*unsplash.com*'];
/** Vue mobile et 4G simulée : valeurs de e2e/support/devices.ts (MOBILE, NET_4G « Slow 4G » de DevTools). */
const MOBILE = {
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36',
};
const NET_4G = { offline: false, latency: 562.5, downloadThroughput: 1_440_000 / 8, uploadThroughput: 675_000 / 8 };
const LOCAL_HOSTNAMES = new Set(['127.0.0.1', 'localhost', '::1', '[::1]']);

const T0 = Date.now();
const log = (msg) => console.log(`[${TAG}] ${msg}`);
const errText = (err) => (err instanceof Error ? err.message.split('\n')[0] : String(err));
const remaining = () => BUDGET_MS - (Date.now() - T0);
const sleep = (ms) => new Promise((r) => { setTimeout(r, ms); });

function withTimeout(promise, ms, label) {
    let timer;
    return Promise.race([
        promise.finally(() => clearTimeout(timer)),
        new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`${label} : pas de fin en ${Math.round(ms / 1000)} s`)), ms); }),
    ]);
}

// ── Configuration ─────────────────────────────────────────────────────────────

function parseEnvFile(file) {
    const out = {};
    for (const raw of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
        const line = raw.trim();
        if (!line || line.startsWith('#') || !line.includes('=')) continue;
        const k = line.slice(0, line.indexOf('=')).trim();
        let v = line.slice(line.indexOf('=') + 1).trim();
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
        out[k] = v;
    }
    return out;
}

/** URL de l'application (NEXT_PUBLIC_APP_URL de .env.e2e, sinon http://localhost:3000) ; locale obligatoirement. */
function appUrl() {
    const fromEnv = process.env.NEXT_PUBLIC_APP_URL || (fs.existsSync(ENV_FILE) ? parseEnvFile(ENV_FILE).NEXT_PUBLIC_APP_URL : undefined);
    const url = new URL(fromEnv || 'http://localhost:3000');
    if (!LOCAL_HOSTNAMES.has(url.hostname)) throw new Error(`NEXT_PUBLIC_APP_URL pointe hors de la machine (${url.hostname}) : refus.`);
    return url.origin;
}

function readJson(file) {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function ceSoirId() {
    if (!fs.existsSync(DEMO_IDS_FILE)) throw new Error(`${path.relative(ROOT, DEMO_IDS_FILE)} absent : le seed de démonstration n'a pas abouti (journal e2e-seed.log).`);
    const id = readJson(DEMO_IDS_FILE)?.events?.ceSoir?.id;
    if (!/^[0-9a-f-]{36}$/i.test(String(id ?? ''))) throw new Error(`${path.relative(ROOT, DEMO_IDS_FILE)} : events.ceSoir.id absent ou illisible.`);
    return id;
}

function readClientState() {
    if (!fs.existsSync(CLIENT_STATE_FILE)) {
        throw new Error(`${path.relative(ROOT, CLIENT_STATE_FILE)} absent : la phase de connexion de l'e2e (e2e/auth.setup.ts) a échoué pour le client de mesure.`);
    }
    const state = readJson(CLIENT_STATE_FILE);
    if (!Array.isArray(state?.cookies) || state.cookies.length === 0) throw new Error(`${path.relative(ROOT, CLIENT_STATE_FILE)} : aucun cookie de session.`);
    return state;
}

function chromiumPath() {
    const { chromium } = require('@playwright/test');
    const exe = chromium.executablePath();
    if (!exe || !fs.existsSync(exe)) throw new Error(`Chromium complet de Playwright introuvable (${exe || 'chemin vide'}) : npx playwright install chromium`);
    return exe;
}

async function loadLighthouse() {
    const mod = await import('lighthouse');
    const fn = mod.default;
    if (typeof fn !== 'function') throw new Error('le module lighthouse n\'exporte pas de fonction par défaut');
    const version = readJson(require.resolve('lighthouse/package.json')).version;
    return { lighthouse: fn, version };
}

// ── Chromium lancé pour Lighthouse (profil neuf, port de débogage) ───────────

function freePort() {
    return new Promise((resolve, reject) => {
        const srv = net.createServer();
        srv.unref();
        srv.on('error', reject);
        srv.listen(0, '127.0.0.1', () => {
            const { port } = srv.address();
            srv.close(() => resolve(port));
        });
    });
}

async function devtoolsEndpoint(port, timeoutMs) {
    const until = Date.now() + timeoutMs;
    let last = '';
    while (Date.now() < until) {
        try {
            const res = await fetch(`http://127.0.0.1:${port}/json/version`, { signal: AbortSignal.timeout(2_000) });
            if (res.ok) {
                const body = await res.json();
                if (body.webSocketDebuggerUrl) return body.webSocketDebuggerUrl;
            }
        } catch (err) {
            last = errText(err);
        }
        await sleep(200);
    }
    throw new Error(`Chromium ne répond pas sur le port ${port} en ${Math.round(timeoutMs / 1000)} s${last ? ` (${last})` : ''}`);
}

/** Une commande CDP au niveau du navigateur (WebSocket de Node 22), avec délai. */
function cdpCommand(wsUrl, method, params = {}, timeoutMs = 10_000) {
    return new Promise((resolve, reject) => {
        if (typeof WebSocket !== 'function') {
            reject(new Error('WebSocket absent de Node (Node 22 ou plus attendu)'));
            return;
        }
        const ws = new WebSocket(wsUrl);
        const timer = setTimeout(() => {
            try { ws.close(); } catch { /* fermeture best effort */ }
            reject(new Error(`${method} : pas de réponse en ${Math.round(timeoutMs / 1000)} s`));
        }, timeoutMs);
        ws.onopen = () => ws.send(JSON.stringify({ id: 1, method, params }));
        ws.onmessage = (ev) => {
            let msg;
            try { msg = JSON.parse(String(ev.data)); } catch { return; }
            if (msg.id !== 1) return;
            clearTimeout(timer);
            try { ws.close(); } catch { /* fermeture best effort */ }
            if (msg.error) reject(new Error(`${method} : ${msg.error.message}`));
            else resolve(msg.result);
        };
        ws.onerror = () => {
            clearTimeout(timer);
            reject(new Error(`${method} : connexion CDP impossible`));
        };
    });
}

/** Cookies d'un storageState Playwright → CookieParam de CDP. */
function toCdpCookies(cookies) {
    return cookies.map((c) => ({
        name: c.name, value: c.value, domain: c.domain, path: c.path || '/', secure: Boolean(c.secure), httpOnly: Boolean(c.httpOnly),
        ...(c.sameSite ? { sameSite: c.sameSite } : {}), ...(typeof c.expires === 'number' && c.expires > 0 ? { expires: c.expires } : {}),
    }));
}

/** Cookies de CDP → format storageState de Playwright. */
function fromCdpCookies(cookies) {
    return cookies.map((c) => ({
        name: c.name, value: c.value, domain: c.domain, path: c.path, expires: c.session ? -1 : c.expires,
        httpOnly: Boolean(c.httpOnly), secure: Boolean(c.secure), sameSite: c.sameSite || 'Lax',
    }));
}

async function killProcess(proc) {
    if (proc.exitCode !== null || proc.signalCode !== null) return;
    const exited = new Promise((r) => { proc.once('exit', r); });
    try { proc.kill('SIGKILL'); } catch { /* déjà arrêté */ }
    await Promise.race([exited, sleep(5_000)]);
}

function removeDir(dir) {
    try { fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); } catch (err) {
        log(`profil temporaire non supprimé (${dir}) : ${errText(err)}`);
    }
}

/**
 * Un passage Lighthouse. `cookies` : cookies Playwright posés avant (vide = visiteur anonyme).
 * Renvoie le rapport (lhr) et les cookies relus après le passage (renouvellement éventuel de la session).
 */
async function lighthouseRun({ lighthouse, exe, url, cookies, cpuSlowdownMultiplier = null }) {
    const port = await freePort();
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ev-lighthouse-'));
    const args = [
        `--remote-debugging-port=${port}`, `--user-data-dir=${dir}`, '--headless=new', '--no-first-run', '--no-default-browser-check',
        '--disable-extensions', '--disable-sync', '--disable-component-update', '--disable-default-apps', '--disable-background-networking',
        '--mute-audio', '--metrics-recording-only', '--password-store=basic', '--use-mock-keychain', HOST_RESOLVER, '--ignore-certificate-errors',
        ...(process.platform === 'linux' ? ['--no-sandbox'] : []), 'about:blank',
    ];
    const proc = spawn(exe, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    let stderr = '';
    proc.stderr.on('data', (d) => { stderr = (stderr + String(d)).slice(-2_000); });
    const spawnError = new Promise((_, reject) => { proc.once('error', (err) => reject(new Error(`Chromium non lancé : ${errText(err)}`))); });
    spawnError.catch(() => { /* lu par la course ci-dessous */ });
    try {
        const ws = await Promise.race([devtoolsEndpoint(port, 30_000), spawnError]).catch((err) => {
            throw new Error(`${errText(err)}${stderr ? ` — Chromium : ${stderr.trim().split('\n').slice(-2).join(' ')}` : ''}`);
        });
        if (cookies.length > 0) await cdpCommand(ws, 'Storage.setCookies', { cookies: toCdpCookies(cookies) });
        const run = lighthouse(url, {
            port,
            output: 'json',
            logLevel: 'error',
            onlyCategories: ['performance'],
            disableFullPageScreenshot: true,
            blockedUrlPatterns: BLOCKED_URLS,
            // Décision du 18/11 : ralentissement calibré (seul ce réglage change ; le reste du préréglage mobile est fusionné)
            ...(cpuSlowdownMultiplier ? { throttling: { cpuSlowdownMultiplier } } : {}),
        });
        run.catch(() => { /* rejet tardif après le délai : ignoré, le passage est déjà en erreur */ });
        const result = await withTimeout(run, LIGHTHOUSE_TIMEOUT_MS, 'Lighthouse');
        if (!result?.lhr) throw new Error('Lighthouse n\'a rendu aucun rapport');
        const after = cookies.length > 0 ? fromCdpCookies((await cdpCommand(ws, 'Storage.getCookies')).cookies ?? []) : null;
        return { lhr: result.lhr, cookies: after };
    } finally {
        await killProcess(proc);
        removeDir(dir);
    }
}

/** Nœuds DOM (sélecteur, extrait) trouvés dans les détails d'un audit, quelle que soit leur profondeur. */
function nodesIn(details, max = 5) {
    const out = [];
    const walk = (v) => {
        if (out.length >= max || !v || typeof v !== 'object') return;
        if (Array.isArray(v)) { v.forEach(walk); return; }
        if (v.type === 'node' && (v.selector || v.snippet)) {
            out.push({ selector: v.selector ?? null, snippet: String(v.snippet ?? '').slice(0, 200) });
            return;
        }
        Object.values(v).forEach(walk);
    };
    walk(details);
    return out;
}

/** Mesures et résumé d'un rapport Lighthouse. */
function summarize(lhr) {
    const a = lhr.audits ?? {};
    const num = (id) => (Number.isFinite(a[id]?.numericValue) ? a[id].numericValue : null);
    const rawScore = lhr.categories?.performance?.score;
    const score = typeof rawScore === 'number' ? Math.round(rawScore * 100) : null;
    const runtime = lhr.runtimeError ? `${lhr.runtimeError.code} ${lhr.runtimeError.message ?? ''}`.trim() : null;
    const lcpNodes = ['largest-contentful-paint-element', 'lcp-breakdown-insight', 'lcp-discovery-insight'].flatMap((id) => nodesIn(a[id]?.details, 1)).slice(0, 1);
    const clsNodes = ['layout-shifts', 'cls-culprits-insight', 'layout-shift-elements'].flatMap((id) => nodesIn(a[id]?.details, 5)).slice(0, 5);
    const requests = (a['network-requests']?.details?.items ?? [])
        .map((r) => ({ url: String(r.url ?? '').slice(0, 160), type: r.resourceType ?? null, transfert_o: r.transferSize ?? 0 }))
        .sort((x, y) => y.transfert_o - x.transfert_o).slice(0, 8);
    return {
        score,
        lcp: num('largest-contentful-paint'),
        cls: num('cumulative-layout-shift'),
        tbt: num('total-blocking-time'),
        fcp: num('first-contentful-paint'),
        si: num('speed-index'),
        bytes: num('total-byte-weight'),
        finalUrl: lhr.finalDisplayedUrl ?? lhr.finalUrl ?? null,
        error: runtime ?? (score === null ? 'score de performance absent du rapport' : null),
        lcpElement: lcpNodes[0] ?? null,
        clsElements: clsNodes,
        plusGrosses: requests,
        avertissements: (lhr.runWarnings ?? []).map((w) => String(w).slice(0, 300)),
        lighthouseVersion: lhr.lighthouseVersion ?? null,
        benchmarkIndex: Number.isFinite(lhr.environment?.benchmarkIndex) ? lhr.environment.benchmarkIndex : null,
        cpu: Number.isFinite(lhr.configSettings?.throttling?.cpuSlowdownMultiplier) ? lhr.configSettings.throttling.cpuSlowdownMultiplier : null,
        reglages: { formFactor: lhr.configSettings?.formFactor, throttlingMethod: lhr.configSettings?.throttlingMethod, throttling: lhr.configSettings?.throttling },
    };
}

/** Rapport complet sans captures d'écran ni catalogue de traductions (taille réduite), compressé. */
function compactLhr(lhr) {
    const copy = { ...lhr, audits: { ...lhr.audits } };
    for (const id of ['screenshot-thumbnails', 'final-screenshot', 'full-page-screenshot']) delete copy.audits[id];
    delete copy.fullPageScreenshot;
    delete copy.i18n;
    return zlib.gzipSync(Buffer.from(JSON.stringify(copy)), { level: 9 });
}

// ── Mesures Playwright (CLS réel, toucher) ────────────────────────────────────

function installProbe() {
    const T = { shifts: [], lcp: null, events: [], temoins: [], clicks: 0, observer: null };
    window.__evPerfMobile = T;
    try {
        new PerformanceObserver((list) => {
            for (const e of list.getEntries()) T.shifts.push({ startTime: e.startTime, value: e.value, hadRecentInput: e.hadRecentInput });
        }).observe({ type: 'layout-shift', buffered: true });
        new PerformanceObserver((list) => {
            const entries = list.getEntries();
            if (entries.length) T.lcp = entries[entries.length - 1].startTime;
        }).observe({ type: 'largest-contentful-paint', buffered: true });
        new PerformanceObserver((list) => {
            for (const e of list.getEntries()) T.events.push({ name: e.name, duration: e.duration, interactionId: e.interactionId || 0, startTime: e.startTime });
        }).observe({ type: 'event', durationThreshold: 16, buffered: true });
        T.observer = 'ok';
    } catch (err) {
        T.observer = `indisponible : ${err instanceof Error ? err.message : String(err)}`;
    }
    let down = null;
    window.addEventListener('pointerdown', (e) => { down = e.timeStamp; }, { capture: true });
    window.addEventListener('click', (e) => {
        T.clicks += 1;
        const t0 = down ?? e.timeStamp;
        down = null;
        requestAnimationFrame(() => {
            const ch = new MessageChannel();
            ch.port1.onmessage = () => { T.temoins.push(performance.now() - t0); };
            ch.port2.postMessage(null);
        });
    }, { capture: true });
}

async function mobileContext(browser, storageState) {
    const context = await browser.newContext({
        ...MOBILE,
        locale: 'fr-FR',
        timezoneId: 'Africa/Dakar',
        serviceWorkers: 'block',
        ignoreHTTPSErrors: true,
        reducedMotion: 'no-preference',
        colorScheme: 'light',
        storageState: storageState ?? { cookies: [], origins: [] },
    });
    context.setDefaultTimeout(15_000);
    context.setDefaultNavigationTimeout(90_000);
    await context.addInitScript({ content: 'window.__name = window.__name || function (f) { return f; };' });
    await context.addInitScript(installProbe);
    return context;
}

async function throttle(context, page, { network }) {
    const cdp = await context.newCDPSession(page);
    await cdp.send('Network.enable');
    await cdp.send('Network.setBlockedURLs', { urls: BLOCKED_URLS });
    if (network) await cdp.send('Network.emulateNetworkConditions', NET_4G);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
}

/**
 * Décision du 18/11 (aucune animation en boucle infinie) — travail de rendu de Mes billets, AVANT / APRÈS dans le même run :
 * « après » = la page telle quelle ; « avant » = la même page où une feuille injectée remet les animations en boucle retirées
 * (pulsation et rotation infinies, halo infini du point « En cours », pulsation du QR en attente, barre du pas du code de
 * 20 s). Trace du navigateur sur 10 s après le chargement (fil principal de la page), processeur ralenti comme Lighthouse
 * (calibré), 4G simulée : somme des tâches de style et mise en page, et de peinture et composition. Information (non
 * bloquante) : perf/rendu-mes-billets.tsv et lighthouse.txt.
 */
const ANIMATIONS_AVANT_CSS = [
    '.animate-pulse{animation:pulse 2s cubic-bezier(.4,0,.6,1) infinite!important}',
    '.animate-ping{animation:ping 1s cubic-bezier(0,0,.2,1) infinite!important}',
    '.animate-spin{animation:spin 1s linear infinite!important}',
    '.ev-live-dot::after{animation:evLivePulse 1.6s ease-out infinite!important;animation-play-state:running!important}',
    '[data-ev-qr-wait] svg{animation:pulse 2s cubic-bezier(.4,0,.6,1) infinite!important}',
    'div:has(> div > [data-ev-qr-timer])::after{content:"";display:block;height:6px;border-radius:9999px;background:#ff8a3d;transform-origin:left;animation:evBarAvant 20s linear infinite}',
    '@keyframes evBarAvant{from{transform:scaleX(1)}to{transform:scaleX(.05)}}',
].join('');
const RENDU_MS = 10_000;
async function renderWork(browser, base, def, session, variant, cpuRate) {
    const context = await mobileContext(browser, session.state);
    try {
        if (variant === 'avant') {
            await context.addInitScript({ content: `document.addEventListener('DOMContentLoaded', () => { const st = document.createElement('style'); st.setAttribute('data-ev-avant', ''); st.textContent = ${JSON.stringify(ANIMATIONS_AVANT_CSS)}; document.head.appendChild(st); });` });
        }
        const page = await context.newPage();
        const cdp = await context.newCDPSession(page);
        await cdp.send('Network.enable');
        await cdp.send('Network.setBlockedURLs', { urls: BLOCKED_URLS });
        await cdp.send('Network.emulateNetworkConditions', NET_4G);
        await cdp.send('Emulation.setCPUThrottlingRate', { rate: cpuRate });
        await browser.startTracing(page, { categories: ['devtools.timeline', 'disabled-by-default-devtools.timeline'] });
        await page.goto(`${base}${def.path}`, { waitUntil: 'load', timeout: 90_000 });
        await page.waitForTimeout(RENDU_MS);
        const buf = await browser.stopTracing();
        session.state = await context.storageState();
        if (!finalPathMatches(page.url(), def.expectedPath)) return { error: `page finale ${new URL(page.url()).pathname}` };
        return { ...renderWorkFromTrace(JSON.parse(buf.toString('utf8'))), error: null };
    } catch (err) {
        return { error: errText(err) };
    } finally {
        await context.close().catch(() => {});
    }
}

/** Un chargement réel : CLS (fenêtres de session) et LCP observés pendant le chargement + 3 s. */
async function realLoad(browser, base, def, session) {
    const context = await mobileContext(browser, def.client ? session.state : null);
    try {
        const page = await context.newPage();
        await throttle(context, page, { network: true });
        await page.goto(`${base}${def.path}`, { waitUntil: 'load', timeout: 90_000 });
        await page.waitForTimeout(3_000);
        const probe = await page.evaluate(() => {
            const T = window.__evPerfMobile;
            return { shifts: T.shifts, lcp: T.lcp, observer: T.observer, url: window.location.href };
        });
        if (def.client) session.state = await context.storageState();
        if (!finalPathMatches(probe.url, def.expectedPath)) {
            return { cls: null, lcp: null, error: `page finale ${new URL(probe.url).pathname} au lieu de ${def.expectedPath}`, fatal: def.client };
        }
        if (probe.observer !== 'ok') return { cls: null, lcp: null, error: `observateurs de performance ${probe.observer}` };
        return { cls: clsSessionWindows(probe.shifts), lcp: probe.lcp, decalages: probe.shifts.filter((s) => !s.hadRecentInput).length, error: null };
    } catch (err) {
        return { cls: null, lcp: null, error: errText(err) };
    } finally {
        await context.close().catch(() => {});
    }
}

/** Stratégies de cible du toucher, de la plus précise au repli documenté. */
const TOUCH_TARGETS = {
    // Design 1b (run 373) : Explorer porte les puces de filtre de la page publique (« Catégorie », « Date et prix »)
    explorer: [
        { desc: 'puce de filtre « Catégorie » d’Explorer', locate: (page) => page.getByRole('group', { name: /cat[ée]gorie/i }).getByRole('button') },
        { desc: 'puce de filtre « Date et prix » d’Explorer', locate: (page) => page.getByRole('group', { name: /date et prix/i }).getByRole('button') },
    ],
    accueil: [
        { desc: 'puce de filtre « Catégorie »', locate: (page) => page.getByRole('group', { name: /cat[ée]gorie/i }).getByRole('button') },
        { desc: 'repli : bouton à bascule (button[aria-pressed])', locate: (page) => page.locator('button[aria-pressed]') },
        { desc: 'repli : onglet (role=tab)', locate: (page) => page.getByRole('tab') },
    ],
    'mes-billets': [
        { desc: 'onglet de « Mes billets »', locate: (page) => page.getByRole('tablist', { name: /billets/i }).getByRole('tab') },
        { desc: 'repli : onglet (role=tab)', locate: (page) => page.getByRole('tab') },
        { desc: 'repli : bouton à bascule (button[aria-pressed])', locate: (page) => page.locator('button[aria-pressed]') },
    ],
};

async function visibleTargets(page, strategies) {
    for (const s of strategies) {
        const all = await s.locate(page).all();
        const visible = [];
        for (const l of all) if (await l.isVisible().catch(() => false)) visible.push(l);
        if (visible.length > 0) return { desc: s.desc, targets: visible };
    }
    return null;
}

const isSelected = async (l) => {
    const [pressed, selected] = await Promise.all([l.getAttribute('aria-pressed').catch(() => null), l.getAttribute('aria-selected').catch(() => null)]);
    return pressed === 'true' || selected === 'true';
};

/** Touchers mesurés sur une page. Renvoie { touches, fatal }. */
async function touchPage(browser, base, def, strategies, session, count) {
    const context = await mobileContext(browser, def.client ? session?.state : null);
    const touches = [];
    try {
        const page = await context.newPage();
        await throttle(context, page, { network: false });
        await page.goto(`${base}${def.path}`, { waitUntil: 'load', timeout: 90_000 });
        if (!finalPathMatches(page.url(), def.expectedPath)) return { touches, fatal: `${def.libelle} : page finale ${new URL(page.url()).pathname} au lieu de ${def.expectedPath}` };
        let found = null;
        const until = Date.now() + 20_000;
        while (!found && Date.now() < until) {
            found = await visibleTargets(page, strategies);
            if (!found) await page.waitForTimeout(500);
        }
        if (!found) return { touches, fatal: `${def.libelle} : rien à toucher (essayé : ${strategies.map((s) => s.desc).join(' ; ')})` };
        // Hydratation : chargement terminé, puis un moment d'inactivité du fil principal (au plus 5 s), puis 1 s
        await page.evaluate(() => new Promise((resolve) => {
            const idle = window.requestIdleCallback ?? ((cb) => setTimeout(cb, 50));
            idle(() => resolve(null), { timeout: 5_000 });
        }));
        await page.waitForTimeout(1_000);
        const observer = await page.evaluate(() => window.__evPerfMobile.observer);
        log(`${def.libelle} : cible « ${found.desc} » (${found.targets.length} visible(s)), Event Timing ${observer}`);
        const pathname = new URL(page.url()).pathname;
        for (let i = 0; i < count; i++) {
            const t = { page: def.libelle, cible: found.desc, eventTimingMs: null, temoinMs: null, etatChange: null, error: null };
            try {
                if (observer !== 'ok') throw new Error(`API Event Timing ${observer}`);
                // Cible non choisie de préférence (une puce déjà choisie ne change rien), en tournant
                let target = found.targets[(i + 1) % found.targets.length];
                for (let k = 0; k < found.targets.length; k++) {
                    const cand = found.targets[(i + 1 + k) % found.targets.length];
                    if (!(await isSelected(cand))) { target = cand; break; }
                }
                const label = ((await target.textContent().catch(() => '')) ?? '').trim().replace(/\s+/g, ' ').slice(0, 40);
                t.cible = `${found.desc}${label ? ` « ${label} »` : ''}`;
                const mark = await page.evaluate(() => {
                    const T = window.__evPerfMobile;
                    return { events: T.events.length, temoins: T.temoins.length, clicks: T.clicks };
                });
                await target.tap({ timeout: 10_000 });
                await page.waitForTimeout(1_200);
                const r = await page.evaluate((m) => {
                    const T = window.__evPerfMobile;
                    return { events: T.events.slice(m.events), temoins: T.temoins.slice(m.temoins), clicks: T.clicks - m.clicks, url: window.location.href };
                }, mark);
                if (new URL(r.url).pathname !== pathname) throw new Error(`le toucher a changé de page (${new URL(r.url).pathname}) : mesure impossible`);
                if (r.clicks === 0) throw new Error('toucher non reçu par la page (aucun clic)');
                const durations = r.events.filter((e) => e.interactionId > 0).map((e) => e.duration);
                t.eventTimingMs = durations.length ? Math.max(...durations) : 0;
                t.temoinMs = r.temoins.length ? Math.max(...r.temoins) : null;
                if (t.temoinMs === null) throw new Error('mesure témoin absente (aucune image après le clic en 1,2 s)');
                t.etatChange = await isSelected(target);
            } catch (err) {
                t.error = errText(err);
            }
            touches.push(t);
            log(`  toucher ${i + 1} : ${t.error ? `ÉCHEC ${t.error}` : `Event Timing ${t.eventTimingMs === 0 ? '< 16 ms' : fmtMs(t.eventTimingMs)}, témoin ${fmtMs(t.temoinMs)}, état ${t.etatChange ? 'changé' : 'inchangé'}`} (${t.cible})`);
        }
        if (def.client && session) session.state = await context.storageState();
        return { touches, fatal: null };
    } catch (err) {
        return { touches, fatal: `${def.libelle} : ${errText(err)}` };
    } finally {
        await context.close().catch(() => {});
    }
}

// ── Session du client ─────────────────────────────────────────────────────────

async function prepareSession(browser, base, def) {
    const session = { state: readClientState() };
    const context = await mobileContext(browser, session.state);
    try {
        const page = await context.newPage();
        await page.goto(`${base}${def.path}`, { waitUntil: 'load', timeout: 60_000 });
        await page.waitForTimeout(2_000);
        if (!finalPathMatches(page.url(), def.expectedPath)) {
            throw new Error(`session du client refusée : « Mes billets » mène à ${new URL(page.url()).pathname} (page de connexion ?) au lieu de ${def.expectedPath}`);
        }
        session.state = await context.storageState();
        return session;
    } finally {
        await context.close().catch(() => {});
    }
}

// ── Écriture des résultats ────────────────────────────────────────────────────

function writeOutputs({ pageResults, touches, touchFatals, entete, notes, gz, calibrations = [], rendus = [] }) {
    fs.mkdirSync(PERF_DIR, { recursive: true });
    // Décision du 18/11 : rendu de Mes billets avant / après (information, non bloquant)
    fs.writeFileSync(path.join(PERF_DIR, 'rendu-mes-billets.tsv'), `${['variante', 'passage', 'ralentissement_cpu', 'style_mise_en_page_ms', 'peinture_ms', 'erreur'].join('\t')}\n${rendus.map((r) => [r.variant, r.pass, r.cpu ?? '', r.styleMs ?? '', r.paintMs ?? '', String(r.error ?? '').replace(/[\t\r\n]+/g, ' ')].join('\t')).join('\n')}\n`, 'utf8');
    for (const v of ['avant', 'apres']) {
        const ok = rendus.filter((r) => r.variant === v && !r.error);
        if (ok.length) notes.push(`Mes billets, rendu ${v === 'avant' ? 'AVANT (animations en boucle remises)' : 'APRÈS'} : style et mise en page médiane ${fmtMs(median(ok.map((r) => r.styleMs)))}, peinture médiane ${fmtMs(median(ok.map((r) => r.paintMs)))} sur 10 s (${ok.length} passage(s) ; perf/rendu-mes-billets.tsv).`);
    }
    const verdicts = pageResults.map((p) => ({ ...verdictPage(p), details: p.details }));
    const toucher = verdictToucher(touches, touchFatals);
    const rapport = texteRapport({ pages: verdicts, toucher, entete, notes });
    const tsv = [TSV_HEADER, ...pageResults.flatMap((p) => tsvRows(p.id, p.lighthouse, p.reel))];
    fs.writeFileSync(path.join(PERF_DIR, 'lighthouse.tsv'), `${tsv.join('\n')}\n`, 'utf8');
    // Valeurs brutes de la calibration : un passage de l'accueil au préréglage (×4) par tour, indice mesuré, ralentissement retenu
    fs.writeFileSync(path.join(PERF_DIR, 'calibration.tsv'), `${['tour', 'indice_puissance', 'ralentissement_retenu', 'score_brut_x4', 'tbt_brut_x4_ms', 'lcp_brut_x4_ms', 'erreur'].join('\t')}\n${calibrations.map((c) => [c.tour, c.benchmarkIndex ?? '', c.multiplier, c.score ?? '', c.tbt === null || c.tbt === undefined ? '' : Math.round(c.tbt), c.lcp === null || c.lcp === undefined ? '' : Math.round(c.lcp), String(c.error ?? '').replace(/[\t\r\n]+/g, ' ')].join('\t')).join('\n')}\n`, 'utf8');
    fs.writeFileSync(path.join(PERF_DIR, 'toucher.tsv'), `${[TOUCHER_TSV_HEADER, ...toucherRows(touches)].join('\n')}\n`, 'utf8');
    fs.writeFileSync(path.join(PERF_DIR, 'lighthouse.txt'), rapport.texte, 'utf8');
    const resume = {
        genere: new Date().toISOString(),
        seuils: SEUILS,
        calibration: { reference: REFERENCE_CPU, tours: calibrations },
        pages: pageResults.map((p) => ({ id: p.id, libelle: p.libelle, url: p.url, fatal: p.fatal ?? null, lighthouse: p.lighthouse, reel: p.reel })),
        touchers: touches,
        verdict: rapport.ok ? 'OK' : 'HORS SEUIL',
    };
    fs.writeFileSync(path.join(PERF_DIR, 'lighthouse-resume.json'), `${JSON.stringify(resume, null, 1)}\n`, 'utf8');
    // Rapports complets compressés : 2 Mo au plus pour l'ensemble des sorties, sinon retirés
    let total = ['lighthouse.tsv', 'toucher.tsv', 'lighthouse.txt', 'lighthouse-resume.json'].reduce((s, f) => s + fs.statSync(path.join(PERF_DIR, f)).size, 0);
    for (const [id, buf] of gz) {
        if (total + buf.length > 2_000_000) {
            log(`rapport complet de ${id} non écrit (${fmtBytes(buf.length)}) : plafond de 2 Mo atteint`);
            continue;
        }
        fs.writeFileSync(path.join(PERF_DIR, `lighthouse-${id}.json.gz`), buf);
        total += buf.length;
    }
    log(`sorties écrites dans ${path.relative(ROOT, PERF_DIR)} (${fmtBytes(total)})`);
    return rapport;
}

// ── Mesure complète (CI) ──────────────────────────────────────────────────────

async function main() {
    let base = appUrl();
    let proxy = null;
    const { chromium } = require('@playwright/test');
    const exe = chromiumPath();
    const { lighthouse, version } = await loadLighthouse();
    log(`Lighthouse ${version}, Chromium ${exe}, application ${base}`);
    try {
        const ping = await fetch(`${base.replace('localhost', '127.0.0.1')}/login`, { redirect: 'manual', signal: AbortSignal.timeout(10_000) });
        if (ping.status >= 500) throw new Error(`HTTP ${ping.status}`);
    } catch (err) {
        const message = `application injoignable (${base}) : ${errText(err)}. L'étape « démarrer l'application » a-t-elle réussi ?`;
        console.error(`[${TAG}] ÉCHEC : ${message}`);
        fs.mkdirSync(PERF_DIR, { recursive: true });
        fs.writeFileSync(path.join(PERF_DIR, 'lighthouse.txt'), `Performance mobile mesurée (design 1b, lot PERF)\nHORS SEUIL — aucune mesure : ${message}\nVERDICT : HORS SEUIL\n`, 'utf8');
        process.exit(1);
    }

    // Décision 1b de l'utilisateur : mesure en HTTP/2, comme la production (CDN), par un relais local devant next start
    // (scripts/e2e/h2-proxy.mjs) ; PERF_HTTP2=0 : mesure directe en HTTP/1.1 (comparaison). Seuils inchangés.
    if (process.env.PERF_HTTP2 !== '0') {
        try {
            proxy = await startH2Proxy(base.replace('localhost', '127.0.0.1'), path.join(os.tmpdir(), 'ev-h2-proxy'));
            log(`relais HTTP/2 ${proxy.origin} → ${base}`);
            base = proxy.origin;
        } catch (err) {
            console.error(`[${TAG}] ÉCHEC : relais HTTP/2 impossible (${errText(err)})`);
            process.exit(1);
        }
    }

    const pages = [
        { id: 'accueil', libelle: 'Accueil', path: '/', expectedPath: '/', client: false },
        { id: 'fiche', libelle: 'Fiche événement (« ce soir »)', path: null, expectedPath: null, client: false },
        { id: 'mes-billets', libelle: 'Mes billets (client connecté)', path: '/tickets?tab=a-venir', expectedPath: '/tickets', client: true },
    ];
    const pageResults = pages.map((p) => ({ id: p.id, libelle: p.libelle, url: p.path, lighthouse: [], reel: [], fatal: null, details: [] }));
    /** Rapports Lighthouse bruts, alignés sur pageResults[i].lighthouse (null : passage sans rapport). */
    const lhrs = new Map(pages.map((p) => [p.id, []]));
    const res = (id) => pageResults.find((r) => r.id === id);
    try {
        const id = ceSoirId();
        pages[1].path = `/events/${id}`;
        pages[1].expectedPath = `/events/${id}`;
        res('fiche').url = pages[1].path;
    } catch (err) {
        res('fiche').fatal = errText(err);
    }
    const touches = [];
    const touchFatals = [];
    const gz = [];
    const notes = [];
    const calibrations = [];
    const rendus = [];

    const finish = () => writeOutputs({
        pageResults, touches, touchFatals, gz, notes, calibrations, rendus,
        entete: [
            `Lighthouse ${version} (préréglage mobile : throttling simulé « Slow 4G », écran mobile), Chromium complet de Playwright. Processeur : ralentissement calibré à chaque tour sur l'indice de puissance mesuré, pour le même téléphone de référence (×${REFERENCE_CPU.multiplier} pour un indice de ${REFERENCE_CPU.benchmarkIndex}) : ${calibrations.map((c) => `tour ${c.tour} indice ${c.benchmarkIndex ?? '?'} → ×${c.multiplier}`).join(' ; ') || 'aucun tour'} (valeurs brutes : perf/calibration.tsv).`,
            `Chargements réels et touchers : Playwright, vue mobile 390 × 844, 4G simulée par CDP (562,5 ms, 1,44 Mbit/s), processeur ×4. Application ${base}${proxy ? ' (HTTP/2, relais local devant next start, comme la production)' : ' (HTTP/1.1, next start direct)'}.`,
            `Durée de la mesure : ${Math.round((Date.now() - T0) / 1000)} s.`,
        ],
    });
    const watchdog = setTimeout(() => {
        notes.push(`! Temps imparti (${WATCHDOG_MS / 60_000} min) dépassé : rapport partiel.`);
        try { finish(); } catch (err) { console.error(`[${TAG}] rapport partiel impossible : ${errText(err)}`); }
        console.error(`[${TAG}] ÉCHEC : temps imparti dépassé`);
        process.exit(1);
    }, WATCHDOG_MS);
    watchdog.unref();

    const browser = await chromium.launch({ channel: 'chromium', headless: true, args: [HOST_RESOLVER, '--ignore-certificate-errors'] });
    let session = null;
    try {
        // 1. Session du client
        try {
            session = await prepareSession(browser, base, pages[2]);
            log(`session du client valide (${session.state.cookies.length} cookie(s))`);
        } catch (err) {
            res('mes-billets').fatal = errText(err);
            log(`Mes billets : ${errText(err)}`);
        }

        // 2. Lighthouse : passages entrelacés (page 1, 2, 3, puis passage suivant)
        for (let pass = 1; pass <= PASSAGES; pass++) {
            // Calibration du tour : un passage de l'accueil au préréglage (×4), non compté ; son indice de puissance fixe le
            // ralentissement des trois pages de ce tour (valeurs brutes gardées : perf/calibration.tsv)
            let cpuSlowdownMultiplier = REFERENCE_CPU.multiplier;
            if (remaining() >= 60_000) {
                try {
                    const cal = summarize((await lighthouseRun({ lighthouse, exe, url: `${base}${pages[0].path}`, cookies: [] })).lhr);
                    cpuSlowdownMultiplier = calibratedCpuMultiplier(cal.benchmarkIndex);
                    calibrations.push({ tour: pass, benchmarkIndex: cal.benchmarkIndex, multiplier: cpuSlowdownMultiplier, score: cal.score, tbt: cal.tbt, lcp: cal.lcp, error: cal.error });
                    log(`calibration du tour ${pass} : indice ${cal.benchmarkIndex ?? '?'} → ×${cpuSlowdownMultiplier} (brut ×4 : score ${cal.score}, TBT ${fmtMs(cal.tbt)})`);
                } catch (err) {
                    calibrations.push({ tour: pass, benchmarkIndex: null, multiplier: cpuSlowdownMultiplier, score: null, tbt: null, lcp: null, error: errText(err) });
                    log(`calibration du tour ${pass} impossible (${errText(err)}) : ×${cpuSlowdownMultiplier}`);
                }
            }
            for (const def of pages) {
                const r = res(def.id);
                if (r.fatal) continue;
                if (remaining() < 30_000) { r.lighthouse.push({ error: 'temps imparti dépassé, passage non lancé' }); lhrs.get(def.id).push(null); continue; }
                const started = Date.now();
                try {
                    const out = await lighthouseRun({ lighthouse, exe, url: `${base}${def.path}`, cookies: def.client ? session.state.cookies : [], cpuSlowdownMultiplier });
                    if (def.client && out.cookies) session.state = { ...session.state, cookies: out.cookies };
                    const s = summarize(out.lhr);
                    if (!s.error && def.expectedPath && !finalPathMatches(s.finalUrl, def.expectedPath)) {
                        s.error = `page finale ${s.finalUrl} au lieu de ${def.expectedPath}`;
                        if (def.client) r.fatal = `Mes billets mesurée sur une autre page (${s.finalUrl}) : session perdue, mesure invalide`;
                    }
                    r.lighthouse.push(s);
                    lhrs.get(def.id).push(out.lhr);
                    log(`${def.id} Lighthouse ${pass}/${PASSAGES} : ${s.error ? `ERREUR ${s.error}` : `score ${s.score}, LCP ${fmtMs(s.lcp)}, CLS ${fmtCls(s.cls)}, TBT ${fmtMs(s.tbt)}, FCP ${fmtMs(s.fcp)}, SI ${fmtMs(s.si)}, ${fmtBytes(s.bytes)}, indice ${s.benchmarkIndex ?? '?'}, processeur ×${s.cpu ?? '?'}`} (${Math.round((Date.now() - started) / 1000)} s)`);
                } catch (err) {
                    r.lighthouse.push({ error: errText(err) });
                    lhrs.get(def.id).push(null);
                    log(`${def.id} Lighthouse ${pass}/${PASSAGES} : ERREUR ${errText(err)}`);
                }
            }
        }

        // 3. Chargements réels (CLS mesuré)
        for (let pass = 1; pass <= PASSAGES; pass++) {
            for (const def of pages) {
                const r = res(def.id);
                if (r.fatal) continue;
                if (remaining() < 20_000) { r.reel.push({ error: 'temps imparti dépassé, chargement non lancé' }); continue; }
                const out = await realLoad(browser, base, def, session);
                if (out.fatal) r.fatal = `chargement réel : ${out.error} (session perdue ?)`;
                delete out.fatal;
                r.reel.push(out);
                log(`${def.id} chargement réel ${pass}/${PASSAGES} : ${out.error ? `ERREUR ${out.error}` : `CLS ${fmtCls(out.cls)} (${out.decalages} décalage(s)), LCP ${fmtMs(out.lcp)}`}`);
            }
        }

        // 3 bis. Décision du 18/11 : travail de rendu de Mes billets, avant / après (animations en boucle), même run
        if (session && !res('mes-billets').fatal) {
            const cpuRate = calibrations.length ? calibrations[calibrations.length - 1].multiplier : REFERENCE_CPU.multiplier;
            for (let pass = 1; pass <= 3; pass++) {
                for (const variant of ['avant', 'apres']) {
                    if (remaining() < 60_000) { rendus.push({ variant, pass, error: 'temps imparti dépassé' }); continue; }
                    const out = await renderWork(browser, base, pages[2], session, variant, cpuRate);
                    rendus.push({ variant, pass, cpu: cpuRate, ...out });
                    log(`Mes billets, rendu ${variant} ${pass}/3 : ${out.error ? `ERREUR ${out.error}` : `style et mise en page ${out.styleMs} ms, peinture ${out.paintMs} ms (10 s, processeur ×${cpuRate})`}`);
                }
            }
        }

        // 4. Toucher
        // Design 1b (run 373) : l'accueil n'a plus de puces (le repli touchait le bouton du thème) : puces d'Explorer
        const explorerDef = { id: 'explorer', libelle: 'Explorer (puces de filtre)', path: '/explore', expectedPath: '/explore', client: false };
        for (const def of [explorerDef, pages[2]]) {
            if (def.client && !session) { touchFatals.push(`${def.libelle} : session du client indisponible, aucun toucher`); continue; }
            if (remaining() < 20_000) { touchFatals.push(`${def.libelle} : temps imparti dépassé, aucun toucher`); continue; }
            const out = await touchPage(browser, base, def, TOUCH_TARGETS[def.id], session, TOUCHERS_PAR_PAGE);
            touches.push(...out.touches);
            if (out.fatal) touchFatals.push(out.fatal);
        }
    } finally {
        await browser.close().catch(() => {});
        if (proxy) await proxy.close().catch(() => {});
    }

    // Détails lisibles et rapports complets du passage médian
    for (const r of pageResults) {
        const ok = r.lighthouse.filter((p) => !p.error);
        if (ok.length > 0) {
            const med = median(ok.map((p) => p.score));
            const idx = r.lighthouse.indexOf(ok.reduce((best, p) => (Math.abs(p.score - med) < Math.abs(best.score - med) ? p : best), ok[0]));
            const s = r.lighthouse[idx];
            if (s.lcpElement) r.details.push(`élément du LCP (passage ${idx + 1}) : ${s.lcpElement.selector ?? ''} ${s.lcpElement.snippet}`.trim());
            if (s.clsElements?.length) r.details.push(`éléments qui bougent (passage ${idx + 1}) : ${s.clsElements.map((n) => n.selector ?? n.snippet).join(' ; ')}`);
            r.details.push(`poids transféré (médiane) : ${fmtBytes(median(ok.map((p) => p.bytes)))} ; TBT ${fmtMs(median(ok.map((p) => p.tbt)))} ; FCP ${fmtMs(median(ok.map((p) => p.fcp)))} ; Speed Index ${fmtMs(median(ok.map((p) => p.si)))}`);
            const lcpReel = median(r.reel.filter((p) => !p.error).map((p) => p.lcp));
            if (lcpReel !== null) r.details.push(`LCP réel (Playwright, « Slow 4G » DevTools, plus sévère que Lighthouse ; information) : médiane ${fmtMs(lcpReel)}`);
            const lhr = lhrs.get(r.id)?.[idx];
            if (lhr) gz.push([r.id, compactLhr(lhr)]);
        }
    }
    clearTimeout(watchdog);
    const rapport = finish();
    process.stdout.write(`\n${rapport.texte}`);
    process.exit(rapport.ok ? 0 : 1);
}

// ── --dry : configuration et essai de la mécanique sur une page locale ───────

const ESSAI_HTML = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Essai de mesure</title><style>body{font:16px system-ui;margin:16px}button{min-height:44px;padding:0 16px;border-radius:22px}</style></head>
<body><main><h1>Essai de la mesure mobile</h1><p>Page servie par scripts/e2e/perf-mobile.mjs --dry.</p>
<div role="group" aria-label="Catégorie"><button type="button" aria-pressed="true">Tous</button> <button type="button" aria-pressed="false">Concerts</button> <button type="button" aria-pressed="false">Soirées</button></div>
<script>document.querySelectorAll('[role=group] button').forEach(function (b) { b.addEventListener('click', function () {
document.querySelectorAll('[role=group] button').forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); }); }); });</script>
</main></body></html>`;

async function dry() {
    const checks = [];
    const check = (nom, ok, detail, bloquant = true) => {
        checks.push({ nom, ok, detail, bloquant });
        log(`${ok ? 'OK ' : bloquant ? 'KO ' : '-- '} ${nom} : ${detail}`);
    };
    let base = null;
    try { base = appUrl(); check('URL de l\'application', true, base); } catch (err) { check('URL de l\'application', false, errText(err)); }
    check('.env.e2e', fs.existsSync(ENV_FILE), fs.existsSync(ENV_FILE) ? path.relative(ROOT, ENV_FILE) : 'absent (généré par la CI ; normal hors CI)', false);
    try { check('événement « ce soir » (demo-ids.json)', true, ceSoirId()); } catch (err) { check('événement « ce soir » (demo-ids.json)', false, `${errText(err)} (normal hors CI)`, false); }
    try {
        const s = readClientState();
        check('session du client de mesure (.auth/mesure.json)', true, `${s.cookies.length} cookie(s) : ${s.cookies.map((c) => c.name).join(', ')}`);
    } catch (err) { check('session du client de mesure (.auth/mesure.json)', false, `${errText(err)} (normal hors CI)`, false); }
    check('WebSocket de Node', typeof WebSocket === 'function', `Node ${process.version}`);
    let exe = null;
    try { exe = chromiumPath(); check('Chromium complet de Playwright', true, exe); } catch (err) { check('Chromium complet de Playwright', false, errText(err)); }
    let lh = null;
    try {
        lh = await loadLighthouse();
        const pkg = readJson(path.join(ROOT, 'package.json'));
        const declared = pkg.devDependencies?.lighthouse;
        check('Lighthouse', declared === lh.version, `installé ${lh.version}, déclaré ${declared ?? 'absent'} (version exacte attendue)`);
    } catch (err) { check('Lighthouse', false, errText(err)); }

    if (exe && lh) {
        // Essai complet sur une page locale : cookie transmis à Lighthouse, CLS réel, touchers
        const cookiesVus = [];
        const server = http.createServer((req, res) => {
            if (req.url === '/' || req.url?.startsWith('/?')) cookiesVus.push(req.headers.cookie ?? '');
            res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
            res.end(ESSAI_HTML);
        });
        await new Promise((r) => { server.listen(0, '127.0.0.1', r); });
        const essai = `http://127.0.0.1:${server.address().port}`;
        const host = new URL(essai).hostname;
        const { chromium } = require('@playwright/test');
        let browser = null;
        try {
            const started = Date.now();
            const out = await lighthouseRun({ lighthouse: lh.lighthouse, exe, url: `${essai}/`, cookies: [{ name: 'ev_essai', value: '1', domain: host, path: '/', expires: -1, httpOnly: true, secure: false, sameSite: 'Lax' }] });
            const s = summarize(out.lhr);
            check('essai Lighthouse (page locale)', !s.error && s.score !== null, s.error ?? `score ${s.score}, LCP ${fmtMs(s.lcp)}, CLS ${fmtCls(s.cls)}, TBT ${fmtMs(s.tbt)}, ${fmtBytes(s.bytes)}, réglages ${s.reglages.formFactor}/${s.reglages.throttlingMethod} (${Math.round((Date.now() - started) / 1000)} s)`);
            check('cookie transmis par Lighthouse', cookiesVus.some((c) => c.includes('ev_essai=1')), `en-têtes Cookie reçus : ${cookiesVus.map((c) => c || '(vide)').join(' | ') || 'aucune requête'}`);
            check('cookies relus après le passage', Array.isArray(out.cookies) && out.cookies.some((c) => c.name === 'ev_essai'), `${out.cookies?.length ?? 0} cookie(s)`);
            check('URL finale contrôlée', finalPathMatches(s.finalUrl, '/'), String(s.finalUrl));
            check('rapport compressé', true, fmtBytes(compactLhr(out.lhr).length));

            browser = await chromium.launch({ channel: 'chromium', headless: true, args: [HOST_RESOLVER] });
            const def = { id: 'essai', libelle: 'Essai', path: '/', expectedPath: '/', client: false };
            const reel = await realLoad(browser, essai, def, null);
            check('essai chargement réel (CLS)', !reel.error, reel.error ?? `CLS ${fmtCls(reel.cls)}, LCP ${fmtMs(reel.lcp)}`);
            const t = await touchPage(browser, essai, def, TOUCH_TARGETS.accueil, null, 3);
            const v = verdictToucher(t.touches, t.fatal ? [t.fatal] : []);
            check('essai toucher (Event Timing)', !t.fatal && t.touches.length === 3 && t.touches.every((x) => !x.error && x.etatChange), `${t.fatal ?? ''}${v.textes.join(' ; ')}`);
        } catch (err) {
            check('essai de la mécanique', false, errText(err));
        } finally {
            await browser?.close().catch(() => {});
            server.close();
        }
    }
    const ko = checks.filter((c) => !c.ok && c.bloquant);
    log(ko.length === 0
        ? `--dry : configuration et mécanique OK (${Math.round((Date.now() - T0) / 1000)} s)${checks.some((c) => !c.ok) ? ' ; fichiers propres à la CI absents ici (non bloquant)' : ''}`
        : `--dry : ÉCHEC (${ko.map((c) => c.nom).join(', ')})`);
    process.exit(ko.length === 0 ? 0 : 1);
}

(DRY ? dry() : main()).catch((err) => {
    console.error(`[${TAG}] ÉCHEC inattendu : ${err instanceof Error ? err.stack ?? err.message : String(err)}`);
    process.exit(1);
});

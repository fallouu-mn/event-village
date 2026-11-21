#!/usr/bin/env node
/**
 * Design 1e (vitesse) — DIAGNOSTIC du temps processeur des pages mesurées (accueil, fiche, Mes billets), lancé par le job
 * « perf » de la CI après la mesure (scripts/e2e/perf-mobile.mjs). Information seulement : n'entre dans aucun verdict
 * et ne change ni les seuils, ni la calibration, ni la mesure.
 *
 * Pourquoi : Lighthouse attribue le travail de React au fichier qui contient son planificateur (le morceau commun de
 * Next) ; pour savoir QUEL code coûte, il faut le profil processeur, fonction par fonction.
 *
 * Ce que fait le script : Chromium de Playwright, vue mobile 390 × 844, 4G simulée et processeur ×4 (comme les
 * chargements réels de perf-mobile.mjs), relais HTTP/2 local ; pour chaque page, PASSAGES chargements, profil CDP
 * (Profiler, échantillon toutes les 100 µs) du début de la navigation à 4 s après « load » ; temps propre (self) et
 * temps total de chaque fonction (nom, fichier, ligne, colonne), puis par fichier. Sorties dans .e2e-captures/perf/ :
 *  - profil-<page>.txt : les 60 fonctions au plus grand temps propre, les 40 au plus grand temps total (hors racine),
 *    le temps par fichier, en millisecondes (moyenne des passages) ;
 *  - profil-<page>.cpuprofile.gz : le profil brut du dernier passage (relu sur le build local, mêmes noms de fichiers).
 * Code de sortie : toujours 0 sauf configuration absente (diagnostic).
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { createRequire } from 'node:module';
import { startH2Proxy } from './h2-proxy.mjs';

const TAG = 'perf-profil';
const ROOT = process.cwd();
const require = createRequire(import.meta.url);
const PERF_DIR = path.join(ROOT, '.e2e-captures', 'perf');
const PASSAGES = Number(process.env.PERF_PROFIL_PASSAGES || 3);
const MOBILE = {
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
    userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36',
};
const NET_4G = { offline: false, latency: 562.5, downloadThroughput: 1_440_000 / 8, uploadThroughput: 675_000 / 8 };
const log = (m) => console.log(`[${TAG}] ${m}`);
const errText = (e) => (e instanceof Error ? e.message.split('\n')[0] : String(e));

function envValue(key) {
    const file = path.join(ROOT, process.env.EV_E2E_ENV_FILE || '.env.e2e');
    if (process.env[key]) return process.env[key];
    if (!fs.existsSync(file)) return undefined;
    const line = fs.readFileSync(file, 'utf8').split(/\r?\n/).find((l) => l.startsWith(`${key}=`));
    return line ? line.slice(key.length + 1).trim() : undefined;
}

/** Temps propre et total par nœud d'un profil CDP (ms), regroupés par (fonction, fichier, ligne, colonne). */
export function aggregateProfile(profile) {
    const nodes = new Map(profile.nodes.map((n) => [n.id, n]));
    const parent = new Map();
    for (const n of profile.nodes) for (const c of n.children ?? []) parent.set(c, n.id);
    const selfUs = new Map();
    const { samples = [], timeDeltas = [] } = profile;
    for (let i = 0; i < samples.length; i += 1) {
        const dt = timeDeltas[i + 1] ?? timeDeltas[i] ?? 0;
        selfUs.set(samples[i], (selfUs.get(samples[i]) ?? 0) + Math.max(0, dt));
    }
    const keyOf = (n) => {
        const f = n.callFrame;
        return `${f.functionName || '(anonyme)'}\t${f.url ? f.url.replace(/^https?:\/\/[^/]+/, '') : '(natif)'}\t${f.lineNumber + 1}\t${f.columnNumber + 1}`;
    };
    const self = new Map();
    const total = new Map();
    const byFile = new Map();
    for (const [id, us] of selfUs) {
        const n = nodes.get(id);
        if (!n) continue;
        const k = keyOf(n);
        self.set(k, (self.get(k) ?? 0) + us / 1000);
        const file = n.callFrame.url ? n.callFrame.url.replace(/^https?:\/\/[^/]+/, '') : `(${n.callFrame.functionName || 'natif'})`;
        byFile.set(file, (byFile.get(file) ?? 0) + us / 1000);
        // total : chaque ancêtre distinct (par clé) reçoit le temps une seule fois (récursion)
        const seen = new Set();
        let cur = id;
        while (cur !== undefined) {
            const cn = nodes.get(cur);
            const ck = keyOf(cn);
            if (!seen.has(ck)) { seen.add(ck); total.set(ck, (total.get(ck) ?? 0) + us / 1000); }
            cur = parent.get(cur);
        }
    }
    return { self, total, byFile };
}

/**
 * Où se trouve une fonction du profil dans le build de la CI (.next/static/…, mêmes fichiers que ceux mesurés) : le module
 * webpack qui la contient (dernier « <id>:(e,t,r)=> » avant la colonne) et un extrait du code. Rien si le fichier manque.
 */
const chunkCache = new Map();
function sourceAt(urlPath, line, column) {
    if (!urlPath.startsWith('/_next/static/')) return null;
    const file = path.join(ROOT, '.next', urlPath.slice('/_next/'.length).split('?')[0]);
    if (!chunkCache.has(file)) chunkCache.set(file, fs.existsSync(file) ? fs.readFileSync(file, 'utf8').split('\n') : null);
    const lines = chunkCache.get(file);
    const text = lines?.[line - 1];
    if (!text) return null;
    const before = text.slice(0, column - 1);
    let moduleId = '?';
    for (const m of before.matchAll(/[,{](\d{1,6}):(?:function\(|\(\w?,?\w?,?\w?\)=>|\w=>)/g)) moduleId = m[1];
    const snippet = text.slice(Math.max(0, column - 1), column - 1 + 220).replace(/\s+/g, ' ');
    const strings = [...text.slice(Math.max(0, column - 1), column - 1 + 4000).matchAll(/"([^"\\]{6,60})"/g)].slice(0, 6).map((m) => m[1]);
    return { moduleId, snippet, strings };
}

function addInto(acc, m) {
    for (const [k, v] of m) acc.set(k, (acc.get(k) ?? 0) + v);
}

function top(m, n, divisor, skip = () => false) {
    return [...m.entries()].filter(([k]) => !skip(k)).sort((a, b) => b[1] - a[1]).slice(0, n)
        .map(([k, v]) => `${(v / divisor).toFixed(1).padStart(8)} ms\t${k}`);
}

async function main() {
    const authFile = path.join(ROOT, '.auth', 'client.json');
    const demoFile = path.join(ROOT, '.e2e-captures', 'demo-ids.json');
    if (!fs.existsSync(authFile) || !fs.existsSync(demoFile)) {
        log(`configuration absente (${fs.existsSync(authFile) ? '' : '.auth/client.json '}${fs.existsSync(demoFile) ? '' : 'demo-ids.json'}) : aucun profil.`);
        process.exit(1);
    }
    const state = JSON.parse(fs.readFileSync(authFile, 'utf8'));
    const ceSoir = JSON.parse(fs.readFileSync(demoFile, 'utf8'))?.events?.ceSoir?.id;
    let base = new URL(envValue('NEXT_PUBLIC_APP_URL') || 'http://localhost:3000').origin;
    const proxy = await startH2Proxy(base.replace('localhost', '127.0.0.1'), path.join(os.tmpdir(), 'ev-h2-proxy-profil'));
    base = proxy.origin;
    const { chromium } = require('@playwright/test');
    const browser = await chromium.launch({ args: ['--host-resolver-rules=MAP localhost 127.0.0.1'] });
    const pages = [
        { id: 'accueil', path: '/', client: false },
        { id: 'fiche', path: `/events/${ceSoir}`, client: false },
        { id: 'mes-billets', path: '/tickets?tab=a-venir', client: true },
    ];
    fs.mkdirSync(PERF_DIR, { recursive: true });
    let session = state;
    for (const def of pages) {
        const self = new Map(); const total = new Map(); const byFile = new Map();
        let ok = 0; let lastProfile = null; const notes = [];
        for (let i = 0; i < PASSAGES; i += 1) {
            const context = await browser.newContext({
                ...MOBILE, locale: 'fr-FR', timezoneId: 'Africa/Dakar', serviceWorkers: 'block', ignoreHTTPSErrors: true,
                colorScheme: 'light', storageState: def.client ? session : { cookies: [], origins: [] },
            });
            try {
                const page = await context.newPage();
                const cdp = await context.newCDPSession(page);
                await cdp.send('Network.enable');
                await cdp.send('Network.setBlockedURLs', { urls: ['*tile.openstreetmap.org*', '*unsplash.com*'] });
                await cdp.send('Network.emulateNetworkConditions', NET_4G);
                await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
                await cdp.send('Profiler.enable');
                await cdp.send('Profiler.setSamplingInterval', { interval: 100 });
                await cdp.send('Profiler.start');
                await page.goto(`${base}${def.path}`, { waitUntil: 'load', timeout: 90_000 });
                await page.waitForTimeout(4_000);
                const { profile } = await cdp.send('Profiler.stop');
                if (def.client) session = await context.storageState();
                const finalPath = new URL(page.url()).pathname;
                if (finalPath !== def.path.split('?')[0]) { notes.push(`passage ${i + 1} : page finale ${finalPath}`); continue; }
                const a = aggregateProfile(profile);
                addInto(self, a.self); addInto(total, a.total); addInto(byFile, a.byFile);
                lastProfile = profile; ok += 1;
            } catch (err) {
                notes.push(`passage ${i + 1} : ${errText(err)}`);
            } finally {
                await context.close().catch(() => {});
            }
        }
        const skipRoot = (k) => /^\((root|program|idle|garbage collector)\)/.test(k);
        const lines = [
            `Profil processeur (diagnostic, design 1e) — ${def.id} ${def.path} — ${ok} passage(s) valide(s) sur ${PASSAGES}, vue mobile, 4G simulée, processeur ×4, jusqu'à « load » + 4 s ; moyenne par passage.`,
            ...notes.map((n) => `! ${n}`),
            '', '== Temps par fichier ==', ...top(byFile, 40, ok || 1),
            '', '== 60 plus grands temps propres (fonction, fichier, ligne, colonne) ==', ...top(self, 60, ok || 1, skipRoot),
            '', '== 40 plus grands temps totaux (hors racine) ==', ...top(total, 40, ok || 1, skipRoot),
        ];
        // Sources des 30 fonctions les plus coûteuses (temps propre et temps total) : module et extrait du build mesuré
        const seen = new Set();
        lines.push('', '== Sources (module webpack et extrait du build mesuré) des fonctions les plus coûteuses ==');
        const ranked = (m) => [...m.entries()].sort((x, y) => y[1] - x[1]).slice(0, 30).map(([k]) => k);
        for (const k of [...ranked(self), ...ranked(total)]) {
            if (seen.has(k) || skipRoot(k)) continue;
            seen.add(k);
            const [fn, url, ln, col] = k.split('\t');
            const src = sourceAt(url, Number(ln), Number(col));
            if (src) lines.push(`${fn} ${url}:${ln}:${col} — module ${src.moduleId} — ${src.snippet}${src.strings.length ? ` — textes : ${src.strings.join(' | ')}` : ''}`);
        }
        fs.writeFileSync(path.join(PERF_DIR, `profil-${def.id}.txt`), `${lines.join('\n')}\n`, 'utf8');
        if (lastProfile) fs.writeFileSync(path.join(PERF_DIR, `profil-${def.id}.cpuprofile.gz`), zlib.gzipSync(JSON.stringify(lastProfile)));
        log(`${def.id} : ${ok}/${PASSAGES} passage(s) ; ${lines.slice(4, 9).join(' | ')}`);
    }
    await browser.close();
    await proxy.close?.();
}

main().then(() => process.exit(0), (err) => { console.error(`[${TAG}] ${errText(err)}`); process.exit(0); });

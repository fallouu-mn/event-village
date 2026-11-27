#!/usr/bin/env node
/**
 * Lot 12b — mesure A/B de la fiche événement (branche de mesure jetable lot12b/mesure-ab, jamais fusionnée).
 *
 * Décision de l'utilisateur (27/11) : chercher la cause de la fiche à 89 (runs 752 et 760) par UN run où main et la
 * branche sont construites dans le MÊME job et mesurées sur la MÊME machine, en alternance (main, branche, main,
 * branche…), 5 passages chacune, même événement (« ce soir » du seed de démonstration), mêmes données (une seule base).
 *
 * Mécanique reprise de scripts/e2e/perf-mobile.mjs, sans changement : Lighthouse (préréglage mobile, 4G simulée), Chromium
 * complet de Playwright, profil neuf par passage, relais HTTP/2 local devant chaque `next start`, hôtes externes bloqués,
 * ralentissement du processeur calibré à chaque tour (un passage de l'accueil de la branche au préréglage ×4, non
 * compté) et appliqué AUX DEUX côtés du tour.
 *
 * Diagnostic dans le même run (point 2 de la décision, pour ne pas refaire de run) : pour chaque passage, scripts
 * exécutés (audit bootup-time), répartition du travail du fil principal, longues tâches, requêtes de scripts ; puis
 * 5 profils processeur de la fiche par côté, en alternance (Playwright, ×4, 4G simulée, jusqu'à « load » + 4 s).
 *
 * Entrées : AB_MAIN (http://localhost:3001), AB_BRANCHE (http://localhost:3000), .e2e-captures/demo-ids.json.
 * Sorties (.e2e-captures/perf/, publiées dans ci-results runs/<n>/perf/) : ab.txt (résumé), ab-fiche.tsv,
 * ab-scripts.tsv, ab-travail.tsv, ab-longues-taches.tsv, ab-requetes-js.tsv, ab-profil.txt,
 * lighthouse-ab-main.json.gz et lighthouse-ab-branche.json.gz (passage médian de chaque côté).
 * Code de sortie : 0 (diagnostic), 1 si la configuration manque ou si une application ne répond pas.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { createRequire } from 'node:module';
import { startH2Proxy } from './h2-proxy.mjs';
import { REFERENCE_CPU, calibratedCpuMultiplier, median } from './perf-mobile-seuils.mjs';

const TAG = 'perf-ab';
const ROOT = process.cwd();
const require = createRequire(import.meta.url);
const PERF_DIR = path.join(ROOT, '.e2e-captures', 'perf');
const TOURS = 5;
const PROFILS = 5;
const LIGHTHOUSE_TIMEOUT_MS = 150_000;
const HOST_RESOLVER = '--host-resolver-rules=MAP localhost 127.0.0.1';
const BLOCKED_URLS = ['*tile.openstreetmap.org*', '*tiles.stadiamaps.com*', '*unsplash.com*'];
const MOBILE = {
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true,
    userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36',
};
const NET_4G = { offline: false, latency: 562.5, downloadThroughput: 1_440_000 / 8, uploadThroughput: 675_000 / 8 };

const log = (m) => console.log(`[${TAG}] ${m}`);
const errText = (e) => (e instanceof Error ? e.message.split('\n')[0] : String(e));
const sleep = (ms) => new Promise((r) => { setTimeout(r, ms); });
const r0 = (v) => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v) : '');
const r1 = (v) => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v * 10) / 10 : '');
const cell = (v) => String(v ?? '').replace(/[\t\r\n]+/g, ' ');

/** Nom d'un script sans l'empreinte du build (les deux constructions n'ont pas les mêmes empreintes). */
function scriptName(url) {
    let p = String(url ?? '');
    try { p = new URL(p).pathname; } catch { /* déjà un chemin */ }
    try { p = decodeURIComponent(p); } catch { /* laissé tel quel */ }
    return p.replace(/^\/_next\/static\/chunks\//, '').replace(/-[0-9a-f]{16}(?=\.js$)/, '').replace(/\.[0-9a-f]{8}(?=\.js$)/, '');
}

function withTimeout(promise, ms, label) {
    let timer;
    return Promise.race([
        promise.finally(() => clearTimeout(timer)),
        new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`${label} : pas de fin en ${Math.round(ms / 1000)} s`)), ms); }),
    ]);
}

function freePort() {
    return new Promise((resolve, reject) => {
        const srv = net.createServer();
        srv.unref();
        srv.on('error', reject);
        srv.listen(0, '127.0.0.1', () => { const { port } = srv.address(); srv.close(() => resolve(port)); });
    });
}

async function devtoolsReady(port, timeoutMs) {
    const until = Date.now() + timeoutMs;
    while (Date.now() < until) {
        try {
            const res = await fetch(`http://127.0.0.1:${port}/json/version`, { signal: AbortSignal.timeout(2_000) });
            if (res.ok && (await res.json()).webSocketDebuggerUrl) return;
        } catch { /* pas encore prêt */ }
        await sleep(200);
    }
    throw new Error(`Chromium ne répond pas sur le port ${port}`);
}

async function killProcess(proc) {
    if (proc.exitCode !== null || proc.signalCode !== null) return;
    const exited = new Promise((r) => { proc.once('exit', r); });
    try { proc.kill('SIGKILL'); } catch { /* déjà arrêté */ }
    await Promise.race([exited, sleep(5_000)]);
}

/** Un passage Lighthouse anonyme (mêmes réglages que perf-mobile.mjs). */
async function lighthouseRun(lighthouse, exe, url, cpuSlowdownMultiplier) {
    const port = await freePort();
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ev-ab-lh-'));
    const proc = spawn(exe, [
        `--remote-debugging-port=${port}`, `--user-data-dir=${dir}`, '--headless=new', '--no-first-run', '--no-default-browser-check',
        '--disable-extensions', '--disable-sync', '--disable-component-update', '--disable-default-apps', '--disable-background-networking',
        '--mute-audio', '--metrics-recording-only', '--password-store=basic', '--use-mock-keychain', HOST_RESOLVER, '--ignore-certificate-errors',
        ...(process.platform === 'linux' ? ['--no-sandbox'] : []), 'about:blank',
    ], { stdio: ['ignore', 'ignore', 'ignore'] });
    try {
        await devtoolsReady(port, 30_000);
        const run = lighthouse(url, {
            port, output: 'json', logLevel: 'error', onlyCategories: ['performance'], disableFullPageScreenshot: true,
            blockedUrlPatterns: BLOCKED_URLS,
            ...(cpuSlowdownMultiplier ? { throttling: { cpuSlowdownMultiplier } } : {}),
        });
        run.catch(() => { /* rejet tardif ignoré */ });
        const result = await withTimeout(run, LIGHTHOUSE_TIMEOUT_MS, 'Lighthouse');
        if (!result?.lhr) throw new Error('aucun rapport');
        return result.lhr;
    } finally {
        await killProcess(proc);
        try { fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); } catch { /* best effort */ }
    }
}

/** Mesures et détails utiles à la comparaison. */
function summarize(lhr) {
    const a = lhr.audits ?? {};
    const num = (id) => (Number.isFinite(a[id]?.numericValue) ? a[id].numericValue : null);
    const raw = lhr.categories?.performance?.score;
    const score = typeof raw === 'number' ? Math.round(raw * 100) : null;
    const items = (id) => (Array.isArray(a[id]?.details?.items) ? a[id].details.items : []);
    const scripts = items('bootup-time').map((i) => ({ script: scriptName(i.url), total: i.total ?? null, scripting: i.scripting ?? null, parse: i.scriptParseCompile ?? null }));
    const travail = items('mainthread-work-breakdown').map((i) => ({ groupe: i.groupLabel ?? i.group ?? '?', duree: i.duration ?? null }));
    const longues = items('long-tasks').map((i) => ({ script: scriptName(i.url), debut: i.startTime ?? null, duree: i.duration ?? null }));
    const js = items('network-requests').filter((i) => i.resourceType === 'Script').map((i) => ({ script: scriptName(i.url), transfert: i.transferSize ?? 0, taille: i.resourceSize ?? 0 }));
    return {
        score, tbt: num('total-blocking-time'), lcp: num('largest-contentful-paint'), fcp: num('first-contentful-paint'), si: num('speed-index'),
        cls: num('cumulative-layout-shift'), octets: num('total-byte-weight'), jsOctets: js.reduce((s, x) => s + (x.transfert || 0), 0),
        benchmarkIndex: Number.isFinite(lhr.environment?.benchmarkIndex) ? lhr.environment.benchmarkIndex : null,
        cpu: lhr.configSettings?.throttling?.cpuSlowdownMultiplier ?? null,
        finalUrl: lhr.finalDisplayedUrl ?? lhr.finalUrl ?? null,
        error: lhr.runtimeError ? `${lhr.runtimeError.code} ${lhr.runtimeError.message ?? ''}`.trim() : (score === null ? 'score absent' : null),
        scripts, travail, longues, js,
    };
}

function compactLhr(lhr) {
    const copy = { ...lhr, audits: { ...lhr.audits } };
    for (const id of ['screenshot-thumbnails', 'final-screenshot', 'full-page-screenshot']) delete copy.audits[id];
    delete copy.fullPageScreenshot;
    delete copy.i18n;
    return zlib.gzipSync(Buffer.from(JSON.stringify(copy)), { level: 9 });
}

/** Temps propre par fonction et par fichier d'un profil CDP (ms), comme scripts/e2e/perf-profil.mjs. */
function aggregateProfile(profile) {
    const nodes = new Map(profile.nodes.map((n) => [n.id, n]));
    const self = new Map();
    const byFile = new Map();
    const { samples = [], timeDeltas = [] } = profile;
    for (let i = 0; i < samples.length; i += 1) {
        const n = nodes.get(samples[i]);
        if (!n) continue;
        const ms = Math.max(0, timeDeltas[i + 1] ?? timeDeltas[i] ?? 0) / 1000;
        const f = n.callFrame;
        const file = f.url ? scriptName(f.url.replace(/^https?:\/\/[^/]+/, '')) : `(${f.functionName || 'natif'})`;
        byFile.set(file, (byFile.get(file) ?? 0) + ms);
        const k = `${f.functionName || '(anonyme)'}\t${file}`;
        self.set(k, (self.get(k) ?? 0) + ms);
    }
    return { self, byFile };
}

async function profileOnce(browser, url) {
    const context = await browser.newContext({ ...MOBILE, locale: 'fr-FR', timezoneId: 'Africa/Dakar', serviceWorkers: 'block', ignoreHTTPSErrors: true, colorScheme: 'light' });
    try {
        const page = await context.newPage();
        const cdp = await context.newCDPSession(page);
        await cdp.send('Network.enable');
        await cdp.send('Network.setBlockedURLs', { urls: BLOCKED_URLS });
        await cdp.send('Network.emulateNetworkConditions', NET_4G);
        await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
        await cdp.send('Profiler.enable');
        await cdp.send('Profiler.setSamplingInterval', { interval: 100 });
        await cdp.send('Profiler.start');
        await page.goto(url, { waitUntil: 'load', timeout: 90_000 });
        await page.waitForTimeout(4_000);
        const { profile } = await cdp.send('Profiler.stop');
        const scripts = await page.evaluate(() => performance.getEntriesByType('resource').filter((e) => e.initiatorType === 'script' || e.name.endsWith('.js')).map((e) => e.name));
        return { profile, finalPath: new URL(page.url()).pathname, scripts };
    } finally {
        await context.close().catch(() => {});
    }
}

const statLine = (label, vals, fmt = (v) => String(v)) => {
    const ok = vals.filter((v) => typeof v === 'number' && Number.isFinite(v));
    return `${label} : médiane ${ok.length ? fmt(median(ok)) : '—'} [${vals.map((v) => (typeof v === 'number' && Number.isFinite(v) ? fmt(v) : 'erreur')).join(' ; ')}]`;
};

async function main() {
    const sides = [
        { id: 'main', origin: process.env.AB_MAIN || 'http://localhost:3001' },
        { id: 'branche', origin: process.env.AB_BRANCHE || 'http://localhost:3000' },
    ];
    const demo = path.join(ROOT, '.e2e-captures', 'demo-ids.json');
    if (!fs.existsSync(demo)) { console.error(`[${TAG}] demo-ids.json absent`); process.exit(1); }
    const ceSoir = JSON.parse(fs.readFileSync(demo, 'utf8'))?.events?.ceSoir?.id;
    if (!/^[0-9a-f-]{36}$/i.test(String(ceSoir ?? ''))) { console.error(`[${TAG}] événement « ce soir » illisible`); process.exit(1); }
    const fichePath = `/events/${ceSoir}`;

    // Applications joignables, puis échauffement identique des deux côtés (rendu serveur et caches de Next)
    for (const s of sides) {
        const direct = s.origin.replace('localhost', '127.0.0.1');
        for (let i = 0; i < 3; i += 1) {
            try {
                const res = await fetch(`${direct}${fichePath}`, { redirect: 'manual', signal: AbortSignal.timeout(30_000) });
                if (res.status >= 400) throw new Error(`HTTP ${res.status}`);
                await res.arrayBuffer();
            } catch (err) {
                console.error(`[${TAG}] ${s.id} injoignable sur ${direct}${fichePath} : ${errText(err)}`);
                process.exit(1);
            }
        }
        s.proxy = await startH2Proxy(direct, path.join(os.tmpdir(), `ev-ab-h2-${s.id}`));
        s.base = s.proxy.origin;
        log(`${s.id} : ${s.origin} (relais HTTP/2 ${s.base}), fiche ${fichePath}`);
    }

    const mod = await import('lighthouse');
    const lighthouse = mod.default;
    const version = JSON.parse(fs.readFileSync(require.resolve('lighthouse/package.json'), 'utf8')).version;
    const { chromium } = require('@playwright/test');
    const exe = chromium.executablePath();
    fs.mkdirSync(PERF_DIR, { recursive: true });

    // 1. Lighthouse en alternance : calibration du tour, puis main, puis branche, même ralentissement
    const passes = [];
    const lhrs = { main: [], branche: [] };
    const calibrations = [];
    for (let tour = 1; tour <= TOURS; tour += 1) {
        let cpu = REFERENCE_CPU.multiplier;
        try {
            const cal = summarize(await lighthouseRun(lighthouse, exe, `${sides[1].base}/`, null));
            cpu = calibratedCpuMultiplier(cal.benchmarkIndex);
            calibrations.push({ tour, indice: cal.benchmarkIndex, cpu });
            log(`tour ${tour} : calibration indice ${cal.benchmarkIndex ?? '?'} → ×${cpu}`);
        } catch (err) {
            calibrations.push({ tour, indice: null, cpu, erreur: errText(err) });
            log(`tour ${tour} : calibration impossible (${errText(err)}) → ×${cpu}`);
        }
        for (const [ordre, s] of sides.entries()) {
            try {
                const lhr = await lighthouseRun(lighthouse, exe, `${s.base}${fichePath}`, cpu);
                const m = summarize(lhr);
                if (!m.error && m.finalUrl && new URL(m.finalUrl).pathname !== fichePath) m.error = `page finale ${m.finalUrl}`;
                passes.push({ tour, ordre: ordre + 1, cote: s.id, ...m });
                lhrs[s.id].push(m.error ? null : lhr);
                log(`tour ${tour} ${s.id} : ${m.error ? `ERREUR ${m.error}` : `score ${m.score}, TBT ${r0(m.tbt)} ms, LCP ${r0(m.lcp)} ms, FCP ${r0(m.fcp)} ms, SI ${r0(m.si)} ms, JS ${m.jsOctets} o, indice ${m.benchmarkIndex}, ×${m.cpu}`}`);
            } catch (err) {
                passes.push({ tour, ordre: ordre + 1, cote: s.id, error: errText(err), scripts: [], travail: [], longues: [], js: [] });
                lhrs[s.id].push(null);
                log(`tour ${tour} ${s.id} : ERREUR ${errText(err)}`);
            }
        }
    }

    // 2. Profils processeur en alternance
    const browser = await chromium.launch({ args: [HOST_RESOLVER, '--ignore-certificate-errors'] });
    const prof = Object.fromEntries(sides.map((s) => [s.id, { ok: 0, self: new Map(), byFile: new Map(), scripts: new Map(), notes: [] }]));
    for (let i = 1; i <= PROFILS; i += 1) {
        for (const s of sides) {
            const p = prof[s.id];
            try {
                const out = await profileOnce(browser, `${s.base}${fichePath}`);
                if (out.finalPath !== fichePath) { p.notes.push(`profil ${i} : page finale ${out.finalPath}`); continue; }
                const a = aggregateProfile(out.profile);
                for (const [k, v] of a.self) p.self.set(k, (p.self.get(k) ?? 0) + v);
                for (const [k, v] of a.byFile) p.byFile.set(k, (p.byFile.get(k) ?? 0) + v);
                for (const u of out.scripts) { const n = scriptName(u); p.scripts.set(n, (p.scripts.get(n) ?? 0) + 1); }
                p.ok += 1;
            } catch (err) {
                p.notes.push(`profil ${i} : ${errText(err)}`);
            }
        }
        log(`profils ${i}/${PROFILS} faits`);
    }
    await browser.close();
    for (const s of sides) await s.proxy.close?.();

    // 3. Sorties brutes
    const W = (f, text) => fs.writeFileSync(path.join(PERF_DIR, f), text, 'utf8');
    W('ab-fiche.tsv', `${['tour', 'ordre', 'cote', 'indice_puissance', 'ralentissement_cpu', 'score', 'tbt_ms', 'lcp_ms', 'fcp_ms', 'si_ms', 'cls', 'octets', 'js_octets', 'scripts_executes', 'longues_taches', 'page_finale', 'erreur'].join('\t')}\n${passes.map((p) => [p.tour, p.ordre, p.cote, p.benchmarkIndex ?? '', p.cpu ?? '', p.score ?? '', r0(p.tbt), r0(p.lcp), r0(p.fcp), r0(p.si), p.cls ?? '', r0(p.octets), p.jsOctets ?? '', p.scripts.length, p.longues.length, cell(p.finalUrl), cell(p.error)].join('\t')).join('\n')}\n`);
    W('ab-scripts.tsv', `cote\ttour\tscript\ttotal_ms\tscripting_ms\tparse_ms\n${passes.flatMap((p) => p.scripts.map((x) => [p.cote, p.tour, cell(x.script), r1(x.total), r1(x.scripting), r1(x.parse)].join('\t'))).join('\n')}\n`);
    W('ab-travail.tsv', `cote\ttour\tgroupe\tduree_ms\n${passes.flatMap((p) => p.travail.map((x) => [p.cote, p.tour, cell(x.groupe), r1(x.duree)].join('\t'))).join('\n')}\n`);
    W('ab-longues-taches.tsv', `cote\ttour\tscript\tdebut_ms\tduree_ms\n${passes.flatMap((p) => p.longues.map((x) => [p.cote, p.tour, cell(x.script), r0(x.debut), r0(x.duree)].join('\t'))).join('\n')}\n`);
    W('ab-requetes-js.tsv', `cote\ttour\tscript\ttransfert_o\ttaille_o\n${passes.flatMap((p) => p.js.map((x) => [p.cote, p.tour, cell(x.script), x.transfert, x.taille].join('\t'))).join('\n')}\n`);
    for (const s of sides) {
        const ok = passes.filter((p) => p.cote === s.id && !p.error);
        const med = median(ok.map((p) => p.score));
        const idx = ok.findIndex((p) => p.score === Math.round(med ?? -1));
        const lhr = lhrs[s.id].filter(Boolean)[idx >= 0 ? idx : 0];
        if (lhr) fs.writeFileSync(path.join(PERF_DIR, `lighthouse-ab-${s.id}.json.gz`), compactLhr(lhr));
    }

    // 4. Profils : temps par fichier et plus grands temps propres, côte à côte (moyenne par passage)
    const profLines = [`Profils processeur de la fiche ${fichePath} (vue mobile, 4G simulée, processeur ×4, jusqu'à « load » + 4 s), en alternance main / branche ; moyenne par passage.`];
    for (const s of sides) profLines.push(`${s.id} : ${prof[s.id].ok} profil(s) valide(s) sur ${PROFILS}${prof[s.id].notes.length ? ` (${prof[s.id].notes.join(' ; ')})` : ''}`);
    const avg = (id, m, k) => (prof[id].ok ? (m.get(k) ?? 0) / prof[id].ok : 0);
    const cmp = (key, n) => {
        const keys = new Set([...prof.main[key].keys(), ...prof.branche[key].keys()]);
        return [...keys].map((k) => ({ k, a: avg('main', prof.main[key], k), b: avg('branche', prof.branche[key], k) }))
            .sort((x, y) => Math.max(y.a, y.b) - Math.max(x.a, x.b)).slice(0, n)
            .map((r) => `${r.a.toFixed(1).padStart(8)} ms  ${r.b.toFixed(1).padStart(8)} ms  ${(r.b - r.a >= 0 ? '+' : '') + (r.b - r.a).toFixed(1).padStart(7)} ms  ${r.k.replace('\t', '  ')}`);
    };
    profLines.push('', '== Temps par fichier : main, branche, écart ==', ...cmp('byFile', 45));
    profLines.push('', '== Plus grands temps propres (fonction, fichier) : main, branche, écart ==', ...cmp('self', 60));
    const scriptsSet = (id) => new Set(prof[id].scripts.keys());
    const onlyA = [...scriptsSet('main')].filter((x) => !scriptsSet('branche').has(x));
    const onlyB = [...scriptsSet('branche')].filter((x) => !scriptsSet('main').has(x));
    profLines.push('', `== Scripts chargés (Resource Timing) : ${scriptsSet('main').size} côté main, ${scriptsSet('branche').size} côté branche ==`,
        `seulement main : ${onlyA.join(', ') || 'aucun'}`, `seulement branche : ${onlyB.join(', ') || 'aucun'}`);
    W('ab-profil.txt', `${profLines.join('\n')}\n`);

    // 5. Résumé
    const lines = [
        `Mesure A/B de la fiche (lot 12b, décision du 27/11) — Lighthouse ${version}, préréglage mobile, relais HTTP/2, même machine, même base, même événement (${fichePath}).`,
        `Ordre : à chaque tour, calibration (accueil de la branche, ×4, non comptée), puis main, puis branche, au même ralentissement. ${TOURS} tours.`,
        `Calibration : ${calibrations.map((c) => `tour ${c.tour} indice ${c.indice ?? '?'} → ×${c.cpu}`).join(' ; ')}`,
        '',
    ];
    const med = {};
    for (const s of sides) {
        const ps = passes.filter((p) => p.cote === s.id);
        const val = (k) => ps.map((p) => (p.error ? null : p[k]));
        med[s.id] = { score: median(val('score')), tbt: median(val('tbt')), lcp: median(val('lcp')), js: median(val('jsOctets')) };
        lines.push(`${s.id.toUpperCase()} (${s.origin})`,
            `  ${statLine('score', val('score'))}`,
            `  ${statLine('TBT', val('tbt'), (v) => `${Math.round(v)} ms`)}`,
            `  ${statLine('LCP', val('lcp'), (v) => `${Math.round(v)} ms`)}`,
            `  ${statLine('FCP', val('fcp'), (v) => `${Math.round(v)} ms`)}`,
            `  ${statLine('Speed Index', val('si'), (v) => `${Math.round(v)} ms`)}`,
            `  ${statLine('CLS', val('cls'), (v) => v.toFixed(3))}`,
            `  ${statLine('JS transféré', val('jsOctets'), (v) => `${Math.round(v)} o`)}`,
            `  ${statLine('scripts exécutés (bootup-time)', ps.map((p) => (p.error ? null : p.scripts.length)))}`,
            `  ${statLine('longues tâches', ps.map((p) => (p.error ? null : p.longues.length)))}`,
            '');
    }
    lines.push(`Écart (branche − main) des médianes : score ${med.branche.score - med.main.score}, TBT ${Math.round(med.branche.tbt - med.main.tbt)} ms, LCP ${Math.round(med.branche.lcp - med.main.lcp)} ms, JS ${Math.round(med.branche.js - med.main.js)} o.`);
    // Scripts : médiane du temps d'exécution de chaque script de chaque côté
    const perScript = (id) => {
        const m = new Map();
        for (const p of passes.filter((x) => x.cote === id && !x.error)) for (const sc of p.scripts) { if (!m.has(sc.script)) m.set(sc.script, []); m.get(sc.script).push(sc.total); }
        return new Map([...m].map(([k, v]) => [k, median(v)]));
    };
    const sa = perScript('main');
    const sb = perScript('branche');
    const names = [...new Set([...sa.keys(), ...sb.keys()])].sort((x, y) => Math.max(sb.get(y) ?? 0, sa.get(y) ?? 0) - Math.max(sb.get(x) ?? 0, sa.get(x) ?? 0));
    lines.push('', '== Scripts exécutés (Lighthouse bootup-time, médiane du temps total) : main, branche, écart ==');
    for (const n of names) {
        const a = sa.get(n);
        const b = sb.get(n);
        lines.push(`${a === undefined ? '       —' : `${a.toFixed(0).padStart(5)} ms`}  ${b === undefined ? '       —' : `${b.toFixed(0).padStart(5)} ms`}  ${a !== undefined && b !== undefined ? `${(b - a >= 0 ? '+' : '') + (b - a).toFixed(0)} ms` : (a === undefined ? 'seulement branche' : 'seulement main')}  ${n}`);
    }
    lines.push('', `Profils, scripts chargés et temps propres : ab-profil.txt. Passages bruts : ab-fiche.tsv, ab-scripts.tsv, ab-travail.tsv, ab-longues-taches.tsv, ab-requetes-js.tsv.`);
    W('ab.txt', `${lines.join('\n')}\n`);
    console.log(lines.join('\n'));
}

main().then(() => process.exit(0), (err) => { console.error(`[${TAG}] ${errText(err)}`); process.exit(1); });

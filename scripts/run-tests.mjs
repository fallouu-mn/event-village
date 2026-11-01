#!/usr/bin/env node
/**
 * Lanceur de tests Event Village (lot 0).
 *
 * - Exécute chaque suite dans un processus Node isolé :
 *     node --import tsx --import ./tests/helpers/env.ts <suite>
 *   (le garde-fou anti-base réelle est donc chargé avant tout code de test).
 * - Continue après un échec, affiche un tableau récapitulatif et un total.
 * - Conserve la sortie brute de chaque suite dans .test-logs/<suite>.log.
 *
 * Choix du runner : node:test (déjà utilisé par les 31 suites existantes, natif,
 * zéro réécriture) exécuté via tsx. Vitest sera introduit pour les tests unitaires
 * purs (calculs financiers, machines à états) sans remettre en cause ce lanceur.
 *
 * Options :
 *   --dir <dossier>      dossier à parcourir récursivement (défaut : tests ; le sous-dossier legacy est ignoré)
 *   --filter <texte>     ne garde que les suites dont le chemin contient <texte>
 *   --timeout <ms>       délai maximal par suite (défaut : 600000 = 10 min)
 *   --list               affiche les suites sans les exécuter
 *   <fichiers...>        suites explicites (remplace --dir)
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = process.cwd();
const GUARD = path.resolve(ROOT, 'tests/helpers/env.ts');
const LOG_DIR = path.resolve(ROOT, '.test-logs');

function parseArgs(argv) {
    const opts = { dir: 'tests', filter: null, timeout: 600_000, list: false, files: [] };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        if (a === '--dir') opts.dir = argv[++i];
        else if (a === '--filter') opts.filter = argv[++i];
        else if (a === '--timeout') opts.timeout = Number(argv[++i]);
        else if (a === '--list') opts.list = true;
        else if (a.startsWith('--')) throw new Error(`Option inconnue : ${a}`);
        else opts.files.push(a);
    }
    if (!Number.isFinite(opts.timeout) || opts.timeout <= 0) throw new Error('--timeout doit être un nombre de millisecondes > 0');
    return opts;
}

function discover(dir) {
    const abs = path.resolve(ROOT, dir);
    const isLegacyRoot = path.basename(abs) === 'legacy';
    if (!fs.existsSync(abs)) return [];
    const out = [];
    const walk = (d) => {
        for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
            if (entry.name === 'node_modules') continue;
            // tests/legacy : suites héritées non portables (lot 0), exécutées uniquement via npm run test:legacy
            if (entry.isDirectory() && entry.name === 'legacy' && !isLegacyRoot) continue;
            const full = path.join(d, entry.name);
            if (entry.isDirectory()) walk(full);
            else if (entry.isFile() && entry.name.endsWith('.test.ts')) out.push(full);
        }
    };
    walk(abs);
    return out.sort((a, b) => a.localeCompare(b));
}

function formatMs(ms) {
    return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`;
}

function runSuite(file, timeoutMs) {
    return new Promise((resolve) => {
        const rel = path.relative(ROOT, file).replace(/\\/g, '/');
        const logPath = path.join(LOG_DIR, `${rel.replace(/[\\/]/g, '__')}.log`);
        const log = fs.createWriteStream(logPath);
        const started = Date.now();

        const child = spawn(
            process.execPath,
            ['--import', 'tsx', '--import', pathToFileURL(GUARD).href, file],
            { cwd: ROOT, env: process.env, stdio: ['ignore', 'pipe', 'pipe'] }
        );

        let timedOut = false;
        const timer = setTimeout(() => {
            timedOut = true;
            child.kill('SIGKILL');
        }, timeoutMs);

        // Sortie TAP gardée en mémoire : un hook after() en échec (ex. invariant violé) produit une ligne
        // « not ok N - <fichier> » de premier niveau alors que node:test peut sortir en code 0 (lot 5).
        let tap = '';
        const forward = (stream, target) => {
            stream.on('data', (chunk) => {
                target.write(chunk);
                log.write(chunk);
                if (stream === child.stdout) tap += chunk.toString();
            });
        };
        forward(child.stdout, process.stdout);
        forward(child.stderr, process.stderr);

        child.on('close', (code, signal) => {
            clearTimeout(timer);
            log.end();
            resolve({
                rel,
                status: timedOut ? 'TIMEOUT' : code === 0 && !/^not ok \d+ /m.test(tap) ? 'PASS' : 'FAIL',
                code,
                signal,
                ms: Date.now() - started,
                logPath: path.relative(ROOT, logPath).replace(/\\/g, '/'),
            });
        });
    });
}

async function main() {
    const opts = parseArgs(process.argv.slice(2));

    if (!process.env.EV_ENV_FILE && !fs.existsSync(path.resolve(ROOT, '.env.test'))) {
        console.error('[run-tests] .env.test introuvable : copiez .env.test.example vers .env.test (instance Supabase locale).');
        process.exit(2);
    }
    if (!fs.existsSync(path.resolve(ROOT, 'node_modules/tsx'))) {
        console.error('[run-tests] dépendance tsx absente : exécutez npm ci.');
        process.exit(2);
    }

    let files = opts.files.length > 0 ? opts.files.map((f) => path.resolve(ROOT, f)) : discover(opts.dir);
    if (opts.filter) files = files.filter((f) => f.includes(opts.filter));

    if (files.length === 0) {
        console.log(`[run-tests] Aucune suite trouvée (${opts.files.length ? 'fichiers explicites' : `dossier ${opts.dir}`}) — 0 suite exécutée.`);
        process.exit(0);
    }

    if (opts.list) {
        for (const f of files) console.log(path.relative(ROOT, f).replace(/\\/g, '/'));
        console.log(`\n${files.length} suite(s).`);
        process.exit(0);
    }

    fs.mkdirSync(LOG_DIR, { recursive: true });
    console.log(`[run-tests] ${files.length} suite(s) — garde-fou : ${path.relative(ROOT, GUARD).replace(/\\/g, '/')} — délai/suite : ${formatMs(opts.timeout)}\n`);

    const results = [];
    for (const file of files) {
        console.log(`\n━━━ ${path.relative(ROOT, file).replace(/\\/g, '/')} ━━━`);
        results.push(await runSuite(file, opts.timeout));
    }

    const counts = { PASS: 0, FAIL: 0, TIMEOUT: 0 };
    for (const r of results) counts[r.status]++;

    const width = Math.max(...results.map((r) => r.rel.length), 10);
    console.log('\n\n═══════════════════ RÉCAPITULATIF ═══════════════════');
    console.log(`${'Suite'.padEnd(width)}  Statut   Durée     Code  Journal`);
    for (const r of results) {
        const codeStr = r.code === null ? `sig:${r.signal}` : String(r.code);
        console.log(`${r.rel.padEnd(width)}  ${r.status.padEnd(8)} ${formatMs(r.ms).padEnd(9)} ${codeStr.padEnd(5)} ${r.logPath}`);
    }
    console.log('──────────────────────────────────────────────────────');
    console.log(`TOTAL : ${results.length} suite(s) — ${counts.PASS} réussie(s), ${counts.FAIL} en échec, ${counts.TIMEOUT} expirée(s)`);

    process.exit(counts.FAIL + counts.TIMEOUT > 0 ? 1 : 0);
}

main().catch((err) => {
    console.error('[run-tests] Erreur fatale :', err instanceof Error ? err.message : err);
    process.exit(2);
});

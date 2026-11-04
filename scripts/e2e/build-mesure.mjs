#!/usr/bin/env node
/**
 * Lot 7 (contrat, sections 9, 11.7 et 14.1) — build « de mesure » quand `npm run verify` a échoué.
 *
 * Pourquoi : `scripts/verify.mjs` s'arrête à la première étape en échec. Au run « avant » du lot 7, les tests
 * rouges sont attendus (étape test) : sans ce script, il n'y aurait ni `next build`, ni mesure du poids
 * JavaScript (scripts/js-budget.mjs, .verify/js-budget.tsv), ni phases e2e (terrain, pwa, perf : temps de scan
 * en 3G, premier affichage utile, durée du job). Ce script refait SEULEMENT les deux dernières étapes de
 * verify, dans le même environnement que verify (copie de ses règles) :
 *  - `.env.test` (EV_ENV_FILE) chargé sans écraser le shell, URL Supabase locale exigée ;
 *  - build sans EV_INTEGRATIONS, clés de `.env.local` neutralisées (aucune valeur du projet distant) ;
 *  - NEXT_TELEMETRY_DISABLED=1.
 * Il ne remplace jamais verify : le job reste en échec (étape verify), seules les mesures sont produites.
 *
 * Code de sortie : celui de `next build` (le e2e n'a de sens qu'avec un build) ; un échec de js-budget est
 * imprimé en erreur (avec son code) et n'empêche pas le e2e, puisque le job est déjà en échec.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { LOCAL_HOSTNAMES, parseEnvFile, ROOT } from './env.mjs';

const TAG = 'build-mesure';
const ENV_FILE = process.env.EV_ENV_FILE || '.env.test';
const envPath = path.resolve(ROOT, ENV_FILE);

function fail(message, code = 2) {
    process.stderr.write(`\n[${TAG}] REFUS — ${message}\n\n`);
    process.exit(code);
}

if (!fs.existsSync(envPath)) fail(`${ENV_FILE} introuvable : le build de mesure utilise l'environnement de verify.`);
for (const [key, value] of Object.entries(parseEnvFile(envPath))) {
    if (process.env[key] === undefined) process.env[key] = value;
}
let host = '';
try {
    host = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL || '').hostname;
} catch (err) {
    fail(`NEXT_PUBLIC_SUPABASE_URL illisible (${err instanceof Error ? err.message : String(err)}).`);
}
if (!LOCAL_HOSTNAMES.has(host)) fail(`NEXT_PUBLIC_SUPABASE_URL n'est pas locale (hôte : ${host || '<absent>'}).`);
process.env.NEXT_TELEMETRY_DISABLED = '1';

function buildEnv() {
    const env = { ...process.env };
    delete env.EV_INTEGRATIONS;
    const localPath = path.resolve(ROOT, '.env.local');
    const neutralized = [];
    if (fs.existsSync(localPath)) {
        for (const key of Object.keys(parseEnvFile(localPath))) {
            if (env[key] === undefined) {
                env[key] = '';
                neutralized.push(key);
            }
        }
    }
    if (neutralized.length > 0) console.log(`[${TAG}] build : ${neutralized.length} clé(s) de .env.local neutralisée(s) : ${neutralized.join(', ')}`);
    return env;
}

function run(name, command, env) {
    console.log(`\n═══════════════ ${TAG} › ${name} : ${command} ═══════════════`);
    const started = Date.now();
    const r = spawnSync(command, { cwd: ROOT, env, stdio: 'inherit', shell: true });
    const code = r.status ?? 1;
    console.log(`[${TAG}] ${name} : ${code === 0 ? 'OK' : `ÉCHEC (code ${r.status ?? r.signal})`} en ${((Date.now() - started) / 1000).toFixed(0)}s`);
    return code;
}

console.log(`[${TAG}] verify a échoué : build et mesure du poids JavaScript refaits pour les phases e2e du run (le job reste en échec).`);
const build = run('build', 'npm run build', buildEnv());
if (build !== 0) process.exit(build);
const budget = run('js-budget', 'node scripts/js-budget.mjs', process.env);
if (budget !== 0) console.error(`[${TAG}] ERREUR : js-budget en échec (code ${budget}) ; voir les lignes [JS-BUDGET] ci-dessus. Le e2e continue sur ce build.`);
process.exit(0);

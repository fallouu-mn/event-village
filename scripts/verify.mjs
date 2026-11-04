#!/usr/bin/env node
/**
 * `npm run verify` — typecheck → lint → test → build → js-budget, dans cet ordre, arrêt à la première erreur.
 *
 * Lot 7 (7.5) : `js-budget` (scripts/js-budget.mjs) mesure, juste après `next build`, le poids gzip du
 * JavaScript du premier chargement, layout racine compris, pour l'accueil, la page événement, Mes billets,
 * le scanner et le billet hors ligne ; il écrit .verify/js-budget.tsv et échoue au-dessus des budgets de
 * scripts/js-budget.json (mesure seule tant que ce fichier est absent ou vide).
 *
 * L'environnement de `.env.test` est chargé AVANT chaque étape (sans écraser les
 * variables déjà présentes dans le shell). Comme Next.js ne remplace jamais une
 * variable déjà définie dans process.env, `next build` voit ainsi l'instance locale
 * même si un `.env.local` pointant sur le projet distant existe sur la machine.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const ENV_FILE = process.env.EV_ENV_FILE || '.env.test';
const envPath = path.resolve(ROOT, ENV_FILE);

if (!fs.existsSync(envPath)) {
    console.error(`[verify] ${ENV_FILE} introuvable : copiez .env.test.example vers .env.test (instance Supabase locale).`);
    process.exit(2);
}

for (const rawLine of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
let host = '';
try { host = new URL(url).hostname; } catch { host = ''; }
if (!['localhost', '127.0.0.1', '::1', '[::1]'].includes(host)) {
    console.error(`[verify] Refus : NEXT_PUBLIC_SUPABASE_URL n'est pas locale (hôte : ${host || '<absent>'}).`);
    process.exit(2);
}

process.env.NEXT_TELEMETRY_DISABLED = '1';

/**
 * Environnement de l'étape build :
 *  - sans EV_INTEGRATIONS : les faux adaptateurs ne concernent que les tests ; un build
 *    de production avec EV_INTEGRATIONS=fake est refusé par lib/env.ts ;
 *  - clés de .env.local neutralisées : `next build` charge .env.local s'il existe, mais ne
 *    remplace jamais une variable déjà définie. Chaque clé absente de .env.test reçoit donc
 *    une valeur vide (traitée comme absente par lib/env.ts) pour qu'aucune valeur du
 *    projet distant n'entre dans le build de vérification.
 */
function buildEnv() {
    const env = { ...process.env };
    delete env.EV_INTEGRATIONS;
    const neutralized = [];
    const localPath = path.resolve(ROOT, '.env.local');
    if (fs.existsSync(localPath)) {
        for (const rawLine of fs.readFileSync(localPath, 'utf8').split(/\r?\n/)) {
            const line = rawLine.trim();
            if (!line || line.startsWith('#') || !line.includes('=')) continue;
            const key = line.slice(0, line.indexOf('=')).trim();
            if (env[key] === undefined) {
                env[key] = '';
                neutralized.push(key);
            }
        }
    }
    if (neutralized.length > 0) {
        console.log(`[verify] build : ${neutralized.length} clé(s) de .env.local neutralisée(s) : ${neutralized.join(', ')}`);
    }
    return env;
}

const steps = [
    ['typecheck', 'npm run typecheck'],
    ['lint', 'npm run lint'],
    ['test', 'npm run test'],
    ['build', 'npm run build'],
    ['js-budget', 'node scripts/js-budget.mjs'],
];

const started = Date.now();
for (const [name, command] of steps) {
    console.log(`\n═══════════════ verify › ${name} : ${command} ═══════════════`);
    const env = name === 'build' ? buildEnv() : process.env;
    const result = spawnSync(command, { cwd: ROOT, env, stdio: 'inherit', shell: true });
    if (result.status !== 0) {
        console.error(`\n[verify] ÉCHEC à l'étape "${name}" (code ${result.status ?? result.signal}).`);
        process.exit(result.status ?? 1);
    }
}
console.log(`\n[verify] OK — ${steps.length} étapes réussies en ${((Date.now() - started) / 1000).toFixed(0)}s.`);

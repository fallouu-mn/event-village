#!/usr/bin/env node
/**
 * Lot 5.1 — démarre l'application pour les tests de bout en bout : `next start` sur le build produit
 * par verify (.next), à l'écoute sur 127.0.0.1, servi sous http://localhost:<port> (NEXT_PUBLIC_APP_URL),
 * avec l'environnement de `.env.e2e`. Hôte « localhost » : le middleware de Next réécrit tout hôte 127.x
 * en « localhost » dans req.url (NextURL) ; ses redirections visent donc localhost, et le navigateur
 * doit naviguer sur ce même hôte pour garder ses cookies de session.
 *
 * Garde-fous :
 *  - URL de la base, de l'application, de SamirPay et de MTarget locales ; aucune clé Resend
 *    (canal email désactivé proprement, lib/notifications/channels.ts) ; EV_INTEGRATIONS absent ;
 *  - clés des fichiers .env* que Next charge en production (.env.production.local, .env.local,
 *    .env.production, .env) neutralisées si .env.e2e ne les définit pas (même règle que
 *    scripts/verify.mjs) : aucune valeur du projet distant n'entre dans le serveur ;
 *  - build présent, et sans URL Supabase hébergée figée dans les bundles du navigateur
 *    (un build fait avec .env.local viserait le projet distant) ;
 *  - lot 7 (tâche 7.5, contrat 11.1) : sharp chargeable avant le démarrage (optimisation des images en
 *    production), puis échec immédiat si la sortie de `next start` (journal next-start.log) contient
 *    « sharp-missing-in-production » : le serveur est arrêté et le script sort en code 1.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { assertLocalServices, fail, loadE2eEnv, parseEnvFile, requirePort, ROOT } from './env.mjs';

const TAG = 'e2e-app';
loadE2eEnv(TAG);
const { app } = assertLocalServices(TAG);
const port = requirePort(TAG, 'E2E_APP_PORT');
if (app.hostname !== 'localhost' || Number(app.port) !== port) {
    fail(TAG, `NEXT_PUBLIC_APP_URL (${app.origin}) doit être http://localhost:${port} : le middleware redirige vers localhost (NextURL), cookies de session et callBackUrl SamirPay en dépendent.`);
}

const buildId = path.join(ROOT, '.next', 'BUILD_ID');
if (!fs.existsSync(buildId)) fail(TAG, 'build absent (.next/BUILD_ID) : lancez « npm run verify » (ou « npm run build » avec .env.test) avant les tests de bout en bout.');

function* jsFiles(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) yield* jsFiles(full);
        else if (entry.isFile() && entry.name.endsWith('.js')) yield full;
    }
}
// Exemples de documentation des bibliothèques Supabase (commentaires, messages) : pas un projet réel
const PLACEHOLDER_PROJECTS = new Set(['xyzcompany', 'project-id', 'project-ref', 'your-project', 'example']);
const staticDir = path.join(ROOT, '.next', 'static');
const localSupabase = String(process.env.NEXT_PUBLIC_SUPABASE_URL).replace(/\/+$/, '');
let localSeen = false;
if (!fs.existsSync(staticDir)) fail(TAG, 'build incomplet : .next/static absent.');
for (const file of jsFiles(staticDir)) {
    const text = fs.readFileSync(file, 'utf8');
    if (text.includes(localSupabase)) localSeen = true;
    for (const m of text.matchAll(/https:\/\/([a-z0-9-]+)\.supabase\.(co|in)\b/g)) {
        if (!PLACEHOLDER_PROJECTS.has(m[1])) {
            fail(TAG, `le build contient une URL Supabase hébergée (${m[0]}, ${path.relative(ROOT, file)}) : refaites le build avec l'instance locale (.env.test).`);
        }
    }
}
if (!localSeen) fail(TAG, `le build ne contient pas l'URL Supabase locale ${localSupabase} : il n'a pas été fait avec l'environnement de test.`);

// Lot 7 (7.5) : sharp installé et chargeable (binaire de la plateforme), sinon Next optimise sans lui et avertit
const SHARP_MISSING = 'sharp-missing-in-production';
try {
    const sharp = (await import('sharp')).default;
    console.log(`[${TAG}] sharp ${sharp.versions?.sharp ?? '?'} chargé (libvips ${sharp.versions?.vips ?? '?'})`);
} catch (err) {
    fail(TAG, `sharp introuvable ou non chargeable (${err instanceof Error ? err.message.split('\n')[0] : String(err)}) : Next signalerait ${SHARP_MISSING} ; npm ci doit installer sharp et son binaire (package.json, fix(7.5)).`);
}

const env = { ...process.env, NEXT_TELEMETRY_DISABLED: '1', HOSTNAME: '127.0.0.1', PORT: String(port) };
delete env.EV_INTEGRATIONS;
delete env.NODE_ENV;
const neutralized = [];
for (const name of ['.env.production.local', '.env.local', '.env.production', '.env']) {
    const file = path.join(ROOT, name);
    if (!fs.existsSync(file)) continue;
    for (const key of Object.keys(parseEnvFile(file))) {
        if (env[key] === undefined) {
            env[key] = '';
            neutralized.push(`${name}:${key}`);
        }
    }
}
if (neutralized.length > 0) console.log(`[${TAG}] ${neutralized.length} clé(s) neutralisée(s) : ${neutralized.join(', ')}`);

const require = createRequire(import.meta.url);
const nextBin = require.resolve('next/dist/bin/next');
console.log(`[${TAG}] next start -H 127.0.0.1 -p ${port} (build ${fs.readFileSync(buildId, 'utf8').trim()})`);
const child = spawn(process.execPath, [nextBin, 'start', '-H', '127.0.0.1', '-p', String(port)], { cwd: ROOT, env, stdio: ['inherit', 'pipe', 'pipe'] });
let sharpMissing = false;
/** Sortie de next start recopiée telle quelle (next-start.log) ; « sharp-missing-in-production » arrête le serveur. */
function watch(stream, out) {
    let pending = '';
    stream.on('data', (chunk) => {
        out.write(chunk);
        pending += chunk.toString('utf8');
        const lines = pending.split(/\r?\n/);
        pending = lines.pop() ?? '';
        if (!sharpMissing && lines.some((l) => l.includes(SHARP_MISSING))) {
            sharpMissing = true;
            console.error(`[${TAG}] ÉCHEC : la sortie de next start contient « ${SHARP_MISSING} » (sharp absent en production, tâche 7.5) : arrêt du serveur.`);
            child.kill('SIGTERM');
        }
    });
}
watch(child.stdout, process.stdout);
watch(child.stderr, process.stderr);
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('exit', (code, signal) => {
    console.log(`[${TAG}] next start terminé (${signal ?? `code ${code}`})`);
    process.exit(sharpMissing ? 1 : (code ?? 1));
});

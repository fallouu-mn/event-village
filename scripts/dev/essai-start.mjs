#!/usr/bin/env node
/**
 * Lot 8 (8.1, L16, contrat 5.1, 5.2) — mode B, aperçu de production : npm run essai:build puis npm run essai:start.
 *
 * Le service worker et le billet hors ligne ne fonctionnent qu'avec `next start`, où EV_INTEGRATIONS=fake est
 * interdit : l'application garde donc ses vrais adaptateurs, pointés sur le faux service local. Ce script ne
 * touche aucun fichier : tout passe par l'environnement du processus fils, que Next ne remplace jamais.
 * EV_ESSAI_SIMULATION=1 fait marquer les opérations en base (lib/integrations/simulation.ts). Aucune vraie clé
 * ne part vers le faux service (L19).
 *
 *   node scripts/dev/essai-start.mjs           lance `next start`, si le build existe et si le faux service répond
 *   node scripts/dev/essai-start.mjs --build   lance `next build` dans le même environnement : EV_INTEGRATIONS=fake
 *                                              de .env.local, interdit hors développement, n'y arrive jamais
 *
 * Lancé sans liaison d'hôte : avec 127.0.0.1, les redirections partiraient sur localhost derrière le tunnel.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { loadLocalEnv, portOf } from './env-local.mjs';
import { ESSAI_SERVER_KEY } from './essai-keys.mjs';

const TAG = 'essai-start';
const HEALTH_TIMEOUT_MS = 3_000;

function childEnv(fakeOrigin) {
    return {
        ...process.env,
        NODE_ENV: 'production',
        EV_INTEGRATIONS: '',
        RESEND_API_KEY: '',
        EV_ESSAI_SIMULATION: '1',
        SAMIRPAY_API_URL: `${fakeOrigin}/samirpay`,
        SAMIRPAY_API_KEY: ESSAI_SERVER_KEY,
        SAMIRPAY_SECRET_KEY: ESSAI_SERVER_KEY,
        MTARGET_API_URL: `${fakeOrigin}/mtarget/messages`,
        MTARGET_USERNAME: ESSAI_SERVER_KEY,
        MTARGET_PASSWORD: ESSAI_SERVER_KEY,
    };
}

async function assertFakeServiceUp(fakeOrigin) {
    const refused = `faux service injoignable sur ${fakeOrigin} : lancez d'abord npm run fake:samirpay dans un autre terminal.`;
    let res;
    try {
        res = await fetch(`${fakeOrigin}/__test/health`, { signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS) });
    } catch (err) {
        throw new Error(`${refused} (${err instanceof Error ? err.name : String(err)})`);
    }
    if (!res.ok) throw new Error(`${refused} (HTTP ${res.status})`);
}

function runNext(args, env) {
    const nextBin = createRequire(import.meta.url).resolve('next/dist/bin/next');
    const child = spawn(process.execPath, [nextBin, ...args], { cwd: process.cwd(), env, stdio: 'inherit' });
    return new Promise((resolve, reject) => {
        child.on('error', reject);
        child.on('exit', (code, signal) => {
            resolve(code ?? (signal ? 1 : 0));
        });
    });
}

async function main() {
    const argv = process.argv.slice(2);
    if (argv.length > 1 || (argv.length === 1 && argv[0] !== '--build')) throw new Error('Seule option admise : --build.');
    const cwd = process.cwd();
    loadLocalEnv({ cwd });
    const fakeOrigin = `http://127.0.0.1:${portOf(process.env, 'EV_DEV_FAKE_PORT', 4010)}`;
    const env = childEnv(fakeOrigin);
    if (argv[0] === '--build') return runNext(['build'], env);

    await assertFakeServiceUp(fakeOrigin);
    if (!fs.existsSync(path.join(cwd, '.next', 'BUILD_ID'))) {
        throw new Error('build absent : lancez npm run essai:build (npm run dev remplace le dossier .next).');
    }
    console.log(`[${TAG}] aperçu de production vers le faux service ${fakeOrigin} : aucun SMS ni paiement réel.`);
    return runNext(['start', '-p', String(portOf(process.env, 'EV_DEV_APP_PORT', 3000))], env);
}

main().then(
    (code) => { process.exitCode = code; },
    (err) => {
        console.error(`[${TAG}] refus : ${err instanceof Error ? err.message : String(err)}`);
        process.exitCode = 1;
    },
);

#!/usr/bin/env node
/**
 * Lot 5.1 — `npm run e2e` : lance Playwright en trois phases, dans cet ordre, chacune exécutée même
 * si la précédente a échoué (une connexion de démonstration manquante ne doit pas masquer la fumée) :
 *   1. connexion (projet setup)          → .auth/<rôle>.json
 *   2. captures  (projets mobile, desktop) → .e2e-captures/captures/*.png + index.txt
 *   3. fumée     (projet fumee)
 * Prérequis vérifiés avant tout : .env.e2e local, application et faux services joignables.
 * Code de sortie : 0 si les trois phases réussissent, 1 sinon (résumé imprimé à la fin).
 * Arguments supplémentaires (`npm run e2e -- <args>`) : une seule exécution de Playwright avec ces
 * arguments, sans phases (usage local).
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { assertLocalServices, fail, loadE2eEnv, requireLocalUrl, ROOT } from './env.mjs';

const TAG = 'e2e';
loadE2eEnv(TAG);
const { app } = assertLocalServices(TAG);
const fake = requireLocalUrl(TAG, 'E2E_FAKE_SERVICES_URL');

async function reachable(url, label) {
    try {
        const res = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(10_000) });
        if (res.status >= 500) fail(TAG, `${label} répond ${res.status} (${url}).`);
        return res.status;
    } catch (err) {
        fail(TAG, `${label} injoignable (${url}) : ${err instanceof Error ? err.message : String(err)}. Démarrez « node scripts/e2e/fake-services.mjs » et « node scripts/e2e/start-app.mjs ».`);
    }
    return 0;
}

console.log(`[${TAG}] faux services : HTTP ${await reachable(`${fake.origin}/__test/health`, 'faux services')}`);
console.log(`[${TAG}] application   : HTTP ${await reachable(`${app.origin}/login`, 'application')}`);

const require = createRequire(import.meta.url);
const cli = require.resolve('@playwright/test/cli');

function playwright(phase, args) {
    console.log(`\n═══════════════ e2e › ${phase} : playwright test ${args.join(' ')} ═══════════════`);
    const started = Date.now();
    const r = spawnSync(process.execPath, [cli, 'test', ...args], { cwd: ROOT, stdio: 'inherit', env: { ...process.env, E2E_PHASE: phase } });
    const code = r.status ?? 1;
    const seconds = ((Date.now() - started) / 1000).toFixed(0);
    console.log(`[${TAG}] phase ${phase} : ${code === 0 ? 'OK' : `ÉCHEC (code ${r.status ?? r.signal})`} en ${seconds}s`);
    return code;
}

const extra = process.argv.slice(2);
if (extra.length > 0) process.exit(playwright('manuel', extra));

// Captures d'une exécution précédente : retirées pour que l'index ne mélange pas deux runs
for (const dir of ['captures', 'results']) {
    fs.rmSync(path.join(ROOT, '.e2e-captures', dir), { recursive: true, force: true });
}

const phases = [
    ['connexion', ['--project=setup']],
    ['captures', ['--project=mobile', '--project=desktop']],
    ['fumee', ['--project=fumee']],
];
const results = phases.map(([phase, args]) => [phase, playwright(phase, args)]);
console.log(`\n[${TAG}] résumé : ${results.map(([p, c]) => `${p} ${c === 0 ? 'OK' : 'ÉCHEC'}`).join(' · ')}`);
process.exit(results.every(([, c]) => c === 0) ? 0 : 1);

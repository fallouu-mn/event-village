#!/usr/bin/env node
/**
 * Lot 5.1 — `npm run e2e` : lance Playwright par phases, dans cet ordre, chacune exécutée même
 * si la précédente a échoué (une connexion de démonstration manquante ne doit pas masquer la fumée) :
 *   1. connexion (projet setup)          → .auth/<rôle>.json
 *   2. captures  (projets mobile, desktop) → .e2e-captures/captures/*.png + index.txt
 *   3. fumée     (projet fumee)
 * Lot 7 (contrat 11.1, D82) : trois phases de plus, séparées des captures, un seul worker chacune :
 *   4. terrain   (projet terrain)  → billet hors ligne, scanner ; .e2e-captures/perf/scan.tsv
 *   5. pwa       (projet pwa)      → application installable (Chromium complet, contexte persistant)
 *   6. perf      (projet perf)     → .e2e-captures/perf/perf.tsv et perf.txt
 * Lot 7 (tâche 7.9, contrat 19.9) : phase « emails » (projet emails, un worker) juste après les captures :
 *   emails rendus par scripts/e2e/render-emails.ts → .e2e-captures/emails/*.html|txt,
 *   captures email-<id>__<largeur>__<thème>.png et emails.txt dans .e2e-captures/captures/.
 * La durée de chaque phase est imprimée et écrite dans .e2e-captures/perf/phases.tsv (budget du job, 11.7).
 * Prérequis vérifiés avant tout : .env.e2e local, application et faux services joignables.
 * Code de sortie : 0 si toutes les phases réussissent, 1 sinon (résumé imprimé à la fin).
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
// Servie sous localhost (cookies, redirections du middleware), à l'écoute sur 127.0.0.1
console.log(`[${TAG}] application   : HTTP ${await reachable(`${app.protocol}//127.0.0.1:${app.port}/login`, 'application')}`);

const require = createRequire(import.meta.url);
const cli = require.resolve('@playwright/test/cli');

/** Durée de chaque phase : [phase, code, secondes] (lot 7, budget du job, contrat 11.7). */
const durations = [];

function playwright(phase, args) {
    console.log(`\n═══════════════ e2e › ${phase} : playwright test ${args.join(' ')} ═══════════════`);
    const started = Date.now();
    const r = spawnSync(process.execPath, [cli, 'test', ...args], { cwd: ROOT, stdio: 'inherit', env: { ...process.env, E2E_PHASE: phase } });
    const code = r.status ?? 1;
    const seconds = ((Date.now() - started) / 1000).toFixed(0);
    durations.push([phase, code, seconds]);
    console.log(`[${TAG}] phase ${phase} : ${code === 0 ? 'OK' : `ÉCHEC (code ${r.status ?? r.signal})`} en ${seconds}s`);
    return code;
}

const extra = process.argv.slice(2);
if (extra.length > 0) process.exit(playwright('manuel', extra));

// Captures et mesures d'une exécution précédente : retirées pour que l'index et les tableaux de mesure
// (lot 7 : perf.tsv et perf.txt reçoivent des lignes ajoutées) ne mélangent pas deux runs
for (const dir of ['captures', 'results', 'perf', 'emails']) {
    fs.rmSync(path.join(ROOT, '.e2e-captures', dir), { recursive: true, force: true });
}

const phases = [
    ['connexion', ['--project=setup']],
    ['captures', ['--project=mobile', '--project=desktop']],
    ['emails', ['--project=emails', '--workers=1']],
    ['fumee', ['--project=fumee']],
    ['terrain', ['--project=terrain', '--workers=1']],
    ['pwa', ['--project=pwa', '--workers=1']],
    ['perf', ['--project=perf', '--workers=1']],
];
const results = phases.map(([phase, args]) => [phase, playwright(phase, args)]);
const perfDir = path.join(ROOT, '.e2e-captures', 'perf');
fs.mkdirSync(perfDir, { recursive: true });
fs.writeFileSync(path.join(perfDir, 'phases.tsv'), `${['phase\tcode\tsecondes', ...durations.map((d) => d.join('\t'))].join('\n')}\n`, 'utf8');
const totalSeconds = durations.reduce((sum, [, , s]) => sum + Number(s), 0);
console.log(`\n[${TAG}] durées : ${durations.map(([p, , s]) => `${p} ${s}s`).join(' · ')} — total ${totalSeconds}s (${(totalSeconds / 60).toFixed(1)} min)`);
console.log(`[${TAG}] résumé :${results.map(([p, c]) => `${p} ${c === 0 ? 'OK' : 'ÉCHEC'}`).join(' · ')}`);
process.exit(results.every(([, c]) => c === 0) ? 0 : 1);

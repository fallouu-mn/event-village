#!/usr/bin/env node
/**
 * Finition 3a — mode rapide de la CI, pendant le travail d'un lot (.github/workflows/verify.yml, étape « Vérification
 * rapide ») : typecheck, lint, puis les seules suites passées en arguments (celles de la ligne « ci-rapide: <suites> »
 * du message du commit ; chemins de suites ou options de scripts/run-tests.mjs, par exemple --filter).
 *
 * Les trois étapes tournent toujours, dans cet ordre : un typecheck rouge sur un commit « tests seuls » (module encore
 * absent) n'empêche pas de lire la sortie brute des tests rouges. Code de sortie 1 si l'une échoue, 2 sans suite.
 * Ni build, ni e2e, ni mesure du poids JavaScript : la CI complète (commit sans la ligne) reste la preuve finale.
 */
import { spawnSync } from 'node:child_process';

const suites = process.argv.slice(2).filter((a) => a.trim() !== '');
if (suites.length === 0) {
    console.error('[ci-rapide] aucune suite citée : rien à vérifier.');
    process.exit(2);
}

const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const steps = [
    ['typecheck', npm, ['run', 'typecheck']],
    ['lint', npm, ['run', 'lint']],
    ['tests', process.execPath, ['scripts/run-tests.mjs', ...suites]],
];

const results = [];
for (const [name, cmd, args] of steps) {
    console.log(`\n═══════════════ ci-rapide › ${name} : ${[cmd, ...args].join(' ')} ═══════════════`);
    const started = Date.now();
    const run = spawnSync(cmd, args, { stdio: 'inherit', env: process.env });
    const code = run.error ? 1 : run.status ?? 1;
    if (run.error) console.error(`[ci-rapide] ${name} n'a pas pu démarrer : ${run.error.message}`);
    results.push({ name, code, seconds: Math.round((Date.now() - started) / 1000) });
}

console.log('\n═══════════════ ci-rapide › résumé ═══════════════');
console.log(`suites citées : ${suites.join(' ')}`);
for (const r of results) console.log(`${r.name.padEnd(10)} ${r.code === 0 ? 'OK    ' : 'ÉCHEC '} code ${String(r.code).padEnd(3)} ${r.seconds} s`);
process.exit(results.every((r) => r.code === 0) ? 0 : 1);

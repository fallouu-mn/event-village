#!/usr/bin/env node
/**
 * Lot CI rapide — job « verdict » de .github/workflows/verify.yml : assemble le dossier du run publié sur la branche
 * ci-results (un seul dossier par run, même arborescence que le run série) à partir des artefacts des jobs parallèles,
 * contrôle que les lots de tests couvrent exactement la liste des suites, et décide du verdict.
 *
 * Usage : node scripts/ci-verdict.mjs <dossier des artefacts> <dossier du run>
 * Environnement : EV_NEEDS (toJSON(needs) du job), EV_T0 (début du run, secondes), variables GITHUB_* du runner.
 * Écrit « verdict=success|failure|cancelled » dans $GITHUB_OUTPUT (et l'imprime). Code de sortie 0 : la décision
 * est appliquée par la dernière étape du job, après la publication des journaux.
 *
 * Arborescence produite (runs/<n>-<id>/) :
 *   verify.log         typecheck et lint (job qualite), récapitulatif FUSIONNÉ des lots et TOTAL (un seul, comme le
 *                      run série), contrôle de couverture, build et poids JavaScript (job e2e) ; en mode rapide : la
 *                      sortie de scripts/ci-rapide.mjs
 *   test-logs/         journal brut de chaque suite (tous lots réunis, mêmes noms qu'en série)
 *   captures/, emails/, perf/, playwright/, js-budget.tsv, e2e*.log, fake-services.log, next-start.log : job e2e
 *   responsive.log, responsive.tsv|txt, captures-responsive/, playwright-responsive/ : job responsive (design 1c)
 *   perf/, perf-mobile.log, build.log, js-budget.tsv, e2e.log : job perf (design 1e, mode rapide avec « ci-perf: oui »)
 *                      (design 1b, lot PERF : perf/lighthouse.tsv|txt, toucher.tsv, lighthouse-resume.json,
 *                      lighthouse-<page>.json.gz et perf-mobile.log, étape bloquante « performance mobile mesurée »)
 *   supabase-start.log, db-reset.log, seed.log, containers.log : ceux de chaque job, l'un après l'autre (en-tête)
 *   jobs/<job>/        journaux bruts de chaque job (dont verify.log de chaque lot), job.txt, etapes.txt
 *   run.txt            métadonnées du run, résultat et durée de chaque job, étapes de chaque job
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const [artefacts, runDir] = process.argv.slice(2);
if (!artefacts || !runDir) {
    console.error('usage : node scripts/ci-verdict.mjs <artefacts> <dossier du run>');
    process.exit(2);
}
const needs = JSON.parse(process.env.EV_NEEDS || '{}');
const t0 = Number(process.env.EV_T0) || null;
const maintenant = Math.floor(Date.now() / 1000);
fs.mkdirSync(runDir, { recursive: true });

const lire = (f) => (fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : null);
const copier = (src, dst) => {
    if (!fs.existsSync(src)) return false;
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.cpSync(src, dst, { recursive: true });
    return true;
};
const kv = (texte) => Object.fromEntries((texte || '').split(/\r?\n/).filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)]));

// Artefacts « journaux-<job> » : qualite, tests-1 … tests-n, e2e, rapide
const jobs = fs.existsSync(artefacts)
    ? fs.readdirSync(artefacts, { withFileTypes: true }).filter((d) => d.isDirectory() && d.name.startsWith('journaux-')).map((d) => ({ nom: d.name.slice('journaux-'.length), dir: path.join(artefacts, d.name) }))
    : [];
const rangJob = (n) => (n === 'qualite' ? 0 : n.startsWith('tests-') ? 1 + Number(n.slice(6)) / 100 : n === 'e2e' ? 2 : n === 'responsive' ? 2.5 : n === 'perf' ? 2.7 : 3);
jobs.sort((a, b) => rangJob(a.nom) - rangJob(b.nom) || a.nom.localeCompare(b.nom));
const job = (nom) => jobs.find((j) => j.nom === nom);
const lots = jobs.filter((j) => j.nom.startsWith('tests-'));

const rapide = needs.mode?.outputs?.rapide === '1';
const graine = needs.mode?.outputs?.graine || '';

// ── Journaux bruts de chaque job ──────────────────────────────────────────────
for (const j of jobs) {
    for (const f of fs.readdirSync(j.dir)) {
        if (f.endsWith('.log') || f.endsWith('.txt')) copier(path.join(j.dir, f), path.join(runDir, 'jobs', j.nom, f));
    }
}
// Journaux communs à plusieurs jobs : réunis, avec un en-tête par job
for (const nom of ['supabase-start', 'db-reset', 'seed', 'containers']) {
    const parts = jobs.map((j) => [j.nom, lire(path.join(j.dir, `${nom}.log`))]).filter(([, t]) => t !== null);
    if (parts.length > 0) fs.writeFileSync(path.join(runDir, `${nom}.log`), parts.map(([n, t]) => `===== job ${n} =====\n${t}`).join('\n'));
}
// Journaux et mesures du job e2e, aux mêmes noms qu'en série
const e2e = job('e2e');
if (e2e) {
    for (const nom of ['e2e-install', 'e2e-seed', 'fake-services', 'next-start', 'e2e', 'build', 'perf-mobile']) copier(path.join(e2e.dir, `${nom}.log`), path.join(runDir, `${nom}.log`));
    for (const d of ['captures', 'emails', 'perf', 'playwright']) copier(path.join(e2e.dir, d), path.join(runDir, d));
    copier(path.join(e2e.dir, 'js-budget.tsv'), path.join(runDir, 'js-budget.tsv'));
}
// Design 1c (point 1) : contrôle responsive (job « responsive ») : journal, résumé et captures, à part de l'e2e
const responsive = job('responsive');
if (responsive) {
    copier(path.join(responsive.dir, 'e2e.log'), path.join(runDir, 'responsive.log'));
    for (const f of ['responsive.tsv', 'responsive.txt']) copier(path.join(responsive.dir, f), path.join(runDir, f));
    copier(path.join(responsive.dir, 'captures-responsive'), path.join(runDir, 'captures-responsive'));
    copier(path.join(responsive.dir, 'playwright'), path.join(runDir, 'playwright-responsive'));
}
// Design 1e (vitesse) : mesure mobile seule en mode rapide (job « perf »), aux mêmes noms que celle du job e2e
const perfJob = job('perf');
if (perfJob) {
    for (const nom of ['build', 'perf-mobile', 'e2e', 'next-start', 'e2e-seed']) copier(path.join(perfJob.dir, `${nom}.log`), path.join(runDir, `${nom}.log`));
    copier(path.join(perfJob.dir, 'perf'), path.join(runDir, 'perf'));
    copier(path.join(perfJob.dir, 'js-budget.tsv'), path.join(runDir, 'js-budget.tsv'));
}
// Journaux des suites : tous lots réunis (noms uniques par suite)
for (const j of [...lots, job('rapide')].filter(Boolean)) copier(path.join(j.dir, 'test-logs'), path.join(runDir, 'test-logs'));

// ── Contrôle de couverture des lots et verify.log ─────────────────────────────
let controle = 'sans-objet';
const sections = [];
if (rapide) {
    const r = job('rapide');
    sections.push(lire(r ? path.join(r.dir, 'verify.log') : '') ?? '[verdict] journal du mode rapide absent\n');
} else {
    const q = job('qualite');
    sections.push(`═══════════════ [job qualite] typecheck · lint ═══════════════\n${lire(q ? path.join(q.dir, 'verify.log') : '') ?? '[verdict] journal du job qualite absent\n'}`);
    const liste = q ? path.join(q.dir, 'liste-suites.txt') : '';
    const journaux = lots.map((l) => path.join(l.dir, 'verify.log'));
    const attendus = Number(needs.mode?.outputs?.lots || 0);
    let sortie;
    if (!liste || !fs.existsSync(liste)) {
        sortie = '[verdict] liste des suites absente (job qualite) : contrôle impossible\n';
        controle = 'echec';
    } else {
        const r = spawnSync(process.execPath, [path.join('scripts', 'ci-lots.mjs'), 'controle', liste, ...journaux], { encoding: 'utf8' });
        sortie = `${r.stdout}${r.stderr}`;
        controle = r.status === 0 ? 'ok' : 'echec';
    }
    if (attendus > 0 && lots.length !== attendus) {
        sortie += `[verdict] ${lots.length} journal(aux) de lot reçu(s) sur ${attendus} attendu(s)\n`;
        controle = 'echec';
    }
    sections.push(`═══════════════ [verdict] tests : ${lots.length} lot(s) en parallèle (journaux bruts : jobs/tests-*/verify.log) ═══════════════${sortie}`);
    sections.push(`═══════════════ [job e2e] build · js-budget ═══════════════\n${lire(e2e ? path.join(e2e.dir, 'build.log') : '') ?? '[verdict] journal du build absent\n'}`);
}
fs.writeFileSync(path.join(runDir, 'verify.log'), sections.join('\n'));

// ── Verdict ───────────────────────────────────────────────────────────────────
// Design 1c (point 1) : le job « responsive » est requis au run complet, et en mode rapide quand le commit le demande
const avecResponsive = !rapide || needs.mode?.outputs?.responsive === '1';
// Design 1e (vitesse) : le job « perf » n'existe qu'en mode rapide, requis quand le commit le demande (ligne ci-perf)
const avecPerf = rapide && needs.mode?.outputs?.perf === '1';
const requis = [...(rapide ? ['mode', 'rapide'] : ['mode', 'qualite', 'tests', 'e2e']), ...(avecResponsive ? ['responsive'] : []), ...(avecPerf ? ['perf'] : [])];
const resultats = requis.map((n) => [n, needs[n]?.result ?? 'absent']);
let verdict = 'success';
if (resultats.some(([, r]) => r === 'failure') || (!rapide && controle !== 'ok')) verdict = 'failure';
else if (resultats.some(([, r]) => r === 'cancelled')) verdict = 'cancelled';
else if (resultats.some(([, r]) => r !== 'success')) verdict = 'failure';

// ── run.txt ───────────────────────────────────────────────────────────────────
const env = process.env;
const lignes = [
    `run_id=${env.GITHUB_RUN_ID ?? ''}`,
    `run_number=${env.GITHUB_RUN_NUMBER ?? ''}`,
    `sha=${env.GITHUB_SHA ?? ''}`,
    `ref=${env.GITHUB_REF ?? ''}`,
    `job_status=${verdict}`,
    'ci=parallele',
];
if (!rapide) {
    const o = needs.e2e?.outputs ?? {};
    lignes.push(`build=${o.build || 'skipped'}`, `js_budget=${o.js_budget || 'skipped'}`, `e2e_seed=${o.e2e_seed || 'skipped'}`, `e2e=${o.e2e || 'skipped'}`);
    // Design 1b (lot PERF) : étape bloquante du job e2e (son échec rend le job, donc le run, rouge)
    lignes.push(`perf_mobile=${o.perf_mobile || 'skipped'}`);
    lignes.push(`controle_lots=${controle}`, `lots=${lots.length}`);
    if (graine) lignes.push(`graine=${graine}`);
}
if (avecResponsive) lignes.push(`responsive=${needs.responsive?.outputs?.responsive || 'skipped'}`);
if (avecPerf) {
    const o = needs.perf?.outputs ?? {};
    lignes.push(`build=${o.build || 'skipped'}`, `js_budget=${o.js_budget || 'skipped'}`, `perf_mobile=${o.perf_mobile || 'skipped'}`);
}
if (rapide) lignes.push('mode=rapide', `suites=${needs.mode?.outputs?.suites ?? ''}`);
else lignes.push('mode=complet');
lignes.push(`url=${env.GITHUB_SERVER_URL ?? ''}/${env.GITHUB_REPOSITORY ?? ''}/actions/runs/${env.GITHUB_RUN_ID ?? ''}`);
// Durée du run : du début du job « mode » à l'assemblage du verdict (en série : durée de l'unique job)
if (t0) lignes.push(`job_elapsed_s=${maintenant - t0}`);
const npm = jobs.map((j) => kv(lire(path.join(j.dir, 'job.txt'))).npm_version).find(Boolean);
lignes.push(`npm_version=${npm || 'inconnue'}`);
for (const [n, r] of Object.entries(needs)) {
    const infos = n === 'tests' ? lots : [job(n)].filter(Boolean);
    if (infos.length === 0) lignes.push(`job_${n}=resultat:${r.result}`);
    for (const j of infos) {
        const m = kv(lire(path.join(j.dir, 'job.txt')));
        const debut = Number(m.debut);
        const fin = Number(m.fin);
        const res = n === 'tests' ? m.statut || r.result : r.result;
        lignes.push(`job_${j.nom}=resultat:${res}${t0 && debut ? ` debut_s:${debut - t0}` : ''}${debut && fin ? ` duree_s:${fin - debut}` : ''}`);
    }
}
for (const j of jobs) {
    const etapes = lire(path.join(j.dir, 'etapes.txt'));
    if (!etapes || !t0) continue;
    for (const l of etapes.trim().split(/\r?\n/)) {
        const [nom, debut, fin, code] = l.split(' ');
        lignes.push(`etape_${j.nom}_${nom}=debut_s:${Number(debut) - t0} duree_s:${Number(fin) - Number(debut)} code:${code}`);
    }
}
fs.writeFileSync(path.join(runDir, 'run.txt'), `${lignes.join('\n')}\n`);

console.log(`[verdict] jobs : ${resultats.map(([n, r]) => `${n} ${r}`).join(' · ')}${rapide ? '' : ` · contrôle des lots ${controle}`}`);
console.log(`[verdict] ${verdict === 'success' ? 'VERT' : verdict === 'cancelled' ? 'ANNULÉ' : 'ROUGE'} (${verdict})`);
if (env.GITHUB_OUTPUT) fs.appendFileSync(env.GITHUB_OUTPUT, `verdict=${verdict}\n`);

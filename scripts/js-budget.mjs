#!/usr/bin/env node
/**
 * Lot 7, tâche 7.5 — poids JavaScript réel du premier chargement, layout racine compris (contrat, section 9 ;
 * décision D76). Appelé par `scripts/verify.mjs` juste après `next build`.
 *
 * Pourquoi : la colonne « First Load JS » du tableau de `next build` ne compte pas le layout racine
 * (`"/layout"` et `"/template"` sont des entrées séparées de `"<route>/page"` dans
 * `.next/app-build-manifest.json` ; voir discovery-7-perf.md §1.1). Ce script somme donc, pour chaque route
 * mesurée, la taille gzip (zlib, niveau 9) des fichiers .js DISTINCTS de `"/layout"` ∪ `"/template"` ∪
 * `"<route>/page"` (un fichier partagé n'est compté qu'une fois). Les feuilles de style ne sont pas comptées.
 *
 * Routes mesurées : /, /events/[id], /tickets, /controller/scanner, /billet/hors-ligne.
 *
 * Budgets : `scripts/js-budget.json`, objet { "<route>": <octets gzip maximum> } (entier > 0 ; 1 Ko = 1 000
 * octets, comme le tableau de Next). Clés admises : les cinq routes ci-dessus, rien d'autre.
 *  - fichier absent, ou objet vide : MESURE SEULE (aucun échec pour un dépassement) ; c'est la mesure
 *    « avant » du commit test(7.5) ;
 *  - route avec budget : échec si la mesure dépasse le budget, ou si la route est absente du build ;
 *  - route sans budget : mesurée et imprimée ;
 *  - route absente du build : échec pour les quatre routes qui existent avant le lot 7 (/, /events/[id],
 *    /tickets, /controller/scanner : une mesure manquante ne passe jamais en silence) et pour toute route
 *    budgétée ; /billet/hors-ligne sans budget est seulement signalée ABSENTE (page créée par 7.1).
 *
 * Sortie : une ligne `[JS-BUDGET]` par route, et `.verify/js-budget.tsv`
 * (colonnes : route, fichiers, octets_gzip, octets_bruts, budget, statut).
 *
 * Codes de sortie : 0 conforme (ou mesure seule) ; 1 budget dépassé, ou route attendue ou budgétée absente ;
 * 2 configuration invalide (manifeste absent ou illisible, entrée "/layout" absente, fichier du manifeste
 * introuvable, budget mal formé).
 *
 * Options (pour les tests du script, tests/parcours/perf-statique.test.ts) :
 *   --next-dir <dossier>   dossier du build (défaut : .next)
 *   --budget <fichier>     fichier des budgets (défaut : scripts/js-budget.json)
 *   --out <fichier>        fichier TSV écrit (défaut : .verify/js-budget.tsv)
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const TAG = '[JS-BUDGET]';
const ROOT = process.cwd();

/** Route mesurée → entrée de page dans app-build-manifest.json, et présence exigée dans tout build. */
const MEASURED_ROUTES = [
    ['/', '/page', true],
    ['/events/[id]', '/events/[id]/page', true],
    ['/tickets', '/tickets/page', true],
    ['/controller/scanner', '/controller/scanner/page', true],
    ['/billet/hors-ligne', '/billet/hors-ligne/page', false],
];

function configError(message) {
    console.error(`${TAG} ERREUR de configuration : ${message}`);
    process.exit(2);
}

function parseArgs(argv) {
    const opts = {
        nextDir: path.resolve(ROOT, '.next'),
        budget: path.resolve(ROOT, 'scripts/js-budget.json'),
        out: path.resolve(ROOT, '.verify/js-budget.tsv'),
    };
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i];
        const value = argv[i + 1];
        if (a === '--next-dir' || a === '--budget' || a === '--out') {
            if (!value || value.startsWith('--')) configError(`valeur manquante après ${a}`);
            const resolved = path.resolve(ROOT, value);
            if (a === '--next-dir') opts.nextDir = resolved;
            else if (a === '--budget') opts.budget = resolved;
            else opts.out = resolved;
            i++;
        } else {
            configError(`option inconnue : ${a}`);
        }
    }
    return opts;
}

function readManifest(nextDir) {
    const file = path.join(nextDir, 'app-build-manifest.json');
    if (!fs.existsSync(file)) {
        configError(`${path.relative(ROOT, file) || file} introuvable : lancez « next build » avant ce script.`);
    }
    let parsed;
    try {
        parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (err) {
        configError(`${file} illisible (${err instanceof Error ? err.message : String(err)}).`);
    }
    if (!parsed || typeof parsed !== 'object' || !parsed.pages || typeof parsed.pages !== 'object') {
        configError(`${file} sans objet « pages ».`);
    }
    if (!Array.isArray(parsed.pages['/layout'])) {
        configError(`entrée "/layout" absente de ${file} : le layout racine ne peut pas être compté.`);
    }
    return parsed.pages;
}

/** Budgets lus (objet vide : mesure seule). Toute clé inconnue ou valeur invalide est une erreur. */
function readBudgets(file) {
    if (!fs.existsSync(file)) return { budgets: {}, source: 'absent' };
    let parsed;
    try {
        parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (err) {
        configError(`${file} illisible (${err instanceof Error ? err.message : String(err)}).`);
    }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        configError(`${file} doit contenir un objet { "<route>": <octets> }.`);
    }
    const known = new Set(MEASURED_ROUTES.map(([route]) => route));
    for (const [route, value] of Object.entries(parsed)) {
        if (!known.has(route)) {
            configError(`route inconnue dans ${file} : « ${route} » (routes admises : ${[...known].join(', ')}).`);
        }
        if (!Number.isInteger(value) || value <= 0) {
            configError(`budget invalide pour « ${route} » dans ${file} : ${JSON.stringify(value)} (entier d'octets > 0 attendu).`);
        }
    }
    return { budgets: parsed, source: path.relative(ROOT, file) || file };
}

function gzipSize(buffer) {
    return zlib.gzipSync(buffer, { level: 9 }).length;
}

function formatKo(bytes) {
    return `${(bytes / 1000).toFixed(1).replace('.', ',')} Ko`;
}

function main() {
    const opts = parseArgs(process.argv.slice(2));
    const pages = readManifest(opts.nextDir);
    const { budgets, source } = readBudgets(opts.budget);
    const measureOnly = Object.keys(budgets).length === 0;
    const shared = [...(pages['/layout'] || []), ...(Array.isArray(pages['/template']) ? pages['/template'] : [])];
    if (!Array.isArray(pages['/template'])) {
        console.log(`${TAG} entrée "/template" absente du manifeste : seul "/layout" est ajouté aux pages.`);
    }
    console.log(`${TAG} budgets : ${source === 'absent' ? 'scripts/js-budget.json absent' : source}${measureOnly ? ' — MESURE SEULE (aucun échec)' : ''}`);

    const rows = [];
    const failures = [];
    for (const [route, entry, required] of MEASURED_ROUTES) {
        const budget = Object.prototype.hasOwnProperty.call(budgets, route) ? budgets[route] : null;
        const pageFiles = pages[entry];
        if (!Array.isArray(pageFiles)) {
            const blocking = required || budget !== null;
            rows.push({ route, files: 0, gzip: '', raw: '', budget: budget ?? '', status: blocking ? 'ECHEC' : 'ABSENTE' });
            console.log(`${TAG} ${route} : absente du build (entrée "${entry}")${blocking ? ' : ÉCHEC' : ''}`);
            if (blocking) {
                failures.push(`${route} : route ${budget !== null ? 'budgétée' : 'attendue'} absente du build (entrée "${entry}")`);
            }
            continue;
        }
        const files = [...new Set([...shared, ...pageFiles])].filter((f) => f.endsWith('.js')).sort();
        let gzip = 0;
        let raw = 0;
        for (const rel of files) {
            const abs = path.join(opts.nextDir, rel);
            if (!fs.existsSync(abs)) configError(`fichier du manifeste introuvable pour ${route} : ${rel}`);
            const buffer = fs.readFileSync(abs);
            raw += buffer.length;
            gzip += gzipSize(buffer);
        }
        let status = 'MESURE';
        if (budget !== null) {
            status = gzip <= budget ? 'OK' : 'DEPASSE';
            if (status === 'DEPASSE') failures.push(`${route} : ${gzip} octets gzip > budget ${budget} (dépassement ${gzip - budget})`);
        }
        rows.push({ route, files: files.length, gzip, raw, budget: budget ?? '', status });
        console.log(`${TAG} ${route} : ${gzip} octets gzip (${formatKo(gzip)}), ${files.length} fichier(s) JS, ${raw} octets bruts`
            + (budget === null ? ' — sans budget' : ` — budget ${budget} octets (${formatKo(budget)}) : ${status === 'OK' ? 'OK' : 'DÉPASSÉ'}`));
    }

    fs.mkdirSync(path.dirname(opts.out), { recursive: true });
    const tsv = ['route\tfichiers\toctets_gzip\toctets_bruts\tbudget\tstatut',
        ...rows.map((r) => [r.route, r.files, r.gzip, r.raw, r.budget, r.status].join('\t'))].join('\n') + '\n';
    fs.writeFileSync(opts.out, tsv, 'utf8');
    console.log(`${TAG} tableau écrit : ${path.relative(ROOT, opts.out) || opts.out}`);

    if (failures.length > 0) {
        console.error(`${TAG} ÉCHEC : ${failures.length} route(s) hors budget ou absente(s) :`);
        for (const f of failures) console.error(`${TAG}   ${f}`);
        process.exit(1);
    }
    console.log(`${TAG} ${measureOnly ? 'mesure terminée (aucun budget fixé)' : 'toutes les routes budgétées sont dans leur budget'}.`);
}

main();

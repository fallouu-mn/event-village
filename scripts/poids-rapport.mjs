#!/usr/bin/env node
/**
 * Lot poids — lecture du relevé des modules (scripts/poids-modules.mjs) pour les routes budgétées (diagnostic seul,
 * code de sortie 0 sauf fichier absent).
 *
 * Pour le code commun (« /layout » ∪ « /template », chargé par TOUTES les routes) puis pour la part propre de chaque
 * route : taille gzip de chaque fichier, puis estimation par paquet et par module. Estimation : la taille gzip du
 * fichier répartie au prorata des octets de source de ses modules (la minification et la compression ne sont pas
 * uniformes : l'ordre de grandeur sert à choisir où chercher, le gain réel se lit sur scripts/js-budget.mjs).
 *
 * Usage : node scripts/poids-rapport.mjs [--next-dir .next] [--modules .verify/poids-modules.tsv] [--top 60]
 */
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const ROOT = process.cwd();
const args = process.argv.slice(2);
const opt = (nom, defaut) => {
    const i = args.indexOf(nom);
    return i >= 0 && args[i + 1] ? args[i + 1] : defaut;
};
const nextDir = path.resolve(ROOT, opt('--next-dir', '.next'));
const modulesTsv = path.resolve(ROOT, opt('--modules', '.verify/poids-modules.tsv'));
const top = Number(opt('--top', '60'));

const ROUTES = [
    ['/', '/page'],
    ['/events/[id]', '/events/[id]/page'],
    ['/tickets', '/tickets/page'],
    ['/controller/scanner', '/controller/scanner/page'],
    ['/billet/hors-ligne', '/billet/hors-ligne/page'],
    ['/explore', '/explore/page'],
];

for (const f of [path.join(nextDir, 'app-build-manifest.json'), modulesTsv]) {
    if (!fs.existsSync(f)) {
        console.error(`[POIDS] ${f} introuvable (build avec EV_ANALYSE_POIDS=1 d'abord).`);
        process.exit(2);
    }
}
const pages = JSON.parse(fs.readFileSync(path.join(nextDir, 'app-build-manifest.json'), 'utf8')).pages;

// fichier .js → modules [{ module, octets }]
const parFichier = new Map();
for (const ligne of fs.readFileSync(modulesTsv, 'utf8').split('\n').slice(1)) {
    if (!ligne) continue;
    const [, fichiers, module, octets] = ligne.split('\t');
    for (const f of fichiers.split(',').filter(Boolean)) {
        if (!parFichier.has(f)) parFichier.set(f, []);
        parFichier.get(f).push({ module, octets: Number(octets) || 0 });
    }
}

const gzCache = new Map();
function gz(rel) {
    if (!gzCache.has(rel)) gzCache.set(rel, zlib.gzipSync(fs.readFileSync(path.join(nextDir, rel)), { level: 9 }).length);
    return gzCache.get(rel);
}

function paquet(module) {
    const m = /node_modules\/((?:@[^/]+\/)?[^/]+)/.exec(module);
    if (m) {
        // Next : distinguer le client du routeur, React compilé, etc.
        if (m[1] === 'next') {
            const sous = /node_modules\/next\/dist\/(compiled\/[^/]+|client\/components|client|shared\/lib|build|lib|server)/.exec(module);
            return `next/${sous ? sous[1] : '?'}`;
        }
        return m[1];
    }
    const app = /^\.\/((?:app|components|lib|hooks|contexts|types)\/[^/]+)/.exec(module);
    return app ? app[1] : module.slice(0, 60);
}

function analyser(titre, fichiers) {
    const js = fichiers.filter((f) => f.endsWith('.js')).sort();
    let total = 0;
    const paquets = new Map();
    const modules = [];
    console.log(`\n[POIDS] ══ ${titre} ══`);
    for (const f of js) {
        const g = gz(f);
        total += g;
        const mods = parFichier.get(f) ?? [];
        const src = mods.reduce((s, m) => s + m.octets, 0);
        console.log(`[POIDS]   fichier ${f.replace(/-[0-9a-f]{16}\.js$/, '.js')} : ${g} octets gzip, ${mods.length} module(s), ${src} octets de source`);
        for (const m of mods) {
            const est = src > 0 ? (g * m.octets) / src : 0;
            modules.push({ ...m, est, fichier: f });
            const p = paquet(m.module);
            paquets.set(p, (paquets.get(p) ?? 0) + est);
        }
    }
    console.log(`[POIDS]   total : ${total} octets gzip`);
    console.log('[POIDS]   — par paquet (estimation gzip) —');
    for (const [p, est] of [...paquets].sort((a, b) => b[1] - a[1]).slice(0, top)) {
        console.log(`[POIDS]     ${String(Math.round(est)).padStart(7)}  ${p}`);
    }
    console.log('[POIDS]   — plus gros modules (estimation gzip ; octets de source) —');
    for (const m of modules.sort((a, b) => b.est - a.est).slice(0, top)) {
        console.log(`[POIDS]     ${String(Math.round(m.est)).padStart(7)}  ${String(m.octets).padStart(7)}  ${m.module}`);
    }
}

const commun = [...new Set([...(pages['/layout'] ?? []), ...(pages['/template'] ?? [])])];
analyser('code commun à toutes les routes (/layout ∪ /template)', commun);
const communSet = new Set(commun);
for (const [route, entree] of ROUTES) {
    if (!Array.isArray(pages[entree])) {
        console.log(`\n[POIDS] ${route} : absente du build`);
        continue;
    }
    analyser(`part propre de ${route} (hors code commun)`, pages[entree].filter((f) => !communSet.has(f)));
}

// Doublons : modules présents dans plusieurs fichiers du premier chargement d'une même route (comptés plusieurs fois)
console.log('\n[POIDS] ══ modules en double dans le premier chargement d\'une route (estimation gzip de chaque copie en trop) ══');
for (const [route, entree] of ROUTES) {
    if (!Array.isArray(pages[entree])) continue;
    const js = [...new Set([...commun, ...pages[entree]])].filter((f) => f.endsWith('.js'));
    const ou = new Map();
    for (const f of js) {
        const mods = parFichier.get(f) ?? [];
        const src = mods.reduce((s, m) => s + m.octets, 0);
        for (const m of mods) {
            if (!ou.has(m.module)) ou.set(m.module, []);
            ou.get(m.module).push({ fichier: f.replace(/-[0-9a-f]{16}\.js$/, '.js'), est: src > 0 ? (gz(f) * m.octets) / src : 0 });
        }
    }
    const doubles = [...ou].filter(([, l]) => l.length > 1)
        .map(([module, l]) => ({ module, l, trop: l.slice(1).reduce((s, x) => s + x.est, 0) }))
        .sort((a, b) => b.trop - a.trop);
    const total = doubles.reduce((s, d) => s + d.trop, 0);
    console.log(`[POIDS]   ${route} : ${doubles.length} module(s) en double, ~${Math.round(total)} octets gzip en trop`);
    for (const d of doubles.slice(0, 40)) {
        console.log(`[POIDS]     ${String(Math.round(d.trop)).padStart(6)}  ${d.module}  [${d.l.map((x) => x.fichier).join(' ; ')}]`);
    }
}

// Morceaux chargeables à la demande : modules de chacun (repérer doublons et variantes)
console.log('\n[POIDS] ══ morceaux hors premier chargement des routes mesurées : modules les plus lourds de chacun ══');
const premier = new Set([...commun, ...ROUTES.flatMap(([, e]) => pages[e] ?? [])]);
// Seulement les morceaux numérotés (pages des autres routes exclues : static/chunks/app/…)
const tousFichiers = [...parFichier.keys()].filter((f) => /^static\/chunks\/\d/.test(f) && !premier.has(f));
for (const f of tousFichiers.sort()) {
    if (!fs.existsSync(path.join(nextDir, f))) continue;
    const mods = (parFichier.get(f) ?? []).sort((a, b) => b.octets - a.octets);
    const g = gz(f);
    console.log(`[POIDS]   ${f.replace(/-[0-9a-f]{16}\.js$/, '.js')} : ${g} octets gzip — ${mods.slice(0, 4).map((m) => `${m.module} (${m.octets})`).join(' ; ')}`);
}

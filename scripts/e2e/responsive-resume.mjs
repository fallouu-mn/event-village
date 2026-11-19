#!/usr/bin/env node
/**
 * Design 1c (point 1) — résumé du contrôle responsive (phase « responsive » de scripts/e2e/run-e2e.mjs).
 *
 * Lit .e2e-captures/responsive/<page>__<thème>.json (un par test d'e2e/responsive.spec.ts) et écrit :
 *  - .e2e-captures/responsive.tsv : une ligne par page, thème et taille (groupe, rôle, nombre de défauts, capture) ;
 *  - .e2e-captures/responsive.txt : chaque défaut en clair, puis le total par groupe.
 * Code de sortie 1 si une page attendue n'a aucun résultat (test pas lancé ou arrêté avant d'écrire) ; les défauts
 * eux-mêmes font déjà échouer la phase Playwright.
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const OUT = path.join(ROOT, '.e2e-captures');
const DIR = path.join(OUT, 'responsive');

const files = fs.existsSync(DIR) ? fs.readdirSync(DIR).filter((f) => f.endsWith('.json')).sort() : [];
const records = files.map((f) => JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')));

const tsv = ['page\tgroupe\trole\ttheme\ttaille\tdefauts\tavertissements\tcapture'];
const txt = [];
const parGroupe = new Map();
let defauts = 0;
for (const r of records) {
    const g = parGroupe.get(r.groupe) ?? { pages: new Set(), controles: 0, defauts: 0 };
    g.pages.add(r.page);
    for (const s of r.sizes) {
        tsv.push([r.page, r.groupe, r.role, r.theme, s.size, s.blocking.length, s.warnings.length, s.capture ?? ''].join('\t'));
        g.controles += 1;
        g.defauts += s.blocking.length;
        defauts += s.blocking.length;
        for (const b of s.blocking) txt.push(`${r.page} (${r.theme}) — ${b}`);
    }
    if (r.error) txt.push(`${r.page} (${r.theme}) — arrêt : ${r.error}`);
    for (const n of r.notes) txt.push(`${r.page} (${r.theme}) — note : ${n}`);
    parGroupe.set(r.groupe, g);
}

const lignes = [
    `Contrôle responsive : ${records.length} résultat(s) (page × thème), ${defauts} défaut(s) bloquant(s).`,
    ...[...parGroupe.entries()].map(([groupe, g]) => `  ${groupe} : ${g.pages.size} page(s), ${g.controles} contrôle(s) (taille × thème), ${g.defauts} défaut(s)`),
    '',
    ...txt,
];
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'responsive.tsv'), `${tsv.join('\n')}\n`, 'utf8');
fs.writeFileSync(path.join(OUT, 'responsive.txt'), `${lignes.join('\n')}\n`, 'utf8');
console.log(lignes.slice(0, 1 + parGroupe.size).join('\n'));
if (records.length === 0) {
    console.error('[responsive] aucun résultat écrit : la phase n’a pas tourné.');
    process.exit(1);
}

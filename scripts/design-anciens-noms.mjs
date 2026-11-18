// Design 1a (point 1) — anciens noms de couleur (table de docs/design/direction.md, section 2).
//
// Les anciens noms restent des alias vers la charte (app/globals.css, tailwind.config.ts), le temps que les pages
// migrent (lots 1b et 1c) et pour les branches en cours ; ils sont INTERDITS dans tout fichier nouveau ou modifié.
// « Modifié » ne dépend pas de l'historique git (la CI clone sans profondeur) : tests/helpers/design-anciens-noms.json
// fige, pour chaque fichier qui les employait au départ du design 1a, l'empreinte SHA-256 de son contenu (fins de ligne
// ramenées à \n). Un fichier absent de l'inventaire, ou dont l'empreinte a changé, ne doit en contenir aucun.
//
//   node scripts/design-anciens-noms.mjs                  liste les fichiers en faute (code 1 s'il y en a)
//   node scripts/design-anciens-noms.mjs --inventaire REF fige l'inventaire depuis la révision git REF
//
// Portée : app/, components/, lib/ (.ts, .tsx, .css), sauf app/globals.css qui définit les alias.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const INVENTORY = 'tests/helpers/design-anciens-noms.json';
const SCOPE = ['app', 'components', 'lib'];
const EXCLUDED = new Set(['app/globals.css']);
const EXT = /\.(ts|tsx|css)$/;

const PREFIX = '(?:bg|text|border(?:-[trblxy])?|ring(?:-offset)?|divide|outline|fill|stroke|from|via|to|placeholder|decoration|caret|accent|shadow)';
const OLD_COLOR = '(?:surface(?:-raised|-sunken)?|fg(?:-muted)?|border-strong|brand(?!-vif)(?:-(?:hover|fg|bg|decor|50|[1-9]00))?'
    + '|on-brand|on-op-wave|on-op-orange-money|(?:success|warning|danger|info)-(?:bg|fg))';
const OLD_VAR = '(?:bg-main|bg-surface|bg-card|text-main|text-secondary|text-muted|border-main|border-subtle|brand-primary'
    + '|brand-active|brand-coral|brand-rose|brand-light|brand-gradient(?:-hover)?|brand-glow|glass-bg|glass-border'
    + '|surface(?:-raised|-sunken)?|fg(?:-muted)?|border-strong|on-brand|brand-(?:hover|fg|bg|decor)'
    + '|(?:success|warning|danger|info)-(?:bg|fg)|on-op-wave|on-op-orange-money)';

/** Une occurrence d'ancien nom : classe Tailwind, variable CSS ou ancienne classe de app/globals.css. */
export const OLD_NAME_RE = new RegExp(
    `(?<![a-zA-Z0-9-])${PREFIX}-${OLD_COLOR}(?![a-zA-Z0-9-])`
    + `|var\\(--${OLD_VAR}\\)`
    + '|(?<![a-zA-Z0-9-])(?:ev-btn-primary|ev-gradient-text|ev-glass|ev-card-hover|ev-ticket-card)(?![a-zA-Z0-9-])',
    'g',
);

export function normalize(text) {
    return text.replace(/\r\n/g, '\n');
}

export function contentHash(text) {
    return createHash('sha256').update(normalize(text), 'utf8').digest('hex');
}

export function oldNamesIn(text) {
    return [...new Set(normalize(text).match(OLD_NAME_RE) ?? [])].sort();
}

function walk(dir, out) {
    for (const name of readdirSync(dir)) {
        const full = join(dir, name);
        if (statSync(full).isDirectory()) walk(full, out);
        else if (EXT.test(name)) out.push(relative(ROOT, full).split(sep).join('/'));
    }
}

/** Fichiers de la portée présents sur le disque. */
export function scopedFiles() {
    const out = [];
    for (const d of SCOPE) if (existsSync(join(ROOT, d))) walk(join(ROOT, d), out);
    return out.filter((f) => !EXCLUDED.has(f)).sort();
}

export function readInventory() {
    return JSON.parse(readFileSync(join(ROOT, INVENTORY), 'utf8'));
}

/** Fichiers en faute : nouveaux ou modifiés depuis l'inventaire, et qui emploient un ancien nom. */
export function faults() {
    const inventory = readInventory().files;
    const out = [];
    for (const rel of scopedFiles()) {
        const text = readFileSync(join(ROOT, rel), 'utf8');
        const names = oldNamesIn(text);
        if (names.length === 0) continue;
        const known = inventory[rel];
        if (known && known === contentHash(text)) continue;
        out.push({ file: rel, state: known ? 'modifié' : 'nouveau', names });
    }
    return out;
}

function buildInventory(ref) {
    const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
    const files = git('ls-tree', '-r', '--name-only', ref, '--', ...SCOPE).split('\n').filter((f) => EXT.test(f) && !EXCLUDED.has(f));
    const inventory = {};
    for (const f of files) {
        const text = git('show', `${ref}:${f}`);
        if (oldNamesIn(text).length > 0) inventory[f] = contentHash(text);
    }
    const base = git('rev-parse', ref).trim();
    writeFileSync(join(ROOT, INVENTORY), `${JSON.stringify({ base, files: inventory }, null, 2)}\n`);
    console.log(`${Object.keys(inventory).length} fichier(s) emploient encore un ancien nom à ${base.slice(0, 9)} : inventaire écrit dans ${INVENTORY}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    const i = process.argv.indexOf('--inventaire');
    if (i > 0) {
        buildInventory(process.argv[i + 1] ?? 'HEAD');
    } else {
        const list = faults();
        for (const f of list) console.log(`${f.file} (${f.state}) : ${f.names.join(', ')}`);
        console.log(`${list.length} fichier(s) nouveau(x) ou modifié(s) avec un ancien nom de couleur.`);
        if (list.length > 0) process.exit(1);
    }
}

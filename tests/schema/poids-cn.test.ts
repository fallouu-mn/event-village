/**
 * Lot poids — fusion des classes (components/ui/cn.ts) sans la configuration complète de tailwind-merge.
 *
 * Avant : cn = extendTailwindMerge({ extend: { classGroups: { 'font-size': [{ text: ['caption'] }] } } }) appliqué à clsx.
 * Après : même algorithme, sur la table des classes du projet calculée au build (scripts/cn-classes.cjs, chargeur
 * scripts/cn-classes-loader.cjs). Ce test compare le NOUVEAU cn.ts (avec la table calculée) à l'ANCIEN (tailwind-merge 2.6.1,
 * même extension), sur :
 *  - toutes les paires de classes du code (chaque classe de la table devant chaque autre) ;
 *  - 150 000 suites tirées au hasard (graine fixe) : modificateurs (hover:, md:, dark:hover:, variante arbitraire), « ! »,
 *    valeurs négatives, suffixes « /… » écrits dans le code, propriétés arbitraires, mots hors Tailwind, blancs multiples ;
 *  - chaque mot des sources classé par tailwind-merge, seul puis précédé d'un autre au hasard.
 * Puis : le chargeur rend exactement la table calculée, il est branché pour toutes les constructions, le fichier du dépôt
 * calcule la même table hors webpack (tests sous Node), cn refuse une table vide, et plus aucun code de l'application
 * n'importe tailwind-merge.
 */
import { describe, test, before } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = process.cwd();
const read = (rel: string): string => fs.readFileSync(path.join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n');

type Generateur = {
    genererTable: (root: string) => { CLASSES: string; groupes: string[]; groupeDe: Map<string, string> };
    sourceModule: (root: string) => string;
    tailwindMerge: (root: string) => { extendTailwindMerge: (e: unknown) => (...c: string[]) => string; createParseClassName: (c: unknown) => unknown };
    EXTENSION: unknown;
    DOSSIERS: string[];
};

let gen: Generateur;
let ancien: (s: string) => string;
let nouveau: (s: string) => string;
let classes: string[];
let motsClasses: string[];

before(async () => {
    const require = createRequire(path.join(ROOT, 'package.json'));
    gen = require(path.join(ROOT, 'scripts/cn-classes.cjs')) as Generateur;
    const { extendTailwindMerge } = require('tailwind-merge') as { extendTailwindMerge: (e: unknown) => (s: string) => string };
    ancien = extendTailwindMerge(gen.EXTENSION);
    // Nouveau cn.ts tel quel, à côté de la table calculée (dossier ignoré par git, dans le dépôt pour résoudre clsx)
    const dir = path.join(ROOT, '.verify', 'poids-cn');
    fs.mkdirSync(dir, { recursive: true });
    fs.copyFileSync(path.join(ROOT, 'components/ui/cn.ts'), path.join(dir, 'cn.ts'));
    fs.writeFileSync(path.join(dir, 'cn-classes.ts'), gen.sourceModule(ROOT));
    const mod = await import(pathToFileURL(path.join(dir, 'cn.ts')).href) as { cn: (...c: string[]) => string };
    nouveau = (s: string) => mod.cn(s);
    const table = gen.genererTable(ROOT);
    classes = [...table.groupeDe.keys()];
    // Mots des sources que tailwind-merge classe (classes écrites, avec leurs modificateurs, « ! », suffixes)
    const mots = new Set<string>();
    const parse = (gen.tailwindMerge(ROOT).createParseClassName as (c: unknown) => (w: string) => { baseClassName: string })({ separator: ':' });
    for (const d of gen.DOSSIERS) {
        const walk = (p: string) => {
            for (const e of fs.readdirSync(p, { withFileTypes: true })) {
                const f = path.join(p, e.name);
                if (e.isDirectory()) { if (e.name !== 'node_modules' && !e.name.startsWith('.')) walk(f); } else if (/\.(tsx?|jsx?|mjs|css)$/.test(e.name)) {
                    for (const m of fs.readFileSync(f, 'utf8').split(/[\s"'`{}]+/)) if (m && m.length < 200) mots.add(m);
                }
            }
        };
        if (fs.existsSync(path.join(ROOT, d))) walk(path.join(ROOT, d));
    }
    const connues = new Set(classes);
    motsClasses = [...mots].filter((m) => {
        const b = parse(m).baseClassName;
        return connues.has(b.startsWith('-') ? b.slice(1) : b) || /^\[.+:.+\]$/.test(b);
    });
});

describe('lot poids — fusion des classes identique à tailwind-merge pour les classes du code', () => {
    test('table calculée : des centaines de classes, text-caption dans le groupe des tailles de texte', () => {
        const table = gen.genererTable(ROOT);
        assert.ok(classes.length > 500, `${classes.length} classes dans la table`);
        assert.equal(table.groupeDe.get('text-caption'), 'font-size', 'text-caption est une taille de texte');
        assert.equal(table.groupeDe.get('text-foreground-strong'), 'text-color');
        assert.match(gen.sourceModule(ROOT), /^export const CALCULEE: boolean = true;$/m);
        assert.equal(nouveau('text-foreground-strong text-caption'), 'text-foreground-strong text-caption');
        assert.equal(nouveau('px-4 py-2 p-3'), 'p-3');
        assert.equal(nouveau('p-3 px-4'), 'p-3 px-4');
    });

    test('toutes les paires de classes du code : même résultat', () => {
        let ecarts = 0;
        const exemples: string[] = [];
        for (const a of classes) {
            for (const b of classes) {
                const s = `${a} ${b}`;
                if (nouveau(s) !== ancien(s)) {
                    ecarts++;
                    if (exemples.length < 10) exemples.push(`« ${s} » : ${JSON.stringify(nouveau(s))} au lieu de ${JSON.stringify(ancien(s))}`);
                }
            }
        }
        assert.equal(ecarts, 0, `${ecarts} écart(s) sur ${classes.length ** 2} paires :\n${exemples.join('\n')}`);
    });

    test('150 000 suites tirées au hasard (modificateurs, « ! », négatifs, suffixes, arbitraires) : même résultat', () => {
        let graine = 20261124;
        const hasard = () => { graine = (graine * 1103515245 + 12345) % 2147483648; return graine / 2147483648; };
        const pris = <T,>(l: T[]): T => l[Math.floor(hasard() * l.length)];
        const variantes = [(c: string) => c, (c: string) => `hover:${c}`, (c: string) => `md:${c}`, (c: string) => `dark:hover:${c}`,
            (c: string) => `hover:dark:${c}`, (c: string) => `!${c}`, (c: string) => `md:!${c}`, (c: string) => `-${c}`, (c: string) => `[&>svg]:${c}`];
        const hors = ['ev-press', 'ev-page-enter', 'toast-enter', 'foo', '[mask-type:luminance]', '[mask-type:alpha]', 'md:[overflow-wrap:anywhere]'];
        let ecarts = 0;
        const exemples: string[] = [];
        for (let k = 0; k < 150_000; k++) {
            const n = 2 + Math.floor(hasard() * 9);
            const parts: string[] = [];
            for (let q = 0; q < n; q++) {
                const r = hasard();
                parts.push(r < 0.08 ? pris(hors) : r < 0.45 ? pris(motsClasses) : pris(variantes)(pris(classes)));
            }
            const s = parts.join(hasard() < 0.8 ? ' ' : '  ');
            if (nouveau(s) !== ancien(s)) {
                ecarts++;
                if (exemples.length < 10) exemples.push(`« ${s} » : ${JSON.stringify(nouveau(s))} au lieu de ${JSON.stringify(ancien(s))}`);
            }
        }
        assert.equal(ecarts, 0, `${ecarts} écart(s) :\n${exemples.join('\n')}`);
    });

    test('chaque mot des sources classé par tailwind-merge, seul puis précédé d\'un autre : même résultat', () => {
        assert.ok(motsClasses.length > 500, `${motsClasses.length} mots`);
        let ecarts = 0;
        const exemples: string[] = [];
        motsClasses.forEach((m, i) => {
            for (const s of [m, `${motsClasses[(i * 7919) % motsClasses.length]} ${m}`, `${m} ${motsClasses[(i * 104729) % motsClasses.length]}`]) {
                if (nouveau(s) !== ancien(s)) {
                    ecarts++;
                    if (exemples.length < 10) exemples.push(`« ${s} » : ${JSON.stringify(nouveau(s))} au lieu de ${JSON.stringify(ancien(s))}`);
                }
            }
        });
        assert.equal(ecarts, 0, `${ecarts} écart(s) :\n${exemples.join('\n')}`);
    });
});

describe('lot poids — table calculée au build, jamais dans le dépôt', () => {
    test('le chargeur rend exactement la table calculée et suit les dossiers des sources', async () => {
        const require = createRequire(path.join(ROOT, 'package.json'));
        const loader = require(path.join(ROOT, 'scripts/cn-classes-loader.cjs')) as (this: unknown) => string;
        const dossiers: string[] = [];
        const rendu = loader.call({ rootContext: ROOT, addContextDependency: (d: string) => dossiers.push(d) });
        assert.equal(rendu, gen.sourceModule(ROOT));
        assert.deepEqual(dossiers.map((d) => path.relative(ROOT, d)).sort(), ['app', 'components', 'hooks', 'lib']);
    });

    test('next.config.mjs branche le chargeur pour toutes les constructions (avant la compilation du fichier)', () => {
        const conf = read('next.config.mjs');
        const corps = conf.slice(conf.indexOf('webpack(config'), conf.indexOf('return config;'));
        const regle = corps.slice(corps.indexOf('config.module.rules.push'), corps.indexOf('});') + 3);
        assert.match(regle, /test: \/\[\\\\\/\]components\[\\\\\/\]ui\[\\\\\/\]cn-classes\\\.ts\$\//);
        assert.match(regle, /enforce: 'pre'/);
        assert.match(regle, /scripts\/cn-classes-loader\.cjs/);
        assert.ok(corps.indexOf('config.module.rules.push') < corps.indexOf('if ('), 'règle ajoutée sans condition (navigateur, serveur, développement)');
    });

    test('npm run dev (next dev, webpack) : la vraie configuration branche le chargeur, navigateur et serveur ; table calculée', async () => {
        // package.json : « dev » lance next dev sans Turbopack (Turbopack ignorerait la fonction webpack de next.config.mjs)
        const pkg = JSON.parse(read('package.json')) as { scripts: Record<string, string> };
        assert.equal(pkg.scripts.dev, 'next dev');
        assert.doesNotMatch(Object.values(pkg.scripts).join('\n'), /--turbo/);
        const { PHASE_DEVELOPMENT_SERVER } = createRequire(path.join(ROOT, 'package.json'))('next/constants') as { PHASE_DEVELOPMENT_SERVER: string };
        const mod = await import(pathToFileURL(path.join(ROOT, 'next.config.mjs')).href) as { default: (phase: string) => { webpack: (c: unknown, o: unknown) => { module: { rules: Array<{ test: RegExp; enforce?: string; use: Array<{ loader: string }> }> } } } };
        const conf = mod.default(PHASE_DEVELOPMENT_SERVER);
        const require = createRequire(path.join(ROOT, 'package.json'));
        for (const isServer of [false, true]) {
            const rendu = conf.webpack({ module: { rules: [] }, plugins: [], output: {} }, { isServer, dev: true });
            const regles = rendu.module.rules.filter((r) => r.test.test(path.join(ROOT, 'components', 'ui', 'cn-classes.ts'))
                && r.test.test(`${ROOT.replace(/\\/g, '/')}/components/ui/cn-classes.ts`));
            assert.equal(regles.length, 1, `dev, ${isServer ? 'serveur' : 'navigateur'} : une règle pour cn-classes.ts`);
            assert.equal(regles[0].enforce, 'pre');
            const loader = require(regles[0].use[0].loader) as (this: unknown) => string;
            const source = loader.call({ rootContext: ROOT, addContextDependency: () => {} });
            assert.equal(source, gen.sourceModule(ROOT));
            assert.match(source, /export const CALCULEE: boolean = true;/);
        }
    });

    test('fichier du dépôt (CALCULEE faux) : hors webpack, même table calculée au chargement ; cn refuse une table vide', async () => {
        const depot = read('components/ui/cn-classes.ts');
        assert.match(depot, /export const CALCULEE: boolean = false;/);
        assert.match(depot, /createRequire\(join\(racine, 'package\.json'\)\)\(join\(racine, 'scripts', 'cn-classes\.cjs'\)\)/);
        // Run complet 641 : design1e-orange appelle cn sous Node ; le fichier du dépôt, importé tel quel, donne la même table
        const tel = await import(pathToFileURL(path.join(ROOT, 'components/ui/cn-classes.ts')).href) as { CLASSES: string; CONFLITS: unknown; CONFLITS_SUFFIXE: unknown };
        const calc = gen.genererTable(ROOT) as unknown as { CLASSES: string; CONFLITS: unknown; CONFLITS_SUFFIXE: unknown };
        assert.equal(tel.CLASSES, calc.CLASSES);
        assert.deepEqual([tel.CONFLITS, tel.CONFLITS_SUFFIXE], [calc.CONFLITS, calc.CONFLITS_SUFFIXE]);
        const cnDepot = await import(pathToFileURL(path.join(ROOT, 'components/ui/cn.ts')).href) as { cn: (...c: string[]) => string };
        const s = 'min-h-12 px-6 text-base bg-primary text-primary-foreground-large font-bold text-[1.1875rem] leading-tight text-sm';
        assert.equal(cnDepot.cn(s), ancien(s), 'cn du dépôt sous Node = tailwind-merge');
        const cn = read('components/ui/cn.ts');
        assert.match(cn, /if \(!CLASSES\) \{\n\s+throw new Error/);
    });

    test('plus aucun code de l\'application n\'importe tailwind-merge (seuls le calcul de la table et ce test)', () => {
        const fautifs: string[] = [];
        for (const d of ['app', 'components', 'lib', 'hooks']) {
            const walk = (p: string) => {
                for (const e of fs.readdirSync(p, { withFileTypes: true })) {
                    const f = path.join(p, e.name);
                    if (e.isDirectory()) { if (!e.name.startsWith('.')) walk(f); } else if (/\.(tsx?|jsx?|mjs)$/.test(e.name) && /from ['"]tailwind-merge['"]/.test(fs.readFileSync(f, 'utf8'))) fautifs.push(path.relative(ROOT, f));
                }
            };
            if (fs.existsSync(path.join(ROOT, d))) walk(path.join(ROOT, d));
        }
        assert.deepEqual(fautifs, []);
    });
});

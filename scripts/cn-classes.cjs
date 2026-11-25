/**
 * Lot poids — table des classes Tailwind du projet pour la fusion de classes de components/ui/cn.ts.
 *
 * Pourquoi : tailwind-merge (2.6.1) embarque sa configuration complète (toutes les classes possibles de Tailwind, avec leurs
 * règles) dans le JavaScript de CHAQUE page : ~6 800 octets gzip. La fusion n'a besoin, pour chaque classe écrite dans le
 * code, que de son GROUPE (p, px, bg-color, font-size…) et des groupes en conflit. Ce module calcule ces données avec
 * tailwind-merge lui-même (même configuration qu'avant : groupes par défaut + text-caption dans font-size), pour les seules
 * classes présentes dans les sources ; components/ui/cn.ts applique ensuite le même algorithme que tailwind-merge
 * (mergeClassList), ligne à ligne. Résultat identique pour toute classe écrite dans le code : tests/schema/poids-cn.test.ts.
 *
 * Univers : chaque mot (découpe sur les blancs, guillemets, accolades) des fichiers .ts .tsx .js .jsx .mjs .css de app/,
 * components/, lib/ et hooks/ — un sur-ensemble des classes réellement écrites (Tailwind ne produit du CSS que pour celles
 * de app/ et components/). Une classe absente des sources n'a pas de CSS : la fusion la garde telle quelle.
 *
 * Utilisé au build (scripts/cn-classes-loader.cjs remplace components/ui/cn-classes.ts par la table calculée : jamais
 * périmée, en développement comme en production) et par le test d'équivalence.
 */
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');

const DOSSIERS = ['app', 'components', 'lib', 'hooks'];
const EXTENSIONS = /\.(tsx?|jsx?|mjs|css)$/;
/** Le fichier remplacé au build ne compte pas dans l'univers (il ne contient aucune classe). */
const EXCLUS = new Set([path.join('components', 'ui', 'cn-classes.ts')]);

/** Version vérifiée : la table dépend de fonctions internes de tailwind-merge (lues dans son module, sans le modifier). */
const VERSION_TAILWIND_MERGE = '2.6.1';

/** Configuration d'avant le lot (components/ui/cn.ts) : groupes par défaut, et text-caption est une taille de texte. */
const EXTENSION = { extend: { classGroups: { 'font-size': [{ text: ['caption'] }] } } };

let interne = null;
/** Fonctions de tailwind-merge, internes comprises (createClassGroupUtils, createParseClassName). */
function tailwindMerge(root = process.cwd()) {
    if (interne) return interne;
    const require = createRequire(path.join(root, 'package.json'));
    // Point d'entrée CommonJS (dist/bundle-cjs.js) : le paquet n'exporte pas son package.json, lu à côté de dist/
    const dist = path.dirname(require.resolve('tailwind-merge'));
    const pkg = JSON.parse(fs.readFileSync(path.join(dist, '..', 'package.json'), 'utf8'));
    if (pkg.name !== 'tailwind-merge' || pkg.version !== VERSION_TAILWIND_MERGE) {
        throw new Error(`[cn-classes] tailwind-merge ${pkg.version} installé, ${VERSION_TAILWIND_MERGE} attendu : vérifier l'algorithme de components/ui/cn.ts, puis cette constante.`);
    }
    const fichier = path.join(dist, 'bundle-mjs.mjs');
    const source = fs.readFileSync(fichier, 'utf8');
    const exporte = /export \{[^}]*\};?\s*$/m;
    if (!exporte.test(source) || /^import /m.test(source)) throw new Error(`[cn-classes] ${fichier} : forme inattendue du module.`);
    // eslint-disable-next-line no-new-func
    interne = new Function(source.replace(exporte, 'return { createClassGroupUtils, createParseClassName, getDefaultConfig, mergeConfigs, extendTailwindMerge };'))();
    return interne;
}

/** Fichiers sources de l'univers (chemins absolus, ordre stable). */
function fichiersSources(root = process.cwd()) {
    const out = [];
    const walk = (d) => {
        for (const e of fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
            const p = path.join(d, e.name);
            if (e.isDirectory()) {
                if (e.name !== 'node_modules' && !e.name.startsWith('.')) walk(p);
            } else if (EXTENSIONS.test(e.name) && !EXCLUS.has(path.relative(root, p))) {
                out.push(p);
            }
        }
    };
    for (const d of DOSSIERS) if (fs.existsSync(path.join(root, d))) walk(path.join(root, d));
    return out;
}

/** Clé de la table : sans le « - » d'une valeur négative (tailwind-merge l'ignore aussi). */
const cle = (b) => (b[0] === '-' && b.length > 1 ? b.slice(1) : b);

/**
 * Données de la fusion : CLASSES (groupes séparés par « | », classes d'un groupe séparées par une espace ; numéro du groupe
 * = rang), CONFLITS et CONFLITS_SUFFIXE (numéros), plus le détail pour les tests.
 */
function genererTable(root = process.cwd()) {
    const tm = tailwindMerge(root);
    const config = tm.mergeConfigs(tm.getDefaultConfig(), EXTENSION);
    const { getClassGroupId } = tm.createClassGroupUtils(config);
    const parse = tm.createParseClassName(config);
    const mots = new Set();
    for (const f of fichiersSources(root)) {
        for (const m of fs.readFileSync(f, 'utf8').split(/[\s"'`{}]+/)) if (m && m.length < 200) mots.add(m);
    }
    const groupeDe = new Map();
    const ajouter = (x) => {
        if (!x) return;
        const k = cle(x);
        if (groupeDe.has(k)) return;
        const g = getClassGroupId(x);
        if (g && !g.startsWith('arbitrary..')) groupeDe.set(k, g);
    };
    for (const m of mots) {
        // Le mot tel quel, et avec « ! » : tailwind-merge compte la position du « / » avant de retirer le « ! » (décalage
        // d'un caractère, reproduit par cn.ts) ; les deux formes sont dans la table
        for (const forme of m[0] === '!' ? [m] : [m, `!${m}`]) {
            const { baseClassName: b, maybePostfixModifierPosition: p } = parse(forme);
            ajouter(b);
            if (p) ajouter(b.substring(0, p));
        }
    }
    const parGroupe = new Map();
    for (const [k, g] of groupeDe) {
        if (!parGroupe.has(g)) parGroupe.set(g, []);
        parGroupe.get(g).push(k);
    }
    const groupes = [...parGroupe.keys()].sort();
    const rang = new Map(groupes.map((g, i) => [g, i]));
    const numeros = (liste) => (liste || []).filter((x) => rang.has(x)).map((x) => rang.get(x));
    const CONFLITS = {};
    const CONFLITS_SUFFIXE = {};
    for (const g of groupes) {
        const c = numeros(config.conflictingClassGroups[g]);
        if (c.length) CONFLITS[rang.get(g)] = c;
        const s = numeros(config.conflictingClassGroupModifiers[g]);
        if (s.length) CONFLITS_SUFFIXE[rang.get(g)] = s;
    }
    const CLASSES = groupes.map((g) => parGroupe.get(g).sort().join(' ')).join('|');
    return { CLASSES, CONFLITS, CONFLITS_SUFFIXE, groupes, groupeDe };
}

/** Source du module components/ui/cn-classes.ts calculé au build. */
function sourceModule(root = process.cwd()) {
    const { CLASSES, CONFLITS, CONFLITS_SUFFIXE } = genererTable(root);
    return [
        '// Calculé au build par scripts/cn-classes-loader.cjs (scripts/cn-classes.cjs) : ne pas modifier.',
        'export const CALCULEE: boolean = true;',
        `export const CLASSES = ${JSON.stringify(CLASSES)};`,
        `export const CONFLITS: Record<number, number[]> = ${JSON.stringify(CONFLITS)};`,
        `export const CONFLITS_SUFFIXE: Record<number, number[]> = ${JSON.stringify(CONFLITS_SUFFIXE)};`,
        '',
    ].join('\n');
}

module.exports = { DOSSIERS, VERSION_TAILWIND_MERGE, EXTENSION, tailwindMerge, fichiersSources, cle, genererTable, sourceModule };

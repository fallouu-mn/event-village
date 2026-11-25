/**
 * Lot poids — table des classes Tailwind du projet pour la fusion de components/ui/cn.ts.
 *
 * Dans toute construction webpack (navigateur, serveur, développement), scripts/cn-classes-loader.cjs REMPLACE ce fichier
 * par la table calculée à partir des sources (scripts/cn-classes.cjs) : le code ci-dessous n'est alors jamais servi.
 * Hors webpack (tests sous Node, scripts), il calcule la même table au chargement, avec le même générateur : cn fusionne
 * partout de la même façon (run complet 641 : design1e-orange appelle cn sous Node).
 */
type Table = { CLASSES: string; CONFLITS: Record<number, number[]>; CONFLITS_SUFFIXE: Record<number, number[]> };

function tableHorsConstruction(): Table {
    const getBuiltinModule = (process as unknown as { getBuiltinModule?: (id: string) => unknown }).getBuiltinModule;
    if (typeof getBuiltinModule !== 'function') {
        throw new Error('[cn-classes] hors construction webpack, Node 22.3 ou plus est requis (process.getBuiltinModule) pour calculer la table des classes.');
    }
    const { createRequire } = getBuiltinModule('node:module') as { createRequire: (from: string) => (id: string) => unknown };
    const { join } = getBuiltinModule('node:path') as { join: (...p: string[]) => string };
    const racine = process.cwd();
    const generateur = createRequire(join(racine, 'package.json'))(join(racine, 'scripts', 'cn-classes.cjs')) as {
        genererTable: (root: string) => Table;
    };
    const { CLASSES, CONFLITS, CONFLITS_SUFFIXE } = generateur.genererTable(racine);
    return { CLASSES, CONFLITS, CONFLITS_SUFFIXE };
}

const table = tableHorsConstruction();

/** Faux : table calculée hors construction (le chargeur pose vrai) ; information seulement. */
export const CALCULEE: boolean = false;
export const CLASSES = table.CLASSES;
export const CONFLITS: Record<number, number[]> = table.CONFLITS;
export const CONFLITS_SUFFIXE: Record<number, number[]> = table.CONFLITS_SUFFIXE;

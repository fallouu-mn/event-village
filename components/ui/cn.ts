import { clsx, type ClassValue } from 'clsx';
import { CALCULEE, CLASSES, CONFLITS, CONFLITS_SUFFIXE } from './cn-classes';

/**
 * Fusion de classes Tailwind (clsx, puis la dernière classe d'un groupe l'emporte) qui connaît les utilitaires du système de
 * design : `text-caption` est une taille de texte (et non une couleur), pour qu'elle ne remplace pas `text-foreground-strong`.
 *
 * Lot poids : même résultat qu'avant (tailwind-merge 2.6.1, extendTailwindMerge avec text-caption dans font-size) pour toute
 * classe écrite dans le code, sans la configuration complète de tailwind-merge dans chaque page. L'algorithme ci-dessous est
 * celui de tailwind-merge (mergeClassList, parseClassName, sortModifiers), pas à pas ; le groupe de chaque classe et les
 * groupes en conflit viennent de la table calculée au build (components/ui/cn-classes.ts, scripts/cn-classes.mjs). Une
 * classe absente des sources n'a pas de CSS : elle est gardée telle quelle. Équivalence vérifiée par
 * tests/schema/poids-cn.test.ts (toutes les paires de classes du code, et des suites tirées au hasard avec modificateurs,
 * « ! », valeurs négatives et suffixes).
 */

let groupes: Map<string, number> | null = null;

/** Groupe d'une classe sans modificateur : numéro de la table, « arbitrary..<propriété> » pour [propriété:valeur]. */
function groupe(base: string): number | string | undefined {
    if (!groupes) {
        if (!CALCULEE && process.env.NODE_ENV === 'production') {
            throw new Error('[cn] table des classes absente : components/ui/cn-classes.ts doit être calculé au build (scripts/cn-classes-loader.cjs, next.config.mjs).');
        }
        const table = new Map<string, number>();
        CLASSES.split('|').forEach((ligne, i) => ligne.split(' ').forEach((c) => { if (c) table.set(c, i); }));
        groupes = table;
    }
    const g = groupes.get(base[0] === '-' && base.length > 1 ? base.slice(1) : base);
    if (g !== undefined) return g;
    const arbitraire = /^\[(.+)\]$/.exec(base);
    const propriete = arbitraire ? arbitraire[1].substring(0, arbitraire[1].indexOf(':')) : '';
    return propriete ? `arbitrary..${propriete}` : undefined;
}

/** Modificateurs triés (ordre alphabétique, sauf autour d'une variante arbitraire « [...] », gardée à sa place). */
function trierModificateurs(modificateurs: string[]): string[] {
    if (modificateurs.length <= 1) return modificateurs;
    const tries: string[] = [];
    let enCours: string[] = [];
    for (const m of modificateurs) {
        if (m[0] === '[') {
            tries.push(...enCours.sort(), m);
            enCours = [];
        } else {
            enCours.push(m);
        }
    }
    tries.push(...enCours.sort());
    return tries;
}

/** Découpe « md:hover:!px-2/50 » : modificateurs, « ! », classe de base, position du suffixe « / » (comme tailwind-merge). */
function decouper(classe: string): [string[], boolean, string, number | undefined] {
    const modificateurs: string[] = [];
    let profondeur = 0;
    let debut = 0;
    let suffixe: number | undefined;
    for (let i = 0; i < classe.length; i++) {
        const c = classe[i];
        if (profondeur === 0) {
            if (c === ':') {
                modificateurs.push(classe.slice(debut, i));
                debut = i + 1;
                continue;
            }
            if (c === '/') {
                suffixe = i;
                continue;
            }
        }
        if (c === '[') profondeur++;
        else if (c === ']') profondeur--;
    }
    const avecImportant = modificateurs.length === 0 ? classe : classe.substring(debut);
    const important = avecImportant.startsWith('!');
    return [
        modificateurs,
        important,
        important ? avecImportant.substring(1) : avecImportant,
        suffixe && suffixe > debut ? suffixe - debut : undefined,
    ];
}

const memoire = new Map<string, string>();

function fusionner(liste: string): string {
    const connu = memoire.get(liste);
    if (connu !== undefined) return connu;
    // Identifiant d'une classe : modificateurs triés, « ! », séparateur, groupe (aucune confusion possible entre les deux)
    const vus: string[] = [];
    let resultat = '';
    const classes = liste.trim().split(/\s+/);
    for (let i = classes.length - 1; i >= 0; i -= 1) {
        const originale = classes[i];
        const [modificateurs, important, base, positionSuffixe] = decouper(originale);
        let avecSuffixe = Boolean(positionSuffixe);
        let g = groupe(avecSuffixe ? base.substring(0, positionSuffixe) : base);
        if (g === undefined) {
            if (!avecSuffixe) {
                resultat = originale + (resultat.length > 0 ? ` ${resultat}` : resultat);
                continue;
            }
            g = groupe(base);
            if (g === undefined) {
                resultat = originale + (resultat.length > 0 ? ` ${resultat}` : resultat);
                continue;
            }
            avecSuffixe = false;
        }
        const prefixe = `${trierModificateurs(modificateurs).join(':')}${important ? '!' : ''}#`;
        if (vus.includes(prefixe + g)) continue;
        vus.push(prefixe + g);
        if (typeof g === 'number') {
            for (const x of CONFLITS[g] ?? []) vus.push(prefixe + x);
            if (avecSuffixe) for (const x of CONFLITS_SUFFIXE[g] ?? []) vus.push(prefixe + x);
        }
        resultat = originale + (resultat.length > 0 ? ` ${resultat}` : resultat);
    }
    if (memoire.size >= 500) memoire.clear();
    memoire.set(liste, resultat);
    return resultat;
}

export function cn(...inputs: ClassValue[]): string {
    return fusionner(clsx(inputs));
}

/**
 * Lot 9 bis, tâche 45 (ex-10.0 e ; contrat 5.45, B94) — forme pliée d'un texte, pour comparer sans tenir compte des
 * accents, de la casse ni des espaces : « Thiès », « THIES » et « thies » donnent la même clé. Sert en mémoire à la
 * recherche et aux villes du catalogue ; aucune donnée n'est réécrite (la forme saisie reste en base et à l'écran).
 */

const COMBINING_MARKS = /[̀-ͯ]/g;

export function foldText(value: string): string {
    return value
        .normalize('NFD')
        .replace(COMBINING_MARKS, '')
        .replace(/œ/g, 'oe')
        .replace(/Œ/g, 'OE')
        .replace(/æ/g, 'ae')
        .replace(/Æ/g, 'AE')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();
}

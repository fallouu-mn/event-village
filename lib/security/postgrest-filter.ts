/**
 * Lot 1C.1 — valeurs sûres dans les filtres PostgREST construits en texte.
 *
 * postgrest-js insère tel quel le texte passé à .or() / .filter() : une virgule, une parenthèse
 * ou un guillemet venant de l'utilisateur y ajoute des conditions. Toute valeur externe
 * interpolée dans un tel filtre passe par une fonction de ce module (préfixe « pg », contrôlé
 * par tests/parcours/filtres-postgrest.test.ts). Préférer .eq() / .in() / .ilike() séparés
 * quand c'est possible.
 */

const MAX_SEARCH_LENGTH = 100;

/** Valeur entre guillemets doubles (syntaxe PostgREST) : réservés neutralisés, \ et " échappés. */
export function pgQuoted(value: string): string {
    return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

/** Échappe les jokers LIKE (% _ \) et retire « * » (que PostgREST traduit en %). */
export function pgEscapeLike(value: string): string {
    return value.replace(/\*/g, '').replace(/[\\%_]/g, (c) => `\\${c}`);
}

/**
 * Motif ILIKE « contient » sûr pour un .or() : terme borné, caractères de contrôle retirés,
 * jokers échappés, valeur entre guillemets.
 */
export function pgIlikeContains(term: string): string {
    const cleaned = term.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, MAX_SEARCH_LENGTH);
    return pgQuoted(`%${pgEscapeLike(cleaned)}%`);
}

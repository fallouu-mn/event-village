/**
 * Design 1d (point 9) — repères de la recherche instantanée, sans dépendance : l'en-tête les lit sans charger le lanceur
 * (chargé après l'affichage, hors du JavaScript du premier chargement de chaque page).
 */

/** Attribut des déclencheurs de la recherche instantanée (lien de l'en-tête, du menu, champ de l'accueil). */
export const SEARCH_LAUNCH_ATTR = 'data-ev-search';

/** Signal envoyé à l'ouverture (le menu du téléphone se ferme). */
export const SEARCH_OPEN_EVENT = 'ev:search-open';

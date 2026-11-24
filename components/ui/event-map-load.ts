/**
 * Lot poids (piste 4) — chargement unique du module de la carte d'un lieu (components/ui/EventMap.tsx).
 *
 * Chaque `import()` écrit à un endroit différent crée, pour webpack, un groupe de morceaux à part ; quand les modules déjà
 * présents diffèrent d'un endroit à l'autre, le même module donne plusieurs VARIANTES de son morceau, et chacune ajoute une
 * entrée à la table des morceaux que TOUTES les pages chargent (webpack.js, ~18 octets gzip par entrée ; enquête du lot
 * Carte B). Sur `main`, la carte de la fiche existait en deux variantes. Tous les usages (fiche, pilotage, pages
 * d'administration) passent par cette fonction : un seul `import()`, un seul morceau.
 */
export const loadEventMap = () => import('./EventMap');

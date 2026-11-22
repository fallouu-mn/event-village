/**
 * Lot Carte B — module unique chargé à la demande pour la carte et le calendrier d'Explorer (chargé par Explorer
 * seulement).
 *
 * Un seul morceau de code pour les deux : chaque morceau chargeable ajoute une entrée à la table que toutes les pages
 * chargent ; les budgets JS des routes sont tenus sans relèvement. Leaflet et sa feuille de style ne sont pas dans ce
 * module : la carte les prend dans le module de la carte de la fiche (components/ui/EventMap.tsx, déjà chargeable), à
 * l'ouverture seulement ; le calendrier n'en charge rien. L'aperçu de l'accueil est servi par ce même module de la fiche.
 */
export { default as ExploreMap } from './ExploreMap';
export { default as ExploreCalendar } from './ExploreCalendar';

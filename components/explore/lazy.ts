/**
 * Lot Carte B — module unique chargé à la demande pour la carte et le calendrier d'Explorer et l'aperçu de l'accueil.
 *
 * Un seul morceau de code pour les trois (au lieu de trois) : chaque morceau chargeable ajoute une entrée à la table que
 * toutes les pages chargent ; les budgets JS des routes sont tenus sans relèvement. Leaflet et sa feuille de style ne sont
 * pas dans ce module : la carte et l'aperçu les prennent dans le module de la carte de la fiche (components/ui/EventMap.tsx,
 * déjà chargeable), à l'ouverture seulement ; le calendrier n'en charge rien.
 */
export { default as ExploreMap } from './ExploreMap';
export { default as ExploreCalendar } from './ExploreCalendar';
export { default as SenegalMapPreview } from './SenegalMapPreview';

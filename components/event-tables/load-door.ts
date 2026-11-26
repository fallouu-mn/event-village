/**
 * Lot 11c-c — chargeur unique de la liste de la porte (components/event-tables/DoorList.tsx), pour les deux pages de la
 * porte (organisatrice, contrôleur). Un seul import() : la page elle-même ne porte presque rien, et la liste ne se mêle pas
 * aux morceaux du scanner (budgété), qui partage l'espace du contrôleur avec la page de la porte.
 */
export const loadDoorList = () => import('./DoorList');

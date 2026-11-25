/**
 * Lot 11c-c — chargeur unique des écrans des tables d'un événement (éditeur, plan, pilotage). Tous les usages passent
 * par cette fonction : un seul import(), un seul morceau, chargé à l'ouverture de l'onglet « Tables ».
 */
export const loadEventTables = () => import('./EventTablesScreens');

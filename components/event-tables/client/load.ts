/**
 * Lot 11c-b — chargeurs uniques des écrans du client pour les tables d'un événement. Rien de ces écrans n'est dans le
 * premier chargement de la fiche ni de Mes billets : chaque module n'a qu'UN import(), ici, appelé à la demande (leçon du
 * lot poids : chaque import() ajoute une entrée au registre des morceaux chargé par toutes les routes).
 *  - loadTablesOffer : onglet « Tables » de la fiche (types, choix, devis, achat, attente, confirmation) ; le plan de salle
 *    passe par le chargeur du plan (components/tables/plan/load.ts), seulement si l'événement montre un plan ;
 *  - loadMyTables : onglet « Tables » de Mes billets (« Ma table » : places, invités, envoi, remboursement au report).
 */
export const loadTablesOffer = () => import('./TablesOffer');
export const loadMyTables = () => import('./MyTables');

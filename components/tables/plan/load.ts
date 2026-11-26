/**
 * Lot 11c-b — chargeur unique du plan de salle (FloorPlan). Leçon du lot poids : chaque import() d'un module ajoute une
 * entrée au registre des morceaux chargé par TOUTES les routes ; le choix d'une table d'un restaurant (lot 11b,
 * BookingPanel) et le choix d'une table d'un événement (lot 11c-b) passent tous les deux par cette fonction.
 */
export const loadFloorPlan = () => import('./FloorPlan');

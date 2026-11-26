/** Onglets de Mes billets, lus par la page serveur (onglet demandé) et par la vue (navigateur). */
// Lot 11c-b : « tables » (« Ma table » du titulaire d'une table d'événement, montré seulement s'il en a une)
export const TABS = ['a-venir', 'tous', 'historique', 'recus', 'tables'] as const;
export type TabKey = typeof TABS[number];

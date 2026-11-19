/** Onglets de Mes billets, lus par la page serveur (onglet demandé) et par la vue (navigateur). */
export const TABS = ['a-venir', 'tous', 'historique', 'recus'] as const;
export type TabKey = typeof TABS[number];

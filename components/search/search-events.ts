/**
 * Design 1d (point 9) — repères de la recherche instantanée, sans dépendance : l'en-tête les lit sans charger le lanceur
 * (chargé après l'affichage, hors du JavaScript du premier chargement de chaque page).
 */

/** Attribut des déclencheurs de la recherche instantanée (lien de l'en-tête, du menu, champ de l'accueil). */
export const SEARCH_LAUNCH_ATTR = 'data-ev-search';

/** Signal envoyé à l'ouverture (le menu du téléphone se ferme). */
export const SEARCH_OPEN_EVENT = 'ev:search-open';

/**
 * Run 489 (temps de blocage de Mes billets) : le lanceur n'est chargé qu'au premier geste sur un déclencheur ; ce geste
 * est gardé ici (variable du module, rien dans le stockage) et rejoué par le lanceur à son arrivée.
 */
let pending: HTMLElement | null = null;

export function setPendingSearch(target: HTMLElement): void {
  pending = target;
}

export function takePendingSearch(): HTMLElement | null {
  const target = pending;
  pending = null;
  return target && target.isConnected ? target : null;
}

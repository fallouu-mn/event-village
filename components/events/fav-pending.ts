/**
 * Design 1d (run 485, temps de blocage de la fiche) — cœur touché AVANT l'arrivée de l'îlot des favoris : le lanceur
 * (CardFavoritesLazy) garde le bouton ici, l'îlot (CardFavorites) le reprend à son montage comme un toucher normal.
 * Variable du module : rien n'est écrit dans le stockage.
 */
/** Attribut posé sur chaque cœur (valeur : identifiant de l'événement). */
export const FAV_ATTR = 'data-ev-fav';

let pending: HTMLElement | null = null;

export function setPendingFavorite(button: HTMLElement): void {
  pending = button;
}

/** Bouton touché en attente (une seule fois), s'il est encore dans la page. */
export function takePendingFavorite(): HTMLElement | null {
  const button = pending;
  pending = null;
  return button && button.isConnected ? button : null;
}

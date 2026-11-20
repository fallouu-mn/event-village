'use client';

import dynamic from 'next/dynamic';

/**
 * Design 1d (run 481 : budget JavaScript de la fiche dépassé de 728 octets) — l'îlot des cœurs ne rend rien : il est
 * chargé après l'affichage, hors du JavaScript du premier chargement de chaque page (accueil, Explorer, fiche, favoris).
 * Un toucher sur un cœur avant son arrivée ne fait rien (bouton seul) ; il arrive en quelques centaines de millisecondes.
 */
const CardFavoritesIsland = dynamic(() => import('./CardFavorites').then((m) => ({ default: m.CardFavorites })), { ssr: false });

export function CardFavoritesLazy() {
  return <CardFavoritesIsland />;
}

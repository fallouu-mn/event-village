import React from 'react';
import { Heart } from 'lucide-react';
import { cn } from '@/components/ui/cn';

import { FAV_ATTR } from './fav-pending';

export { FAV_ATTR };

/**
 * Design 1d (point 8) — cœur des favoris, rendu par le SERVEUR (aucun îlot par carte : budget de l'accueil, run 376) :
 * un bouton `aria-pressed` que l'îlot unique de la page (CardFavorites) met à jour, et dont il reçoit les touchers
 * (délégation). Nom accessible fixe, l'état est dit par aria-pressed. Cible de 44 px.
 */
export function FavoriteHeart({ id, title, className }: { id: string; title: string; className?: string }) {
  return (
    <button
      type="button"
      {...{ [FAV_ATTR]: id }}
      aria-pressed="false"
      aria-label={`Mettre en favori : ${title}`}
      className={cn(
        'ev-fav relative z-10 inline-flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        className,
      )}
    >
      <Heart size={20} strokeWidth={2.25} aria-hidden="true" />
    </button>
  );
}

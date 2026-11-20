'use client';

import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { useAuth } from '@/components/providers/AuthProvider';
import { FAV_ATTR, setPendingFavorite } from './fav-pending';

/**
 * Design 1d (runs 481 et 485 : budget JavaScript et temps de blocage de la fiche) — l'îlot des cœurs n'est chargé que
 * quand il sert : compte connecté (ses cœurs sont à remplir), ou premier toucher d'un cœur. Un visiteur qui ne touche
 * aucun cœur ne charge rien. Le toucher qui déclenche le chargement n'est pas perdu : il est gardé (fav-pending) et
 * l'îlot le rejoue à son arrivée (visiteur : connexion ; compte : favori enregistré).
 */
const CardFavoritesIsland = dynamic(() => import('./CardFavorites').then((m) => ({ default: m.CardFavorites })), { ssr: false });

export function CardFavoritesLazy() {
  const { user, isLoading } = useAuth();
  const [wanted, setWanted] = useState(false);

  useEffect(() => {
    if (!isLoading && user) setWanted(true);
  }, [user, isLoading]);

  useEffect(() => {
    if (wanted) return undefined;
    const onClick = (e: MouseEvent): void => {
      const button = (e.target as Element | null)?.closest?.<HTMLElement>(`[${FAV_ATTR}]`);
      if (!button) return;
      e.preventDefault();
      e.stopPropagation();
      setPendingFavorite(button);
      setWanted(true);
    };
    document.addEventListener('click', onClick, true);
    return () => document.removeEventListener('click', onClick, true);
  }, [wanted]);

  return wanted ? <CardFavoritesIsland /> : null;
}

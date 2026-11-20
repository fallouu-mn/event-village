'use client';

import dynamic from 'next/dynamic';

/**
 * Design 1d (run 481 : budget JavaScript de la fiche) — le compte à rebours ne montre rien au premier rendu (heure du
 * téléphone appliquée après le chargement) : il est chargé après l'affichage, hors du JavaScript du premier chargement.
 * Aucune différence à l'écran, aucun saut (il s'affiche dans la ligne déjà réservée du haut de la fiche).
 */
const EventCountdownIsland = dynamic(() => import('./Countdowns').then((m) => ({ default: m.EventCountdown })), { ssr: false });

export function EventCountdownLazy(props: { startsAt: string; endsAt: string; enabled?: boolean; className?: string }) {
  return <EventCountdownIsland {...props} />;
}

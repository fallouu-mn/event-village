'use client';

import React, { lazy, Suspense, useEffect, useState } from 'react';
import { warmWhenIdle } from '@/lib/ui/warm-when-idle';

/**
 * Design 1a — la barre de progression (NavigationProgress) est chargée quand le navigateur est libre, jamais avec la page :
 * elle n'alourdit aucune route. Avant son chargement (les premières secondes), un changement de page se fait sans barre.
 */
// Morceau introuvable (hors ligne : il n'est pas dans le cache du service worker) : pas de barre, jamais d'erreur.
const Bar = lazy(() => import('./NavigationProgress')
  .then((m): { default: React.ComponentType } => ({ default: m.NavigationProgress }))
  .catch((): { default: React.ComponentType } => ({ default: () => null })));

export function NavigationProgressDifferee() {
  const [ready, setReady] = useState(false);
  // Sans réseau (page hors ligne servie par le service worker) : rien à charger, la barre attendra le réseau. Design 1b :
  // jamais pendant le chargement du premier écran d'une page (scanner : lib/ui/warm-when-idle.ts).
  useEffect(() => warmWhenIdle(() => setReady(true), 2000), []);
  return ready ? <Suspense fallback={null}><Bar /></Suspense> : null;
}

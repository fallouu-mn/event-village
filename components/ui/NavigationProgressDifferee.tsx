'use client';

import React, { lazy, Suspense, useEffect, useState } from 'react';

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
  useEffect(() => {
    // Sans réseau (page hors ligne servie par le service worker) : rien à charger, la barre attendra le réseau
    if (navigator.onLine === false) return undefined;
    const w = window as Window & { requestIdleCallback?: (cb: () => void) => number };
    if (w.requestIdleCallback) w.requestIdleCallback(() => setReady(true));
    else setTimeout(() => setReady(true), 2000);
  }, []);
  return ready ? <Suspense fallback={null}><Bar /></Suspense> : null;
}

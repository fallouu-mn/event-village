'use client';

import { lazy, Suspense, useEffect, useState } from 'react';

/**
 * Design 1a — la barre de progression (NavigationProgress) est chargée quand le navigateur est libre, jamais avec la page :
 * elle n'alourdit aucune route. Avant son chargement (les premières secondes), un changement de page se fait sans barre.
 */
const Bar = lazy(() => import('./NavigationProgress').then((m) => ({ default: m.NavigationProgress })));

export function NavigationProgressDifferee() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const w = window as Window & { requestIdleCallback?: (cb: () => void) => number };
    if (w.requestIdleCallback) w.requestIdleCallback(() => setReady(true));
    else setTimeout(() => setReady(true), 2000);
  }, []);
  return ready ? <Suspense fallback={null}><Bar /></Suspense> : null;
}

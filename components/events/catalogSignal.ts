'use client';

import { useSyncExternalStore } from 'react';

/**
 * Design 1b (point 1) — signal temps réel du catalogue partagé entre les îlots client de l'accueil. L'accueil est
 * préparé par le serveur ; un seul îlot s'abonne au résumé public (HomeLive, public_event_state) et prévient les autres
 * (« Près de chez vous ») par ce compteur, sans second abonnement. Rien de personnel ne passe ici.
 */
let tick = 0;
const listeners = new Set<() => void>();

export function emitCatalogSignal(): void {
  tick += 1;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Nombre de signaux reçus depuis le chargement de la page (0 au rendu serveur). */
export function useCatalogSignal(): number {
  return useSyncExternalStore(subscribe, () => tick, () => 0);
}

'use client';

import { useSyncExternalStore } from 'react';

/**
 * Design 1e (point 2) — nombre de notifications non lues, partagé entre la cloche de l'en-tête (seule à le lire auprès du
 * serveur : GET /api/notifications, temps réel) et le point de l'onglet « Notifications » de la barre du bas. Aucun appel
 * réseau de plus : la cloche publie, la barre lit. 0 côté serveur et tant que la cloche n'a rien lu.
 */
let unread = 0;
const listeners = new Set<() => void>();

export function setUnreadCount(next: number): void {
  const value = Number.isFinite(next) && next > 0 ? Math.floor(next) : 0;
  if (value === unread) return;
  unread = value;
  for (const l of listeners) l();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function useUnreadCount(): number {
  return useSyncExternalStore(subscribe, () => unread, () => 0);
}

'use client';

/**
 * Lot 6 (contrat F5) — enregistrement du service worker (public/sw.js, push et clics seulement).
 * Enregistré tout de suite si la page est déjà chargée (l'événement `load` est alors passé et ne viendra
 * plus), sinon au `load` (une seule fois). Un échec est signalé par console.warn ; rien n'est demandé à
 * l'utilisateur ici : l'autorisation des notifications passe par lib/push/client.ts, au clic.
 */
import { useEffect } from 'react';

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
    const register = () => {
      navigator.serviceWorker.register('/sw.js').catch((error: unknown) => {
        console.warn('[PWA] Enregistrement du service worker impossible :', error instanceof Error ? error.message : String(error));
      });
    };
    if (document.readyState === 'complete') {
      register();
      return;
    }
    window.addEventListener('load', register, { once: true });
    return () => window.removeEventListener('load', register);
  }, []);

  return null;
}

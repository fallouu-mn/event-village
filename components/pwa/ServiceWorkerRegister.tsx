'use client';

import { useEffect } from 'react';

export function ServiceWorkerRegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
      window.addEventListener('load', () => {
        navigator.serviceWorker
          .register('/sw.js')
          .then((registration) => {
            console.log('[PWA] ServiceWorker enregistré avec succès:', registration.scope);
          })
          .catch((error) => {
            console.warn('[PWA] Erreur enregistrement ServiceWorker:', error);
          });
      });
    }
  }, []);

  return null;
}

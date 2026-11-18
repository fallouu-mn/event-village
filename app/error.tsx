'use client';

import { useEffect, useState } from 'react';
import { ErrorContent, OfflineContent } from '@/components/ui/SpecialPage';

/**
 * Design 1a (point 6) : page d'erreur d'une section. Sans réseau (navigator.onLine faux), c'est la page hors ligne qui
 * s'affiche (« Vous n'avez pas de réseau. Vos billets restent disponibles. », « Mes billets ») : une navigation dans
 * l'application a échoué faute de réseau, et le service worker n'intercepte que / et /tickets (contrat 5.3).
 * SÉCURITÉ : ni le message, ni la pile, ni l'empreinte de l'erreur ne s'affichent ; l'empreinte reste dans la console.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    console.error('[AppError]', error.digest ? `empreinte ${error.digest}` : 'sans empreinte');
    setOffline(typeof navigator !== 'undefined' && navigator.onLine === false);
  }, [error]);

  return offline ? <OfflineContent /> : <ErrorContent retry={() => reset()} />;
}

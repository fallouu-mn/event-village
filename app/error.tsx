'use client';

import { useEffect } from 'react';
import { AlertCircle, Home, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { LinkButton } from '@/components/ui/LinkButton';

/**
 * Erreur d'une section (lot 7, 7.3) : message générique en français, jamais le texte brut de l'erreur
 * (il peut contenir un détail technique ou une erreur de base). L'erreur complète part dans la console,
 * avec son identifiant `digest` côté serveur pour la retrouver dans les journaux. « Réessayer » relance le
 * rendu de la section (reset) ; l'accueil reste accessible.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[AppError]', error.digest ? `digest ${error.digest}` : '', error);
  }, [error]);

  return (
    <div role="alert" className="mx-auto flex min-h-[60vh] max-w-lg flex-col items-center justify-center gap-4 px-2 py-10 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-danger-bg text-danger-fg" aria-hidden="true">
        <AlertCircle size={32} />
      </span>
      <h1 className="text-2xl font-bold tracking-tight text-fg">Une erreur est survenue</h1>
      <p className="text-base leading-relaxed text-fg-muted">
        Cette section n’a pas pu s’afficher. Vérifiez votre connexion, puis réessayez. Si le problème persiste, revenez dans quelques minutes.
      </p>
      <div className="flex flex-wrap justify-center gap-3 pt-2">
        <Button variant="primary" onClick={() => reset()} leftIcon={<RotateCcw size={16} />}>
          Réessayer
        </Button>
        <LinkButton href="/" variant="secondary" leftIcon={<Home size={16} />}>
          Retour à l’accueil
        </LinkButton>
      </div>
    </div>
  );
}

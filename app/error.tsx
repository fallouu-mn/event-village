'use client';

import { useEffect } from 'react';
import { AlertCircle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[AppError]', error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center p-6 space-y-4">
      <div className="w-16 h-16 rounded-full bg-red-500/15 text-red-600 dark:text-red-400 flex items-center justify-center border border-red-500/30">
        <AlertCircle size={32} />
      </div>
      <h2 className="text-xl font-black text-slate-900 dark:text-white">Une erreur inattendue est survenue</h2>
      <p className="text-xs text-slate-500 dark:text-zinc-400 max-w-sm">
        {error.message || 'Impossible de charger cette section de l’application. Veuillez réessayer.'}
      </p>
      <Button variant="primary" size="md" onClick={() => reset()} leftIcon={<RotateCcw size={16} />}>
        Recharger la section
      </Button>
    </div>
  );
}

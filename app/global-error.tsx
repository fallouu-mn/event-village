'use client';

import { useEffect } from 'react';

/**
 * Dernier recours : remplace le layout racine, donc aucun composant de components/ui ni fournisseur. Le texte de
 * l'exception reste au journal (8.2 i) : en anglais ou technique, il n'apprend rien à la personne.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[global-error]', error.digest ?? 'sans empreinte', error);
  }, [error]);

  return (
    <html lang="fr">
      <body className="bg-[#F8F9FA] dark:bg-[#0F0F11] text-slate-900 dark:text-white min-h-screen flex items-center justify-center p-6 text-center">
        <div role="alert" className="space-y-4 max-w-md p-8 bg-white dark:bg-[#1D1D22] rounded-3xl border border-slate-200 dark:border-zinc-800 shadow-xl">
          <h2 className="text-2xl font-black text-slate-900 dark:text-white">Erreur critique</h2>
          <p className="text-sm text-slate-500 dark:text-zinc-400">Une interruption inattendue est survenue. Rechargez l&apos;application pour reprendre.</p>
          <button
            onClick={() => reset()}
            className="min-h-11 px-5 py-2.5 bg-gradient-to-r from-[#FF6A3D] to-[#FF3D68] hover:from-[#FF5722] hover:to-[#F02D58] text-white rounded-xl text-sm font-bold shadow-md shadow-[#FF5722]/30 active:scale-[0.98] transition-all"
          >
            Recharger l&apos;application
          </button>
        </div>
      </body>
    </html>
  );
}

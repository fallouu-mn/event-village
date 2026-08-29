'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="fr">
      <body className="bg-[#FAFAFA] dark:bg-[#111111] text-slate-900 dark:text-white min-h-screen flex items-center justify-center p-6 text-center">
        <div className="space-y-4 max-w-md p-8 bg-white dark:bg-[#1E1E1E] rounded-3xl border border-slate-200 dark:border-zinc-800 shadow-xl">
          <h2 className="text-2xl font-black text-slate-900 dark:text-white">Erreur critique</h2>
          <p className="text-xs text-slate-500 dark:text-zinc-400">{error.message || 'Une interruption inattendue est survenue.'}</p>
          <button
            onClick={() => reset()}
            className="px-5 py-2.5 bg-[#FF6B35] text-white rounded-xl text-xs font-black shadow-md hover:bg-[#EA580C] transition-all"
          >
            Recharger l&apos;application
          </button>
        </div>
      </body>
    </html>
  );
}

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
      <body className="bg-[#F8F9FA] dark:bg-[#0F0F11] text-slate-900 dark:text-white min-h-screen flex items-center justify-center p-6 text-center">
        <div className="space-y-4 max-w-md p-8 bg-white dark:bg-[#1D1D22] rounded-3xl border border-slate-200 dark:border-zinc-800 shadow-xl">
          <h2 className="text-2xl font-black text-slate-900 dark:text-white">Erreur critique</h2>
          <p className="text-xs text-slate-500 dark:text-zinc-400">{error.message || 'Une interruption inattendue est survenue.'}</p>
          <button
            onClick={() => reset()}
            className="px-5 py-2.5 bg-gradient-to-r from-[#FF6A3D] to-[#FF3D68] hover:from-[#FF5722] hover:to-[#F02D58] text-white rounded-xl text-xs font-bold shadow-md shadow-[#FF5722]/30 active:scale-[0.98] transition-all"
          >
            Recharger l&apos;application
          </button>
        </div>
      </body>
    </html>
  );
}

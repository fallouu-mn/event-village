'use client';

import { useEffect } from 'react';

/**
 * Dernier recours : remplace le layout racine, donc ni feuille de style globale, ni composant de components/ui, ni
 * fournisseur. Design 1a (point 6) : mêmes textes que la page d'erreur, couleurs de la charte écrites ici (clair, et
 * sombre selon le téléphone), bouton principal B en clair et A en sombre. SÉCURITÉ : le texte de l'exception reste au
 * journal (8.2 i), jamais à l'écran.
 */
const STYLE = `
body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px;text-align:center;
font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;background:#FFFFFF;color:#3A3A3A}
h1{margin:0 0 12px;font-size:24px;line-height:1.25;font-weight:800;color:#1A1A1A}
p{margin:0 0 24px;font-size:16px;line-height:1.5;color:#666666}
.actions{display:flex;flex-wrap:wrap;gap:12px;justify-content:center}
button,a{min-height:44px;display:inline-flex;align-items:center;padding:0 18px;border-radius:12px;font:inherit;font-size:14px;font-weight:600;cursor:pointer;text-decoration:none}
button{border:1px solid transparent;background:#F05A1A;color:#1A1A1A}
a{border:1px solid #E6E6E6;background:#FFFFFF;color:#1A1A1A}
:focus-visible{outline:2px solid transparent;box-shadow:0 0 0 2px #FFFFFF,0 0 0 4px #F05A1A,0 0 0 6px #1A1A1A}
@media (prefers-color-scheme:dark){body{background:#0A0A0A;color:#F2F2F2}h1{color:#FFFFFF}p{color:#A6A6A6}
button{background:#F05A1A;color:#1A1A1A}a{background:#1A1A1A;border-color:#333333;color:#FFFFFF}
:focus-visible{box-shadow:0 0 0 2px #0A0A0A,0 0 0 4px #F05A1A,0 0 0 6px #0A0A0A}}
`;

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[global-error]', error.digest ?? 'sans empreinte');
  }, [error]);

  return (
    <html lang="fr">
      <head>
        <style dangerouslySetInnerHTML={{ __html: STYLE }} />
      </head>
      <body>
        <main role="alert">
          <h1>Quelque chose s’est mal passé de notre côté.</h1>
          <p>Réessayez dans un instant. Si cela continue, revenez à l’accueil.</p>
          <div className="actions">
            <button type="button" onClick={() => reset()}>Réessayer</button>
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- gabarit racine en panne : rechargement complet voulu */}
            <a href="/">Accueil</a>
          </div>
        </main>
      </body>
    </html>
  );
}

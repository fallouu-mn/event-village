'use client';

// Lot poids : composant client (même balisage qu'avant). Composant serveur, son morceau du navigateur était VIDE, et webpack
// le fusionnait avec les ~400 autres morceaux vides de l'application (segments sans composant client) : le fichier chargé
// par chaque page portait tous leurs numéros (997 octets gzip au run 634). Avec un contenu propre, il ne porte que le sien.
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="ev-page-enter">{children}</div>;
}

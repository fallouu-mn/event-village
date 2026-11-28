/**
 * Garde-fou « jamais de code technique » (design 1b), sorti de Toast.tsx au lot « Avis », phase 2 (2h, M1, M9, M12) pour que
 * les petits modules (chargement des données, appels d'API, carte des notifications) l'utilisent sans charger les toasts.
 * Toast.tsx le réexporte : rien ne change pour ses appelants.
 */
export const GENERIC_ERROR = 'Quelque chose s’est mal passé. Réessayez dans un instant.';

/** Rend le message, ou une phrase simple s'il ressemble à un code ou à un message brut du navigateur. */
export function humanToastMessage(message: string): string {
  const m = message.trim();
  // Coupure réseau : message brut du navigateur (fetch) jamais affiché
  if (/^(?:Failed to fetch|Load failed|NetworkError\b|fetch failed)/i.test(m)) return 'Connexion impossible. Vérifiez votre réseau, puis réessayez.';
  if (/\b[A-Z][A-Z0-9]+_[A-Z0-9_]+\b|\bHTTP\s?\d{3}\b|\b(?:Type|Reference|Syntax)?Error:|\bat\s+\S+\s+\(|^[[{]|<\/?[a-z][^>]*>|\bundefined\b|\bnull\b/.test(m)) {
    return GENERIC_ERROR;
  }
  return m;
}

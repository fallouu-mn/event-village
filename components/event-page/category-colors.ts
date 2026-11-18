import type { ScanCategoryColor } from '@/lib/scan/scan-result';

/**
 * Design 1b (point 6) — couleur d'une catégorie sur sa carte de la fiche : la même qu'au contrôle (jetons --scan-cat-*,
 * inchangés en clair et en sombre), en liseré à gauche, jamais en aplat sous le texte. Classes écrites en entier pour
 * Tailwind. Le liseré porte un filet intérieur (ring) : le blanc reste visible sur une carte claire, le noir sur une carte
 * sombre. La couleur est un repère visuel en plus du nom, jamais la seule information.
 */
export const CATEGORY_STRIPE: Record<ScanCategoryColor, string> = {
  BLANC: 'bg-scan-cat-blanc-bg',
  OR: 'bg-scan-cat-or-bg',
  ARGENT: 'bg-scan-cat-argent-bg',
  ROSE: 'bg-scan-cat-rose-bg',
  TURQUOISE: 'bg-scan-cat-turquoise-bg',
  BLEU: 'bg-scan-cat-bleu-bg',
  VIOLET: 'bg-scan-cat-violet-bg',
  NOIR: 'bg-scan-cat-noir-bg',
};

/** Catégorie sans couleur (anciennes données) : liseré neutre. */
export const CATEGORY_STRIPE_NONE = 'bg-border';

/**
 * Lot 12c — écrans du catalogue de la partenaire : types des réponses (formes servies par lib/products/catalog.service.ts)
 * et petites aides de lecture. Aucun montant n'est calculé ici.
 */
import type { CatalogOption, CatalogProduct, CatalogReply, CatalogVenue, CatalogZone } from '@/lib/products/catalog.service';

export type { CatalogOption, CatalogProduct, CatalogReply, CatalogVenue, CatalogZone };

export type CatalogResponse = CatalogReply & { success: boolean };

/** Clé du filtre « Sans établissement » (produits de l'ancien code). */
export const NO_VENUE = 'sans-etablissement';

/** Portions restantes servies par la route (portions et vendues), jamais négatives. */
export function portionsLeft(p: { portions: number; sold: number } | null): number | null {
    if (!p) return null;
    return Math.max(p.portions - p.sold, 0);
}

/** Part vendue de la jauge, de 0 à 100 (affichage seulement). */
export function portionsGauge(p: { portions: number; sold: number } | null): number {
    if (!p || p.portions <= 0) return 0;
    return Math.min(100, Math.round((p.sold / p.portions) * 100));
}

/** Le produit peut-il être commandé en ligne d'après ce que la base dit ? (affichage seulement : la base décide). */
export function sellableOnline(p: CatalogProduct): boolean {
    return !p.underReview && !p.isRegulated && p.adminDecision !== true && p.status === 'DISPONIBLE';
}

/**
 * Design 1d (point 5) — règle de l'image d'aperçu de partage (WhatsApp et autres) : générée SEULEMENT pour un événement
 * publié (PUBLIE). Jamais pour un événement non public (brouillon, en attente, validé, terminé sans publication : il
 * n'existe pas d'autre notion d'événement « privé » dans le projet), ni suspendu, annulé ou terminé.
 * Module sans dépendance (page, route et tests).
 */

export const SHARE_PREVIEW_WIDTH = 1200;
export const SHARE_PREVIEW_HEIGHT = 630;

/** Seul statut qui a une image d'aperçu. */
export function hasSharePreview(status: string | null | undefined): boolean {
    return status === 'PUBLIE';
}

/** Version de l'image : change avec ce qu'elle montre (titre, date, prix, affiche, couleur), pour les caches. */
export function sharePreviewVersion(parts: ReadonlyArray<string | number | null | undefined>): string {
    let h = 2166136261;
    for (const ch of parts.map((p) => String(p ?? '')).join('|')) {
        h ^= ch.codePointAt(0) ?? 0;
        h = Math.imul(h, 16777619) >>> 0;
    }
    return h.toString(36);
}

/** Adresse de l'image d'aperçu d'un événement publié (relative : metadataBase la complète). */
export function sharePreviewPath(eventId: string, version: string): string {
    return `/api/events/${eventId}/apercu?v=${encodeURIComponent(version)}`;
}

/** Prix d'appel de l'aperçu : « Gratuit », « Gratuit ou dès 2 000 F CFA », « Dès 5 000 F CFA », null sans place. */
export function sharePriceLabel(prices: ReadonlyArray<number>): string | null {
    const valid = prices.filter((p) => Number.isFinite(p) && p >= 0);
    if (valid.length === 0) return null;
    const paid = valid.filter((p) => p > 0);
    const fmt = (n: number): string => `${n.toLocaleString('fr-FR').replace(/ | /g, ' ')} F CFA`;
    if (paid.length === 0) return 'Gratuit';
    const from = Math.min(...paid);
    return valid.some((p) => p === 0) ? `Gratuit ou dès ${fmt(from)}` : `Dès ${fmt(from)}`;
}

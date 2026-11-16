/**
 * Finition 2b (A, E-26) — prix minimum d'un billet payant (réglage finance.min_paid_price, 100 F CFA par défaut, réglable
 * par l'administration). Un seul texte de refus, quelle qu'en soit la source : la normalisation d'une catégorie
 * (ticket_category_normalize, chemin de la catégorie), le déclencheur trg_ticket_categories_min_price (dernier rempart),
 * ou l'écran avant d'envoyer (contrôle dès « Suivant »).
 */

/** Montant en francs CFA, séparateur des milliers français (« 1 000 »). */
function amount(min: number): string {
    return min.toLocaleString('fr-FR');
}

/** Texte du refus d'un prix payant sous le minimum. */
export function priceMinimumMessage(min: number): string {
    return `Le prix d’un billet payant est d’au moins ${amount(min)} F CFA. Pour un billet gratuit, indiquez 0.`;
}

/** Prix saisi (texte du champ) payant et sous le minimum ; vide, gratuit ou illisible : faux (le schéma en répond). */
export function isBelowMinimum(rawPrice: string | number | null | undefined, min: number | null): boolean {
    if (min === null || !Number.isFinite(min)) return false;
    const price = typeof rawPrice === 'number' ? rawPrice : Number(String(rawPrice ?? '').replace(/\s/g, '').replace(',', '.'));
    return Number.isFinite(price) && price > 0 && price < min;
}

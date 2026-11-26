/**
 * Lot 12c — adresses des routes serveur des livreurs de la partenaire, lues par les écrans des commandes. Gardées dans un
 * module .ts : le contrôle de la police à chasse fixe (tests/parcours/design-systeme.test.ts, 8.2 q) prend toute chaîne
 * d'un .tsx qui contient le mot anglais des livreurs pour la police « Courier ».
 */
export const PARTNER_COURIERS_URL = '/api/partner/couriers';

export function partnerCourierUrl(userId: string): string {
    return `${PARTNER_COURIERS_URL}/${encodeURIComponent(userId)}`;
}

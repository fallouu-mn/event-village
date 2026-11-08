/**
 * Lot 8, tâche 8.0 — libellés des canaux de vente d'une catégorie (contrat 4.1, AR8, L11).
 * Module pur, sans import : le formulaire partenaire, le guichet, le pilotage et l'administration affichent le
 * même libellé.
 */

/** Libellé d'une catégorie selon ses deux canaux. */
export function categoryChannelLabel(c: { sale_online: boolean; sale_counter: boolean }): string {
    if (c.sale_online) return c.sale_counter ? 'En ligne et au guichet' : 'En ligne uniquement';
    return c.sale_counter ? 'Sur place uniquement' : 'Invitations seulement';
}

/**
 * Aides du formulaire. `none` renvoie à l'onglet Invitations du pilotage (lot 9, AM6).
 */
export const CATEGORY_CHANNEL_HELP: Record<'online' | 'counter' | 'none', string> = {
    online: 'Affichée sur la page de l’événement et achetable sur le site.',
    counter: 'Proposée au contrôleur et vendue en espèces à l’entrée.',
    none: 'Cette catégorie n’est vendue ni en ligne ni au guichet. Distribuez ses billets depuis l’onglet Invitations du pilotage.',
};

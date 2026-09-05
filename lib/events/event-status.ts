/**
 * EVENT VILLAGE — RÈGLES MÉTIER STATUT ÉVÉNEMENT ↔ CONTRÔLEURS
 * Source de vérité unique pour l'éligibilité opérationnelle d'un événement.
 *
 * Cycle de vie d'un événement (enum PostgreSQL 'event_status') :
 * 1. BROUILLON   : En cours de rédaction par le partenaire. Privé. NON ÉLIGIBLE ❌
 * 2. EN_ATTENTE  : Soumis pour validation par la plateforme. NON ÉLIGIBLE ❌
 * 3. VALIDE      : Validé par l'administration, confirmé. ÉLIGIBLE ✅
 * 4. PUBLIE      : En ligne, billetterie active, exploitation ouverte. ÉLIGIBLE ✅
 * 5. SUSPENDU    : Suspendu par l'administration (litige, contrôle). NON ÉLIGIBLE ❌
 * 6. TERMINE     : Événement clôturé / passé. NON ÉLIGIBLE ❌
 */

export const ELIGIBLE_EVENT_STATUSES_FOR_CONTROLLER = ['VALIDE', 'PUBLIE'] as const;
export type EligibleControllerEventStatus = typeof ELIGIBLE_EVENT_STATUSES_FOR_CONTROLLER[number];

/**
 * Vérifie si un événement a un statut autorisant l'affectation opérationnelle d'un contrôleur.
 */
export function isEventEligibleForController(status?: string | null): boolean {
    if (!status) return false;
    return (ELIGIBLE_EVENT_STATUSES_FOR_CONTROLLER as readonly string[]).includes(status.toUpperCase());
}

/**
 * Message d'erreur standardisé pour le rejet d'une affectation non éligible.
 */
export const INELIGIBLE_EVENT_ASSIGNMENT_ERROR =
    "Ce contrôleur ne peut pas être affecté à cet événement car l'événement n'est pas encore confirmé.";

/**
 * Raison contextuelle détaillée pour l'affichage utilisateur ou le journal d'audit.
 */
export function getEventEligibilityRejectionReason(status?: string | null): string {
    if (!status) {
        return "L'événement est introuvable ou son statut n'est pas défini.";
    }
    switch (status.toUpperCase()) {
        case 'BROUILLON':
            return "L'événement est en statut Brouillon.";
        case 'EN_ATTENTE':
            return "L'événement est en attente de validation administrative.";
        case 'SUSPENDU':
            return "L'événement est actuellement suspendu par l'administration.";
        case 'TERMINE':
            return "L'événement est déjà terminé.";
        default:
            return `L'événement a un statut non opérationnel (${status}).`;
    }
}

/**
 * EVENT VILLAGE — RÈGLES MÉTIER STATUT ÉVÉNEMENT ↔ CONTRÔLEURS
 * Source de vérité unique pour l'éligibilité opérationnelle d'un événement.
 *
 * Cycle de vie d'un événement (enum PostgreSQL 'event_status') :
 * 1. BROUILLON   : En cours de rédaction par le partenaire. Privé. NON ÉLIGIBLE
 * 2. EN_ATTENTE  : Soumis pour validation par la plateforme. NON ÉLIGIBLE
 * 3. VALIDE      : Validé par l'administration, confirmé. ÉLIGIBLE
 * 4. PUBLIE      : En ligne, billetterie active, exploitation ouverte. ÉLIGIBLE
 * 5. SUSPENDU    : Suspendu par l'administration (litige, contrôle). NON ÉLIGIBLE
 * 6. TERMINE     : Événement clôturé / passé. NON ÉLIGIBLE
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
        case 'ANNULE':
            return "L'événement a été annulé.";
        case 'SUSPENDU':
            return "L'événement est actuellement suspendu par l'administration.";
        case 'TERMINE':
            return "L'événement est déjà terminé.";
        default:
            return `L'événement a un statut non opérationnel (${status}).`;
    }
}

// ── Lot 5 (contrat B) — libellés, tons et descriptions des statuts ─────────

/** Les 7 valeurs de l'enum PostgreSQL `event_status`. */
export const EVENT_STATUSES = ['BROUILLON', 'EN_ATTENTE', 'VALIDE', 'PUBLIE', 'SUSPENDU', 'TERMINE', 'ANNULE'] as const;
export type EventStatus = (typeof EVENT_STATUSES)[number];

/** Ton visuel d'un statut, traduit en tokens par StatusBadge (components/ui/StatusBadge.tsx). */
export type EventStatusTone = 'neutral' | 'warning' | 'info' | 'success' | 'warning-strong' | 'muted' | 'danger';

export interface EventStatusMeta {
    /** Libellé affiché (casse de phrase, accents). */
    label: string;
    tone: EventStatusTone;
    /** Phrase d'explication pour l'organisateur et l'administration (infobulle, aide, message vide). */
    description: string;
}

/**
 * Seule source des libellés de statut d'un événement : badges, onglets, filtres et messages
 * (miroir de la fonction SQL public.event_status_label, supabase/migrations/20261102000003_lot5_cycle.sql).
 */
export const EVENT_STATUS_META: Record<EventStatus, EventStatusMeta> = {
    BROUILLON: {
        label: 'Brouillon',
        tone: 'neutral',
        description: 'En cours de rédaction par l’organisateur, visible de lui seul.',
    },
    EN_ATTENTE: {
        label: 'En attente de validation',
        tone: 'warning',
        description: 'Soumis à l’équipe Event Village, qui vérifie la fiche avant validation.',
    },
    VALIDE: {
        label: 'Validé',
        tone: 'info',
        description: 'Accepté par l’équipe Event Village : l’organisateur peut maintenant le publier.',
    },
    PUBLIE: {
        label: 'Publié',
        tone: 'success',
        description: 'En ligne : la page publique est visible et la billetterie est ouverte.',
    },
    SUSPENDU: {
        label: 'Suspendu',
        tone: 'warning-strong',
        description: 'Mis en pause par l’équipe Event Village : la vente et le contrôle d’accès sont arrêtés.',
    },
    TERMINE: {
        label: 'Terminé',
        tone: 'muted',
        description: 'L’événement est passé : la vente est close, le bilan reste consultable.',
    },
    ANNULE: {
        label: 'Annulé',
        tone: 'danger',
        description: 'Annulé : les participants sont prévenus et les billets payés sont remboursés.',
    },
};

export function isEventStatus(value: unknown): value is EventStatus {
    return typeof value === 'string' && (EVENT_STATUSES as readonly string[]).includes(value);
}

/** Libellé d'un statut ; une valeur hors enum donne « Statut inconnu », jamais la valeur brute. */
export function eventStatusLabel(status: unknown): string {
    return isEventStatus(status) ? EVENT_STATUS_META[status].label : 'Statut inconnu';
}

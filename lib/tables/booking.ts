/**
 * Lot 11a — réservation de tables : textes et vues côté serveur. Tout l'argent est calculé en base (table_reserve,
 * table_payment_create) ; ce module ne fait que traduire pour les gens (aucun code, aucun statut en capitales à
 * l'écran ni dans une réponse lisible).
 */
import { fcfa } from '@/lib/halls/booking';

export { fcfa };

/** Libellé de chaque état d'une réservation de table (booking_state). */
export const TABLE_STATE_LABELS: Readonly<Record<string, string>> = {
    EN_ATTENTE_PAIEMENT: 'En attente de paiement',
    EN_ATTENTE_ACCEPTATION: 'En attente de réponse de l’établissement',
    CONFIRMEE: 'Confirmée',
    ARRIVEE: 'Client arrivé',
    ABSENT: 'Absent',
    EXPIREE: 'Non payée à temps',
    SANS_REPONSE: 'Sans réponse de l’établissement',
    REFUSEE: 'Refusée par l’établissement',
    ANNULEE_CLIENT: 'Annulée par le client',
    ANNULEE_ETABLISSEMENT: 'Annulée par l’établissement',
    ANNULEE_EV: 'Annulée par Event Village',
};

export function tableStateLabel(state: unknown): string {
    return typeof state === 'string' && TABLE_STATE_LABELS[state] ? TABLE_STATE_LABELS[state] : 'État inconnu';
}

/** Statut de validation d'un établissement. */
export const VENUE_VALIDATION_LABELS: Readonly<Record<string, string>> = {
    EN_ATTENTE_VALIDATION: 'En attente de validation',
    VALIDEE: 'Validé',
    REFUSEE: 'Refusé',
    SUSPENDUE: 'Suspendu',
};

/** Genre d'établissement. */
export const VENUE_KIND_LABELS: Readonly<Record<string, string>> = {
    RESTAURANT: 'Restaurant',
    BAR: 'Bar',
    ESPACE: 'Espace',
};

/** Heure d'une réservation (date et heure de Dakar, UTC toute l'année) ; null si illisible. */
export function tableStartsAt(date: unknown, time: unknown): Date | null {
    if (typeof date !== 'string' || typeof time !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}(:\d{2})?$/.test(time)) return null;
    const at = new Date(`${date}T${time.slice(0, 5)}:00Z`);
    return Number.isNaN(at.getTime()) ? null : at;
}

/**
 * Conditions d'annulation affichées avant le paiement (réglage tables.cancel_free_hours).
 * Contre-vérification de la 11a (T4) : avec l'heure de la réservation, à moins de N h de cette heure, le texte dit que
 * l'acompte payé ne sera pas remboursé (le remboursement n'est déjà plus possible) au lieu de le promettre.
 */
export function tableCancellationText(depositAmount: unknown, freeHours: unknown, startsAt: Date | null = null, now: Date = new Date()): string {
    if (!(Number(depositAmount) > 0)) return 'Réservation sans acompte : vous pouvez l’annuler jusqu’à l’heure prévue.';
    const hours = Number(freeHours);
    if (startsAt && startsAt.getTime() - now.getTime() < hours * 3_600_000) {
        return `Réservation à moins de ${hours} h de l’heure : si vous annulez, l’acompte payé ne sera pas remboursé.`;
    }
    return `Acompte remboursé si vous annulez au moins ${hours} h avant l’heure, rien ensuite.`;
}

/** Message rendu au client qui annule (montant remboursé ou non). */
export function clientCancelMessage(r: { refund_amount?: unknown; paid_amount?: unknown; cancel_free_hours?: unknown }): string {
    const refund = Number(r.refund_amount ?? 0);
    if (refund > 0) return `Réservation annulée. Vous êtes remboursé de ${fcfa(refund)} sur votre compte de paiement.`;
    if (Number(r.paid_amount ?? 0) > 0) {
        return `Réservation annulée. L’acompte n’est pas remboursé : l’annulation arrive moins de ${Number(r.cancel_free_hours ?? 2)} h avant l’heure.`;
    }
    return 'Réservation annulée.';
}

/** Statut HTTP d'un refus des fonctions de la base (le message, lui, est déjà en français simple). */
export function refusalStatus(code: unknown): number {
    switch (code) {
        case 'VENUE_NOT_FOUND':
        case 'RESERVATION_NOT_FOUND':
        case 'SERVICE_CLOSED':
            return 404;
        case 'ACCOUNT_NOT_ACTIVE':
        case 'FORBIDDEN':
            return 403;
        case 'TOO_MANY_PENDING':
        case 'PAYER_PENDING_LIMIT':
            return 429;
        case 'INVALID_DATE':
        case 'INVALID_TIME':
        case 'INVALID_GUESTS':
        case 'DATE_PASSED':
        case 'DATE_TOO_FAR':
        case 'OPERATOR_REQUIRED':
        case 'REASON_REQUIRED':
        case 'INVALID_ORIGIN':
        case 'INVALID_DECISION':
        case 'INVALID_ACTION':
        case 'INVALID_AMOUNT':
        case 'INVALID_METHOD':
        case 'INVALID_HOURS':
        case 'OVERLAPPING_HOURS':
            return 400;
        default:
            return 409;
    }
}

import { OPERATOR_LABELS } from '@/lib/samirpay/types';

/** Lot 9 (9.2, D-cpt 3) : libellés de Mes paiements, faits côté serveur. Une valeur inconnue n'est jamais affichée brute. */

const STATUS_LABELS: Readonly<Record<string, string>> = {
    SUCCESS: 'Confirmé',
    PENDING: 'En attente',
    FAILED: 'Échoué',
    CANCELLED: 'Annulé',
    EXPIRED: 'Expiré',
    REFUND_PENDING: 'Remboursement en cours',
    REFUNDED: 'Remboursé',
    PARTIAL: 'Remboursé en partie',
};

const TARGET_LABELS: Readonly<Record<string, string>> = {
    TICKET: 'Événement',
    SUBSCRIPTION: 'Abonnement',
    ORDER: 'Commande',
    HALL_RESERVATION: 'Réservation de salle',
    TABLE_RESERVATION: 'Réservation de table',
    OTHER: 'Autre paiement',
};

/** Lot 9 bis (B9, contrat 5.1) : état honnête d'un remboursement présent dans « Versements à reprendre ». */
export const REFUND_DELAYED_LABEL = 'Remboursement retardé, l’équipe Event Village s’en occupe.';

/**
 * Libellé du statut d'un paiement. Lot 9 bis (B9) : `refundDelayed` (versement du remboursement dans
 * cashouts_to_resume) remplace « Remboursement en cours » par REFUND_DELAYED_LABEL.
 */
export function paymentStatusLabel(status: string, opts: { refundDelayed?: boolean } = {}): string {
    if (opts.refundDelayed && status === 'REFUND_PENDING') return REFUND_DELAYED_LABEL;
    return STATUS_LABELS[status] ?? 'Statut inconnu';
}

export function paymentTargetLabel(target: string): string {
    return TARGET_LABELS[target] ?? 'Autre paiement';
}

export function paymentOperatorLabel(operator: string | null, isPlatformPayment: boolean): string {
    const known = operator ? (OPERATOR_LABELS as Readonly<Record<string, string>>)[operator] : undefined;
    return known ?? (isPlatformPayment ? 'Mobile Money' : '—');
}

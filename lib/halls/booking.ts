/**
 * Lot 10a — réservation de salles : textes et vues côté serveur. Tout l'argent est calculé en base (hall_quote,
 * hall_reserve, hall_payment_create) ; ce module ne fait que traduire pour les gens (aucun code, aucun statut en
 * capitales à l'écran ni dans une réponse lisible).
 */

/** Libellé de chaque état d'une réservation (booking_state). */
export const BOOKING_STATE_LABELS: Readonly<Record<string, string>> = {
    EN_ATTENTE_PAIEMENT: 'En attente de paiement',
    ACOMPTE_PAYE: 'Acompte payé',
    PAYEE: 'Payée',
    EXPIREE: 'Non payée à temps',
    DELAI_DEPASSE: 'Délai de paiement dépassé',
    ANNULEE_CLIENT: 'Annulée par le client',
    ANNULEE_SALLE: 'Annulée par la salle',
    ANNULEE_EV: 'Annulée par Event Village',
};

export function bookingStateLabel(state: unknown): string {
    return typeof state === 'string' && BOOKING_STATE_LABELS[state] ? BOOKING_STATE_LABELS[state] : 'État inconnu';
}

/** Statut de validation d'une salle. */
export const HALL_VALIDATION_LABELS: Readonly<Record<string, string>> = {
    EN_ATTENTE_VALIDATION: 'En attente de validation',
    VALIDEE: 'Validée',
    REFUSEE: 'Refusée',
    SUSPENDUE: 'Suspendue',
};

export interface CancellationTerms {
    policy: 'SOUPLE' | 'MODEREE' | 'STRICTE';
    partial_percent: number;
    full_days: number | null;
    partial_days: number | null;
}

const POLICY_NAMES: Readonly<Record<CancellationTerms['policy'], string>> = {
    SOUPLE: 'Souple',
    MODEREE: 'Modérée',
    STRICTE: 'Stricte',
};

const days = (n: number): string => `${n} jour${n > 1 ? 's' : ''}`;

/**
 * Conditions d'annulation en français simple, telles que figées sur la réservation (affichées avant le paiement).
 * « jusqu'à N jours avant » = au moins N × 24 heures avant le début.
 */
export function cancellationText(terms: CancellationTerms | null | undefined): string {
    if (!terms) return 'Conditions d’annulation non disponibles.';
    const name = POLICY_NAMES[terms.policy] ?? 'de la salle';
    const part = `${Number(terms.partial_percent)} %`;
    const full = terms.full_days === null || terms.full_days === undefined ? null : Number(terms.full_days);
    const partial = terms.partial_days === null || terms.partial_days === undefined ? null : Number(terms.partial_days);
    if (terms.policy === 'SOUPLE' && full !== null) {
        return `Règle ${name} : remboursement total si vous annulez au moins ${days(full)} avant la date, ${part} ensuite.`;
    }
    if (terms.policy === 'MODEREE' && full !== null && partial !== null) {
        return `Règle ${name} : remboursement total si vous annulez au moins ${days(full)} avant la date, ${part} jusqu’à ${days(partial)} avant, rien ensuite.`;
    }
    if (terms.policy === 'STRICTE' && partial !== null) {
        return `Règle ${name} : ${part} remboursés si vous annulez au moins ${days(partial)} avant la date, rien ensuite.`;
    }
    return `Règle ${name}.`;
}

/** Statut HTTP d'un refus des fonctions de la base (le message, lui, est déjà en français simple). */
export function refusalStatus(code: unknown): number {
    switch (code) {
        case 'HALL_NOT_FOUND':
        case 'RESERVATION_NOT_FOUND':
            return 404;
        case 'ACCOUNT_NOT_ACTIVE':
        case 'FORBIDDEN':
        case 'PARTNER_SUSPENDED':
            return 403;
        case 'TOO_MANY_PENDING':
        case 'PAYER_PENDING_LIMIT':
            return 429;
        case 'SERVICE_CLOSED':
            return 404;
        case 'INVALID_DATES':
        case 'INVALID_DURATION':
        case 'INVALID_MODE':
        case 'DATE_PASSED':
        case 'DATE_TOO_FAR':
        case 'INVALID_PART':
        case 'OPERATOR_REQUIRED':
        case 'REASON_REQUIRED':
        case 'INVALID_ORIGIN':
        case 'INVALID_DECISION':
            return 400;
        default:
            return 409;
    }
}

/** Montant en F CFA, espaces entre les milliers : « 126 000 F CFA ». */
export function fcfa(n: unknown): string {
    const v = Math.round(Number(n));
    return `${String(Math.abs(v)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} F CFA`;
}

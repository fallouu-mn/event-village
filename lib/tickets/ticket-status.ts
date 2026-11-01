/**
 * Lot 5 (contrats B et Q) — seule source des libellés de statut d'un billet.
 *
 * Les valeurs de l'enum PostgreSQL `ticket_status` (0001_initial_schema.sql, plus
 * REMBOURSEMENT_EN_COURS ajouté au lot 3) ne s'affichent jamais telles quelles : badges, messages et
 * aides lisent TICKET_STATUS_META. Une valeur inconnue donne « Statut inconnu », jamais la valeur brute.
 */

export const TICKET_STATUSES = ['VALIDE', 'UTILISE', 'ANNULE', 'REMBOURSE', 'REMBOURSEMENT_EN_COURS'] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

/** Ton visuel d'un statut, traduit en tokens par StatusBadge (components/ui/StatusBadge.tsx). */
export type TicketStatusTone = 'success' | 'info' | 'warning' | 'danger' | 'muted';

export interface TicketStatusMeta {
    /** Libellé court de la pastille (casse de phrase, accents). */
    label: string;
    tone: TicketStatusTone;
    /** Phrase destinée au porteur du billet (aide, message sous la carte). */
    description: string;
}

export const TICKET_STATUS_META: Record<TicketStatus, TicketStatusMeta> = {
    VALIDE: {
        label: 'Valable',
        tone: 'success',
        description: 'Billet valable : présentez son code d’entrée au contrôle.',
    },
    UTILISE: {
        label: 'Utilisé',
        tone: 'info',
        description: 'Ce billet a déjà été contrôlé à l’entrée.',
    },
    ANNULE: {
        label: 'Annulé',
        tone: 'danger',
        description: 'Ce billet est annulé : il ne donne plus accès à l’événement.',
    },
    REMBOURSE: {
        label: 'Remboursé',
        tone: 'muted',
        description: 'Ce billet a été remboursé : il ne donne plus accès à l’événement.',
    },
    REMBOURSEMENT_EN_COURS: {
        label: 'Remboursement en cours',
        tone: 'warning',
        description: 'Le remboursement de ce billet est en cours : vous serez prévenu dès le versement.',
    },
};

export const UNKNOWN_TICKET_STATUS_LABEL = 'Statut inconnu';

export function isTicketStatus(value: unknown): value is TicketStatus {
    return typeof value === 'string' && (TICKET_STATUSES as readonly string[]).includes(value);
}

/** Libellé d'un statut de billet ; une valeur hors enum donne « Statut inconnu », jamais la valeur brute. */
export function ticketStatusLabel(status: unknown): string {
    return isTicketStatus(status) ? TICKET_STATUS_META[status].label : UNKNOWN_TICKET_STATUS_LABEL;
}

/** Phrase d'explication d'un statut de billet, ou null pour une valeur inconnue. */
export function ticketStatusDescription(status: unknown): string | null {
    return isTicketStatus(status) ? TICKET_STATUS_META[status].description : null;
}

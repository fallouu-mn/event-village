/**
 * Finition 3a (E-31) — statuts de paiement de l'administration en français, sans capitales ni code brut, avec la même
 * phrase dans le filtre et dans le badge. Propre aux paiements : StatusBadge (components/ui/Badge.tsx), partagé par
 * une cinquantaine d'écrans, n'est pas modifié.
 * Module pur, lisible par un composant client.
 */
import type { BadgeVariant } from '@/components/ui/Badge';

/** Statuts d'un paiement encaissé, dans l'ordre du filtre. */
export const ENCASHED_PAYMENT_STATUSES = ['SUCCESS', 'PARTIAL', 'REFUND_PENDING', 'REFUNDED'] as const;
export type EncashedPaymentStatus = typeof ENCASHED_PAYMENT_STATUSES[number];

const LABELS: Readonly<Record<EncashedPaymentStatus, { label: string; variant: BadgeVariant }>> = {
    SUCCESS: { label: 'Payé', variant: 'success' },
    PARTIAL: { label: 'Remboursé en partie', variant: 'warning' },
    REFUND_PENDING: { label: 'Remboursement en cours', variant: 'info' },
    REFUNDED: { label: 'Remboursé', variant: 'neutral' },
};

export const UNKNOWN_PAYMENT_STATUS = 'Statut inconnu';

/** Libellé et teinte du badge d'un statut de paiement ; un code inconnu donne « Statut inconnu », jamais le code. */
export function paymentStatusLabel(status: string | null | undefined): { label: string; variant: BadgeVariant } {
    const s = (status ?? '').toUpperCase();
    return (ENCASHED_PAYMENT_STATUSES as readonly string[]).includes(s)
        ? LABELS[s as EncashedPaymentStatus]
        : { label: UNKNOWN_PAYMENT_STATUS, variant: 'neutral' };
}

/** Options du filtre de statut de la liste des paiements (« Tous » d'abord), mêmes mots que les badges. */
export const PAYMENT_STATUS_FILTER: ReadonlyArray<{ value: 'ALL' | EncashedPaymentStatus; label: string }> = [
    { value: 'ALL', label: 'Tous les paiements' },
    ...ENCASHED_PAYMENT_STATUSES.map((s) => ({ value: s, label: LABELS[s].label })),
];

/** Identifiant interne (UUID) : jamais affiché tel quel (design 1b, garde-fou des mots). */
const INTERNAL_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Design 1c (point 5) — référence d'un paiement lisible à l'écran : la référence SamirPay telle quelle ; un paiement sans
 * référence SamirPay (lib/finance/admin-lists.ts, paymentLine, repli sur l'identifiant interne) devient une référence
 * courte « Réf. interne » suivie des 8 premiers caractères, en capitales. Jamais d'identifiant brut affiché.
 */
export function readablePaymentReference(reference: string | null | undefined): string {
    const ref = (reference ?? '').trim();
    if (ref === '') return 'Sans référence';
    if (INTERNAL_ID.test(ref)) return `Réf. interne ${ref.slice(0, 8).toUpperCase()}`;
    return ref;
}

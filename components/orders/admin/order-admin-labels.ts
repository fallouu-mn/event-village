/**
 * Lot 12d — administration des commandes : mots affichés (aucun état ni code en capitales à l'écran) et types des réponses
 * de GET /api/admin/orders et GET /api/admin/orders/[id]. Aucun montant calculé ici : tout montant vient de la base.
 */

export type AdminOrderGroup = 'A_DECIDER' | 'EN_COURS' | 'TERMINEES' | 'ANNULEES' | 'NON_PAYEES' | 'TOUTES';

export const ADMIN_ORDER_GROUPS: ReadonlyArray<{ id: AdminOrderGroup; label: string }> = [
    { id: 'A_DECIDER', label: 'À décider' },
    { id: 'EN_COURS', label: 'En cours' },
    { id: 'TERMINEES', label: 'Terminées' },
    { id: 'ANNULEES', label: 'Annulées' },
    { id: 'NON_PAYEES', label: 'Non payées' },
    { id: 'TOUTES', label: 'Toutes' },
];

export function isAdminOrderGroup(v: unknown): v is AdminOrderGroup {
    return typeof v === 'string' && ADMIN_ORDER_GROUPS.some((g) => g.id === v);
}

export const ADMIN_MODE_LABELS: Readonly<Record<string, string>> = { LIVRAISON: 'Livraison', RETRAIT: 'Retrait', SUR_PLACE: 'Sur place' };

/** Auteur d'une étape, en mots. */
export const ACTOR_LABELS: Readonly<Record<string, string>> = {
    CLIENT: 'Le client',
    PARTENAIRE: 'L’établissement',
    LIVREUR: 'Le livreur',
    ADMIN: 'L’équipe Event Village',
    SUPERADMIN: 'L’équipe Event Village',
    SYSTEM: 'Automatique',
};

/** État atteint à une étape de la frise (libellé de l'administration). */
const STEP_LABELS: Readonly<Record<string, string>> = {
    EN_ATTENTE_PAIEMENT: 'Créée, en attente de paiement',
    RECUE: 'Reçue par l’établissement',
    ACCEPTEE: 'Acceptée',
    EN_PREPARATION: 'En préparation',
    PRETE: 'Prête',
    EN_ROUTE: 'En route',
    NON_RETIREE: 'Close sans remise',
    EXPIREE: 'Non payée à temps',
    REFUSEE: 'Refusée par l’établissement',
    SANS_REPONSE: 'Sans réponse de l’établissement',
    ANNULEE_CLIENT: 'Annulée par le client',
    ANNULEE_PARTENAIRE: 'Annulée par l’établissement',
    ANNULEE_EV: 'Annulée par Event Village',
};

export function stepLabel(to: unknown, mode: unknown): string {
    if (to === 'REMISE') return mode === 'LIVRAISON' ? 'Livrée' : mode === 'SUR_PLACE' ? 'Servie' : 'Retirée';
    if (to === 'NON_RETIREE' && mode === 'LIVRAISON') return 'Close : client absent';
    return typeof to === 'string' && STEP_LABELS[to] ? STEP_LABELS[to] : 'Étape';
}

export const ISSUE_REASON_LABELS: Readonly<Record<string, string>> = {
    RETARD: 'Retard', INCOMPLETE: 'Commande incomplète', ERREUR: 'Erreur dans la commande', AUTRE: 'Autre problème',
};

export const ABSENCE_PHASE_LABELS: Readonly<Record<string, string>> = {
    ATTENTE: 'Le livreur attend le client',
    EQUIPE: 'À décider par l’équipe',
    DECIDEE: 'Décision prise',
};

export const ABSENCE_DECISION_LABELS: Readonly<Record<string, string>> = {
    TOUT: 'Tout remboursé', PART: 'Une part remboursée', RIEN: 'Rien remboursé',
};

export const PAYMENT_PART_LABELS: Readonly<Record<string, string>> = { PREMIER: 'Paiement à la commande', SOLDE: 'Solde' };

export const REFUND_STATUS_LABELS: Readonly<Record<string, string>> = { PENDING: 'En cours', PROCESSED: 'Fait', FAILED: 'Échoué' };

export const CASHOUT_STATUS_LABELS: Readonly<Record<string, string>> = {
    A_ENVOYER: 'À envoyer', ENVOYE: 'Envoyé', CONFIRME: 'Versé', ECHOUE: 'Refusé par l’opérateur', INCERTAIN: 'Sans réponse de l’opérateur',
};

export const label = (map: Readonly<Record<string, string>>, v: unknown, fallback = '—'): string =>
    (typeof v === 'string' && map[v]) ? map[v] : fallback;

/** Ton de la pastille d'un état. */
export function adminStateTone(state: unknown): 'success' | 'info' | 'warning' | 'danger' | 'neutral' {
    switch (state) {
        case 'REMISE': return 'success';
        case 'EN_ATTENTE_PAIEMENT': return 'warning';
        case 'RECUE': case 'ACCEPTEE': case 'EN_PREPARATION': case 'PRETE': case 'EN_ROUTE': return 'info';
        case 'EXPIREE': return 'neutral';
        default: return 'danger';
    }
}

export interface AdminOrderRow {
    id: string;
    order_number: string;
    state: string;
    stateLabel: string;
    mode: string;
    venue_name: string;
    partner_name?: string;
    client_name?: string;
    created_at: string;
    scheduled_for?: string;
    closed_at?: string;
    goods_total: number;
    paid: number;
    refunded: number;
    issue_open?: boolean;
    absence?: 'ATTENTE' | 'EQUIPE' | 'DECIDEE';
    to_decide?: boolean;
}

export interface AdminOrderList {
    total: number;
    page: number;
    pageSize: number;
    pages: number;
    orders: AdminOrderRow[];
}

export interface AdminOrderDetail {
    id: string;
    order_number: string;
    state: string;
    stateLabel: string;
    mode: string;
    payment_type?: string;
    venue: { id: string; name: string };
    venue_address?: string;
    partner_name?: string;
    scheduled_for?: string;
    estimated_at?: string;
    created_at: string;
    zone_name?: string;
    onsite_label?: string;
    items?: Array<{ product_id: string; name: string; quantity: number; unit_price: number; total_price: number; options?: Array<{ name: string; price: number }>; notes?: string }>;
    amounts: {
        items_amount: number; delivery_fee: number; goods_total: number; deposit_percent?: number | null;
        paid_goods: number; paid_fees: number; refunded_amount: number; onsite_amount?: number | null; balance_due: number; to_pay_now?: number | null;
    };
    client?: { name?: string; phone?: string };
    admin_contact?: { address?: string; phone?: string; notes?: string };
    people_visible?: boolean;
    courier_name?: string;
    contact_masked?: boolean;
    timeline?: Array<{ from?: string; to: string; at: string; by: string; note?: string }>;
    payments?: Array<{ id: string; part?: string; amount: number; status: string; operator?: string; created_at: string; paid_at?: string; payer_phone?: string }>;
    refunds?: Array<{ id: string; amount: number; status: string; reason?: string; created_at: string; cashout_status?: string }>;
    issues?: Array<{ id: string; reason: string; details?: string; status: string; created_at: string; closed_at?: string; close_note?: string }>;
    absence?: { reported_at: string; wait_until?: string; escalated_at?: string; phase: 'ATTENTE' | 'EQUIPE' | 'DECIDEE'; decision?: string; decided_at?: string };
    cancel?: { origin?: string; reason?: string; refund_percent?: number };
    refundable: number;
    can_cancel: boolean;
    can_decide_absence: boolean;
    can_close_issue: boolean;
}

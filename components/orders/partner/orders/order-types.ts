/**
 * Lot 12c — forme d'une commande servie à la partenaire (order_view, puis partnerOrderView côté serveur : libellé de
 * l'état, étapes, coordonnées seulement pendant la commande ouverte). Aucun montant n'est recalculé dans le navigateur :
 * chaque montant affiché est l'un de ceux-ci.
 */
export interface OrderLineOption { id?: string; name: string; price: number }

export interface OrderLine {
    product_id: string;
    name: string;
    quantity: number;
    unit_price: number;
    total_price: number;
    options?: OrderLineOption[] | null;
    notes?: string | null;
}

export interface OrderAmounts {
    items_amount: number;
    delivery_fee: number;
    goods_total: number;
    deposit_percent?: number | null;
    paid_goods: number;
    paid_fees: number;
    refunded_amount: number;
    onsite_amount?: number | null;
    balance_due: number;
}

export interface PartnerOrder {
    id: string;
    order_number: string;
    state: string;
    stateLabel: string;
    mode: 'LIVRAISON' | 'RETRAIT' | 'SUR_PLACE' | string;
    payment_type: string;
    venue: { id: string; name: string };
    asap: boolean;
    scheduled_for?: string | null;
    estimated_at?: string | null;
    response_due_at?: string | null;
    timeline: Array<{ key: string; label: string; at: string | null }>;
    items?: OrderLine[] | null;
    amounts: OrderAmounts;
    zone_name?: string | null;
    onsite_label?: string | null;
    contact?: { address?: string | null; phone?: string | null; notes?: string | null } | null;
    contact_masked?: boolean;
    contactHidden?: boolean;
    courier?: { first_name?: string | null } | null;
    cancel?: { origin?: string | null; reason?: string | null; refund_percent?: number | null } | null;
    created_at: string;
}

export interface OrdersReply { success: boolean; orders: PartnerOrder[] }
export interface OrderReply { success: boolean; order: PartnerOrder }

export interface DayReply {
    success: boolean;
    /** État de la fiche de la partenaire (« SUSPENDU » : lecture seule), servi par la route. */
    partnerStatus?: string | null;
    day: {
        date: string;
        receivedToday: number;
        openNow: number;
        toAccept: number;
        handedToday: number;
        revenueToday: number;
        paidOnlineToday: number;
        onsiteToday: number;
        low: Array<{ productId: string; name: string; venueId: string | null; kind: 'STOCK' | 'PORTIONS'; left: number }>;
    };
}

export interface CourierRow {
    id: string;
    userId: string;
    status: string;
    statusLabel: string;
    firstName?: string | null;
    displayName?: string | null;
    phone?: string | null;
    invitedAt: string;
}

export interface CouriersReply { success: boolean; couriers: CourierRow[] }

/** Lignes servies, quatre au plus, en « 2 × Yassa » (aucune somme calculée). */
export function linesSummary(order: PartnerOrder, max = 4): { shown: OrderLine[]; more: boolean } {
    const items = order.items ?? [];
    return { shown: items.slice(0, max), more: items.length > max };
}

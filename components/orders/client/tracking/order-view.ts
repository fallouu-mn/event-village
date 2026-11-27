/**
 * Lot 12b — lecture défensive de GET /api/orders/[id] (order_view vu par le client, lib/orders/booking.ts orderResponse).
 * Aucun montant n'est calculé ici : chaque montant affiché est un champ servi par la base, tel quel.
 */

export interface OrderItemView {
    name: string;
    quantity: number;
    totalPrice: number;
    options: string[];
    notes: string | null;
}

export interface OrderAmountsView {
    itemsAmount: number;
    deliveryFee: number;
    goodsTotal: number;
    depositPercent: number | null;
    paidGoods: number;
    paidFees: number;
    refundedAmount: number;
    onsiteAmount: number | null;
    balanceDue: number;
    /** Montant de la première part à payer maintenant (commande en attente de paiement seulement). */
    toPayNow: number | null;
}

export interface OrderView {
    id: string;
    orderNumber: string;
    state: string;
    mode: string;
    paymentType: string;
    venueId: string | null;
    venueName: string;
    asap: boolean;
    scheduledFor: string | null;
    estimatedAt: string | null;
    steps: Record<string, unknown>;
    items: OrderItemView[];
    amounts: OrderAmountsView;
    zoneName: string | null;
    onsiteLabel: string | null;
    address: string | null;
    contactNotes: string | null;
    courierFirstName: string | null;
    code: { sent: boolean; resendsLeft: number; locked: boolean } | null;
    holdExpiresAt: string | null;
    responseDueAt: string | null;
    cancel: { origin: string | null; reason: string | null } | null;
    canCancel: boolean;
}

type Row = Record<string, unknown>;

const isRow = (v: unknown): v is Row => !!v && typeof v === 'object' && !Array.isArray(v);
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() !== '' ? v : null);
const num = (v: unknown): number => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
};
const numOrNull = (v: unknown): number | null => (v === null || v === undefined || !Number.isFinite(Number(v)) ? null : Number(v));

/** Commande lue dans la réponse, ou null si la forme est inattendue. */
export function readOrderView(body: unknown): OrderView | null {
    if (!isRow(body) || !isRow(body.order)) return null;
    const o = body.order;
    const id = str(o.id);
    const state = str(o.state);
    if (!id || !state) return null;
    const venue = isRow(o.venue) ? o.venue : {};
    const a = isRow(o.amounts) ? o.amounts : {};
    const contact = isRow(o.contact) ? o.contact : {};
    const code = isRow(o.code) ? o.code : null;
    const cancel = isRow(o.cancel) ? o.cancel : null;
    const items = (Array.isArray(o.items) ? o.items : []).filter(isRow).map((it): OrderItemView => ({
        name: str(it.name) ?? 'Produit',
        quantity: num(it.quantity),
        totalPrice: num(it.total_price),
        options: (Array.isArray(it.options) ? it.options : []).filter(isRow).map((x) => str(x.name)).filter((x): x is string => x !== null),
        notes: str(it.notes),
    }));
    return {
        id,
        orderNumber: str(o.order_number) ?? '',
        state,
        mode: str(o.mode) ?? '',
        paymentType: str(o.payment_type) ?? '',
        venueId: str(venue.id),
        venueName: str(venue.name) ?? 'Établissement',
        asap: o.asap === true,
        scheduledFor: str(o.scheduled_for),
        estimatedAt: str(o.estimated_at),
        steps: isRow(o.steps) ? o.steps : {},
        items,
        amounts: {
            itemsAmount: num(a.items_amount),
            deliveryFee: num(a.delivery_fee),
            goodsTotal: num(a.goods_total),
            depositPercent: numOrNull(a.deposit_percent),
            paidGoods: num(a.paid_goods),
            paidFees: num(a.paid_fees),
            refundedAmount: num(a.refunded_amount),
            onsiteAmount: numOrNull(a.onsite_amount),
            balanceDue: num(a.balance_due),
            toPayNow: numOrNull(a.to_pay_now),
        },
        zoneName: str(o.zone_name),
        onsiteLabel: str(o.onsite_label),
        address: str(contact.address),
        contactNotes: str(contact.notes),
        courierFirstName: isRow(o.courier) ? str(o.courier.first_name) : null,
        code: code ? { sent: code.sent === true, resendsLeft: num(code.resends_left), locked: code.locked === true } : null,
        holdExpiresAt: str(o.hold_expires_at),
        responseDueAt: str(o.response_due_at),
        cancel: cancel ? { origin: str(cancel.origin), reason: str(cancel.reason) } : null,
        canCancel: o.can_cancel === true,
    };
}

/** « 13 h 15 » à partir d'un instant (heure de Dakar = UTC toute l'année). */
export function hourText(iso: string | null): string {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const hh = String(d.getUTCHours()).padStart(2, '0');
    const mm = String(d.getUTCMinutes()).padStart(2, '0');
    return `${hh} h ${mm}`;
}

/** Le même jour (Dakar) qu'aujourd'hui ? */
export function isToday(iso: string | null, now: Date = new Date()): boolean {
    if (!iso) return false;
    const d = new Date(iso);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === now.toISOString().slice(0, 10);
}

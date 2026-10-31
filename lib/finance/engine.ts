/**
 * Lot 3 — moteur financier : accès TypeScript au module SQL unique (finance_compute, finance_quote).
 * Aucun calcul de frais ici : les taux, les arrondis et la répartition vivent dans la migration
 * 20261101000003_lot3_moteur.sql ; ce fichier ne fait que les appeler et typer leur réponse.
 */
import { rpcWithRetry } from '@/lib/payments/rpc';

export type FinanceTarget = 'TICKET' | 'ORDER' | 'HALL_RESERVATION' | 'TABLE_RESERVATION' | 'SUBSCRIPTION';
export type FinanceOperator = 'WAVE' | 'ORANGE_MONEY';

export interface BreakdownLine {
    category_id?: string | null;
    unit_price: number;
    quantity: number;
    unit_service_fee: number;
    line_facial: number;
    line_service_fee: number;
    line_total: number;
}

export interface Breakdown {
    target: FinanceTarget;
    operator: FinanceOperator | null;
    lines: BreakdownLine[];
    facial_amount: number;
    service_fee: number;
    total_amount: number;
    service_fee_rate: number;
    aggregator_fee_rate: number | null;
    aggregator_fee: number | null;
    partner_payout_amount: number;
    gross_event_village_revenue: number;
    net_event_village_revenue: number | null;
}

function toBreakdown(raw: Record<string, unknown>): Breakdown {
    const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));
    const lines = (Array.isArray(raw.lines) ? raw.lines : []) as Array<Record<string, unknown>>;
    return {
        target: raw.target as FinanceTarget,
        operator: (raw.operator as FinanceOperator | null) ?? null,
        lines: lines.map((l) => ({
            category_id: (l.category_id as string | null) ?? null,
            unit_price: Number(l.unit_price),
            quantity: Number(l.quantity),
            unit_service_fee: Number(l.unit_service_fee),
            line_facial: Number(l.line_facial),
            line_service_fee: Number(l.line_service_fee),
            line_total: Number(l.line_total),
        })),
        facial_amount: Number(raw.facial_amount),
        service_fee: Number(raw.service_fee),
        total_amount: Number(raw.total_amount),
        service_fee_rate: Number(raw.service_fee_rate),
        aggregator_fee_rate: num(raw.aggregator_fee_rate),
        aggregator_fee: num(raw.aggregator_fee),
        partner_payout_amount: Number(raw.partner_payout_amount),
        gross_event_village_revenue: Number(raw.gross_event_village_revenue),
        net_event_village_revenue: num(raw.net_event_village_revenue),
    };
}

/** Répartition d'un paiement (taux lus dans les réglages au moment de l'appel). */
export async function computeBreakdown(
    target: FinanceTarget,
    lines: Array<{ unit_price: number; quantity: number; category_id?: string }>,
    operator: FinanceOperator | null,
): Promise<Breakdown> {
    const { data, error } = await rpcWithRetry<Record<string, unknown>>('finance_compute', { p_target: target, p_lines: lines, p_operator: operator });
    if (error || !data) throw new Error(`Calcul financier impossible : ${error?.message ?? 'réponse vide'}`);
    return toBreakdown(data);
}

export type QuoteResult =
    | { ok: true; eventId: string; breakdown: Breakdown }
    | { ok: false; code: string; message: string };

/** Devis d'un panier de billets : prix lus en base, frais de service par billet. */
export async function quoteTickets(
    eventId: string,
    items: Array<{ category_id: string; quantity: number }>,
    operator: FinanceOperator | null,
): Promise<QuoteResult> {
    const { data, error } = await rpcWithRetry<Record<string, unknown>>('finance_quote', { p_event_id: eventId, p_items: items, p_operator: operator });
    if (error || !data) throw new Error(`Devis impossible : ${error?.message ?? 'réponse vide'}`);
    if (data.ok !== true) return { ok: false, code: String(data.code), message: String(data.message) };
    return { ok: true, eventId, breakdown: toBreakdown(data) };
}

/** Valeur courante d'un réglage finance.* (fin_setting : exception si la clé manque, aucun repli). */
export async function readFinanceSetting<T extends number | boolean | string>(key: string): Promise<T> {
    const { data, error } = await rpcWithRetry<unknown>('fin_setting', { p_key: key });
    if (error || data === null || data === undefined) throw new Error(`Réglage ${key} indisponible : ${error?.message ?? 'absent'}`);
    return data as T;
}

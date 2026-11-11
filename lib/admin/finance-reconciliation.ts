/**
 * Lot 9 bis (H7, H6 ; contrat 4.1, X5, B29, B106) — frais réels SamirPay des transferts sortants, lus sur les
 * versements confirmés non simulés (colonnes samirpay_* de la migration 20261109000005).
 *  - observedCashoutFeeRates : taux constaté sur 90 jours, Σ frais / Σ montants (arrondi au centième de point), et
 *    maximum par ligne ; null tant qu'aucun frais réel n'est connu. Lu par GET /api/admin/finance-settings pour
 *    avertir quand le taux de retrait réglé est inférieur (l'écriture du réglage n'est jamais bloquée) ;
 *  - cashoutFeeReconciliation : frais réels des versements (Σ samirpay_fees), frais estimés au taux de retrait
 *    réglé (finance.withdrawal_fee_rate) sur les mêmes versements, écart ; les encaissements n'ont aucun frais réel
 *    connu (le Cashin Direct v1.2 n'en renvoie pas) : null et une mention, jamais 0. Lu par
 *    GET /api/admin/finance/reconciliation.
 * Toute erreur de lecture est levée, jamais remplacée par un zéro.
 */
import { getServiceRoleClient } from '@/lib/supabase/server';
import { readFinanceSetting } from '@/lib/finance/engine';
import { fetchAllRows } from '@/lib/partner/partner-dashboard.service';

/** Fenêtre du taux constaté (X5). */
export const OBSERVED_FEE_WINDOW_DAYS = 90;

interface FeeRow { amount: number | string; samirpay_fees: number | string }

const cents = (n: number): number => Math.round(n * 100);
const round2 = (n: number): number => Math.round(n * 100) / 100;

/** Versements confirmés, non simulés, aux frais réels connus, créés depuis `since` (et jusqu'à `until`). */
async function confirmedCashoutFees(since?: string, until?: string): Promise<Array<{ amount: number; fees: number }>> {
    const supabase = getServiceRoleClient();
    const rows = await fetchAllRows<FeeRow>('frais réels des versements', (from, to) => {
        let q = supabase.from('cashouts').select('id, amount, samirpay_fees')
            .eq('status', 'CONFIRME').eq('simulated', false).not('samirpay_fees', 'is', null);
        if (since) q = q.gte('created_at', since);
        if (until) q = q.lte('created_at', until);
        return q.order('id', { ascending: true }).range(from, to);
    });
    return rows.map((r) => ({ amount: Number(r.amount), fees: Number(r.samirpay_fees) })).filter((r) => r.amount > 0);
}

export interface ObservedCashoutFeeRates {
    /** Σ frais / Σ montants × 100, en %, arrondi au centième ; null sans donnée. */
    rate: number | null;
    /** Plus fort taux d'une ligne, en % ; null sans donnée. */
    max: number | null;
}

export async function observedCashoutFeeRates(now: Date = new Date()): Promise<ObservedCashoutFeeRates> {
    const since = new Date(now.getTime() - OBSERVED_FEE_WINDOW_DAYS * 24 * 3600_000).toISOString();
    const rows = await confirmedCashoutFees(since);
    if (rows.length === 0) return { rate: null, max: null };
    const feesCents = rows.reduce((t, r) => t + cents(r.fees), 0);
    const amountCents = rows.reduce((t, r) => t + cents(r.amount), 0);
    return {
        rate: round2((100 * feesCents) / amountCents),
        max: rows.reduce((m, r) => Math.max(m, round2((100 * r.fees) / r.amount)), 0),
    };
}

/** Mention des encaissements, dont SamirPay ne fournit aucun frais réel (H6, contrat 5.59). */
export const CASHIN_FEES_NOTE = 'Frais réels non fournis par SamirPay pour ce mode d’encaissement : comparez avec votre tableau de bord SamirPay.';

export interface CashoutFeeReconciliation {
    /** Σ des frais réels des versements confirmés non simulés, en F CFA. */
    cashoutFeesReal: number;
    /** Mêmes versements au taux de retrait réglé, en F CFA. */
    cashoutFeesEstimated: number;
    /** Réels − estimés. */
    gap: number;
    /** Taux réglé employé pour l'estimation, en %. */
    cashoutFeeRate: number;
    /** Nombre de versements aux frais réels connus. */
    cashoutCount: number;
    /** Encaissements : frais réels inconnus. */
    cashinFeesReal: null;
    cashinNote: string;
}

export async function cashoutFeeReconciliation(period: { startDate?: string; endDate?: string } = {}): Promise<CashoutFeeReconciliation> {
    const [rows, rate] = await Promise.all([
        confirmedCashoutFees(period.startDate, period.endDate),
        readFinanceSetting<number>('finance.withdrawal_fee_rate'),
    ]);
    const rateNum = Number(rate);
    if (!Number.isFinite(rateNum)) throw new Error(`Réglage finance.withdrawal_fee_rate illisible : ${String(rate)}`);
    const realCents = rows.reduce((t, r) => t + cents(r.fees), 0);
    const estimatedCents = rows.reduce((t, r) => t + Math.round(r.amount * rateNum), 0);
    return {
        cashoutFeesReal: realCents / 100,
        cashoutFeesEstimated: estimatedCents / 100,
        gap: (realCents - estimatedCents) / 100,
        cashoutFeeRate: rateNum,
        cashoutCount: rows.length,
        cashinFeesReal: null,
        cashinNote: CASHIN_FEES_NOTE,
    };
}

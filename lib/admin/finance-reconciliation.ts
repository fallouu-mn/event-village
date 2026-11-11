/**
 * Lot 9 bis (H7, H6 ; contrat 4.1, X5, B29, B106) — frais réels SamirPay des transferts sortants, lus sur les
 * versements confirmés non simulés (colonnes samirpay_* de la migration 20261109000005).
 *  - observedCashoutFeeRates : taux constaté sur 90 jours, Σ frais / Σ montants (arrondi au centième de point), et
 *    maximum par ligne ; null tant qu'aucun frais réel n'est connu. Lu par GET /api/admin/finance-settings pour
 *    avertir quand le taux de retrait réglé est inférieur (l'écriture du réglage n'est jamais bloquée).
 * Toute erreur de lecture est levée, jamais remplacée par un zéro.
 */
import { getServiceRoleClient } from '@/lib/supabase/server';
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

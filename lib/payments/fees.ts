/**
 * Frais de billetterie appliqués à un montant payable. Calcul repris tel quel de
 * PaymentService.createPayment (lot 2 : aucun changement du modèle financier, réservé au lot 3).
 * Les taux viennent de platform_settings.ticketing_fee_config ; leur absence est une erreur
 * (aucune valeur de repli).
 */
import { getServiceRoleClient } from '@/lib/supabase/server';

export interface TicketingFees {
    aggregatorFee: number;
    serviceFee: number;
    grossRevenue: number;
    netRevenue: number;
    partnerPayout: number;
}

export async function computeTicketingFees(payableAmount: number, opts: { subscription?: boolean } = {}): Promise<TicketingFees> {
    const { data, error } = await getServiceRoleClient()
        .from('platform_settings')
        .select('value')
        .eq('key', 'ticketing_fee_config')
        .maybeSingle();
    if (error || !data?.value?.service_fee_rate || !data?.value?.aggregator_fee_rate) {
        throw new Error(`Configuration des frais de paiement manquante (ticketing_fee_config)${error ? ` : ${error.message}` : ''}.`);
    }
    const serviceFeeRate = Number(data.value.service_fee_rate) / 100;
    const aggregatorFeeRate = Number(data.value.aggregator_fee_rate) / 100;
    const aggregatorFee = Math.round(payableAmount * aggregatorFeeRate * 100) / 100;
    if (opts.subscription) {
        return { aggregatorFee, serviceFee: 0, grossRevenue: payableAmount, netRevenue: Math.max(0, payableAmount - aggregatorFee), partnerPayout: 0 };
    }
    const serviceFee = Math.round(payableAmount * serviceFeeRate * 100) / 100;
    return {
        aggregatorFee,
        serviceFee,
        grossRevenue: serviceFee,
        netRevenue: Math.max(0, serviceFee - aggregatorFee),
        partnerPayout: Math.max(0, payableAmount - serviceFee),
    };
}

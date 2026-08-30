/**
 * Service de Calcul Financier & Réconciliation CDC V3.0 (Annexes B & C, §78-79, §114, §126)
 * Élimine tout taux uniforme codé en dur et applique les règles de répartition exactes par module.
 */

export interface TicketingFinancialBreakdown {
    ticketFacialPrice: number;
    serviceFeeRatePercent: number;
    serviceFeeAmount: number;
    buyerTotalPaid: number;
    aggregatorFeeRatePercent: number;
    aggregatorFeeAmount: number;
    partnerPayout: number;
    platformNetRetained: number;
}

export interface OrderFinancialBreakdown {
    orderTotalAmount: number;
    commissionRatePercent: number;
    platformCommissionAmount: number;
    aggregatorFeeRatePercent: number;
    aggregatorFeeAmount: number;
    partnerPayout: number;
    platformNetRetained: number;
}

export interface HallFinancialBreakdown {
    hallTotalAmount: number;
    depositPercentage: number;
    depositAmount: number;
    balanceAmount: number;
    aggregatorFeeRatePercent: number;
    aggregatorFeeAmount: number;
    partnerPayout: number;
}

export interface WithdrawalFinancialBreakdown {
    requestedAmount: number;
    feeRatePercent: number;
    feeAmount: number;
    netDisbursed: number;
    isValid: boolean;
    error?: string;
}

export class FinancialCalculatorService {
    /**
     * Annexe C du CDC : Calcul Billetterie
     * - Ticket 1 000 FCFA
     * - Frais de service 5% (50 FCFA) -> Total payé par l'acheteur = 1 050 FCFA
     * - Frais agrégateur 1.5% × 1 050 = 15.75 FCFA
     * - L'organisateur reçoit 1 000 FCFA (le prix plein facial)
     * - Event Village conserve 34.25 FCFA (Frais de service 50 - Frais agrégateur 15.75)
     */
    public static calculateTicketingFinancials(params: {
        ticketFacialPrice: number;
        serviceFeeRatePercent?: number; // Défaut CDC : 5%
        aggregatorFeeRatePercent?: number; // Défaut Wave/OM : 1.5%
    }): TicketingFinancialBreakdown {
        const ticketFacialPrice = Number(params.ticketFacialPrice) || 0;
        const serviceFeeRatePercent = params.serviceFeeRatePercent !== undefined ? params.serviceFeeRatePercent : 5.0;
        const aggregatorFeeRatePercent = params.aggregatorFeeRatePercent !== undefined ? params.aggregatorFeeRatePercent : 1.5;

        // Frais de service acheteur
        const serviceFeeAmount = Number((ticketFacialPrice * (serviceFeeRatePercent / 100)).toFixed(2));
        const buyerTotalPaid = Number((ticketFacialPrice + serviceFeeAmount).toFixed(2));

        // Frais prélevés par l'agrégateur (SamirPay) sur le total encaissé
        const aggregatorFeeAmount = Number((buyerTotalPaid * (aggregatorFeeRatePercent / 100)).toFixed(2));

        // Le partenaire organisateur perçoit l'intégralité du prix facial du billet
        const partnerPayout = ticketFacialPrice;

        // Marge nette conservée par Event Village
        const platformNetRetained = Number((serviceFeeAmount - aggregatorFeeAmount).toFixed(2));

        return {
            ticketFacialPrice,
            serviceFeeRatePercent,
            serviceFeeAmount,
            buyerTotalPaid,
            aggregatorFeeRatePercent,
            aggregatorFeeAmount,
            partnerPayout,
            platformNetRetained,
        };
    }

    /**
     * §114 du CDC : Commande & Vente (Restauration & Services)
     * Le CDC ne fixe aucun taux de commission fixe obligatoire : le taux est un paramètre
     * configurable en base par le Superadmin (via platform_settings).
     */
    public static calculateOrderFinancials(params: {
        orderTotalAmount: number;
        commissionRatePercent?: number; // Configurable Superadmin (ex: 5.0%)
        aggregatorFeeRatePercent?: number; // Défaut Wave/OM : 1.5%
    }): OrderFinancialBreakdown {
        const orderTotalAmount = Number(params.orderTotalAmount) || 0;
        const commissionRatePercent = params.commissionRatePercent !== undefined ? params.commissionRatePercent : 5.0;
        const aggregatorFeeRatePercent = params.aggregatorFeeRatePercent !== undefined ? params.aggregatorFeeRatePercent : 1.5;

        // Commission prélevée par la plateforme
        const platformCommissionAmount = Number((orderTotalAmount * (commissionRatePercent / 100)).toFixed(2));

        // Frais agrégateur
        const aggregatorFeeAmount = Number((orderTotalAmount * (aggregatorFeeRatePercent / 100)).toFixed(2));

        // Reversement net au partenaire restaurateur / prestataire
        const partnerPayout = Number((orderTotalAmount - platformCommissionAmount).toFixed(2));

        // Revenu net Event Village après déduction des frais agrégateur
        const platformNetRetained = Number((platformCommissionAmount - aggregatorFeeAmount).toFixed(2));

        return {
            orderTotalAmount,
            commissionRatePercent,
            platformCommissionAmount,
            aggregatorFeeRatePercent,
            aggregatorFeeAmount,
            partnerPayout,
            platformNetRetained,
        };
    }

    /**
     * Réservation de Salle & Réception
     * Acompte configurable par le partenaire, solde dû et moratoire
     */
    public static calculateHallFinancials(params: {
        hallTotalAmount: number;
        depositPercentage?: number; // Configurable par salle (défaut 30%)
        aggregatorFeeRatePercent?: number;
    }): HallFinancialBreakdown {
        const hallTotalAmount = Number(params.hallTotalAmount) || 0;
        const depositPercentage = params.depositPercentage !== undefined ? params.depositPercentage : 30.0;
        const aggregatorFeeRatePercent = params.aggregatorFeeRatePercent !== undefined ? params.aggregatorFeeRatePercent : 1.5;

        const depositAmount = Number((hallTotalAmount * (depositPercentage / 100)).toFixed(2));
        const balanceAmount = Number((hallTotalAmount - depositAmount).toFixed(2));
        const aggregatorFeeAmount = Number((depositAmount * (aggregatorFeeRatePercent / 100)).toFixed(2));
        const partnerPayout = Number((depositAmount - aggregatorFeeAmount).toFixed(2));

        return {
            hallTotalAmount,
            depositPercentage,
            depositAmount,
            balanceAmount,
            aggregatorFeeRatePercent,
            aggregatorFeeAmount,
            partnerPayout,
        };
    }

    /**
     * §126 du CDC : Retraits Partenaire
     * Seuil minimum 5 000 FCFA, Frais 1%
     */
    public static calculateWithdrawal(params: {
        requestedAmount: number;
        feeRatePercent?: number; // 1.0%
        minThreshold?: number; // 5 000 FCFA
    }): WithdrawalFinancialBreakdown {
        const requestedAmount = Number(params.requestedAmount) || 0;
        const feeRatePercent = params.feeRatePercent !== undefined ? params.feeRatePercent : 1.0;
        const minThreshold = params.minThreshold !== undefined ? params.minThreshold : 5000;

        if (requestedAmount < minThreshold) {
            return {
                requestedAmount,
                feeRatePercent,
                feeAmount: 0,
                netDisbursed: 0,
                isValid: false,
                error: `Le montant minimum de retrait est de ${minThreshold.toLocaleString('fr-FR')} FCFA.`,
            };
        }

        const feeAmount = Math.round(requestedAmount * (feeRatePercent / 100));
        const netDisbursed = requestedAmount - feeAmount;

        return {
            requestedAmount,
            feeRatePercent,
            feeAmount,
            netDisbursed,
            isValid: true,
        };
    }
}

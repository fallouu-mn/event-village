import { getServiceRoleClient } from '@/lib/supabase/server';

export interface FinancialReconciliationItem {
    paymentId: string;
    transactionReference: string;
    targetType: string;
    targetId: string;
    grossAmount: number;
    paymentMethod: string;
    aggregatorFee: number;
    platformFeeRate: number;
    platformNetRevenue: number;
    partnerPayout: number;
    referralCommissionN1: number;
    referralCommissionN2: number;
    totalReferralCommissions: number;
    discrepancy: number; // 0 if balanced
    status: string;
    createdAt: string;
}

export interface FinancialReconciliationSummary {
    period: string;
    totalTransactionsCount: number;
    totalGrossVolume: number;
    totalAggregatorFees: number;
    totalPlatformNetRevenue: number;
    totalPartnerPayouts: number;
    totalReferralCommissions: number;
    totalWithdrawalsPaid: number;
    totalRefunds: number;
    platformNetBalance: number;
    discrepanciesCount: number;
}

export const BLACKLISTED_WORDS = [
    'arnaque',
    'escroc',
    'connard',
    'salope',
    'encule',
    'terroriste',
    'hack',
    'piratage',
    'fake',
    'voler',
    'putain',
    'merde',
];

export class AdminService {
    /**
     * Rapprochement Financier Global (§84)
     */
    static async getFinancialReconciliation(options?: {
        startDate?: string;
        endDate?: string;
        status?: string;
    }): Promise<{
        summary: FinancialReconciliationSummary;
        items: FinancialReconciliationItem[];
    }> {
        const supabase = getServiceRoleClient();

        let paymentsQuery = supabase
            .from('payments')
            .select(`
                id,
                amount,
                payment_method,
                payment_target,
                target_id,
                status,
                external_transaction_id,
                created_at
            `)
            .order('created_at', { ascending: false });

        if (options?.status && options.status !== 'ALL') {
            paymentsQuery = paymentsQuery.eq('status', options.status as any);
        }

        if (options?.startDate) {
            paymentsQuery = paymentsQuery.gte('created_at', options.startDate);
        }

        if (options?.endDate) {
            paymentsQuery = paymentsQuery.lte('created_at', options.endDate);
        }

        const { data: payments } = await paymentsQuery;

        // Récupération des commissions liées
        const { data: commissions } = await supabase
            .from('referral_commissions')
            .select('payment_id, amount, generation');

        // Récupération des retraits payés
        const { data: withdrawals } = await supabase
            .from('withdrawals')
            .select('net_amount, fee_amount, status')
            .eq('status', 'PAID');

        // Récupération des remboursements
        const { data: refunds } = await supabase
            .from('refunds')
            .select('amount, status')
            .eq('status', 'SUCCESS');

        const commMap: Record<string, { n1: number; n2: number }> = {};
        commissions?.forEach((c) => {
            if (!commMap[c.payment_id]) commMap[c.payment_id] = { n1: 0, n2: 0 };
            if (c.generation === 'N1') commMap[c.payment_id].n1 += Number(c.amount || 0);
            if (c.generation === 'N2') commMap[c.payment_id].n2 += Number(c.amount || 0);
        });

        let totalGrossVolume = 0;
        let totalAggregatorFees = 0;
        let totalPlatformNetRevenue = 0;
        let totalPartnerPayouts = 0;
        let totalReferralCommissions = 0;
        let discrepanciesCount = 0;

        const items: FinancialReconciliationItem[] = (payments || []).map((p) => {
            const gross = Number(p.amount || 0);
            totalGrossVolume += gross;

            // Frais agrégateur (Wave 1%, Orange Money 1.5%, etc.)
            let aggRate = 0.015;
            if (p.payment_method === 'WAVE' || p.payment_method === 'WAVE_DIRECT') aggRate = 0.01;
            else if (p.payment_method === 'CARTE_BANCAIRE') aggRate = 0.025;

            const aggregatorFee = Math.round(gross * aggRate);
            totalAggregatorFees += aggregatorFee;

            // Commission Event Village (ex: 6.5% par défaut)
            const platformFeeRate = 6.5;
            const platformNetRevenue = Math.round(gross * (platformFeeRate / 100));
            totalPlatformNetRevenue += platformNetRevenue;

            // Reversement partenaire
            const partnerPayout = Math.max(0, gross - aggregatorFee - platformNetRevenue);
            totalPartnerPayouts += partnerPayout;

            // Commissions Parrainage
            const n1 = commMap[p.id]?.n1 || 0;
            const n2 = commMap[p.id]?.n2 || 0;
            const totalComms = n1 + n2;
            totalReferralCommissions += totalComms;

            // Calcul d'écart (doit être égal à 0)
            const expectedSum = aggregatorFee + platformNetRevenue + partnerPayout;
            const discrepancy = Math.abs(gross - expectedSum);
            if (discrepancy > 1) discrepanciesCount += 1;

            return {
                paymentId: p.id,
                transactionReference: p.external_transaction_id || `TX-${p.id.slice(0, 8)}`,
                targetType: p.payment_target || 'ORDER',
                targetId: p.target_id || '',
                grossAmount: gross,
                paymentMethod: p.payment_method || 'SAMIRPAY',
                aggregatorFee,
                platformFeeRate,
                platformNetRevenue,
                partnerPayout,
                referralCommissionN1: n1,
                referralCommissionN2: n2,
                totalReferralCommissions: totalComms,
                discrepancy,
                status: p.status || 'PENDING',
                createdAt: p.created_at,
            };
        });

        const totalWithdrawalsPaid = withdrawals?.reduce((acc, w) => acc + Number(w.net_amount || 0), 0) || 0;
        const totalRefunds = refunds?.reduce((acc, r) => acc + Number(r.amount || 0), 0) || 0;

        const platformNetBalance = totalPlatformNetRevenue - totalReferralCommissions;

        return {
            summary: {
                period: options?.startDate ? `${options.startDate} au ${options.endDate || 'ce jour'}` : 'Toutes périodes',
                totalTransactionsCount: items.length,
                totalGrossVolume,
                totalAggregatorFees,
                totalPlatformNetRevenue,
                totalPartnerPayouts,
                totalReferralCommissions,
                totalWithdrawalsPaid,
                totalRefunds,
                platformNetBalance,
                discrepanciesCount,
            },
            items,
        };
    }

    /**
     * Contrôle et modération du contenu d'une communication (§121-§126)
     */
    static moderateContent(text: string): { isClean: boolean; flaggedWords: string[] } {
        const lower = text.toLowerCase();
        const flaggedWords: string[] = [];

        for (const word of BLACKLISTED_WORDS) {
            const regex = new RegExp(`\\b${word}s?\\b`, 'i');
            if (regex.test(lower)) {
                flaggedWords.push(word);
            }
        }

        return {
            isClean: flaggedWords.length === 0,
            flaggedWords,
        };
    }

    /**
     * Journalisation inaltérable d'une action Superadmin
     */
    static async logAudit(params: {
        userId?: string;
        userRole: string;
        action: string;
        objectType: string;
        objectId?: string;
        oldValue?: any;
        newValue?: any;
        metadata?: any;
    }) {
        try {
            const supabase = getServiceRoleClient();
            await supabase.from('audit_logs').insert({
                user_id: params.userId || null,
                user_role: params.userRole,
                action: params.action,
                object_type: params.objectType,
                object_id: params.objectId || null,
                old_value: params.oldValue || null,
                new_value: params.newValue || null,
                metadata: params.metadata || {},
            });
        } catch (err) {
            console.error('[AdminService.logAudit] Erreur journalisation:', err);
        }
    }
}

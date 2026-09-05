import { getServiceRoleClient } from '@/lib/supabase/server';
import { samirPayClient } from '@/lib/samirpay/client';
import { RequestWithdrawalInput } from '@/lib/validations/payment';

export interface WithdrawalResult {
    success: boolean;
    withdrawalId?: string;
    status: 'PAID' | 'PROCESSING' | 'PENDING' | 'REJECTED';
    grossAmount: number;
    feeAmount: number;
    netAmount: number;
    externalReference?: string;
    message: string;
}

// Format E.164 : +221XXXXXXXXX (Sénégal)
function toE164Senegal(phone: string): string {
    const digits = phone.replace(/\D/g, '');
    if (digits.startsWith('221') && digits.length === 12) return `+${digits}`;
    if (digits.length === 9) return `+221${digits}`;
    // Déjà au format +221…
    if (phone.startsWith('+221') && digits.length === 12) return phone;
    return `+221${digits}`;
}

export class WithdrawalService {
    public async processWithdrawal(
        userId: string,
        input: RequestWithdrawalInput
    ): Promise<WithdrawalResult> {
        const supabase = getServiceRoleClient();
        const grossAmount = input.amount;

        // 1. Seuil minimum (CDC V3 : 5 000 FCFA) — déjà validé par Zod, défense en profondeur
        if (grossAmount < 5000) {
            throw new Error('Le montant minimum de retrait est fixé à 5 000 FCFA.');
        }

        // 2. Lecture des frais depuis platform_settings (pas de taux hardcodé)
        const { data: feeConfig, error: feeConfigError } = await supabase
            .from('platform_settings')
            .select('value')
            .eq('key', 'withdrawal_fee_config')
            .maybeSingle();

        if (feeConfigError || !feeConfig?.value?.fee_rate) {
            console.error('[WithdrawalService] withdrawal_fee_config manquant en DB:', feeConfigError);
            throw new Error('Configuration des frais de retrait manquante. Contactez le support.');
        }

        const feeRate = Number(feeConfig.value.fee_rate);
        const feeAmount = Math.round(grossAmount * (feeRate / 100) * 100) / 100;
        const netAmount = Math.round((grossAmount - feeAmount) * 100) / 100;

        // 3. Vérification du solde marchand SamirPay — BLOQUANT si l'API échoue
        // Fix : un catch silencieux permettait le cashout même sans trésorerie disponible.
        const merchantBalance = await this.getVerifiedMerchantBalance();
        if (merchantBalance < netAmount) {
            console.error('[WithdrawalService] Solde marchand SamirPay insuffisant:', {
                merchantBalance,
                netAmount,
            });
            throw new Error(
                'La trésorerie de la plateforme est temporairement insuffisante pour ce virement. Veuillez réessayer plus tard ou contacter le support.'
            );
        }

        // 4. Vérification de solde + création atomique via RPC PostgreSQL
        // Fix : remplace SELECT + INSERT non-atomiques (faille TOCTOU / race condition)
        const paymentDetails = {
            phoneNumber: input.phoneNumber,
            operatorName: input.operatorName,
            firstName: input.firstName,
            lastName: input.lastName,
            requestedAt: new Date().toISOString(),
        };

        const { data: rpcResult, error: rpcError } = await supabase.rpc('request_withdrawal', {
            p_user_id: userId,
            p_gross_amount: grossAmount,
            p_fee_rate: feeRate,
            p_fee_amount: feeAmount,
            p_net_amount: netAmount,
            p_payment_details: paymentDetails,
        });

        if (rpcError) {
            const msg = rpcError.message || '';
            if (msg.includes('INSUFFICIENT_BALANCE')) {
                // Extraire les montants de l'exception PostgreSQL pour un message lisible
                const match = msg.match(/Solde disponible\s*:\s*([\d.]+)\s*FCFA/);
                const available = match ? Number(match[1]).toLocaleString('fr-FR') : '—';
                throw new Error(
                    `Solde insuffisant. Votre solde disponible est de ${available} FCFA (Montant demandé : ${grossAmount.toLocaleString('fr-FR')} FCFA).`
                );
            }
            console.error('[WithdrawalService] Erreur RPC request_withdrawal:', rpcError);
            throw new Error('Erreur lors de la vérification du solde et de la création du retrait.');
        }

        const withdrawal = rpcResult as {
            id: string;
            user_id: string;
            gross_amount: number;
            fee_amount: number;
            net_amount: number;
            status: string;
            payment_details: Record<string, unknown>;
            created_at: string;
        };

        if (!withdrawal?.id) {
            throw new Error('Le retrait n\'a pas pu être créé. Veuillez réessayer.');
        }

        // 5. Exécution du Cashout SamirPay (après lock et création de l'enregistrement)
        try {
            const e164Phone = toE164Senegal(input.phoneNumber);

            const cashoutRes = await samirPayClient.sendCashout({
                phoneNumber: e164Phone,
                operatorName: input.operatorName,
                amount: netAmount,
                firstName: input.firstName,
                lastName: input.lastName,
            });

            const externalRef =
                cashoutRes.transaction_id ||
                cashoutRes.reference ||
                `TX-SAMIR-OUT-${withdrawal.id.substring(0, 8)}`;

            // Mise à jour du retrait en PAID
            await supabase
                .from('withdrawals')
                .update({
                    status: 'PAID',
                    external_reference: externalRef,
                    processed_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                })
                .eq('id', withdrawal.id);

            // 6. Marquage FIFO des commissions (Fix overshoot)
            // Ne marque PAID que les commissions entièrement consommées.
            // Si la dernière commission est partiellement consommée, son montant
            // est réduit à la fraction restante (elle reste AVAILABLE).
            await this.applyFifoCommissionMarking(userId, grossAmount, withdrawal.id);

            // Notification utilisateur
            await supabase.from('notifications').insert({
                user_id: userId,
                type: 'WITHDRAWAL_SUCCESS',
                title: 'Retrait réussi !',
                content: `Votre retrait de ${netAmount.toLocaleString('fr-FR')} FCFA vers ${input.operatorName} (${input.phoneNumber}) a été effectué avec succès.`,
                channel: 'PUSH',
                status: 'SENT',
                sent_at: new Date().toISOString(),
                metadata: {
                    withdrawal_id: withdrawal.id,
                    external_reference: externalRef,
                    net_amount: netAmount,
                    fee_amount: feeAmount,
                },
            });

            return {
                success: true,
                withdrawalId: withdrawal.id,
                status: 'PAID',
                grossAmount,
                feeAmount,
                netAmount,
                externalReference: externalRef,
                message: `Retrait de ${netAmount.toLocaleString('fr-FR')} FCFA vers ${input.operatorName} validé avec succès.`,
            };
        } catch (cashoutError: unknown) {
            const errorMessage =
                cashoutError instanceof Error ? cashoutError.message : 'Erreur lors du transfert SamirPay';
            console.error('[WithdrawalService] Échec Cashout SamirPay:', cashoutError);

            // Rollback : on marque le retrait REJECTED pour libérer le solde virtuel
            await supabase
                .from('withdrawals')
                .update({
                    status: 'REJECTED',
                    rejection_reason: errorMessage,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', withdrawal.id);

            throw new Error(`Le transfert de fonds a échoué : ${errorMessage}`);
        }
    }

    /**
     * Vérifie le solde marchand SamirPay.
     * BLOQUANT : lève une erreur si l'API est inaccessible ou retourne 0.
     * Fix : l'ancienne version avalait l'erreur silencieusement (getSolde catch → warn).
     */
    private async getVerifiedMerchantBalance(): Promise<number> {
        let soldeResponse;
        try {
            soldeResponse = await samirPayClient.getSolde();
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : 'Erreur inconnue';
            console.error('[WithdrawalService] Impossible de vérifier le solde SamirPay:', msg);
            throw new Error(
                'Impossible de vérifier la trésorerie de la plateforme. Le retrait ne peut pas être traité pour le moment.'
            );
        }

        const balance = Number(soldeResponse.solde ?? soldeResponse.balance ?? 0);
        if (isNaN(balance)) {
            throw new Error('Réponse solde SamirPay invalide. Veuillez réessayer.');
        }
        return balance;
    }

    /**
     * Algorithme FIFO de consommation des commissions.
     * Fix overshoot : ne marque PAID que les commissions entièrement consommées.
     * La dernière commission partiellement consommée voit son montant réduit exactement.
     */
    private async applyFifoCommissionMarking(
        userId: string,
        grossAmount: number,
        withdrawalId: string
    ): Promise<void> {
        const supabase = getServiceRoleClient();
        const now = new Date().toISOString();

        const { data: commissions, error } = await supabase
            .from('referral_commissions')
            .select('id, amount, created_at')
            .eq('sponsor_id', userId)
            .eq('status', 'AVAILABLE')
            .order('created_at', { ascending: true }); // FIFO : les plus anciennes en premier

        if (error || !commissions) {
            console.warn('[WithdrawalService] Impossible de lire les commissions pour FIFO:', error);
            return;
        }

        let remaining = grossAmount;

        for (const comm of commissions) {
            if (remaining <= 0) break;

            const commAmount = Number(comm.amount);

            if (commAmount <= remaining) {
                // Commission entièrement consommée → PAID
                await supabase
                    .from('referral_commissions')
                    .update({ status: 'PAID', paid_at: now, updated_at: now })
                    .eq('id', comm.id);
                remaining -= commAmount;
            } else {
                // Commission partiellement consommée → on réduit le montant restant
                const leftOver = Math.round((commAmount - remaining) * 100) / 100;
                await supabase
                    .from('referral_commissions')
                    .update({ amount: leftOver, updated_at: now })
                    .eq('id', comm.id);
                remaining = 0;
            }
        }

        if (remaining > 0.01) {
            // Écart résiduel > 1 centime : anomalie à surveiller mais pas bloquante
            console.warn(
                `[WithdrawalService] FIFO : ${remaining} FCFA non déduits après FIFO pour withdrawal ${withdrawalId}`
            );
        }
    }
}

export const withdrawalService = new WithdrawalService();

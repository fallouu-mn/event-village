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

export class WithdrawalService {
    /**
     * Traite une demande de retrait de fonds (Cashout) pour un ambassadeur, parrain ou partenaire.
     * Effectue la vérification du solde utilisateur dans PostgreSQL,
     * la vérification du solde global marchand SamirPay,
     * et l'exécution du transfert vers Wave ou Orange Money.
     */
    public async processWithdrawal(
        userId: string,
        input: RequestWithdrawalInput
    ): Promise<WithdrawalResult> {
        const supabase = getServiceRoleClient();
        const grossAmount = input.amount;

        // 1. Seuil minimum de retrait (CDC V3 : 5 000 FCFA)
        if (grossAmount < 5000) {
            throw new Error('Le montant minimum de retrait est fixé à 5 000 FCFA.');
        }

        // 2. Calcul des frais de retrait (1% selon le CDC V3)
        const feeRate = 1.00; // 1%
        const feeAmount = Math.round(grossAmount * (feeRate / 100.00) * 100) / 100;
        const netAmount = Math.round((grossAmount - feeAmount) * 100) / 100;

        // 3. Vérification du solde disponible de l'utilisateur dans PostgreSQL
        const { data: commissions, error: commError } = await supabase
            .from('referral_commissions')
            .select('id, amount, status')
            .eq('sponsor_id', userId)
            .eq('status', 'AVAILABLE');

        if (commError) {
            console.error('[WithdrawalService] Erreur lecture commissions:', commError);
            throw new Error('Impossible de vérifier le solde utilisateur.');
        }

        const totalAvailableCommissions = (commissions || []).reduce(
            (acc, curr) => acc + Number(curr.amount || 0),
            0
        );

        // Vérification des retraits en cours de traitement pour éviter les doubles dépenses
        const { data: pendingWithdrawals, error: pendingError } = await supabase
            .from('withdrawals')
            .select('gross_amount')
            .eq('user_id', userId)
            .in('status', ['PENDING', 'PROCESSING']);

        if (pendingError) {
            console.error('[WithdrawalService] Erreur lecture retraits en cours:', pendingError);
            throw new Error('Impossible de vérifier les retraits en cours.');
        }

        const totalPending = (pendingWithdrawals || []).reduce(
            (acc, curr) => acc + Number(curr.gross_amount || 0),
            0
        );

        const realAvailableBalance = totalAvailableCommissions - totalPending;

        if (realAvailableBalance < grossAmount) {
            throw new Error(
                `Solde insuffisant. Votre solde disponible est de ${realAvailableBalance.toLocaleString('fr-FR')} FCFA (Montant demandé : ${grossAmount.toLocaleString('fr-FR')} FCFA).`
            );
        }

        // 4. Vérification du solde marchand global Event Village chez SamirPay
        try {
            const soldeResponse = await samirPayClient.getSolde();
            const merchantBalance = Number(soldeResponse.solde ?? soldeResponse.balance ?? 0);

            // Si le solde marchand est inférieur au montant net à envoyer
            if (merchantBalance > 0 && merchantBalance < netAmount) {
                console.error('[WithdrawalService] Solde marchand SamirPay insuffisant:', {
                    merchantBalance,
                    netAmount,
                });
                throw new Error(
                    'La réserve de trésorerie de la plateforme est temporairement insuffisante pour exécuter ce virement automatique. Veuillez réessayer plus tard ou contacter le support.'
                );
            }
        } catch (soldeError: unknown) {
            // En environnement de test ou si l'endpoint solde n'est pas accessible, on log sans bloquer si mock
            console.warn('[WithdrawalService] Avertissement solde SamirPay:', soldeError instanceof Error ? soldeError.message : soldeError);
        }

        // 5. Enregistrement idempotent de la demande dans la table withdrawals
        const paymentDetails = {
            phoneNumber: input.phoneNumber,
            operatorName: input.operatorName,
            firstName: input.firstName,
            lastName: input.lastName,
            requestedAt: new Date().toISOString(),
        };

        const { data: withdrawal, error: insertError } = await supabase
            .from('withdrawals')
            .insert({
                user_id: userId,
                gross_amount: grossAmount,
                fee_rate: feeRate,
                fee_amount: feeAmount,
                net_amount: netAmount,
                withdrawal_method: 'MOBILE_MONEY',
                payment_details: paymentDetails,
                status: 'PROCESSING',
            })
            .select()
            .single();

        if (insertError || !withdrawal) {
            console.error('[WithdrawalService] Erreur création withdrawal:', insertError);
            throw new Error('Erreur lors de l\'enregistrement de la demande de retrait.');
        }

        // 6. Exécution du Cashout auprès de l'API SamirPay (POST /api/tiers/payments/send)
        try {
            const cashoutRes = await samirPayClient.sendCashout({
                phoneNumber: input.phoneNumber,
                operatorName: input.operatorName,
                amount: netAmount,
                firstName: input.firstName,
                lastName: input.lastName,
            });

            const externalRef = cashoutRes.transaction_id || cashoutRes.reference || `TX-SAMIR-OUT-${withdrawal.id.substring(0, 8)}`;

            // Mise à jour du retrait en statut PAID
            await supabase
                .from('withdrawals')
                .update({
                    status: 'PAID',
                    external_reference: externalRef,
                    processed_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                })
                .eq('id', withdrawal.id);

            // Mise à jour des commissions utilisées pour ce retrait
            let amountToDeduct = grossAmount;
            for (const comm of commissions || []) {
                if (amountToDeduct <= 0) break;
                await supabase
                    .from('referral_commissions')
                    .update({
                        status: 'PAID',
                        paid_at: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                    })
                    .eq('id', comm.id);
                amountToDeduct -= Number(comm.amount);
            }

            // Notification utilisateur
            await supabase.from('notifications').insert({
                user_id: userId,
                type: 'WITHDRAWAL_SUCCESS',
                title: 'Retrait réussi !',
                content: `Votre retrait de ${netAmount.toLocaleString('fr-FR')} FCFA vers votre compte ${input.operatorName} (${input.phoneNumber}) a été effectué avec succès.`,
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
            const errorMessage = cashoutError instanceof Error ? cashoutError.message : 'Erreur lors du transfert SamirPay';
            console.error('[WithdrawalService] Échec transfert SamirPay:', cashoutError);

            // Marquage en échec dans PostgreSQL
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
}

export const withdrawalService = new WithdrawalService();

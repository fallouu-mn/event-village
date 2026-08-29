import { NextRequest, NextResponse } from 'next/server';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { samirPayClient } from '@/lib/samirpay/client';
import { mapSamirPayStatus } from '@/lib/samirpay/types';

export const dynamic = 'force-dynamic';

export async function GET(
    req: NextRequest,
    { params }: { params: { transactionId: string } }
) {
    try {
        const transactionId = params.transactionId;
        if (!transactionId) {
            return NextResponse.json(
                { success: false, error: 'Identifiant de transaction manquant.' },
                { status: 400 }
            );
        }

        const supabase = getServiceRoleClient();

        // 1. Consultation en base PostgreSQL
        const { data: payment, error } = await supabase
            .from('payments')
            .select('id, transaction_id, external_order_id, external_transaction_id, client_id, amount, currency, status, provider_status, paid_at, created_at')
            .or(`transaction_id.eq.${transactionId},external_order_id.eq.${transactionId}`)
            .single();

        if (error || !payment) {
            return NextResponse.json(
                { success: false, error: 'Paiement introuvable.' },
                { status: 404 }
            );
        }

        // 2. Si le statut est encore PENDING, vérification de fallback auprès de SamirPay
        if (payment.status === 'PENDING' && payment.external_order_id) {
            try {
                const checkRes = await samirPayClient.checkTransactionStatus(payment.external_order_id);
                if (checkRes && checkRes.status) {
                    const mapped = mapSamirPayStatus(checkRes.status);
                    if (mapped === 'SUCCESS') {
                        // Mise à jour de confirmation
                        await supabase
                            .from('payments')
                            .update({
                                status: 'SUCCESS',
                                external_transaction_id: checkRes.transaction_id || payment.external_transaction_id,
                                provider_status: checkRes.status,
                                paid_at: new Date().toISOString(),
                                updated_at: new Date().toISOString(),
                            })
                            .eq('id', payment.id);

                        payment.status = 'SUCCESS';
                    }
                }
            } catch (fallbackError) {
                // Silently keep current DB status if SamirPay check fails temporarily
                console.warn('[PaymentStatusFallback] Erreur vérification statut auprès de SamirPay', fallbackError);
            }
        }

        return NextResponse.json({
            success: true,
            payment: {
                id: payment.id,
                transaction_id: payment.transaction_id,
                order_id: payment.external_order_id,
                status: payment.status,
                amount: payment.amount,
                currency: payment.currency,
                paid_at: payment.paid_at,
            },
        });
    } catch (error: unknown) {
        console.error('[API /api/payments/[transactionId]/status] Erreur:', error);
        return NextResponse.json(
            { success: false, error: error instanceof Error ? error.message : 'Erreur interne serveur.' },
            { status: 500 }
        );
    }
}

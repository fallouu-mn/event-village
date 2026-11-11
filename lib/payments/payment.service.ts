/**
 * Service de paiement — cibles hors billetterie (commande, réservation de salle ou de table,
 * abonnement). Lot 2 : la billetterie passe par lib/payments/checkout.service.ts ; confirmation,
 * webhook et réconciliation par lib/payments/confirmation.service.ts et webhook.service.ts.
 * Initiation conforme au contrat SamirPay : cashin direct, opérateur Wave ou Orange Money et
 * téléphone payeur (9 chiffres) obligatoires et persistés, callBackUrl portant un jeton propre au
 * paiement. Le montant est toujours relu en base ; le calcul des frais est inchangé (lot 3).
 */
import crypto from 'node:crypto';
import { PublicError } from '@/lib/api/public-error';
import { getServerEnv } from '@/lib/env';
import { samirPayClient } from '@/lib/samirpay/client';
import { isSamirPayError } from '@/lib/samirpay/types';
import { getServiceRoleClient } from '@/lib/supabase/server';
import type { CreatePaymentInput } from '@/lib/validations/payment';
import { hashCallbackToken, paymentView } from './checkout.service';
import { computeBreakdown, readFinanceSetting, type FinanceTarget } from '@/lib/finance/engine';
import { normalizePayerPhone } from './payer-phone';
import { rpcWithRetry } from './rpc';

export class PaymentInputError extends Error {
    constructor(message: string, readonly code: string, readonly httpStatus = 400) {
        super(message);
        this.name = 'PaymentInputError';
    }
}

export class PaymentService {
    /**
     * Crée et initie le paiement d'une cible hors billetterie. Le montant est récupéré en base,
     * jamais fourni par le client.
     */
    public async createPayment(userId: string, input: CreatePaymentInput): Promise<Record<string, unknown>> {
        if (input.targetType === 'TICKET') {
            throw new PaymentInputError('Les billets se paient par le checkout.', 'USE_TICKET_CHECKOUT');
        }
        const supabase = getServiceRoleClient();
        const env = getServerEnv();

        let payableAmount = 0;
        let partnerId: string | null = null;
        let orderRefId: string | null = null;
        let hallResRefId: string | null = null;
        let tableResRefId: string | null = null;
        let subscriptionRefId: string | null = null;
        let description = '';

        // 1. Récupération et vérification du montant réel depuis PostgreSQL
        switch (input.targetType) {
            case 'ORDER': {
                const { data: order, error } = await supabase
                    .from('orders')
                    .select('*')
                    .eq('id', input.targetId)
                    .single();

                if (error || !order) {
                    throw new PublicError('Commande introuvable.');
                }
                if (order.client_id !== userId) {
                    throw new PublicError('Non autorisé : Cette commande appartient à un autre utilisateur.');
                }
                if (order.payment_status === 'SUCCESS') {
                    throw new PublicError('Cette commande est déjà entièrement payée.');
                }
                if (order.order_status === 'ANNULEE' || order.order_status === 'REJETEE') {
                    throw new PublicError('Cette commande est annulée ou rejetée.');
                }

                // Vérification des produits interdits / suspendus à la vente en ligne (§CDC V3.0)
                const { data: orderItems } = await supabase
                    .from('order_items')
                    .select('product_id, products(status)')
                    .eq('order_id', order.id);

                if (orderItems && orderItems.some((item: any) => item.products?.status === 'SUSPENDU' || item.products?.status === 'INDISPONIBLE')) {
                    throw new PublicError('Paiement en ligne refusé : La commande contient des produits interdits ou indisponibles à la vente en ligne.');
                }

                payableAmount = Number(order.balance_amount > 0 ? order.balance_amount : order.total_amount);
                partnerId = order.partner_id;
                orderRefId = order.id;
                description = `Commande ${order.order_number}`;
                break;
            }

            case 'HALL_RESERVATION': {
                const { data: reservation, error } = await supabase
                    .from('hall_reservations')
                    .select('*')
                    .eq('id', input.targetId)
                    .single();

                if (error || !reservation) {
                    throw new PublicError('Réservation de salle introuvable.');
                }
                if (reservation.client_id !== userId) {
                    throw new PublicError('Non autorisé : Réservation appartenant à un autre utilisateur.');
                }
                if (reservation.payment_status === 'SUCCESS') {
                    throw new PublicError('Cette réservation de salle est déjà payée.');
                }

                payableAmount = Number(
                    reservation.balance_amount > 0
                        ? reservation.balance_amount
                        : (reservation.deposit_amount > 0 ? reservation.deposit_amount : reservation.total_amount)
                );
                partnerId = reservation.partner_id;
                hallResRefId = reservation.id;
                description = `Réservation Salle - ${reservation.start_date}`;
                break;
            }

            case 'TABLE_RESERVATION': {
                const { data: tableRes, error } = await supabase
                    .from('table_reservations')
                    .select('*')
                    .eq('id', input.targetId)
                    .single();

                if (error || !tableRes) {
                    throw new PublicError('Réservation de table introuvable.');
                }
                if (tableRes.client_id !== userId) {
                    throw new PublicError('Non autorisé : Réservation appartenant à un autre utilisateur.');
                }
                if (tableRes.payment_status === 'SUCCESS') {
                    throw new PublicError('Cette réservation de table est déjà payée.');
                }

                payableAmount = Number(tableRes.deposit_amount > 0 ? tableRes.deposit_amount : 0);
                partnerId = tableRes.partner_id;
                tableResRefId = tableRes.id;
                description = `Réservation Table - ${tableRes.reservation_date}`;
                break;
            }

            case 'SUBSCRIPTION': {
                const { data: plan, error } = await supabase
                    .from('subscription_plans')
                    .select('*')
                    .eq('id', input.targetId)
                    .single();

                if (error || !plan) {
                    throw new PublicError('Plan d\'abonnement introuvable.');
                }

                // Lot 9 bis (R8, B25) : un abonnement ne s'achète que sur un dossier partenaire VALIDE ; rien
                // n'est créé sinon. Le paiement n'écrit jamais le statut du dossier (activateSubscription).
                const { data: partnerRec, error: partnerErr } = await supabase
                    .from('partners')
                    .select('id, status')
                    .eq('user_id', userId)
                    .maybeSingle();
                if (partnerErr) throw new Error(`Lecture de la fiche partenaire impossible : ${partnerErr.message}`);
                if (!partnerRec || partnerRec.status !== 'VALIDE') {
                    throw new PaymentInputError('Abonnement réservé aux comptes partenaires validés.', 'PARTNER_NOT_VALIDATED', 403);
                }
                partnerId = partnerRec.id;

                payableAmount = Number(plan.price);
                subscriptionRefId = plan.id;
                description = `Abonnement ${plan.name}`;
                break;
            }

            default:
                throw new PublicError('Type de cible de paiement non supporté.');
        }

        if (payableAmount <= 0) {
            throw new PaymentInputError('Le montant à régler doit être supérieur à zéro.', 'NOTHING_TO_PAY');
        }
        const payerPhone = normalizePayerPhone(input.payerPhone);
        if (!payerPhone) {
            throw new PaymentInputError('Numéro du payeur invalide (mobile sénégalais, 9 chiffres).', 'INVALID_PAYER_PHONE');
        }

        // 2. Répartition par le moteur financier unique (lot 3) : frais de service à la charge de
        //    l'acheteur pour les cibles marché, aucun pour un abonnement ; taux recopiés sur le paiement.
        const fees = await computeBreakdown(input.targetType as FinanceTarget, [{ unit_price: payableAmount, quantity: 1 }], input.operator);
        const delayHours = await readFinanceSetting<number>('finance.payout_delay_hours');
        const holdEnabled = await readFinanceSetting<boolean>('finance.payout_hold_enabled');

        // 3. Paiement PENDING, opérateur et téléphone payeur persistés, empreinte du jeton de callback
        const ms = Date.now();
        const suffix = crypto.randomBytes(4).toString('hex').toUpperCase();
        const externalOrderId = `ORD-EV-${ms}-${suffix}`;
        const token = crypto.randomBytes(32).toString('base64url');
        const { data: payment, error: insErr } = await supabase.from('payments').insert({
            transaction_id: `TX-EV-${ms}-${suffix}`,
            external_order_id: externalOrderId,
            client_id: userId,
            partner_id: partnerId,
            order_id: orderRefId,
            hall_reservation_id: hallResRefId,
            table_reservation_id: tableResRefId,
            subscription_plan_id: subscriptionRefId,
            payment_target: input.targetType,
            amount: fees.total_amount,
            facial_amount: fees.facial_amount,
            currency: 'XOF',
            is_platform_payment: true,
            aggregator: 'SAMIRPAY',
            aggregator_fee: fees.aggregator_fee,
            service_fee: fees.service_fee,
            gross_event_village_revenue: fees.gross_event_village_revenue,
            net_event_village_revenue: fees.net_event_village_revenue,
            partner_payout_amount: fees.partner_payout_amount,
            service_fee_rate: fees.service_fee_rate,
            aggregator_fee_rate: fees.aggregator_fee_rate,
            payout_delay_hours: delayHours,
            payout_hold_enabled: holdEnabled,
            status: 'PENDING',
            idempotency_key: `IDEMP-${externalOrderId}`,
            operator: input.operator,
            payer_phone: payerPhone,
            callback_token_hash: hashCallbackToken(token),
            metadata: { target_type: input.targetType, target_id: input.targetId },
        }).select('*').single();
        if (insErr || !payment) throw new Error(`Création du paiement impossible : ${insErr?.message}`);

        // 4. Cashin direct SamirPay
        try {
            const init = await samirPayClient.initDirectPayment({
                amount: fees.total_amount,
                orderId: externalOrderId,
                callBackUrl: `${env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, '')}/api/webhooks/samirpay?t=${token}`,
                operatorName: input.operator,
                telephone: payerPhone,
                description: description.slice(0, 100),
            });
            const { data: updated, error: updErr } = await supabase.from('payments')
                .update({ external_transaction_id: init.transactionId, provider_response: { paymentUrl: init.paymentUrl, deepLinks: init.deepLinks, qrCode: init.qrCode }, provider_status: 'INIT_ACCEPTED' })
                .eq('id', payment.id).eq('status', 'PENDING').select('*').single();
            if (updErr || !updated) throw new Error(`Enregistrement de l'identifiant SamirPay impossible : ${updErr?.message ?? 'paiement introuvable'}`);
            return paymentView(updated);
        } catch (err) {
            const kind = isSamirPayError(err) ? err.kind : 'INTERNAL';
            const { error: relErr } = await rpcWithRetry('payment_release', { p_payment_id: payment.id, p_status: 'FAILED', p_reason: `INIT_${kind}` });
            if (relErr) console.error(`[PaymentService] paiement ${payment.id} non marqué FAILED :`, relErr.message);
            if (kind === 'INTERNAL') throw err;
            throw new PaymentInputError(kind === 'REJECTED' ? 'Paiement refusé par l’opérateur.' : 'Le service de paiement ne répond pas : réessayez.', `PAYMENT_PROVIDER_${kind}`, 502);
        }
    }

    /**
     * Expire automatiquement les réservations en moratoire dont la date limite est dépassée
     */
    public async expireOverdueMoratoriums(): Promise<{ expiredCount: number; reservationIds: string[] }> {
        const supabase = getServiceRoleClient();
        const today = new Date().toISOString().split('T')[0];

        const { data: expiredReservations, error } = await supabase
            .from('hall_reservations')
            .select('id, hall_id, partner_id, client_id, moratorium_date')
            .lt('moratorium_date', today)
            .neq('payment_status', 'SUCCESS')
            .eq('status', 'EN_ATTENTE');

        if (error || !expiredReservations || expiredReservations.length === 0) {
            return { expiredCount: 0, reservationIds: [] };
        }

        const ids = expiredReservations.map(r => r.id);

        await supabase
            .from('hall_reservations')
            .update({
                status: 'ANNULEE',
                payment_status: 'CANCELLED',
                updated_at: new Date().toISOString(),
            })
            .in('id', ids);

        return { expiredCount: ids.length, reservationIds: ids };
    }
}

export const paymentService = new PaymentService();

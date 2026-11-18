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
import { cashinReturnUrls, initCashinOnce, initFailureOf, recordAdoptedInit } from './cashin-init';
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
        const hallResRefId: string | null = null;
        const tableResRefId: string | null = null;
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
                // Lot 10a (S4) : un paiement de salle passe par startHallPayment (hall_payment_create, montant relu sur
                // la réservation : acompte, solde ou totalité) ; ce chemin générique payait le solde avant l'acompte.
                throw new PaymentInputError('Choisissez de payer l’acompte, le solde ou la totalité de la réservation.', 'INVALID_PART');
            }
            case 'TABLE_RESERVATION': {
                // Lot 11a (T3) : un paiement de table passe par startTablePayment (table_payment_create, montant relu sur
                // la réservation) ; ce chemin générique lisait un acompte écrit par la route (5 000 F par personne en dur).
                throw new PaymentInputError('Le paiement de cette réservation se fait depuis la réservation.', 'INVALID_TARGET');
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

        // 4. Cashin direct SamirPay. Lot 9 bis (H4) : une seule relance au même orderId sur un délai dépassé ; 409
        //    porteur de l'identifiant → transaction adoptée, paiement rendu et surveillé, aucun lien pour le client.
        try {
            const outcome = await initCashinOnce({
                amount: fees.total_amount,
                orderId: externalOrderId,
                callBackUrl: `${env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, '')}/api/webhooks/samirpay?t=${token}`,
                operatorName: input.operator,
                telephone: payerPhone,
                description: description.slice(0, 100),
                // Lot 9 ter (0.4) : retour du client vers /paiement/<id>, en https seulement
                ...cashinReturnUrls(env.NEXT_PUBLIC_APP_URL, payment.id),
            });
            if (outcome.kind === 'INITIATED') {
                const init = outcome.init;
                const { data: updated, error: updErr } = await supabase.from('payments')
                    .update({ external_transaction_id: init.transactionId, provider_response: { paymentUrl: init.paymentUrl, deepLinks: init.deepLinks, qrCode: init.qrCode }, provider_status: 'INIT_ACCEPTED' })
                    .eq('id', payment.id).eq('status', 'PENDING').select('*').single();
                if (updErr || !updated) throw new Error(`Enregistrement de l'identifiant SamirPay impossible : ${updErr?.message ?? 'paiement introuvable'}`);
                return paymentView(updated);
            }
            await recordAdoptedInit(payment.id, outcome.transactionId);
        } catch (err) {
            // Lot 9 bis (H8) : un 5xx de SamirPay donne PAYMENT_PROVIDER_INTERNAL ; seul un refus explicite est définitif.
            const failure = initFailureOf(err);
            const { error: relErr } = await rpcWithRetry('payment_release', { p_payment_id: payment.id, p_status: 'FAILED', p_reason: failure?.reason ?? 'INIT_INTERNAL' });
            if (relErr) console.error(`[PaymentService] paiement ${payment.id} non marqué FAILED :`, relErr.message);
            if (!failure) throw err;
            throw new PaymentInputError(failure.message, failure.code, 502);
        }
        // Transaction existante adoptée : aucun lien pour le client, le paiement rendu reste surveillé.
        throw new PaymentInputError('Le service de paiement ne répond pas : réessayez.', 'PAYMENT_PROVIDER_UNCERTAIN', 502);
    }
}

export const paymentService = new PaymentService();

/**
 * Service Métier de Paiement — Event Village.
 * Centralise l'orchestration des paiements, le calcul strict des montants/frais
 * depuis PostgreSQL, l'appel à SamirPay et le traitement idempotent des webhooks.
 */

import { samirPayClient } from '@/lib/samirpay/client';
import { mapSamirPayStatus } from '@/lib/samirpay/types';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { CreatePaymentInput, SamirPayWebhookSchema } from '@/lib/validations/payment';
import { EventService } from '@/lib/events/event.service';
import crypto from 'crypto';

export interface CreatePaymentResult {
    success: boolean;
    payment_id: string;
    order_id: string;
    transaction_id: string;
    payment_url?: string;
    redirect_url?: string;   // Deep link OM ou Wave (data.urls.OM / data.urls.WAVE)
    qr_code?: string;        // QR Code base64 pour paiement Desktop
    is_push_ussd?: boolean;
    amount: number;
    currency: string;
    status: string;
}

export class PaymentService {
    /**
     * Crée une transaction de paiement sécurisée côté serveur.
     * Le montant est obligatoirement récupéré depuis la base de données.
     */
    public async createPayment(userId: string, input: CreatePaymentInput): Promise<CreatePaymentResult> {
        const supabase = getServiceRoleClient();

        let payableAmount = 0;
        let partnerId: string | null = null;
        let orderRefId: string | null = null;
        let hallResRefId: string | null = null;
        let tableResRefId: string | null = null;
        let ticketRefId: string | null = null;
        let eventRefId: string | null = null;
        let categoryRefId: string | null = null;
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
                    throw new Error('Commande introuvable.');
                }
                if (order.client_id !== userId) {
                    throw new Error('Non autorisé : Cette commande appartient à un autre utilisateur.');
                }
                if (order.payment_status === 'SUCCESS') {
                    throw new Error('Cette commande est déjà entièrement payée.');
                }
                if (order.order_status === 'ANNULEE' || order.order_status === 'REJETEE') {
                    throw new Error('Cette commande est annulée ou rejetée.');
                }

                // Vérification des produits interdits / suspendus à la vente en ligne (§CDC V3.0)
                const { data: orderItems } = await supabase
                    .from('order_items')
                    .select('product_id, products(status)')
                    .eq('order_id', order.id);

                if (orderItems && orderItems.some((item: any) => item.products?.status === 'SUSPENDU' || item.products?.status === 'INDISPONIBLE')) {
                    throw new Error('Paiement en ligne refusé : La commande contient des produits interdits ou indisponibles à la vente en ligne.');
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
                    throw new Error('Réservation de salle introuvable.');
                }
                if (reservation.client_id !== userId) {
                    throw new Error('Non autorisé : Réservation appartenant à un autre utilisateur.');
                }
                if (reservation.payment_status === 'SUCCESS') {
                    throw new Error('Cette réservation de salle est déjà payée.');
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
                    throw new Error('Réservation de table introuvable.');
                }
                if (tableRes.client_id !== userId) {
                    throw new Error('Non autorisé : Réservation appartenant à un autre utilisateur.');
                }
                if (tableRes.payment_status === 'SUCCESS') {
                    throw new Error('Cette réservation de table est déjà payée.');
                }

                payableAmount = Number(tableRes.deposit_amount > 0 ? tableRes.deposit_amount : 0);
                partnerId = tableRes.partner_id;
                tableResRefId = tableRes.id;
                description = `Réservation Table - ${tableRes.reservation_date}`;
                break;
            }

            case 'TICKET': {
                // Vérifie d'abord si input.targetId est un ticket_id existant ou une ticket_category_id
                const { data: ticket } = await supabase
                    .from('tickets')
                    .select('*, events(partner_id)')
                    .eq('id', input.targetId)
                    .maybeSingle();

                if (ticket) {
                    if (ticket.user_id !== userId) {
                        throw new Error('Non autorisé.');
                    }
                    if (ticket.status === 'VALIDE' || ticket.status === 'UTILISE') {
                        throw new Error('Ce ticket est déjà validé.');
                    }
                    payableAmount = Number(ticket.price);
                    partnerId = ticket.events?.partner_id || null;
                    ticketRefId = ticket.id;
                    eventRefId = ticket.event_id;
                    categoryRefId = ticket.category_id;
                    description = `Ticket ${ticket.ticket_number}`;
                } else {
                    // C'est un achat direct via ticket_category
                    const { data: category, error: catError } = await supabase
                        .from('ticket_categories')
                        .select('*, events(id, title, partner_id, status)')
                        .eq('id', input.targetId)
                        .single();

                    if (catError || !category) {
                        throw new Error('Catégorie de ticket introuvable.');
                    }

                    const eventStatus = (category.events as any)?.status;
                    if (eventStatus !== 'PUBLIE') {
                        if (eventStatus === 'SUSPENDU') {
                            throw new Error('Cet événement est temporairement suspendu. La billetterie est indisponible.');
                        }
                        throw new Error('La billetterie de cet événement n\'est pas disponible.');
                    }

                    if (!category.is_active) {
                        throw new Error('Cette catégorie de ticket n\'est plus disponible à la vente.');
                    }

                    if (category.sold_quantity >= category.total_quantity) {
                        throw new Error('Cette catégorie de ticket est épuisée.');
                    }

                    payableAmount = Number(category.price);
                    partnerId = category.events?.partner_id || null;
                    eventRefId = category.event_id;
                    categoryRefId = category.id;
                    description = `Ticket ${category.events?.title || ''} - ${category.name}`;
                }
                break;
            }

            case 'SUBSCRIPTION': {
                const { data: plan, error } = await supabase
                    .from('subscription_plans')
                    .select('*')
                    .eq('id', input.targetId)
                    .single();

                if (error || !plan) {
                    throw new Error('Plan d\'abonnement introuvable.');
                }

                const { data: partnerRec } = await supabase
                    .from('partners')
                    .select('id')
                    .eq('user_id', userId)
                    .maybeSingle();

                if (partnerRec) {
                    partnerId = partnerRec.id;
                }

                payableAmount = Number(plan.price);
                subscriptionRefId = plan.id;
                description = `Abonnement ${plan.name}`;
                break;
            }

            default:
                throw new Error('Type de cible de paiement non supporté.');
        }

        if (payableAmount <= 0) {
            throw new Error('Le montant à régler doit être supérieur à zéro.');
        }

        // 2. Lecture des taux depuis platform_settings (jamais hardcodés côté service)
        const { data: ticketingConfig, error: ticketingConfigError } = await supabase
            .from('platform_settings')
            .select('value')
            .eq('key', 'ticketing_fee_config')
            .maybeSingle();

        if (ticketingConfigError || !ticketingConfig?.value?.service_fee_rate || !ticketingConfig?.value?.aggregator_fee_rate) {
            console.error('[PaymentService] ticketing_fee_config manquant en DB:', ticketingConfigError);
            throw new Error('Configuration des frais de paiement manquante. Contactez le support.');
        }

        // Taux en pourcentage (ex: 5.0) → fraction (0.05)
        const serviceFeeRate = Number(ticketingConfig.value.service_fee_rate) / 100;
        const aggregatorFeeRate = Number(ticketingConfig.value.aggregator_fee_rate) / 100;

        const aggregatorFee = Math.round(payableAmount * aggregatorFeeRate * 100) / 100;
        let serviceFee = Math.round(payableAmount * serviceFeeRate * 100) / 100;
        let grossRevenue = serviceFee;
        let netRevenue = Math.max(0, grossRevenue - aggregatorFee);
        let partnerPayout = Math.max(0, payableAmount - serviceFee);

        // Cas particulier : Les abonnements vont à 100% à la plateforme Event Village
        if (input.targetType === 'SUBSCRIPTION') {
            serviceFee = 0;
            grossRevenue = payableAmount;
            netRevenue = Math.max(0, grossRevenue - aggregatorFee);
            partnerPayout = 0;
        }

        // 3. Génération d'identifiants uniques
        const now = Date.now();
        const randomSuffix = crypto.randomBytes(3).toString('hex').toUpperCase();
        const internalTransactionId = `TX-EV-${now}-${randomSuffix}`;
        const externalOrderId = `ORD-EV-${now}-${randomSuffix}`;

        // 4. Création de l'enregistrement de paiement avec statut PENDING
        const { data: paymentRecord, error: insertError } = await supabase
            .from('payments')
            .insert({
                transaction_id: internalTransactionId,
                external_order_id: externalOrderId,
                client_id: userId,
                partner_id: partnerId,
                order_id: orderRefId,
                hall_reservation_id: hallResRefId,
                table_reservation_id: tableResRefId,
                ticket_id: ticketRefId,
                subscription_plan_id: subscriptionRefId,
                payment_target: input.targetType,
                amount: payableAmount,
                currency: 'XOF',
                is_platform_payment: true,
                aggregator: 'SAMIRPAY',
                aggregator_fee: aggregatorFee,
                service_fee: serviceFee,
                gross_event_village_revenue: grossRevenue,
                net_event_village_revenue: netRevenue,
                partner_payout_amount: partnerPayout,
                status: 'PENDING',
                idempotency_key: `IDEMP-${externalOrderId}`,
                metadata: {
                    target_type: input.targetType,
                    target_id: input.targetId,
                    event_id: eventRefId,
                    category_id: categoryRefId,
                    customer_phone: input.customerPhone,
                },
            })
            .select('*')
            .single();

        if (insertError || !paymentRecord) {
            console.error('[PaymentService] Erreur création enregistrement paiement', insertError);
            throw new Error('Impossible d\'enregistrer l\'intention de paiement.');
        }

        // 5. Appel à l'API SamirPay côté serveur (Cashin Direct)
        const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://eventvillage.sn').replace(/\/+$/, '');
        const callbackUrl = `${appUrl}/api/webhooks/samirpay`;
        const returnUrl = input.returnUrl || `${appUrl}/tickets`;
        const cancelUrl = input.cancelUrl || `${appUrl}/explore`;

        // Normalisation du numéro en deux formats requis par SamirPay
        const rawPhone = (input.customerPhone || '').replace(/\s/g, '');
        const fullIntlPhone = rawPhone.startsWith('+221') ? rawPhone
            : rawPhone.startsWith('221') ? `+${rawPhone}`
            : rawPhone.length > 0 ? `+221${rawPhone}` : '';
        const barePhone = fullIntlPhone.replace(/^\+221/, ''); // ex: 771234567

        const samirPayOperator = input.operator || 'WAVE'; // 'ORANGE_MONEY' / 'WAVE' envoyé tel quel

        let samirPayResponse;
        try {
            samirPayResponse = await samirPayClient.initPayment({
                amount: payableAmount,
                currency: 'XOF',
                order_id: externalOrderId,
                operatorName: samirPayOperator,
                description,
                customer: {
                    phone: fullIntlPhone,
                    name: input.customerName || 'Client Event Village',
                    email: input.customerEmail,
                },
                barePhone,
                fullIntlPhone,
                return_url: returnUrl,
                cancel_url: cancelUrl,
                callback_url: callbackUrl,
            });
        } catch (apiError: unknown) {
            await supabase
                .from('payments')
                .update({
                    status: 'FAILED',
                    provider_status: 'API_ERROR',
                    provider_response: { error: apiError instanceof Error ? apiError.message : 'Unknown error' },
                })
                .eq('id', paymentRecord.id);

            throw apiError;
        }

        // 6. Analyse complète de la réponse SamirPay
        const externalTransactionId = samirPayResponse.transaction_id || samirPayResponse.data?.transaction_id;
        const paymentUrl = samirPayResponse.payment_url || samirPayResponse.data?.payment_url || samirPayResponse.data?.url;
        const responseBodyStatus = (samirPayResponse.status || '').toLowerCase();
        const responseBodyMessage = (samirPayResponse.message as string)
            || (samirPayResponse.data?.message as string)
            || '';
        // URLs de secours retournées par SamirPay dans data.urls (deep link OM / Wave)
        const responseUrls: Record<string, string> =
            (samirPayResponse.data?.urls as Record<string, string>)
            || (samirPayResponse.urls as Record<string, string>)
            || {};
        const omRedirectUrl: string | null =
            responseUrls['OM'] || responseUrls['MAXIT'] || responseUrls['OM_URL'] || null;

        // QR Code retourné par SamirPay (base64 ou URL) — utilisé sur Desktop
        const qrCode: string | null =
            (samirPayResponse.qr_code as string)
            || (samirPayResponse.data?.qr_code as string)
            || (samirPayResponse.qrCode as string)
            || (samirPayResponse.data?.qrCode as string)
            || (samirPayResponse.qr as string)
            || (samirPayResponse.data?.qr as string)
            || null;

        // Log exhaustif — montre l'intégralité de la réponse SamirPay pour diagnostic OM
        console.log('[PaymentService] SamirPay response analysis:', {
            operator: input.operator,
            samirpay_operator_sent: samirPayOperator,
            order_id: externalOrderId,
            body_status: samirPayResponse.status || 'ABSENT',
            body_message: responseBodyMessage || 'ABSENT',
            has_payment_url: !!paymentUrl,
            has_transaction_id: !!externalTransactionId,
            transaction_id: externalTransactionId || 'ABSENT',
            response_keys: Object.keys(samirPayResponse).join(','),
        });

        // PROTECTION FAUX POSITIF CRITIQUE :
        // SamirPay peut retourner HTTP 200 avec status:'failed' (ex: "Operator not found",
        // "Invalid phone number", etc.). Sans ce check, le service croirait à tort que
        // c'est un Push USSD réussi et bloquerait le client indéfiniment sur l'écran d'attente.
        if (responseBodyStatus === 'failed' || responseBodyStatus === 'error') {
            await supabase.from('payments').update({
                status: 'FAILED',
                provider_status: samirPayResponse.status,
                provider_response: samirPayResponse,
            }).eq('id', paymentRecord.id);

            const userMsg = responseBodyMessage
                || 'Paiement refusé par l\'opérateur. Vérifiez votre numéro et réessayez.';
            console.error('[PaymentService] SamirPay body-level error (HTTP 200 but failed):', {
                operator: input.operator,
                samirpay_operator_sent: samirPayOperator,
                order_id: externalOrderId,
                body_status: samirPayResponse.status,
                message: userMsg,
            });
            throw new Error(userMsg);
        }

        // isPushUssd = true seulement si OM sans aucune URL disponible (ni payment_url ni omRedirectUrl).
        // Si omRedirectUrl est présent, le frontend redirigera directement → pas d'écran d'attente.
        const isPushUssd = input.operator === 'ORANGE_MONEY' && !paymentUrl && !omRedirectUrl;

        await supabase
            .from('payments')
            .update({
                external_transaction_id: externalTransactionId,
                provider_response: samirPayResponse,
            })
            .eq('id', paymentRecord.id);

        return {
            success: true,
            payment_id: paymentRecord.id,
            order_id: externalOrderId,
            transaction_id: internalTransactionId,
            payment_url: paymentUrl,
            redirect_url: omRedirectUrl || undefined,
            qr_code: qrCode || undefined,
            is_push_ussd: isPushUssd,
            amount: payableAmount,
            currency: 'XOF',
            status: 'PENDING',
        };
    }

    /**
     * Traite de façon atomique et idempotente la notification reçue via le Webhook SamirPay.
     * Le format attendu est application/x-www-form-urlencoded.
     */
    public async handleSamirPayWebhook(formData: FormData): Promise<{ success: boolean; message: string }> {
        const supabase = getServiceRoleClient();

        // 1. Extraction et validation des données du formulaire
        const rawData: Record<string, string> = {};
        formData.forEach((value, key) => {
            if (typeof value === 'string') {
                rawData[key] = value;
            }
        });

        const validationResult = SamirPayWebhookSchema.safeParse(rawData);
        if (!validationResult.success) {
            console.error('[PaymentService.Webhook] Payload webhook invalide', validationResult.error.flatten());
            return { success: false, message: 'Données webhook non conformes.' };
        }

        const { transaction_id, order_id, status } = validationResult.data;

        // 2. Recherche du paiement en base par external_order_id ou transaction_id
        const { data: payment, error: fetchError } = await supabase
            .from('payments')
            .select('*')
            .or(`external_order_id.eq.${order_id},transaction_id.eq.${order_id}`)
            .single();

        if (fetchError || !payment) {
            console.error(`[PaymentService.Webhook] Transaction introuvable pour order_id: ${order_id}`);
            return { success: false, message: 'Transaction introuvable.' };
        }

        // 3. Protection d'idempotence absolue : si déjà SUCCESS, aucun second traitement ni duplicata
        if (payment.status === 'SUCCESS') {
            console.log(`[PaymentService.Webhook] Notification déjà traitée (Idempotence) pour : ${order_id}`);
            return { success: true, message: 'Transaction déjà confirmée.' };
        }

        const mappedStatus = mapSamirPayStatus(status);

        // 4. Traitement selon le statut validé
        if (mappedStatus === 'SUCCESS') {
            let confirmedTicketId = payment.ticket_id;

            // 4.1 Génération sécurisée et garantie du ticket si nécessaire
            if (payment.payment_target === 'TICKET') {
                if (payment.ticket_id) {
                    // Ticket pré-existant -> passer à VALIDE
                    await supabase
                        .from('tickets')
                        .update({
                            status: 'VALIDE',
                            updated_at: new Date().toISOString(),
                        })
                        .eq('id', payment.ticket_id);
                } else if (payment.metadata?.event_id && payment.metadata?.category_id) {
                    try {
                        const purchaseResult = await EventService.purchaseTicketAtomic({
                            eventId: payment.metadata.event_id,
                            categoryId: payment.metadata.category_id,
                            userId: payment.client_id,
                            orderId: payment.order_id || undefined,
                            paymentConfirmed: true,
                        });
                        confirmedTicketId = purchaseResult.ticket.id;
                    } catch (ticketError) {
                        console.error('[PaymentService.Webhook] Erreur génération ticket via EventService:', ticketError);
                    }
                }
            }

            // 4.2 Activation de l'abonnement si payment_target === 'SUBSCRIPTION'
            if (payment.payment_target === 'SUBSCRIPTION' || payment.subscription_plan_id) {
                const planId = payment.subscription_plan_id || payment.metadata?.target_id;
                if (planId) {
                    const { data: plan } = await supabase
                        .from('subscription_plans')
                        .select('*')
                        .eq('id', planId)
                        .maybeSingle();

                    let targetPartnerId = payment.partner_id;
                    if (!targetPartnerId && payment.client_id) {
                        const { data: partnerRec } = await supabase
                            .from('partners')
                            .select('id, trial_ends_at')
                            .eq('user_id', payment.client_id)
                            .maybeSingle();
                        if (partnerRec) targetPartnerId = partnerRec.id;
                    }

                    if (targetPartnerId && plan) {
                        const now = new Date();
                        const durationDays = plan.billing_period === 'YEARLY' ? 365 : 30;
                        const expiresAt = new Date(now.getTime() + durationDays * 24 * 60 * 60 * 1000);

                        await supabase
                            .from('partners')
                            .update({
                                subscription_plan_id: plan.id,
                                status: 'VALIDE',
                                trial_ends_at: expiresAt.toISOString(),
                                updated_at: now.toISOString(),
                            })
                            .eq('id', targetPartnerId);

                        await supabase.from('notifications').insert({
                            user_id: payment.client_id,
                            type: 'SUBSCRIPTION_ACTIVATED',
                            title: 'Abonnement activé',
                            content: `Votre pack ${plan.name} a été activé avec succès pour ${durationDays} jours.`,
                            channel: 'PUSH',
                            status: 'PENDING',
                            metadata: { plan_id: plan.id, payment_id: payment.id },
                        });
                    }
                }
            }

            // Mise à jour de la transaction de paiement vers SUCCESS
            const { error: updatePaymentError } = await supabase
                .from('payments')
                .update({
                    status: 'SUCCESS',
                    external_transaction_id: transaction_id,
                    ticket_id: confirmedTicketId,
                    provider_status: status,
                    paid_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                })
                .eq('id', payment.id);

            if (updatePaymentError) {
                console.error('[PaymentService.Webhook] Erreur mise à jour payment', updatePaymentError);
                throw new Error('Erreur mise à jour paiement.');
            }

            // Mise à jour des commandes associées
            if (payment.order_id) {
                await supabase
                    .from('orders')
                    .update({
                        payment_status: 'SUCCESS',
                        order_status: 'CONFIRMEE',
                        paid_amount: payment.amount,
                        balance_amount: 0,
                        updated_at: new Date().toISOString(),
                    })
                    .eq('id', payment.order_id);
            }

            // Mise à jour des réservations de salle
            if (payment.hall_reservation_id) {
                await supabase
                    .from('hall_reservations')
                    .update({
                        payment_status: 'SUCCESS',
                        status: 'CONFIRMEE',
                        updated_at: new Date().toISOString(),
                    })
                    .eq('id', payment.hall_reservation_id);
            }

            // Mise à jour des réservations de table
            if (payment.table_reservation_id) {
                await supabase
                    .from('table_reservations')
                    .update({
                        payment_status: 'SUCCESS',
                        status: 'CONFIRMEE',
                        updated_at: new Date().toISOString(),
                    })
                    .eq('id', payment.table_reservation_id);
            }

            // Notification client de succès
            await supabase.from('notifications').insert({
                user_id: payment.client_id,
                type: 'PAYMENT_SUCCESS',
                title: 'Paiement confirmé',
                content: `Votre paiement de ${payment.amount} ${payment.currency} a été validé avec succès.`,
                channel: 'PUSH',
                status: 'PENDING',
                metadata: { payment_id: payment.id, order_id: payment.external_order_id },
            });

            console.log(`[PaymentService.Webhook] Paiement validé avec succès : ${order_id}`);
            return { success: true, message: 'Paiement validé avec succès.' };
        } else {
            // Statut FAILED ou CANCELLED
            if (payment.status === 'FAILED' || payment.status === 'CANCELLED') {
                return { success: true, message: `Paiement déjà marqué comme ${payment.status}.` };
            }

            await supabase
                .from('payments')
                .update({
                    status: mappedStatus,
                    external_transaction_id: transaction_id,
                    provider_status: status,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', payment.id);

            // Rollback et libération des ressources selon le CDC
            if (payment.order_id) {
                await supabase
                    .from('orders')
                    .update({
                        payment_status: 'FAILED',
                        order_status: 'ANNULEE',
                        updated_at: new Date().toISOString(),
                    })
                    .eq('id', payment.order_id);
            }

            if (payment.hall_reservation_id) {
                await supabase
                    .from('hall_reservations')
                    .update({
                        payment_status: 'FAILED',
                        status: 'ANNULEE',
                        updated_at: new Date().toISOString(),
                    })
                    .eq('id', payment.hall_reservation_id);
            }

            if (payment.table_reservation_id) {
                await supabase
                    .from('table_reservations')
                    .update({
                        payment_status: 'FAILED',
                        status: 'ANNULEE',
                        updated_at: new Date().toISOString(),
                    })
                    .eq('id', payment.table_reservation_id);
            }

            if (payment.ticket_id) {
                await supabase
                    .from('tickets')
                    .update({
                        status: 'ANNULE',
                        updated_at: new Date().toISOString(),
                    })
                    .eq('id', payment.ticket_id);
            }

            // Notification client d'échec
            await supabase.from('notifications').insert({
                user_id: payment.client_id,
                type: 'PAYMENT_FAILED',
                title: 'Échec du paiement',
                content: `Votre tentative de paiement de ${payment.amount} ${payment.currency} n'a pas pu aboutir.`,
                channel: 'PUSH',
                status: 'PENDING',
                metadata: { payment_id: payment.id, order_id: payment.external_order_id },
            });

            console.warn(`[PaymentService.Webhook] Paiement échoué ou annulé pour : ${order_id} (Statut: ${status})`);
            return { success: true, message: `Paiement marqué comme ${mappedStatus}.` };
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

    /**
     * Traite un remboursement (partiel ou total) et maintient strictement l'invariant Total − Payé = Solde
     */
    public async processRefund(params: {
        paymentId: string;
        refundAmount: number;
        reason?: string;
        processedBy?: string;
    }): Promise<{ success: boolean; newPaidAmount: number; newBalanceAmount: number }> {
        const supabase = getServiceRoleClient();

        const { data: payment, error } = await supabase
            .from('payments')
            .select('*')
            .eq('id', params.paymentId)
            .single();

        if (error || !payment) {
            throw new Error('Paiement introuvable.');
        }

        if (payment.status !== 'SUCCESS' && payment.status !== 'PARTIAL') {
            throw new Error('Seuls les paiements validés (SUCCESS ou PARTIAL) peuvent être remboursés.');
        }

        const refundAmount = Number(params.refundAmount);
        const originalAmount = Number(payment.amount);

        // Récupération des remboursements déjà traités pour ce paiement
        const { data: existingRefunds } = await supabase
            .from('refunds')
            .select('amount')
            .eq('payment_id', payment.id)
            .eq('status', 'PROCESSED');

        const alreadyRefunded = (existingRefunds || []).reduce((sum: number, r: any) => sum + Number(r.amount), 0);
        const remainingRefundable = Math.max(0, originalAmount - alreadyRefunded);

        if (refundAmount <= 0 || refundAmount > remainingRefundable) {
            throw new Error(`Le montant du remboursement (${refundAmount} FCFA) doit être compris entre 1 et ${remainingRefundable} FCFA.`);
        }

        // 1. Enregistrement conforme dans la table refunds avec l'enum PROCESSED et ID unique
        const refundTxId = `REFUND-${Date.now()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
        const { error: refundErr } = await supabase.from('refunds').insert({
            payment_id: payment.id,
            refund_transaction_id: refundTxId,
            amount: refundAmount,
            reason: params.reason || 'Remboursement client',
            status: 'PROCESSED',
            processed_by: params.processedBy || null,
        });

        if (refundErr) {
            console.error('[PaymentService.processRefund] Erreur insertion refund:', refundErr);
            throw new Error(`Échec enregistrement du remboursement: ${refundErr.message}`);
        }

        // Mise à jour du statut du paiement (REFUNDED si intégralité remboursée, PARTIAL sinon)
        const isFullRefund = (alreadyRefunded + refundAmount) >= originalAmount;
        await supabase
            .from('payments')
            .update({
                status: isFullRefund ? 'REFUNDED' : 'PARTIAL',
                updated_at: new Date().toISOString(),
            })
            .eq('id', payment.id);

        let newPaid = 0;
        let newBalance = 0;

        // 2. Mise à jour de la commande (Invariant : Total - Payé = Solde)
        if (payment.order_id) {
            const { data: order } = await supabase
                .from('orders')
                .select('*')
                .eq('id', payment.order_id)
                .single();

            if (order) {
                const total = Number(order.total_amount);
                const prevPaid = Number(order.paid_amount !== undefined && order.paid_amount !== null ? order.paid_amount : payment.amount);
                newPaid = Math.max(0, prevPaid - refundAmount);
                newBalance = total - newPaid;

                const { error: oUpdateErr } = await supabase
                    .from('orders')
                    .update({
                        paid_amount: newPaid,
                        balance_amount: newBalance,
                        payment_status: newPaid === 0 ? 'REFUNDED' : 'PARTIAL',
                        updated_at: new Date().toISOString(),
                    })
                    .eq('id', payment.order_id);

                if (oUpdateErr) {
                    console.error('[PaymentService.processRefund] Erreur update order:', oUpdateErr);
                    throw new Error(`Échec mise à jour commande lors du remboursement: ${oUpdateErr.message}`);
                }
            }
        }

        return {
            success: true,
            newPaidAmount: newPaid,
            newBalanceAmount: newBalance,
        };
    }
}

export const paymentService = new PaymentService();

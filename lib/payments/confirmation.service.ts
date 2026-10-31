/**
 * Lot 2 — confirmation et réconciliation d'un paiement, communes au webhook, à la route de statut
 * et au cron de réconciliation.
 *  - Seul le statut renvoyé par SamirPay pour l'identifiant ENREGISTRÉ fait foi.
 *  - Billetterie : la RPC payment_confirm (transaction unique, idempotente, tout ou rien) émet
 *    les billets ou bascule le paiement en remboursement ; les notifications et l'envoi du
 *    remboursement ne sont lancés qu'au premier passage (résultat CONFIRMED ou REFUND_REQUIRED).
 *  - Autres cibles (commande, salle, table, abonnement) : transition conditionnelle vers SUCCESS
 *    puis effets métier, une seule fois.
 *  - FAILED / CANCELLED chez SamirPay : payment_release (réservations rendues) ; PENDING trop
 *    ancien : expiration.
 */
import { getServerEnv } from '@/lib/env';
import { NotificationService } from '@/lib/notifications/notification.service';
import { samirPayClient } from '@/lib/samirpay/client';
import { isSamirPayError } from '@/lib/samirpay/types';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { CashoutService } from './cashout.service';
import { rpcWithRetry } from './rpc';
import { notifyStockMilestones } from './stock-notifications';

export type ConfirmSource = 'WEBHOOK' | 'STATUS_POLL' | 'RECONCILIATION';

export interface PaymentRecord {
    id: string;
    status: string;
    client_id: string;
    payment_target: string;
    amount: number;
    currency: string | null;
    external_order_id: string | null;
    external_transaction_id: string | null;
    payer_phone: string | null;
    created_at: string;
    order_id: string | null;
    hall_reservation_id: string | null;
    table_reservation_id: string | null;
    subscription_plan_id: string | null;
    partner_id: string | null;
    metadata: Record<string, unknown> | null;
}

export type ReconcileOutcome =
    | 'CONFIRMED' | 'ALREADY_CONFIRMED' | 'REFUND_REQUIRED' | 'REFUND_IN_PROGRESS' | 'FAILED' | 'CANCELLED' | 'EXPIRED'
    | 'STILL_PENDING' | 'NO_PROVIDER_ID' | 'PROVIDER_NOT_FOUND' | 'PROVIDER_UNAVAILABLE' | 'NOT_CONFIRMABLE';

export async function loadPayment(id: string): Promise<PaymentRecord | null> {
    const { data, error } = await getServiceRoleClient().from('payments').select('*').eq('id', id).maybeSingle();
    if (error) throw new Error(`Lecture du paiement ${id} impossible : ${error.message}`);
    return data as PaymentRecord | null;
}

async function notifyTicketPurchase(paymentId: string, ticketIds: string[]): Promise<void> {
    const supabase = getServiceRoleClient();
    const { data: pay, error } = await supabase.from('payments').select('id, client_id, amount, payer_phone, metadata').eq('id', paymentId).single();
    if (error || !pay) {
        console.error(`[confirmation] notifications du paiement ${paymentId} impossibles :`, error?.message);
        return;
    }
    const { data: tickets, error: tErr } = await supabase.from('tickets').select('ticket_number, event_id, category_id').in('id', ticketIds);
    if (tErr || !tickets?.length) {
        console.error(`[confirmation] billets du paiement ${paymentId} illisibles pour les notifications :`, tErr?.message);
        return;
    }
    try {
        await NotificationService.sendTicketPurchaseNotifications({
            userId: pay.client_id,
            eventId: tickets[0].event_id,
            categoryId: new Set(tickets.map((t) => t.category_id)).size === 1 ? tickets[0].category_id : undefined,
            ticketCount: tickets.length,
            ticketNumbers: tickets.map((t) => t.ticket_number),
            totalAmount: Number(pay.amount),
            clientPhone: pay.payer_phone ? `+221${pay.payer_phone}` : undefined,
        });
    } catch (err) {
        console.error(`[confirmation] notifications d'achat du paiement ${paymentId} en échec :`, err instanceof Error ? err.message : String(err));
    }
    await notifyStockMilestones(tickets.map((t) => t.category_id));
}

/** Confirmation billetterie par la RPC unique. */
export async function confirmTicketPayment(paymentId: string, source: ConfirmSource): Promise<{ result: string; cashout_id?: string; ticket_ids?: string[] }> {
    const { data, error } = await rpcWithRetry<{ result: string; cashout_id?: string; ticket_ids?: string[]; reason?: string }>('payment_confirm', { p_payment_id: paymentId, p_source: source });
    if (error || !data) throw new Error(`Confirmation du paiement ${paymentId} impossible : ${error?.message}`);
    if (data.result === 'CONFIRMED') await notifyTicketPurchase(paymentId, data.ticket_ids ?? []);
    if (data.result === 'REFUND_REQUIRED' && data.cashout_id) {
        console.warn(`[confirmation] paiement ${paymentId} encaissé mais non honorable (${data.reason}) : remboursement`);
        try {
            await CashoutService.send(data.cashout_id);
        } catch (err) {
            console.error(`[confirmation] envoi du remboursement ${data.cashout_id} en échec :`, err instanceof Error ? err.message : String(err));
        }
    }
    return data;
}

/** Confirmation d'un paiement hors billetterie (commande, salle, table, abonnement). */
async function confirmOtherPayment(payment: PaymentRecord, source: ConfirmSource): Promise<'CONFIRMED' | 'ALREADY_CONFIRMED' | 'NOT_CONFIRMABLE'> {
    const supabase = getServiceRoleClient();
    const now = new Date().toISOString();
    const { data: won, error } = await supabase
        .from('payments')
        .update({ status: 'SUCCESS', provider_status: 'SUCCESS', provider_final: true, paid_at: now, confirmed_source: source })
        .eq('id', payment.id)
        .in('status', ['PENDING', 'EXPIRED', 'CANCELLED', 'FAILED'])
        .select('id');
    if (error) throw new Error(`Confirmation du paiement ${payment.id} impossible : ${error.message}`);
    if (!won?.length) {
        const current = await loadPayment(payment.id);
        return current?.status === 'SUCCESS' ? 'ALREADY_CONFIRMED' : 'NOT_CONFIRMABLE';
    }
    const effects: Array<PromiseLike<{ error: { message: string } | null }>> = [];
    if (payment.order_id) effects.push(supabase.from('orders').update({ payment_status: 'SUCCESS', order_status: 'CONFIRMEE', paid_amount: payment.amount, balance_amount: 0, updated_at: now }).eq('id', payment.order_id));
    if (payment.hall_reservation_id) effects.push(supabase.from('hall_reservations').update({ payment_status: 'SUCCESS', status: 'CONFIRMEE', updated_at: now }).eq('id', payment.hall_reservation_id));
    if (payment.table_reservation_id) effects.push(supabase.from('table_reservations').update({ payment_status: 'SUCCESS', status: 'CONFIRMEE', updated_at: now }).eq('id', payment.table_reservation_id));
    for (const r of await Promise.all(effects)) {
        if (r.error) console.error(`[confirmation] effet métier du paiement ${payment.id} en échec :`, r.error.message);
    }
    if (payment.payment_target === 'SUBSCRIPTION') await activateSubscription(payment);
    const { error: nErr } = await supabase.from('notifications').insert({
        user_id: payment.client_id, type: 'PAYMENT_SUCCESS', title: 'Paiement confirmé',
        content: `Votre paiement de ${payment.amount} ${payment.currency ?? 'XOF'} a été validé.`,
        channel: 'PUSH', status: 'PENDING', metadata: { payment_id: payment.id, order_id: payment.external_order_id },
    });
    if (nErr) console.error(`[confirmation] notification du paiement ${payment.id} impossible :`, nErr.message);
    return 'CONFIRMED';
}

async function activateSubscription(payment: PaymentRecord): Promise<void> {
    const supabase = getServiceRoleClient();
    const planId = payment.subscription_plan_id || (payment.metadata?.target_id as string | undefined);
    if (!planId) {
        console.error(`[confirmation] abonnement payé sans plan (paiement ${payment.id})`);
        return;
    }
    const { data: plan, error: planErr } = await supabase.from('subscription_plans').select('*').eq('id', planId).maybeSingle();
    let partnerId = payment.partner_id;
    if (!partnerId) {
        const { data: partner } = await supabase.from('partners').select('id').eq('user_id', payment.client_id).maybeSingle();
        partnerId = partner?.id ?? null;
    }
    if (planErr || !plan || !partnerId) {
        console.error(`[confirmation] activation de l'abonnement du paiement ${payment.id} impossible :`, planErr?.message ?? 'plan ou partenaire introuvable');
        return;
    }
    const days = plan.billing_period === 'YEARLY' ? 365 : 30;
    const now = new Date();
    const { error } = await supabase.from('partners').update({
        subscription_plan_id: plan.id, status: 'VALIDE', trial_ends_at: new Date(now.getTime() + days * 86_400_000).toISOString(), updated_at: now.toISOString(),
    }).eq('id', partnerId);
    if (error) {
        console.error(`[confirmation] abonnement du partenaire ${partnerId} non activé :`, error.message);
        return;
    }
    const { error: nErr } = await supabase.from('notifications').insert({
        user_id: payment.client_id, type: 'SUBSCRIPTION_ACTIVATED', title: 'Abonnement activé',
        content: `Votre pack ${plan.name} est activé pour ${days} jours.`, channel: 'PUSH', status: 'PENDING',
        metadata: { plan_id: plan.id, payment_id: payment.id },
    });
    if (nErr) console.error(`[confirmation] notification d'abonnement impossible :`, nErr.message);
}

async function releaseOther(payment: PaymentRecord, status: 'FAILED' | 'CANCELLED' | 'EXPIRED'): Promise<void> {
    const supabase = getServiceRoleClient();
    const now = new Date().toISOString();
    const effects: Array<PromiseLike<{ error: { message: string } | null }>> = [];
    if (payment.order_id) effects.push(supabase.from('orders').update({ payment_status: 'FAILED', order_status: 'ANNULEE', updated_at: now }).eq('id', payment.order_id));
    // Comme l'ancien webhook : réservation annulée, paiement en échec (ou annulé si abandon/annulation)
    const reservationPayment = status === 'FAILED' ? 'FAILED' : 'CANCELLED';
    if (payment.hall_reservation_id) effects.push(supabase.from('hall_reservations').update({ payment_status: reservationPayment, status: 'ANNULEE', updated_at: now }).eq('id', payment.hall_reservation_id));
    if (payment.table_reservation_id) effects.push(supabase.from('table_reservations').update({ payment_status: reservationPayment, status: 'ANNULEE', updated_at: now }).eq('id', payment.table_reservation_id));
    for (const r of await Promise.all(effects)) {
        if (r.error) console.error(`[confirmation] effet d'échec du paiement ${payment.id} en échec :`, r.error.message);
    }
}

/** Passage en échec, annulation ou expiration (réservations rendues). */
export async function releasePayment(payment: PaymentRecord, status: 'FAILED' | 'CANCELLED' | 'EXPIRED', reason: string): Promise<boolean> {
    const { data, error } = await rpcWithRetry<{ changed: boolean; status: string | null }>('payment_release', { p_payment_id: payment.id, p_status: status, p_reason: reason });
    if (error) throw new Error(`Libération du paiement ${payment.id} impossible : ${error.message}`);
    if (data?.changed && payment.payment_target !== 'TICKET') await releaseOther(payment, status);
    return Boolean(data?.changed);
}

/**
 * Interroge SamirPay avec l'identifiant enregistré et applique le résultat (commun au webhook,
 * à la route de statut et au cron).
 */
export async function reconcilePayment(payment: PaymentRecord, source: ConfirmSource): Promise<ReconcileOutcome> {
    if (!payment.external_transaction_id) return 'NO_PROVIDER_ID';
    const supabase = getServiceRoleClient();
    let providerStatus: string;
    try {
        providerStatus = (await samirPayClient.checkTransactionStatus(payment.external_transaction_id)).status;
    } catch (err) {
        if (isSamirPayError(err) && err.kind === 'NOT_FOUND') return 'PROVIDER_NOT_FOUND';
        console.error(`[réconciliation] statut SamirPay du paiement ${payment.id} indisponible :`, err instanceof Error ? err.message : String(err));
        return 'PROVIDER_UNAVAILABLE';
    }
    const { error: stampErr } = await supabase.from('payments').update({ last_reconciled_at: new Date().toISOString() }).eq('id', payment.id);
    if (stampErr) console.error(`[réconciliation] horodatage du paiement ${payment.id} impossible :`, stampErr.message);

    if (providerStatus === 'SUCCESS') {
        if (payment.payment_target === 'TICKET') {
            const r = await confirmTicketPayment(payment.id, source);
            if (r.result === 'CONFIRMED' || r.result === 'ALREADY_CONFIRMED' || r.result === 'REFUND_REQUIRED' || r.result === 'REFUND_IN_PROGRESS') return r.result;
            console.error(`[réconciliation] paiement ${payment.id} payé chez SamirPay mais non confirmable (${r.result})`);
            return 'NOT_CONFIRMABLE';
        }
        return confirmOtherPayment(payment, source);
    }
    if (providerStatus === 'FAILED' || providerStatus === 'CANCELLED') {
        if (payment.status === 'PENDING') {
            await releasePayment(payment, providerStatus, `PROVIDER_${providerStatus}`);
        } else {
            const { error } = await supabase.from('payments').update({ provider_final: true, provider_status: `PROVIDER_${providerStatus}` }).eq('id', payment.id);
            if (error) console.error(`[réconciliation] statut final du paiement ${payment.id} non enregistré :`, error.message);
        }
        return providerStatus;
    }
    // PENDING chez SamirPay
    const ageMinutes = (Date.now() - new Date(payment.created_at).getTime()) / 60_000;
    if (payment.status === 'PENDING' && ageMinutes > getServerEnv().PAYMENT_PENDING_MAX_AGE_MINUTES) {
        await releasePayment(payment, 'EXPIRED', 'PENDING_TOO_OLD');
        return 'EXPIRED';
    }
    return 'STILL_PENDING';
}

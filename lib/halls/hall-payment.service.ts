/**
 * Lot 10a (S4) — paiement d'une réservation de salle : acompte, solde ou totalité, par le paiement SamirPay existant.
 * Le paiement est créé en base par hall_payment_create, qui relit le montant sur la réservation (figé à sa création) :
 * aucun montant ne vient de la requête. Puis le cashin SamirPay est lancé exactement comme pour les billets (même
 * relance unique, même adoption d'une transaction existante, même libération en cas de refus).
 */
import { randomBytes } from 'node:crypto';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { getServerEnv } from '@/lib/env';
import { cashinReturnUrls, initCashinOnce, initFailureOf, recordAdoptedInit } from '@/lib/payments/cashin-init';
import { hashCallbackToken, paymentView } from '@/lib/payments/checkout.service';
import { normalizePayerPhone } from '@/lib/payments/payer-phone';
import { rpcWithRetry } from '@/lib/payments/rpc';
import { refusalStatus } from './booking';

export type HallPaymentPart = 'ACOMPTE' | 'SOLDE' | 'INTEGRAL';

export interface HallPaymentOutcome {
    status: number;
    body: Record<string, unknown>;
}

const PART_LABEL: Readonly<Record<HallPaymentPart, string>> = { ACOMPTE: 'Acompte', SOLDE: 'Solde', INTEGRAL: 'Réservation' };

export async function startHallPayment(params: {
    userId: string;
    reservationId: string;
    part: HallPaymentPart | undefined;
    operator: 'WAVE' | 'ORANGE_MONEY';
    payerPhone: string;
}): Promise<HallPaymentOutcome> {
    if (!params.part) {
        return { status: 400, body: { success: false, error: 'Choisissez de payer l’acompte, le solde ou la totalité.', code: 'INVALID_PART' } };
    }
    const payerPhone = normalizePayerPhone(params.payerPhone);
    if (!payerPhone) {
        return { status: 400, body: { success: false, error: 'Numéro du payeur invalide (mobile sénégalais, 9 chiffres).', code: 'INVALID_PAYER_PHONE' } };
    }
    const env = getServerEnv();
    const ms = Date.now();
    const suffix = randomBytes(4).toString('hex').toUpperCase();
    const ids = { transactionId: `TX-EV-${ms}-${suffix}`, externalOrderId: `ORD-EV-${ms}-${suffix}` };
    const token = randomBytes(32).toString('base64url');

    const { data, error } = await rpcWithRetry<Record<string, unknown>>('hall_payment_create', {
        p: {
            client_id: params.userId,
            reservation_id: params.reservationId,
            part: params.part,
            operator: params.operator,
            payer_phone: payerPhone,
            callback_token_hash: hashCallbackToken(token),
            transaction_id: ids.transactionId,
            external_order_id: ids.externalOrderId,
        },
    });
    if (error || !data) throw new Error(`Création du paiement de salle impossible : ${error?.message ?? 'réponse vide'}`);
    if (data.ok !== true) {
        return {
            status: refusalStatus(data.code),
            body: { success: false, error: data.message ?? 'Paiement impossible pour le moment.', code: data.code, payment_id: data.payment_id },
        };
    }
    const paymentId = String(data.payment_id);
    const amount = Number(data.amount);
    if (!Number.isFinite(amount) || amount <= 0) throw new Error(`Montant du paiement de salle ${paymentId} invalide : ${String(data.amount)}`);

    const supabase = getServiceRoleClient();
    try {
        const outcome = await initCashinOnce({
            amount,
            orderId: ids.externalOrderId,
            callBackUrl: `${env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, '')}/api/webhooks/samirpay?t=${token}`,
            operatorName: params.operator,
            telephone: payerPhone,
            description: `${PART_LABEL[params.part]} de salle`.slice(0, 100),
            ...cashinReturnUrls(env.NEXT_PUBLIC_APP_URL, paymentId),
        });
        if (outcome.kind === 'ADOPTED') {
            await recordAdoptedInit(paymentId, outcome.transactionId);
            return { status: 502, body: { success: false, error: 'Le service de paiement ne répond pas : réessayez.', code: 'PAYMENT_PROVIDER_UNCERTAIN', payment_id: paymentId } };
        }
        const init = outcome.init;
        const { data: updated, error: updErr } = await supabase
            .from('payments')
            .update({
                external_transaction_id: init.transactionId,
                provider_response: { paymentUrl: init.paymentUrl, deepLinks: init.deepLinks, qrCode: init.qrCode },
                provider_status: 'INIT_ACCEPTED',
            })
            .eq('id', paymentId)
            .eq('status', 'PENDING')
            .select('*')
            .single();
        if (updErr || !updated) throw new Error(`Enregistrement de l'identifiant SamirPay impossible : ${updErr?.message ?? 'paiement introuvable'}`);
        return { status: 201, body: { success: true, ...paymentView(updated) } };
    } catch (err) {
        const failure = initFailureOf(err);
        const { error: relErr } = await rpcWithRetry('payment_release', { p_payment_id: paymentId, p_status: 'FAILED', p_reason: failure?.reason ?? 'INIT_INTERNAL' });
        if (relErr) console.error(`[hall-payment] paiement ${paymentId} non marqué en échec :`, relErr.message);
        if (!failure) throw err;
        return { status: 502, body: { success: false, error: failure.message, code: failure.code, payment_id: paymentId } };
    }
}

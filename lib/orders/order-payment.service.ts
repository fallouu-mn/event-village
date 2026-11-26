/**
 * Lot 12a — paiement d'une commande (part payée au départ, ou solde avant la remise), par le paiement SamirPay existant.
 * Le paiement est créé en base par order_payment_create, qui relit le montant sur la commande (figé à sa création, ou
 * solde restant + frais) : aucun montant ne vient de la requête. Puis le cashin SamirPay est lancé exactement comme pour
 * les billets, les salles et les tables (même relance unique, même adoption d'une transaction existante, même
 * libération en cas de refus).
 * Lot 12b : par order_payment_start (enveloppe en base, aucune recopie) : clé d'idempotence de l'écran (en-tête
 * Idempotency-Key) → même paiement, jamais un second (double clic, deux onglets, rejeu) ; montant AFFICHÉ par l'écran
 * (expectedAmount, comparaison seulement) différent du montant de la base → aucun paiement créé, refus « Le montant à
 * payer a changé : … Vérifiez avant de payer. » avec le nouveau montant.
 */
import { randomBytes } from 'node:crypto';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { getServerEnv } from '@/lib/env';
import { cashinReturnUrls, initCashinOnce, initFailureOf, recordAdoptedInit } from '@/lib/payments/cashin-init';
import { hashCallbackToken, paymentView } from '@/lib/payments/checkout.service';
import { fcfa } from '@/lib/halls/booking';
import { normalizePayerPhone } from '@/lib/payments/payer-phone';
import { rpcWithRetry } from '@/lib/payments/rpc';
import { orderRefusalStatus } from './booking';

export interface OrderPaymentOutcome {
    status: number;
    body: Record<string, unknown>;
}

export async function startOrderPayment(params: {
    userId: string;
    orderId: string;
    part: 'PREMIER' | 'SOLDE';
    operator: 'WAVE' | 'ORANGE_MONEY';
    payerPhone: string;
    /** Lot 12b : clé d'idempotence de l'écran (facultative ; absente : comportement du lot 12a). */
    idempotencyKey?: string | null;
    /** Lot 12b : montant affiché par l'écran, comparé en base (facultatif ; absent : aucune comparaison). */
    expectedAmount?: number | null;
}): Promise<OrderPaymentOutcome> {
    const payerPhone = normalizePayerPhone(params.payerPhone);
    if (!payerPhone) {
        return { status: 400, body: { success: false, error: 'Numéro du payeur invalide (mobile sénégalais, 9 chiffres).', code: 'INVALID_PAYER_PHONE' } };
    }
    const env = getServerEnv();
    const ms = Date.now();
    const suffix = randomBytes(4).toString('hex').toUpperCase();
    const ids = { transactionId: `TX-EV-${ms}-${suffix}`, externalOrderId: `ORD-EV-${ms}-${suffix}` };
    const token = randomBytes(32).toString('base64url');

    const key = params.idempotencyKey?.trim() || null;
    if (key !== null && !/^[A-Za-z0-9._:-]{8,128}$/.test(key)) {
        return { status: 400, body: { success: false, error: 'Demande illisible : rechargez la page et réessayez.', code: 'INVALID_IDEMPOTENCY_KEY' } };
    }
    const { data, error } = await rpcWithRetry<Record<string, unknown>>('order_payment_start', {
        p: {
            client_idempotency_key: key,
            expected_amount: typeof params.expectedAmount === 'number' && Number.isInteger(params.expectedAmount) ? params.expectedAmount : null,
            client_id: params.userId,
            order_id: params.orderId,
            part: params.part,
            operator: params.operator,
            payer_phone: payerPhone,
            callback_token_hash: hashCallbackToken(token),
            transaction_id: ids.transactionId,
            external_order_id: ids.externalOrderId,
        },
    });
    if (error || !data) throw new Error(`Création du paiement de commande impossible : ${error?.message ?? 'réponse vide'}`);
    const supabase = getServiceRoleClient();
    // Même demande déjà reçue (même clé) : le paiement existant, tel quel
    if (data.ok === true && data.duplicate === true) {
        const { data: existing, error: readErr } = await supabase.from('payments').select('*').eq('id', String(data.payment_id)).maybeSingle();
        if (readErr || !existing) throw new Error(`Lecture du paiement ${String(data.payment_id)} impossible : ${readErr?.message ?? 'introuvable'}`);
        return { status: 200, body: { success: true, ...paymentView(existing, { duplicate: true }) } };
    }
    if (data.ok !== true && data.code === 'ORDER_PRICE_CHANGED') {
        const amount = Number(data.amount);
        return {
            status: 409,
            body: { success: false, error: `Le montant à payer a changé : ${fcfa(amount)}. Vérifiez avant de payer.`, code: 'ORDER_PRICE_CHANGED', amount },
        };
    }
    if (data.ok !== true) {
        return {
            status: orderRefusalStatus(data.code),
            body: { success: false, error: data.message ?? 'Paiement impossible pour le moment.', code: data.code, payment_id: data.payment_id },
        };
    }
    const paymentId = String(data.payment_id);
    const amount = Number(data.amount);
    if (!Number.isFinite(amount) || amount <= 0) throw new Error(`Montant du paiement de commande ${paymentId} invalide : ${String(data.amount)}`);

    try {
        const outcome = await initCashinOnce({
            amount,
            orderId: ids.externalOrderId,
            callBackUrl: `${env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, '')}/api/webhooks/samirpay?t=${token}`,
            operatorName: params.operator,
            telephone: payerPhone,
            description: params.part === 'SOLDE' ? 'Solde de commande' : 'Commande',
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
        if (relErr) console.error(`[order-payment] paiement ${paymentId} non marqué en échec :`, relErr.message);
        if (!failure) throw err;
        return { status: 502, body: { success: false, error: failure.message, code: failure.code, payment_id: paymentId } };
    }
}

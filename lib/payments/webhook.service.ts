/**
 * Lot 2.1 — webhook SamirPay (POST form-urlencoded : transaction_id, order_id, status=success).
 *
 * Le contrat SamirPay ne prévoit AUCUNE signature : rien n'est inventé. Défense en profondeur :
 *  1. le webhook est enregistré (payment_webhook_events : corps brut, en-têtes utiles) AVANT tout
 *     traitement ; un rejeu identique incrémente receive_count ;
 *  2. order_id validé par regex, transaction_id par format UUID, recherche par .eq() ;
 *  3. jeton aléatoire propre au paiement, présent dans le callBackUrl transmis à SamirPay ; seule
 *     son empreinte est stockée, comparée à temps constant ;
 *  4. corrélation : transaction_id reçu = identifiant SamirPay enregistré à l'initialisation ;
 *  5. confirmation par l'endpoint de statut, appelé avec l'identifiant ENREGISTRÉ ; seul SUCCESS
 *     déclenche la RPC de confirmation. Le montant n'est pas vérifiable par l'API (le statut n'en
 *     renvoie pas) : il est garanti par l'initialisation, faite par notre serveur à partir du
 *     panier réservé.
 * Réponse : 200 dès que l'événement est enregistré (le contrat attend un 200 ; aucune relance
 * documentée) ; une erreur interne est enregistrée puis rattrapée par la réconciliation. 500
 * seulement si l'événement n'a pas pu être enregistré. Aucun numéro de téléphone dans les journaux.
 */
import { createHash, timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { loadPayment, reconcilePayment, type PaymentRecord } from './confirmation.service';
import { rpcWithRetry } from './rpc';

const ORDER_ID = /^ORD-EV-\d{13}-[0-9A-F]{6,12}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const KEPT_HEADERS = ['content-type', 'content-length', 'user-agent', 'x-forwarded-for', 'x-real-ip'];

const sha256 = (v: string) => createHash('sha256').update(v).digest('hex');

function sameHex(a: string, b: string): boolean {
    const ba = Buffer.from(a, 'hex');
    const bb = Buffer.from(b, 'hex');
    return ba.length === 32 && bb.length === 32 && timingSafeEqual(ba, bb);
}

export async function handleSamirPayWebhook(req: NextRequest): Promise<NextResponse> {
    const raw = await req.text();
    const token = new URL(req.url).searchParams.get('t');
    const headers: Record<string, string> = {};
    for (const h of KEPT_HEADERS) {
        const v = req.headers.get(h);
        if (v) headers[h] = v;
    }
    const isForm = (headers['content-type'] ?? '').toLowerCase().startsWith('application/x-www-form-urlencoded');
    const fields = isForm ? new URLSearchParams(raw) : null;
    const orderId = fields?.get('order_id') ?? null;
    const transactionId = fields?.get('transaction_id') ?? null;
    const status = fields?.get('status') ?? null;

    // 1. Enregistrement avant traitement
    const dedupeKey = sha256(`${raw}\n${token ? sha256(token) : 'sans-jeton'}`);
    const { data: recorded, error: recErr } = await rpcWithRetry<{ id: string; receive_count: number }>('payment_webhook_record', {
        p_dedupe_key: dedupeKey, p_raw_body: raw, p_headers: headers, p_token_present: Boolean(token), p_order_id: orderId, p_transaction_id: transactionId,
    });
    if (recErr || !recorded) {
        console.error('[webhook SamirPay] enregistrement impossible :', recErr?.message);
        return NextResponse.json({ received: false }, { status: 500 });
    }

    const finish = async (result: string, detail: string | null, paymentId: string | null = null) => {
        const { error } = await getServiceRoleClient().from('payment_webhook_events')
            .update({ result, result_detail: detail, payment_id: paymentId, processed_at: new Date().toISOString() })
            .eq('id', recorded.id);
        if (error) console.error(`[webhook SamirPay] résultat de l'événement ${recorded.id} non enregistré :`, error.message);
        if (result !== 'CONFIRMED' && result !== 'ALREADY_CONFIRMED') console.warn(`[webhook SamirPay] événement ${recorded.id} : ${result}${detail ? ` (${detail})` : ''}`);
        return NextResponse.json({ received: true }, { status: 200 });
    };

    try {
        // 2. Format
        if (!fields) return finish('REJECTED_INVALID_PAYLOAD', 'corps non form-urlencoded');
        if (!orderId || !ORDER_ID.test(orderId) || !transactionId || !UUID.test(transactionId)) {
            return finish('REJECTED_INVALID_PAYLOAD', 'order_id ou transaction_id invalide');
        }
        if (status !== 'success') return finish('REJECTED_STATUS', `statut « ${String(status).slice(0, 20)} »`);

        const { data: payment, error } = await getServiceRoleClient().from('payments').select('*').eq('external_order_id', orderId).maybeSingle();
        if (error) throw new Error(`lecture du paiement : ${error.message}`);
        if (!payment) return finish('REJECTED_UNKNOWN_ORDER', null);

        // 3. Jeton du callBackUrl
        if (!token || !payment.callback_token_hash || !sameHex(sha256(token), String(payment.callback_token_hash))) {
            return finish('REJECTED_TOKEN', token ? 'jeton invalide' : 'jeton absent', payment.id);
        }
        // 4. Corrélation avec l'identifiant enregistré. Lot 9 bis (H4, PO6) : un paiement dont l'initialisation n'a
        //    rendu aucun identifiant (statut INIT_*) adopte celui du webhook, seulement si aucun n'est enregistré : le
        //    jeton prouve que l'avis vient du callBackUrl remis à SamirPay pour CE paiement, et le statut est ensuite
        //    lu chez SamirPay avec cet identifiant (rien n'est confirmé sur la seule foi du webhook).
        let current = payment as PaymentRecord & { provider_status?: string | null };
        let adopted = false;
        if (!current.external_transaction_id && String(current.provider_status ?? '').startsWith('INIT_')) {
            const { data: won, error: adoptErr } = await getServiceRoleClient().from('payments')
                .update({ external_transaction_id: transactionId })
                .eq('id', current.id).is('external_transaction_id', null)
                .select('*');
            if (adoptErr) throw new Error(`adoption de l'identifiant SamirPay : ${adoptErr.message}`);
            if (won?.length) {
                current = won[0] as typeof current;
                adopted = true;
            } else {
                const reread = await loadPayment(current.id);
                if (!reread) throw new Error(`paiement ${current.id} introuvable après l'adoption`);
                current = reread;
            }
        }
        if (!current.external_transaction_id || current.external_transaction_id !== transactionId) {
            return finish('REJECTED_CORRELATION', current.external_transaction_id ? 'transaction_id différent de l’identifiant enregistré' : 'aucun identifiant SamirPay enregistré', current.id);
        }
        // 5. Statut SamirPay (identifiant enregistré) puis confirmation
        const outcome = await reconcilePayment(current, 'WEBHOOK');
        const result = outcome === 'STILL_PENDING' ? 'CONFIRMATION_PENDING' : outcome;
        return finish(adopted ? `ADOPTED_THEN_${result}` : result, null, current.id);
    } catch (err) {
        console.error(`[webhook SamirPay] erreur interne sur l'événement ${recorded.id} :`, err instanceof Error ? err.message : String(err));
        return finish('ERROR', err instanceof Error ? err.message.slice(0, 500) : 'erreur interne');
    }
}

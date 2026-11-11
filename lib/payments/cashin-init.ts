/**
 * Lot 9 bis (H4, PO6 ; contrat 5.57, 4.5, B105) — initialisation d'un cashin direct SamirPay, commune au checkout
 * des billets et aux autres cibles (lib/payments/checkout.service.ts, payment.service.ts).
 *  - orderId stable, enregistré sur le paiement avant l'appel ;
 *  - délai dépassé ou coupure SANS statut HTTP (UNCERTAIN, l'opération a pu avoir lieu) : UNE seule relance, au même
 *    orderId ; jamais de relance sur un refus (REJECTED), des clés refusées, un doublon ou une réponse 5xx ;
 *  - 409 (orderId déjà utilisé) porteur de l'identifiant de la transaction existante : l'identifiant est adopté, le
 *    paiement est rendu (CANCELLED, motif INIT_CONFLICT_ADOPTED, provider_final faux) et reste surveillé par le
 *    cron des succès tardifs ; le client n'a reçu aucun lien et peut relancer un achat.
 * Tout autre échec est levé tel quel : l'appelant libère le paiement (payment_release FAILED, INIT_<nature>).
 */
import { samirPayClient } from '@/lib/samirpay/client';
import { isSamirPayError, type SamirPayDirectInitRequest, type SamirPayDirectInitResult } from '@/lib/samirpay/types';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { rpcWithRetry } from './rpc';

export type CashinInitOutcome =
    | { kind: 'INITIATED'; init: SamirPayDirectInitResult }
    | { kind: 'ADOPTED'; transactionId: string };

/** Motif du paiement rendu après l'adoption d'une transaction existante (provider_final faux). */
export const ADOPTED_INIT_REASON = 'INIT_CONFLICT_ADOPTED';

function adoptable(err: unknown): string | null {
    return isSamirPayError(err) && err.kind === 'DUPLICATE' && err.existingTransactionId ? err.existingTransactionId : null;
}

/** Délai dépassé ou coupure, sans réponse HTTP : seule issue relancée. */
function retryable(err: unknown): boolean {
    return isSamirPayError(err) && err.kind === 'UNCERTAIN' && err.httpStatus === undefined;
}

async function attempt(payload: SamirPayDirectInitRequest): Promise<CashinInitOutcome> {
    try {
        return { kind: 'INITIATED', init: await samirPayClient.initDirectPayment(payload) };
    } catch (err) {
        const existing = adoptable(err);
        if (existing) return { kind: 'ADOPTED', transactionId: existing };
        throw err;
    }
}

export async function initCashinOnce(payload: SamirPayDirectInitRequest): Promise<CashinInitOutcome> {
    try {
        return await attempt(payload);
    } catch (err) {
        if (!retryable(err)) throw err;
        console.warn(`[cashin] ${payload.orderId} : délai dépassé sans réponse (${err instanceof Error ? err.message : String(err)}), relance unique au même orderId`);
    }
    return attempt(payload);
}

/**
 * Identifiant existant adopté : enregistré sur le paiement encore PENDING et sans identifiant, puis paiement rendu
 * (réservations libérées, CANCELLED, provider_final faux). Toute erreur est levée.
 */
export async function recordAdoptedInit(paymentId: string, transactionId: string): Promise<void> {
    const { error } = await getServiceRoleClient().from('payments')
        .update({ external_transaction_id: transactionId, provider_status: ADOPTED_INIT_REASON })
        .eq('id', paymentId).eq('status', 'PENDING').is('external_transaction_id', null);
    if (error) throw new Error(`Identifiant SamirPay adopté non enregistré sur le paiement ${paymentId} : ${error.message}`);
    const { error: relErr } = await rpcWithRetry('payment_release', { p_payment_id: paymentId, p_status: 'CANCELLED', p_reason: ADOPTED_INIT_REASON });
    if (relErr) throw new Error(`Paiement ${paymentId} non rendu après l'adoption de son identifiant SamirPay : ${relErr.message}`);
    console.warn(`[cashin] paiement ${paymentId} : transaction SamirPay existante adoptée (${transactionId}), paiement rendu et surveillé`);
}

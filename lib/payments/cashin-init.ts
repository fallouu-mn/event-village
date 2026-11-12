/**
 * Lot 9 bis (H4, PO6 ; contrat 5.57, 4.5, B105) — initialisation d'un cashin direct SamirPay, commune au checkout
 * des billets et aux autres cibles (lib/payments/checkout.service.ts, payment.service.ts).
 *  - orderId stable, enregistré sur le paiement avant l'appel ;
 *  - délai dépassé ou coupure SANS statut HTTP (UNCERTAIN, l'opération a pu avoir lieu) : UNE seule relance, au même
 *    orderId ; jamais de relance sur un refus (REJECTED), des clés refusées, un doublon ou une réponse 5xx ;
 *  - 409 (orderId déjà utilisé) porteur de l'identifiant de la transaction existante : l'identifiant est adopté, le
 *    paiement est rendu (CANCELLED, motif INIT_CONFLICT_ADOPTED, provider_final faux) et reste surveillé par le
 *    cron des succès tardifs ; le client n'a reçu aucun lien et peut relancer un achat.
 * Tout autre échec est levé tel quel : l'appelant libère le paiement (payment_release FAILED, INIT_<nature>) et
 * répond selon initFailureOf. Lot 9 bis (H8, B107) : une réponse 5xx de SamirPay (500 au format D, par exemple un
 * montant sous le minimum du compte) donne PAYMENT_PROVIDER_INTERNAL et un message clair ; jamais relancée.
 */
import { samirPayClient } from '@/lib/samirpay/client';
import { isSamirPayError, type SamirPayDirectInitRequest, type SamirPayDirectInitResult } from '@/lib/samirpay/types';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { rpcWithRetry } from './rpc';

export type CashinInitOutcome =
    | { kind: 'INITIATED'; init: SamirPayDirectInitResult }
    | { kind: 'ADOPTED'; transactionId: string };

/** Lot 9 bis (H8, contrat 4.5) : texte d'une erreur 5xx de SamirPay à l'initialisation. */
export const PROVIDER_INTERNAL_MESSAGE = 'Le paiement n’a pas pu être lancé. Réessayez dans quelques minutes ; si le problème continue, contactez le support.';

export interface InitFailure {
    /** Motif posé sur le paiement par payment_release (FAILED). */
    reason: string;
    /** Code de la réponse 502 au client. */
    code: string;
    message: string;
}

/**
 * Échec d'initialisation venu de SamirPay, traduit pour le client ; null pour une erreur interne (levée par
 * l'appelant). Seuls INIT_REJECTED et INIT_UNAUTHORIZED rendent le paiement définitif (payment_release, M05).
 */
export function initFailureOf(err: unknown): InitFailure | null {
    if (!isSamirPayError(err)) return null;
    if (err.httpStatus !== undefined && err.httpStatus >= 500) {
        return { reason: 'INIT_PROVIDER_INTERNAL', code: 'PAYMENT_PROVIDER_INTERNAL', message: PROVIDER_INTERNAL_MESSAGE };
    }
    return {
        reason: `INIT_${err.kind}`,
        code: `PAYMENT_PROVIDER_${err.kind}`,
        message: err.kind === 'REJECTED' ? 'Paiement refusé par l’opérateur.' : 'Le service de paiement ne répond pas : réessayez.',
    };
}

/**
 * Lot 9 ter (0.4, contrat A.3.2) : adresses de retour du client après le paiement, `{APP_URL}/paiement/{id}` pour le
 * succès comme pour l'échec, seulement si l'URL de l'application est en https (une adresse http ou illisible n'est
 * jamais envoyée : `{}`, corps identique au lot 9 bis). La page de suivi lit l'issue sur le serveur et n'en déduit
 * rien de l'adresse. Chemin écrit ici : importer statusPageUrl de checkout.service ferait un cycle d'import.
 */
export function cashinReturnUrls(appUrl: string, paymentId: string): { successUrl?: string; errorUrl?: string } {
    if (!URL.canParse(appUrl) || new URL(appUrl).protocol !== 'https:') return {};
    const url = `${appUrl.replace(/\/+$/, '')}/paiement/${encodeURIComponent(paymentId)}`;
    return { successUrl: url, errorUrl: url };
}

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

/**
 * Types du contrat SamirPay (documentation officielle API Partenaires v1.0) et statuts internes.
 * Le contrat lui-même (document confidentiel) n'est pas recopié : seuls les éléments nécessaires
 * au code figurent ici.
 */

export type SamirPayOperatorName = 'WAVE' | 'ORANGE_MONEY';
export const SAMIRPAY_OPERATORS: readonly SamirPayOperatorName[] = ['WAVE', 'ORANGE_MONEY'];

/** Statuts renvoyés par l'endpoint de statut d'une transaction. */
export type SamirPayTransactionStatus = 'PENDING' | 'SUCCESS' | 'FAILED' | 'CANCELLED';

/** Cashin direct : montant en XOF (envoyé en chaîne), téléphone payeur à 9 chiffres. */
export interface SamirPayDirectInitRequest {
    amount: number;
    orderId: string;
    callBackUrl: string;
    operatorName: SamirPayOperatorName;
    telephone: string;
    description?: string;
}

export interface SamirPayDirectInitResult {
    transactionId: string;
    paymentUrl: string | null;
    qrCode: string | null;
    deepLinks: { wave: string | null; orange: string | null };
}

export interface SamirPayStatusResult {
    transactionId: string;
    status: SamirPayTransactionStatus;
}

/** Cashout : numéro à 9 chiffres sans indicatif, prénom et nom obligatoires. */
export interface SamirPayCashoutRequest {
    phoneNumber: string;
    operatorName: SamirPayOperatorName;
    amount: number;
    firstName: string;
    lastName: string;
}

export interface SamirPayCashoutResult {
    transactionId: string;
    /** Statut renvoyé dans la réponse d'envoi (SUCCESS attendu). */
    status: string;
}

export interface SamirPaySoldeResult {
    solde: number;
    entityName: string | null;
}

/**
 * Nature d'un échec d'appel :
 *  - REJECTED : refus explicite (400, 409 métier) — aucun effet chez SamirPay ;
 *  - DUPLICATE : orderId déjà utilisé (409 sur un cashin) ;
 *  - NOT_FOUND : transaction inexistante (404) ;
 *  - UNAUTHORIZED : clés refusées (401/403) ;
 *  - INVALID_RESPONSE : réponse 2xx incohérente ou illisible pour un appel sans effet financier ;
 *  - UNCERTAIN : délai dépassé, coupure, 5xx ou réponse illisible — l'opération a pu avoir lieu.
 */
export type SamirPayErrorKind = 'REJECTED' | 'DUPLICATE' | 'NOT_FOUND' | 'UNAUTHORIZED' | 'INVALID_RESPONSE' | 'UNCERTAIN';

export class SamirPayError extends Error {
    constructor(readonly kind: SamirPayErrorKind, message: string, readonly httpStatus?: number) {
        super(message);
        this.name = 'SamirPayError';
    }
}

export function isSamirPayError(err: unknown): err is SamirPayError {
    return err instanceof SamirPayError || (typeof err === 'object' && err !== null && (err as { name?: string }).name === 'SamirPayError' && typeof (err as { kind?: unknown }).kind === 'string');
}

/** Webhook SamirPay (form-urlencoded) : envoyé seulement en cas de succès, sans signature. */
export interface SamirPayWebhookFields {
    transaction_id: string;
    order_id: string;
    status: string;
}

/** Statuts d'un paiement Event Village (enum payment_status_enum). */
export type EventVillagePaymentStatus = 'PENDING' | 'SUCCESS' | 'FAILED' | 'REFUNDED' | 'CANCELLED' | 'EXPIRED' | 'REFUND_PENDING' | 'PARTIAL';

export const OPERATOR_LABELS: Record<SamirPayOperatorName, string> = {
    WAVE: 'Wave',
    ORANGE_MONEY: 'Orange Money',
};

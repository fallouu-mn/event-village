/**
 * Types du contrat SamirPay (documentation officielle API Partenaires v1.2, lot 9 bis) et statuts internes.
 * Le contrat lui-même (document confidentiel) n'est pas recopié : seuls les noms de champs, de codes et de
 * statuts nécessaires au code figurent ici.
 */

export type SamirPayOperatorName = 'WAVE' | 'ORANGE_MONEY';
export const SAMIRPAY_OPERATORS: readonly SamirPayOperatorName[] = ['WAVE', 'ORANGE_MONEY'];

/** Statuts « partenaire » renvoyés par l'endpoint de statut d'une transaction (format C). */
export type SamirPayTransactionStatus = 'PENDING' | 'SUCCESS' | 'FAILED' | 'CANCELLED';
export const SAMIRPAY_STATUSES: readonly SamirPayTransactionStatus[] = ['PENDING', 'SUCCESS', 'FAILED', 'CANCELLED'];

/**
 * v1.2 (§3.3) : statut interne de l'objet Transaction (réponse d'un transfert) traduit en statut partenaire.
 * Un statut inconnu rend null : l'appelant décide (UNCERTAIN pour un transfert, INVALID_RESPONSE ailleurs), jamais
 * un succès supposé.
 */
const INTERNAL_STATUSES = new Map<string, SamirPayTransactionStatus>([
    ['T', 'PENDING'], ['PENDING', 'PENDING'], ['WAITING_VALIDATION', 'PENDING'],
    ['V', 'SUCCESS'], ['VALIDATED', 'SUCCESS'], ['SUCCESS', 'SUCCESS'],
    ['C', 'CANCELLED'], ['CANCELLED', 'CANCELLED'],
    ['F', 'FAILED'], ['FAILED', 'FAILED'], ['REJECTED', 'FAILED'], ['ERROR', 'FAILED'], ['EXPIRED', 'FAILED'],
]);

export function mapInternalStatus(raw: unknown): SamirPayTransactionStatus | null {
    return typeof raw === 'string' ? INTERNAL_STATUSES.get(raw.trim().toUpperCase()) ?? null : null;
}

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
    /** Lien de paiement (Wave) ; null pour Orange Money (v1.2). */
    paymentUrl: string | null;
    /** QR en data URL (`data:image/png;base64,…`) ; la v1.2 le donne en base64 brut. */
    qrCode: string | null;
    /** Orange : `urls.OM`, à défaut `urls.MAXIT` ; Wave n'a que `paymentUrl`. */
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

/**
 * Transfert accepté (v1.2, §5.1, objet Transaction sous `body`). Les champs de frais sont facultatifs : la
 * passerelle factice des suites ne les rend que sur demande ; le client HTTP les rend toujours (null si absents).
 */
export interface SamirPayCashoutResult {
    /** `body.id` de la réponse. */
    transactionId: string;
    /** Statut interne traduit (`V` → SUCCESS). */
    status: SamirPayTransactionStatus;
    /** `body.reference`. */
    reference?: string | null;
    /** Frais réels du transfert (`body.fees`). */
    fees?: number | null;
    /** Débit total, frais compris : valeur absolue de `body.netAmount`. */
    netAmount?: number | null;
    /** Référence de l'opérateur (`body.refOperator`). */
    refOperator?: string | null;
}

export interface SamirPaySoldeResult {
    solde: number;
    entityName: string | null;
}

/**
 * Nature d'un échec d'appel :
 *  - REJECTED : refus explicite (400) — aucun effet chez SamirPay ;
 *  - DUPLICATE : orderId déjà utilisé (409 sur un cashin) ;
 *  - NOT_FOUND : transaction inexistante (404 de l'endpoint de statut, `status: NOT_FOUND`) ;
 *  - UNAUTHORIZED : clés refusées (401/403) ;
 *  - INVALID_RESPONSE : réponse hors format pour un appel sans effet financier ;
 *  - UNCERTAIN : délai dépassé, coupure, 5xx ou réponse illisible — l'opération a pu avoir lieu.
 */
export type SamirPayErrorKind = 'REJECTED' | 'DUPLICATE' | 'NOT_FOUND' | 'UNAUTHORIZED' | 'INVALID_RESPONSE' | 'UNCERTAIN';

export class SamirPayError extends Error {
    /** Lot 9 bis (H5, contrat 4.5) : `errorCode` des formats B et D, ou code de classement (`INVALID_ID`). */
    code?: string;

    constructor(readonly kind: SamirPayErrorKind, message: string, readonly httpStatus?: number, options: { code?: string } = {}) {
        super(message);
        this.name = 'SamirPayError';
        if (options.code !== undefined) this.code = options.code;
    }
}

export function isSamirPayError(err: unknown): err is SamirPayError {
    return err instanceof SamirPayError || (typeof err === 'object' && err !== null && (err as { name?: string }).name === 'SamirPayError' && typeof (err as { kind?: unknown }).kind === 'string');
}

/** Webhook SamirPay (form-urlencoded) : envoyé seulement en cas de succès. */
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

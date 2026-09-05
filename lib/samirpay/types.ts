/**
 * Types et interfaces pour l'intégration de la passerelle de paiement SamirPay.
 * Conforme à la documentation officielle SamirPay et aux spécifications techniques Event Village.
 */

export interface SamirPayCustomer {
    name?: string;
    phone: string;
    email?: string;
}

export interface SamirPayInitPaymentRequest {
    amount: number;
    currency?: string;
    order_id: string;
    operatorName: string;
    description?: string;
    customer?: SamirPayCustomer;
    // Formats téléphone redondants requis par SamirPay pour le Push USSD Orange Money
    barePhone?: string;      // ex: 771234567  (sans indicatif)
    fullIntlPhone?: string;  // ex: +221771234567 (E.164)
    return_url?: string;
    cancel_url?: string;
    callback_url?: string;
    metadata?: Record<string, unknown>;
}

export interface SamirPayInitPaymentResponse {
    status: 'success' | 'failed' | 'pending' | string;
    message?: string;
    transaction_id?: string;
    order_id?: string;
    payment_url?: string;
    token?: string;
    urls?: Record<string, string>;
    data?: {
        transaction_id?: string;
        order_id?: string;
        payment_url?: string;
        url?: string;
        urls?: Record<string, string>;
        [key: string]: unknown;
    };
    [key: string]: unknown;
}

export interface SamirPayWebhookFormData {
    transaction_id: string;
    order_id: string;
    status: string;
    amount?: string;
    currency?: string;
    signature?: string;
    [key: string]: string | undefined;
}

export interface SamirPayCheckStatusResponse {
    status: 'success' | 'failed' | 'pending' | 'cancelled' | string;
    transaction_id: string;
    order_id: string;
    amount?: number;
    currency?: string;
    payment_date?: string;
    [key: string]: unknown;
}

export type SamirPayOperatorName = 'WAVE' | 'ORANGE_MONEY';

export interface SamirPayCashoutRequest {
    phoneNumber: string;
    operatorName: SamirPayOperatorName;
    amount: number;
    firstName: string;
    lastName: string;
}

export interface SamirPayCashoutResponse {
    status: 'success' | 'failed' | 'pending' | string;
    message?: string;
    transaction_id?: string;
    reference?: string;
    data?: Record<string, unknown>;
    [key: string]: unknown;
}

export interface SamirPaySoldeResponse {
    status: string;
    solde?: number;
    balance?: number;
    currency?: string;
    message?: string;
    [key: string]: unknown;
}

export type EventVillagePaymentStatus = 'PENDING' | 'SUCCESS' | 'FAILED' | 'REFUNDED' | 'CANCELLED';

/**
 * Mappe un statut retourné par SamirPay vers le statut PostgreSQL Event Village.
 */
export function mapSamirPayStatus(status: string): EventVillagePaymentStatus {
    const normalized = (status || '').toLowerCase().trim();
    switch (normalized) {
        case 'success':
        case 'completed':
        case 'paid':
        case 'valide':
            return 'SUCCESS';
        case 'failed':
        case 'echec':
        case 'error':
        case 'declined':
            return 'FAILED';
        case 'cancelled':
        case 'annule':
            return 'CANCELLED';
        case 'refunded':
        case 'rembourse':
            return 'REFUNDED';
        case 'pending':
        case 'en_attente':
        case 'processing':
        default:
            return 'PENDING';
    }
}

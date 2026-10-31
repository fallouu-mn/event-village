/**
 * Contrats des intégrations externes (SMS, email, passerelle de paiement).
 *
 * Chaque service métier parle à ces interfaces, jamais directement à un
 * fournisseur. Le registre (`./registry`) fournit les implémentations réelles
 * en production et les faux adaptateurs en test (EV_INTEGRATIONS=fake).
 */
import type {
    SamirPayCashoutRequest,
    SamirPayCashoutResult,
    SamirPayDirectInitRequest,
    SamirPayDirectInitResult,
    SamirPaySoldeResult,
    SamirPayStatusResult,
} from '@/lib/samirpay/types';

export interface SmsSendResult {
    success: boolean;
    messageId?: string;
    recipient: string;
    error?: string;
    rawResponse?: unknown;
    /** Lot 1C.9 : refus de la garde anti-abus (aucun SMS envoyé). */
    code?: 'SMS_RATE_LIMITED' | 'SMS_DAILY_CAP_REACHED' | 'SMS_GUARD_UNAVAILABLE';
    retryAfterSeconds?: number;
}

export interface SmsAdapter {
    /** Envoie un SMS. `to` est un numéro brut : l'adaptateur applique son propre formatage. */
    sendSms(to: string, message: string): Promise<SmsSendResult>;
}

export interface EmailSendPayload {
    to: string | string[];
    subject: string;
    html: string;
    from?: string;
    replyTo?: string;
}

export interface EmailSendResult {
    sent: boolean;
    id?: string;
    error?: string;
}

export interface EmailAdapter {
    send(payload: EmailSendPayload): Promise<EmailSendResult>;
}

/**
 * Passerelle de paiement, alignée sur le contrat SamirPay (lot 2). Les échecs sont levés en
 * SamirPayError (nature REJECTED, DUPLICATE, NOT_FOUND, UNAUTHORIZED, INVALID_RESPONSE ou UNCERTAIN).
 */
export interface PaymentGateway {
    /** Cashin direct (POST /api/tiers/direct/initPayment). */
    initDirectPayment(payload: SamirPayDirectInitRequest): Promise<SamirPayDirectInitResult>;
    /** Statut d'une transaction par son identifiant SamirPay (GET /api/tiers/payments/{id}/status). */
    checkTransactionStatus(transactionId: string): Promise<SamirPayStatusResult>;
    /** Solde du compte partenaire (GET /api/tiers/payments/solde). */
    getSolde(): Promise<SamirPaySoldeResult>;
    /** Cashout (POST /api/tiers/payments/send) — aucune clé d'idempotence côté SamirPay. */
    sendCashout(payload: SamirPayCashoutRequest): Promise<SamirPayCashoutResult>;
}

export interface Integrations {
    sms: SmsAdapter;
    email: EmailAdapter;
    payment: PaymentGateway;
}

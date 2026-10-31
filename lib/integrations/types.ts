/**
 * Contrats des intégrations externes (SMS, email, passerelle de paiement).
 *
 * Chaque service métier parle à ces interfaces, jamais directement à un
 * fournisseur. Le registre (`./registry`) fournit les implémentations réelles
 * en production et les faux adaptateurs en test (EV_INTEGRATIONS=fake).
 */
import type {
    SamirPayCashoutRequest,
    SamirPayCashoutResponse,
    SamirPayCheckStatusResponse,
    SamirPayInitPaymentRequest,
    SamirPayInitPaymentResponse,
    SamirPaySoldeResponse,
} from '@/lib/samirpay/types';

export interface SmsSendResult {
    success: boolean;
    messageId?: string;
    recipient: string;
    error?: string;
    rawResponse?: unknown;
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

export interface PaymentGateway {
    initPayment(payload: SamirPayInitPaymentRequest): Promise<SamirPayInitPaymentResponse>;
    checkTransactionStatus(orderId: string): Promise<SamirPayCheckStatusResponse>;
    getSolde(): Promise<SamirPaySoldeResponse>;
    sendCashout(payload: SamirPayCashoutRequest): Promise<SamirPayCashoutResponse>;
}

export interface Integrations {
    sms: SmsAdapter;
    email: EmailAdapter;
    payment: PaymentGateway;
}

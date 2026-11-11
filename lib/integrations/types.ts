/**
 * Contrats des intégrations externes (SMS, email, push web, passerelle de paiement).
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

/**
 * Lot 6 (contrat E6) : issue d'un envoi de SMS.
 *  - SENT      : accepté par le fournisseur (`success` vaut true) ;
 *  - REJECTED  : refusé, rien n'est parti (`retryable` dit si une relance est permise) ;
 *  - UNCERTAIN : la requête est peut-être partie (délai dépassé, connexion coupée, réponse illisible) :
 *                jamais renvoyé automatiquement.
 */
export type SmsOutcome = 'SENT' | 'REJECTED' | 'UNCERTAIN';

export interface SmsSendResult {
    success: boolean;
    messageId?: string;
    recipient: string;
    error?: string;
    rawResponse?: unknown;
    /**
     * Lot 1C.9 : refus de la garde anti-abus (aucun SMS envoyé) ; lot 4.8 : limite par compte déclencheur.
     * Lot 9 bis (I1) : SMS_DEMO_ACCOUNT, destinataire de démonstration hors simulation (aucun SMS envoyé).
     */
    code?: 'SMS_RATE_LIMITED' | 'SMS_DAILY_CAP_REACHED' | 'SMS_ACCOUNT_LIMIT_REACHED' | 'SMS_GUARD_UNAVAILABLE' | 'SMS_DEMO_ACCOUNT';
    retryAfterSeconds?: number;
    /**
     * Lot 6 (E6) : issue de l'envoi ; `success === (outcome === 'SENT')`. Les refus de la garde portent
     * `REJECTED`. Facultative dans le type pour les adaptateurs antérieurs au lot 6 : l'envoyeur traite une
     * issue absente comme `success ? SENT : REJECTED` (relance permise).
     */
    outcome?: SmsOutcome;
    /** Lot 6 (E6) : pour un REJECTED, une relance est permise (HTTP 429 ou 5xx, connexion refusée). */
    retryable?: boolean;
}

export interface SmsAdapter {
    /** Envoie un SMS. `to` est un numéro brut : l'adaptateur applique son propre formatage. */
    sendSms(to: string, message: string): Promise<SmsSendResult>;
}

export interface EmailSendPayload {
    to: string | string[];
    subject: string;
    html: string;
    /** Lot 6 (F3) : version texte du message (lecteurs sans HTML, filtres anti-spam). */
    text?: string;
    /** Lot 6 (F3) : en-têtes du message (List-Unsubscribe pour une famille optionnelle). */
    headers?: Record<string, string>;
    /**
     * Lot 6 (F3) : clé d'idempotence de la ligne de la boîte d'envoi. Resend la reçoit dans l'en-tête HTTP
     * `Idempotency-Key` : une relance après un délai dépassé ne crée pas un second email.
     */
    idempotencyKey?: string;
    from?: string;
    replyTo?: string;
}

export interface EmailSendResult {
    sent: boolean;
    id?: string;
    error?: string;
    /** Lot 6 (F3) : refus temporaire (HTTP 429 ou 5xx, réseau) : une relance est permise. */
    retryable?: boolean;
}

export interface EmailAdapter {
    send(payload: EmailSendPayload): Promise<EmailSendResult>;
}

/**
 * Lot 6 (contrat F4) — push web. Un appareil abonné (`PushTarget`, clés base64url de l'abonnement du
 * navigateur), la charge affichée par le service worker (`PushMessage`, JSON chiffré de bout en bout) et
 * les options du protocole Web Push (TTL, Urgency).
 */
export interface PushTarget { endpoint: string; p256dh: string; auth: string }
export interface PushMessage { title: string; body: string; url: string; tag: string }
export interface PushSendOptions { ttlSeconds: number; urgency: 'normal' | 'high' }
/**
 * Issue d'un envoi vers UN appareil :
 *  - ACCEPTED  : 200, 201 ou 202 ;
 *  - GONE      : 404 ou 410, abonnement expiré (à supprimer) ;
 *  - TOO_LARGE : 413 ;
 *  - RETRY     : 429, 5xx, délai dépassé ou réseau (`statusCode` null) ; `retryAfterSeconds` lu dans Retry-After ;
 *  - REJECTED  : autre refus (400, 401, 403…), ou envoi impossible avant le réseau (configuration, point
 *                d'arrivée hors liste blanche, clés illisibles : `statusCode` null).
 */
export interface PushSendResult {
    outcome: 'ACCEPTED' | 'GONE' | 'REJECTED' | 'RETRY' | 'TOO_LARGE';
    statusCode: number | null;
    retryAfterSeconds?: number;
    error?: string;
}
export interface PushAdapter { send(target: PushTarget, message: PushMessage, options: PushSendOptions): Promise<PushSendResult> }

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
    /** Lot 6 : push web (contrat F4). */
    push: PushAdapter;
}

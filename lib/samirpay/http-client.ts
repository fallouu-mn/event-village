/**
 * Client API SamirPay officiel (Côté serveur exclusivement).
 * Gère l'authentification via X-API-KEY et X-SECRET-KEY ainsi que les appels
 * aux endpoints officiels SamirPay (Direct Cashin, Cashout, Solde, Status).
 * Entièrement piloté par les variables d'environnement (Production & Sandbox).
 */

import {
    SamirPayInitPaymentRequest,
    SamirPayInitPaymentResponse,
    SamirPayCheckStatusResponse,
    SamirPayCashoutRequest,
    SamirPayCashoutResponse,
    SamirPaySoldeResponse,
} from './types';

export class SamirPayClient {
    private get baseUrl(): string {
        return (process.env.SAMIRPAY_API_URL || '').replace(/\/+$/, '');
    }

    private get cashinUrl(): string {
        return process.env.SAMIRPAY_CASHIN_URL || (this.baseUrl ? `${this.baseUrl}/api/tiers/direct/initPayment` : '');
    }

    private get cashoutUrl(): string {
        return process.env.SAMIRPAY_CASHOUT_URL || (this.baseUrl ? `${this.baseUrl}/api/tiers/payments/send` : '');
    }

    private get soldeUrl(): string {
        return process.env.SAMIRPAY_SOLDE_URL || (this.baseUrl ? `${this.baseUrl}/api/tiers/payments/solde` : '');
    }

    private get statusUrl(): string {
        return process.env.SAMIRPAY_STATUS_URL || (this.baseUrl ? `${this.baseUrl}/api/tiers/direct/status` : (this.cashinUrl ? this.cashinUrl.replace(/initPayment\/?$/, 'status') : ''));
    }

    private get apiKey(): string {
        return process.env.SAMIRPAY_API_KEY || '';
    }

    private get secretKey(): string {
        return process.env.SAMIRPAY_SECRET_KEY || '';
    }

    private readonly timeoutMs: number = 15000;

    constructor() {
        // Validation stricte de l'environnement serveur
        if (typeof window !== 'undefined') {
            throw new Error('SamirPayClient ne doit JAMAIS être instancié ou exécuté côté client/navigateur.');
        }
    }

    /**
     * En-têtes HTTP requis par SamirPay pour l'authentification et le format.
     */
    private getHeaders(): Record<string, string> {
        return {
            'Content-Type': 'application/json',
            'X-API-KEY': this.apiKey,
            'X-SECRET-KEY': this.secretKey,
        };
    }

    /**
     * Initialise une demande de paiement Cashin Direct auprès de SamirPay.
     * Utilise dynamiquement process.env.SAMIRPAY_CASHIN_URL
     */
    public async initPayment(payload: SamirPayInitPaymentRequest): Promise<SamirPayInitPaymentResponse> {
        const url = this.cashinUrl;
        if (!url) {
            throw new Error('[SamirPayClient] SAMIRPAY_CASHIN_URL non configurée dans les variables d\'environnement.');
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

        try {
            // Tous les champs téléphone et URL sont envoyés sous plusieurs noms (redondance).
            // SamirPay en production exige ces alias pour déclencher le Push USSD Orange Money.
            const phone = payload.fullIntlPhone || payload.customer?.phone || '';
            const phoneBare = payload.barePhone || phone.replace(/^\+?221/, '');

            const requestPayload = {
                amount: payload.amount,
                currency: payload.currency || 'XOF',
                order_id: payload.order_id,
                operatorName: payload.operatorName,
                description: payload.description || `Paiement Event Village - ${payload.order_id}`,
                customer: payload.customer
                    ? { phone: payload.customer.phone, name: payload.customer.name, email: payload.customer.email }
                    : undefined,
                // Alias téléphone requis par SamirPay
                phone,
                phoneNumber: phoneBare,
                telephone: phone,
                customerPhone: phone,
                // Alias URLs requis par SamirPay
                return_url: payload.return_url,
                cancel_url: payload.cancel_url,
                callback_url: payload.callback_url,
                callbackUrl: payload.callback_url,
                returnUrl: payload.return_url,
                urlCallback: payload.callback_url,
                urlSuccess: payload.return_url,
                metadata: payload.metadata,
            };

            console.log('[SamirPay] initPayment Request:', {
                url,
                method: 'POST',
                payload: {
                    amount: requestPayload.amount,
                    currency: requestPayload.currency,
                    order_id: requestPayload.order_id,
                    description: requestPayload.description,
                    customer_phone: requestPayload.customer?.phone ? `${requestPayload.customer.phone.slice(0, 3)}***` : 'ABSENT',
                    customer_name: requestPayload.customer?.name || 'ABSENT',
                    return_url: requestPayload.return_url || 'ABSENT',
                    cancel_url: requestPayload.cancel_url || 'ABSENT',
                    callback_url: requestPayload.callback_url || 'ABSENT',
                    has_metadata: !!requestPayload.metadata,
                },
            });

            const body = JSON.stringify(requestPayload);

            const response = await fetch(url, {
                method: 'POST',
                headers: this.getHeaders(),
                body,
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const responseText = await response.text();
                console.error('[SamirPay] HTTP Error:', {
                    status: response.status,
                    statusText: response.statusText,
                    body: responseText,
                    order_id: payload.order_id,
                });
                let errorMessage = `Erreur SamirPay HTTP ${response.status}`;
                try {
                    const errorData = JSON.parse(responseText);
                    if (errorData?.message) errorMessage = errorData.message;
                } catch { /* response n'est pas du JSON */ }
                throw new Error(`Échec de l'initialisation SamirPay : ${errorMessage}`);
            }

            const data = (await response.json()) as SamirPayInitPaymentResponse;

            // Log complet pour diagnostic — inclut le status du corps, pas seulement HTTP
            console.log('[SamirPay] initPayment Response:', {
                order_id: payload.order_id,
                operator: payload.operatorName,
                http_ok: true,
                body_status: data.status || 'ABSENT',
                body_message: (data.message as string) || 'ABSENT',
                has_payment_url: !!(data.payment_url || data.data?.payment_url),
                has_transaction_id: !!(data.transaction_id || data.data?.transaction_id),
                response_keys: Object.keys(data).join(','),
            });

            return data;
        } catch (error: unknown) {
            clearTimeout(timeoutId);

            if (error instanceof Error && error.name === 'AbortError') {
                console.error('[SamirPayClient] Timeout lors de l\'appel à initPayment', { order_id: payload.order_id });
                throw new Error('Délai d\'attente dépassé lors de la communication avec SamirPay (Timeout).');
            }

            if (error instanceof Error) {
                // S'assure de ne jamais fuiter les clés secrètes dans l'erreur
                const sanitizedMessage = error.message
                    .replace(this.secretKey, '***')
                    .replace(this.apiKey, '***');
                throw new Error(sanitizedMessage);
            }

            throw new Error('Erreur inconnue lors de l\'initialisation du paiement SamirPay.');
        }
    }

    /**
     * Vérification de fallback du statut d'une transaction auprès de SamirPay.
     * Utilisé en cas de retard de webhook ou pour le rapprochement.
     */
    public async checkTransactionStatus(orderId: string): Promise<SamirPayCheckStatusResponse> {
        let url = this.statusUrl;
        if (!url) {
            throw new Error('[SamirPayClient] URL de vérification de statut non configurée.');
        }

        const separator = url.includes('?') ? '&' : '?';
        url = `${url}${separator}order_id=${encodeURIComponent(orderId)}`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: this.getHeaders(),
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`Impossible de vérifier le statut SamirPay : HTTP ${response.status}`);
            }

            return (await response.json()) as SamirPayCheckStatusResponse;
        } catch (error: unknown) {
            clearTimeout(timeoutId);
            if (error instanceof Error) {
                throw new Error(`Erreur vérification statut SamirPay : ${error.message}`);
            }
            throw new Error('Erreur inconnue lors de la vérification du statut SamirPay.');
        }
    }

    /**
     * Récupère le solde du compte marchand chez SamirPay.
     * Utilise dynamiquement process.env.SAMIRPAY_SOLDE_URL
     */
    public async getSolde(): Promise<SamirPaySoldeResponse> {
        const url = this.soldeUrl;
        if (!url) {
            throw new Error('[SamirPayClient] SAMIRPAY_SOLDE_URL non configurée dans les variables d\'environnement.');
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

        try {
            const response = await fetch(url, {
                method: 'GET',
                headers: this.getHeaders(),
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            const data = (await response.json()) as SamirPaySoldeResponse;

            if (!response.ok) {
                const errorMsg = data?.message || `HTTP ${response.status}`;
                throw new Error(`Impossible de consulter le solde SamirPay : ${errorMsg}`);
            }

            return data;
        } catch (error: unknown) {
            clearTimeout(timeoutId);
            if (error instanceof Error && error.name === 'AbortError') {
                throw new Error('Délai d\'attente dépassé lors de la consultation du solde SamirPay.');
            }
            if (error instanceof Error) {
                const sanitized = error.message
                    .replace(this.secretKey, '***')
                    .replace(this.apiKey, '***');
                throw new Error(sanitized);
            }
            throw new Error('Erreur inconnue lors de la consultation du solde SamirPay.');
        }
    }

    /**
     * Envoie un transfert de fonds (Cashout) vers Wave ou Orange Money.
     * Utilise dynamiquement process.env.SAMIRPAY_CASHOUT_URL
     */
    public async sendCashout(payload: SamirPayCashoutRequest): Promise<SamirPayCashoutResponse> {
        const url = this.cashoutUrl;
        if (!url) {
            throw new Error('[SamirPayClient] SAMIRPAY_CASHOUT_URL non configurée dans les variables d\'environnement.');
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

        try {
            const body = JSON.stringify({
                phoneNumber: payload.phoneNumber,
                operatorName: payload.operatorName,
                amount: payload.amount,
                firstName: payload.firstName,
                lastName: payload.lastName,
            });

            const response = await fetch(url, {
                method: 'POST',
                headers: this.getHeaders(),
                body,
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            const data = (await response.json()) as SamirPayCashoutResponse;

            if (!response.ok) {
                const errorMsg = data?.message || `HTTP ${response.status}`;
                console.error('[SamirPayClient] sendCashout échec:', {
                    phoneNumber: payload.phoneNumber,
                    operatorName: payload.operatorName,
                    amount: payload.amount,
                    error: errorMsg,
                });
                throw new Error(`Échec du Cashout SamirPay : ${errorMsg}`);
            }

            return data;
        } catch (error: unknown) {
            clearTimeout(timeoutId);
            if (error instanceof Error && error.name === 'AbortError') {
                console.error('[SamirPayClient] Timeout sendCashout', { phoneNumber: payload.phoneNumber });
                throw new Error('Délai d\'attente dépassé lors du Cashout SamirPay (Timeout).');
            }
            if (error instanceof Error) {
                const sanitized = error.message
                    .replace(this.secretKey, '***')
                    .replace(this.apiKey, '***');
                throw new Error(sanitized);
            }
            throw new Error('Erreur inconnue lors du Cashout SamirPay.');
        }
    }
}

// Instance singleton côté serveur
export const samirPayClient = new SamirPayClient();

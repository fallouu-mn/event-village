/**
 * Fausse passerelle SamirPay : aucune requête réseau, comportement pilotable,
 * enregistrement de tous les appels, génération de webhooks signés ou non.
 *
 * Scénarios simulés :
 *  - initPayment : succès | refus dans le corps (status "failed") | exception réseau
 *  - checkTransactionStatus : success | failed | pending | cancelled (par order_id)
 *  - getSolde : solde marchand paramétrable
 *  - sendCashout : succès | échec | exception
 *  - buildWebhook : corps application/x-www-form-urlencoded, signé (HMAC-SHA256) ou non
 *
 * NOTE : le schéma de signature (champ `signature` + en-tête `x-samirpay-signature`,
 * HMAC-SHA256 de "order_id|transaction_id|status|amount|currency" avec
 * SAMIRPAY_WEBHOOK_SECRET) est PROVISOIRE : il sera aligné sur la documentation
 * officielle SamirPay au lot 2, en même temps que la vérification côté serveur.
 */
import crypto from 'node:crypto';
import type { PaymentGateway } from '../../lib/integrations/types';
import type {
    SamirPayCashoutRequest,
    SamirPayCashoutResponse,
    SamirPayCheckStatusResponse,
    SamirPayInitPaymentRequest,
    SamirPayInitPaymentResponse,
    SamirPaySoldeResponse,
} from '../../lib/samirpay/types';

export type FakeInitMode = 'success' | 'failed-body' | 'throw';
export type FakeCashoutMode = 'success' | 'failed' | 'throw';
export type FakeTransactionStatus = 'success' | 'failed' | 'pending' | 'cancelled';

export interface RecordedGatewayCall {
    method: 'initPayment' | 'checkTransactionStatus' | 'getSolde' | 'sendCashout';
    args: unknown;
    at: string;
}

export interface FakeWebhookParams {
    order_id: string;
    status: FakeTransactionStatus | string;
    transaction_id?: string;
    amount?: number | string;
    currency?: string;
    /** true (défaut) : signature HMAC incluse ; false : aucun champ ni en-tête de signature. */
    signed?: boolean;
    /** Secret utilisé pour signer (défaut : SAMIRPAY_WEBHOOK_SECRET). Un mauvais secret produit une signature invalide. */
    secret?: string;
}

export interface FakeWebhook {
    fields: Record<string, string>;
    body: string;
    headers: Record<string, string>;
    formData: FormData;
}

export function computeFakeWebhookSignature(fields: Record<string, string>, secret: string): string {
    const canonical = [fields.order_id, fields.transaction_id, fields.status, fields.amount ?? '', fields.currency ?? '']
        .map((v) => v ?? '')
        .join('|');
    return crypto.createHmac('sha256', secret).update(canonical).digest('hex');
}

export class FakeSamirPayGateway implements PaymentGateway {
    readonly calls: RecordedGatewayCall[] = [];
    initMode: FakeInitMode = 'success';
    cashoutMode: FakeCashoutMode = 'success';
    balance = 10_000_000;

    private statuses = new Map<string, FakeTransactionStatus>();
    private transactionIds = new Map<string, string>();
    private counter = 0;

    reset(): void {
        this.calls.length = 0;
        this.initMode = 'success';
        this.cashoutMode = 'success';
        this.balance = 10_000_000;
        this.statuses.clear();
        this.transactionIds.clear();
        this.counter = 0;
    }

    setTransactionStatus(orderId: string, status: FakeTransactionStatus): void {
        this.statuses.set(orderId, status);
    }

    transactionIdFor(orderId: string): string {
        let tx = this.transactionIds.get(orderId);
        if (!tx) {
            tx = `FAKE-TX-${++this.counter}`;
            this.transactionIds.set(orderId, tx);
        }
        return tx;
    }

    callsOf(method: RecordedGatewayCall['method']): RecordedGatewayCall[] {
        return this.calls.filter((c) => c.method === method);
    }

    private record(method: RecordedGatewayCall['method'], args: unknown): void {
        this.calls.push({ method, args, at: new Date().toISOString() });
    }

    async initPayment(payload: SamirPayInitPaymentRequest): Promise<SamirPayInitPaymentResponse> {
        this.record('initPayment', payload);
        if (this.initMode === 'throw') {
            throw new Error('Délai d\'attente dépassé lors de la communication avec SamirPay (simulation).');
        }
        if (this.initMode === 'failed-body') {
            return {
                status: 'failed',
                message: 'Paiement refusé par l\'opérateur (simulation).',
                order_id: payload.order_id,
            };
        }
        const transactionId = this.transactionIdFor(payload.order_id);
        if (!this.statuses.has(payload.order_id)) {
            this.statuses.set(payload.order_id, 'pending');
        }
        return {
            status: 'success',
            message: 'Transaction initiée (simulation).',
            transaction_id: transactionId,
            order_id: payload.order_id,
            payment_url: `http://127.0.0.1:9/fake-samirpay/pay/${transactionId}`,
            data: {
                transaction_id: transactionId,
                order_id: payload.order_id,
                payment_url: `http://127.0.0.1:9/fake-samirpay/pay/${transactionId}`,
            },
        };
    }

    async checkTransactionStatus(orderId: string): Promise<SamirPayCheckStatusResponse> {
        this.record('checkTransactionStatus', { orderId });
        return {
            status: this.statuses.get(orderId) ?? 'pending',
            transaction_id: this.transactionIdFor(orderId),
            order_id: orderId,
        };
    }

    async getSolde(): Promise<SamirPaySoldeResponse> {
        this.record('getSolde', {});
        return { status: 'success', solde: this.balance, balance: this.balance, currency: 'XOF' };
    }

    async sendCashout(payload: SamirPayCashoutRequest): Promise<SamirPayCashoutResponse> {
        this.record('sendCashout', payload);
        if (this.cashoutMode === 'throw') {
            throw new Error('Délai d\'attente dépassé lors du Cashout SamirPay (simulation).');
        }
        if (this.cashoutMode === 'failed') {
            return { status: 'failed', message: 'Cashout refusé par l\'opérateur (simulation).' };
        }
        return { status: 'success', transaction_id: `FAKE-OUT-${++this.counter}`, message: 'Cashout effectué (simulation).' };
    }

    /**
     * Construit la notification que SamirPay enverrait sur POST /api/webhooks/samirpay.
     * Utilisable avec `new NextRequest(url, { method: 'POST', body, headers })`.
     */
    buildWebhook(params: FakeWebhookParams): FakeWebhook {
        const fields: Record<string, string> = {
            order_id: params.order_id,
            transaction_id: params.transaction_id ?? this.transactionIdFor(params.order_id),
            status: params.status,
        };
        if (params.amount !== undefined) fields.amount = String(params.amount);
        if (params.currency !== undefined) fields.currency = params.currency;

        const headers: Record<string, string> = {
            'content-type': 'application/x-www-form-urlencoded',
        };

        const signed = params.signed ?? true;
        if (signed) {
            const secret = params.secret ?? process.env.SAMIRPAY_WEBHOOK_SECRET;
            if (!secret) {
                throw new Error('buildWebhook(signed) : SAMIRPAY_WEBHOOK_SECRET absent de l\'environnement de test.');
            }
            fields.signature = computeFakeWebhookSignature(fields, secret);
            headers['x-samirpay-signature'] = fields.signature;
        }

        const body = new URLSearchParams(fields).toString();
        const formData = new FormData();
        for (const [k, v] of Object.entries(fields)) formData.append(k, v);

        return { fields, body, headers, formData };
    }
}

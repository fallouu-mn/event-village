/**
 * Fausse passerelle SamirPay, alignée EXACTEMENT sur le contrat officiel (API Partenaires v1.0)
 * au niveau de la passerelle (lib/integrations/types.ts) : aucune requête réseau, comportement
 * pilotable, enregistrement de tous les appels.
 *  - initDirectPayment : identifiant de transaction UUID ; orderId en double → DUPLICATE (409) ;
 *    paramètres hors contrat → REJECTED (400) ; modes refus, délai dépassé, clés refusées ;
 *  - checkTransactionStatus : par identifiant SamirPay, { transactionId, status } SANS montant ;
 *    identifiant inconnu → NOT_FOUND (404) ;
 *  - getSolde : { solde } paramétrable ;
 *  - sendCashout : succès, refus, délai dépassé avant envoi (rien n'est parti) ou APRÈS envoi
 *    (l'argent est parti mais la réponse est perdue), réponse « en attente » ;
 *  - buildWebhook : form-urlencoded (transaction_id, order_id, status=success), adressé au
 *    callBackUrl reçu à l'initialisation, aucune signature ; refusé si la transaction n'est pas
 *    SUCCESS (le contrat n'envoie aucun webhook d'échec).
 * Le contrat exact est vérifié côté client réel par tests/samirpay-contrat.test.ts.
 */
import crypto from 'node:crypto';
import type { PaymentGateway } from '../../lib/integrations/types';
import {
    SAMIRPAY_OPERATORS,
    SamirPayError,
    type SamirPayCashoutRequest,
    type SamirPayCashoutResult,
    type SamirPayDirectInitRequest,
    type SamirPayDirectInitResult,
    type SamirPaySoldeResult,
    type SamirPayStatusResult,
    type SamirPayTransactionStatus,
} from '../../lib/samirpay/types';

export type FakeInitMode = 'success' | 'rejected' | 'timeout' | 'unauthorized';
export type FakeCashoutMode = 'success' | 'rejected' | 'timeout' | 'timeout-after-send' | 'pending';

export interface RecordedGatewayCall {
    method: 'initDirectPayment' | 'checkTransactionStatus' | 'getSolde' | 'sendCashout';
    args: Record<string, unknown>;
    at: string;
}

interface FakeTransaction {
    transactionId: string;
    orderId: string | null;
    kind: 'CASHIN' | 'CASHOUT';
    status: SamirPayTransactionStatus;
    callBackUrl: string | null;
    amount: number;
}

export interface FakeWebhook {
    url: string;
    body: string;
    headers: Record<string, string>;
    fields: Record<string, string>;
}

const PHONE9 = /^[0-9]{9}$/;

function normalizeStatus(s: string): SamirPayTransactionStatus {
    const up = s.toUpperCase();
    if (up === 'SUCCESS' || up === 'FAILED' || up === 'CANCELLED' || up === 'PENDING') return up;
    throw new Error(`Faux SamirPay : statut inconnu « ${s} »`);
}

export class FakeSamirPayGateway implements PaymentGateway {
    readonly calls: RecordedGatewayCall[] = [];
    initMode: FakeInitMode = 'success';
    cashoutMode: FakeCashoutMode = 'success';
    balance = 10_000_000;

    private transactions = new Map<string, FakeTransaction>();
    private byOrder = new Map<string, string>();

    reset(): void {
        this.calls.length = 0;
        this.initMode = 'success';
        this.cashoutMode = 'success';
        this.balance = 10_000_000;
        this.transactions.clear();
        this.byOrder.clear();
    }

    setInitMode(mode: FakeInitMode): void {
        this.initMode = mode;
    }

    setCashoutMode(mode: FakeCashoutMode): void {
        this.cashoutMode = mode;
    }

    /** Statut côté SamirPay d'une transaction (clé : identifiant SamirPay, ou orderId de l'initialisation). */
    setTransactionStatus(key: string, status: string): void {
        const tx = this.transactions.get(key) ?? this.transactions.get(this.byOrder.get(key) ?? '');
        if (!tx) throw new Error(`Faux SamirPay : transaction inconnue « ${key} »`);
        tx.status = normalizeStatus(status);
    }

    transactionIdForOrder(orderId: string): string | null {
        return this.byOrder.get(orderId) ?? null;
    }

    callsOf(method: RecordedGatewayCall['method']): RecordedGatewayCall[] {
        return this.calls.filter((c) => c.method === method);
    }

    private record(method: RecordedGatewayCall['method'], args: Record<string, unknown>): void {
        this.calls.push({ method, args: { ...args }, at: new Date().toISOString() });
    }

    async initDirectPayment(payload: SamirPayDirectInitRequest): Promise<SamirPayDirectInitResult> {
        this.record('initDirectPayment', payload as unknown as Record<string, unknown>);
        if (this.initMode === 'unauthorized') throw new SamirPayError('UNAUTHORIZED', 'Clés refusées (simulation)', 401);
        if (this.initMode === 'timeout') throw new SamirPayError('UNCERTAIN', 'Délai dépassé (simulation)');
        if (this.initMode === 'rejected') throw new SamirPayError('REJECTED', 'Paiement refusé par l’opérateur (simulation)', 400);
        if (!(payload.amount > 0) || !payload.orderId || !payload.callBackUrl || !SAMIRPAY_OPERATORS.includes(payload.operatorName) || (payload.telephone && !PHONE9.test(payload.telephone))) {
            throw new SamirPayError('REJECTED', 'Paramètre manquant ou invalide (simulation du contrat)', 400);
        }
        if (this.byOrder.has(payload.orderId)) throw new SamirPayError('DUPLICATE', 'orderId déjà utilisé (simulation)', 409);
        const transactionId = crypto.randomUUID();
        this.transactions.set(transactionId, { transactionId, orderId: payload.orderId, kind: 'CASHIN', status: 'PENDING', callBackUrl: payload.callBackUrl, amount: payload.amount });
        this.byOrder.set(payload.orderId, transactionId);
        return {
            transactionId,
            paymentUrl: `http://127.0.0.1:9/fake-samirpay/pay/${transactionId}`,
            qrCode: 'data:image/png;base64,ZmF1eA==',
            deepLinks: { wave: `http://127.0.0.1:9/fake-wave/${transactionId}`, orange: `http://127.0.0.1:9/fake-orange/${transactionId}` },
        };
    }

    async checkTransactionStatus(transactionId: string): Promise<SamirPayStatusResult> {
        this.record('checkTransactionStatus', { transactionId });
        const tx = this.transactions.get(transactionId);
        if (!tx) throw new SamirPayError('NOT_FOUND', 'Transaction introuvable (simulation)', 404);
        return { transactionId, status: tx.status };
    }

    async getSolde(): Promise<SamirPaySoldeResult> {
        this.record('getSolde', {});
        return { solde: this.balance, entityName: 'Event Village (simulation)' };
    }

    async sendCashout(payload: SamirPayCashoutRequest): Promise<SamirPayCashoutResult> {
        this.record('sendCashout', payload as unknown as Record<string, unknown>);
        if (!PHONE9.test(payload.phoneNumber) || !SAMIRPAY_OPERATORS.includes(payload.operatorName) || !payload.firstName || !payload.lastName || !(payload.amount > 0)) {
            throw new SamirPayError('REJECTED', 'Paramètre manquant ou invalide (simulation du contrat)', 400);
        }
        if (this.cashoutMode === 'rejected') throw new SamirPayError('REJECTED', 'Cashout refusé (simulation)', 409);
        if (this.cashoutMode === 'timeout') throw new SamirPayError('UNCERTAIN', 'Délai dépassé avant envoi (simulation)');
        if (payload.amount > this.balance) throw new SamirPayError('REJECTED', 'Solde insuffisant (simulation)', 409);
        const transactionId = crypto.randomUUID();
        this.balance -= payload.amount;
        const status: SamirPayTransactionStatus = this.cashoutMode === 'pending' ? 'PENDING' : 'SUCCESS';
        this.transactions.set(transactionId, { transactionId, orderId: null, kind: 'CASHOUT', status, callBackUrl: null, amount: payload.amount });
        if (this.cashoutMode === 'timeout-after-send') throw new SamirPayError('UNCERTAIN', 'Délai dépassé après envoi (simulation)');
        return { transactionId, status };
    }

    /**
     * Webhook que SamirPay enverrait au callBackUrl reçu : uniquement pour une transaction SUCCESS.
     */
    buildWebhook(transactionId: string): FakeWebhook {
        const tx = this.transactions.get(transactionId);
        if (!tx || tx.kind !== 'CASHIN' || !tx.callBackUrl || !tx.orderId) throw new Error(`Faux SamirPay : cashin inconnu « ${transactionId} »`);
        if (tx.status !== 'SUCCESS') throw new Error('Faux SamirPay : le contrat n’envoie de webhook qu’en cas de succès');
        const fields = { transaction_id: tx.transactionId, order_id: tx.orderId, status: 'success' };
        return {
            url: tx.callBackUrl,
            body: new URLSearchParams(fields).toString(),
            headers: { 'content-type': 'application/x-www-form-urlencoded' },
            fields,
        };
    }
}

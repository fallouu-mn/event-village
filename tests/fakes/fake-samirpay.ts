/**
 * Fausse passerelle SamirPay, alignée sur le contrat officiel (API Partenaires v1.2, lot 9 bis, T14)
 * au niveau de la passerelle (lib/integrations/types.ts) : aucune requête réseau, comportement
 * pilotable, enregistrement de tous les appels. Les formats HTTP A, B, C et D de la v1.2 sont lus par le
 * client réel (tests/samirpay-contrat.test.ts) ; ce faux en donne le résultat, déjà traduit.
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
    type SamirPayErrorKind,
    type SamirPaySoldeResult,
    type SamirPayStatusResult,
    type SamirPayTransactionStatus,
} from '../../lib/samirpay/types';

export type FakeInitMode = 'success' | 'rejected' | 'timeout' | 'unauthorized';
/**
 * Lot 9 bis (H7, T14) : conflict = 409 du transfert (interrompu, issue incertaine) ; insufficient = 400 « Solde
 * insuffisant » (code INSUFFICIENT_BALANCE, rien n'est débité) ; limits = 400 hors des limites du compte (code
 * ACCOUNT_LIMIT) ; rejected = refus 400 de l'opérateur (code OPERATOR_REFUSED, auparavant 409).
 */
export type FakeCashoutMode = 'success' | 'rejected' | 'timeout' | 'timeout-after-send' | 'pending' | 'conflict' | 'insufficient' | 'limits';

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

/**
 * SamirPayError porteur des champs de la v1.2 (`code`, `existingTransactionId`, contrat 4.5), posés sur l'objet :
 * le type les déclare à partir de fix(9b.H4) et fix(9b.H5) ; les services les lisent alors.
 */
function providerError(kind: SamirPayErrorKind, message: string, httpStatus: number | undefined, extra: { code?: string; existingTransactionId?: string } = {}): SamirPayError {
    return Object.assign(new SamirPayError(kind, message, httpStatus), extra);
}

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
    /** Lot 9 bis (H6, H7) : taux des frais réels renvoyés par un transfert (1,5 = 1,5 %), null = aucun frais renvoyé. */
    cashoutFeeRate: number | null = null;

    private transactions = new Map<string, FakeTransaction>();
    private byOrder = new Map<string, string>();

    reset(): void {
        this.calls.length = 0;
        this.initMode = 'success';
        this.cashoutMode = 'success';
        this.balance = 10_000_000;
        this.cashoutFeeRate = null;
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
        if (this.cashoutMode === 'rejected') throw providerError('REJECTED', 'Cashout refusé par l’opérateur (simulation)', 400, { code: 'OPERATOR_REFUSED' });
        if (this.cashoutMode === 'timeout') throw new SamirPayError('UNCERTAIN', 'Délai dépassé avant envoi (simulation)');
        if (this.cashoutMode === 'conflict') throw new SamirPayError('UNCERTAIN', 'Transfert interrompu, 409 (simulation)', 409);
        if (this.cashoutMode === 'limits') throw providerError('REJECTED', 'Montant hors des limites du compte (simulation)', 400, { code: 'ACCOUNT_LIMIT' });
        if (this.cashoutMode === 'insufficient' || payload.amount > this.balance) throw providerError('REJECTED', 'Solde insuffisant (simulation)', 400, { code: 'INSUFFICIENT_BALANCE' });
        const transactionId = crypto.randomUUID();
        this.balance -= payload.amount;
        const status: SamirPayTransactionStatus = this.cashoutMode === 'pending' ? 'PENDING' : 'SUCCESS';
        this.transactions.set(transactionId, { transactionId, orderId: null, kind: 'CASHOUT', status, callBackUrl: null, amount: payload.amount });
        if (this.cashoutMode === 'timeout-after-send') throw new SamirPayError('UNCERTAIN', 'Délai dépassé après envoi (simulation)');
        const result: SamirPayCashoutResult = { transactionId, status };
        if (this.cashoutFeeRate !== null) {
            // v1.2 (§5.1) : frais réels, débit total (valeur absolue de netAmount), références SamirPay et opérateur
            const fees = Math.round(payload.amount * this.cashoutFeeRate) / 100;
            const tail = crypto.randomBytes(4).toString('hex').toUpperCase();
            Object.assign(result, { fees, netAmount: payload.amount + fees, reference: `TX${tail}`, refOperator: payload.operatorName === 'WAVE' ? `pt-${tail.toLowerCase()}` : `CI${tail}` });
        }
        return result;
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

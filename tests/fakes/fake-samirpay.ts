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
 *    callBackUrl reçu à l'initialisation ; refusé si la transaction n'est pas SUCCESS (le contrat
 *    n'envoie aucun webhook d'échec). Lot 9 bis (H3, T14) : signature facultative X-SamirPay-Signature
 *    `t=<secondes>,v1=<hex>`, HMAC-SHA256 du secret entier (préfixe whsec_ compris) sur `t + "." + corps
 *    brut` ; `extraV1` ajoute une seconde valeur v1 (renouvellement), placée avant la bonne.
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

/**
 * Lot 9 bis (H4, T14) : timeout-after-create = transaction créée puis délai dépassé sans statut HTTP, une fois (la
 * relance au même orderId reçoit DUPLICATE porteur de l'identifiant) ; timeout-after-create-always = même chose à
 * chaque appel (relance sans réponse, PO6) ; timeout-once = délai dépassé une fois, rien de créé, puis succès.
 * Lot 9 bis (H8) : internal-error = 500 au format D (INTERNAL_ERROR, par exemple montant sous le minimum du
 * compte) : rien n'est créé, jamais relancé.
 */
export type FakeInitMode = 'success' | 'rejected' | 'timeout' | 'unauthorized' | 'timeout-after-create' | 'timeout-after-create-always' | 'timeout-once' | 'internal-error';
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

/** Signature facultative du webhook (H3). `t` en secondes, maintenant par défaut. */
export interface FakeWebhookSignature {
    secret: string;
    t?: number;
    extraV1?: string;
}

/** HMAC-SHA256 hexadécimal du secret sur `t + "." + corps brut` (v1.2, §7). */
export function samirPaySignatureV1(secret: string, t: number, rawBody: string): string {
    return crypto.createHmac('sha256', secret).update(`${t}.${rawBody}`).digest('hex');
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
        if (this.initMode === 'internal-error') throw providerError('UNCERTAIN', 'Erreur interne SamirPay, 500 (simulation)', 500, { code: 'INTERNAL_ERROR' });
        if (this.initMode === 'timeout-once') {
            this.initMode = 'success';
            throw new SamirPayError('UNCERTAIN', 'Délai dépassé une fois (simulation)');
        }
        if (this.initMode === 'rejected') throw new SamirPayError('REJECTED', 'Paiement refusé par l’opérateur (simulation)', 400);
        if (!(payload.amount > 0) || !payload.orderId || !payload.callBackUrl || !SAMIRPAY_OPERATORS.includes(payload.operatorName) || (payload.telephone && !PHONE9.test(payload.telephone))) {
            throw new SamirPayError('REJECTED', 'Paramètre manquant ou invalide (simulation du contrat)', 400);
        }
        const afterCreate = this.initMode === 'timeout-after-create' || this.initMode === 'timeout-after-create-always';
        const existing = this.byOrder.get(payload.orderId);
        if (existing && afterCreate) throw new SamirPayError('UNCERTAIN', 'Délai dépassé, transaction déjà créée (simulation)');
        // v1.2 (§3.1, 409 au format D) : l'identifiant de la transaction existante est rendu avec le doublon
        if (existing) throw providerError('DUPLICATE', `orderId déjà utilisé (transactionId=${existing}) (simulation)`, 409, { code: 'CONFLICT', existingTransactionId: existing });
        const transactionId = crypto.randomUUID();
        this.transactions.set(transactionId, { transactionId, orderId: payload.orderId, kind: 'CASHIN', status: 'PENDING', callBackUrl: payload.callBackUrl, amount: payload.amount });
        this.byOrder.set(payload.orderId, transactionId);
        if (afterCreate) {
            if (this.initMode === 'timeout-after-create') this.initMode = 'success';
            throw new SamirPayError('UNCERTAIN', 'Délai dépassé après la création de la transaction (simulation)');
        }
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
    buildWebhook(transactionId: string, signature?: FakeWebhookSignature): FakeWebhook {
        const tx = this.transactions.get(transactionId);
        if (!tx || tx.kind !== 'CASHIN' || !tx.callBackUrl || !tx.orderId) throw new Error(`Faux SamirPay : cashin inconnu « ${transactionId} »`);
        if (tx.status !== 'SUCCESS') throw new Error('Faux SamirPay : le contrat n’envoie de webhook qu’en cas de succès');
        const fields = { transaction_id: tx.transactionId, order_id: tx.orderId, status: 'success' };
        const body = new URLSearchParams(fields).toString();
        const headers: Record<string, string> = { 'content-type': 'application/x-www-form-urlencoded' };
        if (signature) {
            const t = signature.t ?? Math.floor(Date.now() / 1000);
            const v1 = samirPaySignatureV1(signature.secret, t, body);
            headers['x-samirpay-signature'] = [`t=${t}`, ...(signature.extraV1 ? [`v1=${signature.extraV1}`] : []), `v1=${v1}`].join(',');
        }
        return { url: tx.callBackUrl, body, headers, fields };
    }
}

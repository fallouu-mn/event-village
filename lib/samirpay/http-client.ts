/**
 * Client HTTP SamirPay (côté serveur exclusivement), aligné sur le contrat officiel API
 * Partenaires v1.0 (lot 2) :
 *  - cashin direct POST /api/tiers/direct/initPayment (montant en chaîne, orderId, callBackUrl,
 *    operatorName, telephone à 9 chiffres) ;
 *  - statut GET /api/tiers/payments/{transactionId}/status → { transactionId, status } ;
 *  - solde GET /api/tiers/payments/solde → data.solde ;
 *  - cashout POST /api/tiers/payments/send (phoneNumber 9 chiffres, montant en chaîne, prénom, nom).
 * En-têtes X-API-KEY et X-SECRET-KEY. Chemins fixés par le contrat sous SAMIRPAY_API_URL.
 * Chaque échec est levé en SamirPayError, avec une nature qui distingue le refus explicite de
 * l'issue incertaine (délai, coupure, 5xx, réponse illisible). Aucun numéro dans les journaux.
 */
import type { PaymentGateway } from '@/lib/integrations/types';
import { getServerEnv } from '@/lib/env';
import {
    SamirPayError,
    type SamirPayCashoutRequest,
    type SamirPayCashoutResult,
    type SamirPayDirectInitRequest,
    type SamirPayDirectInitResult,
    type SamirPayErrorKind,
    type SamirPaySoldeResult,
    type SamirPayStatusResult,
    type SamirPayTransactionStatus,
} from './types';

const STATUSES: readonly SamirPayTransactionStatus[] = ['PENDING', 'SUCCESS', 'FAILED', 'CANCELLED'];

interface RawResponse {
    status: number;
    body: unknown;
}

type Json = Record<string, unknown>;

function asObject(v: unknown): Json | null {
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Json) : null;
}

export class SamirPayHttpClient implements PaymentGateway {
    constructor() {
        if (typeof window !== 'undefined') {
            throw new Error('SamirPayHttpClient ne doit jamais être exécuté côté navigateur.');
        }
    }

    private get env() {
        return getServerEnv();
    }

    private url(path: string): string {
        return `${this.env.SAMIRPAY_API_URL.replace(/\/+$/, '')}${path}`;
    }

    /**
     * Appel HTTP brut. Délai dépassé ou coupure → UNCERTAIN (le corps est lu en texte puis
     * analysé : un 502 HTML n'est plus une SyntaxError non typée).
     */
    private async call(method: 'GET' | 'POST', path: string, body?: Json): Promise<RawResponse> {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.env.SAMIRPAY_TIMEOUT_MS);
        try {
            const res = await fetch(this.url(path), {
                method,
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-KEY': this.env.SAMIRPAY_API_KEY,
                    'X-SECRET-KEY': this.env.SAMIRPAY_SECRET_KEY,
                },
                body: body ? JSON.stringify(body) : undefined,
                signal: controller.signal,
            });
            const text = await res.text();
            let parsed: unknown = null;
            if (text) {
                try {
                    parsed = JSON.parse(text);
                } catch {
                    parsed = undefined; // corps non JSON : traité par l'appelant selon le statut HTTP
                }
            }
            return { status: res.status, body: parsed };
        } catch (err) {
            const aborted = err instanceof Error && err.name === 'AbortError';
            throw new SamirPayError('UNCERTAIN', aborted ? `SamirPay : délai de ${this.env.SAMIRPAY_TIMEOUT_MS} ms dépassé (${method} ${path.split('/').slice(0, 4).join('/')}).` : `SamirPay injoignable : ${err instanceof Error ? err.message : String(err)}`);
        } finally {
            clearTimeout(timer);
        }
    }

    private failure(res: RawResponse, context: string, conflictKind: SamirPayErrorKind): SamirPayError {
        const message = String(asObject(res.body)?.message ?? `HTTP ${res.status}`);
        if (res.status >= 500 || res.body === undefined) return new SamirPayError('UNCERTAIN', `${context} : ${message}`, res.status);
        if (res.status === 401 || res.status === 403) return new SamirPayError('UNAUTHORIZED', `${context} : clés refusées (${res.status})`, res.status);
        if (res.status === 404) return new SamirPayError('NOT_FOUND', `${context} : introuvable`, res.status);
        if (res.status === 409) return new SamirPayError(conflictKind, `${context} : ${message}`, res.status);
        return new SamirPayError('REJECTED', `${context} : ${message}`, res.status);
    }

    async initDirectPayment(payload: SamirPayDirectInitRequest): Promise<SamirPayDirectInitResult> {
        const body: Json = {
            amount: String(Math.round(payload.amount)),
            orderId: payload.orderId,
            callBackUrl: payload.callBackUrl,
            operatorName: payload.operatorName,
            telephone: payload.telephone,
        };
        if (payload.description) body.description = payload.description;
        const res = await this.call('POST', '/api/tiers/direct/initPayment', body);
        if (res.status !== 200 && res.status !== 201) throw this.failure(res, `Cashin ${payload.orderId}`, 'DUPLICATE');
        const root = asObject(res.body);
        const data = asObject(root?.data);
        if (!root || root.success === false || !data || typeof data.transactionId !== 'string' || !data.transactionId) {
            throw new SamirPayError('INVALID_RESPONSE', `Cashin ${payload.orderId} : réponse sans transactionId`, res.status);
        }
        const urls = asObject(data.urls);
        return {
            transactionId: data.transactionId,
            paymentUrl: typeof data.url === 'string' ? data.url : null,
            qrCode: typeof data.qrCode === 'string' ? data.qrCode : null,
            deepLinks: {
                wave: typeof urls?.wave === 'string' ? urls.wave : null,
                orange: typeof urls?.orange === 'string' ? urls.orange : null,
            },
        };
    }

    async checkTransactionStatus(transactionId: string): Promise<SamirPayStatusResult> {
        const res = await this.call('GET', `/api/tiers/payments/${encodeURIComponent(transactionId)}/status`);
        if (res.status !== 200) {
            const err = this.failure(res, `Statut ${transactionId}`, 'REJECTED');
            // Un statut illisible n'a pas d'effet financier : réponse invalide, à redemander.
            throw err.kind === 'UNCERTAIN' && res.status < 500 ? new SamirPayError('INVALID_RESPONSE', err.message, res.status) : err;
        }
        const root = asObject(res.body);
        const status = String(root?.status ?? '').toUpperCase() as SamirPayTransactionStatus;
        if (!root || root.transactionId !== transactionId || !STATUSES.includes(status)) {
            throw new SamirPayError('INVALID_RESPONSE', `Statut ${transactionId} : réponse non corrélée ou statut inconnu`, res.status);
        }
        return { transactionId, status };
    }

    async getSolde(): Promise<SamirPaySoldeResult> {
        const res = await this.call('GET', '/api/tiers/payments/solde');
        if (res.status !== 200) throw this.failure(res, 'Solde', 'REJECTED');
        const data = asObject(asObject(res.body)?.data);
        const solde = Number(data?.solde);
        if (!data || !Number.isFinite(solde)) throw new SamirPayError('INVALID_RESPONSE', 'Solde : data.solde absent', res.status);
        return { solde, entityName: typeof data.samirEntityName === 'string' ? data.samirEntityName : null };
    }

    async sendCashout(payload: SamirPayCashoutRequest): Promise<SamirPayCashoutResult> {
        const res = await this.call('POST', '/api/tiers/payments/send', {
            phoneNumber: payload.phoneNumber,
            operatorName: payload.operatorName,
            amount: String(Math.round(payload.amount)),
            firstName: payload.firstName,
            lastName: payload.lastName,
        });
        if (res.status !== 200 && res.status !== 201) throw this.failure(res, 'Cashout', 'REJECTED');
        const root = asObject(res.body);
        if (root?.status === 'error') throw new SamirPayError('REJECTED', `Cashout : ${String(root.message ?? 'refusé')}`, res.status);
        const data = asObject(root?.data);
        if (!root || root.status !== 'success' || !data || typeof data.transactionId !== 'string') {
            // Envoi peut-être effectué : jamais traité comme un échec
            throw new SamirPayError('UNCERTAIN', 'Cashout : réponse illisible, envoi possiblement effectué', res.status);
        }
        return { transactionId: data.transactionId, status: String(data.status ?? 'SUCCESS').toUpperCase() };
    }
}

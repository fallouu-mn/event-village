/**
 * Client HTTP SamirPay (côté serveur exclusivement), aligné sur le contrat officiel API Partenaires v1.2
 * (lot 9 bis, H5). Chaque endpoint est lu dans son format documenté :
 *  - format A (`status` « success »/« error », `message`, `body`) : solde, transfert, erreurs d'authentification ;
 *  - format B (`success`, `data`, ou `errorCode` et `errorMessage`) : cashin direct ;
 *  - format C (objet nu `{ transactionId, status }`) : statut d'une transaction ;
 *  - format D (`status` numérique, `errorCode`, `message`, `path`, `timestamp`) : doublon d'orderId, erreurs 500
 *    et erreurs communes.
 * Endpoints : cashin direct POST /api/tiers/direct/initPayment (201 B : transactionId, url, urls.OM / urls.MAXIT,
 * qrCode en base64 brut) ; statut GET /api/tiers/payments/{transactionId}/status (C : PENDING, SUCCESS, FAILED,
 * CANCELLED ; 404 NOT_FOUND ; 400 INVALID_ID) ; solde GET /api/tiers/payments/solde (A : body.solde) ; transfert POST
 * /api/tiers/payments/send (A : body = Transaction, statut interne traduit par mapInternalStatus).
 * En-têtes X-API-KEY et X-SECRET-KEY. Chemins fixés par le contrat sous SAMIRPAY_API_URL.
 * Chaque échec est levé en SamirPayError, avec une nature qui distingue le refus explicite de l'issue incertaine.
 * Une réponse hors format est journalisée et levée (INVALID_RESPONSE, ou UNCERTAIN pour un transfert) : jamais un
 * succès supposé. Aucun numéro dans les journaux.
 */
import type { PaymentGateway } from '@/lib/integrations/types';
import { getServerEnv } from '@/lib/env';
import {
    SAMIRPAY_STATUSES,
    SamirPayError,
    mapInternalStatus,
    type SamirPayCashoutRequest,
    type SamirPayCashoutResult,
    type SamirPayDirectInitRequest,
    type SamirPayDirectInitResult,
    type SamirPayErrorKind,
    type SamirPaySoldeResult,
    type SamirPayStatusResult,
    type SamirPayTransactionStatus,
} from './types';

interface RawResponse {
    status: number;
    /** Corps JSON analysé ; null si vide ; undefined si non JSON. */
    body: unknown;
}

type Json = Record<string, unknown>;

/** Lot 8 (8.1, L19) : cible explicite, pour la passerelle de développement. Sans elle, tout vient de getServerEnv(). */
export interface SamirPayClientOptions {
    baseUrl: string;
    apiKey: string;
    secretKey: string;
}

function asObject(v: unknown): Json | null {
    return v && typeof v === 'object' && !Array.isArray(v) ? (v as Json) : null;
}

function text(v: unknown): string | null {
    return typeof v === 'string' && v.trim() !== '' ? v : null;
}

/** Montant reçu en décimal (nombre JSON, ou chaîne décimale). */
function decimal(v: unknown): number | null {
    if (typeof v === 'number') return Number.isFinite(v) ? v : null;
    if (typeof v === 'string' && /^-?\d+(\.\d+)?$/.test(v.trim())) return Number(v.trim());
    return null;
}

/** Format A : `status` « success » ou « error », `message`, `body` (absent en erreur). */
interface FormatA {
    status: 'success' | 'error';
    message: string | null;
    body: Json | null;
}

function readA(raw: unknown): FormatA | null {
    const o = asObject(raw);
    if (!o || (o.status !== 'success' && o.status !== 'error')) return null;
    return { status: o.status, message: text(o.message), body: asObject(o.body) };
}

/** Format B : `success` vrai et `data`, ou `success` faux et `errorCode`, `errorMessage`. */
type FormatB = { success: true; data: Json } | { success: false; errorCode: string | null; errorMessage: string | null };

function readB(raw: unknown): FormatB | null {
    const o = asObject(raw);
    if (!o || typeof o.success !== 'boolean') return null;
    if (o.success) {
        const data = asObject(o.data);
        return data ? { success: true, data } : null;
    }
    return { success: false, errorCode: text(o.errorCode), errorMessage: text(o.errorMessage) };
}

/** Format C : objet nu `{ transactionId, status }` de l'endpoint de statut. */
function readC(raw: unknown): { transactionId: unknown; status: string | null } | null {
    const o = asObject(raw);
    return o ? { transactionId: o.transactionId, status: typeof o.status === 'string' ? o.status : null } : null;
}

/** Format D : `status` numérique, `errorCode`, `message`, `path`, `timestamp`. */
function readD(raw: unknown): { status: number; errorCode: string | null; message: string | null } | null {
    const o = asObject(raw);
    if (!o || typeof o.status !== 'number') return null;
    return { status: o.status, errorCode: text(o.errorCode), message: text(o.message) };
}

/** Motif et code d'une réponse d'erreur, quel que soit son format documenté (D, B, puis A). */
function errorDetail(raw: unknown): { message: string | null; code?: string; format: 'A' | 'B' | 'D' | null } {
    const d = readD(raw);
    if (d) return { message: d.message, code: d.errorCode ?? undefined, format: 'D' };
    const b = readB(raw);
    if (b && !b.success) return { message: b.errorMessage, code: b.errorCode ?? undefined, format: 'B' };
    const a = readA(raw);
    if (a && a.status === 'error') return { message: a.message, format: 'A' };
    return { message: null, format: null };
}

const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

/**
 * Lot 9 bis (H7, contrat 4.5) : motif d'un refus 400 du transfert (format A). Les mots classants sont SUPPOSÉS
 * conformes à la v1.2 (à confirmer en bac à sable) : « Solde insuffisant » → INSUFFICIENT_BALANCE (rien n'est
 * débité, repris quand le solde revient) ; « minimum autorisé » ou « maximum autorisé » → ACCOUNT_LIMIT ; tout autre
 * 400 → OPERATOR_REFUSED.
 */
/** Lot 9 bis (H4) : `transactionId=<uuid>` dans le message d'un 409 au format D, ou null. */
export function existingTransactionIdOf(message: string | null): string | null {
    const m = /transactionId=([0-9a-f-]{36})/i.exec(message ?? '');
    return m ? m[1] : null;
}

export type CashoutRefusalCode = 'INSUFFICIENT_BALANCE' | 'ACCOUNT_LIMIT' | 'OPERATOR_REFUSED';

export function cashoutRefusalCode(message: string | null): CashoutRefusalCode {
    const m = (message ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    if (/solde insuffisant/.test(m)) return 'INSUFFICIENT_BALANCE';
    if (/(minimum|maximum) autorise/.test(m)) return 'ACCOUNT_LIMIT';
    return 'OPERATOR_REFUSED';
}

/** Classement d'un échec : nature d'un 409, et nature d'une réponse hors contrat (404 d'une route, 2xx inattendu). */
interface FailureRules {
    conflict: SamirPayErrorKind;
    unexpected: 'INVALID_RESPONSE' | 'UNCERTAIN';
}

export class SamirPayHttpClient implements PaymentGateway {
    constructor(private readonly options?: SamirPayClientOptions) {
        if (typeof window !== 'undefined') {
            throw new Error('SamirPayHttpClient ne doit jamais être exécuté côté navigateur.');
        }
    }

    private get env() {
        return getServerEnv();
    }

    private url(path: string): string {
        return `${(this.options?.baseUrl ?? this.env.SAMIRPAY_API_URL).replace(/\/+$/, '')}${path}`;
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
                    'X-API-KEY': this.options?.apiKey ?? this.env.SAMIRPAY_API_KEY,
                    'X-SECRET-KEY': this.options?.secretKey ?? this.env.SAMIRPAY_SECRET_KEY,
                },
                body: body ? JSON.stringify(body) : undefined,
                signal: controller.signal,
            });
            const raw = await res.text();
            let parsed: unknown = null;
            if (raw) {
                try {
                    parsed = JSON.parse(raw);
                } catch {
                    parsed = undefined; // corps non JSON : classé par failure() ou par le lecteur du format attendu
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

    /** Réponse hors du format documenté : journalisée, puis levée par l'appelant. */
    private offFormat(kind: SamirPayErrorKind, message: string, httpStatus: number, code?: string): SamirPayError {
        console.error(`[samirpay] ${message} (HTTP ${httpStatus})`);
        return new SamirPayError(kind, message, httpStatus, { code });
    }

    private failure(res: RawResponse, context: string, rules: FailureRules): SamirPayError {
        const detail = errorDetail(res.body);
        if (detail.format === null) console.error(`[samirpay] ${context} : erreur HTTP ${res.status} hors des formats A, B et D`);
        const message = `${context} : ${detail.message ?? `HTTP ${res.status}`}`;
        const options = { code: detail.code };
        if (res.status >= 500 || res.body === undefined) return new SamirPayError('UNCERTAIN', message, res.status, options);
        if (res.status === 401 || res.status === 403) return new SamirPayError('UNAUTHORIZED', `${context} : clés refusées (${res.status})`, res.status, options);
        if (res.status === 409) return new SamirPayError(rules.conflict, message, res.status, options);
        if (res.status === 404) return this.offFormat(rules.unexpected, `${context} : route introuvable (404)`, res.status, detail.code);
        if (res.status >= 400) return new SamirPayError('REJECTED', message, res.status, options);
        return this.offFormat(rules.unexpected, `${context} : réponse HTTP ${res.status} inattendue`, res.status);
    }

    /** QR de la v1.2 en base64 brut, rendu en data URL ; une valeur illisible est journalisée et ignorée. */
    private qrDataUrl(value: unknown, context: string): string | null {
        if (value === undefined || value === null) return null;
        if (typeof value === 'string') {
            if (value.startsWith('data:image/')) return value;
            const compact = value.replace(/\s/g, '');
            if (compact && BASE64.test(compact)) return `data:image/png;base64,${compact}`;
        }
        console.error(`[samirpay] ${context} : qrCode hors format (base64 attendu), ignoré`);
        return null;
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
        const context = `Cashin ${payload.orderId}`;
        const res = await this.call('POST', '/api/tiers/direct/initPayment', body);
        if (res.status !== 200 && res.status !== 201) {
            const err = this.failure(res, context, { conflict: 'DUPLICATE', unexpected: 'INVALID_RESPONSE' });
            if (err.kind === 'DUPLICATE') {
                // v1.2 (H4) : le 409 au format D porte l'identifiant de la transaction existante dans son message
                const existing = existingTransactionIdOf(errorDetail(res.body).message);
                if (existing) err.existingTransactionId = existing;
                else console.error(`[samirpay] ${context} : orderId en double sans identifiant de transaction lisible dans le 409`);
            }
            throw err;
        }
        const b = readB(res.body);
        const transactionId = b?.success ? text(b.data.transactionId) : null;
        if (!b || !b.success || !transactionId) {
            throw this.offFormat('INVALID_RESPONSE', `${context} : réponse hors format B ou sans data.transactionId`, res.status);
        }
        const urls = asObject(b.data.urls);
        return {
            transactionId,
            paymentUrl: text(b.data.url),
            qrCode: this.qrDataUrl(b.data.qrCode, context),
            // v1.2 : Orange Money donne ses liens sous urls.OM et urls.MAXIT ; Wave n'a que url.
            deepLinks: { wave: null, orange: text(urls?.OM) ?? text(urls?.MAXIT) },
        };
    }

    async checkTransactionStatus(transactionId: string): Promise<SamirPayStatusResult> {
        const context = `Statut ${transactionId}`;
        const res = await this.call('GET', `/api/tiers/payments/${encodeURIComponent(transactionId)}/status`);
        const c = readC(res.body);
        if (res.status === 200) {
            const status = (c?.status ?? '').toUpperCase() as SamirPayTransactionStatus;
            if (!c || c.transactionId !== transactionId || !SAMIRPAY_STATUSES.includes(status)) {
                throw this.offFormat('INVALID_RESPONSE', `${context} : réponse non corrélée ou statut inconnu (format C)`, res.status);
            }
            return { transactionId, status };
        }
        if (res.status === 404) {
            if (c?.status === 'NOT_FOUND') throw new SamirPayError('NOT_FOUND', `${context} : introuvable`, res.status);
            throw this.offFormat('INVALID_RESPONSE', `${context} : 404 sans statut NOT_FOUND (format C), jamais tenu pour une transaction inexistante`, res.status);
        }
        if (res.status === 400 && c?.status === 'INVALID_ID') {
            throw this.offFormat('INVALID_RESPONSE', `${context} : identifiant refusé par SamirPay (INVALID_ID)`, res.status, 'INVALID_ID');
        }
        const err = this.failure(res, context, { conflict: 'INVALID_RESPONSE', unexpected: 'INVALID_RESPONSE' });
        // Un statut n'a pas d'effet financier : seul un 5xx reste incertain, un 4xx non documenté est une réponse invalide.
        if ((err.kind === 'UNCERTAIN' && res.status < 500) || err.kind === 'REJECTED') {
            throw this.offFormat('INVALID_RESPONSE', err.message, res.status, err.code);
        }
        throw err;
    }

    async getSolde(): Promise<SamirPaySoldeResult> {
        const res = await this.call('GET', '/api/tiers/payments/solde');
        if (res.status !== 200) throw this.failure(res, 'Solde', { conflict: 'INVALID_RESPONSE', unexpected: 'INVALID_RESPONSE' });
        const a = readA(res.body);
        const solde = decimal(a?.body?.solde);
        if (!a || a.status !== 'success' || !a.body || solde === null) {
            throw this.offFormat('INVALID_RESPONSE', 'Solde : réponse hors format A ou body.solde absent', res.status);
        }
        return { solde, entityName: text(a.body.samirEntityName) };
    }

    async sendCashout(payload: SamirPayCashoutRequest): Promise<SamirPayCashoutResult> {
        const res = await this.call('POST', '/api/tiers/payments/send', {
            phoneNumber: payload.phoneNumber,
            operatorName: payload.operatorName,
            amount: String(Math.round(payload.amount)),
            firstName: payload.firstName,
            lastName: payload.lastName,
        });
        if (res.status !== 200 && res.status !== 201) {
            // v1.2 (H7) : un 409 est un transfert interrompu, issue incertaine (jamais un refus : aucun solde rendu,
            // aucun renvoi automatique) ; un 400 est un refus sans débit, classé pour que le versement soit bloqué
            // (solde, limites) plutôt qu'échoué.
            const err = this.failure(res, 'Cashout', { conflict: 'UNCERTAIN', unexpected: 'UNCERTAIN' });
            if (err.kind === 'REJECTED' && res.status === 400) err.code = cashoutRefusalCode(errorDetail(res.body).message);
            throw err;
        }
        // Envoi peut-être effectué : toute forme inattendue est INCERTAINE, jamais un échec ni un succès supposés.
        const a = readA(res.body);
        const tx = a?.status === 'success' ? a.body : null;
        const id = text(tx?.id);
        if (!tx || !id) throw this.offFormat('UNCERTAIN', 'Cashout : réponse hors format A ou sans body.id, envoi possiblement effectué', res.status);
        const reference = text(tx.reference);
        const status = mapInternalStatus(tx.status);
        if (!status) {
            throw this.offFormat('UNCERTAIN', `Cashout : statut interne inconnu « ${String(tx.status).slice(0, 30)} » (transaction ${id}, référence ${reference ?? 'absente'}), envoi possiblement effectué`, res.status);
        }
        const netAmount = decimal(tx.netAmount);
        return {
            transactionId: id,
            status,
            reference,
            fees: decimal(tx.fees),
            netAmount: netAmount === null ? null : Math.abs(netAmount),
            refOperator: text(tx.refOperator),
        };
    }
}

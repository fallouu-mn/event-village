/**
 * Lot 8 (contrat 15.2, 3.2 de la découverte essai) — cœur commun des faux services HTTP : faux SamirPay,
 * faux MTarget, recherche d'un paiement et webhook. Deux entrées l'utilisent : scripts/e2e/fake-services.mjs
 * (tests de bout en bout) et, à venir, scripts/dev/fake-samirpay.mjs (mode d'essai local).
 *
 * Ce module n'a aucun effet à l'import : il ne lit aucune variable d'environnement, n'écoute aucun port et
 * ne contient aucune garde. Les refus de démarrer appartiennent à chaque entrée (scripts/e2e/env.mjs pour
 * l'e2e). Le contrat des routes est décrit en tête de fake-services.mjs.
 *
 * L'appelant fournit à createFakeCore :
 *  - base : origine des faux services (http://127.0.0.1:<port>) ;
 *  - sp, mt : chemins de SamirPay et de MTarget, sans barre finale (mt vaut au moins « / ») ;
 *  - transactions : Map transactionId → transaction, que l'appelant peut relire ou sauvegarder ; c'est le
 *    seul état des paiements (le refus d'un orderId déjà vu et la recherche par orderId s'y lisent) ;
 *  - authorized : { samirpay(req), mtarget(body) }, contrôle des identifiants reçus ;
 *  - webhookTarget(tx) : { ok: true, target } ou { ok: false, error }, vérifié AVANT de changer le statut ;
 *  - postWebhook(tx, target) : { ok: true, status, body } ou { ok: false, error } ;
 *  - onSms(sms) : reçoit chaque SMS accepté ;
 *  - log(message) : journal de l'entrée ;
 *  - paymentPage(transactionId), facultatif : adresse de la page de paiement servie à l'application.
 *
 * Lot 9 bis (H5, A1) : les réponses suivent l'API SamirPay v1.2, lue par lib/samirpay/http-client.ts :
 *  - cashin direct, format B : 201 { success, data: { transactionId, url, qrCode, urls, paymentMode, instruction } } ;
 *    Wave : url = page de paiement, urls null ; Orange Money : url null, urls { OM, MAXIT } ; qrCode en base64 brut
 *    (image PNG fixe : le faux service n'encode aucun QR) ; 400 B { success: false, errorCode, errorMessage } ;
 *    orderId déjà vu : 409 au format D (CONFLICT, transactionId=<identifiant existant> dans message) ;
 *  - statut, format C : 200 { transactionId, status } ; 404 { transactionId, status: NOT_FOUND } ; identifiant qui n'est
 *    pas un UUID : 400 { transactionId: null, status: INVALID_ID } ;
 *  - solde, format A : 200 { status: success, message, body: { samirEntityName, solde } } ;
 *  - transfert, format A : 200 { status: success, message, body: Transaction (id, reference, statut interne « V »,
 *    amount et netAmount négatifs, fees, refOperator) } ; 400 A pour un solde insuffisant (montant et frais) ou un
 *    corps invalide ; 409 A une fois après POST /__test/samirpay/conflict (transfert interrompu, rien de débité) ;
 *    frais au taux réglé par POST /__test/samirpay/fees { rate } (pourcentage, 0 par défaut) ;
 *  - erreurs communes : 401 au format A, corps JSON illisible au format D (MALFORMED_JSON) ;
 *  - /__test/samirpay/complete accepte une transaction FAILED (succès tardif après expiration, H1) ;
 *  - postLocalWebhook signe le webhook (X-SamirPay-Signature t=…,v1=…) si un webhookSecret est fourni (H3).
 */
import http from 'node:http';
import { createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';

export const MAX_BODY = 1024 * 1024;

const OPERATORS = new Set(['WAVE', 'ORANGE_MONEY']);
const PHONE9 = /^[0-9]{9}$/;
const AMOUNT = /^[1-9][0-9]*$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** QR du faux service : image PNG fixe (1 pixel gris), en base64 brut comme la v1.2. */
const FAKE_QR_PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAAAAAA6fptVAAAACklEQVR4nGNwAAAAQgBBKTf07wAAAABJRU5ErkJggg==';

/** Date au format de la v1.2 : ISO sans fuseau, en UTC. */
function isoNoZone(date = new Date()) {
    return date.toISOString().slice(0, 19);
}

/** Erreur au format D (doublon d'orderId, erreurs communes). */
function formatD(res, status, errorCode, message, path) {
    return json(res, status, { status, errorCode, message, path, timestamp: isoNoZone() });
}

export function sameSecret(received, expected) {
    const a = Buffer.from(String(received ?? ''));
    const b = Buffer.from(String(expected));
    return a.length === b.length && timingSafeEqual(a, b);
}

export function json(res, status, body) {
    res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
    res.end(JSON.stringify(body));
    return status;
}

export function readBody(req) {
    return new Promise((resolve, reject) => {
        let size = 0;
        const chunks = [];
        req.on('data', (c) => {
            size += c.length;
            if (size > MAX_BODY) {
                reject(new Error('corps trop volumineux'));
                req.destroy();
                return;
            }
            chunks.push(c);
        });
        req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
        req.on('error', reject);
    });
}

export function parseJson(raw) {
    if (!raw) return { ok: true, value: {} };
    try {
        const value = JSON.parse(raw);
        if (!value || typeof value !== 'object' || Array.isArray(value)) return { ok: false, error: 'objet JSON attendu' };
        return { ok: true, value };
    } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
}

function extraKeys(body, allowed) {
    return Object.keys(body).filter((k) => !allowed.includes(k));
}

/** Cible du webhook : uniquement l'origine donnée (l'application locale). */
export function webhookTargetFor(appOrigin) {
    return (tx) => {
        let target;
        try {
            target = new URL(tx.callBackUrl);
        } catch (err) {
            return { ok: false, error: `callBackUrl illisible : ${err instanceof Error ? err.message : String(err)}` };
        }
        if (target.origin !== appOrigin) {
            return { ok: false, error: `callBackUrl hors de l'application locale (${target.origin} au lieu de ${appOrigin}) : webhook non envoyé, statut inchangé` };
        }
        return { ok: true, target };
    };
}

/**
 * Webhook posté à l'application locale : connexion sur 127.0.0.1 (adresse d'écoute de next start),
 * en-tête Host d'origine (localhost:<port>) conservé, comme le ferait SamirPay sur le vrai domaine.
 * Le port de connexion est celui de la cible, sauf s'il est donné (URL publique d'un tunnel).
 * Lot 9 bis (H3) : avec `webhookSecret`, en-tête X-SamirPay-Signature `t=<secondes>,v1=<hex>`, HMAC-SHA256 du secret
 * entier sur `t + "." + corps brut`, comme la v1.2.
 */
export function postLocalWebhook(tx, target, port = Number(target.port || 80), { webhookSecret } = {}) {
    const body = new URLSearchParams({ transaction_id: tx.transactionId, order_id: tx.orderId ?? '', status: 'success' }).toString();
    const headers = { host: target.host, 'content-type': 'application/x-www-form-urlencoded', 'content-length': Buffer.byteLength(body) };
    if (webhookSecret) {
        const t = Math.floor(Date.now() / 1000);
        headers['x-samirpay-signature'] = `t=${t},v1=${createHmac('sha256', webhookSecret).update(`${t}.${body}`).digest('hex')}`;
    }
    return new Promise((resolve) => {
        const req = http.request({
            host: '127.0.0.1',
            port,
            method: 'POST',
            path: `${target.pathname}${target.search}`,
            headers,
            timeout: 30_000,
        }, (res) => {
            const chunks = [];
            res.on('data', (c) => chunks.push(c));
            res.on('end', () => resolve({ ok: true, status: res.statusCode ?? 0, body: Buffer.concat(chunks).toString('utf8').slice(0, 500) }));
        });
        req.on('timeout', () => req.destroy(new Error('délai de 30 s dépassé')));
        req.on('error', (err) => resolve({ ok: false, error: `webhook injoignable : ${err.message}` }));
        req.end(body);
    });
}

/**
 * Crée les routes à partir de l'état et des règles de l'appelant.
 * @param {{
 *   base: string,
 *   sp: string,
 *   mt: string,
 *   transactions: Map<string, {transactionId: string, kind: 'CASHIN'|'CASHOUT', orderId: string|null, amount: number, operatorName: string, telephone: string, callBackUrl: string|null, status: string, createdAt: string, fees?: number, reference?: string, refOperator?: string}>,
 *   authorized: { samirpay: (req: import('node:http').IncomingMessage) => boolean, mtarget: (body: Record<string, unknown>) => boolean },
 *   webhookTarget: (tx: object) => ({ok: true, target: URL} | {ok: false, error: string}),
 *   postWebhook: (tx: object, target: URL) => Promise<{ok: true, status: number, body: string} | {ok: false, error: string}>,
 *   onSms: (sms: {ticket: string, msisdn: string, sender: string, message: string, receivedAt: string}) => void,
 *   log: (message: string) => void,
 *   paymentPage?: (transactionId: string) => string,
 * }} options
 * @returns {{
 *   route: (req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse, url: URL) => Promise<number|null>,
 *   control: (req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse, url: URL) => Promise<number|null>,
 * }} route et control renvoient le statut servi, ou null si le chemin ne les concerne pas (rien n'est répondu).
 */
export function createFakeCore({ base, sp, mt, transactions, authorized, webhookTarget, postWebhook, onSms, log, paymentPage = (id) => `${base}/__pay/${id}` }) {
    let balance = 50_000_000;
    /** Frais des transferts en pourcentage (v1.2 : débit = montant + frais) ; 0 par défaut, réglé par /__test/samirpay/fees. */
    let feeRate = 0;
    /** Prochain transfert en 409 au format A (transfert interrompu), une fois. */
    let nextSendConflict = false;

    function transactionOfOrder(orderId) {
        return [...transactions.values()].find((t) => t.orderId === orderId) ?? null;
    }

    function findCashin(body) {
        if (typeof body.transactionId === 'string') return transactions.get(body.transactionId) ?? null;
        if (typeof body.orderId === 'string') return transactionOfOrder(body.orderId);
        if (typeof body.telephone === 'string') {
            const phone = body.telephone.replace(/\D/g, '').replace(/^221/, '');
            const pending = [...transactions.values()].filter((t) => t.kind === 'CASHIN' && t.telephone === phone && t.status === 'PENDING');
            return pending.length > 0 ? pending[pending.length - 1] : null;
        }
        return null;
    }

    async function handleSamirPay(req, res, sub) {
        if (!authorized.samirpay(req)) return json(res, 401, { status: 'error', message: 'Clés API invalides' });
        if (req.method === 'POST' && sub === '/api/tiers/direct/initPayment') {
            const parsed = parseJson(await readBody(req));
            if (!parsed.ok) return formatD(res, 400, 'MALFORMED_JSON', `Corps invalide : ${parsed.error}`, sub);
            const b = parsed.value;
            const extra = extraKeys(b, ['amount', 'orderId', 'callBackUrl', 'operatorName', 'telephone', 'description']);
            const problems = [
                ...extra.map((k) => `champ hors contrat : ${k}`),
                typeof b.amount === 'string' && AMOUNT.test(b.amount) ? null : 'amount : chaîne de chiffres attendue',
                typeof b.orderId === 'string' && b.orderId ? null : 'orderId requis',
                typeof b.callBackUrl === 'string' && URL.canParse(b.callBackUrl) ? null : 'callBackUrl : URL attendue',
                OPERATORS.has(b.operatorName) ? null : 'operatorName : WAVE ou ORANGE_MONEY',
                typeof b.telephone === 'string' && PHONE9.test(b.telephone) ? null : 'telephone : 9 chiffres',
                b.description === undefined || (typeof b.description === 'string' && b.description.length <= 255) ? null : 'description invalide',
            ].filter(Boolean);
            if (problems.length > 0) return json(res, 400, { success: false, errorCode: 'INVALID_REQUEST', errorMessage: problems.join(' ; ') });
            const existing = transactionOfOrder(b.orderId);
            if (existing) return formatD(res, 409, 'CONFLICT', `orderId déjà utilisé (faux SamirPay, transactionId=${existing.transactionId})`, sub);
            const transactionId = randomUUID();
            transactions.set(transactionId, {
                transactionId, kind: 'CASHIN', orderId: b.orderId, amount: Number(b.amount), operatorName: b.operatorName,
                telephone: b.telephone, callBackUrl: b.callBackUrl, status: 'PENDING', createdAt: new Date().toISOString(),
            });
            const page = paymentPage(transactionId);
            const orange = b.operatorName === 'ORANGE_MONEY';
            return json(res, 201, {
                success: true,
                data: {
                    transactionId,
                    url: orange ? null : page,
                    qrCode: FAKE_QR_PNG,
                    urls: orange ? { OM: page, MAXIT: page } : null,
                    paymentMode: b.operatorName,
                    instruction: 'Paiement simulé (faux SamirPay) : validez-le sur la page de paiement.',
                },
            });
        }
        const status = sub.match(/^\/api\/tiers\/payments\/([^/]+)\/status$/);
        if (req.method === 'GET' && status) {
            const id = decodeURIComponent(status[1]);
            if (!UUID.test(id)) return json(res, 400, { transactionId: null, status: 'INVALID_ID' });
            const tx = transactions.get(id);
            if (!tx) return json(res, 404, { transactionId: id, status: 'NOT_FOUND' });
            return json(res, 200, { transactionId: tx.transactionId, status: tx.status });
        }
        if (req.method === 'GET' && sub === '/api/tiers/payments/solde') {
            return json(res, 200, { status: 'success', message: 'Solde récupéré (faux SamirPay)', body: { samirEntityName: 'Event Village (faux services e2e)', solde: balance } });
        }
        if (req.method === 'POST' && sub === '/api/tiers/payments/send') {
            const parsed = parseJson(await readBody(req));
            if (!parsed.ok) return formatD(res, 400, 'MALFORMED_JSON', `Corps invalide : ${parsed.error}`, sub);
            const b = parsed.value;
            const problems = [
                ...extraKeys(b, ['phoneNumber', 'operatorName', 'amount', 'firstName', 'lastName']).map((k) => `champ hors contrat : ${k}`),
                typeof b.phoneNumber === 'string' && PHONE9.test(b.phoneNumber) ? null : 'phoneNumber : 9 chiffres',
                OPERATORS.has(b.operatorName) ? null : 'operatorName : WAVE ou ORANGE_MONEY',
                typeof b.amount === 'string' && AMOUNT.test(b.amount) ? null : 'amount : chaîne de chiffres attendue',
                typeof b.firstName === 'string' && b.firstName.trim() ? null : 'firstName requis',
                typeof b.lastName === 'string' && b.lastName.trim() ? null : 'lastName requis',
            ].filter(Boolean);
            if (problems.length > 0) return json(res, 400, { status: 'error', message: problems.join(' ; ') });
            if (nextSendConflict) {
                nextSendConflict = false;
                log('transfert refusé en 409 (transfert interrompu simulé, rien de débité)');
                return json(res, 409, { status: 'error', message: 'Transfert interrompu (faux SamirPay) : erreur technique simulée' });
            }
            const amount = Number(b.amount);
            const fees = Math.round(amount * feeRate) / 100;
            if (amount + fees > balance) {
                return json(res, 400, { status: 'error', message: `Solde insuffisant (faux SamirPay) : disponible ${balance}, requis ${amount + fees}` });
            }
            balance -= amount + fees;
            const transactionId = randomUUID();
            const tail = randomBytes(4).toString('hex').toUpperCase();
            const reference = `TX${tail}`;
            const refOperator = b.operatorName === 'WAVE' ? `pt-${tail.toLowerCase()}` : `CI${tail}`;
            const createdAt = new Date();
            transactions.set(transactionId, {
                transactionId, kind: 'CASHOUT', orderId: null, amount, operatorName: b.operatorName, telephone: b.phoneNumber,
                callBackUrl: null, status: 'SUCCESS', createdAt: createdAt.toISOString(), fees, reference, refOperator,
            });
            return json(res, 200, {
                status: 'success',
                message: 'Transfert effectué (faux SamirPay)',
                body: {
                    id: transactionId, reference, operatorName: b.operatorName, operationDate: isoNoZone(createdAt), status: 'V', type: 'CASHOUT',
                    telephone: b.phoneNumber, orderId: null, amount: -amount, fees, netAmount: -(amount + fees), balanceAfterTransaction: balance, refOperator,
                },
            });
        }
        return json(res, 404, { status: 'error', message: `route inconnue du faux SamirPay : ${req.method} ${sub}` });
    }

    async function handleMTarget(req, res) {
        if (req.method !== 'POST') return json(res, 405, { results: [{ code: '405', reason: 'METHOD_NOT_ALLOWED' }] });
        const parsed = parseJson(await readBody(req));
        if (!parsed.ok) return json(res, 400, { results: [{ code: '400', reason: `INVALID_BODY: ${parsed.error}` }] });
        const b = parsed.value;
        if (!authorized.mtarget(b)) return json(res, 401, { results: [{ code: '401', reason: 'AUTHENTICATION_FAILED' }] });
        if (typeof b.msisdn !== 'string' || !/^00221[0-9]{9}$/.test(b.msisdn)) return json(res, 400, { results: [{ code: '2', reason: 'INVALID_MSISDN' }] });
        if (typeof b.msg !== 'string' || !b.msg) return json(res, 400, { results: [{ code: '3', reason: 'EMPTY_MESSAGE' }] });
        const ticket = randomUUID();
        onSms({ ticket, msisdn: b.msisdn, sender: String(b.sender ?? ''), message: b.msg, receivedAt: new Date().toISOString() });
        return json(res, 200, { results: [{ code: '0', reason: 'ACCEPTED', msisdn: b.msisdn, ticket }] });
    }

    /** Routes vues par l'application : MTarget d'abord, puis SamirPay. */
    async function route(req, res, url) {
        if (url.pathname === mt) return handleMTarget(req, res);
        if (url.pathname === sp || url.pathname.startsWith(`${sp}/`)) return handleSamirPay(req, res, url.pathname.slice(sp.length) || '/');
        return null;
    }

    /**
     * Points de contrôle des paiements : terminer, refuser, lister, régler le solde (AM3 : remboursement bloqué de la
     * recette) ; lot 9 bis : régler les frais des transferts, imposer un 409 au prochain transfert.
     */
    async function control(req, res, url) {
        const path = url.pathname;
        if (req.method === 'POST' && (path === '/__test/samirpay/complete' || path === '/__test/samirpay/fail')) {
            const parsed = parseJson(await readBody(req));
            if (!parsed.ok) return json(res, 400, { ok: false, error: `corps invalide : ${parsed.error}` });
            const tx = findCashin(parsed.value);
            if (!tx || tx.kind !== 'CASHIN') return json(res, 404, { ok: false, error: 'aucun paiement (cashin) correspondant', query: parsed.value });
            if (path === '/__test/samirpay/fail') {
                if (tx.status !== 'PENDING') return json(res, 409, { ok: false, error: `transaction déjà ${tx.status}` });
                tx.status = 'FAILED';
                return json(res, 200, { ok: true, transactionId: tx.transactionId, orderId: tx.orderId, status: tx.status });
            }
            // v1.2 (H1) : un paiement passé FAILED à l'expiration peut encore réussir, webhook compris.
            if (tx.status !== 'PENDING' && tx.status !== 'SUCCESS' && tx.status !== 'FAILED') return json(res, 409, { ok: false, error: `transaction déjà ${tx.status}` });
            const target = webhookTarget(tx);
            if (!target.ok) return json(res, 400, { ok: false, transactionId: tx.transactionId, orderId: tx.orderId, error: target.error });
            tx.status = 'SUCCESS';
            const hook = await postWebhook(tx, target.target);
            log(`paiement ${tx.orderId} passé en SUCCESS ; webhook : ${hook.ok ? `HTTP ${hook.status}` : hook.error}`);
            if (!hook.ok) return json(res, 502, { ok: false, transactionId: tx.transactionId, orderId: tx.orderId, error: hook.error });
            return json(res, 200, { ok: true, transactionId: tx.transactionId, orderId: tx.orderId, status: tx.status, webhookStatus: hook.status, webhookBody: hook.body });
        }
        if (req.method === 'POST' && path === '/__test/samirpay/balance') {
            const parsed = parseJson(await readBody(req));
            if (!parsed.ok) return json(res, 400, { ok: false, error: `corps invalide : ${parsed.error}` });
            const { solde } = parsed.value;
            if (!Number.isInteger(solde) || solde < 0) return json(res, 400, { ok: false, error: 'solde : entier positif ou nul attendu' });
            balance = solde;
            log(`solde du faux SamirPay fixé à ${balance}`);
            return json(res, 200, { ok: true, balance });
        }
        if (req.method === 'POST' && path === '/__test/samirpay/fees') {
            const parsed = parseJson(await readBody(req));
            if (!parsed.ok) return json(res, 400, { ok: false, error: `corps invalide : ${parsed.error}` });
            const { rate } = parsed.value;
            if (typeof rate !== 'number' || !Number.isFinite(rate) || rate < 0 || rate > 100) return json(res, 400, { ok: false, error: 'rate : pourcentage de 0 à 100 attendu' });
            feeRate = rate;
            log(`frais des transferts du faux SamirPay fixés à ${feeRate} %`);
            return json(res, 200, { ok: true, rate: feeRate });
        }
        if (req.method === 'POST' && path === '/__test/samirpay/conflict') {
            nextSendConflict = true;
            log('prochain transfert : 409 (transfert interrompu simulé)');
            return json(res, 200, { ok: true, nextSendConflict });
        }
        if (req.method === 'GET' && path === '/__test/samirpay/transactions') {
            const list = [...transactions.values()].slice(-50).reverse().map((t) => ({ ...t, telephone: `${t.telephone.slice(0, 2)}*****${t.telephone.slice(-2)}` }));
            return json(res, 200, { transactions: list, balance });
        }
        return null;
    }

    return { route, control };
}

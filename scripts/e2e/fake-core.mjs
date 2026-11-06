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
 */
import http from 'node:http';
import { randomUUID, timingSafeEqual } from 'node:crypto';

export const MAX_BODY = 1024 * 1024;

const OPERATORS = new Set(['WAVE', 'ORANGE_MONEY']);
const PHONE9 = /^[0-9]{9}$/;
const AMOUNT = /^[1-9][0-9]*$/;

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
 */
export function postLocalWebhook(tx, target, port = Number(target.port || 80)) {
    const body = new URLSearchParams({ transaction_id: tx.transactionId, order_id: tx.orderId ?? '', status: 'success' }).toString();
    return new Promise((resolve) => {
        const req = http.request({
            host: '127.0.0.1',
            port,
            method: 'POST',
            path: `${target.pathname}${target.search}`,
            headers: { host: target.host, 'content-type': 'application/x-www-form-urlencoded', 'content-length': Buffer.byteLength(body) },
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
 *   transactions: Map<string, {transactionId: string, kind: 'CASHIN'|'CASHOUT', orderId: string|null, amount: number, operatorName: string, telephone: string, callBackUrl: string|null, status: string, createdAt: string}>,
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
        if (!authorized.samirpay(req)) return json(res, 401, { status: 'error', message: 'Clés API invalides', data: null });
        if (req.method === 'POST' && sub === '/api/tiers/direct/initPayment') {
            const parsed = parseJson(await readBody(req));
            if (!parsed.ok) return json(res, 400, { success: false, message: `Corps invalide : ${parsed.error}`, data: null });
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
            if (problems.length > 0) return json(res, 400, { success: false, message: problems.join(' ; '), data: null });
            if (transactionOfOrder(b.orderId)) return json(res, 409, { success: false, message: 'orderId déjà utilisé', data: null });
            const transactionId = randomUUID();
            transactions.set(transactionId, {
                transactionId, kind: 'CASHIN', orderId: b.orderId, amount: Number(b.amount), operatorName: b.operatorName,
                telephone: b.telephone, callBackUrl: b.callBackUrl, status: 'PENDING', createdAt: new Date().toISOString(),
            });
            const page = paymentPage(transactionId);
            return json(res, 201, {
                success: true,
                message: 'Paiement initié (faux SamirPay)',
                data: { transactionId, url: page, qrCode: page, urls: { wave: `${page}?operateur=wave`, orange: `${page}?operateur=orange` } },
            });
        }
        const status = sub.match(/^\/api\/tiers\/payments\/([^/]+)\/status$/);
        if (req.method === 'GET' && status) {
            const tx = transactions.get(decodeURIComponent(status[1]));
            if (!tx) return json(res, 404, { status: 'error', message: 'Transaction introuvable' });
            return json(res, 200, { transactionId: tx.transactionId, status: tx.status });
        }
        if (req.method === 'GET' && sub === '/api/tiers/payments/solde') {
            return json(res, 200, { status: 'success', message: 'Solde récupéré avec succès', data: { samirEntityName: 'Event Village (faux services e2e)', solde: balance } });
        }
        if (req.method === 'POST' && sub === '/api/tiers/payments/send') {
            const parsed = parseJson(await readBody(req));
            if (!parsed.ok) return json(res, 400, { status: 'error', message: `Corps invalide : ${parsed.error}`, data: null });
            const b = parsed.value;
            const problems = [
                ...extraKeys(b, ['phoneNumber', 'operatorName', 'amount', 'firstName', 'lastName']).map((k) => `champ hors contrat : ${k}`),
                typeof b.phoneNumber === 'string' && PHONE9.test(b.phoneNumber) ? null : 'phoneNumber : 9 chiffres',
                OPERATORS.has(b.operatorName) ? null : 'operatorName : WAVE ou ORANGE_MONEY',
                typeof b.amount === 'string' && AMOUNT.test(b.amount) ? null : 'amount : chaîne de chiffres attendue',
                typeof b.firstName === 'string' && b.firstName.trim() ? null : 'firstName requis',
                typeof b.lastName === 'string' && b.lastName.trim() ? null : 'lastName requis',
            ].filter(Boolean);
            if (problems.length > 0) return json(res, 400, { status: 'error', message: problems.join(' ; '), data: null });
            const amount = Number(b.amount);
            if (amount > balance) return json(res, 409, { status: 'error', message: 'Solde insuffisant', data: null });
            balance -= amount;
            const transactionId = randomUUID();
            transactions.set(transactionId, {
                transactionId, kind: 'CASHOUT', orderId: null, amount, operatorName: b.operatorName, telephone: b.phoneNumber,
                callBackUrl: null, status: 'SUCCESS', createdAt: new Date().toISOString(),
            });
            return json(res, 200, { status: 'success', message: 'Paiement effectué', data: { transactionId, status: 'SUCCESS', amount, operatorName: b.operatorName, phoneNumber: b.phoneNumber } });
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

    /** Points de contrôle des paiements : terminer, refuser, lister, régler le solde (AM3 : remboursement bloqué de la recette). */
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
            if (tx.status !== 'PENDING' && tx.status !== 'SUCCESS') return json(res, 409, { ok: false, error: `transaction déjà ${tx.status}` });
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
        if (req.method === 'GET' && path === '/__test/samirpay/transactions') {
            const list = [...transactions.values()].slice(-50).reverse().map((t) => ({ ...t, telephone: `${t.telephone.slice(0, 2)}*****${t.telephone.slice(-2)}` }));
            return json(res, 200, { transactions: list, balance });
        }
        return null;
    }

    return { route, control };
}

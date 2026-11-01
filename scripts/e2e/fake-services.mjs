#!/usr/bin/env node
/**
 * Lot 5.1 — faux services HTTP des tests de bout en bout : un seul processus, lié à 127.0.0.1.
 *
 * L'application démarrée par `next start` utilise ses VRAIS adaptateurs (EV_INTEGRATIONS=fake est
 * interdit en production, lib/env.ts) : ils sont pointés ici par SAMIRPAY_API_URL et MTARGET_API_URL.
 *
 *  - Faux SamirPay, conforme au contrat lu par lib/samirpay/http-client.ts et vérifié par
 *    tests/samirpay-contrat.test.ts (en-têtes X-API-KEY / X-SECRET-KEY, corps exacts) :
 *      POST <sp>/api/tiers/direct/initPayment → 201 { success, data: { transactionId, url, qrCode, urls } } ; 409 si orderId déjà vu ;
 *      GET  <sp>/api/tiers/payments/{id}/status → 200 { transactionId, status } ; 404 ;
 *      GET  <sp>/api/tiers/payments/solde → 200 { status, data: { solde, samirEntityName } } ;
 *      POST <sp>/api/tiers/payments/send → 200 { status: 'success', data: { transactionId, status } } ; 409 si solde insuffisant.
 *  - Faux MTarget (lib/sms/mtarget-http.adapter.ts) : POST <mt> → 200 { results: [{ code: '0', reason: 'ACCEPTED', ticket }] }.
 *  - Points de contrôle réservés aux tests :
 *      POST /__test/samirpay/complete { transactionId | orderId | telephone } : transaction en SUCCESS puis
 *           webhook RÉEL (form-urlencoded transaction_id, order_id, status=success) posté au callBackUrl reçu ;
 *      POST /__test/samirpay/fail { … } : transaction en FAILED (le contrat n'envoie aucun webhook d'échec) ;
 *      GET  /__test/samirpay/transactions ; GET /__test/sms?to=&limit= (derniers SMS reçus) ; GET /__test/health.
 *
 * Refus de démarrer : SAMIRPAY_API_URL, MTARGET_API_URL ou NEXT_PUBLIC_APP_URL non locale, URL des faux
 * services sur un autre port que E2E_FAKE_SERVICES_PORT, RESEND_API_KEY renseignée, clés absentes.
 * Le webhook n'est posté qu'à l'application locale (origine de NEXT_PUBLIC_APP_URL).
 */
import http from 'node:http';
import { randomUUID, timingSafeEqual } from 'node:crypto';
import { assertLocalServices, fail, loadE2eEnv, requirePort } from './env.mjs';

const TAG = 'faux-services';
loadE2eEnv(TAG);
const { app, samirpay, mtarget } = assertLocalServices(TAG);
const PORT = requirePort(TAG, 'E2E_FAKE_SERVICES_PORT');
const HOST = '127.0.0.1';

for (const [key, url] of [['SAMIRPAY_API_URL', samirpay], ['MTARGET_API_URL', mtarget]]) {
    if (url.hostname !== HOST || Number(url.port) !== PORT) {
        fail(TAG, `${key} doit viser ces faux services (http://${HOST}:${PORT}/…), valeur reçue : ${url.origin}.`);
    }
}
for (const key of ['SAMIRPAY_API_KEY', 'SAMIRPAY_SECRET_KEY', 'MTARGET_USERNAME', 'MTARGET_PASSWORD']) {
    if (!process.env[key]) fail(TAG, `${key} absente : les faux services vérifient les identifiants envoyés par l'application.`);
}

const SP = samirpay.pathname.replace(/\/+$/, '');
const MT = mtarget.pathname.replace(/\/+$/, '') || '/';
const BASE = `http://${HOST}:${PORT}`;
const OPERATORS = new Set(['WAVE', 'ORANGE_MONEY']);
const PHONE9 = /^[0-9]{9}$/;
const AMOUNT = /^[1-9][0-9]*$/;
const MAX_BODY = 1024 * 1024;

/** @type {Map<string, {transactionId: string, kind: 'CASHIN'|'CASHOUT', orderId: string|null, amount: number, operatorName: string, telephone: string, callBackUrl: string|null, status: string, createdAt: string}>} */
const transactions = new Map();
const orders = new Map();
/** @type {Array<{ticket: string, msisdn: string, sender: string, message: string, receivedAt: string}>} */
const sms = [];
let balance = 50_000_000;

function sameSecret(received, expected) {
    const a = Buffer.from(String(received ?? ''));
    const b = Buffer.from(String(expected));
    return a.length === b.length && timingSafeEqual(a, b);
}

function json(res, status, body) {
    res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
    res.end(JSON.stringify(body));
    return status;
}

function maskMsisdn(msisdn) {
    return msisdn.length > 6 ? `${msisdn.slice(0, 7)}***${msisdn.slice(-2)}` : '***';
}

function readBody(req) {
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

function parseJson(raw) {
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

function samirpayAuthorized(req) {
    return sameSecret(req.headers['x-api-key'], process.env.SAMIRPAY_API_KEY) && sameSecret(req.headers['x-secret-key'], process.env.SAMIRPAY_SECRET_KEY);
}

function findCashin(body) {
    if (typeof body.transactionId === 'string') return transactions.get(body.transactionId) ?? null;
    if (typeof body.orderId === 'string') return transactions.get(orders.get(body.orderId) ?? '') ?? null;
    if (typeof body.telephone === 'string') {
        const phone = body.telephone.replace(/\D/g, '').replace(/^221/, '');
        const pending = [...transactions.values()].filter((t) => t.kind === 'CASHIN' && t.telephone === phone && t.status === 'PENDING');
        return pending.length > 0 ? pending[pending.length - 1] : null;
    }
    return null;
}

/** Cible du webhook : uniquement l'application locale (vérifié AVANT de changer le statut). */
function webhookTarget(tx) {
    let target;
    try {
        target = new URL(tx.callBackUrl);
    } catch (err) {
        return { ok: false, error: `callBackUrl illisible : ${err instanceof Error ? err.message : String(err)}` };
    }
    if (target.origin !== app.origin) {
        return { ok: false, error: `callBackUrl hors de l'application locale (${target.origin} au lieu de ${app.origin}) : webhook non envoyé, statut inchangé` };
    }
    return { ok: true, target };
}

/**
 * Webhook posté à l'application locale : connexion sur 127.0.0.1 (adresse d'écoute de next start),
 * en-tête Host d'origine (localhost:<port>) conservé, comme le ferait SamirPay sur le vrai domaine.
 */
function postWebhook(tx, target) {
    const body = new URLSearchParams({ transaction_id: tx.transactionId, order_id: tx.orderId ?? '', status: 'success' }).toString();
    return new Promise((resolve) => {
        const req = http.request({
            host: '127.0.0.1',
            port: Number(target.port || 80),
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

async function handleSamirPay(req, res, sub) {
    if (!samirpayAuthorized(req)) return json(res, 401, { status: 'error', message: 'Clés API invalides', data: null });
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
        if (orders.has(b.orderId)) return json(res, 409, { success: false, message: 'orderId déjà utilisé', data: null });
        const transactionId = randomUUID();
        transactions.set(transactionId, {
            transactionId, kind: 'CASHIN', orderId: b.orderId, amount: Number(b.amount), operatorName: b.operatorName,
            telephone: b.telephone, callBackUrl: b.callBackUrl, status: 'PENDING', createdAt: new Date().toISOString(),
        });
        orders.set(b.orderId, transactionId);
        const page = `${BASE}/__pay/${transactionId}`;
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
    if (!sameSecret(b.username, process.env.MTARGET_USERNAME) || !sameSecret(b.password, process.env.MTARGET_PASSWORD)) {
        return json(res, 401, { results: [{ code: '401', reason: 'AUTHENTICATION_FAILED' }] });
    }
    if (typeof b.msisdn !== 'string' || !/^00221[0-9]{9}$/.test(b.msisdn)) return json(res, 400, { results: [{ code: '2', reason: 'INVALID_MSISDN' }] });
    if (typeof b.msg !== 'string' || !b.msg) return json(res, 400, { results: [{ code: '3', reason: 'EMPTY_MESSAGE' }] });
    const ticket = randomUUID();
    sms.push({ ticket, msisdn: b.msisdn, sender: String(b.sender ?? ''), message: b.msg, receivedAt: new Date().toISOString() });
    if (sms.length > 500) sms.shift();
    console.log(`[${TAG}] SMS reçu pour ${maskMsisdn(b.msisdn)} (${b.msg.length} caractères)`);
    return json(res, 200, { results: [{ code: '0', reason: 'ACCEPTED', msisdn: b.msisdn, ticket }] });
}

async function handleControl(req, res, url) {
    const route = url.pathname;
    if (req.method === 'GET' && route === '/__test/health') {
        return json(res, 200, { ok: true, samirpay: SP || '/', mtarget: MT, transactions: transactions.size, sms: sms.length });
    }
    if (req.method === 'POST' && (route === '/__test/samirpay/complete' || route === '/__test/samirpay/fail')) {
        const parsed = parseJson(await readBody(req));
        if (!parsed.ok) return json(res, 400, { ok: false, error: `corps invalide : ${parsed.error}` });
        const tx = findCashin(parsed.value);
        if (!tx || tx.kind !== 'CASHIN') return json(res, 404, { ok: false, error: 'aucun paiement (cashin) correspondant', query: parsed.value });
        if (route === '/__test/samirpay/fail') {
            if (tx.status !== 'PENDING') return json(res, 409, { ok: false, error: `transaction déjà ${tx.status}` });
            tx.status = 'FAILED';
            return json(res, 200, { ok: true, transactionId: tx.transactionId, orderId: tx.orderId, status: tx.status });
        }
        if (tx.status !== 'PENDING' && tx.status !== 'SUCCESS') return json(res, 409, { ok: false, error: `transaction déjà ${tx.status}` });
        const target = webhookTarget(tx);
        if (!target.ok) return json(res, 400, { ok: false, transactionId: tx.transactionId, orderId: tx.orderId, error: target.error });
        tx.status = 'SUCCESS';
        const hook = await postWebhook(tx, target.target);
        console.log(`[${TAG}] paiement ${tx.orderId} passé en SUCCESS ; webhook : ${hook.ok ? `HTTP ${hook.status}` : hook.error}`);
        if (!hook.ok) return json(res, 502, { ok: false, transactionId: tx.transactionId, orderId: tx.orderId, error: hook.error });
        return json(res, 200, { ok: true, transactionId: tx.transactionId, orderId: tx.orderId, status: tx.status, webhookStatus: hook.status, webhookBody: hook.body });
    }
    if (req.method === 'GET' && route === '/__test/samirpay/transactions') {
        const list = [...transactions.values()].slice(-50).reverse().map((t) => ({ ...t, telephone: `${t.telephone.slice(0, 2)}*****${t.telephone.slice(-2)}` }));
        return json(res, 200, { transactions: list, balance });
    }
    if (req.method === 'GET' && route === '/__test/sms') {
        const to = (url.searchParams.get('to') ?? '').replace(/\D/g, '');
        const limit = Math.min(Math.max(Number(url.searchParams.get('limit') ?? 20) || 20, 1), 200);
        const list = sms.filter((m) => !to || m.msisdn.endsWith(to)).slice(-limit).reverse();
        return json(res, 200, { messages: list });
    }
    return json(res, 404, { ok: false, error: `point de contrôle inconnu : ${req.method} ${route}` });
}

function payPage(res, id) {
    const tx = transactions.get(id);
    res.writeHead(tx ? 200 : 404, { 'content-type': 'text/html; charset=utf-8' });
    res.end(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Paiement simulé</title></head><body>`
        + `<h1>Paiement simulé (tests de bout en bout)</h1><p>${tx ? `Transaction ${tx.status}.` : 'Transaction inconnue.'}</p></body></html>`);
    return tx ? 200 : 404;
}

const server = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', BASE);
    let code = 500;
    try {
        if (url.pathname.startsWith('/__test/')) code = await handleControl(req, res, url);
        else if (url.pathname.startsWith('/__pay/')) code = payPage(res, url.pathname.slice('/__pay/'.length));
        else if (url.pathname === MT) code = await handleMTarget(req, res);
        else if (url.pathname === SP || url.pathname.startsWith(`${SP}/`)) code = await handleSamirPay(req, res, url.pathname.slice(SP.length) || '/');
        else code = json(res, 404, { error: `route inconnue des faux services : ${req.method} ${url.pathname}` });
    } catch (err) {
        console.error(`[${TAG}] erreur sur ${req.method} ${url.pathname} :`, err instanceof Error ? err.message : String(err));
        if (!res.headersSent) code = json(res, 500, { error: 'erreur interne des faux services', detail: err instanceof Error ? err.message : String(err) });
    }
    console.log(`[${TAG}] ${req.method} ${url.pathname} → ${code}`);
});

server.on('error', (err) => fail(TAG, `écoute impossible sur ${HOST}:${PORT} : ${err.message}`));
server.listen(PORT, HOST, () => {
    console.log(`[${TAG}] prêts sur ${BASE} — SamirPay ${SP || '/'} · MTarget ${MT} · webhooks vers ${app.origin} uniquement`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => {
        console.log(`[${TAG}] arrêt (${signal})`);
        server.close(() => process.exit(0));
    });
}

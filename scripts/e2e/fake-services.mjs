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
 *  - Lot 6 (contrat P4) — faux service push web (RFC 8030, 8291, 8292), visé par les abonnements des
 *    captures (état « activé » simulé, e2e/support/fake-push.ts) :
 *      POST /__test/push/subscribers → 201 { id, endpoint: <base>/push/<id>, keys: { p256dh, auth } } : paire
 *           ECDH P-256 et secret auth de 16 octets RÉELS, clé privée gardée ici pour déchiffrer ;
 *      POST /push/<id> : vérifie Content-Encoding aes128gcm, TTL, Authorization « vapid t=<JWT>, k=<clé> »
 *           (signature ES256 vérifiée avec k, k = VAPID_PUBLIC_KEY, aud = origine du point d'arrivée,
 *           exp dans les 24 h, sub = VAPID_SUBJECT), DÉCHIFFRE le corps (node:crypto), enregistre le
 *           message ; répond 201, ou le statut forcé ; 404 pour un abonné inconnu ;
 *      POST /__test/push/mode { id, status, retryAfter? } : statut forcé (201, 404, 410, 413, 429, 500) ;
 *      GET  /__test/push?endpoint=&limit= : messages reçus (déchiffrés), plus récent d'abord.
 *
 * Refus de démarrer : SAMIRPAY_API_URL, MTARGET_API_URL ou NEXT_PUBLIC_APP_URL non locale, URL des faux
 * services sur un autre port que E2E_FAKE_SERVICES_PORT, RESEND_API_KEY renseignée, clés absentes.
 * Le webhook n'est posté qu'à l'application locale (origine de NEXT_PUBLIC_APP_URL).
 */
import http from 'node:http';
import { createDecipheriv, createECDH, createHmac, createPublicKey, randomBytes, randomUUID, timingSafeEqual, verify as verifySignature } from 'node:crypto';
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

// ── Faux service push web (lot 6, contrat P4) ───────────────────────────────

const PUSH_FORCED = new Set([201, 404, 410, 413, 429, 500]);
/** @type {Map<string, {id: string, endpoint: string, ecdh: import('node:crypto').ECDH, publicKey: Buffer, auth: Buffer, forced: {status: number, retryAfter: number|null}|null, createdAt: string}>} */
const pushSubscribers = new Map();
/** @type {Array<{id: string, endpoint: string, status: number, ttl: string|null, urgency: string|null, topic: string|null, payload: unknown, error: string|null, receivedAt: string}>} */
const pushMessages = [];

function readRawBody(req) {
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
        req.on('end', () => resolve(Buffer.concat(chunks)));
        req.on('error', reject);
    });
}

/** HKDF-SHA-256 sur un seul bloc (longueur ≤ 32), RFC 5869. */
function hkdf(salt, ikm, info, length) {
    const prk = createHmac('sha256', salt).update(ikm).digest();
    return createHmac('sha256', prk).update(Buffer.concat([info, Buffer.from([1])])).digest().subarray(0, length);
}

/** Déchiffrement aes128gcm (RFC 8188) avec la dérivation de clés du push web (RFC 8291), un seul enregistrement. */
function decryptPush(sub, body) {
    if (body.length < 21 + 65 + 17) throw new Error(`corps trop court (${body.length} octets)`);
    const salt = body.subarray(0, 16);
    const rs = body.readUInt32BE(16);
    const idlen = body[20];
    if (idlen !== 65) throw new Error(`keyid de ${idlen} octets au lieu de 65 (clé publique de l'expéditeur)`);
    const senderPublic = body.subarray(21, 21 + idlen);
    const ciphertext = body.subarray(21 + idlen);
    if (ciphertext.length > rs) throw new Error(`plusieurs enregistrements (${ciphertext.length} > rs ${rs}) : non pris en charge`);
    const ecdhSecret = sub.ecdh.computeSecret(senderPublic);
    const keyInfo = Buffer.concat([Buffer.from('WebPush: info\0', 'utf8'), sub.publicKey, senderPublic]);
    const ikm = hkdf(sub.auth, ecdhSecret, keyInfo, 32);
    const cek = hkdf(salt, ikm, Buffer.from('Content-Encoding: aes128gcm\0', 'utf8'), 16);
    const nonce = hkdf(salt, ikm, Buffer.from('Content-Encoding: nonce\0', 'utf8'), 12);
    const decipher = createDecipheriv('aes-128-gcm', cek, nonce);
    decipher.setAuthTag(ciphertext.subarray(ciphertext.length - 16));
    const plain = Buffer.concat([decipher.update(ciphertext.subarray(0, ciphertext.length - 16)), decipher.final()]);
    let end = plain.length - 1;
    while (end >= 0 && plain[end] === 0) end--;
    if (end < 0 || plain[end] !== 2) throw new Error('délimiteur de dernier enregistrement (0x02) absent');
    return plain.subarray(0, end).toString('utf8');
}

/** En-tête VAPID (RFC 8292) : signature ES256 du JWT, clé attendue, aud, exp, sub. Renvoie null ou le motif du refus. */
function vapidProblem(header, endpoint) {
    const expectedKey = process.env.VAPID_PUBLIC_KEY;
    const expectedSubject = process.env.VAPID_SUBJECT;
    if (!expectedKey || !expectedSubject) return 'VAPID_PUBLIC_KEY ou VAPID_SUBJECT absente de .env.e2e : en-tête invérifiable';
    const m = /^vapid\s+t=([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)\s*,\s*k=([A-Za-z0-9_-]+)\s*$/i.exec(String(header ?? ''));
    if (!m) return 'en-tête Authorization « vapid t=…, k=… » absent ou illisible';
    const [, jwt, k] = m;
    if (k !== expectedKey) return 'clé k différente de VAPID_PUBLIC_KEY';
    const raw = Buffer.from(k, 'base64url');
    if (raw.length !== 65 || raw[0] !== 4) return 'clé k : point P-256 non compressé attendu';
    const [h, p, s] = jwt.split('.');
    let head;
    let claims;
    try {
        head = JSON.parse(Buffer.from(h, 'base64url').toString('utf8'));
        claims = JSON.parse(Buffer.from(p, 'base64url').toString('utf8'));
    } catch (err) {
        return `JWT illisible (${err instanceof Error ? err.message : String(err)})`;
    }
    if (head?.alg !== 'ES256') return `algorithme ${head?.alg} au lieu de ES256`;
    const key = createPublicKey({ key: { kty: 'EC', crv: 'P-256', x: raw.subarray(1, 33).toString('base64url'), y: raw.subarray(33, 65).toString('base64url') }, format: 'jwk' });
    const ok = verifySignature('sha256', Buffer.from(`${h}.${p}`, 'utf8'), { key, dsaEncoding: 'ieee-p1363' }, Buffer.from(s, 'base64url'));
    if (!ok) return 'signature ES256 du JWT invalide';
    const now = Math.floor(Date.now() / 1000);
    if (claims?.aud !== new URL(endpoint).origin) return `aud ${claims?.aud} au lieu de ${new URL(endpoint).origin}`;
    if (typeof claims?.exp !== 'number' || claims.exp <= now || claims.exp > now + 24 * 3600 + 60) return `exp ${claims?.exp} hors de la fenêtre de 24 h`;
    if (claims?.sub !== expectedSubject) return `sub ${claims?.sub} au lieu de VAPID_SUBJECT`;
    return null;
}

function recordPush(entry) {
    pushMessages.push({ ...entry, receivedAt: new Date().toISOString() });
    if (pushMessages.length > 500) pushMessages.shift();
}

async function handlePush(req, res, id) {
    const sub = pushSubscribers.get(id);
    if (req.method !== 'POST') return json(res, 405, { error: 'méthode non admise' });
    if (!sub) return json(res, 404, { error: 'abonnement inconnu du faux service push' });
    const body = await readRawBody(req);
    const base = { id, endpoint: sub.endpoint, ttl: req.headers.ttl ?? null, urgency: req.headers.urgency ?? null, topic: req.headers.topic ?? null };
    const refuse = (status, error) => {
        recordPush({ ...base, status, payload: null, error });
        console.log(`[${TAG}] push refusé (${status}) : ${error}`);
        return json(res, status, { error });
    };
    if (String(req.headers['content-encoding'] ?? '').toLowerCase() !== 'aes128gcm') return refuse(415, 'Content-Encoding aes128gcm attendu');
    if (!/^\d+$/.test(String(req.headers.ttl ?? ''))) return refuse(400, 'en-tête TTL absent ou invalide');
    const problem = vapidProblem(req.headers.authorization, sub.endpoint);
    if (problem) return refuse(401, problem);
    let text;
    try {
        text = decryptPush(sub, body);
    } catch (err) {
        return refuse(400, `déchiffrement impossible : ${err instanceof Error ? err.message : String(err)}`);
    }
    let payload;
    try {
        payload = JSON.parse(text);
    } catch {
        payload = text; // charge non JSON : conservée telle quelle pour la lecture du test
    }
    const status = sub.forced?.status ?? 201;
    recordPush({ ...base, status, payload, error: null });
    if (status === 429 && sub.forced?.retryAfter) res.setHeader('retry-after', String(sub.forced.retryAfter));
    return json(res, status, status === 201 ? { ok: true } : { error: `statut forcé ${status}` });
}

async function handlePushControl(req, res, url) {
    const route = url.pathname;
    if (req.method === 'POST' && route === '/__test/push/subscribers') {
        if (pushSubscribers.size >= 1000) return json(res, 429, { ok: false, error: 'trop d’abonnés de test' });
        const id = randomBytes(18).toString('base64url');
        const ecdh = createECDH('prime256v1');
        ecdh.generateKeys();
        const publicKey = ecdh.getPublicKey();
        const auth = randomBytes(16);
        const endpoint = `${BASE}/push/${id}`;
        pushSubscribers.set(id, { id, endpoint, ecdh, publicKey, auth, forced: null, createdAt: new Date().toISOString() });
        return json(res, 201, { id, endpoint, keys: { p256dh: publicKey.toString('base64url'), auth: auth.toString('base64url') } });
    }
    if (req.method === 'POST' && route === '/__test/push/mode') {
        const parsed = parseJson(await readBody(req));
        if (!parsed.ok) return json(res, 400, { ok: false, error: `corps invalide : ${parsed.error}` });
        const { id, status, retryAfter } = parsed.value;
        const sub = pushSubscribers.get(String(id ?? ''));
        if (!sub) return json(res, 404, { ok: false, error: 'abonné inconnu' });
        if (!PUSH_FORCED.has(status)) return json(res, 400, { ok: false, error: `statut ${status} non pris en charge (${[...PUSH_FORCED].join(', ')})` });
        sub.forced = status === 201 ? null : { status, retryAfter: Number.isInteger(retryAfter) && retryAfter > 0 ? retryAfter : null };
        return json(res, 200, { ok: true, id: sub.id, status });
    }
    if (req.method === 'GET' && route === '/__test/push') {
        const endpoint = url.searchParams.get('endpoint') ?? '';
        const limit = Math.min(Math.max(Number(url.searchParams.get('limit') ?? 20) || 20, 1), 200);
        const list = pushMessages.filter((m) => !endpoint || m.endpoint === endpoint).slice(-limit).reverse();
        return json(res, 200, { messages: list });
    }
    return null;
}

async function handleControl(req, res, url) {
    const route = url.pathname;
    if (route.startsWith('/__test/push')) {
        const handled = await handlePushControl(req, res, url);
        if (handled !== null) return handled;
    }
    if (req.method === 'GET' && route === '/__test/health') {
        return json(res, 200, { ok: true, samirpay: SP || '/', mtarget: MT, transactions: transactions.size, sms: sms.length, pushSubscribers: pushSubscribers.size, push: pushMessages.length });
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
        else if (url.pathname.startsWith('/push/')) code = await handlePush(req, res, decodeURIComponent(url.pathname.slice('/push/'.length)));
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

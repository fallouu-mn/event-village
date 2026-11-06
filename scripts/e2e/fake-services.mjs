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
 *      POST /__test/samirpay/balance { solde } : solde du compte fixé, entier >= 0 (lot 8, AM3 : remboursement bloqué) ;
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
 *
 * Lot 8 : les routes SamirPay et MTarget, la recherche d'un paiement et le webhook sont dans fake-core.mjs,
 * partagé avec le mode d'essai local. Ce fichier garde les gardes e2e, le push web et l'écoute.
 */
import http from 'node:http';
import { createDecipheriv, createECDH, createHmac, createPublicKey, randomBytes, verify as verifySignature } from 'node:crypto';
import { assertLocalServices, fail, loadE2eEnv, requirePort } from './env.mjs';
import { createFakeCore, json, MAX_BODY, parseJson, postLocalWebhook, readBody, sameSecret, webhookTargetFor } from './fake-core.mjs';

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
/** @type {Array<{ticket: string, msisdn: string, sender: string, message: string, receivedAt: string}>} */
const sms = [];

function maskMsisdn(msisdn) {
    return msisdn.length > 6 ? `${msisdn.slice(0, 7)}***${msisdn.slice(-2)}` : '***';
}

const transactions = new Map();
const core = createFakeCore({
    base: BASE,
    sp: SP,
    mt: MT,
    transactions,
    authorized: {
        samirpay: (req) => sameSecret(req.headers['x-api-key'], process.env.SAMIRPAY_API_KEY) && sameSecret(req.headers['x-secret-key'], process.env.SAMIRPAY_SECRET_KEY),
        mtarget: (body) => sameSecret(body.username, process.env.MTARGET_USERNAME) && sameSecret(body.password, process.env.MTARGET_PASSWORD),
    },
    webhookTarget: webhookTargetFor(app.origin),
    postWebhook: postLocalWebhook,
    onSms: (message) => {
        sms.push(message);
        if (sms.length > 500) sms.shift();
        console.log(`[${TAG}] SMS reçu pour ${maskMsisdn(message.msisdn)} (${message.message.length} caractères)`);
    },
    log: (message) => console.log(`[${TAG}] ${message}`),
});

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
    const payment = await core.control(req, res, url);
    if (payment !== null) return payment;
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
        else code = (await core.route(req, res, url)) ?? json(res, 404, { error: `route inconnue des faux services : ${req.method} ${url.pathname}` });
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

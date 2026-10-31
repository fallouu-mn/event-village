/**
 * Lot 2 — le client HTTP réel SamirPay respecte le contrat officiel (documentation partenaire
 * v1.0). Il est exécuté contre un serveur local (127.0.0.1) qui imite le contrat et enregistre
 * les requêtes reçues : chemins, en-têtes, corps exacts. Aucun appel réseau externe.
 *  - cashin direct : POST /api/tiers/direct/initPayment, montant en chaîne, orderId, callBackUrl,
 *    operatorName, telephone à 9 chiffres ; 201 → transactionId, url, qrCode, urls ; 409 → doublon ;
 *  - statut : GET /api/tiers/payments/{transactionId}/status → {transactionId, status} ; 404 ;
 *  - solde : data.solde ;
 *  - cashout : POST /api/tiers/payments/send, phoneNumber 9 chiffres, montant en chaîne, prénom
 *    et nom ; refus explicite (400/409) distinct d'une issue incertaine (délai, 5xx, illisible).
 */
import './helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import { SamirPayHttpClient } from '../lib/samirpay/http-client';
import { resetServerEnvCache } from '../lib/env';

interface Received { method: string; path: string; headers: http.IncomingHttpHeaders; body: string }
const received: Received[] = [];
const seenOrders = new Set<string>();
let cashoutBehaviour: 'ok' | 'reject' | 'slow' | 'html502' = 'ok';
let server: http.Server;
const saved: Record<string, string | undefined> = {};

function json(res: http.ServerResponse, status: number, body: unknown) {
    res.writeHead(status, { 'content-type': 'application/json' });
    res.end(JSON.stringify(body));
}

before(async () => {
    server = http.createServer((req, res) => {
        let body = '';
        req.on('data', (c) => { body += c; });
        req.on('end', () => {
            const path = req.url ?? '';
            received.push({ method: req.method ?? '', path, headers: req.headers, body });
            if (req.method === 'POST' && path === '/api/tiers/direct/initPayment') {
                const b = JSON.parse(body || '{}');
                if (seenOrders.has(b.orderId)) return json(res, 409, { success: false, message: 'orderId déjà utilisé', data: null });
                seenOrders.add(b.orderId);
                const id = randomUUID();
                return json(res, 201, { success: true, data: { transactionId: id, url: `https://pay.example/${id}`, qrCode: 'data:image/png;base64,AAAA', urls: { wave: `https://wave.example/${id}`, orange: `https://orange.example/${id}` } } });
            }
            const m = path.match(/^\/api\/tiers\/payments\/([^/]+)\/status$/);
            if (req.method === 'GET' && m) {
                if (m[1] === '00000000-0000-4000-8000-000000000404') return json(res, 404, { status: 'error', message: 'Transaction introuvable' });
                if (m[1] === '00000000-0000-4000-8000-0000000000ee') return json(res, 200, { transactionId: randomUUID(), status: 'SUCCESS' });
                return json(res, 200, { transactionId: m[1], status: 'SUCCESS' });
            }
            if (req.method === 'GET' && path === '/api/tiers/payments/solde') {
                return json(res, 200, { status: 'success', message: 'Solde récupéré avec succès', data: { samirEntityName: 'Event Village Test', solde: 250000.0 } });
            }
            if (req.method === 'POST' && path === '/api/tiers/payments/send') {
                const b = JSON.parse(body || '{}');
                if (cashoutBehaviour === 'reject') return json(res, 409, { status: 'error', message: 'Solde insuffisant', data: null });
                if (cashoutBehaviour === 'html502') { res.writeHead(502, { 'content-type': 'text/html' }); return res.end('<html>Bad gateway</html>'); }
                if (cashoutBehaviour === 'slow') return void setTimeout(() => json(res, 200, { status: 'success', data: { transactionId: randomUUID(), status: 'SUCCESS' } }), 1500);
                return json(res, 200, { status: 'success', message: 'Paiement effectué', data: { transactionId: randomUUID(), status: 'SUCCESS', amount: Number(b.amount), operatorName: b.operatorName, phoneNumber: b.phoneNumber } });
            }
            json(res, 404, { status: 'error', message: `route inconnue du serveur de test : ${req.method} ${path}` });
        });
    });
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', () => r()));
    const { port } = server.address() as AddressInfo;
    for (const k of ['SAMIRPAY_API_URL', 'SAMIRPAY_CASHIN_URL', 'SAMIRPAY_CASHOUT_URL', 'SAMIRPAY_SOLDE_URL', 'SAMIRPAY_STATUS_URL', 'SAMIRPAY_TIMEOUT_MS']) saved[k] = process.env[k];
    process.env.SAMIRPAY_API_URL = `http://127.0.0.1:${port}`;
    for (const k of ['SAMIRPAY_CASHIN_URL', 'SAMIRPAY_CASHOUT_URL', 'SAMIRPAY_SOLDE_URL', 'SAMIRPAY_STATUS_URL']) delete process.env[k];
    process.env.SAMIRPAY_TIMEOUT_MS = '400';
    resetServerEnvCache();
});

after(async () => {
    for (const [k, v] of Object.entries(saved)) {
        if (v === undefined) delete process.env[k];
        else process.env[k] = v;
    }
    resetServerEnvCache();
    await new Promise<void>((r) => server.close(() => r()));
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const client = (): any => new SamirPayHttpClient();
const last = (path: string) => [...received].reverse().find((r) => r.path === path);

async function rejectsWithKind(p: Promise<unknown>, kind: string, label: string) {
    await assert.rejects(p, (err: unknown) => {
        const k = (err as { kind?: string }).kind;
        assert.equal(k, kind, `${label} : nature de l'erreur (${(err as Error).message})`);
        return true;
    });
}

describe('Client SamirPay réel — conformité au contrat', () => {
    test('cashin direct : chemin, en-têtes et corps exacts ; réponse 201 lue (transactionId, url, qrCode, urls)', async () => {
        const orderId = `ORD-EV-${Date.now()}-A1B2C3`;
        const r = await client().initDirectPayment({ amount: 5000, orderId, callBackUrl: 'https://eventvillage.sn/api/webhooks/samirpay?t=abc', operatorName: 'WAVE', telephone: '771234567', description: 'Panier Billetterie' });
        const req = last('/api/tiers/direct/initPayment')!;
        assert.equal(req.method, 'POST');
        assert.equal(req.headers['x-api-key'], process.env.SAMIRPAY_API_KEY);
        assert.equal(req.headers['x-secret-key'], process.env.SAMIRPAY_SECRET_KEY);
        assert.deepEqual(JSON.parse(req.body), { amount: '5000', orderId, callBackUrl: 'https://eventvillage.sn/api/webhooks/samirpay?t=abc', operatorName: 'WAVE', telephone: '771234567', description: 'Panier Billetterie' }, 'corps conforme, sans champ hors contrat');
        assert.match(r.transactionId, /^[0-9a-f-]{36}$/);
        assert.ok(String(r.paymentUrl).startsWith('https://pay.example/'));
        assert.ok(String(r.qrCode).startsWith('data:image/png'));
        assert.ok(String(r.deepLinks.wave).startsWith('https://wave.example/'));
        assert.ok(String(r.deepLinks.orange).startsWith('https://orange.example/'));
    });

    test('cashin direct : orderId en double → erreur DUPLICATE (409)', async () => {
        const orderId = `ORD-EV-${Date.now()}-D0D0D0`;
        await client().initDirectPayment({ amount: 1000, orderId, callBackUrl: 'https://x.example/cb?t=1', operatorName: 'ORANGE_MONEY', telephone: '781234567' });
        await rejectsWithKind(client().initDirectPayment({ amount: 1000, orderId, callBackUrl: 'https://x.example/cb?t=1', operatorName: 'ORANGE_MONEY', telephone: '781234567' }), 'DUPLICATE', 'doublon');
    });

    test('statut : GET /api/tiers/payments/{transactionId}/status, réponse corrélée ; 404 → NOT_FOUND', async () => {
        const id = randomUUID();
        const s = await client().checkTransactionStatus(id);
        assert.equal(last(`/api/tiers/payments/${id}/status`)?.method, 'GET');
        assert.deepEqual(s, { transactionId: id, status: 'SUCCESS' });
        await rejectsWithKind(client().checkTransactionStatus('00000000-0000-4000-8000-000000000404'), 'NOT_FOUND', 'transaction inexistante');
        await rejectsWithKind(client().checkTransactionStatus('00000000-0000-4000-8000-0000000000ee'), 'INVALID_RESPONSE', 'réponse pour un autre identifiant');
    });

    test('solde : lu dans data.solde', async () => {
        const s = await client().getSolde();
        assert.equal(s.solde, 250000);
    });

    test('cashout : corps exact (9 chiffres, montant en chaîne, prénom et nom), identifiant lu dans data', async () => {
        cashoutBehaviour = 'ok';
        const r = await client().sendCashout({ phoneNumber: '771234567', operatorName: 'ORANGE_MONEY', amount: 15000, firstName: 'Awa', lastName: 'Diop' });
        assert.deepEqual(JSON.parse(last('/api/tiers/payments/send')!.body), { phoneNumber: '771234567', operatorName: 'ORANGE_MONEY', amount: '15000', firstName: 'Awa', lastName: 'Diop' });
        assert.match(r.transactionId, /^[0-9a-f-]{36}$/);
        assert.equal(r.status, 'SUCCESS');
    });

    test('cashout : refus explicite → REJECTED ; délai dépassé ou 502 → UNCERTAIN', async () => {
        cashoutBehaviour = 'reject';
        await rejectsWithKind(client().sendCashout({ phoneNumber: '771234567', operatorName: 'WAVE', amount: 1000, firstName: 'A', lastName: 'B' }), 'REJECTED', 'refus 409');
        cashoutBehaviour = 'slow';
        await rejectsWithKind(client().sendCashout({ phoneNumber: '771234567', operatorName: 'WAVE', amount: 1000, firstName: 'A', lastName: 'B' }), 'UNCERTAIN', 'délai dépassé');
        cashoutBehaviour = 'html502';
        await rejectsWithKind(client().sendCashout({ phoneNumber: '771234567', operatorName: 'WAVE', amount: 1000, firstName: 'A', lastName: 'B' }), 'UNCERTAIN', '502 illisible');
        cashoutBehaviour = 'ok';
    });
});

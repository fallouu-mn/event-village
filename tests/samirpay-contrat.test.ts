/**
 * Lot 2 — le client HTTP réel SamirPay respecte le contrat officiel. Lot 9 bis (H5, T13) : contrat v1.2, quatre
 * formats de réponse (A : status/message/body ; B : success/data ou errorCode/errorMessage ; C : objet nu ; D : status
 * numérique, errorCode, message, path, timestamp). Exécuté contre un serveur local (127.0.0.1) qui imite la v1.2 et
 * enregistre les requêtes reçues : chemins, en-têtes, corps exacts. Aucun appel réseau externe, aucun passage du
 * document confidentiel recopié (seuls des noms de champs, de codes et de statuts).
 *  - cashin direct (B, 201) : transactionId, url (Wave), urls.OM puis urls.MAXIT (Orange), qrCode en base64 brut rendu
 *    en data URL ; 400 B : errorMessage repris ; 409 D (orderId en double) → DUPLICATE ;
 *  - statut (C) : {transactionId, status} corrélé ; 404 NOT_FOUND seulement si status = NOT_FOUND ; 400 INVALID_ID ;
 *  - solde (A) : body.solde ;
 *  - cashout (A) : body = Transaction, statut interne « V » → SUCCESS, fees, netAmount (valeur absolue), refOperator,
 *    reference ; statut interne inconnu → UNCERTAIN, jamais un succès supposé ; refus explicite distinct d'une issue
 *    incertaine (délai, 5xx, illisible).
 * Rouge jusqu'à fix(9b.H5) (lib/samirpay/http-client.ts lit encore data, urls.wave et urls.orange). Le serveur imite
 * aussi les erreurs de transfert (H7) et le 409 D porteur d'identifiant (H4), vérifiés en fin de fichier.
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
type SendBehaviour = 'ok' | 'reject' | 'slow' | 'html502' | 'unknown-status' | 'conflict' | 'insufficient' | 'limit-min' | 'limit-max';
const received: Received[] = [];
/** orderId déjà vus → identifiant de la transaction créée (409 D porteur de l'identifiant, H4). */
const seenOrders = new Map<string, string>();
let cashoutBehaviour: SendBehaviour = 'ok';
let server: http.Server;
const saved: Record<string, string | undefined> = {};
/** QR en base64 brut (PNG), tel que la v1.2 le renvoie : sans préfixe data:. */
const RAW_QR = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const STATUS_NOT_FOUND = '00000000-0000-4000-8000-000000000404';
const STATUS_FOREIGN_404 = '00000000-0000-4000-8000-0000000004ff';
const STATUS_OTHER_ID = '00000000-0000-4000-8000-0000000000ee';

function json(res: http.ServerResponse, status: number, body: unknown) {
    res.writeHead(status, { 'content-type': 'application/json' });
    res.end(JSON.stringify(body));
}

/** Erreur au format D (doublon d'orderId, 500). */
function formatD(res: http.ServerResponse, status: number, errorCode: string, message: string, path: string) {
    return json(res, status, { status, errorCode, message, path, timestamp: new Date().toISOString().slice(0, 19) });
}

function transfer(b: Record<string, unknown>, status: string): Record<string, unknown> {
    const amount = Number(b.amount);
    const fees = Math.round(amount * 0.015);
    return {
        id: randomUUID(), reference: 'TXAB12CD34', operatorName: b.operatorName, operationDate: new Date().toISOString().slice(0, 19), status,
        type: 'CASHOUT', telephone: b.phoneNumber, orderId: null, amount: -amount, fees, netAmount: -(amount + fees),
        balanceAfterTransaction: 250000 - amount - fees, refOperator: b.operatorName === 'WAVE' ? 'pt-test-0001' : 'CI260101.0001.A00001',
    };
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
                if (b.description === 'refus-format-B') return json(res, 400, { success: false, errorCode: 'INVALID_REQUEST', errorMessage: 'Numéro de téléphone refusé (serveur de test)' });
                const known = seenOrders.get(b.orderId);
                if (known) return formatD(res, 409, 'CONFLICT', b.description === 'doublon-sans-id' ? 'orderId déjà utilisé (serveur de test)' : `orderId déjà utilisé (transactionId=${known})`, path);
                const id = randomUUID();
                seenOrders.set(b.orderId, id);
                const orange = b.operatorName === 'ORANGE_MONEY';
                return json(res, 201, {
                    success: true,
                    data: {
                        transactionId: id, url: orange ? null : `https://pay.example/${id}`, qrCode: RAW_QR,
                        urls: orange ? { MAXIT: `https://maxit.example/${id}`, OM: `https://om.example/${id}` } : null,
                        paymentMode: orange ? 'QRCODE' : 'WAVE', instruction: 'Validez sur votre téléphone (serveur de test)',
                    },
                });
            }
            const m = path.match(/^\/api\/tiers\/payments\/([^/]+)\/status$/);
            if (req.method === 'GET' && m) {
                if (m[1] === STATUS_NOT_FOUND) return json(res, 404, { transactionId: m[1], status: 'NOT_FOUND' });
                if (m[1] === STATUS_FOREIGN_404) return json(res, 404, { status: 'error', message: 'route introuvable (proxy du serveur de test)' });
                if (!/^[0-9a-f-]{36}$/.test(m[1])) return json(res, 400, { transactionId: null, status: 'INVALID_ID' });
                if (m[1] === STATUS_OTHER_ID) return json(res, 200, { transactionId: randomUUID(), status: 'SUCCESS' });
                return json(res, 200, { transactionId: m[1], status: 'SUCCESS' });
            }
            if (req.method === 'GET' && path === '/api/tiers/payments/solde') {
                return json(res, 200, { status: 'success', message: 'Solde (serveur de test)', body: { samirEntityName: 'Event Village Test', solde: 250000.0 } });
            }
            if (req.method === 'POST' && path === '/api/tiers/payments/send') {
                const b = JSON.parse(body || '{}');
                if (cashoutBehaviour === 'reject') return json(res, 400, { status: 'error', message: 'Transfert refusé par l’opérateur (serveur de test)' });
                if (cashoutBehaviour === 'insufficient') return json(res, 400, { status: 'error', message: 'Solde insuffisant (serveur de test) : 10000 disponibles' });
                if (cashoutBehaviour === 'limit-min') return json(res, 400, { status: 'error', message: 'Montant hors bornes : minimum autorisé non atteint (serveur de test)' });
                if (cashoutBehaviour === 'limit-max') return json(res, 400, { status: 'error', message: 'Montant hors bornes : maximum autorisé dépassé (serveur de test)' });
                if (cashoutBehaviour === 'conflict') return json(res, 409, { status: 'error', message: 'Erreur technique pendant le transfert (serveur de test)' });
                if (cashoutBehaviour === 'html502') { res.writeHead(502, { 'content-type': 'text/html' }); return res.end('<html>Bad gateway</html>'); }
                if (cashoutBehaviour === 'slow') return void setTimeout(() => json(res, 200, { status: 'success', message: 'Transfert effectué', body: transfer(b, 'V') }), 1500);
                if (cashoutBehaviour === 'unknown-status') return json(res, 200, { status: 'success', message: 'Transfert effectué', body: transfer(b, 'Z') });
                return json(res, 200, { status: 'success', message: 'Transfert effectué (serveur de test)', body: transfer(b, 'V') });
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

/** Client typé souplement : les champs v1.2 (fees, netAmount, refOperator, reference) n'existent qu'après fix(9b.H5). */
const client = (): any => new SamirPayHttpClient();
const last = (path: string) => [...received].reverse().find((r) => r.path === path);
const CASHOUT = { phoneNumber: '771234567', operatorName: 'WAVE', amount: 1000, firstName: 'A', lastName: 'B' } as const;

async function rejectsWithKind(p: Promise<unknown>, kind: string, label: string, code?: string) {
    await assert.rejects(p, (err: unknown) => {
        const k = (err as { kind?: string }).kind;
        assert.equal(k, kind, `${label} : nature de l'erreur (${(err as Error).message})`);
        if (code !== undefined) assert.equal((err as { code?: string }).code, code, `${label} : code de l'erreur (${(err as Error).message})`);
        return true;
    });
}

describe('Client SamirPay réel — conformité au contrat v1.2', () => {
    test('cashin direct : chemin, en-têtes et corps exacts ; réponse 201 lue (transactionId, url, qrCode, urls)', async () => {
        const orderId = `ORD-EV-${Date.now()}-A1B2C3`;
        const r = await client().initDirectPayment({ amount: 5000, orderId, callBackUrl: 'https://eventvillage.sn/api/webhooks/samirpay?t=abc', operatorName: 'WAVE', telephone: '771234567', description: 'Panier Billetterie' });
        const req = last('/api/tiers/direct/initPayment')!;
        assert.equal(req.method, 'POST');
        assert.equal(req.headers['x-api-key'], process.env.SAMIRPAY_API_KEY);
        assert.equal(req.headers['x-secret-key'], process.env.SAMIRPAY_SECRET_KEY);
        assert.deepEqual(JSON.parse(req.body), { amount: '5000', orderId, callBackUrl: 'https://eventvillage.sn/api/webhooks/samirpay?t=abc', operatorName: 'WAVE', telephone: '771234567', description: 'Panier Billetterie' }, 'corps conforme, sans champ hors contrat');
        assert.match(r.transactionId, /^[0-9a-f-]{36}$/);
        assert.equal(r.paymentUrl, `https://pay.example/${r.transactionId}`, 'Wave : lien de paiement lu dans data.url');
        assert.equal(r.qrCode, `data:image/png;base64,${RAW_QR}`, 'qrCode en base64 brut (v1.2, §4.2) rendu en data URL');
        assert.deepEqual(r.deepLinks, { wave: null, orange: null }, 'Wave n’a que url : aucun lien profond inventé (contrat 4.5)');
    });

    test('cashin direct Orange Money : url null, lien profond lu dans urls.OM (puis urls.MAXIT), qrCode rendu en data URL', async () => {
        const r = await client().initDirectPayment({ amount: 2500, orderId: `ORD-EV-${Date.now()}-0A0A0A`, callBackUrl: 'https://x.example/cb?t=1', operatorName: 'ORANGE_MONEY', telephone: '781234567' });
        assert.equal(r.paymentUrl, null, 'Orange : aucune url de paiement (v1.2)');
        assert.equal(r.deepLinks.orange, `https://om.example/${r.transactionId}`, 'deepLinks.orange = urls.OM ?? urls.MAXIT (contrat 4.5)');
        assert.equal(r.deepLinks.wave, null);
        assert.equal(r.qrCode, `data:image/png;base64,${RAW_QR}`, 'qrCode préfixé data:image/png;base64,');
    });

    test('cashin direct : 400 au format B → REJECTED, errorMessage repris dans le message (jamais « HTTP 400 »)', async () => {
        await assert.rejects(
            client().initDirectPayment({ amount: 1000, orderId: `ORD-EV-${Date.now()}-B0B0B0`, callBackUrl: 'https://x.example/cb?t=1', operatorName: 'WAVE', telephone: '771234567', description: 'refus-format-B' }),
            (err: unknown) => {
                assert.equal((err as { kind?: string }).kind, 'REJECTED', `nature : ${(err as Error).message}`);
                assert.match((err as Error).message, /Numéro de téléphone refusé/, `errorMessage du format B repris : ${(err as Error).message}`);
                return true;
            });
    });

    test('cashin direct : orderId en double → erreur DUPLICATE (409)', async () => {
        const orderId = `ORD-EV-${Date.now()}-D0D0D0`;
        await client().initDirectPayment({ amount: 1000, orderId, callBackUrl: 'https://x.example/cb?t=1', operatorName: 'ORANGE_MONEY', telephone: '781234567' });
        await rejectsWithKind(client().initDirectPayment({ amount: 1000, orderId, callBackUrl: 'https://x.example/cb?t=1', operatorName: 'ORANGE_MONEY', telephone: '781234567' }), 'DUPLICATE', 'doublon');
    });

    test('statut : GET /api/tiers/payments/{transactionId}/status, réponse corrélée ; 404 NOT_FOUND strict ; 400 INVALID_ID', async () => {
        const id = randomUUID();
        const s = await client().checkTransactionStatus(id);
        assert.equal(last(`/api/tiers/payments/${id}/status`)?.method, 'GET');
        assert.deepEqual(s, { transactionId: id, status: 'SUCCESS' });
        await rejectsWithKind(client().checkTransactionStatus(STATUS_NOT_FOUND), 'NOT_FOUND', 'transaction inexistante (status NOT_FOUND)');
        await rejectsWithKind(client().checkTransactionStatus(STATUS_FOREIGN_404), 'INVALID_RESPONSE', '404 au corps étranger : jamais NOT_FOUND supposé');
        await rejectsWithKind(client().checkTransactionStatus('pas-un-identifiant'), 'INVALID_RESPONSE', '400 INVALID_ID', 'INVALID_ID');
        await rejectsWithKind(client().checkTransactionStatus(STATUS_OTHER_ID), 'INVALID_RESPONSE', 'réponse pour un autre identifiant');
    });

    test('solde : lu dans body.solde (format A)', async () => {
        const s = await client().getSolde();
        assert.equal(s.solde, 250000);
        assert.equal(s.entityName, 'Event Village Test');
    });

    test('cashout : corps exact (9 chiffres, montant en chaîne, prénom et nom) ; body lu : id, statut « V », fees, netAmount, refOperator, reference', async () => {
        cashoutBehaviour = 'ok';
        const r = await client().sendCashout({ phoneNumber: '771234567', operatorName: 'ORANGE_MONEY', amount: 15000, firstName: 'Awa', lastName: 'Diop' });
        assert.deepEqual(JSON.parse(last('/api/tiers/payments/send')!.body), { phoneNumber: '771234567', operatorName: 'ORANGE_MONEY', amount: '15000', firstName: 'Awa', lastName: 'Diop' });
        assert.match(r.transactionId, /^[0-9a-f-]{36}$/);
        assert.deepEqual({ status: r.status, fees: r.fees, netAmount: r.netAmount, refOperator: r.refOperator, reference: r.reference },
            { status: 'SUCCESS', fees: 225, netAmount: 15225, refOperator: 'CI260101.0001.A00001', reference: 'TXAB12CD34' },
            'statut interne V → SUCCESS ; frais réels et débit total (valeur absolue de netAmount, contrat 4.5)');
    });

    test('cashout : statut interne inconnu dans body → UNCERTAIN, jamais un succès supposé', async () => {
        cashoutBehaviour = 'unknown-status';
        await rejectsWithKind(client().sendCashout(CASHOUT), 'UNCERTAIN', 'statut interne inconnu');
        cashoutBehaviour = 'ok';
    });

    test('cashout : refus explicite → REJECTED ; délai dépassé ou 502 → UNCERTAIN', async () => {
        cashoutBehaviour = 'reject';
        await rejectsWithKind(client().sendCashout(CASHOUT), 'REJECTED', 'refus 400 de l’opérateur');
        cashoutBehaviour = 'slow';
        await rejectsWithKind(client().sendCashout(CASHOUT), 'UNCERTAIN', 'délai dépassé');
        cashoutBehaviour = 'html502';
        await rejectsWithKind(client().sendCashout(CASHOUT), 'UNCERTAIN', '502 illisible');
        cashoutBehaviour = 'ok';
    });
});

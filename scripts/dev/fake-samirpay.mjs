#!/usr/bin/env node
/**
 * Lot 8 (8.1, L18, contrat 5.2) — npm run fake:samirpay : faux SamirPay et faux MTarget du mode d'essai.
 *
 * Processus séparé, à l'écoute de 127.0.0.1 seulement (EV_DEV_FAKE_PORT, 4010 par défaut). Mêmes chemins que
 * l'e2e : SamirPay sous /samirpay, MTarget à /mtarget/messages. Les routes viennent de scripts/e2e/fake-core.mjs.
 *  - webhook : toujours posté à 127.0.0.1:<EV_DEV_APP_PORT>, chemin et jeton gardés, même si l'URL de rappel
 *    est celle d'un tunnel (ce port n'est jamais celui de l'URL reçue) ;
 *  - état : .logs/fake-samirpay.json, écrit AVANT chaque réponse : un paiement survit à un arrêt brutal, sans
 *    quoi l'application le croirait inconnu (PROVIDER_NOT_FOUND) ;
 *  - page de paiement : /dev/paiements/<id> de l'application en mode A ; la page / de ce service en mode B,
 *    reconnu à la clé SamirPay que scripts/dev/essai-start.mjs donne à l'application ;
 *  - SMS du mode B : affichés en clair dans cette console. Clés reçues non contrôlées : boucle locale.
 *
 * Valider et refuser passent par POST /__test/samirpay/complete et /__test/samirpay/fail (fake-core.mjs),
 * appelés par app/api/dev/samirpay/[action]/route.dev.ts ou par la page / de ce service.
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createFakeCore, json, postLocalWebhook } from '../e2e/fake-core.mjs';
import { loadLocalEnv, portOf } from './env-local.mjs';
import { ESSAI_SERVER_KEY } from './essai-keys.mjs';

const TAG = 'faux-samirpay';
const HOST = '127.0.0.1';
const SP = '/samirpay';
const MT = '/mtarget/messages';

function fail(message) {
    console.error(`[${TAG}] refus : ${message}`);
    process.exit(1);
}

function log(message) {
    console.log(`[${TAG}] ${message}`);
}

const nodeEnv = process.env.NODE_ENV;
if (nodeEnv === 'production' || nodeEnv === 'test') fail(`NODE_ENV=${nodeEnv} : le faux service ne tourne qu'en développement.`);

const cwd = process.cwd();
let port;
let appPort;
try {
    loadLocalEnv({ cwd, required: ['NEXT_PUBLIC_APP_URL'] });
    port = portOf(process.env, 'EV_DEV_FAKE_PORT', 4010);
    appPort = portOf(process.env, 'EV_DEV_APP_PORT', 3000);
} catch (err) {
    fail(err instanceof Error ? err.message : String(err));
}
const appUrl = process.env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, '');
const BASE = `http://${HOST}:${port}`;

const stateFile = path.join(cwd, '.logs', 'fake-samirpay.json');

function loadTransactions() {
    if (!fs.existsSync(stateFile)) return new Map();
    try {
        const saved = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
        return new Map(saved.transactions.map((t) => [t.transactionId, t]));
    } catch (err) {
        return fail(`${stateFile} illisible (${err instanceof Error ? err.message : String(err)}) : retirez ce fichier, les paiements en cours seront perdus.`);
    }
}

const transactions = loadTransactions();

/** Écriture complète puis remplacement : un arrêt brutal ne laisse jamais un fichier tronqué. */
function saveTransactions() {
    fs.mkdirSync(path.dirname(stateFile), { recursive: true });
    const temporary = `${stateFile}.tmp`;
    fs.writeFileSync(temporary, JSON.stringify({ transactions: [...transactions.values()] }, null, 2));
    fs.renameSync(temporary, stateFile);
}

let previewMode = false;

const core = createFakeCore({
    base: BASE,
    sp: SP,
    mt: MT,
    transactions,
    authorized: {
        samirpay: (req) => {
            previewMode = req.headers['x-api-key'] === ESSAI_SERVER_KEY;
            return true;
        },
        mtarget: () => true,
    },
    // Seuls le chemin et le jeton de l'URL reçue servent : la connexion va toujours à l'application locale.
    webhookTarget: (tx) => {
        if (!URL.canParse(tx.callBackUrl)) return { ok: false, error: 'callBackUrl illisible' };
        return { ok: true, target: new URL(tx.callBackUrl) };
    },
    postWebhook: (tx, target) => postLocalWebhook(tx, target, appPort),
    onSms: (sms) => log(`SMS pour ${sms.msisdn} : ${sms.message}`),
    log,
    paymentPage: (id) => (previewMode ? `${BASE}/#${id}` : `${appUrl}/dev/paiements/${id}`),
});

function escapeHtml(text) {
    return String(text).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

function paymentRow(tx) {
    const id = escapeHtml(tx.transactionId);
    const actions = tx.status === 'PENDING'
        ? `<button data-action="complete" data-id="${id}">Valider</button> <button data-action="fail" data-id="${id}">Refuser</button>`
        : '';
    return `<tr id="${id}"><td>${id}</td><td>${escapeHtml(tx.amount)} F CFA</td><td>${escapeHtml(tx.operatorName)}</td><td>${escapeHtml(tx.status)}</td><td>${actions}</td></tr>`;
}

const PAGE_SCRIPT = `document.addEventListener('click', async (event) => {
    const button = event.target.closest('button[data-action]');
    if (!button) return;
    button.disabled = true;
    const res = await fetch('/__test/samirpay/' + button.dataset.action, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ transactionId: button.dataset.id }),
    });
    if (res.ok) { location.reload(); return; }
    button.disabled = false;
    alert('Action refusée par le faux service, voir sa console.');
});`;

function listPage(res) {
    const rows = [...transactions.values()].filter((t) => t.kind === 'CASHIN').reverse().map(paymentRow).join('');
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
    res.end(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Paiements simulés</title></head><body>`
        + `<h1>Paiements simulés</h1><p>Paiement simulé : aucun argent réel.</p>`
        + `<table border="1" cellpadding="6"><thead><tr><th>Transaction</th><th>Montant</th><th>Opérateur</th><th>Statut</th><th>Action</th></tr></thead>`
        + `<tbody>${rows || '<tr><td colspan="5">Aucun paiement pour le moment.</td></tr>'}</tbody></table>`
        + `<script>${PAGE_SCRIPT}</script></body></html>`);
    return 200;
}

async function handle(req, res, url) {
    if (url.pathname.startsWith('/__test/')) {
        if (req.method === 'GET' && url.pathname === '/__test/health') return json(res, 200, { ok: true, transactions: transactions.size });
        return (await core.control(req, res, url)) ?? json(res, 404, { ok: false, error: `point de contrôle inconnu : ${req.method} ${url.pathname}` });
    }
    if (req.method === 'GET' && url.pathname === '/') return listPage(res);
    return (await core.route(req, res, url)) ?? json(res, 404, { error: `route inconnue du faux service : ${req.method} ${url.pathname}` });
}

const server = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', BASE);
    // L'état part sur le disque avant la réponse : qui reçoit la réponse peut couper le service.
    if (req.method === 'POST') {
        const end = res.end.bind(res);
        res.end = (...args) => {
            try {
                saveTransactions();
            } catch (err) {
                console.error(`[${TAG}] état non enregistré dans ${stateFile} :`, err instanceof Error ? err.message : String(err));
            }
            return end(...args);
        };
    }
    let code = 500;
    try {
        code = await handle(req, res, url);
    } catch (err) {
        console.error(`[${TAG}] erreur sur ${req.method} ${url.pathname} :`, err instanceof Error ? err.message : String(err));
        if (!res.headersSent) code = json(res, 500, { error: 'erreur interne du faux service' });
    }
    log(`${req.method} ${url.pathname} → ${code}`);
});

server.on('error', (err) => fail(`écoute impossible sur ${HOST}:${port} : ${err.message}`));
server.listen(port, HOST, () => {
    log(`prêt sur ${BASE} — SamirPay ${SP} · MTarget ${MT} · webhooks vers ${HOST}:${appPort} · aucun argent réel`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => {
        log(`arrêt (${signal})`);
        server.close(() => process.exit(0));
    });
}

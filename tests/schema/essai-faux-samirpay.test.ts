/**
 * Lot 8, tâche 8.1 (contrat 5.2, 5.5, L18) — faux SamirPay local (npm run fake:samirpay).
 *
 * L'entrée scripts/dev/fake-samirpay.mjs tourne dans un processus fils, avec un dossier de travail TEMPORAIRE qui
 * porte un `.env.local` fabriqué (le fichier du dépôt n'est jamais lu) et son état `.logs/fake-samirpay.json`. Le
 * « serveur de l'application » est un petit serveur HTTP du test, sur EV_DEV_APP_PORT. Aucune base.
 *
 * API figée par cette suite (au-delà du contrat, pour S1 et E5) :
 *  - chemins identiques à ceux de l'e2e (.env.e2e, verify.yml) : SamirPay sous `/samirpay`, MTarget à
 *    `/mtarget/messages` ; EV_DEV_FAKE_SERVICES_URL vaut donc `http://127.0.0.1:<port>/samirpay` ;
 *  - valider et refuser passent par les points de contrôle de fake-core.mjs (`/__test/samirpay/complete` et
 *    `/__test/samirpay/fail`), appelés par route.dev.ts ou par la page de `/` ;
 *  - l'état est relu depuis le dossier de travail ; il est écrit à chaque changement (le fils est tué par SIGKILL).
 *
 * Rouge aujourd'hui : scripts/dev/fake-samirpay.mjs et scripts/dev/essai-start.mjs n'existent pas, chaque échec
 * nomme le fichier attendu.
 *
 * Lot 9 bis (H5, T15) : le cas « contrat SamirPay » suit la v1.2 (formats A, B, C et D), avec autant d'assertions
 * qu'avant : cashin B (qrCode en base64 brut ; Orange : url nulle, urls.OM et urls.MAXIT), doublon 409 D (CONFLICT,
 * transactionId= dans message), statut C (404 { transactionId, status: NOT_FOUND }), solde A (body.solde), transfert A
 * (body, statut interne « V »). Rouge jusqu'à fix(9b.H5), qui aligne scripts/e2e/fake-core.mjs (A1).
 */
import '../helpers/env';
import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import net, { type AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';

const ROOT = process.cwd();
const ENTRY_FILE = path.join(ROOT, 'scripts', 'dev', 'fake-samirpay.mjs');
const ESSAI_START_FILE = path.join(ROOT, 'scripts', 'dev', 'essai-start.mjs');
const TUNNEL = 'https://mot-mot-mot-mot.trycloudflare.com';
/** Valeur envoyée par la passerelle de développement (L19), ni clé ni mot de passe réels. */
const DEV_FAKE_KEY = 'dev-fake';
const WORK_DIRS: string[] = [];
const CHILDREN: ChildProcess[] = [];

after(async () => {
    for (const child of CHILDREN) if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
    for (const dir of WORK_DIRS) fs.rmSync(dir, { recursive: true, force: true });
});

function workDir(lines: Record<string, string>): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ev-faux-samirpay-'));
    WORK_DIRS.push(dir);
    fs.writeFileSync(path.join(dir, '.env.local'), Object.entries(lines).map(([k, v]) => `${k}=${v}`).join('\n'));
    return dir;
}

function childEnv(env: Record<string, string>): Record<string, string> {
    const out = { ...env };
    for (const key of ['PATH', 'Path', 'SystemRoot', 'TEMP', 'TMP']) if (process.env[key]) out[key] = process.env[key] as string;
    return out;
}

async function freePort(): Promise<number> {
    const probe = net.createServer();
    await new Promise<void>((resolve) => { probe.listen(0, '127.0.0.1', resolve); });
    const port = (probe.address() as AddressInfo).port;
    await new Promise((resolve) => { probe.close(resolve); });
    return port;
}

/** Vrai si une connexion TCP aboutit sur host:port. */
function canConnect(host: string, port: number): Promise<boolean> {
    return new Promise((resolve) => {
        const socket = net.connect({ host, port });
        socket.setTimeout(1500);
        socket.once('connect', () => { socket.destroy(); resolve(true); });
        socket.once('timeout', () => { socket.destroy(); resolve(false); });
        socket.once('error', () => { resolve(false); });
    });
}

interface RunningFake {
    port: number;
    base: string;
    output: () => string;
    stop: () => Promise<void>;
}

function startFake(cwd: string, port: number, env: Record<string, string> = {}): Promise<RunningFake> {
    assert.ok(fs.existsSync(ENTRY_FILE), 'scripts/dev/fake-samirpay.mjs absent : livré par fix(8.1s)');
    const child = spawn(process.execPath, [ENTRY_FILE], {
        cwd,
        env: childEnv({ EV_DEV_FAKE_PORT: String(port), ...env }) as NodeJS.ProcessEnv,
        stdio: ['ignore', 'pipe', 'pipe'],
    });
    CHILDREN.push(child);
    let output = '';
    child.stdout?.on('data', (c) => { output += String(c); });
    child.stderr?.on('data', (c) => { output += String(c); });
    const exited = new Promise<void>((resolve) => { child.once('close', () => { resolve(); }); });
    return (async () => {
        const deadline = Date.now() + 15_000;
        for (;;) {
            if (child.exitCode !== null) assert.fail(`le faux service s'est arrêté (code ${child.exitCode}) : ${output.slice(0, 800)}`);
            if (await canConnect('127.0.0.1', port)) break;
            assert.ok(Date.now() < deadline, `le faux service n'écoute pas sur 127.0.0.1:${port} : ${output.slice(0, 800)}`);
            await new Promise((resolve) => { setTimeout(resolve, 100); });
        }
        return {
            port,
            base: `http://127.0.0.1:${port}`,
            output: () => output,
            stop: async () => {
                child.kill('SIGKILL');
                await exited;
            },
        };
    })();
}

interface Exit { code: number | null; output: string }

function runToExit(file: string, cwd: string, env: Record<string, string>): Promise<Exit> {
    return new Promise((resolve, reject) => {
        const child = spawn(process.execPath, [file], { cwd, env: childEnv(env) as NodeJS.ProcessEnv, stdio: ['ignore', 'pipe', 'pipe'] });
        CHILDREN.push(child);
        let output = '';
        const timer = setTimeout(() => child.kill('SIGKILL'), 15_000);
        child.stdout.on('data', (c) => { output += String(c); });
        child.stderr.on('data', (c) => { output += String(c); });
        child.on('error', reject);
        child.on('close', (code) => {
            clearTimeout(timer);
            resolve({ code, output });
        });
    });
}

interface Webhook { method: string; url: string; host: string | undefined; contentType: string | undefined; body: string }

interface FakeApp { port: number; hooks: Webhook[]; close(): Promise<void> }

async function fakeApp(): Promise<FakeApp> {
    const hooks: Webhook[] = [];
    const server = http.createServer((req, res) => {
        let body = '';
        req.setEncoding('utf8');
        req.on('data', (c) => { body += String(c); });
        req.on('end', () => {
            hooks.push({ method: req.method ?? '', url: req.url ?? '', host: req.headers.host, contentType: req.headers['content-type'], body });
            res.writeHead(200, { 'content-type': 'application/json' });
            res.end('{"ok":true}');
        });
    });
    await new Promise<void>((resolve) => { server.listen(0, '127.0.0.1', resolve); });
    server.unref(); // un test en échec avant son finally ne doit pas retenir le processus jusqu'au délai du lanceur
    return {
        port: (server.address() as AddressInfo).port,
        hooks,
        close: () => new Promise<void>((resolve) => { server.close(() => { resolve(); }); }),
    };
}

async function call(base: string, method: string, url: string, body?: unknown): Promise<{ status: number; json: Record<string, unknown> }> {
    const res = await fetch(`${base}${url}`, {
        method,
        headers: { 'content-type': 'application/json', 'x-api-key': DEV_FAKE_KEY, 'x-secret-key': DEV_FAKE_KEY },
        body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    return { status: res.status, json: text ? JSON.parse(text) as Record<string, unknown> : {} };
}

function initBody(callBackUrl: string, over: Record<string, unknown> = {}): Record<string, unknown> {
    return { amount: '5000', orderId: `ORD-${randomUUID()}`, callBackUrl, operatorName: 'WAVE', telephone: '770000001', ...over };
}

async function init(base: string, callBackUrl: string): Promise<{ transactionId: string; url: string; orderId: string }> {
    const body = initBody(callBackUrl);
    const r = await call(base, 'POST', '/samirpay/api/tiers/direct/initPayment', body);
    assert.equal(r.status, 201, `initPayment : ${JSON.stringify(r.json)}`);
    const data = r.json.data as { transactionId: string; url: string };
    assert.match(data.transactionId, /^[0-9a-f-]{36}$/);
    return { transactionId: data.transactionId, url: data.url, orderId: String(body.orderId) };
}

function appEnv(appPort: number, over: Record<string, string> = {}): Record<string, string> {
    return { NEXT_PUBLIC_APP_URL: TUNNEL, EV_INTEGRATIONS: 'fake', EV_DEV_APP_PORT: String(appPort), ...over };
}

describe('scripts/dev/fake-samirpay.mjs : refus de démarrer', () => {
    for (const nodeEnv of ['production', 'test']) {
        test(`NODE_ENV=${nodeEnv} : refus, rien n’écoute`, async () => {
            assert.ok(fs.existsSync(ENTRY_FILE), 'scripts/dev/fake-samirpay.mjs absent : livré par fix(8.1s)');
            const port = await freePort();
            const r = await runToExit(ENTRY_FILE, workDir(appEnv(3000)), { NODE_ENV: nodeEnv, EV_DEV_FAKE_PORT: String(port) });
            assert.notEqual(r.code, 0, `refus attendu : ${r.output.slice(0, 300)}`);
            assert.match(r.output, /NODE_ENV/);
            assert.equal(await canConnect('127.0.0.1', port), false, 'aucune écoute après un refus');
        });
    }
});

describe('scripts/dev/fake-samirpay.mjs : écoute et contrat', () => {
    test('écoute sur 127.0.0.1 seulement : une autre adresse de boucle locale ne répond pas', async () => {
        const app = await fakeApp();
        const fake = await startFake(workDir(appEnv(app.port)), await freePort());
        try {
            assert.equal(await canConnect('127.0.0.1', fake.port), true);
            // 127.0.0.2 répond sur toute écoute 0.0.0.0, jamais sur une écoute limitée à 127.0.0.1.
            assert.equal(await canConnect('127.0.0.2', fake.port), false, 'le faux service écoute au-delà de 127.0.0.1');
        } finally {
            await fake.stop();
            await app.close();
        }
    });

    test('contrat SamirPay : init, statut, solde, send', async () => {
        const app = await fakeApp();
        const fake = await startFake(workDir(appEnv(app.port)), await freePort());
        try {
            const body = initBody(`${TUNNEL}/api/webhooks/samirpay?token=essai`);
            const created = await call(fake.base, 'POST', '/samirpay/api/tiers/direct/initPayment', body);
            assert.equal(created.status, 201, JSON.stringify(created.json));
            assert.equal(created.json.success, true);
            const data = created.json.data as { transactionId: string; url: string; qrCode: string };
            assert.equal(typeof data.transactionId, 'string');
            assert.match(String(data.qrCode), /^[A-Za-z0-9+/]+=*$/, `qrCode en base64 brut, sans préfixe data: (v1.2) : ${String(data.qrCode).slice(0, 40)}`);
            const orange = await call(fake.base, 'POST', '/samirpay/api/tiers/direct/initPayment', initBody(`${TUNNEL}/api/webhooks/samirpay?token=essai`, { operatorName: 'ORANGE_MONEY' }));
            const od = (orange.json.data ?? {}) as { transactionId: string; url: string | null; urls: { OM?: string; MAXIT?: string } | null };
            assert.ok(orange.status === 201 && od.url === null && String(od.urls?.OM).startsWith(`${TUNNEL}/dev/paiements/${od.transactionId}`), `Orange : url nulle, urls.OM vers la page de paiement : ${JSON.stringify(orange.json)}`);
            assert.ok(String(od.urls?.MAXIT).startsWith(`${TUNNEL}/dev/paiements/${od.transactionId}`), `Orange : urls.MAXIT vers la page de paiement : ${JSON.stringify(od.urls)}`);

            const twice = await call(fake.base, 'POST', '/samirpay/api/tiers/direct/initPayment', body);
            assert.deepEqual([twice.status, twice.json.status, twice.json.errorCode, new RegExp(`transactionId=${data.transactionId}`).test(String(twice.json.message))], [409, 409, 'CONFLICT', true], `un orderId déjà vu : 409 au format D, identifiant existant dans message : ${JSON.stringify(twice.json)}`);

            const status = await call(fake.base, 'GET', `/samirpay/api/tiers/payments/${data.transactionId}/status`);
            assert.equal(status.status, 200);
            assert.deepEqual(status.json, { transactionId: data.transactionId, status: 'PENDING' });
            const unknownId = randomUUID();
            assert.deepEqual(await call(fake.base, 'GET', `/samirpay/api/tiers/payments/${unknownId}/status`), { status: 404, json: { transactionId: unknownId, status: 'NOT_FOUND' } });

            const solde = await call(fake.base, 'GET', '/samirpay/api/tiers/payments/solde');
            assert.equal(solde.status, 200);
            assert.equal(typeof (solde.json.body as { solde: unknown } | undefined)?.solde, 'number', `solde lu dans body.solde (format A) : ${JSON.stringify(solde.json)}`);

            const sent = await call(fake.base, 'POST', '/samirpay/api/tiers/payments/send', { phoneNumber: '770000002', operatorName: 'WAVE', amount: '1500', firstName: 'Awa', lastName: 'Diop' });
            assert.equal(sent.status, 200, JSON.stringify(sent.json));
            assert.equal(sent.json.status, 'success');
            assert.equal((sent.json.body as { status: string } | undefined)?.status, 'V', `transfert : body = Transaction, statut interne « V » : ${JSON.stringify(sent.json)}`);
        } finally {
            await fake.stop();
            await app.close();
        }
    });

    test('mode A : la page de paiement est /dev/paiements/<id> sur l’URL de l’application', async () => {
        const app = await fakeApp();
        const fake = await startFake(workDir(appEnv(app.port)), await freePort());
        try {
            const tx = await init(fake.base, `${TUNNEL}/api/webhooks/samirpay?token=essai`);
            assert.equal(tx.url, `${TUNNEL}/dev/paiements/${tx.transactionId}`);
        } finally {
            await fake.stop();
            await app.close();
        }
    });

    test('valider : webhook sur le port de l’application, même avec une URL https, chemin et jeton gardés', async () => {
        const app = await fakeApp();
        const fake = await startFake(workDir(appEnv(app.port)), await freePort());
        try {
            const token = randomBytes(16).toString('hex');
            const tx = await init(fake.base, `${TUNNEL}/api/webhooks/samirpay?token=${token}`);
            const done = await call(fake.base, 'POST', '/__test/samirpay/complete', { transactionId: tx.transactionId });
            assert.equal(done.status, 200, JSON.stringify(done.json));
            assert.equal(done.json.ok, true);
            assert.equal(app.hooks.length, 1, 'un seul webhook');
            const hook = app.hooks[0];
            assert.equal(hook.method, 'POST');
            assert.equal(hook.url, `/api/webhooks/samirpay?token=${token}`);
            assert.equal(hook.contentType, 'application/x-www-form-urlencoded');
            const fields = new URLSearchParams(hook.body);
            assert.equal(fields.get('transaction_id'), tx.transactionId);
            assert.equal(fields.get('order_id'), tx.orderId);
            assert.equal(fields.get('status'), 'success');
            const status = await call(fake.base, 'GET', `/samirpay/api/tiers/payments/${tx.transactionId}/status`);
            assert.equal(status.json.status, 'SUCCESS');
        } finally {
            await fake.stop();
            await app.close();
        }
    });

    test('refuser : FAILED, aucun webhook', async () => {
        const app = await fakeApp();
        const fake = await startFake(workDir(appEnv(app.port)), await freePort());
        try {
            const tx = await init(fake.base, `${TUNNEL}/api/webhooks/samirpay?token=essai`);
            const failed = await call(fake.base, 'POST', '/__test/samirpay/fail', { transactionId: tx.transactionId });
            assert.equal(failed.status, 200, JSON.stringify(failed.json));
            assert.equal(failed.json.status, 'FAILED');
            const status = await call(fake.base, 'GET', `/samirpay/api/tiers/payments/${tx.transactionId}/status`);
            assert.equal(status.json.status, 'FAILED');
            assert.equal(app.hooks.length, 0, 'le contrat n’envoie aucun webhook d’échec');
        } finally {
            await fake.stop();
            await app.close();
        }
    });

    test('état conservé après un arrêt brutal : .logs/fake-samirpay.json, statut relu, validation possible', async () => {
        const app = await fakeApp();
        const cwd = workDir(appEnv(app.port));
        const port = await freePort();
        const first = await startFake(cwd, port);
        const pending = await init(first.base, `${TUNNEL}/api/webhooks/samirpay?token=essai`);
        const refused = await init(first.base, `${TUNNEL}/api/webhooks/samirpay?token=essai`);
        assert.equal((await call(first.base, 'POST', '/__test/samirpay/fail', { transactionId: refused.transactionId })).status, 200);
        await first.stop();

        const stateFile = path.join(cwd, '.logs', 'fake-samirpay.json');
        assert.ok(fs.existsSync(stateFile), '.logs/fake-samirpay.json absent du dossier de travail');
        assert.ok(fs.readFileSync(stateFile, 'utf8').includes(pending.transactionId), 'la transaction doit être écrite sur le disque');

        const second = await startFake(cwd, port);
        try {
            assert.equal((await call(second.base, 'GET', `/samirpay/api/tiers/payments/${pending.transactionId}/status`)).json.status, 'PENDING');
            assert.equal((await call(second.base, 'GET', `/samirpay/api/tiers/payments/${refused.transactionId}/status`)).json.status, 'FAILED');
            assert.equal((await call(second.base, 'POST', '/__test/samirpay/complete', { transactionId: pending.transactionId })).status, 200);
            assert.equal(app.hooks.length, 1, 'webhook après redémarrage');
        } finally {
            await second.stop();
            await app.close();
        }
    });

    test('SMS du mode B : acceptés et affichés en clair dans la console du faux service', async () => {
        const app = await fakeApp();
        const fake = await startFake(workDir(appEnv(app.port)), await freePort());
        try {
            const message = `Votre code est ${randomBytes(3).toString('hex')}`;
            const r = await call(fake.base, 'POST', '/mtarget/messages', { username: DEV_FAKE_KEY, password: DEV_FAKE_KEY, msisdn: '00221770000003', sender: 'EVENTVILLAGE', msg: message });
            assert.equal(r.status, 200, JSON.stringify(r.json));
            assert.equal((r.json.results as Array<{ code: string }>)[0].code, '0');
            await new Promise((resolve) => { setTimeout(resolve, 100); });
            assert.ok(fake.output().includes(message), `texte absent de la console : ${fake.output().slice(0, 500)}`);
        } finally {
            await fake.stop();
            await app.close();
        }
    });

    test('page de / : liste les paiements avec Valider et Refuser', async () => {
        const app = await fakeApp();
        const fake = await startFake(workDir(appEnv(app.port)), await freePort());
        try {
            const tx = await init(fake.base, `${TUNNEL}/api/webhooks/samirpay?token=essai`);
            const res = await fetch(`${fake.base}/`);
            assert.equal(res.status, 200);
            assert.match(String(res.headers.get('content-type')), /text\/html/);
            const html = await res.text();
            assert.ok(html.includes(tx.transactionId), 'le paiement en attente doit figurer sur la page');
            assert.match(html, /Valider/);
            assert.match(html, /Refuser/);
        } finally {
            await fake.stop();
            await app.close();
        }
    });
});

describe('scripts/dev/essai-start.mjs (mode B)', () => {
    test('refuse si le faux service ne répond pas, avant de lancer l’application', async () => {
        assert.ok(fs.existsSync(ESSAI_START_FILE), 'scripts/dev/essai-start.mjs absent : livré par fix(8.1s)');
        const port = await freePort();
        const r = await runToExit(ESSAI_START_FILE, workDir({ NEXT_PUBLIC_APP_URL: 'http://localhost:3000' }), { EV_DEV_FAKE_PORT: String(port) });
        assert.notEqual(r.code, 0, `refus attendu : ${r.output.slice(0, 300)}`);
        assert.match(r.output, /fake:samirpay|faux service/i);
    });

    test('n’écrit aucun fichier, pose les variables du fils, ne lie pas d’hôte (contrôle statique)', () => {
        assert.ok(fs.existsSync(ESSAI_START_FILE), 'scripts/dev/essai-start.mjs absent : livré par fix(8.1s)');
        const source = fs.readFileSync(ESSAI_START_FILE, 'utf8');
        assert.doesNotMatch(source, /\bwriteFile(Sync)?\b|\bappendFile(Sync)?\b/, 'essai-start n’écrit aucun fichier');
        for (const key of ['SAMIRPAY_API_URL', 'MTARGET_API_URL', 'EV_INTEGRATIONS', 'RESEND_API_KEY', 'EV_ESSAI_SIMULATION']) {
            assert.ok(source.includes(key), `${key} doit être posée dans l’environnement du fils`);
        }
        assert.doesNotMatch(source, /['"]-H['"]|['"]--hostname['"]/, 'lancement sans -H : les redirections partiraient sur localhost derrière le tunnel');
    });
});

// ── Lot 9 ter (9t.4, consigne 0.4, contrat A.3) : adresses de retour du client, facultatives ──

describe('scripts/e2e/fake-core.mjs : adresses de retour du cashin (lot 9 ter, 0.4)', () => {
    test('contrat SamirPay : successUrl et errorUrl facultatifs, acceptés s’ils sont des URL, refusés sinon (lot 9 ter, 0.4)', async () => {
        const app = await fakeApp();
        const fake = await startFake(workDir(appEnv(app.port)), await freePort());
        try {
            const back = `${TUNNEL}/paiement/${randomUUID()}`;
            const both = await call(fake.base, 'POST', '/samirpay/api/tiers/direct/initPayment', initBody(`${TUNNEL}/api/webhooks/samirpay?token=essai`, { successUrl: back, errorUrl: back }));
            assert.equal(both.status, 201, `successUrl et errorUrl https acceptés (aujourd’hui « champ hors contrat ») : ${JSON.stringify(both.json)}`);
            assert.equal(both.json.success, true);
            assert.match(String((both.json.data as { transactionId?: unknown } | undefined)?.transactionId), /^[0-9a-f-]{36}$/, 'transaction créée');

            const without = await call(fake.base, 'POST', '/samirpay/api/tiers/direct/initPayment', initBody(`${TUNNEL}/api/webhooks/samirpay?token=essai`));
            assert.equal(without.status, 201, `les deux champs restent facultatifs : ${JSON.stringify(without.json)}`);

            const bad = await call(fake.base, 'POST', '/samirpay/api/tiers/direct/initPayment', initBody(`${TUNNEL}/api/webhooks/samirpay?token=essai`, { successUrl: 'pas une url' }));
            assert.equal(bad.status, 400, `successUrl illisible refusé : ${JSON.stringify(bad.json)}`);
            assert.equal(bad.json.errorCode, 'INVALID_REQUEST', JSON.stringify(bad.json));
            assert.match(String(bad.json.errorMessage), /successUrl : URL attendue/, `motif du refus : ${JSON.stringify(bad.json)}`);
            assert.doesNotMatch(String(bad.json.errorMessage), /champ hors contrat/, `successUrl fait partie du contrat : ${JSON.stringify(bad.json)}`);

            const badError = await call(fake.base, 'POST', '/samirpay/api/tiers/direct/initPayment', initBody(`${TUNNEL}/api/webhooks/samirpay?token=essai`, { errorUrl: 42 }));
            assert.equal(badError.status, 400, `errorUrl illisible refusé : ${JSON.stringify(badError.json)}`);
            assert.match(String(badError.json.errorMessage), /errorUrl : URL attendue/, `motif du refus : ${JSON.stringify(badError.json)}`);
        } finally {
            await fake.stop();
            await app.close();
        }
    });
});

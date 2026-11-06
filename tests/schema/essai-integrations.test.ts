/**
 * Lot 8, tâche 8.1 (contrat 5.2, 5.5, L17, L19, L28, L29) — intégrations simulées du mode d'essai.
 *
 * tests/helpers/env.ts gèle EV_INTEGRATIONS et force les faux adaptateurs : tout ce qui dépend de NODE_ENV ou
 * de EV_INTEGRATIONS passe donc par un processus fils à l'environnement EXPLICITE (rien n'est hérité du
 * processus de test, aucun fichier d'environnement n'est lu, aucune valeur n'est réelle : tout est généré ici).
 * Aucune base, aucun réseau hors de la boucle locale.
 *
 * API figée par cette suite (au-delà du contrat, pour S1) :
 *  - lib/integrations/simulation.ts : SIMULATION_HEADER, isSimulationRun(env?), simulationHeaders() ;
 *  - lib/integrations/dev-adapters.ts : DEV_ADAPTERS_SENTINEL ; chargé par `require('./dev-adapters')` depuis
 *    registry.ts, jamais par un import de tête.
 *
 * Rouge aujourd'hui : refus sans NODE_ENV, integrationsMode, adaptateurs de console, passerelle de
 * développement, lib/integrations/simulation.ts et bannière. Déjà verts, annoncés (couverture ajoutée, le refus
 * en production n'avait aucun test) : les quatre cas de getServerEnv autres que « NODE_ENV absent », le registre
 * en test sans surcharge, la priorité des surcharges, et le code OTP absent des journaux en mode réel.
 * Le garde-fou de « dev-adapters jamais chargé en réel » est son auto-contrôle : la même détection doit voir le
 * module chargé en mode simulé, sinon le test reste rouge.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomBytes, randomInt } from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';

const ROOT = process.cwd();
const RESULT_MARK = '@@RESULTAT@@';
const SIMULATION_FILE = path.join(ROOT, 'lib', 'integrations', 'simulation.ts');
const DEV_ADAPTERS_FILE = path.join(ROOT, 'lib', 'integrations', 'dev-adapters.ts');

function generated(): string {
    return randomBytes(24).toString('hex');
}

/** Environnement minimal et factice de getServerEnv ; chaque clé est générée pour ce processus de test. */
const BASE_ENV: Readonly<Record<string, string>> = {
    NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:9',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: generated(),
    SUPABASE_SERVICE_ROLE_KEY: generated(),
    NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
    SAMIRPAY_API_URL: 'http://127.0.0.1:9/samirpay',
    SAMIRPAY_API_KEY: generated(),
    SAMIRPAY_SECRET_KEY: generated(),
    MTARGET_API_URL: 'http://127.0.0.1:9/mtarget',
    MTARGET_USERNAME: 'essai-integrations',
    MTARGET_PASSWORD: generated(),
    OTP_HASH_SECRET: generated(),
    TICKET_TOTP_MASTER_KEY: generated(),
    REGISSEUR_PIN_KEY: generated(),
};

interface ChildResult {
    code: number | null;
    stdout: string;
    stderr: string;
    /** Objet imprimé par le corps du fils (dernière ligne marquée), null s'il n'a rien rendu. */
    result: Record<string, unknown> | null;
}

/** Corps exécuté dans un fils CommonJS sous tsx : `out(objet)` rend le résultat ; une erreur rend `{ thrown }`. */
function runChild(body: string, env: Record<string, string | undefined>): Promise<ChildResult> {
    const script = `
const out = (o) => console.log(${JSON.stringify(RESULT_MARK)} + JSON.stringify(o));
const root = ${JSON.stringify(ROOT.replace(/\\/g, '/'))};
(async () => {
${body}
})().catch((e) => { out({ thrown: String(e && e.message ? e.message : e) }); });
`;
    const childEnv: Record<string, string> = {};
    for (const key of ['PATH', 'Path', 'SystemRoot', 'TEMP', 'TMP']) if (process.env[key]) childEnv[key] = process.env[key] as string;
    for (const [key, value] of Object.entries({ ...BASE_ENV, ...env })) if (value !== undefined) childEnv[key] = value;
    return new Promise((resolve, reject) => {
        const child = spawn(process.execPath, ['--import', 'tsx', '-e', script], { cwd: ROOT, env: childEnv as NodeJS.ProcessEnv, stdio: ['ignore', 'pipe', 'pipe'] });
        let stdout = '';
        let stderr = '';
        const timer = setTimeout(() => child.kill('SIGKILL'), 45_000);
        child.stdout.on('data', (c) => { stdout += String(c); });
        child.stderr.on('data', (c) => { stderr += String(c); });
        child.on('error', reject);
        child.on('close', (code) => {
            clearTimeout(timer);
            const line = stdout.split(/\r?\n/).reverse().find((l) => l.startsWith(RESULT_MARK));
            resolve({ code, stdout, stderr, result: line ? JSON.parse(line.slice(RESULT_MARK.length)) as Record<string, unknown> : null });
        });
    });
}

function resultOf(r: ChildResult, what: string): Record<string, unknown> {
    assert.ok(r.result, `${what} : le processus fils n'a rien rendu (code ${r.code}).\nstderr : ${r.stderr.slice(0, 800)}`);
    return r.result;
}

function assertModuleExists(file: string, commit: string): void {
    assert.ok(fs.existsSync(file), `${path.relative(ROOT, file).replace(/\\/g, '/')} absent : module livré par ${commit}`);
}

const ENV_CHECK = `
const { getServerEnv } = require(root + '/lib/env.ts');
try { out({ mode: getServerEnv().EV_INTEGRATIONS }); }
catch (e) { out({ refused: String(e.message) }); }
`;

const ADAPTERS = ['getSmsAdapter', 'getEmailAdapter', 'getPushAdapter', 'getPaymentGateway'] as const;

const REGISTRY_CHECK = `
const r = require(root + '/lib/integrations/registry.ts');
const res = {};
try { res.mode = r.integrationsMode(); } catch (e) { res.modeError = String(e.message); }
for (const name of ${JSON.stringify(ADAPTERS)}) {
    try { res[name] = r[name]().constructor.name; } catch (e) { res[name + 'Error'] = String(e.message); }
}
out(res);
`;

describe('getServerEnv : EV_INTEGRATIONS=fake', () => {
    test('production refusée (déjà vert, le refus n’avait aucun test)', async () => {
        const r = resultOf(await runChild(ENV_CHECK, { NODE_ENV: 'production', EV_INTEGRATIONS: 'fake' }), 'fake + production');
        assert.match(String(r.refused), /EV_INTEGRATIONS=fake est interdit/, JSON.stringify(r));
    });

    test('NODE_ENV absent refusé : le défaut « development » de lib/env.ts n’autorise pas le mode simulé', async () => {
        for (const nodeEnv of [undefined, '']) {
            const r = resultOf(await runChild(ENV_CHECK, { NODE_ENV: nodeEnv, EV_INTEGRATIONS: 'fake' }), `fake + NODE_ENV ${JSON.stringify(nodeEnv)}`);
            assert.match(String(r.refused), /EV_INTEGRATIONS=fake/, `NODE_ENV ${JSON.stringify(nodeEnv)} : ${JSON.stringify(r)}`);
        }
    });

    test('development et test acceptés ; production en mode réel acceptée (déjà verts)', async () => {
        for (const [nodeEnv, mode] of [['development', 'fake'], ['test', 'fake'], ['production', 'real']] as const) {
            const r = resultOf(await runChild(ENV_CHECK, { NODE_ENV: nodeEnv, EV_INTEGRATIONS: mode }), `${mode} + ${nodeEnv}`);
            assert.deepEqual(r, { mode }, `${mode} + ${nodeEnv}`);
        }
    });
});

describe('registre des intégrations', () => {
    test('production : integrationsMode lève, aucun adaptateur n’est rendu', async () => {
        const r = resultOf(await runChild(REGISTRY_CHECK, { NODE_ENV: 'production', EV_INTEGRATIONS: 'fake' }), 'registre en production');
        assert.equal(r.mode, undefined, `integrationsMode doit lever hors development et test, valeur rendue : ${String(r.mode)}`);
        assert.match(String(r.modeError), /EV_INTEGRATIONS/, JSON.stringify(r));
        for (const name of ADAPTERS) assert.equal(r[name], undefined, `${name} rendu en production : ${String(r[name])}`);
    });

    test('NODE_ENV absent : integrationsMode lève aussi', async () => {
        const r = resultOf(await runChild(REGISTRY_CHECK, { NODE_ENV: undefined, EV_INTEGRATIONS: 'fake' }), 'registre sans NODE_ENV');
        assert.equal(r.mode, undefined, `integrationsMode doit lever sans NODE_ENV, valeur rendue : ${String(r.mode)}`);
        assert.match(String(r.modeError), /EV_INTEGRATIONS/, JSON.stringify(r));
    });

    test('test sans surcharge : lève comme aujourd’hui, jamais de repli (déjà vert)', async () => {
        const r = resultOf(await runChild(REGISTRY_CHECK, { NODE_ENV: 'test', EV_INTEGRATIONS: 'fake' }), 'registre en test');
        assert.equal(r.mode, 'fake');
        for (const [name, key] of [['getSmsAdapter', 'sms'], ['getEmailAdapter', 'email'], ['getPushAdapter', 'push'], ['getPaymentGateway', 'payment']]) {
            assert.equal(r[name], undefined, `${name} rendu en test sans surcharge`);
            assert.match(String(r[`${name}Error`]), new RegExp(`aucun faux adaptateur "${key}"`), `${name} : ${JSON.stringify(r)}`);
        }
    });

    test('les surcharges restent prioritaires en développement (déjà vert)', async () => {
        const r = resultOf(await runChild(`
const reg = require(root + '/lib/integrations/registry.ts');
const stub = { sendSms: async () => ({ success: true, recipient: 'surcharge', outcome: 'SENT' }) };
reg.setIntegrations({ sms: stub });
out({ same: reg.getSmsAdapter() === stub });
`, { NODE_ENV: 'development', EV_INTEGRATIONS: 'fake' }), 'surcharge');
        assert.deepEqual(r, { same: true });
    });

    test('development : SMS en console avec le texte complet (OTP compris), issue SENT', async () => {
        const phone = `+2217700${randomInt(10_000, 99_999)}`;
        const code = String(randomInt(100_000, 999_999));
        const text = `Event Village : votre code est ${code}`;
        const child = await runChild(`
const r = require(root + '/lib/integrations/registry.ts');
const res = await r.getSmsAdapter().sendSms(${JSON.stringify(phone)}, ${JSON.stringify(text)});
out({ res });
`, { NODE_ENV: 'development', EV_INTEGRATIONS: 'fake', EV_DEV_FAKE_SERVICES_URL: 'http://127.0.0.1:9/samirpay' });
        const r = resultOf(child, 'SMS en console');
        assert.equal(r.thrown, undefined, `adaptateur de console attendu : ${String(r.thrown)}`);
        const res = r.res as { success: boolean; outcome: string; recipient: string };
        assert.equal(res.success, true);
        assert.equal(res.outcome, 'SENT');
        const printed = child.stdout.split(/\r?\n/).filter((l) => !l.startsWith(RESULT_MARK)).join('\n');
        assert.ok(printed.includes(phone), `destinataire absent de la console : ${printed}`);
        assert.ok(printed.includes(text), `texte complet absent de la console : ${printed}`);
    });

    test('development : email (destinataire et sujet, jamais le HTML) et push acceptés', async () => {
        const marker = generated();
        const child = await runChild(`
const r = require(root + '/lib/integrations/registry.ts');
const mail = await r.getEmailAdapter().send({ to: 'essai@essai.eventvillage.invalid', subject: 'Sujet ${marker}', html: '<p>corps-html-${marker}</p>' });
const push = await r.getPushAdapter().send({ endpoint: 'http://127.0.0.1:9/push', p256dh: 'x', auth: 'y' }, { title: 't', body: 'b', url: '/', tag: 'g' }, { ttlSeconds: 60, urgency: 'normal' });
out({ mail, push });
`, { NODE_ENV: 'development', EV_INTEGRATIONS: 'fake', EV_DEV_FAKE_SERVICES_URL: 'http://127.0.0.1:9/samirpay' });
        const r = resultOf(child, 'email et push en console');
        assert.equal(r.thrown, undefined, `adaptateurs de console attendus : ${String(r.thrown)}`);
        assert.equal((r.mail as { sent: boolean }).sent, true);
        assert.equal((r.push as { outcome: string }).outcome, 'ACCEPTED');
        const printed = child.stdout.split(/\r?\n/).filter((l) => !l.startsWith(RESULT_MARK)).join('\n');
        assert.ok(printed.includes('essai@essai.eventvillage.invalid'), `destinataire absent : ${printed}`);
        assert.ok(printed.includes(`Sujet ${marker}`), `sujet absent : ${printed}`);
        assert.ok(!printed.includes(`corps-html-${marker}`), 'le HTML ne doit pas être journalisé');
    });

    test('mode réel : le code OTP n’apparaît dans aucune sortie (déjà vert)', async () => {
        const seen: string[] = [];
        const server = http.createServer((req, res) => {
            req.setEncoding('utf8');
            let body = '';
            req.on('data', (c) => { body += String(c); });
            req.on('end', () => {
                seen.push(body);
                res.writeHead(200, { 'content-type': 'application/json' });
                res.end(JSON.stringify({ results: [{ code: '0', reason: 'ACCEPTED', ticket: 'essai' }] }));
            });
        });
        await new Promise<void>((resolve) => { server.listen(0, '127.0.0.1', resolve); });
        const port = (server.address() as AddressInfo).port;
        try {
            const code = String(randomInt(100_000, 999_999));
            const child = await runChild(`
const r = require(root + '/lib/integrations/registry.ts');
const res = await r.getSmsAdapter().sendSms('+221770000001', 'Votre code est ${code}');
out({ outcome: res.outcome, name: r.getSmsAdapter().constructor.name });
`, { NODE_ENV: 'development', EV_INTEGRATIONS: 'real', MTARGET_API_URL: `http://127.0.0.1:${port}/mtarget` });
            const r = resultOf(child, 'SMS réel');
            assert.deepEqual(r, { outcome: 'SENT', name: 'MTargetHttpAdapter' });
            assert.equal(seen.length, 1, 'un seul appel au fournisseur');
            assert.ok(!`${child.stdout}${child.stderr}`.includes(code), 'le code OTP ne doit jamais être journalisé en mode réel');
        } finally {
            await new Promise((resolve) => { server.close(resolve); });
        }
    });

    test('dev-adapters : chargé seulement en mode simulé de développement, jamais en réel, jamais par un import de tête', async () => {
        assertModuleExists(DEV_ADAPTERS_FILE, 'fix(8.1s)');
        const detect = `
const r = require(root + '/lib/integrations/registry.ts');
for (const name of ${JSON.stringify(ADAPTERS)}) {
    try { r[name](); } catch (e) { console.error(name, String(e.message)); }
}
out({ loaded: Object.keys(require.cache).some((k) => /dev-adapters/.test(k)) });
`;
        const fake = resultOf(await runChild(detect, { NODE_ENV: 'development', EV_INTEGRATIONS: 'fake', EV_DEV_FAKE_SERVICES_URL: 'http://127.0.0.1:9/samirpay' }), 'détection en mode simulé');
        assert.deepEqual(fake, { loaded: true }, 'auto-contrôle : la détection doit voir le module chargé en mode simulé');
        const real = resultOf(await runChild(detect, { NODE_ENV: 'development', EV_INTEGRATIONS: 'real' }), 'détection en mode réel');
        assert.deepEqual(real, { loaded: false }, 'dev-adapters chargé en mode réel');
        const inTest = resultOf(await runChild(detect, { NODE_ENV: 'test', EV_INTEGRATIONS: 'fake' }), 'détection en test');
        assert.deepEqual(inTest, { loaded: false }, 'dev-adapters chargé en test');

        const registry = fs.readFileSync(path.join(ROOT, 'lib', 'integrations', 'registry.ts'), 'utf8');
        assert.doesNotMatch(registry, /^\s*import\b[^\n]*dev-adapters/m, 'import de tête de dev-adapters : le module entrerait dans le build de production');
        assert.match(registry, /process\.env\.NODE_ENV === 'development'[\s\S]{0,120}require\('\.\/dev-adapters'\)/, 'require dans une branche morte au build attendu (L17)');
    });

    test('sentinelle du build exportée et présente dans le module (L17, L29)', async () => {
        assertModuleExists(DEV_ADAPTERS_FILE, 'fix(8.1s)');
        const r = resultOf(await runChild(`
const m = require(root + '/lib/integrations/dev-adapters.ts');
out({ sentinel: m.DEV_ADAPTERS_SENTINEL });
`, { NODE_ENV: 'development', EV_INTEGRATIONS: 'fake', EV_DEV_FAKE_SERVICES_URL: 'http://127.0.0.1:9/samirpay' }), 'sentinelle');
        assert.deepEqual(r, { sentinel: 'EV_DEV_ADAPTERS_SENTINEL_LOT8' });
    });
});

describe('passerelle de développement', () => {
    interface Seen { url: string; apiKey: string | undefined; secretKey: string | undefined }
    const seen: Seen[] = [];
    const server = http.createServer((req, res) => {
        seen.push({ url: req.url ?? '', apiKey: req.headers['x-api-key'] as string | undefined, secretKey: req.headers['x-secret-key'] as string | undefined });
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ status: 'success', message: 'ok', data: { samirEntityName: 'Faux', solde: 1234 } }));
    });
    let port = 0;

    before(async () => {
        await new Promise<void>((resolve) => { server.listen(0, '127.0.0.1', resolve); });
        port = (server.address() as AddressInfo).port;
    });
    after(async () => {
        await new Promise((resolve) => { server.close(resolve); });
    });

    const GATEWAY = `
const r = require(root + '/lib/integrations/registry.ts');
try { out({ solde: (await r.getPaymentGateway().getSolde()).solde }); }
catch (e) { out({ refused: String(e.message) }); }
`;

    test('elle vise le faux service local et n’envoie jamais les vraies clés (L19)', async () => {
        seen.length = 0;
        const r = resultOf(await runChild(GATEWAY, { NODE_ENV: 'development', EV_INTEGRATIONS: 'fake', EV_DEV_FAKE_SERVICES_URL: `http://127.0.0.1:${port}/samirpay` }), 'passerelle de développement');
        assert.deepEqual(r, { solde: 1234 }, `passerelle vers le faux service attendue : ${JSON.stringify(r)}`);
        assert.equal(seen.length, 1, 'un seul appel au faux service');
        assert.equal(seen[0].url, '/samirpay/api/tiers/payments/solde');
        assert.equal(seen[0].apiKey, 'dev-fake');
        assert.equal(seen[0].secretKey, 'dev-fake');
        assert.notEqual(seen[0].apiKey, BASE_ENV.SAMIRPAY_API_KEY);
    });

    test('EV_DEV_FAKE_SERVICES_URL absente, distante ou piégée : refus nommé, aucun appel', async () => {
        for (const url of [undefined, '', 'https://api.samirpay.example', 'http://localhost.evil.example:4010', 'http://localhost@evil.example:4010', 'http://127.0.0.1.evil.example', 'pas-une-url']) {
            seen.length = 0;
            const r = resultOf(await runChild(GATEWAY, { NODE_ENV: 'development', EV_INTEGRATIONS: 'fake', EV_DEV_FAKE_SERVICES_URL: url }), `URL ${String(url)}`);
            assert.match(String(r.refused ?? r.thrown), /EV_DEV_FAKE_SERVICES_URL/, `URL ${JSON.stringify(url)} : ${JSON.stringify(r)}`);
            assert.equal(seen.length, 0, `URL ${JSON.stringify(url)} : aucun appel attendu`);
        }
    });
});

describe('lib/integrations/simulation.ts (L28)', () => {
    const SIMULATION_CHECK = `
const s = require(root + '/lib/integrations/simulation.ts');
out({ run: s.isSimulationRun(), headers: s.simulationHeaders(), name: s.SIMULATION_HEADER });
`;
    const MATRIX: Array<[string, Record<string, string | undefined>, boolean]> = [
        ['development + fake', { NODE_ENV: 'development', EV_INTEGRATIONS: 'fake' }, true],
        ['development + real', { NODE_ENV: 'development', EV_INTEGRATIONS: 'real' }, false],
        ['development sans EV_INTEGRATIONS', { NODE_ENV: 'development', EV_INTEGRATIONS: undefined }, false],
        ['test + fake', { NODE_ENV: 'test', EV_INTEGRATIONS: 'fake' }, false],
        ['production + fake, sans essai', { NODE_ENV: 'production', EV_INTEGRATIONS: 'fake' }, false],
        ['production normale', { NODE_ENV: 'production' }, false],
        ['mode B : EV_ESSAI_SIMULATION et URL 127.0.0.1', { NODE_ENV: 'production', EV_ESSAI_SIMULATION: '1', SAMIRPAY_API_URL: 'http://127.0.0.1:4010/samirpay' }, true],
        ['mode B : EV_ESSAI_SIMULATION et URL localhost', { NODE_ENV: 'production', EV_ESSAI_SIMULATION: '1', SAMIRPAY_API_URL: 'http://localhost:4010/samirpay' }, true],
        ['EV_ESSAI_SIMULATION avec une URL distante', { NODE_ENV: 'production', EV_ESSAI_SIMULATION: '1', SAMIRPAY_API_URL: 'https://api.samirpay.example' }, false],
        ['EV_ESSAI_SIMULATION avec un hôte piégé', { NODE_ENV: 'production', EV_ESSAI_SIMULATION: '1', SAMIRPAY_API_URL: 'http://127.0.0.1.evil.example:4010' }, false],
        ['EV_ESSAI_SIMULATION avec une URL à identifiant', { NODE_ENV: 'production', EV_ESSAI_SIMULATION: '1', SAMIRPAY_API_URL: 'http://localhost@evil.example:4010' }, false],
        ['EV_ESSAI_SIMULATION avec une URL illisible', { NODE_ENV: 'production', EV_ESSAI_SIMULATION: '1', SAMIRPAY_API_URL: 'pas-une-url' }, false],
        ['EV_ESSAI_SIMULATION sans URL', { NODE_ENV: 'production', EV_ESSAI_SIMULATION: '1', SAMIRPAY_API_URL: undefined }, false],
        ['EV_ESSAI_SIMULATION à une autre valeur', { NODE_ENV: 'production', EV_ESSAI_SIMULATION: 'true', SAMIRPAY_API_URL: 'http://127.0.0.1:4010/samirpay' }, false],
    ];

    for (const [label, env, expected] of MATRIX) {
        test(`isSimulationRun et simulationHeaders : ${label} → ${expected ? 'simulation' : 'réel'}`, async () => {
            assertModuleExists(SIMULATION_FILE, 'fix(8.1s)');
            const r = resultOf(await runChild(SIMULATION_CHECK, env), label);
            assert.equal(r.thrown, undefined, `${label} : ${String(r.thrown)}`);
            assert.equal(r.run, expected, `${label} : ${JSON.stringify(r)}`);
            assert.equal(r.name, 'x-ev-simulation');
            assert.deepEqual(r.headers, expected ? { 'x-ev-simulation': '1' } : {}, label);
        });
    }

    test('le client service_role envoie l’en-tête sur un serveur d’essai, et lui seul', async () => {
        assertModuleExists(SIMULATION_FILE, 'fix(8.1s)');
        const seen: Array<string | undefined> = [];
        const server = http.createServer((req, res) => {
            seen.push(req.headers['x-ev-simulation'] as string | undefined);
            res.writeHead(200, { 'content-type': 'application/json' });
            res.end('[]');
        });
        await new Promise<void>((resolve) => { server.listen(0, '127.0.0.1', resolve); });
        const port = (server.address() as AddressInfo).port;
        const call = `
const { getServiceRoleClient } = require(root + '/lib/supabase/server.ts');
const { error } = await getServiceRoleClient().from('cashouts').select('id').limit(1);
out({ error: error ? error.message : null });
`;
        try {
            const url = `http://127.0.0.1:${port}`;
            assert.deepEqual(resultOf(await runChild(call, { NODE_ENV: 'development', EV_INTEGRATIONS: 'fake', NEXT_PUBLIC_SUPABASE_URL: url }), 'mode A'), { error: null });
            assert.deepEqual(seen, ['1'], 'mode A : en-tête attendu');
            seen.length = 0;
            assert.deepEqual(resultOf(await runChild(call, { NODE_ENV: 'production', EV_ESSAI_SIMULATION: '1', SAMIRPAY_API_URL: 'http://127.0.0.1:4010/samirpay', NEXT_PUBLIC_SUPABASE_URL: url }), 'mode B'), { error: null });
            assert.deepEqual(seen, ['1'], 'mode B : en-tête attendu');
            seen.length = 0;
            assert.deepEqual(resultOf(await runChild(call, { NODE_ENV: 'production', NEXT_PUBLIC_SUPABASE_URL: url }), 'production'), { error: null });
            assert.deepEqual(seen, [undefined], 'production : jamais d’en-tête');
        } finally {
            await new Promise((resolve) => { server.close(resolve); });
        }
    });
});

describe('bannière de démarrage', () => {
    const BANNER = 'Intégrations simulées : aucun SMS ni paiement réel';
    const REGISTER = `
const m = require(root + '/instrumentation.ts');
await m.register();
out({ done: true });
`;

    test('une seule ligne en mode simulé, aucune en mode réel', async () => {
        const fake = await runChild(REGISTER, { NODE_ENV: 'development', EV_INTEGRATIONS: 'fake', NEXT_RUNTIME: 'nodejs', RESEND_API_KEY: 're_essai' });
        assert.deepEqual(resultOf(fake, 'mode simulé'), { done: true });
        assert.equal(`${fake.stdout}${fake.stderr}`.split(BANNER).length - 1, 1, `bannière unique attendue :\n${fake.stdout}${fake.stderr}`);
        const real = await runChild(REGISTER, { NODE_ENV: 'development', EV_INTEGRATIONS: 'real', NEXT_RUNTIME: 'nodejs', RESEND_API_KEY: 're_essai' });
        assert.deepEqual(resultOf(real, 'mode réel'), { done: true });
        assert.ok(!`${real.stdout}${real.stderr}`.includes(BANNER), 'aucune bannière en mode réel');
    });
});

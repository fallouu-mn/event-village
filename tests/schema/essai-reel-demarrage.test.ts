/**
 * Lot 9 bis, tâche I3 (contrat 4.7, 5.65, arbitrage A9, X14, B110) — démarrage en mode réel : une ligne
 * « [réel] … » dans la fenêtre du serveur, et refus de démarrer quand NEXT_PUBLIC_APP_URL n'est pas en https
 * (le callback SamirPay ne pourrait pas arriver).
 *
 * Mode réel au sens du contrat (A9) : ni serveur d'essai (isSimulationRun faux), ni EV_INTEGRATIONS=fake, et
 * SAMIRPAY_API_URL hors de la boucle locale, quel que soit NODE_ENV. Les deux cas de l'arbitrage sont testés :
 * SamirPay distant (ligne, ou refus en http) contre SamirPay en 127.0.0.1 (configuration de la CI e2e : ni ligne
 * ni refus, la CI n'est pas touchée).
 *
 * Patron REGISTER de tests/schema/essai-integrations.test.ts:383-387 : chaque cas tourne dans un processus fils
 * à l'environnement EXPLICITE (tests/helpers/env.ts gèle EV_INTEGRATIONS dans le processus de test), aucune valeur
 * n'est réelle, aucun fichier d'environnement n'est lu. Le fils remplace `fetch` et `net.Socket#connect` par un
 * refus compté : aucune requête réseau ne doit partir au démarrage.
 *
 * API figée par cette suite (contrat 4.7, 5.65, D-ree 3), pour S-I :
 *  - lib/integrations/real-mode.ts exporte REAL_BANNER et realRunStartup(env) → { banner: boolean; refusal: string | null } ;
 *  - instrumentation.ts appelle realRunStartup(process.env) après la bannière [essai], lève Error(refusal) sur un
 *    refus, sinon écrit REAL_BANNER une fois.
 *
 * Rouge aujourd'hui : lib/integrations/real-mode.ts est absent (chaque cas le nomme d'abord, même ceux dont le
 * résultat attendu est « rien » : ils sont déjà vrais sur le code actuel, le garde-fou est la présence du module),
 * register() n'écrit aucune ligne [réel] et ne refuse jamais. Suite sans base et sans écriture : aucun appel
 * d'invariants (écart signalé, comme les autres suites tests/schema sans base).
 */
import '../helpers/env';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const RESULT_MARK = '@@RESULTAT@@';
const REAL_MODE_FILE = path.join(ROOT, 'lib', 'integrations', 'real-mode.ts');

/** Textes exacts du contrat (5.65, consigne I3). */
const REAL_BANNER = '[réel] SMS, paiements et emails RÉELS : de l\'argent réel sera débité.';
const REFUSAL = '[réel] Refus de démarrer : en réel, NEXT_PUBLIC_APP_URL doit commencer par https://, sinon l\'avis de paiement de SamirPay ne peut pas arriver. Ouvrez le tunnel (docs/essai-local.md, section 9), mettez son adresse dans NEXT_PUBLIC_APP_URL et EV_DEV_TUNNEL_URL, puis relancez.';
/** Bannière du mode simulé (instrumentation.ts:12, inchangée). */
const ESSAI_BANNER = 'Intégrations simulées : aucun SMS ni paiement réel';

function generated(): string {
    return randomBytes(24).toString('hex');
}

/** Environnement minimal et factice de getServerEnv (patron essai-integrations.test.ts:41-55). */
const BASE_ENV: Readonly<Record<string, string>> = {
    NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:9',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: generated(),
    SUPABASE_SERVICE_ROLE_KEY: generated(),
    NEXT_PUBLIC_APP_URL: 'http://localhost:3000',
    SAMIRPAY_API_URL: 'http://127.0.0.1:9/samirpay',
    SAMIRPAY_API_KEY: generated(),
    SAMIRPAY_SECRET_KEY: generated(),
    MTARGET_API_URL: 'http://127.0.0.1:9/mtarget',
    MTARGET_USERNAME: 'essai-reel-demarrage',
    MTARGET_PASSWORD: generated(),
    OTP_HASH_SECRET: generated(),
    TICKET_TOTP_MASTER_KEY: generated(),
    REGISSEUR_PIN_KEY: generated(),
    NEXT_RUNTIME: 'nodejs',
    RESEND_API_KEY: 're_essai',
};

interface ChildResult {
    code: number | null;
    stdout: string;
    stderr: string;
    result: Record<string, unknown> | null;
}

/** Préambule du fils : tout accès réseau est refusé et compté (fetch et sockets). */
const NO_NETWORK = `
const netCalls = [];
const net = require('node:net');
net.Socket.prototype.connect = function (...args) {
    const a = args[0];
    netCalls.push(String(a && typeof a === 'object' ? (a.host || a.path || JSON.stringify(a)) : a));
    throw new Error('réseau interdit au démarrage (essai-reel-demarrage)');
};
globalThis.fetch = async (input) => {
    netCalls.push(String(input && input.url ? input.url : input));
    throw new Error('réseau interdit au démarrage (essai-reel-demarrage)');
};
`;

function runChild(body: string, env: Record<string, string | undefined>): Promise<ChildResult> {
    const script = `
const out = (o) => console.log(${JSON.stringify(RESULT_MARK)} + JSON.stringify(o));
const root = ${JSON.stringify(ROOT.replace(/\\/g, '/'))};
${NO_NETWORK}
(async () => {
${body}
})().catch((e) => { out({ thrown: String(e && e.message ? e.message : e), net: netCalls }); });
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

function assertRealModeModule(): void {
    assert.ok(fs.existsSync(REAL_MODE_FILE), 'lib/integrations/real-mode.ts absent : module livré par fix(9b.I3) (S-I, contrat 5.65)');
}

/** Apostrophes typographiques et espaces insécables ramenées à leur forme simple. */
function norm(s: string): string {
    return s.replace(/[  ]/g, ' ').replace(/[’‘]/g, '\'');
}

function occurrences(haystack: string, needle: string): number {
    return norm(haystack).split(norm(needle)).length - 1;
}

const REGISTER = `
const m = require(root + '/instrumentation.ts');
try { await m.register(); out({ done: true, net: netCalls }); }
catch (e) { out({ refused: String(e && e.message ? e.message : e), net: netCalls }); }
`;

const MODULE_CHECK = `
const rm = require(root + '/lib/integrations/real-mode.ts');
out({ banner: rm.REAL_BANNER, startup: rm.realRunStartup(process.env), net: netCalls });
`;

type Env = Record<string, string | undefined>;

/** SamirPay hors boucle locale (« .invalid » ne se résout jamais), EV_INTEGRATIONS absente. */
const REAL_REMOTE: Env = { EV_INTEGRATIONS: undefined, SAMIRPAY_API_URL: 'https://samirpay.invalid/api' };
const TUNNEL: Env = { NEXT_PUBLIC_APP_URL: 'https://essai.trycloudflare.com' };

/** Cas où rien ne doit se passer : ni ligne [réel], ni refus. `essai` : nombre de bannières [essai] attendu. */
const QUIET_CASES: Array<[string, Env, number]> = [
    ['configuration e2e : production, EV_INTEGRATIONS absente, SamirPay et MTarget en 127.0.0.1, http (A9, CI non touchée)',
        { NODE_ENV: 'production', EV_INTEGRATIONS: undefined }, 0],
    ['development, EV_INTEGRATIONS=real, SamirPay en 127.0.0.1, http (fils « réel » de essai-integrations, X14)',
        { NODE_ENV: 'development', EV_INTEGRATIONS: 'real' }, 0],
    ['NODE_ENV=test, faux adaptateurs, adresses locales', { NODE_ENV: 'test', EV_INTEGRATIONS: 'fake' }, 0],
    ['NODE_ENV=test, faux adaptateurs, SamirPay distant : EV_INTEGRATIONS=fake n\'est jamais le réel',
        { NODE_ENV: 'test', EV_INTEGRATIONS: 'fake', SAMIRPAY_API_URL: 'https://samirpay.invalid/api' }, 0],
    ['mode A : development + EV_INTEGRATIONS=fake, http', { NODE_ENV: 'development', EV_INTEGRATIONS: 'fake' }, 1],
    ['mode A avec une adresse SamirPay distante dans l\'environnement, http',
        { NODE_ENV: 'development', EV_INTEGRATIONS: 'fake', SAMIRPAY_API_URL: 'https://samirpay.invalid/api' }, 1],
    ['mode B : production + EV_ESSAI_SIMULATION=1, SamirPay en 127.0.0.1, http',
        { NODE_ENV: 'production', EV_INTEGRATIONS: undefined, EV_ESSAI_SIMULATION: '1', SAMIRPAY_API_URL: 'http://127.0.0.1:4010/samirpay' }, 1],
];

describe('I3 : register() en mode réel, SamirPay hors boucle locale (A9, premier cas)', () => {
    for (const nodeEnv of ['development', 'production'] as const) {
        test(`${nodeEnv}, NEXT_PUBLIC_APP_URL en https : une seule ligne [réel], aucune bannière [essai], aucun accès réseau`, async () => {
            assertRealModeModule();
            const child = await runChild(REGISTER, { NODE_ENV: nodeEnv, ...REAL_REMOTE, ...TUNNEL });
            const r = resultOf(child, `réel ${nodeEnv} en https`);
            assert.equal(r.refused, undefined, `aucun refus attendu en https : ${String(r.refused)}`);
            assert.equal(r.done, true, JSON.stringify(r));
            const printed = `${child.stdout}${child.stderr}`;
            assert.equal(occurrences(printed, REAL_BANNER), 1, `ligne [réel] exacte attendue une seule fois :\n${printed}`);
            assert.equal(occurrences(printed, ESSAI_BANNER), 0, `aucune bannière [essai] en réel :\n${printed}`);
            assert.deepEqual(r.net, [], 'aucune requête réseau au démarrage');
        });

        // Lot 9 bis, run 121 : Next 14.2 n'appelle register() qu'à la première requête et une exception levée là est seulement
        // journalisée (« Failed to prepare server ») sans arrêter next start (scripts/e2e/fake-prod.mjs, troisième lancement).
        // Le refus est donc écrit sur la sortie d'erreur et le processus sort en code 1 (écart au contrat 4.7, « throw ») :
        // ce cas exige cette sortie au lieu d'une exception. Mêmes exigences sur le texte, la valeur, la bannière et le réseau
        // (un appel réseau lèverait « réseau interdit », rattrapé et rendu par le fils : aucun résultat ne doit sortir).
        test(`${nodeEnv}, NEXT_PUBLIC_APP_URL en http : register() refuse le démarrage (refus exact sur la sortie d'erreur, code 1), sans la valeur, et aucune ligne [réel]`, async () => {
            assertRealModeModule();
            const appUrl = `http://localhost:3000/${generated().slice(0, 8)}`;
            const child = await runChild(REGISTER, { NODE_ENV: nodeEnv, ...REAL_REMOTE, NEXT_PUBLIC_APP_URL: appUrl });
            const printed = `${child.stdout}${child.stderr}`;
            assert.equal(child.result, null, `register() a rendu la main en réel avec ${appUrl} (démarrage ou exception) : arrêt du processus attendu :\n${JSON.stringify(child.result)}`);
            assert.equal(child.code, 1, `code de sortie du processus refusé :\n${printed}`);
            const errLines = norm(child.stderr).split(/\r?\n/).filter((l) => l.includes('Refus de démarrer'));
            assert.deepEqual(errLines, [norm(REFUSAL)], `texte du refus sur la sortie d'erreur, une seule fois (contrat 5.65) :\n${child.stderr}`);
            for (const word of ['NEXT_PUBLIC_APP_URL', 'https', 'tunnel']) assert.ok(errLines[0].includes(word), `le refus doit citer « ${word} »`);
            assert.ok(!printed.includes(appUrl) && !printed.includes('localhost:3000'), 'la valeur de NEXT_PUBLIC_APP_URL ne doit jamais être affichée');
            assert.equal(occurrences(printed, REAL_BANNER), 0, `aucune ligne [réel] quand le démarrage est refusé :\n${printed}`);
            assert.ok(!printed.includes('réseau interdit'), `aucune requête réseau au démarrage :\n${printed}`);
        });
    }
});

describe('I3 : rien en dehors du mode réel (A9, second cas : SamirPay en 127.0.0.1, et modes simulés)', () => {
    for (const [label, env, essai] of QUIET_CASES) {
        test(`${label} : ni ligne [réel] ni refus${essai ? ', bannière [essai] unique' : ''}`, async () => {
            assertRealModeModule();
            const child = await runChild(REGISTER, env);
            const r = resultOf(child, label);
            assert.equal(r.refused, undefined, `${label} : refus inattendu : ${String(r.refused)}`);
            assert.equal(r.done, true, JSON.stringify(r));
            const printed = `${child.stdout}${child.stderr}`;
            assert.equal(occurrences(printed, '[réel]'), 0, `${label} : aucune ligne [réel] attendue :\n${printed}`);
            assert.equal(occurrences(printed, ESSAI_BANNER), essai, `${label} : bannière [essai] attendue ${essai} fois :\n${printed}`);
            assert.deepEqual(r.net, [], 'aucune requête réseau au démarrage');
        });
    }
});

describe('I3 : lib/integrations/real-mode.ts, realRunStartup(env) (contrat 5.65)', () => {
    test('REAL_BANNER est le texte exact de la consigne', async () => {
        assertRealModeModule();
        const r = resultOf(await runChild(MODULE_CHECK, { NODE_ENV: 'development', ...REAL_REMOTE, ...TUNNEL }), 'module');
        assert.equal(r.thrown, undefined, String(r.thrown));
        assert.equal(norm(String(r.banner)), norm(REAL_BANNER));
    });

    const MATRIX: Array<[string, Env, { banner: boolean; refused: boolean }]> = [
        ['réel development en https', { NODE_ENV: 'development', ...REAL_REMOTE, ...TUNNEL }, { banner: true, refused: false }],
        ['réel production en https', { NODE_ENV: 'production', ...REAL_REMOTE, ...TUNNEL }, { banner: true, refused: false }],
        ['réel development en http', { NODE_ENV: 'development', ...REAL_REMOTE }, { banner: false, refused: true }],
        ['réel production en http', { NODE_ENV: 'production', ...REAL_REMOTE }, { banner: false, refused: true }],
        ['réel production, NEXT_PUBLIC_APP_URL illisible', { NODE_ENV: 'production', ...REAL_REMOTE, NEXT_PUBLIC_APP_URL: 'pas-une-url' }, { banner: false, refused: true }],
        ...QUIET_CASES.map(([label, env]): [string, Env, { banner: boolean; refused: boolean }] => [label, env, { banner: false, refused: false }]),
    ];

    for (const [label, env, expected] of MATRIX) {
        test(`${label} → ${expected.refused ? 'refus' : expected.banner ? 'ligne [réel]' : 'rien'}`, async () => {
            assertRealModeModule();
            const r = resultOf(await runChild(MODULE_CHECK, env), label);
            assert.equal(r.thrown, undefined, `${label} : ${String(r.thrown)}`);
            const startup = r.startup as { banner?: unknown; refusal?: unknown };
            if (expected.refused) {
                assert.equal(norm(String(startup.refusal)), norm(REFUSAL), `${label} : refus exact attendu`);
            } else {
                assert.equal(startup.refusal, null, `${label} : aucun refus attendu, obtenu ${String(startup.refusal)}`);
                assert.equal(startup.banner, expected.banner, `${label} : banner ${String(startup.banner)}`);
            }
            assert.deepEqual(r.net, [], 'aucune requête réseau');
        });
    }
});

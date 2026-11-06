/**
 * Lot 8, tâche 8.1 (contrat 5.2, 5.5, L23, L24) — garde-fous de npm run seed:dev, sans base ni réseau.
 *
 * API figée par cette suite (au-delà du contrat, pour S1) :
 *  - scripts/dev/seed-dev.core.ts exporte MAX_REAL_ACCOUNTS, countRealAccounts(users) et
 *    assertSeedAllowed({ nodeEnv, isTty, fileEnv, shellEnv, realAccounts, confirmation }), pur et sans valeur
 *    facultative (aucune garde ne se saute par omission), qui rend le projet ciblé ;
 *  - ordre des gardes de 5.2 : NODE_ENV, terminal, projet, EV_DEV_PROJECT_REF, EV_INTEGRATIONS, mot de passe,
 *    nombre de comptes, confirmation. La garde de schéma (REST) reste dans l'entrée, entre mot de passe et comptes ;
 *  - EV_INTEGRATIONS lue comme Next : le shell l'emporte sur `.env.local`.
 *
 * Écarts tranchés :
 *  - 5.2 dit « moins de MAX_REAL_ACCOUNTS », 5.5 et la consigne disent « 25 acceptés, 26 refusés » : la consigne
 *    (« refuse si plus de N ») fait foi ;
 *  - 5.2 interdit tout import de tests/, alors que l'affiche vient de fixturePosterPng
 *    (tests/helpers/fixture-poster.ts, module pur) : ce seul import est admis, le reste de tests/ est refusé.
 *
 * Rouge aujourd'hui : scripts/dev/seed-dev.core.ts et seed-dev.ts n'existent pas, chaque échec le nomme.
 */
import '../helpers/env';
import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = process.cwd();
const CORE_FILE = path.join(ROOT, 'scripts', 'dev', 'seed-dev.core.ts');
const ENTRY_FILE = path.join(ROOT, 'scripts', 'dev', 'seed-dev.ts');
// Chemin calculé : le module n'existe pas avant le correctif, et le typecheck de la CI passe avant les tests.
const CORE_PATH = '../../scripts/dev/seed-dev.core';
const SEED_DOMAIN = 'essai.eventvillage.invalid';

interface SeedInput {
    nodeEnv: string | undefined;
    isTty: boolean;
    fileEnv: Record<string, string>;
    shellEnv: Record<string, string | undefined>;
    realAccounts: number;
    confirmation: string;
}
interface Core {
    MAX_REAL_ACCOUNTS: number;
    countRealAccounts(users: Array<{ email?: string | null; user_metadata?: Record<string, unknown> | null }>): number;
    assertSeedAllowed(input: SeedInput): { ref: string; url: string };
}

async function loadCore(): Promise<Core> {
    assert.ok(fs.existsSync(CORE_FILE), 'scripts/dev/seed-dev.core.ts absent : livré par fix(8.1s)');
    return (await import(CORE_PATH)) as Core;
}

const REF = 'abcdefghijklmnopqrst';
const OTHER_REF = 'tsrqponmlkjihgfedcba';
const SERVICE_KEY = randomBytes(24).toString('hex');
const ANON_KEY = randomBytes(24).toString('hex');
// Mot de passe généré, conforme à checkPasswordStrength : minuscule, majuscule, chiffre, spécial, 14 caractères.
const SEED_SECRET = `Aa1!${randomBytes(12).toString('hex')}`;

function validInput(over: Partial<SeedInput> = {}, fileOver: Record<string, string> = {}): SeedInput {
    return {
        nodeEnv: 'development',
        isTty: true,
        shellEnv: {},
        realAccounts: 3,
        confirmation: REF,
        ...over,
        fileEnv: {
            NEXT_PUBLIC_SUPABASE_URL: `https://${REF}.supabase.co`,
            NEXT_PUBLIC_SUPABASE_ANON_KEY: ANON_KEY,
            SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY,
            EV_DEV_PROJECT_REF: REF,
            EV_INTEGRATIONS: 'fake',
            EV_DEV_SEED_PASSWORD: SEED_SECRET,
            ...over.fileEnv,
            ...fileOver,
        },
    };
}

function without(key: string): SeedInput {
    const input = validInput();
    delete input.fileEnv[key];
    return input;
}

function assertNoSecret(message: string, label: string): void {
    for (const value of [SERVICE_KEY, ANON_KEY, SEED_SECRET]) assert.ok(!message.includes(value), `${label} : un secret figure dans le message`);
}

function refusal(core: Core, input: SeedInput, label: string): string {
    let message = '';
    try {
        core.assertSeedAllowed(input);
    } catch (err) {
        message = err instanceof Error ? err.message : String(err);
    }
    assert.ok(message, `${label} : refus attendu`);
    assertNoSecret(message, label);
    return message;
}

describe('assertSeedAllowed : refus', () => {
    const CASES: Array<[string, () => SeedInput, RegExp]> = [
        ['NODE_ENV=production', () => validInput({ nodeEnv: 'production' }), /NODE_ENV/],
        ['NODE_ENV=test', () => validInput({ nodeEnv: 'test' }), /NODE_ENV/],
        ['hors terminal interactif', () => validInput({ isTty: false }), /terminal/i],
        ['URL locale', () => validInput({}, { NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321' }), /supabase\.co/],
        ['hôte piégé', () => validInput({}, { NEXT_PUBLIC_SUPABASE_URL: `https://${REF}.supabase.co.evil.example` }), /supabase\.co/],
        ['clé service absente', () => without('SUPABASE_SERVICE_ROLE_KEY'), /SUPABASE_SERVICE_ROLE_KEY/],
        ['EV_DEV_PROJECT_REF absent', () => without('EV_DEV_PROJECT_REF'), /EV_DEV_PROJECT_REF/],
        ['mauvais projet', () => validInput({}, { EV_DEV_PROJECT_REF: OTHER_REF }), /EV_DEV_PROJECT_REF/],
        ['shell divergent : NEXT_PUBLIC_SUPABASE_URL', () => validInput({ shellEnv: { NEXT_PUBLIC_SUPABASE_URL: `https://${OTHER_REF}.supabase.co` } }), /\.env\.local/],
        ['shell divergent : SUPABASE_URL', () => validInput({ shellEnv: { SUPABASE_URL: 'http://127.0.0.1:54321' } }), /\.env\.local/],
        ['EV_INTEGRATIONS absente', () => without('EV_INTEGRATIONS'), /EV_INTEGRATIONS/],
        ['EV_INTEGRATIONS=real', () => validInput({}, { EV_INTEGRATIONS: 'real' }), /EV_INTEGRATIONS/],
        ['EV_INTEGRATIONS=real dans le shell, fake dans le fichier', () => validInput({ shellEnv: { EV_INTEGRATIONS: 'real' } }), /EV_INTEGRATIONS/],
        ['mot de passe absent', () => without('EV_DEV_SEED_PASSWORD'), /EV_DEV_SEED_PASSWORD/],
        ['mot de passe faible', () => validInput({}, { EV_DEV_SEED_PASSWORD: 'courte' }), /EV_DEV_SEED_PASSWORD/],
        ['mot de passe sans caractère spécial', () => validInput({}, { EV_DEV_SEED_PASSWORD: `Aa1${'b'.repeat(20)}` }), /EV_DEV_SEED_PASSWORD/],
        ['26 comptes réels', () => validInput({ realAccounts: 26 }), /26/],
        ['confirmation fausse', () => validInput({ confirmation: OTHER_REF }), /confirmation/i],
        ['confirmation vide', () => validInput({ confirmation: '' }), /confirmation/i],
        ['confirmation en majuscules', () => validInput({ confirmation: REF.toUpperCase() }), /confirmation/i],
    ];
    for (const [label, input, message] of CASES) {
        test(`refus : ${label}`, async () => {
            assert.match(refusal(await loadCore(), input(), label), message, label);
        });
    }

    test('le mot de passe refusé n’est jamais cité', async () => {
        const weak = randomBytes(4).toString('hex');
        const message = refusal(await loadCore(), validInput({}, { EV_DEV_SEED_PASSWORD: weak }), 'mot de passe faible');
        assert.ok(!message.includes(weak), 'le mot de passe figure dans le message');
    });

    test('les gardes s’appliquent dans l’ordre du contrat', async () => {
        const core = await loadCore();
        const everythingWrong = validInput(
            { nodeEnv: 'production', isTty: false, realAccounts: 26, confirmation: 'non' },
            { NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321', EV_DEV_PROJECT_REF: OTHER_REF, EV_INTEGRATIONS: 'real', EV_DEV_SEED_PASSWORD: 'x' },
        );
        const steps: Array<[Partial<SeedInput>, Record<string, string>, RegExp]> = [
            [{}, {}, /NODE_ENV/],
            [{ nodeEnv: 'development' }, {}, /terminal/i],
            [{ nodeEnv: 'development', isTty: true }, {}, /supabase\.co/],
            [{ nodeEnv: 'development', isTty: true }, { NEXT_PUBLIC_SUPABASE_URL: `https://${REF}.supabase.co` }, /EV_DEV_PROJECT_REF/],
            [{ nodeEnv: 'development', isTty: true }, { NEXT_PUBLIC_SUPABASE_URL: `https://${REF}.supabase.co`, EV_DEV_PROJECT_REF: REF }, /EV_INTEGRATIONS/],
            [{ nodeEnv: 'development', isTty: true }, { NEXT_PUBLIC_SUPABASE_URL: `https://${REF}.supabase.co`, EV_DEV_PROJECT_REF: REF, EV_INTEGRATIONS: 'fake' }, /EV_DEV_SEED_PASSWORD/],
            [{ nodeEnv: 'development', isTty: true }, { NEXT_PUBLIC_SUPABASE_URL: `https://${REF}.supabase.co`, EV_DEV_PROJECT_REF: REF, EV_INTEGRATIONS: 'fake', EV_DEV_SEED_PASSWORD: SEED_SECRET }, /26/],
        ];
        for (const [over, fileOver, expected] of steps) {
            const input = { ...everythingWrong, ...over, fileEnv: { ...everythingWrong.fileEnv, ...fileOver } };
            assert.match(refusal(core, input, String(expected)), expected);
        }
    });
});

describe('assertSeedAllowed : accepté', () => {
    test('toutes les gardes passent, le projet ciblé est rendu', async () => {
        const core = await loadCore();
        const target = core.assertSeedAllowed(validInput());
        assert.equal(target.ref, REF);
        assert.equal(target.url, `https://${REF}.supabase.co`);
    });

    test('NODE_ENV absent accepté ; shell identique accepté', async () => {
        const core = await loadCore();
        assert.equal(core.assertSeedAllowed(validInput({ nodeEnv: undefined })).ref, REF);
        assert.equal(core.assertSeedAllowed(validInput({ shellEnv: { NEXT_PUBLIC_SUPABASE_URL: `https://${REF}.supabase.co`, EV_INTEGRATIONS: 'fake' } })).ref, REF);
    });

    test('seuil : MAX_REAL_ACCOUNTS vaut 25, 25 comptes réels acceptés, 26 refusés', async () => {
        const core = await loadCore();
        assert.equal(core.MAX_REAL_ACCOUNTS, 25);
        assert.equal(core.assertSeedAllowed(validInput({ realAccounts: 25 })).ref, REF);
        assert.equal(core.assertSeedAllowed(validInput({ realAccounts: 0 })).ref, REF);
        assert.throws(() => core.assertSeedAllowed(validInput({ realAccounts: 26 })));
    });
});

describe('countRealAccounts : les comptes du seed ne comptent pas', () => {
    test('un compte réel est sans marque et hors du domaine du seed', async () => {
        const core = await loadCore();
        assert.equal(core.countRealAccounts([]), 0);
        assert.equal(core.countRealAccounts([
            { email: 'awa@example.org', user_metadata: {} },
            { email: 'sans-metadonnees@example.org' },
            { email: null, user_metadata: null },
        ]), 3);
        assert.equal(core.countRealAccounts([
            { email: `partenaire@${SEED_DOMAIN}`, user_metadata: {} },
            { email: 'marque@example.org', user_metadata: { is_essai_fixture: true } },
            { email: `client@${SEED_DOMAIN}`, user_metadata: { is_essai_fixture: true } },
        ]), 0);
    });

    test('domaine piégé et marque fausse : compte réel', async () => {
        const core = await loadCore();
        assert.equal(core.countRealAccounts([
            { email: `x@${SEED_DOMAIN}.evil.example`, user_metadata: {} },
            { email: `x@faux${SEED_DOMAIN}`, user_metadata: {} },
            { email: 'marque-fausse@example.org', user_metadata: { is_essai_fixture: false } },
        ]), 3);
    });

    test('26 comptes réels parmi 40 : refus ; 25 parmi 40 : accepté', async () => {
        const core = await loadCore();
        const accounts = (real: number) => [
            ...Array.from({ length: real }, (_, i) => ({ email: `reel-${i}@example.org`, user_metadata: {} })),
            ...Array.from({ length: 40 - real }, (_, i) => ({ email: `seed-${i}@${SEED_DOMAIN}`, user_metadata: { is_essai_fixture: true } })),
        ];
        assert.equal(core.assertSeedAllowed(validInput({ realAccounts: core.countRealAccounts(accounts(25)) })).ref, REF);
        assert.throws(() => core.assertSeedAllowed(validInput({ realAccounts: core.countRealAccounts(accounts(26)) })));
    });
});

describe('scripts/dev/seed-dev.ts : entrée', () => {
    const WORK_DIRS: string[] = [];
    after(() => {
        for (const dir of WORK_DIRS) fs.rmSync(dir, { recursive: true, force: true });
    });

    /** Fils sous tsx, dossier de travail temporaire ; fetch remplacé : la moindre requête est signalée puis refusée. */
    function runEntry(env: Record<string, string>): Promise<{ code: number | null; output: string }> {
        assert.ok(fs.existsSync(ENTRY_FILE), 'scripts/dev/seed-dev.ts absent : livré par fix(8.1s)');
        const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'ev-seed-dev-'));
        WORK_DIRS.push(cwd);
        const lines = validInput().fileEnv;
        fs.writeFileSync(path.join(cwd, '.env.local'), Object.entries(lines).map(([k, v]) => `${k}=${v}`).join('\n'));
        const preload = path.join(cwd, 'sans-reseau.mjs');
        fs.writeFileSync(preload, "globalThis.fetch = async (u) => { console.error('RESEAU-INTERDIT ' + u); throw new Error('réseau interdit'); };\n");
        const childEnv: Record<string, string> = { TSX_TSCONFIG_PATH: path.join(ROOT, 'tsconfig.json'), ...env };
        for (const key of ['PATH', 'Path', 'SystemRoot', 'TEMP', 'TMP']) if (process.env[key]) childEnv[key] = process.env[key] as string;
        const tsx = pathToFileURL(path.join(ROOT, 'node_modules', 'tsx', 'dist', 'loader.mjs')).href;
        return new Promise((resolve, reject) => {
            const child = spawn(process.execPath, ['--import', tsx, '--import', pathToFileURL(preload).href, ENTRY_FILE], { cwd, env: childEnv as NodeJS.ProcessEnv, stdio: ['pipe', 'pipe', 'pipe'] });
            child.stdin.end();
            let output = '';
            const timer = setTimeout(() => child.kill('SIGKILL'), 30_000);
            child.stdout.on('data', (c) => { output += String(c); });
            child.stderr.on('data', (c) => { output += String(c); });
            child.on('error', reject);
            child.on('close', (code) => {
                clearTimeout(timer);
                resolve({ code, output });
            });
        });
    }

    test('hors terminal : refus avant tout appel réseau', async () => {
        const r = await runEntry({});
        assert.notEqual(r.code, 0, `refus attendu : ${r.output.slice(0, 400)}`);
        assert.match(r.output, /terminal/i, r.output.slice(0, 400));
        assert.doesNotMatch(r.output, /RESEAU-INTERDIT/, 'aucune requête ne doit partir');
        assertNoSecret(r.output, 'sortie de l’entrée');
    });

    test('NODE_ENV=production : refus avant tout appel réseau', async () => {
        const r = await runEntry({ NODE_ENV: 'production' });
        assert.notEqual(r.code, 0, `refus attendu : ${r.output.slice(0, 400)}`);
        assert.match(r.output, /NODE_ENV/, r.output.slice(0, 400));
        assert.doesNotMatch(r.output, /RESEAU-INTERDIT/, 'aucune requête ne doit partir');
    });
});

describe('contrôles statiques du seed (5.2)', () => {
    function sources(): Array<[string, string]> {
        assert.ok(fs.existsSync(CORE_FILE), 'scripts/dev/seed-dev.core.ts absent : livré par fix(8.1s)');
        assert.ok(fs.existsSync(ENTRY_FILE), 'scripts/dev/seed-dev.ts absent : livré par fix(8.1s)');
        return [[path.relative(ROOT, CORE_FILE), fs.readFileSync(CORE_FILE, 'utf8')], [path.relative(ROOT, ENTRY_FILE), fs.readFileSync(ENTRY_FILE, 'utf8')]];
    }

    test('aucune suppression : ni .delete(, ni deleteUser, ni TRUNCATE, ni upsert', () => {
        for (const [file, source] of sources()) {
            for (const banned of [/\.delete\s*\(/, /deleteUser/, /\bTRUNCATE\b/i, /\bDELETE\s+FROM\b/i, /\.upsert\s*\(/]) {
                assert.doesNotMatch(source, banned, `${file} : ${banned.source} interdit (rejouable, jamais d’effacement)`);
            }
        }
    });

    test('aucun import de tests/ sauf l’affiche pure ; jamais tests/helpers/env ; pas de TEST_PASSWORD', () => {
        for (const [file, source] of sources()) {
            const imports = Array.from(source.matchAll(/(?:from\s+|import\s*\(\s*|import\s+|require\s*\(\s*)['"`]([^'"`]+)['"`]/g), (m) => m[1]);
            const fromTests = imports.filter((i) => /(^|\/)tests\//.test(i) && !/tests\/helpers\/fixture-poster$/.test(i));
            assert.deepEqual(fromTests, [], `${file} : import de tests/ interdit`);
            assert.doesNotMatch(source, /TEST_PASSWORD/, `${file} : TEST_PASSWORD interdit sur un projet cloud`);
        }
    });

    test('l’affiche reste un module pur, sans import de l’environnement de test', () => {
        const poster = fs.readFileSync(path.join(ROOT, 'tests', 'helpers', 'fixture-poster.ts'), 'utf8');
        const imports = Array.from(poster.matchAll(/from\s+['"]([^'"]+)['"]/g), (m) => m[1]);
        assert.deepEqual(imports.filter((i) => !i.startsWith('node:')), [], 'fixture-poster ne doit dépendre que de node:');
    });

    test('réutilise resolveTargetProject et checkPasswordStrength, sans les recopier', () => {
        const core = fs.readFileSync(CORE_FILE, 'utf8');
        assert.match(core, /reset-test-password\.core/, 'import de scripts/reset-test-password.core attendu');
        assert.match(core, /\bresolveTargetProject\b/);
        assert.match(core, /\bcheckPasswordStrength\b/);
    });
});

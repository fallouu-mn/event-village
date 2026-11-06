/**
 * Lot 8, tâche 8.1 (contrat 5.2, 5.5, L22) — lecture de `.env.local` par les scripts de développement : mêmes
 * valeurs que Next, jamais une valeur dans un message.
 *
 * Tout se passe dans un processus fils, avec un dossier de travail TEMPORAIRE qui porte un `.env.local` fabriqué :
 * le fichier du dépôt n'est jamais lu, et @next/env modifie process.env (gelé dans le processus de test).
 * L'oracle de « comme Next » est @next/env lui-même, appelé dans un second fils sur le même fichier.
 *
 * API figée par cette suite (au-delà du contrat, pour S1) :
 *   loadLocalEnv({ cwd?, required? }) rend `{ fileEnv, shellEnv }` :
 *    - fileEnv : valeurs du fichier, telles que Next les lit, même si le shell définit la même clé ;
 *    - shellEnv : copie de l'environnement du shell, prise avant le chargement (resolveTargetProject la compare) ;
 *    - required : noms exigés ; une clé absente lève une erreur qui ne cite que son nom.
 *
 * Rouge aujourd'hui : scripts/dev/env-local.mjs n'existe pas, chaque échec le nomme.
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
const MODULE_FILE = path.join(ROOT, 'scripts', 'dev', 'env-local.mjs');
const MARK = '@@RESULTAT@@';
const WORK_DIRS: string[] = [];

after(() => {
    for (const dir of WORK_DIRS) fs.rmSync(dir, { recursive: true, force: true });
});

function workDir(content: string | Buffer | null): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ev-env-local-'));
    WORK_DIRS.push(dir);
    if (content !== null) fs.writeFileSync(path.join(dir, '.env.local'), content);
    return dir;
}

interface ChildResult { code: number | null; stdout: string; stderr: string; result: Record<string, unknown> | null }

function runScript(script: string, cwd: string, env: Record<string, string> = {}): Promise<ChildResult> {
    const file = path.join(cwd, 'enfant.mjs');
    fs.writeFileSync(file, script);
    const childEnv: Record<string, string> = { ...env };
    for (const key of ['PATH', 'Path', 'SystemRoot', 'TEMP', 'TMP']) if (process.env[key]) childEnv[key] = process.env[key] as string;
    return new Promise((resolve, reject) => {
        const child = spawn(process.execPath, [file], { cwd, env: childEnv as NodeJS.ProcessEnv, stdio: ['ignore', 'pipe', 'pipe'] });
        let stdout = '';
        let stderr = '';
        const timer = setTimeout(() => child.kill('SIGKILL'), 20_000);
        child.stdout.on('data', (c) => { stdout += String(c); });
        child.stderr.on('data', (c) => { stderr += String(c); });
        child.on('error', reject);
        child.on('close', (code) => {
            clearTimeout(timer);
            const line = stdout.split(/\r?\n/).reverse().find((l) => l.startsWith(MARK));
            resolve({ code, stdout, stderr, result: line ? JSON.parse(line.slice(MARK.length)) as Record<string, unknown> : null });
        });
    });
}

/** Appelle loadLocalEnv dans un fils ; une erreur revient dans `refused` (message complet). */
function load(cwd: string, opts: { required?: string[]; env?: Record<string, string> } = {}): Promise<ChildResult> {
    assert.ok(fs.existsSync(MODULE_FILE), 'scripts/dev/env-local.mjs absent : livré par fix(8.1s)');
    const script = `
import { loadLocalEnv } from ${JSON.stringify(pathToFileURL(MODULE_FILE).href)};
try {
    const r = loadLocalEnv({ cwd: process.cwd(), required: ${JSON.stringify(opts.required ?? [])} });
    console.log(${JSON.stringify(MARK)} + JSON.stringify({ fileEnv: r.fileEnv, shellEnv: r.shellEnv, processValue: process.env.ESSAI_PARTAGEE ?? null }));
} catch (err) {
    console.log(${JSON.stringify(MARK)} + JSON.stringify({ refused: String(err && err.message ? err.message : err) }));
}
`;
    return runScript(script, cwd, opts.env);
}

/** Lecture de référence : @next/env lui-même, avec les mêmes paramètres que le serveur de développement. */
async function readByNext(cwd: string): Promise<Record<string, string>> {
    const nextEnv = pathToFileURL(path.join(ROOT, 'node_modules', '@next', 'env', 'dist', 'index.js')).href;
    const script = `
import nextEnv from ${JSON.stringify(nextEnv)};
const { combinedEnv } = nextEnv.loadEnvConfig(process.cwd(), true, { info() {}, error() {} }, true);
console.log(${JSON.stringify(MARK)} + JSON.stringify(combinedEnv));
`;
    const r = await runScript(script, cwd);
    assert.ok(r.result, `référence @next/env : ${r.stderr}`);
    return r.result as Record<string, string>;
}

function fileEnvOf(r: ChildResult): Record<string, string> {
    assert.ok(r.result, `le fils n'a rien rendu (code ${r.code}) : ${r.stderr.slice(0, 500)}`);
    assert.equal(r.result.refused, undefined, `refus inattendu : ${String(r.result.refused)}`);
    return r.result.fileEnv as Record<string, string>;
}

describe('scripts/dev/env-local.mjs : mêmes valeurs que Next', () => {
    test('# et $ : valeur lue par Next, pas celle de parseEnvFile', async () => {
        const content = ['ESSAI_DIESE=abc#def', 'ESSAI_DOLLAR=pa$word', 'ESSAI_GUILLEMETS="x#y$z"', "ESSAI_APOSTROPHES='x#y$z'", 'ESSAI_SIMPLE=valeur'].join('\n');
        const cwd = workDir(content);
        const next = await readByNext(cwd);
        // Constat de la découverte, rejoué ici : si @next/env changeait, le test le dirait.
        assert.equal(next.ESSAI_DIESE, 'abc');
        assert.equal(next.ESSAI_DOLLAR, 'pa');
        assert.equal(next.ESSAI_GUILLEMETS, 'x#y');
        const env = fileEnvOf(await load(cwd));
        for (const key of ['ESSAI_DIESE', 'ESSAI_DOLLAR', 'ESSAI_GUILLEMETS', 'ESSAI_APOSTROPHES', 'ESSAI_SIMPLE']) {
            assert.equal(env[key], next[key], `${key} : valeur différente de celle de Next`);
        }
    });

    test('fichiers CRLF et avec BOM : lus comme Next', async () => {
        const crlf = workDir('ESSAI_A=un\r\nESSAI_B=deux\r\n');
        const crlfEnv = fileEnvOf(await load(crlf));
        const crlfNext = await readByNext(crlf);
        assert.equal(crlfEnv.ESSAI_A, 'un');
        assert.equal(crlfEnv.ESSAI_B, 'deux');
        assert.equal(crlfEnv.ESSAI_B, crlfNext.ESSAI_B);

        const bom = workDir(Buffer.concat([Buffer.from([0xEF, 0xBB, 0xBF]), Buffer.from('ESSAI_A=un\nESSAI_B=deux\n')]));
        assert.equal(fileEnvOf(await load(bom)).ESSAI_B, (await readByNext(bom)).ESSAI_B);
    });

    test('valeur du fichier rendue même si le shell définit la clé ; copie du shell prise avant le chargement', async () => {
        const cwd = workDir('ESSAI_PARTAGEE=du-fichier\nESSAI_SEULE=fichier\n');
        const r = await load(cwd, { env: { ESSAI_PARTAGEE: 'du-shell' } });
        const env = fileEnvOf(r);
        assert.equal(env.ESSAI_PARTAGEE, 'du-fichier', 'fileEnv doit porter la valeur du fichier');
        const shell = r.result?.shellEnv as Record<string, string | undefined>;
        assert.equal(shell.ESSAI_PARTAGEE, 'du-shell', 'shellEnv doit porter la valeur du shell');
        assert.equal(shell.ESSAI_SEULE, undefined, 'shellEnv ne contient pas les clés du fichier');
        assert.equal(r.result?.processValue, 'du-shell', 'comme Next : une variable du shell n’est jamais remplacée');
    });
});

describe('scripts/dev/env-local.mjs : refus', () => {
    test('NODE_ENV=test : refusé (Next y saute .env.local sans rien dire)', async () => {
        const value = randomBytes(12).toString('hex');
        const r = await load(workDir(`ESSAI_VALEUR=${value}\n`), { env: { NODE_ENV: 'test' } });
        assert.match(String(r.result?.refused), /NODE_ENV/, JSON.stringify(r.result));
    });

    test('NODE_ENV=development et NODE_ENV absent : acceptés', async () => {
        assert.equal(fileEnvOf(await load(workDir('ESSAI_A=un\n'), { env: { NODE_ENV: 'development' } })).ESSAI_A, 'un');
        assert.equal(fileEnvOf(await load(workDir('ESSAI_A=un\n'))).ESSAI_A, 'un');
    });

    test('fichier UTF-16 (FF FE, cas de `>` sous PowerShell 5.1) : refus clair, sans aucune valeur', async () => {
        const value = randomBytes(12).toString('hex');
        const cwd = workDir(Buffer.concat([Buffer.from([0xFF, 0xFE]), Buffer.from(`ESSAI_SECRET=${value}\r\n`, 'utf16le')]));
        const r = await load(cwd);
        const refused = String(r.result?.refused);
        assert.match(refused, /UTF-16/, JSON.stringify(r.result));
        assert.match(refused, /\.env\.local/);
        assert.ok(!`${r.stdout}${r.stderr}`.includes(value), 'une valeur figure dans la sortie');
    });

    test('clé exigée absente : seul son nom est cité, jamais une valeur', async () => {
        const value = randomBytes(12).toString('hex');
        const r = await load(workDir(`AUTRE_CLE=${value}\n`), { required: ['CRON_SECRET'] });
        const refused = String(r.result?.refused);
        assert.match(refused, /CRON_SECRET/, JSON.stringify(r.result));
        assert.ok(!`${r.stdout}${r.stderr}`.includes(value), 'une valeur figure dans la sortie');
    });

    test('clé exigée présente seulement dans le shell : acceptée, comme Next', async () => {
        const r = await load(workDir('AUTRE_CLE=x\n'), { required: ['CRON_SECRET'], env: { CRON_SECRET: randomBytes(12).toString('hex') } });
        assert.ok(r.result, r.stderr);
        assert.equal(r.result.refused, undefined, String(r.result.refused));
    });

    test('.env.local absent : refus qui nomme le fichier ou la clé', async () => {
        const r = await load(workDir(null), { required: ['CRON_SECRET'] });
        const refused = String(r.result?.refused);
        assert.match(refused, /\.env\.local|CRON_SECRET/, JSON.stringify(r.result));
    });

    test('rien n’est imprimé au chargement : ni nom de fichier chargé, ni valeur', async () => {
        const value = randomBytes(12).toString('hex');
        const r = await load(workDir(`ESSAI_SECRET=${value}\n`));
        fileEnvOf(r);
        const printed = r.stdout.split(/\r?\n/).filter((l) => l && !l.startsWith(MARK)).join('\n');
        assert.equal(printed, '', `sortie inattendue : ${printed}`);
        assert.equal(r.stderr, '', `erreur inattendue : ${r.stderr}`);
    });
});

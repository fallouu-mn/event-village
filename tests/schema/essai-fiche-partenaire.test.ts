/**
 * Lot 9 ter, tâche 9t.1 (consigne 0.1, arbitrage 6 ; contrat 5.A, A.1.4 et A.1.5 suite 5) — npm run
 * essai:fiche-partenaire, sans base. L'outil de l'essai « une partenaire en attente tente de se valider elle-même » :
 * connexion du compte partenaire@essai.eventvillage.invalid avec la clé anon seule, lecture de sa fiche, PATCH de
 * `status` à sa valeur actuelle (aucune modification même si le trou existait), relecture, déconnexion.
 * Sorties : 0 protégé (refus 403 et code 42501), 1 exposé (PATCH accepté), 2 contrôle impossible.
 *
 * Chaque cas tourne dans un processus fils, dans un dossier TEMPORAIRE qui porte un `.env.local` généré (aucune vraie
 * valeur ; le `.env.local` du dépôt n'est jamais lu), face à un faux GoTrue + PostgREST sur 127.0.0.1 (patron
 * tests/schema/essai-check-reel.test.ts). Clé anon, mot de passe et jeton sont générés à chaque cas : aucun ne doit
 * apparaître dans une sortie.
 *
 * Rouge aujourd'hui : scripts/dev/essai-fiche-partenaire.mjs et son cœur sont absents, package.json n'a pas la
 * commande (livrés par fix(9t.1) et chore(9t.1), S-RLS).
 * Suite sans base et sans écriture : aucun appel d'invariants (écart signalé, comme au 9 bis).
 */
import '../helpers/env';
import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';

const ROOT = process.cwd();
const ENTRY_FILE = path.join(ROOT, 'scripts', 'dev', 'essai-fiche-partenaire.mjs');
const CORE_FILE = path.join(ROOT, 'scripts', 'dev', 'essai-fiche-partenaire.core.mjs');
const EMAIL = 'partenaire@essai.eventvillage.invalid';

/** Textes exacts (contrat A.1.4). */
const TEXT = {
    startPrefix: '[fiche-partenaire] projet ',
    startSuffix: ` : connexion du compte ${EMAIL} avec la clé publique seulement.`,
    protectedLine: (status: string) => `[fiche-partenaire] Protégé : la fiche partenaire refuse toute modification directe de son statut (statut ${status} inchangé).`,
    exposedLine: '[fiche-partenaire] NON PROTÉGÉ : la fiche partenaire a accepté une modification directe de son statut. Arrêtez l\'essai et prévenez l\'équipe technique : la migration 20261110000001_lot9ter_rls n\'est pas appliquée sur ce projet.',
    impossible: (reason: string) => `[fiche-partenaire] contrôle impossible : ${reason}`,
    signInRefused: `connexion du compte ${EMAIL} refusée : lancez d'abord npm run seed:dev sur ce projet.`,
    httpNotLocal: 'NEXT_PUBLIC_SUPABASE_URL doit être en https, ou une adresse locale (localhost, 127.0.0.1) : refus.',
};

function secret(): string {
    return randomBytes(24).toString('hex');
}

function norm(s: string): string {
    return s.replace(/[  ]/g, ' ').replace(/[’‘]/g, '\'');
}

// ── Faux GoTrue + PostgREST ────────────────────────────────────────────────

interface Seen { method: string; url: string; apikey: string | undefined; authorization: string | undefined; prefer: string | undefined; body: string }

interface Reply { status: number; body: string }

interface Scenario {
    signIn: Reply;
    /** Statut de la fiche servi à la lecture (2) et à la relecture (4), dans l'ordre. */
    reads: string[];
    patch: Reply;
}

interface Fake { origin: string; seen: Seen[]; close(): Promise<void> }

const json = (status: number, payload: unknown): Reply => ({ status, body: JSON.stringify(payload) });

async function fakeSupabase(s: Scenario, ids: { userId: string; ficheId: string }): Promise<Fake> {
    const seen: Seen[] = [];
    let readIndex = 0;
    const server = http.createServer((req, res) => {
        let body = '';
        req.setEncoding('utf8');
        req.on('data', (c) => { body += String(c); });
        req.on('end', () => {
            const url = req.url ?? '';
            seen.push({
                method: req.method ?? '', url, apikey: req.headers.apikey as string | undefined, authorization: req.headers.authorization,
                prefer: req.headers.prefer as string | undefined, body,
            });
            const route = url.split('?')[0];
            let reply: Reply = json(404, { message: 'route inconnue du faux serveur' });
            if (req.method === 'POST' && route === '/auth/v1/token') reply = s.signIn;
            else if (req.method === 'GET' && route === '/rest/v1/partners') {
                const status = s.reads[Math.min(readIndex, s.reads.length - 1)];
                readIndex += 1;
                reply = json(200, [{ id: ids.ficheId, status }]);
            } else if (req.method === 'PATCH' && route === '/rest/v1/partners') reply = s.patch;
            else if (req.method === 'POST' && route === '/auth/v1/logout') reply = { status: 204, body: '' };
            res.writeHead(reply.status, reply.body ? { 'content-type': 'application/json' } : {});
            res.end(reply.body);
        });
    });
    await new Promise<void>((resolve) => { server.listen(0, '127.0.0.1', resolve); });
    return {
        origin: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
        seen,
        close: () => new Promise<void>((resolve) => { server.close(() => { resolve(); }); }),
    };
}

// ── Processus fils ─────────────────────────────────────────────────────────

const WORK_DIRS: string[] = [];

after(() => {
    for (const dir of WORK_DIRS) fs.rmSync(dir, { recursive: true, force: true });
});

function workDir(lines: Record<string, string>): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ev-fiche-partenaire-'));
    WORK_DIRS.push(dir);
    fs.writeFileSync(path.join(dir, '.env.local'), Object.entries(lines).map(([k, v]) => `${k}="${v}"`).join('\n'));
    return dir;
}

interface EntryResult { code: number | null; stdout: string; stderr: string; all: string }

function runEntry(cwd: string): Promise<EntryResult> {
    assert.ok(fs.existsSync(ENTRY_FILE), 'scripts/dev/essai-fiche-partenaire.mjs absent : livré par fix(9t.1) (S-RLS, contrat A.1.4)');
    const childEnv: Record<string, string> = {};
    for (const key of ['PATH', 'Path', 'SystemRoot', 'TEMP', 'TMP']) if (process.env[key]) childEnv[key] = process.env[key] as string;
    return new Promise((resolve, reject) => {
        const child = spawn(process.execPath, [ENTRY_FILE], { cwd, env: childEnv as NodeJS.ProcessEnv, stdio: ['ignore', 'pipe', 'pipe'] });
        let stdout = '';
        let stderr = '';
        const timer = setTimeout(() => child.kill('SIGKILL'), 60_000);
        child.stdout.on('data', (c) => { stdout += String(c); });
        child.stderr.on('data', (c) => { stderr += String(c); });
        child.on('error', reject);
        child.on('close', (code) => {
            clearTimeout(timer);
            resolve({ code, stdout, stderr, all: norm(`${stdout}\n${stderr}`) });
        });
    });
}

function out(run: EntryResult): string {
    return `code ${run.code}\n${run.stdout}\n${run.stderr}`;
}

function stdoutLines(run: EntryResult): string[] {
    return run.stdout.split(/\r?\n/).map((l) => norm(l.trimEnd())).filter((l) => l !== '');
}

interface Secrets { anonKey: string; password: string; token: string }

/** Aucune valeur secrète affichée, dans aucune sortie (cas 6, contrôlé à chaque lancement). */
function assertNoSecret(run: EntryResult, s: Secrets): void {
    assert.ok(!run.all.includes(s.anonKey), `la clé anon figure dans la sortie :\n${out(run)}`);
    assert.ok(!run.all.includes(s.password), `le mot de passe figure dans la sortie :\n${out(run)}`);
    assert.ok(!run.all.includes(s.token), `le jeton du compte figure dans la sortie :\n${out(run)}`);
}

/** Lancement face au faux serveur, avec des valeurs générées. */
async function check(scenario: (s: Secrets, ids: { userId: string; ficheId: string }) => Scenario): Promise<{ run: EntryResult; fake: Fake; s: Secrets; ids: { userId: string; ficheId: string } }> {
    const s: Secrets = { anonKey: secret(), password: `Essai#${secret()}`, token: `jeton-${secret()}` };
    const ids = { userId: randomUUID(), ficheId: randomUUID() };
    const fake = await fakeSupabase(scenario(s, ids), ids);
    try {
        const run = await runEntry(workDir({ NEXT_PUBLIC_SUPABASE_URL: fake.origin, NEXT_PUBLIC_SUPABASE_ANON_KEY: s.anonKey, EV_DEV_SEED_PASSWORD: s.password }));
        assertNoSecret(run, s);
        return { run, fake, s, ids };
    } finally {
        await fake.close();
    }
}

function signInOk(s: Secrets, ids: { userId: string }): Reply {
    return json(200, { access_token: s.token, token_type: 'bearer', expires_in: 3600, refresh_token: secret(), user: { id: ids.userId, email: EMAIL } });
}

const PATCH_DENIED: Reply = json(403, { code: '42501', details: null, hint: null, message: 'permission denied for table partners' });
const PATCH_ACCEPTED: Reply = { status: 204, body: '' };

function hits(fake: Fake, method: string, route: string): Seen[] {
    return fake.seen.filter((h) => h.method === method && h.url.split('?')[0] === route);
}

// ── Cas ────────────────────────────────────────────────────────────────────

describe('essai:fiche-partenaire : réponses du projet', () => {
    test('PATCH refusé 403 42501 : sortie 0, ligne Protégé exacte, statut relu inchangé', async () => {
        const { run, fake } = await check((s, ids) => ({ signIn: signInOk(s, ids), reads: ['VALIDE', 'VALIDE'], patch: PATCH_DENIED }));
        assert.equal(run.code, 0, out(run));
        const lines = stdoutLines(run);
        assert.ok(lines.some((l) => l.startsWith(TEXT.startPrefix) && l.endsWith(norm(TEXT.startSuffix))), `ligne de début attendue :\n${out(run)}`);
        assert.ok(lines.includes(norm(TEXT.protectedLine('VALIDE'))), `ligne Protégé exacte attendue :\n${out(run)}`);
        assert.ok(!run.all.includes('NON PROTÉGÉ'), 'aucune ligne NON PROTÉGÉ');
        assert.equal(hits(fake, 'PATCH', '/rest/v1/partners').length, 1, 'un seul PATCH');
        assert.equal(hits(fake, 'GET', '/rest/v1/partners').length, 2, 'lecture puis relecture de la fiche');
    });

    test('PATCH accepté 204 : sortie 1, ligne NON PROTÉGÉ exacte', async () => {
        const { run } = await check((s, ids) => ({ signIn: signInOk(s, ids), reads: ['VALIDE', 'VALIDE'], patch: PATCH_ACCEPTED }));
        assert.equal(run.code, 1, out(run));
        assert.ok(stdoutLines(run).includes(norm(TEXT.exposedLine)), `ligne NON PROTÉGÉ exacte attendue :\n${out(run)}`);
        assert.ok(!run.all.includes('Protégé :'), 'aucune ligne Protégé');
    });

    test('connexion refusée 400 invalid_grant : sortie 2, raison exacte, aucun PATCH reçu', async () => {
        const { run, fake } = await check(() => ({
            signIn: json(400, { error: 'invalid_grant', error_description: 'Invalid login credentials' }),
            reads: ['VALIDE'], patch: PATCH_ACCEPTED,
        }));
        assert.equal(run.code, 2, out(run));
        assert.ok(norm(run.stderr).includes(norm(TEXT.impossible(TEXT.signInRefused))), `raison exacte attendue sur stderr :\n${out(run)}`);
        assert.equal(hits(fake, 'PATCH', '/rest/v1/partners').length, 0, 'aucun PATCH');
    });
});

describe('essai:fiche-partenaire : refus avant tout appel réseau (sortie 2)', () => {
    for (const missing of ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'EV_DEV_SEED_PASSWORD'] as const) {
        test(`${missing} absente : sortie 2, variable nommée, aucune requête`, async () => {
            const s: Secrets = { anonKey: secret(), password: `Essai#${secret()}`, token: `jeton-${secret()}` };
            const ids = { userId: randomUUID(), ficheId: randomUUID() };
            const fake = await fakeSupabase({ signIn: signInOk(s, ids), reads: ['VALIDE'], patch: PATCH_DENIED }, ids);
            try {
                const env: Record<string, string> = { NEXT_PUBLIC_SUPABASE_URL: fake.origin, NEXT_PUBLIC_SUPABASE_ANON_KEY: s.anonKey, EV_DEV_SEED_PASSWORD: s.password };
                delete env[missing];
                const run = await runEntry(workDir(env));
                assert.equal(run.code, 2, out(run));
                assert.ok(run.all.includes(missing), `la variable ${missing} doit être nommée :\n${out(run)}`);
                assert.equal(fake.seen.length, 0, `aucune requête attendue : ${JSON.stringify(fake.seen.map((h) => `${h.method} ${h.url}`))}`);
                assertNoSecret(run, s);
            } finally {
                await fake.close();
            }
        });
    }

    test('URL http non locale : sortie 2, raison exacte', async () => {
        const s: Secrets = { anonKey: secret(), password: `Essai#${secret()}`, token: `jeton-${secret()}` };
        const run = await runEntry(workDir({ NEXT_PUBLIC_SUPABASE_URL: 'http://projet.example.invalid', NEXT_PUBLIC_SUPABASE_ANON_KEY: s.anonKey, EV_DEV_SEED_PASSWORD: s.password }));
        assert.equal(run.code, 2, out(run));
        assert.ok(norm(run.stderr).includes(norm(TEXT.impossible(TEXT.httpNotLocal))), `raison exacte attendue sur stderr :\n${out(run)}`);
        assertNoSecret(run, s);
    });
});

describe('essai:fiche-partenaire : requêtes envoyées et secrets', () => {
    test('le faux serveur reçoit apikey = clé anon, Authorization: Bearer <jeton du compte> (jamais la clé anon), et le corps exact {"status":"<statut lu>"} ; puis une déconnexion', async () => {
        const { run, fake, s, ids } = await check((sec, i) => ({ signIn: signInOk(sec, i), reads: ['EN_ATTENTE', 'EN_ATTENTE'], patch: PATCH_DENIED }));
        assert.equal(run.code, 0, out(run));
        assert.ok(stdoutLines(run).includes(norm(TEXT.protectedLine('EN_ATTENTE'))), `ligne Protégé avec le statut lu attendue :\n${out(run)}`);

        const token = hits(fake, 'POST', '/auth/v1/token');
        assert.equal(token.length, 1, 'une connexion');
        assert.match(token[0].url, /grant_type=password/, `connexion par mot de passe : ${token[0].url}`);
        assert.equal(token[0].apikey, s.anonKey, 'connexion : apikey = clé anon');
        assert.deepEqual(JSON.parse(token[0].body), { email: EMAIL, password: s.password }, 'connexion : corps { email, password } du compte de l’essai');

        const reads = hits(fake, 'GET', '/rest/v1/partners');
        assert.equal(reads.length, 2, 'lecture puis relecture');
        for (const r of reads) {
            assert.ok(r.url.includes(`user_id=eq.${ids.userId}`), `lecture de la fiche du compte connecté : ${r.url}`);
        }
        const patches = hits(fake, 'PATCH', '/rest/v1/partners');
        assert.equal(patches.length, 1, 'un PATCH');
        assert.ok(patches[0].url.includes(`id=eq.${ids.ficheId}`), `PATCH filtré sur la fiche lue : ${patches[0].url}`);
        assert.deepEqual(JSON.parse(patches[0].body), { status: 'EN_ATTENTE' }, `corps exact du PATCH : ${patches[0].body}`);

        for (const h of [...reads, ...patches]) {
            assert.equal(h.apikey, s.anonKey, `${h.method} ${h.url} : apikey = clé anon`);
            assert.equal(h.authorization, `Bearer ${s.token}`, `${h.method} ${h.url} : Authorization = Bearer <jeton du compte>`);
            assert.notEqual(h.authorization, `Bearer ${s.anonKey}`, 'jamais la clé anon comme jeton');
        }
        const logout = hits(fake, 'POST', '/auth/v1/logout');
        assert.equal(logout.length, 1, 'une déconnexion');
        assert.equal(logout[0].authorization, `Bearer ${s.token}`, 'déconnexion avec le jeton du compte');
        const lastPatch = fake.seen.indexOf(patches[0]);
        assert.ok(fake.seen.indexOf(logout[0]) > lastPatch, 'déconnexion après la tentative');
    });

    test('aucune valeur secrète affichée : ni la clé anon, ni le mot de passe, ni le jeton, sur aucun chemin', async () => {
        for (const patch of [PATCH_DENIED, PATCH_ACCEPTED, json(500, { code: 'XX000', message: 'panne simulée' })]) {
            const { run } = await check((s, ids) => ({ signIn: signInOk(s, ids), reads: ['VALIDE', 'VALIDE'], patch }));
            assert.notEqual(run.code, null, `le processus doit se terminer :\n${out(run)}`);
        }
    });
});

describe('essai:fiche-partenaire : statique', () => {
    /** Commentaires retirés : seul le code compte. */
    function code(file: string): string {
        assert.ok(fs.existsSync(file), `${path.relative(ROOT, file).replace(/\\/g, '/')} absent : livré par fix(9t.1)`);
        return fs.readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
    }

    test('package.json : "essai:fiche-partenaire": "node scripts/dev/essai-fiche-partenaire.mjs" ; aucune clé serveur ; le cœur sans réseau', () => {
        const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')) as { scripts?: Record<string, string> };
        assert.equal(pkg.scripts?.['essai:fiche-partenaire'], 'node scripts/dev/essai-fiche-partenaire.mjs');
        for (const file of [ENTRY_FILE, CORE_FILE]) {
            assert.ok(fs.existsSync(file), `${path.relative(ROOT, file).replace(/\\/g, '/')} absent : livré par fix(9t.1)`);
            assert.ok(!fs.readFileSync(file, 'utf8').includes('SUPABASE_SERVICE_ROLE_KEY'), `${path.basename(file)} cite SUPABASE_SERVICE_ROLE_KEY`);
        }
        const core = code(CORE_FILE);
        assert.doesNotMatch(core, /\bfetch\s*\(/, 'le cœur ne doit pas appeler fetch');
        assert.doesNotMatch(core, /from\s+['"](node:)?(http|https|net|tls|dns|undici)['"]|require\(\s*['"](node:)?(http|https|net|tls|dns|undici)['"]\s*\)/, 'le cœur n’importe aucun module réseau');
        assert.match(code(ENTRY_FILE), /\bfetch\s*\(/, 'l’entrée fait les appels réseau par fetch');
    });
});

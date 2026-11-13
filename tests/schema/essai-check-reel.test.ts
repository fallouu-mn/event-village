/**
 * Lot 9 bis, tâche I2 (contrat 4.7, 5.64, B109 ; textes D-ree 2) — npm run essai:check-reel, sans base.
 *
 * Le script lit `.env.local` du dossier de travail (scripts/dev/env-local.mjs), fait UN SEUL appel
 * `POST <NEXT_PUBLIC_SUPABASE_URL>/rest/v1/rpc/essai_check_reel` et sort avec 0 (rien ne partirait en réel), 1 (au
 * moins une rubrique) ou 2 (contrôle impossible : refus, variable absente, fonction absente, réponse illisible,
 * réseau). Chaque cas tourne dans un processus fils, dans un dossier TEMPORAIRE qui porte un `.env.local` généré
 * (aucune vraie valeur ; le `.env.local` du dépôt n'est jamais lu), face à un faux PostgREST sur 127.0.0.1.
 *
 * Forme de la réponse de la RPC figée par cette suite (D-ree 2 ne la fixe pas ; S-I la reprend telle quelle dans M12
 * et dans le script, tests/parcours/essai-check-reel.test.ts la vérifie en base) :
 *   { ok: true,
 *     outbox: { total, sms, email, push },
 *     payments: { total, examples: [{ id, created_at, amount }] },
 *     cashouts: { total, examples: [{ id, kind, status, amount }] },
 *     tickets: { total, events: [{ event_id, title, slug, status, start_date, count }] },
 *     seed_events_on_sale: { total, events: [{ event_id, title, slug, start_date }] } }
 * `seed_events_on_sale` informe sans changer le code de sortie (D-I2-2). Les refus sortent aussi avec 2.
 *
 * Rouge aujourd'hui : scripts/dev/essai-check-reel.mjs et son cœur sont absents, package.json n'a pas la commande.
 * Suite sans base et sans écriture : aucun appel d'invariants (écart signalé).
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
import { randomSenegalPhone } from '../parcours/helpers';

const ROOT = process.cwd();
const ENTRY_FILE = path.join(ROOT, 'scripts', 'dev', 'essai-check-reel.mjs');
const CORE_FILE = path.join(ROOT, 'scripts', 'dev', 'essai-check-reel.core.mjs');
const RPC_PATH = '/rest/v1/rpc/essai_check_reel';

/** Textes exacts (D-ree 2, repris par le contrat 4.7). */
const TEXT = {
    readOnly: 'lecture seule, aucune écriture.',
    nothing: '[check-reel] Rien ne partirait en réel : vous pouvez passer en réel (docs/essai-local.md, « Tout en réel depuis votre PC »).',
    missing: '[check-reel] contrôle impossible : fonction essai_check_reel absente. Appliquez les migrations 20261109 (docs/essai-local.md, section 3).',
    outbox: (n: number, sms: number, email: number, push: number) => `Notifications en file : ${n} (SMS ${sms}, email ${email}, push ${push}). Laissez cron:local tourner en simulé jusqu'à 0.`,
    payments: (n: number) => `Paiements simulés en attente : ${n}. Validez-les ou refusez-les sur /dev/paiements.`,
    cashouts: (n: number) => `Versements simulés en cours ou vers un compte de démonstration : ${n}. Laissez-les aboutir en simulé.`,
    tickets: (n: number, m: number) => `Billets de démonstration sur des événements à venir : ${n}, sur ${m} événement(s)`,
    ticketsEnd: 'Annulez ces événements en simulé, ou attendez leur fin.',
    points: (k: number) => `[check-reel] ${k} point(s) à traiter avant le réel : ne retirez pas EV_INTEGRATIONS=fake.`,
};

function secret(): string {
    return randomBytes(24).toString('hex');
}

function norm(s: string): string {
    return s.replace(/[  ]/g, ' ').replace(/[’‘]/g, '\'');
}

// ── Réponse de la RPC ──────────────────────────────────────────────────────

interface CheckReel {
    ok: true;
    outbox: { total: number; sms: number; email: number; push: number };
    payments: { total: number; examples: Array<Record<string, unknown>> };
    cashouts: { total: number; examples: Array<Record<string, unknown>> };
    tickets: { total: number; events: Array<Record<string, unknown>> };
    seed_events_on_sale: { total: number; events: Array<Record<string, unknown>> };
    /** Lot 9 quinquies (B1, modification signalée) : nombre de réglages du contact du support renseignés. */
    support: { filled: number };
}

function emptyReply(): CheckReel {
    return {
        ok: true,
        outbox: { total: 0, sms: 0, email: 0, push: 0 },
        payments: { total: 0, examples: [] },
        cashouts: { total: 0, examples: [] },
        tickets: { total: 0, events: [] },
        seed_events_on_sale: { total: 0, events: [] },
        support: { filled: 1 },
    };
}

/** Numéro planté dans la réponse : il ne doit jamais être affiché. */
const PLANTED_PHONE = randomSenegalPhone('77');
const TITLE_A = `Soirée d'essai ${randomUUID().slice(0, 6)}`;
const TITLE_B = `Concert d'essai ${randomUUID().slice(0, 6)}`;

const RUBRICS: Record<'outbox' | 'payments' | 'cashouts' | 'tickets', { patch: Partial<CheckReel>; expected: string[] }> = {
    outbox: {
        patch: { outbox: { total: 3, sms: 2, email: 1, push: 0 } },
        expected: [TEXT.outbox(3, 2, 1, 0)],
    },
    payments: {
        patch: { payments: { total: 2, examples: [
            { id: randomUUID(), created_at: '2026-11-10T10:00:00+00:00', amount: 5000, client_phone: PLANTED_PHONE },
            { id: randomUUID(), created_at: '2026-11-10T11:00:00+00:00', amount: 2500, client_phone: PLANTED_PHONE },
        ] } },
        expected: [TEXT.payments(2)],
    },
    cashouts: {
        patch: { cashouts: { total: 1, examples: [{ id: randomUUID(), kind: 'REFUND', status: 'A_ENVOYER', amount: 5000, beneficiary_phone: PLANTED_PHONE }] } },
        expected: [TEXT.cashouts(1)],
    },
    tickets: {
        patch: { tickets: { total: 4, events: [
            { event_id: randomUUID(), title: TITLE_A, slug: 'soiree-essai', status: 'PUBLIE', start_date: '2026-12-05', count: 3, holder_phone: PLANTED_PHONE },
            { event_id: randomUUID(), title: TITLE_B, slug: 'concert-essai', status: 'SUSPENDU', start_date: '2026-12-12', count: 1, holder_phone: PLANTED_PHONE },
        ] } },
        expected: [TEXT.tickets(4, 2), TITLE_A, TITLE_B, TEXT.ticketsEnd],
    },
};

// ── Faux PostgREST ─────────────────────────────────────────────────────────

interface Seen { method: string; url: string; apikey: string | undefined; authorization: string | undefined; body: string }

interface FakeRest { origin: string; seen: Seen[]; close(): Promise<void> }

async function fakeRest(reply: { status: number; body: string }): Promise<FakeRest> {
    const seen: Seen[] = [];
    const server = http.createServer((req, res) => {
        let body = '';
        req.setEncoding('utf8');
        req.on('data', (c) => { body += String(c); });
        req.on('end', () => {
            seen.push({ method: req.method ?? '', url: req.url ?? '', apikey: req.headers.apikey as string | undefined, authorization: req.headers.authorization, body });
            res.writeHead(reply.status, { 'content-type': 'application/json' });
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

const json = (status: number, payload: unknown) => ({ status, body: JSON.stringify(payload) });

// ── Processus fils ─────────────────────────────────────────────────────────

const WORK_DIRS: string[] = [];

after(() => {
    for (const dir of WORK_DIRS) fs.rmSync(dir, { recursive: true, force: true });
});

function workDir(lines: Record<string, string>): string {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ev-check-reel-'));
    WORK_DIRS.push(dir);
    fs.writeFileSync(path.join(dir, '.env.local'), Object.entries(lines).map(([k, v]) => `${k}=${v}`).join('\n'));
    return dir;
}

interface EntryResult { code: number | null; stdout: string; stderr: string; all: string }

function runEntry(cwd: string, env: Record<string, string> = {}): Promise<EntryResult> {
    assert.ok(fs.existsSync(ENTRY_FILE), 'scripts/dev/essai-check-reel.mjs absent : livré par fix(9b.I2) (S-I, contrat 5.64)');
    const childEnv: Record<string, string> = { ...env };
    for (const key of ['PATH', 'Path', 'SystemRoot', 'TEMP', 'TMP']) if (process.env[key]) childEnv[key] = process.env[key] as string;
    return new Promise((resolve, reject) => {
        const child = spawn(process.execPath, [ENTRY_FILE], { cwd, env: childEnv as NodeJS.ProcessEnv, stdio: ['ignore', 'pipe', 'pipe'] });
        let stdout = '';
        let stderr = '';
        const timer = setTimeout(() => child.kill('SIGKILL'), 40_000);
        child.stdout.on('data', (c) => { stdout += String(c); });
        child.stderr.on('data', (c) => { stderr += String(c); });
        child.on('error', reject);
        child.on('close', (code) => {
            clearTimeout(timer);
            resolve({ code, stdout, stderr, all: norm(`${stdout}\n${stderr}`) });
        });
    });
}

/** Lancement face au faux PostgREST : `.env.local` local, clé générée ; contrôles communs (clé et numéros jamais affichés). */
async function check(reply: { status: number; body: string }): Promise<{ run: EntryResult; rest: FakeRest; key: string }> {
    const rest = await fakeRest(reply);
    const key = secret();
    try {
        const run = await runEntry(workDir({ NEXT_PUBLIC_SUPABASE_URL: rest.origin, SUPABASE_SERVICE_ROLE_KEY: key }));
        assert.ok(!run.all.includes(key), 'la clé service_role figure dans la sortie');
        assert.ok(!run.all.includes(PLANTED_PHONE) && !run.all.includes(PLANTED_PHONE.slice(4)), 'un numéro de la réponse figure dans la sortie');
        return { run, rest, key };
    } finally {
        await rest.close();
    }
}

function assertSingleRead(rest: FakeRest, key: string): void {
    assert.equal(rest.seen.length, 1, `une seule requête attendue : ${JSON.stringify(rest.seen.map((s) => `${s.method} ${s.url}`))}`);
    const hit = rest.seen[0];
    assert.equal(hit.method, 'POST');
    assert.equal(hit.url.split('?')[0], RPC_PATH);
    assert.equal(hit.apikey, key, 'en-tête apikey : la clé service_role');
    assert.equal(hit.authorization, `Bearer ${key}`, 'en-tête Authorization : Bearer <clé service_role>');
    if (hit.body) assert.doesNotThrow(() => JSON.parse(hit.body), `corps JSON attendu : ${hit.body}`);
}

function out(run: EntryResult): string {
    return `code ${run.code}\n${run.stdout}\n${run.stderr}`;
}

// ── Cas ────────────────────────────────────────────────────────────────────

describe('essai:check-reel : réponses de la RPC', () => {
    test('réponse vide : code 0, phrase de feu vert, une seule lecture POST', async () => {
        const { run, rest, key } = await check(json(200, emptyReply()));
        assert.equal(run.code, 0, out(run));
        assert.ok(run.all.includes(norm(TEXT.nothing)), `phrase de feu vert attendue :\n${out(run)}`);
        assert.ok(run.all.includes(TEXT.readOnly), `ligne du projet « ${TEXT.readOnly} » attendue :\n${out(run)}`);
        assert.ok(!run.all.includes('point(s) à traiter'), 'aucune conclusion de points à traiter');
        assertSingleRead(rest, key);
    });

    for (const [name, rubric] of Object.entries(RUBRICS)) {
        test(`rubrique ${name} seule : code 1, rubrique citée, conclusion « 1 point(s) »`, async () => {
            const { run, rest, key } = await check(json(200, { ...emptyReply(), ...rubric.patch }));
            assert.equal(run.code, 1, out(run));
            for (const text of rubric.expected) assert.ok(run.all.includes(norm(text)), `« ${text} » attendu :\n${out(run)}`);
            assert.ok(run.all.includes(norm(TEXT.points(1))), `conclusion attendue :\n${out(run)}`);
            assert.ok(!run.all.includes(norm(TEXT.nothing)), 'pas de feu vert quand une rubrique est non vide');
            assertSingleRead(rest, key);
        });
    }

    test('les quatre rubriques : code 1, chacune citée, « 4 point(s) »', async () => {
        const all: CheckReel = { ...emptyReply(), ...RUBRICS.outbox.patch, ...RUBRICS.payments.patch, ...RUBRICS.cashouts.patch, ...RUBRICS.tickets.patch };
        const { run } = await check(json(200, all));
        assert.equal(run.code, 1, out(run));
        for (const rubric of Object.values(RUBRICS)) for (const text of rubric.expected) assert.ok(run.all.includes(norm(text)), `« ${text} » attendu :\n${out(run)}`);
        assert.ok(run.all.includes(norm(TEXT.points(4))), `conclusion attendue :\n${out(run)}`);
    });

    test('événements du seed encore en vente seuls : information sans effet sur le code (0, D-I2-2)', async () => {
        const reply: CheckReel = { ...emptyReply(), seed_events_on_sale: { total: 1, events: [{ event_id: randomUUID(), title: TITLE_A, slug: 'soiree-essai', start_date: '2026-12-05' }] } };
        const { run } = await check(json(200, reply));
        assert.equal(run.code, 0, out(run));
    });
});

describe('essai:check-reel : contrôle impossible (code 2)', () => {
    for (const [label, reply] of [
        ['404 PGRST202 (fonction absente)', json(404, { code: 'PGRST202', message: 'Could not find the function public.essai_check_reel(p) in the schema cache', details: null, hint: null })],
        ['404 sans corps lisible', { status: 404, body: '' }],
    ] as const) {
        test(`${label} : code 2 et renvoi aux migrations 20261109`, async () => {
            const { run, rest } = await check(reply);
            assert.equal(run.code, 2, out(run));
            assert.ok(run.all.includes(norm(TEXT.missing)), `message des migrations attendu :\n${out(run)}`);
            assert.equal(rest.seen.length, 1, 'une seule requête');
        });
    }

    test('500 : code 2, aucun feu vert', async () => {
        const { run } = await check(json(500, { code: 'XX000', message: 'panne simulée', details: null, hint: null }));
        assert.equal(run.code, 2, out(run));
        assert.ok(!run.all.includes(norm(TEXT.nothing)), 'aucun feu vert sur une erreur');
    });

    test('réponse illisible (200 sans JSON, ou JSON sans rubriques) : code 2', async () => {
        for (const reply of [{ status: 200, body: 'pas du json' }, json(200, { ok: true })]) {
            const { run } = await check(reply);
            assert.equal(run.code, 2, `${reply.body} :\n${out(run)}`);
            assert.ok(!run.all.includes(norm(TEXT.nothing)), 'aucun feu vert sur une réponse illisible');
        }
    });

    test('connexion refusée : code 2, clé jamais affichée', async () => {
        const rest = await fakeRest(json(200, emptyReply()));
        await rest.close();
        const key = secret();
        const run = await runEntry(workDir({ NEXT_PUBLIC_SUPABASE_URL: rest.origin, SUPABASE_SERVICE_ROLE_KEY: key }));
        assert.equal(run.code, 2, out(run));
        assert.ok(!run.all.includes(key), 'la clé figure dans la sortie');
    });
});

describe('essai:check-reel : refus avant toute requête (code 2)', () => {
    test('NODE_ENV=test : refus nommé, aucune requête', async () => {
        const rest = await fakeRest(json(200, emptyReply()));
        try {
            const run = await runEntry(workDir({ NEXT_PUBLIC_SUPABASE_URL: rest.origin, SUPABASE_SERVICE_ROLE_KEY: secret() }), { NODE_ENV: 'test' });
            assert.equal(run.code, 2, out(run));
            assert.match(run.all, /NODE_ENV/, out(run));
            assert.equal(rest.seen.length, 0, 'aucune requête');
        } finally {
            await rest.close();
        }
    });

    test('clé service_role absente : seul son nom est cité, aucune requête', async () => {
        const rest = await fakeRest(json(200, emptyReply()));
        try {
            const run = await runEntry(workDir({ NEXT_PUBLIC_SUPABASE_URL: rest.origin }));
            assert.equal(run.code, 2, out(run));
            assert.match(run.all, /SUPABASE_SERVICE_ROLE_KEY/, out(run));
            assert.equal(rest.seen.length, 0, 'aucune requête');
        } finally {
            await rest.close();
        }
    });

    test('EV_DEV_PROJECT_REF différente de la référence de NEXT_PUBLIC_SUPABASE_URL : refus nommé, sans la clé', async () => {
        const key = secret();
        const run = await runEntry(workDir({
            NEXT_PUBLIC_SUPABASE_URL: 'https://aaaaaaaaaaaaaaaaaaaa.supabase.co',
            SUPABASE_SERVICE_ROLE_KEY: key,
            EV_DEV_PROJECT_REF: 'bbbbbbbbbbbbbbbbbbbb',
        }));
        assert.equal(run.code, 2, out(run));
        assert.match(run.all, /EV_DEV_PROJECT_REF/, out(run));
        assert.ok(!run.all.includes(key), 'la clé figure dans la sortie');
    });

    test('URL ni https ni locale : refus nommé', async () => {
        const run = await runEntry(workDir({ NEXT_PUBLIC_SUPABASE_URL: 'http://projet.example.invalid', SUPABASE_SERVICE_ROLE_KEY: secret() }));
        assert.equal(run.code, 2, out(run));
        assert.match(run.all, /NEXT_PUBLIC_SUPABASE_URL/, out(run));
    });
});

describe('essai:check-reel : statique', () => {
    /** Commentaires retirés : seul le code compte. */
    function code(file: string): string {
        assert.ok(fs.existsSync(file), `${path.relative(ROOT, file).replace(/\\/g, '/')} absent : livré par fix(9b.I2)`);
        return fs.readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/.*$/gm, '$1');
    }

    test('lecture seule : aucune méthode d\'écriture, une seule adresse REST, celle de la RPC', () => {
        for (const file of [ENTRY_FILE, CORE_FILE]) {
            const src = code(file);
            const name = path.basename(file);
            assert.doesNotMatch(src, /['"`](PATCH|DELETE|PUT)['"`]/, `${name} : méthode d'écriture`);
            assert.doesNotMatch(src, /\.(insert|update|upsert|delete)\s*\(/, `${name} : écriture par client`);
            const restPaths = Array.from(src.matchAll(/\/rest\/v1\/[A-Za-z0-9_/]+/g), (m) => m[0]);
            for (const p of restPaths) assert.equal(p, RPC_PATH, `${name} : adresse REST autre que la RPC : ${p}`);
        }
        assert.ok(`${code(ENTRY_FILE)}${code(CORE_FILE)}`.includes(RPC_PATH), `${RPC_PATH} attendu dans le script`);
    });

    test('package.json : "essai:check-reel": "node scripts/dev/essai-check-reel.mjs"', () => {
        const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')) as { scripts?: Record<string, string> };
        assert.equal(pkg.scripts?.['essai:check-reel'], 'node scripts/dev/essai-check-reel.mjs');
    });
});

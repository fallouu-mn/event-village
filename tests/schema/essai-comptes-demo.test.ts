/**
 * Lot 9 bis, tâche I1 (contrat 4.7, 5.63, X13, B108) — garde des comptes de démonstration, sans base.
 *
 * Hors simulation (mode réel, production, et NODE_ENV=test), aucun SMS, email ni push ne part vers un compte de
 * seed:dev. Cette suite prouve, sans base :
 *  - demoGuardActive() : faux en mode A et en mode B, vrai en réel, en production et sous NODE_ENV=test ;
 *  - les envois synchrones (sendOtp, sendControllerInvite) dans un processus fils en mode réel, Supabase (PostgREST)
 *    et MTarget simulés par un serveur HTTP local sur 127.0.0.1 :
 *      RPC notification_demo_recipients → blocked: ['sync'] : aucune requête au faux MTarget, aucune réservation de
 *      quota, résultat SMS_DEMO_ACCOUNT, journal notification_sync_log SKIPPED DEMO_ACCOUNT ;
 *      blocked: [] : un seul SMS ; RPC en 500 : aucun SMS, SMS_GUARD_UNAVAILABLE (échec fermé) ;
 *      mode A : la RPC n'est jamais appelée, le SMS s'écrit en console ;
 *  - classifySmsResult : SMS_DEMO_ACCOUNT → GUARD_REFUSED, motif DEMO_ACCOUNT ;
 *  - statique : le domaine du seed est le même dans scripts/dev/seed-dev.core.ts et dans M12 ; libellés de supervision
 *    DEMO_ACCOUNT et DEMO_GUARD_UNAVAILABLE exacts (section 11).
 *
 * Patron runChild de tests/schema/essai-integrations.test.ts:65-91 (environnement explicite, aucune valeur réelle,
 * aucun fichier d'environnement lu, aucun réseau hors de la boucle locale).
 *
 * Forme de la RPC figée par cette suite (D-ree 1, contrat 4.7) : `notification_demo_recipients(p jsonb)` reçoit
 * `{ items: [{ key, user_id?, phone?, email?, event_id? }] }` et rend `{ ok: true, blocked: [key…] }`. Le faux
 * PostgREST rend comme bloquées toutes les clés reçues : le nom de la clé ('sync' chez D-ree) reste libre.
 *
 * Rouge aujourd'hui : lib/notifications/demo-guard.ts et M12 absents ; sendOtp n'appelle aucune garde (le SMS part
 * au faux MTarget) ; SMS_DEMO_ACCOUNT inconnu de classifySmsResult ; libellés absents. Les cas « mode A » et
 * « blocked: [] » envoient déjà un SMS aujourd'hui : leur garde-fou est l'appel exact de la RPC (ou son absence) et la
 * présence du module. Suite sans base et sans écriture : aucun appel d'invariants (écart signalé).
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import path from 'node:path';
import { OUTBOX_REASON_LABELS } from '../../lib/notifications/outbox-labels';
import type { MTargetSendResult } from '../../lib/sms/mtarget.service';
import { randomSenegalPhone } from '../parcours/helpers';

const ROOT = process.cwd();
const RESULT_MARK = '@@RESULTAT@@';
const DEMO_GUARD_FILE = path.join(ROOT, 'lib', 'notifications', 'demo-guard.ts');
const SEED_CORE_FILE = path.join(ROOT, 'scripts', 'dev', 'seed-dev.core.ts');
const M12_FILE = path.join(ROOT, 'supabase', 'migrations', '20261109000012_lot9bis_mode_reel.sql');
const DEMO_RPC = 'notification_demo_recipients';

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
    MTARGET_USERNAME: 'essai-comptes-demo',
    MTARGET_PASSWORD: generated(),
    OTP_HASH_SECRET: generated(),
    TICKET_TOTP_MASTER_KEY: generated(),
    REGISSEUR_PIN_KEY: generated(),
};

interface ChildResult {
    code: number | null;
    stdout: string;
    stderr: string;
    result: Record<string, unknown> | null;
}

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

function assertDemoGuardModule(): void {
    assert.ok(fs.existsSync(DEMO_GUARD_FILE), 'lib/notifications/demo-guard.ts absent : module livré par fix(9b.I1) (S-I, contrat 5.63)');
}

function norm(s: string): string {
    return s.replace(/[  ]/g, ' ').replace(/[’‘]/g, '\'');
}

// ── 1. demoGuardActive ────────────────────────────────────────────────────

describe('I1 : demoGuardActive() selon le mode (actif hors simulation, D-I1-4)', () => {
    const CHECK = `
const g = require(root + '/lib/notifications/demo-guard.ts');
out({ active: g.demoGuardActive() });
`;
    const MATRIX: Array<[string, Record<string, string | undefined>, boolean]> = [
        ['mode A : development + EV_INTEGRATIONS=fake', { NODE_ENV: 'development', EV_INTEGRATIONS: 'fake' }, false],
        ['mode B : production + EV_ESSAI_SIMULATION=1, SamirPay en 127.0.0.1', { NODE_ENV: 'production', EV_ESSAI_SIMULATION: '1', SAMIRPAY_API_URL: 'http://127.0.0.1:4010/samirpay' }, false],
        ['réel : development sans EV_INTEGRATIONS', { NODE_ENV: 'development', EV_INTEGRATIONS: undefined }, true],
        ['réel : development + EV_INTEGRATIONS=real', { NODE_ENV: 'development', EV_INTEGRATIONS: 'real' }, true],
        ['production', { NODE_ENV: 'production' }, true],
        ['NODE_ENV=test (suites avec base)', { NODE_ENV: 'test', EV_INTEGRATIONS: 'fake' }, true],
    ];
    for (const [label, env, expected] of MATRIX) {
        test(`${label} → ${expected ? 'active' : 'inactive'}`, async () => {
            assertDemoGuardModule();
            const r = resultOf(await runChild(CHECK, env), label);
            assert.equal(r.thrown, undefined, `${label} : ${String(r.thrown)}`);
            assert.equal(r.active, expected, `${label} : ${JSON.stringify(r)}`);
        });
    }
});

// ── 2. Envois synchrones, Supabase et MTarget simulés ─────────────────────

type DemoMode = 'block' | 'none' | 'fail';

interface Hit { path: string; body: Record<string, unknown> | null }

/** Faux PostgREST (rpc) et faux MTarget sur un seul serveur local ; la réponse de la RPC de garde est réglée par cas. */
const hits: Hit[] = [];
let demoMode: DemoMode = 'block';
const server = http.createServer((req, res) => {
    let raw = '';
    req.setEncoding('utf8');
    req.on('data', (c) => { raw += String(c); });
    req.on('end', () => {
        let body: Record<string, unknown> | null = null;
        if (raw) {
            try {
                body = JSON.parse(raw) as Record<string, unknown>;
            } catch (err) {
                // Corps non JSON (MTarget peut poster un formulaire) : gardé tel quel pour le diagnostic.
                body = { raw, parseError: err instanceof Error ? err.message : String(err) };
            }
        }
        const url = (req.url ?? '').split('?')[0];
        hits.push({ path: url, body });
        const send = (status: number, payload: unknown) => {
            res.writeHead(status, { 'content-type': 'application/json' });
            res.end(JSON.stringify(payload));
        };
        if (url === `/rest/v1/rpc/${DEMO_RPC}`) {
            if (demoMode === 'fail') return send(500, { code: 'XX000', message: 'panne simulée de la garde', details: null, hint: null });
            const p = (body?.p ?? {}) as { items?: Array<{ key?: unknown }> };
            const keys = demoMode === 'block' ? (p.items ?? []).map((i) => String(i.key)) : [];
            return send(200, { ok: true, blocked: keys });
        }
        if (url === '/rest/v1/rpc/quota_reserve') return send(200, { allowed: true });
        if (url === '/rest/v1/rpc/notification_sync_log') return send(200, { ok: true, id: randomUUID() });
        if (url.startsWith('/mtarget')) return send(200, { results: [{ code: '0', reason: 'ACCEPTED', ticket: `essai-${randomUUID()}` }] });
        return send(404, { code: 'PGRST202', message: `route inconnue du faux service : ${url}`, details: null, hint: null });
    });
});
let origin = '';

before(async () => {
    await new Promise<void>((resolve) => { server.listen(0, '127.0.0.1', resolve); });
    origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
after(async () => {
    await new Promise((resolve) => { server.close(resolve); });
});

function realEnv(): Record<string, string | undefined> {
    return { NODE_ENV: 'development', EV_INTEGRATIONS: 'real', NEXT_PUBLIC_SUPABASE_URL: origin, MTARGET_API_URL: `${origin}/mtarget` };
}

const ofPath = (p: string): Hit[] => hits.filter((h) => h.path === p);
const smsHits = (): Hit[] => hits.filter((h) => h.path.startsWith('/mtarget'));

function otpCall(phone: string, userId: string): string {
    const code = String(100_000 + (randomBytes(3).readUIntBE(0, 3) % 900_000));
    return `
const { mTargetService } = require(root + '/lib/sms/mtarget.service.ts');
const res = await mTargetService.sendOtp(${JSON.stringify(phone)}, ${JSON.stringify(code)}, { purpose: 'LOGIN', log: { type: 'OTP_LOGIN', ref: ${JSON.stringify(randomUUID())}, userId: ${JSON.stringify(userId)} } });
out({ res });
`;
}

interface SyncRes { success?: boolean; code?: string; outcome?: string }

function demoItems(): Array<Record<string, unknown>> {
    const call = ofPath(`/rest/v1/rpc/${DEMO_RPC}`);
    assert.equal(call.length, 1, `RPC ${DEMO_RPC} : un seul appel attendu avant l'envoi synchrone, ${call.length} reçu(s) — garde absente de sendOtp (fix(9b.I1), lib/sms/mtarget.service.ts)`);
    const p = (call[0].body?.p ?? null) as { items?: Array<Record<string, unknown>> } | null;
    assert.ok(p && Array.isArray(p.items), `RPC ${DEMO_RPC} : corps { p: { items: [...] } } attendu, reçu ${JSON.stringify(call[0].body)}`);
    return p.items;
}

describe('I1 : envois synchrones en mode réel (sendOtp, sendControllerInvite)', () => {
    test('compte de démonstration (RPC : bloqué) : aucun SMS, aucune réservation de quota, SMS_DEMO_ACCOUNT, journal SKIPPED DEMO_ACCOUNT', async () => {
        hits.length = 0;
        demoMode = 'block';
        const phone = randomSenegalPhone('77');
        const userId = randomUUID();
        const r = resultOf(await runChild(otpCall(phone, userId), realEnv()), 'sendOtp bloqué');
        assert.equal(r.thrown, undefined, String(r.thrown));
        const items = demoItems();
        assert.equal(items.length, 1, `un seul élément interrogé : ${JSON.stringify(items)}`);
        assert.ok(String(items[0].phone ?? '').replace(/\D/g, '').endsWith(phone.slice(-9)), `numéro du destinataire transmis à la garde : ${JSON.stringify(items[0])}`);
        assert.equal(items[0].user_id, userId, 'compte du journal transmis à la garde');
        assert.equal(smsHits().length, 0, 'aucune requête au faux MTarget pour un compte de démonstration');
        assert.equal(ofPath('/rest/v1/rpc/quota_reserve').length, 0, 'aucune réservation de quota pour un SMS retenu');
        const res = r.res as SyncRes;
        assert.equal(res.success, false);
        assert.equal(res.code, 'SMS_DEMO_ACCOUNT', `code du refus (contrat 4.7) : ${JSON.stringify(res)}`);
        const logs = ofPath('/rest/v1/rpc/notification_sync_log');
        assert.equal(logs.length, 1, 'une ligne de journal synchrone');
        const p = (logs[0].body?.p ?? {}) as Record<string, unknown>;
        assert.equal(p.outcome, 'SKIPPED', `journal : ${JSON.stringify(p)}`);
        assert.equal(p.reason, 'DEMO_ACCOUNT', `journal : ${JSON.stringify(p)}`);
    });

    test('destinataire ordinaire (RPC : rien de bloqué) : la garde est consultée, puis un seul SMS part', async () => {
        hits.length = 0;
        demoMode = 'none';
        const phone = randomSenegalPhone('77');
        const r = resultOf(await runChild(otpCall(phone, randomUUID()), realEnv()), 'sendOtp ordinaire');
        assert.equal(r.thrown, undefined, String(r.thrown));
        assert.equal(demoItems().length, 1);
        assert.equal(smsHits().length, 1, 'un seul SMS au faux MTarget');
        const res = r.res as SyncRes;
        assert.equal(res.success, true, JSON.stringify(res));
        assert.equal(res.outcome, 'SENT');
    });

    test('garde indisponible (RPC en 500) : échec fermé, aucun SMS, SMS_GUARD_UNAVAILABLE', async () => {
        hits.length = 0;
        demoMode = 'fail';
        const r = resultOf(await runChild(otpCall(randomSenegalPhone('77'), randomUUID()), realEnv()), 'sendOtp garde en panne');
        assert.equal(r.thrown, undefined, String(r.thrown));
        assert.ok(ofPath(`/rest/v1/rpc/${DEMO_RPC}`).length >= 1, `RPC ${DEMO_RPC} jamais appelée : garde absente de sendOtp`);
        assert.equal(smsHits().length, 0, 'aucun SMS envoyé à l\'aveugle quand la garde est indisponible');
        const res = r.res as SyncRes;
        assert.equal(res.success, false);
        assert.equal(res.code, 'SMS_GUARD_UNAVAILABLE', JSON.stringify(res));
    });

    test('invitation de contrôleur vers un compte de démonstration : aucun SMS, SMS_DEMO_ACCOUNT', async () => {
        hits.length = 0;
        demoMode = 'block';
        const phone = randomSenegalPhone('77');
        const r = resultOf(await runChild(`
const { mTargetService } = require(root + '/lib/sms/mtarget.service.ts');
const res = await mTargetService.sendControllerInvite(${JSON.stringify(phone)}, '482913', 'http://localhost:3000/controller/setup', 'Awa', { log: { type: 'CONTROLLER_INVITE', ref: ${JSON.stringify(randomUUID())} } });
out({ res });
`, realEnv()), 'sendControllerInvite bloqué');
        assert.equal(r.thrown, undefined, String(r.thrown));
        assert.equal(demoItems().length, 1);
        assert.equal(smsHits().length, 0, 'aucune invitation envoyée à un compte de démonstration');
        assert.equal((r.res as SyncRes).code, 'SMS_DEMO_ACCOUNT', JSON.stringify(r.res));
    });

    test('mode A (development + EV_INTEGRATIONS=fake) : la RPC de garde n\'est jamais appelée, le SMS s\'écrit en console', async () => {
        assertDemoGuardModule();
        hits.length = 0;
        demoMode = 'block';
        const phone = randomSenegalPhone('77');
        const child = await runChild(otpCall(phone, randomUUID()), {
            NODE_ENV: 'development', EV_INTEGRATIONS: 'fake', NEXT_PUBLIC_SUPABASE_URL: origin, EV_DEV_FAKE_SERVICES_URL: 'http://127.0.0.1:9/samirpay',
        });
        const r = resultOf(child, 'sendOtp en mode A');
        assert.equal(r.thrown, undefined, String(r.thrown));
        assert.equal(ofPath(`/rest/v1/rpc/${DEMO_RPC}`).length, 0, 'mode simulé : garde inactive, aucune RPC');
        assert.equal((r.res as SyncRes).outcome, 'SENT', JSON.stringify(r.res));
        const printed = child.stdout.split(/\r?\n/).filter((l) => !l.startsWith(RESULT_MARK)).join('\n');
        assert.ok(printed.includes(phone), `SMS simulé attendu en console pour ${phone} : ${printed}`);
    });

    test('classifySmsResult : SMS_DEMO_ACCOUNT → GUARD_REFUSED, motif DEMO_ACCOUNT (rien n\'est parti)', async () => {
        const { classifySmsResult } = await import('../../lib/sms/mtarget.service');
        const refused = { success: false, outcome: 'REJECTED', retryable: false, recipient: '00221770000000', code: 'SMS_DEMO_ACCOUNT', error: 'Compte de démonstration : aucun SMS hors simulation.' } as unknown as MTargetSendResult;
        assert.deepEqual(
            { kind: classifySmsResult(refused).kind, reason: classifySmsResult(refused).reason },
            { kind: 'GUARD_REFUSED', reason: 'DEMO_ACCOUNT' },
        );
    });
});

// ── 3. Statique ────────────────────────────────────────────────────────────

describe('I1 : statique', () => {
    test('domaine du seed identique dans scripts/dev/seed-dev.core.ts et dans la reprise de M12', () => {
        const seed = fs.readFileSync(SEED_CORE_FILE, 'utf8');
        const declared = /const SEED_DOMAIN = '([^']+)'/.exec(seed);
        assert.ok(declared, 'SEED_DOMAIN introuvable dans scripts/dev/seed-dev.core.ts');
        assert.ok(fs.existsSync(M12_FILE), 'supabase/migrations/20261109000012_lot9bis_mode_reel.sql absente (M12, S-I)');
        const sql = fs.readFileSync(M12_FILE, 'utf8');
        const domains = Array.from(sql.matchAll(/@([a-z0-9.-]+\.invalid)\b/gi), (m) => m[1].toLowerCase());
        assert.ok(domains.length > 0, 'M12 : aucun domaine « @….invalid » dans la reprise des comptes du seed');
        const distinct = Array.from(new Set(domains));
        assert.deepEqual(distinct, [declared[1]], `M12 : domaine(s) ${JSON.stringify(distinct)}, seed : ${declared[1]}`);
        assert.match(sql, /is_essai_fixture/, 'M12 : la reprise lit aussi la marque is_essai_fixture du seed');
    });

    test('libellés de supervision exacts (section 11) : DEMO_ACCOUNT et DEMO_GUARD_UNAVAILABLE', () => {
        assert.equal(norm(OUTBOX_REASON_LABELS.DEMO_ACCOUNT ?? '(absent)'), 'Non envoyé : compte de démonstration');
        assert.equal(norm(OUTBOX_REASON_LABELS.DEMO_GUARD_UNAVAILABLE ?? '(absent)'), 'Contrôle des comptes de démonstration indisponible');
    });
});

/**
 * Lot 4, tâche 4.8 — limiteurs : `reserveQuota` partout (toutes les tentatives comptées, en base,
 * refus si la garde ne répond pas), `lib/security/rate-limiter.ts` supprimé, anti-abus SMS complété.
 *
 * Rouge avant correctif :
 *  - scan : RateLimiter.checkAndRecord ne compte qu'en mémoire de l'instance, jamais en base
 *    (lib/security/rate-limiter.ts:96-149 ; app/api/controller/scan/route.ts:42-48, 5/s, failClosed false) ;
 *  - encaissement (PUT scan) et live-code : aucun limiteur (scan/route.ts:423-445,
 *    app/api/tickets/[id]/live-code/route.ts:13-81) ;
 *  - resolve-phone, verify-otp, controller/setup, partner/register : RateLimiter qui ne compte que les
 *    échecs, par numéro ou par `x-forwarded-for` brut, sans refus si la base ne répond pas
 *    (resolve-phone/route.ts:28-61, verify-otp/route.ts:35-60, controller/setup/route.ts:42-150,
 *    partner/register/route.ts:25-218) ;
 *  - invitation : 20/h et 3/jour par numéro, contrôle et enregistrement séparés
 *    (partner/team/invite/route.ts:90-120, :410-415) ; PIN régisseur : RateLimiter
 *    (lib/shifts/shift.service.ts:127-173) ;
 *  - SMS : aucune limite par compte déclencheur, plafond global commun à l'OTP, compteur par
 *    destinataire commun à l'OTP et aux notifications (lib/sms/sms-guard.ts:47-66).
 *
 * Points de contrat fixés ici (le contrat est muet) :
 *  - dépassement → HTTP 429 (scan : corps `{ result: 'rate_limited' }`) ; garde indisponible → HTTP 503 ;
 *  - le quota est réservé avant toute validation métier : une tentative invalide compte aussi
 *    (corps refusé, code faux, pièces introuvables) ;
 *  - compteur du scan : ligne de quota_counters dont le scope contient « scan », le bucket contient
 *    l'identifiant du scanneur et la fenêtre vaut 10 s ;
 *  - compteurs SMS globaux : bucket 'all' et scope commençant par « sms » (comme sms_global au lot 1C) ;
 *    les envois non OTP s'arrêtent à floor(plafond × (100 − part OTP) / 100) ;
 *  - IP cliente : première valeur de x-forwarded-for ; les tests utilisent des /64 IPv6 aléatoires
 *    (aucun compteur partagé d'une exécution à l'autre).
 * Chaque test règle ses propres petites limites dans ce processus (variables d'environnement).
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { Client } from 'pg';
import type { NextRequest } from 'next/server';
import { resetServerEnvCache } from '../../lib/env';
import { assertAccessInvariants } from '../helpers/access-invariants';
import { getFakes } from '../fakes';
import { jsonRequest, randomEmail, randomSenegalPhone, STRONG_PASSWORD } from './helpers';
import { importModule, newBuyer, service, type Buyer, type SaleEvent } from './paiement-helpers';
import { newPartner, type TestPartner } from './finance-helpers';
import { authed, createCashOrderTickets, createTimedEvent, liveCode, newController, scan, type RouteResult } from './acces-helpers';

// ── Environnement : limites larges par défaut, petites limites par test ────

const BASE_LIMITS: Record<string, string> = {
    SCAN_PER_SCANNER_10S: '1000',
    LIVE_CODE_PER_USER_MIN: '1000',
    RESOLVE_PHONE_PER_IP_HOUR: '1000',
    VERIFY_OTP_PER_PHONE_15MIN: '1000',
    CONTROLLER_SETUP_PER_PHONE_HOUR: '1000',
    PARTNER_REGISTER_PER_IP_HOUR: '1000',
    INVITE_PER_PARTNER_HOUR: '1000',
    INVITE_PER_PHONE_DAY: '1000',
    REGISSEUR_PIN_PER_SHIFT_15MIN: '1000',
    SMS_PER_ACCOUNT_DAY: '1000',
    SMS_GLOBAL_OTP_RESERVED_PERCENT: '30',
    SMS_OTP_PER_PHONE_15MIN: '1000',
    SMS_OTP_PER_PHONE_DAY: '1000',
    SMS_OTP_PER_IP_HOUR: '1000',
    SMS_OTP_PER_IP_DAY: '1000',
    SMS_PER_PHONE_DAY: '1000',
    SMS_GLOBAL_DAILY_CAP: '100000',
    CLIENT_IP_SOURCE: 'x-forwarded-for',
};

async function withEnv<T>(overrides: Record<string, string>, fn: () => Promise<T>): Promise<T> {
    const saved = new Map<string, string | undefined>();
    for (const [k, v] of Object.entries(overrides)) {
        saved.set(k, process.env[k]);
        process.env[k] = v;
    }
    resetServerEnvCache();
    try {
        return await fn();
    } finally {
        saved.forEach((v, k) => {
            if (v === undefined) delete process.env[k];
            else process.env[k] = v;
        });
        resetServerEnvCache();
    }
}

/** Les quotas sont comptés sur des fenêtres fixes : on évite de chevaucher deux fenêtres. */
async function alignWindow(windowSecs: number, neededMs: number): Promise<void> {
    const w = windowSecs * 1000;
    const left = w - (Date.now() % w);
    if (left < neededMs) await new Promise((resolve) => setTimeout(resolve, left + 300));
}

/** /64 IPv6 aléatoire (la garde ramène une IPv6 à son préfixe /64). */
function freshIp(): string {
    const h = () => randomBytes(2).toString('hex');
    return `2001:db8:${h()}:${h()}::${Math.floor(1 + Math.random() * 9000)}`;
}

// ── Appels de routes ───────────────────────────────────────────────────────

type Handler = (req: NextRequest) => Promise<Response>;

async function post(modulePath: string, req: NextRequest): Promise<RouteResult> {
    const mod = await importModule(modulePath);
    const handler = mod.POST as Handler | undefined;
    assert.equal(typeof handler, 'function', `${modulePath} n'exporte pas POST`);
    const res = await handler!(req);
    const text = await res.text();
    let body: Record<string, unknown> = {};
    try {
        body = text ? JSON.parse(text) : {};
    } catch {
        body = { raw: text };
    }
    return { status: res.status, body };
}

const ip = (value: string) => ({ 'x-forwarded-for': `${value}, 10.0.0.1` });

const resolvePhone = (from: string, phone: string) =>
    post('../../app/api/auth/resolve-phone/route', jsonRequest('/api/auth/resolve-phone', { phone }, ip(from)));
const verifyOtp = (from: string, phone: string) =>
    post('../../app/api/auth/verify-otp/route', jsonRequest('/api/auth/verify-otp', { phone, otpCode: '000000' }, ip(from)));
const controllerSetup = (from: string, phone: string) =>
    post('../../app/api/controller/setup/route', jsonRequest('/api/controller/setup', { phone, otp_code: '000000', new_password: STRONG_PASSWORD }, ip(from)));
const partnerRegister = (from: string, body: Record<string, unknown>) =>
    post('../../app/api/partner/register/route', jsonRequest('/api/partner/register', body, ip(from)));
const sendOtp = (from: string, phone: string) =>
    post('../../app/api/auth/send-otp/route', jsonRequest('/api/auth/send-otp', { phone }, ip(from)));
const invite = (by: Buyer, eventId: string, phone: string) =>
    post('../../app/api/partner/team/invite/route', authed('/api/partner/team/invite', 'POST', by, { event_ids: [eventId], phone, first_name: 'Ctrl' }));

/** Inscription partenaire valide pour le schéma, mais avec des jetons de pièces inconnus : aucun compte, aucun SMS. */
function registerBody(): Record<string, unknown> {
    return {
        companyName: 'Limiteurs Test SARL',
        description: 'Organisateur fictif pour les tests des limiteurs (lot 4).',
        address: '7 rue des Quotas',
        city: 'Dakar',
        activities: ['ORGANISATEUR'],
        firstName: 'Ndeye',
        lastName: 'Quota',
        phone: randomSenegalPhone('77'),
        email: randomEmail('quota'),
        password: STRONG_PASSWORD,
        confirmPassword: STRONG_PASSWORD,
        idCardUploadToken: randomBytes(24).toString('hex'),
        businessDocUploadToken: randomBytes(24).toString('hex'),
    };
}

function statuses(results: RouteResult[]): string {
    return results.map((r) => `${r.status}${r.body.code ? `/${String(r.body.code)}` : ''}`).join(', ');
}

/** n premières tentatives acceptées par le quota, la suivante refusée en 429. */
function assertLimitedAfter(results: RouteResult[], n: number, what: string): void {
    const head = results.slice(0, n);
    assert.ok(head.every((r) => r.status !== 429), `${what} : refus avant la limite (${statuses(results)})`);
    assert.equal(results[n]?.status, 429, `${what} : tentative ${n + 1} au-delà de la limite (${statuses(results)})`);
}

// ── Contexte commun ────────────────────────────────────────────────────────

let partner: TestPartner;
let ev: SaleEvent;

before(async () => {
    Object.assign(process.env, BASE_LIMITS);
    resetServerEnvCache();
    partner = await newPartner('limiteurs');
    ev = await createTimedEvent(partner.partnerId, 'limiteurs', [{ name: 'Standard', price: 5000, total: 50 }], { startsInHours: 1, durationHours: 6 });
});

after(async () => {
    await assertAccessInvariants('acces-limiteurs');
});

const SCAN_ROUTE = '../../app/api/controller/scan/route';

function unknownPayload(): Record<string, unknown> {
    return { eventId: ev.eventId, payload: `EVT1:${randomUUID()}:000000` };
}

async function scanQuotaRows(scannerId: string): Promise<Array<{ scope: string; bucket: string; window_secs: number; hits: number }>> {
    const { data, error } = await service.from('quota_counters')
        .select('scope, bucket, window_secs, hits')
        .ilike('scope', '%scan%')
        .ilike('bucket', `%${scannerId}%`)
        .eq('window_secs', 10);
    assert.equal(error, null, `quota_counters : ${error?.message}`);
    return (data ?? []) as Array<{ scope: string; bucket: string; window_secs: number; hits: number }>;
}

// ── Scan ───────────────────────────────────────────────────────────────────

describe('4.8 — scan : quota par scanneur en base', () => {
    test('rafale au-delà de SCAN_PER_SCANNER_10S → 429 rate_limited ; compteur en base, pas en mémoire de l’instance', async () => {
        const LIMIT = 4;
        await withEnv({ SCAN_PER_SCANNER_10S: String(LIMIT) }, async () => {
            const scanner = await newController(partner, ev.eventId, { label: 'rafale' });
            await importModule(SCAN_ROUTE);
            await alignWindow(10, 6000);
            const results = await Promise.all(Array.from({ length: LIMIT + 2 }, () => scan(scanner, unknownPayload())));
            const limited = results.filter((r) => r.status === 429);
            assert.equal(results.length - limited.length, LIMIT, `scans acceptés par le quota : ${statuses(results)}`);
            assert.equal(limited.length, 2, `refus 429 attendus : ${statuses(results)}`);
            assert.ok(limited.every((r) => r.body.result === 'rate_limited'), `corps du refus : ${JSON.stringify(limited[0]?.body)}`);

            // Le compteur est en base : une autre instance (autre lambda) voit le même état.
            const rows = await scanQuotaRows(scanner.userId);
            assert.ok(rows.some((r) => Number(r.hits) === LIMIT), `compteur de scan en base (hits = ${LIMIT}) : ${JSON.stringify(rows)}`);

            // La décision est lue en base, sans cache d'instance : compteur effacé → le scan suivant passe le quota.
            const { error: delErr } = await service.from('quota_counters').delete()
                .ilike('scope', '%scan%').ilike('bucket', `%${scanner.userId}%`).eq('window_secs', 10);
            assert.equal(delErr, null, `effacement du compteur : ${delErr?.message}`);
            const again = await scan(scanner, unknownPayload());
            assert.notEqual(again.status, 429, `après effacement du compteur en base : ${JSON.stringify(again.body)}`);
        });
    });
});

// ── Quotas par route ───────────────────────────────────────────────────────

describe('4.8 — quotas en base sur chaque route', () => {
    test('live-code : LIVE_CODE_PER_USER_MIN par utilisateur', async () => {
        await withEnv({ LIVE_CODE_PER_USER_MIN: '2' }, async () => {
            const holder = await newBuyer('lim-live');
            const { ticketIds } = await createCashOrderTickets(holder, partner, ev, 'Standard', 1);
            await alignWindow(60, 8000);
            const results: RouteResult[] = [];
            for (let i = 0; i < 3; i += 1) results.push(await liveCode(holder, ticketIds[0]));
            assert.deepEqual(results.slice(0, 2).map((r) => r.status), [200, 200], `porteur sous la limite : ${statuses(results)}`);
            assertLimitedAfter(results, 2, 'live-code');
        });
    });

    test('resolve-phone : RESOLVE_PHONE_PER_IP_HOUR par IP, numéros différents', async () => {
        await withEnv({ RESOLVE_PHONE_PER_IP_HOUR: '2' }, async () => {
            const from = freshIp();
            await alignWindow(3600, 8000);
            const results: RouteResult[] = [];
            for (let i = 0; i < 3; i += 1) results.push(await resolvePhone(from, randomSenegalPhone('78')));
            assertLimitedAfter(results, 2, 'resolve-phone');
        });
    });

    test('verify-otp : VERIFY_OTP_PER_PHONE_15MIN par numéro, depuis des IP différentes', async () => {
        await withEnv({ VERIFY_OTP_PER_PHONE_15MIN: '2' }, async () => {
            const phone = randomSenegalPhone('78');
            await alignWindow(900, 8000);
            const results: RouteResult[] = [];
            for (let i = 0; i < 3; i += 1) results.push(await verifyOtp(freshIp(), phone));
            assertLimitedAfter(results, 2, 'verify-otp');
        });
    });

    test('controller/setup : CONTROLLER_SETUP_PER_PHONE_HOUR par numéro, depuis des IP différentes', async () => {
        await withEnv({ CONTROLLER_SETUP_PER_PHONE_HOUR: '2' }, async () => {
            const phone = randomSenegalPhone('77');
            await alignWindow(3600, 8000);
            const results: RouteResult[] = [];
            for (let i = 0; i < 3; i += 1) results.push(await controllerSetup(freshIp(), phone));
            assertLimitedAfter(results, 2, 'controller/setup');
        });
    });

    test('partner/register : PARTNER_REGISTER_PER_IP_HOUR par IP (première valeur de x-forwarded-for), aucun SMS', async () => {
        await withEnv({ PARTNER_REGISTER_PER_IP_HOUR: '2' }, async () => {
            const from = freshIp();
            await alignWindow(3600, 8000);
            const bodies = [registerBody(), registerBody(), registerBody()];
            const results: RouteResult[] = [];
            for (const b of bodies) results.push(await partnerRegister(from, b));
            assertLimitedAfter(results, 2, 'partner/register');
            for (const b of bodies) assert.equal(getFakes().sms.messagesTo(String(b.phone)).length, 0, 'aucun SMS sans pièces valides');
        });
    });

    test('invitation : INVITE_PER_PARTNER_HOUR par partenaire', async () => {
        await withEnv({ INVITE_PER_PARTNER_HOUR: '2' }, async () => {
            const host = await newPartner('lim-invite');
            const hostEvent = await createTimedEvent(host.partnerId, 'lim-invite', [{ name: 'Standard', price: 5000, total: 10 }], { startsInHours: 48 });
            await alignWindow(3600, 15000);
            const results: RouteResult[] = [];
            for (let i = 0; i < 3; i += 1) results.push(await invite(host, hostEvent.eventId, randomSenegalPhone('77')));
            assert.ok(results.slice(0, 2).every((r) => r.status < 300), `invitations sous la limite : ${statuses(results)}`);
            assertLimitedAfter(results, 2, 'invitation par partenaire');
        });
    });

    test('invitation : INVITE_PER_PHONE_DAY par numéro invité, tous partenaires confondus', async () => {
        await withEnv({ INVITE_PER_PHONE_DAY: '1' }, async () => {
            const first = await newPartner('lim-inv-a');
            const second = await newPartner('lim-inv-b');
            const evA = await createTimedEvent(first.partnerId, 'lim-inv-a', [{ name: 'Standard', price: 5000, total: 10 }], { startsInHours: 48 });
            const evB = await createTimedEvent(second.partnerId, 'lim-inv-b', [{ name: 'Standard', price: 5000, total: 10 }], { startsInHours: 48 });
            const phone = randomSenegalPhone('77');
            await alignWindow(86400, 15000);
            const a = await invite(first, evA.eventId, phone);
            assert.ok(a.status < 300, `première invitation : HTTP ${a.status} ${JSON.stringify(a.body)}`);
            const b = await invite(second, evB.eventId, phone);
            assert.equal(b.status, 429, `deuxième invitation du même numéro : HTTP ${b.status} ${JSON.stringify(b.body)}`);
        });
    });

    test('PIN régisseur : vérification limitée par reserveQuota (REGISSEUR_PIN_PER_SHIFT_15MIN), contrôle statique', () => {
        const files: string[] = [];
        const walk = (dir: string) => {
            for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
                const full = path.join(dir, e.name);
                if (e.isDirectory()) walk(full);
                else if (/\.tsx?$/.test(e.name)) files.push(full);
            }
        };
        walk(path.resolve(process.cwd(), 'lib'));
        const guarded = files.filter((f) => {
            const src = fs.readFileSync(f, 'utf8');
            return src.includes('REGISSEUR_PIN_PER_SHIFT_15MIN') && /\breserveQuota\s*\(/.test(src);
        });
        assert.ok(guarded.length > 0, 'aucun module de lib/ ne limite la vérification du PIN par reserveQuota avec REGISSEUR_PIN_PER_SHIFT_15MIN');
        const shiftService = fs.readFileSync(path.resolve(process.cwd(), 'lib/shifts/shift.service.ts'), 'utf8');
        assert.ok(!/\bRateLimiter\b/.test(shiftService), 'lib/shifts/shift.service.ts utilise encore RateLimiter');
    });
});

// ── Refus si la garde ne répond pas ────────────────────────────────────────

describe('4.8 — garde de quota indisponible : refus (fail-closed)', () => {
    test('EXECUTE retiré sur quota_reserve → 503 sur scan, live-code, resolve-phone, verify-otp, setup, register, invitation', async () => {
        const scanner = await newController(partner, ev.eventId, { canAcceptCash: true, label: 'garde' });
        const holder = await newBuyer('lim-garde');
        const { ticketIds } = await createCashOrderTickets(holder, partner, ev, 'Standard', 1);
        const host = await newPartner('lim-garde');
        const hostEvent = await createTimedEvent(host.partnerId, 'lim-garde', [{ name: 'Standard', price: 5000, total: 10 }], { startsInHours: 48 });
        const invitedPhone = randomSenegalPhone('77');
        for (const m of [SCAN_ROUTE, '../../app/api/tickets/[id]/live-code/route', '../../app/api/auth/resolve-phone/route',
            '../../app/api/auth/verify-otp/route', '../../app/api/controller/setup/route', '../../app/api/partner/register/route',
            '../../app/api/partner/team/invite/route']) {
            await importModule(m);
        }

        const db = new Client({ connectionString: process.env.SUPABASE_DB_URL });
        await db.connect();
        const outcomes: Array<[string, RouteResult]> = [];
        try {
            await db.query('REVOKE EXECUTE ON FUNCTION public.quota_reserve(jsonb) FROM service_role');
            outcomes.push(['scan', await scan(scanner, unknownPayload())]);
            outcomes.push(['live-code', await liveCode(holder, ticketIds[0])]);
            outcomes.push(['resolve-phone', await resolvePhone(freshIp(), randomSenegalPhone('78'))]);
            outcomes.push(['verify-otp', await verifyOtp(freshIp(), randomSenegalPhone('78'))]);
            outcomes.push(['controller/setup', await controllerSetup(freshIp(), randomSenegalPhone('77'))]);
            outcomes.push(['partner/register', await partnerRegister(freshIp(), registerBody())]);
            outcomes.push(['invitation', await invite(host, hostEvent.eventId, invitedPhone)]);
        } finally {
            try {
                await db.query('GRANT EXECUTE ON FUNCTION public.quota_reserve(jsonb) TO service_role').catch((e: Error) => {
                    throw new Error(`restauration du droit EXECUTE impossible : ${e.message}`);
                });
            } finally {
                await db.end();
            }
        }
        const wrong = outcomes.filter(([, r]) => r.status !== 503).map(([name, r]) => `${name} : HTTP ${r.status} ${JSON.stringify(r.body).slice(0, 160)}`);
        assert.deepEqual(wrong, [], `routes qui ne refusent pas en 503 quand la garde est indisponible :\n${wrong.join('\n')}`);
        assert.equal(getFakes().sms.messagesTo(invitedPhone).length, 0, 'aucun SMS d’invitation sans garde');
    });
});

// ── SMS ────────────────────────────────────────────────────────────────────

async function smsService(): Promise<{ sendSms: (to: string, message: string) => Promise<{ success: boolean; code?: string; error?: string }> }> {
    const mod = await importModule('../../lib/sms/mtarget.service');
    return mod.mTargetService;
}

const NOTIFICATION = 'Event Village : notification de test des limiteurs (lot 4).';

describe('4.8 — anti-abus SMS', () => {
    test('des notifications vers un numéro n’épuisent plus son quota OTP', async () => {
        await withEnv({ SMS_PER_PHONE_DAY: '2' }, async () => {
            const sms = await smsService();
            const phone = randomSenegalPhone('76');
            await alignWindow(86400, 15000);
            for (let i = 0; i < 2; i += 1) {
                const r = await sms.sendSms(phone, NOTIFICATION);
                assert.equal(r.success, true, `notification ${i + 1} : ${r.code} ${r.error}`);
            }
            const otp = await sendOtp(freshIp(), phone);
            assert.equal(otp.status, 200, `OTP après 2 notifications au même numéro : HTTP ${otp.status} ${JSON.stringify(otp.body)}`);
            assert.ok(getFakes().sms.messagesTo(phone).some((m) => /code/i.test(m.message)), 'le code OTP est parti');
        });
    });

    test('un compte déclencheur au-delà de SMS_PER_ACCOUNT_DAY est bloqué (invitations d’un partenaire)', async () => {
        await withEnv({ SMS_PER_ACCOUNT_DAY: '2' }, async () => {
            const host = await newPartner('lim-sms-compte');
            const hostEvent = await createTimedEvent(host.partnerId, 'lim-sms-compte', [{ name: 'Standard', price: 5000, total: 10 }], { startsInHours: 48 });
            const phones = [randomSenegalPhone('77'), randomSenegalPhone('77'), randomSenegalPhone('77')];
            await alignWindow(86400, 20000);
            const results: RouteResult[] = [];
            for (const p of phones) results.push(await invite(host, hostEvent.eventId, p));
            assert.ok(results.slice(0, 2).every((r) => r.status < 300), `invitations sous la limite du compte : ${statuses(results)}`);
            const received = phones.map((p) => getFakes().sms.messagesTo(p).length);
            assert.deepEqual(received, [1, 1, 0], `SMS reçus par invité (limite de 2 SMS pour le compte du partenaire) : ${received.join(', ')}`);
        });
    });

    test('plafond global presque atteint par des SMS non OTP : les non OTP s’arrêtent à 70 %, les OTP utilisent tout le plafond', async () => {
        const CAP = 10;
        const NON_OTP_MAX = 7; // floor(10 × (100 − 30) / 100)
        await withEnv({ SMS_GLOBAL_DAILY_CAP: String(CAP), SMS_GLOBAL_OTP_RESERVED_PERCENT: '30' }, async () => {
            const sms = await smsService();
            await importModule('../../app/api/auth/send-otp/route');
            await alignWindow(86400, 60000);
            // Compteurs globaux du jour remis à zéro (base locale) : la suite ne dépend pas des envois des suites précédentes.
            const dayStart = `${new Date().toISOString().slice(0, 10)}T00:00:00Z`;
            const { error: resetErr } = await service.from('quota_counters').delete().like('scope', 'sms%').eq('bucket', 'all').gte('window_start', dayStart);
            assert.equal(resetErr, null, `remise à zéro des compteurs globaux : ${resetErr?.message}`);

            const outcomes: Array<{ success: boolean; code?: string }> = [];
            for (let i = 0; i < CAP + 2; i += 1) {
                const r = await sms.sendSms(randomSenegalPhone('78'), NOTIFICATION);
                outcomes.push(r);
                if (!r.success) break;
            }
            const sent = outcomes.filter((o) => o.success).length;
            assert.equal(sent, NON_OTP_MAX, `SMS non OTP envoyés avant l'arrêt (plafond ${CAP}, part OTP 30 %) : ${sent}`);
            assert.match(String(outcomes[outcomes.length - 1].code), /CAP/, `code du refus non OTP : ${JSON.stringify(outcomes[outcomes.length - 1])}`);

            for (let i = 0; i < CAP - NON_OTP_MAX; i += 1) {
                const r = await sendOtp(freshIp(), randomSenegalPhone('76'));
                assert.equal(r.status, 200, `OTP ${i + 1} dans la part réservée : HTTP ${r.status} ${JSON.stringify(r.body)}`);
            }
            const over = await sendOtp(freshIp(), randomSenegalPhone('76'));
            assert.equal(over.status, 429, `OTP au-delà du plafond global : HTTP ${over.status} ${JSON.stringify(over.body)}`);
            assert.equal(over.body.code, 'SMS_DAILY_CAP_REACHED');
        });
    });
});

// ── Contrôles statiques ────────────────────────────────────────────────────

const QUOTA_VARIABLES: Record<string, string> = {
    SCAN_PER_SCANNER_10S: '30',
    LIVE_CODE_PER_USER_MIN: '60',
    RESOLVE_PHONE_PER_IP_HOUR: '30',
    VERIFY_OTP_PER_PHONE_15MIN: '10',
    CONTROLLER_SETUP_PER_PHONE_HOUR: '10',
    PARTNER_REGISTER_PER_IP_HOUR: '10',
    INVITE_PER_PARTNER_HOUR: '20',
    INVITE_PER_PHONE_DAY: '3',
    REGISSEUR_PIN_PER_SHIFT_15MIN: '5',
    SMS_PER_ACCOUNT_DAY: '30',
    SMS_GLOBAL_OTP_RESERVED_PERCENT: '30',
};

describe('4.8 — contrôles statiques', () => {
    test('lib/security/rate-limiter.ts n’existe plus', () => {
        assert.equal(fs.existsSync(path.resolve(process.cwd(), 'lib/security/rate-limiter.ts')), false, 'lib/security/rate-limiter.ts existe encore');
    });

    test('plus aucun import ni usage de RateLimiter dans app/, lib/, components/, hooks/, tests/ (legacy comprises) ni middleware.ts', () => {
        const self = path.resolve(__filename);
        const offenders: string[] = [];
        const scanFile = (full: string) => {
            if (path.resolve(full) === self) return;
            const lines = fs.readFileSync(full, 'utf8').split(/\r?\n/);
            lines.forEach((line, i) => {
                // Lignes de code seulement : un commentaire qui cite l'ancien limiteur n'est pas un usage.
                const code = line.replace(/\/\/.*$/, '').replace(/^\s*(\*|\/\*).*$/, '');
                if (/\bRateLimiter\b|rate-limiter['"]/.test(code)) offenders.push(`${path.relative(process.cwd(), full).replace(/\\/g, '/')}:${i + 1} ${line.trim()}`);
            });
        };
        const walk = (dir: string) => {
            for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
                const full = path.join(dir, e.name);
                if (e.isDirectory()) {
                    if (e.name !== 'node_modules') walk(full);
                } else if (/\.(ts|tsx|js|mjs)$/.test(e.name)) scanFile(full);
            }
        };
        for (const d of ['app', 'lib', 'components', 'hooks', 'tests']) {
            const abs = path.resolve(process.cwd(), d);
            if (fs.existsSync(abs)) walk(abs);
        }
        const mw = path.resolve(process.cwd(), 'middleware.ts');
        if (fs.existsSync(mw)) scanFile(mw);
        assert.deepEqual(offenders, [], `références à RateLimiter :\n${offenders.join('\n')}`);
    });

    test('variables de quota déclarées dans lib/env.ts et réglées dans .env.test.example (valeurs du contrat)', () => {
        const envTs = fs.readFileSync(path.resolve(process.cwd(), 'lib/env.ts'), 'utf8');
        const example = fs.readFileSync(path.resolve(process.cwd(), '.env.test.example'), 'utf8').split(/\r?\n/).map((l) => l.trim());
        const missing: string[] = [];
        for (const [key, value] of Object.entries(QUOTA_VARIABLES)) {
            if (!new RegExp(`\\b${key}\\s*:`).test(envTs)) missing.push(`lib/env.ts : ${key}`);
            if (!example.includes(`${key}=${value}`)) missing.push(`.env.test.example : ${key}=${value}`);
        }
        assert.deepEqual(missing, [], `variables absentes :\n${missing.join('\n')}`);
    });
});

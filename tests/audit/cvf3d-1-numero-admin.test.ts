/**
 * Contre-vérification de la finition 3d, attaque 1 — changement du numéro d'un ADMIN par le SUPERADMIN
 * (POST /api/admin/users/[id]/phone/start et /confirm ; admin_phone_change_start, _verify, _finalize).
 *  a. Sans mot de passe récent ; b. sans code administrateur récent : refus, aucun SMS, aucune demande.
 *  c. Code périmé (demande de plus de 10 minutes) : refus, numéro inchangé.
 *  d. Nouveau numéro non prouvé : code d'une autre demande, demande remplacée par une plus récente, demande d'un autre
 *     Superadmin : refus, numéro inchangé.
 *  e. Code deviné : 5 essais faux puis le bon code ; 8 essais faux en parallèle : jamais plus de 5 comptés, bon code refusé.
 *  f. Cible SUPERADMIN ; g. cible soi-même ; h. ADMIN (même muni de users.write) qui vise quiconque : refus, aucun SMS.
 *  i. Requêtes simultanées : deux validations du bon code ; deux débuts pour deux numéros ; validation et nouveau début en
 *     même temps : un seul changement, numéro de connexion (auth.users) et numéro du compte toujours identiques.
 *  j. Sessions et appareils de la cible révoqués : routes de l'application et jeton de rafraîchissement (j1), jeton d'accès
 *     déjà ouvert par la REST (j2) et abonnement temps réel déjà ouvert (j3).
 *  k. L'ADMIN change lui-même son numéro par l'écran client (Profil : /api/account/phone/start et /confirm), sans le
 *     Superadmin.
 * Sortie brute `[CVF3D-1]`.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';
import { inspect, writeLocal } from '../helpers/db';
import { assertFinition3dInvariants } from '../helpers/finition3d-invariants';
import {
    disposeClients, expectNothing, produceUntilReceived, RECEIVE_TIMEOUT_MS, signedInClient, subscribeCollect, waitForEvent,
    type Collector,
} from '../helpers/realtime';
import { newPartner } from '../parcours/finance-helpers';
import { newAdmin } from '../parcours/notif-helpers';
import { newBuyer } from '../parcours/paiement-helpers';
import {
    ageDeviceCode, auditCount, authPhoneOf, call, confirmIdentity, devicesOf, digits, lastSmsCode, othersSeen, phoneOf,
    randomSenegalPhone, refreshError, sessionsOf, show, smsTo, steppedUpSession, STRONG_PASSWORD, superadmin,
    confirmPasswordOnly, type OpenSession, type Reply, type Row, type TestAdmin,
} from './cvf3d-helpers';

const START = 'admin/users/[id]/phone/start';
const CONFIRM = 'admin/users/[id]/phone/confirm';
const REASON = 'Téléphone perdu (contre-vérification 3d)';

const start = (token: string, targetId: string, body: Row): Promise<Reply> =>
    call('POST', START, { token, path: `/api/admin/users/${targetId}/phone/start`, params: { id: targetId }, body });
const confirm = (token: string, targetId: string, body: Row): Promise<Reply> =>
    call('POST', CONFIRM, { token, path: `/api/admin/users/${targetId}/phone/confirm`, params: { id: targetId }, body });

async function requestsOf(targetId: string): Promise<Row[]> {
    return inspect(async (c) => (await c.query(
        `SELECT id::text, status, attempts, new_phone, actor_id::text FROM public.admin_phone_changes WHERE target_id = $1 ORDER BY created_at`,
        [targetId])).rows as Row[]);
}

function wrongCode(code: string, i: number): string {
    return String((Number(code) + 1 + i) % 1_000_000).padStart(6, '0');
}

/** Début réussi pour `target` vers `phone` ; rend l'identifiant de la demande et le code reçu au nouveau numéro. */
async function started(sa: TestAdmin, target: TestAdmin, phone: string): Promise<{ requestId: string; code: string }> {
    const r = await start(sa.accessToken, target.userId, { phone, reason: REASON });
    assert.equal(r.status, 200, `début du changement (montage) : ${show(r)}`);
    return { requestId: String(r.body.request_id), code: await lastSmsCode(phone) };
}

async function samePhones(userId: string): Promise<{ same: boolean; detail: string }> {
    const pub = await phoneOf(userId);
    const auth = await authPhoneOf(userId);
    return { same: digits(pub) === digits(auth), detail: `compte ${pub} ; connexion ${auth}` };
}

after(async () => {
    await assertFinition3dInvariants('cvf3d-1-numero-admin');
});

describe('1. preuves exigées du SUPERADMIN', () => {
    test('a. sans mot de passe récent : 403 PASSWORD_CONFIRMATION_REQUIRED, aucun SMS, aucune demande', async () => {
        const sa = await superadmin('cvf3d1-a', false);
        const target = await newAdmin('cvf3d1-a-cible', ['events.read']);
        const phone = randomSenegalPhone('77');
        const r = await start(sa.accessToken, target.userId, { phone, reason: REASON });
        const reqs = await requestsOf(target.userId);
        console.log(`[CVF3D-1a] début sans mot de passe récent : ${show(r)} ; SMS au nouveau numéro : ${smsTo(phone).length} ; demandes : ${reqs.length}`);
        assert.deepEqual([r.status, r.body.code], [403, 'PASSWORD_CONFIRMATION_REQUIRED'], show(r));
        assert.equal(smsTo(phone).length, 0, 'aucun SMS au nouveau numéro');
        assert.equal(reqs.length, 0, 'aucune demande enregistrée');
    });

    test('b. mot de passe saisi mais code administrateur de plus de 10 minutes : 403 ADMIN_CODE_CONFIRMATION_REQUIRED, aucun SMS', async () => {
        const sa = await superadmin('cvf3d1-b', false);
        await confirmPasswordOnly(sa.accessToken);
        await ageDeviceCode(sa.userId, 11);
        const target = await newAdmin('cvf3d1-b-cible', ['events.read']);
        const phone = randomSenegalPhone('77');
        const r = await start(sa.accessToken, target.userId, { phone, reason: REASON });
        const reqs = await requestsOf(target.userId);
        console.log(`[CVF3D-1b] début sans code récent : ${show(r)} ; SMS : ${smsTo(phone).length} ; demandes : ${reqs.length}`);
        assert.deepEqual([r.status, r.body.code], [403, 'ADMIN_CODE_CONFIRMATION_REQUIRED'], show(r));
        assert.equal(smsTo(phone).length, 0, 'aucun SMS au nouveau numéro');
        assert.equal(reqs.length, 0, 'aucune demande enregistrée');
    });
});

describe('1. preuve du nouveau numéro', () => {
    test('c. code périmé (demande de plus de 10 minutes) : 410 CODE_EXPIRED, numéro inchangé', async () => {
        const sa = await superadmin('cvf3d1-c');
        const target = await newAdmin('cvf3d1-c-cible', ['events.read']);
        const phone = randomSenegalPhone('77');
        const { requestId, code } = await started(sa, target, phone);
        await writeLocal((c) => c.query(`UPDATE public.admin_phone_changes SET expires_at = now() - interval '1 minute' WHERE id = $1`, [requestId]));
        const r = await confirm(sa.accessToken, target.userId, { request_id: requestId, code });
        const now = await phoneOf(target.userId);
        console.log(`[CVF3D-1c] bon code après expiration : ${show(r)} ; numéro du compte : ${now}`);
        assert.deepEqual([r.status, r.body.code], [410, 'CODE_EXPIRED'], show(r));
        assert.equal(digits(now), digits(target.phoneE164), 'numéro inchangé');
    });

    test('d. nouveau numéro non prouvé : code d\'une autre demande, demande remplacée, demande d\'un autre Superadmin', async () => {
        const sa = await superadmin('cvf3d1-d');
        const other = await superadmin('cvf3d1-d-autre');
        const t1 = await newAdmin('cvf3d1-d-cible1', ['events.read']);
        const t2 = await newAdmin('cvf3d1-d-cible2', ['events.read']);
        const t3 = await newAdmin('cvf3d1-d-cible3', ['events.read']);
        // d1 : code reçu pour la demande de t2, saisi sur la demande de t1
        const a = await started(sa, t1, randomSenegalPhone('77'));
        const b = await started(sa, t2, randomSenegalPhone('77'));
        const cross = await confirm(sa.accessToken, t1.userId, { request_id: a.requestId, code: b.code === a.code ? wrongCode(a.code, 0) : b.code });
        // d2 : demande remplacée par une plus récente (même compte visé), puis son code
        const pOld = randomSenegalPhone('77');
        const old = await started(sa, t3, pOld);
        const fresh = await started(sa, t3, randomSenegalPhone('77'));
        const replaced = await confirm(sa.accessToken, t3.userId, { request_id: old.requestId, code: old.code });
        // d3 : demande ouverte par un autre Superadmin, validée par le premier avec le bon code
        const foreign = await confirm(other.accessToken, t3.userId, { request_id: fresh.requestId, code: fresh.code });
        const phones = [await phoneOf(t1.userId), await phoneOf(t3.userId)];
        console.log(`[CVF3D-1d] code d'une autre demande : ${show(cross)} ; demande remplacée : ${show(replaced)} ; demande d'un autre Superadmin : ${show(foreign)} ; numéros : ${phones.join(', ')}`);
        assert.deepEqual([cross.status, cross.body.code], [400, 'INVALID_CODE'], `d1 ${show(cross)}`);
        assert.deepEqual([replaced.status, replaced.body.code], [409, 'REQUEST_CLOSED'], `d2 ${show(replaced)}`);
        assert.deepEqual([foreign.status, foreign.body.code], [404, 'REQUEST_NOT_FOUND'], `d3 ${show(foreign)}`);
        assert.equal(digits(phones[0]), digits(t1.phoneE164), 'numéro de t1 inchangé');
        assert.equal(digits(phones[1]), digits(t3.phoneE164), 'numéro de t3 inchangé');
        assert.ok(!smsTo(pOld).some((m) => /maintenant celui/.test(m)), 'aucun SMS de confirmation au numéro non prouvé');
    });

    test('e. code deviné : 5 essais faux puis le bon (refusé) ; 8 essais faux en parallèle : 5 comptés au plus, bon code refusé', async () => {
        const sa = await superadmin('cvf3d1-e');
        const target = await newAdmin('cvf3d1-e-cible', ['events.read']);
        const { requestId, code } = await started(sa, target, randomSenegalPhone('77'));
        const seq: string[] = [];
        for (let i = 0; i < 5; i += 1) {
            const r = await confirm(sa.accessToken, target.userId, { request_id: requestId, code: wrongCode(code, i) });
            seq.push(`${r.status} ${String(r.body.code)}`);
        }
        const right = await confirm(sa.accessToken, target.userId, { request_id: requestId, code });
        const row = (await requestsOf(target.userId)).find((x) => x.id === requestId);

        const sa2 = await superadmin('cvf3d1-e2');
        const target2 = await newAdmin('cvf3d1-e2-cible', ['events.read']);
        const p2 = await started(sa2, target2, randomSenegalPhone('77'));
        const burst = await Promise.all(Array.from({ length: 8 }, (_, i) => confirm(sa2.accessToken, target2.userId, { request_id: p2.requestId, code: wrongCode(p2.code, i) })));
        const right2 = await confirm(sa2.accessToken, target2.userId, { request_id: p2.requestId, code: p2.code });
        const row2 = (await requestsOf(target2.userId)).find((x) => x.id === p2.requestId);
        console.log(`[CVF3D-1e] essais faux un à un : ${seq.join(' | ')} ; bon code ensuite : ${show(right)} ; demande : ${JSON.stringify(row)}`);
        console.log(`[CVF3D-1e] 8 essais faux en parallèle : ${burst.map((r) => `${r.status} ${String(r.body.code)}`).join(' | ')} ; bon code ensuite : ${show(right2)} ; demande : ${JSON.stringify(row2)}`);
        assert.deepEqual(seq, ['400 INVALID_CODE', '400 INVALID_CODE', '400 INVALID_CODE', '400 INVALID_CODE', '429 TOO_MANY_ATTEMPTS']);
        assert.notEqual(right.status, 200, `bon code après 5 essais faux : ${show(right)}`);
        assert.equal(Number(row?.attempts), 5);
        assert.ok(Number(row2?.attempts) <= 5, `essais comptés en parallèle : ${String(row2?.attempts)}`);
        assert.ok(burst.filter((r) => r.body.code === 'INVALID_CODE').length <= 4, 'au plus 4 « code incorrect » avant le blocage');
        assert.notEqual(right2.status, 200, `bon code après la rafale : ${show(right2)}`);
        assert.equal(digits(await phoneOf(target.userId)), digits(target.phoneE164));
        assert.equal(digits(await phoneOf(target2.userId)), digits(target2.phoneE164));
    });
});

describe('1. qui peut viser qui', () => {
    test('f. cible SUPERADMIN : 409 TARGET_IS_SUPERADMIN ; g. cible soi-même : 409 SELF_TARGET ; aucun SMS', async () => {
        const sa = await superadmin('cvf3d1-fg');
        const other = await superadmin('cvf3d1-fg-autre', false);
        const pF = randomSenegalPhone('77');
        const pG = randomSenegalPhone('77');
        const f = await start(sa.accessToken, other.userId, { phone: pF, reason: REASON });
        const g = await start(sa.accessToken, sa.userId, { phone: pG, reason: REASON });
        console.log(`[CVF3D-1f] cible SUPERADMIN : ${show(f)} ; [CVF3D-1g] cible soi-même : ${show(g)} ; SMS : ${smsTo(pF).length + smsTo(pG).length}`);
        assert.deepEqual([f.status, f.body.code], [409, 'TARGET_IS_SUPERADMIN'], show(f));
        assert.deepEqual([g.status, g.body.code], [409, 'SELF_TARGET'], show(g));
        assert.equal(smsTo(pF).length + smsTo(pG).length, 0, 'aucun SMS');
    });

    test('h. ADMIN muni de users.write, identité confirmée, qui vise un ADMIN, un client ou lui-même : 403, aucun SMS', async () => {
        const admin = await newAdmin('cvf3d1-h', ['users.read', 'users.write']);
        await confirmIdentity(admin);
        const other = await newAdmin('cvf3d1-h-cible', ['events.read']);
        const client = await newBuyer('cvf3d1-h-client');
        const sa = await superadmin('cvf3d1-h-sa');
        const real = await started(sa, other, randomSenegalPhone('77'));
        const phones = [randomSenegalPhone('77'), randomSenegalPhone('77'), randomSenegalPhone('77')];
        const replies = [
            await start(admin.accessToken, other.userId, { phone: phones[0], reason: REASON }),
            await start(admin.accessToken, client.userId, { phone: phones[1], reason: REASON }),
            await start(admin.accessToken, admin.userId, { phone: phones[2], reason: REASON }),
            await confirm(admin.accessToken, other.userId, { request_id: real.requestId, code: real.code }),
        ];
        console.log(`[CVF3D-1h] ADMIN : ${replies.map(show).join(' | ')}`);
        for (const r of replies) assert.equal(r.status, 403, show(r));
        assert.equal(phones.reduce((n, p) => n + smsTo(p).length, 0), 0, 'aucun SMS');
        assert.equal(digits(await phoneOf(other.userId)), digits(other.phoneE164), 'numéro de l\'ADMIN visé inchangé');
    });
});

describe('1. requêtes simultanées', () => {
    test('i1. deux validations du bon code en même temps : un seul changement', async () => {
        const sa = await superadmin('cvf3d1-i1');
        const target = await newAdmin('cvf3d1-i1-cible', ['events.read']);
        const phone = randomSenegalPhone('77');
        const { requestId, code } = await started(sa, target, phone);
        const both = await Promise.all([0, 1].map(() => confirm(sa.accessToken, target.userId, { request_id: requestId, code })));
        const done = await auditCount('ADMIN_PHONE_CHANGED', target.userId);
        const phones = await samePhones(target.userId);
        console.log(`[CVF3D-1i1] ${both.map(show).join(' | ')} ; journal ADMIN_PHONE_CHANGED : ${done} ; ${phones.detail}`);
        assert.equal(both.filter((r) => r.status === 200).length, 1, 'une seule validation réussie');
        assert.equal(done, 1, 'un seul changement au journal');
        assert.equal(digits(await phoneOf(target.userId)), digits(phone));
        assert.ok(phones.same, `numéros divergents : ${phones.detail}`);
    });

    test('i2. deux débuts en même temps pour deux numéros : une seule demande ouverte, l\'autre ne valide rien', async () => {
        const sa = await superadmin('cvf3d1-i2');
        const target = await newAdmin('cvf3d1-i2-cible', ['events.read']);
        const pA = randomSenegalPhone('77');
        const pB = randomSenegalPhone('77');
        const [ra, rb] = await Promise.all([pA, pB].map((phone) => start(sa.accessToken, target.userId, { phone, reason: REASON })));
        const open = (await requestsOf(target.userId)).filter((x) => x.status === 'PENDING');
        const codes = { [pA]: smsTo(pA).length ? await lastSmsCode(pA) : null, [pB]: smsTo(pB).length ? await lastSmsCode(pB) : null };
        const attempts: string[] = [];
        for (const [r, p] of [[ra, pA], [rb, pB]] as Array<[Reply, string]>) {
            if (r.status !== 200 || !codes[p]) continue;
            const c = await confirm(sa.accessToken, target.userId, { request_id: String(r.body.request_id), code: codes[p] });
            attempts.push(`${p.slice(-2)} → ${c.status} ${String(c.body.code ?? 'ok')}`);
        }
        const phones = await samePhones(target.userId);
        console.log(`[CVF3D-1i2] débuts : ${show(ra)} | ${show(rb)} ; demandes ouvertes : ${open.length} ; validations : ${attempts.join(' | ')} ; ${phones.detail}`);
        assert.ok(open.length <= 1, `demandes ouvertes en même temps : ${open.length}`);
        assert.ok(attempts.filter((a) => / → 200 /.test(a)).length <= 1, 'au plus un changement');
        assert.ok(phones.same, `numéros divergents : ${phones.detail}`);
    });

    test('i3. validation et nouveau début en même temps : numéro de connexion et numéro du compte identiques', async () => {
        const sa = await superadmin('cvf3d1-i3');
        const target = await newAdmin('cvf3d1-i3-cible', ['events.read']);
        const pA = randomSenegalPhone('77');
        const { requestId, code } = await started(sa, target, pA);
        const [c, s] = await Promise.all([
            confirm(sa.accessToken, target.userId, { request_id: requestId, code }),
            start(sa.accessToken, target.userId, { phone: randomSenegalPhone('77'), reason: REASON }),
        ]);
        const phones = await samePhones(target.userId);
        const rows = await requestsOf(target.userId);
        console.log(`[CVF3D-1i3] validation : ${show(c)} ; nouveau début : ${show(s)} ; demandes : ${rows.map((x) => `${String(x.status)}`).join(', ')} ; ${phones.detail}`);
        assert.ok(phones.same, `numéros divergents : ${phones.detail}`);
        if (c.status === 200) assert.equal(digits(await phoneOf(target.userId)), digits(pA));
        else assert.equal(digits(await phoneOf(target.userId)), digits(target.phoneE164));
    });
});

describe('1. sessions et appareils de l\'ADMIN visé, après le changement', () => {
    let sa: TestAdmin;
    let target: TestAdmin;
    let held: OpenSession;
    let rt: SupabaseClient;
    let witness: SupabaseClient;
    let spy: Collector;
    let feed: Collector;
    const registered: string[] = [];
    const before0: { tokenSeen: number; heldSeen: number } = { tokenSeen: 0, heldSeen: 0 };
    let change: Reply;

    const register = async (): Promise<string> => {
        const p = await newPartner('cvf3d1-signal');
        registered.push(p.partnerId);
        return p.partnerId;
    };

    before(async () => {
        sa = await superadmin('cvf3d1-j');
        target = await newAdmin('cvf3d1-j-cible', ['events.read']);
        held = await steppedUpSession(target.email);
        before0.tokenSeen = (await othersSeen(target.accessToken, target.userId)).n;
        before0.heldSeen = (await othersSeen(held.token, target.userId)).n;
        witness = await signedInClient('ADMIN');
        rt = await signedInClient({ email: target.email });
        feed = subscribeCollect(witness, { table: 'admin_signals' }, { label: 'témoin (ADMIN du jeu d\'essai)' });
        spy = subscribeCollect(rt, { table: 'admin_signals' }, { label: 'ADMIN visé (abonnement ouvert avant le changement)' });
        await Promise.all([feed.ready, spy.ready]);
        await produceUntilReceived(spy, register, (e) => registered.includes(String(e.new.ref_id)),
            { what: 'avant le changement : l\'ADMIN visé reçoit les signaux d\'administration' });
        const phone = randomSenegalPhone('77');
        const { requestId, code } = await started(sa, target, phone);
        change = await confirm(sa.accessToken, target.userId, { request_id: requestId, code });
        assert.equal(change.status, 200, `changement du numéro (montage) : ${show(change)}`);
    });

    after(async () => {
        await disposeClients(...[rt, witness].filter(Boolean));
    });

    test('j1. routes de l\'application, jeton de rafraîchissement, sessions et appareils : tout est refusé ou retiré', async () => {
        const me = await call('GET', 'auth/me', { token: target.accessToken });
        const team = await call('GET', 'partner/team/organizers', { token: held.token });
        const refresh = await refreshError(held.refresh);
        const sessions = await sessionsOf(target.userId);
        const devices = await devicesOf(target.userId);
        console.log(`[CVF3D-1j1] changement : ${show(change)} ; /api/auth/me : ${show(me)} ; /api/partner/team/organizers : ${show(team)} ; rafraîchissement : ${refresh ?? 'ACCEPTÉ'} ; sessions : ${sessions} ; appareils : ${devices}`);
        assert.ok(me.status === 401 || me.status === 403, `jeton révoqué servi par /api/auth/me : ${show(me)}`);
        assert.ok(team.status === 401 || team.status === 403, `jeton révoqué servi par une route admin : ${show(team)}`);
        assert.notEqual(refresh, null, 'jeton de rafraîchissement encore accepté');
        assert.equal(sessions, 0, 'sessions restantes');
        assert.equal(devices, 0, 'appareils restants');
    });

    test('j2. jeton d\'accès déjà ouvert, par la REST : plus aucun compte d\'autrui (pouvoir d\'administration retiré)', async () => {
        const a = await othersSeen(target.accessToken, target.userId);
        const b = await othersSeen(held.token, target.userId);
        const codes = await inspect(async (c) => Number((await c.query(`SELECT count(*)::int AS n FROM public.admin_session_codes WHERE user_id = $1`, [target.userId])).rows[0].n));
        console.log(`[CVF3D-1j2] comptes d'autrui lus par la REST : avant le changement ${before0.tokenSeen} et ${before0.heldSeen} ; après : ${a.n}${a.error ? ` (${a.error})` : ''} et ${b.n}${b.error ? ` (${b.error})` : ''} ; lignes admin_session_codes restantes : ${codes}`);
        assert.ok(before0.tokenSeen > 0 && before0.heldSeen > 0, 'témoin : avant le changement, le jeton lit les comptes d\'autrui');
        assert.equal(a.n, 0, `jeton de la session révoquée : ${a.n} compte(s) d'autrui encore lus par la REST`);
        assert.equal(b.n, 0, `jeton de l'autre session révoquée : ${b.n} compte(s) d'autrui encore lus par la REST`);
    });

    test('j3. abonnement temps réel ouvert avant le changement : plus aucun signal d\'administration', async () => {
        spy.clear();
        feed.clear();
        const sentinel = await register();
        await waitForEvent(feed, (e) => e.new.ref_id === sentinel, RECEIVE_TIMEOUT_MS, 'le témoin reçoit la sentinelle');
        const leaked = (): boolean => spy.events.some((e) => e.new.ref_id === sentinel);
        await new Promise((r) => setTimeout(r, 3_000));
        console.log(`[CVF3D-1j3] sentinelle ${sentinel} : reçue par le témoin ; reçue par l'ADMIN visé après la révocation : ${leaked() ? 'OUI' : 'non'}`);
        await expectNothing(spy, 0, (e) => e.new.ref_id === sentinel, 'ADMIN visé, session révoquée : aucun signal d\'administration');
    });
});

describe('1. autre chemin', () => {
    test('k. l\'ADMIN change lui-même son numéro par l\'écran client (Profil), sans le Superadmin : refusé', async () => {
        const admin = await newAdmin('cvf3d1-k', ['events.read']);
        await ageDeviceCode(admin.userId, 120);
        const pwd = await call('POST', 'account/password-confirm', { token: admin.accessToken, body: { password: STRONG_PASSWORD } });
        assert.equal(pwd.status, 200, `mot de passe (montage) : ${show(pwd)}`);
        const phone = randomSenegalPhone('77');
        const s = await call('POST', 'account/phone/start', { token: admin.accessToken, body: { phone } });
        let c: Reply | null = null;
        if (s.status === 200 && smsTo(phone).length > 0) {
            c = await call('POST', 'account/phone/confirm', { token: admin.accessToken, body: { phone, code: await lastSmsCode(phone) } });
        }
        const now = await phoneOf(admin.userId);
        console.log(`[CVF3D-1k] ADMIN (code de l'appareil vieux de 2 h, aucun Superadmin) : début ${show(s)} ; SMS au nouveau numéro : ${smsTo(phone).length} ; validation ${c ? show(c) : '—'} ; numéro du compte : ${now} (avant : ${admin.phoneE164})`);
        assert.equal(digits(now), digits(admin.phoneE164), `numéro de l'ADMIN changé sans le Superadmin (${now})`);
        assert.equal(smsTo(phone).length, 0, 'code envoyé au nouveau numéro : le changement est ouvert à l\'ADMIN');
    });
});

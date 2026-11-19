/**
 * Finition 3d (recours et suppléance) — point 2, téléphone perdu.
 *
 * 2b. Codes de secours du SUPERADMIN : 10 codes à usage unique (POST /api/admin/security/backup-codes, mot de passe et
 *     code administrateur exigés), montrés une seule fois, rangés en empreinte seulement ; régénérer annule les anciens ;
 *     nombre restant (GET). Un ADMIN n'en a pas.
 * 2c. « J'ai perdu mon téléphone » (POST /api/admin/step-up/recovery) : mot de passe et code de secours remplacent le SMS
 *     (appareil reconnu) ; à chaque usage : SMS d'alerte à l'ancien numéro, email, journal. Puis changement de son propre
 *     numéro (POST /api/admin/security/phone/start et /confirm), prouvé par un code envoyé au nouveau numéro : autres
 *     sessions et appareils révoqués, SMS à l'ancien et au nouveau numéro.
 * 2a. Le SUPERADMIN change le numéro d'un ADMIN (POST /api/admin/users/[id]/phone/start et /confirm) : mot de passe et
 *     code, motif, nouveau numéro prouvé par le code qu'il reçoit (à dicter au Superadmin) ; toutes les sessions et tous les
 *     appareils de l'ADMIN révoqués ; SMS à l'ancien et au nouveau numéro ; journal ; quotas.
 * 2d. Attaques : usurpation (ADMIN, client, SUPERADMIN sans preuve), code de secours rejoué ou deviné (limite d'essais),
 *     SUPERADMIN qui vise un autre SUPERADMIN ou lui-même, changement sans preuve du nouveau numéro (code faux, demande
 *     d'un autre, finalisation directe en base), numéro déjà pris, quotas.
 * Fin de suite : assertFinition3dInvariants.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { inspect, writeLocal } from '../helpers/db';
import { gotrueEmail } from '../helpers/gotrue-email';
import { assertFinition3dInvariants } from '../helpers/finition3d-invariants';
import { newAdmin, type TestAdmin } from './notif-helpers';
import { newBuyer, service } from './paiement-helpers';
import { callRoute, confirmIdentity, lastSmsCode, show, smsTo, type CallResult } from './f3d-helpers';
import { randomSenegalPhone, STRONG_PASSWORD } from './helpers';

const BACKUP = '../../app/api/admin/security/backup-codes/route';
const RECOVERY = '../../app/api/admin/step-up/recovery/route';
const STEP_UP = '../../app/api/admin/step-up/route';
const START = '../../app/api/admin/users/[id]/phone/start/route';
const CONFIRM = '../../app/api/admin/users/[id]/phone/confirm/route';
const SELF_START = '../../app/api/admin/security/phone/start/route';
const SELF_CONFIRM = '../../app/api/admin/security/phone/confirm/route';
const CODE_RE = /^[A-HJ-NP-Z2-9]{5}-[A-HJ-NP-Z2-9]{5}$/;

type Row = Record<string, unknown>;

function sessionIdOf(token: string): string {
    return String((JSON.parse(Buffer.from(token.split('.')[1] ?? '', 'base64url').toString('utf8')) as { session_id?: string }).session_id);
}

const generate = (a: TestAdmin) => callRoute(BACKUP, 'POST', '/api/admin/security/backup-codes', a.accessToken, {});
const status = (a: TestAdmin) => callRoute(BACKUP, 'GET', '/api/admin/security/backup-codes', a.accessToken);
const recover = (a: TestAdmin, password: string, code: string) => callRoute(RECOVERY, 'POST', '/api/admin/step-up/recovery', a.accessToken, { password, code });
const startFor = (actor: TestAdmin | { accessToken: string }, targetId: string, body: Row) =>
    callRoute(START, 'POST', `/api/admin/users/${targetId}/phone/start`, actor.accessToken, body, { id: targetId });
const confirmFor = (actor: TestAdmin | { accessToken: string }, targetId: string, body: Row) =>
    callRoute(CONFIRM, 'POST', `/api/admin/users/${targetId}/phone/confirm`, actor.accessToken, body, { id: targetId });

async function forgetDevice(a: TestAdmin): Promise<void> {
    await writeLocal((c) => c.query(`DELETE FROM public.admin_devices WHERE user_id = $1`, [a.userId]));
}

async function openCodes(userId: string): Promise<number> {
    return inspect(async (c) => Number((await c.query(`SELECT count(*)::int AS n FROM public.admin_backup_codes WHERE user_id = $1 AND used_at IS NULL AND revoked_at IS NULL`, [userId])).rows[0].n));
}

async function phoneOf(userId: string): Promise<string | null> {
    const { data, error } = await service.from('users').select('phone').eq('id', userId).single();
    assert.equal(error, null, error?.message);
    return (data?.phone as string | null) ?? null;
}

async function sessionsOf(userId: string): Promise<string[]> {
    return inspect(async (c) => (await c.query(`SELECT id::text FROM auth.sessions WHERE user_id = $1`, [userId])).rows.map((r) => String(r.id)));
}

async function outbox(type: string, filter: { phone?: string; userId?: string }): Promise<Row[]> {
    let q = service.from('notification_outbox').select('channel, recipient_user_id, recipient_phone, template_data, status').eq('type', type);
    if (filter.phone) q = q.eq('recipient_phone', filter.phone);
    if (filter.userId) q = q.eq('recipient_user_id', filter.userId);
    const { data, error } = await q;
    assert.equal(error, null, error?.message);
    return (data ?? []) as Row[];
}

/** Superadmin neuf, identité confirmée, 10 codes de secours créés (rendus en clair une seule fois). */
async function superadminWithCodes(label: string): Promise<{ sa: TestAdmin; codes: string[] }> {
    const sa = await newAdmin(label, [], { role: 'SUPERADMIN' });
    await confirmIdentity(sa);
    const r = await generate(sa);
    assert.equal(r.status, 200, show(r));
    return { sa, codes: r.body.codes as string[] };
}

after(async () => {
    await assertFinition3dInvariants('f3d-telephone');
});

describe('2b. codes de secours du SUPERADMIN', () => {
    test('sans mot de passe ni code récents : 403 PASSWORD_CONFIRMATION_REQUIRED, aucun code', async () => {
        const sa = await newAdmin('f3d-tel-sans-preuve', [], { role: 'SUPERADMIN' });
        const r = await generate(sa);
        assert.deepEqual([r.status, r.body.code], [403, 'PASSWORD_CONFIRMATION_REQUIRED'], show(r));
        assert.equal(await openCodes(sa.userId), 0);
    });

    test('création : 10 codes montrés une seule fois, rangés en empreinte seulement, 10 restants', async () => {
        const { sa, codes } = await superadminWithCodes('f3d-tel-codes');
        assert.equal(codes.length, 10);
        assert.equal(new Set(codes).size, 10, 'codes distincts');
        for (const code of codes) assert.match(code, CODE_RE, `forme du code ${code}`);
        const rows = await inspect(async (c) => (await c.query(`SELECT code_hash FROM public.admin_backup_codes WHERE user_id = $1 AND revoked_at IS NULL`, [sa.userId])).rows);
        assert.equal(rows.length, 10);
        const stored = rows.map((r) => String(r.code_hash));
        for (const code of codes) {
            assert.ok(!stored.some((h) => h.includes(code.replace('-', ''))), 'un code est rangé en clair');
            assert.match(stored[0], /^[0-9a-f]{64}$/);
        }
        const s = await status(sa);
        assert.deepEqual([s.status, s.body.remaining], [200, 10], show(s));
        assert.equal(s.body.codes, undefined, 'les codes ne se relisent jamais');
    });

    test('régénérer annule les anciens : un ancien code ne sert plus', async () => {
        const { sa, codes: old } = await superadminWithCodes('f3d-tel-regen');
        const again = await generate(sa);
        assert.equal(again.status, 200, show(again));
        assert.equal(await openCodes(sa.userId), 10);
        await forgetDevice(sa);
        const r = await recover(sa, STRONG_PASSWORD, old[0]);
        assert.deepEqual([r.status, r.body.code], [403, 'BACKUP_CODE_INVALID'], show(r));
    });

    test('un ADMIN n’a pas de codes de secours : 403', async () => {
        const admin = await newAdmin('f3d-tel-admin-codes', ['users.read']);
        const r = await status(admin);
        assert.deepEqual([r.status, r.body.code], [403, 'SUPERADMIN_ONLY'], show(r));
    });
});

describe('2c. « J’ai perdu mon téléphone » : mot de passe et code de secours remplacent le SMS', () => {
    let sa: TestAdmin;
    let codes: string[];
    let oldPhone: string;

    before(async () => {
        ({ sa, codes } = await superadminWithCodes('f3d-tel-perdu'));
        oldPhone = sa.phoneE164;
        await forgetDevice(sa);
    });

    test('nouvel appareil : le code administrateur est demandé', async () => {
        const r = await callRoute(STEP_UP, 'GET', '/api/admin/step-up', sa.accessToken);
        assert.equal(r.body.required, 'ADMIN_SMS_REQUIRED', show(r));
    });

    test('mauvais mot de passe : refusé, le code n’est pas consommé', async () => {
        const r = await recover(sa, 'Pas-le-bon#2026', codes[1]);
        assert.deepEqual([r.status, r.body.code], [403, 'BACKUP_CODE_INVALID'], show(r));
        assert.equal(await openCodes(sa.userId), 10);
    });

    test('mot de passe et code de secours : appareil reconnu, 9 restants, SMS à l’ancien numéro, email, journal', async () => {
        const r = await recover(sa, STRONG_PASSWORD, codes[0]);
        assert.equal(r.status, 200, show(r));
        assert.equal(r.body.remaining, 9);
        const step = await callRoute(STEP_UP, 'GET', '/api/admin/step-up', sa.accessToken);
        assert.equal(step.body.required, null, `appareil non reconnu après le code de secours : ${show(step)}`);
        const sms = await outbox('ADMIN_BACKUP_CODE_USED', { phone: oldPhone });
        assert.equal(sms.filter((x) => x.channel === 'SMS').length, 1, 'SMS d’alerte à l’ancien numéro');
        const mail = await outbox('ADMIN_BACKUP_CODE_USED', { userId: sa.userId });
        assert.ok(mail.some((x) => x.channel === 'EMAIL'), 'ligne d’email absente');
        const { data: audits } = await service.from('audit_logs').select('metadata').eq('action', 'ADMIN_BACKUP_CODE_USED').eq('object_id', sa.userId);
        assert.equal((audits ?? []).length, 1);
    });

    test('code de secours rejoué : refusé', async () => {
        await forgetDevice(sa);
        const r = await recover(sa, STRONG_PASSWORD, codes[0]);
        assert.deepEqual([r.status, r.body.code], [403, 'BACKUP_CODE_INVALID'], show(r));
        // Retour à l'état « appareil reconnu » pour la suite, par un autre code
        const ok = await recover(sa, STRONG_PASSWORD, codes[2]);
        assert.equal(ok.status, 200, show(ok));
    });

    test('puis son propre numéro, prouvé par un code au nouveau numéro : autres sessions et appareils révoqués, SMS aux deux numéros', async () => {
        // Seconde session du même compte (un autre appareil, par exemple le téléphone perdu)
        const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
        const { data: second, error: signErr } = await anon.auth.signInWithPassword({ email: await gotrueEmail(sa.email), password: STRONG_PASSWORD });
        assert.equal(signErr, null, signErr?.message);
        const before = await sessionsOf(sa.userId);
        const current = sessionIdOf(sa.accessToken);
        assert.ok(before.includes(current), 'session en cours absente');
        assert.ok(before.includes(sessionIdOf(second.session!.access_token)), 'seconde session absente');
        const newPhone = randomSenegalPhone('76');
        const start = await callRoute(SELF_START, 'POST', '/api/admin/security/phone/start', sa.accessToken, { phone: newPhone });
        assert.equal(start.status, 200, show(start));
        const code = await lastSmsCode(newPhone);
        const done = await callRoute(SELF_CONFIRM, 'POST', '/api/admin/security/phone/confirm', sa.accessToken, { request_id: start.body.request_id, code });
        assert.equal(done.status, 200, show(done));
        assert.equal(await phoneOf(sa.userId), newPhone);
        const { data: authUser } = await service.auth.admin.getUserById(sa.userId);
        assert.equal(`+${String(authUser.user?.phone ?? '').replace(/^\+/, '')}`, newPhone, 'numéro de connexion non changé');
        const after = await sessionsOf(sa.userId);
        assert.deepEqual(after, [current], 'seule la session en cours reste');
        assert.equal((await outbox('ADMIN_PHONE_CHANGED', { phone: oldPhone })).length, 1, 'SMS à l’ancien numéro');
        assert.equal((await outbox('ADMIN_PHONE_CONFIRMED', { phone: newPhone })).filter((x) => x.channel === 'SMS').length, 1, 'SMS au nouveau numéro');
        // Règle G.49 (run 306) : un seul email au compte (adresse vérifiée), porté par ADMIN_PHONE_CONFIRMED ; la ligne à
        // l'ancien numéro reste SMS seul, sans seconde ligne au compte
        assert.equal((await outbox('ADMIN_PHONE_CONFIRMED', { userId: sa.userId })).filter((x) => x.channel === 'EMAIL').length, 1, 'email au compte');
        assert.equal((await outbox('ADMIN_PHONE_CHANGED', { userId: sa.userId })).length, 0, 'aucune ligne ADMIN_PHONE_CHANGED au compte');
    });

    test('code deviné : 5 essais faux, puis même le bon code est refusé (429)', async () => {
        const { sa: g, codes: gc } = await superadminWithCodes('f3d-tel-devine');
        await forgetDevice(g);
        for (let i = 0; i < 5; i += 1) {
            const r = await recover(g, STRONG_PASSWORD, 'ZZZZZ-ZZZZZ');
            assert.deepEqual([r.status, r.body.code], [403, 'BACKUP_CODE_INVALID'], `essai ${i + 1} : ${show(r)}`);
        }
        const blocked = await recover(g, STRONG_PASSWORD, gc[0]);
        assert.equal(blocked.status, 429, show(blocked));
        assert.equal(await openCodes(g.userId), 10, 'aucun code consommé pendant le blocage');
    });

    test('un ADMIN : pas de code de secours, on lui dit de demander au Superadmin', async () => {
        const admin = await newAdmin('f3d-tel-admin-perdu', ['events.read']);
        await forgetDevice(admin);
        const r = await recover(admin, STRONG_PASSWORD, 'ABCDE-FGHJK');
        assert.deepEqual([r.status, r.body.code], [403, 'NO_BACKUP_CODES'], show(r));
        assert.match(String(r.body.error), /super-administrateur/); // design 1c (point 3) : nouveau mot, même exigence
    });
});

describe('2a. le SUPERADMIN change le numéro d’un ADMIN', () => {
    test('numéro prouvé par le code reçu au nouveau numéro : changé, tout révoqué, SMS aux deux numéros, journal', async () => {
        const boss = await newAdmin('f3d-tel-boss', [], { role: 'SUPERADMIN' });
        await confirmIdentity(boss);
        const target = await newAdmin('f3d-tel-cible', ['events.read']);
        const oldPhone = target.phoneE164;
        const newPhone = randomSenegalPhone('76');
        const start = await startFor(boss, target.userId, { phone: newPhone, reason: 'Téléphone perdu pendant un événement' });
        assert.equal(start.status, 200, show(start));
        const sms = smsTo(newPhone).at(-1) ?? '';
        // Design 1c (via la finition 4, modification signalée au rapport) : « super-administrateur » ; écart de caisse en mots
        assert.match(sms, /Donnez-le seulement au super-administrateur/, `texte du code : ${sms}`);
        const code = await lastSmsCode(newPhone);
        const done = await confirmFor(boss, target.userId, { request_id: start.body.request_id, code });
        assert.equal(done.status, 200, show(done));
        assert.equal(await phoneOf(target.userId), newPhone);
        assert.deepEqual(await sessionsOf(target.userId), [], 'toutes les sessions de l’ADMIN révoquées');
        const devices = await inspect(async (c) => Number((await c.query(`SELECT count(*)::int AS n FROM public.admin_devices WHERE user_id = $1`, [target.userId])).rows[0].n));
        assert.equal(devices, 0, 'tous les appareils de l’ADMIN révoqués');
        assert.equal((await outbox('ADMIN_PHONE_CHANGED', { phone: oldPhone })).length, 1, 'SMS à l’ancien numéro');
        assert.equal((await outbox('ADMIN_PHONE_CONFIRMED', { phone: newPhone })).filter((x) => x.channel === 'SMS').length, 1, 'SMS au nouveau numéro');
        const { data: audits } = await service.from('audit_logs').select('user_id, metadata').eq('action', 'ADMIN_PHONE_CHANGED').eq('object_id', target.userId);
        assert.equal((audits ?? []).length, 1);
        assert.deepEqual([audits![0].user_id, (audits![0].metadata as Row).reason], [boss.userId, 'Téléphone perdu pendant un événement']);
    });
});

describe('2d. tests d’attaque', () => {
    let boss: TestAdmin;
    let target: TestAdmin;
    before(async () => {
        boss = await newAdmin('f3d-tel-att-boss', [], { role: 'SUPERADMIN' });
        await confirmIdentity(boss);
        target = await newAdmin('f3d-tel-att-cible', ['events.read']);
    });

    test('usurpation : un ADMIN (même users.write), un client, un SUPERADMIN sans preuve : refusés, aucun SMS', async () => {
        const newPhone = randomSenegalPhone('76');
        const admin = await newAdmin('f3d-tel-att-admin', ['users.read', 'users.write']);
        const r1 = await startFor(admin, target.userId, { phone: newPhone, reason: 'Usurpation' });
        assert.deepEqual([r1.status, r1.body.code], [403, 'SUPERADMIN_ONLY'], show(r1));
        const client = await newBuyer('f3d-tel-att-client');
        const r2 = await startFor(client, target.userId, { phone: newPhone, reason: 'Usurpation' });
        assert.equal(r2.status, 403, show(r2));
        const fresh = await newAdmin('f3d-tel-att-sa-nu', [], { role: 'SUPERADMIN' });
        const r3 = await startFor(fresh, target.userId, { phone: newPhone, reason: 'Sans preuve' });
        assert.deepEqual([r3.status, r3.body.code], [403, 'PASSWORD_CONFIRMATION_REQUIRED'], show(r3));
        assert.deepEqual(smsTo(newPhone), [], 'aucun SMS au numéro visé');
        assert.equal(await phoneOf(target.userId), target.phoneE164);
    });

    test('SUPERADMIN qui vise un autre SUPERADMIN : 409 TARGET_IS_SUPERADMIN ; lui-même par cet écran : 409 SELF_TARGET', async () => {
        const other = await newAdmin('f3d-tel-att-autre-sa', [], { role: 'SUPERADMIN' });
        const r1 = await startFor(boss, other.userId, { phone: randomSenegalPhone('76'), reason: 'Viser un Superadmin' });
        assert.deepEqual([r1.status, r1.body.code], [409, 'TARGET_IS_SUPERADMIN'], show(r1));
        const r2 = await startFor(boss, boss.userId, { phone: randomSenegalPhone('76'), reason: 'Mon numéro' });
        assert.deepEqual([r2.status, r2.body.code], [409, 'SELF_TARGET'], show(r2));
    });

    test('sans preuve du nouveau numéro : code faux (5 essais), demande d’un autre Superadmin, finalisation directe en base : refusés', async () => {
        const newPhone = randomSenegalPhone('76');
        const start = await startFor(boss, target.userId, { phone: newPhone, reason: 'Essai sans preuve' });
        assert.equal(start.status, 200, show(start));
        const requestId = String(start.body.request_id);
        const intruder = await newAdmin('f3d-tel-att-intrus', [], { role: 'SUPERADMIN' });
        await confirmIdentity(intruder);
        const stolen = await confirmFor(intruder, target.userId, { request_id: requestId, code: await lastSmsCode(newPhone) });
        assert.equal(stolen.status, 404, `demande d’un autre Superadmin : ${show(stolen)}`);
        const { data: direct, error } = await service.rpc('admin_phone_change_finalize', { p: { request_id: requestId, actor_id: boss.userId, session_id: sessionIdOf(boss.accessToken), device_key: `ses:${sessionIdOf(boss.accessToken)}` } });
        assert.equal(error, null, error?.message);
        assert.equal((direct as Row).code, 'NOT_VERIFIED', JSON.stringify(direct));
        const codes: CallResult[] = [];
        for (let i = 0; i < 5; i += 1) codes.push(await confirmFor(boss, target.userId, { request_id: requestId, code: '000000' }));
        assert.deepEqual(codes.map((r) => r.body.code), ['INVALID_CODE', 'INVALID_CODE', 'INVALID_CODE', 'INVALID_CODE', 'TOO_MANY_ATTEMPTS'], codes.map(show).join('\n'));
        const late = await confirmFor(boss, target.userId, { request_id: requestId, code: await lastSmsCode(newPhone) });
        assert.equal(late.status, 409, `le bon code après le blocage : ${show(late)}`);
        assert.equal(await phoneOf(target.userId), target.phoneE164, 'numéro inchangé sans preuve');
    });

    test('nouveau numéro déjà pris : 409 PHONE_TAKEN, aucun SMS', async () => {
        const owner = await newBuyer('f3d-tel-att-pris');
        const r = await startFor(boss, target.userId, { phone: owner.phoneE164, reason: 'Numéro déjà pris' });
        assert.deepEqual([r.status, r.body.code], [409, 'PHONE_TAKEN'], show(r));
    });

    test('quotas : au-delà de 3 demandes par jour pour un même compte, 429', async () => {
        const cible = await newAdmin('f3d-tel-att-quota', ['events.read']);
        const replies: number[] = [];
        for (let i = 0; i < 4; i += 1) replies.push((await startFor(boss, cible.userId, { phone: randomSenegalPhone('76'), reason: 'Essais répétés' })).status);
        assert.deepEqual(replies, [200, 200, 200, 429]);
    });
});

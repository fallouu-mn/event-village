/**
 * Lot 9 quater — comptes (A2 : AUD-01, AUD-03, G-36 ; A3 : AUD-02, G-04 ; A4 : AUD-19 ; A5 : G-97 ; A7 : AUD-12 ;
 * A8 : AUD-05). Base LOCALE (garde-fou tests/helpers/env.ts), faux MTarget, serveur de courrier local de la CI.
 *
 *  A2  inscription publique de GoTrue fermée ; les parcours serveur créent encore les comptes ; un compte sans numéro
 *      prouvé ne prend ni billet gratuit, ni panier, ni transfert : « Confirmez d'abord votre numéro de téléphone. »
 *  A3  PUT /auth/v1/user {password} avec le seul jeton : refusé, mot de passe inchangé ; marque « coquille » posée par
 *      l'utilisateur dans user_metadata : sans effet sur l'avis ; /api/auth/reset-password : session de récupération
 *      seule, règle commune côté serveur, sessions révoquées, avis PASSWORD_CHANGED.
 *  A4  adresse technique u<32 hex>@comptes.eventvillage.invalid, sans le numéro ; GoTrue n'émet aucun code ni lien
 *      email pour elle (/otp, /recover) ; connexion par code et par mot de passe, inscription d'un numéro existant :
 *      inchangées ; reprise des comptes existants (section 9 de 20261111000001) rejouée dans une transaction annulée.
 *  A5  contrôleur invité pas encore activé : ni code de connexion, ni « Mot de passe oublié », ni mot de passe ;
 *      activation : règle commune.
 *  A7  PATCH /api/controller/profile : compte ACTIF exigé, quota par compte.
 *  A8  la part des codes vers un numéro sans compte atteinte n'empêche pas un compte existant de recevoir son code ;
 *      alerte ADMIN_SMS_CAP_NEW_NUMBERS.
 * Rouge avant correctif (signUp accepté, PUT accepté, adresse <numéro>@eventvillage.sn, codes au contrôleur non activé,
 * route /api/auth/reset-password absente, migration 20261111000001 absente).
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { NextRequest } from 'next/server';
import { getFakes } from '../fakes';
import { inRolledBackTransaction } from '../helpers/db';
import { assertLot9quaterInvariants } from '../helpers/lot9quater-invariants';
import { BASE_URL, jsonRequest, randomSenegalPhone, STRONG_PASSWORD } from './helpers';
import { createSaleEvent, importModule, newBuyer, service, type Buyer } from './paiement-helpers';
import { newPartner, type TestPartner } from './finance-helpers';
import { authed, type RouteResult } from './acces-helpers';
import { advanceEventTo, createDraftEvent } from './cycle-helpers';
import { newAdmin, outboxRows, withEnv } from './notif-helpers';
import { registerClientFlow } from './terrain-helpers';

type Handler = (req: NextRequest, ctx?: unknown) => Promise<Response>;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const MAIL_API = 'http://127.0.0.1:54324/api/v1';
const TECH_RE = /^u[0-9a-f]{32}@comptes\.eventvillage\.invalid$/;
const PHONE_NOT_VERIFIED = 'Confirmez d’abord votre numéro de téléphone.';
const NOT_ACTIVATED = 'Activez d’abord votre compte contrôleur avec le lien reçu par SMS.';

after(async () => {
    await assertLot9quaterInvariants('lot9quater-comptes');
});

function anon() {
    return createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
}

let ipSeq = 0;
function ip(): Record<string, string> {
    ipSeq += 1;
    return { 'x-forwarded-for': `198.18.${(process.pid % 200) + 1}.${(ipSeq % 250) + 1}` };
}

async function call(modulePath: string, req: NextRequest, method = 'POST', ctx?: unknown): Promise<RouteResult> {
    const mod = await importModule(modulePath) as Record<string, Handler>;
    const res = await mod[method](req, ctx);
    const text = await res.text();
    let body: Record<string, unknown> = {};
    try { body = text ? JSON.parse(text) as Record<string, unknown> : {}; } catch { body = { raw: text.slice(0, 300) }; }
    return { status: res.status, body };
}

function show(r: RouteResult): string {
    return `HTTP ${r.status} ${JSON.stringify(r.body).slice(0, 300)}`;
}

async function gotrue(pathName: string, method: string, body: Record<string, unknown>, token?: string): Promise<{ status: number; text: string }> {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/${pathName}`, {
        method,
        headers: { apikey: ANON_KEY, 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(body),
    });
    return { status: res.status, text: (await res.text()).slice(0, 300) };
}

/** Messages reçus par `address` dans le serveur de courrier local (Mailpit) ; [] si aucun. */
async function mailsTo(address: string): Promise<number> {
    const res = await fetch(`${MAIL_API}/search?query=${encodeURIComponent(`to:"${address}"`)}`);
    assert.ok(res.ok, `serveur de courrier local : HTTP ${res.status}`);
    const data = await res.json() as { messages_count?: number; messages?: unknown[] };
    return Number(data.messages_count ?? (data.messages ?? []).length);
}

async function authEmail(userId: string): Promise<string> {
    const { data, error } = await service.auth.admin.getUserById(userId);
    assert.equal(error, null, `auth.users : ${error?.message}`);
    return String(data.user?.email ?? '');
}

async function signInWith(email: string, password: string): Promise<boolean> {
    const { data, error } = await anon().auth.signInWithPassword({ email, password });
    return !error && Boolean(data.session);
}

// ── A2 ─────────────────────────────────────────────────────────────────────

describe('A2 — inscription publique de GoTrue fermée, numéro prouvé exigé', () => {
    test('POST /auth/v1/signup (clé anon) est refusé et ne crée aucun compte', async () => {
        const email = `q-public-${randomBytes(5).toString('hex')}@test.eventvillage.local`;
        const res = await anon().auth.signUp({ email, password: `Public#${randomBytes(6).toString('hex')}A1` });
        console.log(`[A2] signUp public : erreur=${res.error?.code ?? res.error?.message ?? 'aucune'} utilisateur=${res.data.user?.id ?? 'aucun'}`);
        assert.ok(res.error, 'signUp public accepté');
        const { data } = await service.from('users').select('id').eq('email', email);
        assert.deepEqual(data ?? [], [], 'aucun compte créé');
    });

    test('les parcours serveur créent encore les comptes : inscription client, création par un admin', async () => {
        const flow = await registerClientFlow({ headers: ip() });
        assert.ok(flow.userId, 'inscription client');
        const { data: row } = await service.from('users').select('phone_verified_at, status').eq('id', flow.userId!).single();
        assert.ok(row?.phone_verified_at, 'numéro prouvé à l’inscription');
        const { newAdminWith } = await import('./terrain-helpers');
        const admin = await newAdminWith(['users.write'], { label: 'q-a2-admin' });
        const created = await call('../../app/api/admin/users/route', authed('/api/admin/users', 'POST', admin, {
            firstName: 'Cree', lastName: 'ParAdmin', phone: randomSenegalPhone('76'), password: STRONG_PASSWORD, role: 'CLIENT',
        }));
        assert.equal(created.status, 200, `création par un admin : ${show(created)}`);
    });

    test('compte sans numéro prouvé : billet gratuit, panier et transfert refusés (403 PHONE_NOT_VERIFIED)', async () => {
        const buyer = await newBuyer('q-a2-nonverifie');
        const { error } = await service.from('users').update({ phone_verified_at: null }).eq('id', buyer.userId);
        assert.equal(error, null, error?.message);
        const ev = await createSaleEvent('q-a2', [{ name: 'Gratuite', price: 0, total: 3, maxPerOrder: 1 }, { name: 'Std', price: 1_000, total: 3 }]);
        const free = await call('../../app/api/tickets/claim-free/route', authed('/api/tickets/claim-free', 'POST', buyer, { categoryId: ev.categories.Gratuite.id, quantity: 1 }));
        const cart = await call('../../app/api/checkout/route', authed('/api/checkout', 'POST', buyer, {
            items: [{ categoryId: ev.categories.Std.id, quantity: 1 }], payerPhone: buyer.phone9, operator: 'WAVE',
        }, { 'idempotency-key': randomBytes(16).toString('hex') }));
        console.log(`[A2] sans numéro prouvé : billet gratuit ${show(free)} ; panier ${show(cart)}`);
        for (const r of [free, cart]) {
            assert.equal(r.status, 403, show(r));
            assert.deepEqual([r.body.code, r.body.error], ['PHONE_NOT_VERIFIED', PHONE_NOT_VERIFIED], show(r));
        }
        const { data: cat } = await service.from('ticket_categories').select('sold_quantity').eq('id', ev.categories.Gratuite.id).single();
        assert.equal(cat?.sold_quantity, 0, 'aucun billet gratuit émis');
    });
});

// ── A3 ─────────────────────────────────────────────────────────────────────

describe('A3 — mot de passe : jamais avec le seul jeton, avis toujours, /reset-password réservé à la récupération', () => {
    test('PUT /auth/v1/user {password} avec le seul jeton : refusé, l’ancien mot de passe reste valable', async () => {
        const victim = await newBuyer('q-a3-put');
        const put = await gotrue('user', 'PUT', { password: `Vole#${randomBytes(6).toString('hex')}A1` }, victim.accessToken);
        console.log(`[A3] PUT /auth/v1/user {password} : HTTP ${put.status} ${put.text.slice(0, 120)}`);
        assert.notEqual(put.status, 200, 'GoTrue a accepté un nouveau mot de passe présenté avec le seul jeton');
        assert.equal(await signInWith(victim.email, STRONG_PASSWORD), true, 'l’ancien mot de passe ouvre toujours une session');
    });

    test('marque « coquille » écrite par l’utilisateur dans user_metadata : l’avis PASSWORD_CHANGED part quand même', async () => {
        const victim = await newBuyer('q-a3-marque');
        const flag = await gotrue('user', 'PUT', { data: { is_temporary_controller_account: true, controller_activation_pending: true } }, victim.accessToken);
        assert.equal(flag.status, 200, `précondition : métadonnées écrites par l’utilisateur : ${flag.text}`);
        const before = (await outboxRows({ type: 'PASSWORD_CHANGED', userId: victim.userId })).length;
        const next = `Nouveau#${randomBytes(6).toString('hex')}A1`;
        const r = await call('../../app/api/account/password/route', authed('/api/account/password', 'POST', victim, { current_password: STRONG_PASSWORD, new_password: next }));
        assert.equal(r.status, 200, `changement par l’application : ${show(r)}`);
        const afterRows = await outboxRows({ type: 'PASSWORD_CHANGED', userId: victim.userId });
        console.log(`[A3] avis PASSWORD_CHANGED : ${before} → ${afterRows.length} (${afterRows.map((x) => x.channel).join(', ')})`);
        assert.ok(afterRows.length > before, 'aucun avis après un changement de mot de passe');
        assert.ok(afterRows.some((x) => x.channel === 'SMS'), 'avis par SMS');
    });

    test('/api/auth/reset-password : refusé avec une session ordinaire ; après le code « Mot de passe oublié » : règle commune, sessions révoquées, avis', async () => {
        const user = await newBuyer('q-a3-reset');
        const ordinary = await call('../../app/api/auth/reset-password/route', authed('/api/auth/reset-password', 'POST', user, { password: `Autre#${randomBytes(6).toString('hex')}A1` }));
        assert.equal(ordinary.status, 403, `session ordinaire : ${show(ordinary)}`);
        assert.equal(ordinary.body.code, 'RECOVERY_SESSION_REQUIRED', show(ordinary));

        const since = getFakes().sms.messagesTo(user.phoneE164).length;
        const sent = await call('../../app/api/auth/send-otp/route', jsonRequest('/api/auth/send-otp', { phone: user.phoneE164, purpose: 'PASSWORD_RESET' }, ip()));
        assert.equal(sent.status, 200, show(sent));
        const code = getFakes().sms.messagesTo(user.phoneE164).slice(since).map((m) => m.message.match(/\b(\d{6})\b/)?.[1]).filter(Boolean).pop();
        assert.ok(code, 'code « Mot de passe oublié » reçu');
        const verified = await call('../../app/api/auth/verify-otp/route', jsonRequest('/api/auth/verify-otp', { phone: user.phoneE164, otpCode: code, purpose: 'PASSWORD_RESET' }, ip()));
        assert.equal(verified.status, 200, show(verified));
        const opened = await anon().auth.verifyOtp({ token_hash: String(verified.body.token_hash), type: 'magiclink' });
        assert.equal(opened.error, null, `session de récupération : ${opened.error?.message}`);
        const recovery: Buyer = { ...user, accessToken: opened.data.session!.access_token };

        const weak = await call('../../app/api/auth/reset-password/route', authed('/api/auth/reset-password', 'POST', recovery, { password: 'faible' }));
        assert.equal(weak.status, 400, `mot de passe faible : ${show(weak)}`);
        const before = (await outboxRows({ type: 'PASSWORD_CHANGED', userId: user.userId })).length;
        const next = `Recup#${randomBytes(6).toString('hex')}A1`;
        const ok = await call('../../app/api/auth/reset-password/route', authed('/api/auth/reset-password', 'POST', recovery, { password: next }));
        assert.equal(ok.status, 200, show(ok));
        assert.equal(await signInWith(user.email, next), true, 'le nouveau mot de passe ouvre une session');
        assert.equal(await signInWith(user.email, STRONG_PASSWORD), false, 'l’ancien ne l’ouvre plus');
        const { data: sessions } = await anon().auth.getUser(user.accessToken);
        assert.equal(sessions.user, null, 'l’ancienne session est révoquée');
        assert.ok((await outboxRows({ type: 'PASSWORD_CHANGED', userId: user.userId })).length > before, 'avis PASSWORD_CHANGED');
        const again = await call('../../app/api/auth/reset-password/route', authed('/api/auth/reset-password', 'POST', recovery, { password: `Encore#${randomBytes(6).toString('hex')}A1` }));
        assert.notEqual(again.status, 200, `l’autorisation de récupération ne sert qu’une fois : ${show(again)}`);
    });

    test('aucune décision de sécurité ne lit user_metadata (code de l’application et migrations du lot)', () => {
        const offenders: string[] = [];
        const walk = (dir: string) => {
            for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
                const full = path.join(dir, e.name);
                if (e.isDirectory()) walk(full);
                else if (/\.(ts|tsx)$/.test(e.name)) {
                    fs.readFileSync(full, 'utf8').split(/\r?\n/).forEach((line, i) => {
                        if (/user_metadata\??\.(is_temporary_controller_account|is_essai_fixture|role|roles)\b/.test(line)) offenders.push(`${full}:${i + 1} ${line.trim()}`);
                    });
                }
            }
        };
        for (const d of ['app', 'lib', 'components', 'scripts']) walk(path.join(process.cwd(), d));
        const sql = fs.readFileSync('supabase/migrations/20261111000001_lot9quater_comptes.sql', 'utf8')
            .split('\n').filter((l) => !/^\s*--/.test(l)).join('\n');
        if (/raw_user_meta_data\s*->>?\s*'is_temporary_controller_account'\s*\)\s*=|OLD\.raw_user_meta_data/.test(sql.replace(/UPDATE auth\.users[\s\S]*$/, ''))) {
            offenders.push('20261111000001 : une fonction lit encore raw_user_meta_data');
        }
        assert.deepEqual(offenders, [], offenders.join('\n'));
    });
});

// ── A4 ─────────────────────────────────────────────────────────────────────

describe('A4 — adresse technique non routable, aucun code email', () => {
    test('inscription : adresse u<32 hex>@comptes.eventvillage.invalid, sans le numéro ; connexion par numéro et mot de passe', async () => {
        const flow = await registerClientFlow({ headers: ip() });
        const tech = await authEmail(flow.userId!);
        console.log(`[A4] adresse technique d’un compte neuf : ${tech}`);
        assert.match(tech, TECH_RE);
        assert.ok(!tech.includes(flow.phone.replace(/\D/g, '').slice(3)), 'aucun chiffre du numéro');
        const login = await call('../../app/api/auth/login/route', jsonRequest('/api/auth/login', { identifier: flow.phone, password: STRONG_PASSWORD }, ip()));
        assert.equal(login.status, 200, `connexion par numéro : ${show(login)}`);
        const again = await registerClientFlow({ phone: flow.phone, headers: ip() }, { expectOk: false });
        assert.equal(again.start.status, 409, `inscription d’un numéro existant : HTTP ${again.start.status}`);
    });

    test('GoTrue n’émet aucun code ni lien email vers l’adresse technique (/otp, /recover), aucun message', async () => {
        const flow = await registerClientFlow({ headers: ip() });
        const tech = await authEmail(flow.userId!);
        const otp = await gotrue('otp', 'POST', { email: tech, create_user: false });
        const recover = await gotrue('recover', 'POST', { email: tech });
        const mails = await mailsTo(tech);
        console.log(`[A4] /otp ${tech} : HTTP ${otp.status} ${otp.text.slice(0, 100)} ; /recover : HTTP ${recover.status} ${recover.text.slice(0, 100)} ; messages : ${mails}`);
        assert.notEqual(otp.status, 200, 'code de connexion émis');
        assert.notEqual(recover.status, 200, 'lien de récupération émis');
        assert.equal(mails, 0, 'aucun message vers l’adresse technique');
    });

    test('connexion par code SMS : inchangée (lien de session interne, permis à usage unique)', async () => {
        const flow = await registerClientFlow({ headers: ip() });
        const since = getFakes().sms.messagesTo(flow.phone).length;
        const sent = await call('../../app/api/auth/send-otp/route', jsonRequest('/api/auth/send-otp', { phone: flow.phone, purpose: 'LOGIN' }, ip()));
        assert.equal(sent.status, 200, show(sent));
        const code = getFakes().sms.messagesTo(flow.phone).slice(since).map((m) => m.message.match(/\b(\d{6})\b/)?.[1]).filter(Boolean).pop();
        const verified = await call('../../app/api/auth/verify-otp/route', jsonRequest('/api/auth/verify-otp', { phone: flow.phone, otpCode: code, isLogin: true }, ip()));
        assert.equal(verified.status, 200, show(verified));
        const s = await anon().auth.verifyOtp({ token_hash: String(verified.body.token_hash), type: 'email' });
        assert.equal(s.error, null, `session ouverte par le code : ${s.error?.message}`);
        assert.equal(s.data.user?.id, flow.userId);
    });

    test('reprise des comptes existants (section 9 de 20261111000001) : adresse <numéro>@eventvillage.sn → technical_email_for(id), connexion gardée', async () => {
        const phone = randomSenegalPhone('77');
        const legacy = `${phone.replace('+', '')}@eventvillage.sn`;
        const { data, error } = await service.auth.admin.createUser({ email: legacy, phone, password: STRONG_PASSWORD, email_confirm: true, phone_confirm: true });
        assert.equal(error, null, `compte d’avant le lot : ${error?.message}`);
        const id = data.user!.id;
        const { error: upErr } = await service.from('users').update({ email: legacy, phone, status: 'ACTIF' }).eq('id', id);
        assert.equal(upErr, null, upErr?.message);
        const sql = fs.readFileSync('supabase/migrations/20261111000001_lot9quater_comptes.sql', 'utf8');
        const after = await inRolledBackTransaction(async (db) => {
            await db.query(sql);
            const a = await db.query<{ email: string }>('SELECT email FROM auth.users WHERE id = $1', [id]);
            const u = await db.query<{ email: string }>('SELECT email FROM public.users WHERE id = $1', [id]);
            const i = await db.query<{ email: string | null }>(`SELECT identity_data->>'email' AS email FROM auth.identities WHERE user_id = $1 AND provider = 'email'`, [id]);
            const left = await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM auth.users WHERE email ~ '^[0-9]+@eventvillage\\.sn$'`);
            return { auth: a.rows[0]?.email, users: u.rows[0]?.email, identities: i.rows.map((r) => r.email), left: left.rows[0].n };
        });
        const expected = `u${id.replace(/-/g, '')}@comptes.eventvillage.invalid`;
        console.log(`[A4] reprise : ${legacy} → ${JSON.stringify(after)}`);
        assert.deepEqual([after.auth, after.users, after.left], [expected, expected, 0]);
        assert.ok(after.identities.every((e) => e === expected), `identités : ${JSON.stringify(after.identities)}`);
    });

    test('adresse .invalid refusée à la saisie (profil, inscription)', async () => {
        const flow = await registerClientFlow({ email: `u${randomBytes(16).toString('hex')}@comptes.eventvillage.invalid`, headers: ip() }, { expectOk: false });
        assert.equal(flow.register?.status, 400, `inscription avec une adresse technique : HTTP ${flow.register?.status}`);
        assert.deepEqual([flow.register?.body.code, flow.register?.body.field], ['INVALID_FIELD', 'email']);
    });
});

// ── A5 ─────────────────────────────────────────────────────────────────────

describe('A5 — contrôleur invité pas encore activé : aucune connexion avant l’activation', () => {
    let partner: TestPartner;
    let eventId: string;

    before(async () => {
        partner = await newPartner('q-a5');
        const ev = await createDraftEvent(partner, 'q-a5', [{ name: 'Standard', price: 5_000, total: 20 }], { title: `Q A5 ${randomBytes(2).toString('hex')}`, startsInHours: 72 });
        await advanceEventTo(ev.eventId, 'PUBLIE', { partnerUserId: partner.userId });
        eventId = ev.eventId;
    });

    test('code de connexion, « Mot de passe oublié » et mot de passe refusés ; activation à la règle commune ; ensuite tout marche', async () => {
        const phone = randomSenegalPhone('76');
        const since = getFakes().sms.messagesTo(phone).length;
        const inv = await call('../../app/api/partner/team/invite/route', authed('/api/partner/team/invite', 'POST', partner, { phone, event_ids: [eventId], first_name: 'Moussa' }, ip()));
        assert.ok(inv.status === 200 || inv.status === 201, show(inv));
        const setupCode = getFakes().sms.messagesTo(phone).slice(since).map((m) => m.message.match(/\b(\d{6})\b/)?.[1]).filter(Boolean).pop();
        assert.ok(setupCode, 'code d’activation reçu');
        const { data: row } = await service.from('users').select('id').eq('phone', phone).single();
        const { data: auth } = await service.auth.admin.getUserById(String(row!.id));
        assert.equal(auth.user?.app_metadata?.controller_activation_pending, true, 'marque dans app_metadata');
        assert.equal(auth.user?.user_metadata?.is_temporary_controller_account, undefined, 'plus aucune marque dans user_metadata');

        const afterInvite = getFakes().sms.messagesTo(phone).length;
        const login = await call('../../app/api/auth/send-otp/route', jsonRequest('/api/auth/send-otp', { phone, purpose: 'LOGIN' }, ip()));
        const reset = await call('../../app/api/auth/send-otp/route', jsonRequest('/api/auth/send-otp', { phone, purpose: 'PASSWORD_RESET' }, ip()));
        const pwd = await call('../../app/api/auth/login/route', jsonRequest('/api/auth/login', { identifier: phone, password: STRONG_PASSWORD }, ip()));
        console.log(`[A5] contrôleur non activé : code ${show(login)} ; oublié ${show(reset)} ; mot de passe ${show(pwd)}`);
        for (const r of [login, reset, pwd]) {
            assert.equal(r.status, 403, show(r));
            assert.deepEqual([r.body.code, r.body.error], ['CONTROLLER_NOT_ACTIVATED', NOT_ACTIVATED], show(r));
        }
        assert.equal(getFakes().sms.messagesTo(phone).length, afterInvite, 'aucun SMS envoyé');

        const setup = (password: string) => call('../../app/api/controller/setup/route', jsonRequest('/api/controller/setup', { phone, otp_code: setupCode, new_password: password }, ip()));
        const weak = await setup('Abcdefg1');
        assert.equal(weak.status, 400, `mot de passe sans caractère spécial (règle commune, G-31) : ${show(weak)}`);
        const good = `Ctrl#${randomBytes(6).toString('hex')}A1`;
        const ok = await setup(good);
        assert.equal(ok.status, 200, show(ok));
        const relog = await call('../../app/api/auth/login/route', jsonRequest('/api/auth/login', { identifier: phone, password: good }, ip()));
        assert.equal(relog.status, 200, `connexion après l’activation : ${show(relog)}`);
        assert.deepEqual((await outboxRows({ type: 'PASSWORD_CHANGED', userId: String(row!.id) })).map((r) => r.channel), [], 'aucun avis à l’activation (première pose)');
    });
});

// ── A7 ─────────────────────────────────────────────────────────────────────

describe('A7 — PATCH /api/controller/profile', () => {
    async function controller(label: string): Promise<Buyer> {
        const c = await newBuyer(label);
        const { error } = await service.from('user_roles').upsert([{ user_id: c.userId, role: 'CONTROLEUR' }], { onConflict: 'user_id,role' });
        assert.equal(error, null, error?.message);
        return c;
    }

    test('compte suspendu : 403, mot de passe inchangé', async () => {
        const c = await controller('q-a7-susp');
        const { error } = await service.from('users').update({ status: 'SUSPENDU' }).eq('id', c.userId);
        assert.equal(error, null, error?.message);
        const r = await call('../../app/api/controller/profile/route', authed('/api/controller/profile', 'PATCH', c, { current_password: STRONG_PASSWORD, new_password: `Nouv#${randomBytes(6).toString('hex')}A1` }), 'PATCH');
        assert.equal(r.status, 403, show(r));
    });

    test('essais de l’ancien mot de passe limités par compte (même quota que /api/account/password)', async () => {
        const c = await controller('q-a7-quota');
        const statuses: number[] = [];
        await withEnv({ PASSWORD_CONFIRM_PER_ACCOUNT_15MIN: '3' }, async () => {
            for (let i = 0; i < 4; i += 1) {
                const r = await call('../../app/api/controller/profile/route', authed('/api/controller/profile', 'PATCH', c, { current_password: `Faux#${i}xxxxA1`, new_password: `Nouv#${randomBytes(6).toString('hex')}A1` }), 'PATCH');
                statuses.push(r.status);
            }
        });
        assert.deepEqual(statuses, [400, 400, 400, 429]);
    });
});

// ── A8 ─────────────────────────────────────────────────────────────────────

describe('A8 — part des codes vers un numéro sans compte', () => {
    test('part atteinte : inscription refusée, alerte admin ; un compte existant reçoit encore son code', async () => {
        const holder = await newBuyer('q-a8-titulaire');
        await newAdmin('q-a8-admin', ['notifications.read']); // destinataire de l'alerte
        const dayStart = `${new Date().toISOString().slice(0, 10)}T00:00:00Z`;
        const { error: resetErr } = await service.from('quota_counters').delete().in('scope', ['sms_otp_new_number']).eq('bucket', 'all').gte('window_start', dayStart);
        assert.equal(resetErr, null, resetErr?.message);
        await service.from('quota_counters').delete().eq('scope', 'sms_alert').eq('bucket', 'new_number_share').gte('window_start', dayStart);
        const result = await withEnv({ SMS_OTP_NEW_NUMBER_DAILY_CAP: '2' }, async () => {
            const starts: number[] = [];
            for (let i = 0; i < 3; i += 1) {
                const { registerStart } = await import('./terrain-helpers');
                starts.push((await registerStart(randomSenegalPhone('76'), ip())).status);
            }
            const since = getFakes().sms.messagesTo(holder.phoneE164).length;
            const login = await call('../../app/api/auth/send-otp/route', jsonRequest('/api/auth/send-otp', { phone: holder.phoneE164, purpose: 'LOGIN' }, ip()));
            return { starts, login, received: getFakes().sms.messagesTo(holder.phoneE164).length - since };
        });
        console.log(`[A8] inscriptions : ${result.starts.join(', ')} ; code du titulaire : ${show(result.login)} ; SMS : ${result.received}`);
        assert.deepEqual(result.starts, [200, 200, 429]);
        assert.equal(result.login.status, 200, show(result.login));
        assert.equal(result.received, 1);
        const { data: alerts } = await service.from('notification_outbox').select('id').eq('type', 'ADMIN_SMS_CAP_NEW_NUMBERS').gte('created_at', dayStart);
        assert.ok((alerts ?? []).length > 0, 'alerte ADMIN_SMS_CAP_NEW_NUMBERS mise en file');
    });
});

void BASE_URL;

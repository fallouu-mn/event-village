/**
 * Lot 7, tâche 7.0 d — preuves du code d'activation de l'invitation d'un contrôleur (contrat, section 4.4 ;
 * D22 ; discovery-7-dette.md §d.1). Le code envoyé par SMS à l'invitation d'un nouveau compte
 * (POST /api/partner/team/invite) active le compte par POST /api/controller/setup.
 *  1. (couverture) stocké haché : la ligne otp_codes CONTROLLER_SETUP porte code_hash = HMAC du numéro et du
 *     code (64 hexadécimaux), aucune colonne ne contient le code ;
 *  2. (couverture) lié au numéro : le bon code présenté avec un autre numéro invité est refusé, le code du
 *     premier numéro reste intact et l'active ensuite ;
 *  3. (couverture) essais limités par le mécanisme atomique de l'OTP : 5 mauvais essais, puis le bon code
 *     → TOO_MANY_ATTEMPTS (429), compte non activé ;
 *  4. (couverture) expiré après 24 h : expires_at ≈ invitation + 24 h (± 2 min) ; reculé en base locale →
 *     refusé (« expiré ») ;
 *  5. usage unique : trois POST /api/controller/setup simultanés avec le bon code → exactement une 200, les
 *     autres refusées, puis tout rejeu refusé ; seul le mot de passe de la requête acceptée ouvre la session ;
 *  6. nouvelle invitation du même numéro tant que le compte est temporaire → nouveau code par SMS, utilisable ;
 *     l'ancien code est refusé.
 * Les cas 1 à 4 sont déjà vrais sur le code actuel (couverture demandée par la consigne, verts dès l'écriture).
 *
 * Rouge avant correctif (fix(7.0d), app/api/controller/setup/route.ts et app/api/partner/team/invite/route.ts) :
 *  - 5 : le code est contrôlé sans être consommé, le mot de passe posé, puis le code consommé ; deux requêtes
 *    simultanées réussissent toutes les deux (la dernière impose son mot de passe) ;
 *  - 6 : une invitation d'un compte existant n'émet aucun code (route :356-371, `isNewUser` seulement).
 * Comptage des SMS par numéro neuf (faux MTarget) ; IP de test distinctes ; aucune horloge simulée.
 *
 * Lot 8 (8.2 v) : cas T1.2 de tests/legacy/security-fixes.test.ts porté, vert dès l'écriture : un compte établi garde
 * son mot de passe (ACCOUNT_ALREADY_CONFIGURED). Écart au legacy : code d'activation posé par storeOtp, le legacy
 * écrivait la colonne `code`, supprimée au lot 1C.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomInt } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { NextRequest } from 'next/server';
import { hashOtpCode, storeOtp } from '../../lib/auth/otp-store';
import { getFakes } from '../fakes';
import { BASE_URL, randomSenegalPhone, STRONG_PASSWORD } from './helpers';
import { importModule, newBuyer, service } from './paiement-helpers';
import { newPartner, type TestPartner } from './finance-helpers';
import { assignController, authed, type RouteResult } from './acces-helpers';
import { advanceEventTo, createDraftEvent, type DraftEvent } from './cycle-helpers';
import { assertTerrainInvariants } from './terrain-helpers';

after(async () => {
    await assertTerrainInvariants('activation-controleur');
});

type Row = Record<string, unknown>;
type Handler = (req: NextRequest, ctx?: unknown) => Promise<Response>;

const INVALID_MESSAGE = 'Code de vérification incorrect ou expiré.';
const EXPIRED_MESSAGE = 'Le code a expiré. Demandez-en un nouveau.';
const TOO_MANY_MESSAGE = 'Trop de tentatives infructueuses. Veuillez demander un nouveau code.';
const DAY_MS = 24 * 3600_000;

let partner: TestPartner;
let ev1: DraftEvent;
let ev2: DraftEvent;

async function publishedEvent(label: string): Promise<DraftEvent> {
    const ev = await createDraftEvent(partner, `activation-${label}`, [{ name: 'Standard', price: 5_000, total: 20 }], {
        title: `Activation ${randomBytes(2).toString('hex')}`, startsInHours: 72,
    });
    await advanceEventTo(ev.eventId, 'PUBLIE', { partnerUserId: partner.userId });
    return ev;
}

before(async () => {
    partner = await newPartner('activation-ctrl');
    ev1 = await publishedEvent('1');
    ev2 = await publishedEvent('2');
});

// ── Outils locaux ──────────────────────────────────────────────────────────

let ipSeq = 0;
function freshIp(): string {
    ipSeq += 1;
    return `198.18.${(process.pid % 200) + 1}.${(ipSeq % 250) + 1}`;
}

async function invoke(handler: Handler, req: NextRequest): Promise<RouteResult> {
    const res = await handler(req);
    const text = await res.text();
    let body: Row = {};
    try {
        body = text ? JSON.parse(text) : {};
    } catch (err) {
        body = { raw: text, parseError: (err as Error).message };
    }
    return { status: res.status, body };
}

function show(r: RouteResult): string {
    return `HTTP ${r.status} ${JSON.stringify(r.body).slice(0, 300)}`;
}

/** Invitation du partenaire de la suite pour `eventId` ; le corps peut être complété (confirm_promotion…). */
async function invite(phone: string, eventId: string, extra: Row = {}): Promise<RouteResult> {
    const { POST } = await importModule('../../app/api/partner/team/invite/route') as { POST: Handler };
    return invoke(POST, authed('/api/partner/team/invite', 'POST', partner,
        { phone, event_ids: [eventId], first_name: 'Moussa', ...extra }, { 'x-forwarded-for': `${freshIp()}, 10.0.0.1` }));
}

function newPassword(): string {
    return `Ctrl#${randomBytes(6).toString('hex')}A1`;
}

async function setup(phone: string, code: string, password: string = newPassword()): Promise<RouteResult> {
    const { POST } = await importModule('../../app/api/controller/setup/route') as { POST: Handler };
    return invoke(POST, new NextRequest(`${BASE_URL}/api/controller/setup`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-forwarded-for': `${freshIp()}, 10.0.0.1` },
        body: JSON.stringify({ phone, otp_code: code, new_password: password }),
    }));
}

/** Codes à 6 chiffres reçus par `phone` (faux MTarget) depuis le repère `since`. */
function codesSince(phone: string, since: number): string[] {
    return getFakes().sms.messagesTo(phone).slice(since)
        .map((m) => m.message.match(/\b(\d{6})\b/)?.[1])
        .filter((c): c is string => Boolean(c));
}

interface Invited { phone: string; code: string; invitedAt: number; answeredAt: number }

/** Nouveau numéro invité : compte temporaire créé, un SMS avec le code d'activation. */
async function invitedController(eventId: string = ev1.eventId): Promise<Invited> {
    const phone = randomSenegalPhone('76');
    const since = getFakes().sms.messagesTo(phone).length;
    const invitedAt = Date.now();
    const res = await invite(phone, eventId);
    const answeredAt = Date.now();
    assert.ok(res.status === 200 || res.status === 201, `invitation : ${show(res)}`);
    assert.equal(res.body.is_new_user, true, `nouveau compte contrôleur : ${show(res)}`);
    const codes = codesSince(phone, since);
    assert.equal(codes.length, 1, `un SMS d'invitation avec un code : ${JSON.stringify(getFakes().sms.messagesTo(phone).slice(since).map((m) => m.message))}`);
    return { phone, code: codes[0], invitedAt, answeredAt };
}

async function setupCodes(phone: string): Promise<Row[]> {
    const { data, error } = await service.from('otp_codes').select('*').eq('phone', phone).eq('purpose', 'CONTROLLER_SETUP').order('created_at');
    assert.equal(error, null, `otp_codes : ${error?.message}`);
    return (data ?? []) as Row[];
}

function otherCode(code: string): string {
    for (;;) {
        const c = String(randomInt(100000, 1000000));
        if (c !== code) return c;
    }
}

/** Le compte du numéro est encore un compte temporaire (aucun mot de passe défini par le contrôleur). */
async function isTemporary(phone: string): Promise<boolean> {
    const { data, error } = await service.from('users').select('id').eq('phone', phone).single();
    assert.equal(error, null, `compte du ${phone} : ${error?.message}`);
    const { data: auth, error: aErr } = await service.auth.admin.getUserById(String(data.id));
    assert.equal(aErr, null, `compte d'authentification : ${aErr?.message}`);
    return auth.user?.user_metadata?.is_temporary_controller_account === true;
}

/** Connexion par mot de passe (clé anon) avec l'email de connexion synthétique du contrôleur. */
async function canSignIn(phone: string, password: string): Promise<boolean> {
    const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await anon.auth.signInWithPassword({ email: `${phone.replace('+', '')}@eventvillage.sn`, password });
    return !error && Boolean(data.session);
}

// ── Cas ────────────────────────────────────────────────────────────────────

describe('7.0 d Code d’activation du contrôleur : haché, lié au numéro, essais limités, 24 h (couverture)', () => {
    test('stocké haché : code_hash = HMAC(numéro, code), 64 hexadécimaux ; aucune colonne ne contient le code', async () => {
        const c = await invitedController();
        const rows = await setupCodes(c.phone);
        assert.equal(rows.length, 1, `une ligne otp_codes CONTROLLER_SETUP pour le numéro : ${rows.length}`);
        const row = rows[0];
        assert.match(String(row.code_hash), /^[0-9a-f]{64}$/, 'code_hash : 64 hexadécimaux');
        assert.equal(row.code_hash, hashOtpCode(c.phone, c.code), 'code_hash = HMAC-SHA256 du numéro et du code reçu');
        const { code_hash: _hash, ...rest } = row;
        void _hash;
        const leaks = Object.entries(rest).filter(([, v]) => JSON.stringify(v ?? null).includes(c.code)).map(([k]) => k);
        assert.deepEqual(leaks, [], `colonnes qui contiennent le code : ${leaks.join(', ')}`);
        assert.equal(row.verified, false, 'code non consommé');
        assert.equal(Number(row.attempts), 0, 'aucun essai');
    });

    test('lié au numéro : le code de A présenté avec le numéro de B (invité) est refusé ; le code de A reste intact et active A', async () => {
        const a = await invitedController();
        const b = await invitedController();
        assert.notEqual(a.code, b.code, 'précondition : deux codes différents');
        const wrong = await setup(b.phone, a.code);
        assert.equal(wrong.status, 400, `code de A avec le numéro de B : ${show(wrong)}`);
        assert.equal(wrong.body.error, INVALID_MESSAGE, 'message du refus');
        const [rowA] = await setupCodes(a.phone);
        assert.equal(rowA.verified, false, 'code de A intact (non consommé)');
        assert.equal(Number(rowA.attempts), 0, 'aucun essai compté sur le code de A');
        assert.equal(await isTemporary(b.phone), true, 'compte de B non activé');
        const ok = await setup(a.phone, a.code);
        assert.equal(ok.status, 200, `témoin : le code de A active A (${show(ok)})`);
    });

    test('5 mauvais essais puis le bon code : TOO_MANY_ATTEMPTS (429), compte non activé', async () => {
        const c = await invitedController();
        const statuses: number[] = [];
        for (let i = 0; i < 5; i++) statuses.push((await setup(c.phone, otherCode(c.code))).status);
        assert.deepEqual(statuses, [400, 400, 400, 400, 429], `mauvais essais : ${statuses.join(', ')}`);
        const right = await setup(c.phone, c.code);
        assert.equal(right.status, 429, `bon code après 5 échecs : ${show(right)}`);
        assert.equal(right.body.error, TOO_MANY_MESSAGE, 'message TOO_MANY_ATTEMPTS');
        const [row] = await setupCodes(c.phone);
        assert.equal(Number(row.attempts), 5, `essais comptés en base : ${row.attempts}`);
        assert.equal(row.verified, false, 'code non consommé');
        assert.equal(await isTemporary(c.phone), true, 'compte toujours temporaire');
    });

    test('expiré après 24 h : expires_at ≈ invitation + 24 h (± 2 min) ; reculé en base locale → refusé', async () => {
        const c = await invitedController();
        const [row] = await setupCodes(c.phone);
        const exp = Date.parse(String(row.expires_at));
        assert.ok(exp >= c.invitedAt + DAY_MS - 120_000 && exp <= c.answeredAt + DAY_MS + 120_000,
            `expires_at ${String(row.expires_at)} : attendu entre ${new Date(c.invitedAt + DAY_MS - 120_000).toISOString()} et ${new Date(c.answeredAt + DAY_MS + 120_000).toISOString()}`);
        const { error } = await service.from('otp_codes').update({ expires_at: new Date(Date.now() - 60_000).toISOString() }).eq('id', String(row.id));
        assert.equal(error, null, `expiration reculée : ${error?.message}`);
        const res = await setup(c.phone, c.code);
        assert.equal(res.status, 400, `code expiré : ${show(res)}`);
        assert.equal(res.body.error, EXPIRED_MESSAGE, 'message « expiré »');
        assert.equal(await isTemporary(c.phone), true, 'compte non activé');
    });
});

describe('7.0 d Code d’activation : usage unique et renvoi (D22)', () => {
    test('trois activations simultanées avec le bon code : exactement une 200, puis tout rejeu refusé ; seul le mot de passe accepté ouvre la session', async () => {
        const c = await invitedController();
        const passwords = [newPassword(), newPassword(), newPassword()];
        const results = await Promise.all(passwords.map((p) => setup(c.phone, c.code, p)));
        const statuses = results.map((r) => r.status);
        const winners = statuses.flatMap((s, i) => (s === 200 ? [i] : []));
        assert.equal(winners.length, 1, `activations simultanées : une seule 200 attendue (statuts ${statuses.join(', ')} ; ${results.map(show).join(' | ')})`);
        assert.ok(statuses.every((s, i) => i === winners[0] || (s >= 400 && s < 500)), `les autres requêtes sont refusées (4xx) : ${statuses.join(', ')}`);
        const replay = await setup(c.phone, c.code, newPassword());
        assert.ok(replay.status >= 400 && replay.status < 500, `rejeu du code : ${show(replay)}`);
        const [row] = await setupCodes(c.phone);
        assert.equal(row.verified, true, 'code consommé');
        assert.equal(await isTemporary(c.phone), false, 'compte activé');
        const usable = await Promise.all(passwords.map((p) => canSignIn(c.phone, p)));
        assert.deepEqual(usable, passwords.map((_, i) => i === winners[0]), `seul le mot de passe de la requête acceptée ouvre la session (${JSON.stringify(usable)})`);
    });

    test('nouvelle invitation du même numéro (compte encore temporaire) : nouveau code par SMS, utilisable ; l’ancien est refusé', async () => {
        const c = await invitedController(ev1.eventId);
        const since = getFakes().sms.messagesTo(c.phone).length;
        const again = await invite(c.phone, ev2.eventId, { confirm_promotion: true });
        assert.ok(again.status === 200 || again.status === 201, `seconde invitation : ${show(again)}`);
        assert.equal(await isTemporary(c.phone), true, 'précondition : compte encore temporaire');
        const codes = codesSince(c.phone, since);
        assert.equal(codes.length, 1, `seconde invitation d'un compte temporaire : un nouveau code par SMS attendu (reçu ${JSON.stringify(getFakes().sms.messagesTo(c.phone).slice(since).map((m) => m.message))})`);
        const fresh = codes[0];
        assert.notEqual(fresh, c.code, 'nouveau code différent de l’ancien');
        const rows = await setupCodes(c.phone);
        assert.equal(rows.length, 2, `deux codes CONTROLLER_SETUP émis pour le numéro : ${rows.length}`);
        const old = await setup(c.phone, c.code);
        assert.equal(old.status, 400, `ancien code après la nouvelle invitation : ${show(old)}`);
        assert.equal(await isTemporary(c.phone), true, 'ancien code : compte non activé');
        const ok = await setup(c.phone, fresh);
        assert.equal(ok.status, 200, `nouveau code : ${show(ok)}`);
        assert.equal(await isTemporary(c.phone), false, 'compte activé par le nouveau code');
    });
});

describe('8.2 v — /api/controller/setup ne réécrit pas le mot de passe d’un compte établi (cas T1.2 porté)', () => {
    async function opensSession(email: string, password: string): Promise<boolean> {
        const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
        const { data, error } = await anon.auth.signInWithPassword({ email, password });
        return !error && Boolean(data.session);
    }

    test('compte établi affecté, code valide : 400 ACCOUNT_ALREADY_CONFIGURED, le mot de passe d’origine ouvre la session, le mot de passe présenté est refusé', async () => {
        const victim = await newBuyer('setup-etabli');
        await assignController(partner, victim.userId, ev1.eventId, false);
        const code = String(randomInt(100000, 1000000));
        await storeOtp(victim.phoneE164, code, new Date(Date.now() + 3600_000), 'CONTROLLER_SETUP');
        const stolen = newPassword();
        const res = await setup(victim.phoneE164, code, stolen);
        assert.equal(res.status, 400, `activation d’un compte établi : ${show(res)}`);
        assert.equal(res.body.code, 'ACCOUNT_ALREADY_CONFIGURED', show(res));
        assert.equal(res.body.redirect, '/login', `renvoi vers la connexion : ${show(res)}`);
        assert.equal(await opensSession(victim.email, STRONG_PASSWORD), true, 'le mot de passe d’origine ouvre toujours la session');
        assert.equal(await opensSession(victim.email, stolen), false, 'le mot de passe présenté est refusé');
    });
});

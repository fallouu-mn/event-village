/**
 * Lot 7 — 7.3 : inscription « numéro d'abord » (contrat §7.1, 3.6, D1, D61 ; écrivain « Client », W7).
 * Nouveau contrat (D1) : POST /api/auth/register/start { phone } envoie un code REGISTER (haché en base,
 * aucun compte) ; POST /api/auth/register { phone, code, firstName, lastName, password, email?, referralCode? }
 * vérifie et consomme le code (otp_check) AVANT de créer le compte, ACTIF avec phone_verified_at.
 *  1. start : aucun compte (auth.users, users), une ligne otp_codes REGISTER dont l'empreinte est celle du
 *     code reçu, un seul SMS ; numéro déjà inscrit → 409 PHONE_ALREADY_REGISTERED sans SMS ni code ; numéro
 *     invalide → 400 INVALID_PHONE ;
 *  2. register sans code → 400 REGISTRATION_CODE_REQUIRED ; mauvais code → 400 INVALID_CODE ; code expiré →
 *     400 CODE_EXPIRED ; 5 mauvais codes puis le bon → 429 TOO_MANY_ATTEMPTS (otp_check : 5 essais au plus,
 *     le 5e échec répond déjà TOO_MANY_ATTEMPTS, 20261102000002_lot5_dette.sql) ; jamais de compte ;
 *  3. bon code → compte ACTIF, phone_verified_at non nul, code consommé, aucun SMS de plus, connexion par mot
 *     de passe ; rejeu → 409, un seul compte ;
 *  4. mot de passe faible → 400 sans consommer d'essai (attempts = 0), puis le bon envoi passe ;
 *  5. un tiers ne bloque plus un numéro : start par un tiers, essai d'un code deviné refusé sans compte, puis
 *     inscription du titulaire avec son propre code → 200 ;
 *  6. parrainage conservé (« comme aujourd'hui », 3.6) : referralCode d'un parrain → relation
 *     CLIENT_TO_CLIENT aux taux de referral_config ;
 *  7. statique : app/register/page.tsx appelle /api/auth/register/start puis /api/auth/register, plus
 *     /api/auth/verify-otp ; garde PageHeader « Créer un compte » et @eventvillage.sn
 *     (notif-interface.test.ts:519-521) ; conserve ?redirect= (D61).
 *
 * Rouge avant correctif (fix(7.3s) pour les routes, fix(7.3e) pour l'écran) : app/api/auth/register/start
 * absent (registerStart échoue en le nommant) ; la route actuelle crée le compte ACTIF avant le code
 * (app/api/auth/register/route.ts:85-90,120) ; la page appelle /api/auth/register puis /api/auth/verify-otp.
 * Un en-tête x-forwarded-for neuf (TEST-NET-3) est envoyé à chaque démarrage : aucun couplage avec les quotas
 * par IP des autres suites.
 */
import '../helpers/env';
import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import ts from 'typescript';
import { hashOtpCode } from '../../lib/auth/otp-store';
import { getFakes } from '../fakes';
import { inspect } from '../helpers/db';
import { randomSenegalPhone, STRONG_PASSWORD } from './helpers';
import { newBuyer, service } from './paiement-helpers';
import {
    assertTerrainInvariants, lastSmsCode, newRegisterEmail, registerClientFlow, registerStart, registerSubmit,
} from './terrain-helpers';
import { gotrueEmail } from '../helpers/gotrue-email';

type Row = Record<string, unknown>;

let ipSeq = 0;
function freshIp(): Record<string, string> {
    ipSeq += 1;
    return { 'x-forwarded-for': `203.0.113.${(ipSeq % 250) + 1}` };
}

after(async () => {
    await assertTerrainInvariants('inscription-numero-dabord');
});

// ── Aides locales ──────────────────────────────────────────────────────────

function smsCount(phone: string): number {
    return getFakes().sms.messagesTo(phone).length;
}

/** Comptes portant ce numéro : auth.users (stocké sans « + ») et public.users (les deux formes). */
async function accountsFor(phone: string): Promise<{ auth: number; users: number }> {
    const bare = phone.replace(/^\+/, '');
    return inspect(async (db) => {
        const a = await db.query<{ n: string }>('SELECT count(*)::text AS n FROM auth.users WHERE phone = ANY($1::text[])', [[phone, bare]]);
        const u = await db.query<{ n: string }>('SELECT count(*)::text AS n FROM public.users WHERE phone = ANY($1::text[])', [[phone, bare]]);
        return { auth: Number(a.rows[0].n), users: Number(u.rows[0].n) };
    });
}

async function assertNoAccount(phone: string, what: string): Promise<void> {
    assert.deepEqual(await accountsFor(phone), { auth: 0, users: 0 }, `${what} : aucun compte pour ${phone}`);
}

async function registerCodes(phone: string): Promise<Row[]> {
    const { data, error } = await service.from('otp_codes').select('id, purpose, code_hash, verified, attempts, expires_at')
        .eq('phone', phone).eq('purpose', 'REGISTER').order('created_at', { ascending: true });
    assert.equal(error, null, `otp_codes de ${phone} : ${error?.message}`);
    return (data ?? []) as Row[];
}

function wrongCode(code: string, shift = 1): string {
    return String((Number(code) + shift) % 1_000_000).padStart(6, '0');
}

function profile(phone: string, code: string | null, extra: Row = {}): Row {
    const body: Row = { phone, firstName: 'Mariama', lastName: 'Numerodabord', password: STRONG_PASSWORD, ...extra };
    if (code !== null) body.code = code;
    return body;
}

/** Démarrage réussi et code reçu par SMS (échec explicite sinon). */
async function started(phone: string): Promise<string> {
    const since = smsCount(phone);
    const start = await registerStart(phone, freshIp());
    assert.equal(start.status, 200, `démarrage : HTTP ${start.status} ${JSON.stringify(start.body)}`);
    const code = lastSmsCode(phone, since);
    assert.ok(code, `aucun code à 6 chiffres reçu par SMS au ${phone}`);
    return code;
}

// ── 1. Démarrage ───────────────────────────────────────────────────────────

describe('7.3 — inscription : démarrage par le numéro (D1, contrat 3.6)', () => {
    test('start : réponse du contrat, aucun compte, une ligne otp_codes REGISTER hachée, un seul SMS', async () => {
        const phone = randomSenegalPhone('77');
        const since = smsCount(phone);
        const start = await registerStart(phone, freshIp());
        assert.equal(start.status, 200, `démarrage : HTTP ${start.status} ${JSON.stringify(start.body)}`);
        assert.deepEqual(
            { ok: start.body.ok, phone: start.body.phone, expires_in: start.body.expires_in, resend_after: start.body.resend_after },
            { ok: true, phone, expires_in: 600, resend_after: 60 }, `réponse : ${JSON.stringify(start.body)}`);
        assert.equal(smsCount(phone) - since, 1, 'un seul SMS envoyé');
        const code = lastSmsCode(phone, since);
        assert.ok(code, 'le SMS contient un code à 6 chiffres');
        await assertNoAccount(phone, 'après le démarrage');
        const rows = await registerCodes(phone);
        assert.equal(rows.length, 1, 'une ligne otp_codes REGISTER');
        assert.equal(rows[0].verified, false, 'code non consommé');
        assert.match(String(rows[0].code_hash), /^[0-9a-f]{64}$/, 'empreinte HMAC-SHA256');
        assert.equal(rows[0].code_hash, hashOtpCode(phone, code!), 'empreinte du code reçu (jamais le code en clair)');
        assert.ok(!JSON.stringify(rows[0]).includes(code!), 'le code en clair n\'est pas stocké');
    });

    test('numéro déjà inscrit → 409 PHONE_ALREADY_REGISTERED, aucun SMS, aucun code', async () => {
        const existing = await newBuyer('inscr-existant');
        const since = smsCount(existing.phoneE164);
        const r = await registerStart(existing.phoneE164, freshIp());
        assert.equal(r.status, 409, `numéro inscrit : HTTP ${r.status} ${JSON.stringify(r.body)}`);
        assert.equal(r.body.code, 'PHONE_ALREADY_REGISTERED', `code : ${JSON.stringify(r.body)}`);
        assert.equal(r.body.error, 'Ce numéro de téléphone est déjà associé à un compte. Veuillez vous connecter.', 'message du contrat 3.6');
        assert.equal(smsCount(existing.phoneE164), since, 'aucun SMS (facturé) pour un numéro déjà inscrit');
        assert.deepEqual(await registerCodes(existing.phoneE164), [], 'aucun code REGISTER enregistré');
    });

    test('numéro invalide → 400 INVALID_PHONE', async () => {
        const r = await registerStart('12345', freshIp());
        assert.equal(r.status, 400, `numéro invalide : HTTP ${r.status} ${JSON.stringify(r.body)}`);
        assert.equal(r.body.code, 'INVALID_PHONE', `code : ${JSON.stringify(r.body)}`);
    });
});

// ── 2. Code absent, faux, expiré, trop d'essais ────────────────────────────

describe('7.3 — inscription : le code est vérifié avant la création du compte', () => {
    test('sans code → 400 REGISTRATION_CODE_REQUIRED, aucun compte', async () => {
        const phone = randomSenegalPhone('77');
        await started(phone);
        const r = await registerSubmit(profile(phone, null));
        assert.equal(r.status, 400, `sans code : HTTP ${r.status} ${JSON.stringify(r.body)}`);
        assert.equal(r.body.code, 'REGISTRATION_CODE_REQUIRED', `code : ${JSON.stringify(r.body)}`);
        await assertNoAccount(phone, 'inscription sans code');
    });

    test('mauvais code → 400 INVALID_CODE ; code expiré → 400 CODE_EXPIRED ; aucun compte', async () => {
        const phone = randomSenegalPhone('77');
        const code = await started(phone);
        const bad = await registerSubmit(profile(phone, wrongCode(code)));
        assert.equal(bad.status, 400, `mauvais code : HTTP ${bad.status} ${JSON.stringify(bad.body)}`);
        assert.equal(bad.body.code, 'INVALID_CODE', `code : ${JSON.stringify(bad.body)}`);
        await assertNoAccount(phone, 'mauvais code');

        const { error } = await service.from('otp_codes').update({ expires_at: new Date(Date.now() - 60_000).toISOString() })
            .eq('phone', phone).eq('purpose', 'REGISTER');
        assert.equal(error, null, `échéance du code reculée en base locale : ${error?.message}`);
        const expired = await registerSubmit(profile(phone, code));
        assert.equal(expired.status, 400, `code expiré : HTTP ${expired.status} ${JSON.stringify(expired.body)}`);
        assert.equal(expired.body.code, 'CODE_EXPIRED', `code : ${JSON.stringify(expired.body)}`);
        await assertNoAccount(phone, 'code expiré');
    });

    test('5 mauvais codes puis le bon → 429 TOO_MANY_ATTEMPTS (5e et 6e essai), aucun compte', async () => {
        const phone = randomSenegalPhone('77');
        const code = await started(phone);
        const statuses: Array<[number, unknown]> = [];
        for (let i = 1; i <= 5; i++) {
            const r = await registerSubmit(profile(phone, wrongCode(code, i)));
            statuses.push([r.status, r.body.code]);
        }
        assert.deepEqual(statuses, [
            [400, 'INVALID_CODE'], [400, 'INVALID_CODE'], [400, 'INVALID_CODE'], [400, 'INVALID_CODE'], [429, 'TOO_MANY_ATTEMPTS'],
        ], 'essais 1 à 4 refusés, 5e : trop d\'essais (otp_check)');
        const sixth = await registerSubmit(profile(phone, code));
        assert.equal(sixth.status, 429, `6e essai avec le bon code : HTTP ${sixth.status} ${JSON.stringify(sixth.body)}`);
        assert.equal(sixth.body.code, 'TOO_MANY_ATTEMPTS', `code : ${JSON.stringify(sixth.body)}`);
        await assertNoAccount(phone, 'après 6 essais');
    });
});

// ── 3 et 4. Succès, rejeu, mot de passe faible ─────────────────────────────

describe('7.3 — inscription : bon code, compte vérifié', () => {
    test('bon code → compte ACTIF, phone_verified_at, code consommé, aucun SMS de plus, connexion par mot de passe ; rejeu → 409', async () => {
        const phone = randomSenegalPhone('77');
        const code = await started(phone);
        const smsAfterStart = smsCount(phone);
        const r = await registerSubmit(profile(phone, code));
        assert.equal(r.status, 200, `inscription : HTTP ${r.status} ${JSON.stringify(r.body)}`);
        assert.equal(r.body.success, true, `réponse : ${JSON.stringify(r.body)}`);
        assert.equal(r.body.phone, phone, 'numéro normalisé renvoyé');
        const userId = String(r.body.userId ?? '');
        assert.match(userId, /^[0-9a-f-]{36}$/, `userId : ${JSON.stringify(r.body)}`);
        const { data: user, error } = await service.from('users').select('status, phone, phone_verified_at, email').eq('id', userId).single();
        assert.equal(error, null, `profil : ${error?.message}`);
        assert.equal(user.status, 'ACTIF', 'compte ACTIF');
        assert.ok(user.phone_verified_at, 'phone_verified_at posé : le numéro est prouvé par le code');
        // Lot 9 quater (A4 : AUD-19) : adresse technique aléatoire sous .invalid, jamais tirée du numéro (modification signalée)
        assert.match(String(user.email), /^u[0-9a-f]{32}@comptes\.eventvillage\.invalid$/, 'email technique (aucun email fourni), sans le numéro');
        assert.equal(r.body.email, user.email, 'email renvoyé = email du compte');
        const [row] = await registerCodes(phone);
        assert.equal(row.verified, true, 'code consommé');
        assert.equal(smsCount(phone), smsAfterStart, 'la route d\'inscription n\'envoie plus de SMS');

        const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
        const { data: s, error: signErr } = await anon.auth.signInWithPassword({ email: await gotrueEmail(String(r.body.email)), password: STRONG_PASSWORD });
        assert.equal(signErr, null, `connexion par mot de passe : ${signErr?.message}`);
        assert.equal(s.user?.id, userId, 'session du compte créé');

        const replay = await registerSubmit(profile(phone, code));
        assert.equal(replay.status, 409, `rejeu du code : HTTP ${replay.status} ${JSON.stringify(replay.body)}`);
        assert.deepEqual(await accountsFor(phone), { auth: 1, users: 1 }, 'un seul compte pour ce numéro');
    });

    test('mot de passe faible → 400 sans consommer d\'essai, puis le bon envoi passe', async () => {
        const phone = randomSenegalPhone('77');
        const code = await started(phone);
        // Mot de passe faible généré (minuscules seules) : aucun mot de passe littéral dans tests/ (secrets-codes-en-dur).
        const weak = await registerSubmit(profile(phone, code, { password: 'x'.repeat(10) }));
        assert.equal(weak.status, 400, `mot de passe faible : HTTP ${weak.status} ${JSON.stringify(weak.body)}`);
        await assertNoAccount(phone, 'mot de passe faible');
        const [row] = await registerCodes(phone);
        assert.deepEqual({ attempts: row.attempts, verified: row.verified }, { attempts: 0, verified: false }, 'aucun essai consommé, code intact');
        const ok = await registerSubmit(profile(phone, code));
        assert.equal(ok.status, 200, `envoi corrigé : HTTP ${ok.status} ${JSON.stringify(ok.body)}`);
    });
});

// ── 5 et 6. Tiers, parrainage, email ───────────────────────────────────────

describe('7.3 — inscription : un tiers ne bloque plus un numéro ; parrainage et email conservés', () => {
    test('start par un tiers, code deviné refusé sans compte ; le titulaire s\'inscrit avec son propre code → 200', async () => {
        const phone = randomSenegalPhone('77');
        const tierCode = await started(phone);
        const guess = await registerSubmit(profile(phone, wrongCode(tierCode, 7), { firstName: 'Usurpateur', lastName: 'Tiers' }));
        assert.equal(guess.status, 400, `code deviné par le tiers : HTTP ${guess.status} ${JSON.stringify(guess.body)}`);
        await assertNoAccount(phone, 'tentative du tiers');
        const flow = await registerClientFlow({ phone, firstName: 'Awa', lastName: 'Titulaire', headers: freshIp() });
        assert.ok(flow.userId, 'compte du titulaire créé');
        const { data: user, error } = await service.from('users').select('first_name, last_name').eq('id', flow.userId!).single();
        assert.equal(error, null, `profil : ${error?.message}`);
        assert.deepEqual([user.first_name, user.last_name], ['Awa', 'Titulaire'], 'le compte est celui du titulaire');
    });

    test('code de parrainage : relation CLIENT_TO_CLIENT aux taux de referral_config ; email fourni en attente de vérification, lien envoyé', async () => {
        const sponsor = await newBuyer('inscr-parrain');
        const { data: sp, error: spErr } = await service.from('users').select('referral_code, referral_status').eq('id', sponsor.userId).single();
        assert.equal(spErr, null, `parrain : ${spErr?.message}`);
        assert.ok(sp.referral_code, 'précondition : code de parrainage du parrain (trigger set_referral_code_on_insert)');
        const { data: cfg, error: cfgErr } = await service.from('referral_config').select('rate_n1, rate_n2, duration_months')
            .eq('sponsor_status', sp.referral_status).eq('referral_type', 'CLIENT_TO_CLIENT').eq('is_active', true).single();
        assert.equal(cfgErr, null, `referral_config : ${cfgErr?.message}`);
        const email = newRegisterEmail('parrainage');
        const flow = await registerClientFlow({ referralCode: String(sp.referral_code).toLowerCase(), email, headers: freshIp() });
        const { data: rel, error: relErr } = await service.from('referral_relationships')
            .select('sponsor_id, referral_type, rate_n1_at_creation, rate_n2_at_creation, duration_months, is_active').eq('referred_id', flow.userId!);
        assert.equal(relErr, null, `relation : ${relErr?.message}`);
        assert.deepEqual((rel ?? []).map((r) => ({ ...r, rate_n1_at_creation: Number(r.rate_n1_at_creation), rate_n2_at_creation: Number(r.rate_n2_at_creation) })), [{
            sponsor_id: sponsor.userId, referral_type: 'CLIENT_TO_CLIENT', rate_n1_at_creation: Number(cfg.rate_n1), rate_n2_at_creation: Number(cfg.rate_n2),
            duration_months: cfg.duration_months, is_active: true,
        }], 'une relation parrain → filleul, taux figés à l\'inscription');
        // Lot 9 bis (R87, T60, contrat 4.6) : l'adresse fournie attend sa vérification ; users.email garde l'adresse technique.
        const { data: user, error } = await service.from('users').select('email').eq('id', flow.userId!).single();
        assert.equal(error, null, `profil : ${error?.message}`);
        assert.match(String(user.email), /^u[0-9a-f]{32}@comptes\.eventvillage\.invalid$/, 'R87 : adresse technique tant que l’adresse fournie n’est pas vérifiée (lot 9 quater : sans le numéro)');
        const { data: pending, error: pErr } = await service.from('users').select('email_pending, email_verified_at').eq('id', flow.userId!).single();
        assert.equal(pErr, null, `adresse en attente : ${pErr?.message} — colonnes users.email_pending et users.email_verified_at (M10 du lot 9 bis)`);
        assert.deepEqual([pending.email_pending, pending.email_verified_at], [email.toLowerCase(), null], 'email fourni enregistré en attente, non vérifié');
        assert.deepEqual(getFakes().email.messagesTo(email).map((m) => m.subject), ['Vérifiez votre adresse email — Event Village'],
            'un seul email à l’adresse fournie : le lien de vérification (11.1 N26)');
    });
});

// ── 7. Écran ───────────────────────────────────────────────────────────────

describe('7.3 — inscription : écran (statique, fix(7.3e))', () => {
    const printer = ts.createPrinter({ removeComments: true });
    const page = (): string => {
        const src = fs.readFileSync('app/register/page.tsx', 'utf8');
        return printer.printFile(ts.createSourceFile('page.tsx', src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX));
    };

    test('appelle /api/auth/register/start puis /api/auth/register, plus /api/auth/verify-otp', () => {
        const code = page();
        const start = code.search(/["'`]\/api\/auth\/register\/start["'`]/);
        const submit = code.search(/["'`]\/api\/auth\/register["'`]/);
        assert.ok(start >= 0, 'appel de /api/auth/register/start absent');
        assert.ok(submit >= 0, 'appel de /api/auth/register absent');
        assert.ok(start < submit, 'le numéro d\'abord : /start avant /api/auth/register');
        assert.doesNotMatch(code, /\/api\/auth\/verify-otp/, 'plus de vérification séparée par verify-otp (le code est vérifié par /api/auth/register)');
    });

    test('garde PageHeader « Créer un compte », aucune adresse tirée du numéro ; conserve ?redirect= (chemin interne seulement)', () => {
        const code = page();
        const sf = ts.createSourceFile('page.tsx', fs.readFileSync('app/register/page.tsx', 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
        const titles: string[] = [];
        const visit = (n: ts.Node): void => {
            if ((ts.isJsxOpeningElement(n) || ts.isJsxSelfClosingElement(n)) && n.tagName.getText(sf) === 'PageHeader') {
                for (const attr of n.attributes.properties) {
                    if (ts.isJsxAttribute(attr) && attr.name.getText(sf) === 'title' && attr.initializer) titles.push(attr.initializer.getText(sf));
                }
            }
            ts.forEachChild(n, visit);
        };
        visit(sf);
        assert.ok(titles.some((t) => t.includes('Créer un compte')), `PageHeader « Créer un compte » (notif-interface.test.ts:519-521) ; titres lus : ${titles.join(' | ') || 'aucun'}`);
        // Lot 9 quater (A4 : AUD-19) : l'écran ne fabrique plus l'adresse technique à partir du numéro (modification signalée)
        assert.doesNotMatch(code, /@eventvillage\.sn/, 'aucune adresse technique tirée du numéro dans l’écran');
        assert.match(code, /\.get\(\s*["']redirect["']\s*\)/, 'destination lue dans ?redirect= (D61)');
        const refusesExternal = /["'`]\/\/["'`]/.test(code) || /\\\/\\\//.test(code) || /\b(safe|internal|sanitiz)\w*(Redirect|Path)\w*\s*\(/i.test(code);
        assert.ok(refusesExternal, 'une destination « //… » (hors du site) est refusée (D61) : contrôle de « // » ou aide de chemin interne attendus');
    });
});

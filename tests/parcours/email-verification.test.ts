/**
 * Lot 9 bis, domaine G (contrat 5.47, 5.48, 4.6 ; décisions B96, B100 ; discovery-9bis-email 2, 3, 7) — l'email,
 * vrai canal : adresse visible à l'inscription et au profil, puis vérifiée par un lien avant de servir.
 *
 * Tâche 47 (statique, sans base) :
 *  - app/register/page.tsx : le champ « inscription-email » est rendu hors de l'accordéon `moreOptions`, après le mot de
 *    passe, libellé « Adresse email (facultative) », aide exacte « Recommandé : recevez vos billets et confirmations par
 *    email » ; l'accordéon devient « Plus d’options : code de parrainage » ; textes du lien envoyé ou non parti ;
 *  - components/profile/ProfileForm.tsx (et app/profile/page.tsx) : même aide, badges « Email vérifié » et « Email non
 *    vérifié », bouton « Renvoyer le lien » qui appelle /api/account/email/resend, texte « Lien envoyé à … » ;
 *  - app/partner/register/page.tsx : même aide (E-B).
 * Rouge aujourd'hui : le champ est dans la branche `moreOptions` (app/register/page.tsx:441), l'aide du profil est
 * « Facultative… » (ProfileForm.tsx:150), aucun badge ni bouton de renvoi, aucune route de renvoi.
 *
 * Tâche 48 (R87, G53-1 à 4, 6, 7, 11, 12 ; base locale) : une adresse saisie va dans users.email_pending, users.email et
 * auth.users gardent l'adresse technique (ou l'adresse déjà en place) ; un seul email part, le lien de vérification de
 * 24 h (11.1 N26) ; GoTrue ne fabrique aucun lien de récupération pour l'adresse saisie (R87-b) ; même règle pour
 * l'inscription partenaire en deux appels et la création par un admin (R87-c) et pour le profil (R87-d). La validation
 * (POST /api/account/email/verify, publique, sans session ouverte) aligne les deux tables ; lien expiré 410, réutilisé
 * 409, remplacé 400 ; adresse vérifiée ailleurs 409 EMAIL_TAKEN au profil comme à la validation ; deux validations
 * tenues en même temps en base : la seconde attend puis est refusée, sans interblocage (3.3, X28). Compte anonymisé
 * « …@deleted.eventvillage.sn » : jamais destinataire (B100), anonymisation d'un compte vérifié possible. Adresse
 * technique d'un autre numéro refusée à l'inscription. Quatrième renvoi dans l'heure → 429. Le jeton n'existe que dans
 * l'email : SHA-256 en base. Page /verify-email (statique) : jeton effacé, aucun référent, aucune validation au
 * chargement. Rouge aujourd'hui : aucune notion de vérification (grep vide), adresse saisie écrite dans GoTrue
 * (register/route.ts:114, :142-147 ; partner/register/route.ts:116-120 ; admin/users/route.ts:136-140 ;
 * profile/route.ts:54), règle de l'adresse technique `^[0-9]+@eventvillage\.sn$` (M/20261105000002:334-337).
 * Les changements d'adresse passent par la confirmation du mot de passe (R57, confirmPassword) : rouge aussi jusqu'à
 * fix(9b.13). Les colonnes et fonctions de M10 sont nommées par la garde de schéma du lot quand elles manquent.
 *
 * Les textes sont comparés mot pour mot, espaces insécables et apostrophes typographiques ramenées à leur forme simple
 * (la règle des espaces insécables avant « : » est celle de l'interface, pas celle du test).
 */
import '../helpers/env';
import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { createClient } from '@supabase/supabase-js';
import type { NextRequest } from 'next/server';
import { AdminService } from '../../lib/admin/admin.service';
import { NOTIFICATION_CATALOG } from '../../lib/notifications/catalog';
import { getFakes, type RecordedEmail } from '../fakes';
import { inspect, openConcurrentClient, waitForLockWaiters } from '../helpers/db';
import { LOT9BIS_MIGRATION, assertLot9bisInvariants, missingLot9bisSchema } from '../helpers/lot9bis-invariants';
import { callMiddleware } from '../helpers/middleware';
import { authed } from './acces-helpers';
import { superadminId } from './finance-helpers';
import {
    confirmPassword, jsonRequest, randomEmail, randomSenegalPhone, registerPartnerTwoStep, STRONG_PASSWORD, uploadRegistrationDocuments,
} from './helpers';
import { flushNotifications, loadLotModule, markEmailVerified, outboxRows } from './notif-helpers';
import { newBuyer, service, type Buyer } from './paiement-helpers';
import { newAdminWith, registerClientFlow } from './terrain-helpers';

after(async () => {
    await assertLot9bisInvariants('email-verification');
});

const ROOT = process.cwd();
/** Aide exacte de la consigne (G.47), à l'inscription client, à l'inscription partenaire et au profil. */
const EMAIL_HINT = 'Recommandé : recevez vos billets et confirmations par email';

// ── Lecture des sources ────────────────────────────────────────────────────

/** Espaces (insécables comprises) réduites à une espace simple, apostrophes typographiques ramenées à « ' ». */
function norm(s: string): string {
    return s.replace(/[  ]/g, ' ').replace(/[’‘]/g, '\'').replace(/\s+/g, ' ').trim();
}

function readSource(rel: string, why: string): string {
    const abs = path.resolve(ROOT, rel);
    assert.ok(fs.existsSync(abs), `${rel} absent (${why})`);
    return fs.readFileSync(abs, 'utf8');
}

/** Fichier d'un import « @/… » du dépôt (.ts, .tsx ou index), null s'il n'existe pas. */
function resolveAlias(spec: string): string | null {
    const base = spec.replace(/^@\//, '');
    for (const candidate of [`${base}.tsx`, `${base}.ts`, `${base}/index.tsx`, `${base}/index.ts`]) {
        if (fs.existsSync(path.resolve(ROOT, candidate))) return candidate;
    }
    return null;
}

/**
 * Source normalisée du fichier et de ses imports directs « @/components/… » et « @/lib/… » : un texte déplacé dans un
 * composant ou un module de textes reste trouvé, sans élargir la recherche au reste du dépôt.
 */
function sourceWithImports(rel: string, why: string): string {
    const src = readSource(rel, why);
    const parts = [src];
    for (const m of Array.from(src.matchAll(/from\s+['"](@\/(?:components|lib)\/[^'"]+)['"]/g))) {
        const file = resolveAlias(m[1]);
        if (file) parts.push(fs.readFileSync(path.resolve(ROOT, file), 'utf8'));
    }
    return norm(parts.join('\n'));
}

function tsxFile(rel: string, why: string): ts.SourceFile {
    return ts.createSourceFile(rel, readSource(rel, why), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
}

type JsxOpening = ts.JsxOpeningElement | ts.JsxSelfClosingElement;

/** Valeur littérale d'un attribut JSX (« … », {'…'} ou {`…`} sans substitution), null sinon. */
function attrValue(el: JsxOpening, name: string): string | null {
    for (const prop of el.attributes.properties) {
        if (!ts.isJsxAttribute(prop) || prop.name.getText() !== name || !prop.initializer) continue;
        const init = prop.initializer;
        if (ts.isStringLiteral(init)) return init.text;
        if (ts.isJsxExpression(init) && init.expression
            && (ts.isStringLiteral(init.expression) || ts.isNoSubstitutionTemplateLiteral(init.expression))) return init.expression.text;
    }
    return null;
}

/** Éléments JSX dont l'attribut `id` vaut littéralement `id`. */
function elementsWithId(sf: ts.SourceFile, id: string): JsxOpening[] {
    const found: JsxOpening[] = [];
    const visit = (n: ts.Node): void => {
        if ((ts.isJsxOpeningElement(n) || ts.isJsxSelfClosingElement(n)) && attrValue(n, 'id') === id) found.push(n);
        ts.forEachChild(n, visit);
    };
    visit(sf);
    return found;
}

/** Conditions qui gardent le rendu de `node` : côté gauche des « && » et « || », condition des « ? : ». */
function renderGuards(node: ts.Node): string[] {
    const guards: string[] = [];
    let child: ts.Node = node;
    for (let n: ts.Node | undefined = node.parent; n; child = n, n = n.parent) {
        if (ts.isBinaryExpression(n) && n.right === child
            && (n.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken || n.operatorToken.kind === ts.SyntaxKind.BarBarToken)) {
            guards.push(n.left.getText());
        }
        if (ts.isConditionalExpression(n) && n.condition !== child) guards.push(n.condition.getText());
    }
    return guards;
}

/** Identifiants (`id`) des éléments JSX qui contiennent `node`. */
function enclosingIds(node: ts.Node): string[] {
    const ids: string[] = [];
    for (let n: ts.Node | undefined = node.parent; n; n = n.parent) {
        if (ts.isJsxElement(n)) {
            const id = attrValue(n.openingElement, 'id');
            if (id) ids.push(id);
        }
    }
    return ids;
}

function assertText(haystack: string, expected: string, what: string): void {
    assert.ok(haystack.includes(norm(expected)), `${what} : texte « ${expected} » absent`);
}

// ── Tâche 47 : inscription ─────────────────────────────────────────────────

describe('9b.47 G.47 — inscription client : l’email n’est plus caché (app/register/page.tsx, E-G)', () => {
    const REGISTER = 'app/register/page.tsx';
    const WHY = 'écran d’inscription, contrat 5.47';

    test('le champ « inscription-email » est rendu hors de l’accordéon moreOptions, après le mot de passe', () => {
        const sf = tsxFile(REGISTER, WHY);
        const fields = elementsWithId(sf, 'inscription-email');
        assert.equal(fields.length, 1, `un seul champ id="inscription-email" attendu (trouvé ${fields.length})`);
        const guards = renderGuards(fields[0]);
        assert.ok(!guards.some((g) => /moreOptions/.test(g)),
            `le champ email est encore rendu sous condition de l’accordéon (G.47 : « n’est plus caché ») : ${guards.join(' | ')}`);
        assert.ok(!enclosingIds(fields[0]).includes('inscription-options'), 'le champ email est encore dans le bloc « inscription-options »');
        const password = elementsWithId(sf, 'inscription-mot-de-passe');
        assert.equal(password.length, 1, 'champ id="inscription-mot-de-passe" attendu');
        assert.ok(fields[0].getStart() > password[0].getStart(), 'le champ email vient après le mot de passe (contrat 5.47, E-G)');
    });

    test('libellé « Adresse email (facultative) » et aide exacte « Recommandé : recevez vos billets et confirmations par email »', () => {
        const [field] = elementsWithId(tsxFile(REGISTER, WHY), 'inscription-email');
        assert.ok(field, 'champ id="inscription-email" absent');
        assert.equal(norm(attrValue(field, 'label') ?? ''), norm('Adresse email (facultative)'), 'libellé du champ');
        assert.equal(norm(attrValue(field, 'hint') ?? ''), norm(EMAIL_HINT),
            `aide du champ (G.47, mot pour mot) ; lue : « ${attrValue(field, 'hint') ?? 'aucune aide littérale'} »`);
    });

    test('l’accordéon ne porte plus que le code de parrainage : « Plus d’options : code de parrainage »', () => {
        const src = norm(readSource(REGISTER, WHY));
        assertText(src, 'Plus d’options : code de parrainage', 'accordéon de l’inscription');
        assert.ok(!src.includes(norm('Plus d’options : email, code de parrainage')), 'l’accordéon annonce encore l’email');
    });

    test('textes après l’inscription : lien envoyé (valable 24 heures) ou lien non parti, renvoi depuis le profil', () => {
        const src = sourceWithImports(REGISTER, WHY);
        assertText(src, 'Un lien de vérification a été envoyé à', 'inscription réussie avec email');
        assertText(src, 'Il est valable 24 heures.', 'inscription réussie avec email');
        assertText(src, 'Le lien n’a pas pu être envoyé. Renvoyez-le depuis votre profil.', 'lien non parti');
    });
});

describe('9b.47 G.47 — inscription partenaire : même aide (app/partner/register/page.tsx, E-B)', () => {
    test('aide exacte sous l’email professionnel', () => {
        const src = sourceWithImports('app/partner/register/page.tsx', 'inscription partenaire, contrat 5.47');
        assertText(src, EMAIL_HINT, 'inscription partenaire');
    });
});

// ── Tâche 47 : profil ──────────────────────────────────────────────────────

describe('9b.47 G.47, R87 — profil : aide, état de l’adresse, renvoi du lien (ProfileForm.tsx, profile/page.tsx, E-G)', () => {
    const FORM = 'components/profile/ProfileForm.tsx';
    const PAGE = 'app/profile/page.tsx';
    const WHY = 'profil, contrat 5.47';
    const profileSources = (): string => `${sourceWithImports(FORM, WHY)}\n${sourceWithImports(PAGE, WHY)}`;

    test('ProfileForm : aide exacte du champ email, plus « Facultative… »', () => {
        const src = norm(readSource(FORM, WHY));
        assertText(src, EMAIL_HINT, 'aide du champ email du profil');
        assert.ok(!src.includes(norm('Facultative. Laissez ce champ vide si vous n’en avez pas.')), 'ancienne aide encore présente (ProfileForm.tsx:150)');
    });

    // Lot 9 quinquies (B5, modification signalée) : bandeau « Adresse email non vérifiée » et « Recevoir le lien de vérification »
    test('état de l’adresse : badge « Email vérifié » et bandeau « Adresse email non vérifiée »', () => {
        const src = profileSources();
        assertText(src, 'Email vérifié', 'badge d’une adresse vérifiée');
        assertText(src, 'Adresse email non vérifiée', 'bandeau d’une adresse en attente (R87, B5)');
    });

    test('« Recevoir le lien de vérification » présent et appelle POST /api/account/email/resend ; texte « Lien envoyé à … Il est valable 24 heures. »', () => {
        const src = profileSources();
        assertText(src, 'Recevoir le lien de vérification', 'bouton de renvoi (R87, B5)');
        assert.match(src, /["'`]\/api\/account\/email\/resend["'`]/, 'le profil n’appelle pas /api/account/email/resend');
        assertText(src, 'Lien envoyé à', 'renvoi réussi');
        assertText(src, 'Il est valable 24 heures.', 'renvoi réussi');
    });
});

// ═══ Tâche 48 : R87, vérification de l'adresse (routes et base locale) ═══════

type Row = Record<string, unknown>;
type Handler = (req: NextRequest) => Promise<Response>;

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? '').replace(/\/+$/, '');
const VERIFY_ROUTE = '../../app/api/account/email/verify/route';
const RESEND_ROUTE = '../../app/api/account/email/resend/route';
const PROFILE_ROUTE = '../../app/api/account/profile/route';
const ADMIN_USERS_ROUTE = '../../app/api/admin/users/route';
/** Email de vérification (11.1 N26, discovery-9bis-email 5), textes mot pour mot. */
const VERIFY_MAIL = {
    subject: 'Vérifiez votre adresse email — Event Village',
    title: 'Vérifiez votre adresse email',
    paragraph: 'Vous avez indiqué cette adresse pour votre compte Event Village. Confirmez-la pour recevoir vos billets et vos confirmations par email.',
    button: 'Vérifier mon adresse',
    note: 'Ce lien est valable 24 heures et ne sert qu’une fois. Si vous n’êtes pas à l’origine de cette demande, ignorez ce message : l’adresse ne sera pas ajoutée.',
} as const;
const TOKEN_RE = /\/verify-email\?t=([A-Za-z0-9_-]+)/;

interface Reply { status: number; body: Row; text: string; cookies: string[] }

async function reply(res: Response): Promise<Reply> {
    const text = await res.text();
    let body: Row = {};
    try {
        body = text ? JSON.parse(text) as Row : {};
    } catch (err) {
        assert.fail(`réponse non JSON (${err instanceof Error ? err.message : String(err)}) : ${text.slice(0, 200)}`);
    }
    return { status: res.status, body, text, cookies: res.headers.getSetCookie() };
}

async function routeFn(rel: string, method: 'POST' | 'PATCH', what: string): Promise<Handler> {
    const mod = await loadLotModule(rel, what);
    assert.equal(typeof mod[method], 'function', `${what} : ${method} non exporté`);
    return mod[method] as Handler;
}

let ipSeq = 0;
/** IP neuve (plage de test 198.18.0.0/15) : aucun couplage avec les quotas par IP des autres suites. */
function freshIp(): Record<string, string> {
    ipSeq += 1;
    return { 'x-forwarded-for': `198.18.${(process.pid % 200) + 1}.${(ipSeq % 250) + 1}` };
}

/** Ancienne adresse technique tirée du numéro (domaine réservé, refusée à la saisie). */
function technical(phone: string): string {
    return `${phone.replace('+', '')}@eventvillage.sn`;
}

/**
 * Lot 9 quater (A4 : AUD-19) : adresse technique d'un compte à numéro, aléatoire sous .invalid, jamais tirée du numéro
 * (modification signalée au rapport : les égalités à technical(numéro) deviennent ce motif).
 */
const TECH_RE = /^u[0-9a-f]{32}@comptes\.eventvillage\.invalid$/;

function sha256(token: string): string {
    return createHash('sha256').update(token).digest('hex');
}

function show(r: Reply): string {
    return `HTTP ${r.status} ${r.text.slice(0, 300)}`;
}

/** Emails enregistrés par le faux Resend pour cette adresse (toutes issues). */
function mailsTo(address: string): RecordedEmail[] {
    return getFakes().email.messagesTo(address);
}

/** Jeton d'un email de vérification (lien `{APP_URL}/verify-email?t=…`, version texte puis HTML). */
function tokenOf(mail: RecordedEmail): string {
    const m = TOKEN_RE.exec(mail.text ?? '') ?? TOKEN_RE.exec(mail.html);
    assert.ok(m, `email « ${mail.subject} » sans lien /verify-email?t=…`);
    return m[1];
}

/** Contrôle de l'email de vérification (11.1 N26) ; rend son jeton. */
function assertVerificationMail(mail: RecordedEmail, address: string): string {
    assert.equal(mail.subject, VERIFY_MAIL.subject, 'sujet de l’email de vérification (N26)');
    assert.deepEqual(mail.to.map((t) => t.toLowerCase()), [address.toLowerCase()], 'destinataire : l’adresse saisie seule');
    const text = norm(mail.text ?? '');
    for (const part of [VERIFY_MAIL.title, VERIFY_MAIL.paragraph, VERIFY_MAIL.button, VERIFY_MAIL.note]) {
        assertText(text, part, 'email de vérification (11.1 N26)');
    }
    assert.ok(text.includes(`${APP_URL}/verify-email?t=`), `lien vers ${APP_URL}/verify-email?t=… attendu`);
    assert.equal(/<img/i.test(mail.html), false, 'aucune image ni QR dans l’email (G.51)');
    for (const m of Array.from(mail.html.matchAll(/href="([^"]+)"/g))) {
        const href = m[1].replace(/&amp;/g, '&');
        assert.ok(href.startsWith(`${APP_URL}/`) || href.startsWith('mailto:'), 'lien hors de l’application dans l’email de vérification');
    }
    const token = tokenOf(mail);
    assert.match(token, /^[A-Za-z0-9_-]{43,}$/, 'jeton base64url de 256 bits au moins');
    return token;
}

/** Dernier email de vérification reçu par `address` après les `since` premiers ; échoue s'il n'y en a aucun. */
function lastToken(address: string, since: number): string {
    const mails = mailsTo(address).slice(since).filter((m) => m.subject === VERIFY_MAIL.subject);
    assert.ok(mails.length > 0, `aucun email de vérification reçu par ${address}`);
    return assertVerificationMail(mails[mails.length - 1], address);
}

interface Account { email: string | null; email_pending: string | null; email_verified_at: string | null }

async function accountOf(userId: string): Promise<Account> {
    const { data, error } = await service.from('users').select('email, email_pending, email_verified_at').eq('id', userId).single();
    assert.equal(error, null, `compte ${userId} : ${error?.message} — colonnes users.email_pending et users.email_verified_at, ${LOT9BIS_MIGRATION.M10}`);
    return data as Account;
}

async function authEmail(userId: string): Promise<string | undefined> {
    const { data, error } = await service.auth.admin.getUserById(userId);
    assert.equal(error, null, `auth.users : ${error?.message}`);
    return data.user?.email;
}

async function userIdByPhone(phone: string): Promise<string> {
    const { data, error } = await service.from('users').select('id').eq('phone', phone);
    assert.equal(error, null, `compte du ${phone} : ${error?.message}`);
    assert.equal((data ?? []).length, 1, `un compte pour ${phone} (trouvé ${(data ?? []).length})`);
    return String(data![0].id);
}

async function signInError(email: string): Promise<string | null> {
    const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
    const { error } = await anon.auth.signInWithPassword({ email, password: STRONG_PASSWORD });
    return error ? error.message : null;
}

/** Objets de M10 (colonnes, table, fonctions de l'email) nommés par la garde de schéma du lot : aucun ne doit manquer. */
async function requireEmailSchema(what: string): Promise<void> {
    const missing = (await missingLot9bisSchema()).filter((m) => m.includes(LOT9BIS_MIGRATION.M10));
    assert.deepEqual(missing, [], `${what} : schéma de l'email incomplet`);
}

async function auditFor(userId: string, action: string): Promise<Row[]> {
    const { data, error } = await service.from('audit_logs').select('*').eq('action', action).or(`user_id.eq.${userId},object_id.eq.${userId}`);
    assert.equal(error, null, `audit_logs : ${error?.message}`);
    return (data ?? []) as Row[];
}

// R57 : mot de passe confirmé une fois par session avant un changement d'adresse (10 minutes, quota par compte).
const confirmedSessions = new Map<string, Promise<void>>();

async function confirmOnce(user: Buyer): Promise<void> {
    if (!confirmedSessions.has(user.accessToken)) confirmedSessions.set(user.accessToken, confirmPassword(user, STRONG_PASSWORD));
    await confirmedSessions.get(user.accessToken);
}

/** PATCH /api/account/profile comme l'écran : mot de passe confirmé (R57), puis prénom, nom et adresse. */
async function patchEmail(user: Buyer, email: string): Promise<Reply> {
    await confirmOnce(user);
    const PATCH = await routeFn(PROFILE_ROUTE, 'PATCH', 'PATCH /api/account/profile');
    return reply(await PATCH(authed('/api/account/profile', 'PATCH', user, { first_name: user.firstName, last_name: user.lastName, email })));
}

/** Adresse mise en attente par le profil (200 et email_pending exigés) ; rend le jeton du lien reçu. */
async function pendingVia(user: Buyer, address: string): Promise<string> {
    const since = mailsTo(address).length;
    const r = await patchEmail(user, address);
    assert.equal(r.status, 200, `profil : ${show(r)}`);
    assert.equal(r.body.email_pending, address.toLowerCase(), `réponse du profil : adresse en attente (contrat 4.6) : ${show(r)}`);
    return lastToken(address, since);
}

/** POST /api/account/email/verify { token } : publique, aucune session. */
async function verify(token: string): Promise<Reply> {
    const POST = await routeFn(VERIFY_ROUTE, 'POST', 'route POST /api/account/email/verify (contrat 4.6, fix(9b.48))');
    return reply(await POST(jsonRequest('/api/account/email/verify', { token })));
}

/** POST /api/account/email/resend, session du compte. */
async function resend(user: Pick<Buyer, 'accessToken'> & Partial<Buyer>): Promise<Reply> {
    const POST = await routeFn(RESEND_ROUTE, 'POST', 'route POST /api/account/email/resend (contrat 4.6, fix(9b.48))');
    return reply(await POST(authed('/api/account/email/resend', 'POST', user as Buyer, {})));
}

/** notif_enqueue validé (COMMIT), comme une RPC appelée par l'application. */
async function commitEnqueue(p: Row): Promise<void> {
    const db = await openConcurrentClient({ applicationName: 'ev-test-email-enqueue' });
    try {
        await db.query('SELECT public.notif_enqueue($1::jsonb)', [JSON.stringify(p)]);
        await db.commit();
    } finally {
        await db.close();
    }
}

function catalogSample(type: string): Row {
    const tpl = (NOTIFICATION_CATALOG as unknown as Record<string, { sample?: Row }>)[type];
    assert.ok(tpl?.sample, `${type} absent du catalogue`);
    return { ...tpl.sample };
}

// ── R87 : inscription ──────────────────────────────────────────────────────

describe('9b.48 R87 — inscription : l’adresse saisie attend sa vérification, GoTrue garde l’adresse technique', () => {
    test('R87-a client : auth.users et users.email techniques, email_pending = X, un seul email (le lien de vérification, N26)', async () => {
        const address = randomEmail('r87a');
        const since = mailsTo(address).length;
        const flow = await registerClientFlow({ email: address, headers: freshIp() });
        const tech = String(await authEmail(flow.userId!));
        assert.match(tech, TECH_RE,
            'R87 : auth.users.email doit rester l’adresse technique tant que X n’est pas vérifiée (aujourd’hui X, register/route.ts:114, :142-147)');
        assert.deepEqual([flow.register!.body.email, flow.register!.body.email_pending, flow.register!.body.email_verification], [tech, address, 'SENT'],
            `réponse : email technique (connexion de l’écran), email_pending, email_verification (contrat 4.6) : ${JSON.stringify(flow.register!.body)}`);
        const mails = mailsTo(address).slice(since);
        assert.deepEqual(mails.map((m) => m.subject), [VERIFY_MAIL.subject], 'un seul email à X : le lien de vérification, aucun autre');
        assertVerificationMail(mails[0], address);
        assert.equal(mailsTo(tech).length, 0, 'rien à l’adresse technique');
        const acc = await accountOf(flow.userId!);
        assert.deepEqual([acc.email, acc.email_pending, acc.email_verified_at], [tech, address, null], 'users : adresse technique, X en attente, rien de vérifié');
    });

    test('R87-b : après l’inscription, GoTrue ne fabrique aucun lien de récupération pour X (X n’est pas un identifiant de connexion)', async () => {
        const address = randomEmail('r87b');
        await registerClientFlow({ email: address, headers: freshIp() });
        const { data, error } = await service.auth.admin.generateLink({ type: 'recovery', email: address });
        assert.ok(error, `R87 : lien de récupération fabriqué pour une adresse non vérifiée (action_link présent : ${Boolean(data?.properties?.action_link)}) : `
            + 'quiconque lit la boîte X ouvrirait le compte (forgot-password/page.tsx:202)');
    });

    test('R87-c inscription partenaire en deux appels : adresse technique dans les deux tables, email_pending = X, un seul email de vérification', async () => {
        const address = randomEmail('r87c-partenaire');
        const phone = randomSenegalPhone('78');
        const since = mailsTo(address).length;
        const reg = await registerPartnerTwoStep({
            companyName: 'Verification Lien SARL', description: 'Partenaire fictif dont l’adresse attend sa vérification.', address: '2 rue du Lien',
            city: 'Dakar', activities: ['ORGANISATEUR'], firstName: 'Ndeye', lastName: 'Verifiee', phone, email: address,
            password: STRONG_PASSWORD, confirmPassword: STRONG_PASSWORD, ...(await uploadRegistrationDocuments()),
        }, { headers: freshIp() });
        assert.equal(reg.first.status, 200, `appel 1 : HTTP ${reg.first.status} ${JSON.stringify(reg.first.body)}`);
        assert.equal(reg.second?.status, 201, `appel 2 : HTTP ${reg.second?.status} ${JSON.stringify(reg.second?.body)}`);
        const userId = await userIdByPhone(phone);
        const techP = String(await authEmail(userId));
        assert.match(techP, TECH_RE, 'R87 : auth.users.email technique (aujourd’hui X, partner/register/route.ts:116-120)');
        const acc = await accountOf(userId);
        assert.deepEqual([acc.email, acc.email_pending, acc.email_verified_at], [techP, address, null]);
        assert.deepEqual(mailsTo(address).slice(since).map((m) => m.subject), [VERIFY_MAIL.subject], 'un seul email à X : le lien de vérification');
    });

    test('R87-c création par un admin users.write : adresse technique dans les deux tables, email_pending = X, un seul email de vérification', async () => {
        const admin = await newAdminWith(['users.write'], { label: 'r87c-admin' });
        const address = randomEmail('r87c-admin');
        const phone = randomSenegalPhone('76');
        const since = mailsTo(address).length;
        const POST = await routeFn(ADMIN_USERS_ROUTE, 'POST', 'POST /api/admin/users');
        const res = await reply(await POST(authed('/api/admin/users', 'POST', admin,
            { firstName: 'Moussa', lastName: 'Cree', phone, email: address, role: 'CLIENT' }))); // lot 9 quinquies (A2) : sans mot de passe
        assert.equal(res.status, 200, show(res));
        const userId = String(res.body.userId);
        const techA = String(await authEmail(userId));
        assert.match(techA, TECH_RE, 'R87 : auth.users.email technique (aujourd’hui X, admin/users/route.ts:136-140)');
        assert.deepEqual([res.body.email_pending, res.body.email_verification], [address, 'SENT'], `réponse (contrat 4.6) : ${show(res)}`);
        const acc = await accountOf(userId);
        assert.deepEqual([acc.email, acc.email_pending, acc.email_verified_at], [techA, address, null]);
        assert.deepEqual(mailsTo(address).slice(since).map((m) => m.subject), [VERIFY_MAIL.subject], 'un seul email à X : le lien de vérification');
    });
});

// ── R87-d : profil ─────────────────────────────────────────────────────────

describe('9b.48 R87-d — profil : la nouvelle adresse attend son lien', () => {
    test('PATCH vers X : users.email et auth.users inchangés, email_pending = X, rien de vérifié, lien envoyé à X, rien à l’ancienne adresse', async () => {
        const a = await newBuyer('r87d');
        const address = randomEmail('r87d');
        const sinceOld = mailsTo(a.email).length;
        const sinceNew = mailsTo(address).length;
        const r = await patchEmail(a, address);
        assert.equal(r.status, 200, show(r));
        assert.equal(await authEmail(a.userId), a.email, 'R87 : auth.users inchangé avant la validation (aujourd’hui X, profile/route.ts:54)');
        assert.deepEqual(r.body, { ok: true, email_technical: false, email_pending: address, email_verification: 'SENT' }, 'réponse du profil (contrat 4.6)');
        const acc = await accountOf(a.userId);
        assert.deepEqual([acc.email, acc.email_pending, acc.email_verified_at], [a.email, address, null]);
        assert.deepEqual(mailsTo(address).slice(sinceNew).map((m) => m.subject), [VERIFY_MAIL.subject], 'un seul email à X : le lien de vérification');
        assert.equal(mailsTo(a.email).length, sinceOld, 'rien à l’ancienne adresse (G.48)');
    });
});

// ── G53-1 à G53-3 : validation du lien ─────────────────────────────────────

describe('9b.48 G53-1 à G53-3 — validation du lien (POST /api/account/email/verify)', () => {
    test('G53-1 lien valide : 200, users.email = auth.users.email = X, vérifiée, rien en attente ; connexion par X ; audit sans valeur ; aucune session ouverte', async () => {
        const a = await newBuyer('g53-1');
        const address = randomEmail('g53-1');
        const token = await pendingVia(a, address);
        const res = await verify(token);
        assert.equal(res.status, 200, show(res));
        assert.deepEqual(res.cookies.filter((c) => /^sb-/.test(c)), [], 'la validation n’ouvre aucune session (cookie sb-…)');
        for (const key of ['access_token', 'refresh_token']) assert.equal(res.text.includes(key), false, `réponse avec ${key} : aucune session ne doit être ouverte`);
        assert.equal(res.text.includes(token), false, 'le jeton n’est pas renvoyé');
        const acc = await accountOf(a.userId);
        assert.deepEqual([acc.email, acc.email_pending], [address, null], 'adresse vérifiée en place, rien en attente');
        assert.ok(acc.email_verified_at, 'email_verified_at posé');
        assert.equal(await authEmail(a.userId), address, 'auth.users.email aligné');
        assert.equal(await signInError(address), null, 'connexion par X');
        const audit = await auditFor(a.userId, 'ACCOUNT_EMAIL_VERIFIED');
        assert.equal(audit.length, 1, 'une ligne d’audit ACCOUNT_EMAIL_VERIFIED');
        const dump = JSON.stringify(audit[0]);
        assert.equal(dump.includes(address) || dump.includes(token), false, 'audit sans adresse ni jeton');
    });

    test('G53-2 lien expiré : 410 EMAIL_LINK_EXPIRED, rien n’a changé', async () => {
        const a = await newBuyer('g53-2');
        const address = randomEmail('g53-2');
        const token = await pendingVia(a, address);
        const { data, error } = await service.from('email_verifications')
            .update({ created_at: new Date(Date.now() - 25 * 3600_000).toISOString(), expires_at: new Date(Date.now() - 60_000).toISOString() })
            .eq('user_id', a.userId).is('used_at', null).select('id');
        assert.equal(error, null, `échéance du lien reculée en base locale : ${error?.message} — table email_verifications, ${LOT9BIS_MIGRATION.M10}`);
        assert.equal((data ?? []).length, 1, 'un seul lien ouvert pour le compte');
        const res = await verify(token);
        assert.equal(res.status, 410, show(res));
        assert.equal(res.body.code, 'EMAIL_LINK_EXPIRED', show(res));
        const acc = await accountOf(a.userId);
        assert.deepEqual([acc.email, acc.email_pending, acc.email_verified_at], [a.email, address, null], 'rien n’a changé');
        assert.equal(await authEmail(a.userId), a.email);
    });

    test('G53-3 lien réutilisé : 409 EMAIL_LINK_USED ; lien remplacé par un renvoi : 400 EMAIL_LINK_INVALID, le nouveau passe', async () => {
        const a = await newBuyer('g53-3a');
        const token = await pendingVia(a, randomEmail('g53-3a'));
        assert.equal((await verify(token)).status, 200, 'première validation');
        const again = await verify(token);
        assert.equal(again.status, 409, show(again));
        assert.equal(again.body.code, 'EMAIL_LINK_USED', show(again));

        const b = await newBuyer('g53-3b');
        const address = randomEmail('g53-3b');
        const first = await pendingVia(b, address);
        const since = mailsTo(address).length;
        const r = await resend(b);
        assert.equal(r.status, 200, show(r));
        assert.deepEqual(r.body, { sent: true }, show(r));
        const second = lastToken(address, since);
        assert.notEqual(second, first, 'un nouveau jeton à chaque envoi');
        const old = await verify(first);
        assert.equal(old.status, 400, show(old));
        assert.equal(old.body.code, 'EMAIL_LINK_INVALID', show(old));
        assert.deepEqual((await accountOf(b.userId)).email_pending, address, 'l’ancien lien ne change rien');
        const fresh = await verify(second);
        assert.equal(fresh.status, 200, show(fresh));
        assert.equal((await accountOf(b.userId)).email, address);
    });
});

// ── G53-4 : adresse prise ──────────────────────────────────────────────────

describe('9b.48 G53-4 — adresse vérifiée ailleurs ; deux attentes sur la même adresse', () => {
    test('A a vérifié X : B saisit X → 409 EMAIL_TAKEN, rien en attente sur B, aucun lien', async () => {
        const a = await newBuyer('g53-4a');
        const b = await newBuyer('g53-4b');
        const address = randomEmail('g53-4');
        assert.equal((await verify(await pendingVia(a, address))).status, 200, 'A vérifie X');
        const since = mailsTo(address).length;
        const r = await patchEmail(b, address);
        assert.equal(r.status, 409, show(r));
        assert.equal(r.body.code, 'EMAIL_TAKEN', show(r));
        assert.equal((await accountOf(b.userId)).email_pending, null, 'rien en attente sur B');
        assert.equal(mailsTo(address).length, since, 'aucun lien envoyé pour B');
    });

    test('A et B en attente sur X (une attente ne bloque pas), A valide : la validation de B → 409 EMAIL_TAKEN, l’attente de B est vidée', async () => {
        const a = await newBuyer('g53-4c');
        const b = await newBuyer('g53-4d');
        const address = randomEmail('g53-4-attente');
        const ta = await pendingVia(a, address);
        const tb = await pendingVia(b, address);
        assert.equal((await verify(ta)).status, 200, 'A valide X');
        const rb = await verify(tb);
        assert.equal(rb.status, 409, show(rb));
        assert.equal(rb.body.code, 'EMAIL_TAKEN', `discovery-9bis-email 7, G53-4 : « la validation de B donne 409 » : ${show(rb)}`);
        const accB = await accountOf(b.userId);
        assert.deepEqual([accB.email, accB.email_pending, accB.email_verified_at], [b.email, null, null], 'B garde son adresse, attente vidée');
        assert.equal(await authEmail(b.userId), b.email);
        assert.equal((await accountOf(a.userId)).email, address);
    });

    test('X28 : deux validations de X tenues en même temps en base — la seconde attend la première, puis est refusée EMAIL_TAKEN, sans interblocage', async () => {
        const a = await newBuyer('g53-4e');
        const b = await newBuyer('g53-4f');
        const address = randomEmail('g53-4-course');
        const ta = await pendingVia(a, address);
        const tb = await pendingVia(b, address);
        await requireEmailSchema('X28');
        // Étape de la route avant la RPC (AR2) : auth.users de A reçoit X ; celle de B serait refusée par GoTrue.
        const { error } = await service.auth.admin.updateUserById(a.userId, { email: address, email_confirm: true });
        assert.equal(error, null, `auth.users de A : ${error?.message}`);
        const sql = 'SELECT public.email_verification_finalize($1::jsonb) AS r';
        const c1 = await openConcurrentClient({ applicationName: 'ev-test-email-finalize-a' });
        const c2 = await openConcurrentClient({ applicationName: 'ev-test-email-finalize-b', statementTimeoutMs: 30_000 });
        try {
            const r1 = (await c1.query<{ r: Row }>(sql, [JSON.stringify({ token_hash: sha256(ta), expected_email: a.email })])).rows[0].r;
            assert.equal(r1.ok, true, `validation de A : ${JSON.stringify(r1)}`);
            const second = c2.query<{ r: Row }>(sql, [JSON.stringify({ token_hash: sha256(tb), expected_email: b.email })])
                .then((res) => ({ row: res.rows[0].r, err: null as Error | null }), (err: Error) => ({ row: null as Row | null, err }));
            await waitForLockWaiters([c2.pid]);
            await c1.commit();
            const r2 = await second;
            assert.equal(r2.err, null, `seconde validation : ${r2.err?.message ?? ''} (40P01 = interblocage, ordre des verrous 3.3)`);
            assert.equal(r2.row?.ok, false, `seconde validation acceptée : ${JSON.stringify(r2.row)}`);
            assert.equal(r2.row?.code, 'EMAIL_TAKEN', `seconde validation : ${JSON.stringify(r2.row)}`);
            await c2.commit();
        } finally {
            await c1.close();
            await c2.close();
        }
        const accA = await accountOf(a.userId);
        assert.equal(accA.email, address, 'A gagne');
        assert.ok(accA.email_verified_at, 'A vérifiée');
        const accB = await accountOf(b.userId);
        assert.deepEqual([accB.email, accB.email_pending, accB.email_verified_at], [b.email, null, null], 'B inchangée, attente vidée');
    });
});

// ── G53-6, G53-7 : adresses techniques ─────────────────────────────────────

describe('9b.48 G53-6, G53-7 — adresses techniques (B100)', () => {
    test('G53-6 compte anonymisé « …@deleted.eventvillage.sn » : REFUND_PAID (ALLOW) → EMAIL SKIPPED NO_REAL_EMAIL, aucun email', async () => {
        const a = await newBuyer('g53-6');
        const result = await AdminService.anonymizeUser(a.userId, { id: await superadminId(), role: 'SUPERADMIN' });
        assert.equal(result.success, true, `anonymisation : ${JSON.stringify(result)}`);
        const deleted = `${a.userId}@deleted.eventvillage.sn`;
        const key = `REFUND_PAID:${randomUUID()}`;
        await commitEnqueue({ type: 'REFUND_PAID', key, user_id: a.userId, data: catalogSample('REFUND_PAID') });
        const emailRows = (await outboxRows({ keyPrefix: `${key}:` })).filter((r) => r.channel === 'EMAIL');
        assert.equal(emailRows.length, 1, 'une ligne EMAIL pour REFUND_PAID (canal du registre)');
        await flushNotifications({ ids: emailRows.map((r) => r.id) });
        const [row] = await outboxRows({ ids: emailRows.map((r) => r.id) });
        assert.deepEqual([row.status, row.reason], ['SKIPPED', 'NO_REAL_EMAIL'],
            `adresse technique d’un compte anonymisé : jamais destinataire (aujourd’hui envoyé, règle ^[0-9]+@eventvillage.sn$) : ${JSON.stringify([row.status, row.reason])}`);
        assert.equal(mailsTo(deleted).length, 0, 'aucun email vers le domaine deleted.eventvillage.sn');
    });

    test('G53-6 anonymisation d’un compte vérifié : elle aboutit, email_verified_at et email_pending remis à NULL (contrainte users_email_verified_real_chk)', async () => {
        const a = await newBuyer('g53-6v');
        await markEmailVerified(a.userId);
        const result = await AdminService.anonymizeUser(a.userId, { id: await superadminId(), role: 'SUPERADMIN' });
        assert.equal(result.success, true, `anonymisation d’un compte vérifié : ${JSON.stringify(result)}`);
        const acc = await accountOf(a.userId);
        assert.deepEqual([acc.email, acc.email_verified_at, acc.email_pending], [`${a.userId}@deleted.eventvillage.sn`, null, null]);
    });

    test('G53-7 adresse technique d’un autre numéro, ou d’un sous-domaine, à l’inscription : 400 INVALID_FIELD sur email, aucun compte ; le titulaire s’inscrit ensuite', async () => {
        const owner = randomSenegalPhone('77');
        for (const email of [technical(owner), `u${randomUUID().replace(/-/g, '')}@comptes.eventvillage.invalid`, `${randomUUID()}@deleted.eventvillage.sn`]) {
            const squat = await registerClientFlow({ email, headers: freshIp() }, { expectOk: false });
            assert.equal(squat.register?.status, 400, `${email} : HTTP ${squat.register?.status} ${JSON.stringify(squat.register?.body)} (aujourd’hui accepté, lib/validations/auth.ts:112)`);
            assert.deepEqual([squat.register?.body.code, squat.register?.body.field], ['INVALID_FIELD', 'email'], JSON.stringify(squat.register?.body));
            const { data, error } = await service.from('users').select('id').eq('phone', squat.phone);
            assert.equal(error, null, error?.message);
            assert.equal((data ?? []).length, 0, `${email} : aucun compte créé`);
        }
        const flow = await registerClientFlow({ phone: owner, headers: freshIp() });
        assert.ok(flow.userId, 'le titulaire du numéro s’inscrit');
        assert.match(String(await authEmail(flow.userId!)), TECH_RE, 'son adresse technique est la sienne (lot 9 quater : tirée au hasard, sans le numéro)');
    });
});

// ── G53-11, G53-12 : renvoi et jeton ───────────────────────────────────────

describe('9b.48 G53-11, G53-12 — renvoi du lien, jeton', () => {
    test('G53-11 quota : trois renvois dans l’heure passent, le quatrième → 429 EMAIL_VERIFY_RATE_LIMITED, sans email', async () => {
        const a = await newBuyer('g53-11'); // adresse réelle non vérifiée d'avant le lot (B98) : cible du renvoi
        const since = mailsTo(a.email).length;
        for (let i = 1; i <= 3; i++) {
            const r = await resend(a);
            assert.equal(r.status, 200, `renvoi ${i} : ${show(r)}`);
            assert.deepEqual(r.body, { sent: true }, `renvoi ${i}`);
        }
        const fourth = await resend(a);
        assert.equal(fourth.status, 429, show(fourth));
        assert.equal(fourth.body.code, 'EMAIL_VERIFY_RATE_LIMITED', show(fourth));
        assert.match(norm(String(fourth.body.error ?? '')), /^Trop de liens demandés\. Réessayez dans \d+ minutes?\.$/, show(fourth));
        assert.equal(mailsTo(a.email).slice(since).filter((m) => m.subject === VERIFY_MAIL.subject).length, 3, 'trois liens envoyés, pas de quatrième');
    });

    test('renvoi sans adresse à vérifier (adresse technique, rien en attente) : 400 NO_EMAIL_TO_VERIFY, aucun email', async () => {
        const flow = await registerClientFlow({ headers: freshIp() });
        const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
        const { data, error } = await anon.auth.signInWithPassword({ email: String(await authEmail(flow.userId!)), password: STRONG_PASSWORD });
        assert.equal(error, null, `connexion du compte : ${error?.message}`);
        const before = getFakes().email.sent.length;
        const r = await resend({ accessToken: data.session!.access_token });
        assert.equal(r.status, 400, show(r));
        assert.equal(r.body.code, 'NO_EMAIL_TO_VERIFY', show(r));
        assert.equal(getFakes().email.sent.length, before, 'aucun email tenté');
    });

    test('G53-12 le jeton n’existe que dans l’email : la base garde son SHA-256, aucune ligne (lien, boîte d’envoi, audit) ne le contient', async () => {
        const a = await newBuyer('g53-12');
        const since = mailsTo(a.email).length;
        const r = await resend(a);
        assert.equal(r.status, 200, show(r));
        const token = lastToken(a.email, since);
        await requireEmailSchema('G53-12');
        const found = await inspect(async (db) => {
            const links = await db.query<{ token_hash: string; j: string }>(
                'SELECT v.token_hash, row_to_json(v)::text AS j FROM public.email_verifications v WHERE v.user_id = $1', [a.userId]);
            const outbox = await db.query<{ n: number }>(
                'SELECT count(*)::int AS n FROM public.notification_outbox o WHERE (o.recipient_user_id = $1 OR lower(o.recipient_email) = lower($2)) AND strpos(row_to_json(o)::text, $3) > 0',
                [a.userId, a.email, token]);
            const audit = await db.query<{ n: number }>(
                'SELECT count(*)::int AS n FROM public.audit_logs l WHERE (l.user_id = $1 OR l.object_id = $1) AND strpos(row_to_json(l)::text, $2) > 0', [a.userId, token]);
            return { links: links.rows, outbox: outbox.rows[0].n, audit: audit.rows[0].n };
        });
        assert.equal(found.links.length, 1, 'un lien pour le compte');
        assert.equal(found.links[0].token_hash, sha256(token), 'token_hash = SHA-256 hexadécimal du jeton de l’email');
        assert.equal(found.links[0].j.includes(token), false, 'le jeton en clair est dans email_verifications');
        assert.equal(found.outbox, 0, 'le jeton est dans la boîte d’envoi (journal compris)');
        assert.equal(found.audit, 0, 'le jeton est dans le journal d’audit');
    });
});

// ── Routes publiques, page /verify-email ───────────────────────────────────

describe('9b.48 middleware et page /verify-email', () => {
    test('POST /api/account/email/verify et la page /verify-email passent le middleware sans session (leçon A41)', async () => {
        for (const p of ['/api/account/email/verify', '/verify-email']) {
            const r = await callMiddleware(p, []);
            assert.equal(r.passedThrough, true, `${p} : publique attendue (HTTP ${r.status}, ${r.location ?? 'sans redirection'})`);
        }
    });

    test('témoin (vert dès l’écriture) : /api/account/email/resend exige une session (401 sans session)', async () => {
        const r = await callMiddleware('/api/account/email/resend', []);
        assert.equal(r.passedThrough, false, JSON.stringify(r));
        assert.equal(r.status, 401, JSON.stringify(r));
    });

    test('page /verify-email (statique, E-G) : lit ?t=, l’efface, aucun référent, bouton « Confirmer mon adresse » qui poste, aucune validation au chargement, textes des issues', () => {
        const PAGE = 'app/verify-email/page.tsx';
        const src = sourceWithImports(PAGE, 'page de validation, contrat 4.6');
        assert.match(src, /history\.replaceState/, 'jeton effacé de la barre d’adresse');
        assert.match(src, /no-referrer/, 'aucun référent transmis');
        assert.match(src, /["'`]\/api\/account\/email\/verify["'`]/, 'appel de /api/account/email/verify');
        assertText(src, 'Confirmer mon adresse', 'bouton de validation');
        for (const t of [
            'Adresse vérifiée. Vous recevrez désormais vos billets et vos confirmations par email.',
            'Ce lien n’est pas valable. Demandez un nouveau lien depuis votre profil.',
            'Ce lien a expiré (24 heures). Demandez un nouveau lien depuis votre profil.',
            'Ce lien a déjà servi.',
            'Cette adresse est déjà vérifiée sur un autre compte Event Village.',
        ]) assertText(src, t, 'issue de la validation (discovery-9bis-email 5)');
        const sf = tsxFile(PAGE, 'page de validation');
        const effects: string[] = [];
        const visit = (n: ts.Node): void => {
            if (ts.isCallExpression(n) && /^(React\.)?use(Layout)?Effect$/.test(n.expression.getText())) effects.push(n.getText());
            ts.forEachChild(n, visit);
        };
        visit(sf);
        assert.ok(!effects.some((e) => /\/api\/account\/email\/verify|fetch\(/.test(e)),
            'validation au chargement : les antivirus de messagerie ouvrent les liens et videraient le jeton (discovery-9bis-email 2.3)');
    });
});

/**
 * Lot 8, tâche 8.3 d, anomalie A2 (contrat 3.12, 13.4, L87 ; CDC §86, §182) — lien de parrainage mort :
 * app/api/referrals/my-stats/route.ts:117 renvoie https://eventvillage.sn/r/<code> (domaine en dur, aucune route
 * app/r/, aucune règle de réécriture) et /register ne lit aucun code dans l'URL.
 *  1. referralLink vaut exactement <NEXT_PUBLIC_APP_URL>/register?ref=<code>, sans « / » doublé, et suit la variable
 *     (adresse du tunnel d'essai) : jamais le domaine en dur ;
 *  2. le code du lien est celui que l'inscription reconnaît, users.referral_code : la route le recalcule aujourd'hui
 *     depuis le téléphone (:46-47). Deux comptes aux six mêmes derniers chiffres ont des codes différents en base
 *     (generate_referral_code ajoute un compteur, 0011_referral_codes.sql:36-40) : le lien du second parraine
 *     aujourd'hui pour le compte du premier ;
 *  3. de bout en bout : le code lu dans le lien, passé à l'inscription, crée la relation parrain → filleul, et le
 *     parrain voit son filleul dans ses statistiques ;
 *  4. statique : aucun domaine en dur dans la route, /register lit ?ref= dans le navigateur (comme redirect, :102,
 *     sans useSearchParams), préremplit le champ et ouvre « Plus d'options » pour que le code soit visible.
 *
 * Rouge avant correctif : 1 à 3 et la partie route du 4 par fix(8.3-A2s) (S4), la partie écran du 4 par fix(8.3-A2e)
 * (E4). Vert dès l'écriture (signalé) : le garde-fou qui vérifie que l'inscription transmet toujours le code.
 * Après la suite : assertRecetteInvariants.
 */
import '../helpers/env';
import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import ts from 'typescript';
import { GET as myStatsRoute } from '../../app/api/referrals/my-stats/route';
import { resetServerEnvCache } from '../../lib/env';
import { assertRecetteInvariants } from '../helpers/recette-invariants';
import { authed, type RouteResult } from './acces-helpers';
import { randomEmail, STRONG_PASSWORD } from './helpers';
import { newBuyer, service, type Buyer } from './paiement-helpers';
import { registerClientFlow } from './terrain-helpers';

type Row = Record<string, unknown>;

const ROUTE_FILE = 'app/api/referrals/my-stats/route.ts';
const REGISTER_PAGE = 'app/register/page.tsx';

after(async () => {
    await assertRecetteInvariants('parrainage-lien');
});

// ── Outils ─────────────────────────────────────────────────────────────────

let ipSeq = 0;
/** Adresse réservée à la suite : les quotas d'inscription par IP ne se mélangent pas à ceux des autres suites. */
function freshIp(): Record<string, string> {
    ipSeq += 1;
    return { 'x-forwarded-for': `198.51.100.${20 + ipSeq}` };
}

function appUrl(): string {
    const url = process.env.NEXT_PUBLIC_APP_URL;
    assert.ok(url, 'NEXT_PUBLIC_APP_URL absente de l’environnement de test');
    return url.replace(/\/+$/, '');
}

async function myStats(user: Buyer): Promise<RouteResult> {
    const res = await myStatsRoute(authed('/api/referrals/my-stats', 'GET', user));
    return { status: res.status, body: await res.json() as Row };
}

async function storedCode(userId: string): Promise<string> {
    const { data, error } = await service.from('users').select('referral_code').eq('id', userId).single();
    assert.equal(error, null, `code de parrainage ${userId} : ${error?.message}`);
    assert.ok(data.referral_code, `précondition : code en base (trigger set_referral_code_on_insert) pour ${userId}`);
    return String(data.referral_code);
}

/** Compte neuf au numéro imposé (newBuyer tire le sien) : sert à fabriquer deux numéros de même fin. */
async function accountWithPhone(phoneE164: string, label: string): Promise<Buyer> {
    const email = randomEmail(`lien-${label}`);
    const firstName = 'Ndeye';
    const lastName = 'Marraine';
    const { data, error } = await service.auth.admin.createUser({
        email, phone: phoneE164, password: STRONG_PASSWORD, email_confirm: true, phone_confirm: true,
        user_metadata: { first_name: firstName, last_name: lastName },
    });
    assert.equal(error, null, `création du compte ${phoneE164} : ${error?.message}`);
    const userId = data.user!.id;
    const { error: upErr } = await service.from('users').update({ phone: phoneE164, first_name: firstName, last_name: lastName, status: 'ACTIF' }).eq('id', userId);
    assert.equal(upErr, null, `profil ${phoneE164} : ${upErr?.message}`);
    const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: s, error: signErr } = await anon.auth.signInWithPassword({ email, password: STRONG_PASSWORD });
    assert.equal(signErr, null, `connexion ${phoneE164} : ${signErr?.message}`);
    return { userId, accessToken: s.session!.access_token, email, phoneE164, phone9: phoneE164.slice(4), firstName, lastName };
}

/** Le paramètre ref du lien tel qu'un navigateur le lit ; échoue en montrant le lien s'il n'y en a pas. */
function refOf(link: unknown): string {
    assert.equal(typeof link, 'string', `referralLink : ${JSON.stringify(link)}`);
    const parsed = new URL(String(link));
    assert.equal(parsed.pathname, '/register', `le lien ne mène pas à l’inscription : ${String(link)}`);
    const ref = parsed.searchParams.get('ref');
    assert.ok(ref, `paramètre ref absent du lien : ${String(link)}`);
    return ref;
}

async function sponsorsOf(userId: string): Promise<Row[]> {
    const { data, error } = await service.from('referral_relationships')
        .select('sponsor_id, referral_type, is_active').eq('referred_id', userId);
    assert.equal(error, null, `relation du filleul ${userId} : ${error?.message}`);
    return (data ?? []) as Row[];
}

async function withAppUrl<T>(url: string, fn: () => Promise<T>): Promise<T> {
    const previous = process.env.NEXT_PUBLIC_APP_URL;
    process.env.NEXT_PUBLIC_APP_URL = url;
    resetServerEnvCache();
    try {
        return await fn();
    } finally {
        process.env.NEXT_PUBLIC_APP_URL = previous;
        resetServerEnvCache();
    }
}

// ── 1 à 3. Route et inscription ────────────────────────────────────────────

describe('A2 — GET /api/referrals/my-stats : lien sur NEXT_PUBLIC_APP_URL', () => {
    test('referralLink vaut exactement <NEXT_PUBLIC_APP_URL>/register?ref=<code>, code de la base', async () => {
        const sponsor = await newBuyer('lien-exact');
        const code = await storedCode(sponsor.userId);
        const r = await myStats(sponsor);
        assert.equal(r.status, 200, JSON.stringify(r.body));
        assert.equal(r.body.referralCode, code, 'code affiché = code enregistré en base');
        assert.equal(r.body.referralLink, `${appUrl()}/register?ref=${code}`);
        assert.doesNotMatch(String(r.body.referralLink), /eventvillage\.sn/, 'domaine en dur');
    });

    test('le lien suit NEXT_PUBLIC_APP_URL (adresse du tunnel d’essai), sans « / » doublé', async () => {
        const sponsor = await newBuyer('lien-tunnel');
        const code = await storedCode(sponsor.userId);
        const r = await withAppUrl('https://essai-tunnel.example.test/', () => myStats(sponsor));
        assert.equal(r.status, 200, JSON.stringify(r.body));
        assert.equal(r.body.referralLink, `https://essai-tunnel.example.test/register?ref=${code}`);
    });

    test('deux comptes aux six mêmes derniers chiffres : chacun son code, et le filleul va au bon parrain', async () => {
        const first = await newBuyer('lien-premier');
        const second = await accountWithPhone(`+22178${first.phoneE164.slice(-7)}`, 'second');
        const firstCode = await storedCode(first.userId);
        const secondCode = await storedCode(second.userId);
        const derived = `EV-${second.phoneE164.slice(-6)}`;
        assert.notEqual(secondCode, firstCode, 'précondition : codes distincts en base');
        assert.notEqual(secondCode, derived, 'précondition : generate_referral_code a ajouté un compteur au second compte');

        const r = await myStats(second);
        assert.equal(r.status, 200, JSON.stringify(r.body));
        assert.equal(r.body.referralCode, secondCode, 'le second compte voit son propre code, pas celui recalculé depuis le téléphone');
        assert.equal(r.body.referralLink, `${appUrl()}/register?ref=${secondCode}`);

        const flow = await registerClientFlow({ referralCode: refOf(r.body.referralLink), headers: freshIp() });
        assert.deepEqual(await sponsorsOf(flow.userId!), [{ sponsor_id: second.userId, referral_type: 'CLIENT_TO_CLIENT', is_active: true }],
            'le filleul du lien revient au titulaire du lien');
    });

    test('de bout en bout : le code lu dans le lien crée la relation et le parrain voit son filleul', async () => {
        const sponsor = await newBuyer('lien-relation');
        const before = await myStats(sponsor);
        assert.equal(before.status, 200, JSON.stringify(before.body));
        assert.deepEqual(before.body.network, { level1Count: 0, level2Count: 0, totalReferred: 0 }, 'précondition : aucun filleul');

        const flow = await registerClientFlow({ referralCode: refOf(before.body.referralLink), headers: freshIp() });

        assert.deepEqual(await sponsorsOf(flow.userId!), [{ sponsor_id: sponsor.userId, referral_type: 'CLIENT_TO_CLIENT', is_active: true }],
            'une relation parrain → filleul');
        const after_ = await myStats(sponsor);
        assert.deepEqual(after_.body.network, { level1Count: 1, level2Count: 0, totalReferred: 1 }, 'le filleul compte chez le parrain');
    });
});

// ── 4. Sources ─────────────────────────────────────────────────────────────

function parseFile(rel: string): ts.SourceFile {
    const text = fs.readFileSync(path.join(process.cwd(), ...rel.split('/')), 'utf8');
    return ts.createSourceFile(rel, text, ts.ScriptTarget.Latest, true, rel.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
}

function nodesOf(root: ts.Node, keep: (n: ts.Node) => boolean): ts.Node[] {
    const out: ts.Node[] = [];
    const visit = (n: ts.Node): void => {
        if (keep(n)) out.push(n);
        ts.forEachChild(n, visit);
    };
    visit(root);
    return out;
}

function literals(sf: ts.SourceFile): string[] {
    return nodesOf(sf, (n) => ts.isStringLiteralLike(n) || ts.isTemplateHead(n) || ts.isTemplateMiddle(n) || ts.isTemplateTail(n))
        .map((n) => (n as ts.LiteralLikeNode).text);
}

function calledNames(root: ts.Node): string[] {
    return nodesOf(root, ts.isCallExpression).map((n) => {
        const callee = (n as ts.CallExpression).expression;
        return ts.isIdentifier(callee) ? callee.text : ts.isPropertyAccessExpression(callee) ? callee.name.text : '';
    });
}

function isGetRef(n: ts.Node): boolean {
    return ts.isCallExpression(n)
        && ts.isPropertyAccessExpression(n.expression)
        && n.expression.name.text === 'get'
        && n.arguments.length === 1
        && ts.isStringLiteralLike(n.arguments[0])
        && n.arguments[0].text === 'ref';
}

function enclosingFunction(n: ts.Node): ts.Node | null {
    for (let p: ts.Node | undefined = n.parent; p; p = p.parent) {
        if (ts.isArrowFunction(p) || ts.isFunctionExpression(p) || ts.isFunctionDeclaration(p)) return p;
    }
    return null;
}

describe('A2 — sources', () => {
    test('la route ne garde aucun domaine en dur et lit l’adresse par getServerEnv()', () => {
        const sf = parseFile(ROUTE_FILE);
        const hardcoded = literals(sf).filter((t) => /eventvillage\.sn|\/r\//.test(t));
        assert.deepEqual(hardcoded, [], `adresse en dur dans ${ROUTE_FILE} : ${hardcoded.join(' ; ')}`);
        assert.ok(calledNames(sf).includes('getServerEnv'), `${ROUTE_FILE} : getServerEnv() n'est pas appelée (contrat 3.12)`);
    });

    test('/register lit ?ref= dans le navigateur, préremplit le champ et ouvre les options', () => {
        const sf = parseFile(REGISTER_PAGE);
        const reads = nodesOf(sf, isGetRef);
        assert.equal(reads.length, 1, `${REGISTER_PAGE} : lecture du paramètre ref attendue une fois (contrat 3.12)`);
        const fn = enclosingFunction(reads[0]);
        assert.ok(fn, 'lecture de ref hors de toute fonction');
        const called = calledNames(fn);
        assert.ok(called.includes('setReferralCode'), `${REGISTER_PAGE} : le champ n'est pas prérempli depuis ?ref= (setReferralCode)`);
        assert.ok(nodesOf(fn, (n) => ts.isCallExpression(n) && n.expression.getText(sf) === 'setMoreOptions' && n.arguments[0]?.kind === ts.SyntaxKind.TrueKeyword).length > 0,
            `${REGISTER_PAGE} : le code prérempli reste caché, le champ n'est rendu que sous moreOptions (setMoreOptions(true) attendu)`);
    });

    test('/register n’utilise pas useSearchParams : la page reste rendue sans Suspense, comme redirect (:102)', () => {
        const sf = parseFile(REGISTER_PAGE);
        assert.ok(!calledNames(sf).includes('useSearchParams'), `${REGISTER_PAGE} : useSearchParams ajouté`);
    });

    test('garde-fou : l’inscription transmet toujours le code saisi ou prérempli', () => {
        const sf = parseFile(REGISTER_PAGE);
        const sent = nodesOf(sf, (n) => ts.isPropertyAssignment(n) && n.name.getText(sf) === 'referralCode') as ts.PropertyAssignment[];
        assert.equal(sent.length, 1, 'referralCode envoyé une fois à POST /api/auth/register');
        assert.match(sent[0].initializer.getText(sf), /referralCode\.trim\(\)/);
    });
});

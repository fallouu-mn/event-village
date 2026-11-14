/**
 * Aides des tests de sécurité — point de vue d'un attaquant SANS privilège.
 *
 * Règle du lot 1A : uniquement la clé anon publique + signUp / signInWithPassword. Lot 9 quater (A2) : signUp est fermé ;
 * un compte d'attaquant passe par les routes publiques d'inscription de l'application.
 * Ce module n'importe aucun client service_role (contrôlé par tests/security/anon-uniquement.test.ts).
 */
import '../helpers/env';
import { randomBytes } from 'node:crypto';
import assert from 'node:assert/strict';
import { createClient, type PostgrestError, type SupabaseClient } from '@supabase/supabase-js';
import { NextRequest } from 'next/server';
import { getFakes } from '../fakes';
import { FIXTURE_EVENTS, FIXTURE_USERS, TEST_PASSWORD, type FixtureEventKey, type FixtureUserKey } from '../helpers/fixture-data';
import { gotrueEmail } from '../helpers/gotrue-email';
import { stepUpTestSession } from '../helpers/admin-step-up';

export const ZERO_UUID = '00000000-0000-0000-0000-000000000000';

/** Codes d'erreur attendus quand l'accès est refusé : permission SQL refusée, ou objet inexistant / non exposé. */
export const DENIED_CODES = ['42501', 'PGRST202', 'PGRST205', '42703', 'PGRST204'] as const;

function newClient(): SupabaseClient {
    return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
}

/** Client non authentifié (clé anon seule). */
export function anonClient(): SupabaseClient {
    return newClient();
}

export interface AttackerAccount {
    client: SupabaseClient;
    userId: string;
    email: string;
}

let attackerSeq = 0;

/** Adresse IP inventée, différente à chaque appel (quotas par IP de l'inscription). */
function attackerIp(): string {
    attackerSeq += 1;
    return `198.19.${(process.pid % 200) + 1}.${(attackerSeq % 250) + 1}`;
}

/** Numéro mobile sénégalais neuf (+22177…). */
function attackerPhone(): string {
    return `+22177${String(randomBytes(4).readUInt32BE(0) % 10_000_000).padStart(7, '0')}`;
}

/** POST vers une route de l'application, comme le ferait le navigateur d'un visiteur. */
async function postPublic(modulePath: string, url: string, body: unknown, ip: string): Promise<{ status: number; body: Record<string, unknown> }> {
    const mod = await import(modulePath) as { POST: (req: NextRequest) => Promise<Response> };
    const res = await mod.POST(new NextRequest(`http://127.0.0.1:3000${url}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
        body: JSON.stringify(body),
    }));
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) as Record<string, unknown> : {} };
}

/**
 * Compte neuf ouvert comme n'importe quel visiteur. Lot 9 quater (A2 : AUD-01, AUD-03) : l'inscription publique de
 * GoTrue est fermée ; le seul chemin public est celui de l'application : numéro, code reçu par SMS (faux MTarget, le
 * visiteur lit son propre téléphone), profil et mot de passe, puis connexion avec l'identifiant rendu par la route.
 * `metadata` (rôles forgés, numéro revendiqué…) est écrit ensuite par le visiteur lui-même dans user_metadata
 * (`updateUser({ data })`, ce que GoTrue laisse faire à tout compte) : l'intention des tests de métadonnées forgées est
 * gardée. Modification signalée au rapport du lot 9 quater (avant : `signUp` public de GoTrue).
 */
export async function signUpAttacker(label: string, metadata: Record<string, unknown> = {}): Promise<AttackerAccount> {
    const phone = attackerPhone();
    const ip = attackerIp();
    const since = getFakes().sms.messagesTo(phone).length;
    const start = await postPublic('../../app/api/auth/register/start/route', '/api/auth/register/start', { phone }, ip);
    if (start.status !== 200) throw new Error(`inscription (${label}) : démarrage HTTP ${start.status} ${JSON.stringify(start.body)}`);
    const code = getFakes().sms.messagesTo(phone).slice(since).map((m) => m.message.match(/\b(\d{6})\b/)?.[1]).filter(Boolean).pop();
    if (!code) throw new Error(`inscription (${label}) : aucun code reçu par SMS`);
    const password = `Sec#${randomBytes(8).toString('hex')}A1`;
    const reg = await postPublic('../../app/api/auth/register/route', '/api/auth/register', {
        phone, code, firstName: 'Visiteur', lastName: `Attaquant${label.replace(/[^a-z]/gi, '').slice(0, 10) || 'X'}`, password,
    }, ip);
    if (reg.status !== 200) throw new Error(`inscription (${label}) : HTTP ${reg.status} ${JSON.stringify(reg.body)}`);
    const email = String(reg.body.email ?? '');
    const userId = String(reg.body.userId ?? '');
    if (!email || !userId) throw new Error(`inscription (${label}) : réponse sans identifiant ${JSON.stringify(reg.body)}`);
    const client = newClient();
    const { error: signInErr } = await client.auth.signInWithPassword({ email: await gotrueEmail(email), password });
    if (signInErr) throw new Error(`signInWithPassword(${label}) : ${signInErr.message}`);
    if (Object.keys(metadata).length > 0) {
        const { error: metaErr } = await client.auth.updateUser({ data: metadata });
        if (metaErr) throw new Error(`updateUser(${label}, métadonnées) : ${metaErr.message}`);
        const { error: refreshErr } = await client.auth.refreshSession();
        if (refreshErr) throw new Error(`refreshSession(${label}) : ${refreshErr.message}`);
    }
    return { client, userId, email };
}

const fixtureSessions = new Map<FixtureUserKey, Promise<AttackerAccount>>();

/**
 * Connexion à un compte de fixture (compte gratuit déjà existant) par email + mot de passe.
 * Une seule connexion par compte et par processus (limite de débit de l'API Auth).
 */
type RouteHandler = (req: NextRequest) => Promise<Response>;

async function stepUpCall(path: string, token: string, body: unknown): Promise<{ status: number; body: Record<string, unknown> }> {
    const mod = (await import(`../../app${path}/route`)) as { POST: RouteHandler };
    const res = await mod.POST(new NextRequest(`http://127.0.0.1:3000${path}`, {
        method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify(body),
    }));
    return { status: res.status, body: (await res.json().catch(() => ({}))) as Record<string, unknown> };
}

/** Lot 9 quinquies (A3, A4) : mot de passe redemandé, code administrateur envoyé, lu dans le faux SMS, saisi. */
export async function adminStepUpThroughRoutes(token: string, phone: string): Promise<void> {
    const pwd = await stepUpCall('/api/admin/step-up', token, { password: TEST_PASSWORD });
    if (pwd.status !== 200) throw new Error(`second facteur : mot de passe refusé (HTTP ${pwd.status} ${JSON.stringify(pwd.body)})`);
    if (pwd.body.required !== 'ADMIN_SMS_REQUIRED') return;
    const since = getFakes().sms.messagesTo(phone).length;
    const sent = await stepUpCall('/api/admin/step-up/sms', token, {});
    if (sent.status !== 200) throw new Error(`second facteur : code non envoyé (HTTP ${sent.status} ${JSON.stringify(sent.body)})`);
    const code = getFakes().sms.messagesTo(phone).slice(since).map((m) => /code administrateur (\d{6})/.exec(m.message)?.[1]).find(Boolean);
    if (!code) throw new Error('second facteur : aucun code administrateur reçu par le faux SMS');
    const ok = await stepUpCall('/api/admin/step-up/sms', token, { code });
    if (ok.status !== 200) throw new Error(`second facteur : code refusé (HTTP ${ok.status} ${JSON.stringify(ok.body)})`);
}

const fixtureStepUps = new Map<FixtureUserKey, Promise<void>>();

/**
 * Lot 9 quinquies (A3, A4 ; aide ajoutée, signalée au rapport) : second facteur de la session de fixture d'un ADMIN ou
 * d'un SUPERADMIN, passé par les VRAIES routes (mot de passe, puis code administrateur lu dans le faux SMS), sans
 * service_role. À appeler seulement par une suite qui appelle une route de l'application avec ce compte : un code par
 * suite épuiserait la limite de SMS par numéro (3 par 15 minutes ; run 171). Une fois par compte et par processus.
 * Contre-vérification (point 1) : signInFixture inscrit déjà la session comme admise (stepUpTestSession, base locale) :
 * le passage par les routes ne redemande alors plus le code.
 */
export function stepUpFixture(key: FixtureUserKey): Promise<void> {
    let done = fixtureStepUps.get(key);
    if (!done) {
        done = (async () => {
            const account = await signInFixture(key);
            const { data, error } = await account.client.auth.getSession();
            if (error || !data.session) throw new Error(`stepUpFixture(${key}) : session absente (${error?.message ?? 'aucune'})`);
            await adminStepUpThroughRoutes(data.session.access_token, FIXTURE_USERS[key].phone);
        })();
        fixtureStepUps.set(key, done);
    }
    return done;
}

export function signInFixture(key: FixtureUserKey): Promise<AttackerAccount> {
    let session = fixtureSessions.get(key);
    if (!session) {
        session = (async () => {
            const client = newClient();
            const { data, error } = await client.auth.signInWithPassword({ email: await gotrueEmail(FIXTURE_USERS[key].email), password: TEST_PASSWORD });
            if (error || !data.user || !data.session) throw new Error(`signInWithPassword(${key}) : ${error?.message ?? 'aucun utilisateur'}`);
            // Contre-vérification du lot 9 quinquies (point 1 ; aide modifiée, signalée au rapport) : is_admin() exige en base
            // le code administrateur de la session ; la session de fixture vaut une session qui l'a passé (comme signInAs).
            await stepUpTestSession(data.session.access_token);
            return { client, userId: data.user.id, email: FIXTURE_USERS[key].email };
        })();
        fixtureSessions.set(key, session);
    }
    return session;
}

export interface PublicEventIds {
    eventId: string;
    categories: Record<string, { id: string; price: number }>;
}

/** Identifiants d'un événement publié, découverts comme le ferait un visiteur (lecture publique). */
export async function publicEvent(key: FixtureEventKey): Promise<PublicEventIds> {
    const anon = anonClient();
    const { data: event, error } = await anon.from('events').select('id').eq('slug', FIXTURE_EVENTS[key].slug).maybeSingle();
    if (error || !event) throw new Error(`événement public ${key} introuvable en lecture anon : ${error?.message ?? 'absent'}`);
    const { data: cats, error: catErr } = await anon.from('ticket_categories').select('id, name, price').eq('event_id', event.id);
    if (catErr) throw new Error(`catégories de ${key} : ${catErr.message}`);
    const categories: PublicEventIds['categories'] = {};
    for (const c of cats || []) categories[c.name] = { id: c.id, price: Number(c.price) };
    return { eventId: event.id, categories };
}

/** Affirme qu'une opération a été refusée par la base (et non simplement vide). */
export function assertDenied(error: PostgrestError | null, what: string): void {
    assert.ok(error, `${what} : l'opération a été ACCEPTÉE alors qu'elle doit être refusée`);
    assert.ok(
        (DENIED_CODES as readonly string[]).includes(error.code) || /permission denied|row-level security|does not exist|Could not find/i.test(error.message),
        `${what} : refus attendu (permission / RLS / objet inexistant), obtenu code=${error.code} message=${error.message}`
    );
}

export function uniqueSuffix(): string {
    return randomBytes(6).toString('hex').toUpperCase();
}

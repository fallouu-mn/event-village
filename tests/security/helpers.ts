/**
 * Aides des tests de sécurité — point de vue d'un attaquant SANS privilège.
 *
 * Règle du lot 1A : uniquement la clé anon publique + signUp / signInWithPassword.
 * Ce module n'importe aucun client service_role (contrôlé par tests/security/anon-uniquement.test.ts).
 */
import '../helpers/env';
import { randomBytes } from 'node:crypto';
import assert from 'node:assert/strict';
import { createClient, type PostgrestError, type SupabaseClient } from '@supabase/supabase-js';
import { FIXTURE_EVENTS, FIXTURE_USERS, TEST_PASSWORD, type FixtureEventKey, type FixtureUserKey } from '../helpers/fixture-data';

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

/** Inscription publique d'un nouveau compte (comme n'importe quel visiteur), avec métadonnées libres. */
export async function signUpAttacker(label: string, metadata: Record<string, unknown> = {}): Promise<AttackerAccount> {
    const email = `sec-${label}-${randomBytes(6).toString('hex')}@test.eventvillage.local`;
    const password = `Sec#${randomBytes(8).toString('hex')}A1`;
    const client = newClient();
    const { data, error } = await client.auth.signUp({ email, password, options: { data: metadata } });
    if (error) throw new Error(`signUp(${label}) refusé : ${error.message}`);
    if (!data.user) throw new Error(`signUp(${label}) : aucun utilisateur retourné`);
    if (!data.session) {
        const { error: signInErr } = await client.auth.signInWithPassword({ email, password });
        if (signInErr) throw new Error(`signInWithPassword(${label}) : ${signInErr.message}`);
    }
    return { client, userId: data.user.id, email };
}

const fixtureSessions = new Map<FixtureUserKey, Promise<AttackerAccount>>();

/**
 * Connexion à un compte de fixture (compte gratuit déjà existant) par email + mot de passe.
 * Une seule connexion par compte et par processus (limite de débit de l'API Auth).
 */
export function signInFixture(key: FixtureUserKey): Promise<AttackerAccount> {
    let session = fixtureSessions.get(key);
    if (!session) {
        session = (async () => {
            const client = newClient();
            const { data, error } = await client.auth.signInWithPassword({ email: FIXTURE_USERS[key].email, password: TEST_PASSWORD });
            if (error || !data.user) throw new Error(`signInWithPassword(${key}) : ${error?.message ?? 'aucun utilisateur'}`);
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

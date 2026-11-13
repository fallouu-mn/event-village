/**
 * Fixtures de test — identifiants STABLES (emails, téléphones fictifs, slugs) et
 * résolution des UUID réels depuis la base locale seedée (`npm run seed:test`).
 *
 * Règle : aucun test ne doit coder un UUID en dur ; il passe par loadFixtures().
 */
import './env';
import { createClient } from '@supabase/supabase-js';
import { getServiceRoleClient } from '../../lib/supabase/server';
import { stepUpTestSession } from './admin-step-up';

import {
    CONTROLLER_A_EVENT,
    FIXTURE_EVENTS,
    FIXTURE_PARTNERS,
    FIXTURE_USERS,
    TEST_PASSWORD,
    type FixtureEventKey,
    type FixturePartnerKey,
    type FixtureUserKey,
} from './fixture-data';

export * from './fixture-data';


export interface FixtureUser { id: string; email: string; phone: string }
export interface FixturePartner { id: string; userId: string }
export interface FixtureCategory { id: string; name: string; price: number; total_quantity: number }
export interface FixtureEvent {
    id: string;
    slug: string;
    status: string;
    partnerId: string;
    categories: Record<string, FixtureCategory>;
}

export interface Fixtures {
    users: Record<FixtureUserKey, FixtureUser>;
    partners: Record<FixturePartnerKey, FixturePartner>;
    events: Record<FixtureEventKey, FixtureEvent>;
}

const SEED_HINT = 'Seed de test absent ou incomplet : exécutez `npm run seed:test` sur l\'instance Supabase locale.';

let cache: Fixtures | null = null;

/** Résout les UUID réels des fixtures depuis la base locale. Lève une erreur explicite si le seed manque. */
export async function loadFixtures(force = false): Promise<Fixtures> {
    if (cache && !force) return cache;
    const supabase = getServiceRoleClient();

    const emails = Object.values(FIXTURE_USERS).map((u) => u.email);
    const { data: userRows, error: userErr } = await supabase
        .from('users')
        .select('id, email, phone')
        .in('email', emails);
    if (userErr) throw new Error(`loadFixtures(users) : ${userErr.message}`);

    const users = {} as Record<FixtureUserKey, FixtureUser>;
    for (const key of Object.keys(FIXTURE_USERS) as FixtureUserKey[]) {
        const row = (userRows || []).find((r) => r.email === FIXTURE_USERS[key].email);
        if (!row) throw new Error(`${SEED_HINT} (utilisateur ${key} introuvable)`);
        users[key] = { id: row.id, email: row.email, phone: row.phone };
    }

    const partners = {} as Record<FixturePartnerKey, FixturePartner>;
    for (const key of Object.keys(FIXTURE_PARTNERS) as FixturePartnerKey[]) {
        const userId = users[FIXTURE_PARTNERS[key].userKey].id;
        const { data: partnerRow, error } = await supabase.from('partners').select('id, user_id').eq('user_id', userId).maybeSingle();
        if (error) throw new Error(`loadFixtures(partners) : ${error.message}`);
        if (!partnerRow) throw new Error(`${SEED_HINT} (partenaire ${key} introuvable)`);
        partners[key] = { id: partnerRow.id, userId: partnerRow.user_id };
    }

    const slugs = Object.values(FIXTURE_EVENTS).map((e) => e.slug);
    const { data: eventRows, error: eventErr } = await supabase
        .from('events')
        .select('id, slug, status, partner_id, ticket_categories(id, name, price, total_quantity)')
        .in('slug', slugs);
    if (eventErr) throw new Error(`loadFixtures(events) : ${eventErr.message}`);

    const events = {} as Record<FixtureEventKey, FixtureEvent>;
    for (const key of Object.keys(FIXTURE_EVENTS) as FixtureEventKey[]) {
        const spec = FIXTURE_EVENTS[key];
        const row = (eventRows || []).find((r: any) => r.slug === spec.slug) as any;
        if (!row) throw new Error(`${SEED_HINT} (événement ${key} introuvable)`);
        const categories: Record<string, FixtureCategory> = {};
        for (const c of row.ticket_categories || []) {
            categories[c.name] = { id: c.id, name: c.name, price: Number(c.price), total_quantity: Number(c.total_quantity) };
        }
        for (const c of spec.categories) {
            if (!categories[c.name]) throw new Error(`${SEED_HINT} (catégorie ${c.name} de ${key} introuvable)`);
        }
        events[key] = { id: row.id, slug: row.slug, status: row.status, partnerId: row.partner_id, categories };
    }

    cache = { users, partners, events };
    return cache;
}

export interface SignedInUser {
    userId: string;
    accessToken: string;
    refreshToken: string;
}

/** Ouvre une session via l'API Auth locale pour un utilisateur de fixture. */
export async function signInAs(key: FixtureUserKey): Promise<SignedInUser> {
    const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
        auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data, error } = await anon.auth.signInWithPassword({ email: FIXTURE_USERS[key].email, password: TEST_PASSWORD });
    if (error || !data.session) {
        throw new Error(`signInAs(${key}) : ${error?.message || 'session absente'} — ${SEED_HINT}`);
    }
    // Lot 9 quinquies (A3, A4 ; aide modifiée, signalée au rapport) : session valant mot de passe et code administrateur saisis
    await stepUpTestSession(data.session.access_token);
    return { userId: data.user.id, accessToken: data.session.access_token, refreshToken: data.session.refresh_token };
}

export function bearer(token: string): Record<string, string> {
    return { Authorization: `Bearer ${token}` };
}

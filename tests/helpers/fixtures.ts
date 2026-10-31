/**
 * Fixtures de test — identifiants STABLES (emails, téléphones fictifs, slugs) et
 * résolution des UUID réels depuis la base locale seedée (`npm run seed:test`).
 *
 * Règle : aucun test ne doit coder un UUID en dur ; il passe par loadFixtures().
 */
import './env';
import { createClient } from '@supabase/supabase-js';
import { getServiceRoleClient } from '../../lib/supabase/server';

export const TEST_PASSWORD = 'EvTest#2026-local';

export const FIXTURE_USERS = {
    CLIENT: { email: 'client@test.eventvillage.local', phone: '+221700000001', firstName: 'Awa', lastName: 'Client', primaryRole: 'CLIENT', roles: ['CLIENT'] },
    CLIENT_BIS: { email: 'client-bis@test.eventvillage.local', phone: '+221700000002', firstName: 'Birame', lastName: 'ClientBis', primaryRole: 'CLIENT', roles: ['CLIENT'] },
    PARTNER_A: { email: 'partner-a@test.eventvillage.local', phone: '+221700000003', firstName: 'Aïssatou', lastName: 'OrgaA', primaryRole: 'PARTENAIRE', roles: ['CLIENT', 'PARTENAIRE'] },
    PARTNER_B: { email: 'partner-b@test.eventvillage.local', phone: '+221700000004', firstName: 'Bassirou', lastName: 'OrgaB', primaryRole: 'PARTENAIRE', roles: ['CLIENT', 'PARTENAIRE'] },
    CONTROLLER_A: { email: 'controller-a@test.eventvillage.local', phone: '+221700000005', firstName: 'Cheikh', lastName: 'ControleurA', primaryRole: 'CONTROLEUR', roles: ['CLIENT', 'CONTROLEUR'] },
    ADMIN: { email: 'admin@test.eventvillage.local', phone: '+221700000006', firstName: 'Dior', lastName: 'Admin', primaryRole: 'ADMIN', roles: ['CLIENT', 'ADMIN'] },
    SUPERADMIN: { email: 'superadmin@test.eventvillage.local', phone: '+221700000007', firstName: 'Elhadji', lastName: 'SuperAdmin', primaryRole: 'SUPERADMIN', roles: ['CLIENT', 'SUPERADMIN'] },
} as const;

export type FixtureUserKey = keyof typeof FIXTURE_USERS;

export const FIXTURE_PARTNERS = {
    A: { userKey: 'PARTNER_A', companyName: 'TEST Organisateur A', commercialName: 'Orga A (test)', city: 'Dakar' },
    B: { userKey: 'PARTNER_B', companyName: 'TEST Organisateur B', commercialName: 'Orga B (test)', city: 'Thiès' },
} as const;

export type FixturePartnerKey = keyof typeof FIXTURE_PARTNERS;

export interface FixtureCategorySpec {
    name: string;
    price: number;
    total: number;
}

export interface FixtureEventSpec {
    partner: FixturePartnerKey;
    slug: string;
    title: string;
    status: 'PUBLIE' | 'BROUILLON';
    daysFromNow: number;
    categories: readonly FixtureCategorySpec[];
}

export const FIXTURE_EVENTS: Record<string, FixtureEventSpec> = {
    A_PUBLIE: {
        partner: 'A',
        slug: 'test-fixture-a-publie',
        title: 'TEST Concert A (publié, à venir)',
        status: 'PUBLIE',
        daysFromNow: 30,
        categories: [
            { name: 'Standard', price: 5000, total: 10 },
            { name: 'VIP', price: 15000, total: 3 },
        ],
    },
    A_BROUILLON: {
        partner: 'A',
        slug: 'test-fixture-a-brouillon',
        title: 'TEST Soirée A (brouillon)',
        status: 'BROUILLON',
        daysFromNow: 45,
        categories: [{ name: 'Standard', price: 2000, total: 5 }],
    },
    A_PASSE: {
        partner: 'A',
        slug: 'test-fixture-a-passe',
        title: 'TEST Festival A (passé, encore PUBLIE)',
        status: 'PUBLIE',
        daysFromNow: -30,
        categories: [{ name: 'Standard', price: 3000, total: 5 }],
    },
    B_PUBLIE: {
        partner: 'B',
        slug: 'test-fixture-b-publie',
        title: 'TEST Spectacle B (publié, à venir)',
        status: 'PUBLIE',
        daysFromNow: 20,
        categories: [{ name: 'Standard', price: 4000, total: 8 }],
    },
};

export type FixtureEventKey = keyof typeof FIXTURE_EVENTS;

/** Événement sur lequel CONTROLLER_A est affecté (droit d'encaisser les espèces). */
export const CONTROLLER_A_EVENT: FixtureEventKey = 'A_PUBLIE';

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
    return { userId: data.user.id, accessToken: data.session.access_token, refreshToken: data.session.refresh_token };
}

export function bearer(token: string): Record<string, string> {
    return { Authorization: `Bearer ${token}` };
}

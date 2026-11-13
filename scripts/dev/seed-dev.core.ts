/**
 * Lot 8 (8.1, L23, L24, contrat 5.2) — cœur de npm run seed:dev : comptes et données de démonstration du projet
 * d'essai manuel. Les gardes sont pures (tests/schema/essai-seed-gardes.test.ts) ; runSeedDev est joué sur la
 * base locale par tests/parcours/essai-seed-dev.test.ts, sans les gardes.
 *
 * Ce seed n'efface rien, ne vend rien et ne réécrit jamais une ligne présente : une ligne se cherche par email,
 * par compte ou par slug ; présente, elle reste telle quelle, mot de passe compris. Les statuts passent par la
 * seule RPC event_transition. Une création interrompue n'est pas reprise : l'objet déjà écrit reste, et le
 * message d'erreur dit lequel.
 * Lot 9 bis (R60, R91) : le compte `admin` reçoit les permissions manquantes de la préparation P0.2, même s'il existait
 * déjà (ajout seul) ; la fiche partenaire créée a un essai de 60 jours, sans statut de fondateur.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { fixturePosterPng } from '../../tests/helpers/fixture-poster';
import { checkPasswordStrength, resolveTargetProject, type TargetProject } from '../reset-test-password.core';

/**
 * Au-delà de ce nombre de comptes réels, le projet n'est plus un projet d'essai récent : refus, sans dérogation
 * par variable. Le refus affiche le nombre trouvé ; pour aller au-delà, changer cette constante.
 */
export const MAX_REAL_ACCOUNTS = 25;

const SEED_DOMAIN = 'essai.eventvillage.invalid';
const BUCKET = 'public-images';
const DAY_MS = 86_400_000;

/**
 * Lot 9 bis (R60, B95, décision D7) : permissions du compte `admin` (Moussa), celles de la préparation P0.2 du plan
 * de test (docs/plan-de-test-evenement.md), toutes dans lib/admin/admin-auth.ts. Ajoutées même à un compte déjà semé,
 * jamais retirées : une permission présente reste telle quelle (aucune ligne réécrite).
 */
export const SEED_ADMIN_PERMISSIONS = [
    'events.read', 'events.write', 'notifications.read', 'notifications.write',
    'partners.read', 'partners.validate', 'payments.read', 'refunds.manage',
] as const;

/** Lot 9 bis (R91) : essai de 60 jours, comme activate_partner_trial hors fondateur (20261103000006_lot6_pros_admin.sql:856-861). */
const TRIAL_DAYS_STANDARD = 60;

type EnvMap = Record<string, string | undefined>;

export interface SeedPreconditions {
    nodeEnv: string | undefined;
    isTty: boolean;
    fileEnv: EnvMap;
    shellEnv: EnvMap;
}

export interface SeedInput extends SeedPreconditions {
    realAccounts: number;
    confirmation: string;
}

/** Comme Next : une variable du shell l'emporte sur `.env.local`, même vide. */
function effective(key: string, fileEnv: EnvMap, shellEnv: EnvMap): string | undefined {
    return shellEnv[key] ?? fileEnv[key];
}

/** Gardes sans réseau, dans l'ordre du contrat : NODE_ENV, terminal, projet, EV_DEV_PROJECT_REF, EV_INTEGRATIONS, mot de passe. */
export function assertSeedPreconditions({ nodeEnv, isTty, fileEnv, shellEnv }: SeedPreconditions): TargetProject {
    if (nodeEnv && nodeEnv !== 'development') throw new Error(`NODE_ENV=${nodeEnv} : seed:dev ne tourne qu'en développement.`);
    if (!isTty) throw new Error('Terminal interactif requis : la confirmation se tape au clavier.');

    const target = resolveTargetProject(fileEnv as Record<string, string>, shellEnv);
    if (!fileEnv.EV_DEV_PROJECT_REF) throw new Error('EV_DEV_PROJECT_REF absente de .env.local : indiquez la référence du projet d\'essai.');
    if (fileEnv.EV_DEV_PROJECT_REF !== target.ref) throw new Error('EV_DEV_PROJECT_REF diffère de la référence du projet de NEXT_PUBLIC_SUPABASE_URL : refus.');
    if (effective('EV_INTEGRATIONS', fileEnv, shellEnv) !== 'fake') {
        throw new Error('EV_INTEGRATIONS=fake requis : les avis du seed ne doivent partir vers aucun numéro.');
    }
    const problems = checkPasswordStrength(effective('EV_DEV_SEED_PASSWORD', fileEnv, shellEnv) ?? '');
    if (problems.length > 0) throw new Error(`EV_DEV_SEED_PASSWORD absent ou trop faible, il faut : ${problems.join(', ')}.`);
    return target;
}

export function assertAccountLimit(realAccounts: number): void {
    if (realAccounts > MAX_REAL_ACCOUNTS) {
        throw new Error(`${realAccounts} comptes réels sur ce projet, ${MAX_REAL_ACCOUNTS} au plus : ce n'est pas un projet d'essai récent, refus.`);
    }
}

/** Toutes les gardes. Aucun champ facultatif : aucune ne se saute par omission. Rend le projet ciblé. */
export function assertSeedAllowed(input: SeedInput): TargetProject {
    const target = assertSeedPreconditions(input);
    assertAccountLimit(input.realAccounts);
    if (input.confirmation !== target.ref) throw new Error('Confirmation fausse : la référence du projet n\'a pas été retapée à l\'identique.');
    return target;
}

export function seedPassword({ fileEnv, shellEnv }: Pick<SeedPreconditions, 'fileEnv' | 'shellEnv'>): string {
    const password = effective('EV_DEV_SEED_PASSWORD', fileEnv, shellEnv);
    if (!password) throw new Error('EV_DEV_SEED_PASSWORD absent de .env.local.');
    return password;
}

interface AuthUserLike {
    email?: string | null;
    /** Lot 9 quater (A3) : la marque du seed est lue dans app_metadata (service_role seul), jamais dans user_metadata. */
    app_metadata?: Record<string, unknown> | null;
    user_metadata?: Record<string, unknown> | null;
}

/** Compte réel : sans la marque du seed (app_metadata) et hors de son domaine. */
export function countRealAccounts(users: AuthUserLike[]): number {
    return users.filter((u) => u.app_metadata?.is_essai_fixture !== true && !(u.email ?? '').toLowerCase().endsWith(`@${SEED_DOMAIN}`)).length;
}

/**
 * Schéma à jour, lu par REST (pas de SUPABASE_DB_URL en essai) : les migrations du lot 8 sont appliquées, et celles du
 * lot 9 bis pour la marque des comptes de démonstration (users.demo_account, I1, fix(9b.I1-SE)).
 */
export async function assertSchemaReady(client: SupabaseClient): Promise<void> {
    const checks: ReadonlyArray<readonly [string, string, string]> = [
        ['ticket_categories', 'sale_online, sale_counter', '20261106'],
        ['payments', 'simulated', '20261106'],
        ['users', 'demo_account', '20261109'],
    ];
    for (const [table, columns, migrations] of checks) {
        const { error } = await client.from(table).select(columns).limit(1);
        if (error) throw new Error(`Schéma en retard (${table} : ${error.message}) : appliquez les migrations ${migrations} sur ce projet, voir docs/essai-local.md.`);
    }
}

/** Tous les comptes du projet, page par page. */
export async function listAuthUsers(client: SupabaseClient): Promise<AuthUserLike[]> {
    const perPage = 200;
    const users: AuthUserLike[] = [];
    for (let page = 1; ; page++) {
        const { data, error } = await client.auth.admin.listUsers({ page, perPage });
        if (error) throw new Error(`Lecture des comptes impossible : ${error.message}`);
        users.push(...data.users);
        if (data.users.length < perPage) return users;
    }
}

// ── Données ────────────────────────────────────────────────────────────────

interface AccountSeed { key: AccountKey; email: string; phone: string; firstName: string; lastName: string; primaryRole: string; roles: string[] }

type AccountKey = 'superadmin' | 'admin' | 'partenaire' | 'controleur' | 'clientA' | 'clientB';

function account(key: AccountKey, local: string, n: number, firstName: string, primaryRole: string): AccountSeed {
    const roles = primaryRole === 'CLIENT' ? ['CLIENT'] : ['CLIENT', primaryRole];
    return { key, email: `${local}@${SEED_DOMAIN}`, phone: `+221700009${String(n).padStart(3, '0')}`, firstName, lastName: 'Essai', primaryRole, roles };
}

const ACCOUNTS: readonly AccountSeed[] = [
    account('superadmin', 'superadmin', 1, 'Aïda', 'SUPERADMIN'),
    account('admin', 'admin', 2, 'Moussa', 'ADMIN'),
    account('partenaire', 'partenaire', 3, 'Mariama', 'PARTENAIRE'),
    account('controleur', 'controleur', 4, 'Ibrahima', 'CONTROLEUR'),
    account('clientA', 'client1', 5, 'Fatou', 'CLIENT'),
    account('clientB', 'client2', 6, 'Lamine', 'CLIENT'),
];

interface CategorySeed { name: string; price: number; total: number; online: boolean; counter: boolean }
type SeedStatus = 'BROUILLON' | 'EN_ATTENTE' | 'PUBLIE';
interface EventSeed { slug: string; title: string; description: string; inDays: number; status: SeedStatus; categories: CategorySeed[] }

const EVENTS: readonly EventSeed[] = [
    {
        slug: 'essai-concert-payant', title: 'Concert d\'essai à Dakar', status: 'PUBLIE', inDays: 21,
        description: 'Événement publié et payant, avec les trois réglages de vente : partout, sur place, invitations.',
        categories: [
            { name: 'Pass général', price: 5000, total: 200, online: true, counter: true },
            { name: 'Tarif guichet', price: 4000, total: 100, online: false, counter: true },
            { name: 'Carré invités', price: 10000, total: 30, online: false, counter: false },
        ],
    },
    {
        slug: 'essai-journee-gratuite', title: 'Journée portes ouvertes d\'essai', status: 'PUBLIE', inDays: 28,
        description: 'Événement publié et gratuit.',
        categories: [{ name: 'Entrée libre', price: 0, total: 150, online: true, counter: true }],
    },
    {
        slug: 'essai-gala-en-attente', title: 'Gala d\'essai en attente', status: 'EN_ATTENTE', inDays: 35,
        description: 'Événement soumis, à valider par un administrateur.',
        categories: [{ name: 'Table gala', price: 15000, total: 80, online: true, counter: true }],
    },
    {
        slug: 'essai-atelier-brouillon', title: 'Atelier d\'essai en brouillon', status: 'BROUILLON', inDays: 42,
        description: 'Brouillon de l\'organisateur, encore modifiable.',
        categories: [{ name: 'Participant', price: 2000, total: 40, online: true, counter: true }],
    },
];

const EVENT_START_HOUR = 20;
const EVENT_HOURS = 4;

function dateColumns(inDays: number, now: number): { start_date: string; start_time: string; end_date: string; end_time: string } {
    const midnight = now - (now % DAY_MS);
    // Africa/Dakar = UTC+0 toute l'année
    const start = new Date(midnight + inDays * DAY_MS + EVENT_START_HOUR * 3_600_000).toISOString();
    const end = new Date(midnight + inDays * DAY_MS + (EVENT_START_HOUR + EVENT_HOURS) * 3_600_000).toISOString();
    return { start_date: start.slice(0, 10), start_time: start.slice(11, 19), end_date: end.slice(0, 10), end_time: end.slice(11, 19) };
}

function must<T>(what: string, res: { data: T | null; error: { message: string } | null }): T {
    if (res.error) throw new Error(`${what} : ${res.error.message}`);
    if (res.data === null) throw new Error(`${what} : aucune ligne rendue`);
    return res.data;
}

function done(what: string, res: { error: { message: string } | null }): void {
    if (res.error) throw new Error(`${what} : ${res.error.message}`);
}

export interface SeedReport {
    created: string[];
    kept: string[];
    accounts: { email: string; role: string }[];
}

async function ensureAccount(client: SupabaseClient, spec: AccountSeed, password: string, report: SeedReport): Promise<string> {
    const found = await client.from('users').select('id').eq('email', spec.email).maybeSingle();
    if (found.error) throw new Error(`recherche de ${spec.email} : ${found.error.message}`);
    if (found.data) {
        // Lot 9 bis (I1, B108, fix(9b.I1-SE)) : un compte du seed semé avant M12 reçoit la marque des envois retenus
        // (seule écriture sur un compte gardé, et seulement si elle manque).
        done(`marque de démonstration ${spec.email}`, await client.from('users').update({ demo_account: true })
            .eq('id', String(found.data.id)).eq('demo_account', false));
        report.kept.push(spec.email);
        return String(found.data.id);
    }
    const created = await client.auth.admin.createUser({
        email: spec.email, password, email_confirm: true, phone: spec.phone, phone_confirm: true,
        user_metadata: { first_name: spec.firstName, last_name: spec.lastName, phone: spec.phone },
        app_metadata: { is_essai_fixture: true },
    });
    if (created.error || !created.data.user) throw new Error(`compte ${spec.email} : ${created.error?.message ?? 'utilisateur absent'}`);
    const userId = created.data.user.id;
    // Le trigger d'inscription a créé le profil au rôle CLIENT, avec le numéro tel que l'authentification le garde.
    done(`profil ${spec.email}`, await client.from('users').update({
        first_name: spec.firstName, last_name: spec.lastName, phone: spec.phone, email: spec.email, role: spec.primaryRole,
        status: 'ACTIF', referral_status: 'STANDARD',
        // Lot 9 bis (I1, B108, fix(9b.I1-SE)) : aucun SMS, email ni push réel vers un compte du seed (garde des envois)
        demo_account: true,
        updated_at: new Date().toISOString(),
    }).eq('id', userId));
    const present = must(`rôles ${spec.email}`, await client.from('user_roles').select('role').eq('user_id', userId)) as { role: string }[];
    const missing = spec.roles.filter((role) => !present.some((r) => r.role === role));
    if (missing.length > 0) done(`rôles ${spec.email}`, await client.from('user_roles').insert(missing.map((role) => ({ user_id: userId, role }))));
    report.created.push(spec.email);
    return userId;
}

/** R60 : ajoute au compte admin les permissions manquantes (insertion seule, aucune suppression ni réécriture). */
async function ensureAdminPermissions(client: SupabaseClient, adminId: string, grantedBy: string, report: SeedReport): Promise<void> {
    const present = must('permissions du compte admin', await client.from('admin_permissions').select('permission').eq('user_id', adminId)) as { permission: string }[];
    const missing = SEED_ADMIN_PERMISSIONS.filter((perm) => !present.some((r) => r.permission === perm));
    if (missing.length === 0) {
        report.kept.push('permissions admin');
        return;
    }
    // Insertion des seules manquantes (jamais d'upsert : tests/schema/essai-seed-gardes.test.ts) ; une course avec un
    // autre passage lève sur uq_admin_user_permission, sans rien réécrire.
    done('permissions du compte admin', await client.from('admin_permissions').insert(
        missing.map((permission) => ({ user_id: adminId, permission, granted_by: grantedBy })),
    ));
    report.created.push(`permissions admin (${missing.length})`);
}

async function ensurePartner(client: SupabaseClient, ownerId: string, owner: AccountSeed, now: number, report: SeedReport): Promise<string> {
    const found = await client.from('partners').select('id').eq('user_id', ownerId).maybeSingle();
    if (found.error) throw new Error(`recherche du partenaire : ${found.error.message}`);
    if (found.data) {
        report.kept.push('partenaire');
        return String(found.data.id);
    }
    // event-village-dev ne joue pas supabase/seed.sql : subscription_plans peut être vide, le partenaire reste alors sans formule.
    const plan = await client.from('subscription_plans').select('id').eq('code', 'STARTER').maybeSingle();
    if (plan.error) throw new Error(`formule STARTER : ${plan.error.message}`);
    const partner = must('partenaire', await client.from('partners').insert({
        user_id: ownerId, company_name: 'Essai Événements SARL', commercial_name: 'Essai Événements',
        description: 'Organisateur de démonstration du mode d\'essai.', address: '1, rue de l\'Essai, Dakar', city: 'Dakar',
        phone: owner.phone, email: owner.email, is_verified: true, status: 'VALIDE', subscription_plan_id: plan.data?.id ?? null,
        is_founder: false,
        trial_started_at: new Date(now).toISOString(), trial_ends_at: new Date(now + TRIAL_DAYS_STANDARD * DAY_MS).toISOString(),
    }).select('id').single()) as { id: string };
    const activity = await client.from('partner_activities').select('id').eq('partner_id', partner.id).eq('activity_type', 'ORGANISATEUR').maybeSingle();
    if (activity.error) throw new Error(`activité du partenaire : ${activity.error.message}`);
    if (!activity.data) {
        done('activité du partenaire', await client.from('partner_activities').insert({ partner_id: partner.id, activity_type: 'ORGANISATEUR', is_active: true }));
    }
    report.created.push('partenaire');
    return partner.id;
}

async function uploadPoster(client: SupabaseClient, partnerId: string, slug: string): Promise<string> {
    const objectPath = `events/${partnerId}/${slug}.png`;
    const { error } = await client.storage.from(BUCKET).upload(objectPath, fixturePosterPng(slug), { contentType: 'image/png' });
    // Affiche déjà là : une création interrompue l'a laissée, elle n'est pas remplacée.
    if (error && !/already exists/i.test(error.message)) throw new Error(`affiche ${slug} : ${error.message}`);
    return client.storage.from(BUCKET).getPublicUrl(objectPath).data.publicUrl;
}

async function transition(client: SupabaseClient, seed: EventSeed, eventId: string, actorId: string, to: string): Promise<void> {
    const { data, error } = await client.rpc('event_transition', { p: { event_id: eventId, actor_id: actorId, to_status: to } });
    if (error) throw new Error(`« ${seed.title} » vers ${to} : ${error.message}`);
    if ((data as { ok?: boolean } | null)?.ok !== true) throw new Error(`« ${seed.title} » vers ${to} refusé : ${JSON.stringify(data)}`);
}

interface EventActors { partnerId: string; ownerId: string; adminId: string; controllerId: string }

async function ensureEvent(client: SupabaseClient, seed: EventSeed, actors: EventActors, now: number, report: SeedReport): Promise<void> {
    const found = await client.from('events').select('id').eq('slug', seed.slug).maybeSingle();
    if (found.error) throw new Error(`recherche de « ${seed.title} » : ${found.error.message}`);
    if (found.data) {
        report.kept.push(seed.slug);
        return;
    }
    const { partnerId, ownerId, adminId, controllerId } = actors;
    const imageUrl = await uploadPoster(client, partnerId, seed.slug);
    const event = must(`événement « ${seed.title} »`, await client.from('events').insert({
        partner_id: partnerId, title: seed.title, slug: seed.slug, description: seed.description, category: 'CONCERT',
        ...dateColumns(seed.inDays, now), location: 'Salle d\'essai, Dakar', city: 'Dakar', capacity: 500, image_url: imageUrl, status: 'BROUILLON',
        services: { ticketing: true, tableBooking: false, communication: false },
    }).select('id').single()) as { id: string };
    for (const c of seed.categories) {
        done(`catégorie « ${c.name} »`, await client.from('ticket_categories').insert({
            event_id: event.id, name: c.name, price: c.price, total_quantity: c.total, sold_quantity: 0, is_active: true,
            sale_online: c.online, sale_counter: c.counter, max_per_order: 10,
        }));
    }
    if (seed.status !== 'BROUILLON') await transition(client, seed, event.id, ownerId, 'EN_ATTENTE');
    if (seed.status === 'PUBLIE') {
        await transition(client, seed, event.id, adminId, 'VALIDE');
        await transition(client, seed, event.id, ownerId, 'PUBLIE');
        done(`affectation sur « ${seed.title} »`, await client.from('event_controllers').insert({
            event_id: event.id, user_id: controllerId, can_accept_cash: true, created_by: ownerId, entry_point: 'Entrée principale',
        }));
    }
    report.created.push(seed.slug);
}

/** Crée ce qui manque, ne touche à rien d'autre. Lignes présentes : `kept`. Lève à la première erreur, avec l'objet en cause. */
export async function runSeedDev(client: SupabaseClient, { password }: { password: string }): Promise<SeedReport> {
    const now = Date.now();
    const report: SeedReport = { created: [], kept: [], accounts: ACCOUNTS.map((a) => ({ email: a.email, role: a.primaryRole })) };
    const ids = new Map<AccountKey, string>();
    for (const spec of ACCOUNTS) ids.set(spec.key, await ensureAccount(client, spec, password, report));
    const userId = (key: AccountKey): string => {
        const id = ids.get(key);
        if (!id) throw new Error(`compte ${key} absent`);
        return id;
    };
    await ensureAdminPermissions(client, userId('admin'), userId('superadmin'), report);
    const owner = ACCOUNTS.find((a) => a.key === 'partenaire');
    if (!owner) throw new Error('compte partenaire absent de la liste du seed');
    const actors: EventActors = {
        partnerId: await ensurePartner(client, userId('partenaire'), owner, now, report),
        ownerId: userId('partenaire'),
        adminId: userId('superadmin'),
        controllerId: userId('controleur'),
    };
    for (const seed of EVENTS) await ensureEvent(client, seed, actors, now, report);
    return report;
}

/**
 * Lot 8, tâche 8.1 (contrat 5.2, 5.5, L23) — runSeedDev(client, { password }) joué deux fois sur la base LOCALE,
 * sans les gardes (elles sont prouvées par tests/schema/essai-seed-gardes.test.ts) : comptes et données de
 * démonstration, aucune vente, statuts atteints par event_transition, trois profils de canaux, et rejeu qui ne
 * touche rien.
 *
 * Le seed fixe ses adresses : la suite repère ses lignes par le domaine essai.eventvillage.invalid. Le premier
 * passage se fait avec subscription_plans VIDE, comme sur event-village-dev (supabase/seed.sql n'y est pas joué) ;
 * la table et les références sont rétablies dans un finally. Mot de passe généré, jamais TEST_PASSWORD.
 *
 * Rouge aujourd'hui : scripts/dev/seed-dev.core.ts n'existe pas (fix(8.1s)), chaque test le nomme. Le vert demande
 * aussi M1 (fix(8.0s)) : les trois profils s'écrivent sur sale_online et sale_counter.
 */
import '../helpers/env';
import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { openConcurrentClient } from '../helpers/db';
import { assertRecetteInvariants } from '../helpers/recette-invariants';
import { eventHistory } from './cycle-helpers';
import { importModule, service } from './paiement-helpers';

const CORE_FILE = path.join(process.cwd(), 'scripts', 'dev', 'seed-dev.core.ts');
const DOMAIN = '@essai.eventvillage.invalid';
const ACCOUNT_PHONE = /^\+221700009\d{3}$/;

interface SeedCore { runSeedDev(client: SupabaseClient, opts: { password: string }): Promise<unknown> }

async function seed(password: string): Promise<void> {
    assert.ok(fs.existsSync(CORE_FILE), 'scripts/dev/seed-dev.core.ts absent : livré par fix(8.1s)');
    const core = (await importModule('../../scripts/dev/seed-dev.core')) as SeedCore;
    await core.runSeedDev(service, { password });
}

// Mot de passe généré, conforme à checkPasswordStrength.
const SEED_PASSWORD = `Aa1!${randomBytes(12).toString('hex')}`;
const OTHER_PASSWORD = `Bb2!${randomBytes(12).toString('hex')}`;

after(async () => {
    await assertRecetteInvariants('essai-seed-dev');
});

// ── subscription_plans vide, le temps du premier passage ───────────────────

/** Vide subscription_plans (références SET NULL comprises), puis rétablit tout à l'identique, même sur un échec. */
async function withoutPlans<T>(fn: () => Promise<T>): Promise<T> {
    const open = await openConcurrentClient({ applicationName: 'ev-essai-seed-plans' });
    let plans: unknown[] = [];
    const references: Array<{ table: string; column: string; rows: Array<{ id: string; plan: string }> }> = [];
    try {
        const fks = await open.query<{ tbl: string; col: string }>(`
            SELECT c.conrelid::regclass::text AS tbl, a.attname AS col
              FROM pg_constraint c
              JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
             WHERE c.contype = 'f' AND c.confrelid = 'public.subscription_plans'::regclass`);
        for (const fk of fks.rows) {
            const r = await open.query<{ id: string; plan: string }>(`SELECT id::text AS id, ${fk.col}::text AS plan FROM ${fk.tbl} WHERE ${fk.col} IS NOT NULL`);
            references.push({ table: fk.tbl, column: fk.col, rows: r.rows });
        }
        plans = (await open.query<{ row: unknown }>('SELECT to_jsonb(p) AS row FROM public.subscription_plans p')).rows.map((r) => r.row);
        await open.query('DELETE FROM public.subscription_plans');
        await open.commit();
    } finally {
        await open.close();
    }
    try {
        return await fn();
    } finally {
        const restore = await openConcurrentClient({ applicationName: 'ev-essai-seed-plans' });
        try {
            await restore.query('DELETE FROM public.subscription_plans');
            await restore.query(`INSERT INTO public.subscription_plans SELECT * FROM jsonb_populate_recordset(NULL::public.subscription_plans, $1::jsonb)`, [JSON.stringify(plans)]);
            // Rétablir une référence n'active aucune formule : l'avis SUBSCRIPTION_ACTIVATED ne doit pas repartir.
            await restore.query('ALTER TABLE public.partners DISABLE TRIGGER trg_partners_subscription');
            for (const ref of references) {
                await restore.query(
                    `UPDATE ${ref.table} t SET ${ref.column} = r.plan FROM jsonb_to_recordset($1::jsonb) AS r(id uuid, plan uuid) WHERE t.id = r.id`,
                    [JSON.stringify(ref.rows)]);
            }
            await restore.query('ALTER TABLE public.partners ENABLE TRIGGER trg_partners_subscription');
            await restore.commit();
        } finally {
            await restore.close();
        }
    }
}

// ── Photographie des lignes du seed ────────────────────────────────────────

type Row = Record<string, unknown>;

interface Snapshot {
    users: Row[];
    roles: Row[];
    partners: Row[];
    activities: Row[];
    events: Row[];
    categories: Row[];
    controllers: Row[];
    tickets: number;
    payments: number;
}

function rowsOf<T>(res: { data: T[] | null; error: { message: string } | null }, what: string): T[] {
    assert.equal(res.error, null, `${what} : ${res.error?.message}`);
    return res.data ?? [];
}

function byId(a: Row, b: Row): number {
    return String(a.id ?? a.role).localeCompare(String(b.id ?? b.role));
}

async function snapshot(): Promise<Snapshot> {
    const users = rowsOf(await service.from('users').select('id, email, phone, first_name, last_name, status').like('email', `%${DOMAIN}`), 'comptes');
    const userIds = users.map((u) => String(u.id));
    const roles = rowsOf(await service.from('user_roles').select('user_id, role').in('user_id', userIds), 'rôles');
    const partners = rowsOf(await service.from('partners').select('id, user_id, status, is_verified, company_name').in('user_id', userIds), 'partenaires');
    const partnerIds = partners.map((p) => String(p.id));
    const activities = rowsOf(await service.from('partner_activities').select('partner_id, activity_type, is_active').in('partner_id', partnerIds), 'activités');
    const events = rowsOf(await service.from('events').select('id, partner_id, title, slug, status, image_url, description').in('partner_id', partnerIds), 'événements');
    const eventIds = events.map((e) => String(e.id));
    const categories = rowsOf(await service.from('ticket_categories').select('id, event_id, name, price, total_quantity, sold_quantity, is_visible, sale_online, sale_counter').in('event_id', eventIds), 'catégories');
    const controllers = rowsOf(await service.from('event_controllers').select('event_id, user_id').in('event_id', eventIds), 'affectations');
    const tickets = await service.from('tickets').select('id', { count: 'exact', head: true }).in('event_id', eventIds);
    assert.equal(tickets.error, null, `billets : ${tickets.error?.message}`);
    const payments = await service.from('payments').select('id', { count: 'exact', head: true }).in('client_id', userIds);
    assert.equal(payments.error, null, `paiements : ${payments.error?.message}`);
    return {
        users: users.sort(byId), roles, partners: partners.sort(byId), activities, events: events.sort(byId), categories: categories.sort(byId), controllers,
        tickets: tickets.count ?? 0, payments: payments.count ?? 0,
    };
}

function userWithRole(s: Snapshot, role: string): Row {
    const hit = s.roles.find((r) => r.role === role);
    assert.ok(hit, `aucun compte du seed n'a le rôle ${role}`);
    const user = s.users.find((u) => u.id === hit.user_id);
    assert.ok(user, `compte du rôle ${role} introuvable`);
    return user;
}

function statusCount(s: Snapshot, status: string): number {
    return s.events.filter((e) => e.status === status).length;
}

// ── Passages (mémorisés : chaque test est lisible seul, l'ordre ne change rien) ──

let firstPass: Promise<Snapshot> | undefined;
let secondPass: Promise<{ before: Snapshot; after: Snapshot; changedTitle: string; changedFirstName: string; changedCategory: string }> | undefined;

function afterFirstRun(): Promise<Snapshot> {
    firstPass ??= (async () => {
        // Avant de vider subscription_plans : au run « avant », le module absent ne doit rien toucher en base.
        assert.ok(fs.existsSync(CORE_FILE), 'scripts/dev/seed-dev.core.ts absent : livré par fix(8.1s)');
        await withoutPlans(() => seed(SEED_PASSWORD));
        return snapshot();
    })();
    return firstPass;
}

/** L'utilisateur a travaillé entre deux passages : ses données doivent survivre au rejeu. */
function afterSecondRun() {
    secondPass ??= (async () => {
        await afterFirstRun();
        const s = await snapshot();
        const draft = s.events.find((e) => e.status === 'BROUILLON');
        assert.ok(draft, 'brouillon du seed introuvable');
        const changedTitle = `Titre retouché ${randomBytes(4).toString('hex')}`;
        const { error: evErr } = await service.from('events').update({ title: changedTitle }).eq('id', draft.id);
        assert.equal(evErr, null, `retouche de l'événement : ${evErr?.message}`);

        const client = userWithRole(s, 'CLIENT');
        const changedFirstName = `Prenom${randomBytes(3).toString('hex')}`;
        const { error: userErr } = await service.from('users').update({ first_name: changedFirstName }).eq('id', client.id);
        assert.equal(userErr, null, `retouche du compte : ${userErr?.message}`);

        const category = s.categories.find((c) => c.sale_online === true && c.sale_counter === true);
        assert.ok(category, 'catégorie vendue partout introuvable');
        const { error: catErr } = await service.from('ticket_categories').update({ sale_counter: false }).eq('id', category.id);
        assert.equal(catErr, null, `retouche de la catégorie : ${catErr?.message}`);

        const before = await snapshot();
        await seed(OTHER_PASSWORD);
        return { before, after: await snapshot(), changedTitle, changedFirstName, changedCategory: String(category.id) };
    })();
    return secondPass;
}

async function signIn(email: string, password: string): Promise<string | null> {
    const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
    const { error } = await anon.auth.signInWithPassword({ email, password });
    return error ? error.message : null;
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('runSeedDev : premier passage, subscription_plans vide', () => {
    test('six comptes de démonstration, un par rôle et deux clients, marqués et fictifs', async () => {
        const s = await afterFirstRun();
        assert.equal(s.users.length, 6, `comptes : ${s.users.map((u) => u.email).join(', ')}`);
        for (const role of ['SUPERADMIN', 'ADMIN', 'PARTENAIRE', 'CONTROLEUR']) userWithRole(s, role);
        const clients = s.roles.filter((r) => r.role === 'CLIENT').length;
        assert.ok(clients >= 2, `deux clients au moins attendus, ${clients} trouvés`);
        for (const u of s.users) {
            assert.equal(u.status, 'ACTIF', `${String(u.email)} : ${String(u.status)}`);
            assert.match(String(u.phone), ACCOUNT_PHONE, `${String(u.email)} : numéro hors de la plage fictive`);
            const { data, error } = await service.auth.admin.getUserById(String(u.id));
            assert.equal(error, null, `compte ${String(u.email)} : ${error?.message}`);
            assert.equal(data.user?.user_metadata?.is_essai_fixture, true, `${String(u.email)} : marque is_essai_fixture absente`);
        }
    });

    test('partenaire VALIDE et vérifié, activité ORGANISATEUR, contrôleur affecté', async () => {
        const s = await afterFirstRun();
        assert.equal(s.partners.length, 1, 'une seule fiche partenaire');
        assert.equal(s.partners[0].status, 'VALIDE');
        assert.equal(s.partners[0].is_verified, true);
        assert.deepEqual(s.activities.map((a) => [a.activity_type, a.is_active]), [['ORGANISATEUR', true]]);
        const controller = userWithRole(s, 'CONTROLEUR');
        const published = new Set(s.events.filter((e) => e.status === 'PUBLIE').map((e) => e.id));
        assert.ok(s.controllers.some((c) => c.user_id === controller.id && published.has(c.event_id)), 'contrôleur non affecté à un événement publié');
    });

    test('quatre événements : deux publiés (payant, gratuit), un en attente, un brouillon, avec affiche', async () => {
        const s = await afterFirstRun();
        assert.equal(s.events.length, 4, `événements : ${s.events.map((e) => `${String(e.title)} (${String(e.status)})`).join(', ')}`);
        assert.equal(statusCount(s, 'PUBLIE'), 2);
        assert.equal(statusCount(s, 'EN_ATTENTE'), 1);
        assert.equal(statusCount(s, 'BROUILLON'), 1);
        for (const e of s.events) {
            assert.ok(e.slug, `${String(e.title)} : slug requis, le rejeu cherche par slug`);
            assert.ok(e.image_url, `${String(e.title)} : affiche absente`);
        }
        const prices = s.events.filter((e) => e.status === 'PUBLIE').map((e) => s.categories.filter((c) => c.event_id === e.id).map((c) => Number(c.price)));
        assert.ok(prices.some((list) => list.some((p) => p > 0)), 'un événement publié payant attendu');
        assert.ok(prices.some((list) => list.length > 0 && list.every((p) => p === 0)), 'un événement publié gratuit attendu');
    });

    test('statuts atteints par event_transition : historique complet, aucune écriture directe', async () => {
        const s = await afterFirstRun();
        const expected: Record<string, string[]> = {
            BROUILLON: ['BROUILLON'],
            EN_ATTENTE: ['BROUILLON', 'EN_ATTENTE'],
            PUBLIE: ['BROUILLON', 'EN_ATTENTE', 'VALIDE', 'PUBLIE'],
        };
        for (const e of s.events) {
            const history = await eventHistory(String(e.id));
            assert.deepEqual(history.map((h) => h.new_status), expected[String(e.status)], `historique de « ${String(e.title)} »`);
            assert.equal(history[0].channel, 'CREATION');
            for (const h of history.slice(1)) {
                assert.equal(h.channel, 'TRANSITION', `« ${String(e.title)} » : ${h.new_status}`);
                assert.ok(h.actor_id, `« ${String(e.title)} » : ${h.new_status} sans acteur`);
            }
        }
    });

    test('trois profils de canaux : vendue partout, sur place uniquement, invitations seulement', async () => {
        const s = await afterFirstRun();
        const profile = (online: boolean, counter: boolean) => s.categories.filter((c) => c.sale_online === online && c.sale_counter === counter);
        assert.ok(profile(true, true).length > 0, 'catégorie vendue partout absente');
        assert.ok(profile(false, true).length > 0, 'catégorie « Sur place uniquement » absente');
        assert.ok(profile(false, false).length > 0, 'catégorie « Invitations seulement » absente');
        for (const c of s.categories) assert.equal(c.is_visible, c.sale_online, `« ${String(c.name)} » : is_visible doit rester le miroir de sale_online`);
    });

    test('aucune vente : ni billet, ni paiement, stock intact', async () => {
        const s = await afterFirstRun();
        assert.equal(s.tickets, 0, 'billets créés par le seed');
        assert.equal(s.payments, 0, 'paiements créés par le seed');
        for (const c of s.categories) assert.equal(Number(c.sold_quantity), 0, `« ${String(c.name)} » : sold_quantity`);
    });

    test('mot de passe reçu en option : connexion possible avec lui', async () => {
        const s = await afterFirstRun();
        assert.equal(await signIn(String(userWithRole(s, 'PARTENAIRE').email), SEED_PASSWORD), null);
    });

    test('subscription_plans rétablie après le passage', async () => {
        await afterFirstRun();
        const { data, error } = await service.from('subscription_plans').select('code');
        assert.equal(error, null, `formules : ${error?.message}`);
        assert.ok((data ?? []).some((p) => p.code === 'STARTER'), 'la formule STARTER doit être rétablie');
    });
});

describe('runSeedDev : second passage', () => {
    test('mêmes nombres, aucune ligne perdue, aucun identifiant changé', async () => {
        const { before, after: rerun } = await afterSecondRun();
        for (const key of ['users', 'partners', 'events', 'categories'] as const) {
            assert.deepEqual(rerun[key].map((r) => r.id), before[key].map((r) => r.id), `${key} : identifiants différents après le rejeu`);
        }
        assert.equal(rerun.roles.length, before.roles.length, 'rôles');
        assert.equal(rerun.activities.length, before.activities.length, 'activités');
        assert.equal(rerun.controllers.length, before.controllers.length, 'affectations');
        assert.equal(rerun.tickets, 0);
        assert.equal(rerun.payments, 0);
    });

    test('données modifiées intactes : événement, compte, catégorie', async () => {
        const { before, after: rerun, changedTitle, changedFirstName, changedCategory } = await afterSecondRun();
        assert.ok(rerun.events.some((e) => e.title === changedTitle), 'titre retouché écrasé par le rejeu');
        assert.ok(rerun.users.some((u) => u.first_name === changedFirstName), 'prénom retouché écrasé par le rejeu');
        const category = rerun.categories.find((c) => c.id === changedCategory);
        assert.equal(category?.sale_counter, false, 'réglage de canal écrasé par le rejeu');
        assert.deepEqual(rerun.events, before.events, 'aucun événement ne change au rejeu');
        assert.deepEqual(rerun.categories, before.categories, 'aucune catégorie ne change au rejeu');
        assert.deepEqual(rerun.users, before.users, 'aucun compte ne change au rejeu');
    });

    test('mot de passe existant conservé : le rejeu ne le réécrit pas', async () => {
        const { after: rerun } = await afterSecondRun();
        const email = String(userWithRole(rerun, 'PARTENAIRE').email);
        assert.equal(await signIn(email, SEED_PASSWORD), null, 'le mot de passe du premier passage doit rester valable');
        assert.notEqual(await signIn(email, OTHER_PASSWORD), null, 'le mot de passe du second passage ne doit pas être posé');
    });
});

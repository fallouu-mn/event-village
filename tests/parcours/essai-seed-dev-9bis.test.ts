/**
 * Lot 9 bis, tâche 44 (R60, R91 ; contrat 5.44, B95, X26) — runSeedDev(service, { password }) sur la base LOCALE :
 *  1. R60 : le compte `admin` du seed (Moussa) a les 8 permissions de la préparation P0.2 ;
 *  2. R60 : rejeu sur un admin déjà semé dont les permissions ont été retirées : elles sont ajoutées, rien d'autre ne
 *     change (comptes, rôles, fiche partenaire, événements, catégories, affectations) ;
 *  3. R91 : la fiche partenaire du seed a un essai de 60 jours (comme activate_partner_trial hors fondateur,
 *     M/20261103000006:856-861), `is_founder` faux.
 *
 * Ordre des suites : le lanceur trie les fichiers (localeCompare), cette suite passe AVANT essai-seed-dev.test.ts, qui
 * suppose que son propre passage crée les comptes avec SON mot de passe (« mot de passe reçu en option : connexion
 * possible avec lui », :236 et :281). Si cette suite crée les comptes du seed, after() les retire du domaine du seed
 * (adresses, numéros, slugs renommés, rien supprimé) : essai-seed-dev retrouve une base sans compte de démonstration.
 * Si les comptes existaient déjà, rien n'est retiré. Écart signalé au rapport : sur une base locale réutilisée, la fiche
 * partenaire n'est jamais recréée, le cas 3 lit celle du premier passage.
 *
 * Rouge avant correctif (fix(9b.44) de S-E, scripts/dev/seed-dev.core.ts) : ensureAccount ne pose aucune permission
 * (:188-211, retour direct d'un compte présent :191-194) ; ensurePartner écrit `now + 90 * DAY_MS` (:227) sans
 * `is_founder`. after() : la garde de schéma du lot 9 bis nomme les objets absents jusqu'à M12 (attendu, contrat 10).
 */
import '../helpers/env';
import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { SupabaseClient } from '@supabase/supabase-js';
import { assertLot9bisInvariants } from '../helpers/lot9bis-invariants';
import { randomSenegalPhone } from './helpers';
import { importModule, service } from './paiement-helpers';

type Row = Record<string, unknown>;

const CORE_FILE = path.join(process.cwd(), 'scripts', 'dev', 'seed-dev.core.ts');
const DOMAIN = '@essai.eventvillage.invalid';
const ADMIN_EMAIL = `admin${DOMAIN}`;
const PARTNER_EMAIL = `partenaire${DOMAIN}`;
const DAY_MS = 86_400_000;
/** Préparation P0.2 du plan de test (docs/plan-de-test-evenement.md:45), toutes dans lib/admin/admin-auth.ts:22-41. */
const SEED_ADMIN_PERMISSIONS = [
    'events.read', 'events.write', 'notifications.read', 'notifications.write',
    'partners.read', 'partners.validate', 'payments.read', 'refunds.manage',
].sort();
/** Mot de passe généré, conforme à checkPasswordStrength, jamais TEST_PASSWORD. */
const SEED_PASSWORD = `Cc3!${randomBytes(12).toString('hex')}`;

interface SeedCore { runSeedDev(client: SupabaseClient, opts: { password: string }): Promise<unknown> }

let createdHere = false;
let firstPass: Promise<void> | undefined;

async function seedAccounts(): Promise<Row[]> {
    const { data, error } = await service.from('users').select('id, email, phone, first_name, last_name, status').like('email', `%${DOMAIN}`).order('id');
    assert.equal(error, null, `comptes du seed : ${error?.message}`);
    return (data ?? []) as Row[];
}

async function runSeed(): Promise<void> {
    assert.ok(fs.existsSync(CORE_FILE), 'scripts/dev/seed-dev.core.ts absent');
    const core = (await importModule('../../scripts/dev/seed-dev.core')) as SeedCore;
    await core.runSeedDev(service, { password: SEED_PASSWORD });
}

/** Premier passage de la suite (mémorisé) ; retient s'il a créé les comptes du seed. */
function seeded(): Promise<void> {
    firstPass ??= (async () => {
        createdHere = (await seedAccounts()).length === 0;
        await runSeed();
    })();
    return firstPass;
}

async function userIdByEmail(email: string): Promise<string> {
    const { data, error } = await service.from('users').select('id').eq('email', email).single();
    assert.equal(error, null, `compte ${email} : ${error?.message}`);
    return String(data.id);
}

async function permissionsOf(userId: string): Promise<string[]> {
    const { data, error } = await service.from('admin_permissions').select('permission').eq('user_id', userId);
    assert.equal(error, null, `admin_permissions : ${error?.message}`);
    return (data ?? []).map((r) => String(r.permission)).sort();
}

interface Snapshot { users: Row[]; roles: Row[]; partners: Row[]; events: Row[]; categories: Row[]; controllers: Row[] }

function rows(res: { data: unknown[] | null; error: { message: string } | null }, what: string): Row[] {
    assert.equal(res.error, null, `${what} : ${res.error?.message}`);
    return (res.data ?? []) as Row[];
}

async function snapshot(): Promise<Snapshot> {
    const users = await seedAccounts();
    const ids = users.map((u) => String(u.id));
    const roles = rows(await service.from('user_roles').select('user_id, role').in('user_id', ids).order('user_id').order('role'), 'rôles');
    const partners = rows(await service.from('partners').select('id, user_id, status, is_verified, is_founder, trial_started_at, trial_ends_at, subscription_plan_id').in('user_id', ids).order('id'), 'partenaires');
    const events = rows(await service.from('events').select('id, partner_id, slug, title, status, image_url').in('partner_id', partners.map((p) => String(p.id))).order('id'), 'événements');
    const categories = rows(await service.from('ticket_categories').select('id, event_id, name, price, total_quantity, sold_quantity, sale_online, sale_counter').in('event_id', events.map((e) => String(e.id))).order('id'), 'catégories');
    const controllers = rows(await service.from('event_controllers').select('event_id, user_id, can_accept_cash').in('event_id', events.map((e) => String(e.id))).order('event_id').order('user_id'), 'affectations');
    return { users, roles, partners, events, categories, controllers };
}

/**
 * Comptes créés par cette suite : sortis du domaine du seed (adresse, numéro, slug des événements), sans suppression,
 * pour qu'essai-seed-dev.test.ts (passé après) crée les siens avec son mot de passe.
 */
async function retireSeedData(): Promise<void> {
    const tag = randomBytes(3).toString('hex');
    const users = await seedAccounts();
    const ids = users.map((u) => String(u.id));
    const partners = rows(await service.from('partners').select('id, user_id').in('user_id', ids), 'partenaires à retirer');
    const events = rows(await service.from('events').select('id, slug').in('partner_id', partners.map((p) => String(p.id))), 'événements à retirer');
    for (const e of events) {
        const { error } = await service.from('events').update({ slug: `${String(e.slug)}-retire-${tag}` }).eq('id', String(e.id));
        assert.equal(error, null, `slug de ${String(e.slug)} : ${error?.message}`);
    }
    for (const u of users) {
        const email = `${String(u.email).split('@')[0]}-${tag}@essai-retire.eventvillage.invalid`;
        const phone = randomSenegalPhone('76');
        const { error: authErr } = await service.auth.admin.updateUserById(String(u.id), { email, phone, email_confirm: true, phone_confirm: true });
        assert.equal(authErr, null, `compte d’authentification ${String(u.email)} : ${authErr?.message}`);
        const { error } = await service.from('users').update({ email, phone }).eq('id', String(u.id));
        assert.equal(error, null, `profil ${String(u.email)} : ${error?.message}`);
        const { error: pErr } = await service.from('partners').update({ email, phone }).eq('user_id', String(u.id));
        assert.equal(pErr, null, `fiche partenaire de ${String(u.email)} : ${pErr?.message}`);
    }
    assert.deepEqual(await seedAccounts(), [], 'plus aucun compte dans le domaine du seed');
}

after(async () => {
    try {
        if (firstPass && createdHere) await retireSeedData();
    } finally {
        await assertLot9bisInvariants('essai-seed-dev-9bis');
    }
});

describe('R60 — permissions du compte admin du seed', () => {
    test('admin du seed : les 8 permissions de la préparation P0.2', async () => {
        await seeded();
        assert.deepEqual(await permissionsOf(await userIdByEmail(ADMIN_EMAIL)), SEED_ADMIN_PERMISSIONS,
            'permissions de Moussa (aujourd’hui aucune : le plan les fait poser à la main, P0.2)');
    });

    test('rejeu sur un admin déjà semé, permissions retirées : elles sont ajoutées, rien d’autre ne change', async () => {
        await seeded();
        const admin = await userIdByEmail(ADMIN_EMAIL);
        const { error } = await service.from('admin_permissions').delete().eq('user_id', admin);
        assert.equal(error, null, `retrait des permissions : ${error?.message}`);
        assert.deepEqual(await permissionsOf(admin), [], 'précondition : admin sans permission');
        const before = await snapshot();
        await runSeed();
        assert.deepEqual(await permissionsOf(admin), SEED_ADMIN_PERMISSIONS, 'permissions ajoutées au compte déjà semé (ensureAccount rend aujourd’hui sans rien poser)');
        assert.deepEqual(await snapshot(), before, 'rien d’autre ne change au rejeu');
    });
});

describe('R91 — offre d’essai de la fiche partenaire du seed', () => {
    test('essai de 60 jours, is_founder faux', async () => {
        await seeded();
        const owner = await userIdByEmail(PARTNER_EMAIL);
        const { data, error } = await service.from('partners').select('trial_started_at, trial_ends_at, is_founder').eq('user_id', owner).single();
        assert.equal(error, null, `fiche partenaire : ${error?.message}`);
        assert.ok(data.trial_started_at && data.trial_ends_at, `essai posé : ${JSON.stringify(data)}`);
        const days = (Date.parse(String(data.trial_ends_at)) - Date.parse(String(data.trial_started_at))) / DAY_MS;
        assert.equal(days, 60, `durée de l’essai : ${days} jours (aujourd’hui 90, seed-dev.core.ts:227)`);
        assert.equal(data.is_founder, false, 'is_founder faux');
    });
});

/**
 * Lot 8 — les migrations du lot (contrat, section 2 : 20261106000001 à …06) sont rejouables : chacune, déjà
 * appliquée par la CI depuis une base vide, s'exécute encore deux fois de suite sans erreur, dans une
 * transaction annulée (base LOCALE seulement), et ne gère pas elle-même sa transaction (aucun BEGIN ni
 * COMMIT). Modèle : tests/schema/migration-lot7-rejouable.test.ts.
 *
 * Reprise de la tâche 8.0 prouvée ici sur des données fabriquées (contrat 18.4), et non dans tests/parcours :
 * elle fait DROP COLUMN sur une table publiée, et tests/schema passe après toutes les suites temps réel. Les
 * colonnes du lot sont retirées puis la migration M1 est rejouée dans une transaction annulée : c'est le
 * passage réel de `db push` sur une base qui ne les a pas encore. La reprise ne change aucun comportement :
 * sale_online vaut is_visible, sale_counter vaut vrai, compteurs, prix et résumé public sont inchangés, et les
 * billets existants portent la marque REPRISE.
 *
 * Rouge avant correctif : les six fichiers du lot n'existent pas (fix(8.0s), fix(8.1s), fix(8.2b), fix(8.2c),
 * fix(8.2e-s), fix(8.2l)) ; chaque échec nomme le fichier attendu. En fin de suite, assertRecetteInvariants
 * contrôle toute la base, après toutes les suites tests/parcours.
 */
import '../helpers/env';
import { after, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type { Client } from 'pg';
import { inRolledBackTransaction } from '../helpers/db';
import { loadFixtures } from '../helpers/fixtures';
import { assertRecetteInvariants } from '../helpers/recette-invariants';

const DIR = path.resolve(process.cwd(), 'supabase/migrations');

/** Migrations du lot 8, dans l'ordre du contrat (section 2.1). */
const LOT8_MIGRATIONS = [
    '20261106000001_lot8_canaux.sql',
    '20261106000002_lot8_essai.sql',
    '20261106000003_lot8_paiement.sql',
    '20261106000004_lot8_commissions.sql',
    '20261106000005_lot8_scan.sql',
    '20261106000006_lot8_profil.sql',
] as const;

const M1 = LOT8_MIGRATIONS[0];

function readMigration(name: string): string {
    const file = path.join(DIR, name);
    assert.ok(fs.existsSync(file), `migration du lot 8 absente : supabase/migrations/${name} (contrat, section 2.1)`);
    return fs.readFileSync(file, 'utf8');
}

// ── Reprise de 8.0 : données fabriquées ────────────────────────────────────

interface CategorySpec { key: string; isVisible: boolean; isActive: boolean; sold: number }

/** Visible ou masquée × active ou inactive, plus une masquée avec ventes (le cas « Carré presse »). */
const CATEGORIES: readonly CategorySpec[] = [
    { key: 'visible-active', isVisible: true, isActive: true, sold: 0 },
    { key: 'visible-inactive', isVisible: true, isActive: false, sold: 0 },
    { key: 'masquee-active', isVisible: false, isActive: true, sold: 0 },
    { key: 'masquee-inactive', isVisible: false, isActive: false, sold: 0 },
    { key: 'masquee-vendue', isVisible: false, isActive: true, sold: 1 },
];

interface Scene { eventId: string; categories: Map<string, string>; ticketId: string; reservationId: string }

/** Catégories, billet et réservation de la scène, posés avant toute coupure des colonnes du lot. */
async function fabricate(db: Client): Promise<Scene> {
    const fx = await loadFixtures();
    const eventId = fx.events.A_PUBLIE.id;
    const clientId = fx.users.CLIENT.id;
    const { rows: ev } = await db.query<{ status: string }>('SELECT status::text AS status FROM public.events WHERE id = $1', [eventId]);
    assert.equal(ev[0]?.status, 'PUBLIE', 'la fixture A_PUBLIE doit être publiée : le résumé public ne couvre que les événements publics');

    const suffix = randomUUID().slice(0, 8);
    const categories = new Map<string, string>();
    for (const c of CATEGORIES) {
        const id = randomUUID();
        // Uniquement les colonnes d'avant le lot : c'est l'état que la reprise reçoit en production.
        await db.query(
            `INSERT INTO public.ticket_categories (id, event_id, name, price, total_quantity, sold_quantity, is_active, is_visible, max_per_order)
             VALUES ($1, $2, $3, 5000, 50, $4, $5, $6, 10)`,
            [id, eventId, `TEST Reprise ${c.key} ${suffix}`, c.sold, c.isActive, c.isVisible]);
        categories.set(c.key, id);
    }
    const sold = categories.get('masquee-vendue')!;
    const ticketId = randomUUID();
    await db.query(
        `INSERT INTO public.tickets (id, event_id, category_id, user_id, price, status, sale_channel, ticket_number, qr_code)
         VALUES ($1, $2, $3, $4, 0, 'VALIDE', 'FREE', $5, $6)`,
        [ticketId, eventId, sold, clientId, `TCK-REPRISE-${suffix}`, `EV-QR-REPRISE-${ticketId}`]);

    const paymentId = randomUUID();
    await db.query(
        `INSERT INTO public.payments (id, transaction_id, client_id, payment_target, amount, status, is_platform_payment,
                                      facial_amount, service_fee, aggregator_fee, net_event_village_revenue, partner_payout_amount)
         VALUES ($1, $2, $3, 'TICKET', 5250, 'SUCCESS', true, 5000, 250, 78.75, 171.25, 5000)`,
        [paymentId, `TX-REPRISE-${suffix}`, clientId]);
    const reservationId = randomUUID();
    await db.query(
        `INSERT INTO public.stock_reservations (id, payment_id, category_id, quantity, unit_price, status, expires_at)
         VALUES ($1, $2, $3, 1, 5000, 'CONVERTED', now())`,
        [reservationId, paymentId, sold]);
    return { eventId, categories, ticketId, reservationId };
}

/** Prix et compteurs de toutes les catégories : la reprise ne doit en changer aucun. */
async function categorySnapshot(db: Client): Promise<unknown[]> {
    const { rows } = await db.query(
        `SELECT id::text, price::text, total_quantity, sold_quantity, held_quantity, is_active, is_visible
           FROM public.ticket_categories ORDER BY id`);
    return rows;
}

/** Résumé public de toutes les catégories, hors horodatage. */
async function stockSnapshot(db: Client): Promise<Array<{ category_id: string; event_id: string; availability: string; remaining_hint: number | null }>> {
    const { rows } = await db.query<{ category_id: string; event_id: string; availability: string; remaining_hint: number | null }>(
        `SELECT category_id::text, event_id::text, availability, remaining_hint FROM public.public_category_stock ORDER BY category_id`);
    return rows;
}

async function channels(db: Client, id: string): Promise<{ sale_online: boolean; sale_counter: boolean; is_visible: boolean }> {
    const { rows } = await db.query<{ sale_online: boolean; sale_counter: boolean; is_visible: boolean }>(
        'SELECT sale_online, sale_counter, is_visible FROM public.ticket_categories WHERE id = $1', [id]);
    assert.equal(rows.length, 1, `catégorie ${id} introuvable après la reprise`);
    return rows[0];
}

async function columnDefault(db: Client, table: string, column: string): Promise<string> {
    const { rows } = await db.query<{ column_default: string | null }>(
        `SELECT column_default FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2`, [table, column]);
    assert.equal(rows.length, 1, `colonne public.${table}.${column} absente après la reprise`);
    return rows[0].column_default ?? '';
}

async function triggerDefinition(db: Client, table: string, name: string): Promise<string> {
    const { rows } = await db.query<{ def: string }>(
        `SELECT pg_get_triggerdef(tg.oid) AS def FROM pg_trigger tg
           JOIN pg_class c ON c.oid = tg.tgrelid JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = 'public' AND c.relname = $1 AND tg.tgname = $2 AND NOT tg.tgisinternal`, [table, name]);
    assert.equal(rows.length, 1, `trigger ${name} absent de public.${table} après la reprise`);
    return rows[0].def;
}

after(async () => {
    await assertRecetteInvariants('migration-lot8-rejouable');
});

describe('Lot 8 — migrations 20261106000001 à …06 rejouables (transaction annulée)', () => {
    test('les migrations 20261106… du dépôt sont exactement les six du contrat, dans cet ordre', () => {
        const present = fs.readdirSync(DIR).filter((f) => f.startsWith('20261106')).sort();
        assert.deepEqual(present, [...LOT8_MIGRATIONS], `migrations 20261106… présentes : ${present.join(', ') || 'aucune'}`);
    });

    for (const name of LOT8_MIGRATIONS) {
        test(`${name} : sans BEGIN ni COMMIT, appliquée deux fois de plus sans erreur`, async () => {
            const sql = readMigration(name);
            assert.doesNotMatch(sql, /^\s*(BEGIN|COMMIT)\s*;\s*$/im, `${name} : la migration ne gère pas elle-même sa transaction`);
            await inRolledBackTransaction(async (c) => {
                await c.query(sql);
                await c.query(sql);
            });
        });
    }
});

describe('Lot 8 — reprise de la tâche 8.0 sans changement de comportement (transaction annulée)', () => {
    test('sale_online = is_visible, sale_counter = vrai, compteurs, prix et résumé public inchangés, billets en REPRISE ; rejouée, elle conserve les réglages', async () => {
        const m1 = readMigration(M1);
        await inRolledBackTransaction(async (db) => {
            // a. État d'avant le lot, puis événements différés vidés : sans cela, ALTER TABLE lève 55006.
            const scene = await fabricate(db);
            const id = (key: string): string => scene.categories.get(key)!;
            await db.query('SET CONSTRAINTS ALL IMMEDIATE');

            const categoriesBefore = await categorySnapshot(db);
            const stockBefore = await stockSnapshot(db);
            assert.ok(stockBefore.some((s) => s.category_id === id('visible-active')), 'témoin : la catégorie visible et active figure au résumé public avant la reprise');
            assert.ok(!stockBefore.some((s) => s.category_id === id('masquee-active')), 'témoin : une catégorie masquée ne figure pas au résumé public avant la reprise');

            // c. Base d'avant la migration : colonnes retirées, dépendances (politique, triggers) comprises.
            await db.query('ALTER TABLE public.ticket_categories DROP COLUMN sale_online CASCADE, DROP COLUMN sale_counter CASCADE');
            await db.query('ALTER TABLE public.tickets DROP COLUMN sale_decision CASCADE');
            await db.query('ALTER TABLE public.stock_reservations DROP COLUMN sale_online_at_checkout CASCADE');

            // d. Passage réel de la migration.
            await db.query(m1);

            // e. Aucun changement de comportement.
            const diverging = await db.query<{ n: number }>('SELECT count(*)::int AS n FROM public.ticket_categories WHERE sale_online IS DISTINCT FROM is_visible');
            assert.equal(diverging.rows[0].n, 0, 'reprise : sale_online doit valoir is_visible sur toutes les catégories');
            const noCounter = await db.query<{ n: number }>('SELECT count(*)::int AS n FROM public.ticket_categories WHERE sale_counter IS NOT TRUE');
            assert.equal(noCounter.rows[0].n, 0, 'reprise : sale_counter doit valoir vrai sur toutes les catégories');
            for (const c of CATEGORIES) {
                assert.deepEqual(await channels(db, id(c.key)), { sale_online: c.isVisible, sale_counter: true, is_visible: c.isVisible }, `reprise : canaux de la catégorie ${c.key}`);
            }
            assert.deepEqual(await categorySnapshot(db), categoriesBefore, 'reprise : prix, compteurs et états des catégories inchangés');
            assert.deepEqual(await stockSnapshot(db), stockBefore, 'reprise : public_category_stock identique');

            const ticket = await db.query<{ sale_decision: unknown }>('SELECT sale_decision FROM public.tickets WHERE id = $1', [scene.ticketId]);
            assert.deepEqual(ticket.rows[0]?.sale_decision, { source: 'REPRISE' }, 'reprise : billet existant marqué REPRISE, sans réécriture');
            const notReprise = await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM public.tickets WHERE sale_decision->>'source' IS DISTINCT FROM 'REPRISE'`);
            assert.equal(notReprise.rows[0].n, 0, 'reprise : tous les billets existants sont marqués REPRISE');
            const reservation = await db.query<{ sale_online_at_checkout: boolean }>('SELECT sale_online_at_checkout FROM public.stock_reservations WHERE id = $1', [scene.reservationId]);
            assert.equal(reservation.rows[0]?.sale_online_at_checkout, true, 'reprise : réservation existante à vrai, décision déjà prise');

            // Défauts futurs fail-closed (L12) : la reprise n'a servi que les lignes existantes.
            assert.match(await columnDefault(db, 'tickets', 'sale_decision'), /SANS_DECISION/, 'défaut futur de tickets.sale_decision');
            assert.equal(await columnDefault(db, 'stock_reservations', 'sale_online_at_checkout'), 'false', 'défaut futur de stock_reservations.sale_online_at_checkout');

            // Objets retirés par CASCADE et recréés par M1 : politique publique, triggers, droit de lecture.
            const policy = await db.query<{ qual: string }>(
                `SELECT qual FROM pg_policies WHERE schemaname = 'public' AND tablename = 'ticket_categories' AND policyname = 'ticket_categories_read_public'`);
            assert.equal(policy.rows.length, 1, 'politique ticket_categories_read_public absente après la reprise');
            assert.match(policy.rows[0].qual, /sale_online/, 'la politique publique lit sale_online');
            assert.doesNotMatch(policy.rows[0].qual, /is_visible/, 'la politique publique ne lit plus is_visible');
            await triggerDefinition(db, 'ticket_categories', 'trg_ticket_categories_channels');
            await triggerDefinition(db, 'tickets', 'trg_tickets_sale_decision_guard');
            assert.match(await triggerDefinition(db, 'ticket_categories', 'trg_ticket_categories_public_summary_sync'), /sale_online/,
                'le résumé public se resynchronise quand sale_online change (contrat 2.4, point 5)');
            const privilege = await db.query<{ anon: boolean; authenticated: boolean }>(
                `SELECT has_column_privilege('anon', 'public.ticket_categories', 'sale_online', 'SELECT') AS anon,
                        has_column_privilege('authenticated', 'public.ticket_categories', 'sale_online', 'SELECT') AS authenticated`);
            assert.deepEqual(privilege.rows[0], { anon: true, authenticated: true }, 'sale_online lisible par anon et authenticated : sinon la politique publique casse');

            // f. Rejouée après un réglage de l'organisateur, la migration conserve ce réglage.
            await db.query('UPDATE public.ticket_categories SET sale_counter = FALSE WHERE id = $1', [id('visible-active')]);
            await db.query('UPDATE public.ticket_categories SET sale_online = FALSE WHERE id = $1', [id('visible-inactive')]);
            await db.query('SET CONSTRAINTS ALL IMMEDIATE');
            await db.query(m1);
            assert.deepEqual(await channels(db, id('visible-active')), { sale_online: true, sale_counter: false, is_visible: true }, 'second passage : sale_counter faux conservé');
            assert.deepEqual(await channels(db, id('visible-inactive')), { sale_online: false, sale_counter: true, is_visible: false }, 'second passage : sale_online faux conservé, miroir compris');
            const ticketAgain = await db.query<{ sale_decision: unknown }>('SELECT sale_decision FROM public.tickets WHERE id = $1', [scene.ticketId]);
            assert.deepEqual(ticketAgain.rows[0]?.sale_decision, { source: 'REPRISE' }, 'second passage : décision du billet inchangée');
        });
    });
});

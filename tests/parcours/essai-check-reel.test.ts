/**
 * Lot 9 bis, tâche I2 (contrat 3.2, 4.7, 5.64, B109 ; D-ree 2) — RPC public.essai_check_reel(p jsonb), sur la base
 * LOCALE : ce qui ferait partir de vrais messages ou de l'argent vers des comptes de démonstration.
 *
 * Compteurs exacts par écart, dans UNE transaction annulée en REPEATABLE READ (inRolledBackTransaction) : la RPC est
 * lue avant, puis après l'écriture des lignes du test dans la même transaction ; l'image figée ignore les autres
 * écritures, l'écart ne vient que de ces lignes. Les triggers utilisateur des tables écrites sont coupés dans la
 * transaction (patron lot9bis-invariant.test.ts) : sinon `simulated` serait recalculé et des avis seraient émis.
 *  - outbox : une ligne SMS PENDING compte, une ligne IN_APP PENDING non ;
 *  - paiements : simulé PENDING oui, réel PENDING non ;
 *  - versements : simulé A_ENVOYER oui, simulé bloqué `SIMULATED` non (D-ree constat 10) ; réel A_ENVOYER vers un
 *    compte de démonstration oui, vers un compte ordinaire non (D-I2-1) ;
 *  - billets VALIDE d'un compte de démonstration : événement à venir oui, événement terminé non ; billet d'un compte
 *    ordinaire sur l'événement à venir non.
 * Puis le catalogue : STABLE (`provolatile = 's'`, PostgreSQL y refuse toute écriture), SECURITY DEFINER ; et le
 * refus par REST pour anon et authenticated (42501 exigé ; PGRST202 = fonction absente, nommée).
 *
 * Forme de la réponse : celle de tests/schema/essai-check-reel.test.ts (ok, outbox, payments, cashouts, tickets,
 * seed_events_on_sale).
 *
 * Rouge aujourd'hui : users.demo_account et public.essai_check_reel(jsonb) n'existent pas (M12) : chaque cas les nomme
 * avant toute écriture ; after() reste rouge sur la garde de schéma jusqu'à M12.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Client } from 'pg';
import { inRolledBackTransaction, inspect } from '../helpers/db';
import { assertLot9bisInvariants } from '../helpers/lot9bis-invariants';
import { randomSenegalPhone } from './helpers';
import { newBuyer, type Buyer } from './paiement-helpers';

const M12 = 'migration 20261109000012_lot9bis_mode_reel';

after(async () => {
    await assertLot9bisInvariants('essai-check-reel');
});

interface CheckReel {
    ok: boolean;
    outbox: { total: number; sms: number; email: number; push: number };
    payments: { total: number; examples: Array<Record<string, unknown>> };
    cashouts: { total: number; examples: Array<Record<string, unknown>> };
    tickets: { total: number; events: Array<{ event_id: string; count: number } & Record<string, unknown>> };
    seed_events_on_sale: { total: number; events: Array<Record<string, unknown>> };
}

/** Objets de M12 lus par la suite : un échec les nomme, jamais une erreur Postgres brute. */
async function assertM12(db: Client): Promise<void> {
    const col = await db.query(`SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'demo_account'`);
    const fn = await db.query(`SELECT 1 FROM pg_proc WHERE pronamespace = 'public'::regnamespace AND proname = 'essai_check_reel'
                                  AND pg_get_function_identity_arguments(oid) = 'p jsonb'`);
    const missing = [
        ...(col.rowCount === 0 ? ['colonne public.users.demo_account'] : []),
        ...(fn.rowCount === 0 ? ['fonction public.essai_check_reel(p jsonb)'] : []),
    ];
    assert.deepEqual(missing, [], `objets absents — ${M12} (I1, I2) : ${missing.join(', ')}`);
}

async function checkReel(db: Client): Promise<CheckReel> {
    const { rows } = await db.query<{ r: CheckReel }>(`SELECT public.essai_check_reel('{}'::jsonb) AS r`);
    const r = rows[0].r;
    for (const key of ['outbox', 'payments', 'cashouts', 'tickets', 'seed_events_on_sale'] as const) {
        assert.ok(r && typeof r[key] === 'object' && r[key] !== null, `essai_check_reel : rubrique « ${key} » absente de la réponse ${JSON.stringify(r).slice(0, 300)}`);
    }
    assert.equal(r.ok, true, `essai_check_reel : ok attendu, ${JSON.stringify(r).slice(0, 300)}`);
    return r;
}

// ── Lignes écrites dans la transaction (triggers utilisateur coupés) ───────

const TABLES = ['notification_outbox', 'payments', 'cashouts', 'partners', 'events', 'ticket_categories', 'tickets'] as const;

async function insertPartner(db: Client, userId: string): Promise<string> {
    const id = randomUUID();
    await db.query('INSERT INTO public.partners (id, user_id, company_name, status) VALUES ($1, $2, $3, \'VALIDE\'::public.partner_status)',
        [id, userId, `TEST check-reel ${id.slice(0, 8)}`]);
    return id;
}

async function insertEvent(db: Client, partnerId: string, status: 'PUBLIE' | 'TERMINE', days: number): Promise<string> {
    const id = randomUUID();
    await db.query(
        `INSERT INTO public.events (id, partner_id, title, slug, start_date, start_time, end_date, end_time, location, city, status)
         VALUES ($1, $2, $3, $4, current_date + $5::int, '20:00', current_date + $5::int, '23:00', 'Salle test', 'Dakar', $6::public.event_status)`,
        [id, partnerId, `TEST check-reel ${status} ${id.slice(0, 8)}`, `test-check-reel-${id}`, days, status]);
    return id;
}

async function insertCategory(db: Client, eventId: string): Promise<string> {
    const id = randomUUID();
    await db.query(
        `INSERT INTO public.ticket_categories (id, event_id, name, price, total_quantity, sold_quantity, is_active, is_visible, max_per_order)
         VALUES ($1, $2, $3, 0, 50, 0, TRUE, TRUE, 10)`, [id, eventId, `TEST check-reel ${id.slice(0, 8)}`]);
    return id;
}

async function insertTicket(db: Client, eventId: string, categoryId: string, userId: string): Promise<string> {
    const id = randomUUID();
    await db.query(
        `INSERT INTO public.tickets (id, event_id, category_id, user_id, ticket_number, price, qr_code, status, sale_channel, transfer_locked, sale_decision)
         VALUES ($1, $2, $3, $4, $5, 0, $6, 'VALIDE'::public.ticket_status, 'ONLINE', FALSE, $7::jsonb)`,
        [id, eventId, categoryId, userId, `TCK-CHECK-REEL-${id.slice(0, 8)}`, `EV-QR-CHECK-REEL-${id}`,
            JSON.stringify({ source: 'CATEGORIE', sale_online: true, sale_counter: true, decided_at: '2026-11-09T12:00:00+00:00' })]);
    return id;
}

async function insertPayment(db: Client, clientId: string, eventId: string, simulated: boolean): Promise<string> {
    const id = randomUUID();
    await db.query(
        `INSERT INTO public.payments (id, transaction_id, client_id, event_id, payment_target, amount, status, is_platform_payment, offline_payment_method,
                                      facial_amount, service_fee, aggregator_fee, net_event_village_revenue, partner_payout_amount, simulated)
         VALUES ($1, $2, $3, $4, 'TICKET', 1000, 'PENDING'::public.payment_status_enum, TRUE, NULL, 1000, 0, 0, 0, 1000, $5)`,
        [id, `TX-CHECK-REEL-${id}`, clientId, eventId, simulated]);
    return id;
}

async function insertCashout(db: Client, spec: { simulated: boolean; blockedReason?: string; beneficiary?: string }): Promise<string> {
    const id = randomUUID();
    await db.query(
        `INSERT INTO public.cashouts (id, kind, idempotency_key, amount, status, simulated, blocked_reason, beneficiary_user_id)
         VALUES ($1, 'REFUND', $2, 1000, 'A_ENVOYER', $3, $4, $5)`,
        [id, `CHECK-REEL-${id}`, spec.simulated, spec.blockedReason ?? null, spec.beneficiary ?? null]);
    return id;
}

async function insertPendingOutbox(db: Client, channel: 'SMS' | 'IN_APP', spec: { phone?: string; user?: string }): Promise<string> {
    const id = randomUUID();
    const key = `CHECK-REEL:${id}`;
    await db.query(
        `INSERT INTO public.notification_outbox (id, idempotency_key, group_key, type, family, channel, status, recipient_user_id, recipient_phone, due_at, next_attempt_at)
         VALUES ($1, $2, $2, 'PASSWORD_CHANGED', 'ESSENTIAL', $3, 'PENDING', $4, $5, now() + interval '30 days', now() + interval '30 days')`,
        [id, key, channel, spec.user ?? null, spec.phone ?? null]);
    return id;
}

// ── Cas ────────────────────────────────────────────────────────────────────

describe('I2 : essai_check_reel, compteurs exacts par écart (transaction annulée)', () => {
    let demo: Buyer;
    let plain: Buyer;
    let owner: Buyer;

    before(async () => {
        demo = await newBuyer('check-reel-demo');
        plain = await newBuyer('check-reel-ordinaire');
        owner = await newBuyer('check-reel-orga');
    });

    test('outbox, paiements, versements et billets : chaque ligne qui compte compte une fois, chaque témoin zéro', async () => {
        await inRolledBackTransaction(async (db) => {
            await db.query('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
            await assertM12(db);
            const before = await checkReel(db);

            for (const table of TABLES) await db.query(`ALTER TABLE public.${table} DISABLE TRIGGER USER`);
            await db.query('UPDATE public.users SET demo_account = TRUE WHERE id = $1', [demo.userId]);

            // Notifications : SMS en file oui, IN_APP non.
            await insertPendingOutbox(db, 'SMS', { phone: randomSenegalPhone('76') });
            await insertPendingOutbox(db, 'IN_APP', { user: plain.userId });

            // Billets : événement à venir et événement terminé d'une partenaire ordinaire.
            const partnerId = await insertPartner(db, owner.userId);
            const upcoming = await insertEvent(db, partnerId, 'PUBLIE', 30);
            const finished = await insertEvent(db, partnerId, 'TERMINE', -3);
            const upcomingCat = await insertCategory(db, upcoming);
            const finishedCat = await insertCategory(db, finished);
            await insertTicket(db, upcoming, upcomingCat, demo.userId);
            await insertTicket(db, finished, finishedCat, demo.userId);
            await insertTicket(db, upcoming, upcomingCat, plain.userId);

            // Paiements : simulé PENDING oui, réel PENDING non.
            await insertPayment(db, plain.userId, upcoming, true);
            await insertPayment(db, plain.userId, upcoming, false);

            // Versements : simulé A_ENVOYER oui ; simulé bloqué SIMULATED non ; réel vers un compte de démonstration oui ; réel ordinaire non.
            await insertCashout(db, { simulated: true });
            await insertCashout(db, { simulated: true, blockedReason: 'SIMULATED' });
            await insertCashout(db, { simulated: false, beneficiary: demo.userId });
            await insertCashout(db, { simulated: false, beneficiary: plain.userId });

            const after = await checkReel(db);
            const delta = {
                outbox: { total: after.outbox.total - before.outbox.total, sms: after.outbox.sms - before.outbox.sms, email: after.outbox.email - before.outbox.email, push: after.outbox.push - before.outbox.push },
                payments: after.payments.total - before.payments.total,
                cashouts: after.cashouts.total - before.cashouts.total,
                tickets: after.tickets.total - before.tickets.total,
            };
            assert.deepEqual(delta, { outbox: { total: 1, sms: 1, email: 0, push: 0 }, payments: 1, cashouts: 2, tickets: 1 },
                `écarts attendus (une ligne SMS, un paiement simulé, un versement simulé et un réel vers la démonstration, un billet à venir) : ${JSON.stringify(delta)}`);

            const events = after.tickets.events;
            assert.ok(Array.isArray(events), 'tickets.events : liste attendue');
            const up = events.find((e) => e.event_id === upcoming);
            assert.equal(up?.count, 1, `événement à venir : un billet de démonstration attendu, ${JSON.stringify(up)}`);
            assert.equal(events.find((e) => e.event_id === finished), undefined, 'événement terminé : jamais compté');
            const printed = JSON.stringify(after);
            for (const forbidden of [demo.phoneE164, demo.phone9, plain.phoneE164, demo.email]) {
                assert.ok(!printed.includes(forbidden), `aucun numéro ni adresse dans la réponse (D-ree 2) : ${forbidden}`);
            }
        });
    });
});

describe('I2 : essai_check_reel, catalogue et privilèges', () => {
    test('STABLE (provolatile = s), SECURITY DEFINER, search_path fixé', async () => {
        const fn = await inspect(async (db) => {
            await assertM12(db);
            const { rows } = await db.query<{ provolatile: string; prosecdef: boolean; proconfig: string[] | null }>(
                `SELECT provolatile, prosecdef, proconfig FROM pg_proc WHERE pronamespace = 'public'::regnamespace AND proname = 'essai_check_reel'`);
            return rows;
        });
        assert.equal(fn.length, 1, 'une seule fonction essai_check_reel (aucune surcharge, A2)');
        assert.equal(fn[0].provolatile, 's', 'STABLE : la lecture seule est garantie par PostgreSQL');
        assert.equal(fn[0].prosecdef, true, 'SECURITY DEFINER');
        assert.ok((fn[0].proconfig ?? []).includes('search_path=public'), `search_path : ${JSON.stringify(fn[0].proconfig)}`);
    });

    function apiClient(token?: string): SupabaseClient {
        return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
            auth: { persistSession: false, autoRefreshToken: false },
            ...(token ? { global: { headers: { Authorization: `Bearer ${token}` } } } : {}),
        });
    }

    test('appel REST refusé à anon et à authenticated (42501)', async () => {
        const buyer = await newBuyer('check-reel-api');
        for (const [who, client] of [['anon', apiClient()], ['authenticated', apiClient(buyer.accessToken)]] as const) {
            const { data, error } = await client.rpc('essai_check_reel', { p: {} });
            assert.ok(error, `${who} : appel accepté (${JSON.stringify(data).slice(0, 200)})`);
            assert.notEqual(error.code, 'PGRST202', `${who} : fonction public.essai_check_reel absente — ${M12} (I2)`);
            assert.equal(error.code, '42501', `${who} : refus 42501 attendu, obtenu ${error.code} ${error.message}`);
        }
    });
});

/**
 * Lot 8, tâche 8.0 — garde-fous de l'invariant (t) (contrat, sections 4.3, 14.2 et 14.3 ; requête
 * RECETTE_INVARIANT_SQL dans tests/helpers/recette-invariants.ts). Un invariant toujours vide ne prouverait
 * rien : dans des transactions annulées (inRolledBackTransaction, modèle terrain-invariant.test.ts), chaque
 * règle détecte une violation fabriquée exprès, à côté d'un témoin conforme écrit dans la même transaction.
 *  - les triggers utilisateur de tickets et de stock_reservations sont coupés dans la transaction (annulé avec
 *    elle) : sinon trg_tickets_sale_decision et trg_stock_reservations_sale_online écraseraient la décision
 *    fabriquée. t3 coupe aussi ceux de ticket_categories (miroir), comme terrain-invariant.test.ts:99 ;
 *  - t0 : billet inséré sans décision, le défaut de colonne vaut SANS_DECISION (fail-closed, L12) ;
 *  - t1 : billet ONLINE, puis FREE (L9), dont la décision dit sale_online faux, ou ne dit rien ;
 *  - t2 : billet COUNTER dont la décision dit sale_counter faux ;
 *  - t3 : is_visible et sale_online divergent ;
 *  - t4 : billet payé en ligne dont la décision contredit sa réservation ;
 *  - témoins : décision conforme, canal de l'autre côté coupé (un billet ONLINE à sale_counter faux, un billet
 *    COUNTER à sale_online faux), ligne REPRISE ignorée ;
 *  - cas central : vente réelle par les trois chemins, coupure du canal, invariant toujours à 0 : (t) ne lit
 *    que l'instantané, jamais les réglages courants de la catégorie ;
 *  - dernier cas : après ROLLBACK, aucune ligne fabriquée ne reste, et les triggers sont actifs.
 * Les violations sont filtrées par objet : la requête lit toute la base, et after() contrôle le reste.
 *
 * Rouge avant correctif : ni les colonnes du lot, ni les triggers de l'instantané n'existent ;
 * assertRecetteSchema échoue dans chaque transaction en nommant chaque objet manquant, jamais par une erreur
 * Postgres brute. recetteViolations exige aussi M3 (payment_duplicate_of) et M4 (uncapped_amount) : la suite
 * ne passe au vert qu'avec fix(8.0s), fix(8.2a) et fix(8.2c).
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { Client } from 'pg';
import { inRolledBackTransaction, inspect } from '../helpers/db';
import { loadFixtures } from '../helpers/fixtures';
import { assertRecetteInvariants, assertRecetteSchema, missingRecetteSchema, recetteViolations, type RecetteViolation } from '../helpers/recette-invariants';
import { newBuyer, service, type Buyer } from './paiement-helpers';
import { buyConfirmed, newPartner, type TestPartner } from './finance-helpers';
import { authed, createTimedEvent, newController, openShift } from './acces-helpers';
import { invoke, routeHandler, show } from './pilotage-helpers';

type Row = Record<string, unknown>;

const T0 = 'billet sans décision de vente';
const T1 = (channel: string): string => `billet ${channel} d'une catégorie non vendue en ligne au moment de l'achat`;
const T2 = 'billet COUNTER d\'une catégorie non vendue au guichet au moment de la vente';
const T3 = 'is_visible et sale_online divergent';
const T4 = 'billet payé en ligne dont la décision ne vient pas de sa réservation';

/** Décisions fabriquées (forme du contrat 2.4). */
const decided = (source: string, saleOnline: boolean, saleCounter: boolean): Row => ({ source, sale_online: saleOnline, sale_counter: saleCounter, decided_at: '2026-11-06T12:00:00+00:00' });

/** Identifiants de toutes les lignes fabriquées (contrôle final après ROLLBACK). */
const FABRICATED = { tickets: new Set<string>(), payments: new Set<string>() };

let partner: TestPartner;

before(async () => {
    partner = await newPartner('canaux-inv');
});

after(async () => {
    await assertRecetteInvariants('canaux-invariant');
});

// ── Outils locaux (dans la transaction annulée) ────────────────────────────

interface Scene { eventId: string; categoryId: string; otherCategoryId: string; price: number; client: string }

async function scene(): Promise<Scene> {
    const fx = await loadFixtures();
    const ev = fx.events.A_PUBLIE;
    const [first, second] = Object.values(ev.categories);
    assert.ok(first && second, 'fixture A_PUBLIE : deux catégories attendues');
    return { eventId: ev.id, categoryId: first.id, otherCategoryId: second.id, price: first.price, client: fx.users.CLIENT.id };
}

/** Schéma présent (échec explicite sinon, AVANT tout DDL), puis triggers utilisateur coupés dans la transaction. */
async function prepare(db: Client, label: string, tables: string[] = ['tickets', 'stock_reservations']): Promise<void> {
    await assertRecetteSchema(`canaux-invariant ${label}`, db);
    for (const table of tables) await db.query(`ALTER TABLE public.${table} DISABLE TRIGGER USER`);
}

/** Billet fabriqué ; sans `decision`, la colonne prend son défaut. */
async function insertTicket(db: Client, s: Scene, over: { channel: 'ONLINE' | 'FREE' | 'COUNTER'; decision?: Row; paymentId?: string }): Promise<string> {
    const id = randomUUID();
    const row: Row = {
        id,
        event_id: s.eventId,
        category_id: s.categoryId,
        user_id: s.client,
        ticket_number: `TCK-INV-CANAUX-${id.slice(0, 8)}`,
        price: s.price,
        qr_code: `EV-QR-INV-CANAUX-${id}`,
        status: 'VALIDE',
        sale_channel: over.channel,
        ...(over.paymentId ? { payment_id: over.paymentId } : {}),
        ...(over.decision ? { sale_decision: JSON.stringify(over.decision) } : {}),
    };
    const cols = Object.keys(row);
    const vals = cols.map((c, i) => (c === 'sale_decision' ? `$${i + 1}::jsonb` : `$${i + 1}`));
    await db.query(`INSERT INTO public.tickets (${cols.join(', ')}) VALUES (${vals.join(', ')})`, Object.values(row));
    FABRICATED.tickets.add(id);
    return id;
}

/** Paiement réussi fabriqué (partner_id et event_id nuls : hors des règles (s)) et sa réservation convertie. */
async function insertPaidReservation(db: Client, s: Scene, saleOnlineAtCheckout: boolean): Promise<string> {
    const id = randomUUID();
    await db.query(
        `INSERT INTO public.payments (id, transaction_id, client_id, payment_target, amount, status, is_platform_payment,
                                      facial_amount, service_fee, aggregator_fee, net_event_village_revenue, partner_payout_amount)
         VALUES ($1, $2, $3, 'TICKET', $4, 'SUCCESS', true, $4, 0, 0, 0, $4)`,
        [id, `TX-INV-CANAUX-${id}`, s.client, s.price]);
    await db.query(
        `INSERT INTO public.stock_reservations (payment_id, category_id, quantity, unit_price, status, expires_at, closed_at, close_reason, sale_online_at_checkout)
         VALUES ($1, $2, 1, $3, 'CONVERTED', now(), now(), 'TEST', $4)`,
        [id, s.categoryId, s.price, saleOnlineAtCheckout]);
    FABRICATED.payments.add(id);
    return id;
}

function about(rows: RecetteViolation[], objet: string): string {
    return JSON.stringify(rows.filter((r) => r.objet === objet));
}

function assertDetected(rows: RecetteViolation[], objet: string, detail: string, what: string): void {
    assert.ok(rows.some((r) => r.regle === 't' && r.objet === objet && r.detail === detail), `${what} : « ${detail} » attendu : ${about(rows, objet)}`);
}

function assertClean(rows: RecetteViolation[], objet: string, what: string): void {
    assert.deepEqual(rows.filter((r) => r.objet === objet), [], `${what} : aucune violation attendue : ${about(rows, objet)}`);
}

// ── Violations fabriquées ──────────────────────────────────────────────────

describe('8.0 Invariant (t) : chaque règle détecte une violation fabriquée', () => {
    test('t0 : billet sans décision (défaut de colonne SANS_DECISION) ; témoin : décision conforme', async () => {
        const s = await scene();
        const ids = { missing: '', witness: '' };
        const rows = await inRolledBackTransaction(async (db) => {
            await prepare(db, 't0');
            ids.missing = await insertTicket(db, s, { channel: 'ONLINE' });
            ids.witness = await insertTicket(db, s, { channel: 'ONLINE', decision: decided('CATEGORIE', true, true) });
            const { rows: def } = await db.query<{ sale_decision: Row }>('SELECT sale_decision FROM public.tickets WHERE id = $1', [ids.missing]);
            assert.deepEqual(def[0].sale_decision, { source: 'SANS_DECISION' }, 'défaut fail-closed de tickets.sale_decision (L12)');
            return recetteViolations(db);
        });
        assertDetected(rows, ids.missing, T0, '(t0)');
        assertClean(rows, ids.witness, '(t0) témoin');
    });

    test('t1 ONLINE : décision sale_online faux, ou clé absente ; témoins : sale_online vrai avec sale_counter faux', async () => {
        const s = await scene();
        const ids = { off: '', absent: '', witness: '' };
        const rows = await inRolledBackTransaction(async (db) => {
            await prepare(db, 't1 ONLINE');
            ids.off = await insertTicket(db, s, { channel: 'ONLINE', decision: decided('CATEGORIE', false, true) });
            ids.absent = await insertTicket(db, s, { channel: 'ONLINE', decision: { source: 'CATEGORIE' } });
            ids.witness = await insertTicket(db, s, { channel: 'ONLINE', decision: decided('CATEGORIE', true, false) });
            return recetteViolations(db);
        });
        assertDetected(rows, ids.off, T1('ONLINE'), '(t1) ONLINE');
        assertDetected(rows, ids.absent, T1('ONLINE'), '(t1) ONLINE, clé absente');
        assertClean(rows, ids.witness, '(t1) ONLINE témoin');
    });

    test('t1 FREE : un billet gratuit est soumis à sale_online (L9) ; témoin : sale_online vrai', async () => {
        const s = await scene();
        const ids = { off: '', witness: '' };
        const rows = await inRolledBackTransaction(async (db) => {
            await prepare(db, 't1 FREE');
            ids.off = await insertTicket(db, s, { channel: 'FREE', decision: decided('CATEGORIE', false, true) });
            ids.witness = await insertTicket(db, s, { channel: 'FREE', decision: decided('CATEGORIE', true, true) });
            return recetteViolations(db);
        });
        assertDetected(rows, ids.off, T1('FREE'), '(t1) FREE');
        assertClean(rows, ids.witness, '(t1) FREE témoin');
    });

    test('t2 : billet COUNTER à sale_counter faux ; témoin : sale_counter vrai avec sale_online faux (« Sur place uniquement »)', async () => {
        const s = await scene();
        const ids = { off: '', witness: '' };
        const rows = await inRolledBackTransaction(async (db) => {
            await prepare(db, 't2');
            ids.off = await insertTicket(db, s, { channel: 'COUNTER', decision: decided('CATEGORIE', true, false) });
            ids.witness = await insertTicket(db, s, { channel: 'COUNTER', decision: decided('CATEGORIE', false, true) });
            return recetteViolations(db);
        });
        assertDetected(rows, ids.off, T2, '(t2)');
        assertClean(rows, ids.witness, '(t2) témoin');
    });

    test('t3 : is_visible et sale_online divergent (triggers de ticket_categories coupés) ; témoin : l’autre catégorie', async () => {
        const s = await scene();
        const rows = await inRolledBackTransaction(async (db) => {
            await prepare(db, 't3', ['ticket_categories']);
            const { rowCount } = await db.query('UPDATE public.ticket_categories SET sale_online = NOT is_visible WHERE id = $1', [s.categoryId]);
            assert.equal(rowCount, 1, 'catégorie fixture modifiée dans la transaction');
            return recetteViolations(db);
        });
        assertDetected(rows, s.categoryId, T3, '(t3)');
        assertClean(rows, s.otherCategoryId, '(t3) témoin');
    });

    test('t4 : billet payé en ligne dont la décision contredit sa réservation ; témoin : décision égale à la réservation', async () => {
        const s = await scene();
        const ids = { off: '', witness: '' };
        const rows = await inRolledBackTransaction(async (db) => {
            await prepare(db, 't4');
            const refused = await insertPaidReservation(db, s, false);
            ids.off = await insertTicket(db, s, { channel: 'ONLINE', paymentId: refused, decision: decided('RESERVATION', true, true) });
            const allowed = await insertPaidReservation(db, s, true);
            ids.witness = await insertTicket(db, s, { channel: 'ONLINE', paymentId: allowed, decision: decided('RESERVATION', true, true) });
            return recetteViolations(db);
        });
        assertDetected(rows, ids.off, T4, '(t4)');
        assertClean(rows, ids.witness, '(t4) témoin');
    });

    test('ligne REPRISE ignorée, quel que soit le canal (billets anciens, sans réécriture)', async () => {
        const s = await scene();
        const ids: string[] = [];
        const rows = await inRolledBackTransaction(async (db) => {
            await prepare(db, 'REPRISE');
            for (const channel of ['ONLINE', 'FREE', 'COUNTER'] as const) {
                ids.push(await insertTicket(db, s, { channel, decision: { source: 'REPRISE' } }));
            }
            return recetteViolations(db);
        });
        for (const id of ids) assertClean(rows, id, 'ligne REPRISE');
    });
});

// ── Cas central ────────────────────────────────────────────────────────────

describe('8.0 Invariant (t) sur une vente réelle', () => {
    test('vente en ligne, gratuite et au guichet, puis coupure des canaux : décisions inchangées, invariant à 0', async () => {
        await assertRecetteSchema('canaux-invariant vente réelle');
        const ev = await createTimedEvent(partner.partnerId, 'canaux invariant', [
            { name: 'Web', price: 3000, total: 10 },
            { name: 'Libre', price: 0, total: 10 },
            { name: 'Guichet', price: 2000, total: 10 },
        ]);
        const buyer: Buyer = await newBuyer('canaux-inv');

        const online = await buyConfirmed(buyer, ev, [['Web', 1]]);
        assert.equal(online.tickets.length, 1, 'un billet en ligne');

        const { data: claimed, error: claimErr } = await service.rpc('free_tickets_claim', {
            p_user_id: buyer.userId, p_event_id: ev.eventId, p_items: [{ category_id: ev.categories.Libre.id, quantity: 1 }],
        });
        assert.equal(claimErr, null, `free_tickets_claim : ${claimErr?.message}`);
        assert.equal((claimed as Row).ok, true, `billet gratuit : ${JSON.stringify(claimed)}`);

        const seller = await newController(partner, ev.eventId, { canAcceptCash: true, label: 'canaux-inv' });
        const opened = await openShift(seller, ev.eventId);
        assert.equal(opened.status, 200, `caisse : ${show(opened)}`);
        const handler = await routeHandler('../../app/api/controller/counter-sale/route', 'POST', 'POST /api/controller/counter-sale');
        const sale = await invoke(handler, authed('/api/controller/counter-sale', 'POST', seller,
            { eventId: ev.eventId, items: [{ categoryId: ev.categories.Guichet.id, quantity: 1 }] }, { 'idempotency-key': randomUUID() }));
        assert.equal(sale.status, 200, `vente au guichet : ${show(sale)}`);

        const read = async (): Promise<Row[]> => {
            const { data, error } = await service.from('tickets').select('id, sale_channel, sale_decision').eq('event_id', ev.eventId).order('id');
            assert.equal(error, null, `billets : ${error?.message}`);
            return (data ?? []) as Row[];
        };
        const before = await read();
        assert.deepEqual(before.map((t) => t.sale_channel).sort(), ['COUNTER', 'FREE', 'ONLINE'], 'un billet par chemin de vente');

        for (const [name, patch] of [['Web', { sale_online: false }], ['Libre', { sale_online: false }], ['Guichet', { sale_counter: false }]] as Array<[string, Row]>) {
            const { error } = await service.from('ticket_categories').update(patch).eq('id', ev.categories[name].id);
            assert.equal(error, null, `coupure de ${name} : ${error?.message}`);
        }

        assert.deepEqual(await read(), before, 'la coupure ne réécrit aucune décision');
        const mine = new Set([...before.map((t) => String(t.id)), ...Object.values(ev.categories).map((c) => c.id)]);
        const rows = (await recetteViolations()).filter((r) => mine.has(r.objet));
        assert.deepEqual(rows, [], `invariant (t) après la coupure : ${JSON.stringify(rows)}`);
    });
});

// ── Après ROLLBACK ─────────────────────────────────────────────────────────

describe('8.0 Invariant (t) sur l’état réel', () => {
    test('schéma du lot présent ; après ROLLBACK, aucune ligne fabriquée ne reste et les triggers sont actifs', async () => {
        assert.deepEqual(await missingRecetteSchema(), [], 'schéma du lot 8 (contrat 14.1)');
        assert.ok(FABRICATED.tickets.size > 0 && FABRICATED.payments.size > 0, `les garde-fous ci-dessus ont fabriqué des lignes (${FABRICATED.tickets.size} billets, ${FABRICATED.payments.size} paiements)`);
        const left = await inspect(async (db) => {
            const ticketIds = Array.from(FABRICATED.tickets);
            const paymentIds = Array.from(FABRICATED.payments);
            const tickets = await db.query<{ id: string }>('SELECT id::text AS id FROM public.tickets WHERE id = ANY($1::uuid[])', [ticketIds]);
            const payments = await db.query<{ id: string }>('SELECT id::text AS id FROM public.payments WHERE id = ANY($1::uuid[])', [paymentIds]);
            const reservations = await db.query<{ id: string }>('SELECT id::text AS id FROM public.stock_reservations WHERE payment_id = ANY($1::uuid[])', [paymentIds]);
            return [...tickets.rows, ...payments.rows, ...reservations.rows].map((r) => r.id);
        });
        assert.deepEqual(left, [], `lignes fabriquées encore présentes après ROLLBACK : ${JSON.stringify(left)}`);

        const disabled = await inspect(async (db) => (await db.query<{ tgname: string }>(
            `SELECT tg.tgname FROM pg_trigger tg JOIN pg_class c ON c.oid = tg.tgrelid JOIN pg_namespace n ON n.oid = c.relnamespace
              WHERE n.nspname = 'public' AND c.relname IN ('tickets', 'stock_reservations', 'ticket_categories')
                AND NOT tg.tgisinternal AND tg.tgenabled = 'D'`)).rows.map((r) => r.tgname));
        assert.deepEqual(disabled, [], `triggers restés coupés : ${JSON.stringify(disabled)}`);

        const fabricated = new Set(FABRICATED.tickets);
        const leaked = (await recetteViolations()).filter((r) => fabricated.has(r.objet));
        assert.deepEqual(leaked, [], `violations fabriquées visibles après ROLLBACK : ${JSON.stringify(leaked)}`);
    });
});

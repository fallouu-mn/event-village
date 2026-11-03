/**
 * Lot 6, tâche 6.0 d — orders, hall_reservations et table_reservations dans la publication supabase_realtime
 * (contrat A4, S2 groupe Dette ; discovery-6-temps-reel-rls.md §4).
 *  - hall_reservations et table_reservations (aucun abonné dans l'application) sont retirées de la
 *    publication ; orders y reste (abonnés : hooks/usePartnerOrders.ts, app/partner/orders/page.tsx) ;
 *  - temps réel : pendant la mise à jour d'une réservation de salle et d'une réservation de table, ni le
 *    client de la réservation, ni le partenaire propriétaire, ni anon ne reçoivent rien (témoin : la commande
 *    du même client, reçue par le partenaire propriétaire dans la même période) ;
 *  - orders : anon, un client B et un partenaire B (abonnés avec le filtre du partenaire A et sans filtre) ne
 *    reçoivent rien ; le partenaire propriétaire actif reçoit ;
 *  - sonde RLS : la politique orders_read évaluée comme Realtime l'évalue (rôle de l'abonné et claims de son
 *    JWT, en lecture seule) rend la commande au partenaire propriétaire et au client, aucune ligne à anon, au
 *    client B et au partenaire B ; garde-fou : la même sonde relève une politique permissive fabriquée
 *    (transaction annulée) ; partenaire propriétaire suspendu (users.status, transaction annulée) : aucune
 *    ligne (A1, orders_read durcie).
 * Schéma des preuves temps réel (tests/helpers/realtime.ts, lot 5) : chaque abonné ouvre UN canal qui porte
 * les tables observées et une table de contrôle qu'il a le droit de lire (public_event_state d'un événement
 * publié, ou la commande pour le témoin) ; la vivacité est prouvée sur ce même canal (les abonnements d'un
 * canal sont activés ensemble par le serveur), puis l'action observée, puis une sentinelle reçue par le
 * témoin, puis l'absence chez les autres. Un message sans donnée n'est pas une diffusion.
 *
 * Rouge avant correctif :
 *  - hall_reservations et table_reservations publiées depuis supabase/migrations/0004_indexes.sql:147-148
 *    (REPLICA IDENTITY FULL, :137-138), jamais retirées (run 56) : le client et le partenaire propriétaire
 *    reçoivent la mise à jour ;
 *  - orders_read (0003_rls.sql:243-248) ne lit pas users.status : le partenaire suspendu lit encore la commande.
 * Déjà vert (couverture, signalé) : orders n'arrive ni à anon, ni au client B, ni au partenaire B (les trois
 * branches de orders_read sont fausses pour eux) ; la sonde RLS sur ces abonnés ; son garde-fou.
 * Fin de suite : assertNotificationInvariants (rouge avant le correctif 6.1, boîte d'envoi absente).
 * La suite crée ses partenaires (A, B), ses clients (A, B), sa commande, ses réservations et son événement de
 * contrôle.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import {
    type RealtimeChannel,
    type RealtimePostgresChangesFilter,
    type RealtimePostgresChangesPayload,
    type SupabaseClient,
} from '@supabase/supabase-js';
import type { Client } from 'pg';
import { inRolledBackTransaction, inspect } from '../helpers/db';
import {
    RECEIVE_TIMEOUT_MS,
    SUBSCRIBE_TIMEOUT_MS,
    anonClient,
    disposeClients,
    produceUntilReceived,
    signedInClient,
    waitForEvent,
    type ChangeEvent,
    type Collector,
    type ReceivedChange,
    type RealtimeTarget,
    type SubscribeOutcome,
} from '../helpers/realtime';
import { assertNotificationInvariants } from './notif-helpers';
import { newBuyer, service, type Buyer, type SaleEvent } from './paiement-helpers';
import { newPartner, type TestPartner } from './finance-helpers';
import { createTimedEvent } from './acces-helpers';

const SETTLE_MS = 1_500;
const REMOVED_FROM_PUBLICATION = ['hall_reservations', 'table_reservations'];

let partnerA: TestPartner;
let partnerB: TestPartner;
let clientA: Buyer;
let clientB: Buyer;
let live: SaleEvent;
let liveTitle: string;
let orderId: string;
let hallReservationId: string;
let tableReservationId: string;

before(async () => {
    partnerA = await newPartner('pub-resa-a');
    partnerB = await newPartner('pub-resa-b');
    clientA = await newBuyer('pub-resa-client-a');
    clientB = await newBuyer('pub-resa-client-b');
    live = await createTimedEvent(partnerA.partnerId, 'pub-resa-controle', [{ name: 'Standard', price: 2000, total: 10 }], { startsInHours: 96 });
    const { data, error } = await service.from('events').select('title').eq('id', live.eventId).single();
    assert.equal(error, null, `titre de l'événement de contrôle : ${error?.message}`);
    liveTitle = String(data.title);
    orderId = await createOrder();
    hallReservationId = await createHallReservation();
    tableReservationId = await createTableReservation();
});

after(async () => {
    await assertNotificationInvariants('dette-publication-reservations');
});

// ── Données ────────────────────────────────────────────────────────────────

let dayOffset = 200;
function futureDate(): string {
    dayOffset += 1;
    return new Date(Date.now() + dayOffset * 24 * 3600_000).toISOString().slice(0, 10);
}

async function createOrder(): Promise<string> {
    const { data, error } = await service.from('orders').insert({
        order_number: `CMD-LOT6-PUB-${randomUUID()}`,
        client_id: clientA.userId, partner_id: partnerA.partnerId,
        subtotal: 3000, total_amount: 3000, paid_amount: 0, balance_amount: 3000,
        payment_type: 'INTEGRAL', delivery_mode: 'RETRAIT', order_status: 'EN_ATTENTE', payment_status: 'PENDING',
    }).select('id').single();
    assert.equal(error, null, `commande : ${error?.message}`);
    return String(data.id);
}

async function createHallReservation(): Promise<string> {
    const { data: hall, error: hallErr } = await service.from('halls').insert({
        partner_id: partnerA.partnerId, name: `TEST Salle lot 6 ${randomUUID().slice(0, 8)}`, capacity: 100,
        price_per_day: 50_000, deposit_percentage: 100, city: 'Dakar', is_active: true,
    }).select('id').single();
    assert.equal(hallErr, null, `salle : ${hallErr?.message}`);
    const day = futureDate();
    const { data, error } = await service.from('hall_reservations').insert({
        hall_id: hall.id, client_id: clientA.userId, partner_id: partnerA.partnerId,
        start_date: day, end_date: day, total_amount: 50_000, deposit_amount: 50_000, balance_amount: 0,
        status: 'EN_ATTENTE', payment_status: 'PENDING',
    }).select('id').single();
    assert.equal(error, null, `réservation de salle : ${error?.message}`);
    return String(data.id);
}

async function createTableReservation(): Promise<string> {
    const { data: table, error: tableErr } = await service.from('restaurant_tables').insert({
        partner_id: partnerA.partnerId, table_number: `T-${randomUUID().slice(0, 8)}`, capacity: 4, is_active: true,
    }).select('id').single();
    assert.equal(tableErr, null, `table : ${tableErr?.message}`);
    const { data, error } = await service.from('table_reservations').insert({
        partner_id: partnerA.partnerId, table_id: table.id, client_id: clientA.userId,
        reservation_date: futureDate(), reservation_time: '20:00:00', guest_count: 2,
        deposit_amount: 10_000, is_platform_payment: true, status: 'EN_ATTENTE', payment_status: 'PENDING',
    }).select('id').single();
    assert.equal(error, null, `réservation de table : ${error?.message}`);
    return String(data.id);
}

// ── Actions reproductibles ─────────────────────────────────────────────────

let pulse = 0;

/** Nouveau titre de l'événement de contrôle : un changement de public_event_state, lisible par tous. */
async function retitle(): Promise<string> {
    pulse += 1;
    const title = `${liveTitle} · contrôle ${pulse}`;
    const { error } = await service.from('events').update({ title }).eq('id', live.eventId);
    assert.equal(error, null, `titre de l'événement de contrôle : ${error?.message}`);
    return title;
}

async function touchOrder(): Promise<string> {
    const marker = `Signal ${randomUUID()}`;
    const { error } = await service.from('orders').update({ delivery_notes: marker }).eq('id', orderId);
    assert.equal(error, null, `mise à jour de la commande ${orderId} : ${error?.message}`);
    return marker;
}

async function touchHallReservation(): Promise<string> {
    const marker = `Signal ${randomUUID()}`;
    const { error } = await service.from('hall_reservations').update({ notes: marker }).eq('id', hallReservationId);
    assert.equal(error, null, `mise à jour de la réservation de salle : ${error?.message}`);
    return marker;
}

async function touchTableReservation(): Promise<string> {
    const marker = `Signal ${randomUUID()}`;
    const { error } = await service.from('table_reservations').update({ special_requests: marker }).eq('id', tableReservationId);
    assert.equal(error, null, `mise à jour de la réservation de table : ${error?.message}`);
    return marker;
}

// ── Abonnements : un canal par abonné, une table de contrôle dans le canal ──

function carriesData(e: ReceivedChange): boolean {
    return Object.keys(e.new).length > 0 || Object.keys(e.old).length > 0;
}

function about(column: string, values: string[]): (e: ReceivedChange) => boolean {
    return (e) => carriesData(e) && (values.includes(String(e.new[column])) || values.includes(String(e.old[column])));
}

interface Bundle<K extends string> {
    label: string;
    feeds: Record<K, Collector>;
    readonly ready: Promise<void>;
}

/**
 * Un seul canal pour plusieurs abonnements postgres_changes (un collecteur par clé). Le serveur active les
 * abonnements d'un canal ensemble : la réception sur la table de contrôle prouve que les autres sont actifs.
 */
function subscribeBundle<K extends string>(client: SupabaseClient, label: string, targets: Record<K, RealtimeTarget>): Bundle<K> {
    const states: string[] = [];
    let channel: RealtimeChannel = client.channel(`ev-test-lot6-${randomBytes(4).toString('hex')}`);
    let resolveOutcome: (o: SubscribeOutcome) => void = () => undefined;
    const outcome = new Promise<SubscribeOutcome>((resolve) => {
        resolveOutcome = resolve;
    });
    const readyOf = (): Promise<void> => outcome.then((o) => {
        if (o.status !== 'SUBSCRIBED') throw new Error(`abonnement Realtime ${label} : ${o.status} ${o.error ?? ''}`.trim());
    });
    const feeds = {} as Record<K, Collector>;
    for (const key of Object.keys(targets) as K[]) {
        const target = targets[key];
        const events: ReceivedChange[] = [];
        const filter: RealtimePostgresChangesFilter<ChangeEvent> = { event: target.event ?? '*', schema: target.schema ?? 'public', table: target.table };
        if (target.filter) filter.filter = target.filter;
        channel = channel.on('postgres_changes', filter, (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
            events.push({
                eventType: payload.eventType,
                table: payload.table,
                new: payload.new as Record<string, unknown>,
                old: payload.old as Record<string, unknown>,
                commitTimestamp: payload.commit_timestamp,
                receivedAt: Date.now(),
            });
        });
        feeds[key] = {
            label: `${label} ${key}`,
            target,
            events,
            states,
            outcome,
            get ready(): Promise<void> {
                return readyOf();
            },
            clear() {
                events.length = 0;
            },
            close() {
                return client.removeChannel(channel);
            },
        };
    }
    let settled = false;
    const settle = (o: SubscribeOutcome): void => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolveOutcome(o);
    };
    const timer = setTimeout(() => settle({ status: 'TIMED_OUT', error: `abonnement non confirmé en ${SUBSCRIBE_TIMEOUT_MS} ms` }), SUBSCRIBE_TIMEOUT_MS);
    channel.subscribe((status, err) => {
        states.push(err ? `${status} : ${err.message}` : status);
        settle({ status, error: status === 'SUBSCRIBED' ? null : (err?.message ?? `état ${status}`) });
    });
    return {
        label,
        feeds,
        get ready(): Promise<void> {
            return readyOf();
        },
    };
}

/** Vivacité du canal : un nouveau titre de l'événement de contrôle reçu sur sa table de contrôle. */
async function proveLive(feed: Collector): Promise<void> {
    await produceUntilReceived(feed, retitle, (e) => e.new.event_id === live.eventId, { what: `vivacité : ${feed.label}` });
}

/** Table de contrôle lisible par tous : la ligne public_event_state de l'événement publié de la suite. */
function controlTarget(): RealtimeTarget {
    return { table: 'public_event_state', filter: `event_id=eq.${live.eventId}` };
}

function sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
}

/** Messages qui satisfont `leak`, par collecteur ; vide = aucune fuite. */
function leaksOf(collectors: Collector[], leak: (e: ReceivedChange) => boolean): string[] {
    return collectors
        .map((c) => ({ label: c.label, hits: c.events.filter(leak) }))
        .filter((x) => x.hits.length > 0)
        .map((x) => `${x.label} : ${x.hits.length} message(s) ${JSON.stringify(x.hits.slice(0, 2).map((h) => h.new))}`);
}

async function publishedTables(): Promise<string[]> {
    return inspect(async (db) => (await db.query<{ tablename: string }>(
        "SELECT tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' ORDER BY tablename",
    )).rows.map((r) => r.tablename));
}

// ── Publication ────────────────────────────────────────────────────────────

describe('6.0 d — publication supabase_realtime', () => {
    test('hall_reservations et table_reservations retirées de la publication ; orders y reste', async () => {
        const tables = await publishedTables();
        console.log(`[TEMPS-REEL-6.0d] publication supabase_realtime : ${tables.join(', ')}`);
        const still = REMOVED_FROM_PUBLICATION.filter((t) => tables.includes(t));
        assert.deepEqual(still, [], `tables encore publiées (aucun abonné dans l'application) : ${still.join(', ')}`);
        assert.ok(tables.includes('orders'), `orders retirée de la publication alors que deux écrans s'y abonnent (tables : ${tables.join(', ')})`);
    });

    test('réservations de salle et de table : ni le client, ni le partenaire propriétaire, ni anon ne reçoivent une mise à jour (témoin : la commande, reçue par le partenaire)', async () => {
        const owner = await signedInClient({ email: partnerA.email });
        const cust = await signedInClient({ email: clientA.email });
        const anon = anonClient();
        try {
            // Commande témoin et réservations sur des canaux SÉPARÉS : un abonnement à une table retirée de la
            // publication peut être refusé par Realtime, ce qui coupait le canal entier, témoin compris (run 61).
            const ownerB = subscribeBundle(owner, 'partenaire propriétaire', {
                orders: { table: 'orders', filter: `partner_id=eq.${partnerA.partnerId}` },
            });
            const ownerR = subscribeBundle(owner, 'partenaire propriétaire (réservations)', {
                hallFiltered: { table: 'hall_reservations', filter: `partner_id=eq.${partnerA.partnerId}` },
                hall: { table: 'hall_reservations' },
                tableFiltered: { table: 'table_reservations', filter: `partner_id=eq.${partnerA.partnerId}` },
                table: { table: 'table_reservations' },
            });
            const custB = subscribeBundle(cust, 'client de la réservation', {
                orders: { table: 'orders', filter: `client_id=eq.${clientA.userId}` },
            });
            const custR = subscribeBundle(cust, 'client de la réservation (réservations)', {
                hallFiltered: { table: 'hall_reservations', filter: `client_id=eq.${clientA.userId}` },
                hall: { table: 'hall_reservations' },
                tableFiltered: { table: 'table_reservations', filter: `client_id=eq.${clientA.userId}` },
                table: { table: 'table_reservations' },
            });
            const anonB = subscribeBundle(anon, 'anon', { control: controlTarget() });
            const anonR = subscribeBundle(anon, 'anon (réservations)', {
                hall: { table: 'hall_reservations' },
                table: { table: 'table_reservations' },
            });
            await Promise.all([ownerB.ready, custB.ready, anonB.ready]);
            // Réservations : abonnement accepté (aucun message ne doit arriver) ou refusé par Realtime (aucune
            // diffusion possible) ; tout autre état, dont le délai dépassé, fait échouer le test.
            for (const r of [ownerR, custR, anonR]) {
                const o = await Object.values<Collector>(r.feeds)[0].outcome;
                console.log(`[TEMPS-REEL-6.0d] abonnement ${r.label} : ${o.status}${o.error ? ` (${o.error})` : ''}`);
                assert.ok(o.status === 'SUBSCRIBED' || o.status === 'CHANNEL_ERROR', `abonnement ${r.label} : état inattendu ${o.status} ${o.error ?? ''}`);
            }
            await produceUntilReceived(ownerB.feeds.orders, touchOrder, about('id', [orderId]), { what: 'vivacité : commande reçue par le partenaire propriétaire' });
            await produceUntilReceived(custB.feeds.orders, touchOrder, about('id', [orderId]), { what: 'vivacité : commande reçue par son client' });
            await proveLive(anonB.feeds.control);

            const hallMarker = await touchHallReservation();
            const tableMarker = await touchTableReservation();
            const sentinel = await touchOrder();
            await waitForEvent(ownerB.feeds.orders, (e) => e.new.id === orderId && e.new.delivery_notes === sentinel, RECEIVE_TIMEOUT_MS,
                'sentinelle : commande reçue par le partenaire propriétaire après les deux mises à jour');
            await waitForEvent(custB.feeds.orders, (e) => e.new.id === orderId && e.new.delivery_notes === sentinel, RECEIVE_TIMEOUT_MS,
                'sentinelle : commande reçue par son client après les deux mises à jour');
            await sleep(SETTLE_MS);

            const hallLeak = about('id', [hallReservationId]);
            const tableLeak = about('id', [tableReservationId]);
            const leaks = [
                ...leaksOf([ownerR.feeds.hallFiltered, ownerR.feeds.hall, custR.feeds.hallFiltered, custR.feeds.hall, anonR.feeds.hall], hallLeak),
                ...leaksOf([ownerR.feeds.tableFiltered, ownerR.feeds.table, custR.feeds.tableFiltered, custR.feeds.table, anonR.feeds.table], tableLeak),
            ];
            console.log(`[TEMPS-REEL-6.0d] marqueurs : salle ${hallMarker}, table ${tableMarker}`);
            assert.deepEqual(leaks, [], `réservations diffusées en temps réel :\n${leaks.join('\n')}`);
        } finally {
            await disposeClients(owner, cust, anon);
        }
    });
});

// ── orders ─────────────────────────────────────────────────────────────────

describe('6.0 d — orders : reçue par le partenaire propriétaire actif seulement', () => {
    test('anon, client B et partenaire B (avec et sans filtre) ne reçoivent rien ; le partenaire propriétaire reçoit (couverture)', async () => {
        const owner = await signedInClient({ email: partnerA.email });
        const b = await signedInClient({ email: partnerB.email });
        const c = await signedInClient({ email: clientB.email });
        const a = anonClient();
        try {
            const witness = subscribeBundle(owner, 'partenaire propriétaire', { orders: { table: 'orders', filter: `partner_id=eq.${partnerA.partnerId}` } });
            const spies = ([['partenaire B', b], ['client B', c], ['anon', a]] as Array<[string, SupabaseClient]>).map(([who, cl]) => subscribeBundle(cl, who, {
                control: controlTarget(),
                filtered: { table: 'orders', filter: `partner_id=eq.${partnerA.partnerId}` },
                all: { table: 'orders' },
            }));
            await Promise.all([witness.ready, ...spies.map((s) => s.ready)]);
            await produceUntilReceived(witness.feeds.orders, touchOrder, about('id', [orderId]), { what: 'vivacité : commande reçue par le partenaire propriétaire' });
            for (const s of spies) await proveLive(s.feeds.control);

            const target = await touchOrder();
            await waitForEvent(witness.feeds.orders, (e) => e.new.id === orderId && e.new.delivery_notes === target, RECEIVE_TIMEOUT_MS, 'commande reçue par le partenaire propriétaire');
            const sentinel = await touchOrder();
            await waitForEvent(witness.feeds.orders, (e) => e.new.id === orderId && e.new.delivery_notes === sentinel, RECEIVE_TIMEOUT_MS, 'sentinelle reçue par le partenaire propriétaire');
            await sleep(SETTLE_MS);
            const leaks = leaksOf(spies.flatMap((s) => [s.feeds.filtered, s.feeds.all]), about('id', [orderId]));
            assert.deepEqual(leaks, [], `commande diffusée à un tiers :\n${leaks.join('\n')}`);
        } finally {
            await disposeClients(owner, b, c, a);
        }
    });
});

// ── Sonde RLS (évaluation de Realtime : rôle et claims de l'abonné) ─────────

type Viewer = { label: string; role: 'anon' } | { label: string; role: 'authenticated'; userId: string };

/**
 * Lignes de `table` d'identifiant `id` visibles par l'abonné : rôle API et claims de son JWT posés dans un
 * point de sauvegarde (annulé ensuite), comme Realtime applique la RLS à chaque changement. 'REFUS' : aucun
 * privilège SELECT (42501).
 */
async function visibleRows(db: Client, viewer: Viewer, table: string, id: string): Promise<number | 'REFUS'> {
    await db.query('SAVEPOINT probe');
    try {
        await db.query(`SET LOCAL ROLE ${viewer.role}`);
        const sub = viewer.role === 'anon' ? '' : viewer.userId;
        const claims = viewer.role === 'anon' ? { role: 'anon' } : { sub, role: 'authenticated', aud: 'authenticated' };
        await db.query("SELECT set_config('request.jwt.claims', $1, true), set_config('request.jwt.claim.sub', $2, true), set_config('request.jwt.claim.role', $3, true)",
            [JSON.stringify(claims), sub, viewer.role]);
        const r = await db.query<{ n: string }>(`SELECT count(*)::text AS n FROM public.${table} WHERE id = $1`, [id]);
        return Number(r.rows[0].n);
    } catch (err) {
        if ((err as { code?: string }).code === '42501') return 'REFUS';
        throw err;
    } finally {
        await db.query('ROLLBACK TO SAVEPOINT probe');
    }
}

function viewers(): { owner: Viewer; client: Viewer; partnerB: Viewer; clientB: Viewer; anon: Viewer } {
    return {
        owner: { label: 'partenaire propriétaire', role: 'authenticated', userId: partnerA.userId },
        client: { label: 'client de la commande', role: 'authenticated', userId: clientA.userId },
        partnerB: { label: 'partenaire B', role: 'authenticated', userId: partnerB.userId },
        clientB: { label: 'client B', role: 'authenticated', userId: clientB.userId },
        anon: { label: 'anon', role: 'anon' },
    };
}

function hidden(n: number | 'REFUS'): boolean {
    return n === 0 || n === 'REFUS';
}

describe('6.0 d — sonde RLS de orders_read sous le rôle et les claims de chaque abonné', () => {
    test('la commande est visible du partenaire propriétaire et du client, d’aucun tiers (couverture)', async () => {
        const v = viewers();
        const seen = await inspect(async (db) => {
            const out: Record<string, number | 'REFUS'> = {};
            for (const viewer of Object.values(v)) out[viewer.label] = await visibleRows(db, viewer, 'orders', orderId);
            return out;
        });
        console.log(`[TEMPS-REEL-6.0d] orders_read : ${JSON.stringify(seen)}`);
        assert.equal(seen[v.owner.label], 1, `partenaire propriétaire : ${JSON.stringify(seen)}`);
        assert.equal(seen[v.client.label], 1, `client de la commande : ${JSON.stringify(seen)}`);
        for (const viewer of [v.partnerB, v.clientB, v.anon]) {
            assert.ok(hidden(seen[viewer.label]), `${viewer.label} voit la commande : ${JSON.stringify(seen)}`);
        }
    });

    test('garde-fou : une politique permissive fabriquée (transaction annulée) est relevée par la sonde', async () => {
        const v = viewers();
        const policy = `ev_test_orders_open_${randomBytes(4).toString('hex')}`;
        const seen = await inRolledBackTransaction(async (db) => {
            await db.query(`CREATE POLICY ${policy} ON public.orders FOR SELECT TO authenticated USING (TRUE)`);
            return visibleRows(db, v.clientB, 'orders', orderId);
        });
        assert.equal(seen, 1, `la sonde ne relève pas la politique permissive fabriquée (client B : ${seen})`);
    });

    test('partenaire propriétaire suspendu (users.status, transaction annulée) : aucune ligne (orders_read durcie, A1)', async () => {
        const v = viewers();
        const seen = await inRolledBackTransaction(async (db) => {
            const active = await visibleRows(db, v.owner, 'orders', orderId);
            const upd = await db.query("UPDATE public.users SET status = 'SUSPENDU' WHERE id = $1", [partnerA.userId]);
            assert.equal(upd.rowCount, 1, 'suspension du partenaire dans la transaction');
            return { active, suspended: await visibleRows(db, v.owner, 'orders', orderId) };
        });
        assert.equal(seen.active, 1, `précondition : le partenaire actif voit sa commande (${JSON.stringify(seen)})`);
        assert.ok(hidden(seen.suspended), `partenaire suspendu : la commande reste lisible par la RLS (${JSON.stringify(seen)}) — orders_read ne lit pas users.status`);
    });
});

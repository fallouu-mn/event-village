/**
 * Lot 5, tâche 5.13 — tables privées de la publication supabase_realtime (contrat, sections A4, O2 et O4) :
 *  - ticket_scans, scan_incidents, controller_shifts et event_status_history : reçus par le partenaire
 *    propriétaire de l'événement, et par personne d'autre : ni le partenaire B, ni anon, ni un client
 *    (abonnés avec le filtre de l'événement et sans filtre) ; controller_shifts est aussi reçu par le
 *    contrôleur de la caisse ;
 *  - admin_signals (EVENT_SUBMITTED à la soumission d'un événement, PARTNER_REGISTERED à l'inscription d'un
 *    partenaire) : reçus par un admin seulement, ni par anon, ni par un client, ni par le partenaire ;
 *  - payments : retirée de la publication (A4) ; ni le payeur, ni le partenaire, ni un admin, ni anon ne
 *    reçoivent rien d'un achat (témoin : le payeur reçoit ses billets, publiés, dans la même période) ;
 *  - publication : les tables du contrat O2 y sont, payments n'y est plus, ni aucune table de données
 *    personnelles (partners, users, ticket_transfers) ; chaque table publiée a la RLS activée
 *    (pg_class.relrowsecurity) et une politique SELECT ; anon ne lit aucune ligne des tables privées.
 * Schéma des preuves (tests/helpers/realtime.ts) : vivacité chez le témoin autorisé, action observée,
 * sentinelle reçue par le témoin, puis absence chez les intrus. Une trame d'erreur sans donnée (rôle sans
 * privilège) n'est pas une diffusion : les assertions négatives portent sur les messages qui transportent
 * des colonnes de l'objet observé.
 * La suite crée ses partenaires (A et B), son client, son contrôleur et ses événements.
 * Rouge avant correctif :
 *  - publication actuelle : orders, payments, tickets, notifications, hall_reservations, table_reservations
 *    (supabase/migrations/0004_indexes.sql:143-148), ticket_categories (20260907000002_…:15), ticket_scans
 *    (20261101000013_lot4_pilotage.sql:76-77) : payments y est (0004_indexes.sql:144), controller_shifts n'y
 *    est pas, et les tables scan_incidents, event_status_history, admin_signals, public_event_state et
 *    public_category_stock n'existent pas (aucune migration) ;
 *  - payments_read (0003_rls.sql:274-279) : le payeur et le partenaire reçoivent les paiements en direct ;
 *  - aucune RPC event_transition (contrat D4) pour la soumission (tests/parcours/cycle-helpers.ts).
 * Garde-fou (vert aujourd'hui) : ticket_scans n'arrive ni au partenaire B (lot 4), ni à un client, ni à
 * anon (RLS ticket_scans_owner_admin_select, 20261101000013_lot4_pilotage.sql:64-72 ; REVOKE pour anon,
 * 20261101000010_lot4_scan.sql:53).
 *
 * Lot 8, T11 (contrat 10.2, consigne n) : abonnement d'un admin avec EXACTEMENT le filtre lu dans
 * app/admin/notifications/page.tsx. Rouge jusqu'à fix(8.2n) : les INSERT de SMS_FORECAST et de SMS_OPTIONAL_80
 * n'arrivent pas (filtre à deux valeurs, page.tsx:332). Garde-fou vert : CASHOUT_UNCERTAIN n'arrive pas, avec
 * un témoin sans filtre qui le reçoit et une sentinelle reçue par l'abonnement filtré.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import fs from 'node:fs';
import type { SupabaseClient } from '@supabase/supabase-js';
import { inRolledBackTransaction, inspect } from '../helpers/db';
import { assertLifecycleInvariants } from '../helpers/lifecycle-invariants';
import {
    RECEIVE_TIMEOUT_MS,
    anonClient,
    disposeClients,
    expectNothing,
    produceUntilReceived,
    signedInClient,
    subscribeCollect,
    waitForEvent,
    type Collector,
    type ReceivedChange,
    type RealtimeTarget,
} from '../helpers/realtime';
import { newBuyer, service, type Buyer, type SaleEvent } from './paiement-helpers';
import { buyConfirmed, newPartner, type TestPartner } from './finance-helpers';
import { createTimedEvent, newController, openShift } from './acces-helpers';
import { advanceEventTo, createDraftEvent } from './cycle-helpers';

/** Tables ajoutées par le contrat O2, ou déjà publiées et conservées. */
const REQUIRED_PUBLISHED = [
    'tickets', 'notifications', 'ticket_scans',
    'public_event_state', 'public_category_stock', 'event_status_history', 'controller_shifts', 'scan_incidents', 'admin_signals',
];
/** Jamais dans la publication : A4 (payments) ; données personnelles sans résumé public (partners, users, ticket_transfers). */
const FORBIDDEN_PUBLISHED = ['payments', 'partners', 'users', 'ticket_transfers'];
/** Tables privées ajoutées par le contrat O2 : aucune ligne lisible par anon. */
const PRIVATE_NEW = ['event_status_history', 'controller_shifts', 'scan_incidents', 'admin_signals'];
const SETTLE_MS = 1_500;

let partnerA: TestPartner;
let partnerB: TestPartner;
let client: Buyer;
let controller: Buyer;
let ev: SaleEvent;

before(async () => {
    partnerA = await newPartner('tr-prives-a');
    partnerB = await newPartner('tr-prives-b');
    client = await newBuyer('tr-prives-client');
    ev = await createTimedEvent(partnerA.partnerId, 'tr-prives', [{ name: 'Standard', price: 2000, total: 40 }]);
    controller = await newController(partnerA, ev.eventId, { canAcceptCash: true, label: 'tr-prives' });
});

after(async () => {
    await assertLifecycleInvariants('temps-reel-prives');
});

// ── Outils locaux ──────────────────────────────────────────────────────────

function carriesData(e: ReceivedChange): boolean {
    return Object.keys(e.new).length > 0 || Object.keys(e.old).length > 0;
}

/** Message qui transporte une ligne dont `column` vaut l'une des valeurs. */
function about(column: string, values: string[]): (e: ReceivedChange) => boolean {
    return (e) => carriesData(e) && (values.includes(String(e.new[column])) || values.includes(String(e.old[column])));
}

interface Intruders {
    clients: SupabaseClient[];
    collectors: Collector[];
}

/**
 * Le partenaire B, un client et anon s'abonnent à la table, avec le filtre `filter` (s'il est donné) et sans
 * filtre : six collecteurs, prêts (SUBSCRIBED) au retour.
 */
async function intruders(table: string, filter: string | null): Promise<Intruders> {
    const b = await signedInClient({ email: partnerB.email });
    const c = await signedInClient({ email: client.email });
    const a = anonClient();
    const collectors: Collector[] = [];
    for (const [who, cl] of [['partenaire B', b], ['client', c], ['anon', a]] as Array<[string, SupabaseClient]>) {
        if (filter) collectors.push(subscribeCollect(cl, { table, filter }, { label: `${who} ${table} [${filter}]` }));
        collectors.push(subscribeCollect(cl, { table }, { label: `${who} ${table} (sans filtre)` }));
    }
    await Promise.all(collectors.map((x) => x.ready));
    return { clients: [b, c, a], collectors };
}

async function assertNobodyElse(spies: Intruders, leak: (e: ReceivedChange) => boolean, what: string): Promise<void> {
    let first = true;
    for (const col of spies.collectors) {
        await expectNothing(col, first ? SETTLE_MS : 0, leak, `${what} — ${col.label}`);
        first = false;
    }
}

async function publishedTables(): Promise<string[]> {
    return inspect(async (db) => (await db.query<{ tablename: string }>(
        "SELECT tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' ORDER BY tablename",
    )).rows.map((r) => r.tablename));
}

async function logScan(eventId: string): Promise<string> {
    const hash = randomBytes(32).toString('hex');
    const { error } = await service.rpc('scan_log', {
        p_ticket: null, p_event: eventId, p_scanner: controller.userId, p_result: 'invalid', p_accepted: false,
        p_method: 'QR', p_identity: false, p_hash: hash, p_amount: null,
    });
    assert.equal(error, null, `journal d’une tentative de scan : ${error?.message}`);
    return hash;
}

async function logIncident(eventId: string): Promise<string> {
    const { data, error } = await service.from('scan_incidents')
        .insert({ scanner_id: controller.userId, event_id: eventId, kind: 'NETWORK', source: 'DEVICE' })
        .select('id').single();
    assert.equal(error, null, `incident de scan (table scan_incidents, contrat C8) : ${error?.message}`);
    return String(data.id);
}

let tick = 0;

async function touchShift(shiftId: string): Promise<string> {
    tick += 1;
    const at = new Date(Date.now() + tick).toISOString();
    const { error } = await service.from('controller_shifts').update({ updated_at: at }).eq('id', shiftId);
    assert.equal(error, null, `mise à jour de la caisse ${shiftId} : ${error?.message}`);
    return at;
}

function sameInstant(value: unknown, iso: string): boolean {
    return typeof value === 'string' && Date.parse(value) === Date.parse(iso);
}

/** Abonnement du témoin, vivacité, action observée, sentinelle, puis absence chez les intrus. */
async function provePrivate(opts: {
    table: string;
    witness: SupabaseClient;
    witnessTarget: RealtimeTarget;
    spies: Intruders;
    /** Action reproductible ; renvoie la valeur qui identifie son message. */
    produce: () => Promise<string>;
    /** Le message `e` est celui de l'action qui a renvoyé `marker`. */
    matches: (e: ReceivedChange, marker: string) => boolean;
    /** Les messages des intrus qui constitueraient une fuite. */
    leak: (e: ReceivedChange) => boolean;
    what: string;
}): Promise<void> {
    const mine = subscribeCollect(opts.witness, opts.witnessTarget, { label: `témoin ${opts.table}` });
    await mine.ready;
    await produceUntilReceived(mine, opts.produce, (e) => carriesData(e), { what: `vivacité : ${opts.what} reçu par le témoin` });
    const target = await opts.produce();
    await waitForEvent(mine, (e) => opts.matches(e, target), RECEIVE_TIMEOUT_MS, `${opts.what} reçu par le témoin`);
    const sentinel = await opts.produce();
    await waitForEvent(mine, (e) => opts.matches(e, sentinel), RECEIVE_TIMEOUT_MS, `sentinelle (${opts.what}) reçue par le témoin`);
    await assertNobodyElse(opts.spies, opts.leak, `${opts.what} : rien chez un compte non autorisé`);
}

// ── Tables du pilotage ─────────────────────────────────────────────────────

describe('Tables du pilotage : reçues par le partenaire propriétaire seul', () => {
    test('garde-fou : ticket_scans, ni au partenaire B, ni à un client, ni à anon', async () => {
        const owner = await signedInClient({ email: partnerA.email });
        const spies = await intruders('ticket_scans', `event_id=eq.${ev.eventId}`);
        try {
            await provePrivate({
                table: 'ticket_scans', witness: owner, witnessTarget: { table: 'ticket_scans', filter: `event_id=eq.${ev.eventId}` }, spies,
                produce: () => logScan(ev.eventId),
                matches: (e, hash) => e.new.payload_hash === hash,
                leak: about('event_id', [ev.eventId]),
                what: 'tentative de scan',
            });
        } finally {
            await disposeClients(owner, ...spies.clients);
        }
    });

    test('scan_incidents : reçu par le partenaire propriétaire, ni par le partenaire B, ni par un client, ni par anon', async () => {
        const owner = await signedInClient({ email: partnerA.email });
        const spies = await intruders('scan_incidents', `event_id=eq.${ev.eventId}`);
        try {
            await provePrivate({
                table: 'scan_incidents', witness: owner, witnessTarget: { table: 'scan_incidents', filter: `event_id=eq.${ev.eventId}` }, spies,
                produce: () => logIncident(ev.eventId),
                matches: (e, id) => e.new.id === id,
                leak: about('event_id', [ev.eventId]),
                what: 'incident technique de scan',
            });
        } finally {
            await disposeClients(owner, ...spies.clients);
        }
    });

    test('controller_shifts : reçu par le partenaire propriétaire et par le contrôleur de la caisse, ni par le partenaire B, ni par un client, ni par anon', async () => {
        const opened = await openShift(controller, ev.eventId);
        assert.equal(opened.status, 200, `ouverture de caisse : HTTP ${opened.status} ${JSON.stringify(opened.body)}`);
        const { data: shifts, error } = await service.from('controller_shifts').select('id')
            .eq('controller_id', controller.userId).eq('event_id', ev.eventId).eq('status', 'OUVERT');
        assert.equal(error, null, `caisse ouverte : ${error?.message}`);
        assert.equal((shifts ?? []).length, 1, `une caisse OUVERT du contrôleur (trouvé : ${(shifts ?? []).length})`);
        const shiftId = String(shifts![0].id);

        const owner = await signedInClient({ email: partnerA.email });
        const cashier = await signedInClient({ email: controller.email });
        const spies = await intruders('controller_shifts', `event_id=eq.${ev.eventId}`);
        try {
            const cashierFeed = subscribeCollect(cashier, { table: 'controller_shifts', filter: `event_id=eq.${ev.eventId}` }, { label: 'contrôleur de la caisse controller_shifts' });
            await cashierFeed.ready;
            await provePrivate({
                table: 'controller_shifts', witness: owner, witnessTarget: { table: 'controller_shifts', filter: `event_id=eq.${ev.eventId}` }, spies,
                produce: () => touchShift(shiftId),
                matches: (e, at) => e.new.id === shiftId && sameInstant(e.new.updated_at, at),
                leak: about('id', [shiftId]),
                what: 'mise à jour de la caisse',
            });
            await waitForEvent(cashierFeed, (e) => e.new.id === shiftId, RECEIVE_TIMEOUT_MS, 'le contrôleur de la caisse reçoit sa caisse');
        } finally {
            await disposeClients(owner, cashier, ...spies.clients);
        }
    });

    test('event_status_history : création et soumission reçues par le partenaire propriétaire, ni par le partenaire B, ni par un client, ni par anon', async () => {
        const draft = await createDraftEvent(partnerA, 'tr-historique', [{ name: 'Standard', price: 2000, total: 10 }], { startsInHours: 96 });
        const ownEvents: string[] = [draft.eventId];
        const owner = await signedInClient({ email: partnerA.email });
        const spies = await intruders('event_status_history', `event_id=eq.${draft.eventId}`);
        try {
            const mine = subscribeCollect(owner, { table: 'event_status_history' }, { label: 'partenaire propriétaire event_status_history' });
            await mine.ready;
            // Action reproductible : un brouillon créé écrit sa ligne NULL → BROUILLON (canal CREATION).
            const newDraft = async (): Promise<string> => {
                const d = await createDraftEvent(partnerA, 'tr-historique-signal', [{ name: 'Standard', price: 2000, total: 10 }], { startsInHours: 96 });
                ownEvents.push(d.eventId);
                return d.eventId;
            };
            await produceUntilReceived(mine, newDraft, (e) => e.new.new_status === 'BROUILLON' && ownEvents.includes(String(e.new.event_id)),
                { what: 'vivacité : création d’un brouillon reçue par le partenaire propriétaire' });

            await advanceEventTo(draft.eventId, 'EN_ATTENTE');
            const submitted = await waitForEvent(mine, (e) => e.new.event_id === draft.eventId && e.new.new_status === 'EN_ATTENTE', RECEIVE_TIMEOUT_MS,
                'soumission reçue par le partenaire propriétaire');
            assert.equal(submitted.new.old_status, 'BROUILLON', JSON.stringify(submitted.new));
            const sentinel = await newDraft();
            await waitForEvent(mine, (e) => e.new.event_id === sentinel, RECEIVE_TIMEOUT_MS, 'sentinelle (création d’un brouillon) reçue par le partenaire propriétaire');
            await assertNobodyElse(spies, about('event_id', ownEvents), 'historique des statuts : rien chez un compte non autorisé');
        } finally {
            await disposeClients(owner, ...spies.clients);
        }
    });
});

// ── Signaux de l'admin ─────────────────────────────────────────────────────

describe('admin_signals : reçus par un admin seulement (O2)', () => {
    async function signalSpies(): Promise<Intruders> {
        const a = anonClient();
        const c = await signedInClient({ email: client.email });
        const p = await signedInClient({ email: partnerA.email });
        const collectors = [
            subscribeCollect(a, { table: 'admin_signals' }, { label: 'anon admin_signals' }),
            subscribeCollect(c, { table: 'admin_signals' }, { label: 'client admin_signals' }),
            subscribeCollect(p, { table: 'admin_signals' }, { label: 'partenaire admin_signals' }),
        ];
        await Promise.all(collectors.map((x) => x.ready));
        return { clients: [a, c, p], collectors };
    }

    async function signalRow(kind: string, refId: string): Promise<Record<string, unknown> | null> {
        const { data, error } = await service.from('admin_signals').select('*').eq('kind', kind).eq('ref_id', refId).maybeSingle();
        assert.equal(error, null, `admin_signals (${kind}, ${refId}) : ${error?.message}`);
        return (data ?? null) as Record<string, unknown> | null;
    }

    test('PARTNER_REGISTERED à l’inscription d’un partenaire : l’admin le reçoit, ni anon, ni un client, ni un partenaire', async () => {
        const admin = await signedInClient('ADMIN');
        const spies = await signalSpies();
        const registered: string[] = [];
        try {
            const feed = subscribeCollect(admin, { table: 'admin_signals' }, { label: 'admin admin_signals' });
            await feed.ready;
            const register = async (): Promise<string> => {
                const p = await newPartner('tr-signal');
                registered.push(p.partnerId);
                return p.partnerId;
            };
            await produceUntilReceived(feed, register, (e) => e.new.kind === 'PARTNER_REGISTERED' && registered.includes(String(e.new.ref_id)),
                { what: 'vivacité : inscription d’un partenaire reçue par l’admin' });
            const target = await register();
            const got = await waitForEvent(feed, (e) => e.new.kind === 'PARTNER_REGISTERED' && e.new.ref_id === target, RECEIVE_TIMEOUT_MS,
                'signal PARTNER_REGISTERED reçu par l’admin');
            assert.ok(got.new.created_at, JSON.stringify(got.new));
            assert.ok(await signalRow('PARTNER_REGISTERED', target), 'ligne admin_signals écrite par le trigger d’INSERT dans partners');
            const sentinel = await register();
            await waitForEvent(feed, (e) => e.new.ref_id === sentinel, RECEIVE_TIMEOUT_MS, 'sentinelle reçue par l’admin');
            await assertNobodyElse(spies, carriesData, 'signal d’administration : rien chez un compte non admin');
        } finally {
            await disposeClients(admin, ...spies.clients);
        }
    });

    test('EVENT_SUBMITTED à la soumission d’un événement : l’admin le reçoit, ni anon, ni un client, ni le partenaire qui soumet', async () => {
        const admin = await signedInClient('ADMIN');
        const spies = await signalSpies();
        try {
            const feed = subscribeCollect(admin, { table: 'admin_signals' }, { label: 'admin admin_signals' });
            await feed.ready;
            const submit = async (): Promise<string> => {
                const d = await createDraftEvent(partnerA, 'tr-soumission', [{ name: 'Standard', price: 2000, total: 10 }], { startsInHours: 96 });
                await advanceEventTo(d.eventId, 'EN_ATTENTE');
                return d.eventId;
            };
            await produceUntilReceived(feed, submit, (e) => e.new.kind === 'EVENT_SUBMITTED',
                { what: 'vivacité : soumission d’un événement reçue par l’admin' });
            const target = await submit();
            await waitForEvent(feed, (e) => e.new.kind === 'EVENT_SUBMITTED' && e.new.ref_id === target, RECEIVE_TIMEOUT_MS,
                'signal EVENT_SUBMITTED reçu par l’admin');
            assert.ok(await signalRow('EVENT_SUBMITTED', target), 'ligne admin_signals écrite à la transition vers EN_ATTENTE');
            const sentinel = await submit();
            await waitForEvent(feed, (e) => e.new.ref_id === sentinel, RECEIVE_TIMEOUT_MS, 'sentinelle reçue par l’admin');
            await assertNobodyElse(spies, carriesData, 'signal d’administration : rien chez un compte non admin (le partenaire qui soumet compris)');
        } finally {
            await disposeClients(admin, ...spies.clients);
        }
    });

    // ── 8.2 n : la page Notifications se recharge aussi pour les alertes de budget SMS ─────

    /** Filtre de l'abonnement à admin_signals, tel qu'il est écrit dans la page (jamais recopié ici). */
    function notificationsPageFilter(): string {
        const page = 'app/admin/notifications/page.tsx';
        const found = Array.from(fs.readFileSync(page, 'utf8').matchAll(/table:\s*['"`]admin_signals['"`][^}]*?filter:\s*['"`]([^'"`]+)['"`]/g), (m) => m[1]);
        assert.equal(found.length, 1, `${page} : un seul abonnement filtré à admin_signals attendu (trouvé : ${JSON.stringify(found)})`);
        return found[0];
    }

    async function insertSignal(kind: string): Promise<string> {
        const refId = randomUUID();
        const { error } = await service.from('admin_signals').insert({ kind, ref_id: refId });
        assert.equal(error, null, `signal ${kind} : ${error?.message}`);
        return refId;
    }

    function signalOf(kind: string, refId: string): (e: ReceivedChange) => boolean {
        return (e) => e.new.kind === kind && e.new.ref_id === refId;
    }

    /** Abonnement de la page et témoin sans filtre, ouverts, puis vivacité par SMS_DAILY_THRESHOLD (dans le filtre, avant et après le correctif). */
    async function pageFeeds(admin: SupabaseClient, filter: string): Promise<{ feed: Collector; all: Collector }> {
        const feed = subscribeCollect(admin, { table: 'admin_signals', event: 'INSERT', filter }, { label: `admin admin_signals [${filter}]` });
        const all = subscribeCollect(admin, { table: 'admin_signals', event: 'INSERT' }, { label: 'admin admin_signals (témoin sans filtre)' });
        await Promise.all([feed.ready, all.ready]);
        const produced: string[] = [];
        await produceUntilReceived(feed, async () => produced.push(await insertSignal('SMS_DAILY_THRESHOLD')),
            (e) => produced.includes(String(e.new.ref_id)), { what: 'vivacité : SMS_DAILY_THRESHOLD reçu avec le filtre de la page' });
        return { feed, all };
    }

    test('8.2 n : avec le filtre lu dans la page, l’admin reçoit les INSERT de SMS_FORECAST et de SMS_OPTIONAL_80', async () => {
        const filter = notificationsPageFilter();
        const admin = await signedInClient('ADMIN');
        try {
            const { feed } = await pageFeeds(admin, filter);
            for (const kind of ['SMS_FORECAST', 'SMS_OPTIONAL_80']) {
                const refId = await insertSignal(kind);
                const got = await waitForEvent(feed, signalOf(kind, refId), RECEIVE_TIMEOUT_MS, `${kind} reçu avec le filtre de la page (« ${filter} »)`);
                assert.equal(got.eventType, 'INSERT', JSON.stringify(got));
            }
        } finally {
            await disposeClients(admin);
        }
    });

    test('garde-fou 8.2 n : avec le filtre lu dans la page, CASHOUT_UNCERTAIN n’est pas reçu (témoin sans filtre et sentinelle)', async () => {
        const filter = notificationsPageFilter();
        const admin = await signedInClient('ADMIN');
        try {
            const { feed, all } = await pageFeeds(admin, filter);
            const excluded = await insertSignal('CASHOUT_UNCERTAIN');
            await waitForEvent(all, signalOf('CASHOUT_UNCERTAIN', excluded), RECEIVE_TIMEOUT_MS, 'témoin sans filtre : CASHOUT_UNCERTAIN reçu');
            const sentinel = await insertSignal('SMS_DAILY_THRESHOLD');
            await waitForEvent(feed, signalOf('SMS_DAILY_THRESHOLD', sentinel), RECEIVE_TIMEOUT_MS, 'sentinelle reçue avec le filtre de la page');
            await expectNothing(feed, SETTLE_MS, (e) => e.new.kind === 'CASHOUT_UNCERTAIN', `CASHOUT_UNCERTAIN reçu malgré le filtre « ${filter} »`);
        } finally {
            await disposeClients(admin);
        }
    });
});

// ── payments ───────────────────────────────────────────────────────────────

describe('payments retirée de la publication (A4)', () => {
    test('pendant un achat, ni le payeur, ni le partenaire, ni un admin, ni anon ne reçoivent de paiement ; payments n’est plus dans supabase_realtime', async () => {
        const payer = await newBuyer('tr-payeur');
        const first = await buyConfirmed(payer, ev, [['Standard', 1]]);
        const firstTicket = String(first.tickets[0].id);
        const payerC = await signedInClient({ email: payer.email });
        const owner = await signedInClient({ email: partnerA.email });
        const admin = await signedInClient('ADMIN');
        const anon = anonClient();
        try {
            const witness = subscribeCollect(payerC, { table: 'tickets', filter: `user_id=eq.${payer.userId}` }, { label: 'payeur tickets (témoin)' });
            const spies = [
                subscribeCollect(payerC, { table: 'payments', filter: `client_id=eq.${payer.userId}` }, { label: 'payeur payments' }),
                subscribeCollect(owner, { table: 'payments', filter: `partner_id=eq.${partnerA.partnerId}` }, { label: 'partenaire payments' }),
                subscribeCollect(admin, { table: 'payments' }, { label: 'admin payments' }),
                subscribeCollect(anon, { table: 'payments' }, { label: 'anon payments' }),
            ];
            await Promise.all([witness, ...spies].map((c) => c.ready));
            const touch = async () => {
                tick += 1;
                const at = new Date(Date.now() + tick).toISOString();
                const { error } = await service.from('tickets').update({ updated_at: at }).eq('id', firstTicket);
                assert.equal(error, null, `mise à jour du billet ${firstTicket} : ${error?.message}`);
                return at;
            };
            await produceUntilReceived(witness, touch, (e) => e.new.id === firstTicket, { what: 'vivacité : billet du payeur reçu par le payeur' });

            const second = await buyConfirmed(payer, ev, [['Standard', 1]]);
            await waitForEvent(witness, (e) => e.new.payment_id === second.payment.id, RECEIVE_TIMEOUT_MS, 'témoin : le payeur reçoit le billet de son second achat');
            const marker = await touch();
            await waitForEvent(witness, (e) => e.new.id === firstTicket && sameInstant(e.new.updated_at, marker), RECEIVE_TIMEOUT_MS, 'sentinelle reçue par le payeur');
            let firstSpy = true;
            for (const spy of spies) {
                await expectNothing(spy, firstSpy ? SETTLE_MS : 0, () => true, `payments diffusée — ${spy.label}`);
                firstSpy = false;
            }
        } finally {
            await disposeClients(payerC, owner, admin, anon);
        }
        const tables = await publishedTables();
        assert.ok(!tables.includes('payments'), `payments encore dans la publication supabase_realtime (tables : ${tables.join(', ')})`);
    });
});

// ── Publication et RLS ─────────────────────────────────────────────────────

describe('Publication supabase_realtime : contenu et RLS (O2)', () => {
    test('les tables du contrat O2 sont publiées ; payments, partners, users et ticket_transfers ne le sont pas', async () => {
        const tables = await publishedTables();
        console.log(`[TEMPS-REEL] publication supabase_realtime : ${tables.join(', ')}`);
        const missing = REQUIRED_PUBLISHED.filter((t) => !tables.includes(t));
        const forbidden = FORBIDDEN_PUBLISHED.filter((t) => tables.includes(t));
        assert.deepEqual(missing, [], `tables absentes de la publication : ${missing.join(', ')}`);
        assert.deepEqual(forbidden, [], `tables qui ne doivent pas être publiées : ${forbidden.join(', ')}`);
    });

    test('chaque table publiée (et chaque table ajoutée par le contrat) existe, a la RLS activée et une politique SELECT', async () => {
        const rows = await inspect(async (db) => (await db.query<{ table_name: string; present: boolean; rls: boolean | null; select_policies: string }>(
            `WITH wanted AS (
                 SELECT tablename AS table_name FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public'
                 UNION SELECT unnest($1::text[])
             )
             SELECT w.table_name,
                    c.oid IS NOT NULL AS present,
                    c.relrowsecurity AS rls,
                    (SELECT count(*) FROM pg_policies p
                      WHERE p.schemaname = 'public' AND p.tablename = w.table_name AND p.cmd IN ('SELECT', 'ALL'))::text AS select_policies
               FROM wanted w
               LEFT JOIN pg_class c ON c.relname = w.table_name AND c.relnamespace = 'public'::regnamespace AND c.relkind IN ('r', 'p')
              ORDER BY w.table_name`,
            [REQUIRED_PUBLISHED],
        )).rows);
        for (const r of rows) console.log(`[TEMPS-REEL]   ${r.table_name} : existe ${r.present}, RLS ${r.rls}, politiques SELECT ${r.select_policies}`);
        const absent = rows.filter((r) => !r.present).map((r) => r.table_name);
        const noRls = rows.filter((r) => r.present && r.rls !== true).map((r) => r.table_name);
        const noSelect = rows.filter((r) => r.present && Number(r.select_policies) === 0).map((r) => r.table_name);
        assert.deepEqual(absent, [], `tables du contrat absentes : ${absent.join(', ')}`);
        assert.deepEqual(noRls, [], `tables publiées sans RLS : ${noRls.join(', ')}`);
        assert.deepEqual(noSelect, [], `tables publiées sans politique SELECT : ${noSelect.join(', ')}`);
    });

    test('anon ne lit aucune ligne des tables privées ajoutées (event_status_history, controller_shifts, scan_incidents, admin_signals)', async () => {
        for (const table of PRIVATE_NEW) {
            const outcome = await inRolledBackTransaction(async (db) => {
                await db.query('SET LOCAL ROLE anon');
                try {
                    const r = await db.query<{ n: string }>(`SELECT count(*)::text AS n FROM public.${table}`);
                    return { code: null as string | null, rows: Number(r.rows[0].n) };
                } catch (err) {
                    return { code: String((err as { code?: string }).code ?? 'inconnu'), rows: 0 };
                }
            });
            // Refus par privilège (42501) ou RLS sans ligne visible ; une table absente (42P01) échoue.
            assert.ok(outcome.code === '42501' || (outcome.code === null && outcome.rows === 0),
                `anon et ${table} : ${JSON.stringify(outcome)} (attendu : refus 42501 ou aucune ligne)`);
        }
    });
});

/**
 * Lot 5, tâche 5.13 — temps réel public : résumé `public_event_state` (contrat, sections O1, O2, O4 et O5).
 *  - exigence « publication d'un événement → visible dans le catalogue ouvert, sans recharger » : anon,
 *    abonné à public_event_state, reçoit la ligne de l'événement au passage VALIDE → PUBLIE (prix « à
 *    partir de » sur les seules catégories actives et visibles), et le catalogue rechargé sur ce signal
 *    (GET /api/events) contient l'événement ;
 *  - suspension, réactivation, annulation et fin (cron events_finish_overdue) : diffusées à anon avec leur
 *    statut ; ni le motif de suspension ni le motif interne de l'annulation ne sont diffusés ; l'événement
 *    annulé sort du catalogue ;
 *  - exigence « aucun événement non public diffusé à anon » : création BROUILLON, modification du
 *    brouillon, soumission EN_ATTENTE, validation VALIDE → aucune ligne public_event_state (ni en base, ni
 *    en temps réel), rien sur events ; rien non plus sur ticket_categories (catégories d'un événement non
 *    public, catégorie masquée d'un événement publié : contrat A3) ;
 *  - public_event_state : colonnes du contrat O1 seulement (aucune info pratique, aucun motif, aucun
 *    volume), lisible par anon, aucune écriture par les rôles API.
 * Schéma des preuves (tests/helpers/realtime.ts) : vivacité par une action reproductible (titre d'un
 * événement publié dédié), puis l'action observée, puis une sentinelle reçue sur la même table ; une
 * absence de message n'est affirmée qu'après la sentinelle. Un message sans donnée (trame d'erreur 401 de
 * Realtime pour un rôle sans privilège) n'est pas une diffusion : les assertions négatives portent sur les
 * messages qui transportent des colonnes.
 * Rouge avant correctif :
 *  - aucune table public_event_state (aucune migration ne la crée) ni aucune publication de celle-ci
 *    (supabase/migrations/0004_indexes.sql:142-148, 20260907000002_ticket_categories_realtime_replica.sql:15,
 *    20260907000003_tickets_realtime_replica.sql:15, 20261101000013_lot4_pilotage.sql:76-77) : la vivacité et
 *    la réception échouent sur un délai dépassé, les lectures en base sur « relation inexistante » ;
 *  - aucune RPC event_transition ni event_cancel (contrat D4, D6) : advanceEventTo échoue
 *    (tests/parcours/cycle-helpers.ts) ;
 *  - ticket_categories lisible par anon dès que is_active = TRUE, quel que soit le statut de l'événement
 *    et la visibilité (supabase/migrations/0003_rls.sql:141-146), et publiée en REPLICA IDENTITY FULL
 *    (20260907000002_ticket_categories_realtime_replica.sql:7, :15) : anon reçoit les catégories d'un
 *    brouillon et une catégorie masquée.
 * Garde-fou (vert aujourd'hui) : events n'est pas dans la publication, anon n'en reçoit rien.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { inRolledBackTransaction, inspect } from '../helpers/db';
import { assertLifecycleInvariants, finishOverdueEvents } from '../helpers/lifecycle-invariants';
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
} from '../helpers/realtime';
import { importModule, service } from './paiement-helpers';
import { jsonRequest, newPartner, type TestPartner } from './finance-helpers';
import { advanceEventTo, createDraftEvent, createEventInStatus, eventStatus, shiftEventDates, type DraftEvent } from './cycle-helpers';

/** Colonnes de public_event_state (contrat O1), seules autorisées. */
const PUBLIC_EVENT_STATE_COLUMNS = [
    'event_id', 'status', 'title', 'start_at', 'end_at', 'location', 'city', 'image_url', 'min_price', 'has_purchasable', 'updated_at',
];
const PUBLIC_STATUSES = ['PUBLIE', 'SUSPENDU', 'ANNULE', 'TERMINE'];
/** Délai d'observation après la sentinelle (lot 4 : 1 s). */
const SETTLE_MS = 1_500;

let partner: TestPartner;
/** Événement PUBLIE dédié à la vivacité et aux sentinelles (son titre change à chaque signal). */
let live: DraftEvent;

before(async () => {
    partner = await newPartner('tr-public');
    live = await createEventInStatus(partner, 'tr-public-vivacite', [{ name: 'Standard', price: 3000, total: 30 }], 'PUBLIE', { startsInHours: 96 });
});

after(async () => {
    await assertLifecycleInvariants('temps-reel-public');
});

// ── Outils locaux ──────────────────────────────────────────────────────────

let pulse = 0;

/** Nouveau titre unique pour un événement (action reproductible : public_event_state.title change). */
async function retitle(ev: DraftEvent): Promise<string> {
    pulse += 1;
    const title = `${ev.title} · signal ${pulse}`;
    const { error } = await service.from('events').update({ title }).eq('id', ev.eventId);
    assert.equal(error, null, `modification du titre de l'événement ${ev.eventId} : ${error?.message}`);
    return title;
}

/** Sentinelle sur public_event_state : nouveau titre de l'événement de vivacité, attendu chez l'abonné. */
async function stateSentinel(collector: Collector): Promise<void> {
    const title = await retitle(live);
    await waitForEvent(collector, (e) => e.new.event_id === live.eventId && e.new.title === title, RECEIVE_TIMEOUT_MS,
        'sentinelle : nouveau titre de l’événement de vivacité');
}

/** Message qui transporte des colonnes (une trame d'erreur sans donnée n'est pas une diffusion). */
function carriesData(e: ReceivedChange): boolean {
    return Object.keys(e.new).length > 0 || Object.keys(e.old).length > 0;
}

function concerns(e: ReceivedChange, column: string, id: string): boolean {
    return carriesData(e) && (e.new[column] === id || e.old[column] === id);
}

async function stateRow(eventId: string): Promise<Record<string, unknown> | null> {
    const { data, error } = await service.from('public_event_state').select('*').eq('event_id', eventId).maybeSingle();
    assert.equal(error, null, `lecture de public_event_state (événement ${eventId}) : ${error?.message}`);
    return (data ?? null) as Record<string, unknown> | null;
}

/** La charge reçue par anon ne contient que les colonnes publiques, un statut public, et aucun des textes interdits. */
function assertPublicPayload(e: ReceivedChange, forbiddenTexts: string[] = []): void {
    const extra = Object.keys(e.new).filter((k) => !PUBLIC_EVENT_STATE_COLUMNS.includes(k));
    assert.deepEqual(extra, [], `colonnes hors contrat O1 diffusées à anon : ${extra.join(', ')} — ${JSON.stringify(e.new)}`);
    assert.ok(PUBLIC_STATUSES.includes(String(e.new.status)), `statut diffusé à anon : ${String(e.new.status)} (statuts publics : ${PUBLIC_STATUSES.join(', ')})`);
    const text = JSON.stringify(e.new);
    for (const secret of forbiddenTexts) {
        assert.ok(!text.includes(secret), `donnée non publique diffusée à anon (« ${secret} ») : ${text}`);
    }
}

/** Identifiants du catalogue, tel que le recharge l'écran sur le signal (GET /api/events). */
async function catalogueIds(): Promise<string[]> {
    const { GET } = await importModule('../../app/api/events/route');
    const res: Response = await GET(jsonRequest('/api/events', 'GET', null));
    const body = (await res.json()) as { events?: Array<{ id: unknown }> };
    assert.equal(res.status, 200, `GET /api/events : HTTP ${res.status} ${JSON.stringify(body).slice(0, 300)}`);
    return (body.events ?? []).map((e) => String(e.id));
}

async function publishedTables(): Promise<string[]> {
    return inspect(async (db) => (await db.query<{ tablename: string }>(
        "SELECT tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' ORDER BY tablename",
    )).rows.map((r) => r.tablename));
}

/** Nouvelle description unique d'une catégorie (action reproductible sur ticket_categories). */
async function touchCategory(categoryId: string): Promise<string> {
    const marker = `Signal ${randomUUID()}`;
    const { error } = await service.from('ticket_categories').update({ description: marker }).eq('id', categoryId);
    assert.equal(error, null, `modification de la catégorie ${categoryId} : ${error?.message}`);
    return marker;
}

// ── Publication ────────────────────────────────────────────────────────────

describe('Publication d’un événement : visible dans le catalogue ouvert, sans recharger (O4)', () => {
    test('VALIDE → PUBLIE : anon abonné à public_event_state reçoit la ligne (prix « à partir de » des seules catégories actives et visibles) et le catalogue rechargé contient l’événement', async () => {
        const ev = await createEventInStatus(partner, 'tr-publication', [
            { name: 'Standard', price: 5000, total: 20 },
            { name: 'VIP', price: 15000, total: 5 },
            { name: 'Invitation masquée', price: 1000, total: 5, isVisible: false },
            { name: 'Ancienne', price: 500, total: 5, isActive: false },
        ], 'VALIDE', { startsInHours: 72 });
        assert.equal(await stateRow(ev.eventId), null, 'aucune ligne public_event_state tant que l’événement n’a jamais été public');
        assert.ok(!(await catalogueIds()).includes(ev.eventId), 'un événement VALIDE n’est pas au catalogue');

        const anon = anonClient();
        try {
            const all = subscribeCollect(anon, { table: 'public_event_state' }, { label: 'anon public_event_state (sans filtre)' });
            const mine = subscribeCollect(anon, { table: 'public_event_state', filter: `event_id=eq.${ev.eventId}` }, { label: 'anon public_event_state (événement publié)' });
            await Promise.all([all.ready, mine.ready]);
            await produceUntilReceived(all, () => retitle(live), (e) => e.new.event_id === live.eventId,
                { what: 'vivacité : changement du titre d’un événement publié reçu par anon' });

            await advanceEventTo(ev.eventId, 'PUBLIE');
            const got = await waitForEvent(mine, (e) => e.new.event_id === ev.eventId && e.new.status === 'PUBLIE', RECEIVE_TIMEOUT_MS,
                'ligne PUBLIE de l’événement reçue par anon, sans recharger');
            assertPublicPayload(got);
            assert.equal(got.new.title, ev.title, `titre diffusé : ${JSON.stringify(got.new)}`);
            assert.equal(Number(got.new.min_price), 5000, `prix « à partir de » sur les catégories actives et visibles (5000, pas 1000 ni 500) : ${JSON.stringify(got.new)}`);
            assert.equal(got.new.has_purchasable, true, `catégorie achetable signalée : ${JSON.stringify(got.new)}`);

            const row = await stateRow(ev.eventId);
            assert.ok(row, 'ligne public_event_state créée à la publication');
            assert.equal(row.status, 'PUBLIE');
            assert.ok((await catalogueIds()).includes(ev.eventId), 'le catalogue rechargé sur le signal contient l’événement publié');
        } finally {
            await disposeClients(anon);
        }
    });
});

// ── Retraits du catalogue ──────────────────────────────────────────────────

describe('Suspension, réactivation, annulation et fin : diffusées à anon avec leur statut', () => {
    test('PUBLIE → SUSPENDU → PUBLIE → ANNULE : chaque statut arrive à anon, sans le motif de suspension ni le motif interne ; l’événement annulé sort du catalogue', async () => {
        const ev = await createEventInStatus(partner, 'tr-retraits', [{ name: 'Standard', price: 4000, total: 10 }], 'PUBLIE', { startsInHours: 72 });
        const suspendReason = `Motif de suspension confidentiel ${randomUUID().slice(0, 8)}`;
        const internalReason = `Motif interne confidentiel ${randomUUID().slice(0, 8)}`;
        const anon = anonClient();
        try {
            const mine = subscribeCollect(anon, { table: 'public_event_state', filter: `event_id=eq.${ev.eventId}` }, { label: 'anon public_event_state (événement retiré)' });
            await produceUntilReceived(mine, () => retitle(ev), (e) => e.new.event_id === ev.eventId,
                { what: 'vivacité : changement du titre de l’événement publié reçu par anon' });
            mine.clear();

            /** Message de statut `status` reçu après le message `after` (ordre d'arrivée dans le collecteur). */
            const nextStatus = (status: string, after: ReceivedChange | null, what: string) => waitForEvent(mine,
                (e) => e.new.status === status && mine.events.indexOf(e) > (after ? mine.events.indexOf(after) : -1), RECEIVE_TIMEOUT_MS, what);
            await advanceEventTo(ev.eventId, 'SUSPENDU', { suspendReason });
            const suspended = await nextStatus('SUSPENDU', null, 'suspension diffusée à anon');
            await advanceEventTo(ev.eventId, 'PUBLIE');
            const reactivated = await nextStatus('PUBLIE', suspended, 'réactivation diffusée à anon (après la suspension)');
            await advanceEventTo(ev.eventId, 'ANNULE', {
                internalReason,
                publicNotice: 'L’organisateur annule cet événement : chaque billet est remboursé.',
            });
            await nextStatus('ANNULE', reactivated, 'annulation diffusée à anon (après la réactivation)');
            for (const e of mine.events.filter(carriesData)) assertPublicPayload(e, [suspendReason, internalReason]);

            const row = await stateRow(ev.eventId);
            assert.ok(row, 'la ligne public_event_state reste après le retrait (un événement public le reste avec son statut)');
            assert.equal(row.status, 'ANNULE');
            assert.ok(!JSON.stringify(row).includes(internalReason), 'aucun motif interne dans la ligne publique');
            assert.ok(!(await catalogueIds()).includes(ev.eventId), 'l’événement annulé sort du catalogue rechargé');
        } finally {
            await disposeClients(anon);
        }
    });

    test('fin automatique (cron events_finish_overdue) : TERMINE diffusé à anon, l’événement sort du catalogue', async () => {
        const ev = await createEventInStatus(partner, 'tr-fin', [{ name: 'Standard', price: 2500, total: 10 }], 'PUBLIE', { startsInHours: 72 });
        const anon = anonClient();
        try {
            const mine = subscribeCollect(anon, { table: 'public_event_state', filter: `event_id=eq.${ev.eventId}` }, { label: 'anon public_event_state (événement terminé)' });
            await produceUntilReceived(mine, () => retitle(ev), (e) => e.new.event_id === ev.eventId,
                { what: 'vivacité : changement du titre de l’événement publié reçu par anon' });
            mine.clear();

            await shiftEventDates(ev.eventId, { startsInHours: -8, durationHours: 3 });
            const cron = await finishOverdueEvents();
            assert.ok(cron.ids.includes(ev.eventId), `le cron termine l’événement dont la fin est passée depuis 5 h (ids : ${cron.ids.join(', ')})`);
            assert.equal(await eventStatus(ev.eventId), 'TERMINE');
            const got = await waitForEvent(mine, (e) => e.new.status === 'TERMINE', RECEIVE_TIMEOUT_MS, 'fin diffusée à anon');
            assertPublicPayload(got);
            assert.ok(!(await catalogueIds()).includes(ev.eventId), 'l’événement terminé sort du catalogue rechargé');
        } finally {
            await disposeClients(anon);
        }
    });
});

// ── Aucun événement non public diffusé à anon ──────────────────────────────

describe('Aucun événement non public diffusé à anon (O4)', () => {
    test('création BROUILLON, modification, soumission EN_ATTENTE, validation VALIDE : rien sur public_event_state, aucune ligne en base, rien sur events', async () => {
        const anon = anonClient();
        const owner = await signedInClient({ email: partner.email });
        try {
            const state = subscribeCollect(anon, { table: 'public_event_state' }, { label: 'anon public_event_state (sans filtre)' });
            const anonEvents = subscribeCollect(anon, { table: 'events' }, { label: 'anon events (sans filtre)' });
            const ownerEvents = subscribeCollect(owner, { table: 'events' }, { label: 'partenaire propriétaire events (témoin si events est publiée)' });
            await Promise.all([state.ready, anonEvents.ready, ownerEvents.ready]);
            await produceUntilReceived(state, () => retitle(live), (e) => e.new.event_id === live.eventId,
                { what: 'vivacité : changement du titre d’un événement publié reçu par anon' });

            const draft = await createDraftEvent(partner, 'tr-non-public', [{ name: 'Standard', price: 3500, total: 15 }], { startsInHours: 96 });
            const { error: editErr } = await service.from('events').update({ description: 'Brouillon modifié avant soumission.' }).eq('id', draft.eventId);
            assert.equal(editErr, null, `modification du brouillon : ${editErr?.message}`);
            await advanceEventTo(draft.eventId, 'EN_ATTENTE');
            await advanceEventTo(draft.eventId, 'VALIDE');
            await stateSentinel(state);

            await expectNothing(state, SETTLE_MS, (e) => concerns(e, 'event_id', draft.eventId),
                'anon : aucune ligne public_event_state pour un événement BROUILLON, EN_ATTENTE ou VALIDE');
            assert.equal(await stateRow(draft.eventId), null, 'aucune ligne public_event_state en base pour un événement jamais public');

            const eventsPublished = (await publishedTables()).includes('events');
            if (eventsPublished) {
                await waitForEvent(ownerEvents, (e) => e.new.id === draft.eventId && e.new.status === 'VALIDE', RECEIVE_TIMEOUT_MS,
                    'témoin : events est publiée, le partenaire propriétaire reçoit la validation de son événement');
            } else {
                console.log('[TEMPS-REEL] events hors de la publication supabase_realtime : aucune ligne de events ne peut être diffusée');
            }
            await expectNothing(anonEvents, 0, (e) => concerns(e, 'id', draft.eventId),
                'anon : aucune ligne de events pour un événement BROUILLON, EN_ATTENTE ou VALIDE');
        } finally {
            await disposeClients(anon, owner);
        }
    });

    test('ticket_categories : anon ne reçoit rien des catégories d’un événement non public, ni d’une catégorie masquée d’un événement publié (le propriétaire, témoin, les reçoit)', async () => {
        const draft = await createDraftEvent(partner, 'tr-categories', [
            { name: 'Standard', price: 2500, total: 10 },
            { name: 'Masquée', price: 1000, total: 10, isVisible: false },
        ], { startsInHours: 96 });
        const standard = draft.categories.Standard.id;
        const hidden = draft.categories['Masquée'].id;
        const anon = anonClient();
        const owner = await signedInClient({ email: partner.email });
        try {
            const ownerCats = subscribeCollect(owner, { table: 'ticket_categories', filter: `event_id=eq.${draft.eventId}` }, { label: 'partenaire propriétaire ticket_categories (témoin)' });
            const anonCats = subscribeCollect(anon, { table: 'ticket_categories', filter: `event_id=eq.${draft.eventId}` }, { label: 'anon ticket_categories (événement du test)' });
            const anonAll = subscribeCollect(anon, { table: 'ticket_categories' }, { label: 'anon ticket_categories (sans filtre)' });
            await Promise.all([ownerCats.ready, anonCats.ready, anonAll.ready]);
            await produceUntilReceived(ownerCats, () => touchCategory(standard), (e) => e.new.id === standard,
                { what: 'vivacité : changement d’une catégorie reçu par le partenaire propriétaire' });

            const phase = async (label: string, categoryId: string) => {
                const marker = await touchCategory(categoryId);
                await waitForEvent(ownerCats, (e) => e.new.id === categoryId && e.new.description === marker, RECEIVE_TIMEOUT_MS,
                    `témoin (${label}) : le partenaire propriétaire reçoit le changement`);
                await expectNothing(anonCats, SETTLE_MS, (e) => concerns(e, 'id', categoryId), `anon (${label}) : aucune ligne de ticket_categories`);
                await expectNothing(anonAll, 0, (e) => concerns(e, 'id', categoryId), `anon sans filtre (${label}) : aucune ligne de ticket_categories`);
            };

            await phase('événement BROUILLON', standard);
            await advanceEventTo(draft.eventId, 'EN_ATTENTE');
            await phase('événement EN_ATTENTE', standard);
            await advanceEventTo(draft.eventId, 'VALIDE');
            await phase('événement VALIDE', standard);
            await advanceEventTo(draft.eventId, 'PUBLIE');
            await phase('catégorie masquée d’un événement PUBLIE', hidden);
        } finally {
            await disposeClients(anon, owner);
        }
    });
});

// ── Schéma et droits ───────────────────────────────────────────────────────

describe('public_event_state : colonnes publiques seulement, lecture publique, aucune écriture par les rôles API', () => {
    test('colonnes du contrat O1 et rien d’autre (aucune info pratique, aucun motif, aucun volume de vente)', async () => {
        const cols = await inspect(async (db) => (await db.query<{ column_name: string }>(
            "SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'public_event_state' ORDER BY ordinal_position",
        )).rows.map((r) => r.column_name));
        assert.ok(cols.length > 0, 'table public.public_event_state absente (contrat O1, migration 20261102000006_lot5_temps_reel.sql)');
        const missing = PUBLIC_EVENT_STATE_COLUMNS.filter((c) => !cols.includes(c));
        const extra = cols.filter((c) => !PUBLIC_EVENT_STATE_COLUMNS.includes(c));
        assert.deepEqual(missing, [], `colonnes du contrat O1 absentes : ${missing.join(', ')} (colonnes : ${cols.join(', ')})`);
        assert.deepEqual(extra, [], `colonnes hors contrat O1 (seules les données publiques sont permises) : ${extra.join(', ')}`);
    });

    test('lecture par anon et authenticated ; INSERT, UPDATE et DELETE refusés aux rôles API', async () => {
        for (const role of ['anon', 'authenticated'] as const) {
            const n = await inspect(async (db) => Number((await db.query<{ n: string }>('SELECT count(*)::text AS n FROM public.public_event_state')).rows[0].n), role);
            assert.ok(Number.isInteger(n) && n >= 0, `${role} : lecture de public_event_state`);
        }
        const attempts: Array<[string, string]> = [
            ['INSERT', "INSERT INTO public.public_event_state (event_id, status, title) VALUES (gen_random_uuid(), 'PUBLIE', 'Événement forgé')"],
            ['UPDATE', "UPDATE public.public_event_state SET title = 'Titre forgé'"],
            ['DELETE', 'DELETE FROM public.public_event_state'],
        ];
        for (const role of ['anon', 'authenticated'] as const) {
            for (const [verb, sql] of attempts) {
                const outcome = await inRolledBackTransaction(async (db) => {
                    await db.query(`SET LOCAL ROLE ${role}`);
                    try {
                        const r = await db.query(sql);
                        return { code: null as string | null, rowCount: r.rowCount ?? 0 };
                    } catch (err) {
                        return { code: String((err as { code?: string }).code ?? 'inconnu'), rowCount: 0 };
                    }
                });
                if (verb === 'INSERT') {
                    assert.equal(outcome.code, '42501', `${role} : INSERT dans public_event_state refusé (privilège ou RLS), obtenu ${JSON.stringify(outcome)}`);
                } else {
                    // Refus par privilège (42501) ou par la RLS (aucune ligne touchée, sans erreur) ; toute autre erreur échoue.
                    assert.ok(outcome.code === '42501' || (outcome.code === null && outcome.rowCount === 0),
                        `${role} : ${verb} sur public_event_state sans effet, obtenu ${JSON.stringify(outcome)}`);
                }
            }
        }
    });
});

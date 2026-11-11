/**
 * Lot 6, tâche 6.0 a — un compte suspendu ne reçoit plus rien en temps réel : la RLS des tables publiées lit
 * le statut du compte (contrat A1 et amendement 1 : P_ACTIF = users.status ni SUSPENDU ni SUPPRIME ; S2 groupe
 * Dette ; discovery-6-temps-reel-rls.md §1).
 *  - partenaire suspendu par la vraie route PATCH /api/admin/partners/[id]/status, puis reconnecté (GoTrue
 *    délivre encore un jeton, seul le navigateur se déconnecte) : aucun message sur ticket_scans,
 *    scan_incidents, controller_shifts, event_status_history, tickets, ticket_categories (catégorie masquée),
 *    orders, notifications ; dans la même période, le témoin admin reçoit chaque changement (et un client
 *    témoin reçoit sa propre notification, posée après celle du partenaire) ;
 *  - réactivé (SUSPENDU → VALIDE par la même route) : un NOUVEAU client connecté reçoit chacune des tables.
 *    Le canal ouvert avant la suspension n'est pas affirmé : ce qu'il reçoit est journalisé (décision 46) ;
 *  - admin suspendu par PATCH /api/admin/users : rien sur admin_signals (témoin : l'admin du seed) ; réactivé :
 *    un nouveau client reçoit ;
 *  - contrôleur suspendu par PATCH /api/admin/users : rien sur sa caisse (controller_shifts) ; réactivé : reçoit ;
 *  - sonde pg_policies imprimée : chaque politique du tableau A1 lit users.status (SUSPENDU et SUPPRIME) et
 *    s'adresse à authenticated (sauf les deux de ticket_categories, rôles inchangés).
 * Schéma des preuves (tests/helpers/realtime.ts, lot 5) : chaque abonné ouvre UN canal qui porte toutes les
 * tables observées et une table de contrôle lisible par tous (public_event_state d'un événement publié de la
 * suite) ; la vivacité est prouvée sur ce même canal (le serveur active ensemble les abonnements d'un canal) :
 * un abonné suspendu ne peut pas « ne rien recevoir » parce que son abonnement n'est pas encore actif. Puis
 * l'action observée, la sentinelle reçue par le témoin, et l'absence chez le compte suspendu. Un message sans
 * donnée n'est pas une diffusion.
 * Producteurs (repris de temps-reel-prives.test.ts) : scan_log, insertion dans scan_incidents, updated_at de
 * la caisse et du billet, description de la catégorie masquée, delivery_notes de la commande, transitions
 * admin PUBLIE ↔ SUSPENDU d'un événement du partenaire (une ligne d'historique chacune), notification insérée
 * par le service_role (canal PUSH tant que notifications.channel est l'énumération du lot 5, IN_APP une fois
 * la colonne passée en texte, contrat F1), inscription d'un partenaire (signal PARTNER_REGISTERED).
 *
 * Rouge avant correctif : aucune politique RLS ne lit users.status (discovery §0.1 ; is_partner_owner,
 * has_role et les jointures en ligne l'ignorent) : le partenaire, l'admin et le contrôleur suspendus et
 * reconnectés reçoivent tout ; la sonde pg_policies ne trouve ni SUSPENDU ni SUPPRIME, et controller_shifts,
 * tickets, notifications, orders n'ont pas de clause TO authenticated.
 * Vert dès aujourd'hui (préconditions, signalées) : le compte actif reçoit ; le compte réactivé reçoit sur
 * une nouvelle connexion.
 * Fin de suite : assertNotificationInvariants (rouge avant le correctif 6.1, boîte d'envoi absente) ; un
 * compte resté suspendu après un échec est réactivé avant.
 * La suite crée son partenaire, ses événements, son contrôleur, sa caisse, sa commande, son billet, ses
 * clients et son admin.
 * Lot 9 bis (T24 ; R5, B18, B37) : la suspension par la route suspend en cascade les événements PUBLIE du
 * partenaire et refuse leur republication par un admin tant qu'il est suspendu ; la bascule de l'événement
 * d'historique relit donc son statut en base, et un brouillon du partenaire créé par le service produit la ligne
 * d'historique quand la bascule est refusée PARTNER_SUSPENDED ; la réactivation porte un motif. L'absence de fuite
 * est vérifiée de la même façon, sur l'événement d'historique et sur chacun de ces brouillons.
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
import type { NextRequest } from 'next/server';
import { inspect } from '../helpers/db';
import { bearer, signInAs } from '../helpers/fixtures';
import {
    RECEIVE_TIMEOUT_MS,
    SUBSCRIBE_TIMEOUT_MS,
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
import { assertNotificationInvariants, newAdmin, type TestAdmin } from './notif-helpers';
import { importModule, newBuyer, service, type Buyer, type SaleEvent } from './paiement-helpers';
import { newPartner, superadminId, type TestPartner } from './finance-helpers';
import { createCashOrderTickets, createTimedEvent, newController, openShift, type RouteResult } from './acces-helpers';
import { assertRpcOk, createDraftEvent, eventHistory, eventStatus, rpcTransition } from './cycle-helpers';
import { jsonRequest } from './helpers';

const SETTLE_MS = 1_500;
const PARTNER_STATUS_ROUTE = '../../app/api/admin/partners/[id]/status/route';
const USERS_ROUTE = '../../app/api/admin/users/route';
const HIDDEN_CATEGORY = 'Coulisses';

type TableKey =
    | 'ticket_scans' | 'scan_incidents' | 'controller_shifts' | 'event_status_history'
    | 'tickets' | 'ticket_categories' | 'orders' | 'notifications';

let partner: TestPartner;
let witnessClient: Buyer;
let buyer: Buyer;
let controller: Buyer;
let ev: SaleEvent;
let historyEvent: SaleEvent;
let live: SaleEvent;
let liveTitle: string;
let shiftId: string;
let orderId: string;
let ticketId: string;
let hiddenCategoryId: string;
let adminActor: string;

/** Clients ouverts par le premier groupe (fermés dans after). */
const opened: SupabaseClient[] = [];

before(async () => {
    partner = await newPartner('tr-susp');
    witnessClient = await newBuyer('tr-susp-temoin', { firstName: 'Khady', lastName: 'Temoin' });
    buyer = await newBuyer('tr-susp-client');
    ev = await createTimedEvent(partner.partnerId, 'tr-susp', [
        { name: 'Standard', price: 2000, total: 40 },
        { name: HIDDEN_CATEGORY, price: 1000, total: 5, isVisible: false },
    ]);
    hiddenCategoryId = ev.categories[HIDDEN_CATEGORY].id;
    historyEvent = await createTimedEvent(partner.partnerId, 'tr-susp-historique', [{ name: 'Standard', price: 2000, total: 10 }], { startsInHours: 72 });
    historyEventIds.push(historyEvent.eventId);
    live = await createTimedEvent(partner.partnerId, 'tr-susp-controle', [{ name: 'Standard', price: 2000, total: 10 }], { startsInHours: 96 });
    const { data, error } = await service.from('events').select('title').eq('id', live.eventId).single();
    assert.equal(error, null, `titre de l'événement de contrôle : ${error?.message}`);
    liveTitle = String(data.title);
    controller = await newController(partner, ev.eventId, { canAcceptCash: true, label: 'tr-susp' });
    shiftId = await openShiftOf(controller, ev.eventId);
    const cash = await createCashOrderTickets(buyer, partner, ev, 'Standard', 1);
    orderId = cash.orderId;
    ticketId = cash.ticketIds[0];
    adminActor = await superadminId();
});

after(async () => {
    try {
        await forceActive(partner.userId, partner.partnerId);
        await disposeClients(...opened);
    } finally {
        await assertNotificationInvariants('dette-suspendu-temps-reel');
    }
});

// ── Outils locaux ──────────────────────────────────────────────────────────

type Row = Record<string, unknown>;
type Handler = (req: NextRequest, ctx?: unknown) => Promise<Response>;

function sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
}

function carriesData(e: ReceivedChange): boolean {
    return Object.keys(e.new).length > 0 || Object.keys(e.old).length > 0;
}

function about(column: string, values: string[]): (e: ReceivedChange) => boolean {
    return (e) => carriesData(e) && (values.includes(String(e.new[column])) || values.includes(String(e.old[column])));
}

function sameInstant(value: unknown, iso: string): boolean {
    return typeof value === 'string' && Date.parse(value) === Date.parse(iso);
}

async function invoke(handler: Handler, req: NextRequest, ctx?: unknown): Promise<RouteResult> {
    const res = await handler(req, ctx);
    const text = await res.text();
    let body: Row = {};
    try {
        body = text ? JSON.parse(text) : {};
    } catch {
        body = { raw: text };
    }
    return { status: res.status, body };
}

function show(r: RouteResult): string {
    return `HTTP ${r.status} ${JSON.stringify(r.body)}`;
}

/** Contexte de route valable que le gestionnaire lise `params.id` (Next 14) ou `await params`. */
function paramsContext(id: string): { params: Promise<{ id: string }> & { id: string } } {
    return { params: Object.assign(Promise.resolve({ id }), { id }) };
}

async function openShiftOf(user: Buyer, eventId: string): Promise<string> {
    const res = await openShift(user, eventId);
    assert.equal(res.status, 200, `ouverture de caisse : ${show(res)}`);
    const { data, error } = await service.from('controller_shifts').select('id')
        .eq('controller_id', user.userId).eq('event_id', eventId).eq('status', 'OUVERT');
    assert.equal(error, null, `caisse ouverte : ${error?.message}`);
    assert.equal((data ?? []).length, 1, `une caisse OUVERT du contrôleur (trouvé : ${(data ?? []).length})`);
    return String(data![0].id);
}

async function userStatus(userId: string): Promise<string> {
    const { data, error } = await service.from('users').select('status').eq('id', userId).single();
    assert.equal(error, null, `statut du compte ${userId} : ${error?.message}`);
    return String(data.status);
}

async function partnerStatus(partnerId: string): Promise<string> {
    const { data, error } = await service.from('partners').select('status').eq('id', partnerId).single();
    assert.equal(error, null, `statut du partenaire ${partnerId} : ${error?.message}`);
    return String(data.status);
}

/** Filet de fin de test : un compte resté suspendu après un échec redevient actif (et sa fiche VALIDE). */
async function forceActive(userId: string, partnerId?: string): Promise<void> {
    if (partnerId && (await partnerStatus(partnerId)) === 'SUSPENDU') {
        const { error } = await service.from('partners').update({ status: 'VALIDE', suspended_reason: null }).eq('id', partnerId);
        assert.equal(error, null, `remise en état du partenaire ${partnerId} : ${error?.message}`);
    }
    if ((await userStatus(userId)) !== 'ACTIF') {
        const { error } = await service.from('users').update({ status: 'ACTIF' }).eq('id', userId);
        assert.equal(error, null, `remise en état du compte ${userId} : ${error?.message}`);
    }
}

let superToken: string | null = null;

async function superadminToken(): Promise<string> {
    if (!superToken) superToken = (await signInAs('SUPERADMIN')).accessToken;
    return superToken;
}

async function setPartnerStatus(status: 'SUSPENDU' | 'VALIDE', reason?: string): Promise<RouteResult> {
    const { PATCH } = await importModule(PARTNER_STATUS_ROUTE);
    const body: Row = { status };
    if (reason) body.reason = reason;
    return invoke(PATCH as Handler,
        jsonRequest(`/api/admin/partners/${partner.partnerId}/status`, body, bearer(await superadminToken()), 'PATCH'),
        paramsContext(partner.partnerId));
}

async function setUserStatus(userId: string, status: 'SUSPENDU' | 'ACTIF'): Promise<RouteResult> {
    const { PATCH } = await importModule(USERS_ROUTE);
    return invoke(PATCH as Handler, jsonRequest('/api/admin/users', { userId, status }, bearer(await superadminToken()), 'PATCH'));
}

// ── Abonnements : un canal par abonné, une table de contrôle dans le canal ──

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

/** Table de contrôle lisible par tous : la ligne public_event_state de l'événement de contrôle. */
function controlTarget(): RealtimeTarget {
    return { table: 'public_event_state', filter: `event_id=eq.${live.eventId}` };
}

let pulse = 0;

async function retitle(): Promise<string> {
    pulse += 1;
    const title = `${liveTitle} · contrôle ${pulse}`;
    const { error } = await service.from('events').update({ title }).eq('id', live.eventId);
    assert.equal(error, null, `titre de l'événement de contrôle : ${error?.message}`);
    return title;
}

/** Vivacité du canal : un nouveau titre de l'événement de contrôle reçu sur la table de contrôle du canal. */
async function proveLive(feed: Collector): Promise<void> {
    await produceUntilReceived(feed, retitle, (e) => e.new.event_id === live.eventId, { what: `vivacité : ${feed.label}` });
}

// ── Producteurs ────────────────────────────────────────────────────────────

async function logScan(): Promise<string> {
    const hash = randomBytes(32).toString('hex');
    const { error } = await service.rpc('scan_log', {
        p_ticket: null, p_event: ev.eventId, p_scanner: controller.userId, p_result: 'invalid', p_accepted: false,
        p_method: 'QR', p_identity: false, p_hash: hash, p_amount: null,
    });
    assert.equal(error, null, `journal d’une tentative de scan : ${error?.message}`);
    return hash;
}

async function logIncident(): Promise<string> {
    const { data, error } = await service.from('scan_incidents')
        .insert({ scanner_id: controller.userId, event_id: ev.eventId, kind: 'NETWORK', source: 'DEVICE' })
        .select('id').single();
    assert.equal(error, null, `incident de scan : ${error?.message}`);
    return String(data.id);
}

let tick = 0;

async function touchShift(id: string): Promise<string> {
    tick += 1;
    const at = new Date(Date.now() + tick).toISOString();
    const { error } = await service.from('controller_shifts').update({ updated_at: at }).eq('id', id);
    assert.equal(error, null, `mise à jour de la caisse ${id} : ${error?.message}`);
    return at;
}

async function touchTicket(): Promise<string> {
    tick += 1;
    const at = new Date(Date.now() + tick).toISOString();
    const { error } = await service.from('tickets').update({ updated_at: at }).eq('id', ticketId);
    assert.equal(error, null, `mise à jour du billet ${ticketId} : ${error?.message}`);
    return at;
}

async function touchHiddenCategory(): Promise<string> {
    const marker = `Signal ${randomUUID()}`;
    const { error } = await service.from('ticket_categories').update({ description: marker }).eq('id', hiddenCategoryId);
    assert.equal(error, null, `catégorie masquée ${hiddenCategoryId} : ${error?.message}`);
    return marker;
}

async function touchOrder(): Promise<string> {
    const marker = `Signal ${randomUUID()}`;
    const { error } = await service.from('orders').update({ delivery_notes: marker }).eq('id', orderId);
    assert.equal(error, null, `commande ${orderId} : ${error?.message}`);
    return marker;
}

/**
 * Événements du partenaire dont l'historique est observé : l'événement d'historique, puis chaque brouillon de
 * remplacement (lot 9 bis, ci-dessous). Tableau partagé, lu à chaque message par `about` (fuite) : un brouillon
 * créé pendant la suspension est couvert par l'assertion d'absence comme l'événement d'historique.
 */
const historyEventIds: string[] = [];

/**
 * Lot 9 bis (T24 ; R5, B16, B18) : la suspension de la partenaire suspend en cascade ses événements PUBLIE, et un
 * admin ne republie pas l'événement d'une partenaire suspendue (PARTNER_SUSPENDED). Le statut est donc relu en base
 * avant la bascule (plus de variable locale désynchronisée par la cascade) ; si la bascule est refusée
 * PARTNER_SUSPENDED, un brouillon du partenaire créé par le service écrit la ligne d'historique à sa place (CREATION,
 * trigger events_log_creation), sur la même table et pour un événement du même partenaire.
 */
async function draftHistoryRow(): Promise<string> {
    const draft = await createDraftEvent(partner, 'tr-susp-historique-brouillon', [], { startsInHours: 120 });
    historyEventIds.push(draft.eventId);
    const rows = await eventHistory(draft.eventId);
    assert.equal(rows.length, 1, `ligne CREATION du brouillon de remplacement : ${JSON.stringify(rows)}`);
    assert.equal(rows[0].channel, 'CREATION', JSON.stringify(rows[0]));
    return rows[0].id;
}

/** Transition admin PUBLIE ↔ SUSPENDU de l'événement d'historique (ou brouillon de remplacement) ; renvoie l'id de la ligne écrite. */
async function toggleHistoryEvent(): Promise<string> {
    const from = await eventStatus(historyEvent.eventId);
    assert.ok(from === 'PUBLIE' || from === 'SUSPENDU', `événement d'historique ni PUBLIE ni SUSPENDU : ${from}`);
    const to = from === 'PUBLIE' ? 'SUSPENDU' : 'PUBLIE';
    const call = await rpcTransition(historyEvent.eventId, adminActor, to, to === 'SUSPENDU' ? 'Suspension de test du lot 6 (temps réel)' : undefined);
    if (call.error === null && call.data?.ok === false && call.data.code === 'PARTNER_SUSPENDED') return draftHistoryRow();
    assertRpcOk(call, `transition ${from} → ${to} de l'événement d'historique`);
    const rows = await eventHistory(historyEvent.eventId);
    const last = rows[rows.length - 1];
    assert.equal(last.new_status, to, `dernière ligne d'historique : ${JSON.stringify(last)}`);
    return last.id;
}

let notificationChannel: string | null = null;

/** Canal à écrire dans notifications : PUSH tant que la colonne est l'énumération du lot 5, IN_APP une fois en texte (F1). */
async function notificationChannelValue(): Promise<string> {
    if (notificationChannel) return notificationChannel;
    const type = await inspect(async (db) => (await db.query<{ data_type: string }>(
        "SELECT data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'notifications' AND column_name = 'channel'",
    )).rows[0]?.data_type);
    assert.ok(type, 'colonne notifications.channel introuvable');
    notificationChannel = type === 'USER-DEFINED' ? 'PUSH' : 'IN_APP';
    return notificationChannel;
}

async function insertNotification(userId: string): Promise<string> {
    const title = `Notification de test ${randomUUID().slice(0, 8)}`;
    const { error } = await service.from('notifications').insert({
        user_id: userId,
        type: 'TICKET_TRANSFER_CLAIMED',
        title,
        content: 'Notification dédiée aux tests du temps réel (lot 6, compte suspendu).',
        channel: await notificationChannelValue(),
        status: 'SENT',
        sent_at: new Date().toISOString(),
        metadata: { source: 'tests-lot6-dette-suspendu' },
    });
    assert.equal(error, null, `notification de test : ${error?.message}`);
    return title;
}

interface Probe {
    key: TableKey;
    /** Abonnement du compte observé (et du témoin admin, sauf notifications). */
    target: RealtimeTarget;
    produce: () => Promise<string>;
    matches: (e: ReceivedChange, marker: string) => boolean;
    leak: (e: ReceivedChange) => boolean;
    /** admin : l'admin du seed reçoit le même changement ; client : un client témoin reçoit SA notification posée ensuite. */
    witness: 'admin' | 'client';
}

function probes(): Probe[] {
    return [
        {
            key: 'ticket_scans', target: { table: 'ticket_scans', filter: `event_id=eq.${ev.eventId}` }, witness: 'admin',
            produce: logScan, matches: (e, hash) => e.new.payload_hash === hash, leak: about('event_id', [ev.eventId]),
        },
        {
            key: 'scan_incidents', target: { table: 'scan_incidents', filter: `event_id=eq.${ev.eventId}` }, witness: 'admin',
            produce: logIncident, matches: (e, id) => e.new.id === id, leak: about('event_id', [ev.eventId]),
        },
        {
            key: 'controller_shifts', target: { table: 'controller_shifts', filter: `event_id=eq.${ev.eventId}` }, witness: 'admin',
            produce: () => touchShift(shiftId), matches: (e, at) => e.new.id === shiftId && sameInstant(e.new.updated_at, at), leak: about('id', [shiftId]),
        },
        {
            // Lot 9 bis (T24) : abonnement sans filtre, car un brouillon de remplacement naît après l'abonnement ;
            // la fuite couvre l'événement d'historique et chacun de ces brouillons (historyEventIds).
            key: 'event_status_history', target: { table: 'event_status_history' }, witness: 'admin',
            produce: toggleHistoryEvent, matches: (e, id) => e.new.id === id, leak: about('event_id', historyEventIds),
        },
        {
            key: 'tickets', target: { table: 'tickets', filter: `event_id=eq.${ev.eventId}` }, witness: 'admin',
            produce: touchTicket, matches: (e, at) => e.new.id === ticketId && sameInstant(e.new.updated_at, at), leak: about('id', [ticketId]),
        },
        {
            key: 'ticket_categories', target: { table: 'ticket_categories', filter: `event_id=eq.${ev.eventId}` }, witness: 'admin',
            produce: touchHiddenCategory, matches: (e, m) => e.new.id === hiddenCategoryId && e.new.description === m, leak: about('id', [hiddenCategoryId]),
        },
        {
            key: 'orders', target: { table: 'orders', filter: `partner_id=eq.${partner.partnerId}` }, witness: 'admin',
            produce: touchOrder, matches: (e, m) => e.new.id === orderId && e.new.delivery_notes === m, leak: about('id', [orderId]),
        },
        {
            key: 'notifications', target: { table: 'notifications', filter: `user_id=eq.${partner.userId}` }, witness: 'client',
            produce: () => insertNotification(partner.userId), matches: (e, title) => e.new.title === title, leak: about('user_id', [partner.userId]),
        },
    ];
}

function partnerTargets(): Record<TableKey | 'control', RealtimeTarget> {
    const out = { control: controlTarget() } as Record<TableKey | 'control', RealtimeTarget>;
    for (const p of probes()) out[p.key] = p.target;
    return out;
}

async function partnerBundle(label: string): Promise<Bundle<TableKey | 'control'>> {
    const client = await signedInClient({ email: partner.email });
    opened.push(client);
    const bundle = subscribeBundle(client, label, partnerTargets());
    await bundle.ready;
    await proveLive(bundle.feeds.control);
    return bundle;
}

/** Messages d'un collecteur qui satisfont `leak`, résumés ; vide = aucune fuite. */
function leakSummary(feed: Collector, leak: (e: ReceivedChange) => boolean): string | null {
    const hits = feed.events.filter(leak);
    return hits.length === 0 ? null : `${feed.label} : ${hits.length} message(s) ${JSON.stringify(hits.slice(0, 2).map((h) => h.new))}`;
}

// ── Partenaire suspendu ────────────────────────────────────────────────────

describe('6.0 a — partenaire suspendu par la route : plus aucun message en temps réel', () => {
    let initial: Bundle<TableKey | 'control'>;
    let adminFeeds: Bundle<Exclude<TableKey, 'notifications'> | 'control'>;
    let witnessFeeds: Bundle<'notifications' | 'control'>;
    let suspended: Bundle<TableKey | 'control'> | null = null;

    test('précondition : le partenaire actif abonné reçoit chacune des huit tables ; témoins abonnés', async () => {
        initial = await partnerBundle('partenaire actif (canal ouvert avant la suspension)');
        const admin = await signedInClient('ADMIN');
        const witness = await signedInClient({ email: witnessClient.email });
        opened.push(admin, witness);
        const adminTargets = { ...partnerTargets() } as Partial<Record<TableKey | 'control', RealtimeTarget>>;
        delete adminTargets.notifications;
        adminFeeds = subscribeBundle(admin, 'témoin admin', adminTargets as Record<Exclude<TableKey, 'notifications'> | 'control', RealtimeTarget>);
        witnessFeeds = subscribeBundle(witness, 'client témoin', {
            control: controlTarget(),
            notifications: { table: 'notifications', filter: `user_id=eq.${witnessClient.userId}` },
        });
        await Promise.all([adminFeeds.ready, witnessFeeds.ready]);
        await proveLive(adminFeeds.feeds.control);
        await proveLive(witnessFeeds.feeds.control);
        for (const p of probes()) {
            await produceUntilReceived(initial.feeds[p.key], p.produce, p.leak, { what: `précondition : ${p.key} reçu par le partenaire actif` });
        }
    });

    test('suspendu (PATCH /api/admin/partners/[id]/status) puis reconnecté : rien sur les huit tables, le témoin reçoit chaque changement', async () => {
        assert.ok(initial && adminFeeds && witnessFeeds, 'précondition non établie : le test précédent (abonnements du partenaire actif et des témoins) a échoué');
        const res = await setPartnerStatus('SUSPENDU', 'Suspension de test du lot 6 (temps réel)');
        assert.equal(res.status, 200, `suspension du partenaire : ${show(res)}`);
        assert.equal(await partnerStatus(partner.partnerId), 'SUSPENDU', 'fiche partenaire suspendue');
        assert.equal(await userStatus(partner.userId), 'SUSPENDU', 'compte du partenaire suspendu (users.status, seul lu par la RLS)');

        for (const feed of Object.values<Collector>(initial.feeds)) feed.clear();
        suspended = await partnerBundle('partenaire suspendu reconnecté');

        for (const p of probes()) {
            const marker = await p.produce();
            if (p.witness === 'client') {
                const sentinel = await insertNotification(witnessClient.userId);
                await waitForEvent(witnessFeeds.feeds.notifications, (e) => e.new.title === sentinel, RECEIVE_TIMEOUT_MS,
                    `${p.key} : sentinelle (notification du client témoin, posée après celle du partenaire) reçue`);
            } else {
                const feed = (adminFeeds.feeds as Partial<Record<TableKey, Collector>>)[p.key];
                assert.ok(feed, `témoin admin abonné à ${p.key}`);
                await waitForEvent(feed, (e) => p.matches(e, marker), RECEIVE_TIMEOUT_MS, `${p.key} : changement reçu par le témoin admin`);
                const sentinel = await p.produce();
                await waitForEvent(feed, (e) => p.matches(e, sentinel), RECEIVE_TIMEOUT_MS, `${p.key} : sentinelle reçue par le témoin admin`);
            }
        }
        await sleep(SETTLE_MS);

        const journal = probes().map((p) => `${p.key} ${initial.feeds[p.key].events.filter(p.leak).length}`).join(', ');
        console.log(`[TEMPS-REEL-6.0a] canal ouvert avant la suspension, messages reçus pendant la suspension (journalisé, non affirmé) : ${journal}`);
        const leaks = probes().map((p) => leakSummary(suspended!.feeds[p.key], p.leak)).filter((x): x is string => x !== null);
        assert.deepEqual(leaks, [], `partenaire suspendu et reconnecté : messages reçus\n${leaks.join('\n')}`);
    });

    test('réactivé (SUSPENDU → VALIDE par la même route) : un nouveau client reçoit chacune des huit tables', async () => {
        assert.ok(initial, 'précondition non établie : le premier test (abonnement du partenaire actif) a échoué');
        // Lot 9 bis (T24, B37) : la réactivation SUSPENDU → VALIDE exige désormais un motif.
        const res = await setPartnerStatus('VALIDE', 'Réactivation de test du lot 9 bis (temps réel)');
        assert.equal(res.status, 200, `réactivation du partenaire : ${show(res)}`);
        assert.equal(await partnerStatus(partner.partnerId), 'VALIDE', 'fiche partenaire réactivée');
        assert.equal(await userStatus(partner.userId), 'ACTIF', 'compte du partenaire réactivé');

        const fresh = await partnerBundle('partenaire réactivé (nouvelle connexion)');
        const markers: Partial<Record<TableKey, string>> = {};
        for (const p of probes()) {
            const marker = await p.produce();
            markers[p.key] = marker;
            await waitForEvent(fresh.feeds[p.key], (e) => p.matches(e, marker), RECEIVE_TIMEOUT_MS, `${p.key} : reçu par le partenaire réactivé`);
        }
        const journal = (bundle: Bundle<TableKey | 'control'> | null): string => (bundle
            ? probes().map((p) => `${p.key} ${bundle.feeds[p.key].events.some((e) => p.matches(e, markers[p.key]!)) ? 'oui' : 'non'}`).join(', ')
            : 'canal non ouvert');
        console.log(`[TEMPS-REEL-6.0a] après réactivation, canal ouvert avant la suspension (journalisé) : ${journal(initial)}`);
        console.log(`[TEMPS-REEL-6.0a] après réactivation, canal ouvert pendant la suspension (journalisé) : ${journal(suspended)}`);
    });
});

// ── Admin suspendu ─────────────────────────────────────────────────────────

describe('6.0 a — admin suspendu (PATCH /api/admin/users) : rien sur admin_signals', () => {
    test('suspendu puis reconnecté : aucun signal ; l’admin du seed les reçoit ; réactivé : un nouveau client les reçoit', async () => {
        const admin: TestAdmin = await newAdmin('tr-susp-signaux');
        const clients: SupabaseClient[] = [];
        const registered: string[] = [];
        const register = async (): Promise<string> => {
            const p = await newPartner('tr-susp-signal');
            registered.push(p.partnerId);
            return p.partnerId;
        };
        const isSignal = (ids: string[]) => (e: ReceivedChange): boolean => e.new.kind === 'PARTNER_REGISTERED' && ids.includes(String(e.new.ref_id));
        const bundleOf = async (label: string, who: { email: string } | 'ADMIN'): Promise<Bundle<'signals' | 'control'>> => {
            const c = await signedInClient(who);
            clients.push(c);
            const b = subscribeBundle(c, label, { control: controlTarget(), signals: { table: 'admin_signals' } });
            await b.ready;
            await proveLive(b.feeds.control);
            return b;
        };
        try {
            const active = await bundleOf('admin actif', { email: admin.email });
            await produceUntilReceived(active.feeds.signals, register, isSignal(registered), { what: 'précondition : inscription d’un partenaire reçue par l’admin actif' });

            const res = await setUserStatus(admin.userId, 'SUSPENDU');
            assert.equal(res.status, 200, `suspension de l'admin : ${show(res)}`);
            assert.equal(await userStatus(admin.userId), 'SUSPENDU', 'compte admin suspendu');
            const suspended = await bundleOf('admin suspendu reconnecté', { email: admin.email });
            const witness = await bundleOf('admin du seed (témoin)', 'ADMIN');

            const target = await register();
            await waitForEvent(witness.feeds.signals, isSignal([target]), RECEIVE_TIMEOUT_MS, 'signal PARTNER_REGISTERED reçu par l’admin témoin');
            const sentinel = await register();
            await waitForEvent(witness.feeds.signals, isSignal([sentinel]), RECEIVE_TIMEOUT_MS, 'sentinelle reçue par l’admin témoin');
            await sleep(SETTLE_MS);
            const leak = leakSummary(suspended.feeds.signals, isSignal([target, sentinel]));
            assert.equal(leak, null, `admin suspendu et reconnecté : signaux reçus — ${leak}`);

            const back = await setUserStatus(admin.userId, 'ACTIF');
            assert.equal(back.status, 200, `réactivation de l'admin : ${show(back)}`);
            const fresh = await bundleOf('admin réactivé (nouvelle connexion)', { email: admin.email });
            const again = await register();
            await waitForEvent(fresh.feeds.signals, isSignal([again]), RECEIVE_TIMEOUT_MS, 'signal reçu par l’admin réactivé');
        } finally {
            await forceActive(admin.userId);
            await disposeClients(...clients);
        }
    });
});

// ── Contrôleur suspendu ────────────────────────────────────────────────────

describe('6.0 a — contrôleur suspendu (PATCH /api/admin/users) : rien sur sa caisse', () => {
    test('suspendu puis reconnecté : aucune mise à jour de sa caisse ; l’admin la reçoit ; réactivé : un nouveau client la reçoit', async () => {
        // Indépendance vis-à-vis du groupe précédent : si sa réactivation a échoué, le partenaire est remis actif
        // avant l'ouverture de la caisse (filet de test, rien n'est affirmé sur ce chemin).
        await forceActive(partner.userId, partner.partnerId);
        const cashier = await newController(partner, ev.eventId, { canAcceptCash: true, label: 'tr-susp-caisse' });
        const ownShift = await openShiftOf(cashier, ev.eventId);
        const clients: SupabaseClient[] = [];
        const shiftTarget: RealtimeTarget = { table: 'controller_shifts', filter: `id=eq.${ownShift}` };
        const matches = (at: string) => (e: ReceivedChange): boolean => e.new.id === ownShift && sameInstant(e.new.updated_at, at);
        const bundleOf = async (label: string, who: { email: string } | 'ADMIN'): Promise<Bundle<'shift' | 'control'>> => {
            const c = await signedInClient(who);
            clients.push(c);
            const b = subscribeBundle(c, label, { control: controlTarget(), shift: shiftTarget });
            await b.ready;
            await proveLive(b.feeds.control);
            return b;
        };
        try {
            const active = await bundleOf('contrôleur actif', { email: cashier.email });
            await produceUntilReceived(active.feeds.shift, () => touchShift(ownShift), about('id', [ownShift]), { what: 'précondition : sa caisse reçue par le contrôleur actif' });

            const res = await setUserStatus(cashier.userId, 'SUSPENDU');
            assert.equal(res.status, 200, `suspension du contrôleur : ${show(res)}`);
            assert.equal(await userStatus(cashier.userId), 'SUSPENDU', 'compte contrôleur suspendu');
            const suspended = await bundleOf('contrôleur suspendu reconnecté', { email: cashier.email });
            const witness = await bundleOf('admin du seed (témoin)', 'ADMIN');

            const target = await touchShift(ownShift);
            await waitForEvent(witness.feeds.shift, matches(target), RECEIVE_TIMEOUT_MS, 'mise à jour de la caisse reçue par l’admin témoin');
            const sentinel = await touchShift(ownShift);
            await waitForEvent(witness.feeds.shift, matches(sentinel), RECEIVE_TIMEOUT_MS, 'sentinelle reçue par l’admin témoin');
            await sleep(SETTLE_MS);
            const leak = leakSummary(suspended.feeds.shift, about('id', [ownShift]));
            assert.equal(leak, null, `contrôleur suspendu et reconnecté : sa caisse reçue — ${leak}`);

            const back = await setUserStatus(cashier.userId, 'ACTIF');
            assert.equal(back.status, 200, `réactivation du contrôleur : ${show(back)}`);
            const fresh = await bundleOf('contrôleur réactivé (nouvelle connexion)', { email: cashier.email });
            const again = await touchShift(ownShift);
            await waitForEvent(fresh.feeds.shift, matches(again), RECEIVE_TIMEOUT_MS, 'sa caisse reçue par le contrôleur réactivé');
        } finally {
            await forceActive(cashier.userId);
            await disposeClients(...clients);
        }
    });
});

// ── Sonde pg_policies ──────────────────────────────────────────────────────

interface HardenedPolicy {
    table: string;
    policy: string;
    /** Clause TO authenticated exigée (contrat A1 : ajoutée ou déjà présente). */
    authenticatedOnly: boolean;
    /** La condition doit aussi figurer dans WITH CHECK (politique FOR ALL). */
    withCheck?: boolean;
    /**
     * Lot 7 (tâche 7.0 c, D21, migration 20261105000003) : la condition P_ACTIF est portée par cette aide RLS
     * SECURITY DEFINER, appelée par la politique ; c'est alors le corps de l'aide qui doit lire users.status.
     */
    viaHelper?: string;
}

/** Politiques du tableau A1 (dernières définitions), toutes réécrites avec P_ACTIF. */
const HARDENED: HardenedPolicy[] = [
    { table: 'ticket_scans', policy: 'ticket_scans_owner_admin_select', authenticatedOnly: true },
    { table: 'scan_incidents', policy: 'scan_incidents_owner_admin_select', authenticatedOnly: true },
    { table: 'controller_shifts', policy: 'controller_shifts_controller_select', authenticatedOnly: true },
    { table: 'controller_shifts', policy: 'controller_shifts_partner_select', authenticatedOnly: true },
    { table: 'controller_shifts', policy: 'controller_shifts_admin_select', authenticatedOnly: true },
    { table: 'event_status_history', policy: 'event_status_history_read', authenticatedOnly: true },
    { table: 'admin_signals', policy: 'admin_signals_admin_read', authenticatedOnly: true },
    { table: 'tickets', policy: 'tickets_read', authenticatedOnly: true },
    { table: 'ticket_categories', policy: 'ticket_categories_read_public', authenticatedOnly: false, viaHelper: 'ticket_category_private_read' },
    { table: 'ticket_categories', policy: 'ticket_categories_admin_manage', authenticatedOnly: false, withCheck: true, viaHelper: 'ticket_category_private_read' },
    { table: 'notifications', policy: 'notifications_read_own', authenticatedOnly: true },
    { table: 'orders', policy: 'orders_read', authenticatedOnly: true },
];

/** P_ACTIF (amendement 1) : lecture de public.users et refus de SUSPENDU et de SUPPRIME. */
function readsAccountStatus(expr: string | null): boolean {
    return !!expr && /\busers\b/.test(expr) && /SUSPENDU/.test(expr) && /SUPPRIME/.test(expr);
}

describe('6.0 a — sonde pg_policies des tables publiées', () => {
    test('chaque politique du tableau A1 lit users.status (ni SUSPENDU ni SUPPRIME) et s’adresse à authenticated', async () => {
        const tables = HARDENED.map((h) => h.table).filter((t, i, all) => all.indexOf(t) === i);
        const rows = await inspect(async (db) => (await db.query<{ tablename: string; policyname: string; cmd: string; roles: string[]; qual: string | null; with_check: string | null }>(
            `SELECT tablename, policyname, cmd, roles::text[] AS roles, qual, with_check
               FROM pg_policies
              WHERE schemaname = 'public' AND tablename = ANY($1::text[]) AND cmd IN ('SELECT', 'ALL')
              ORDER BY tablename, policyname`, [tables])).rows);
        for (const r of rows) {
            console.log(`[TEMPS-REEL-6.0a] ${r.tablename}.${r.policyname} (${r.cmd}, ${r.roles.join(',')}) USING ${r.qual ?? '∅'}${r.with_check ? ` WITH CHECK ${r.with_check}` : ''}`);
        }
        const helperNames = HARDENED.map((h) => h.viaHelper).filter((n): n is string => !!n).filter((n, i, all) => all.indexOf(n) === i);
        const helpers = await inspect(async (db) => (await db.query<{ proname: string; prosrc: string }>(
            `SELECT p.proname, p.prosrc FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
              WHERE n.nspname = 'public' AND p.proname = ANY($1::text[])`, [helperNames])).rows);
        /** USING ou WITH CHECK : lecture directe du statut, ou appel de l'aide dont le corps lit le statut. */
        const guarded = (h: HardenedPolicy, expr: string | null): boolean => {
            if (readsAccountStatus(expr)) return true;
            if (!h.viaHelper || !expr || !expr.includes(`${h.viaHelper}(`)) return false;
            const bodies = helpers.filter((p) => p.proname === h.viaHelper);
            return bodies.length === 1 && readsAccountStatus(bodies[0].prosrc);
        };
        const problems: string[] = [];
        for (const h of HARDENED) {
            const row = rows.find((r) => r.tablename === h.table && r.policyname === h.policy);
            if (!row) {
                problems.push(`${h.table}.${h.policy} : politique absente`);
                continue;
            }
            if (!guarded(h, row.qual)) problems.push(`${h.table}.${h.policy} : USING ne lit pas le statut du compte${h.viaHelper ? ` (ni par ${h.viaHelper})` : ''}`);
            if (h.withCheck && !guarded(h, row.with_check)) problems.push(`${h.table}.${h.policy} : WITH CHECK ne lit pas le statut du compte${h.viaHelper ? ` (ni par ${h.viaHelper})` : ''}`);
            if (h.authenticatedOnly && !(row.roles.length === 1 && row.roles[0] === 'authenticated')) {
                problems.push(`${h.table}.${h.policy} : rôles ${row.roles.join(',')} (TO authenticated attendu)`);
            }
        }
        assert.deepEqual(problems, [], `politiques des tables publiées sans le statut du compte :\n${problems.join('\n')}`);
    });
});

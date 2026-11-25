/**
 * Lot 11c-a — aides des suites des tables d'un événement (une table = un lot de N billets vendu par le moteur des
 * billets, paiement de cible TICKET). Base LOCALE seulement ; faux SamirPay (aucun appel réel). Les montants attendus
 * sont calculés à la main dans chaque test, jamais par ces aides.
 *
 *  - réglages du lot : event_tables_setting_set (fonction propre du lot : finance_setting_set n'est pas recopié et
 *    répondrait UNKNOWN_KEY pour features.event_tables_enabled et event_tables.max_per_account) ;
 *  - événement d'une partenaire neuve avec une catégorie de billets et une capacité donnée (brouillon puis statut voulu
 *    par les RPC du cycle de vie) ; capacité changée par event_update (propriétaire, version attendue) ;
 *  - routes du lot appelées par leur handler (NextRequest et session Bearer) : types, tables et plan, offre, devis,
 *    achat (puis webhook du faux SamirPay), « Ma table », porte, remboursement au report.
 */
import '../helpers/env';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { routeContext } from './helpers';
import { deliverWebhook, paymentById, providerSays, service, type Buyer, type PaymentRow } from './paiement-helpers';
import { jsonRequest, superadminId, type TestPartner } from './finance-helpers';
import { platformSetting } from './l10a-helpers';
import { advanceEventTo, createDraftEvent, type EventStatus } from './cycle-helpers';
import { GET as partnerTablesGet, PUT as partnerTablesPut } from '../../app/api/partner/events/[id]/tables/route';
import { POST as tableTypePost } from '../../app/api/partner/events/[id]/tables/types/route';
import { PATCH as tableTypePatch, DELETE as tableTypeDelete } from '../../app/api/partner/events/[id]/tables/types/[typeId]/route';
import { GET as offerGet } from '../../app/api/events/[id]/tables/route';
import { POST as quotePost } from '../../app/api/events/[id]/tables/quote/route';
import { POST as checkoutPost } from '../../app/api/events/[id]/tables/checkout/route';
import { GET as doorGet } from '../../app/api/events/[id]/tables/door/route';
import { GET as myTablesGet } from '../../app/api/event-tables/route';
import { GET as myTableGet } from '../../app/api/event-tables/[bookingId]/route';
import { POST as tableRefundPost } from '../../app/api/event-tables/[bookingId]/refund/route';

export type Row = Record<string, unknown>;
export interface Reply { status: number; body: Row }

const HOUR = 3600_000;

async function reply(res: Response): Promise<Reply> {
    const text = await res.text();
    let body: Row;
    try {
        body = (text ? JSON.parse(text) : {}) as Row;
    } catch {
        body = { raw: text };
    }
    return { status: res.status, body };
}

/** Réponse courte pour les messages d'assertion. */
export function show(r: Reply): string {
    return `HTTP ${r.status} ${JSON.stringify(r.body).slice(0, 600)}`;
}

// ── Réglages du lot ───────────────────────────────────────────────────────────────────────────────────────────────

export type EventTablesSettingKey = 'features.event_tables_enabled' | 'event_tables.max_per_account';

/** Réglage du lot par event_tables_setting_set (super-administrateur du seed) ; refus → échec avec la réponse. */
export async function setEventTablesSetting(key: EventTablesSettingKey, value: unknown, reason = 'test du lot 11c-a'): Promise<void> {
    const { data, error } = await service.rpc('event_tables_setting_set', { p_key: key, p_value: { value }, p_actor: await superadminId(), p_reason: reason });
    assert.equal(error, null, `event_tables_setting_set ${key} : ${error?.message}`);
    assert.equal((data as Row | null)?.ok, true, `réglage ${key} refusé : ${JSON.stringify(data)}`);
    assert.deepEqual(await platformSetting(key), value, `réglage ${key} relu`);
}

/** Ouvre (ou ferme) le service des tables d'un événement ; rend la fonction qui remet la valeur d'origine. */
export async function switchEventTablesService(open = true): Promise<() => Promise<void>> {
    const before = await platformSetting('features.event_tables_enabled');
    await setEventTablesSetting('features.event_tables_enabled', open);
    return async () => setEventTablesSetting('features.event_tables_enabled', before, 'test du lot 11c-a : valeur d’origine');
}

/** Applique un réglage du lot le temps de fn, puis remet la valeur d'origine. */
export async function withEventTablesSetting<T>(key: EventTablesSettingKey, value: unknown, fn: () => Promise<T>): Promise<T> {
    const before = await platformSetting(key);
    await setEventTablesSetting(key, value);
    try {
        return await fn();
    } finally {
        await setEventTablesSetting(key, before, 'test du lot 11c-a : valeur d’origine');
    }
}

// ── Événements ────────────────────────────────────────────────────────────────────────────────────────────────────

export interface TablesEvent {
    eventId: string;
    title: string;
    /** Catégorie de billets ordinaire (kind TICKET). */
    ticketCategoryId: string;
}

export interface TablesEventOptions {
    /** Capacité totale en places (défaut 100) ; null : sans capacité (posée après la publication par event_update). */
    capacity?: number | null;
    /** Quota de la catégorie de billets (défaut 20, 5 000 F). */
    tickets?: number;
    /** Statut atteint par les RPC du cycle de vie (défaut PUBLIE). */
    status?: EventStatus;
    /** Début dans N heures (défaut 240) ; durée 4 h. */
    startsInHours?: number;
}

/** Événement d'une partenaire avec une catégorie de billets « Entrée » et une capacité donnée, au statut voulu. */
export async function newTablesEvent(owner: TestPartner, label: string, opts: TablesEventOptions = {}): Promise<TablesEvent> {
    const tickets = opts.tickets ?? 20;
    const capacity = opts.capacity === undefined ? 100 : opts.capacity;
    const title = `TEST Tables 11c ${label} ${Date.now() % 100_000}`.slice(0, 60);
    const ev = await createDraftEvent(owner, `l11c-${label}`, [{ name: 'Entrée', price: 5_000, total: tickets }], {
        title, startsInHours: opts.startsInHours ?? 240, durationHours: 4, capacity: capacity ?? Math.max(tickets + 10, 1),
    });
    const status = opts.status ?? 'PUBLIE';
    if (status !== 'BROUILLON') await advanceEventTo(ev.eventId, status, { partnerUserId: owner.userId });
    if (capacity === null) await setCapacity(owner, ev.eventId, null);
    return { eventId: ev.eventId, title, ticketCategoryId: ev.categories['Entrée'].id };
}

/** Capacité changée par event_update (propriétaire, version attendue) ; rend la réponse brute de la base. */
export async function updateCapacity(owner: TestPartner, eventId: string, capacity: number | null): Promise<Row> {
    const { data: ev, error: evErr } = await service.from('events').select('updated_at').eq('id', eventId).single();
    assert.equal(evErr, null, `version de l'événement ${eventId} : ${evErr?.message}`);
    const { data, error } = await service.rpc('event_update', {
        p: { event_id: eventId, actor_id: owner.userId, expected_updated_at: ev!.updated_at, patch: { capacity } },
    });
    assert.equal(error, null, `event_update (capacité) : ${error?.message}`);
    return data as Row;
}

export async function setCapacity(owner: TestPartner, eventId: string, capacity: number | null): Promise<void> {
    const r = await updateCapacity(owner, eventId, capacity);
    assert.equal(r.ok, true, `capacité ${String(capacity)} refusée : ${JSON.stringify(r)}`);
}

/** Report de `hours` heures par event_update (début et fin décalés ensemble), comme lot9bis-report ; rend le nouveau début. */
export async function postpone(owner: TestPartner, eventId: string, hours: number): Promise<Date> {
    const { data: d, error: dErr } = await service.from('events').select('start_date, start_time, end_date, end_time, updated_at').eq('id', eventId).single();
    assert.equal(dErr, null, `dates de l'événement ${eventId} : ${dErr?.message}`);
    const cols = (at: Date) => ({ date: at.toISOString().slice(0, 10), time: at.toISOString().slice(11, 19) });
    const start = new Date(new Date(`${d!.start_date}T${d!.start_time}Z`).getTime() + hours * HOUR);
    const s = cols(start);
    const patch: Row = { start_date: s.date, start_time: s.time };
    if (d!.end_date && d!.end_time) {
        const e = cols(new Date(new Date(`${d!.end_date}T${d!.end_time}Z`).getTime() + hours * HOUR));
        patch.end_date = e.date;
        patch.end_time = e.time;
    }
    const { data, error } = await service.rpc('event_update', { p: { event_id: eventId, actor_id: owner.userId, expected_updated_at: d!.updated_at, patch } });
    assert.equal(error, null, `event_update (report de ${hours} h) : ${error?.message}`);
    assert.equal((data as Row | null)?.ok, true, `report de ${hours} h refusé : ${JSON.stringify(data)}`);
    return start;
}

// ── Organisatrice : types, tables et plan (routes) ───────────────────────────────────────────────────────────────

/** Type de table « Table VIP, 6 places, 150 000 F » (corps de la route). */
export function vipType(overrides: Row = {}): Row {
    return { name: `Table VIP ${randomUUID().slice(0, 6)}`, seats: 6, price: 150_000, included_text: 'Une bouteille et des softs', ...overrides };
}

export async function createTableType(owner: Buyer, eventId: string, type: Row, count: number): Promise<Reply> {
    return reply(await tableTypePost(jsonRequest(`/api/partner/events/${eventId}/tables/types`, 'POST', owner.accessToken, { type, count }), routeContext({ id: eventId })));
}

/** Type créé (201 exigé) : identifiant du type et de ses tables, par numéro croissant. */
export async function createdTableType(owner: Buyer, eventId: string, type: Row = vipType(), count = 3): Promise<{ typeId: string; tables: Array<{ id: string; number: number }>; body: Row }> {
    const r = await createTableType(owner, eventId, type, count);
    assert.equal(r.status, 201, `création du type de table : ${show(r)}`);
    const t = r.body.type as Row;
    const tables = ((r.body.tables ?? []) as Row[]).map((x) => ({ id: String(x.id), number: Number(x.number) }));
    return { typeId: String(t.id), tables, body: r.body };
}

export async function patchTableType(owner: Buyer, eventId: string, typeId: string, patch: Row): Promise<Reply> {
    // La garde de la route est typée « réponse ou undefined » : une réponse absente échoue ici
    const res = await tableTypePatch(jsonRequest(`/api/partner/events/${eventId}/tables/types/${typeId}`, 'PATCH', owner.accessToken, patch), routeContext({ id: eventId, typeId }));
    assert.ok(res, 'PATCH du type : aucune réponse');
    return reply(res);
}

export async function deleteTableType(owner: Buyer, eventId: string, typeId: string): Promise<Reply> {
    const res = await tableTypeDelete(jsonRequest(`/api/partner/events/${eventId}/tables/types/${typeId}`, 'DELETE', owner.accessToken), routeContext({ id: eventId, typeId }));
    assert.ok(res, 'DELETE du type : aucune réponse');
    return reply(res);
}

export async function tablesConfig(user: Buyer, eventId: string): Promise<Reply> {
    return reply(await partnerTablesGet(jsonRequest(`/api/partner/events/${eventId}/tables`, 'GET', user.accessToken), routeContext({ id: eventId })));
}

export async function saveTables(owner: Buyer, eventId: string, body: Row): Promise<Reply> {
    return reply(await partnerTablesPut(jsonRequest(`/api/partner/events/${eventId}/tables`, 'PUT', owner.accessToken, body), routeContext({ id: eventId })));
}

/** Toutes les tables de l'événement relues par la configuration, au format du PUT (position du plan comprise). */
export async function tablesForSave(owner: Buyer, eventId: string): Promise<Row[]> {
    const r = await tablesConfig(owner, eventId);
    assert.equal(r.status, 200, `configuration des tables : ${show(r)}`);
    return ((r.body.tables ?? []) as Row[]).map((t) => ({
        id: String(t.id), type_id: String(t.type_id), number: Number(t.number), zone_id: (t.zone_id as string | null) ?? null,
        x: t.x === null || t.x === undefined ? null : Number(t.x), y: t.y === null || t.y === undefined ? null : Number(t.y),
    }));
}

/** Plan montré aux clients : chaque table placée sur une grille (10 %, 10 % + 10 × rang). */
export async function showPlan(owner: Buyer, eventId: string): Promise<void> {
    const tables = (await tablesForSave(owner, eventId)).map((t, i) => ({ ...t, x: 10 + (i % 8) * 10, y: 10 + Math.floor(i / 8) * 10 }));
    const r = await saveTables(owner, eventId, { plan_enabled: true, tables, zones: [] });
    assert.equal(r.status, 200, `plan montré : ${show(r)}`);
    assert.equal(r.body.plan_enabled, true, show(r));
}

// ── Client : offre, devis, achat ───────────────────────────────────────────────────────────────────────────────────

export async function tableOffer(eventId: string): Promise<Reply> {
    return reply(await offerGet(jsonRequest(`/api/events/${eventId}/tables`, 'GET', null), routeContext({ id: eventId })));
}

export async function tableQuote(eventId: string, body: Row): Promise<Reply> {
    return reply(await quotePost(jsonRequest(`/api/events/${eventId}/tables/quote`, 'POST', null, body), routeContext({ id: eventId })));
}

export interface TableCheckout extends Reply { payment: PaymentRow | null }

/** Achat par la route (session du client, en-tête Idempotency-Key neuf) ; le paiement créé est relu en base. */
export async function tableCheckout(buyer: Buyer, eventId: string, typeId: string, opts: { tableId?: string | null; key?: string; extra?: Row } = {}): Promise<TableCheckout> {
    const body: Row = { typeId, operator: 'WAVE', payerPhone: buyer.phone9, ...(opts.tableId ? { tableId: opts.tableId } : {}), ...(opts.extra ?? {}) };
    const res = await reply(await checkoutPost(
        jsonRequest(`/api/events/${eventId}/tables/checkout`, 'POST', buyer.accessToken, body, { 'idempotency-key': opts.key ?? randomUUID() }),
        routeContext({ id: eventId }),
    ));
    const payment = typeof res.body.payment_id === 'string' ? await paymentById(res.body.payment_id) : null;
    return { ...res, payment };
}

/** Le faux SamirPay dit SUCCESS et le webhook arrive : rend le paiement relu. */
export async function confirmByWebhook(payment: PaymentRow): Promise<PaymentRow> {
    providerSays(payment, 'SUCCESS');
    const hook = await deliverWebhook(payment);
    assert.equal(hook.status, 200, `webhook : HTTP ${hook.status}`);
    return paymentById(payment.id);
}

export interface BoughtTable {
    payment: PaymentRow;
    booking: Row;
    tickets: Row[];
}

/** Achat d'une table par la route puis paiement confirmé par le webhook : la vente et ses billets. */
export async function buyTable(buyer: Buyer, eventId: string, typeId: string, tableId?: string | null): Promise<BoughtTable> {
    const started = await tableCheckout(buyer, eventId, typeId, { tableId });
    assert.equal(started.status, 200, `achat de la table : ${show(started)}`);
    assert.ok(started.payment, 'paiement créé');
    const payment = await confirmByWebhook(started.payment!);
    assert.equal(payment.status, 'SUCCESS', `paiement de la table confirmé (${payment.status}) : ${JSON.stringify(payment.metadata)}`);
    const booking = await bookingOfPayment(payment.id);
    assert.ok(booking, `vente de la table pour le paiement ${payment.id}`);
    return { payment, booking: booking!, tickets: await ticketsOfBooking(String(booking!.id)) };
}

// ── Lectures en base ──────────────────────────────────────────────────────────────────────────────────────────────

export async function bookingOfPayment(paymentId: string): Promise<Row | null> {
    const { data, error } = await service.from('event_table_bookings').select('*').eq('payment_id', paymentId).maybeSingle();
    assert.equal(error, null, `vente du paiement ${paymentId} : ${error?.message}`);
    return (data as Row | null) ?? null;
}

export async function bookingById(id: string): Promise<Row> {
    const { data, error } = await service.from('event_table_bookings').select('*').eq('id', id).single();
    assert.equal(error, null, `vente ${id} : ${error?.message}`);
    return data as Row;
}

export async function bookingsOfTable(tableId: string): Promise<Row[]> {
    const { data, error } = await service.from('event_table_bookings').select('*').eq('event_table_id', tableId).order('created_at');
    assert.equal(error, null, `ventes de la table ${tableId} : ${error?.message}`);
    return (data ?? []) as Row[];
}

export async function ticketsOfBooking(bookingId: string): Promise<Row[]> {
    const { data, error } = await service.from('tickets').select('*').eq('event_table_booking_id', bookingId).order('ticket_number');
    assert.equal(error, null, `billets de la vente ${bookingId} : ${error?.message}`);
    return (data ?? []) as Row[];
}

export async function ticketById(id: string): Promise<Row> {
    const { data, error } = await service.from('tickets').select('*').eq('id', id).single();
    assert.equal(error, null, `billet ${id} : ${error?.message}`);
    return data as Row;
}

export async function categoryRow(id: string): Promise<Row> {
    const { data, error } = await service.from('ticket_categories').select('*').eq('id', id).single();
    assert.equal(error, null, `catégorie ${id} : ${error?.message}`);
    return data as Row;
}

export async function tableCategoriesOf(eventId: string): Promise<Row[]> {
    const { data, error } = await service.from('ticket_categories').select('*').eq('event_id', eventId).eq('kind', 'TABLE');
    assert.equal(error, null, `types de tables de ${eventId} : ${error?.message}`);
    return (data ?? []) as Row[];
}

export async function reservationsOfPayment(paymentId: string): Promise<Row[]> {
    const { data, error } = await service.from('stock_reservations').select('*').eq('payment_id', paymentId);
    assert.equal(error, null, `attentes du paiement ${paymentId} : ${error?.message}`);
    return (data ?? []) as Row[];
}

/** Remboursements PLATEFORME d'un paiement. */
export async function platformRefunds(paymentId: string): Promise<Row[]> {
    const { data, error } = await service.from('refunds').select('*').eq('payment_id', paymentId).eq('settlement', 'PLATEFORME').order('created_at');
    assert.equal(error, null, `remboursements du paiement ${paymentId} : ${error?.message}`);
    return (data ?? []) as Row[];
}

export async function outbox(filter: { type: string; eventId?: string; userId?: string }): Promise<Row[]> {
    let q = service.from('notification_outbox').select('*').eq('type', filter.type);
    if (filter.eventId) q = q.eq('event_id', filter.eventId);
    if (filter.userId) q = q.eq('recipient_user_id', filter.userId);
    const { data, error } = await q.order('created_at');
    assert.equal(error, null, `boîte d'envoi ${filter.type} : ${error?.message}`);
    return (data ?? []) as Row[];
}

// ── « Ma table », porte, remboursement au report ──────────────────────────────────────────────────────────────────

export async function myTables(user: Buyer): Promise<Reply> {
    return reply(await myTablesGet(jsonRequest('/api/event-tables', 'GET', user.accessToken)));
}

export async function myTable(user: Buyer, bookingId: string): Promise<Reply> {
    return reply(await myTableGet(jsonRequest(`/api/event-tables/${bookingId}`, 'GET', user.accessToken), routeContext({ bookingId })));
}

export async function doorList(user: Buyer, eventId: string): Promise<Reply> {
    return reply(await doorGet(jsonRequest(`/api/events/${eventId}/tables/door`, 'GET', user.accessToken), routeContext({ id: eventId })));
}

export async function tableRefund(user: Buyer, bookingId: string, body: Row = { confirm: true }): Promise<Reply> {
    return reply(await tableRefundPost(jsonRequest(`/api/event-tables/${bookingId}/refund`, 'POST', user.accessToken, body), routeContext({ bookingId })));
}

/** Transfert d'une place en attente (ticket_transfer_initiate, 48 h) ; rend l'identifiant du transfert. */
export async function transferSeat(ticketId: string, from: Buyer, toPhone: string): Promise<string> {
    const { data, error } = await service.rpc('ticket_transfer_initiate', {
        p: { ticket_id: ticketId, actor_id: from.userId, recipient: toPhone, expires_at: new Date(Date.now() + 48 * HOUR).toISOString() },
    });
    assert.equal(error, null, `ticket_transfer_initiate : ${error?.message}`);
    assert.equal((data as Row | null)?.ok, true, `transfert d'une place refusé : ${JSON.stringify(data)}`);
    return String((data as Row).transfer_id);
}

export async function transferStatus(id: string): Promise<string> {
    const { data, error } = await service.from('ticket_transfers').select('status').eq('id', id).single();
    assert.equal(error, null, `transfert ${id} : ${error?.message}`);
    return String(data!.status);
}

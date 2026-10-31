/**
 * Lot 4 — outils des suites du contrôle d'accès : réglages access.*, événement à horaire précis
 * (fenêtre de scan), contrôleur affecté, billets payés en ligne ou « à régler sur place », appels
 * des routes de scan, de caisse et de code dynamique. Les modules réécrits au lot 4 (code dynamique,
 * routes nouvelles) sont importés dynamiquement : le typecheck de la CI passe avant les tests.
 */
import '../helpers/env';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { NextRequest } from 'next/server';
import { BASE_URL, routeContext } from './helpers';
import { service, newBuyer, importModule, type Buyer, type CategorySpec, type SaleEvent } from './paiement-helpers';
import { superadminId, type TestPartner } from './finance-helpers';

export type AccessSettingKey =
    | 'access.manual_entry_scope'
    | 'access.scan_window_before_hours'
    | 'access.scan_window_after_hours'
    | 'access.counter_sale_enabled';

// ── Réglages access.* (même RPC que le lot 3) ──────────────────────────────

export async function getAccessSetting(key: AccessSettingKey): Promise<unknown> {
    const { data, error } = await service.from('platform_settings').select('value').eq('key', key).maybeSingle();
    assert.equal(error, null, `lecture du réglage ${key} : ${error?.message}`);
    assert.ok(data, `réglage ${key} absent de platform_settings`);
    return (data.value as { value?: unknown }).value;
}

export async function setAccessSetting(key: AccessSettingKey, value: unknown, reason = 'test du lot 4'): Promise<void> {
    const { data, error } = await service.rpc('finance_setting_set', { p_key: key, p_value: { value }, p_actor: await superadminId(), p_reason: reason });
    assert.equal(error, null, `réglage ${key} : ${error?.message}`);
    assert.equal((data as { ok?: boolean } | null)?.ok, true, `réglage ${key} refusé : ${JSON.stringify(data)}`);
}

export async function withAccessSettings<T>(overrides: Partial<Record<AccessSettingKey, unknown>>, fn: () => Promise<T>): Promise<T> {
    const keys = Object.keys(overrides) as AccessSettingKey[];
    const saved = new Map<AccessSettingKey, unknown>();
    for (const k of keys) saved.set(k, await getAccessSetting(k));
    for (const k of keys) await setAccessSetting(k, overrides[k]);
    try {
        return await fn();
    } finally {
        for (const k of keys) await setAccessSetting(k, saved.get(k), 'restauration après un test du lot 4');
    }
}

// ── Événement à horaire précis (fuseau Africa/Dakar = UTC+0) ───────────────

function dakar(d: Date): { date: string; time: string } {
    const iso = d.toISOString();
    return { date: iso.slice(0, 10), time: iso.slice(11, 19) };
}

/** Événement du partenaire, début dans `startsInHours` heures (négatif : déjà commencé), durée `durationHours`. */
export async function createTimedEvent(partnerId: string, label: string, categories: CategorySpec[], opts: { startsInHours?: number; durationHours?: number; status?: string } = {}): Promise<SaleEvent> {
    const start = new Date(Date.now() + (opts.startsInHours ?? 1) * 3600_000);
    const end = new Date(start.getTime() + (opts.durationHours ?? 4) * 3600_000);
    const s = dakar(start);
    const e = dakar(end);
    const { data: event, error } = await service.from('events').insert({
        partner_id: partnerId,
        title: `TEST Accès ${label} ${Date.now()}`,
        description: 'Événement dédié aux tests du contrôle d’accès (lot 4).',
        start_date: s.date, start_time: s.time, end_date: e.date, end_time: e.time,
        location: 'Salle de test, Dakar', city: 'Dakar',
        capacity: categories.reduce((sum, c) => sum + c.total, 0) + 10,
        status: opts.status ?? 'PUBLIE',
    }).select('id').single();
    assert.equal(error, null, `événement ${label} : ${error?.message}`);
    const out: SaleEvent = { eventId: event.id, categories: {} };
    for (const c of categories) {
        const inserted: { data: { id: string } | null; error: { message: string } | null } = await service.from('ticket_categories').insert({
            event_id: event.id, name: c.name, price: c.price, total_quantity: c.total, sold_quantity: 0,
            is_active: c.isActive ?? true, is_visible: c.isVisible ?? true, max_per_order: c.maxPerOrder ?? 10,
        }).select('id').single();
        assert.equal(inserted.error, null, `catégorie ${c.name} : ${inserted.error?.message}`);
        out.categories[c.name] = { id: inserted.data!.id, price: c.price, total: c.total };
    }
    return out;
}

// ── Contrôleur affecté ─────────────────────────────────────────────────────

export async function newController(partner: TestPartner, eventId: string | null, opts: { canAcceptCash?: boolean; label?: string } = {}): Promise<Buyer> {
    const user = await newBuyer(`ctrl-${opts.label ?? 'x'}`, { firstName: 'Ibrahima', lastName: 'Controleur' });
    const { error: roleErr } = await service.from('user_roles').upsert([{ user_id: user.userId, role: 'CONTROLEUR' }], { onConflict: 'user_id,role' });
    assert.equal(roleErr, null, `rôle CONTROLEUR : ${roleErr?.message}`);
    if (eventId) await assignController(partner, user.userId, eventId, opts.canAcceptCash ?? false);
    return user;
}

export async function assignController(partner: TestPartner, controllerId: string, eventId: string, canAcceptCash: boolean): Promise<void> {
    const { error } = await service.from('event_controllers').upsert(
        { event_id: eventId, user_id: controllerId, can_accept_cash: canAcceptCash, created_by: partner.userId },
        { onConflict: 'event_id,user_id' });
    assert.equal(error, null, `affectation du contrôleur : ${error?.message}`);
}

// ── Billets ────────────────────────────────────────────────────────────────

export async function ticketRow(id: string): Promise<Record<string, unknown>> {
    const { data, error } = await service.from('tickets').select('*').eq('id', id).single();
    assert.equal(error, null, `billet ${id} : ${error?.message}`);
    return data as Record<string, unknown>;
}

export interface CashOrder { orderId: string; ticketIds: string[] }

/** Commande impayée « à régler sur place » et ses billets (comme un paiement à l'entrée). */
export async function createCashOrderTickets(buyer: Buyer, partner: TestPartner, ev: SaleEvent, category: string, count: number): Promise<CashOrder> {
    const cat = ev.categories[category];
    const total = cat.price * count;
    const { data: order, error } = await service.from('orders').insert({
        order_number: `CMD-ACCES-${Date.now()}-${randomUUID().slice(0, 6)}`,
        client_id: buyer.userId, partner_id: partner.partnerId,
        subtotal: total, total_amount: total, paid_amount: 0, balance_amount: total,
        payment_type: 'DIFFERE', delivery_mode: 'SUR_PLACE', order_status: 'CONFIRMEE', payment_status: 'PENDING',
    }).select('id').single();
    assert.equal(error, null, `commande à régler sur place : ${error?.message}`);
    const rows = Array.from({ length: count }, () => ({
        event_id: ev.eventId, category_id: cat.id, user_id: buyer.userId, order_id: order.id,
        ticket_number: `TCK-ACCES-${randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase()}`,
        qr_code: `EV-QR-${randomUUID().replace(/-/g, '')}`, price: cat.price, status: 'VALIDE',
    }));
    const { data: tickets, error: tErr } = await service.from('tickets').insert(rows).select('id');
    assert.equal(tErr, null, `billets à régler sur place : ${tErr?.message}`);
    const { data: c, error: cErr } = await service.from('ticket_categories').select('sold_quantity').eq('id', cat.id).single();
    assert.equal(cErr, null);
    const { error: uErr } = await service.from('ticket_categories').update({ sold_quantity: Number(c.sold_quantity) + count }).eq('id', cat.id);
    assert.equal(uErr, null, `stock : ${uErr?.message}`);
    return { orderId: order.id, ticketIds: (tickets ?? []).map((t) => t.id as string) };
}

// ── Code dynamique (module réécrit au lot 4) ───────────────────────────────

export async function ticketPayload(ticketId: string, at: Date = new Date()): Promise<string> {
    const totp = await importModule('../../lib/security/totp');
    const t = await ticketRow(ticketId);
    return totp.buildTicketPayload(ticketId, totp.generateTicketCode(ticketId, String(t.totp_secret), at));
}

// ── Routes ─────────────────────────────────────────────────────────────────

export function authed(path: string, method: string, user: Buyer, body?: unknown, headers: Record<string, string> = {}): NextRequest {
    return new NextRequest(`${BASE_URL}${path}`, {
        method,
        headers: { 'content-type': 'application/json', authorization: `Bearer ${user.accessToken}`, ...headers },
        body: body === undefined ? undefined : JSON.stringify(body),
    });
}

export interface RouteResult { status: number; body: Record<string, unknown> }

async function call(handler: (req: NextRequest, ctx?: unknown) => Promise<Response>, req: NextRequest, ctx?: unknown): Promise<RouteResult> {
    const res = await handler(req, ctx);
    const text = await res.text();
    let body: Record<string, unknown> = {};
    try {
        body = text ? JSON.parse(text) : {};
    } catch {
        body = { raw: text };
    }
    return { status: res.status, body };
}

export async function scan(user: Buyer, body: Record<string, unknown>): Promise<RouteResult> {
    const { POST } = await importModule('../../app/api/controller/scan/route');
    return call(POST, authed('/api/controller/scan', 'POST', user, body));
}

export async function cashCheckin(user: Buyer, body: Record<string, unknown>): Promise<RouteResult> {
    const { PUT } = await importModule('../../app/api/controller/scan/route');
    return call(PUT, authed('/api/controller/scan', 'PUT', user, body));
}

export async function openShift(user: Buyer, eventId: string, openingFloat = 0): Promise<RouteResult> {
    const { POST } = await importModule('../../app/api/controller/shifts/open/route');
    return call(POST, authed('/api/controller/shifts/open', 'POST', user, { eventId, event_id: eventId, openingFloat, opening_float_amount: openingFloat }));
}

export async function liveCode(user: Buyer, ticketId: string): Promise<RouteResult> {
    const { GET } = await importModule('../../app/api/tickets/[id]/live-code/route');
    return call(GET, authed(`/api/tickets/${ticketId}/live-code`, 'GET', user), routeContext({ id: ticketId }));
}

export async function scansOf(ticketId: string): Promise<Array<Record<string, unknown>>> {
    const { data, error } = await service.from('ticket_scans').select('*').eq('ticket_id', ticketId).order('created_at');
    assert.equal(error, null, `ticket_scans : ${error?.message}`);
    return (data ?? []) as Array<Record<string, unknown>>;
}

export async function shiftRow(id: string): Promise<Record<string, unknown>> {
    const { data, error } = await service.from('controller_shifts').select('*').eq('id', id).single();
    assert.equal(error, null, `caisse ${id} : ${error?.message}`);
    return data as Record<string, unknown>;
}

/**
 * Lot 4 — outils des suites du contrôle d'accès : réglages access.*, événement à horaire précis
 * (fenêtre de scan), contrôleur affecté, billets payés en ligne ou « à régler sur place », appels
 * des routes de scan, de caisse et de code dynamique. Les modules réécrits au lot 4 (code dynamique,
 * routes nouvelles) sont importés dynamiquement : le typecheck de la CI passe avant les tests.
 * Lot 7 (T0b, D39) : scan() envoie l'en-tête Idempotency-Key, une clé aléatoire neuve par appel (chaque
 * appel reste une lecture distincte, comme avant), sauf clé fournie (rejeu) ou `null` (en-tête absent).
 * Lot 9 bis (R42, A11, T47) : openShift passe un PIN régisseur, posé par l'aide le temps de l'ouverture (PIN de la suite
 * remis ensuite) ; `pin: null` ouvre sans PIN (refus PIN_REQUIRED). respondControllerInvitations (R37, T49) : réponse du
 * titulaire à ses invitations de contrôleur par les routes /api/account/controller-invitations.
 */
import '../helpers/env';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { NextRequest } from 'next/server';
import { BASE_URL, routeContext, STRONG_PASSWORD } from './helpers';
import {
    service, newBuyer, importModule, advanceHelperEvent, helperInsertionDates, helperPosterUrl,
    type Buyer, type CategorySpec, type HelperEventDates, type SaleEvent,
} from './paiement-helpers';
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

/**
 * Événement du partenaire, début dans `startsInHours` heures (négatif : déjà commencé), durée `durationHours`.
 * Lot 5 : inséré en BROUILLON puis avancé jusqu'à `status` par les RPC de transition (advanceHelperEvent) ;
 * TERMINE exige un début passé (fin manuelle par l'admin, contrat D4).
 */
export async function createTimedEvent(partnerId: string, label: string, categories: CategorySpec[], opts: { startsInHours?: number; durationHours?: number; status?: string } = {}): Promise<SaleEvent> {
    const start = new Date(Date.now() + (opts.startsInHours ?? 1) * 3600_000);
    const end = new Date(start.getTime() + (opts.durationHours ?? 4) * 3600_000);
    const s = dakar(start);
    const e = dakar(end);
    const status = opts.status ?? 'PUBLIE';
    const dates: HelperEventDates = { start_date: s.date, start_time: s.time, end_date: e.date, end_time: e.time };
    const insertDates = helperInsertionDates(status, dates);
    const { data: event, error } = await service.from('events').insert({
        partner_id: partnerId,
        title: `TEST Accès ${label} ${Date.now()}`,
        description: 'Événement dédié aux tests du contrôle d’accès (lot 4).',
        ...insertDates,
        location: 'Salle de test, Dakar', city: 'Dakar',
        capacity: categories.reduce((sum, c) => sum + c.total, 0) + 10,
        image_url: await helperPosterUrl(partnerId),
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
    await advanceHelperEvent(event.id, status, dates, insertDates);
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

/** Commande impayée et ses billets : billet payant sans paiement rattaché (fixture du filet payment_required, lot 9 A16 ; nom conservé, L48). */
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

/** Clé d'idempotence d'un scan (contrat 3.3 : ^[A-Za-z0-9_-]{8,100}$) : UUID aléatoire. */
export function newScanKey(): string {
    return randomUUID();
}

export interface ScanOptions {
    /** Clé envoyée dans Idempotency-Key ; absente : clé aléatoire neuve ; `null` : aucun en-tête (refus attendu, D39). */
    idempotencyKey?: string | null;
}

export async function scan(user: Buyer, body: Record<string, unknown>, opts: ScanOptions = {}): Promise<RouteResult> {
    const { POST } = await importModule('../../app/api/controller/scan/route');
    const key = opts.idempotencyKey === undefined ? newScanKey() : opts.idempotencyKey;
    const headers: Record<string, string> = key === null ? {} : { 'idempotency-key': key };
    return call(POST, authed('/api/controller/scan', 'POST', user, body, headers));
}

/** PIN régisseur connu de l'aide pour l'événement (A11) : posé par elle, jamais lu en base (seul le haché y est). */
const HELPER_PIN = '246813';

/**
 * Lot 9 bis (R42, A11, T47) : PIN régisseur de l'événement le temps d'une ouverture de caisse. Sans PIN en base,
 * l'aide pose le sien (haché du contrat, `hashRegisseurPin`) puis le retire après l'ouverture ; avec un PIN posé
 * par la suite (route regisseur-pin, valeur inconnue de l'aide), elle pose le sien le temps de l'ouverture puis
 * remet la ligne d'origine telle quelle (haché, sel, dates) : la suite garde son PIN pour clôturer.
 */
async function withHelperPin<T>(eventId: string, fn: (pin: string) => Promise<T>): Promise<T> {
    const shifts = await importModule('../../lib/shifts/shift.service');
    assert.equal(typeof shifts.hashRegisseurPin, 'function', 'lib/shifts/shift.service : hashRegisseurPin exporté');
    const { data: original, error } = await service.from('event_regisseur_pins').select('*').eq('event_id', eventId).maybeSingle();
    assert.equal(error, null, `PIN régisseur de l'événement ${eventId} : ${error?.message}`);
    const salt = randomUUID().replace(/-/g, '');
    const { error: setErr } = await service.from('event_regisseur_pins').upsert(
        { event_id: eventId, pin_hash: shifts.hashRegisseurPin(eventId, salt, HELPER_PIN), pin_salt: salt, updated_at: new Date().toISOString() },
        { onConflict: 'event_id' });
    assert.equal(setErr, null, `PIN régisseur de l'aide : ${setErr?.message}`);
    try {
        return await fn(HELPER_PIN);
    } finally {
        const restore = original
            ? await service.from('event_regisseur_pins').upsert(original, { onConflict: 'event_id' })
            : await service.from('event_regisseur_pins').delete().eq('event_id', eventId);
        assert.equal(restore.error, null, `PIN régisseur d'origine remis : ${restore.error?.message}`);
    }
}

/**
 * Ouverture de caisse par la route du contrat. Lot 9 bis (R42, A11, T47) : PIN régisseur obligatoire. Sans `pin`,
 * l'aide pose un PIN connu pour l'événement et le passe (comme le régisseur le donne au caissier) ; `pin: null`
 * ouvre sans PIN (cas du refus PIN_REQUIRED) ; une chaîne est passée telle quelle.
 */
export async function openShift(user: Buyer, eventId: string, openingFloat = 0, pin?: string | null): Promise<RouteResult> {
    const { POST } = await importModule('../../app/api/controller/shifts/open/route');
    const send = (p: string | null): Promise<RouteResult> => {
        const body: Record<string, unknown> = { eventId, event_id: eventId, openingFloat, opening_float_amount: openingFloat };
        if (p !== null) {
            body.regisseurPin = p;
            body.regisseur_pin = p;
        }
        return call(POST, authed('/api/controller/shifts/open', 'POST', user, body));
    };
    if (pin === undefined) return withHelperPin(eventId, (p) => send(p));
    return send(pin);
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

// ── Invitations de contrôleur (lot 9 bis, R37, contrat 4.3) ───────────────

// Import dynamique : les routes n'existent pas avant le correctif fix(9b.26).
const INVITATIONS_LIST_ROUTE = '../../app/api/account/controller-invitations/route';
const INVITATION_RESPOND_ROUTE = '../../app/api/account/controller-invitations/[id]/route';

async function routeOf(modPath: string, method: string, what: string): Promise<(req: NextRequest, ctx?: unknown) => Promise<Response>> {
    let mod: Record<string, unknown>;
    try {
        mod = (await importModule(modPath)) as Record<string, unknown>;
    } catch (err) {
        throw new Error(`${what} absente (R37, fix(9b.26)) : ${err instanceof Error ? err.message : String(err)}`);
    }
    assert.equal(typeof mod[method], 'function', `${what} : ${method} exporté par ${modPath}`);
    return mod[method] as (req: NextRequest, ctx?: unknown) => Promise<Response>;
}

/** GET /api/account/controller-invitations du compte connecté : `{ items: [{ id, company, events, expires_at }] }`. */
export async function myControllerInvitations(user: Pick<Buyer, 'accessToken'>): Promise<RouteResult> {
    const GET = await routeOf(INVITATIONS_LIST_ROUTE, 'GET', 'GET /api/account/controller-invitations');
    return call(GET, authed('/api/account/controller-invitations', 'GET', user as Buyer));
}

/** POST /api/account/controller-invitations/[id] `{ accept }` par le compte connecté. */
export async function respondControllerInvitation(user: Pick<Buyer, 'accessToken'>, invitationId: string, accept: boolean): Promise<RouteResult> {
    const POST = await routeOf(INVITATION_RESPOND_ROUTE, 'POST', 'POST /api/account/controller-invitations/[id]');
    return call(POST, authed(`/api/account/controller-invitations/${invitationId}`, 'POST', user as Buyer, { accept }), routeContext({ id: invitationId }));
}

/**
 * Session neuve du compte, ouverte par son mot de passe (clé anon) : une promotion ou un retrait de contrôleur révoque
 * les sessions existantes, le jeton d'origine ne sert plus.
 */
export async function freshSession(user: Pick<Buyer, 'email'>): Promise<Pick<Buyer, 'accessToken'>> {
    const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data, error } = await anon.auth.signInWithPassword({ email: user.email, password: STRONG_PASSWORD });
    assert.equal(error, null, `connexion de ${user.email} : ${error?.message}`);
    assert.ok(data.session, `session de ${user.email}`);
    return { accessToken: data.session.access_token };
}

/**
 * Le titulaire répond à toutes ses invitations de contrôleur en attente (liste puis réponse, 200 exigés) ; rend les
 * identifiants traités. Échec explicite si aucune invitation n'attend.
 */
export async function respondControllerInvitations(user: Pick<Buyer, 'accessToken'>, accept: boolean): Promise<string[]> {
    const list = await myControllerInvitations(user);
    assert.equal(list.status, 200, `invitations de contrôleur du titulaire : HTTP ${list.status} ${JSON.stringify(list.body)}`);
    const items = Array.isArray(list.body.items) ? (list.body.items as Array<Record<string, unknown>>) : [];
    assert.ok(items.length > 0, `au moins une invitation de contrôleur en attente : ${JSON.stringify(list.body)}`);
    const ids: string[] = [];
    for (const item of items) {
        const id = String(item.id);
        const res = await respondControllerInvitation(user, id, accept);
        assert.equal(res.status, 200, `réponse ${accept ? 'acceptée' : 'refusée'} à l'invitation ${id} : HTTP ${res.status} ${JSON.stringify(res.body)}`);
        ids.push(id);
    }
    return ids;
}

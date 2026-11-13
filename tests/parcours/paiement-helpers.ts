/**
 * Lot 2 — outils communs des suites de paiement (chaîne paiement → billet).
 *
 * Écrits pour fonctionner AVANT et APRÈS les correctifs : les suites rouges échouent sur les
 * défauts (billet sans paiement confirmé, survente, débit sans contrôle…), pas sur la plomberie.
 *  - Le faux SamirPay est piloté par des accès souples (nouvelle API alignée sur le contrat,
 *    ancienne API en repli).
 *  - Les nouvelles routes (annulation, crons) sont importées dynamiquement : elles n'existent pas
 *    avant le correctif, et le typecheck de la CI passe avant les tests.
 *  - Les billets sont comptés par événement : chaque suite crée ses propres événements.
 */
import '../helpers/env';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { NextRequest } from 'next/server';
import { getServiceRoleClient } from '../../lib/supabase/server';
import { loadFixtures } from '../helpers/fixtures';
import { getFakes } from '../fakes';
import { BASE_URL, randomEmail, randomSenegalPhone, routeContext, STRONG_PASSWORD } from './helpers';
import { POST as checkoutRoute } from '../../app/api/checkout/route';
import { POST as webhookRoute } from '../../app/api/webhooks/samirpay/route';
import { GET as statusRoute } from '../../app/api/payments/[transactionId]/status/route';

export const service = getServiceRoleClient();

/** Import dynamique d'un module qui peut ne pas exister avant le correctif. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function importModule(relPath: string): Promise<any> {
    const target = relPath;
    return import(target);
}

// ── Acheteurs ──────────────────────────────────────────────────────────────

export interface Buyer {
    userId: string;
    accessToken: string;
    email: string;
    phoneE164: string;
    /** Format SamirPay : 9 chiffres sans indicatif. */
    phone9: string;
    firstName: string;
    lastName: string;
}

export async function newBuyer(label: string, opts: { firstName?: string; lastName?: string } = {}): Promise<Buyer> {
    const email = randomEmail(`pay-${label}`);
    const phoneE164 = randomSenegalPhone('77');
    const firstName = opts.firstName ?? 'Awa';
    const lastName = opts.lastName ?? `Acheteuse${label.replace(/[^a-z]/gi, '').slice(0, 10)}`;
    const { data, error } = await service.auth.admin.createUser({
        email, phone: phoneE164, password: STRONG_PASSWORD, email_confirm: true, phone_confirm: true,
        user_metadata: { first_name: firstName, last_name: lastName },
    });
    assert.equal(error, null, `création de l'acheteur : ${error?.message}`);
    const userId = data.user!.id;
    const { error: upErr } = await service.from('users')
        // Lot 9 quater (A2) : numéro prouvé, comme après l'inscription par code (achat, billet gratuit, transfert, retrait)
        .update({ phone: phoneE164, first_name: firstName, last_name: lastName, status: 'ACTIF', phone_verified_at: new Date().toISOString() })
        .eq('id', userId);
    assert.equal(upErr, null, `profil de l'acheteur : ${upErr?.message}`);
    const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: s, error: signErr } = await anon.auth.signInWithPassword({ email, password: STRONG_PASSWORD });
    assert.equal(signErr, null, `connexion de l'acheteur : ${signErr?.message}`);
    return { userId, accessToken: s.session!.access_token, email, phoneE164, phone9: phoneE164.slice(4), firstName, lastName };
}

// ── Événements de vente ────────────────────────────────────────────────────

export interface CategorySpec {
    name: string;
    price: number;
    total: number;
    maxPerOrder?: number;
    isVisible?: boolean;
    isActive?: boolean;
    saleStart?: string | null;
    saleEnd?: string | null;
}

export interface SaleEvent {
    eventId: string;
    categories: Record<string, { id: string; price: number; total: number }>;
}

// ── Lot 5 : statut atteint par les RPC de transition (contrat D2 et S) ─────
// Tout INSERT dans events est forcé à BROUILLON : les helpers insèrent le brouillon (avec une affiche du
// bucket du projet, exigée à la soumission), ses catégories, puis l'avancent par advanceEventTo
// (tests/parcours/cycle-helpers.ts, importé dynamiquement : cycle-helpers importe ce module). Un événement
// « dans le passé » est créé dans le futur, publié, puis ses dates sont déplacées (la garde ne porte que
// sur le statut) ; TERMINE : dates demandées remises avant la fin manuelle par l'admin (début passé exigé).

export interface HelperEventDates {
    start_date: string;
    start_time: string;
    end_date: string | null;
    end_time: string | null;
}

const THROUGH_SUBMISSION = new Set(['EN_ATTENTE', 'VALIDE', 'PUBLIE', 'SUSPENDU', 'TERMINE', 'ANNULE']);

function helperStartMs(d: HelperEventDates): number {
    // Lot 9 bis (R94, contrat 5.25) : la soumission refuse un début passé (plus seulement une fin passée).
    const time = d.start_time.length === 5 ? `${d.start_time}:00` : d.start_time;
    return Date.parse(`${d.start_date}T${time}Z`);
}

function addDays(date: string, days: number): string {
    const d = new Date(`${date}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
}

/** Dates d'insertion : celles demandées, sauf début passé d'un événement qui doit être soumis (J+30, même durée). */
export function helperInsertionDates(status: string, dates: HelperEventDates): HelperEventDates {
    if (!THROUGH_SUBMISSION.has(status) || helperStartMs(dates) > Date.now() + 60_000) return dates;
    const start = addDays(new Date().toISOString().slice(0, 10), 30);
    const span = dates.end_date ? Math.round((Date.parse(`${dates.end_date}T00:00:00Z`) - Date.parse(`${dates.start_date}T00:00:00Z`)) / 86_400_000) : 0;
    return { ...dates, start_date: start, end_date: dates.end_date ? addDays(start, span) : null };
}

async function setHelperEventDates(eventId: string, dates: HelperEventDates): Promise<void> {
    const { data, error } = await service.from('events').update(dates).eq('id', eventId).select('id');
    assert.equal(error, null, `dates de l'événement ${eventId} : ${error?.message}`);
    assert.equal((data ?? []).length, 1, `dates de l'événement ${eventId} : événement introuvable`);
}

/** Affiche factice acceptée par la soumission (préfixe public-images du projet, contrat F1). */
export async function helperPosterUrl(partnerId: string): Promise<string> {
    return (await import('./cycle-helpers')).posterUrl(partnerId);
}

/**
 * Avance un brouillon (catégories déjà créées) jusqu'à `status` par les RPC event_transition et
 * event_cancel, puis remet les dates demandées si l'insertion les avait déplacées.
 */
export async function advanceHelperEvent(eventId: string, status: string, dates: HelperEventDates, inserted: HelperEventDates): Promise<void> {
    const cycle = await import('./cycle-helpers');
    assert.ok((cycle.EVENT_STATUSES as readonly string[]).includes(status), `statut d'événement inconnu : ${status}`);
    const target = status as import('./cycle-helpers').EventStatus;
    const moved = JSON.stringify(dates) !== JSON.stringify(inserted);
    if (target === 'TERMINE') {
        await cycle.advanceEventTo(eventId, 'PUBLIE');
        if (moved) await setHelperEventDates(eventId, dates);
        await cycle.advanceEventTo(eventId, 'TERMINE');
        return;
    }
    if (target !== 'BROUILLON') await cycle.advanceEventTo(eventId, target);
    if (moved) await setHelperEventDates(eventId, dates);
}

export async function createSaleEvent(label: string, categories: CategorySpec[], opts: { daysFromNow?: number; status?: string } = {}): Promise<SaleEvent> {
    const fx = await loadFixtures();
    const days = opts.daysFromNow ?? 35;
    const date = new Date(Date.now() + days * 24 * 3600 * 1000).toISOString().slice(0, 10);
    const status = opts.status ?? 'PUBLIE';
    const dates: HelperEventDates = { start_date: date, start_time: '20:00:00', end_date: null, end_time: null };
    const insertDates = helperInsertionDates(status, dates);
    const { data: event, error } = await service.from('events').insert({
        partner_id: fx.partners.A.id,
        title: `TEST Paiement ${label} ${Date.now()}`,
        description: 'Événement dédié aux tests de la chaîne paiement → billet (lot 2).',
        ...insertDates,
        location: 'Salle de test, Dakar',
        city: 'Dakar',
        capacity: categories.reduce((s, c) => s + c.total, 0) + 10,
        image_url: await helperPosterUrl(fx.partners.A.id),
    }).select('id').single();
    assert.equal(error, null, `création de l'événement ${label} : ${error?.message}`);
    const out: SaleEvent = { eventId: event.id, categories: {} };
    for (const c of categories) {
        const inserted: { data: { id: string } | null; error: { message: string } | null } = await service.from('ticket_categories').insert({
            event_id: event.id,
            name: c.name,
            price: c.price,
            total_quantity: c.total,
            sold_quantity: 0,
            is_active: c.isActive ?? true,
            is_visible: c.isVisible ?? true,
            max_per_order: c.maxPerOrder ?? 10,
            sale_start: c.saleStart ?? null,
            sale_end: c.saleEnd ?? null,
        }).select('id').single();
        assert.equal(inserted.error, null, `création de la catégorie ${c.name} : ${inserted.error?.message}`);
        out.categories[c.name] = { id: inserted.data!.id, price: c.price, total: c.total };
    }
    await advanceHelperEvent(event.id, status, dates, insertDates);
    return out;
}

// ── Faux SamirPay (accès souple : API du contrat, ancienne API en repli) ──

/* eslint-disable @typescript-eslint/no-explicit-any */
export function fakePay(): any {
    return getFakes().payment as any;
}

export interface InitCall {
    orderId: string;
    args: Record<string, unknown>;
}

/** Appels d'initialisation enregistrés par le faux (nouvelle ou ancienne méthode). */
export function initCalls(): InitCall[] {
    const fake = fakePay();
    const calls: Array<{ method: string; args: Record<string, unknown> }> = fake.calls ?? [];
    return calls
        .filter((c) => c.method === 'initDirectPayment' || c.method === 'initPayment')
        .map((c) => ({ orderId: String(c.args.orderId ?? c.args.order_id ?? ''), args: c.args }));
}

export function callsOf(method: string): Array<{ method: string; args: Record<string, unknown> }> {
    const fake = fakePay();
    return (fake.calls ?? []).filter((c: { method: string }) => c.method === method);
}

/** Statut renvoyé par le fournisseur pour ce paiement (clé : identifiant SamirPay, ou orderId pour l'ancienne API). */
export function providerSays(payment: PaymentRow, status: 'SUCCESS' | 'FAILED' | 'CANCELLED' | 'PENDING'): void {
    const fake = fakePay();
    if (payment.external_transaction_id) fake.setTransactionStatus(payment.external_transaction_id, status);
    if (payment.external_order_id) fake.setTransactionStatus(payment.external_order_id, status.toLowerCase());
}

export function setFakeMode(key: 'initMode' | 'cashoutMode', value: string): void {
    const fake = fakePay();
    const setter = key === 'initMode' ? fake.setInitMode : fake.setCashoutMode;
    if (typeof setter === 'function') setter.call(fake, value);
    else fake[key] = value;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

// ── Paiements ──────────────────────────────────────────────────────────────

export interface PaymentRow {
    id: string;
    status: string;
    client_id: string;
    amount: number;
    external_order_id: string | null;
    external_transaction_id: string | null;
    [key: string]: unknown;
}

export async function paymentByOrder(orderId: string): Promise<PaymentRow | null> {
    const { data, error } = await service.from('payments').select('*').eq('external_order_id', orderId).maybeSingle();
    assert.equal(error, null, `lecture du paiement ${orderId} : ${error?.message}`);
    return data as PaymentRow | null;
}

export async function paymentById(id: string): Promise<PaymentRow> {
    const { data, error } = await service.from('payments').select('*').eq('id', id).single();
    assert.equal(error, null, `lecture du paiement ${id} : ${error?.message}`);
    return data as PaymentRow;
}

export async function paymentsOf(userId: string): Promise<PaymentRow[]> {
    const { data, error } = await service.from('payments').select('*').eq('client_id', userId).order('created_at');
    assert.equal(error, null, `paiements de ${userId} : ${error?.message}`);
    return (data ?? []) as PaymentRow[];
}

export interface CheckoutResult {
    status: number;
    body: Record<string, unknown>;
    payment: PaymentRow | null;
}

export async function checkout(buyer: Buyer, body: Record<string, unknown>, opts: { idempotencyKey?: string | null } = {}): Promise<CheckoutResult> {
    const headers: Record<string, string> = { 'content-type': 'application/json', authorization: `Bearer ${buyer.accessToken}` };
    const key = opts.idempotencyKey === undefined ? randomUUID() : opts.idempotencyKey;
    if (key) headers['idempotency-key'] = key;
    const before = new Set(initCalls().map((c) => c.orderId));
    const res = await checkoutRoute(new NextRequest(`${BASE_URL}/api/checkout`, { method: 'POST', headers, body: JSON.stringify(body) }));
    const json = (await res.json()) as Record<string, unknown>;
    let payment: PaymentRow | null = null;
    if (typeof json.payment_id === 'string') payment = await paymentById(json.payment_id);
    else if (res.status === 200) {
        // Repli (ancien contrat sans payment_id) : seulement pour une réponse acceptée, sinon un
        // achat concurrent refusé se verrait attribuer le paiement de l'autre acheteur.
        const fresh = initCalls().find((c) => !before.has(c.orderId));
        if (fresh) payment = await paymentByOrder(fresh.orderId);
    }
    return { status: res.status, body: json, payment };
}

/** Corps de checkout conforme au lot 2 (opérateur et téléphone payeur obligatoires). */
export function cart(eventId: string, items: Array<[string, number]>, buyer: Buyer, operator: 'WAVE' | 'ORANGE_MONEY' = 'WAVE'): Record<string, unknown> {
    return {
        eventId,
        items: items.map(([categoryId, quantity]) => ({ categoryId, quantity })),
        operator,
        payerPhone: buyer.phone9,
        // ancien contrat (repli avant correctif)
        customerPhone: buyer.phoneE164,
    };
}

// ── Webhook ────────────────────────────────────────────────────────────────

export function callbackUrlFor(orderId: string): string {
    const call = initCalls().find((c) => c.orderId === orderId);
    const raw = String(call?.args.callBackUrl ?? call?.args.callback_url ?? `${BASE_URL}/api/webhooks/samirpay`);
    return raw;
}

export async function deliverWebhook(payment: PaymentRow, opts: {
    token?: 'valid' | 'none' | 'wrong';
    transactionId?: string;
    orderId?: string;
    status?: string;
    rawBody?: string;
    contentType?: string;
} = {}): Promise<Response> {
    const url = new URL(callbackUrlFor(payment.external_order_id!), BASE_URL);
    if (opts.token === 'none') url.searchParams.delete('t');
    if (opts.token === 'wrong') url.searchParams.set('t', randomUUID().replace(/-/g, ''));
    const fields = {
        transaction_id: opts.transactionId ?? payment.external_transaction_id ?? '',
        order_id: opts.orderId ?? payment.external_order_id ?? '',
        status: opts.status ?? 'success',
    };
    const body = opts.rawBody ?? new URLSearchParams(fields).toString();
    const req = new NextRequest(url.toString(), {
        method: 'POST',
        headers: { 'content-type': opts.contentType ?? 'application/x-www-form-urlencoded' },
        body,
    });
    return webhookRoute(req);
}

// ── Statut ─────────────────────────────────────────────────────────────────

export async function pollStatus(token: string | null, paymentId: string): Promise<{ status: number; body: Record<string, unknown> }> {
    const headers: Record<string, string> = {};
    if (token) headers.authorization = `Bearer ${token}`;
    const res = await statusRoute(new NextRequest(`${BASE_URL}/api/payments/${paymentId}/status`, { method: 'GET', headers }), routeContext({ transactionId: paymentId }) as never);
    return { status: res.status, body: (await res.json()) as Record<string, unknown> };
}

// ── Billets et stock ───────────────────────────────────────────────────────

export async function eventTickets(eventId: string): Promise<Array<Record<string, unknown>>> {
    const { data, error } = await service.from('tickets').select('*').eq('event_id', eventId);
    assert.equal(error, null, `billets de l'événement : ${error?.message}`);
    return data ?? [];
}

export async function categoryState(categoryId: string): Promise<{ sold: number; held: number; total: number }> {
    const { data, error } = await service.from('ticket_categories').select('sold_quantity, held_quantity, total_quantity').eq('id', categoryId).single();
    assert.equal(error, null, `catégorie ${categoryId} : ${error?.message}`);
    return { sold: Number(data.sold_quantity), held: Number(data.held_quantity), total: Number(data.total_quantity) };
}

export function cronRequest(path: string, secret: string | null = process.env.CRON_SECRET ?? null): NextRequest {
    const headers: Record<string, string> = {};
    if (secret) headers.authorization = `Bearer ${secret}`;
    return new NextRequest(`${BASE_URL}${path}`, { method: 'GET', headers });
}

export function sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
}

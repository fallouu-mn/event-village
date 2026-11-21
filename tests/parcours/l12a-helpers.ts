/**
 * Lot 12a — aides des suites des commandes (argent et sécurité). Base LOCALE seulement ; faux SamirPay (aucun appel
 * réel). Les montants attendus des suites sont calculés à la main dans chaque test, jamais par ces aides.
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { NextRequest } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { BASE_URL } from './helpers';
import { deliverWebhook, newBuyer, paymentById, providerSays, service, type Buyer, type PaymentRow } from './paiement-helpers';
import { newPartner, superadminId, type TestPartner } from './finance-helpers';
import { openConcurrentClient } from '../helpers/db';
import { platformSetting, setPlatformSetting } from './l10a-helpers';
import { newVenue, type VenueSpec } from './l11a-helpers';
import { POST as createOrderRoute } from '../../app/api/orders/create/route';
import { POST as paymentCreateRoute } from '../../app/api/payments/create/route';
import { PATCH as partnerOrderPatch } from '../../app/api/partner/orders/[id]/route';
import { PATCH as courierOrderPatch } from '../../app/api/courier/orders/[id]/route';

export type Row = Record<string, unknown>;
export const n = (v: unknown): number => Number(v);

/** Ouvre le service des commandes le temps d'une suite ; rend la fonction qui remet la valeur d'origine. */
export async function openOrdersService(): Promise<() => Promise<void>> {
    const before = await platformSetting('features.orders_enabled');
    await setPlatformSetting('features.orders_enabled', true, 'test du lot 12a');
    return async () => setPlatformSetting('features.orders_enabled', before, 'test du lot 12a');
}

export interface ShopSpec extends VenueSpec {
    modes?: Array<'LIVRAISON' | 'RETRAIT' | 'SUR_PLACE'>;
    depositAllowed?: boolean;
    depositPercent?: number | null;
    payOnHandover?: boolean;
    prepMinutes?: number | null;
    ordersOpen?: boolean;
}

/** Établissement validé, ouvert 24 h sur 24, qui prend des commandes (réglages par order_venue_settings_set). */
export async function newShop(partner: TestPartner, spec: ShopSpec = {}): Promise<string> {
    const venueId = await newVenue(partner, spec);
    const { data, error } = await service.rpc('order_venue_settings_set', {
        p: {
            actor_id: partner.userId, venue_id: venueId, orders_open: spec.ordersOpen ?? true,
            modes: spec.modes ?? ['LIVRAISON', 'RETRAIT', 'SUR_PLACE'],
            deposit_allowed: spec.depositAllowed ?? false, deposit_percent: spec.depositPercent ?? null,
            pay_on_handover: spec.payOnHandover ?? false, prep_minutes: spec.prepMinutes ?? null,
        },
    });
    assert.equal(error, null, `order_venue_settings_set : ${error?.message}`);
    assert.equal((data as Row).ok, true, `réglages de vente : ${JSON.stringify(data)}`);
    return venueId;
}

export interface ProductSpec {
    price: number;
    name?: string;
    stock?: number | null;
    daily?: boolean;
    regulated?: boolean;
    regulatedKind?: 'ALCOOL' | 'TABAC';
    status?: 'DISPONIBLE' | 'INDISPONIBLE' | 'EPUISE' | 'SUSPENDU';
}

export async function newProduct(partner: TestPartner, venueId: string, spec: ProductSpec): Promise<string> {
    const { data, error } = await service.from('products').insert({
        partner_id: partner.partnerId, venue_id: venueId, name: spec.name ?? `TEST Plat ${randomUUID().slice(0, 6)}`, price: spec.price,
        is_stock_managed: spec.stock !== undefined && spec.stock !== null, stock_quantity: spec.stock ?? null,
        is_daily_special: spec.daily ?? false, is_regulated: spec.regulated ?? false, regulated_kind: spec.regulated ? (spec.regulatedKind ?? 'ALCOOL') : null,
        status: spec.status ?? 'DISPONIBLE',
    }).select('id').single();
    assert.equal(error, null, `produit : ${error?.message}`);
    return String(data!.id);
}

export async function newOption(productId: string, name: string, price: number): Promise<string> {
    const { data, error } = await service.from('product_options').insert({ product_id: productId, name, price_delta: price }).select('id').single();
    assert.equal(error, null, `supplément : ${error?.message}`);
    return String(data!.id);
}

export async function newDeliveryZone(venueId: string, fee: number, minOrder = 0, name = 'Almadies'): Promise<string> {
    const { data, error } = await service.from('order_delivery_zones').insert({ venue_id: venueId, name, fee, min_order: minOrder }).select('id').single();
    assert.equal(error, null, `zone de livraison : ${error?.message}`);
    return String(data!.id);
}

export async function setPortions(partner: TestPartner, productId: string, portions: number): Promise<Row> {
    const { data, error } = await service.rpc('order_daily_portions_set', { p: { actor_id: partner.userId, product_id: productId, portions } });
    assert.equal(error, null, `order_daily_portions_set : ${error?.message}`);
    return data as Row;
}

export interface Line { productId: string; quantity: number | string; optionIds?: string[]; notes?: string }

/** Corps de commande (forme de la route : camelCase). */
export function orderBody(venueId: string, lines: Line[], extra: Row = {}): Row {
    return { venueId, mode: 'RETRAIT', payment: 'INTEGRAL', items: lines, ...extra };
}

/** Commande par la fonction en base (mêmes contrôles que la route ; corps transformé comme par la route). */
export async function orderRpc(client: Buyer, body: Row): Promise<Row> {
    const { orderInput } = await import('../../lib/orders/booking');
    const { data, error } = await service.rpc('order_create', { p: orderInput(client.userId, body) });
    assert.equal(error, null, `order_create : ${error?.message}`);
    return data as Row;
}

/** Commande par la route (session du client). */
export async function orderRoute(client: Buyer, body: Row): Promise<{ status: number; body: Row }> {
    const res = await createOrderRoute(new NextRequest(`${BASE_URL}/api/orders/create`, {
        method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${client.accessToken}` }, body: JSON.stringify(body),
    }));
    return { status: res.status, body: (await res.json()) as Row };
}

/** Commande créée (sinon échec du test) ; rend son identifiant. */
export async function placed(client: Buyer, body: Row): Promise<string> {
    const r = await orderRpc(client, body);
    assert.equal(r.ok, true, `commande : ${JSON.stringify(r)}`);
    return String(r.order_id);
}

/** Lance un paiement par la route (faux SamirPay) ; rend la réponse et le paiement créé. */
export async function startOrderPay(client: Buyer, orderId: string, extra: Row = {}): Promise<{ status: number; body: Row; payment: PaymentRow | null }> {
    const res = await paymentCreateRoute(new NextRequest(`${BASE_URL}/api/payments/create`, {
        method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${client.accessToken}` },
        body: JSON.stringify({ targetType: 'ORDER', targetId: orderId, operator: 'WAVE', payerPhone: client.phone9, ...extra }),
    }));
    const body = (await res.json()) as Row;
    const id = typeof body.payment_id === 'string' ? body.payment_id : typeof body.id === 'string' ? body.id : null;
    return { status: res.status, body, payment: id ? await paymentById(id) : null };
}

/** Paiement confirmé par le webhook (le faux SamirPay dit SUCCESS). */
export async function payOrder(client: Buyer, orderId: string, extra: Row = {}): Promise<PaymentRow> {
    const started = await startOrderPay(client, orderId, extra);
    assert.equal(started.status, 201, `paiement : HTTP ${started.status} ${JSON.stringify(started.body)}`);
    assert.ok(started.payment, 'paiement créé');
    providerSays(started.payment!, 'SUCCESS');
    const hook = await deliverWebhook(started.payment!);
    assert.equal(hook.status, 200, `webhook : HTTP ${hook.status}`);
    return paymentById(started.payment!.id);
}

export async function order(id: string): Promise<Row> {
    const { data, error } = await service.from('orders').select('*').eq('id', id).single();
    assert.equal(error, null, `commande ${id} : ${error?.message}`);
    return data as Row;
}

export async function itemsOf(id: string): Promise<Row[]> {
    const { data, error } = await service.from('order_items').select('*').eq('order_id', id).order('created_at');
    assert.equal(error, null, error?.message);
    return (data ?? []) as Row[];
}

export async function historyOf(id: string): Promise<string[]> {
    const { data, error } = await service.from('order_state_history').select('from_state, to_state, actor_role').eq('order_id', id).order('id');
    assert.equal(error, null, error?.message);
    return (data ?? []).map((h) => `${h.from_state ?? '∅'}→${h.to_state} (${h.actor_role})`);
}

export async function partnerAct(partner: Buyer, id: string, body: Row): Promise<{ status: number; body: Row }> {
    const res = await partnerOrderPatch(new NextRequest(`${BASE_URL}/api/partner/orders/${id}`, {
        method: 'PATCH', headers: { 'content-type': 'application/json', authorization: `Bearer ${partner.accessToken}` }, body: JSON.stringify(body),
    }), { params: Promise.resolve({ id }) });
    return { status: res.status, body: (await res.json()) as Row };
}

export async function courierAct(courier: Buyer, id: string, body: Row): Promise<{ status: number; body: Row }> {
    const res = await courierOrderPatch(new NextRequest(`${BASE_URL}/api/courier/orders/${id}`, {
        method: 'PATCH', headers: { 'content-type': 'application/json', authorization: `Bearer ${courier.accessToken}` }, body: JSON.stringify(body),
    }), { params: Promise.resolve({ id }) });
    return { status: res.status, body: (await res.json()) as Row };
}

/** Fait avancer une commande payée jusqu'à « prête » (accepter, préparer, prête), par la route de la partenaire. */
export async function toReady(partner: Buyer, id: string): Promise<void> {
    for (const action of ['ACCEPTER', 'PREPARER', 'PRETE']) {
        const r = await partnerAct(partner, id, { action });
        assert.equal(r.status, 200, `${action} : HTTP ${r.status} ${JSON.stringify(r.body)}`);
    }
}

/**
 * Code de remise lu dans la boîte d'envoi (ligne SMS, push ou email encore en attente) : le seul endroit où il existe en
 * clair, jusqu'à la fin de l'envoi. Le plus récent pour ce type d'avis.
 */
export async function codeOf(clientId: string, orderId: string, type = ''): Promise<string> {
    let q = service.from('notification_outbox').select('type, channel, template_data, created_at')
        .eq('recipient_user_id', clientId).eq('template_data->>order_id', orderId).neq('channel', 'IN_APP')
        .order('created_at', { ascending: false });
    if (type) q = q.eq('type', type);
    const { data, error } = await q;
    assert.equal(error, null, `boîte d'envoi : ${error?.message}`);
    const row = (data ?? []).find((r) => typeof (r.template_data as Row)?.code === 'string');
    assert.ok(row, `aucun code en attente d'envoi pour la commande ${orderId} (${type || 'tout type'})`);
    return String((row!.template_data as Row).code);
}

/** Avis en file pour un destinataire et une commande : « TYPE:CANAL », triés. */
export async function outboxOf(userId: string, orderId: string): Promise<string[]> {
    const { data, error } = await service.from('notification_outbox').select('type, channel')
        .eq('recipient_user_id', userId).eq('template_data->>order_id', orderId);
    assert.equal(error, null, `boîte d'envoi : ${error?.message}`);
    return (data ?? []).map((r) => `${String(r.type)}:${String(r.channel)}`).sort();
}

export function allChannels(type: string): string[] {
    return ['EMAIL', 'IN_APP', 'PUSH', 'SMS'].map((c) => `${type}:${c}`);
}

/**
 * Horloge des tests : déplace une commande dans le temps par une écriture locale avec le drapeau des fonctions en base
 * (la garde refuse toute autre écriture). Valeurs en minutes relatives à maintenant (négatif = passé).
 */
export async function shiftOrder(id: string, minutes: Partial<Record<'hold_expires_at' | 'response_due_at' | 'scheduled_for' | 'ready_at' | 'handed_over_at' | 'closed_at', number>>): Promise<void> {
    const c = await openConcurrentClient({ applicationName: 'ev-test-l12a' });
    try {
        await c.query(`SELECT set_config('event_village.order_flow', 'on', true)`);
        for (const [col, m] of Object.entries(minutes)) {
            await c.query(`UPDATE public.orders SET ${col} = now() + make_interval(mins => $2::int) WHERE id = $1`, [id, m]);
        }
        await c.commit();
    } finally {
        await c.close();
    }
}

/** Commandes non payées d'un client closes (« Non payée à temps ») : le plafond ne gêne pas les tests suivants. */
export async function releaseUnpaid(clientId: string): Promise<void> {
    const { data, error } = await service.from('orders').select('id').eq('client_id', clientId).eq('order_state', 'EN_ATTENTE_PAIEMENT');
    assert.equal(error, null, error?.message);
    for (const o of data ?? []) {
        await shiftOrder(String(o.id), { hold_expires_at: -1 });
        const { error: e } = await service.rpc('order_expire_hold', { p_order_id: o.id });
        assert.equal(e, null, e?.message);
    }
}

export async function tick(): Promise<Row> {
    const { data, error } = await service.rpc('order_tick');
    assert.equal(error, null, `order_tick : ${error?.message}`);
    return data as Row;
}

/** Livreur ACTIF de l'équipe d'une partenaire (invitation puis accord). */
export async function addCourier(partner: TestPartner, courier: Buyer): Promise<string> {
    const { data, error } = await service.rpc('order_courier_invite', { p: { actor_id: partner.userId, phone: courier.phoneE164 } });
    assert.equal(error, null, error?.message);
    assert.equal((data as Row).ok, true, `invitation : ${JSON.stringify(data)}`);
    const { data: r, error: e2 } = await service.rpc('order_courier_respond', { p: { actor_id: courier.userId, invitation_id: (data as Row).invitation_id, accept: true } });
    assert.equal(e2, null, e2?.message);
    assert.equal((r as Row).ok, true, `accord : ${JSON.stringify(r)}`);
    return String((data as Row).invitation_id);
}

/** Client REST de la session d'un compte (clé anon + jeton) : ce que le navigateur peut lire ou écrire lui-même. */
export function userClient(token: string): SupabaseClient {
    return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { headers: { Authorization: `Bearer ${token}` } },
    });
}

export async function refundsOfOrder(orderId: string): Promise<Row[]> {
    const { data, error } = await service.from('refunds')
        .select('amount, facial_part, service_part, aggregator_fee_share, aggregator_fee_bearer, net_revenue_reversal, kind, payment_id, payments!inner(order_id)')
        .eq('payments.order_id', orderId).order('amount');
    assert.equal(error, null, error?.message);
    return (data ?? []) as Row[];
}

/** Somme signée des écritures du grand livre d'un paiement (crédit positif, débit négatif). */
export async function ledgerOfPayment(paymentId: string): Promise<number> {
    const { data, error } = await service.from('finance_ledger').select('amount').eq('payment_id', paymentId);
    assert.equal(error, null, error?.message);
    return (data ?? []).reduce((sum, r) => sum + Number(r.amount), 0);
}

export { newBuyer, newPartner, platformSetting, service, setPlatformSetting, superadminId, type Buyer, type PaymentRow, type TestPartner };

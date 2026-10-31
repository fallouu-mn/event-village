/**
 * Lot 3 — outils des suites financières : réglages (finance_setting_set, restauration après le test),
 * partenaire dédié (grand livre isolé), achat confirmé de bout en bout, grand livre, remboursements.
 * Les RPC appelées ici sont celles du contrat du lot 3 : avant correctif, elles n'existent pas et les
 * suites échouent sur l'assertion qui les appelle.
 */
import '../helpers/env';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { NextRequest } from 'next/server';
import { BASE_URL } from './helpers';
import { CashoutService } from '../../lib/payments/cashout.service';
import { loadFixtures } from '../helpers/fixtures';
import {
    service, newBuyer, checkout, cart, providerSays, deliverWebhook, paymentById,
    type Buyer, type CategorySpec, type PaymentRow, type SaleEvent,
} from './paiement-helpers';

export type FinanceSettingKey =
    | 'finance.service_fee_rate'
    | 'finance.aggregator_fee_rate.WAVE'
    | 'finance.aggregator_fee_rate.ORANGE_MONEY'
    | 'finance.cancellation_aggregator_fee_bearer'
    | 'finance.payout_hold_enabled'
    | 'finance.payout_delay_hours'
    | 'finance.withdrawal_fee_rate'
    | 'finance.withdrawal_min_amount'
    | 'finance.withdrawal_bank_enabled'
    | 'finance.referral_availability_days';

// ── Réglages ───────────────────────────────────────────────────────────────

export async function superadminId(): Promise<string> {
    return (await loadFixtures()).users.SUPERADMIN.id;
}

export async function getSetting(key: FinanceSettingKey): Promise<unknown> {
    const { data, error } = await service.from('platform_settings').select('value').eq('key', key).maybeSingle();
    assert.equal(error, null, `lecture du réglage ${key} : ${error?.message}`);
    assert.ok(data, `réglage ${key} absent de platform_settings`);
    return (data.value as { value?: unknown }).value;
}

export async function setSetting(key: FinanceSettingKey, value: unknown, reason = 'test du lot 3'): Promise<void> {
    const { data, error } = await service.rpc('finance_setting_set', { p_key: key, p_value: { value }, p_actor: await superadminId(), p_reason: reason });
    assert.equal(error, null, `réglage ${key} : ${error?.message}`);
    assert.equal((data as { ok?: boolean } | null)?.ok, true, `réglage ${key} refusé : ${JSON.stringify(data)}`);
}

/** Applique des réglages le temps de fn, puis remet les valeurs d'origine. */
export async function withSettings<T>(overrides: Partial<Record<FinanceSettingKey, unknown>>, fn: () => Promise<T>): Promise<T> {
    const keys = Object.keys(overrides) as FinanceSettingKey[];
    const saved = new Map<FinanceSettingKey, unknown>();
    for (const k of keys) saved.set(k, await getSetting(k));
    for (const k of keys) await setSetting(k, overrides[k]);
    try {
        return await fn();
    } finally {
        for (const k of keys) await setSetting(k, saved.get(k), 'restauration après un test du lot 3');
    }
}

// ── Partenaire et événement dédiés ─────────────────────────────────────────

export interface TestPartner extends Buyer {
    partnerId: string;
}

/** Partenaire VALIDE neuf (compte, rôle PARTENAIRE, fiche), pour un grand livre sans historique. */
export async function newPartner(label: string): Promise<TestPartner> {
    const user = await newBuyer(`part-${label}`, { firstName: 'Moussa', lastName: `Organisateur${label.replace(/[^a-z]/gi, '').slice(0, 10)}` });
    const { error: roleErr } = await service.from('user_roles').upsert([{ user_id: user.userId, role: 'PARTENAIRE' }], { onConflict: 'user_id,role' });
    assert.equal(roleErr, null, `rôle PARTENAIRE : ${roleErr?.message}`);
    const { data: partner, error } = await service.from('partners').insert({
        user_id: user.userId,
        company_name: `TEST Finance ${label} ${Date.now()}`,
        commercial_name: `Finance ${label}`,
        description: 'Partenaire dédié aux tests financiers (lot 3).',
        address: 'Rue de test, Dakar',
        city: 'Dakar',
        phone: user.phoneE164,
        email: user.email,
        is_verified: true,
        status: 'VALIDE',
    }).select('id').single();
    assert.equal(error, null, `partenaire ${label} : ${error?.message}`);
    const { error: actErr } = await service.from('partner_activities')
        .upsert({ partner_id: partner.id, activity_type: 'ORGANISATEUR', is_active: true }, { onConflict: 'partner_id,activity_type' });
    assert.equal(actErr, null, `activité ORGANISATEUR : ${actErr?.message}`);
    return { ...user, partnerId: partner.id };
}

export async function createPartnerEvent(partnerId: string, label: string, categories: CategorySpec[], opts: { daysFromNow?: number } = {}): Promise<SaleEvent> {
    const days = opts.daysFromNow ?? 30;
    const date = new Date(Date.now() + days * 24 * 3600 * 1000).toISOString().slice(0, 10);
    const { data: event, error } = await service.from('events').insert({
        partner_id: partnerId,
        title: `TEST Finance ${label} ${Date.now()}`,
        description: 'Événement dédié aux tests financiers (lot 3).',
        start_date: date,
        start_time: '20:00:00',
        end_date: date,
        end_time: '23:00:00',
        location: 'Salle de test, Dakar',
        city: 'Dakar',
        capacity: categories.reduce((s, c) => s + c.total, 0) + 10,
        status: 'PUBLIE',
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

// ── Achat confirmé ─────────────────────────────────────────────────────────

export interface Purchase {
    payment: Record<string, unknown> & PaymentRow;
    tickets: Array<Record<string, unknown>>;
    checkoutBody: Record<string, unknown>;
}

/** Checkout, succès chez SamirPay, webhook : paiement confirmé et billets émis. */
export async function buyConfirmed(buyer: Buyer, ev: SaleEvent, items: Array<[string, number]>, operator: 'WAVE' | 'ORANGE_MONEY' = 'WAVE'): Promise<Purchase> {
    const res = await checkout(buyer, cart(ev.eventId, items.map(([name, q]) => [ev.categories[name].id, q]), buyer, operator));
    assert.equal(res.status, 200, `checkout : HTTP ${res.status} ${JSON.stringify(res.body)}`);
    assert.ok(res.payment, 'paiement créé');
    providerSays(res.payment!, 'SUCCESS');
    const hook = await deliverWebhook(res.payment!);
    assert.equal(hook.status, 200, 'webhook accepté');
    const payment = (await paymentById(res.payment!.id)) as Record<string, unknown> & PaymentRow;
    assert.equal(payment.status, 'SUCCESS', `paiement confirmé (${payment.status})`);
    const { data: tickets, error } = await service.from('tickets').select('*').eq('payment_id', payment.id).order('created_at');
    assert.equal(error, null, `billets : ${error?.message}`);
    return { payment, tickets: tickets ?? [], checkoutBody: res.body };
}

export async function paymentRow(id: string): Promise<Record<string, unknown>> {
    const { data, error } = await service.from('payments').select('*').eq('id', id).single();
    assert.equal(error, null, `paiement ${id} : ${error?.message}`);
    return data as Record<string, unknown>;
}

// ── Grand livre ────────────────────────────────────────────────────────────

export type AccountKind = 'ORGANISATEUR' | 'PARRAINAGE';

export interface Balance { available: number; pending: number; next_available_at: string | null; in_progress: number }

export async function balanceOf(ownerId: string, kind: AccountKind): Promise<Balance> {
    const { data, error } = await service.rpc('finance_account_balance', { p_owner: ownerId, p_kind: kind });
    assert.equal(error, null, `solde ${kind} : ${error?.message}`);
    const b = data as Record<string, unknown>;
    return { available: Number(b.available), pending: Number(b.pending), next_available_at: (b.next_available_at as string | null) ?? null, in_progress: Number(b.in_progress ?? 0) };
}

export async function ledgerOf(ownerId: string, kind: AccountKind): Promise<Array<Record<string, unknown>>> {
    const { data, error } = await service.from('finance_ledger').select('*').eq('owner_id', ownerId).eq('account_kind', kind).order('created_at');
    assert.equal(error, null, `grand livre ${kind} : ${error?.message}`);
    return (data ?? []) as Array<Record<string, unknown>>;
}

export async function cashoutsByKey(prefix: string): Promise<Array<Record<string, unknown>>> {
    const { data, error } = await service.from('cashouts').select('*').like('idempotency_key', `${prefix}%`).order('created_at');
    assert.equal(error, null, `cashouts ${prefix} : ${error?.message}`);
    return (data ?? []) as Array<Record<string, unknown>>;
}

/** Fait passer un cashout envoyé à CONFIRME via la confirmation du module (statut SamirPay SUCCESS). */
export async function confirmCashouts(): Promise<void> {
    await CashoutService.confirmSent(200);
}

// ── Routes ─────────────────────────────────────────────────────────────────

export function jsonRequest(path: string, method: string, token: string | null, body?: unknown, headers: Record<string, string> = {}): NextRequest {
    const h: Record<string, string> = { 'content-type': 'application/json', ...headers };
    if (token) h.authorization = `Bearer ${token}`;
    return new NextRequest(`${BASE_URL}${path}`, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) });
}

export function idempotencyHeader(): Record<string, string> {
    return { 'idempotency-key': randomUUID() };
}

export function round2(x: number): number {
    return Math.round(x * 100) / 100;
}

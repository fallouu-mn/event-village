/**
 * Contre-vérification du lot 10a (salles : argent et sécurité) — aides communes aux suites tests/audit/cv10a-*.
 * Aucune aide ne corrige quoi que ce soit : elles montent des comptes et des salles, appellent les routes réelles de
 * l'application et lisent la base LOCALE (tests/helpers/db : hôte vérifié). Faux SamirPay : aucun appel réel.
 *
 * Le temps qui passe est simulé comme dans les suites du lot (tests/parcours/l10a-annulation.test.ts:212) : on
 * déplace l'échéance (balance_due_at, hold_expires_at) ou la date de création d'un paiement, jamais l'horloge.
 */
import assert from 'node:assert/strict';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { inspect } from '../helpers/db';
import { service, type PaymentRow } from '../parcours/paiement-helpers';
import { api, show, type Reply, type Row } from './cvf1-helpers';
import {
    dayFromNow, decideHall, newBuyer, newHall, newPartner, openHallsService, outboxOf, payConfirmed, reservation,
    reserveRoute, reserveRpc, setPlatformSetting, platformSetting, startPayment, type Buyer, type TestPartner,
} from '../parcours/l10a-helpers';

export type { Buyer, PaymentRow, Reply, Row, TestPartner };
export {
    api, dayFromNow, decideHall, newBuyer, newHall, newPartner, openHallsService, outboxOf, payConfirmed, platformSetting,
    reservation, reserveRoute, reserveRpc, service, setPlatformSetting, show, startPayment,
};

export const n = (v: unknown): number => Number(v);

/** Client REST (clé anon + jeton de session), jamais la clé de service. */
export function restAs(token: string | null): SupabaseClient {
    return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
        ...(token ? { global: { headers: { Authorization: `Bearer ${token}` } } } : {}),
    });
}

/** Début d'un créneau à l'heure, sur un pas de 30 minutes, autour d'un instant (jamais 23:30 : 1 h ne tiendrait pas). */
export function halfHourSlot(targetMs: number, dir: 'up' | 'down'): { startDate: string; startTime: string; startMs: number } {
    const step = 30 * 60_000;
    let ms = dir === 'up' ? Math.ceil(targetMs / step) * step : Math.floor(targetMs / step) * step;
    const d = new Date(ms);
    if (d.getUTCHours() === 23 && d.getUTCMinutes() === 30) ms += dir === 'up' ? step : -step;
    const iso = new Date(ms).toISOString();
    return { startDate: iso.slice(0, 10), startTime: iso.slice(11, 16), startMs: ms };
}

export const DAY_MS = 86_400_000;

/** Réservations d'un client (toutes, par la clé de service). */
export async function reservationsOf(clientId: string): Promise<Row[]> {
    const { data, error } = await service.from('hall_reservations').select('*').eq('client_id', clientId).order('created_at');
    assert.equal(error, null, error?.message);
    return (data ?? []) as Row[];
}

export async function pendingCount(clientId: string): Promise<number> {
    const { data, error } = await service.from('hall_reservations').select('id')
        .eq('client_id', clientId).eq('booking_state', 'EN_ATTENTE_PAIEMENT').gt('hold_expires_at', new Date().toISOString());
    assert.equal(error, null, error?.message);
    return (data ?? []).length;
}

export async function paymentsOfReservation(id: string): Promise<Row[]> {
    const { data, error } = await service.from('payments').select('*').eq('hall_reservation_id', id).order('created_at');
    assert.equal(error, null, error?.message);
    return (data ?? []) as Row[];
}

export async function refundsOf(reservationId: string): Promise<Row[]> {
    const { data, error } = await service.from('refunds')
        .select('id, amount, facial_part, service_part, aggregator_fee_share, net_revenue_reversal, kind, payment_id, payments!inner(hall_reservation_id)')
        .eq('payments.hall_reservation_id', reservationId).order('amount');
    assert.equal(error, null, error?.message);
    return (data ?? []) as Row[];
}

/** Somme signée des écritures du grand livre d'un paiement pour un type (crédit positif, débit négatif). */
export async function ledgerSum(paymentId: string, entryType: string): Promise<number> {
    const { data, error } = await service.from('finance_ledger').select('amount').eq('payment_id', paymentId).eq('entry_type', entryType);
    assert.equal(error, null, error?.message);
    return (data ?? []).reduce((sum, r) => sum + Number(r.amount), 0);
}

export async function tick(): Promise<Row> {
    const { data, error } = await service.rpc('hall_reservations_tick');
    assert.equal(error, null, `hall_reservations_tick : ${error?.message}`);
    return data as Row;
}

/** Le temps passe : l'attente de paiement de 15 minutes est échue. */
export async function expireHold(id: string): Promise<void> {
    const { error } = await service.from('hall_reservations').update({ hold_expires_at: new Date(Date.now() - 60_000).toISOString() }).eq('id', id);
    assert.equal(error, null, error?.message);
}

/** Le temps passe : le paiement a été lancé il y a `minutes` minutes. */
export async function agePayment(id: string, minutes: number): Promise<void> {
    const { error } = await service.from('payments').update({ created_at: new Date(Date.now() - minutes * 60_000).toISOString() }).eq('id', id);
    assert.equal(error, null, error?.message);
}

/** Paiement lancé par la route (faux SamirPay) : 201 attendu ; rend la ligne du paiement. */
export async function started(client: Buyer, id: string, part: 'ACOMPTE' | 'SOLDE' | 'INTEGRAL', extra: Row = {}): Promise<PaymentRow> {
    const s = await startPayment(client, id, part, extra);
    assert.equal(s.status, 201, `paiement ${part} : HTTP ${s.status} ${JSON.stringify(s.body)}`);
    assert.ok(s.payment, 'paiement créé');
    return s.payment!;
}

/** Le fournisseur dit SUCCESS, le webhook arrive (chemin réel de confirmation). */
export async function confirmByWebhook(payment: PaymentRow): Promise<void> {
    const { deliverWebhook, providerSays } = await import('../parcours/paiement-helpers');
    providerSays(payment, 'SUCCESS');
    const hook = await deliverWebhook(payment);
    assert.equal(hook.status, 200, `webhook : HTTP ${hook.status}`);
}

/** Route réelle avec un segment [id]. */
export async function routeId(method: string, rel: string, id: string, token: string | null, body?: unknown): Promise<Reply> {
    return api(method, rel, { token, params: { id }, path: `/api/${rel.replace('[id]', id)}`, body });
}

export const clientCancel = (id: string, token: string): Promise<Reply> =>
    routeId('POST', 'halls/reservations/[id]/cancel', id, token, {});
export const partnerAction = (id: string, token: string, body: Row): Promise<Reply> =>
    routeId('POST', 'partner/halls/reservations/[id]/status', id, token, body);
export const adminCancel = (id: string, token: string, reason: string): Promise<Reply> =>
    routeId('POST', 'admin/halls/reservations/[id]/cancel', id, token, { reason });

/** Lecture brute (lecture seule) d'une requête SQL sur la base locale. */
export async function sql<T extends Row = Row>(text: string, params: unknown[] = []): Promise<T[]> {
    return inspect(async (c) => (await c.query<T>(text, params)).rows);
}

/** Trace d'une attaque dans la sortie brute (lue au rapport). */
export function trace(tag: string, what: unknown): void {
    console.log(`[CV10A] ${tag} : ${typeof what === 'string' ? what : JSON.stringify(what)}`);
}

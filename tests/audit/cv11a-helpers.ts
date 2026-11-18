/**
 * Contre-vérification du lot 11a (tables : argent et sécurité) — aides communes aux suites tests/audit/cv11a-*.
 * Aucune aide ne corrige quoi que ce soit : elles montent des comptes, des établissements et des tables par les aides du
 * lot (tests/parcours/l11a-helpers.ts), appellent les routes réelles de l'application et lisent la base LOCALE
 * (tests/helpers/db : hôte vérifié). Faux SamirPay : aucun appel réel.
 *
 * Le temps qui passe est simulé comme dans les suites du lot (shiftReservation : écriture locale avec le drapeau des
 * fonctions en base) ou en vieillissant la date de création d'un paiement ; jamais l'horloge.
 */
import assert from 'node:assert/strict';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { inspect } from '../helpers/db';
import { deliverWebhook, paymentById, providerSays, service, type PaymentRow } from '../parcours/paiement-helpers';
import { api, show, type Reply } from './cvf1-helpers';
import {
    ALWAYS_OPEN, dayFromNow, decideVenue, isoWeekday, ledgerOfPayment, newBuyer, newPartner, newTable, newVenue, newZone,
    openTablesService, outboxOf, payConfirmed, platformSetting, refundsOf, releasePending, reservation, reserveRoute, reserveRpc,
    setHours, setPlatformSetting, shiftReservation, startIn, startPayment, superadminId, tick, type Buyer, type Row, type TestPartner,
} from '../parcours/l11a-helpers';

export type { Buyer, PaymentRow, Reply, Row, TestPartner };
export {
    ALWAYS_OPEN, api, dayFromNow, decideVenue, deliverWebhook, isoWeekday, ledgerOfPayment, newBuyer, newPartner, newTable, newVenue,
    newZone, openTablesService, outboxOf, payConfirmed, paymentById, platformSetting, providerSays, refundsOf, releasePending, reservation,
    reserveRoute, reserveRpc, service, setHours, setPlatformSetting, shiftReservation, show, startIn, startPayment, superadminId, tick,
};

export const n = (v: unknown): number => Number(v);

/** Client REST (clé anon + jeton de session), jamais la clé de service. */
export function restAs(token: string | null): SupabaseClient {
    return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
        ...(token ? { global: { headers: { Authorization: `Bearer ${token}` } } } : {}),
    });
}

/** Route réelle avec un segment [id]. */
export async function routeId(method: string, rel: string, id: string, token: string | null, body?: unknown, query = ''): Promise<Reply> {
    return api(method, rel, { token, params: { id }, path: `/api/${rel.replace('[id]', id)}${query}`, body });
}

export const clientCancel = (id: string, token: string): Promise<Reply> => routeId('POST', 'tables/reservations/[id]/cancel', id, token, {});
export const partnerAction = (id: string, token: string, body: Row): Promise<Reply> => routeId('PATCH', 'partner/tables/reservations/[id]', id, token, body);
export const adminCancel = (id: string, token: string, reason: string): Promise<Reply> =>
    routeId('POST', 'admin/tables/reservations/[id]/cancel', id, token, { reason });

/** Paiement lancé par la route (faux SamirPay) : 201 attendu ; rend la ligne du paiement. */
export async function started(client: Buyer, id: string, extra: Row = {}): Promise<PaymentRow> {
    const s = await startPayment(client, id, extra);
    assert.equal(s.status, 201, `paiement : HTTP ${s.status} ${JSON.stringify(s.body)}`);
    assert.ok(s.payment, 'paiement créé');
    return s.payment!;
}

/** Le fournisseur dit SUCCESS, le webhook arrive (chemin réel de confirmation). */
export async function confirmByWebhook(payment: PaymentRow): Promise<void> {
    providerSays(payment, 'SUCCESS');
    const hook = await deliverWebhook(payment);
    assert.equal(hook.status, 200, `webhook : HTTP ${hook.status}`);
}

/** Le temps passe : le paiement a été lancé il y a `minutes` minutes. */
export async function agePayment(id: string, minutes: number): Promise<void> {
    const { error } = await service.from('payments').update({ created_at: new Date(Date.now() - minutes * 60_000).toISOString() }).eq('id', id);
    assert.equal(error, null, error?.message);
}

export async function paymentsOfReservation(id: string): Promise<Row[]> {
    const { data, error } = await service.from('payments').select('*').eq('table_reservation_id', id).order('created_at');
    assert.equal(error, null, error?.message);
    return (data ?? []) as Row[];
}

/** Réservations d'un client (toutes, par la clé de service). */
export async function reservationsOf(clientId: string): Promise<Row[]> {
    const { data, error } = await service.from('table_reservations').select('*').eq('client_id', clientId).order('created_at');
    assert.equal(error, null, error?.message);
    return (data ?? []) as Row[];
}

/** Réservations qui tiennent une table sans qu'aucun acompte n'ait été payé (attente, demande, ou confirmée gratuite). */
export async function heldWithoutPayment(clientId: string): Promise<Row[]> {
    return sql(`SELECT id, booking_state, total_amount, paid_amount, hold_expires_at FROM public.table_reservations
                 WHERE client_id = $1 AND paid_amount = 0
                   AND ((booking_state = 'EN_ATTENTE_PAIEMENT' AND hold_expires_at > now())
                        OR booking_state IN ('EN_ATTENTE_ACCEPTATION', 'CONFIRMEE'))`, [clientId]);
}

/** Lecture brute (lecture seule) d'une requête SQL sur la base locale. */
export async function sql<T extends Row = Row>(text: string, params: unknown[] = []): Promise<T[]> {
    return inspect(async (c) => (await c.query<T>(text, params)).rows);
}

/** Trace d'une attaque dans la sortie brute (lue au rapport). */
export function trace(tag: string, what: unknown): void {
    console.log(`[CV11A] ${tag} : ${typeof what === 'string' ? what : JSON.stringify(what)}`);
}

/** Établissement avec acompte et une seule table de 4 (la plus simple à saturer). */
export async function depositVenue(partner: TestPartner, perPerson = 5_000, spec: Parameters<typeof newVenue>[1] = {}): Promise<{ venue: string; table: string }> {
    const venue = await newVenue(partner, { deposit_per_person: perPerson, ...spec });
    const table = await newTable(partner, venue, 4);
    return { venue, table };
}

/** Réservation réussie par la fonction en base ; rend son identifiant. */
export async function reserved(client: Buyer, venue: string, opts: Parameters<typeof reserveRpc>[2] = {}): Promise<string> {
    const r = await reserveRpc(client, venue, opts);
    assert.equal(r.ok, true, `réservation : ${JSON.stringify(r)}`);
    return String(r.reservation_id);
}

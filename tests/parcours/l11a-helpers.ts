/**
 * Lot 11a — aides des suites de la réservation de tables (argent et sécurité). Base LOCALE seulement ; faux SamirPay
 * (aucun appel réel). Les montants attendus des suites sont calculés à la main dans chaque test, jamais par ces aides.
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { NextRequest } from 'next/server';
import { BASE_URL } from './helpers';
import { deliverWebhook, newBuyer, paymentById, providerSays, service, type Buyer, type PaymentRow } from './paiement-helpers';
import { newPartner, superadminId, type TestPartner } from './finance-helpers';
import { openConcurrentClient } from '../helpers/db';
import { platformSetting, setPlatformSetting } from './l10a-helpers';
import { POST as reserveHandler } from '../../app/api/restaurants/reserve-table/route';
import { POST as paymentCreateRoute } from '../../app/api/payments/create/route';

export type Row = Record<string, unknown>;

/** Ouvre le service des tables le temps d'une suite ; rend la fonction qui remet la valeur d'origine. */
export async function openTablesService(): Promise<() => Promise<void>> {
    const before = await platformSetting('features.tables_enabled');
    await setPlatformSetting('features.tables_enabled', true, 'test du lot 11a');
    return async () => setPlatformSetting('features.tables_enabled', before, 'test du lot 11a');
}

export interface VenueSpec {
    kind?: 'RESTAURANT' | 'BAR' | 'ESPACE';
    deposit_per_person?: number | null;
    confirmation_mode?: 'AUTO' | 'MANUELLE';
    slot_minutes?: number | null;
    /** Plages d'ouverture ; par défaut, ouvert 24 h sur 24 tous les jours. */
    hours?: Array<{ weekday: number; opens_at: string; closes_at: string }>;
    validate?: boolean;
    is_active?: boolean;
}

export const ALWAYS_OPEN = [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({ weekday, opens_at: '00:00', closes_at: '24:00' }));

/** Établissement d'une partenaire VALIDE, horaires posés, validé par l'administration (sauf validate: false). */
export async function newVenue(partner: TestPartner, spec: VenueSpec = {}): Promise<string> {
    const { data, error } = await service.from('venues').insert({
        partner_id: partner.partnerId,
        kind: spec.kind ?? 'RESTAURANT',
        name: `TEST Restaurant 11a ${randomUUID().slice(0, 8)}`,
        address: 'Corniche Ouest',
        city: 'Dakar',
        deposit_per_person: spec.deposit_per_person ?? null,
        confirmation_mode: spec.confirmation_mode ?? 'AUTO',
        slot_minutes: spec.slot_minutes ?? null,
        is_active: spec.is_active ?? true,
    }).select('id').single();
    assert.equal(error, null, `établissement : ${error?.message}`);
    const venueId = String(data!.id);
    await setHours(partner, venueId, spec.hours ?? ALWAYS_OPEN);
    if (spec.validate !== false) {
        const r = await decideVenue(venueId, 'VALIDER');
        assert.equal(r.ok, true, `validation : ${JSON.stringify(r)}`);
    }
    return venueId;
}

export async function setHours(partner: TestPartner, venueId: string, hours: VenueSpec['hours']): Promise<Row> {
    const { data, error } = await service.rpc('venue_hours_set', { p: { actor_id: partner.userId, venue_id: venueId, hours } });
    assert.equal(error, null, `venue_hours_set : ${error?.message}`);
    return data as Row;
}

export async function decideVenue(venueId: string, decision: string, reason: string | null = null, actor?: string): Promise<Row> {
    const { data, error } = await service.rpc('venue_validation_decide', {
        p: { actor_id: actor ?? await superadminId(), venue_id: venueId, decision, reason },
    });
    assert.equal(error, null, `venue_validation_decide : ${error?.message}`);
    return data as Row;
}

export async function newZone(partner: TestPartner, venueId: string, name = 'Terrasse'): Promise<string> {
    const { data, error } = await service.from('restaurant_zones').insert({ partner_id: partner.partnerId, venue_id: venueId, name }).select('id').single();
    assert.equal(error, null, `zone : ${error?.message}`);
    return String(data!.id);
}

export async function newTable(partner: TestPartner, venueId: string, capacity: number, opts: { number?: string; min?: number; zoneId?: string | null; active?: boolean } = {}): Promise<string> {
    const { data, error } = await service.from('restaurant_tables').insert({
        partner_id: partner.partnerId, venue_id: venueId, zone_id: opts.zoneId ?? null,
        table_number: opts.number ?? `T${randomUUID().slice(0, 6)}`, capacity, min_capacity: opts.min ?? 1, is_active: opts.active ?? true,
    }).select('id').single();
    assert.equal(error, null, `table : ${error?.message}`);
    return String(data!.id);
}

/** Date et heure de Dakar (= UTC) dans `minutes`, arrondies au quart d'heure suivant. */
export function startIn(minutes: number): { date: string; time: string } {
    const quarter = 15 * 60_000;
    const at = new Date(Math.ceil((Date.now() + minutes * 60_000) / quarter) * quarter);
    return { date: at.toISOString().slice(0, 10), time: at.toISOString().slice(11, 16) };
}

export function dayFromNow(days: number): string {
    return new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10);
}

/** Jour ISO (1 = lundi … 7 = dimanche) d'une date « AAAA-MM-JJ ». */
export function isoWeekday(date: string): number {
    const d = new Date(`${date}T00:00:00Z`).getUTCDay();
    return d === 0 ? 7 : d;
}

export interface ReserveOpts { date?: string; time?: string; guests?: number; tableId?: string | null; zoneId?: string | null; notes?: string }

/** Réservation par la fonction en base (mêmes contrôles que la route). */
export async function reserveRpc(client: Buyer, venueId: string, opts: ReserveOpts = {}): Promise<Row> {
    const { data, error } = await service.rpc('table_reserve', {
        p: {
            client_id: client.userId, venue_id: venueId,
            date: opts.date ?? dayFromNow(20), time: opts.time ?? '20:00', guests: opts.guests ?? 4,
            table_id: opts.tableId ?? null, zone_id: opts.zoneId ?? null, notes: opts.notes ?? null,
        },
    });
    assert.equal(error, null, `table_reserve : ${error?.message}`);
    return data as Row;
}

/** Réservation par la route (session du client). */
export async function reserveRoute(client: Buyer, body: Row): Promise<{ status: number; body: Row }> {
    const res = await reserveHandler(new NextRequest(`${BASE_URL}/api/restaurants/reserve-table`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${client.accessToken}` },
        body: JSON.stringify(body),
    }));
    return { status: res.status, body: (await res.json()) as Row };
}

/** Lance le paiement de l'acompte par la route (faux SamirPay) ; rend la réponse et le paiement créé. */
export async function startPayment(client: Buyer, reservationId: string, extra: Row = {}): Promise<{ status: number; body: Row; payment: PaymentRow | null }> {
    const res = await paymentCreateRoute(new NextRequest(`${BASE_URL}/api/payments/create`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${client.accessToken}` },
        body: JSON.stringify({ targetType: 'TABLE_RESERVATION', targetId: reservationId, operator: 'WAVE', payerPhone: client.phone9, ...extra }),
    }));
    const body = (await res.json()) as Row;
    const id = typeof body.payment_id === 'string' ? body.payment_id : typeof body.id === 'string' ? body.id : null;
    return { status: res.status, body, payment: id ? await paymentById(id) : null };
}

/** Acompte confirmé par le webhook (le faux SamirPay dit SUCCESS). */
export async function payConfirmed(client: Buyer, reservationId: string): Promise<PaymentRow> {
    const started = await startPayment(client, reservationId);
    assert.equal(started.status, 201, `paiement : HTTP ${started.status} ${JSON.stringify(started.body)}`);
    assert.ok(started.payment, 'paiement créé');
    providerSays(started.payment!, 'SUCCESS');
    const hook = await deliverWebhook(started.payment!);
    assert.equal(hook.status, 200, `webhook : HTTP ${hook.status}`);
    return paymentById(started.payment!.id);
}

export async function reservation(id: string): Promise<Row> {
    const { data, error } = await service.from('table_reservations').select('*').eq('id', id).single();
    assert.equal(error, null, `réservation ${id} : ${error?.message}`);
    return data as Row;
}

/**
 * Horloge des tests : déplace une réservation dans le temps (début, fin d'attente, échéance de réponse) par une écriture
 * locale avec le drapeau des fonctions en base (la garde refuse toute autre écriture). `startMinutes` : début dans
 * N minutes (négatif = commencé). Les autres champs : relatifs à maintenant, en minutes.
 */
export async function shiftReservation(id: string, opts: { startMinutes?: number; holdMinutes?: number; responseMinutes?: number }): Promise<void> {
    const c = await openConcurrentClient({ applicationName: 'ev-test-l11a' });
    try {
        await c.query(`SELECT set_config('event_village.table_booking', 'on', true)`);
        if (opts.startMinutes !== undefined) {
            await c.query(`UPDATE public.table_reservations
                              SET reservation_date = ((now() + make_interval(mins => $2::int)) AT TIME ZONE 'Africa/Dakar')::date,
                                  reservation_time = ((now() + make_interval(mins => $2::int)) AT TIME ZONE 'Africa/Dakar')::time(0)
                            WHERE id = $1`, [id, opts.startMinutes]);
        }
        if (opts.holdMinutes !== undefined) {
            await c.query(`UPDATE public.table_reservations SET hold_expires_at = now() + make_interval(mins => $2::int) WHERE id = $1`, [id, opts.holdMinutes]);
        }
        if (opts.responseMinutes !== undefined) {
            await c.query(`UPDATE public.table_reservations SET response_due_at = now() + make_interval(mins => $2::int) WHERE id = $1`, [id, opts.responseMinutes]);
        }
        await c.commit();
    } finally {
        await c.close();
    }
}

/**
 * Attentes (paiement ou réponse) d'un client rendues échues : la limite de demandes en attente ne gêne pas les tests suivants.
 * Contre-vérification de la 11a (T2, modification signalée au rapport) : la limite compte aussi les réservations
 * gratuites confirmées à venir ; celles du client sont closes (« Annulée par le client », rien à rendre).
 */
export async function releasePending(clientId: string): Promise<void> {
    const c = await openConcurrentClient({ applicationName: 'ev-test-l11a' });
    try {
        await c.query(`SELECT set_config('event_village.table_booking', 'on', true)`);
        await c.query(`UPDATE public.table_reservations SET booking_state = 'EXPIREE', hold_expires_at = NULL
                        WHERE client_id = $1 AND booking_state IN ('EN_ATTENTE_PAIEMENT', 'EN_ATTENTE_ACCEPTATION') AND paid_amount = 0`, [clientId]);
        await c.query(`UPDATE public.table_reservations
                          SET booking_state = 'ANNULEE_CLIENT', cancel_origin = 'CLIENT', cancel_reason = 'Libérée entre deux tests',
                              cancelled_at = now(), cancelled_by = client_id, payment_status = 'CANCELLED', updated_at = now()
                        WHERE client_id = $1 AND booking_state = 'CONFIRMEE' AND paid_amount = 0`, [clientId]);
        await c.commit();
    } finally {
        await c.close();
    }
}

export async function tick(): Promise<Row> {
    const { data, error } = await service.rpc('table_reservations_tick');
    assert.equal(error, null, `table_reservations_tick : ${error?.message}`);
    return data as Row;
}

/** Avis en file pour un destinataire et une réservation : « TYPE:CANAL », triés. */
export async function outboxOf(userId: string, reservationId: string): Promise<string[]> {
    // Filtre en base (la lecture REST s'arrête à 1 000 lignes)
    const { data, error } = await service.from('notification_outbox').select('type, channel')
        .eq('recipient_user_id', userId).eq('template_data->>reservation_id', reservationId);
    assert.equal(error, null, `boîte d'envoi : ${error?.message}`);
    return (data ?? []).map((r) => `${String(r.type)}:${String(r.channel)}`).sort();
}

/** Les 4 canaux d'un type : cloche, push, email, SMS. */
export function allChannels(type: string): string[] {
    return ['EMAIL', 'IN_APP', 'PUSH', 'SMS'].map((c) => `${type}:${c}`);
}

export async function refundsOf(reservationId: string): Promise<Row[]> {
    const { data, error } = await service.from('refunds')
        .select('amount, facial_part, service_part, aggregator_fee_share, aggregator_fee_bearer, net_revenue_reversal, kind, payment_id, payments!inner(table_reservation_id)')
        .eq('payments.table_reservation_id', reservationId).order('amount');
    assert.equal(error, null, error?.message);
    return (data ?? []) as Row[];
}

/** Somme signée des écritures du grand livre d'un paiement (crédit positif, débit négatif). */
export async function ledgerOfPayment(paymentId: string, entryType: string): Promise<number> {
    const { data, error } = await service.from('finance_ledger').select('amount').eq('payment_id', paymentId).eq('entry_type', entryType);
    assert.equal(error, null, error?.message);
    return (data ?? []).reduce((sum, r) => sum + Number(r.amount), 0);
}

export { newBuyer, newPartner, platformSetting, setPlatformSetting, superadminId, type Buyer, type TestPartner };

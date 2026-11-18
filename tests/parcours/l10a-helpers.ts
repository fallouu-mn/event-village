/**
 * Lot 10a — aides des suites de la réservation de salles (argent et sécurité). Base LOCALE seulement ; faux SamirPay
 * (aucun appel réel). Les montants attendus des suites sont calculés à la main dans chaque test, jamais par ces aides.
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { NextRequest } from 'next/server';
import { BASE_URL } from './helpers';
import { deliverWebhook, newBuyer, paymentById, providerSays, service, type Buyer, type PaymentRow } from './paiement-helpers';
import { newPartner, superadminId, type TestPartner } from './finance-helpers';
import { POST as reserveHandler } from '../../app/api/halls/reserve/route';
import { POST as paymentCreateRoute } from '../../app/api/payments/create/route';

export type Row = Record<string, unknown>;

/** Réglage de la plateforme par la fonction du Superadmin (valeur relue après). */
export async function setPlatformSetting(key: string, value: unknown, reason = 'test du lot 10a'): Promise<void> {
    const { data, error } = await service.rpc('finance_setting_set', { p_key: key, p_value: { value }, p_actor: await superadminId(), p_reason: reason });
    assert.equal(error, null, `réglage ${key} : ${error?.message}`);
    assert.equal((data as { ok?: boolean } | null)?.ok, true, `réglage ${key} refusé : ${JSON.stringify(data)}`);
}

export async function platformSetting(key: string): Promise<unknown> {
    const { data, error } = await service.from('platform_settings').select('value').eq('key', key).single();
    assert.equal(error, null, `réglage ${key} : ${error?.message}`);
    return (data!.value as { value: unknown }).value;
}

/** Ouvre le service des salles le temps d'une suite ; rend la fonction qui remet la valeur d'origine. */
export async function openHallsService(): Promise<() => Promise<void>> {
    const before = await platformSetting('features.halls_enabled');
    await setPlatformSetting('features.halls_enabled', true);
    return async () => setPlatformSetting('features.halls_enabled', before);
}

export interface HallSpec {
    price_per_day?: number | null;
    price_per_hour?: number | null;
    deposit_mode?: 'POURCENTAGE' | 'MONTANT_FIXE';
    deposit_value?: number | null;
    cancellation_policy?: 'SOUPLE' | 'MODEREE' | 'STRICTE';
    validate?: boolean;
    is_active?: boolean;
}

/** Salle d'une partenaire VALIDE, validée par l'administration (sauf validate: false). */
export async function newHall(partner: TestPartner, spec: HallSpec = {}): Promise<string> {
    const { data, error } = await service.from('halls').insert({
        partner_id: partner.partnerId,
        name: `TEST Salle 10a ${randomUUID().slice(0, 8)}`,
        capacity: 200,
        price_per_day: spec.price_per_day === undefined ? 200_000 : spec.price_per_day,
        price_per_hour: spec.price_per_hour ?? null,
        deposit_mode: spec.deposit_mode ?? 'POURCENTAGE',
        deposit_value: spec.deposit_value ?? null,
        cancellation_policy: spec.cancellation_policy ?? 'MODEREE',
        city: 'Dakar',
        is_active: spec.is_active ?? true,
    }).select('id, validation_status').single();
    assert.equal(error, null, `salle : ${error?.message}`);
    const hallId = String(data!.id);
    if (spec.validate !== false) await decideHall(hallId, 'VALIDER');
    return hallId;
}

export async function decideHall(hallId: string, decision: string, reason: string | null = null, actor?: string): Promise<Row> {
    const { data, error } = await service.rpc('hall_validation_decide', {
        p: { actor_id: actor ?? await superadminId(), hall_id: hallId, decision, reason },
    });
    assert.equal(error, null, `hall_validation_decide : ${error?.message}`);
    return data as Row;
}

export function dayFromNow(days: number): string {
    const d = new Date(Date.now() + days * 86_400_000);
    return d.toISOString().slice(0, 10);
}

/** Réservation par la fonction en base (mêmes contrôles que la route). */
export async function reserveRpc(client: Buyer, hallId: string, opts: { days?: number; startInDays?: number; mode?: 'JOUR' | 'HEURE'; startTime?: string; hours?: number; startDate?: string } = {}): Promise<Row> {
    const mode = opts.mode ?? 'JOUR';
    const { data, error } = await service.rpc('hall_reserve', {
        p: {
            client_id: client.userId,
            hall_id: hallId,
            mode,
            start_date: opts.startDate ?? dayFromNow(opts.startInDays ?? 60),
            units: mode === 'HEURE' ? (opts.hours ?? 4) : (opts.days ?? 1),
            start_time: mode === 'HEURE' ? (opts.startTime ?? '18:00') : null,
        },
    });
    assert.equal(error, null, `hall_reserve : ${error?.message}`);
    return data as Row;
}

/** Réservation par la route (session du client). */
export async function reserveRoute(client: Buyer, body: Row): Promise<{ status: number; body: Row }> {
    const res = await reserveHandler(new NextRequest(`${BASE_URL}/api/halls/reserve`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${client.accessToken}` },
        body: JSON.stringify(body),
    }));
    return { status: res.status, body: (await res.json()) as Row };
}

/** Lance un paiement de salle par la route (faux SamirPay) ; rend la réponse et le paiement créé. */
export async function startPayment(client: Buyer, reservationId: string, part: 'ACOMPTE' | 'SOLDE' | 'INTEGRAL' | undefined, extra: Row = {}): Promise<{ status: number; body: Row; payment: PaymentRow | null }> {
    const res = await paymentCreateRoute(new NextRequest(`${BASE_URL}/api/payments/create`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${client.accessToken}` },
        body: JSON.stringify({ targetType: 'HALL_RESERVATION', targetId: reservationId, part, operator: 'WAVE', payerPhone: client.phone9, ...extra }),
    }));
    const body = (await res.json()) as Row;
    const id = typeof body.payment_id === 'string' ? body.payment_id : typeof body.id === 'string' ? body.id : null;
    return { status: res.status, body, payment: id ? await paymentById(id) : null };
}

/** Paiement de salle confirmé par le webhook (le faux SamirPay dit SUCCESS). */
export async function payConfirmed(client: Buyer, reservationId: string, part: 'ACOMPTE' | 'SOLDE' | 'INTEGRAL'): Promise<PaymentRow> {
    const started = await startPayment(client, reservationId, part);
    assert.equal(started.status, 201, `paiement ${part} : HTTP ${started.status} ${JSON.stringify(started.body)}`);
    assert.ok(started.payment, 'paiement créé');
    providerSays(started.payment!, 'SUCCESS');
    const hook = await deliverWebhook(started.payment!);
    assert.equal(hook.status, 200, `webhook : HTTP ${hook.status}`);
    return paymentById(started.payment!.id);
}

export async function reservation(id: string): Promise<Row> {
    const { data, error } = await service.from('hall_reservations').select('*').eq('id', id).single();
    assert.equal(error, null, `réservation ${id} : ${error?.message}`);
    return data as Row;
}

/** Avis en file pour un destinataire et une réservation : « TYPE:CANAL », triés. */
export async function outboxOf(userId: string, reservationId: string): Promise<string[]> {
    const { data, error } = await service.from('notification_outbox').select('type, channel, template_data').eq('recipient_user_id', userId);
    assert.equal(error, null, `boîte d'envoi : ${error?.message}`);
    return (data ?? [])
        .filter((r) => (r.template_data as Row | null)?.reservation_id === reservationId)
        .map((r) => `${String(r.type)}:${String(r.channel)}`)
        .sort();
}

export { newBuyer, newPartner, type Buyer, type TestPartner };

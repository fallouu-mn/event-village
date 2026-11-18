/**
 * Lot 10a — annuler une réservation de salle, rembourser, délai de paiement dépassé (S5, S6). Montants calculés à la
 * main. Réglages par défaut : souple 7 jours, modérée 30 et 7 jours, stricte 30 jours, part intermédiaire 50 %, frais
 * de service 5 %, frais Wave 1,5 % à la charge d'Event Village.
 *
 *  C1. Seuils exacts de chaque règle (hall_cancel_percent) : « jusqu'à N jours avant » = au moins N × 24 h avant.
 *  C2. Annulation par le client : modérée à plus de 30 jours (tout), entre 7 et 30 jours (50 % de l'acompte et du solde),
 *      stricte à moins de 30 jours (rien) ; grand livre (part de la salle reprise), revenu d'Event Village corrigé.
 *  C3. Annulation par la salle (tout, motif obligatoire) et par Event Village (tout, droit des remboursements).
 *  C4. Parrainage corrigé : commission annulée au remboursement total, recalculée au prorata au remboursement de 50 %.
 *  C5. Délai de paiement dépassé : réservation annulée, acompte traité selon la règle à l'instant de l'échéance ;
 *      passage idempotent ; rappel du solde 3 jours avant l'échéance, une seule fois.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { assertLot10aInvariants } from '../helpers/lot10a-invariants';
import { inspect } from '../helpers/db';
import { service, type Buyer } from './paiement-helpers';
import type { TestPartner } from './finance-helpers';
import { BASE_URL } from './helpers';
import { newAdmin } from './notif-helpers';
import { POST as clientCancelRoute } from '../../app/api/halls/reservations/[id]/cancel/route';
import { POST as adminCancelRoute } from '../../app/api/admin/halls/reservations/[id]/cancel/route';
import { POST as partnerStatusRoute } from '../../app/api/partner/halls/reservations/[id]/status/route';
import {
    dayFromNow, newBuyer, newHall, newPartner, openHallsService, outboxOf, payConfirmed, reservation, reserveRpc, type Row,
} from './l10a-helpers';

let restore: () => Promise<void>;
let partner: TestPartner;

before(async () => {
    restore = await openHallsService();
    partner = await newPartner('l10a-annul');
});

after(async () => {
    await restore();
    await assertLot10aInvariants('l10a-annulation');
});

const n = (v: unknown): number => Number(v);

async function percent(policy: string, hoursBefore: number): Promise<number> {
    return inspect(async (c) => {
        const { rows } = await c.query<{ p: string }>(
            `SELECT public.hall_cancel_percent(public.hall_cancel_terms($1), timestamp '2027-06-01 00:00' + make_interval(secs => $2), timestamp '2027-06-01 00:00') AS p`,
            [policy, Math.round(hoursBefore * 3600)]);
        return Number(rows[0].p);
    });
}

async function route(handler: typeof clientCancelRoute, path: string, id: string, token: string, body: Row = {}): Promise<{ status: number; body: Row }> {
    const res = await handler(new NextRequest(`${BASE_URL}${path}`, {
        method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify(body),
    }), { params: Promise.resolve({ id }) });
    return { status: res.status, body: (await res.json()) as Row };
}

async function refundsOf(reservationId: string): Promise<Row[]> {
    const { data, error } = await service.from('refunds')
        .select('amount, facial_part, service_part, aggregator_fee_share, aggregator_fee_bearer, net_revenue_reversal, kind, payment_id, payments!inner(hall_reservation_id)')
        .eq('payments.hall_reservation_id', reservationId).order('amount');
    assert.equal(error, null, error?.message);
    return (data ?? []) as Row[];
}

/** Somme signée des écritures du grand livre d'un paiement (crédit positif, débit négatif). */
async function ledgerOfPayment(paymentId: string, entryType: string): Promise<number> {
    const { data, error } = await service.from('finance_ledger').select('amount').eq('payment_id', paymentId).eq('entry_type', entryType);
    assert.equal(error, null, error?.message);
    return (data ?? []).reduce((sum, r) => sum + Number(r.amount), 0);
}

describe('C1. Seuils des règles d’annulation (au moins N × 24 h avant le début)', () => {
    const cases: Array<[string, number, number]> = [
        ['SOUPLE', 7 * 24, 100], ['SOUPLE', 7 * 24 - 1 / 3600, 50], ['SOUPLE', 1, 50], ['SOUPLE', -1, 0],
        ['MODEREE', 30 * 24, 100], ['MODEREE', 30 * 24 - 1 / 3600, 50], ['MODEREE', 7 * 24, 50], ['MODEREE', 7 * 24 - 1 / 3600, 0],
        ['STRICTE', 100 * 24, 50], ['STRICTE', 30 * 24, 50], ['STRICTE', 30 * 24 - 1 / 3600, 0], ['STRICTE', 1, 0],
    ];
    for (const [policy, hours, expected] of cases) {
        test(`${policy}, ${hours >= 0 ? `${Math.round(hours * 3600)} s` : 'après le début'} avant → ${expected} %`, async () => {
            assert.equal(await percent(policy, hours), expected);
        });
    }
});

describe('C2. Annulation par le client : règle figée sur la réservation', () => {
    test('modérée, plus de 30 jours avant, acompte payé (126 000) : tout remboursé ; part de la salle reprise ; Event Village garde 0', async () => {
        const client = await newBuyer('l10a-annul-1');
        const id = String((await reserveRpc(client, await newHall(partner, { price_per_day: 200_000 }), { days: 2, startInDays: 45 })).reservation_id);
        const dep = await payConfirmed(client, id, 'ACOMPTE');
        const res = await route(clientCancelRoute, `/api/halls/reservations/${id}/cancel`, id, client.accessToken);
        assert.equal(res.status, 200, JSON.stringify(res.body));
        assert.equal(res.body.message, 'Réservation annulée. Vous êtes remboursé de 126 000 F CFA sur votre compte de paiement.');
        const row = await reservation(id);
        assert.deepEqual([row.booking_state, row.status, n(row.refund_percent), n(row.refunded_amount), row.cancel_origin],
            ['ANNULEE_CLIENT', 'ANNULEE', 100, 126_000, 'CLIENT']);
        const refunds = await refundsOf(id);
        assert.deepEqual(refunds.map((r) => [n(r.amount), n(r.facial_part), n(r.service_part), n(r.aggregator_fee_share), r.aggregator_fee_bearer, n(r.net_revenue_reversal), r.kind]),
            [[126_000, 120_000, 6_000, 1_890, 'EVENT_VILLAGE', 6_000, 'REFUND']]);
        assert.equal(await ledgerOfPayment(dep.id, 'VENTE'), 120_000, 'vente de la salle');
        assert.equal(await ledgerOfPayment(dep.id, 'REMBOURSEMENT'), -120_000, 'part de la salle reprise');
        assert.ok((await outboxOf(client.userId, id)).includes('HALL_RESERVATION_CANCELLED:SMS'));
        assert.ok((await outboxOf(partner.userId, id)).includes('HALL_RESERVATION_CANCELLED_PRO:IN_APP'));
        const again = await route(clientCancelRoute, `/api/halls/reservations/${id}/cancel`, id, client.accessToken);
        assert.deepEqual([again.status, again.body.code], [409, 'NOT_CANCELLABLE']);
    });

    test('modérée, entre 7 et 30 jours avant, payée en totalité (420 000) : 50 % de chaque paiement (63 000 + 147 000)', async () => {
        const client = await newBuyer('l10a-annul-2');
        const id = String((await reserveRpc(client, await newHall(partner, { price_per_day: 200_000 }), { days: 2, startInDays: 20 })).reservation_id);
        await payConfirmed(client, id, 'ACOMPTE');
        await payConfirmed(client, id, 'SOLDE');
        const res = await route(clientCancelRoute, `/api/halls/reservations/${id}/cancel`, id, client.accessToken);
        assert.equal(res.status, 200, JSON.stringify(res.body));
        const refunds = await refundsOf(id);
        assert.deepEqual(refunds.map((r) => [n(r.amount), n(r.facial_part), n(r.service_part), n(r.aggregator_fee_share)]),
            [[63_000, 60_000, 3_000, 945], [147_000, 140_000, 7_000, 2_205]]);
        const row = await reservation(id);
        assert.deepEqual([n(row.refund_percent), n(row.refunded_amount), n(row.paid_amount)], [50, 210_000, 420_000]);
    });

    test('stricte, moins de 30 jours avant : rien remboursé ; la date est libérée', async () => {
        const client = await newBuyer('l10a-annul-3');
        const hall = await newHall(partner, { price_per_day: 200_000, cancellation_policy: 'STRICTE' });
        const id = String((await reserveRpc(client, hall, { days: 1, startInDays: 20 })).reservation_id);
        await payConfirmed(client, id, 'ACOMPTE');
        const res = await route(clientCancelRoute, `/api/halls/reservations/${id}/cancel`, id, client.accessToken);
        assert.equal(res.body.message, 'Réservation annulée. Selon les conditions de la salle, aucun remboursement n’est dû.');
        assert.deepEqual(await refundsOf(id), []);
        assert.deepEqual([(await reservation(id)).booking_state, n((await reservation(id)).refund_percent)], ['ANNULEE_CLIENT', 0]);
        assert.equal((await reserveRpc(await newBuyer('l10a-annul-3b'), hall, { days: 1, startInDays: 20 })).ok, true, 'date de nouveau libre');
    });

    test('réservation d’un autre client : « Réservation introuvable », rien ne change', async () => {
        const owner = await newBuyer('l10a-annul-4');
        const id = String((await reserveRpc(owner, await newHall(partner), { startInDays: 40 })).reservation_id);
        const res = await route(clientCancelRoute, `/api/halls/reservations/${id}/cancel`, id, (await newBuyer('l10a-annul-intrus')).accessToken);
        assert.deepEqual([res.status, res.body.error], [404, 'Réservation introuvable.']);
        assert.equal((await reservation(id)).booking_state, 'EN_ATTENTE_PAIEMENT');
    });
});

describe('C3. Annulation par la salle ou par Event Village : remboursement total', () => {
    test('la salle (règle stricte) : motif obligatoire, puis tout remboursé (126 000)', async () => {
        const client = await newBuyer('l10a-annul-5');
        const id = String((await reserveRpc(client, await newHall(partner, { price_per_day: 200_000, cancellation_policy: 'STRICTE' }), { days: 2, startInDays: 15 })).reservation_id);
        await payConfirmed(client, id, 'ACOMPTE');
        const noReason = await route(partnerStatusRoute, `/api/partner/halls/reservations/${id}/status`, id, partner.accessToken, { action: 'CANCEL' });
        assert.deepEqual([noReason.status, noReason.body.code], [400, 'REASON_REQUIRED']);
        const res = await route(partnerStatusRoute, `/api/partner/halls/reservations/${id}/status`, id, partner.accessToken, { action: 'CANCEL', reason: 'Dégât des eaux dans la salle' });
        assert.equal(res.status, 200, JSON.stringify(res.body));
        assert.equal(res.body.message, 'Réservation annulée. Le client est remboursé de 126 000 F CFA.');
        assert.deepEqual([(await reservation(id)).booking_state, n((await reservation(id)).refunded_amount)], ['ANNULEE_SALLE', 126_000]);
    });

    test('Event Village : un admin sans le droit des remboursements est refusé ; avec lui, tout est remboursé', async () => {
        const client = await newBuyer('l10a-annul-6');
        const id = String((await reserveRpc(client, await newHall(partner, { price_per_day: 200_000 }), { days: 1, startInDays: 25 })).reservation_id);
        await payConfirmed(client, id, 'INTEGRAL');
        const noRight = await newAdmin('l10a-sans-droit', ['events.read']);
        const refused = await route(adminCancelRoute, `/api/admin/halls/reservations/${id}/cancel`, id, noRight.accessToken, { reason: 'Fraude signalée' });
        assert.equal(refused.status, 403, JSON.stringify(refused.body));
        const allowed = await newAdmin('l10a-remb', ['refunds.manage']);
        const res = await route(adminCancelRoute, `/api/admin/halls/reservations/${id}/cancel`, id, allowed.accessToken, { reason: 'Salle fermée par la mairie' });
        assert.equal(res.status, 200, JSON.stringify(res.body));
        assert.deepEqual([(await reservation(id)).booking_state, n((await reservation(id)).refunded_amount)], ['ANNULEE_EV', 210_000]);
    });
});

describe('C4. Parrainage corrigé (§82, §100)', () => {
    test('commission calculée sur le revenu net, disponible après la date ; annulée au remboursement total', async () => {
        const sponsor = await newBuyer('l10a-parrain');
        const client = await newBuyer('l10a-filleul');
        const { data: cfg } = await service.from('referral_config').select('rate_n1, rate_n2, duration_months')
            .eq('sponsor_status', 'STANDARD').eq('referral_type', 'CLIENT_TO_CLIENT').eq('is_active', true).maybeSingle();
        const rate = Number(cfg?.rate_n1 ?? 5);
        const { error } = await service.from('referral_relationships').insert({
            sponsor_id: sponsor.userId, referred_id: client.userId, referral_type: 'CLIENT_TO_CLIENT', sponsor_status_at_creation: 'STANDARD',
            rate_n1_at_creation: rate, rate_n2_at_creation: Number(cfg?.rate_n2 ?? 2), duration_months: Number(cfg?.duration_months ?? 12),
            expires_at: new Date(Date.now() + 365 * 86_400_000).toISOString(), is_active: true,
        });
        assert.equal(error, null, error?.message);
        const start = dayFromNow(50);
        const id = String((await reserveRpc(client, await newHall(partner, { price_per_day: 200_000 }), { days: 2, startDate: start })).reservation_id);
        const dep = await payConfirmed(client, id, 'ACOMPTE');
        const { error: calcErr } = await service.rpc('calculate_referral_commissions', { p_payment_id: dep.id });
        assert.equal(calcErr, null, calcErr?.message);
        const { data: comm } = await service.from('referral_commissions').select('amount, status, available_at, eligible_net_revenue')
            .eq('payment_id', dep.id).eq('generation', 'N1').single();
        assert.equal(n(comm!.eligible_net_revenue), 4_110, 'revenu net d’Event Village sur l’acompte');
        assert.equal(n(comm!.amount), Math.round(4_110 * rate) / 100, `commission ${rate} %`);
        const end = Date.parse(`${dayFromNow(52)}T00:00:00Z`);
        assert.ok(new Date(String(comm!.available_at)).getTime() >= end + 7 * 86_400_000 - 1000, 'disponible après la fin de la réservation + 7 jours');

        const res = await route(partnerStatusRoute, `/api/partner/halls/reservations/${id}/status`, id, partner.accessToken, { action: 'CANCEL', reason: 'Fermeture administrative' });
        assert.equal(res.status, 200, JSON.stringify(res.body));
        const { data: after } = await service.from('referral_commissions').select('status, cancellation_reason').eq('payment_id', dep.id).eq('generation', 'N1').eq('kind', 'COMMISSION');
        assert.ok((after ?? []).some((c) => c.status === 'CANCELLED' && c.cancellation_reason === 'REMBOURSEMENT'), JSON.stringify(after));
    });
});

describe('C5. Délai de paiement dépassé, rappel du solde', () => {
    test('solde non payé à l’échéance : annulée (« Délai de paiement dépassé »), 50 % de l’acompte rendu (63 000), passage idempotent', async () => {
        const client = await newBuyer('l10a-delai');
        const id = String((await reserveRpc(client, await newHall(partner, { price_per_day: 200_000 }), { days: 2, startInDays: 20 })).reservation_id);
        await payConfirmed(client, id, 'ACOMPTE');
        // Le temps passe : l'échéance du solde est atteinte (20 jours avant la date : règle modérée, tranche de 50 %)
        await service.from('hall_reservations').update({ balance_due_at: new Date(Date.now() - 60_000).toISOString() }).eq('id', id);
        const { data: tick, error } = await service.rpc('hall_reservations_tick');
        assert.equal(error, null, error?.message);
        assert.ok(Number((tick as Row).deadline_passed) >= 1, JSON.stringify(tick));
        const row = await reservation(id);
        assert.deepEqual([row.booking_state, row.cancel_origin, n(row.refund_percent), n(row.refunded_amount)], ['DELAI_DEPASSE', 'DELAI', 50, 63_000]);
        assert.deepEqual((await refundsOf(id)).map((r) => n(r.amount)), [63_000]);
        assert.ok((await outboxOf(client.userId, id)).includes('HALL_PAYMENT_DEADLINE_PASSED:SMS'));
        const { data: tick2 } = await service.rpc('hall_reservations_tick');
        assert.deepEqual((await refundsOf(id)).map((r) => n(r.amount)), [63_000], `second passage sans effet : ${JSON.stringify(tick2)}`);
    });

    test('rappel du solde 3 jours avant l’échéance, une seule fois', async () => {
        const client = await newBuyer('l10a-rappel');
        const id = String((await reserveRpc(client, await newHall(partner), { days: 1, startInDays: 30 })).reservation_id);
        await payConfirmed(client, id, 'ACOMPTE');
        await service.from('hall_reservations').update({ balance_due_at: new Date(Date.now() + 2 * 86_400_000).toISOString() }).eq('id', id);
        await service.rpc('hall_reservations_tick');
        await service.rpc('hall_reservations_tick');
        const reminders = (await outboxOf(client.userId, id)).filter((t) => t.startsWith('HALL_BALANCE_REMINDER:'));
        assert.ok(reminders.includes('HALL_BALANCE_REMINDER:IN_APP'), reminders.join(', '));
        assert.equal(reminders.filter((t) => t.endsWith(':SMS')).length, 1, `un seul SMS de rappel : ${reminders.join(', ')}`);
        assert.equal(new Set(reminders).size, reminders.length, 'une ligne par canal, deux passages');
        assert.equal((await reservation(id)).booking_state, 'ACOMPTE_PAYE');
    });
});

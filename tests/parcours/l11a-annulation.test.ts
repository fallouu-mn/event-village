/**
 * Lot 11a — annuler, refuser, demande sans réponse, client absent, rappel (tâche planifiée), parrainage. Montants
 * calculés à la main : acompte 5 000 F × 4 = 20 000, frais 1 000, payé 21 000, 1,5 % Wave = 315 à la charge d'Event
 * Village. Réglages par défaut : annulation gratuite jusqu'à 2 h avant, réponse sous 2 h, absence 30 minutes après
 * l'heure, rappel 3 h avant.
 *
 *  C1. Seuil de l'annulation par le client : « jusqu'à 2 h avant » = au moins 2 h avant (inclus).
 *  C2. Client : à plus de 2 h, tout rendu (21 000) ; à moins de 2 h, rien (l'établissement garde l'acompte) ; gratuite.
 *  C3. Établissement (motif obligatoire) et Event Village (droit des remboursements) : tout rendu.
 *  C4. Demande refusée, demande sans réponse sous 2 h : tout rendu ; attente de paiement échue : avis.
 *  C5. Client absent 30 minutes après l'heure : « Absent », table libérée, acompte gardé ; pas avant 30 minutes.
 *  C6. Rappel 3 h avant, une seule fois ; tâche planifiée idempotente.
 *  C7. Parrainage corrigé : commission sur le revenu net (685), annulée au remboursement total.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { assertLot11aInvariants } from '../helpers/lot11a-invariants';
import { inspect } from '../helpers/db';
import { service } from './paiement-helpers';
import { BASE_URL } from './helpers';
import { newAdmin } from './notif-helpers';
import { POST as clientCancelRoute } from '../../app/api/tables/reservations/[id]/cancel/route';
import { POST as adminCancelRoute } from '../../app/api/admin/tables/reservations/[id]/cancel/route';
import { PATCH as partnerActionRoute } from '../../app/api/partner/tables/reservations/[id]/route';
import {
    allChannels, dayFromNow, ledgerOfPayment, newBuyer, newPartner, newTable, newVenue, openTablesService, outboxOf, payConfirmed,
    refundsOf, reservation, reserveRpc, shiftReservation, startIn, tick, type Row, type TestPartner,
} from './l11a-helpers';

let restore: () => Promise<void>;
let partner: TestPartner;

before(async () => {
    restore = await openTablesService();
    partner = await newPartner('l11a-annul');
});

after(async () => {
    await restore();
    await assertLot11aInvariants('l11a-annulation');
});

const n = (v: unknown): number => Number(v);

async function post(handler: typeof clientCancelRoute, path: string, id: string, token: string, body: Row = {}): Promise<{ status: number; body: Row }> {
    const res = await handler(new NextRequest(`${BASE_URL}${path}`, {
        method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify(body),
    }), { params: Promise.resolve({ id }) });
    return { status: res.status, body: (await res.json()) as Row };
}

async function partnerAction(id: string, token: string, body: Row): Promise<{ status: number; body: Row }> {
    const res = await partnerActionRoute(new NextRequest(`${BASE_URL}/api/partner/tables/reservations/${id}`, {
        method: 'PATCH', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify(body),
    }), { params: Promise.resolve({ id }) });
    return { status: res.status, body: (await res.json()) as Row };
}

/** Réservation avec acompte payé (5 000 × 4 = 21 000 payés), début dans `startMinutes` minutes. */
async function paidReservation(label: string, startMinutes: number, mode: 'AUTO' | 'MANUELLE' = 'AUTO') {
    const client = await newBuyer(label);
    const venue = await newVenue(partner, { deposit_per_person: 5_000, confirmation_mode: mode });
    const table = await newTable(partner, venue, 4);
    const r = await reserveRpc(client, venue, startIn(startMinutes));
    assert.equal(r.ok, true, JSON.stringify(r));
    const id = String(r.reservation_id);
    const pay = await payConfirmed(client, id);
    return { client, venue, table, id, pay };
}

async function clientCancel(id: string, token: string) {
    return post(clientCancelRoute, `/api/tables/reservations/${id}/cancel`, id, token);
}

describe('C1. Seuil de l’annulation gratuite (au moins 2 h avant l’heure)', () => {
    const cases: Array<[number, number]> = [[2 * 3600, 100], [2 * 3600 - 1, 0], [3 * 86_400, 100], [60, 0], [-60, 0]];
    for (const [seconds, expected] of cases) {
        test(`${seconds} s avant → ${expected} %`, async () => {
            const p = await inspect(async (c) => {
                const { rows } = await c.query<{ p: string }>(
                    `SELECT public.table_client_refund_percent(timestamp '2027-06-01 20:00' , timestamp '2027-06-01 20:00' - make_interval(secs => $1), 2) AS p`, [seconds]);
                return Number(rows[0].p);
            });
            assert.equal(p, expected);
        });
    }
});

describe('C2. Annulation par le client', () => {
    test('à 3 h de l’heure : tout rendu (21 000 : 20 000 + 1 000 ; 315 à la charge d’Event Village) ; part de l’établissement reprise ; avis', async () => {
        const { client, id, pay } = await paidReservation('l11a-annul-1', 180);
        const res = await clientCancel(id, client.accessToken);
        assert.equal(res.status, 200, JSON.stringify(res.body));
        assert.equal(res.body.message, 'Réservation annulée. Vous êtes remboursé de 21 000 F CFA sur votre compte de paiement.');
        const row = await reservation(id);
        assert.deepEqual([row.booking_state, row.status, n(row.refund_percent), n(row.refunded_amount), row.cancel_origin],
            ['ANNULEE_CLIENT', 'ANNULEE', 100, 21_000, 'CLIENT']);
        const refunds = await refundsOf(id);
        assert.deepEqual(refunds.map((r) => [n(r.amount), n(r.facial_part), n(r.service_part), n(r.aggregator_fee_share), r.aggregator_fee_bearer, n(r.net_revenue_reversal), r.kind]),
            [[21_000, 20_000, 1_000, 315, 'EVENT_VILLAGE', 1_000, 'REFUND']]);
        assert.equal(await ledgerOfPayment(pay.id, 'VENTE'), 20_000);
        assert.equal(await ledgerOfPayment(pay.id, 'REMBOURSEMENT'), -20_000);
        assert.deepEqual((await outboxOf(client.userId, id)).filter((t) => t.startsWith('TABLE_RESERVATION_CANCELLED:')), allChannels('TABLE_RESERVATION_CANCELLED'));
        assert.deepEqual((await outboxOf(partner.userId, id)).filter((t) => t.startsWith('TABLE_RESERVATION_CANCELLED_PRO:')), allChannels('TABLE_RESERVATION_CANCELLED_PRO'));
        const again = await clientCancel(id, client.accessToken);
        assert.deepEqual([again.status, again.body.code], [409, 'NOT_CANCELLABLE']);
    });

    test('à 1 h de l’heure : rien rendu, l’établissement garde l’acompte (20 000) ; la table est libérée', async () => {
        const { client, id, pay, venue } = await paidReservation('l11a-annul-2', 60);
        const res = await clientCancel(id, client.accessToken);
        assert.equal(res.status, 200, JSON.stringify(res.body));
        assert.equal(res.body.message, 'Réservation annulée. L’acompte n’est pas remboursé : l’annulation arrive moins de 2 h avant l’heure.');
        const row = await reservation(id);
        assert.deepEqual([row.booking_state, n(row.refund_percent), n(row.refunded_amount)], ['ANNULEE_CLIENT', 0, 0]);
        assert.deepEqual(await refundsOf(id), []);
        assert.equal(await ledgerOfPayment(pay.id, 'VENTE'), 20_000);
        const next = await reserveRpc(await newBuyer('l11a-annul-2b'), venue, { date: String(row.reservation_date), time: String(row.reservation_time).slice(0, 5) });
        assert.equal(next.ok, true, `table libérée : ${JSON.stringify(next)}`);
    });

    test('réservation gratuite : annulée sans argent ; un autre client ne peut pas l’annuler', async () => {
        const client = await newBuyer('l11a-annul-3');
        const venue = await newVenue(partner);
        await newTable(partner, venue, 4);
        const id = String((await reserveRpc(client, venue, { date: dayFromNow(15) })).reservation_id);
        const intruder = await newBuyer('l11a-annul-intrus');
        const stolen = await clientCancel(id, intruder.accessToken);
        assert.deepEqual([stolen.status, stolen.body.code], [404, 'RESERVATION_NOT_FOUND']);
        const res = await clientCancel(id, client.accessToken);
        assert.deepEqual([res.status, res.body.message], [200, 'Réservation annulée.']);
        assert.equal((await reservation(id)).booking_state, 'ANNULEE_CLIENT');
    });
});

describe('C3. Annulation par l’établissement et par Event Village : tout rendu', () => {
    test('établissement : motif obligatoire, puis 21 000 rendus ; une autre partenaire ne peut pas', async () => {
        const { client, id } = await paidReservation('l11a-annul-etab', 30);
        const noReason = await partnerAction(id, partner.accessToken, { action: 'ANNULER' });
        assert.deepEqual([noReason.status, noReason.body.code, noReason.body.error], [400, 'REASON_REQUIRED', 'Indiquez le motif : il est envoyé au client.']);
        const stranger = await newPartner('l11a-annul-etrangere');
        const foreign = await partnerAction(id, stranger.accessToken, { action: 'ANNULER', reason: 'Cuisine fermée ce soir' });
        assert.deepEqual([foreign.status, foreign.body.code], [404, 'RESERVATION_NOT_FOUND']);
        const res = await partnerAction(id, partner.accessToken, { action: 'ANNULER', reason: 'Cuisine fermée ce soir' });
        assert.equal(res.status, 200, JSON.stringify(res.body));
        const row = await reservation(id);
        assert.deepEqual([row.booking_state, n(row.refunded_amount), row.cancel_reason], ['ANNULEE_ETABLISSEMENT', 21_000, 'Cuisine fermée ce soir']);
        assert.deepEqual((await outboxOf(client.userId, id)).filter((t) => t.startsWith('TABLE_RESERVATION_CANCELLED:')), allChannels('TABLE_RESERVATION_CANCELLED'));
    });

    test('Event Village : un administrateur sans le droit des remboursements est refusé ; avec, 21 000 rendus', async () => {
        const { id } = await paidReservation('l11a-annul-ev', 600);
        const weak = await newAdmin('l11a-admin-faible', ['events.read']);
        const refused = await post(adminCancelRoute, `/api/admin/tables/reservations/${id}/cancel`, id, weak.accessToken, { reason: 'Établissement fermé par décision' });
        assert.equal(refused.status, 403, JSON.stringify(refused.body));
        const admin = await newAdmin('l11a-admin-remb', ['refunds.manage']);
        const res = await post(adminCancelRoute, `/api/admin/tables/reservations/${id}/cancel`, id, admin.accessToken, { reason: 'Établissement fermé par décision' });
        assert.equal(res.status, 200, JSON.stringify(res.body));
        const row = await reservation(id);
        assert.deepEqual([row.booking_state, n(row.refunded_amount), row.cancel_origin], ['ANNULEE_EV', 21_000, 'EVENT_VILLAGE']);
    });
});

describe('C4. Refus, demande sans réponse, attente de paiement échue', () => {
    test('demande refusée par l’établissement (motif) : 21 000 rendus, avis au client', async () => {
        const { client, id } = await paidReservation('l11a-refus', 600, 'MANUELLE');
        assert.equal((await reservation(id)).booking_state, 'EN_ATTENTE_ACCEPTATION');
        const res = await partnerAction(id, partner.accessToken, { action: 'REFUSER', reason: 'Complet ce soir-là' });
        assert.equal(res.status, 200, JSON.stringify(res.body));
        const row = await reservation(id);
        assert.deepEqual([row.booking_state, row.status, n(row.refunded_amount), n(row.refund_percent)], ['REFUSEE', 'REJETEE', 21_000, 100]);
        assert.deepEqual((await outboxOf(client.userId, id)).filter((t) => t.startsWith('TABLE_REQUEST_REFUSED:')), allChannels('TABLE_REQUEST_REFUSED'));
    });

    test('sans réponse sous 2 h : demande annulée par la tâche planifiée, 21 000 rendus ; second passage sans effet', async () => {
        const { client, id } = await paidReservation('l11a-sans-reponse', 600, 'MANUELLE');
        await shiftReservation(id, { responseMinutes: -1 });
        const t = await tick();
        assert.ok(n(t.unanswered) >= 1, JSON.stringify(t));
        const row = await reservation(id);
        assert.deepEqual([row.booking_state, n(row.refunded_amount)], ['SANS_REPONSE', 21_000]);
        assert.deepEqual((await outboxOf(client.userId, id)).filter((x) => x.startsWith('TABLE_REQUEST_EXPIRED:')), allChannels('TABLE_REQUEST_EXPIRED'));
        assert.deepEqual((await outboxOf(partner.userId, id)).filter((x) => x.startsWith('TABLE_RESERVATION_CANCELLED_PRO:')), allChannels('TABLE_RESERVATION_CANCELLED_PRO'));
        await tick();
        assert.deepEqual((await refundsOf(id)).map((r) => n(r.amount)), [21_000]);
    });

    test('attente de paiement échue : « Non payée à temps », avis au client', async () => {
        const client = await newBuyer('l11a-attente');
        const venue = await newVenue(partner, { deposit_per_person: 5_000 });
        await newTable(partner, venue, 4);
        const id = String((await reserveRpc(client, venue, { date: dayFromNow(16) })).reservation_id);
        await shiftReservation(id, { holdMinutes: -1 });
        const t = await tick();
        assert.ok(n(t.expired_holds) >= 1, JSON.stringify(t));
        assert.equal((await reservation(id)).booking_state, 'EXPIREE');
        assert.deepEqual(await outboxOf(client.userId, id), allChannels('TABLE_HOLD_EXPIRED'));
    });
});

describe('C5. Client absent', () => {
    test('29 minutes après l’heure : rien ; 31 minutes après : « Absent », acompte gardé (20 000), table libérée, avis', async () => {
        const { client, id, pay, venue, table } = await paidReservation('l11a-absent', 600);
        await shiftReservation(id, { startMinutes: -29 });
        await tick();
        assert.equal((await reservation(id)).booking_state, 'CONFIRMEE');
        await shiftReservation(id, { startMinutes: -31 });
        const t = await tick();
        assert.ok(n(t.no_shows) >= 1, JSON.stringify(t));
        const row = await reservation(id);
        assert.deepEqual([row.booking_state, row.status, n(row.refunded_amount)], ['ABSENT', 'ANNULEE', 0]);
        assert.deepEqual(await refundsOf(id), []);
        assert.equal(await ledgerOfPayment(pay.id, 'VENTE'), 20_000);
        assert.deepEqual((await outboxOf(client.userId, id)).filter((x) => x.startsWith('TABLE_NO_SHOW:')), allChannels('TABLE_NO_SHOW'));
        const next = await reserveRpc(await newBuyer('l11a-absent-suivant'), venue, { ...startIn(15), tableId: table });
        assert.equal(next.ok, true, `table libérée : ${JSON.stringify(next)}`);
    });

    test('client arrivé : la tâche ne le marque pas absent ; l’établissement peut marquer « Absent » après l’heure', async () => {
        const { id } = await paidReservation('l11a-arrive', 600);
        await shiftReservation(id, { startMinutes: -40 });
        const arrived = await partnerAction(id, partner.accessToken, { action: 'ARRIVEE' });
        assert.equal(arrived.status, 200, JSON.stringify(arrived.body));
        await tick();
        assert.equal((await reservation(id)).booking_state, 'ARRIVEE');
        const other = await paidReservation('l11a-absent-main', 600);
        await shiftReservation(other.id, { startMinutes: -5 });
        const absent = await partnerAction(other.id, partner.accessToken, { action: 'ABSENT' });
        assert.equal(absent.status, 200, JSON.stringify(absent.body));
        assert.equal((await reservation(other.id)).booking_state, 'ABSENT');
    });
});

describe('C6. Rappel et tâche planifiée', () => {
    // Lot 11b (modification signalée au rapport) : rappel 2 h avant (décision du client, réglage tables.reminder_hours)
    test('rappel 2 h avant l’heure, sur les canaux du rappel, une seule fois', async () => {
        // Début dans 90 à 105 minutes (arrondi au quart d'heure) : dans la fenêtre du rappel (2 h), quelle que soit l'heure
        const { client, id } = await paidReservation('l11a-rappel', 90);
        await tick();
        await tick();
        const reminders = (await outboxOf(client.userId, id)).filter((x) => x.startsWith('TABLE_REMINDER:'));
        assert.deepEqual(reminders, allChannels('TABLE_REMINDER'));
    });
});

describe('C7. Parrainage corrigé (§82)', () => {
    test('commission sur le revenu net (685), disponible après le créneau ; annulée au remboursement total', async () => {
        const sponsor = await newBuyer('l11a-parrain');
        const client = await newBuyer('l11a-filleul');
        const { data: cfg } = await service.from('referral_config').select('rate_n1, rate_n2, duration_months')
            .eq('sponsor_status', 'STANDARD').eq('referral_type', 'CLIENT_TO_CLIENT').eq('is_active', true).maybeSingle();
        const rate = Number(cfg?.rate_n1 ?? 5);
        const { error } = await service.from('referral_relationships').insert({
            sponsor_id: sponsor.userId, referred_id: client.userId, referral_type: 'CLIENT_TO_CLIENT', sponsor_status_at_creation: 'STANDARD',
            rate_n1_at_creation: rate, rate_n2_at_creation: Number(cfg?.rate_n2 ?? 2), duration_months: Number(cfg?.duration_months ?? 12),
            expires_at: new Date(Date.now() + 365 * 86_400_000).toISOString(), is_active: true,
        });
        assert.equal(error, null, error?.message);
        const venue = await newVenue(partner, { deposit_per_person: 5_000 });
        await newTable(partner, venue, 4);
        const date = dayFromNow(18);
        const id = String((await reserveRpc(client, venue, { date, time: '20:00' })).reservation_id);
        const pay = await payConfirmed(client, id);
        const { error: calcErr } = await service.rpc('calculate_referral_commissions', { p_payment_id: pay.id });
        assert.equal(calcErr, null, calcErr?.message);
        const { data: comm } = await service.from('referral_commissions').select('amount, available_at, eligible_net_revenue')
            .eq('payment_id', pay.id).eq('generation', 'N1').single();
        assert.equal(n(comm!.eligible_net_revenue), 685, 'revenu net d’Event Village sur l’acompte');
        assert.equal(n(comm!.amount), Math.round(685 * rate) / 100, `commission ${rate} %`);
        const end = Date.parse(`${date}T22:00:00Z`);
        assert.ok(new Date(String(comm!.available_at)).getTime() >= end + 7 * 86_400_000 - 1000, 'disponible après la fin du créneau + 7 jours');
        const res = await clientCancel(id, client.accessToken);
        assert.equal(res.status, 200, JSON.stringify(res.body));
        const { data: afterRows } = await service.from('referral_commissions').select('status, cancellation_reason').eq('payment_id', pay.id).eq('generation', 'N1').eq('kind', 'COMMISSION');
        assert.ok((afterRows ?? []).some((c) => c.status === 'CANCELLED' && c.cancellation_reason === 'REMBOURSEMENT'), JSON.stringify(afterRows));
    });
});

/**
 * Lot 10a — réserver et payer une salle (argent et sécurité). Montants calculés à la main dans chaque test, avec les
 * réglages par défaut vérifiés en tête : frais de service 5 %, commission 0 %, acompte 30 %, solde 7 jours avant,
 * attente de 15 minutes, frais Wave 1,5 %, garde des ventes 48 h après la fin.
 *
 *  A. Réserver (S1 à S3) : formules à la journée, à l'heure, acompte en % et fixe, arrondis, paiement intégral à moins de
 *     7 jours ; attaques : montant dans le corps, 0 F, salle non validée, refusée, suspendue, inactive, partenaire
 *     suspendue, sa propre salle, dates hors bornes, chevauchements simultanés, 3 attentes au plus, attente échue.
 *  B. Payer (S4, C1) : acompte puis solde, intégral, montant toujours relu en base, ordre imposé, un paiement en attente
 *     à la fois, réservation d'un autre client, confirmation par la salle sans paiement, paiement arrivé trop tard
 *     (remboursé), échec du paiement du solde (l'acompte reste), grand livre et date de disponibilité, avis.
 * Faux SamirPay seulement. Base LOCALE. Invariants du lot (h1 à h4) et des livraisons précédentes à la fin.
 */
import '../helpers/env';
import { after, before, beforeEach, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { assertLot10aInvariants } from '../helpers/lot10a-invariants';
import { service, deliverWebhook, providerSays, paymentById, type Buyer } from './paiement-helpers';
import type { TestPartner } from './finance-helpers';
import { releasePayment, loadPayment } from '../../lib/payments/confirmation.service';
import { POST as partnerStatusRoute } from '../../app/api/partner/halls/reservations/[id]/status/route';
import { NextRequest } from 'next/server';
import { BASE_URL } from './helpers';
import {
    dayFromNow, decideHall, newBuyer, newHall, newPartner, openHallsService, outboxOf, payConfirmed, platformSetting,
    reservation, reserveRoute, reserveRpc, startPayment, type Row,
} from './l10a-helpers';

let restore: () => Promise<void>;
let partner: TestPartner;
let client: Buyer;

before(async () => {
    restore = await openHallsService();
    partner = await newPartner('l10a-salles');
    client = await newBuyer('l10a-client');
});

// Limite de 3 réservations non payées par client : les attentes laissées par les tests précédents sont échues
beforeEach(async () => {
    if (!client) return;
    await service.from('hall_reservations').update({ hold_expires_at: new Date(Date.now() - 60_000).toISOString() })
        .eq('client_id', client.userId).eq('booking_state', 'EN_ATTENTE_PAIEMENT');
});

after(async () => {
    await restore();
    await assertLot10aInvariants('l10a-salles');
});

const n = (v: unknown): number => Number(v);

describe('A. Réserver une salle : argent calculé en base, contrôles', () => {
    test('réglages par défaut (décisions du client)', async () => {
        const expected: Record<string, unknown> = {
            'halls.service_fee_rate': 5, 'halls.commission_rate': 0, 'halls.deposit_default_percent': 30, 'halls.balance_due_days': 7,
            'halls.hold_minutes': 15, 'halls.validation_required': true, 'halls.cancel_partial_percent': 50,
            'halls.cancel_souple_full_days': 7, 'halls.cancel_moderee_full_days': 30, 'halls.cancel_moderee_partial_days': 7,
            'halls.cancel_stricte_partial_days': 30, 'finance.aggregator_fee_rate.WAVE': 1.5, 'finance.payout_delay_hours': 48,
        };
        for (const [key, value] of Object.entries(expected)) assert.equal(await platformSetting(key), value, key);
    });

    test('à la journée : 200 000 F × 2 jours → prix 400 000, frais 20 000, total 420 000, acompte 126 000, solde 294 000, échéance J-7', async () => {
        const hall = await newHall(partner, { price_per_day: 200_000 });
        const start = dayFromNow(60);
        const r = await reserveRpc(client, hall, { days: 2, startDate: start });
        assert.equal(r.ok, true, JSON.stringify(r));
        const row = await reservation(String(r.reservation_id));
        assert.deepEqual(
            [row.booking_state, row.booking_mode, n(row.units), n(row.price_amount), n(row.service_fee_amount), n(row.total_amount),
             n(row.deposit_price), n(row.deposit_service_fee), n(row.deposit_amount), n(row.balance_amount), row.end_date],
            ['EN_ATTENTE_PAIEMENT', 'JOUR', 2, 400_000, 20_000, 420_000, 120_000, 6_000, 126_000, 294_000, dayFromNow(61)]);
        assert.equal(new Date(String(row.balance_due_at)).getTime(), Date.parse(`${start}T00:00:00Z`) - 7 * 86_400_000, 'solde dû 7 jours avant la date');
        assert.equal(row.full_payment_required, false);
        const hold = Date.parse(String(row.hold_expires_at)) - Date.now();
        assert.ok(hold > 13 * 60_000 && hold <= 15 * 60_000, `date tenue 15 minutes (${Math.round(hold / 1000)} s)`);
        assert.equal((row.cancellation_terms as Row).policy, 'MODEREE');
        assert.deepEqual(row.cancellation_terms, { policy: 'MODEREE', partial_percent: 50, full_days: 30, partial_days: 7 });
    });

    test('à l’heure : 25 000 F × 4 h de 18:00 à 22:00, acompte fixe 50 000 → total 105 000, acompte 52 500, solde 52 500', async () => {
        const hall = await newHall(partner, { price_per_day: 150_000, price_per_hour: 25_000, deposit_mode: 'MONTANT_FIXE', deposit_value: 50_000 });
        const r = await reserveRpc(client, hall, { mode: 'HEURE', startTime: '18:00', hours: 4, startInDays: 45 });
        assert.equal(r.ok, true, JSON.stringify(r));
        const row = await reservation(String(r.reservation_id));
        assert.deepEqual([row.booking_mode, n(row.units), row.start_time, row.end_time, n(row.price_amount), n(row.service_fee_amount), n(row.total_amount),
            n(row.deposit_price), n(row.deposit_service_fee), n(row.deposit_amount), n(row.balance_amount)],
            ['HEURE', 4, '18:00:00', '22:00:00', 100_000, 5_000, 105_000, 50_000, 2_500, 52_500, 52_500]);
        // Deux créneaux à la suite le même jour : permis ; un créneau qui chevauche : refusé
        const other = await newBuyer('l10a-heure-2');
        const next = await reserveRpc(other, hall, { mode: 'HEURE', startTime: '22:00', hours: 2, startInDays: 45 });
        assert.equal(next.ok, true, `créneau 22:00-24:00 à la suite : ${JSON.stringify(next)}`);
        const overlap = await reserveRpc(await newBuyer('l10a-heure-3'), hall, { mode: 'HEURE', startTime: '21:30', hours: 1, startInDays: 45 });
        assert.deepEqual([overlap.ok, overlap.code], [false, 'SLOT_TAKEN']);
        const wholeDay = await reserveRpc(await newBuyer('l10a-heure-4'), hall, { days: 1, startInDays: 45 });
        assert.deepEqual([wholeDay.ok, wholeDay.code], [false, 'SLOT_TAKEN'], 'la journée chevauche les créneaux à l’heure');
    });

    test('acompte fixe plus grand que le prix → paiement en une fois (acompte = total 157 500, solde 0)', async () => {
        const hall = await newHall(partner, { price_per_day: 150_000, deposit_mode: 'MONTANT_FIXE', deposit_value: 500_000 });
        const r = await reserveRpc(client, hall, { days: 1, startInDays: 50 });
        assert.equal(r.ok, true, JSON.stringify(r));
        const row = await reservation(String(r.reservation_id));
        assert.deepEqual([n(row.deposit_price), n(row.deposit_amount), n(row.balance_amount), row.full_payment_required, row.balance_due_at],
            [150_000, 157_500, 0, true, null]);
    });

    test('arrondis au franc supérieur : 99 999 F, acompte 33 % → frais 5 000, acompte 33 000 + 1 650 = 34 650, solde 70 349', async () => {
        const hall = await newHall(partner, { price_per_day: 99_999, deposit_value: 33 });
        const r = await reserveRpc(client, hall, { days: 1, startInDays: 55 });
        assert.equal(r.ok, true, JSON.stringify(r));
        const row = await reservation(String(r.reservation_id));
        assert.deepEqual([n(row.price_amount), n(row.service_fee_amount), n(row.total_amount), n(row.deposit_price), n(row.deposit_service_fee), n(row.deposit_amount), n(row.balance_amount)],
            [99_999, 5_000, 104_999, 33_000, 1_650, 34_650, 70_349]);
    });

    test('à moins de 7 jours de la date : paiement intégral exigé (acompte = 210 000, solde 0)', async () => {
        const hall = await newHall(partner, { price_per_day: 200_000 });
        const r = await reserveRpc(client, hall, { days: 1, startInDays: 3 });
        assert.equal(r.ok, true, JSON.stringify(r));
        const row = await reservation(String(r.reservation_id));
        assert.deepEqual([row.full_payment_required, n(row.deposit_amount), n(row.total_amount), n(row.balance_amount)], [true, 210_000, 210_000, 0]);
    });

    test('attaque : montants envoyés dans le corps ignorés (420 000 calculés en base)', async () => {
        const hall = await newHall(partner, { price_per_day: 200_000 });
        const res = await reserveRoute(client, {
            hallId: hall, startDate: dayFromNow(62), durationDays: 2,
            totalAmount: 1, depositAmount: 1, price_per_day: 1, price: 1, deposit_value: 0, service_fee_amount: 0, total_amount: 1,
        });
        assert.equal(res.status, 200, JSON.stringify(res.body));
        const resa = res.body.reservation as Row;
        assert.deepEqual([resa.totalAmount, resa.depositAmount, resa.balanceAmount], [420_000, 126_000, 294_000]);
        assert.match(String(resa.cancellation), /^Règle Modérée : remboursement total si vous annulez au moins 30 jours avant la date, 50 % jusqu’à 7 jours avant, rien ensuite\.$/);
        assert.equal(resa.state, 'En attente de paiement');
    });

    test('attaque 0 F : prix nul, acompte nul ou négatif refusés par la base ; salle sans prix jamais validée ; durée nulle refusée', async () => {
        const bad: Row[] = [
            { price_per_day: 0 }, { price_per_day: -1000 }, { price_per_day: 1000.5 }, { price_per_day: 1000, price_per_hour: 0 },
            { price_per_day: 1000, deposit_mode: 'POURCENTAGE', deposit_value: 0 },
            { price_per_day: 1000, deposit_mode: 'MONTANT_FIXE', deposit_value: 0 },
            { price_per_day: 1000, deposit_mode: 'MONTANT_FIXE', deposit_value: null },
            { price_per_day: 1000, deposit_mode: 'POURCENTAGE', deposit_value: 101 },
        ];
        for (const fields of bad) {
            const { error } = await service.from('halls').insert({ partner_id: partner.partnerId, name: 'TEST Salle invalide', capacity: 10, ...fields });
            assert.ok(error, `salle acceptée : ${JSON.stringify(fields)}`);
        }
        const noPrice = await newHall(partner, { price_per_day: null, validate: false });
        const decided = await decideHall(noPrice, 'VALIDER');
        assert.deepEqual([decided.ok, decided.code], [false, 'PRICE_MISSING'], 'une salle sans prix par jour n’est jamais validée');
        assert.equal((await reserveRpc(client, noPrice, { startInDays: 70 })).code, 'HALL_NOT_AVAILABLE');
        const hall = await newHall(partner);
        for (const days of [0, -1, 31]) {
            const r = await reserveRpc(client, hall, { days, startInDays: 70 });
            assert.deepEqual([r.ok, r.code], [false, 'INVALID_DURATION'], `durée ${days}`);
        }
    });

    test('salle non validée, refusée, suspendue ou inactive ; partenaire suspendue ; sa propre salle : refus, rien d’écrit', async () => {
        const pending = await newHall(partner, { validate: false });
        const refused = await newHall(partner, { validate: false });
        assert.equal((await decideHall(refused, 'REFUSER', 'Photos manquantes.')).ok, true);
        const suspended = await newHall(partner);
        assert.equal((await decideHall(suspended, 'SUSPENDRE', 'Signalement en cours.')).ok, true);
        const inactive = await newHall(partner, { is_active: false });
        for (const hall of [pending, refused, suspended, inactive]) {
            const r = await reserveRpc(client, hall, { startInDays: 80 });
            assert.deepEqual([r.ok, r.code], [false, 'HALL_NOT_AVAILABLE'], `salle ${hall}`);
        }
        const other = await newPartner('l10a-suspendue');
        const hallOfSuspended = await newHall(other);
        const { error } = await service.from('partners').update({ status: 'SUSPENDU' }).eq('id', other.partnerId);
        assert.equal(error, null);
        const ofSuspended = await reserveRpc(client, hallOfSuspended, { startInDays: 80 });
        assert.deepEqual([ofSuspended.ok, ofSuspended.code], [false, 'HALL_NOT_AVAILABLE']);
        const own = await newHall(partner);
        const self = await reserveRpc(partner as unknown as Buyer, own, { startInDays: 80 });
        assert.deepEqual([self.ok, self.code], [false, 'OWN_HALL']);
        const { count } = await service.from('hall_reservations').select('id', { count: 'exact', head: true }).in('hall_id', [pending, refused, suspended, inactive, hallOfSuspended, own]);
        assert.equal(count, 0, 'aucune réservation écrite');
    });

    test('dates : passée, trop lointaine (plus de 18 mois), heure de début invalide → refus', async () => {
        const hall = await newHall(partner, { price_per_hour: 10_000 });
        assert.equal((await reserveRpc(client, hall, { startInDays: -1 })).code, 'DATE_PASSED');
        assert.equal((await reserveRpc(client, hall, { startInDays: 600 })).code, 'DATE_TOO_FAR');
        assert.equal((await reserveRpc(client, hall, { mode: 'HEURE', startTime: '18:15', hours: 2, startInDays: 30 })).code, 'INVALID_DATES');
        assert.equal((await reserveRpc(client, hall, { mode: 'HEURE', startTime: '20:00', hours: 5, startInDays: 30 })).code, 'INVALID_DURATION');
    });

    test('chevauchements simultanés : 5 tours de 6 réservations à la fois → une seule réussit, jamais de blocage mutuel', async () => {
        const clients: Buyer[] = [];
        for (let i = 0; i < 6; i += 1) clients.push(await newBuyer(`l10a-conc-${i}`));
        for (let round = 0; round < 5; round += 1) {
            const hall = await newHall(partner);
            const results = await Promise.allSettled(clients.map((c, i) => reserveRpc(c, hall, { startDate: dayFromNow(90 + (i % 2)), days: 2 })));
            const ok = results.filter((r) => r.status === 'fulfilled' && (r.value as Row).ok === true).length;
            const taken = results.filter((r) => r.status === 'fulfilled' && (r.value as Row).code === 'SLOT_TAKEN').length;
            const errors = results.filter((r) => r.status === 'rejected').map((r) => String((r as PromiseRejectedResult).reason));
            const codes = results.map((r) => (r.status === 'fulfilled' ? String((r.value as Row).code ?? 'ok') : 'erreur'));
            assert.deepEqual([ok, taken, errors], [1, 5, []], `tour ${round} : ${codes.join(', ')}`);
            // Attente du gagnant rendue : un client ne garde jamais plus de 3 réservations non payées
            await service.from('hall_reservations').update({ hold_expires_at: new Date(Date.now() - 60_000).toISOString() }).eq('hall_id', hall);
        }
    });

    test('3 réservations non payées au plus par client ; une attente échue rend la date', async () => {
        const greedy = await newBuyer('l10a-attentes');
        for (let i = 0; i < 3; i += 1) assert.equal((await reserveRpc(greedy, await newHall(partner), { startInDays: 100 })).ok, true);
        const fourth = await reserveRpc(greedy, await newHall(partner), { startInDays: 100 });
        assert.deepEqual([fourth.ok, fourth.code], [false, 'TOO_MANY_PENDING']);
        assert.match(String(fourth.message), /^Vous avez déjà 3 réservations en attente de paiement\./);

        const hall = await newHall(partner);
        const first = await reserveRpc(client, hall, { startInDays: 110 });
        const blocked = await reserveRpc(await newBuyer('l10a-attente-2'), hall, { startInDays: 110 });
        assert.equal(blocked.code, 'SLOT_TAKEN', 'date tenue pendant l’attente');
        // Le temps passe : l'attente de 15 minutes est échue
        await service.from('hall_reservations').update({ hold_expires_at: new Date(Date.now() - 60_000).toISOString() }).eq('id', String(first.reservation_id));
        const second = await reserveRpc(await newBuyer('l10a-attente-3'), hall, { startInDays: 110 });
        assert.equal(second.ok, true, JSON.stringify(second));
        assert.equal((await reservation(String(first.reservation_id))).booking_state, 'EXPIREE');
    });

    test('service fermé : refus, rien d’écrit', async () => {
        const hall = await newHall(partner);
        await restore();
        try {
            const r = await reserveRpc(client, hall, { startInDays: 120 });
            assert.deepEqual([r.ok, r.code], [false, 'SERVICE_CLOSED']);
        } finally {
            restore = await openHallsService();
        }
    });
});

describe('B. Payer : acompte puis solde, montant relu en base, confirmation par le paiement seulement', () => {
    test('acompte puis solde : 126 000 puis 294 000 ; « payée » seulement au total ; grand livre et disponibilité après la date', async () => {
        const hall = await newHall(partner, { price_per_day: 200_000 });
        const start = dayFromNow(60);
        const r = await reserveRpc(client, hall, { days: 2, startDate: start });
        const id = String(r.reservation_id);

        const dep = await payConfirmed(client, id, 'ACOMPTE');
        assert.deepEqual([dep.status, n(dep.amount), n(dep.facial_amount), n(dep.service_fee), n(dep.aggregator_fee), n(dep.partner_payout_amount),
            n(dep.gross_event_village_revenue), n(dep.net_event_village_revenue)],
            ['SUCCESS', 126_000, 120_000, 6_000, 1_890, 120_000, 6_000, 4_110]);
        let row = await reservation(id);
        assert.deepEqual([row.booking_state, row.status, row.payment_status, n(row.paid_amount)], ['ACOMPTE_PAYE', 'CONFIRMEE', 'PARTIAL', 126_000]);

        const { data: sale } = await service.from('finance_ledger').select('amount, available_at, owner_id').eq('source_key', `VENTE-${dep.id}`).single();
        assert.equal(n(sale!.amount), 120_000, 'part de la salle au grand livre');
        assert.equal(sale!.owner_id, partner.userId);
        const end = Date.parse(`${dayFromNow(62)}T00:00:00Z`);
        assert.equal(new Date(String(sale!.available_at)).getTime(), end + 48 * 3_600_000, 'disponible 48 h après la fin de la réservation');

        const bal = await payConfirmed(client, id, 'SOLDE');
        assert.deepEqual([n(bal.amount), n(bal.facial_amount), n(bal.service_fee), n(bal.aggregator_fee), n(bal.net_event_village_revenue)],
            [294_000, 280_000, 14_000, 4_410, 9_590]);
        row = await reservation(id);
        assert.deepEqual([row.booking_state, row.payment_status, n(row.paid_amount)], ['PAYEE', 'SUCCESS', 420_000]);

        const clientNotes = await outboxOf(client.userId, id);
        assert.ok(clientNotes.includes('HALL_RESERVATION_CONFIRMED:SMS'), clientNotes.join(', '));
        assert.ok(clientNotes.includes('HALL_BALANCE_PAID:PUSH'), clientNotes.join(', '));
        // Lot 10b (décision du client, modification signalée au rapport) : le solde payé part aussi par SMS
        assert.ok(clientNotes.includes('HALL_BALANCE_PAID:SMS'), `SMS du solde payé : ${clientNotes.join(', ')}`);
        const partnerNotes = await outboxOf(partner.userId, id);
        // Lot 10b (décision du client, modification signalée au rapport) : la salle reçoit aussi le SMS
        assert.ok(partnerNotes.includes('HALL_RESERVATION_REQUESTED:IN_APP') && partnerNotes.includes('HALL_RESERVATION_REQUESTED:SMS'), partnerNotes.join(', '));
        const { count: generic } = await service.from('notification_outbox').select('id', { count: 'exact', head: true })
            .eq('type', 'PAYMENT_SUCCESS').in('template_data->>payment_id', [dep.id, bal.id]);
        assert.equal(generic, 0, 'pas d’avis générique « Paiement confirmé » pour une salle');
    });

    test('totalité d’un coup : 420 000 → payée ; ordre imposé : solde avant acompte, second acompte, paiement après « payée »', async () => {
        const hall = await newHall(partner, { price_per_day: 200_000 });
        const id = String((await reserveRpc(client, hall, { days: 2, startInDays: 65 })).reservation_id);
        const balanceFirst = await startPayment(client, id, 'SOLDE');
        assert.deepEqual([balanceFirst.status, balanceFirst.body.code], [409, 'DEPOSIT_FIRST']);
        const full = await payConfirmed(client, id, 'INTEGRAL');
        assert.equal(n(full.amount), 420_000);
        assert.equal((await reservation(id)).booking_state, 'PAYEE');
        const again = await startPayment(client, id, 'SOLDE');
        assert.deepEqual([again.status, again.body.code], [409, 'ALREADY_PAID']);

        const id2 = String((await reserveRpc(client, await newHall(partner), { days: 1, startInDays: 66 })).reservation_id);
        await payConfirmed(client, id2, 'ACOMPTE');
        const secondDeposit = await startPayment(client, id2, 'ACOMPTE');
        assert.deepEqual([secondDeposit.status, secondDeposit.body.code], [409, 'BALANCE_ONLY']);
        const noPart = await startPayment(client, id2, undefined);
        assert.deepEqual([noPart.status, noPart.body.code], [400, 'INVALID_PART']);

        const near = String((await reserveRpc(client, await newHall(partner), { days: 1, startInDays: 4 })).reservation_id);
        const depositNear = await startPayment(client, near, 'ACOMPTE');
        assert.deepEqual([depositNear.status, depositNear.body.code], [409, 'FULL_PAYMENT_REQUIRED']);
        assert.equal(depositNear.body.error, 'La date est proche : cette réservation se paie en une fois.');
    });

    test('attaque : montant dans la demande de paiement ignoré ; un paiement en attente à la fois', async () => {
        const id = String((await reserveRpc(client, await newHall(partner, { price_per_day: 200_000 }), { days: 2, startInDays: 67 })).reservation_id);
        const first = await startPayment(client, id, 'ACOMPTE', { amount: 1, facial_amount: 1, quantity: 1 });
        assert.equal(first.status, 201, JSON.stringify(first.body));
        assert.equal(n(first.payment!.amount), 126_000, 'montant relu sur la réservation');
        const second = await startPayment(client, id, 'ACOMPTE');
        assert.deepEqual([second.status, second.body.code, second.body.payment_id], [409, 'PAYMENT_PENDING', first.payment!.id]);
    });

    test('réservation d’un autre client : paiement refusé « Réservation introuvable », rien de créé', async () => {
        const id = String((await reserveRpc(client, await newHall(partner), { startInDays: 68 })).reservation_id);
        const intruder = await newBuyer('l10a-intrus');
        const res = await startPayment(intruder, id, 'INTEGRAL');
        assert.deepEqual([res.status, res.body.code, res.body.error], [404, 'RESERVATION_NOT_FOUND', 'Réservation introuvable.']);
        const { count } = await service.from('payments').select('id', { count: 'exact', head: true }).eq('hall_reservation_id', id);
        assert.equal(count, 0);
    });

    test('C1 : la salle ne confirme jamais une réservation non payée ; une salle tierce ne voit rien', async () => {
        const hall = await newHall(partner);
        const id = String((await reserveRpc(client, hall, { startInDays: 69 })).reservation_id);
        const call = async (userToken: string, action: string) => {
            const res = await partnerStatusRoute(new NextRequest(`${BASE_URL}/api/partner/halls/reservations/${id}/status`, {
                method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${userToken}` }, body: JSON.stringify({ action }),
            }), { params: Promise.resolve({ id }) });
            return { status: res.status, body: (await res.json()) as Row };
        };
        const refused = await call(partner.accessToken, 'CONFIRM');
        assert.deepEqual([refused.status, refused.body.code], [409, 'NOT_PAID']);
        assert.equal((await reservation(id)).booking_state, 'EN_ATTENTE_PAIEMENT', 'état inchangé');
        const otherPartner = await newPartner('l10a-tiers');
        const stranger = await call(otherPartner.accessToken, 'CANCEL');
        assert.deepEqual([stranger.status, stranger.body.error], [404, 'Réservation introuvable.']);
        await payConfirmed(client, id, 'INTEGRAL');
        const ok = await call(partner.accessToken, 'CONFIRM');
        assert.deepEqual([ok.status, (ok.body.reservation as Row).state], [200, 'Payée']);
    });

    test('paiement arrivé après la reprise de la date : remboursé en entier, l’autre client garde la date', async () => {
        const hall = await newHall(partner, { price_per_day: 200_000 });
        const late = await newBuyer('l10a-tardif');
        const id = String((await reserveRpc(late, hall, { days: 2, startInDays: 72 })).reservation_id);
        const started = await startPayment(late, id, 'ACOMPTE');
        assert.equal(started.status, 201, JSON.stringify(started.body));
        await service.from('hall_reservations').update({ hold_expires_at: new Date(Date.now() - 60_000).toISOString() }).eq('id', id);
        const winner = await newBuyer('l10a-gagnant');
        const won = await reserveRpc(winner, hall, { days: 2, startInDays: 72 });
        assert.equal(won.ok, true, JSON.stringify(won));

        providerSays(started.payment!, 'SUCCESS');
        assert.equal((await deliverWebhook(started.payment!)).status, 200);
        const pay = await paymentById(started.payment!.id);
        assert.ok(['REFUND_PENDING', 'REFUNDED'].includes(String(pay.status)), `paiement ${pay.status}`);
        const { data: refund } = await service.from('refunds').select('amount, kind').eq('payment_id', pay.id).single();
        assert.deepEqual([n(refund!.amount), refund!.kind], [126_000, 'REFUND']);
        assert.equal((await reservation(id)).booking_state, 'EXPIREE');
        assert.equal((await reservation(String(won.reservation_id))).booking_state, 'EN_ATTENTE_PAIEMENT');
        assert.ok((await outboxOf(late.userId, id)).includes('HALL_PAYMENT_REFUNDED:SMS'));
        const { count: ticketText } = await service.from('notification_outbox').select('id', { count: 'exact', head: true })
            .eq('type', 'PAYMENT_REFUND_STARTED').eq('recipient_user_id', late.userId);
        assert.equal(ticketText, 0, 'pas le texte des billets');
    });

    test('échec du paiement du solde : l’acompte payé reste, la réservation aussi', async () => {
        const id = String((await reserveRpc(client, await newHall(partner), { days: 1, startInDays: 75 })).reservation_id);
        await payConfirmed(client, id, 'ACOMPTE');
        const bal = await startPayment(client, id, 'SOLDE');
        assert.equal(bal.status, 201, JSON.stringify(bal.body));
        const record = await loadPayment(bal.payment!.id);
        await releasePayment(record!, 'CANCELLED', 'USER_CANCELLED');
        const row = await reservation(id);
        assert.deepEqual([row.booking_state, row.status, n(row.paid_amount)], ['ACOMPTE_PAYE', 'CONFIRMEE', 63_000], 'acompte de 60 000 + 3 000 payé');
    });

});

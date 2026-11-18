/**
 * Contre-vérification du lot 10a — point 1 : faire payer moins que le total, payer dans le mauvais ordre ou deux fois,
 * paiement en retard, double remboursement ; grand livre et parrainage au franc près. Chaque test décrit le
 * comportement sûr attendu : un test rouge est un TROU (sortie brute au rapport docs/audit-lot10a.md).
 * Montants calculés à la main (réglages par défaut : frais 5 %, Wave 1,5 %, acompte 30 %, commission 0 %).
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { assertLot10aInvariants } from '../helpers/lot10a-invariants';
import {
    DAY_MS, adminCancel, decideHall, agePayment, clientCancel, confirmByWebhook, dayFromNow, expireHold, halfHourSlot, ledgerSum, n,
    newBuyer, newHall, newPartner, openHallsService, partnerAction, payConfirmed, paymentsOfReservation, platformSetting,
    refundsOf, reservation, reservationsOf, reserveRoute, reserveRpc, routeId, service, setPlatformSetting, show, startPayment,
    started, tick, trace, type Row, type TestPartner,
} from './cv10a-helpers';
import { newAdmin } from '../parcours/notif-helpers';

let restore: () => Promise<void>;
let partner: TestPartner;

before(async () => {
    restore = await openHallsService();
    partner = await newPartner('cv10a-argent');
});

after(async () => {
    await restore();
    await assertLot10aInvariants('cv10a-1-argent');
});

describe('1.1 Montants : le corps de la requête ne fixe rien', () => {
    test('réservation avec des montants et un autre client dans le corps : montants de la base, client de la session', async () => {
        const client = await newBuyer('cv10a-corps');
        const victim = await newBuyer('cv10a-corps-v');
        const hall = await newHall(partner, { price_per_day: 200_000 });
        const res = await reserveRoute(client, {
            hallId: hall, startDate: dayFromNow(40), units: 2,
            totalAmount: 1, total_amount: 1, price_amount: 1, priceAmount: 1, deposit_amount: 1, depositAmount: 1, balance_amount: 0,
            service_fee_amount: 0, serviceFee: 0, unit_price: 1, commission_rate: 100, deposit_price: 1, full_payment_required: false,
            client_id: victim.userId, clientId: victim.userId, userId: victim.userId,
        });
        assert.equal(res.status, 200, JSON.stringify(res.body));
        const row = await reservation(String((res.body.reservation as Row).id));
        trace('1.1a', { total: row.total_amount, deposit: row.deposit_amount, client: row.client_id === client.userId });
        assert.deepEqual([n(row.price_amount), n(row.service_fee_amount), n(row.total_amount), n(row.deposit_amount), n(row.balance_amount), n(row.commission_rate)],
            [400_000, 20_000, 420_000, 126_000, 294_000, 0]);
        assert.equal(row.client_id, client.userId);
    });

    test('paiement avec un montant dans le corps : 126 000 (acompte relu sur la réservation)', async () => {
        const client = await newBuyer('cv10a-corps-pay');
        const id = String((await reserveRpc(client, await newHall(partner), { days: 2, startInDays: 41 })).reservation_id);
        const p = await started(client, id, 'ACOMPTE', { amount: 1, facial_amount: 1, service_fee: 0, quantity: 1 });
        trace('1.1b', { amount: p.amount });
        assert.equal(n(p.amount), 126_000);
    });
});

describe('1.2 Salle sans prix', () => {
    test('validation refusée sans prix par jour ; salle validée dont le prix est retiré : réservation refusée', async () => {
        const client = await newBuyer('cv10a-sans-prix');
        const noPrice = await newHall(partner, { price_per_day: null, validate: false });
        const dec = await decideHall(noPrice, 'VALIDER');
        assert.equal(dec.code, 'PRICE_MISSING', JSON.stringify(dec));
        // Salle d'avant le lot : validée, puis prix retiré (la contrainte NOT VALID n'interdit pas le vide)
        const hall = await newHall(partner, { price_per_day: 150_000 });
        const { error } = await service.from('halls').update({ price_per_day: null }).eq('id', hall);
        assert.equal(error, null, error?.message);
        const res = await reserveRoute(client, { hallId: hall, startDate: dayFromNow(42), units: 1 });
        trace('1.2a', show(res));
        assert.deepEqual([res.status, res.body.code], [409, 'PRICE_MISSING']);
        assert.equal((await reservationsOf(client.userId)).length, 0);
    });

    test('prix à 0 ou retiré par la route de la salle : refusé, salle inchangée', async () => {
        const hall = await newHall(partner, { price_per_day: 150_000 });
        for (const body of [{ price_per_day: 0 }, { price_per_day: null }, { price_per_day: -5 }, { price_per_day: 0.5 }]) {
            const r = await routeId('PUT', 'partner/halls/[id]', hall, partner.accessToken, body);
            trace('1.2b', `${JSON.stringify(body)} → ${show(r)}`);
            assert.ok(r.status >= 400, `${JSON.stringify(body)} accepté : ${show(r)}`);
        }
        const { data } = await service.from('halls').select('price_per_day').eq('id', hall).single();
        assert.equal(n(data!.price_per_day), 150_000);
    });

    test('à l’heure sur une salle sans prix horaire : refusé', async () => {
        const client = await newBuyer('cv10a-sans-heure');
        const hall = await newHall(partner, { price_per_day: 150_000 });
        const res = await reserveRoute(client, { hallId: hall, startDate: dayFromNow(43), mode: 'HEURE', startTime: '10:00', units: 2 });
        assert.deepEqual([res.status, res.body.code], [409, 'HOURLY_NOT_OFFERED'], show(res));
    });
});

describe('1.3 Acompte à 0, à 100 % ou plus que le prix', () => {
    test('acompte à 0 (pourcentage ou fixe), sous 1 % ou au-delà de 100 % : refusé par la route et par la base', async () => {
        const hall = await newHall(partner, { price_per_day: 100_000 });
        const bodies = [
            { deposit_mode: 'POURCENTAGE', deposit_value: 0 }, { deposit_mode: 'MONTANT_FIXE', deposit_value: 0 },
            { deposit_mode: 'POURCENTAGE', deposit_value: 0.5 }, { deposit_mode: 'POURCENTAGE', deposit_value: -10 },
            { deposit_mode: 'POURCENTAGE', deposit_value: 101 }, { deposit_mode: 'MONTANT_FIXE', deposit_value: -1 },
            { deposit_mode: 'MONTANT_FIXE', deposit_value: 10.5 }, { deposit_percentage: 0 },
        ];
        for (const body of bodies) {
            const r = await routeId('PUT', 'partner/halls/[id]', hall, partner.accessToken, body);
            trace('1.3a', `${JSON.stringify(body)} → ${show(r)}`);
            assert.ok(r.status >= 400, `${JSON.stringify(body)} accepté : ${show(r)}`);
        }
        const { data } = await service.from('halls').select('deposit_mode, deposit_value').eq('id', hall).single();
        assert.deepEqual([data!.deposit_mode, data!.deposit_value], ['POURCENTAGE', null]);
        const direct = await service.from('halls').update({ deposit_mode: 'MONTANT_FIXE', deposit_value: 0 }).eq('id', hall);
        assert.ok(direct.error, 'acompte fixe à 0 écrit en base');
    });

    test('acompte à 100 % : paiement en une fois ; « acompte » et « solde » refusés', async () => {
        const client = await newBuyer('cv10a-100');
        const hall = await newHall(partner, { price_per_day: 100_000, deposit_value: 100 });
        const q = await reserveRpc(client, hall, { days: 1, startInDays: 44 });
        assert.deepEqual([n(q.deposit_amount), n(q.balance_amount), q.full_payment_required], [105_000, 0, true]);
        const id = String(q.reservation_id);
        const acompte = await startPayment(client, id, 'ACOMPTE');
        const solde = await startPayment(client, id, 'SOLDE');
        trace('1.3b', { acompte: acompte.body.code, solde: solde.body.code });
        assert.deepEqual([acompte.status, acompte.body.code], [409, 'FULL_PAYMENT_REQUIRED']);
        assert.deepEqual([solde.status, solde.body.code], [409, 'DEPOSIT_FIRST']);
        await payConfirmed(client, id, 'INTEGRAL');
        const row = await reservation(id);
        assert.deepEqual([row.booking_state, n(row.paid_amount)], ['PAYEE', 105_000]);
    });

    test('acompte fixe plus grand que le prix (5 000 000 F pour 100 000 F) : plafonné au prix, paiement en une fois', async () => {
        const client = await newBuyer('cv10a-fixe');
        const hall = await newHall(partner, { price_per_day: 100_000, deposit_mode: 'MONTANT_FIXE', deposit_value: 5_000_000 });
        const q = await reserveRpc(client, hall, { days: 1, startInDays: 45 });
        trace('1.3c', { deposit: q.deposit_amount, total: q.total_amount });
        assert.deepEqual([n(q.deposit_price), n(q.deposit_amount), n(q.total_amount), q.full_payment_required], [100_000, 105_000, 105_000, true]);
    });
});

describe('1.4 Jours et heures négatifs, nuls ou énormes', () => {
    test('chaque durée ou date invalide est refusée par la route, aucune réservation créée', async () => {
        const client = await newBuyer('cv10a-durees');
        const hall = await newHall(partner, { price_per_day: 100_000, price_per_hour: 10_000 });
        const d = dayFromNow(46);
        const bodies: Row[] = [
            { units: -1 }, { units: 0 }, { units: 31 }, { units: 2_147_483_648 }, { units: 1e21 }, { units: 1.5 }, { units: 'abc' }, { units: null },
            { durationDays: -3 }, { units: -2_147_483_648 },
            { mode: 'HEURE', startTime: '10:00', units: 25 }, { mode: 'HEURE', startTime: '10:00', units: 0 },
            { mode: 'HEURE', startTime: '10:00', units: -2 }, { mode: 'HEURE', startTime: '23:30', units: 1 },
            { mode: 'HEURE', startTime: '24:00', units: 1 }, { mode: 'HEURE', startTime: '10:15', units: 1 },
            { mode: 'HEURE', startTime: '99:99', units: 1 }, { mode: 'HEURE', startTime: '22:00', units: 3 },
            { startDate: '2027-13-45', units: 1 }, { startDate: '2027-02-30', units: 1 }, { startDate: dayFromNow(600), units: 1 },
            { startDate: '1900-01-01', units: 1 },
        ];
        for (const b of bodies) {
            const r = await reserveRoute(client, { hallId: hall, startDate: d, ...b });
            trace('1.4a', `${JSON.stringify(b)} → ${show(r)}`);
            assert.ok(r.status >= 400 && r.status < 500, `${JSON.stringify(b)} : ${show(r)}`);
        }
        assert.deepEqual(await reservationsOf(client.userId), [], 'aucune réservation créée');
    });

    test('par la fonction en base : unités en texte, énormes ou négatives refusées', async () => {
        const client = await newBuyer('cv10a-durees-rpc');
        const hall = await newHall(partner, { price_per_day: 100_000, price_per_hour: 10_000 });
        for (const units of ['99999999999', '-5', '1e3', '2.5', '', ' 3']) {
            const { data, error } = await service.rpc('hall_reserve', { p: { client_id: client.userId, hall_id: hall, mode: 'JOUR', start_date: dayFromNow(47), units } });
            trace('1.4b', `${units} → ${JSON.stringify(data ?? error?.message)}`);
            assert.equal(error, null, error?.message);
            if ((data as Row).ok === true) assert.ok(n((data as Row).units) >= 1 && n((data as Row).units) <= 30, `unités acceptées : ${JSON.stringify(data)}`);
        }
        for (const r of await reservationsOf(client.userId)) assert.ok(n(r.price_amount) === 100_000 * n(r.units) && n(r.units) <= 30, JSON.stringify(r));
    });
});

describe('1.5 Arrondis, grand livre et parrainage au franc près', () => {
    test('salle à 3 F : 4 F encaissés en deux fois, 3 F pour la salle ; annulation à 50 % : 2 F rendus, part de la salle au demi-franc près', async () => {
        const client = await newBuyer('cv10a-3f');
        const hall = await newHall(partner, { price_per_day: 3 });
        const q = await reserveRpc(client, hall, { days: 1, startInDays: 20 });
        trace('1.5a quote', q);
        assert.deepEqual([n(q.price_amount), n(q.service_fee_amount), n(q.total_amount), n(q.deposit_price), n(q.deposit_service_fee), n(q.balance_amount)],
            [3, 1, 4, 1, 1, 2]);
        const id = String(q.reservation_id);
        const dep = await payConfirmed(client, id, 'ACOMPTE');
        const bal = await payConfirmed(client, id, 'SOLDE');
        for (const p of [dep, bal]) {
            assert.equal(n(p.amount), n(p.facial_amount) + n(p.service_fee), `paiement ${p.id} : montant = prix + frais`);
            assert.equal(await ledgerSum(p.id, 'VENTE'), n(p.partner_payout_amount), `vente du paiement ${p.id}`);
        }
        assert.equal(n(dep.amount) + n(bal.amount), 4, 'le client paie le total');
        assert.equal(n(dep.partner_payout_amount) + n(bal.partner_payout_amount), 3, 'la salle reçoit le prix');
        const c = await clientCancel(id, client.accessToken);
        assert.equal(c.status, 200, show(c));
        const refunds = await refundsOf(id);
        trace('1.5a remboursements', refunds);
        assert.equal(refunds.reduce((s, r) => s + n(r.amount), 0), 2, '50 % de 4 F');
        for (const r of refunds) {
            const p = r.payment_id === dep.id ? dep : bal;
            assert.equal(n(r.amount), n(r.facial_part) + n(r.service_part));
            assert.ok(Math.abs(n(r.facial_part) - n(p.partner_payout_amount) * 0.5) <= 0.5, `part de la salle rendue ${r.facial_part} pour ${p.partner_payout_amount}`);
            assert.equal(await ledgerSum(String(r.payment_id), 'REMBOURSEMENT'), -n(r.facial_part));
        }
    });

    test('commission de 10 % et parrain : acompte 126 000 → salle 108 000, Event Village 16 110 net ; 50 % rendu → salle −54 000, commission au prorata', async () => {
        const before = await platformSetting('halls.commission_rate');
        await setPlatformSetting('halls.commission_rate', 10, 'contre-vérification 10a');
        try {
            const sponsor = await newBuyer('cv10a-parrain');
            const client = await newBuyer('cv10a-filleul');
            const { data: cfg } = await service.from('referral_config').select('rate_n1, rate_n2, duration_months')
                .eq('sponsor_status', 'STANDARD').eq('referral_type', 'CLIENT_TO_CLIENT').eq('is_active', true).maybeSingle();
            const rate = n(cfg?.rate_n1 ?? 5);
            const { error } = await service.from('referral_relationships').insert({
                sponsor_id: sponsor.userId, referred_id: client.userId, referral_type: 'CLIENT_TO_CLIENT', sponsor_status_at_creation: 'STANDARD',
                rate_n1_at_creation: rate, rate_n2_at_creation: n(cfg?.rate_n2 ?? 2), duration_months: n(cfg?.duration_months ?? 12),
                expires_at: new Date(Date.now() + 365 * DAY_MS).toISOString(), is_active: true,
            });
            assert.equal(error, null, error?.message);
            const id = String((await reserveRpc(client, await newHall(partner, { price_per_day: 200_000 }), { days: 2, startInDays: 20 })).reservation_id);
            const dep = await payConfirmed(client, id, 'ACOMPTE');
            trace('1.5b paiement', { amount: dep.amount, payout: dep.partner_payout_amount, net: dep.net_event_village_revenue, agg: dep.aggregator_fee });
            assert.deepEqual([n(dep.amount), n(dep.facial_amount), n(dep.service_fee), n(dep.partner_payout_amount), n(dep.aggregator_fee), n(dep.net_event_village_revenue)],
                [126_000, 120_000, 6_000, 108_000, 1_890, 16_110]);
            assert.equal(await ledgerSum(dep.id, 'VENTE'), 108_000);
            const { data: comm } = await service.from('referral_commissions').select('id, amount, status').eq('payment_id', dep.id).eq('generation', 'N1').eq('kind', 'COMMISSION');
            const expected = Math.round(16_110 * rate) / 100;
            assert.deepEqual((comm ?? []).map((c) => n(c.amount)), [expected], `commission N1 ${rate} % : ${JSON.stringify(comm)}`);
            const c = await clientCancel(id, client.accessToken);
            assert.equal(c.status, 200, show(c));
            const refunds = await refundsOf(id);
            trace('1.5b remboursement', refunds);
            assert.deepEqual(refunds.map((r) => [n(r.amount), n(r.facial_part), n(r.service_part), n(r.net_revenue_reversal)]), [[63_000, 54_000, 9_000, 9_000]]);
            assert.equal(await ledgerSum(dep.id, 'REMBOURSEMENT'), -54_000, 'la salle rend la moitié de sa part');
            const { data: after } = await service.from('referral_commissions').select('amount, status, cancellation_reason').eq('payment_id', dep.id).eq('generation', 'N1').eq('kind', 'COMMISSION').order('created_at');
            trace('1.5b commissions', after);
            const live = (after ?? []).filter((x) => x.status !== 'CANCELLED').reduce((s, x) => s + n(x.amount), 0);
            assert.equal(live, Math.round(expected * 50) / 100, 'commission recalculée à 50 %');
            const { data: led } = await service.from('finance_ledger').select('amount').eq('owner_id', sponsor.userId).eq('account_kind', 'PARRAINAGE');
            assert.equal(Math.round((led ?? []).reduce((s, x) => s + n(x.amount), 0) * 100) / 100, Math.round(expected * 50) / 100, 'grand livre du parrain');
        } finally {
            await setPlatformSetting('halls.commission_rate', before, 'contre-vérification 10a : valeur d’origine');
        }
    });
});

describe('1.6 Ordre des paiements, paiement en double', () => {
    test('solde avant l’acompte : refusé, aucun paiement', async () => {
        const client = await newBuyer('cv10a-solde-avant');
        const id = String((await reserveRpc(client, await newHall(partner), { days: 2, startInDays: 48 })).reservation_id);
        const r = await startPayment(client, id, 'SOLDE');
        assert.deepEqual([r.status, r.body.code], [409, 'DEPOSIT_FIRST'], show(r));
        assert.deepEqual(await paymentsOfReservation(id), []);
    });

    test('deux acomptes lancés en même temps : un seul paiement', async () => {
        const client = await newBuyer('cv10a-2acomptes');
        const id = String((await reserveRpc(client, await newHall(partner), { days: 2, startInDays: 49 })).reservation_id);
        const rs = await Promise.all([startPayment(client, id, 'ACOMPTE'), startPayment(client, id, 'ACOMPTE'), startPayment(client, id, 'INTEGRAL')]);
        trace('1.6b', rs.map((r) => `${r.status} ${String(r.body.code ?? '')}`));
        assert.equal(rs.filter((r) => r.status === 201).length, 1);
        assert.equal((await paymentsOfReservation(id)).length, 1);
    });

    test('acompte abandonné puis payé tard, après un paiement intégral : remboursé en entier, rien de plus pour la salle', async () => {
        const client = await newBuyer('cv10a-tard');
        const id = String((await reserveRpc(client, await newHall(partner), { days: 2, startInDays: 50 })).reservation_id);
        const p1 = await started(client, id, 'ACOMPTE');
        await agePayment(p1.id, 61);
        const p2 = await started(client, id, 'INTEGRAL');
        await confirmByWebhook(p2);
        await confirmByWebhook(p1);
        const row = await reservation(id);
        const pays = await paymentsOfReservation(id);
        trace('1.6c', { state: row.booking_state, paid: row.paid_amount, pays: pays.map((p) => [p.metadata && (p.metadata as Row).part, p.amount, p.status]) });
        assert.deepEqual([row.booking_state, n(row.paid_amount)], ['PAYEE', 420_000]);
        assert.equal(await ledgerSum(p1.id, 'VENTE'), 0, 'aucune vente pour le paiement en trop');
        const { data: cash } = await service.from('cashouts').select('amount').eq('payment_id', p1.id);
        assert.deepEqual((cash ?? []).map((c) => n(c.amount)), [126_000], 'paiement en trop rendu en entier');
    });

    test('solde payé deux fois : le second est rendu en entier', async () => {
        const client = await newBuyer('cv10a-2soldes');
        const id = String((await reserveRpc(client, await newHall(partner), { days: 2, startInDays: 51 })).reservation_id);
        await payConfirmed(client, id, 'ACOMPTE');
        const s1 = await started(client, id, 'SOLDE');
        await agePayment(s1.id, 61);
        const s2 = await started(client, id, 'SOLDE');
        await confirmByWebhook(s2);
        await confirmByWebhook(s1);
        const row = await reservation(id);
        assert.deepEqual([row.booking_state, n(row.paid_amount)], ['PAYEE', 420_000]);
        const { data: cash } = await service.from('cashouts').select('amount').eq('payment_id', s1.id);
        assert.deepEqual((cash ?? []).map((c) => n(c.amount)), [294_000]);
        assert.equal(await ledgerSum(s1.id, 'VENTE'), 0);
    });

    test('webhook rejoué : une seule vente, rien de plus payé', async () => {
        const client = await newBuyer('cv10a-rejeu');
        const id = String((await reserveRpc(client, await newHall(partner), { days: 1, startInDays: 52 })).reservation_id);
        const p = await started(client, id, 'INTEGRAL');
        await confirmByWebhook(p);
        await confirmByWebhook(p);
        await confirmByWebhook(p);
        assert.equal(n((await reservation(id)).paid_amount), 210_000);
        assert.equal(await ledgerSum(p.id, 'VENTE'), 200_000);
    });
});

describe('1.7 Paiement qui arrive après l’expiration, l’annulation ou l’échéance', () => {
    test('après l’expiration, date reprise par un autre : le paiement est rendu, l’autre garde la date', async () => {
        const a = await newBuyer('cv10a-exp-a');
        const b = await newBuyer('cv10a-exp-b');
        const hall = await newHall(partner);
        const id = String((await reserveRpc(a, hall, { days: 1, startInDays: 53 })).reservation_id);
        const p = await started(a, id, 'INTEGRAL');
        await expireHold(id);
        await tick();
        const other = await reserveRpc(b, hall, { days: 1, startInDays: 53 });
        assert.equal(other.ok, true, JSON.stringify(other));
        await confirmByWebhook(p);
        const row = await reservation(id);
        trace('1.7a', { a: row.booking_state, paid: row.paid_amount, b: (await reservation(String(other.reservation_id))).booking_state });
        assert.deepEqual([row.booking_state, n(row.paid_amount)], ['EXPIREE', 0]);
        const { data: cash } = await service.from('cashouts').select('amount').eq('payment_id', p.id);
        assert.deepEqual((cash ?? []).map((c) => n(c.amount)), [210_000]);
    });

    test('après l’annulation par le client : le paiement est rendu en entier', async () => {
        const client = await newBuyer('cv10a-ann-pay');
        const id = String((await reserveRpc(client, await newHall(partner), { days: 1, startInDays: 54 })).reservation_id);
        const p = await started(client, id, 'INTEGRAL');
        assert.equal((await clientCancel(id, client.accessToken)).status, 200);
        await confirmByWebhook(p);
        const row = await reservation(id);
        assert.deepEqual([row.booking_state, n(row.paid_amount)], ['ANNULEE_CLIENT', 0]);
        const { data: cash } = await service.from('cashouts').select('amount').eq('payment_id', p.id);
        assert.deepEqual((cash ?? []).map((c) => n(c.amount)), [210_000]);
    });

    test('acompte proposé quand le solde est dû quelques minutes plus tard (réservation à J-7 + quelques minutes)', async () => {
        const client = await newBuyer('cv10a-j7');
        const hall = await newHall(partner, { price_per_day: 200_000, price_per_hour: 20_000, cancellation_policy: 'MODEREE' });
        const slot = halfHourSlot(Date.now() + 7 * DAY_MS + 3 * 60_000, 'up');
        const q = await reserveRpc(client, hall, { mode: 'HEURE', startDate: slot.startDate, startTime: slot.startTime, hours: 1 });
        assert.equal(q.ok, true, JSON.stringify(q));
        const dueInMin = (Date.parse(String(q.balance_due_at)) - Date.now()) / 60_000;
        trace('1.7c', { full: q.full_payment_required, balance_due_at: q.balance_due_at, dueInMin: Math.round(dueInMin), deposit: q.deposit_amount });
        // Sûr : paiement en une fois exigé, ou au moins 24 h pour payer le solde après l'acompte
        assert.ok(q.full_payment_required === true || dueInMin >= 24 * 60,
            `acompte de ${String(q.deposit_amount)} F proposé, solde dû dans ${Math.round(dueInMin)} min`);
    });

    test('acompte lancé avant l’échéance du solde, confirmé après : le client ne perd pas son acompte', async () => {
        const client = await newBuyer('cv10a-echeance');
        const hall = await newHall(partner, { price_per_day: 200_000, cancellation_policy: 'STRICTE' });
        const id = String((await reserveRpc(client, hall, { days: 2, startInDays: 20 })).reservation_id);
        const p = await started(client, id, 'ACOMPTE');
        // Le temps passe : paiement lancé il y a 5 minutes, échéance du solde passée depuis 1 minute, Wave confirme maintenant
        await agePayment(p.id, 5);
        await service.from('hall_reservations').update({ balance_due_at: new Date(Date.now() - 60_000).toISOString() }).eq('id', id);
        await confirmByWebhook(p);
        const afterConfirm = await reservation(id);
        const solde = await startPayment(client, id, 'SOLDE');
        await tick();
        const row = await reservation(id);
        trace('1.7d', { confirm: afterConfirm.booking_state, solde: `${solde.status} ${String(solde.body.code ?? '')}`, state: row.booking_state, paid: row.paid_amount, refunded: row.refunded_amount });
        const lost = n(row.paid_amount) - n(row.refunded_amount);
        assert.ok(!(row.booking_state === 'DELAI_DEPASSE' && lost > 0),
            `acompte encaissé après l’échéance puis réservation annulée d’office : ${lost} F perdus (${row.booking_state}, solde ${solde.status} ${String(solde.body.code ?? '')})`);
    });
});

describe('1.8 Double remboursement, remboursement plus grand que le payé', () => {
    test('annulations simultanées (client ×3, salle, Event Village, tâche) : un seul remboursement par paiement', async () => {
        const client = await newBuyer('cv10a-double');
        const id = String((await reserveRpc(client, await newHall(partner), { days: 2, startInDays: 25 })).reservation_id);
        await payConfirmed(client, id, 'ACOMPTE');
        await payConfirmed(client, id, 'SOLDE');
        const admin = await newAdmin('cv10a-remb', ['refunds.manage']);
        const rs = await Promise.all([
            clientCancel(id, client.accessToken), clientCancel(id, client.accessToken), clientCancel(id, client.accessToken),
            partnerAction(id, partner.accessToken, { action: 'CANCEL', reason: 'Fuite d’eau dans la salle' }),
            adminCancel(id, admin.accessToken, 'Salle fermée par la mairie'),
            service.rpc('hall_reservations_tick').then(() => ({ status: 0, body: {} })),
        ]);
        trace('1.8a', rs.map((r) => `${r.status} ${String((r.body as Row).code ?? '')}`));
        assert.equal(rs.filter((r) => r.status === 200).length, 1, 'une seule annulation');
        const refunds = await refundsOf(id);
        const row = await reservation(id);
        trace('1.8a remboursements', refunds.map((r) => [r.payment_id, r.amount]));
        assert.equal(new Set(refunds.map((r) => r.payment_id)).size, refunds.length, 'un remboursement par paiement');
        assert.ok(refunds.reduce((s, r) => s + n(r.amount), 0) <= n(row.paid_amount));
    });

    test('annulation par la salle d’une réservation payée en deux fois : rendu = payé, part de la salle reprise, frais Wave gardés par Event Village', async () => {
        const client = await newBuyer('cv10a-tout');
        const id = String((await reserveRpc(client, await newHall(partner), { days: 2, startInDays: 26 })).reservation_id);
        const dep = await payConfirmed(client, id, 'ACOMPTE');
        const bal = await payConfirmed(client, id, 'SOLDE');
        const r = await partnerAction(id, partner.accessToken, { action: 'CANCEL', reason: 'Travaux imprévus' });
        assert.equal(r.status, 200, show(r));
        const refunds = await refundsOf(id);
        assert.deepEqual(refunds.map((x) => [n(x.amount), n(x.facial_part), n(x.service_part), n(x.aggregator_fee_share)]),
            [[126_000, 120_000, 6_000, 1_890], [294_000, 280_000, 14_000, 4_410]]);
        for (const p of [dep, bal]) assert.equal(await ledgerSum(p.id, 'VENTE') + await ledgerSum(p.id, 'REMBOURSEMENT'), 0, `salle à 0 pour ${p.id}`);
        const row = await reservation(id);
        assert.deepEqual([n(row.paid_amount), n(row.refunded_amount)], [420_000, 420_000]);
        const again = await adminCancel(id, (await newAdmin('cv10a-remb2', ['refunds.manage'])).accessToken, 'Second remboursement');
        assert.deepEqual([again.status, again.body.code], [409, 'NOT_CANCELLABLE']);
        const { data: ref } = await service.rpc('hall_refund_payment', { p_payment_id: dep.id, p_percent: 100, p_reason: 'rejeu' });
        assert.equal((await refundsOf(id)).length, 2, `second remboursement du même paiement : ${JSON.stringify(ref)}`);
    });
});

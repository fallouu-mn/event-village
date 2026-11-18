/**
 * Contre-vérification du lot 11a — point 1 : argent. Payer moins que dû (montants du corps, acompte 0, personnes 0 ou
 * énormes, arrondis), payer deux fois, paiement après l'expiration, après « sans réponse », après un refus ou une
 * annulation, double remboursement ; paiement sur place jamais compté ni au grand livre ; grand livre et parrainage
 * justes au franc près. Un test rouge est un TROU (docs/audit-lot11a.md). Base LOCALE, faux SamirPay.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { assertLot11aInvariants } from '../helpers/lot11a-invariants';
import { inRolledBackTransaction } from '../helpers/db';
import { FINANCE_INVARIANT_SQL } from '../helpers/finance-invariants';
import { newAdmin } from '../parcours/notif-helpers';
import {
    adminCancel, agePayment, api, clientCancel, confirmByWebhook, dayFromNow, depositVenue, ledgerOfPayment, n, newBuyer, newPartner,
    newTable, newVenue, openTablesService, partnerAction, payConfirmed, paymentsOfReservation, refundsOf, reservation, reserveRoute,
    reserved, service, shiftReservation, show, sql, started, startIn, startPayment, tick, trace, type Buyer, type Row, type TestPartner,
} from './cv11a-helpers';

let restore: () => Promise<void>;
let partner: TestPartner;

before(async () => {
    restore = await openTablesService();
    partner = await newPartner('cv11a-argent');
});

after(async () => {
    await restore();
    await assertLot11aInvariants('cv11a-1-argent');
});

/** Net de l'établissement au grand livre pour une réservation (ventes moins remboursements). */
async function partnerNet(reservationId: string): Promise<number> {
    const rows = await sql<{ s: string | null }>(
        `SELECT COALESCE(sum(l.amount), 0) AS s FROM public.finance_ledger l JOIN public.payments p ON p.id = l.payment_id
          WHERE p.table_reservation_id = $1 AND l.entry_type IN ('VENTE', 'REMBOURSEMENT')`, [reservationId]);
    return n(rows[0].s);
}

/** Encaissé (paiements confirmés chez l'opérateur) et rendu (remboursements) pour une réservation. */
async function moneyOf(reservationId: string): Promise<{ cashed: number; refunded: number; payments: Array<[string, number]> }> {
    const pays = await paymentsOfReservation(reservationId);
    const refunds = await refundsOf(reservationId);
    const cashed = pays.filter((p) => ['SUCCESS', 'REFUND_PENDING', 'REFUNDED', 'PARTIAL'].includes(String(p.status))).reduce((s, p) => s + n(p.amount), 0);
    return { cashed, refunded: refunds.reduce((s, r) => s + n(r.amount), 0), payments: pays.map((p) => [String(p.status), n(p.amount)]) };
}

describe('1.1 Payer moins que dû', () => {
    test('montants, taux et autre client envoyés dans le corps : ignorés (1 234 × 3 → 3 888 calculés en base)', async () => {
        const client = await newBuyer('cv11a-corps');
        const other = await newBuyer('cv11a-corps-autre');
        const { venue } = await depositVenue(partner, 1_234);
        const r = await reserveRoute(client, {
            venueId: venue, date: dayFromNow(30), time: '20:00', guests: 3,
            totalAmount: 1, total_amount: 1, deposit_amount: 0, depositAmount: 0, service_fee_amount: 0, deposit_per_person: 1,
            commission_rate: 100, client_id: other.userId, clientId: other.userId, booking_state: 'CONFIRMEE', paid_amount: 3_888,
        });
        assert.equal(r.status, 200, JSON.stringify(r.body));
        const id = String((r.body.reservation as Row).id);
        const row = await reservation(id);
        trace('1.1a', { http: r.status, total: row.total_amount, deposit: row.deposit_amount, fee: row.service_fee_amount, client: row.client_id === client.userId, state: row.booking_state });
        assert.deepEqual([n(row.deposit_amount), n(row.service_fee_amount), n(row.total_amount), n(row.paid_amount)], [3_702, 186, 3_888, 0]);
        assert.equal(row.client_id, client.userId);
        assert.equal(row.booking_state, 'EN_ATTENTE_PAIEMENT');
        const pay = await startPayment(client, id, { amount: 1, totalAmount: 1, part: 'SOLDE', targetType: 'TABLE_RESERVATION' });
        trace('1.1b', { http: pay.status, amount: pay.payment?.amount });
        assert.equal(pay.status, 201, JSON.stringify(pay.body));
        assert.equal(n(pay.payment!.amount), 3_888);
    });

    test('personnes 0, négatives, énormes, décimales, texte, booléen, tableau ; heure et date illisibles : refusées (400), rien de créé', async () => {
        const client = await newBuyer('cv11a-saisies');
        const { venue } = await depositVenue(partner, 5_000);
        const date = dayFromNow(31);
        const bad: Array<[string, Row]> = [
            ['0', { guests: 0 }], ['-1', { guests: -1 }], ['51', { guests: 51 }], ['2^31', { guests: 2 ** 31 }], ['1e21', { guests: 1e21 }],
            ['4.5', { guests: 4.5 }], ['"4.5"', { guests: '4.5' }], ['"4abc"', { guests: '4abc' }], ['true', { guests: true }], ['[4]', { guests: [4] }],
            ['vide', { guests: '' }], ['null', { guests: null }], ['"1e1"', { guests: '1e1' }],
            ['24:00', { time: '24:00' }], ['20:07', { time: '20:07' }], ['20:00:30', { time: '20:00:30' }], ['25:00', { time: '25:00' }],
            ['date 30 février', { date: '2027-02-30' }], ['date epoch', { date: 'epoch' }], ['date infinity', { date: 'infinity' }],
            ['date -infinity', { date: '-infinity' }], ['date 1900', { date: '1900-01-01' }],
        ];
        const replies: Row = {};
        for (const [label, patch] of bad) {
            const res = await reserveRoute(client, { venueId: venue, date, time: '20:00', guests: 4, ...patch });
            replies[label] = `${res.status} ${String(res.body.code)}`;
        }
        trace('1.1c', replies);
        const rows = await sql(`SELECT id FROM public.table_reservations WHERE client_id = $1`, [client.userId]);
        assert.equal(rows.length, 0, `réservation créée par une saisie invalide : ${JSON.stringify(replies)}`);
        for (const [label, reply] of Object.entries(replies)) assert.match(String(reply), /^400 /, `${label} : ${String(reply)}`);
    });

    test('acompte 0, 99, 50,5, négatif ou 1 000 001 F par personne : refusé à la création (route) et en base', async () => {
        const replies: Row = {};
        for (const deposit of [0, 99, 50.5, -100, 1_000_001]) {
            const res = await api('POST', 'partner/venues', { token: partner.accessToken, body: { name: `TEST cv11a acompte ${deposit}`, deposit_per_person: deposit } });
            replies[String(deposit)] = res.status;
            assert.equal(res.status, 400, `acompte ${deposit} : ${show(res)}`);
        }
        const { error } = await service.from('venues').insert({ partner_id: partner.partnerId, name: 'TEST cv11a acompte 0 direct', deposit_per_person: 0 });
        trace('1.1d', { replies, direct: error?.code });
        assert.equal(error?.code, '23514', 'acompte 0 écrit en base');
    });

    test('acompte maximal : 1 000 000 F × 50 personnes → 52 500 000 F à payer, calculés en base sans dépassement', async () => {
        const client = await newBuyer('cv11a-enorme');
        const venue = await newVenue(partner, { deposit_per_person: 1_000_000 });
        await newTable(partner, venue, 50);
        const id = await reserved(client, venue, { date: dayFromNow(32), guests: 50 });
        const row = await reservation(id);
        trace('1.1e', { deposit: row.deposit_amount, fee: row.service_fee_amount, total: row.total_amount });
        assert.deepEqual([n(row.deposit_amount), n(row.service_fee_amount), n(row.total_amount)], [50_000_000, 2_500_000, 52_500_000]);
        const pay = await startPayment(client, id);
        trace('1.1e paiement', `${pay.status} ${JSON.stringify(pay.body).slice(0, 300)}`);
        assert.ok(pay.status < 500, `paiement d'un gros acompte : erreur serveur ${pay.status}`);
        if (pay.payment) assert.equal(n(pay.payment.amount), 52_500_000);
    });
});

describe('1.2 Payer deux fois, payer trop tard', () => {
    test('deux paiements du même acompte (le premier abandonné 61 min puis payé) : le second rendu en entier, une seule vente', async () => {
        const client = await newBuyer('cv11a-deux-fois');
        const { venue } = await depositVenue(partner);
        const id = await reserved(client, venue, { date: dayFromNow(33) });
        const p1 = await started(client, id);
        await agePayment(p1.id, 61);
        const p2 = await started(client, id);
        await confirmByWebhook(p2);
        await confirmByWebhook(p1);
        const row = await reservation(id);
        const money = await moneyOf(id);
        trace('1.2a', { state: row.booking_state, paid: row.paid_amount, ...money, net: await partnerNet(id) });
        assert.equal(row.booking_state, 'CONFIRMEE');
        assert.equal(n(row.paid_amount), 21_000);
        assert.equal(money.cashed - money.refunded, 21_000, 'gardé = un acompte');
        assert.equal(await partnerNet(id), 20_000);
        assert.equal(await ledgerOfPayment(p1.id, 'VENTE'), 0, 'vente pour le second paiement');
    });

    for (const scenario of ['sans réponse', 'refus', 'annulation par Event Village'] as const) {
        test(`demande payée puis close (${scenario}), puis un paiement plus ancien confirmé : tout rendu, l’établissement à 0`, async () => {
            const client = await newBuyer(`cv11a-close-${scenario === 'sans réponse' ? 'sr' : scenario === 'refus' ? 'refus' : 'ev'}`);
            const { venue } = await depositVenue(partner, 5_000, { confirmation_mode: 'MANUELLE' });
            const id = await reserved(client, venue, { date: dayFromNow(34) });
            const p1 = await started(client, id);
            await agePayment(p1.id, 61);
            const p2 = await started(client, id);
            await confirmByWebhook(p2);
            assert.equal((await reservation(id)).booking_state, 'EN_ATTENTE_ACCEPTATION');
            let closing: unknown;
            if (scenario === 'sans réponse') {
                await shiftReservation(id, { responseMinutes: -1 });
                closing = await tick();
            } else if (scenario === 'refus') {
                closing = show(await partnerAction(id, partner.accessToken, { action: 'REFUSER', reason: 'Complet ce soir-là' }));
            } else {
                const admin = await newAdmin('cv11a-ev', ['refunds.manage']);
                closing = show(await adminCancel(id, admin.accessToken, 'Établissement fermé pour travaux'));
            }
            await confirmByWebhook(p1);
            const row = await reservation(id);
            const money = await moneyOf(id);
            trace(`1.2 ${scenario}`, { closing, state: row.booking_state, paid: row.paid_amount, refundedRow: row.refunded_amount, ...money, net: await partnerNet(id) });
            assert.ok(['SANS_REPONSE', 'REFUSEE', 'ANNULEE_EV'].includes(String(row.booking_state)), String(row.booking_state));
            assert.equal(money.cashed, 42_000);
            assert.equal(money.refunded, 42_000, 'tout ce qui a été payé est rendu');
            assert.equal(await partnerNet(id), 0, 'l’établissement ne garde rien');
        });
    }

    test('acompte en cours, client qui annule avant la confirmation : paiement arrivé ensuite rendu en entier (21 000)', async () => {
        const client = await newBuyer('cv11a-annule-avant');
        const { venue } = await depositVenue(partner);
        const id = await reserved(client, venue, { date: dayFromNow(35) });
        const p = await started(client, id);
        const cancel = await clientCancel(id, client.accessToken);
        await confirmByWebhook(p);
        const row = await reservation(id);
        const money = await moneyOf(id);
        trace('1.2e', { cancel: show(cancel), state: row.booking_state, ...money });
        assert.equal(row.booking_state, 'ANNULEE_CLIENT');
        assert.equal(money.refunded, 21_000);
        assert.equal(await partnerNet(id), 0);
    });

    test('paiement lancé avant l’heure, confirmé après le début du créneau : rendu en entier, jamais confirmé', async () => {
        const client = await newBuyer('cv11a-apres-heure');
        const { venue } = await depositVenue(partner);
        const id = await reserved(client, venue, startIn(60));
        const p = await started(client, id);
        await shiftReservation(id, { startMinutes: -5, holdMinutes: 10 });
        await confirmByWebhook(p);
        const row = await reservation(id);
        const money = await moneyOf(id);
        trace('1.2f', { state: row.booking_state, paid: row.paid_amount, ...money });
        assert.notEqual(row.booking_state, 'CONFIRMEE');
        assert.equal(money.refunded, 21_000);
    });
});

describe('1.3 Double remboursement', () => {
    test('annulations simultanées (client ×3, établissement, Event Village, tâche) puis remboursement direct rejoué : une seule fois 21 000', async () => {
        const client = await newBuyer('cv11a-double-rembt');
        const admin = await newAdmin('cv11a-double', ['refunds.manage']);
        const { venue } = await depositVenue(partner);
        const id = await reserved(client, venue, { date: dayFromNow(36) });
        const pay = await payConfirmed(client, id);
        const replies = await Promise.all([
            clientCancel(id, client.accessToken), clientCancel(id, client.accessToken), clientCancel(id, client.accessToken),
            partnerAction(id, partner.accessToken, { action: 'ANNULER', reason: 'Fermeture exceptionnelle' }),
            adminCancel(id, admin.accessToken, 'Litige avec l’établissement'),
            tick(),
        ]);
        const again = await service.rpc('table_refund_payment', { p_payment_id: pay.id, p_percent: 100, p_reason: 'rejeu' });
        const refunds = await refundsOf(id);
        const cashouts = await sql(`SELECT id, amount FROM public.cashouts WHERE payment_id = $1`, [pay.id]);
        trace('1.3', { replies: replies.slice(0, 5).map((r) => (r as { status: number }).status), refunds: refunds.map((r) => r.amount), cashouts: cashouts.length, again: again.error?.message ?? 'ok' });
        assert.equal(replies.slice(0, 5).filter((r) => (r as { status: number }).status === 200).length, 1, 'une seule annulation acceptée');
        assert.equal(refunds.length, 1);
        assert.equal(n(refunds[0].amount), 21_000);
        assert.equal(cashouts.length, 1);
        assert.equal(await partnerNet(id), 0);
    });
});

describe('1.4 Paiement sur place : jamais compté', () => {
    test('déclaré sur une réservation payée puis annulée par l’établissement : aucun paiement, aucune écriture, seul l’acompte rendu', async () => {
        const client = await newBuyer('cv11a-sur-place');
        const { venue } = await depositVenue(partner);
        const id = await reserved(client, venue, { date: dayFromNow(37) });
        const pay = await payConfirmed(client, id);
        const before = { pays: (await paymentsOfReservation(id)).length, ledger: await sql(`SELECT count(*)::int AS c FROM public.finance_ledger WHERE owner_id = $1`, [partner.userId]) };
        const rec = await partnerAction(id, partner.accessToken, { action: 'PAIEMENT_SUR_PLACE', amount: 150_000, method: 'ESPECES' });
        const big = await partnerAction(id, partner.accessToken, { action: 'PAIEMENT_SUR_PLACE', amount: 10_000_001, method: 'ESPECES' });
        const weird = await partnerAction(id, partner.accessToken, { action: 'PAIEMENT_SUR_PLACE', amount: '1e5', method: 'WAVE' });
        const afterRec = { pays: (await paymentsOfReservation(id)).length, ledger: await sql(`SELECT count(*)::int AS c FROM public.finance_ledger WHERE owner_id = $1`, [partner.userId]) };
        const cancel = await partnerAction(id, partner.accessToken, { action: 'ANNULER', reason: 'Fermeture exceptionnelle' });
        const row = await reservation(id);
        const refunds = await refundsOf(id);
        trace('1.4a', { rec: show(rec), big: big.status, weird: weird.status, before, afterRec, cancel: cancel.status, onsite: row.onsite_amount, payStatus: row.payment_status, refunds: refunds.map((r) => r.amount) });
        assert.equal(rec.status, 200, show(rec));
        assert.equal(big.status, 400);
        assert.equal(afterRec.pays, before.pays, 'ligne de paiement créée');
        assert.deepEqual(afterRec.ledger, before.ledger, 'écriture au grand livre');
        assert.deepEqual(refunds.map((r) => n(r.amount)), [21_000], 'seul l’acompte payé en ligne est rendu');
        assert.equal(await ledgerOfPayment(pay.id, 'VENTE'), 20_000);
    });

    test('sur une réservation gratuite : aucune ligne de paiement, rien au grand livre ; relevés de l’établissement sans ce montant', async () => {
        const client = await newBuyer('cv11a-sur-place-gratuit');
        const venue = await newVenue(partner);
        await newTable(partner, venue, 4);
        const id = await reserved(client, venue, { date: dayFromNow(38) });
        const fin1 = await api('GET', 'partner/finance', { token: partner.accessToken });
        const rec = await partnerAction(id, partner.accessToken, { action: 'PAIEMENT_SUR_PLACE', amount: 77_777, method: 'OM_DIRECT' });
        const fin2 = await api('GET', 'partner/finance', { token: partner.accessToken });
        const pays = await paymentsOfReservation(id);
        trace('1.4b', { rec: rec.status, pays: pays.length, fin1: JSON.stringify(fin1.body).slice(0, 300), fin2: JSON.stringify(fin2.body).slice(0, 300) });
        assert.equal(rec.status, 200, show(rec));
        assert.equal(pays.length, 0);
        assert.ok(!JSON.stringify(fin2.body).includes('77777') && !JSON.stringify(fin2.body).includes('77 777'), 'montant sur place compté dans les relevés');
    });
});

describe('1.5 Grand livre et parrainage au franc près', () => {
    test('1 234 × 3 (3 888) avec parrain : vente 3 702 après la fin + 48 h, net Event Village 127,68, commission ; annulé à J-39 : tout repris', async () => {
        const sponsor = await newBuyer('cv11a-parrain');
        const client = await newBuyer('cv11a-filleul');
        const { data: cfg } = await service.from('referral_config').select('rate_n1, rate_n2, duration_months')
            .eq('sponsor_status', 'STANDARD').eq('referral_type', 'CLIENT_TO_CLIENT').eq('is_active', true).maybeSingle();
        const rate = n(cfg?.rate_n1 ?? 5);
        const { error } = await service.from('referral_relationships').insert({
            sponsor_id: sponsor.userId, referred_id: client.userId, referral_type: 'CLIENT_TO_CLIENT', sponsor_status_at_creation: 'STANDARD',
            rate_n1_at_creation: rate, rate_n2_at_creation: n(cfg?.rate_n2 ?? 2), duration_months: n(cfg?.duration_months ?? 12),
            expires_at: new Date(Date.now() + 365 * 86_400_000).toISOString(), is_active: true,
        });
        assert.equal(error, null, error?.message);
        const { venue } = await depositVenue(partner, 1_234);
        const date = dayFromNow(39);
        const id = await reserved(client, venue, { date, time: '20:00', guests: 3 });
        const pay = await payConfirmed(client, id);
        await service.rpc('calculate_referral_commissions', { p_payment_id: pay.id });
        const p = (await paymentsOfReservation(id))[0];
        const sale = await sql(`SELECT amount, available_at FROM public.finance_ledger WHERE source_key = $1`, [`VENTE-${pay.id}`]);
        const comm = await sql(`SELECT amount, status, available_at FROM public.referral_commissions WHERE payment_id = $1 AND kind = 'COMMISSION'`, [pay.id]);
        const end = Date.parse(`${date}T22:00:00Z`);
        trace('1.5a', { amount: p.amount, facial: p.facial_amount, fee: p.service_fee, agg: p.aggregator_fee, net: p.net_event_village_revenue, payout: p.partner_payout_amount, sale, comm });
        assert.deepEqual([n(p.amount), n(p.facial_amount), n(p.service_fee), n(p.aggregator_fee), n(p.net_event_village_revenue), n(p.partner_payout_amount)],
            [3_888, 3_702, 186, 58.32, 127.68, 3_702]);
        assert.equal(n(sale[0]?.amount), 3_702);
        assert.ok(new Date(String(sale[0].available_at)).getTime() >= end + 48 * 3_600_000 - 1000, 'vente disponible avant la fin + 48 h');
        assert.equal(n(comm[0]?.amount), Math.round(127.68 * rate) / 100, `commission ${rate} % du net`);
        const res = await clientCancel(id, client.accessToken);
        assert.equal(res.status, 200, show(res));
        const refunds = await refundsOf(id);
        const commAfter = await sql(`SELECT amount, status FROM public.referral_commissions WHERE payment_id = $1 AND kind = 'COMMISSION'`, [pay.id]);
        const sponsorNet = await sql<{ s: string }>(`SELECT COALESCE(sum(amount), 0) AS s FROM public.finance_ledger WHERE owner_id = $1`, [sponsor.userId]);
        const violations = (await sql(FINANCE_INVARIANT_SQL)).filter((v) => v.objet === pay.id);
        trace('1.5b', { refunds, commAfter, sponsorNet: sponsorNet[0].s, partnerNet: await partnerNet(id), violations });
        assert.deepEqual(refunds.map((r) => [n(r.amount), n(r.facial_part), n(r.service_part)]), [[3_888, 3_702, 186]]);
        assert.equal(await partnerNet(id), 0);
        assert.equal(n(sponsorNet[0].s), 0, 'le parrain garde une commission sur une réservation remboursée');
        assert.deepEqual(violations, []);
    });

    test('commission de 3 % (transaction annulée) : 3 702 × 3 % = 111,06 ; remboursement total : écart de l’établissement < 1 F', async () => {
        const payer = await newBuyer('cv11a-commission');
        const { venue } = await depositVenue(partner, 1_234);
        const out = await inRolledBackTransaction(async (c) => {
            const one = async (q: string, params: unknown[] = []): Promise<Row> => (await c.query<Row>(q, params)).rows[0];
            await c.query(`UPDATE public.platform_settings SET value = '{"value": 3}'::jsonb WHERE key = 'tables.commission_rate'`);
            const q = (await one(`SELECT public.table_reserve($1::jsonb) AS r`,
                [JSON.stringify({ client_id: payer.userId, venue_id: venue, date: dayFromNow(58), time: '20:00', guests: 3 })])).r as Row;
            const tag = `CV11A-${Date.now()}`;
            const created = (await one(`SELECT public.table_payment_create($1::jsonb) AS r`, [JSON.stringify({
                client_id: payer.userId, reservation_id: q.reservation_id, operator: 'WAVE', payer_phone: payer.phone9,
                transaction_id: `TX-${tag}`, external_order_id: `ORD-${tag}`, callback_token_hash: 'c'.repeat(64) })])).r as Row;
            await one(`SELECT public.table_payment_confirm($1::uuid, 'WEBHOOK') AS r`, [created.payment_id]);
            const pay = await one(`SELECT amount, facial_amount, service_fee, partner_payout_amount, net_event_village_revenue FROM public.payments WHERE id = $1`, [created.payment_id]);
            const cancel = (await one(`SELECT public.table_reservation_cancel($1::jsonb) AS r`,
                [JSON.stringify({ reservation_id: q.reservation_id, actor_id: payer.userId, origin: 'CLIENT' })])).r as Row;
            const refund = await one(`SELECT amount, facial_part, service_part, net_revenue_reversal FROM public.refunds WHERE payment_id = $1`, [created.payment_id]);
            const net = await one(`SELECT COALESCE(sum(amount), 0) AS s FROM public.finance_ledger WHERE payment_id = $1 AND entry_type IN ('VENTE', 'REMBOURSEMENT')`, [created.payment_id]);
            const violations = (await c.query<Row>(FINANCE_INVARIANT_SQL)).rows.filter((v) => v.objet === created.payment_id);
            return { pay, cancel: cancel.ok, refund, net: net.s, violations };
        });
        trace('1.5c', out);
        assert.equal(n((out.pay as Row).partner_payout_amount), 3_590.94);
        assert.equal(n((out.refund as Row).amount), 3_888, 'le client récupère tout');
        assert.ok(Math.abs(n(out.net)) < 1, `écart de l’établissement après remboursement total : ${String(out.net)} F`);
        assert.deepEqual(out.violations, []);
    });
});

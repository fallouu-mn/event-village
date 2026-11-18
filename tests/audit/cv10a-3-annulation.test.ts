/**
 * Contre-vérification du lot 10a — point 3 : annulation. Chaque règle à quelques minutes des seuils de 7 et 30 jours
 * (réservation réelle à l'heure, payée, annulée par la route du client), client qui annule la réservation d'un autre,
 * salle qui annule celle d'une autre salle, annulation après le début, délai de paiement dépassé appliqué deux fois.
 * Un test rouge est un TROU (docs/audit-lot10a.md).
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { assertLot10aInvariants } from '../helpers/lot10a-invariants';
import { newAdmin } from '../parcours/notif-helpers';
import { cronRequest } from '../parcours/paiement-helpers';
import { GET as cronMoratoriums } from '../../app/api/cron/moratoriums/route';
import {
    DAY_MS, adminCancel, agePayment, clientCancel, confirmByWebhook, dayFromNow, halfHourSlot, ledgerSum, n, newBuyer, newHall,
    newPartner, openHallsService, partnerAction, payConfirmed, refundsOf, reservation, reserveRpc, service, show, started, tick,
    trace, type Reply, type TestPartner,
} from './cv10a-helpers';

let restore: () => Promise<void>;
let partner: TestPartner;

before(async () => {
    restore = await openHallsService();
    partner = await newPartner('cv10a-annul');
});

after(async () => {
    await restore();
    await assertLot10aInvariants('cv10a-3-annulation');
});

describe('3.1 Règles d’annulation à quelques minutes des seuils (réservation à l’heure, 10 500 F payés)', () => {
    const cases: Array<['SOUPLE' | 'MODEREE' | 'STRICTE', number, 'plus' | 'moins', number]> = [
        ['SOUPLE', 7, 'plus', 100], ['SOUPLE', 7, 'moins', 50],
        ['MODEREE', 30, 'plus', 100], ['MODEREE', 30, 'moins', 50], ['MODEREE', 7, 'plus', 50], ['MODEREE', 7, 'moins', 0],
        ['STRICTE', 30, 'plus', 50], ['STRICTE', 30, 'moins', 0],
    ];
    for (const [policy, days, side, pct] of cases) {
        test(`${policy}, ${side === 'plus' ? 'un peu plus' : 'un peu moins'} de ${days} jours avant : ${pct} %`, async () => {
            const client = await newBuyer(`cv10a-seuil-${policy}-${days}-${side}`);
            const hall = await newHall(partner, { price_per_day: 200_000, price_per_hour: 10_000, cancellation_policy: policy });
            const target = Date.now() + days * DAY_MS + (side === 'plus' ? 3 : -3) * 60_000;
            const slot = halfHourSlot(target, side === 'plus' ? 'up' : 'down');
            const q = await reserveRpc(client, hall, { mode: 'HEURE', startDate: slot.startDate, startTime: slot.startTime, hours: 1 });
            assert.equal(q.ok, true, JSON.stringify(q));
            const id = String(q.reservation_id);
            await payConfirmed(client, id, 'INTEGRAL');
            const marginMin = (slot.startMs - Date.now() - days * DAY_MS) / 60_000;
            const c = await clientCancel(id, client.accessToken);
            assert.equal(c.status, 200, show(c));
            const row = await reservation(id);
            trace(`3.1 ${policy} ${days} ${side}`, { start: `${slot.startDate} ${slot.startTime}`, marginMin: Math.round(marginMin * 10) / 10, pct: row.refund_percent, refunded: row.refunded_amount, message: c.body.message });
            assert.deepEqual([n(row.refund_percent), n(row.refunded_amount)], [pct, Math.round(10_500 * pct / 100)]);
            assert.equal((await refundsOf(id)).reduce((s, r) => s + n(r.amount), 0), Math.round(10_500 * pct / 100));
        });
    }
});

describe('3.2 et 3.3 Annuler la réservation d’un autre', () => {
    test('un client annule la réservation payée d’un autre : « Réservation introuvable », rien ne bouge', async () => {
        const owner = await newBuyer('cv10a-a-proprio');
        const intruder = await newBuyer('cv10a-a-intrus');
        const id = String((await reserveRpc(owner, await newHall(partner), { days: 1, startInDays: 90 })).reservation_id);
        await payConfirmed(owner, id, 'INTEGRAL');
        const r = await clientCancel(id, intruder.accessToken);
        assert.deepEqual([r.status, r.body.code], [404, 'RESERVATION_NOT_FOUND'], show(r));
        assert.equal((await reservation(id)).booking_state, 'PAYEE');
        assert.deepEqual(await refundsOf(id), []);
    });

    test('une salle annule ou « vérifie » la réservation d’une autre salle : introuvable ; une partenaire n’a pas la route de l’administration', async () => {
        const other = await newPartner('cv10a-autre-salle');
        const client = await newBuyer('cv10a-a-client');
        const id = String((await reserveRpc(client, await newHall(partner), { days: 1, startInDays: 91 })).reservation_id);
        await payConfirmed(client, id, 'INTEGRAL');
        const cancel = await partnerAction(id, other.accessToken, { action: 'CANCEL', reason: 'Je reprends la date' });
        const confirm = await partnerAction(id, other.accessToken, { action: 'CONFIRM' });
        const admin = await adminCancel(id, other.accessToken, 'Je reprends la date');
        trace('3.3', [show(cancel), show(confirm), show(admin)]);
        assert.deepEqual([cancel.status, confirm.status], [404, 404]);
        assert.ok(admin.status === 401 || admin.status === 403, show(admin));
        assert.ok(!JSON.stringify(confirm.body).includes('210'), 'montant de la réservation d’une autre salle révélé');
        assert.equal((await reservation(id)).booking_state, 'PAYEE');
        const short = await partnerAction(id, partner.accessToken, { action: 'CANCEL', reason: ' \u0007\u0008ab ' });
        assert.deepEqual([short.status, short.body.code], [400, 'REASON_REQUIRED'], show(short));
    });
});

describe('3.4 Annulation après le début', () => {
    test('réservation commencée hier : ni le client ni la salle ne l’annulent ; terminée : Event Village non plus', async () => {
        const client = await newBuyer('cv10a-commencee');
        const id = String((await reserveRpc(client, await newHall(partner), { days: 1, startInDays: 92 })).reservation_id);
        await payConfirmed(client, id, 'INTEGRAL');
        // Le temps passe : la réservation a commencé hier et finit demain
        const { error } = await service.from('hall_reservations').update({ start_date: dayFromNow(-1), end_date: dayFromNow(1) }).eq('id', id);
        assert.equal(error, null, error?.message);
        const c = await clientCancel(id, client.accessToken);
        const s = await partnerAction(id, partner.accessToken, { action: 'CANCEL', reason: 'Annulation tardive' });
        trace('3.4', [show(c), show(s)]);
        assert.deepEqual([c.status, c.body.code], [409, 'ALREADY_STARTED']);
        assert.deepEqual([s.status, s.body.code], [409, 'ALREADY_STARTED']);
        const { error: e2 } = await service.from('hall_reservations').update({ start_date: dayFromNow(-3), end_date: dayFromNow(-2) }).eq('id', id);
        assert.equal(e2, null, e2?.message);
        const a = await adminCancel(id, (await newAdmin('cv10a-fini', ['refunds.manage'])).accessToken, 'Litige après la fête');
        assert.deepEqual([a.status, a.body.code], [409, 'ALREADY_ENDED'], show(a));
        assert.deepEqual(await refundsOf(id), []);
        assert.equal((await reservation(id)).booking_state, 'PAYEE');
    });
});

describe('3.5 Délai de paiement dépassé appliqué deux fois', () => {
    test('tâche ×3, route de la tâche ×2 et annulation du client en même temps : un seul remboursement de l’acompte (50 %, 63 000)', async () => {
        const client = await newBuyer('cv10a-delai2');
        const id = String((await reserveRpc(client, await newHall(partner), { days: 2, startInDays: 20 })).reservation_id);
        const dep = await payConfirmed(client, id, 'ACOMPTE');
        await service.from('hall_reservations').update({ balance_due_at: new Date(Date.now() - 60_000).toISOString() }).eq('id', id);
        const asReply = (p: PromiseLike<unknown>): Promise<Reply> => Promise.resolve(p).then(() => ({ status: 0, body: {} }));
        const rs = await Promise.all([
            asReply(service.rpc('hall_reservations_tick')), asReply(service.rpc('hall_reservations_tick')), asReply(service.rpc('hall_reservations_tick')),
            cronMoratoriums(cronRequest('/api/cron/moratoriums')).then(async (r) => ({ status: r.status, body: await r.json() })),
            cronMoratoriums(cronRequest('/api/cron/moratoriums')).then(async (r) => ({ status: r.status, body: await r.json() })),
            clientCancel(id, client.accessToken),
        ]);
        await tick();
        const row = await reservation(id);
        const refunds = await refundsOf(id);
        trace('3.5a', { replies: rs.map((r) => r.status), state: row.booking_state, refunds: refunds.map((r) => r.amount) });
        assert.ok(['DELAI_DEPASSE', 'ANNULEE_CLIENT'].includes(String(row.booking_state)), String(row.booking_state));
        assert.deepEqual(refunds.map((r) => n(r.amount)), [63_000]);
        assert.equal(await ledgerSum(dep.id, 'REMBOURSEMENT'), -60_000);
        assert.equal(n(row.refunded_amount), 63_000);
    });

    test('solde lancé avant l’échéance, confirmé plus d’une heure après, la réservation ayant été annulée pour délai dépassé : solde rendu en entier', async () => {
        const client = await newBuyer('cv10a-solde-tard');
        const id = String((await reserveRpc(client, await newHall(partner), { days: 2, startInDays: 21 })).reservation_id);
        await payConfirmed(client, id, 'ACOMPTE');
        const s = await started(client, id, 'SOLDE');
        await agePayment(s.id, 70);
        await service.from('hall_reservations').update({ balance_due_at: new Date(Date.now() - 65 * 60_000).toISOString() }).eq('id', id);
        await tick();
        assert.equal((await reservation(id)).booking_state, 'DELAI_DEPASSE');
        await confirmByWebhook(s);
        await tick();
        const row = await reservation(id);
        const { data: cash } = await service.from('cashouts').select('amount').eq('payment_id', s.id);
        trace('3.5b', { state: row.booking_state, paid: row.paid_amount, refunded: row.refunded_amount, soldeRendu: cash });
        assert.deepEqual((cash ?? []).map((c) => n(c.amount)), [294_000]);
        assert.equal(await ledgerSum(s.id, 'VENTE'), 0);
        assert.deepEqual([row.booking_state, n(row.paid_amount)], ['DELAI_DEPASSE', 126_000]);
    });

    test('solde lancé avant l’échéance, confirmé dans l’heure : payée, la tâche ne l’annule pas', async () => {
        const client = await newBuyer('cv10a-solde-ok');
        const id = String((await reserveRpc(client, await newHall(partner), { days: 2, startInDays: 22 })).reservation_id);
        await payConfirmed(client, id, 'ACOMPTE');
        const s = await started(client, id, 'SOLDE');
        await agePayment(s.id, 10);
        await service.from('hall_reservations').update({ balance_due_at: new Date(Date.now() - 5 * 60_000).toISOString() }).eq('id', id);
        await tick();
        await confirmByWebhook(s);
        await tick();
        const row = await reservation(id);
        assert.deepEqual([row.booking_state, n(row.paid_amount), n(row.refunded_amount)], ['PAYEE', 420_000, 0]);
    });
});

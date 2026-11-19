/**
 * Lot 10b (point 5) — avis du parcours des salles mis en file par la tâche planifiée et par les versements : rappel du
 * solde à J-10 puis J-8 (un de chaque), rappel la veille (client et salle), recettes disponibles (salle), remboursement
 * versé (HALL_REFUND_PAID au lieu de l'avis des billets). Base LOCALE, faux SamirPay.
 * Le temps qui passe est simulé comme dans les suites du lot 10a : on déplace les dates de la réservation (et la date de
 * disponibilité de sa vente au grand livre, gardée après la fin), jamais l'horloge. La nuit (réglages
 * notif.sms_quiet_start / _end) est neutralisée le temps de la suite (0 et 0 : jamais la nuit), puis rendue.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { assertLot10aInvariants } from '../helpers/lot10a-invariants';
import { assertFinanceInvariants } from '../helpers/finance-invariants';
import {
    dayFromNow, newBuyer, newHall, newPartner, openHallsService, payConfirmed, platformSetting, reservation, reserveRpc,
    setPlatformSetting, type Buyer, type Row, type TestPartner,
} from './l10a-helpers';
import { service } from './paiement-helpers';
import { confirmCashouts } from './finance-helpers';
import { sendHallRefunds } from '../../lib/halls/refunds';

let restore: () => Promise<void>;
let quiet: [unknown, unknown];
let owner: TestPartner;
let client: Buyer;

async function tick(): Promise<Row> {
    const { data, error } = await service.rpc('hall_reservations_tick');
    assert.equal(error, null, `hall_reservations_tick : ${error?.message}`);
    return data as Row;
}

async function keysOf(userId: string, type: string, reservationId: string): Promise<string[]> {
    const { data, error } = await service.from('notification_outbox').select('idempotency_key, channel, template_data')
        .eq('recipient_user_id', userId).eq('type', type);
    assert.equal(error, null, error?.message);
    return (data ?? []).filter((r) => (r.template_data as Row | null)?.reservation_id === reservationId)
        .map((r) => String(r.idempotency_key)).sort();
}

/** Déplace la réservation (une journée) au jour donné ; l'échéance du solde suit (J-7), l'attente reste close. */
async function moveTo(id: string, day: string, opts: { due?: boolean } = {}): Promise<void> {
    const due = new Date(Date.parse(`${day}T00:00:00Z`) - 7 * 86_400_000).toISOString();
    const { error } = await service.from('hall_reservations')
        .update({ start_date: day, end_date: day, ...(opts.due ? { balance_due_at: due } : {}) }).eq('id', id);
    assert.equal(error, null, `déplacement : ${error?.message}`);
}

before(async () => {
    restore = await openHallsService();
    quiet = [await platformSetting('notif.sms_quiet_start'), await platformSetting('notif.sms_quiet_end')];
    await setPlatformSetting('notif.sms_quiet_start', 0);
    await setPlatformSetting('notif.sms_quiet_end', 0);
    owner = await newPartner('l10b-avis-salle');
    client = await newBuyer('l10b-avis-client', { firstName: 'Fatou', lastName: 'Sow' });
});

after(async () => {
    await setPlatformSetting('notif.sms_quiet_start', quiet[0]);
    await setPlatformSetting('notif.sms_quiet_end', quiet[1]);
    await restore();
    await assertLot10aInvariants('l10b-avis');
    await assertFinanceInvariants('l10b-avis');
});

describe('Rappels du solde à J-10 puis J-8', () => {
    test('un rappel à J-10, un à J-8, jamais deux fois le même ; quatre canaux', async () => {
        const hall = await newHall(owner, { price_per_day: 200_000 });
        const r = await reserveRpc(client, hall, { startDate: dayFromNow(25) });
        assert.equal(r.ok, true, JSON.stringify(r));
        const id = String(r.reservation_id);
        await payConfirmed(client, id, 'ACOMPTE');
        assert.equal((await reservation(id)).booking_state, 'ACOMPTE_PAYE');

        await tick();
        assert.deepEqual(await keysOf(client.userId, 'HALL_BALANCE_REMINDER', id), [], 'rappel avant J-10');

        await moveTo(id, dayFromNow(10), { due: true });
        await tick();
        await tick();
        const j10 = await keysOf(client.userId, 'HALL_BALANCE_REMINDER', id);
        assert.deepEqual(j10, ['EMAIL', 'IN_APP', 'PUSH', 'SMS'].map((c) => `HALL_BALANCE_REMINDER:J10:${id}:${c}`).sort(), JSON.stringify(j10));

        await moveTo(id, dayFromNow(8), { due: true });
        await tick();
        await tick();
        const all = await keysOf(client.userId, 'HALL_BALANCE_REMINDER', id);
        assert.equal(all.filter((k) => k.includes(':J8:')).length, 4, JSON.stringify(all));
        assert.equal(all.length, 8, `un rappel de chaque, jamais en double : ${JSON.stringify(all)}`);
    });
});

describe('Rappel la veille', () => {
    test('réservation payée qui commence demain : avis au client et à la salle, une fois, quatre canaux chacun', async () => {
        const hall = await newHall(owner, { price_per_day: 150_000 });
        const r = await reserveRpc(client, hall, { startDate: dayFromNow(30) });
        assert.equal(r.ok, true, JSON.stringify(r));
        const id = String(r.reservation_id);
        await payConfirmed(client, id, 'INTEGRAL');
        await moveTo(id, dayFromNow(1));
        await tick();
        await tick();
        const toClient = await keysOf(client.userId, 'HALL_EVE_REMINDER', id);
        const toOwner = await keysOf(owner.userId, 'HALL_EVE_REMINDER', id);
        assert.equal(toClient.length, 4, JSON.stringify(toClient));
        assert.equal(toOwner.length, 4, JSON.stringify(toOwner));
        const { data } = await service.from('notification_outbox').select('template_data')
            .eq('recipient_user_id', owner.userId).eq('type', 'HALL_EVE_REMINDER').eq('channel', 'IN_APP');
        assert.ok((data ?? []).some((x) => (x.template_data as Row).recipient_role === 'PARTNER'));
    });
});

describe('Recettes disponibles', () => {
    test('vente au grand livre devenue disponible : avis à la salle, une fois ; vente pas encore disponible : rien', async () => {
        const hall = await newHall(owner, { price_per_day: 100_000 });
        const r = await reserveRpc(client, hall, { startDate: dayFromNow(45) });
        assert.equal(r.ok, true, JSON.stringify(r));
        const id = String(r.reservation_id);
        const pay = await payConfirmed(client, id, 'INTEGRAL');
        await tick();
        assert.deepEqual(await keysOf(owner.userId, 'HALL_EARNINGS_AVAILABLE', id), [], 'recettes annoncées avant la fin');

        // Réservation passée (fin il y a 2 jours) ; vente disponible à la fin + 48 h, comme le moteur la date
        const past = dayFromNow(-3);
        await moveTo(id, past);
        const availableAt = new Date(Date.parse(`${past}T00:00:00Z`) + 3 * 86_400_000).toISOString();
        const { error } = await service.from('finance_ledger').update({ available_at: availableAt }).eq('payment_id', pay.id).eq('entry_type', 'VENTE');
        assert.equal(error, null, error?.message);
        await tick();
        await tick();
        const keys = await keysOf(owner.userId, 'HALL_EARNINGS_AVAILABLE', id);
        assert.equal(keys.length, 4, JSON.stringify(keys));
        const { data } = await service.from('notification_outbox').select('template_data')
            .eq('recipient_user_id', owner.userId).eq('type', 'HALL_EARNINGS_AVAILABLE').eq('channel', 'IN_APP');
        const earned = (data ?? []).map((x) => Number((x.template_data as Row).earned));
        assert.ok(earned.some((e) => e > 0 && e <= 100_000), JSON.stringify(earned));
    });
});

describe('Remboursement versé', () => {
    test('versement confirmé du remboursement d’une salle : HALL_REFUND_PAID (et non l’avis des billets)', async () => {
        const hall = await newHall(owner, { price_per_day: 80_000, cancellation_policy: 'SOUPLE' });
        const r = await reserveRpc(client, hall, { startDate: dayFromNow(60) });
        assert.equal(r.ok, true, JSON.stringify(r));
        const id = String(r.reservation_id);
        const pay = await payConfirmed(client, id, 'ACOMPTE');
        const { data: c, error: cErr } = await service.rpc('hall_reservation_cancel', { p: { reservation_id: id, actor_id: client.userId, origin: 'CLIENT' } });
        assert.equal(cErr, null, cErr?.message);
        assert.equal((c as Row).ok, true, JSON.stringify(c));
        const { data: outs } = await service.from('cashouts').select('id, status').eq('payment_id', pay.id).eq('kind', 'REFUND');
        assert.equal((outs ?? []).length, 1, JSON.stringify(outs));
        // Chemin réel : envoi au faux SamirPay, puis confirmation du versement par le module des versements
        await sendHallRefunds((c as Row).cashout_ids);
        await confirmCashouts();
        const { data: done } = await service.from('cashouts').select('status').eq('id', outs![0].id).single();
        assert.equal(done!.status, 'CONFIRME', JSON.stringify(done));
        const hallKeys = await keysOf(client.userId, 'HALL_REFUND_PAID', id);
        assert.equal(hallKeys.length, 4, JSON.stringify(hallKeys));
        const { count } = await service.from('notification_outbox').select('id', { count: 'exact', head: true })
            .eq('type', 'REFUND_PAID').like('idempotency_key', `REFUND_PAID:${outs![0].id}%`);
        assert.equal(count ?? 0, 0, 'avis des billets envoyé pour une salle');
    });
});

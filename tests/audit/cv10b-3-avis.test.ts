/**
 * Contre-vérification du lot 10b — point 5 : avis sur les 4 canaux, aucune donnée du client montrée à qui ne doit pas
 * la voir, report de nuit selon le réglage. Base LOCALE, faux SamirPay, faux SMS ; heure simulée pour l'envoyeur.
 *
 * Garde-fous (verts attendus) :
 *  G7. avis d'une réservation (demandée, acompte reçu) sur les 4 canaux ; aucun numéro ni adresse du client dans les
 *      données d'un avis à la salle ; détail d'une réservation non payée lu par la salle sans téléphone ni note.
 * Trous (rouges attendus tant qu'ils ne sont pas corrigés) :
 *  T5. la note du client d'une réservation NON payée (texte libre, souvent un numéro) est lue par la salle par la REST
 *      (politique hall_reservations_read), alors que l'écran la cache jusqu'au paiement ;
 *  T6. salle validée modifiée (prix) : l'avis aux administrateurs n'a pas de SMS (3 canaux sur 4) ;
 *  T7. rappels du solde écrits en dur à J-10 et J-8 de la date : avec halls.balance_due_days = 14 (réglage admis
 *      de 1 à 60), le solde est dû avant le premier rappel, le client n'est jamais rappelé ;
 *  T8. rappel du solde mis en file de jour, envoyé par l'envoyeur pendant la plage de nuit du réglage : la nuit n'est
 *      pas revérifiée à l'envoi (même défaut que le run 414 pour les SMS aux admins).
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { assertLot10aInvariants } from '../helpers/lot10a-invariants';
import { assertFinanceInvariants } from '../helpers/finance-invariants';
import { dakarAt, dakarDay, dispatchAt } from '../parcours/notif-helpers';
import {
    channelsOf, dayFromNow, newAdmin, newBuyer, newHall, newPartner, openHallsService, outboxRows, payConfirmed,
    platformSetting, reservation, reserveRpc, restAs, routeId, service, show, trace, withSettings, type Buyer, type Row,
    type TestAdmin, type TestPartner,
} from './cv10b-helpers';

let restore: () => Promise<void>;
let owner: TestPartner;
let validator: TestAdmin;

before(async () => {
    restore = await openHallsService();
    owner = await newPartner('cv10b-avis');
    validator = await newAdmin('cv10b-avis-valide', ['halls.validate']);
});

after(async () => {
    await restore();
    await assertLot10aInvariants('cv10b-3-avis');
    await assertFinanceInvariants('cv10b-3-avis');
});

const forReservation = (rows: Row[], id: string): Row[] => rows.filter((r) => (r.template_data as Row | null)?.reservation_id === id);

describe('G7. Avis et données du client (garde-fous)', () => {
    test('demandée puis acompte reçu : 4 canaux ; aucun contact du client dans les avis à la salle', async () => {
        const client = await newBuyer('cv10b-avis-client', { firstName: 'Fatou', lastName: 'Sarr' });
        const hall = await newHall(owner);
        const id = String((await reserveRpc(client, hall, { days: 1, startInDays: 33 })).reservation_id);
        const pending = forReservation(await outboxRows(client.userId, 'HALL_RESERVATION_PENDING'), id);
        await payConfirmed(client, id, 'ACOMPTE');
        const confirmed = forReservation(await outboxRows(client.userId, 'HALL_RESERVATION_CONFIRMED'), id);
        const toHall = forReservation(await outboxRows(owner.userId, 'HALL_RESERVATION_REQUESTED'), id);
        trace('G7 canaux', { pending: channelsOf(pending), confirmed: channelsOf(confirmed), toHall: channelsOf(toHall) });
        for (const rows of [pending, confirmed, toHall]) assert.deepEqual(channelsOf(rows), ['EMAIL', 'IN_APP', 'PUSH', 'SMS']);
        const text = JSON.stringify(toHall.map((r) => r.template_data));
        for (const v of [client.phone9, client.phoneE164, client.email]) assert.ok(!text.includes(v), `contact du client dans un avis à la salle : ${v}`);
    });

    test('réservation non payée lue par la salle (route) : ni téléphone ni note', async () => {
        const client = await newBuyer('cv10b-note-route');
        const hall = await newHall(owner);
        const { data, error } = await service.rpc('hall_reserve', {
            p: { client_id: client.userId, hall_id: hall, mode: 'JOUR', start_date: dayFromNow(36), units: 1, notes: `Appelez-moi au ${client.phone9}` },
        });
        assert.equal(error, null, error?.message);
        const id = String((data as Row).reservation_id);
        const r = await routeId('GET', 'partner/halls/reservations/[id]', id, owner.accessToken);
        assert.equal(r.status, 200, show(r));
        const view = r.body.reservation as Row;
        trace('G7 route salle, réservation non payée', { clientName: view.clientName, clientPhone: view.clientPhone, notes: view.notes });
        assert.equal(view.clientPhone, null);
        assert.equal(view.notes, null);
    });
});

describe('T5. Note du client d’une réservation non payée lue par la salle par la REST', () => {
    test('jeton de la salle + clé anon : la note (et le numéro qu’elle porte) ne doit pas être lisible avant paiement', async () => {
        const client = await newBuyer('cv10b-note-rest');
        const hall = await newHall(owner);
        const note = `Appelez-moi au ${client.phone9}`;
        const { data, error } = await service.rpc('hall_reserve', {
            p: { client_id: client.userId, hall_id: hall, mode: 'JOUR', start_date: dayFromNow(38), units: 1, notes: note },
        });
        assert.equal(error, null, error?.message);
        const id = String((data as Row).reservation_id);
        assert.equal((await reservation(id)).booking_state, 'EN_ATTENTE_PAIEMENT', 'précondition : non payée');
        const rest = await restAs(owner.accessToken).from('hall_reservations').select('id, booking_state, client_id, notes').eq('id', id);
        trace('T5 REST de la salle', { error: rest.error?.message ?? null, rows: rest.data });
        const leaked = (rest.data ?? []).filter((r) => r.notes !== null && r.notes !== undefined);
        assert.deepEqual(leaked, [], `note du client d'une réservation non payée lue par la salle : ${JSON.stringify(rest.data)}`);
    });
});

describe('T6. Salle validée modifiée : avis aux administrateurs sans SMS', () => {
    test('prix changé par la propriétaire : ADMIN_HALL_CHANGED attendu sur les 4 canaux (ou SMS groupé)', async () => {
        const hall = await newHall(owner, { price_per_day: 250_000 });
        // Références de cette salle déjà dans le SMS groupé (envoi en validation à la création) : exclues du constat
        const refsOf = async (): Promise<string[]> => (await outboxRows(validator.userId, 'ADMIN_REVIEW_SMS'))
            .flatMap((r) => (Array.isArray((r.template_data as Row).refs) ? (r.template_data as { refs: string[] }).refs : []))
            .filter((ref) => ref.startsWith(hall));
        const refsBefore = await refsOf();
        const put = await routeId('PUT', 'partner/halls/[id]', hall, owner.accessToken, { price_per_day: 400_000 });
        assert.equal(put.status, 200, show(put));
        const rows = (await outboxRows(validator.userId, 'ADMIN_HALL_CHANGED')).filter((r) => (r.template_data as Row).hall_id === hall);
        const grouped = (await refsOf()).filter((ref) => !refsBefore.includes(ref));
        trace('T6 salle validée modifiée', { channels: channelsOf(rows), changes: rows[0]?.template_data, refsBefore, newGroupedRefs: grouped });
        assert.ok(rows.length > 0, 'précondition : avis ADMIN_HALL_CHANGED mis en file');
        assert.ok(channelsOf(rows).includes('SMS') || grouped.length > 0,
            `salle validée modifiée : aucun SMS aux administrateurs (canaux ${channelsOf(rows).join(', ')})`);
    });
});

/** Réservation payée à l'acompte, rappels générés de jour (plage de nuit neutralisée le temps du passage). */
async function tickByDay(): Promise<Row> {
    return withSettings({ 'notif.sms_quiet_start': 0, 'notif.sms_quiet_end': 0 }, async () => {
        const { data, error } = await service.rpc('hall_reservations_tick');
        assert.equal(error, null, `hall_reservations_tick : ${error?.message}`);
        return data as Row;
    });
}

describe('T7. Rappels du solde écrits en dur (J-10, J-8) : réglage halls.balance_due_days ignoré', () => {
    test('échéance à J-14 (réglage 14) : solde dû dans moins de 3 jours, aucun rappel au client', async () => {
        await withSettings({ 'halls.balance_due_days': 14 }, async () => {
            const client = await newBuyer('cv10b-rappel-14');
            const hall = await newHall(owner);
            const id = String((await reserveRpc(client, hall, { days: 1, startInDays: 17 })).reservation_id);
            await payConfirmed(client, id, 'ACOMPTE');
            const r = await reservation(id);
            const hoursLeft = (Date.parse(String(r.balance_due_at)) - Date.now()) / 3_600_000;
            assert.equal(r.booking_state, 'ACOMPTE_PAYE', 'précondition : acompte payé');
            assert.ok(hoursLeft > 24 && hoursLeft < 96, `précondition : solde dû dans 1 à 4 jours (${hoursLeft.toFixed(1)} h)`);
            const report = await tickByDay();
            const reminders = forReservation(await outboxRows(client.userId, 'HALL_BALANCE_REMINDER'), id);
            trace('T7 échéance à J-14', { start: r.start_date, balance_due_at: r.balance_due_at, hoursLeft: Math.round(hoursLeft), tick: report, reminders: reminders.length });
            assert.ok(reminders.length > 0, `solde dû dans ${Math.round(hoursLeft)} h, aucun rappel (rappels à J-10 et J-8 de la date seulement)`);
        });
    });
});

describe('T8. Rappel du solde envoyé la nuit : plage de nuit non revérifiée à l’envoi', () => {
    test('mis en file de jour, envoyeur pendant la plage du réglage : le SMS doit attendre la fin de la nuit', async () => {
        const client = await newBuyer('cv10b-rappel-nuit');
        const hall = await newHall(owner);
        const id = String((await reserveRpc(client, hall, { days: 1, startInDays: 30 })).reservation_id);
        await payConfirmed(client, id, 'ACOMPTE');
        const day = dayFromNow(9);
        const { error } = await service.from('hall_reservations')
            .update({ start_date: day, end_date: day, balance_due_at: new Date(Date.now() + 2 * 86_400_000).toISOString() }).eq('id', id);
        assert.equal(error, null, error?.message);
        await tickByDay();
        const sms = forReservation(await outboxRows(client.userId, 'HALL_BALANCE_REMINDER'), id).filter((r) => r.channel === 'SMS');
        assert.equal(sms.length, 1, 'précondition : un SMS de rappel en file');
        const quietStart = Number(await platformSetting('notif.sms_quiet_start'));
        const quietEnd = Number(await platformSetting('notif.sms_quiet_end'));
        assert.notEqual(quietStart, quietEnd, 'précondition : une plage de nuit est réglée');
        const night = dakarAt(dakarDay(2), `${String(quietStart).padStart(2, '0')}:30`);
        await dispatchAt(night, { ids: [String(sms[0].id)] });
        const { data: row } = await service.from('notification_outbox').select('status, sent_at, due_at, decision').eq('id', String(sms[0].id)).single();
        trace('T8 envoi simulé la nuit', { plage: `${quietStart} h - ${quietEnd} h`, envoyeur: night.toISOString(), row });
        assert.notEqual(row!.status, 'SENT', `SMS de rappel envoyé à ${night.toISOString()} (plage de nuit ${quietStart} h - ${quietEnd} h) : ${JSON.stringify(row)}`);
    });
});

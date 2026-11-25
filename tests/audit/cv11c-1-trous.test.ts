/**
 * Contre-vérification du lot 11c-a (tables d'un événement : argent et sécurité) — un test par trou.
 * ROUGE sur la branche du lot = trou présent ; VERT = attaque bloquée. Base LOCALE, faux SamirPay ; aucune correction.
 * Chaque preuve de jauge est nettoyée (événement annulé) pour laisser les invariants justes après la suite.
 *
 *  T1 Deux tables du même type achetées par le même compte (2 autorisées par event_tables.max_per_account) : la 2e est
 *     prise pour un « paiement en double du panier » (payment_duplicate_of compare type:quantité) et remboursée.
 *  T2 Capacité baissée par event_update sous les places d'un type de table arrêté déjà vendu (v_quota ne compte que les
 *     catégories actives) : billets vendus au-delà de la jauge.
 *  T3 Point connu « une catégorie de billets arrêtée libère ses places » :
 *     T3a (antérieur au lot) : nouvelle catégorie de billets, survente réelle mesurée ;
 *     T3b (code du lot, event_seats_refusal) : nouveau type de table créé sur ces places, table vendue au-delà de la jauge.
 *  T4 Remboursement de la table au report : l'invité qui a accepté sa place la perd sans aucun avis.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { checkLot11cInvariants } from '../helpers/lot11c-invariants';
import { assertNotificationInvariants } from '../helpers/notification-invariants';
import { newBuyer, service } from '../parcours/paiement-helpers';
import { newPartner, type TestPartner } from '../parcours/finance-helpers';
import {
    buyTable, confirmByWebhook, createTableType, createdTableType, newTablesEvent, patchTableType, postpone, show, switchEventTablesService,
    tableCheckout, tableRefund, ticketById, transferSeat, updateCapacity, vipType, withEventTablesSetting, type Row,
} from '../parcours/l11c-helpers';
import { buyTickets, cancelEvent, n, outboxOf, seatsTaken } from './cv11c-helpers';

let restore: () => Promise<void>;
let partner: TestPartner;

before(async () => {
    restore = await switchEventTablesService(true);
    partner = await newPartner('cv11c-trous');
});

after(async () => {
    if (restore) await restore();
    await checkLot11cInvariants('cv11c-1-trous');
    await assertNotificationInvariants('cv11c-1-trous');
});

describe('Trous du lot 11c-a', () => {
    test('T1 — un compte achète 2 tables du même type (maximum 2 par compte) : la 2e est vendue, pas remboursée comme un paiement en double', async () => {
        const ev = await newTablesEvent(partner, 'cv-t1');
        const t = await createdTableType(partner, ev.eventId, vipType(), 3);
        const buyer = await newBuyer('cv11c-t1');
        await withEventTablesSetting('event_tables.max_per_account', 2, async () => {
            const first = await buyTable(buyer, ev.eventId, t.typeId);
            const started = await tableCheckout(buyer, ev.eventId, t.typeId);
            assert.equal(started.status, 200, `2e table acceptée à l’achat (limite 2) : ${show(started)}`);
            const second = await confirmByWebhook(started.payment!);
            const { data: booking } = await service.from('event_table_bookings').select('id, status').eq('payment_id', second.id).maybeSingle();
            const { data: alerts } = await service.from('notification_outbox').select('id').eq('type', 'ADMIN_DUPLICATE_PAYMENT')
                .contains('template_data', { payment_id: second.id });
            assert.deepEqual(
                { status: second.status, booking: booking?.status ?? null, duplicate_of: (second.metadata as Row).duplicate_of ?? null, admin_alerts: (alerts ?? []).length },
                { status: 'SUCCESS', booking: 'ACTIVE', duplicate_of: null, admin_alerts: 0 },
                `2e table du même type : paiement ${second.status}, motif « ${String((second.metadata as Row).refund_reason ?? '')} », `
                + `duplicate_of = ${String((second.metadata as Row).duplicate_of ?? '')} (1re table : paiement ${first.payment.id})`,
            );
        });
    });

    test('T2 — capacité baissée sous les places d’un type de table arrêté déjà vendu : refusée (sinon billets vendus au-delà de la jauge)', async () => {
        // Capacité 12 : 6 billets « Entrée » + 1 table de 6 places vendue puis type arrêté = 12 places engagées
        const ev = await newTablesEvent(partner, 'cv-t2', { capacity: 12, tickets: 6 });
        const t = await createdTableType(partner, ev.eventId, vipType({ seats: 6 }), 1);
        await buyTable(await newBuyer('cv11c-t2-table'), ev.eventId, t.typeId);
        const stop = await patchTableType(partner, ev.eventId, t.typeId, { is_active: false });
        assert.equal(stop.status, 200, `type arrêté : ${show(stop)}`);
        const lowered = await updateCapacity(partner, ev.eventId, 6);
        let measured = '';
        if (lowered.ok === true) {
            // Mesure : les 6 billets « Entrée » se vendent encore, avec les 6 places de la table
            await buyTickets(await newBuyer('cv11c-t2-billets'), ev.eventId, { id: ev.ticketCategoryId, price: 5_000, total: 6 }, 6);
            const s = await seatsTaken(ev.eventId);
            measured = `capacité ${s.capacity} : ${s.tickets} billet(s) + ${s.tableSeats} place(s) de table = ${s.tickets + s.tableSeats} places vendues`;
            await cancelEvent(partner, ev.eventId, ev.title);
        }
        assert.notEqual(lowered.ok, true, `event_update accepte la capacité 6 : ${JSON.stringify(lowered).slice(0, 200)} — ${measured}`);
    });

    test('T3a (antérieur au lot) — catégorie de billets vendue puis arrêtée : une nouvelle catégorie ne reprend pas ses places', async () => {
        const ev = await newTablesEvent(partner, 'cv-t3a', { capacity: 10, tickets: 10 });
        await buyTickets(await newBuyer('cv11c-t3a-a'), ev.eventId, { id: ev.ticketCategoryId, price: 5_000, total: 10 }, 4);
        const { data: stop, error: sErr } = await service.rpc('ticket_category_update', { p: {
            event_id: ev.eventId, category_id: ev.ticketCategoryId, actor_id: partner.userId, patch: { is_active: false },
        } });
        assert.equal(sErr, null, sErr?.message);
        assert.equal((stop as Row).ok, true, `catégorie vendue arrêtée : ${JSON.stringify(stop)}`);
        const { data: created, error } = await service.rpc('ticket_category_create', { p: {
            event_id: ev.eventId, actor_id: partner.userId,
            category: { name: `Balcon ${Date.now() % 10_000}`, price: 3_000, total_quantity: 10, max_per_order: 10 },
        } });
        assert.equal(error, null, error?.message);
        let measured = '';
        if ((created as Row).ok === true) {
            const cat = (created as Row).category as Row;
            await buyTickets(await newBuyer('cv11c-t3a-b'), ev.eventId, { id: String(cat.id), price: 3_000, total: 10 }, 7);
            const s = await seatsTaken(ev.eventId);
            measured = `capacité ${s.capacity} : ${s.tickets} billets VALIDE vendus`;
            await cancelEvent(partner, ev.eventId, ev.title);
        }
        assert.equal((created as Row).code, 'QUOTA_ABOVE_CAPACITY', `nouvelle catégorie de 10 places acceptée sur une capacité de 10 dont 4 vendues : ${JSON.stringify(created).slice(0, 160)} — ${measured}`);
    });

    test('T3b — même point dans le code du lot (event_seats_refusal) : un type de table créé sur les places d’une catégorie de billets arrêtée est refusé', async () => {
        const ev = await newTablesEvent(partner, 'cv-t3b', { capacity: 10, tickets: 10 });
        await buyTickets(await newBuyer('cv11c-t3b-a'), ev.eventId, { id: ev.ticketCategoryId, price: 5_000, total: 10 }, 4);
        const { data: stop, error: sErr } = await service.rpc('ticket_category_update', { p: {
            event_id: ev.eventId, category_id: ev.ticketCategoryId, actor_id: partner.userId, patch: { is_active: false },
        } });
        assert.equal(sErr, null, sErr?.message);
        assert.equal((stop as Row).ok, true, `catégorie vendue arrêtée : ${JSON.stringify(stop)}`);
        const r = await createTableType(partner, ev.eventId, vipType({ seats: 10 }), 1);
        let measured = '';
        if (r.status === 201) {
            await buyTable(await newBuyer('cv11c-t3b-b'), ev.eventId, String((r.body.type as Row).id));
            const s = await seatsTaken(ev.eventId);
            measured = `capacité ${s.capacity} : ${s.tickets} billet(s) + ${s.tableSeats} place(s) de table = ${s.tickets + s.tableSeats} places vendues`;
            await cancelEvent(partner, ev.eventId, ev.title);
        }
        assert.deepEqual([r.status, r.body.code], [409, 'QUOTA_ABOVE_CAPACITY'], `type de 10 places sur une capacité de 10 dont 4 vendues : ${show(r).slice(0, 200)} — ${measured}`);
    });

    test('T4 — table remboursée au report : l’invité qui avait accepté sa place est prévenu que sa place est annulée', async () => {
        const ev = await newTablesEvent(partner, 'cv-t4');
        const t = await createdTableType(partner, ev.eventId, vipType(), 1);
        const holder = await newBuyer('cv11c-t4-titulaire');
        const guest = await newBuyer('cv11c-t4-invite', { firstName: 'Fatou' });
        const bought = await buyTable(holder, ev.eventId, t.typeId);
        const seat = String(bought.tickets[1].id);
        const transferId = await transferSeat(seat, holder, guest.phoneE164);
        const { data: acc, error: accErr } = await service.rpc('ticket_transfer_accept', { p: { transfer_id: transferId, actor_id: guest.userId } });
        assert.equal(accErr, null, accErr?.message);
        assert.equal((acc as Row).ok, true, `place acceptée par l’invité : ${JSON.stringify(acc)}`);
        assert.equal((await ticketById(seat)).user_id, guest.userId, 'la place est à l’invité');

        await postpone(partner, ev.eventId, 48);
        const before = new Set((await outboxOf(guest.userId)).map((r) => String(r.id)));
        const refund = await tableRefund(holder, String(bought.booking.id));
        assert.equal(refund.status, 200, `table remboursée : ${show(refund)}`);
        // Garde-fou (vert attendu) : la place de l'invité n'est plus valable
        const seatAfter = await ticketById(seat);
        assert.ok(['REMBOURSEMENT_EN_COURS', 'REMBOURSE'].includes(String(seatAfter.status)), `place de l’invité annulée : ${String(seatAfter.status)}`);
        // Trou : aucun avis à l'invité
        const fresh = (await outboxOf(guest.userId)).filter((r) => !before.has(String(r.id)));
        assert.ok(fresh.length > 0,
            `aucun avis à l’invité (${guest.userId}) après le remboursement de la table : place ${String(seatAfter.status)}, `
            + `boîte d’envoi de l’invité avant : ${before.size} ligne(s), après : ${before.size + fresh.length}`);
        assert.ok(n(refund.body.amount) > 0);
    });
});

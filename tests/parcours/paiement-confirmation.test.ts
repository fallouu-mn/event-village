/**
 * Lot 2.2 — confirmation atomique (R10, R11, R12, R13).
 * Une seule RPC (payment_confirm), appelée par le webhook ET par la réconciliation : dans une
 * transaction, transition conditionnelle du paiement, conversion des réservations en ventes,
 * création des billets de TOUT le panier. Tout ou rien, idempotente, sans double décrément de
 * held_quantity. Les montants sont LUS (paiement, réservations), jamais recalculés.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { assertPaymentInvariants } from '../helpers/payment-invariants';
import {
    cart, categoryState, checkout, createSaleEvent, deliverWebhook, eventTickets, newBuyer, paymentById,
    pollStatus, providerSays, SaleEvent, service,
} from './paiement-helpers';

let ev: SaleEvent;

before(async () => {
    ev = await createSaleEvent('confirmation', [
        { name: 'Standard', price: 2500, total: 30 },
        { name: 'VIP', price: 9000, total: 3 },
        { name: 'Rare', price: 4000, total: 1 },
    ]);
});

after(async () => {
    await assertPaymentInvariants('paiement-confirmation');
});

describe('Confirmation atomique', () => {
    test('deux webhooks identiques simultanés + un sondage : billets émis une seule fois, held sans double décrément', async () => {
        const buyer = await newBuyer('concurrence');
        const std = ev.categories.Standard.id;
        const vip = ev.categories.VIP.id;
        const before0 = { std: await categoryState(std), vip: await categoryState(vip) };
        const r = await checkout(buyer, cart(ev.eventId, [[std, 2], [vip, 1]], buyer));
        assert.equal(r.status, 200, `checkout : ${JSON.stringify(r.body)}`);
        const payment = r.payment!;
        assert.equal((await categoryState(std)).held, before0.std.held + 2, 'réservation Standard');
        providerSays(payment, 'SUCCESS');
        const results = await Promise.allSettled([
            deliverWebhook(payment, { token: 'valid' }),
            deliverWebhook(payment, { token: 'valid' }),
            pollStatus(buyer.accessToken, payment.id),
        ]);
        assert.ok(results.every((x) => x.status === 'fulfilled'), `appels concurrents : ${JSON.stringify(results.map((x) => x.status))}`);
        const mine = (await eventTickets(ev.eventId)).filter((t) => t.user_id === buyer.userId);
        assert.equal(mine.length, 3, 'trois billets exactement (2 Standard + 1 VIP)');
        assert.equal((await paymentById(payment.id)).status, 'SUCCESS');
        const after = { std: await categoryState(std), vip: await categoryState(vip) };
        assert.equal(after.std.sold, before0.std.sold + 2, 'Standard vendus +2');
        assert.equal(after.std.held, before0.std.held, 'held Standard revenu à son niveau (un seul décrément)');
        assert.equal(after.vip.sold, before0.vip.sold + 1, 'VIP vendus +1');
        assert.equal(after.vip.held, before0.vip.held, 'held VIP revenu à son niveau');
        assert.ok(mine.every((t) => t.payment_id === payment.id), 'billets rattachés au paiement');
    });

    test('RPC idempotente : un second appel ne fait rien et le dit', async () => {
        const buyer = await newBuyer('idempotente');
        const r = await checkout(buyer, cart(ev.eventId, [[ev.categories.Standard.id, 1]], buyer));
        const payment = r.payment!;
        providerSays(payment, 'SUCCESS');
        const first = await service.rpc('payment_confirm', { p_payment_id: payment.id, p_source: 'TEST' });
        assert.equal(first.error, null, `premier appel : ${first.error?.message}`);
        assert.equal(first.data?.result, 'CONFIRMED');
        const second = await service.rpc('payment_confirm', { p_payment_id: payment.id, p_source: 'TEST' });
        assert.equal(second.error, null, `second appel : ${second.error?.message}`);
        assert.equal(second.data?.result, 'ALREADY_CONFIRMED');
        assert.equal((await eventTickets(ev.eventId)).filter((t) => t.payment_id === payment.id).length, 1);
    });

    test('panier dont une catégorie ne peut pas être honorée : zéro billet, jamais de SUCCESS partiel, remboursement déclenché', async () => {
        const buyer = await newBuyer('partiel', { firstName: 'Moussa', lastName: 'Partiel' });
        const std = ev.categories.Standard.id;
        const rare = ev.categories.Rare.id;
        const r = await checkout(buyer, cart(ev.eventId, [[std, 1], [rare, 1]], buyer, 'ORANGE_MONEY'));
        assert.equal(r.status, 200, `checkout : ${JSON.stringify(r.body)}`);
        const payment = r.payment!;
        // La réservation de « Rare » échoit et la dernière place est vendue à un autre acheteur.
        const { error: expErr } = await service.from('stock_reservations').update({ expires_at: new Date(Date.now() - 60_000).toISOString() }).eq('payment_id', payment.id).eq('category_id', rare);
        assert.equal(expErr, null, `échéance forcée : ${expErr?.message}`);
        await service.rpc('stock_reservations_expire');
        const other = await newBuyer('rival');
        const r2 = await checkout(other, cart(ev.eventId, [[rare, 1]], other));
        assert.equal(r2.status, 200, `achat rival : ${JSON.stringify(r2.body)}`);
        providerSays(r2.payment!, 'SUCCESS');
        await deliverWebhook(r2.payment!, { token: 'valid' });
        // Le paiement du premier acheteur aboutit malgré tout chez SamirPay.
        providerSays(payment, 'SUCCESS');
        await deliverWebhook(payment, { token: 'valid' });
        const mine = (await eventTickets(ev.eventId)).filter((t) => t.user_id === buyer.userId);
        assert.equal(mine.length, 0, 'aucun billet émis (pas même Standard)');
        const p = await paymentById(payment.id);
        assert.notEqual(p.status, 'SUCCESS', 'jamais de SUCCESS partiel');
        assert.ok(['REFUND_PENDING', 'REFUNDED'].includes(p.status), `chemin de remboursement : statut ${p.status}`);
        const { data: cashouts } = await service.from('cashouts').select('*').eq('payment_id', payment.id);
        assert.equal(cashouts?.length, 1, 'remboursement créé');
        assert.equal(cashouts![0].idempotency_key, `REFUND-${payment.id}`);
        assert.equal(Number(cashouts![0].amount), Number(payment.amount), 'montant lu sur le paiement');
    });

    test('montants lus, pas recalculés : le billet garde le prix payé si la catégorie change de prix avant la confirmation', async () => {
        const buyer = await newBuyer('prix');
        const std = ev.categories.Standard.id;
        const r = await checkout(buyer, cart(ev.eventId, [[std, 1]], buyer));
        const payment = r.payment!;
        await service.from('ticket_categories').update({ price: 99999 }).eq('id', std);
        try {
            providerSays(payment, 'SUCCESS');
            await deliverWebhook(payment, { token: 'valid' });
        } finally {
            await service.from('ticket_categories').update({ price: 2500 }).eq('id', std);
        }
        const [t] = (await eventTickets(ev.eventId)).filter((x) => x.user_id === buyer.userId);
        assert.ok(t, 'billet émis');
        assert.equal(Number(t.price), 2500, 'prix du billet = prix au paiement');
        assert.equal(Number((await paymentById(payment.id)).amount), 2500, 'montant du paiement inchangé');
    });
});

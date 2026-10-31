/**
 * Lot 2.6 — billets gratuits dans un panier mixte (ticketing-finance-16).
 * Les billets gratuits d'un panier mixte ne sont émis qu'à la confirmation, dans la même RPC que
 * les payants. claim-free : limite par compte et par catégorie, sans doublon sous concurrence.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { POST as claimFree } from '../../app/api/tickets/claim-free/route';
import { assertPaymentInvariants } from '../helpers/payment-invariants';
import { BASE_URL } from './helpers';
import {
    Buyer, cart, checkout, createSaleEvent, deliverWebhook, eventTickets, newBuyer, paymentById, pollStatus,
    providerSays, SaleEvent,
} from './paiement-helpers';

let ev: SaleEvent;

before(async () => {
    ev = await createSaleEvent('gratuits', [
        { name: 'Payante', price: 3000, total: 20 },
        { name: 'Gratuite', price: 0, total: 30, maxPerOrder: 2 },
    ]);
});

after(async () => {
    await assertPaymentInvariants('paiement-gratuits');
});

function claim(buyer: Buyer, categoryId: string, quantity: number) {
    return claimFree(new NextRequest(`${BASE_URL}/api/tickets/claim-free`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${buyer.accessToken}` },
        body: JSON.stringify({ categoryId, quantity }),
    }));
}

const ticketsOf = async (b: Buyer) => (await eventTickets(ev.eventId)).filter((t) => t.user_id === b.userId);

describe('Billets gratuits', () => {
    test('panier mixte dont le paiement échoue : aucun billet gratuit émis', async () => {
        const b = await newBuyer('mixte-echec');
        const r = await checkout(b, cart(ev.eventId, [[ev.categories.Payante.id, 1], [ev.categories.Gratuite.id, 2]], b));
        assert.equal(r.status, 200, JSON.stringify(r.body));
        assert.equal((await ticketsOf(b)).length, 0, 'aucun billet avant la confirmation');
        providerSays(r.payment!, 'FAILED');
        await pollStatus(b.accessToken, r.payment!.id);
        assert.equal((await paymentById(r.payment!.id)).status, 'FAILED');
        assert.equal((await ticketsOf(b)).length, 0, 'aucun billet gratuit après l’échec');
    });

    test('panier mixte confirmé : payants et gratuits émis ensemble, une seule fois', async () => {
        const b = await newBuyer('mixte-ok');
        const r = await checkout(b, cart(ev.eventId, [[ev.categories.Payante.id, 1], [ev.categories.Gratuite.id, 2]], b));
        providerSays(r.payment!, 'SUCCESS');
        await Promise.allSettled([deliverWebhook(r.payment!, { token: 'valid' }), deliverWebhook(r.payment!, { token: 'valid' })]);
        const mine = await ticketsOf(b);
        assert.equal(mine.filter((t) => t.category_id === ev.categories.Payante.id).length, 1);
        assert.equal(mine.filter((t) => t.category_id === ev.categories.Gratuite.id).length, 2);
        assert.ok(mine.every((t) => t.payment_id === r.payment!.id), 'gratuits rattachés au paiement du panier');
    });

    test('claim-free : tentatives répétées et simultanées → jamais au-delà de la limite par compte et par catégorie', async () => {
        const b = await newBuyer('claim');
        const results = await Promise.allSettled(Array.from({ length: 5 }, () => claim(b, ev.categories.Gratuite.id, 1)));
        const statuses = results.map((x) => (x.status === 'fulfilled' ? x.value.status : 0));
        assert.equal(statuses.filter((s) => s === 200).length, 2, `deux réussites (limite 2) : ${statuses}`);
        assert.equal((await ticketsOf(b)).length, 2, 'deux billets, aucun doublon');
        const again = await claim(b, ev.categories.Gratuite.id, 1);
        assert.ok(again.status === 409 || again.status === 429, `nouvelle tentative refusée : ${again.status}`);
    });

    test('claim-free sur une catégorie payante → 400, aucun billet', async () => {
        const b = await newBuyer('claim-payante');
        assert.equal((await claim(b, ev.categories.Payante.id, 1)).status, 400);
        assert.equal((await ticketsOf(b)).length, 0);
    });
});

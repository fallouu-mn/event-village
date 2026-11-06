/**
 * Lot 2.6 — billets gratuits dans un panier mixte (ticketing-finance-16).
 * Les billets gratuits d'un panier mixte ne sont émis qu'à la confirmation, dans la même RPC que
 * les payants. claim-free : limite par compte et par catégorie, sans doublon sous concurrence.
 *
 * Lot 8 (8.2 v) : cas portés, verts dès l'écriture : T1 de tests/legacy/checkout-mixed-cart.test.ts (panier 100 %
 * gratuit par /api/checkout) et T1.2 de tests/legacy/ticketing-e2e-final.test.ts (claim-free après épuisement).
 * Écart au legacy, T1 : la réponse est { free, status, ticket_ids } depuis le lot 2 (ni success, ni freeTickets).
 * Écart au legacy, T1.2 : 409 INSUFFICIENT_STOCK (route réécrite au lot 2), plus 400 TICKET_CATEGORY_SOLD_OUT ; le
 * stock est épuisé par une vraie réclamation, pas par sold_quantity écrit en base.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { POST as claimFree } from '../../app/api/tickets/claim-free/route';
import { assertPaymentInvariants } from '../helpers/payment-invariants';
import { BASE_URL } from './helpers';
import {
    Buyer, cart, categoryState, checkout, createSaleEvent, deliverWebhook, eventTickets, initCalls, newBuyer, paymentById,
    paymentsOf, pollStatus, providerSays, SaleEvent,
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

    test('panier 100 % gratuit par /api/checkout : billets émis tout de suite, aucun paiement, aucun appel à SamirPay (cas T1 porté)', async () => {
        const b = await newBuyer('panier-gratuit');
        const categoryId = ev.categories.Gratuite.id;
        const soldBefore = (await categoryState(categoryId)).sold;
        const r = await checkout(b, { eventId: ev.eventId, items: [{ categoryId, quantity: 2 }] });
        assert.equal(r.status, 200, JSON.stringify(r.body));
        assert.deepEqual({ free: r.body.free, status: r.body.status }, { free: true, status: 'SUCCESS' }, JSON.stringify(r.body));
        const ticketIds = r.body.ticket_ids as string[];
        assert.equal(ticketIds.length, 2, `deux billets annoncés : ${JSON.stringify(r.body)}`);
        assert.equal(r.payment, null, 'aucun paiement rendu');
        assert.deepEqual(await paymentsOf(b.userId), [], 'aucune ligne payments pour ce compte');
        assert.equal(initCalls().filter((c) => c.args.telephone === b.phone9).length, 0, 'aucun appel à SamirPay pour ce payeur');
        const mine = await ticketsOf(b);
        assert.deepEqual(mine.map((t) => String(t.id)).sort(), [...ticketIds].sort(), 'billets émis = billets annoncés');
        for (const t of mine) {
            assert.deepEqual({ status: t.status, price: Number(t.price), payment: t.payment_id, category: t.category_id },
                { status: 'VALIDE', price: 0, payment: null, category: categoryId }, `billet ${t.id}`);
        }
        assert.equal((await categoryState(categoryId)).sold, soldBefore + 2, 'stock vendu + 2');
    });

    test('claim-free après épuisement : 409 INSUFFICIENT_STOCK, aucun billet, stock inchangé (cas T1.2 porté)', async () => {
        const soldOut = await createSaleEvent('gratuits-epuises', [{ name: 'Epuisee', price: 0, total: 1 }]);
        const categoryId = soldOut.categories.Epuisee.id;
        const first = await newBuyer('claim-premier');
        const won = await claim(first, categoryId, 1);
        assert.equal(won.status, 200, `dernière place : ${JSON.stringify(await won.clone().json())}`);
        assert.equal((await categoryState(categoryId)).sold, 1, 'précondition : catégorie épuisée');

        const late = await newBuyer('claim-trop-tard');
        const refused = await claim(late, categoryId, 1);
        const body = (await refused.json()) as { code?: unknown; error?: unknown };
        assert.equal(refused.status, 409, JSON.stringify(body));
        assert.equal(body.code, 'INSUFFICIENT_STOCK', JSON.stringify(body));
        assert.equal(typeof body.error, 'string', 'message en français attendu');
        const issued = await eventTickets(soldOut.eventId);
        assert.deepEqual(issued.map((t) => t.user_id), [first.userId], 'seul le premier compte a un billet');
        assert.equal((await categoryState(categoryId)).sold, 1, 'stock vendu inchangé');
    });
});

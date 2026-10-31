/**
 * Lot 2.3 — route de statut (R10).
 * /api/payments/[id]/status : authentifiée, réservée au propriétaire, en lecture seule. Elle peut
 * demander une réconciliation, qui passe par la même RPC que le webhook ; elle ne passe jamais
 * elle-même un paiement en SUCCESS. Identifiant validé (UUID), plus de .or() interpolé (D1).
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { assertPaymentInvariants } from '../helpers/payment-invariants';
import {
    cart, checkout, createSaleEvent, deliverWebhook, eventTickets, newBuyer, paymentById, pollStatus,
    providerSays, SaleEvent,
} from './paiement-helpers';

let ev: SaleEvent;

before(async () => {
    ev = await createSaleEvent('statut', [{ name: 'Standard', price: 2000, total: 20 }]);
});

after(async () => {
    await assertPaymentInvariants('paiement-statut');
});

describe('Route de statut', () => {
    test('sans session → 401 ; autre compte → 404 sans donnée ; propriétaire → statut, opérateur, échéance', async () => {
        const owner = await newBuyer('statut-owner');
        const r = await checkout(owner, cart(ev.eventId, [[ev.categories.Standard.id, 1]], owner, 'ORANGE_MONEY'));
        const payment = r.payment!;
        assert.equal((await pollStatus(null, payment.id)).status, 401);
        const stranger = await newBuyer('statut-tiers');
        const other = await pollStatus(stranger.accessToken, payment.id);
        assert.equal(other.status, 404, `autre compte : ${JSON.stringify(other.body)}`);
        assert.equal(other.body.amount, undefined);
        const mine = await pollStatus(owner.accessToken, payment.id);
        assert.equal(mine.status, 200, JSON.stringify(mine.body));
        assert.equal(mine.body.payment_id, payment.id);
        assert.equal(mine.body.status, 'PENDING');
        assert.equal(mine.body.operator, 'ORANGE_MONEY');
        assert.ok(mine.body.expires_at, 'échéance de la réservation');
    });

    test('identifiant non UUID (injection) → 400', async () => {
        const owner = await newBuyer('statut-injection');
        const res = await pollStatus(owner.accessToken, 'x,id.not.is.null');
        assert.equal(res.status, 400);
    });

    test('sondage qui voit SUCCESS chez SamirPay avant le webhook : billets émis exactement une fois, puis webhook idempotent', async () => {
        const owner = await newBuyer('statut-avant-webhook');
        const r = await checkout(owner, cart(ev.eventId, [[ev.categories.Standard.id, 2]], owner));
        const payment = r.payment!;
        providerSays(payment, 'SUCCESS');
        const polled = await pollStatus(owner.accessToken, payment.id);
        assert.equal(polled.status, 200);
        assert.equal(polled.body.status, 'SUCCESS', `après réconciliation : ${JSON.stringify(polled.body)}`);
        const mine = () => eventTickets(ev.eventId).then((ts) => ts.filter((t) => t.user_id === owner.userId));
        assert.equal((await mine()).length, 2, 'billets émis par la réconciliation');
        const hook = await deliverWebhook(payment, { token: 'valid' });
        assert.equal(hook.status, 200);
        assert.equal((await mine()).length, 2, 'webhook idempotent : aucun doublon');
        assert.equal((await paymentById(payment.id)).status, 'SUCCESS');
    });

    test('la route ne passe jamais elle-même un paiement en SUCCESS (lecture seule, réconciliation par RPC)', () => {
        const src = fs.readFileSync('app/api/payments/[transactionId]/status/route.ts', 'utf8');
        assert.doesNotMatch(src, /status:\s*['"]SUCCESS['"]/, 'aucune écriture de SUCCESS dans la route');
        assert.doesNotMatch(src, /\.update\(/, 'aucune mise à jour directe');
        assert.doesNotMatch(src, /\.or\(/, 'aucun .or() interpolé');
    });
});

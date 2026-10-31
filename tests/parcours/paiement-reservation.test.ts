/**
 * Lot 2.4 — réservation de stock en SQL (R9, R13).
 * Une RPC réserve toutes les catégories du panier dans une seule transaction, tout ou rien ;
 * held_quantity reste égal à la somme des réservations actives. Libération garantie sur tous les
 * chemins d'échec : refus SamirPay (corps ou exception), panier partiel, annulation par le client,
 * expiration (route cron protégée par CRON_SECRET).
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { NextRequest } from 'next/server';
import { assertPaymentInvariants } from '../helpers/payment-invariants';
import { BASE_URL, routeContext } from './helpers';
import {
    cart, categoryState, checkout, createSaleEvent, cronRequest, importModule, initCalls, newBuyer, paymentById,
    paymentsOf, SaleEvent, service, setFakeMode,
} from './paiement-helpers';

let ev: SaleEvent;

before(async () => {
    ev = await createSaleEvent('reservation', [
        { name: 'Derniere', price: 3000, total: 1 },
        { name: 'Standard', price: 1500, total: 20 },
        { name: 'Epuisee', price: 1500, total: 1 },
    ]);
});

after(async () => {
    setFakeMode('initMode', 'success');
    await assertPaymentInvariants('paiement-reservation');
});

describe('Réservation de stock', () => {
    test('deux acheteurs simultanés pour la dernière place : une réservation, un refus avant tout appel SamirPay, aucune survente', async () => {
        const [a, b] = await Promise.all([newBuyer('derniere-a'), newBuyer('derniere-b')]);
        const cat = ev.categories.Derniere.id;
        const initsBefore = initCalls().length;
        const results = await Promise.allSettled([
            checkout(a, cart(ev.eventId, [[cat, 1]], a)),
            checkout(b, cart(ev.eventId, [[cat, 1]], b)),
        ]);
        const ok = results.filter((x) => x.status === 'fulfilled' && x.value.status === 200);
        const refused = results.filter((x) => x.status === 'fulfilled' && x.value.status === 409);
        assert.equal(ok.length, 1, `une seule réservation : ${JSON.stringify(results.map((x) => (x.status === 'fulfilled' ? [x.value.status, x.value.body.code] : x.reason?.message)))}`);
        assert.equal(refused.length, 1, 'un refus 409');
        assert.equal(initCalls().length - initsBefore, 1, 'un seul appel SamirPay');
        const loser = refused[0].status === 'fulfilled' ? refused[0].value : null;
        assert.equal(loser?.payment, null, 'aucune ligne payments pour le refusé');
        const state = await categoryState(cat);
        assert.ok(state.sold + state.held <= state.total, `aucune survente : ${JSON.stringify(state)}`);
        assert.equal(state.held, 1);
    });

    test('panier partiel (une catégorie épuisée) : rien n’est réservé, aucun paiement', async () => {
        const buyer = await newBuyer('partiel');
        const filler = await newBuyer('remplit');
        const fill = await checkout(filler, cart(ev.eventId, [[ev.categories.Epuisee.id, 1]], filler));
        assert.equal(fill.status, 200);
        const stdBefore = await categoryState(ev.categories.Standard.id);
        const r = await checkout(buyer, cart(ev.eventId, [[ev.categories.Standard.id, 2], [ev.categories.Epuisee.id, 1]], buyer));
        assert.equal(r.status, 409, JSON.stringify(r.body));
        assert.equal((await paymentsOf(buyer.userId)).length, 0, 'aucun paiement');
        assert.deepEqual(await categoryState(ev.categories.Standard.id), stdBefore, 'Standard non réservé');
    });

    test('refus SamirPay dans la réponse : paiement FAILED, réservation libérée', async () => {
        const buyer = await newBuyer('refus-corps');
        const before0 = await categoryState(ev.categories.Standard.id);
        setFakeMode('initMode', 'rejected');
        let status = 0;
        try {
            status = (await checkout(buyer, cart(ev.eventId, [[ev.categories.Standard.id, 2]], buyer))).status;
        } finally {
            setFakeMode('initMode', 'success');
        }
        assert.ok(status >= 400, `refus remonté : ${status}`);
        const [p] = await paymentsOf(buyer.userId);
        assert.equal(p?.status, 'FAILED', 'paiement en échec');
        assert.deepEqual(await categoryState(ev.categories.Standard.id), before0, 'réservation libérée');
    });

    test('exception SamirPay (délai dépassé) : réservation libérée', async () => {
        const buyer = await newBuyer('refus-exception');
        const before0 = await categoryState(ev.categories.Standard.id);
        setFakeMode('initMode', 'timeout');
        try {
            await checkout(buyer, cart(ev.eventId, [[ev.categories.Standard.id, 1]], buyer));
        } finally {
            setFakeMode('initMode', 'success');
        }
        assert.deepEqual(await categoryState(ev.categories.Standard.id), before0, 'réservation libérée');
    });

    test('annulation par le client : réservation libérée, paiement CANCELLED ; un tiers ne peut pas annuler', async () => {
        const buyer = await newBuyer('annule');
        const stranger = await newBuyer('annule-tiers');
        const before0 = await categoryState(ev.categories.Standard.id);
        const r = await checkout(buyer, cart(ev.eventId, [[ev.categories.Standard.id, 3]], buyer));
        assert.equal((await categoryState(ev.categories.Standard.id)).held, before0.held + 3);
        const { POST: cancel } = await importModule('../../app/api/payments/[transactionId]/cancel/route');
        const req = (token: string) => new NextRequest(`${BASE_URL}/api/payments/${r.payment!.id}/cancel`, { method: 'POST', headers: { authorization: `Bearer ${token}` } });
        assert.equal((await cancel(req(stranger.accessToken), routeContext({ transactionId: r.payment!.id }))).status, 404, 'un tiers ne peut pas annuler');
        assert.equal((await cancel(req(buyer.accessToken), routeContext({ transactionId: r.payment!.id }))).status, 200);
        assert.equal((await paymentById(r.payment!.id)).status, 'CANCELLED');
        assert.deepEqual(await categoryState(ev.categories.Standard.id), before0, 'réservation libérée');
    });

    test('réservation échue : la route cron (CRON_SECRET) rend le stock ; sans secret → 401', async () => {
        const buyer = await newBuyer('echue');
        const before0 = await categoryState(ev.categories.Standard.id);
        const r = await checkout(buyer, cart(ev.eventId, [[ev.categories.Standard.id, 2]], buyer));
        assert.equal((await categoryState(ev.categories.Standard.id)).held, before0.held + 2);
        await service.from('stock_reservations').update({ expires_at: new Date(Date.now() - 1000).toISOString() }).eq('payment_id', r.payment!.id);
        const { GET: cron } = await importModule('../../app/api/cron/stock-reservations/route');
        assert.equal((await cron(cronRequest('/api/cron/stock-reservations', null))).status, 401, 'sans secret');
        assert.equal((await cron(cronRequest('/api/cron/stock-reservations', 'mauvais-secret'))).status, 401, 'secret erroné');
        const res = await cron(cronRequest('/api/cron/stock-reservations'));
        assert.equal(res.status, 200);
        assert.deepEqual(await categoryState(ev.categories.Standard.id), before0, 'stock rendu');
    });

    test('plus de repli silencieux : aucune suppression de paiement ni « colonne absente » dans le code serveur', () => {
        const offenders: string[] = [];
        const walk = (dir: string) => {
            for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
                const full = path.join(dir, e.name);
                if (e.isDirectory()) walk(full);
                else if (/\.(ts|tsx)$/.test(e.name)) {
                    const src = fs.readFileSync(full, 'utf8');
                    if (/from\(['"]payments['"]\)\s*\.delete\(/.test(src)) offenders.push(`${full} : suppression de paiement`);
                    if (/colonne held_quantity non configurée|hasHeldCol/.test(src)) offenders.push(`${full} : repli « colonne absente »`);
                    if (/verifyAndEnforceHoldAtomic/.test(src)) offenders.push(`${full} : ancienne réservation applicative`);
                }
            }
        };
        walk('app');
        walk('lib');
        assert.deepEqual(offenders, []);
    });
});

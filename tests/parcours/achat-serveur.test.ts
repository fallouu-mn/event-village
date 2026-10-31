/**
 * Lot 1A.4 — le parcours d'achat serveur fonctionne toujours sans politiques d'insertion
 * client sur tickets / payments : checkout (paiement PENDING) → notification de paiement →
 * billet VALIDE émis par le serveur. Le trigger de commissions (SECURITY DEFINER) s'exécute
 * au passage du paiement à SUCCESS.
 *
 * Note : la notification est envoyée signée avec le schéma provisoire du faux SamirPay ;
 * la vérification de signature côté serveur est l'objet du lot 2.
 */
import '../helpers/env';
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { getServiceRoleClient } from '../../lib/supabase/server';
import { bearer, loadFixtures, signInAs } from '../helpers/fixtures';
import { POST as checkout } from '../../app/api/checkout/route';
import { POST as samirpayWebhook } from '../../app/api/webhooks/samirpay/route';
import { getFakes } from '../fakes';
import { formRequest, jsonRequest, randomSenegalPhone } from './helpers';

const service = getServiceRoleClient();
let eventId = '';
let categoryId = '';

before(async () => {
    const fx = await loadFixtures();
    const date = new Date(Date.now() + 40 * 24 * 3600 * 1000).toISOString().slice(0, 10);
    const { data: event, error } = await service
        .from('events')
        .insert({
            partner_id: fx.partners.A.id,
            title: `TEST Parcours achat ${Date.now()}`,
            description: 'Événement dédié au test du parcours d\'achat serveur.',
            start_date: date,
            start_time: '19:00:00',
            location: 'Salle de test, Dakar',
            city: 'Dakar',
            capacity: 50,
            status: 'PUBLIE',
        })
        .select('id')
        .single();
    assert.equal(error, null, `création de l'événement de test : ${error?.message}`);
    eventId = event.id;
    const { data: cat, error: catErr } = await service
        .from('ticket_categories')
        .insert({ event_id: eventId, name: 'Standard', price: 2000, total_quantity: 5, sold_quantity: 0, is_active: true })
        .select('id')
        .single();
    assert.equal(catErr, null, `création de la catégorie : ${catErr?.message}`);
    categoryId = cat.id;
});

test('checkout → paiement PENDING → notification SUCCESS → billet VALIDE émis par le serveur', async () => {
    const { payment } = getFakes();
    const client = await signInAs('CLIENT');

    const res = await checkout(jsonRequest('/api/checkout', {
        eventId,
        items: [{ categoryId, quantity: 1 }],
        operator: 'WAVE',
        customerPhone: randomSenegalPhone('77'),
        customerName: 'Awa Client',
    }, bearer(client.accessToken)));
    const body = await res.json();
    assert.equal(res.status, 200, `checkout : HTTP ${res.status} ${JSON.stringify(body)}`);
    assert.ok(body.payment?.transaction_id, 'transaction interne retournée');

    const init = payment.callsOf('initPayment');
    assert.equal(init.length, 1, 'un appel initPayment (faux SamirPay)');
    const orderId = (init[0].args as { order_id: string }).order_id;

    const { data: pending } = await service.from('payments').select('id, status, amount').eq('external_order_id', orderId).single();
    assert.equal(pending?.status, 'PENDING');

    payment.setTransactionStatus(orderId, 'success');
    const hook = payment.buildWebhook({ order_id: orderId, status: 'success', amount: pending?.amount, currency: 'XOF' });
    const hookRes = await samirpayWebhook(formRequest('/api/webhooks/samirpay', hook.body, hook.headers));
    const hookBody = await hookRes.json();
    assert.equal(hookRes.status, 200, `webhook : HTTP ${hookRes.status}`);
    assert.equal(hookBody.success, true, `webhook traité : ${JSON.stringify(hookBody)}`);

    const { data: paid } = await service.from('payments').select('status').eq('id', pending!.id).single();
    assert.equal(paid?.status, 'SUCCESS');

    const { data: tickets, error } = await service.from('tickets').select('status, price').eq('event_id', eventId).eq('user_id', client.userId);
    assert.equal(error, null, `lecture des billets : ${error?.message}`);
    assert.equal(tickets?.length, 1, 'un billet émis');
    assert.equal(tickets?.[0].status, 'VALIDE');
});

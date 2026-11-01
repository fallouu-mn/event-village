/**
 * Lot 1A.4 — le parcours d'achat serveur fonctionne toujours sans politiques d'insertion
 * client sur tickets / payments : checkout (paiement PENDING) → notification de paiement →
 * billet VALIDE émis par le serveur. Le trigger de commissions (SECURITY DEFINER) s'exécute
 * au passage du paiement à SUCCESS.
 *
 * Lot 2 : contrat SamirPay (cashin direct, opérateur et téléphone payeur, Idempotency-Key) ;
 * la notification est adressée au callBackUrl (jeton du paiement), sans signature, et le serveur
 * confirme auprès de l'endpoint de statut avant d'émettre.
 */
import '../helpers/env';
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { getServiceRoleClient } from '../../lib/supabase/server';
import { bearer, loadFixtures, signInAs } from '../helpers/fixtures';
import { POST as checkout } from '../../app/api/checkout/route';
import { POST as samirpayWebhook } from '../../app/api/webhooks/samirpay/route';
import { getFakes } from '../fakes';
import { randomUUID } from 'node:crypto';
import { NextRequest } from 'next/server';
import { jsonRequest, randomSenegalPhone } from './helpers';
import { advanceEventTo, posterUrl } from './cycle-helpers';

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
            // Lot 5 : inséré en BROUILLON (forcé par la base), publié par les RPC de transition
            image_url: posterUrl(fx.partners.A.id),
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
    await advanceEventTo(eventId, 'PUBLIE');
});

test('checkout → paiement PENDING → notification SUCCESS → billet VALIDE émis par le serveur', async () => {
    const { payment } = getFakes();
    const client = await signInAs('CLIENT');

    const res = await checkout(jsonRequest('/api/checkout', {
        eventId,
        items: [{ categoryId, quantity: 1 }],
        operator: 'WAVE',
        payerPhone: randomSenegalPhone('77').slice(4),
    }, { ...bearer(client.accessToken), 'idempotency-key': randomUUID() }));
    const body = await res.json();
    assert.equal(res.status, 200, `checkout : HTTP ${res.status} ${JSON.stringify(body)}`);
    assert.ok(body.payment_id, 'paiement retourné');

    const init = payment.callsOf('initDirectPayment');
    assert.equal(init.length, 1, 'un appel de cashin direct (faux SamirPay)');
    const orderId = (init[0].args as { orderId: string }).orderId;

    const { data: pending } = await service.from('payments').select('id, status, amount, external_transaction_id').eq('external_order_id', orderId).single();
    assert.equal(pending?.status, 'PENDING');

    payment.setTransactionStatus(pending!.external_transaction_id, 'SUCCESS');
    const hook = payment.buildWebhook(pending!.external_transaction_id);
    const hookRes = await samirpayWebhook(new NextRequest(hook.url, { method: 'POST', headers: hook.headers, body: hook.body }));
    const hookBody = await hookRes.json();
    assert.equal(hookRes.status, 200, `webhook : HTTP ${hookRes.status}`);
    assert.equal(hookBody.received, true, `webhook enregistré : ${JSON.stringify(hookBody)}`);

    const { data: paid } = await service.from('payments').select('status').eq('id', pending!.id).single();
    assert.equal(paid?.status, 'SUCCESS');

    const { data: tickets, error } = await service.from('tickets').select('status, price').eq('event_id', eventId).eq('user_id', client.userId);
    assert.equal(error, null, `lecture des billets : ${error?.message}`);
    assert.equal(tickets?.length, 1, 'un billet émis');
    assert.equal(tickets?.[0].status, 'VALIDE');
});

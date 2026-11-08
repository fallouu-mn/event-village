/**
 * Lot 2.1 — webhook SamirPay authentifié (R7, R8).
 * Contrat SamirPay : POST form-urlencoded (transaction_id, order_id, status=success), aucune
 * signature, envoyé seulement en cas de succès. Défense en profondeur :
 *  - jeton aléatoire propre au paiement dans le callBackUrl (empreinte stockée, comparaison à
 *    temps constant) ;
 *  - corrélation : transaction_id reçu = identifiant SamirPay enregistré à la création ;
 *  - confirmation par l'endpoint de statut, appelé avec l'identifiant ENREGISTRÉ ; seul SUCCESS
 *    déclenche la confirmation ;
 *  - chaque webhook est enregistré (payment_webhook_events) avant traitement ; réponse 200 ;
 *  - order_id validé par regex, recherche par .eq() (plus de .or() interpolé) ;
 *  - aucun numéro de téléphone dans les journaux.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { assertPaymentInvariants } from '../helpers/payment-invariants';
import {
    Buyer, callsOf, cart, checkout, createSaleEvent, deliverWebhook, eventTickets, newBuyer, paymentById,
    PaymentRow, providerSays, SaleEvent, service,
} from './paiement-helpers';

let ev: SaleEvent;

async function initiated(label: string): Promise<{ buyer: Buyer; payment: PaymentRow }> {
    const buyer = await newBuyer(label);
    const r = await checkout(buyer, cart(ev.eventId, [[ev.categories.Standard.id, 1]], buyer));
    assert.equal(r.status, 200, `checkout : HTTP ${r.status} ${JSON.stringify(r.body)}`);
    assert.ok(r.payment, 'paiement créé');
    return { buyer, payment: r.payment! };
}

async function webhookEvents(orderId: string): Promise<Array<Record<string, unknown>>> {
    const { data, error } = await service.from('payment_webhook_events').select('*').eq('order_id', orderId);
    assert.equal(error, null, `journal des webhooks : ${error?.message}`);
    return data ?? [];
}

async function ticketsFor(buyer: Buyer): Promise<number> {
    return (await eventTickets(ev.eventId)).filter((t) => t.user_id === buyer.userId).length;
}

before(async () => {
    ev = await createSaleEvent('webhook', [{ name: 'Standard', price: 3000, total: 40 }]);
});

after(async () => {
    await assertPaymentInvariants('paiement-webhook');
});

describe('Webhook SamirPay', () => {
    test('sans jeton : enregistré, 200, aucun billet, paiement toujours PENDING', async () => {
        const { buyer, payment } = await initiated('sans-jeton');
        providerSays(payment, 'SUCCESS');
        const res = await deliverWebhook(payment, { token: 'none' });
        assert.equal(res.status, 200);
        assert.equal(await ticketsFor(buyer), 0, 'aucun billet sans jeton');
        assert.equal((await paymentById(payment.id)).status, 'PENDING');
        const evts = await webhookEvents(payment.external_order_id!);
        assert.equal(evts.length, 1, 'webhook enregistré');
        assert.equal(evts[0].result, 'REJECTED_TOKEN');
    });

    test('jeton erroné : rejeté, aucun billet', async () => {
        const { buyer, payment } = await initiated('jeton-errone');
        providerSays(payment, 'SUCCESS');
        assert.equal((await deliverWebhook(payment, { token: 'wrong' })).status, 200);
        assert.equal(await ticketsFor(buyer), 0);
        assert.equal((await webhookEvents(payment.external_order_id!))[0]?.result, 'REJECTED_TOKEN');
    });

    test('jeton valide mais transaction_id différent de l’identifiant enregistré : rejeté (corrélation)', async () => {
        const { buyer, payment } = await initiated('correlation');
        providerSays(payment, 'SUCCESS');
        assert.equal((await deliverWebhook(payment, { token: 'valid', transactionId: '7b0e4f7c-3d1a-4c9e-9a51-2f3c4d5e6f70' })).status, 200);
        assert.equal(await ticketsFor(buyer), 0);
        assert.equal((await webhookEvents(payment.external_order_id!))[0]?.result, 'REJECTED_CORRELATION');
    });

    test('jeton et corrélation valides, fournisseur encore PENDING : aucun billet', async () => {
        const { buyer, payment } = await initiated('fournisseur-pending');
        providerSays(payment, 'PENDING');
        assert.equal((await deliverWebhook(payment, { token: 'valid' })).status, 200);
        assert.equal(await ticketsFor(buyer), 0, 'le webhook seul ne suffit pas : le statut SamirPay fait foi');
        assert.equal((await paymentById(payment.id)).status, 'PENDING');
    });

    test('fournisseur SUCCESS : billets émis, statut demandé avec l’identifiant ENREGISTRÉ', async () => {
        const { buyer, payment } = await initiated('succes');
        providerSays(payment, 'SUCCESS');
        const before = callsOf('checkTransactionStatus').length;
        assert.equal((await deliverWebhook(payment, { token: 'valid' })).status, 200);
        assert.equal(await ticketsFor(buyer), 1, 'un billet émis');
        assert.equal((await paymentById(payment.id)).status, 'SUCCESS');
        const statusCalls = callsOf('checkTransactionStatus').slice(before);
        assert.ok(statusCalls.length >= 1, 'statut demandé à SamirPay avant émission');
        assert.ok(statusCalls.every((c) => String(c.args.transactionId) === payment.external_transaction_id), `statut demandé avec l'identifiant enregistré : ${JSON.stringify(statusCalls.map((c) => c.args))}`);
        assert.equal((await webhookEvents(payment.external_order_id!))[0]?.result, 'CONFIRMED');
    });

    test('rejeu : enregistré une fois (compteur de réceptions), billets non doublés', async () => {
        const { buyer, payment } = await initiated('rejeu');
        providerSays(payment, 'SUCCESS');
        await deliverWebhook(payment, { token: 'valid' });
        await deliverWebhook(payment, { token: 'valid' });
        assert.equal(await ticketsFor(buyer), 1, 'aucun doublon');
        const evts = await webhookEvents(payment.external_order_id!);
        assert.equal(evts.length, 1, 'une ligne par événement (contrainte d’unicité)');
        assert.equal(Number(evts[0].receive_count), 2, 'réceptions comptées');
    });

    test('order_id malformé (injection de filtre PostgREST) : 200, rejeté, aucun billet', async () => {
        const { payment } = await initiated('injection');
        const injected = `${payment.external_order_id},id.not.is.null`;
        const res = await deliverWebhook(payment, { token: 'valid', orderId: injected });
        assert.equal(res.status, 200);
        const evts = await webhookEvents(injected);
        assert.equal(evts.length, 1, 'enregistré tel que reçu');
        assert.equal(evts[0].result, 'REJECTED_INVALID_PAYLOAD');
        assert.equal(await ticketsFor({ userId: payment.client_id } as Buyer), 0);
    });

    test('corps brut et en-têtes utiles conservés ; statut autre que success ignoré', async () => {
        const { buyer, payment } = await initiated('statut-autre');
        providerSays(payment, 'SUCCESS');
        assert.equal((await deliverWebhook(payment, { token: 'valid', status: 'failed' })).status, 200);
        assert.equal(await ticketsFor(buyer), 0);
        const [evt] = await webhookEvents(payment.external_order_id!);
        assert.equal(evt.result, 'REJECTED_STATUS');
        assert.ok(String(evt.raw_body).includes(`order_id=${encodeURIComponent(payment.external_order_id!)}`), 'corps brut conservé');
        assert.equal((evt.headers as Record<string, string>)['content-type'], 'application/x-www-form-urlencoded');
    });

    test('aucun numéro de téléphone payeur dans les journaux du parcours', async () => {
        const lines: string[] = [];
        const saved = { log: console.log, warn: console.warn, error: console.error, info: console.info };
        for (const k of ['log', 'warn', 'error', 'info'] as const) {
            console[k] = (...args: unknown[]) => { lines.push(args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ')); };
        }
        let phone9 = '';
        try {
            const { buyer, payment } = await initiated('journaux');
            phone9 = buyer.phone9;
            providerSays(payment, 'SUCCESS');
            await deliverWebhook(payment, { token: 'valid' });
        } finally {
            Object.assign(console, saved);
        }
        const leaks = lines.filter((l) => l.includes(phone9));
        assert.deepEqual(leaks, [], 'numéro payeur absent des journaux');
    });

    // Port A21 du SCENARIO 6 & 7 : seule preuve de la branche « corps non form-urlencoded » de lib/payments/webhook.service.ts.
    // Jeton et champs sont valides : seul le format du corps arrête ce webhook. Le corps n'étant pas lu, order_id reste
    // vide en base : la ligne se retrouve par son corps brut, propre à ce paiement.
    test('corps multipart : 200, received: true, REJECTED_INVALID_PAYLOAD « corps non form-urlencoded », aucun billet', async () => {
        const { buyer, payment } = await initiated('multipart');
        providerSays(payment, 'SUCCESS');
        const rawBody = [
            ['transaction_id', payment.external_transaction_id!],
            ['order_id', payment.external_order_id!],
            ['status', 'success'],
        ].map(([name, value]) => `--frontiere\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`).join('') + '--frontiere--\r\n';
        const res = await deliverWebhook(payment, { rawBody, contentType: 'multipart/form-data' });
        assert.equal(res.status, 200);
        assert.equal((await res.json()).received, true);
        const { data, error } = await service.from('payment_webhook_events').select('*').eq('raw_body', rawBody);
        assert.equal(error, null, `journal des webhooks : ${error?.message}`);
        const evts = data ?? [];
        assert.equal(evts.length, 1, 'webhook enregistré');
        assert.equal(evts[0].result, 'REJECTED_INVALID_PAYLOAD');
        assert.equal(evts[0].result_detail, 'corps non form-urlencoded', 'branche du format du corps, pas celle des identifiants invalides');
        assert.equal(evts[0].order_id, null, 'champs du corps non lus');
        assert.equal(await ticketsFor(buyer), 0, 'aucun billet');
        assert.equal((await paymentById(payment.id)).status, 'PENDING');
    });
});

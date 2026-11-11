/**
 * Lot 9 bis, tâche H4 — orderId stable, une seule relance au même orderId, 409 CONFLICT qui rend l'identifiant de la
 * transaction existante, adoption par le webhook (PO6). Consigne H4 ; contrat 5.57, 4.5, B105 ; découverte
 * 9bis/discovery-9bis-samirpay.md section 5. Faux SamirPay de tests/fakes (modes timeout-after-create,
 * timeout-after-create-always, timeout-once ; DUPLICATE porteur de existingTransactionId), acheteurs neufs.
 *  a. délai dépassé APRÈS la création (sans statut HTTP), relance au même orderId → 409 DUPLICATE avec l'identifiant :
 *     2 appels, paiement CANCELLED avec l'identifiant adopté, provider_final faux (surveillé), réservation rendue ;
 *  b. délai dépassé une fois, rien de créé, relance → succès : 2 appels au même orderId, paiement PENDING avec lien ;
 *  c. délai dépassé à chaque appel : 2 appels exactement, FAILED INIT_UNCERTAIN, provider_final faux, réservation rendue ;
 *  d. PO6 : transaction créée chez SamirPay mais aucune réponse aux deux appels, puis le client paie : le webhook au
 *     jeton valide adopte l'identifiant (paiement sans identifiant, statut INIT_*) et les billets sont émis ;
 *  e. garde : refus explicite (rejected) → un seul appel, aucune relance.
 *
 * Rouge aujourd'hui : aucune relance (checkout.service.ts:278-288), toute erreur → payment_release(FAILED,
 * INIT_<nature>) donc provider_final = TRUE (20261031000013_lot2_reservations.sql:218) ; le doublon ne rend aucun
 * identifiant ; le webhook d'un paiement sans identifiant est rejeté REJECTED_CORRELATION (webhook.service.ts:87-89).
 * Vert dès l'écriture (signalé) : e (un seul appel) ; son garde-fou est c (deux appels exigés pour un délai dépassé).
 * after() : assertLot9bisInvariants (garde de schéma rouge jusqu'aux migrations du lot).
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { assertLot9bisInvariants } from '../helpers/lot9bis-invariants';
import {
    cart, checkout, createSaleEvent, deliverWebhook, eventTickets, fakePay, initCalls, newBuyer, paymentByOrder, setFakeMode,
    service, type Buyer, type InitCall, type PaymentRow, type SaleEvent,
} from './paiement-helpers';

type Row = Record<string, unknown>;

let ev: SaleEvent;

before(async () => {
    setFakeMode('initMode', 'success');
    ev = await createSaleEvent('init-relance', [{ name: 'Standard', price: 2_500, total: 40, maxPerOrder: 5 }]);
});

after(async () => {
    setFakeMode('initMode', 'success');
    await assertLot9bisInvariants('paiement-init-relance');
});

interface Attempt { buyer: Buyer; status: number; body: Row; calls: InitCall[]; payment: PaymentRow }

/** Checkout dans le mode du faux demandé ; les appels d'initialisation de CE checkout sont isolés et doivent porter un seul orderId. */
async function attempt(label: string, mode: string): Promise<Attempt> {
    const buyer = await newBuyer(`init-${label}`);
    const before0 = initCalls().length;
    setFakeMode('initMode', mode);
    let r: Awaited<ReturnType<typeof checkout>>;
    try {
        r = await checkout(buyer, cart(ev.eventId, [[ev.categories.Standard.id, 2]], buyer));
    } finally {
        setFakeMode('initMode', 'success');
    }
    const calls = initCalls().slice(before0).filter((c) => c.args.telephone === buyer.phone9);
    assert.ok(calls.length >= 1, `au moins un appel d'initialisation pour ce checkout : HTTP ${r.status} ${JSON.stringify(r.body)}`);
    assert.equal(new Set(calls.map((c) => c.orderId)).size, 1, `un seul orderId, stable d’un appel à l’autre (consigne H4) : ${JSON.stringify(calls.map((c) => c.orderId))}`);
    const payment = r.payment ?? await paymentByOrder(calls[0].orderId);
    assert.ok(payment, `paiement du checkout (orderId ${calls[0].orderId})`);
    return { buyer, status: r.status, body: r.body, calls, payment: payment! };
}

async function heldOf(paymentId: string): Promise<Array<[number, string]>> {
    const { data, error } = await service.from('stock_reservations').select('quantity, status').eq('payment_id', paymentId);
    assert.equal(error, null, `réservations du paiement : ${error?.message}`);
    return (data ?? []).map((r) => [Number(r.quantity), String(r.status)]);
}

async function reread(p: PaymentRow): Promise<Row> {
    const { data, error } = await service.from('payments').select('*').eq('id', p.id).single();
    assert.equal(error, null, `paiement ${p.id} : ${error?.message}`);
    return data as Row;
}

describe('H4 — initialisation : une seule relance au même orderId, identifiant repris (contrat 5.57, B105)', () => {
    test('a. délai dépassé après la création, relance → 409 DUPLICATE avec identifiant : CANCELLED avec l’identifiant, provider_final faux, réservation rendue', async () => {
        const a = await attempt('apres-creation', 'timeout-after-create');
        assert.equal(a.calls.length, 2, `une relance unique au même orderId (aujourd’hui un seul appel) : ${a.calls.length}`);
        const created = fakePay().transactionIdForOrder(a.calls[0].orderId);
        assert.ok(created, 'précondition : la transaction existe chez SamirPay');
        const p = await reread(a.payment);
        assert.deepEqual({ status: p.status, id: p.external_transaction_id, final: p.provider_final },
            { status: 'CANCELLED', id: created, final: false }, `identifiant existant repris, paiement surveillé (B105, D-sam D1) : ${JSON.stringify({ status: p.status, provider_status: p.provider_status })}`);
        assert.ok((await heldOf(a.payment.id)).every(([, s]) => s !== 'ACTIVE'), 'réservation rendue : le client peut relancer un achat');
        assert.ok(a.status >= 400, `le client n’a reçu aucun lien : refus affiché (HTTP ${a.status})`);
    });

    test('b. délai dépassé une fois, rien de créé, relance → succès : paiement PENDING avec son lien', async () => {
        const b = await attempt('une-fois', 'timeout-once');
        assert.equal(b.calls.length, 2, `relance unique au même orderId : ${b.calls.length}`);
        assert.equal(b.status, 200, `la relance aboutit : HTTP ${b.status} ${JSON.stringify(b.body)}`);
        const p = await reread(b.payment);
        assert.deepEqual({ status: p.status, id: p.external_transaction_id }, { status: 'PENDING', id: fakePay().transactionIdForOrder(b.calls[0].orderId) }, 'paiement en attente, identifiant de la relance');
        assert.equal(typeof b.body.payment_url, 'string', `lien de paiement rendu au client (Wave : url) : ${JSON.stringify(b.body)}`);
    });

    test('c. délai dépassé à chaque appel : 2 appels exactement, FAILED INIT_UNCERTAIN, provider_final faux, réservation rendue', async () => {
        const c = await attempt('toujours', 'timeout');
        assert.equal(c.calls.length, 2, `une relance, jamais plus (aujourd’hui un seul appel) : ${c.calls.length}`);
        const p = await reread(c.payment);
        assert.deepEqual({ status: p.status, reason: p.provider_status, final: p.provider_final }, { status: 'FAILED', reason: 'INIT_UNCERTAIN', final: false },
            'issue inconnue : jamais définitive (aujourd’hui provider_final = TRUE)');
        assert.ok((await heldOf(c.payment.id)).every(([, s]) => s !== 'ACTIVE'), 'réservation rendue');
    });

    test('d. PO6 : transaction créée sans réponse aux deux appels, le client paie : le webhook au jeton valide adopte l’identifiant, billets émis', async () => {
        const d = await attempt('po6', 'timeout-after-create-always');
        assert.equal(d.calls.length, 2, `relance unique : ${d.calls.length}`);
        const created = fakePay().transactionIdForOrder(d.calls[0].orderId);
        assert.ok(created, 'précondition : transaction créée chez SamirPay');
        const before0 = await reread(d.payment);
        assert.equal(before0.external_transaction_id, null, 'précondition : aucun identifiant enregistré (aucune réponse)');
        fakePay().setTransactionStatus(created, 'SUCCESS');
        const hook = await deliverWebhook(d.payment, { transactionId: created });
        assert.equal(hook.status, 200, `webhook : HTTP ${hook.status}`);
        const { data: events, error } = await service.from('payment_webhook_events').select('result').eq('order_id', d.calls[0].orderId);
        assert.equal(error, null, `journal du webhook : ${error?.message}`);
        assert.ok((events ?? []).some((e) => String(e.result).startsWith('ADOPTED_THEN_')), `identifiant adopté par le webhook (aujourd’hui REJECTED_CORRELATION) : ${JSON.stringify(events)}`);
        const p = await reread(d.payment);
        assert.deepEqual({ status: p.status, id: p.external_transaction_id }, { status: 'SUCCESS', id: created }, 'paiement confirmé avec l’identifiant adopté');
        assert.equal((await eventTickets(ev.eventId)).filter((t) => t.payment_id === d.payment.id).length, 2, 'les deux billets payés sont émis : l’argent encaissé n’est jamais perdu');
    });

    test('e. garde : refus explicite de l’opérateur → un seul appel, aucune relance', async () => {
        const e = await attempt('refus', 'rejected');
        assert.equal(e.calls.length, 1, 'un refus n’est jamais relancé');
        assert.equal((await reread(e.payment)).status, 'FAILED', 'paiement refusé');
    });
});

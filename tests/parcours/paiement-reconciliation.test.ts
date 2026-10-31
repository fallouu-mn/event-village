/**
 * Lot 2.9 — réconciliation périodique (obligatoire : seul moyen de connaître FAILED et CANCELLED,
 * le webhook n'étant envoyé qu'en cas de succès). Route cron protégée par CRON_SECRET :
 *  - fenêtre d'attente avant le premier contrôle (paiements trop récents ignorés) ;
 *  - statut demandé à SamirPay avec l'identifiant enregistré → confirmation par la RPC (SUCCESS),
 *    échec ou annulation (FAILED / CANCELLED) avec libération des réservations ;
 *  - expiration des PENDING trop anciens, réservations libérées.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { assertPaymentInvariants } from '../helpers/payment-invariants';
import {
    cart, categoryState, checkout, createSaleEvent, cronRequest, eventTickets, importModule, newBuyer, paymentById,
    PaymentRow, providerSays, SaleEvent, service,
} from './paiement-helpers';

let ev: SaleEvent;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let cron: (req: any) => Promise<Response>;

before(async () => {
    ev = await createSaleEvent('reconciliation', [{ name: 'Standard', price: 2500, total: 30 }]);
    ({ GET: cron } = await importModule('../../app/api/cron/payments-reconcile/route'));
});

after(async () => {
    await assertPaymentInvariants('paiement-reconciliation');
});

async function agedPayment(label: string, minutes: number): Promise<PaymentRow> {
    const b = await newBuyer(label);
    const r = await checkout(b, cart(ev.eventId, [[ev.categories.Standard.id, 2]], b));
    assert.equal(r.status, 200, JSON.stringify(r.body));
    const at = new Date(Date.now() - minutes * 60_000).toISOString();
    const { error } = await service.from('payments').update({ created_at: at }).eq('id', r.payment!.id);
    assert.equal(error, null, `vieillissement : ${error?.message}`);
    return r.payment!;
}

describe('Réconciliation', () => {
    test('sans CRON_SECRET → 401', async () => {
        assert.equal((await cron(cronRequest('/api/cron/payments-reconcile', null))).status, 401);
        assert.equal((await cron(cronRequest('/api/cron/payments-reconcile', 'faux'))).status, 401);
    });

    test('SUCCESS chez SamirPay (webhook perdu) → billets émis par la RPC ; FAILED → échec et stock rendu ; CANCELLED → annulé', async () => {
        const held0 = (await categoryState(ev.categories.Standard.id)).held;
        const ok = await agedPayment('rec-succes', 20);
        const ko = await agedPayment('rec-echec', 20);
        const cancelled = await agedPayment('rec-annule', 20);
        providerSays(ok, 'SUCCESS');
        providerSays(ko, 'FAILED');
        providerSays(cancelled, 'CANCELLED');
        const res = await cron(cronRequest('/api/cron/payments-reconcile'));
        assert.equal(res.status, 200, JSON.stringify(await res.clone().json()));
        assert.equal((await paymentById(ok.id)).status, 'SUCCESS');
        assert.equal((await eventTickets(ev.eventId)).filter((t) => t.user_id === ok.client_id).length, 2);
        assert.equal((await paymentById(ko.id)).status, 'FAILED');
        assert.equal((await paymentById(cancelled.id)).status, 'CANCELLED');
        assert.equal((await categoryState(ev.categories.Standard.id)).held, held0, 'réservations libérées ou converties');
    });

    test('PENDING trop ancien encore PENDING chez SamirPay → EXPIRED, réservation libérée ; paiement récent ignoré', async () => {
        const held0 = (await categoryState(ev.categories.Standard.id)).held;
        const old = await agedPayment('rec-vieux', 120);
        providerSays(old, 'PENDING');
        const b = await newBuyer('rec-recent');
        const recent = (await checkout(b, cart(ev.eventId, [[ev.categories.Standard.id, 1]], b))).payment!;
        providerSays(recent, 'SUCCESS');
        await cron(cronRequest('/api/cron/payments-reconcile'));
        assert.equal((await paymentById(old.id)).status, 'EXPIRED');
        assert.equal((await paymentById(recent.id)).status, 'PENDING', 'fenêtre d’attente avant le premier contrôle');
        assert.equal((await categoryState(ev.categories.Standard.id)).held, held0 + 1, 'seule la réservation récente reste');
    });
});

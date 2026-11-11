/**
 * Lot 9 bis, tâches H5 (R103, 4e cas) et H1 — paiement expiré chez SamirPay puis réussi (consigne H1, H5 ; contrat
 * 5.54, 5.58, B102 ; découverte 9bis/discovery-9bis-samirpay.md sections 2 et 6). Faux SamirPay de tests/fakes,
 * acheteurs et événements neufs, cron payments-reconcile appelé en lot large.
 *  R103-4  paiement PENDING de 70 minutes dont SamirPay ne connaît pas l'identifiant (NOT_FOUND) : le cron l'expire
 *          (EXPIRED, PROVIDER_NOT_FOUND), il reste surveillé (provider_final faux) ;
 *  H1-a    paiement de 70 minutes, SamirPay dit FAILED : cron → FAILED, non définitif ; SamirPay dit ensuite SUCCESS :
 *          cron → SUCCESS, billets émis ;
 *  H1-b    même chemin, places vendues entre-temps : REFUND_PENDING, un remboursement REFUND, PAYMENT_REFUND_STARTED ;
 *  H1-c    webhook de succès arrivé après la libération des places (paiement FAILED) : remboursement ; puis l'avis ;
 *  H1-d    témoin : FAILED lu 2 h 05 après la création → provider_final vrai, plus aucun contrôle de statut.
 *
 * Rouge aujourd'hui :
 *  - R103-4 : reconcilePayment rend PROVIDER_NOT_FOUND avant le contrôle d'âge (lib/payments/confirmation.service.ts:158),
 *    le paiement reste PENDING sans fin ;
 *  - H1-a, H1-b : payment_release pose provider_final = TRUE pour tout FAILED (20261031000013_lot2_reservations.sql:218)
 *    et le cron ne surveille que EXPIRED et CANCELLED (app/api/cron/payments-reconcile/route.ts:50) ;
 *  - avis de H1-b et H1-c : PAYMENT_REFUND_STARTED absent (R30, tâche 6).
 * Non reproduit probable (signalé) : la partie « remboursement » de H1-c, chemin webhook (payment_confirm n'exige pas
 * PENDING, 20261106000003_lot8_paiement.sql:125-137 ; le webhook ne lit pas provider_final, webhook.service.ts:78-93).
 * Vert dès l'écriture (témoin) : H1-d ; son garde-fou est H1-a (même montage à 70 minutes).
 * after() : assertLot9bisInvariants (garde de schéma rouge jusqu'aux migrations du lot).
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { assertLot9bisInvariants } from '../helpers/lot9bis-invariants';
import {
    callsOf, cart, checkout, createSaleEvent, cronRequest, fakePay, importModule, newBuyer, paymentById, service, setFakeMode,
    type Buyer, type PaymentRow, type SaleEvent,
} from './paiement-helpers';
import { withEnv } from './notif-helpers';

type Row = Record<string, unknown>;

const RECONCILE_ROUTE = '../../app/api/cron/payments-reconcile/route';
const MINUTE = 60_000;

before(() => {
    setFakeMode('initMode', 'success');
    setFakeMode('cashoutMode', 'success');
    fakePay().balance = 10_000_000;
});

after(async () => {
    setFakeMode('initMode', 'success');
    await assertLot9bisInvariants('paiement-succes-tardif-v12');
});

// ── Outils ─────────────────────────────────────────────────────────────────

/** Passage du cron, lot large : les paiements laissés par d'autres suites n'écartent jamais celui du cas. */
async function runCron(): Promise<Row> {
    const { GET } = await importModule(RECONCILE_ROUTE);
    return withEnv({ PAYMENT_RECONCILE_BATCH: '1000' }, async () => {
        const res = await GET(cronRequest('/api/cron/payments-reconcile'));
        const body = (await res.json()) as Row;
        assert.equal(res.status, 200, `cron payments-reconcile : ${JSON.stringify(body)}`);
        return body;
    });
}

async function pendingPayment(buyer: Buyer, ev: SaleEvent, quantity: number): Promise<PaymentRow> {
    const r = await checkout(buyer, cart(ev.eventId, [[ev.categories.Standard.id, quantity]], buyer));
    assert.equal(r.status, 200, `checkout de préparation : HTTP ${r.status} ${JSON.stringify(r.body)}`);
    assert.ok(r.payment?.external_transaction_id, 'précondition : paiement PENDING avec identifiant SamirPay');
    return r.payment!;
}

/** Paiement créé il y a `minutes` minutes (validité SamirPay : 1 h ; délai de grâce H1 : 2 h). */
async function agePayment(payment: PaymentRow, minutes: number): Promise<void> {
    const { error } = await service.from('payments').update({ created_at: new Date(Date.now() - minutes * MINUTE).toISOString() }).eq('id', payment.id);
    assert.equal(error, null, `created_at du paiement reculé : ${error?.message}`);
}

// ── R103, 4e cas (H5) ──────────────────────────────────────────────────────

describe('H5 — R103 (4e cas) : un paiement que SamirPay ne connaît pas n’attend pas sans fin', () => {
    test('R103-4 : PENDING de 70 minutes, identifiant inconnu de SamirPay (NOT_FOUND) : le cron l’expire et le garde sous surveillance', async () => {
        const ev = await createSaleEvent('v12-introuvable', [{ name: 'Standard', price: 2_000, total: 10 }]);
        const buyer = await newBuyer('v12-introuvable');
        const p = await pendingPayment(buyer, ev, 1);
        const unknown = randomUUID();
        const { error } = await service.from('payments').update({ external_transaction_id: unknown }).eq('id', p.id);
        assert.equal(error, null, `identifiant inconnu de SamirPay : ${error?.message}`);
        await agePayment(p, 70);

        await runCron();
        assert.ok(callsOf('checkTransactionStatus').some((c) => c.args.transactionId === unknown), 'précondition : statut demandé à SamirPay, qui répond NOT_FOUND');
        const after0 = await paymentById(p.id);
        assert.deepEqual({ status: after0.status, provider_status: after0.provider_status, final: after0.provider_final },
            { status: 'EXPIRED', provider_status: 'PROVIDER_NOT_FOUND', final: false },
            `paiement de plus de 60 minutes introuvable chez SamirPay : expiré, encore surveillé (aujourd’hui PENDING sans fin) : ${JSON.stringify({ status: after0.status, provider_status: after0.provider_status })}`);
    });
});

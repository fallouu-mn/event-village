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
    callsOf, cart, checkout, createSaleEvent, cronRequest, deliverWebhook, eventTickets, fakePay, importModule, newBuyer, paymentById,
    providerSays, service, setFakeMode, type Buyer, type PaymentRow, type SaleEvent,
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

// ── H1 : un FAILED lu au statut n'est pas définitif pendant 2 heures ───────

/** Le cron ne revoit un paiement surveillé qu'après 15 minutes : le dernier contrôle est reculé de 20 minutes. */
async function allowRecheck(payment: PaymentRow): Promise<void> {
    const { error } = await service.from('payments').update({ last_reconciled_at: new Date(Date.now() - 20 * MINUTE).toISOString() }).eq('id', payment.id);
    assert.equal(error, null, `dernier contrôle reculé : ${error?.message}`);
}

function statusChecks(payment: PaymentRow): number {
    return callsOf('checkTransactionStatus').filter((c) => c.args.transactionId === payment.external_transaction_id).length;
}

async function ticketsOf(ev: SaleEvent, paymentId: string): Promise<Row[]> {
    return (await eventTickets(ev.eventId)).filter((t) => t.payment_id === paymentId);
}

async function cashoutsOf(paymentId: string): Promise<Row[]> {
    const { data, error } = await service.from('cashouts').select('*').eq('payment_id', paymentId).order('created_at');
    assert.equal(error, null, `cashouts du paiement ${paymentId} : ${error?.message}`);
    return (data ?? []) as Row[];
}

/** Paiement PENDING de `minutes` minutes, que le cron lit FAILED chez SamirPay. */
async function failedByStatus(label: string, ev: SaleEvent, minutes: number): Promise<{ buyer: Buyer; payment: PaymentRow }> {
    const buyer = await newBuyer(`v12-${label}`);
    const payment = await pendingPayment(buyer, ev, 2);
    await agePayment(payment, minutes);
    providerSays(payment, 'FAILED');
    await runCron();
    assert.equal((await paymentById(payment.id)).status, 'FAILED', 'précondition : paiement FAILED lu au statut SamirPay');
    return { buyer, payment };
}

/** Avis PAYMENT_REFUND_STARTED du client (R30, 11.1 N4) : un par canal. */
async function refundStartedChannels(buyer: Buyer): Promise<string[]> {
    const { data, error } = await service.from('notification_outbox').select('channel').eq('type', 'PAYMENT_REFUND_STARTED').eq('recipient_user_id', buyer.userId);
    assert.equal(error, null, `boîte d’envoi : ${error?.message}`);
    return (data ?? []).map((r) => String(r.channel)).sort();
}

describe('H1 — paiement expiré chez SamirPay (FAILED) puis réussi : billets s’il reste des places, sinon remboursement', () => {
    test('H1-a : 70 minutes, FAILED lu par le cron (non définitif), puis SUCCESS : le cron confirme, billets émis', async () => {
        const ev = await createSaleEvent('v12-tardif-stock', [{ name: 'Standard', price: 2_000, total: 10 }]);
        const { payment } = await failedByStatus('tardif-stock', ev, 70);
        assert.equal((await paymentById(payment.id)).provider_final, false, 'FAILED de moins de 2 h : jamais définitif (B102 ; aujourd’hui provider_final = TRUE)');

        providerSays(payment, 'SUCCESS');
        await allowRecheck(payment);
        await runCron();
        const paid = await paymentById(payment.id);
        assert.equal(paid.status, 'SUCCESS', `succès tardif repris par le statut (aujourd’hui le cron ignore les FAILED) : ${paid.status}`);
        assert.deepEqual((await ticketsOf(ev, payment.id)).map((t) => t.status), ['VALIDE', 'VALIDE'], 'les deux billets payés sont émis');
    });

    test('H1-b : places vendues entre-temps : REFUND_PENDING, un remboursement REFUND, PAYMENT_REFUND_STARTED au client', async () => {
        const ev = await createSaleEvent('v12-tardif-complet', [{ name: 'Standard', price: 2_000, total: 2 }]);
        const { buyer, payment } = await failedByStatus('tardif-complet', ev, 70);
        const other = await newBuyer('v12-tardif-autre');
        const sold = await pendingPayment(other, ev, 2);
        providerSays(sold, 'SUCCESS');
        assert.equal((await deliverWebhook(sold)).status, 200, 'précondition : un autre acheteur prend les deux places');
        assert.equal((await paymentById(sold.id)).status, 'SUCCESS', 'précondition : places vendues');

        providerSays(payment, 'SUCCESS');
        await allowRecheck(payment);
        await runCron();
        const p = await paymentById(payment.id);
        assert.ok(p.status === 'REFUND_PENDING' || p.status === 'REFUNDED', `encaissé sans place : remboursé (aujourd’hui FAILED, jamais relu) : ${p.status}`);
        const refunds = await cashoutsOf(payment.id);
        assert.deepEqual(refunds.map((c) => [c.kind, Number(c.amount)]), [['REFUND', Number(payment.amount)]], 'un seul remboursement, du montant payé');
        assert.equal((await ticketsOf(ev, payment.id)).length, 0, 'aucun billet émis sans place');
        assert.deepEqual(await refundStartedChannels(buyer), ['EMAIL', 'IN_APP', 'PUSH', 'SMS'], 'PAYMENT_REFUND_STARTED au client (R30, un seul émetteur : notif_cashouts_notify)');
    });

    test('H1-c : webhook de succès arrivé après la libération des places (paiement FAILED) : REFUND_PENDING et remboursement', async () => {
        const ev = await createSaleEvent('v12-webhook-complet', [{ name: 'Standard', price: 2_000, total: 2 }]);
        const buyer = await newBuyer('v12-webhook-complet');
        const payment = await pendingPayment(buyer, ev, 2);
        const { data, error } = await service.rpc('payment_release', { p_payment_id: payment.id, p_status: 'FAILED', p_reason: 'PROVIDER_FAILED' });
        assert.equal(error, null, `libération : ${error?.message}`);
        assert.equal((data as Row | null)?.changed, true, 'précondition : places libérées, paiement FAILED');
        const other = await newBuyer('v12-webhook-autre');
        const sold = await pendingPayment(other, ev, 2);
        providerSays(sold, 'SUCCESS');
        assert.equal((await deliverWebhook(sold)).status, 200, 'précondition : places revendues');

        providerSays(payment, 'SUCCESS');
        assert.equal((await deliverWebhook(payment)).status, 200, 'webhook de succès accepté');
        const p = await paymentById(payment.id);
        assert.ok(p.status === 'REFUND_PENDING' || p.status === 'REFUNDED', `succès sans place : remboursé : ${p.status}`);
        assert.deepEqual((await cashoutsOf(payment.id)).map((c) => c.kind), ['REFUND'], 'un remboursement');
        assert.equal((await ticketsOf(ev, payment.id)).length, 0, 'aucun billet');
    });

    test('H1-c (avis) : le client du succès tardif remboursé reçoit PAYMENT_REFUND_STARTED (SMS, in-app, push, email)', async () => {
        const ev = await createSaleEvent('v12-webhook-avis', [{ name: 'Standard', price: 2_000, total: 2 }]);
        const buyer = await newBuyer('v12-webhook-avis');
        const payment = await pendingPayment(buyer, ev, 2);
        const { error } = await service.rpc('payment_release', { p_payment_id: payment.id, p_status: 'FAILED', p_reason: 'PROVIDER_FAILED' });
        assert.equal(error, null, `libération : ${error?.message}`);
        const sold = await pendingPayment(await newBuyer('v12-webhook-avis-autre'), ev, 2);
        providerSays(sold, 'SUCCESS');
        assert.equal((await deliverWebhook(sold)).status, 200, 'précondition : places revendues');
        providerSays(payment, 'SUCCESS');
        assert.equal((await deliverWebhook(payment)).status, 200, 'webhook de succès accepté');
        assert.deepEqual(await refundStartedChannels(buyer), ['EMAIL', 'IN_APP', 'PUSH', 'SMS'], 'PAYMENT_REFUND_STARTED (R30, tâche 6 ; aujourd’hui aucun avis avant le versement)');
    });

    test('H1-d : témoin : FAILED lu 2 h 05 après la création → définitif (provider_final), plus aucun contrôle de statut', async () => {
        const ev = await createSaleEvent('v12-tardif-final', [{ name: 'Standard', price: 2_000, total: 10 }]);
        const { payment } = await failedByStatus('tardif-final', ev, 125);
        assert.equal((await paymentById(payment.id)).provider_final, true, 'au-delà de 2 h : FAILED définitif');
        providerSays(payment, 'SUCCESS');
        await allowRecheck(payment);
        const checks = statusChecks(payment);
        await runCron();
        assert.equal(statusChecks(payment), checks, 'aucun nouveau contrôle de statut au-delà de 2 h');
        assert.equal((await paymentById(payment.id)).status, 'FAILED', 'paiement toujours FAILED');
    });
});

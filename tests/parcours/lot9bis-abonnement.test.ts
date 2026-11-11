/**
 * Lot 9 bis, tâche 8 (R8 ; contrat 5.8, B25, 4.1) — abonnement d'un partenaire :
 *  - un paiement d'abonnement confirmé applique le plan (subscription_plan_id, échéance) sans jamais écrire le statut
 *    du dossier : un dossier passé REJETE entre la création et le succès reste REJETE (D13 : plan appliqué, statut
 *    intact) ;
 *  - la création d'un paiement d'abonnement est refusée hors dossier VALIDE : POST /api/payments/create SUBSCRIPTION
 *    → 403 PARTNER_NOT_VALIDATED « Abonnement réservé aux comptes partenaires validés. », aucun paiement créé.
 *
 * Rouge avant correctif : activateSubscription écrit `status: 'VALIDE'` (lib/payments/confirmation.service.ts:116) ;
 * la création lit la fiche sans son statut (lib/payments/payment.service.ts:139-164) et rend 201.
 * Le dossier VALIDE est remis EN_ATTENTE par le service avant d'être refusé par partner_status_set (B37 : seul un
 * dossier en attente se refuse), comme partenaire-lot7.test.ts:234.
 * Fin de suite : assertLot9bisInvariants.
 */
import '../helpers/env';
import { after, before, describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { POST as createPaymentRoute } from '../../app/api/payments/create/route';
import { assertLot9bisInvariants } from '../helpers/lot9bis-invariants';
import { deliverWebhook, paymentById, providerSays, service, type PaymentRow } from './paiement-helpers';
import { jsonRequest, newPartner, superadminId, type TestPartner } from './finance-helpers';

after(async () => {
    await assertLot9bisInvariants('lot9bis-abonnement');
});

type Row = Record<string, unknown>;

const PLAN_PRICE = 15_000;
const NOT_VALIDATED_TEXT = 'Abonnement réservé aux comptes partenaires validés.';

let planId: string;

before(async () => {
    const { data, error } = await service.from('subscription_plans').insert({
        code: `TEST-9BIS-${randomUUID()}`, name: 'Pack de test (lot 9 bis)', description: 'Plan dédié aux tests de l’abonnement (R8).',
        price: PLAN_PRICE, billing_period: 'MONTHLY', features: {}, is_active: true,
    }).select('id').single();
    assert.equal(error, null, `plan d'abonnement : ${error?.message}`);
    planId = String(data.id);
});

// ── Outils locaux ──────────────────────────────────────────────────────────

interface Reply { status: number; body: Row }

async function createSubscriptionPayment(partner: TestPartner): Promise<Reply> {
    const res = await createPaymentRoute(jsonRequest('/api/payments/create', 'POST', partner.accessToken, {
        targetType: 'SUBSCRIPTION', targetId: planId, operator: 'WAVE', payerPhone: partner.phone9,
    }));
    return { status: res.status, body: (await res.json()) as Row };
}

async function partnerRow(partnerId: string): Promise<Row> {
    const { data, error } = await service.from('partners')
        .select('status, is_verified, rejection_reason, subscription_plan_id, trial_ends_at').eq('id', partnerId).single();
    assert.equal(error, null, `fiche partenaire ${partnerId} : ${error?.message}`);
    return data as Row;
}

/** Dossier VALIDE remis EN_ATTENTE (service, B37), puis refusé par partner_status_set (SUPERADMIN du seed). */
async function rejectPartner(partner: TestPartner, reason: string): Promise<void> {
    const { error: upErr } = await service.from('partners').update({ status: 'EN_ATTENTE', is_verified: false }).eq('id', partner.partnerId);
    assert.equal(upErr, null, `dossier remis EN_ATTENTE : ${upErr?.message}`);
    const { data, error } = await service.rpc('partner_status_set', { p: { partner_id: partner.partnerId, actor_id: await superadminId(), status: 'REJETE', reason } });
    assert.equal(error, null, `partner_status_set REJETE : ${error?.message}`);
    assert.equal((data as Row | null)?.ok, true, `refus du dossier : ${JSON.stringify(data)}`);
    assert.equal((await partnerRow(partner.partnerId)).status, 'REJETE', 'dossier refusé');
}

async function subscriptionPaymentsOf(userId: string): Promise<PaymentRow[]> {
    const { data, error } = await service.from('payments').select('*').eq('client_id', userId).eq('payment_target', 'SUBSCRIPTION');
    assert.equal(error, null, `paiements d'abonnement de ${userId} : ${error?.message}`);
    return (data ?? []) as PaymentRow[];
}

/** Paiement créé à tort (rouge d'aujourd'hui) : annulé pour ne rien laisser en attente aux suites suivantes. */
async function cancelPending(paymentId: unknown): Promise<void> {
    if (typeof paymentId !== 'string') return;
    const { error } = await service.rpc('payment_release', { p_payment_id: paymentId, p_status: 'CANCELLED', p_reason: 'TEST_LOT9BIS' });
    assert.equal(error, null, `annulation du paiement créé à tort : ${error?.message}`);
}

// ── Cas ────────────────────────────────────────────────────────────────────

describe('R8 — abonnement : le paiement n’écrit jamais le statut du dossier', () => {
    test('R8 reproduit (statut) : paiement créé par une partenaire VALIDE, dossier refusé avant le succès → plan appliqué, statut REJETE intact', async () => {
        const partner = await newPartner('abo-statut');
        const created = await createSubscriptionPayment(partner);
        assert.equal(created.status, 201, `paiement d'abonnement d'une partenaire validée : HTTP ${created.status} ${JSON.stringify(created.body)}`);
        const pending = await paymentById(String(created.body.payment_id));
        assert.equal(pending.payment_target, 'SUBSCRIPTION');
        assert.equal(pending.status, 'PENDING');

        await rejectPartner(partner, 'Dossier refusé pendant le paiement de l’abonnement (test du lot 9 bis)');

        providerSays(pending, 'SUCCESS');
        const hook = await deliverWebhook(pending);
        assert.equal(hook.status, 200, 'webhook accepté');
        assert.equal((await paymentById(pending.id)).status, 'SUCCESS', 'paiement confirmé');

        const after1 = await partnerRow(partner.partnerId);
        assert.equal(after1.subscription_plan_id, planId, 'plan appliqué (D13)');
        assert.ok(after1.trial_ends_at, 'échéance de l’abonnement posée');
        assert.equal(after1.status, 'REJETE', `R8 : le paiement de l'abonnement a remis le dossier refusé VALIDE : ${JSON.stringify(after1)}`);
        assert.equal(after1.is_verified, false, 'dossier toujours non vérifié');
        assert.equal(after1.rejection_reason, 'Dossier refusé pendant le paiement de l’abonnement (test du lot 9 bis)', 'motif du refus gardé');
    });

    test('R8 reproduit (création) : partenaire REJETE, POST /api/payments/create SUBSCRIPTION → 403 PARTNER_NOT_VALIDATED, aucun paiement', async () => {
        const partner = await newPartner('abo-refuse');
        await rejectPartner(partner, 'Dossier refusé avant l’abonnement (test du lot 9 bis)');
        const before0 = (await subscriptionPaymentsOf(partner.userId)).length;
        assert.equal(before0, 0, 'aucun paiement d’abonnement avant la demande');

        const res = await createSubscriptionPayment(partner);
        if (res.status === 201) await cancelPending(res.body.payment_id);
        assert.equal(res.status, 403, `R8 : abonnement acheté par un dossier refusé : HTTP ${res.status} ${JSON.stringify(res.body)}`);
        assert.equal(res.body.code, 'PARTNER_NOT_VALIDATED', JSON.stringify(res.body));
        assert.equal(res.body.error, NOT_VALIDATED_TEXT, `texte du refus (contrat 4.1) : ${JSON.stringify(res.body)}`);
        assert.deepEqual((await subscriptionPaymentsOf(partner.userId)).map((p) => p.id), [], 'aucun paiement d’abonnement créé');
        assert.equal((await partnerRow(partner.partnerId)).status, 'REJETE', 'dossier inchangé');
    });
});

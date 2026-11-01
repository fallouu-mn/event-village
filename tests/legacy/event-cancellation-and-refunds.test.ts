import { test } from 'node:test';
import assert from 'node:assert';
import { EventCancellationService } from '../../lib/events/event-cancellation.service';
import { TicketTransferService } from '../../lib/tickets/ticket-transfer.service';
import { isEventEligibleForController, getEventEligibilityRejectionReason } from '../../lib/events/event-status';
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Chargement de l'environnement local
// [lot 0] Chargement de .env.local supprimé : l'environnement de test (.env.test, instance Supabase locale)
// et le garde-fou anti-base réelle sont fournis par tests/helpers/env.ts.
import '../helpers/env';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const partnerAUserId = 'e706a7a2-502c-4396-9e91-4dc6720388f7';
const partnerBUserId = '775818bd-1833-4e99-843d-3f5ecf8196e3';
const clientAUserId = 'a7345050-03cf-4967-9281-9ee5eb75615a';

// [lot 5 — cas supprimé] 1. Annulation partenaire et verrouillage atomique : EventCancellationService.cancelEvent(eventId, userId, role, motif, avis) remplacé par l’annulation transactionnelle (RPC event_cancel, titre retapé et avis public obligatoires, contrat D6) ; couvert par tests/parcours/cycle-annulation.test.ts (annulation transactionnelle par la route partenaire)

// [lot 5 — cas supprimé] 2. Sécurité RBAC et isolation multi-tenant : EventCancellationService.cancelEvent(eventId, userId, role, motif, avis) remplacé par l’annulation transactionnelle (RPC event_cancel, titre retapé et avis public obligatoires, contrat D6) ; couvert par tests/parcours/cycle-annulation.test.ts (lecture réservée, A6) et tests/parcours/cycle-transitions.test.ts (partenaire B refusé)

// [lot 5 — cas supprimé] 3. Concurrence sur l’annulation : EventCancellationService.cancelEvent(eventId, userId, role, motif, avis) remplacé par l’annulation transactionnelle (RPC event_cancel, titre retapé et avis public obligatoires, contrat D6) ; couvert par tests/parcours/cycle-annulation.test.ts (deux annulations simultanées, UNIQUE(event_id))

// [lot 5 — cas supprimé] 4. Remboursement Mobile Money et idempotence : EventCancellationService.cancelEvent(eventId, userId, role, motif, avis) remplacé par l’annulation transactionnelle (RPC event_cancel, titre retapé et avis public obligatoires, contrat D6) ; couvert par tests/parcours/cycle-annulation.test.ts (REFUND-<paymentId>, un remboursement par paiement) et tests/parcours/finance-annulation.test.ts

test('5. RETRY REMBOURSEMENT ADMINISTRATEUR & VERROU DE CONCURRENCE CAS : Relance sécurisée', async () => {
    if (!supabaseUrl || !serviceRoleKey) return;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: partnerA } = await adminClient.from('partners').select('id').eq('user_id', partnerAUserId).single();
    assert.ok(partnerA?.id);

    const suffix = Date.now().toString().slice(-6);

    const pmtTxId = `TX-FAIL-${suffix}`;
    const { data: payment, error: pmtErr } = await adminClient
        .from('payments')
        .insert({
            transaction_id: pmtTxId,
            client_id: clientAUserId,
            partner_id: partnerA.id,
            payment_target: 'TICKET',
            amount: 10000,
            currency: 'XOF',
            payment_method: 'ORANGE_MONEY',
            is_platform_payment: true,
            status: 'SUCCESS',
            metadata: {
                customer_phone: '+221779998877',
                customer_name: 'Moussa Diop',
                operator: 'ORANGE_MONEY',
            },
        })
        .select('*')
        .single();

    assert.ifError(pmtErr);
    assert.ok(payment?.id);

    const refundTxId = `REFUND-PMT-${payment.id}`;
    const { data: failedRefund, error: refErr } = await adminClient
        .from('refunds')
        .insert({
            payment_id: payment.id,
            refund_transaction_id: refundTxId,
            amount: 10000,
            reason: 'Test retry cashout (Réseau indisponible)',
            status: 'FAILED',
        })
        .select('*')
        .single();

    assert.ifError(refErr);
    assert.ok(failedRefund?.id);

    try {
        const retryResult = await EventCancellationService.retryRefund(
            failedRefund.id,
            partnerAUserId
        );

        assert.ok(retryResult.refundId === failedRefund.id);
        assert.ok(['PROCESSED', 'FAILED'].includes(retryResult.status));

        const { data: dbRefund } = await adminClient
            .from('refunds')
            .select('status')
            .eq('id', failedRefund.id)
            .single();

        assert.ok(['PROCESSED', 'FAILED'].includes(dbRefund?.status || ''));
    } finally {
        await adminClient.from('refunds').delete().eq('id', failedRefund.id);
        await adminClient.from('payments').delete().eq('id', payment.id);
    }
});

// [lot 5 — cas supprimé] 6. Révocation des transferts P2P et rejet de réclamation après annulation : EventCancellationService.cancelEvent(eventId, userId, role, motif, avis) remplacé par l’annulation transactionnelle (RPC event_cancel, titre retapé et avis public obligatoires, contrat D6) ; non couvert : la révocation des transferts en attente est écrite dans event_cancel (migration 20261102000003), sans test dédié (point ouvert)

test('7. RÈGLES MÉTIER SCANNER : Le statut ANNULE bloque immédiatement les contrôles d\'accès', async () => {
    assert.strictEqual(isEventEligibleForController('ANNULE'), false);
    assert.strictEqual(isEventEligibleForController('annule'), false);
    assert.strictEqual(isEventEligibleForController('PUBLIE'), true);
    assert.strictEqual(isEventEligibleForController('VALIDE'), true);

    const rejectionReason = getEventEligibilityRejectionReason('ANNULE');
    assert.strictEqual(rejectionReason, "L'événement a été annulé.");
});

// [lot 2 — cas supprimé] 8. Achat bloqué sur événement annulé : le refus reposait sur EventService.reserveTicketsAtomic, supprimé (contrôles du checkout avant la RPC checkout_create_payment) ; couvert par tests/parcours/paiement-controles.test.ts (événement non publié → 400 : même branche status <> 'PUBLIE', testée sur un brouillon)
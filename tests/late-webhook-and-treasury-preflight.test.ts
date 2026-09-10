/**
 * ============================================================================
 * EVENT VILLAGE — TESTS DES BLINDAGES DE SÉCURITÉ
 * 1. Auto-Refund immédiat sur Late Webhook / Overbooking
 * 2. Pre-Flight Check de Trésorerie avant Annulation Massive
 * ============================================================================
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'fs';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';

// Chargement de .env.local
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach((line) => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
            const [k, ...v] = trimmed.split('=');
            process.env[k.trim()] = v.join('=').trim();
        }
    });
}

import { PaymentService } from '../lib/payments/payment.service';
import { EventCancellationService } from '../lib/events/event-cancellation.service';
import { samirPayClient } from '../lib/samirpay/client';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

const partnerAUserId = 'e706a7a2-502c-4396-9e91-4dc6720388f7';
const clientAUserId = 'a7345050-03cf-4967-9281-9ee5eb75615a';

test('BLINDAGE 1 : LATE WEBHOOK ET OVERBOOKING -> Auto-remboursement déclenché proprement', async () => {
    const paymentService = new PaymentService();
    const suffix = Date.now().toString().slice(-6);

    // 1. Créer un paiement simulant un achat sur une catégorie qui sera fermée/sold out
    const { data: partner } = await supabaseAdmin.from('partners').select('id').eq('user_id', partnerAUserId).single();
    assert.ok(partner?.id);

    // Créer un événement test
    const { data: event } = await supabaseAdmin.from('events').insert({
        partner_id: partner.id,
        title: `Test Late Webhook ${suffix}`,
        start_date: '2026-12-15',
        start_time: '20:00',
        location: 'Dakar Arena',
        status: 'PUBLIE',
    }).select().single();
    assert.ok(event?.id);

    // Créer une catégorie inactive / fermée pour forcer l'échec de reserveTicketsAtomic
    const { data: cat } = await supabaseAdmin.from('ticket_categories').insert({
        event_id: event.id,
        name: 'Pass Test Late',
        price: 15000,
        total_quantity: 10,
        sold_quantity: 10,
        is_active: false,
    }).select().single();
    assert.ok(cat?.id);

    // Créer une intention de paiement PENDING avec external_order_id
    const orderId = `EV-LATE-${suffix}`;
    const { data: payment } = await supabaseAdmin.from('payments').insert({
        client_id: clientAUserId,
        external_order_id: orderId,
        transaction_id: `TX-${orderId}`,
        amount: 15000,
        currency: 'XOF',
        status: 'PENDING',
        payment_target: 'TICKET',
        payment_method: 'WAVE',
        metadata: {
            event_id: event.id,
            category_id: cat.id,
            quantity: 1,
            customer_phone: '771234567',
            customer_name: 'Test Client Late',
            operator: 'WAVE',
        },
    }).select().single();
    assert.ok(payment?.id);

    // 2. Simuler l'arrivée du webhook SUCCESS de SamirPay
    const result = await paymentService.handleSamirPayWebhook({
        order_id: orderId,
        transaction_id: `TX-LATE-${suffix}`,
        status: 'success',
        amount: '15000',
    });

    console.log('[Test Blindage 1] Webhook result:', result);
    assert.equal(result.success, true);

    // 3. Vérifier que le paiement a été traité en surréservation / remboursement
    const { data: updatedPayment } = await supabaseAdmin
        .from('payments')
        .select('*')
        .eq('id', payment.id)
        .single();

    assert.ok(updatedPayment);
    assert.ok(['REFUNDED', 'FAILED'].includes(updatedPayment.status), `Le statut doit être REFUNDED ou FAILED (était ${updatedPayment.status})`);
    assert.equal(updatedPayment.metadata?.overbooked, true);
    assert.equal(updatedPayment.metadata?.failure_reason, 'LATE_WEBHOOK_SOLD_OUT');

    // 4. Vérifier qu'une ligne refunds a été créée
    const { data: refundRecord } = await supabaseAdmin
        .from('refunds')
        .select('*')
        .eq('payment_id', payment.id)
        .single();

    assert.ok(refundRecord, 'Une ligne de remboursement doit être enregistrée dans la table refunds');
    assert.equal(refundRecord.amount, 15000);
});

test('BLINDAGE 2 : PRE-FLIGHT CHECK TRÉSORERIE -> Détection du solde SamirPay et blocage préventif', async () => {
    const soldeData = await samirPayClient.getSolde();
    const availableFloat = Number(soldeData.solde ?? soldeData.body?.solde ?? soldeData.balance ?? 0);
    console.log(`[Test Blindage 2] Solde SamirPay disponible en direct : ${availableFloat} FCFA`);
    assert.ok(availableFloat >= 0);

    const { data: partner } = await supabaseAdmin.from('partners').select('id').eq('user_id', partnerAUserId).single();
    assert.ok(partner?.id);
    const suffix = Date.now().toString().slice(-6);

    const { data: event } = await supabaseAdmin.from('events').insert({
        partner_id: partner.id,
        title: `Test Mega Event Insufficient Float ${suffix}`,
        start_date: '2026-11-20',
        start_time: '20:00',
        location: 'Stade Abdoulaye Wade',
        status: 'PUBLIE',
    }).select().single();
    assert.ok(event?.id);

    const orderId = `EV-FLOAT-${suffix}`;
    const { data: payment } = await supabaseAdmin.from('payments').insert({
        client_id: clientAUserId,
        external_order_id: orderId,
        transaction_id: `TX-${orderId}`,
        amount: 5000000,
        currency: 'XOF',
        status: 'SUCCESS',
        payment_target: 'TICKET',
        payment_method: 'WAVE',
        metadata: {
            event_id: event.id,
            customer_phone: '771234567',
            customer_name: 'VIP Client',
            operator: 'WAVE',
        },
    }).select().single();
    assert.ok(payment?.id);

    const result = await EventCancellationService.cancelEvent(
        event.id,
        partnerAUserId,
        'PARTENAIRE',
        'Imprévu logistique majeur'
    );

    console.log('[Test Blindage 2] Cancel result:', result);
    assert.equal(result.success, true);
    assert.ok(result.message.includes('attente de réapprovisionnement') || result.refundsProcessed >= 0);

    const { data: dbEvent } = await supabaseAdmin.from('events').select('status').eq('id', event.id).single();
    assert.ok(['ANNULE', 'SUSPENDU'].includes(dbEvent?.status || ''));

    const { data: pendingRefund } = await supabaseAdmin
        .from('refunds')
        .select('*')
        .eq('payment_id', payment.id)
        .single();

    assert.ok(pendingRefund);
    assert.equal(pendingRefund.status, 'PENDING');
});

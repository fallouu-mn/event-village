import { test } from 'node:test';
import assert from 'node:assert';
import { FinancialCalculatorService } from '../lib/payments/financial-calculator.service';
import { paymentService } from '../lib/payments/payment.service';
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Chargement des variables d'environnement locales
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
            const [k, ...v] = trimmed.split('=');
            process.env[k.trim()] = v.join('=').trim();
        }
    });
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

test('1. FORMULE FINANCIÈRE CDC ANNEXE C : Répartition Billetterie au centime près', () => {
    const breakdown = FinancialCalculatorService.calculateTicketingFinancials({
        ticketFacialPrice: 1000,
        serviceFeeRatePercent: 5.0,
        aggregatorFeeRatePercent: 1.5,
    });

    assert.strictEqual(breakdown.ticketFacialPrice, 1000, 'Prix facial du billet = 1 000 FCFA');
    assert.strictEqual(breakdown.serviceFeeAmount, 50.00, 'Frais de service (5%) = 50.00 FCFA');
    assert.strictEqual(breakdown.buyerTotalPaid, 1050.00, 'Total payé par l\'acheteur = 1 050.00 FCFA');
    assert.strictEqual(breakdown.aggregatorFeeAmount, 15.75, 'Frais agrégateur (1.5% sur 1050) = 15.75 FCFA');
    assert.strictEqual(breakdown.partnerPayout, 1000.00, 'Organisateur perçoit 1 000.00 FCFA plein');
    assert.strictEqual(breakdown.platformNetRetained, 34.25, 'Event Village conserve 34.25 FCFA nets');

    const sum = Number((breakdown.partnerPayout + breakdown.aggregatorFeeAmount + breakdown.platformNetRetained).toFixed(2));
    assert.strictEqual(sum, breakdown.buyerTotalPaid, 'Invariant Total Encaissé = Répartition complète');
});

test('2. COMMISSION COMMANDE & VENTE §114 : Taux configurable en base (Zéro taux en dur)', () => {
    const breakdown5 = FinancialCalculatorService.calculateOrderFinancials({
        orderTotalAmount: 20000,
        commissionRatePercent: 5.0,
        aggregatorFeeRatePercent: 1.5,
    });
    assert.strictEqual(breakdown5.platformCommissionAmount, 1000.00);
    assert.strictEqual(breakdown5.partnerPayout, 19000.00);
    assert.strictEqual(breakdown5.aggregatorFeeAmount, 300.00);
    assert.strictEqual(breakdown5.platformNetRetained, 700.00);

    const breakdown8 = FinancialCalculatorService.calculateOrderFinancials({
        orderTotalAmount: 20000,
        commissionRatePercent: 8.0,
        aggregatorFeeRatePercent: 1.5,
    });
    assert.strictEqual(breakdown8.platformCommissionAmount, 1600.00);
    assert.strictEqual(breakdown8.partnerPayout, 18400.00);
});

test('3. VRAI TEST D\'INTÉGRATION RLS MULTI-TENANT : Partner A avec son token ne peut PAS lire la ressource privée de Partner B', async () => {
    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
        console.warn('Variables Supabase manquantes pour le test RLS, skip DB connect.');
        return;
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const partnerAUserId = 'e706a7a2-502c-4396-9e91-4dc6720388f7';
    const partnerAId = 'a917b7ac-d542-4c2b-b5d8-ab38f866b2e7';
    const partnerBId = '9cdc4247-d1fe-483b-b5e2-12671b069134';

    const { data: pAUser } = await adminClient.from('users').select('email').eq('id', partnerAUserId).single();
    const testEmailA = pAUser?.email || 'fallouu.dev@gmail.com';
    const testPassword = 'Password123!';

    await adminClient.auth.admin.updateUserById(partnerAUserId, { password: testPassword });

    // Création d'un événement BROUILLON (privé) pour Partner B et d'un événement pour Partner A
    const { data: eventB, error: eErrB } = await adminClient.from('events').insert({
        partner_id: partnerBId,
        title: 'Événement Privé Brouillon Partner B',
        slug: `event-b-rls-${Date.now()}`,
        status: 'BROUILLON', // Non publié -> protégé par RLS
        start_date: '2026-12-31',
        start_time: '20:00',
        location: 'Dakar Arena',
    }).select('id').single();
    assert.ok(!eErrB && eventB?.id, `Event B créé: ${eErrB?.message}`);

    const { data: eventA, error: eErrA } = await adminClient.from('events').insert({
        partner_id: partnerAId,
        title: 'Événement Privé Brouillon Partner A',
        slug: `event-a-rls-${Date.now()}`,
        status: 'BROUILLON',
        start_date: '2026-12-31',
        start_time: '20:00',
        location: 'Grand Théâtre',
    }).select('id').single();
    assert.ok(!eErrA && eventA?.id, `Event A créé: ${eErrA?.message}`);

    try {
        // Authentification de Partner A avec son client dédié (ANON KEY + Session JWT de Partner A)
        const userClientA = createClient(supabaseUrl, anonKey);
        const { data: sessionA, error: loginErr } = await userClientA.auth.signInWithPassword({
            email: testEmailA,
            password: testPassword,
        });
        assert.ok(!loginErr && sessionA?.session, `Connexion réussie de Partner A: ${loginErr?.message}`);

        // Test 1 : Partner A tente de lire l'événement privé de Partner B via RLS
        const { data: crossTenantEvents, error: crossErr } = await userClientA
            .from('events')
            .select('id, title')
            .eq('id', eventB.id);

        assert.ok(!crossErr, 'La requête SELECT s\'exécute sans crash');
        assert.strictEqual(
            crossTenantEvents?.length || 0,
            0,
            'VIOLATION RLS : Partner A a pu lire l\'événement privé de Partner B ! (Le résultat doit être strictement 0 ligne)'
        );

        // Test 2 : Preuve inverse — Partner A accède avec succès à son propre événement privé
        const { data: ownEvents, error: ownErr } = await userClientA
            .from('events')
            .select('id, title')
            .eq('id', eventA.id);

        assert.ok(!ownErr, 'La requête propre à Partner A s\'exécute');
        assert.strictEqual(ownEvents?.length, 1, 'Partner A doit lire son propre événement');
        assert.strictEqual(ownEvents?.[0]?.id, eventA.id, 'L\'ID de l\'événement correspond');
    } finally {
        await adminClient.from('events').delete().in('id', [eventA?.id, eventB?.id].filter(Boolean));
    }
});

test('4. VRAI CONTRÔLE BACKEND PRODUIT INTERDIT : Refus de paiement et aucune ligne créée en base', async () => {
    if (!supabaseUrl || !serviceRoleKey) return;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const partnerAUserId = 'e706a7a2-502c-4396-9e91-4dc6720388f7';
    const partnerAId = 'a917b7ac-d542-4c2b-b5d8-ab38f866b2e7';
    const uniqueSuffix = Date.now().toString().slice(-6);

    // Création d'un produit avec status 'SUSPENDU'
    const { data: prohibitedProduct, error: pErr } = await adminClient.from('products').insert({
        partner_id: partnerAId,
        name: 'Produit Réglementé Interdit Test',
        price: 5000,
        status: 'SUSPENDU',
    }).select('id').single();
    assert.ok(!pErr && prohibitedProduct?.id, `Produit créé: ${pErr?.message}`);

    // Création d'une commande
    const orderNumber = `EV-ORD-TEST-${uniqueSuffix}`;
    const { data: order, error: oErr } = await adminClient.from('orders').insert({
        order_number: orderNumber,
        client_id: partnerAUserId,
        partner_id: partnerAId,
        subtotal: 5000,
        total_amount: 5000,
        delivery_mode: 'RETRAIT',
        order_status: 'EN_ATTENTE',
        payment_status: 'PENDING',
    }).select('id').single();
    assert.ok(!oErr && order?.id, `Commande créée: ${oErr?.message}`);

    // Création de la ligne order_item liée au produit SUSPENDU
    await adminClient.from('order_items').insert({
        order_id: order!.id,
        product_id: prohibitedProduct!.id,
        product_name: 'Produit Réglementé Interdit Test',
        quantity: 1,
        unit_price: 5000,
        total_price: 5000,
    });

    try {
        let threwError = false;
        let errorMessage = '';

        try {
            await paymentService.createPayment(partnerAUserId, {
                targetType: 'ORDER',
                targetId: order!.id,
                operator: 'WAVE',
                customerPhone: '+221770000000',
            });
        } catch (err: any) {
            threwError = true;
            errorMessage = err.message || '';
        }

        assert.strictEqual(threwError, true, 'createPayment doit lever une exception pour un produit interdit/suspendu');
        assert.match(errorMessage, /suspendu|interdit|indisponible|impossible/i, 'Message d\'erreur explicite');

        // Vérification de la base de données : AUCUN paiement créé pour cette commande
        const { data: payments } = await adminClient
            .from('payments')
            .select('id')
            .eq('target_id', order!.id);

        assert.strictEqual(payments?.length || 0, 0, 'CRITIQUE : Zéro ligne de paiement créée en base pour un produit suspendu');
    } finally {
        if (order?.id) {
            await adminClient.from('order_items').delete().eq('order_id', order.id);
            await adminClient.from('orders').delete().eq('id', order.id);
        }
        if (prohibitedProduct?.id) {
            await adminClient.from('products').delete().eq('id', prohibitedProduct.id);
        }
    }
});

test('5. VRAIE EXPIRATION AUTOMATIQUE DES MORATOIRES EN BASE DE DONNÉES', async () => {
    if (!supabaseUrl || !serviceRoleKey) return;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const partnerAUserId = 'e706a7a2-502c-4396-9e91-4dc6720388f7';
    const partnerAId = 'a917b7ac-d542-4c2b-b5d8-ab38f866b2e7';

    const { data: hall, error: hErr } = await adminClient.from('halls').insert({
        partner_id: partnerAId,
        name: 'Grande Salle Moratoire Test',
        capacity: 100,
        price_per_day: 100000,
    }).select('id').single();

    assert.ok(!hErr && hall?.id, `Hall créé: ${hErr?.message}`);

    // Création d'une réservation avec date moratoire dans le passé (échue)
    const { data: reservation, error: rErr } = await adminClient.from('hall_reservations').insert({
        hall_id: hall!.id,
        partner_id: partnerAId,
        client_id: partnerAUserId,
        start_date: '2026-11-01',
        end_date: '2026-11-02',
        total_amount: 100000,
        deposit_amount: 30000,
        balance_amount: 70000,
        moratorium_date: '2020-01-01', // Date échue dans le passé
        status: 'EN_ATTENTE',
        payment_status: 'PENDING',
    }).select('id').single();

    assert.ok(!rErr && reservation?.id, `Réservation créée: ${rErr?.message}`);

    try {
        const result = await paymentService.expireOverdueMoratoriums();
        assert.ok(result.expiredCount >= 1, 'Au moins un moratoire doit être expiré');
        assert.ok(result.reservationIds.includes(reservation!.id), 'Notre réservation de test doit être dans la liste des expirées');

        // Re-lecture réelle en base de données de la réservation
        const { data: updatedRes, error: fetchErr } = await adminClient
            .from('hall_reservations')
            .select('status, payment_status')
            .eq('id', reservation!.id)
            .single();

        assert.ok(!fetchErr && updatedRes, 'Relecture de la réservation');
        assert.strictEqual(updatedRes.status, 'ANNULEE', 'Le statut en base doit être passé à ANNULEE');
        assert.strictEqual(updatedRes.payment_status, 'CANCELLED', 'Le payment_status en base doit être passé à CANCELLED');
    } finally {
        if (reservation?.id) await adminClient.from('hall_reservations').delete().eq('id', reservation.id);
        if (hall?.id) await adminClient.from('halls').delete().eq('id', hall.id);
    }
});

test('6. VRAI REMBOURSEMENT & INVARIANT EN BASE DE DONNÉES (Total − Payé = Solde)', async () => {
    if (!supabaseUrl || !serviceRoleKey) return;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const partnerAUserId = 'e706a7a2-502c-4396-9e91-4dc6720388f7';
    const partnerAId = 'a917b7ac-d542-4c2b-b5d8-ab38f866b2e7';
    const uniqueSuffix = Date.now().toString().slice(-6);

    const clientId = partnerAUserId;

    // 1. Commande de 80 000 FCFA payée en totalité
    const orderNumber = `EV-ORD-REFUND-${uniqueSuffix}`;
    const { data: order, error: oErr } = await adminClient.from('orders').insert({
        order_number: orderNumber,
        client_id: clientId,
        partner_id: partnerAId,
        subtotal: 80000,
        total_amount: 80000,
        paid_amount: 80000,
        balance_amount: 0,
        delivery_mode: 'RETRAIT',
        order_status: 'CONFIRMEE',
        payment_status: 'SUCCESS',
    }).select('id').single();
    assert.ok(!oErr && order?.id, `Création commande Test 6: ${oErr?.message}`);

    // 2. Transaction de paiement SUCCESS
    const txId = `EV-TX-REFUND-${uniqueSuffix}`;
    const { data: payment, error: pErr } = await adminClient.from('payments').insert({
        transaction_id: txId,
        client_id: clientId,
        partner_id: partnerAId,
        order_id: order.id,
        amount: 80000,
        status: 'SUCCESS',
        payment_target: 'ORDER',
    }).select('id, order_id').single();
    assert.ok(!pErr && payment?.id, `Création paiement Test 6: ${pErr?.message}`);

    try {
        // 3. Exécution du remboursement partiel de 30 000 FCFA
        const refundResult = await paymentService.processRefund({
            paymentId: payment.id,
            refundAmount: 30000,
            reason: 'Test Remboursement Partiel CDC',
        });

        assert.strictEqual(refundResult.success, true);
        assert.strictEqual(refundResult.newPaidAmount, 50000);
        assert.strictEqual(refundResult.newBalanceAmount, 30000);

        // 4. Re-lecture réelle de la commande en base de données
        const { data: dbOrder, error: orderErr } = await adminClient
            .from('orders')
            .select('total_amount, paid_amount, balance_amount, payment_status')
            .eq('id', order.id)
            .single();

        assert.ok(!orderErr && dbOrder, 'Lecture de la commande en base');
        const dbTotal = Number(dbOrder.total_amount);
        const dbPaid = Number(dbOrder.paid_amount);
        const dbBalance = Number(dbOrder.balance_amount);

        assert.strictEqual(dbTotal, 80000, 'Total inchangé en base = 80 000 FCFA');
        assert.strictEqual(dbPaid, 50000, 'Nouveau Payé en base = 50 000 FCFA');
        assert.strictEqual(dbBalance, 30000, 'Nouveau Solde en base = 30 000 FCFA');
        assert.strictEqual(dbOrder.payment_status, 'PARTIAL', 'Statut = PARTIAL');
        assert.strictEqual(dbTotal - dbPaid, dbBalance, 'Invariant Total - Payé = Solde vérifié en base');
    } finally {
        await adminClient.from('refunds').delete().eq('payment_id', payment.id);
        await adminClient.from('payments').delete().eq('id', payment.id);
        await adminClient.from('orders').delete().eq('id', order.id);
    }
});

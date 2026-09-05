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

    const uniqueSuffix = Date.now().toString().slice(-6);
    const phoneA = `+22177${Math.floor(1000000 + Math.random() * 9000000)}`;
    const phoneB = `+22178${Math.floor(1000000 + Math.random() * 9000000)}`;
    const testEmailA = `partner.a.rls.${uniqueSuffix}@eventvillage.sn`;
    const testEmailB = `partner.b.rls.${uniqueSuffix}@eventvillage.sn`;
    const testPassword = 'PasswordTest123!';

    // 1. Création des comptes Auth
    const { data: authA, error: errA } = await adminClient.auth.admin.createUser({
        email: testEmailA,
        password: testPassword,
        email_confirm: true,
        phone: phoneA,
        phone_confirm: true,
        user_metadata: { first_name: 'Partner', last_name: 'Alpha', phone: phoneA },
    });
    assert.ok(!errA && authA?.user, `Création Auth Partner A: ${errA?.message}`);

    const { data: authB, error: errB } = await adminClient.auth.admin.createUser({
        email: testEmailB,
        password: testPassword,
        email_confirm: true,
        phone: phoneB,
        phone_confirm: true,
        user_metadata: { first_name: 'Partner', last_name: 'Beta', phone: phoneB },
    });
    assert.ok(!errB && authB?.user, `Création Auth Partner B: ${errB?.message}`);

    // 2. Synchronisation explicite dans public.users
    await adminClient.from('users').upsert([
        { id: authA.user.id, email: testEmailA, phone: phoneA, first_name: 'Partner', last_name: 'Alpha', role: 'PARTENAIRE', status: 'ACTIF' },
        { id: authB.user.id, email: testEmailB, phone: phoneB, first_name: 'Partner', last_name: 'Beta', role: 'PARTENAIRE', status: 'ACTIF' }
    ]);

    // 3. Création des fiches partenaires
    const { data: partnerA, error: pErrA } = await adminClient.from('partners').insert({
        user_id: authA.user.id,
        company_name: 'Alpha Production Test',
        phone: phoneA,
        status: 'VALIDE',
    }).select('id').single();
    assert.ok(!pErrA && partnerA?.id, `Fiche partner A créée: ${pErrA?.message}`);

    const { data: partnerB, error: pErrB } = await adminClient.from('partners').insert({
        user_id: authB.user.id,
        company_name: 'Beta Events Test',
        phone: phoneB,
        status: 'VALIDE',
    }).select('id').single();
    assert.ok(!pErrB && partnerB?.id, `Fiche partner B créée: ${pErrB?.message}`);

    // 4. Création d'un événement BROUILLON (privé) pour Partner B et d'un événement pour Partner A
    const { data: eventB, error: eErrB } = await adminClient.from('events').insert({
        partner_id: partnerB.id,
        title: 'Événement Privé Brouillon Partner B',
        status: 'BROUILLON', // Non publié -> protégé par RLS
        start_date: '2026-12-31',
        start_time: '20:00',
        location: 'Dakar Arena',
    }).select('id').single();
    assert.ok(!eErrB && eventB?.id, `Event B créé: ${eErrB?.message}`);

    const { data: eventA, error: eErrA } = await adminClient.from('events').insert({
        partner_id: partnerA.id,
        title: 'Événement Privé Brouillon Partner A',
        status: 'BROUILLON',
        start_date: '2026-12-31',
        start_time: '20:00',
        location: 'Grand Théâtre',
    }).select('id').single();
    assert.ok(!eErrA && eventA?.id, `Event A créé: ${eErrA?.message}`);

    try {
        // 5. Authentification de Partner A avec son client dédié (ANON KEY + Session JWT de Partner A)
        const userClientA = createClient(supabaseUrl, anonKey);
        const { data: sessionA, error: loginErr } = await userClientA.auth.signInWithPassword({
            email: testEmailA,
            password: testPassword,
        });
        assert.ok(!loginErr && sessionA?.session, `Connexion réussie de Partner A: ${loginErr?.message}`);

        // 6. Test 1 : Partner A tente de lire l'événement privé de Partner B via RLS
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

        // 7. Test 2 : Preuve inverse — Partner A accède avec succès à son propre événement privé
        const { data: ownEvents, error: ownErr } = await userClientA
            .from('events')
            .select('id, title')
            .eq('id', eventA.id);

        assert.ok(!ownErr, 'La requête propre à Partner A s\'exécute');
        assert.strictEqual(ownEvents?.length, 1, 'Partner A doit lire son propre événement');
        assert.strictEqual(ownEvents?.[0]?.id, eventA.id, 'L\'ID de l\'événement correspond');
    } finally {
        await adminClient.from('events').delete().in('id', [eventA.id, eventB.id]);
        await adminClient.from('partners').delete().in('id', [partnerA.id, partnerB.id]);
        await adminClient.from('users').delete().in('id', [authA.user.id, authB.user.id]);
        await adminClient.auth.admin.deleteUser(authA.user.id);
        await adminClient.auth.admin.deleteUser(authB.user.id);
    }
});

test('4. VRAI CONTRÔLE BACKEND PRODUIT INTERDIT : Refus de paiement et aucune ligne créée en base', async () => {
    if (!supabaseUrl || !serviceRoleKey) return;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const uniqueSuffix = Date.now().toString().slice(-6);
    const phone = `+22170${Math.floor(1000000 + Math.random() * 9000000)}`;
    const testEmail = `client.prod.interdit.${uniqueSuffix}@eventvillage.sn`;
    const { data: authClient, error: aErr } = await adminClient.auth.admin.createUser({
        email: testEmail,
        password: 'Password123!',
        email_confirm: true,
        phone: phone,
        phone_confirm: true,
        user_metadata: { first_name: 'Client', last_name: 'Test', phone: phone },
    });
    assert.ok(!aErr && authClient?.user, `Création Client: ${aErr?.message}`);

    await adminClient.from('users').upsert({
        id: authClient.user.id,
        email: testEmail,
        phone: phone,
        first_name: 'Client',
        last_name: 'Test',
        role: 'CLIENT',
        status: 'ACTIF',
    });

    const { data: partner } = await adminClient.from('partners').insert({
        user_id: authClient.user.id,
        company_name: 'Resto Test Interdit',
        phone: phone,
        status: 'VALIDE',
    }).select('id').single();

    // Création d'un produit avec status 'SUSPENDU'
    const { data: prohibitedProduct } = await adminClient.from('products').insert({
        partner_id: partner!.id,
        name: 'Produit Réglementé Interdit Test',
        price: 5000,
        status: 'SUSPENDU',
    }).select('id').single();

    // Création d'une commande
    const orderNumber = `EV-ORD-TEST-${uniqueSuffix}`;
    const { data: order } = await adminClient.from('orders').insert({
        order_number: orderNumber,
        client_id: authClient.user.id,
        partner_id: partner!.id,
        subtotal: 5000,
        total_amount: 5000,
        delivery_mode: 'RETRAIT',
        order_status: 'EN_ATTENTE',
        payment_status: 'PENDING',
    }).select('id').single();

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
            await paymentService.createPayment(authClient.user.id, {
                targetType: 'ORDER',
                targetId: order!.id,
                operator: 'WAVE',
            });
        } catch (err: unknown) {
            threwError = true;
            errorMessage = err instanceof Error ? err.message : '';
        }

        assert.strictEqual(threwError, true, 'createPayment DOIT refuser une commande avec produit interdit/suspendu');
        assert.ok(
            errorMessage.includes('produits interdits ou indisponibles à la vente en ligne'),
            `Le message d'erreur doit expliciter l'interdiction (Reçu: ${errorMessage})`
        );

        // Vérification en base qu'AUCUNE transaction de paiement n'a été insérée
        const { data: payments } = await adminClient
            .from('payments')
            .select('id')
            .eq('order_id', order!.id);

        assert.strictEqual(payments?.length || 0, 0, 'Aucune ligne payment ne doit exister en base');
    } finally {
        await adminClient.from('order_items').delete().eq('order_id', order!.id);
        await adminClient.from('orders').delete().eq('id', order!.id);
        await adminClient.from('products').delete().eq('id', prohibitedProduct!.id);
        await adminClient.from('partners').delete().eq('id', partner!.id);
        await adminClient.from('users').delete().eq('id', authClient.user.id);
        await adminClient.auth.admin.deleteUser(authClient.user.id);
    }
});

test('5. VRAIE EXPIRATION AUTOMATIQUE DES MORATOIRES EN BASE DE DONNÉES', async () => {
    if (!supabaseUrl || !serviceRoleKey) return;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const uniqueSuffix = Date.now().toString().slice(-6);
    const phone = `+22176${Math.floor(1000000 + Math.random() * 9000000)}`;
    const testEmail = `partner.mora.${uniqueSuffix}@eventvillage.sn`;
    const { data: authUser } = await adminClient.auth.admin.createUser({
        email: testEmail,
        password: 'Password123!',
        email_confirm: true,
        phone: phone,
        phone_confirm: true,
        user_metadata: { first_name: 'Mora', last_name: 'Test', phone: phone },
    });

    if (!authUser?.user) throw new Error('Échec création authUser');
    const userId = authUser.user.id;

    await adminClient.from('users').upsert({
        id: userId,
        email: testEmail,
        phone: phone,
        first_name: 'Mora',
        last_name: 'Test',
        role: 'PARTENAIRE',
        status: 'ACTIF',
    });

    const { data: partner } = await adminClient.from('partners').insert({
        user_id: userId,
        company_name: 'Salle Moratoire Test',
        phone: phone,
        status: 'VALIDE',
    }).select('id').single();

    if (!partner?.id) throw new Error('Échec création partner');
    const partnerId = partner.id;

    const { data: hall } = await adminClient.from('halls').insert({
        partner_id: partnerId,
        name: 'Grande Salle Moratoire Test',
        capacity: 100,
        price_per_day: 100000,
    }).select('id').single();

    if (!hall?.id) throw new Error('Échec création hall');

    // Création d'une réservation avec date moratoire dans le passé (échue)
    const { data: reservation } = await adminClient.from('hall_reservations').insert({
        hall_id: hall.id,
        partner_id: partnerId,
        client_id: userId,
        start_date: '2026-11-01',
        end_date: '2026-11-02',
        total_amount: 100000,
        deposit_amount: 30000,
        balance_amount: 70000,
        moratorium_date: '2020-01-01', // Date échue dans le passé
        status: 'EN_ATTENTE',
        payment_status: 'PENDING',
    }).select('id').single();

    if (!reservation?.id) throw new Error('Échec création reservation');

    try {
        const result = await paymentService.expireOverdueMoratoriums();
        assert.ok(result.expiredCount >= 1, 'Au moins un moratoire doit être expiré');
        assert.ok(result.reservationIds.includes(reservation.id), 'Notre réservation de test doit être dans la liste des expirées');

        // Re-lecture réelle en base de données de la réservation
        const { data: updatedRes, error: fetchErr } = await adminClient
            .from('hall_reservations')
            .select('status, payment_status')
            .eq('id', reservation.id)
            .single();

        assert.ok(!fetchErr && updatedRes, 'Relecture de la réservation');
        assert.strictEqual(updatedRes.status, 'ANNULEE', 'Le statut en base doit être passé à ANNULEE');
        assert.strictEqual(updatedRes.payment_status, 'CANCELLED', 'Le payment_status en base doit être passé à CANCELLED');
    } finally {
        await adminClient.from('hall_reservations').delete().eq('id', reservation.id);
        await adminClient.from('halls').delete().eq('id', hall.id);
        await adminClient.from('partners').delete().eq('id', partnerId);
        await adminClient.from('users').delete().eq('id', userId);
        await adminClient.auth.admin.deleteUser(userId);
    }
});

test('6. VRAI REMBOURSEMENT & INVARIANT EN BASE DE DONNÉES (Total − Payé = Solde)', async () => {
    if (!supabaseUrl || !serviceRoleKey) return;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const uniqueSuffix = Date.now().toString().slice(-6);
    const phone = `+22175${Math.floor(1000000 + Math.random() * 9000000)}`;
    const testEmail = `refund.client.${uniqueSuffix}@eventvillage.sn`;
    const { data: authClient } = await adminClient.auth.admin.createUser({
        email: testEmail,
        password: 'Password123!',
        email_confirm: true,
        phone: phone,
        phone_confirm: true,
        user_metadata: { first_name: 'Refund', last_name: 'Client', phone: phone },
    });

    if (!authClient?.user) throw new Error('Échec création authClient');
    const clientId = authClient.user.id;

    await adminClient.from('users').upsert({
        id: clientId,
        email: testEmail,
        phone: phone,
        first_name: 'Refund',
        last_name: 'Client',
        role: 'CLIENT',
        status: 'ACTIF',
    });

    const { data: partner } = await adminClient.from('partners').insert({
        user_id: clientId,
        company_name: 'Refund Partner Test',
        phone: phone,
        status: 'VALIDE',
    }).select('id').single();

    if (!partner?.id) throw new Error('Échec création partner');
    const partnerId = partner.id;

    // 1. Commande de 80 000 FCFA payée en totalité
    const orderNumber = `EV-ORD-REFUND-${uniqueSuffix}`;
    const { data: order, error: oErr } = await adminClient.from('orders').insert({
        order_number: orderNumber,
        client_id: clientId,
        partner_id: partnerId,
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
        partner_id: partnerId,
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
        await adminClient.from('partners').delete().eq('id', partnerId);
        await adminClient.from('users').delete().eq('id', clientId);
        await adminClient.auth.admin.deleteUser(clientId);
    }
});

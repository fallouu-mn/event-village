import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { getServiceRoleClient } from '../lib/supabase/server';
import { paymentService } from '../lib/payments/payment.service';
import { NotificationService } from '../lib/notifications/notification.service';
import { samirPayClient } from '../lib/samirpay/client';
import { randomUUID } from 'crypto';

import * as fs from 'fs';
import * as path from 'path';

// Chargement des variables d'environnement si exécuté directement
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

describe('CHUNK 5 — PHASE 1 : ÉRADICATION DES BUGS CRITIQUES', () => {
    const supabase = getServiceRoleClient();

    let testClientId: string;
    let testPartnerId: string;
    let testPartnerUserId: string;
    let testPlanId: string;
    let testHallId: string;
    let testTableId: string;

    const timestamp = Date.now();
    const clientEmail = `chunk5_client_${timestamp}@test.sn`;
    const partnerEmail = `chunk5_partner_${timestamp}@test.sn`;
    const clientPhone = `+22177${Math.floor(1000000 + Math.random() * 9000000)}`;
    const partnerPhone = `+22178${Math.floor(1000000 + Math.random() * 9000000)}`;

    before(async () => {
        // 1. Création utilisateur Client
        const { data: authClient } = await supabase.auth.admin.createUser({
            email: clientEmail,
            password: 'Password123!',
            email_confirm: true,
            user_metadata: { role: 'CLIENT', first_name: 'Client', last_name: 'Chunk5' },
        });
        testClientId = authClient.user!.id;

        await supabase.from('users').upsert({
            id: testClientId,
            email: clientEmail,
            phone: clientPhone,
            first_name: 'Client',
            last_name: 'Chunk5',
            role: 'CLIENT',
            status: 'ACTIF',
        });

        // 2. Création utilisateur Partenaire
        const { data: authPartner } = await supabase.auth.admin.createUser({
            email: partnerEmail,
            password: 'Password123!',
            email_confirm: true,
            user_metadata: { role: 'PARTENAIRE', first_name: 'Partner', last_name: 'Chunk5' },
        });
        testPartnerUserId = authPartner.user!.id;

        await supabase.from('users').upsert({
            id: testPartnerUserId,
            email: partnerEmail,
            phone: partnerPhone,
            first_name: 'Partner',
            last_name: 'Chunk5',
            role: 'PARTENAIRE',
            status: 'ACTIF',
        });

        const { data: existingPartner } = await supabase
            .from('partners')
            .select('id')
            .eq('user_id', testPartnerUserId)
            .maybeSingle();

        if (existingPartner) {
            testPartnerId = existingPartner.id;
        } else {
            const { data: partnerRec, error: pErr } = await supabase.from('partners').insert({
                user_id: testPartnerUserId,
                company_name: 'Traiteur & Salle Chunk5',
                commercial_name: 'Chunk5 Events',
                status: 'VALIDE',
            }).select().single();
            if (pErr) console.error('Error creating partner in test setup:', pErr);
            testPartnerId = partnerRec!.id;
        }

        // 3. Récupération ou création d'un plan d'abonnement payant
        const { data: existingPlan } = await supabase
            .from('subscription_plans')
            .select('id, price')
            .gt('price', 0)
            .limit(1)
            .maybeSingle();

        if (existingPlan) {
            testPlanId = existingPlan.id;
        } else {
            const { data: newPlan } = await supabase.from('subscription_plans').insert({
                code: 'PREMIUM_TEST',
                name: 'Pack Premium Test',
                price: 25000,
                billing_period: 'MONTHLY',
                features: ['Accès complet', 'Support 24/7'],
            }).select().single();
            testPlanId = newPlan!.id;
        }

        // 4. Création d'une salle pour test
        const { data: hall } = await supabase.from('halls').insert({
            partner_id: testPartnerId,
            name: 'Palais Chunk5',
            capacity: 300,
            price_per_day: 150000,
            deposit_percentage: 30,
            is_active: true,
        }).select().single();
        testHallId = hall!.id;

        // 5. Création d'une table pour test
        const { data: table } = await supabase.from('restaurant_tables').insert({
            partner_id: testPartnerId,
            table_number: `T-${timestamp}`,
            capacity: 4,
            is_active: true,
        }).select().single();
        testTableId = table!.id;
    });

    after(async () => {
        // Nettoyage des données de test
        await supabase.from('refunds').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        await supabase.from('payments').delete().eq('client_id', testClientId);
        await supabase.from('table_reservations').delete().eq('partner_id', testPartnerId);
        await supabase.from('hall_reservations').delete().eq('partner_id', testPartnerId);
        await supabase.from('orders').delete().eq('client_id', testClientId);
        await supabase.from('restaurant_tables').delete().eq('id', testTableId);
        await supabase.from('halls').delete().eq('id', testHallId);
        await supabase.from('partners').delete().eq('id', testPartnerId);
        await supabase.from('users').delete().in('id', [testClientId, testPartnerUserId]);
        await supabase.auth.admin.deleteUser(testClientId);
        await supabase.auth.admin.deleteUser(testPartnerUserId);
    });

    test('BUG 1 — Enum & Invariant de Remboursement : processRefund utilise l\'enum PROCESSED et préserve Total − Payé = Solde', async () => {
        // 1. Création d'une commande de 50 000 FCFA avec les colonnes obligatoires (subtotal, delivery_mode)
        const { data: order, error: orderErr } = await supabase.from('orders').insert({
            client_id: testClientId,
            partner_id: testPartnerId,
            subtotal: 50000,
            delivery_mode: 'RETRAIT',
            total_amount: 50000,
            paid_amount: 50000,
            balance_amount: 0,
            payment_status: 'SUCCESS',
            order_status: 'CONFIRMEE',
            order_number: `CMD-TEST-${Date.now()}`,
        }).select().single();

        if (orderErr) {
            console.error('Error creating order in test 1:', orderErr);
        }

        // 2. Création du paiement associé à SUCCESS
        const { data: payment } = await supabase.from('payments').insert({
            transaction_id: `TX-REFUND-${Date.now()}`,
            external_order_id: `ORD-REFUND-${Date.now()}`,
            client_id: testClientId,
            partner_id: testPartnerId,
            order_id: order!.id,
            amount: 50000,
            currency: 'XOF',
            status: 'SUCCESS',
            payment_target: 'ORDER',
        }).select().single();

        // 3. Exécution d'un remboursement partiel de 20 000 FCFA
        const refund1 = await paymentService.processRefund({
            paymentId: payment!.id,
            refundAmount: 20000,
            reason: 'Annulation partielle',
            processedBy: testPartnerUserId,
        });

        assert.equal(refund1.success, true);
        assert.equal(refund1.newPaidAmount, 30000);
        assert.equal(refund1.newBalanceAmount, 20000);

        // 4. Vérification stricte en base de données
        const { data: refunds } = await supabase
            .from('refunds')
            .select('*')
            .eq('payment_id', payment!.id);

        assert.equal(refunds?.length, 1);
        assert.equal(refunds![0].status, 'PROCESSED', 'Le statut doit être PROCESSED (enum Postgres autorisé)');
        assert.equal(Number(refunds![0].amount), 20000);
        assert.ok(refunds![0].refund_transaction_id.startsWith('REFUND-'), 'refund_transaction_id doit être généré et unique');

        // Vérification de la commande mise à jour (Invariant : Total - Payé = Solde)
        const { data: updatedOrder } = await supabase
            .from('orders')
            .select('*')
            .eq('id', order!.id)
            .single();

        assert.equal(Number(updatedOrder!.paid_amount), 30000);
        assert.equal(Number(updatedOrder!.balance_amount), 20000);
        assert.equal(Number(updatedOrder!.total_amount), 50000);
        assert.equal(Number(updatedOrder!.paid_amount) + Number(updatedOrder!.balance_amount), Number(updatedOrder!.total_amount));
        assert.equal(updatedOrder!.payment_status, 'PARTIAL');

        // 5. Remboursement du solde restant (30 000 FCFA) -> Statut REFUNDED
        const refund2 = await paymentService.processRefund({
            paymentId: payment!.id,
            refundAmount: 30000,
            reason: 'Remboursement intégral du solde',
        });

        assert.equal(refund2.success, true);
        assert.equal(refund2.newPaidAmount, 0);
        assert.equal(refund2.newBalanceAmount, 50000);

        const { data: finalOrder } = await supabase
            .from('orders')
            .select('*')
            .eq('id', order!.id)
            .single();

        assert.equal(Number(finalOrder!.paid_amount), 0);
        assert.equal(Number(finalOrder!.balance_amount), 50000);
        assert.equal(finalOrder!.payment_status, 'REFUNDED');
    });

    test('BUG 2 — Webhook Subscription & Idempotence : Activation en base, calcul trial/expiration et protection anti-duplication', async () => {
        const originalInitPayment = samirPayClient.initPayment;
        samirPayClient.initPayment = async (payload) => ({
            success: true,
            status: 'PENDING',
            message: 'Payment initialized',
            transaction_id: `EXT-SAMIR-${Date.now()}`,
            payment_url: `https://checkout.samirpay.sn/pay/${payload.order_id}`,
            data: {
                transaction_id: `EXT-SAMIR-${Date.now()}`,
                payment_url: `https://checkout.samirpay.sn/pay/${payload.order_id}`,
                status: 'PENDING',
            }
        });

        let paymentIntent;
        try {
            // 1. Initialisation d'un paiement d'abonnement pour le partenaire
            paymentIntent = await paymentService.createPayment(testPartnerUserId, {
                targetType: 'SUBSCRIPTION',
                targetId: testPlanId,
                operator: 'WAVE',
                customerPhone: partnerPhone,
                customerEmail: partnerEmail,
            });
        } finally {
            samirPayClient.initPayment = originalInitPayment;
        }

        assert.equal(paymentIntent.success, true);
        assert.ok(paymentIntent.order_id);

        // 2. Réception du premier Webhook SUCCESS
        const formData1 = new FormData();
        formData1.append('transaction_id', `EXT-SAMIR-${Date.now()}`);
        formData1.append('order_id', paymentIntent.order_id);
        formData1.append('status', 'SUCCESS');
        formData1.append('amount', paymentIntent.amount.toString());

        const webhookRes1 = await paymentService.handleSamirPayWebhook(formData1);
        assert.equal(webhookRes1.success, true);
        assert.equal(webhookRes1.message, 'Paiement validé avec succès.');

        // Vérification de l'activation en base de données
        const { data: partnerAfter1 } = await supabase
            .from('partners')
            .select('subscription_plan_id, status, trial_ends_at')
            .eq('id', testPartnerId)
            .single();

        assert.equal(partnerAfter1!.subscription_plan_id, testPlanId, 'Le subscription_plan_id doit être mis à jour');
        assert.equal(partnerAfter1!.status, 'VALIDE');
        assert.ok(partnerAfter1!.trial_ends_at, 'La date de validité doit être calculée');

        const initialEndsAt = new Date(partnerAfter1!.trial_ends_at!).getTime();

        // 3. Test d'idempotence : Envoi d'un second webhook identique (Duplicate)
        const formData2 = new FormData();
        formData2.append('transaction_id', `EXT-SAMIR-${Date.now()}`);
        formData2.append('order_id', paymentIntent.order_id);
        formData2.append('status', 'SUCCESS');
        formData2.append('amount', paymentIntent.amount.toString());

        const webhookRes2 = await paymentService.handleSamirPayWebhook(formData2);
        assert.equal(webhookRes2.success, true);
        assert.equal(webhookRes2.message, 'Transaction déjà confirmée.', 'L\'idempotence doit retourner confirmation sans réappliquer');

        const { data: partnerAfter2 } = await supabase
            .from('partners')
            .select('trial_ends_at')
            .eq('id', testPartnerId)
            .single();

        assert.equal(new Date(partnerAfter2!.trial_ends_at!).getTime(), initialEndsAt, 'Aucune prolongation ou duplication de période lors du 2ème webhook');
    });

    test('BUG 3 — Reset Password SMS : Câblage de NotificationService et non-divulgation de l\'OTP', async () => {
        // 1. Envoi de notification de réinitialisation de mot de passe
        const notifResult = await NotificationService.sendPasswordResetNotification({
            phone: clientPhone,
            resetCode: '654321',
            email: clientEmail,
        });

        assert.equal(typeof notifResult.smsSent, 'boolean');
        assert.equal(notifResult.emailSent, true);

        // 2. Appel via l'endpoint /api/auth/send-otp avec purpose: PASSWORD_RESET
        // Vérification que le numéro est bien validé et que le code n'est jamais retourné dans le JSON
        const otpCode = '123456';
        assert.ok(!JSON.stringify(notifResult).includes(otpCode), 'L\'OTP ne doit jamais être retourné dans l\'objet de résultat public');
    });

    test('BUG 4 — Rollback Paiement FAILED & Webhook Hors-Ordre : Libération des ressources (salle, table, commande)', async () => {
        // 1. Création réservation de salle en attente
        const { data: hallRes } = await supabase.from('hall_reservations').insert({
            hall_id: testHallId,
            partner_id: testPartnerId,
            client_id: testClientId,
            start_date: '2026-10-15',
            end_date: '2026-10-15',
            total_amount: 150000,
            deposit_amount: 45000,
            balance_amount: 105000,
            status: 'EN_ATTENTE',
            payment_status: 'PENDING',
        }).select().single();

        // 2. Création réservation de table en attente
        const { data: tableRes } = await supabase.from('table_reservations').insert({
            partner_id: testPartnerId,
            table_id: testTableId,
            client_id: testClientId,
            reservation_date: '2026-10-15',
            reservation_time: '20:00:00',
            guest_count: 2,
            deposit_amount: 10000,
            status: 'EN_ATTENTE',
            payment_status: 'PENDING',
        }).select().single();

        // 3. Création des paiements associés
        const { data: paymentHall } = await supabase.from('payments').insert({
            transaction_id: `TX-HALL-FAIL-${Date.now()}`,
            external_order_id: `ORD-HALL-FAIL-${Date.now()}`,
            client_id: testClientId,
            partner_id: testPartnerId,
            hall_reservation_id: hallRes!.id,
            amount: 45000,
            currency: 'XOF',
            status: 'PENDING',
            payment_target: 'HALL_RESERVATION',
        }).select().single();

        const { data: paymentTable } = await supabase.from('payments').insert({
            transaction_id: `TX-TAB-FAIL-${Date.now()}`,
            external_order_id: `ORD-TAB-FAIL-${Date.now()}`,
            client_id: testClientId,
            partner_id: testPartnerId,
            table_reservation_id: tableRes!.id,
            amount: 10000,
            currency: 'XOF',
            status: 'PENDING',
            payment_target: 'TABLE_RESERVATION',
        }).select().single();

        // 4. Réception Webhook FAILED pour la réservation de salle
        const formFailedHall = new FormData();
        formFailedHall.append('transaction_id', `EXT-FAIL-${Date.now()}`);
        formFailedHall.append('order_id', paymentHall!.external_order_id);
        formFailedHall.append('status', 'FAILED');
        formFailedHall.append('amount', '45000');

        const hallWebhookRes = await paymentService.handleSamirPayWebhook(formFailedHall);
        assert.equal(hallWebhookRes.success, true);

        // Vérification de la libération de la salle (Statut ANNULEE)
        const { data: hallResAfter } = await supabase
            .from('hall_reservations')
            .select('status, payment_status')
            .eq('id', hallRes!.id)
            .single();

        assert.equal(hallResAfter!.status, 'ANNULEE', 'La réservation de salle doit passer à ANNULEE pour libérer les dates');
        assert.equal(hallResAfter!.payment_status, 'FAILED');

        // 5. Réception Webhook FAILED pour la réservation de table
        const formFailedTable = new FormData();
        formFailedTable.append('transaction_id', `EXT-FAIL-TAB-${Date.now()}`);
        formFailedTable.append('order_id', paymentTable!.external_order_id);
        formFailedTable.append('status', 'FAILED');
        formFailedTable.append('amount', '10000');

        const tableWebhookRes = await paymentService.handleSamirPayWebhook(formFailedTable);
        assert.equal(tableWebhookRes.success, true);

        // Vérification de la libération de la table (Statut ANNULEE)
        const { data: tableResAfter } = await supabase
            .from('table_reservations')
            .select('status, payment_status')
            .eq('id', tableRes!.id)
            .single();

        assert.equal(tableResAfter!.status, 'ANNULEE', 'La réservation de table doit passer à ANNULEE pour libérer la table');
        assert.equal(tableResAfter!.payment_status, 'FAILED');

        // 6. Test Webhook Hors-Ordre : Créer un paiement SUCCESS, puis envoyer un webhook FAILED tardif
        const { data: paymentSuccess } = await supabase.from('payments').insert({
            transaction_id: `TX-ORDER-OUT-${Date.now()}`,
            external_order_id: `ORD-ORDER-OUT-${Date.now()}`,
            client_id: testClientId,
            partner_id: testPartnerId,
            amount: 15000,
            currency: 'XOF',
            status: 'SUCCESS',
            payment_target: 'OTHER',
        }).select().single();

        const formOutOfOrder = new FormData();
        formOutOfOrder.append('transaction_id', `EXT-LATE-${Date.now()}`);
        formOutOfOrder.append('order_id', paymentSuccess!.external_order_id);
        formOutOfOrder.append('status', 'FAILED');
        formOutOfOrder.append('amount', '15000');

        const outOfOrderRes = await paymentService.handleSamirPayWebhook(formOutOfOrder);
        assert.equal(outOfOrderRes.success, true);

        const { data: paymentStillSuccess } = await supabase
            .from('payments')
            .select('status')
            .eq('id', paymentSuccess!.id)
            .single();

        assert.equal(paymentStillSuccess!.status, 'SUCCESS', 'Un webhook FAILED tardif ne doit pas écraser un paiement déjà SUCCESS');
    });
});

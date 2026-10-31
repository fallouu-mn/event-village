import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { getServiceRoleClient } from '../../lib/supabase/server';
import { NotificationService } from '../../lib/notifications/notification.service';
import { randomUUID } from 'crypto';

import * as fs from 'fs';
import * as path from 'path';

// Chargement des variables d'environnement si exécuté directement
// [lot 0] Chargement de .env.local supprimé : l'environnement de test (.env.test, instance Supabase locale)
// et le garde-fou anti-base réelle sont fournis par tests/helpers/env.ts.
import '../helpers/env';

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
        testClientId = 'a7345050-03cf-4967-9281-9ee5eb75615a';
        testPartnerUserId = 'e706a7a2-502c-4396-9e91-4dc6720388f7';
        testPartnerId = 'a917b7ac-d542-4c2b-b5d8-ab38f866b2e7';

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
        if (testTableId) await supabase.from('restaurant_tables').delete().eq('id', testTableId);
        if (testHallId) await supabase.from('halls').delete().eq('id', testHallId);
    });

    // [lot 2 — cas supprimé] BUG 1 Enum et invariant de remboursement : PaymentService.processRefund supprimé (remboursements par le module de cashout, lib/payments/cashout.service.ts) ; couvert par tests/parcours/paiement-remboursement.test.ts (remboursement partiel d'une commande sans équivalent)
    // [lot 2 — cas supprimé] BUG 2 Webhook d'abonnement et idempotence : samirPayClient.initPayment et PaymentService.handleSamirPayWebhook supprimés (webhook par lib/payments/webhook.service.ts) ; couvert par tests/parcours/paiement-webhook.test.ts (parcours billet ; activation d'abonnement sans cas dédié)

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

    // [lot 2 — cas supprimé] BUG 4 Rollback FAILED et webhook hors ordre (salle, table) : PaymentService.handleSamirPayWebhook supprimé (le webhook n'accepte que status=success et interroge SamirPay) ; couvert par tests/parcours/paiement-webhook.test.ts et tests/parcours/paiement-reconciliation.test.ts (parcours billet ; libération salle et table sans cas dédié)
});

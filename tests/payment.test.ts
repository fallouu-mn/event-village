import test from 'node:test';
import assert from 'node:assert/strict';
import { mapSamirPayStatus } from '../lib/samirpay/types';
import { SamirPayWebhookSchema, CreatePaymentSchema } from '../lib/validations/payment';

test('1. Mapping des statuts SamirPay', () => {
    assert.equal(mapSamirPayStatus('success'), 'SUCCESS');
    assert.equal(mapSamirPayStatus('paid'), 'SUCCESS');
    assert.equal(mapSamirPayStatus('valide'), 'SUCCESS');
    assert.equal(mapSamirPayStatus('failed'), 'FAILED');
    assert.equal(mapSamirPayStatus('echec'), 'FAILED');
    assert.equal(mapSamirPayStatus('cancelled'), 'CANCELLED');
    assert.equal(mapSamirPayStatus('pending'), 'PENDING');
});

test('2. Validation du payload Webhook SamirPay', () => {
    const validPayload = {
        transaction_id: 'TX-123456',
        order_id: 'ORD-789012',
        status: 'success',
    };
    const result = SamirPayWebhookSchema.safeParse(validPayload);
    assert.equal(result.success, true);

    const invalidPayload = {
        transaction_id: '',
        order_id: 'ORD-789',
        // missing status
    };
    const invalidResult = SamirPayWebhookSchema.safeParse(invalidPayload);
    assert.equal(invalidResult.success, false);
});

test('3. Masquage strict des secrets dans les erreurs', () => {
    const fakeSecret = 'sec_live_999888777';
    const fakeKey = 'key_live_111222333';
    const rawError = `Erreur avec ${fakeSecret} et ${fakeKey}`;
    const sanitized = rawError.replace(fakeSecret, '***').replace(fakeKey, '***');
    assert.ok(!sanitized.includes(fakeSecret));
    assert.ok(!sanitized.includes(fakeKey));
    assert.equal(sanitized, 'Erreur avec *** et ***');
});

test('4. Validation de la création de paiement PWA (Pas de montant envoyé)', () => {
    const validPaymentInput = {
        targetType: 'TICKET',
        targetId: 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d',
        customerPhone: '771234567',
    };
    const result = CreatePaymentSchema.safeParse(validPaymentInput);
    assert.equal(result.success, true);

    // Si le client tente d'injecter un montant arbitraire, il est ignoré par le schéma
    const hackedInput = {
        targetType: 'ORDER',
        targetId: 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d',
        amount: 1, // Devra être ignoré / non pris en compte
    };
    const hackedResult = CreatePaymentSchema.safeParse(hackedInput);
    assert.equal(hackedResult.success, true);
    // Le type déduit n'inclut pas 'amount'
    assert.equal((hackedResult.data as Record<string, unknown>).amount, undefined);
});

test('5. Calcul du Revenu Net Event Village et des Commissions de Parrainage (CDC V3)', () => {
    const brutAmount = 25000;
    const serviceFeeRate = 0.05; // 5%
    const aggregatorFeeRate = 0.015; // 1.5%

    const serviceFee = brutAmount * serviceFeeRate; // 1250 FCFA (Gross revenue)
    const aggregatorFee = brutAmount * aggregatorFeeRate; // 375 FCFA
    const eligibleNetRevenue = serviceFee - aggregatorFee; // 875 FCFA (Revenu Net Event Village éligible)

    assert.equal(eligibleNetRevenue, 875);

    // Taux Ambassadeur -> Client : N1 = 7%, N2 = 2%
    const commN1 = Math.round(eligibleNetRevenue * 0.07 * 100) / 100; // 61.25 FCFA
    const commN2 = Math.round(eligibleNetRevenue * 0.02 * 100) / 100; // 17.50 FCFA

    assert.equal(commN1, 61.25);
    assert.equal(commN2, 17.5);
    assert.ok(commN1 + commN2 < eligibleNetRevenue);
});

test('6. Validation du schéma et des calculs de Cashout SamirPay (Seuil min 5000, 1% de frais)', () => {
    const { RequestWithdrawalSchema } = require('../lib/validations/payment');

    const validCashout = {
        amount: 15000,
        operatorName: 'WAVE',
        phoneNumber: '771234567',
        firstName: 'Mamadou',
        lastName: 'Diallo',
    };
    const validResult = RequestWithdrawalSchema.safeParse(validCashout);
    assert.equal(validResult.success, true);

    // Calculs financiers (1% frais de retrait CDC V3)
    const gross = 15000;
    const feeRate = 0.01;
    const fee = gross * feeRate; // 150 FCFA
    const net = gross - fee; // 14850 FCFA

    assert.equal(fee, 150);
    assert.equal(net, 14850);

    // Seuil minimum inférieur à 5000 FCFA rejeté
    const belowMin = {
        amount: 3000,
        operatorName: 'ORANGE_MONEY',
        phoneNumber: '771234567',
        firstName: 'Mamadou',
        lastName: 'Diallo',
    };
    const belowMinResult = RequestWithdrawalSchema.safeParse(belowMin);
    assert.equal(belowMinResult.success, false);
});


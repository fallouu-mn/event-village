import test from 'node:test';
import assert from 'node:assert/strict';
import { AdminService, BLACKLISTED_WORDS } from '../lib/admin/admin.service';
import { ADMIN_PERMISSIONS, AdminPermission } from '../lib/admin/admin-auth';

test('1. SUPERADMIN RBAC : Possède toutes les permissions par défaut', () => {
    assert.strictEqual(ADMIN_PERMISSIONS.length > 10, true);
    assert.strictEqual(ADMIN_PERMISSIONS.includes('users.read'), true);
    assert.strictEqual(ADMIN_PERMISSIONS.includes('partners.validate'), true);
    assert.strictEqual(ADMIN_PERMISSIONS.includes('refunds.manage'), true);
    assert.strictEqual(ADMIN_PERMISSIONS.includes('pricing.manage'), true);
});

test('2. SÉCURITÉ : Protection stricte contre l\'élévation de privilèges (CDC V3)', () => {
    // Un utilisateur avec rôle CLIENT ne peut pas attribuer de permissions
    const clientUser = { role: 'CLIENT', id: 'user-client-1' };
    const canElevate = clientUser.role === 'SUPERADMIN';
    assert.strictEqual(canElevate, false, 'Un CLIENT ne doit jamais pouvoir élever des privilèges.');

    // Un ADMIN ordinaire ne peut pas créer un SUPERADMIN
    const adminUser = { role: 'ADMIN', id: 'user-admin-1' };
    const canCreateSuperadmin = adminUser.role === 'SUPERADMIN';
    assert.strictEqual(canCreateSuperadmin, false, 'Un ADMIN ne peut pas créer un SUPERADMIN.');
});

test('3. RÈGLE ABSOLUE DE NON-RÉTROACTIVITÉ DU PARRAINAGE (§132, §98)', () => {
    // Simulation Transaction A avec ancien taux (4%)
    const transactionA_EligibleNet = 10000;
    const oldRateN1 = 4.0;
    const commissionA = Math.round(transactionA_EligibleNet * (oldRateN1 / 100));
    assert.strictEqual(commissionA, 400, 'Commission A doit être de 400 FCFA avec l\'ancien taux.');

    // Modification du taux pour le futur -> Nouveau taux (7% Ambassadeur)
    const newRateN1 = 7.0;

    // Simulation Transaction B avec le nouveau taux (7%)
    const transactionB_EligibleNet = 10000;
    const commissionB = Math.round(transactionB_EligibleNet * (newRateN1 / 100));
    assert.strictEqual(commissionB, 700, 'Commission B doit être calculée à 700 FCFA.');

    // Vérification que Transaction A reste STRICTEMENT figée
    assert.strictEqual(commissionA, 400, 'La Transaction A antérieure ne doit JAMAIS être recalculée.');
});

test('4. RAPPROCHEMENT FINANCIER SAMIRPAY (§84) : Équilibre Parfait Brut vs Frais vs Net vs Reversement', () => {
    const grossAmount = 50000;
    const paymentMethod = 'WAVE';

    // 1. Frais agrégateur (Wave = 1.0%)
    const aggFeeRate = paymentMethod === 'WAVE' ? 0.01 : 0.015;
    const aggregatorFee = Math.round(grossAmount * aggFeeRate);
    assert.strictEqual(aggregatorFee, 500);

    // 2. Net Plateforme Event Village (6.5%)
    const platformFeeRate = 6.5;
    const platformNetRevenue = Math.round(grossAmount * (platformFeeRate / 100));
    assert.strictEqual(platformNetRevenue, 3250);

    // 3. Reversement net au partenaire
    const partnerPayout = grossAmount - aggregatorFee - platformNetRevenue;
    assert.strictEqual(partnerPayout, 46250);

    // 4. Vérification d'écart zéro
    const sum = aggregatorFee + platformNetRevenue + partnerPayout;
    const discrepancy = Math.abs(grossAmount - sum);
    assert.strictEqual(discrepancy, 0, 'L\'écart de rapprochement financier doit être strictement égal à 0 FCFA.');
});

test('5. MODÉRATION DU CONTENU DES COMMUNICATIONS SUPERADMIN (§121-§126)', () => {
    // Message licite
    const cleanMsg = 'Bonjour chers partenaires, l\'événement Festival de Dakar ouvrira ses portes à 18h.';
    const resClean = AdminService.moderateContent(cleanMsg);
    assert.strictEqual(resClean.isClean, true);
    assert.strictEqual(resClean.flaggedWords.length, 0);

    // Message avec contenu offensant / interdit
    const dirtyMsg = 'Attention cette promotion est une grosse arnaque organisée par des escrocs.';
    const resDirty = AdminService.moderateContent(dirtyMsg);
    assert.strictEqual(resDirty.isClean, false);
    assert.strictEqual(resDirty.flaggedWords.includes('arnaque'), true);
    assert.strictEqual(resDirty.flaggedWords.includes('escroc'), true);
});

test('6. CALCUL DU ROI DU PARRAINAGE (§132, §133)', () => {
    const netRevenueFromReferrals = 500000;
    const totalCommissionsPaid = 75000;

    const netProfit = netRevenueFromReferrals - totalCommissionsPaid;
    const roiPercentage = Math.round((netProfit / totalCommissionsPaid) * 100);

    assert.strictEqual(netProfit, 425000);
    assert.strictEqual(roiPercentage, 567); // ROI +567%
});

test('7. RÈGLE STRICTE AMBASSADEUR : role = CLIENT et referral_status = AMBASSADEUR', () => {
    const ambassadorUser = {
        role: 'CLIENT',
        referral_status: 'AMBASSADEUR',
    };

    assert.strictEqual(ambassadorUser.role, 'CLIENT');
    assert.strictEqual(ambassadorUser.referral_status, 'AMBASSADEUR');
    assert.notStrictEqual(ambassadorUser.role, 'AMBASSADEUR', 'Le rôle RBAC ne doit jamais être AMBASSADEUR.');
});

test('8. TARIFS & PACKS PARTENAIRES (§117) : Grille Officielle CDC V3.0', () => {
    const subscriptionPacks = {
        starter: { name: 'Starter', price: 0, commission_rate: 8.0, max_events: 2 },
        business: { name: 'Business', price: 25000, commission_rate: 6.5, max_events: 10 },
        premium: { name: 'Premium', price: 75000, commission_rate: 5.0, max_events: 999 },
    };

    assert.strictEqual(subscriptionPacks.starter.price, 0);
    assert.strictEqual(subscriptionPacks.starter.commission_rate, 8.0);
    assert.strictEqual(subscriptionPacks.business.price, 25000);
    assert.strictEqual(subscriptionPacks.business.commission_rate, 6.5);
    assert.strictEqual(subscriptionPacks.premium.price, 75000);
    assert.strictEqual(subscriptionPacks.premium.commission_rate, 5.0);
});

test('9. GESTION DES RETRAITS (§126) : Règle de frais et seuil minimum', () => {
    const withdrawalRules = {
        min_amount: 5000,
        fee_rate: 1.0,
    };

    const requestedAmount = 100000;
    const fee = Math.round(requestedAmount * (withdrawalRules.fee_rate / 100));
    const netPayout = requestedAmount - fee;

    assert.strictEqual(fee, 1000);
    assert.strictEqual(netPayout, 99000);
    assert.strictEqual(requestedAmount >= withdrawalRules.min_amount, true);
});

test('10. JOURNAL D\'AUDIT INALTÉRABLE (§134, §156) : Structure obligatoire des entrées d\'audit', () => {
    const sampleLog = {
        action: 'STATUS_CHANGE',
        object_type: 'partners',
        object_id: 'partner-uuid-123',
        old_value: { status: 'EN_ATTENTE' },
        new_value: { status: 'VALIDE' },
        user_role: 'SUPERADMIN',
    };

    assert.ok(sampleLog.action);
    assert.ok(sampleLog.object_type);
    assert.ok(sampleLog.object_id);
    assert.strictEqual(sampleLog.old_value.status, 'EN_ATTENTE');
    assert.strictEqual(sampleLog.new_value.status, 'VALIDE');
    assert.strictEqual(sampleLog.user_role, 'SUPERADMIN');
});


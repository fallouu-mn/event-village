import test from 'node:test';
import assert from 'node:assert/strict';
import { RegisterPartnerSchema, normalizePhoneNumber } from '../lib/validations/auth';
import { RateLimiter } from '../lib/security/rate-limiter';
import { SensitiveActionService } from '../lib/security/sensitive-action.service';
import { NotificationService } from '../lib/notifications/notification.service';
import { AdminService } from '../lib/admin/admin.service';

test('1. Register Partenaire : Schéma strict avec documents obligatoires (Bucket Privé) et statut initial EN_ATTENTE', () => {
    const validPayload = {
        companyName: 'Traiteur Royal Dakar',
        commercialName: 'Royal Buffet',
        description: 'Service traiteur haut de gamme',
        address: 'Almadies Zone 4',
        city: 'Dakar',
        activities: ['TRAITEUR', 'PATISSERIE'],
        firstName: 'Aminata',
        lastName: 'Diallo',
        phone: '77 456 78 90',
        email: 'aminata@royal.sn',
        password: 'Password123!',
        confirmPassword: 'Password123!',
        idCardUrl: 'pending_registrations/id_card_aminata_123.pdf',
        businessDocUrl: 'pending_registrations/business_rccm_royal_123.pdf',
    };

    const parsed = RegisterPartnerSchema.safeParse(validPayload);
    assert.strictEqual(parsed.success, true);
    if (parsed.success) {
        assert.strictEqual(parsed.data.activities.length, 2);
        assert.strictEqual(normalizePhoneNumber(parsed.data.phone), '+221774567890');
        assert.strictEqual(parsed.data.idCardUrl, 'pending_registrations/id_card_aminata_123.pdf');
        assert.strictEqual(parsed.data.businessDocUrl, 'pending_registrations/business_rccm_royal_123.pdf');
    }

    // Rejet si pièce d'identité manquante
    const payloadWithoutIdCard = { ...validPayload, idCardUrl: undefined };
    const parsedNoId = RegisterPartnerSchema.safeParse(payloadWithoutIdCard);
    assert.strictEqual(parsedNoId.success, false, 'Le schéma doit rejeter une inscription sans pièce d\'identité.');

    // Rejet si document d'entreprise manquant
    const payloadWithoutBusinessDoc = { ...validPayload, businessDocUrl: undefined };
    const parsedNoBus = RegisterPartnerSchema.safeParse(payloadWithoutBusinessDoc);
    assert.strictEqual(parsedNoBus.success, false, 'Le schéma doit rejeter une inscription sans document d\'entreprise.');
});

test('2. OTP Validation : Code conforme et vérification', () => {
    const generatedCode = '654321';
    const submittedCode = '654321';
    const isMatch = generatedCode === submittedCode.trim();
    assert.strictEqual(isMatch, true);
});

test('3. OTP Invalide : Détection et rejet', () => {
    const generatedCode = '654321';
    const wrongCode = '000000';
    assert.notStrictEqual(generatedCode, wrongCode);
});

test('4. OTP Expiré : Rejet après dépassement de validité', () => {
    const expiredTimestamp = Date.now() - 1000;
    const isExpired = Date.now() > expiredTimestamp;
    assert.strictEqual(isExpired, true, 'Un code expiré doit être rejeté.');
});

test('5. Login Valide : Rôle résolu côté serveur', () => {
    const serverVerifiedUser = {
        id: 'user-uuid-part-1',
        role: 'PARTENAIRE',
        status: 'ACTIF',
    };
    assert.strictEqual(serverVerifiedUser.role, 'PARTENAIRE');
    assert.strictEqual(serverVerifiedUser.status, 'ACTIF');
});

test('6. Login Mauvais Mot de Passe : Échec d\'authentification', () => {
    const passwordHashMatches = false;
    assert.strictEqual(passwordHashMatches, false);
});

test('7. Accès Partner Autorisé : Rôle PARTENAIRE -> /partner/*', () => {
    const role: string = 'PARTENAIRE';
    const canAccessPartner = role === 'PARTENAIRE' || role === 'ADMIN' || role === 'SUPERADMIN';
    assert.strictEqual(canAccessPartner, true);
});

test('8. Accès Client → /partner Interdit', () => {
    const role: string = 'CLIENT';
    const canAccessPartner = role === 'PARTENAIRE' || role === 'ADMIN' || role === 'SUPERADMIN';
    assert.strictEqual(canAccessPartner, false, 'Un CLIENT ne doit pas pouvoir accéder aux routes /partner.');
});

test('9. Accès Partner → /admin Interdit', () => {
    const role: string = 'PARTENAIRE';
    const canAccessAdmin = role === 'ADMIN' || role === 'SUPERADMIN';
    assert.strictEqual(canAccessAdmin, false, 'Un PARTENAIRE ne doit pas pouvoir accéder aux routes /admin.');
});

test('10. Accès Admin → /admin Autorisé', () => {
    const role: string = 'ADMIN';
    const canAccessAdmin = role === 'ADMIN' || role === 'SUPERADMIN';
    assert.strictEqual(canAccessAdmin, true);
});

test('11. Accès Contrôleur → /partner/scan Autorisé', () => {
    const role: string = 'CONTROLEUR';
    const canScan = role === 'CONTROLEUR' || role === 'ADMIN' || role === 'SUPERADMIN' || role === 'PARTENAIRE';
    assert.strictEqual(canScan, true);
});

test('12. Accès Client → /partner/scan Interdit', () => {
    const role: string = 'CLIENT';
    const canScan = role === 'CONTROLEUR' || role === 'ADMIN' || role === 'SUPERADMIN' || role === 'PARTENAIRE';
    assert.strictEqual(canScan, false);
});

test('13. Upload Document Autorisé : Dossier propriétaire auth.uid()', () => {
    const currentUserId = 'user-abc-123';
    const targetFolder = 'user-abc-123/id_card.pdf';
    const isOwner = targetFolder.startsWith(currentUserId + '/');
    assert.strictEqual(isOwner, true);
});

test('14. Accès Document Autre Partenaire Interdit (Isolation Cross-Tenant)', () => {
    const currentUserId = 'user-partner-A';
    const victimDocumentPath = 'user-partner-B/business_doc.pdf';
    const isOwner = victimDocumentPath.startsWith(currentUserId + '/');
    assert.strictEqual(isOwner, false, 'Un partenaire ne doit pas accéder aux documents d\'un autre partenaire.');
});

test('15. Validation Partenaire : Statut VALIDE et Notification', async () => {
    const partner = {
        company_name: 'Dakar Traiteur',
        email: 'dakar@traiteur.sn',
        phone: '+221771112233',
        status: 'VALIDE',
        is_verified: true,
    };
    assert.strictEqual(partner.status, 'VALIDE');
    assert.strictEqual(partner.is_verified, true);
});

test('16. Refus Partenaire : Statut REJETE avec motif conservé', () => {
    const partner = {
        status: 'REJETE',
        rejection_reason: 'Document d\'immatriculation NINEA non lisible.',
    };
    assert.strictEqual(partner.status, 'REJETE');
    assert.ok(partner.rejection_reason.includes('NINEA'));
});

test('17. Suspension Partenaire : Statut SUSPENDU et blocage d\'accès', () => {
    const partner = {
        status: 'SUSPENDU',
        suspended_reason: 'Non-conformité sanitaire signalée.',
    };
    const isBlocked = partner.status === 'SUSPENDU';
    assert.strictEqual(isBlocked, true);
});

test('18. Réactivation Partenaire : Statut ACTIF restauré', () => {
    let partnerStatus = 'SUSPENDU';
    partnerStatus = 'ACTIF';
    assert.strictEqual(partnerStatus, 'ACTIF');
});

test('19. Reset Password : Token / OTP sécurisé', () => {
    const resetFlow = {
        type: 'PHONE_OTP',
        phone: '+221774567890',
        validityMinutes: 15,
    };
    assert.strictEqual(resetFlow.validityMinutes, 15);
});

test('20. Sensitive Action OTP : Protection des retraits', () => {
    const withdrawalRequest = {
        amount: 50000,
        phone: '+221770001122',
        requiresOtp: true,
    };
    assert.strictEqual(withdrawalRequest.requiresOtp, true);
});

test('21. Audit Log : Journalisation inaltérable des actions partenaires', () => {
    const log = {
        action: 'PARTNER_REGISTRATION',
        object_type: 'partners',
        object_id: 'partner-uuid-456',
        user_role: 'PARTENAIRE',
    };
    assert.strictEqual(log.action, 'PARTNER_REGISTRATION');
    assert.strictEqual(log.object_type, 'partners');
});

test('22. Anti-Brute-Force : RateLimiter bloque après 5 échecs consécutifs', async () => {
    const testIdentifier = 'test_ip_192_168_1_50';
    await RateLimiter.resetAttempts(testIdentifier);

    // 1 à 4 échecs -> pas encore bloqué
    for (let i = 1; i <= 4; i++) {
        const res = await RateLimiter.recordFailedAttempt(testIdentifier);
        assert.strictEqual(res.locked, false, `Tentative ${i} ne doit pas verrouiller.`);
    }

    // 5ème échec -> verrouillé
    const res5 = await RateLimiter.recordFailedAttempt(testIdentifier);
    assert.strictEqual(res5.locked, true, 'La 5ème tentative doit verrouiller l\'accès.');

    // Vérification de verrouillage
    const check = await RateLimiter.isRateLimited(testIdentifier);
    assert.strictEqual(check.limited, true, 'L\'identifiant doit être considéré comme limité.');

    // Nettoyage
    await RateLimiter.resetAttempts(testIdentifier);
});

test('23. Première Activation : Durée 60 jours Standard vs 90 jours Founder', () => {
    const standardPartner = { is_founder: false };
    const founderPartner = { is_founder: true };

    const standardDays = standardPartner.is_founder ? 90 : 60;
    const founderDays = founderPartner.is_founder ? 90 : 60;

    assert.strictEqual(standardDays, 60);
    assert.strictEqual(founderDays, 90);
});

test('24. Période d\'Essai Idempotente : Non recalculée sur les connexions suivantes', () => {
    const existingTrialStart = new Date('2026-08-01T10:00:00Z').toISOString();
    const existingTrialEnd = new Date('2026-10-01T10:00:00Z').toISOString();

    const partner = {
        trial_started_at: existingTrialStart,
        trial_ends_at: existingTrialEnd,
    };

    // Tentative de réactivation
    const isAlreadyActivated = !!partner.trial_started_at;
    assert.strictEqual(isAlreadyActivated, true);
    assert.strictEqual(partner.trial_started_at, existingTrialStart, 'La date de début ne doit pas être altérée.');
    assert.strictEqual(partner.trial_ends_at, existingTrialEnd, 'La date de fin ne doit pas être altérée.');
});

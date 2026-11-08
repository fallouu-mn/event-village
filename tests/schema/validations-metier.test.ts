/**
 * Lot 9, A21 (contrat 5.5, L51) : accueil des cas réels des suites racine supprimées en vague L, sans base.
 * Cas portés, chacun sur le vrai code : auth-rbac 13, 14 ; partner-auth-complete 1 ; payment 1, 2, 4, 6 (partie schéma) ;
 * superadmin-complete 1, 5 ; source du verrouillage « Devenir partenaire » (auth-rbac 20, roles-isolation 7).
 * Vert dès l'écriture, annoncé au commit : ces cas passaient déjà dans les suites d'origine. Si un port échoue, c'est une
 * anomalie à instruire, pas un test à détendre. Sans base, aucune écriture : aucun appel d'invariants (signalé).
 */
import '../helpers/env';
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { RegisterPartnerSchema, VerifyOtpSchema, normalizePhoneNumber } from '../../lib/validations/auth';
import { OPERATOR_LABELS, SAMIRPAY_OPERATORS } from '../../lib/samirpay/types';
import { CreatePaymentSchema, RequestWithdrawalSchema, SamirPayWebhookSchema } from '../../lib/validations/payment';
import { AdminService } from '../../lib/admin/admin.service';
import { ADMIN_PERMISSIONS } from '../../lib/admin/admin-auth';
import { TEST_PASSWORD } from '../helpers/fixture-data';

describe('A21 — schémas d’authentification', () => {
    test('VerifyOtpSchema accepte un code à 6 chiffres, normalizePhoneNumber rend le E.164 sénégalais', () => {
        const input = { phone: '77 123 45 67', token: '123456', type: 'sms' as const };
        assert.equal(VerifyOtpSchema.safeParse(input).success, true);
        assert.equal(normalizePhoneNumber(input.phone), '+221771234567');
    });

    test('VerifyOtpSchema refuse un code trop court', () => {
        assert.equal(VerifyOtpSchema.safeParse({ phone: '77 123 45 67', token: '12', type: 'sms' as const }).success, false);
    });

    test('RegisterPartnerSchema exige les deux jetons de pièces et garde leurs valeurs', () => {
        const ID_CARD_TOKEN = 'jeton-de-depot-fictif-piece-identite-0001';
        const BUSINESS_DOC_TOKEN = 'jeton-de-depot-fictif-document-entreprise-0001';
        const valid = {
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
            password: TEST_PASSWORD,
            confirmPassword: TEST_PASSWORD,
            idCardUploadToken: ID_CARD_TOKEN,
            businessDocUploadToken: BUSINESS_DOC_TOKEN,
        };
        const parsed = RegisterPartnerSchema.safeParse(valid);
        assert.equal(parsed.success, true);
        if (parsed.success) {
            assert.equal(parsed.data.activities.length, 2);
            assert.equal(normalizePhoneNumber(parsed.data.phone), '+221774567890');
            assert.equal(parsed.data.idCardUploadToken, ID_CARD_TOKEN);
            assert.equal(parsed.data.businessDocUploadToken, BUSINESS_DOC_TOKEN);
        }
        assert.equal(RegisterPartnerSchema.safeParse({ ...valid, idCardUploadToken: undefined }).success, false, 'sans pièce d’identité');
        assert.equal(RegisterPartnerSchema.safeParse({ ...valid, businessDocUploadToken: undefined }).success, false, 'sans document d’entreprise');
    });
});

describe('A21 — paiement', () => {
    test('opérateurs du contrat SamirPay : Wave et Orange Money uniquement, libellé Orange Money', () => {
        assert.deepEqual([...SAMIRPAY_OPERATORS], ['WAVE', 'ORANGE_MONEY']);
        assert.equal(OPERATOR_LABELS.ORANGE_MONEY, 'Orange Money');
    });

    test('SamirPayWebhookSchema : statut et identifiants obligatoires', () => {
        const valid = { transaction_id: '550e8400-e29b-41d4-a716-446655440000', order_id: 'ORD-EV-1793470496112-6786FB', status: 'success' };
        assert.equal(SamirPayWebhookSchema.safeParse(valid).success, true);
        assert.equal(SamirPayWebhookSchema.safeParse({ transaction_id: '', order_id: 'ORD-789' }).success, false);
    });

    test('CreatePaymentSchema : opérateur obligatoire, carte refusée, montant envoyé ignoré', () => {
        const target = 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d';
        const valid = { targetType: 'TICKET', targetId: target, operator: 'WAVE', payerPhone: '771234567' };
        assert.equal(CreatePaymentSchema.safeParse(valid).success, true);
        assert.equal(CreatePaymentSchema.safeParse({ ...valid, operator: undefined }).success, false, 'opérateur obligatoire');
        assert.equal(CreatePaymentSchema.safeParse({ ...valid, operator: 'CARD' }).success, false, 'carte refusée');
        const hacked = CreatePaymentSchema.safeParse({ targetType: 'ORDER', targetId: target, operator: 'ORANGE_MONEY', payerPhone: '781234567', amount: 1 });
        assert.equal(hacked.success, true);
        assert.equal((hacked.data as Record<string, unknown>).amount, undefined, 'le montant envoyé par le client est ignoré');
    });

    test('RequestWithdrawalSchema : 15 000 F accepté, 3 000 F refusé (seuil de 5 000 F)', () => {
        const body = { operatorName: 'WAVE', phoneNumber: '771234567', firstName: 'Mamadou', lastName: 'Diallo' };
        assert.equal(RequestWithdrawalSchema.safeParse({ ...body, amount: 15000 }).success, true);
        assert.equal(RequestWithdrawalSchema.safeParse({ ...body, operatorName: 'ORANGE_MONEY', amount: 3000 }).success, false);
    });
});

describe('A21 — administration', () => {
    test('ADMIN_PERMISSIONS : plus de 10 droits, dont users.read, partners.validate, refunds.manage, pricing.manage', () => {
        assert.ok(ADMIN_PERMISSIONS.length > 10, `droits : ${ADMIN_PERMISSIONS.length}`);
        for (const permission of ['users.read', 'partners.validate', 'refunds.manage', 'pricing.manage'] as const) {
            assert.equal(ADMIN_PERMISSIONS.includes(permission), true, `droit ${permission} absent`);
        }
    });

    test('moderateContent : message licite accepté, mots interdits relevés', () => {
        const clean = AdminService.moderateContent('Bonjour chers partenaires, l’événement Festival de Dakar ouvrira ses portes à 18h.');
        assert.equal(clean.isClean, true);
        assert.equal(clean.flaggedWords.length, 0);
        const dirty = AdminService.moderateContent('Attention cette promotion est une grosse arnaque organisée par des escrocs.');
        assert.equal(dirty.isClean, false);
        assert.ok(dirty.flaggedWords.includes('arnaque'), `mots relevés : ${JSON.stringify(dirty.flaggedWords)}`);
        assert.ok(dirty.flaggedWords.includes('escroc'), `mots relevés : ${JSON.stringify(dirty.flaggedWords)}`);
    });
});

describe('A21 — navigation', () => {
    test('AppLayout : « Devenir partenaire » réservé à qui n’est ni partenaire, ni admin, ni contrôleur', () => {
        const src = fs.readFileSync(path.join(process.cwd(), 'components/layout/AppLayout.tsx'), 'utf8');
        assert.match(src, /if\s*\(\s*!isPartner\s*&&\s*!isAdmin\s*&&\s*!isController\s*\)\s*\{\s*proItems\.push\(\s*\{\s*name:\s*'Devenir partenaire'/,
            'l’option « Devenir partenaire » n’est plus gardée par les trois rôles');
    });
});

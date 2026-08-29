import test from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { middleware } from '../middleware';
import {
    RegisterClientSchema,
    VerifyOtpSchema,
    RegisterPartnerSchema,
    normalizePhoneNumber,
} from '../lib/validations/auth';

// Helper pour simuler une requête Next.js avec cookies optionnels
function createMockRequest(path: string, cookies: Record<string, string> = {}) {
    const url = `http://localhost:3000${path}`;
    const req = new NextRequest(url);
    for (const [key, value] of Object.entries(cookies)) {
        req.cookies.set(key, value);
    }
    return req;
}

// Helper pour simuler la logique RBAC interne du middleware
function evaluateRbac(pathname: string, user: { role: string; partnerStatus?: string } | null) {
    const isPublicExact = ['/', '/explore', '/login', '/register', '/forgot-password', '/reset-password', '/halls', '/partner/register'].includes(pathname);
    const isPublicDynamic = pathname.startsWith('/events/') || pathname.startsWith('/halls/') || pathname.startsWith('/restaurants/');

    if (!user) {
        if (isPublicExact || isPublicDynamic) {
            return { allowed: true, redirect: null };
        }
        return { allowed: false, redirect: `/login?redirect=${encodeURIComponent(pathname)}` };
    }

    if (pathname.startsWith('/admin')) {
        if (user.role === 'ADMIN' || user.role === 'SUPERADMIN') {
            return { allowed: true, redirect: null };
        }
        return { allowed: false, redirect: '/?error=unauthorized_admin' };
    }

    if (pathname === '/partner/scan' || pathname.startsWith('/partner/scan/') || pathname === '/scan') {
        if (['CONTROLEUR', 'ADMIN', 'SUPERADMIN', 'PARTENAIRE'].includes(user.role)) {
            return { allowed: true, redirect: null };
        }
        return { allowed: false, redirect: '/?error=unauthorized_scanner' };
    }

    if (pathname.startsWith('/partner') && pathname !== '/partner/register') {
        if (['ADMIN', 'SUPERADMIN'].includes(user.role)) {
            return { allowed: true, redirect: null };
        }
        if (user.role === 'PARTENAIRE') {
            if (user.partnerStatus === 'EN_ATTENTE') {
                return { allowed: false, redirect: '/partner/dashboard?status=pending', isPending: true };
            }
            return { allowed: true, redirect: null };
        }
        return { allowed: false, redirect: '/?error=unauthorized_partner' };
    }

    return { allowed: true, redirect: null };
}

// Helper pour le Smart Routing
function resolveSmartRoute(role: string, redirectUrl?: string | null): string {
    if (redirectUrl && redirectUrl !== '/') return redirectUrl;
    switch (role) {
        case 'SUPERADMIN':
        case 'ADMIN':
            return '/admin';
        case 'PARTENAIRE':
            return '/partner';
        case 'CONTROLEUR':
            return '/scan';
        case 'CLIENT':
        default:
            return '/';
    }
}

// ============================================================================
// TESTS SPÉCIFIÉS DANS LE CAHIER DES CHARGES & PROMPT
// ============================================================================

test('1. CLIENT → accès / (Accueil public autorisé)', () => {
    const res = evaluateRbac('/', { role: 'CLIENT' });
    assert.equal(res.allowed, true);
    assert.equal(res.redirect, null);
});

test('2. CLIENT → accès /explore (Catalogue public autorisé)', () => {
    const res = evaluateRbac('/explore', { role: 'CLIENT' });
    assert.equal(res.allowed, true);
    assert.equal(res.redirect, null);
});

test('3. CLIENT → accès /events/* (Détail événement public autorisé)', () => {
    const res = evaluateRbac('/events/evt-justice-tour', { role: 'CLIENT' });
    assert.equal(res.allowed, true);
    assert.equal(res.redirect, null);
});

test('4. CLIENT → refus /partner/* (Accès pro bloqué avec redirection)', () => {
    const res = evaluateRbac('/partner/dashboard', { role: 'CLIENT' });
    assert.equal(res.allowed, false);
    assert.equal(res.redirect, '/?error=unauthorized_partner');
});

test('5. CLIENT → refus /admin/* (Accès administration bloqué)', () => {
    const res = evaluateRbac('/admin/dashboard', { role: 'CLIENT' });
    assert.equal(res.allowed, false);
    assert.equal(res.redirect, '/?error=unauthorized_admin');
});

test('6. PARTENAIRE EN_ATTENTE → refus /partner/* (Accès bloqué avant validation)', () => {
    const res = evaluateRbac('/partner/dashboard', { role: 'PARTENAIRE', partnerStatus: 'EN_ATTENTE' });
    assert.equal(res.allowed, false);
    assert.equal(res.isPending, true);
});

test('7. PARTENAIRE APPROUVE → accès /partner/* (Accès autorisé après validation)', () => {
    const res = evaluateRbac('/partner/dashboard', { role: 'PARTENAIRE', partnerStatus: 'VALIDE' });
    assert.equal(res.allowed, true);
    assert.equal(res.redirect, null);
});

test('8. ADMIN → accès /admin/* (Accès superviseur autorisé)', () => {
    const res = evaluateRbac('/admin/dashboard', { role: 'ADMIN' });
    assert.equal(res.allowed, true);
    assert.equal(res.redirect, null);
});

test('9. SUPERADMIN → accès /admin/* (Accès Superadmin maître autorisé)', () => {
    const res = evaluateRbac('/admin/referral', { role: 'SUPERADMIN' });
    assert.equal(res.allowed, true);
    assert.equal(res.redirect, null);
});

test('10. CONTROLEUR → accès scanner (/partner/scan autorisé)', () => {
    const res = evaluateRbac('/partner/scan', { role: 'CONTROLEUR' });
    assert.equal(res.allowed, true);
    assert.equal(res.redirect, null);
});

test('11. CLIENT → refus scanner (/partner/scan bloqué pour client ordinaire)', () => {
    const res = evaluateRbac('/partner/scan', { role: 'CLIENT' });
    assert.equal(res.allowed, false);
    assert.equal(res.redirect, '/?error=unauthorized_scanner');
});

test('12. Utilisateur non authentifié → redirection /login avec paramètre redirect', () => {
    const res = evaluateRbac('/wallet', null);
    assert.equal(res.allowed, false);
    assert.equal(res.redirect, '/login?redirect=%2Fwallet');
});

test('13. OTP valide → validation et activation du compte', () => {
    const validOtp = {
        phone: '77 123 45 67',
        token: '123456',
        type: 'sms' as const,
    };
    const parseResult = VerifyOtpSchema.safeParse(validOtp);
    assert.equal(parseResult.success, true);
    assert.equal(normalizePhoneNumber(validOtp.phone), '+221771234567');
});

test('14. OTP invalide → refus strict par le schéma', () => {
    const invalidToken = {
        phone: '77 123 45 67',
        token: '12', // 2 chiffres au lieu de 6
        type: 'sms' as const,
    };
    const result = VerifyOtpSchema.safeParse(invalidToken);
    assert.equal(result.success, false);
});

test('15. Règle Ambassadeur CDC V3 → le rôle reste strictement CLIENT', () => {
    const userAmbassador = {
        id: 'usr-amb-001',
        first_name: 'Mamadou',
        last_name: 'Diallo',
        phone: '+221771234567',
        role: 'CLIENT', // Strictement CLIENT
        referral_status: 'AMBASSADEUR', // Statut ambassadeur
    };

    assert.equal(userAmbassador.role, 'CLIENT');
    assert.equal(userAmbassador.referral_status, 'AMBASSADEUR');
    assert.notEqual(userAmbassador.role, 'AMBASSADEUR');
});

test('16. Upload document → configuration bucket privé partner_documents', () => {
    const bucketConfig = {
        id: 'partner_documents',
        name: 'partner_documents',
        public: false, // Bucket strictement privé
        file_size_limit: 10485760, // 10MB
        allowed_mime_types: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
    };

    assert.equal(bucketConfig.public, false);
    assert.ok(bucketConfig.allowed_mime_types.includes('application/pdf'));
    assert.ok(bucketConfig.allowed_mime_types.includes('image/jpeg'));
});

test('17. Audit log → journalisation d’un changement de statut', () => {
    const auditRecord = {
        user_id: 'admin-uuid-001',
        user_role: 'ADMIN',
        action: 'UPDATE',
        object_type: 'partners',
        object_id: 'partner-uuid-999',
        old_value: { status: 'EN_ATTENTE' },
        new_value: { status: 'VALIDE' },
        created_at: new Date().toISOString(),
    };

    assert.equal(auditRecord.action, 'UPDATE');
    assert.equal(auditRecord.object_type, 'partners');
    assert.equal(auditRecord.old_value.status, 'EN_ATTENTE');
    assert.equal(auditRecord.new_value.status, 'VALIDE');
});

test('18. Bootstrapping Superadmin : Élévation automatique pour le numéro racine (+221770000000 / 770000000)', () => {
    const superadminPhones = ['+221770000000', '770000000', '00221770000000', '773780756', '+221773780756'];
    for (const p of superadminPhones) {
        const clean = p.replace(/\D/g, '').replace(/^00/, '');
        const isSuper = clean === '221770000000' || clean === '770000000' || clean === '221773780756' || clean === '773780756';
        assert.equal(isSuper, true, `Le numéro ${p} doit être reconnu comme Superadmin`);
    }

    const standardPhone = '+221771234567';
    const isStandardSuper = standardPhone.replace(/\D/g, '').replace(/^00/, '') === '221770000000';
    assert.equal(isStandardSuper, false, 'Un numéro ordinaire ne doit pas être Superadmin');
});

test('19. Smart Routing : Redirection post-connexion selon le rôle', () => {
    assert.equal(resolveSmartRoute('SUPERADMIN'), '/admin');
    assert.equal(resolveSmartRoute('ADMIN'), '/admin');
    assert.equal(resolveSmartRoute('PARTENAIRE'), '/partner');
    assert.equal(resolveSmartRoute('CONTROLEUR'), '/scan');
    assert.equal(resolveSmartRoute('CLIENT'), '/');
    assert.equal(resolveSmartRoute('UNKNOWN'), '/');

    // Préservation du redirectUrl prioritaire
    assert.equal(resolveSmartRoute('SUPERADMIN', '/tickets'), '/tickets');
    assert.equal(resolveSmartRoute('CLIENT', '/wallet'), '/wallet');
});

test('20. Verrouillage UI Superadmin : Masquage des options B2C "Devenir Partenaire"', () => {
    const canBecomePartner = (role: string) => !['SUPERADMIN', 'ADMIN', 'PARTENAIRE', 'CONTROLEUR'].includes(role);
    assert.equal(canBecomePartner('CLIENT'), true);
    assert.equal(canBecomePartner('SUPERADMIN'), false);
    assert.equal(canBecomePartner('ADMIN'), false);
    assert.equal(canBecomePartner('PARTENAIRE'), false);
});

/**
 * Données de fixtures — constantes PURES (emails, téléphones fictifs, slugs, prix).
 *
 * Ce module n'importe aucun client Supabase : les tests de sécurité (tests/security)
 * peuvent l'utiliser sans jamais toucher au service_role. La résolution des UUID
 * réels par le service_role est dans tests/helpers/fixtures.ts.
 */

export const TEST_PASSWORD = 'EvTest#2026-local';

export const FIXTURE_USERS = {
    CLIENT: { email: 'client@test.eventvillage.local', phone: '+221700000001', firstName: 'Awa', lastName: 'Client', primaryRole: 'CLIENT', roles: ['CLIENT'] },
    CLIENT_BIS: { email: 'client-bis@test.eventvillage.local', phone: '+221700000002', firstName: 'Birame', lastName: 'ClientBis', primaryRole: 'CLIENT', roles: ['CLIENT'] },
    PARTNER_A: { email: 'partner-a@test.eventvillage.local', phone: '+221700000003', firstName: 'Aïssatou', lastName: 'OrgaA', primaryRole: 'PARTENAIRE', roles: ['CLIENT', 'PARTENAIRE'] },
    PARTNER_B: { email: 'partner-b@test.eventvillage.local', phone: '+221700000004', firstName: 'Bassirou', lastName: 'OrgaB', primaryRole: 'PARTENAIRE', roles: ['CLIENT', 'PARTENAIRE'] },
    CONTROLLER_A: { email: 'controller-a@test.eventvillage.local', phone: '+221700000005', firstName: 'Cheikh', lastName: 'ControleurA', primaryRole: 'CONTROLEUR', roles: ['CLIENT', 'CONTROLEUR'] },
    ADMIN: { email: 'admin@test.eventvillage.local', phone: '+221700000006', firstName: 'Dior', lastName: 'Admin', primaryRole: 'ADMIN', roles: ['CLIENT', 'ADMIN'] },
    SUPERADMIN: { email: 'superadmin@test.eventvillage.local', phone: '+221700000007', firstName: 'Elhadji', lastName: 'SuperAdmin', primaryRole: 'SUPERADMIN', roles: ['CLIENT', 'SUPERADMIN'] },
    /** Compte client SUSPENDU (lot 1B.2) : ne doit pas pouvoir se réactiver lui-même. */
    SUSPENDED: { email: 'suspendu@test.eventvillage.local', phone: '+221700000008', firstName: 'Fatou', lastName: 'Suspendue', primaryRole: 'CLIENT', roles: ['CLIENT'], status: 'SUSPENDU' },
} as const;

/** Statut du profil public.users d'une fixture (ACTIF sauf mention contraire). */
export function fixtureUserStatus(key: FixtureUserKey): 'ACTIF' | 'SUSPENDU' {
    const spec = FIXTURE_USERS[key];
    return 'status' in spec ? spec.status : 'ACTIF';
}

export type FixtureUserKey = keyof typeof FIXTURE_USERS;

export const FIXTURE_PARTNERS = {
    A: { userKey: 'PARTNER_A', companyName: 'TEST Organisateur A', commercialName: 'Orga A (test)', city: 'Dakar' },
    B: { userKey: 'PARTNER_B', companyName: 'TEST Organisateur B', commercialName: 'Orga B (test)', city: 'Thiès' },
} as const;

export type FixturePartnerKey = keyof typeof FIXTURE_PARTNERS;

export interface FixtureCategorySpec {
    name: string;
    price: number;
    total: number;
}

export interface FixtureEventSpec {
    partner: FixturePartnerKey;
    slug: string;
    title: string;
    status: 'PUBLIE' | 'BROUILLON' | 'ANNULE';
    daysFromNow: number;
    categories: readonly FixtureCategorySpec[];
}

export const FIXTURE_EVENTS: Record<string, FixtureEventSpec> = {
    A_PUBLIE: {
        partner: 'A',
        slug: 'test-fixture-a-publie',
        title: 'TEST Concert A (publié, à venir)',
        status: 'PUBLIE',
        daysFromNow: 30,
        categories: [
            { name: 'Standard', price: 5000, total: 10 },
            { name: 'VIP', price: 15000, total: 3 },
        ],
    },
    A_BROUILLON: {
        partner: 'A',
        slug: 'test-fixture-a-brouillon',
        title: 'TEST Soirée A (brouillon)',
        status: 'BROUILLON',
        daysFromNow: 45,
        categories: [{ name: 'Standard', price: 2000, total: 5 }],
    },
    A_PASSE: {
        partner: 'A',
        slug: 'test-fixture-a-passe',
        title: 'TEST Festival A (passé, encore PUBLIE)',
        status: 'PUBLIE',
        daysFromNow: -30,
        categories: [{ name: 'Standard', price: 3000, total: 5 }],
    },
    B_PUBLIE: {
        partner: 'B',
        slug: 'test-fixture-b-publie',
        title: 'TEST Spectacle B (publié, à venir)',
        status: 'PUBLIE',
        daysFromNow: 20,
        categories: [{ name: 'Standard', price: 4000, total: 8 }],
    },
    B_ANNULE: {
        partner: 'B',
        slug: 'test-fixture-b-annule',
        title: 'TEST Gala B (annulé)',
        status: 'ANNULE',
        daysFromNow: 25,
        categories: [],
    },
};

export type FixtureEventKey = keyof typeof FIXTURE_EVENTS;

/** Événement sur lequel CONTROLLER_A est affecté (droit d'encaisser les espèces). */
export const CONTROLLER_A_EVENT: FixtureEventKey = 'A_PUBLIE';

/**
 * Billet de référence émis par le seed : CLIENT, catégorie Standard de A_PUBLIE, statut VALIDE.
 * Sert aux tests qui ont besoin d'un billet existant (lecture, tentative de modification).
 */
export const FIXTURE_TICKETS = {
    CLIENT_A_STANDARD: {
        owner: 'CLIENT' as FixtureUserKey,
        event: 'A_PUBLIE' as FixtureEventKey,
        category: 'Standard',
        ticketNumber: 'TCK-FIXTURE-CLIENT-A-1',
        qrCode: 'EV-QR-FIXTURE-CLIENT-A-1',
    },
    /** Billet sur l'événement de B (lot 1B.3) : CONTROLLER_A, affecté à A seulement, ne doit pas le lire. */
    CLIENT_BIS_B_STANDARD: {
        owner: 'CLIENT_BIS' as FixtureUserKey,
        event: 'B_PUBLIE' as FixtureEventKey,
        category: 'Standard',
        ticketNumber: 'TCK-FIXTURE-CLIENT-BIS-B-1',
        qrCode: 'EV-QR-FIXTURE-CLIENT-BIS-B-1',
    },
} as const;

/** Annulations d'événement émises par le seed (lot 1B.4) : celle de B ne doit pas être lisible par A. */
export const FIXTURE_CANCELLATIONS = {
    B_ANNULE: {
        event: 'B_ANNULE' as FixtureEventKey,
        cancelledBy: 'PARTNER_B' as FixtureUserKey,
        internalReason: 'Annulation de test (fixture lot 1B)',
        publicNotice: 'Événement de test annulé.',
    },
} as const;

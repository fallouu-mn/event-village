/**
 * Permissions d'administration (liste unique). Lot 9 quinquies : module sans dépendance serveur, importable par un
 * composant client (app/admin/users/page.tsx) ; lib/admin/admin-auth.ts la réexporte.
 */
export const ADMIN_PERMISSIONS = [
    'users.read',
    'users.write',
    'partners.read',
    'partners.validate',
    'partners.suspend',
    'events.read',
    'events.write',
    'payments.read',
    'refunds.manage',
    'referrals.manage',
    'communications.manage',
    'statistics.read',
    'pricing.manage',
    // Lot 6 (contrat L1) : supervision de la boîte d'envoi (lecture) et relance d'un envoi en échec
    'notifications.read',
    'notifications.write',
    // Lot 7 (7.0 c, contrat 3.7) : lecture des écarts de caisse consolidés (GET /api/admin/shifts/audit)
    'shifts.read',
    // Lot 9 quater (B4 : AUD-15) : scanner les billets et tenir une caisse sur un événement (ADMIN)
    'access.operate',
    // Lot 9 quater (B5 : AUD-37) : lire les réglages de la plateforme et les tarifs
    'settings.read',
] as const;

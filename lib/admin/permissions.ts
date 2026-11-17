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
    // Finition 3b (E-36) : pricing.manage retiré (« Tarification » : trois clés que rien ne relisait)
    // Lot 6 (contrat L1) : supervision de la boîte d'envoi (lecture) et relance d'un envoi en échec
    'notifications.read',
    'notifications.write',
    // Finition 3b (E-36) : shifts.read retiré (seule route, /api/admin/shifts/audit, appelée par aucun écran ; les écarts
    // de caisse se valident dans l'onglet « Caisse » du pilotage, avec events.write)
    // Lot 9 quater (B4 : AUD-15) : scanner les billets et tenir une caisse sur un événement (ADMIN)
    'access.operate',
    // Lot 9 quater (B5 : AUD-37) : lire les réglages de la plateforme et les tarifs
    'settings.read',
] as const;

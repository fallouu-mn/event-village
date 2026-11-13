/**
 * Lot 9 bis, tâches 11 et 12 (R2, R51 ; contrat 4.2, B34) — libellés français des permissions d'administration.
 *
 * Un code de permission (`events.write`) n'est jamais affiché tel quel : le refus d'une route et la grille des
 * permissions de l'écran passent par ce libellé. Module pur (sans `next/server`), lisible par un composant client.
 */

export const PERMISSION_LABELS: Readonly<Record<string, string>> = {
    'users.read': 'Consulter les comptes',
    'users.write': 'Gérer les comptes',
    'partners.read': 'Consulter les partenaires et leurs contacts',
    'partners.validate': 'Valider les partenaires',
    'partners.suspend': 'Suspendre les partenaires',
    'events.read': 'Consulter les événements',
    'events.write': 'Gérer les événements',
    'payments.read': 'Consulter les paiements',
    'refunds.manage': 'Gérer les remboursements',
    'referrals.manage': 'Gérer le parrainage',
    'communications.manage': 'Gérer les communications',
    'statistics.read': 'Consulter les statistiques',
    'pricing.manage': 'Gérer les tarifs',
    'notifications.read': 'Consulter les envois de messages',
    'notifications.write': 'Relancer les envois de messages',
    'shifts.read': 'Consulter les écarts de caisse',
    // Lot 9 quater (B4, B5) : nouvelles permissions, toujours affichées par leur libellé
    'access.operate': 'Contrôler les entrées et tenir une caisse',
    'settings.read': 'Lire les réglages',
};

/** Libellé d'une permission ; un code inconnu reçoit un libellé générique, jamais le code brut. */
export function permissionLabel(permission: string): string {
    return PERMISSION_LABELS[permission] ?? 'action d’administration';
}

/** Texte du refus PERMISSION_MISSING (contrat 4.2). */
export function permissionMissingMessage(permission: string): string {
    return `Action non autorisée : votre compte n’a pas la permission « ${permissionLabel(permission)} ».`;
}

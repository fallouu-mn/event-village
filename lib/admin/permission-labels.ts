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

/**
 * Finition 3b (E-34, E-36) — ce que chaque droit permet, en une phrase simple (page « Mes droits » et grille des droits).
 * Relu contre les routes : chaque phrase ne promet que ce que la route de la permission ouvre.
 */
export const PERMISSION_DESCRIPTIONS: Readonly<Record<string, string>> = {
    'users.read': 'Voir la liste des comptes et les chercher.',
    'users.write': 'Créer, suspendre, réactiver ou supprimer des comptes de clients et de contrôleurs, jamais un administrateur.',
    'partners.read': 'Voir les candidatures et les dossiers des partenaires : pièces, NINEA, contacts.',
    'partners.validate': 'Valider, refuser ou réactiver un partenaire. Le partenaire en est prévenu.',
    'partners.suspend': 'Suspendre un partenaire. Attention : seul le Superadmin peut le faire, ce droit ne suffit pas à un administrateur.',
    'events.read': 'Voir les événements, leur pilotage, leurs équipes, leurs caisses et les catalogues.',
    'events.write': 'Valider, refuser, suspendre, réactiver, clore ou annuler un événement ; valider un écart de caisse.',
    'payments.read': 'Voir la finance : ce que gagne Event Village, ce qui est dû, les paiements et les créances.',
    'refunds.manage': 'Traiter les versements à reprendre : renvoyer, marquer versé ou constater non versé.',
    'referrals.manage': 'Voir les taux du parrainage.',
    'communications.manage': 'Préparer des campagnes (brouillons seulement).',
    'statistics.read': 'Voir les indicateurs de l’accueil : volume, revenu, nombre de comptes.',
    'notifications.read': 'Voir les envois de SMS, d’emails et de notifications, et recevoir leurs alertes.',
    'notifications.write': 'Relancer un envoi en échec.',
    'access.operate': 'Contrôler les entrées et tenir une caisse sur un événement.',
    'settings.read': 'Lire les réglages de la plateforme ; seul le Superadmin les change.',
};

/** Phrase d'une permission ; un code inconnu reçoit une phrase générique, jamais le code brut. */
export function permissionDescription(permission: string): string {
    return PERMISSION_DESCRIPTIONS[permission] ?? 'Action d’administration.';
}

/** Libellé d'une permission ; un code inconnu reçoit un libellé générique, jamais le code brut. */
export function permissionLabel(permission: string): string {
    return PERMISSION_LABELS[permission] ?? 'action d’administration';
}

/** Texte du refus PERMISSION_MISSING (contrat 4.2). */
export function permissionMissingMessage(permission: string): string {
    return `Action non autorisée : votre compte n’a pas la permission « ${permissionLabel(permission)} ».`;
}

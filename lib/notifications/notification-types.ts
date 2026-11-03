/**
 * Lot 5 (contrat Q) — seule source des libellés des types de notification.
 *
 * La colonne `notifications.type` est un texte libre écrit par le serveur (services, routes, fonctions
 * SQL : EVENT_STATUS, EVENT_CHANGE, REFUND_PROCESSED…). Elle ne s'affiche jamais telle quelle : l'interface
 * lit ici un libellé français et une catégorie (filtres, icône). Un type inconnu donne la catégorie
 * « Informations » et le libellé « Information », jamais la valeur brute.
 */

/** Catégories présentées au lecteur (filtres de la page Notifications, icône de la ligne). */
export const NOTIFICATION_CATEGORIES = ['event', 'ticket', 'payment', 'order', 'account', 'alert', 'info'] as const;
export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];

export const NOTIFICATION_CATEGORY_LABELS: Record<NotificationCategory, string> = {
    event: 'Événements',
    ticket: 'Billets',
    payment: 'Paiements et remboursements',
    order: 'Réservations et commandes',
    account: 'Compte',
    alert: 'Alertes',
    info: 'Informations',
};

export interface NotificationTypeMeta {
    /** Libellé court de la pastille (casse de phrase). */
    label: string;
    category: NotificationCategory;
}

/** Types écrits par le serveur à ce jour (lib/, app/api/, supabase/migrations/). */
export const NOTIFICATION_TYPE_META: Readonly<Record<string, NotificationTypeMeta>> = {
    // Cycle de vie et modification d'un événement (lot 5)
    EVENT_STATUS: { label: 'Statut de l’événement', category: 'event' },
    EVENT_CHANGE: { label: 'Événement modifié', category: 'event' },
    // Billets
    TICKET: { label: 'Billet', category: 'ticket' },
    TICKET_SCANNED: { label: 'Entrée contrôlée', category: 'ticket' },
    // Paiements, remboursements, retraits
    PAYMENT: { label: 'Paiement', category: 'payment' },
    PAYMENT_SUCCESS: { label: 'Paiement confirmé', category: 'payment' },
    REFUND_REQUESTED: { label: 'Remboursement demandé', category: 'payment' },
    REFUND_PROCESSED: { label: 'Remboursement versé', category: 'payment' },
    WITHDRAWAL_PAID: { label: 'Retrait versé', category: 'payment' },
    WITHDRAWAL_REJECTED: { label: 'Retrait refusé', category: 'payment' },
    SUBSCRIPTION_ACTIVATED: { label: 'Abonnement activé', category: 'payment' },
    // Réservations et commandes
    RESERVATION: { label: 'Réservation', category: 'order' },
    HALL_RESERVATION: { label: 'Réservation de salle', category: 'order' },
    TABLE_RESERVATION: { label: 'Réservation de table', category: 'order' },
    ORDER: { label: 'Commande', category: 'order' },
    FOOD_ORDER: { label: 'Commande de restauration', category: 'order' },
    // Compte
    KYC: { label: 'Candidature et pièces', category: 'account' },
    SECURITY: { label: 'Sécurité du compte', category: 'account' },
    REFERRAL: { label: 'Parrainage', category: 'account' },
    // Alertes (organisateur, administration)
    ALERT: { label: 'Alerte', category: 'alert' },
    FINANCE_ALERT: { label: 'Alerte financière', category: 'alert' },
    CASHOUT_ALERT: { label: 'Alerte de versement', category: 'alert' },
    CATEGORY_SOLD_OUT: { label: 'Catégorie complète', category: 'alert' },
    EVENT_FULLY_SOLD_OUT: { label: 'Événement complet', category: 'alert' },
    SMS_DAILY_CAP_REACHED: { label: 'Plafond de SMS atteint', category: 'alert' },
    SMS_NON_OTP_SHARE_REACHED: { label: 'Quota de SMS atteint', category: 'alert' },
    // Informations générales
    SYSTEM: { label: 'Information', category: 'info' },
    COMMUNICATION: { label: 'Message d’Event Village', category: 'info' },
    // Lot 6 (contrat G1) : types in-app écrits par la boîte d'envoi (notification_outbox_mark)
    TICKET_TRANSFER: { label: 'Transfert de billet', category: 'ticket' },
    REMINDER: { label: 'Rappel', category: 'event' },
    SALES: { label: 'Ventes', category: 'event' },
    REFUND_PROGRESS: { label: 'Remboursements de l’annulation', category: 'payment' },
    WITHDRAWAL_PENDING_CHECK: { label: 'Retrait en vérification', category: 'payment' },
    TRIAL: { label: 'Période d’essai', category: 'account' },
    CONTROLLER: { label: 'Contrôle d’accès', category: 'event' },
    ADMIN_REVIEW: { label: 'À valider', category: 'alert' },
    NOTIFICATION_ALERT: { label: 'Envoi en échec', category: 'alert' },
    SMS_DAILY_THRESHOLD: { label: 'Volume de SMS', category: 'alert' },
    PROMOTION: { label: 'Mise en avant', category: 'event' },
};

/** Catégorie connue (filtre `?category=` de GET /api/notifications, onglets de la page). */
export function isNotificationCategory(value: unknown): value is NotificationCategory {
    return typeof value === 'string' && (NOTIFICATION_CATEGORIES as readonly string[]).includes(value);
}

/**
 * Lot 6 (contrat N2) — types d'une catégorie, pour le filtre servi par le serveur. Seuls les types
 * déclarés ici sont retenus : un type inconnu s'affiche « Information » mais n'entre dans aucun filtre de
 * catégorie (il reste visible dans « Toutes » et « Non lues »).
 */
export function notificationTypesOfCategory(category: NotificationCategory): string[] {
    return Object.entries(NOTIFICATION_TYPE_META)
        .filter(([, meta]) => meta.category === category)
        .map(([type]) => type)
        .sort();
}

const UNKNOWN_TYPE_META: NotificationTypeMeta = { label: 'Information', category: 'info' };

/** Libellé et catégorie d'un type de notification ; un type inconnu n'est jamais affiché brut. */
export function notificationTypeMeta(type: unknown): NotificationTypeMeta {
    if (typeof type !== 'string') return UNKNOWN_TYPE_META;
    return Object.prototype.hasOwnProperty.call(NOTIFICATION_TYPE_META, type) ? NOTIFICATION_TYPE_META[type] : UNKNOWN_TYPE_META;
}

export function notificationTypeLabel(type: unknown): string {
    return notificationTypeMeta(type).label;
}

export function notificationCategory(type: unknown): NotificationCategory {
    return notificationTypeMeta(type).category;
}

/**
 * Lot 6 (contrat C4, L4) — libellés humains de la boîte d'envoi : statuts, canaux, motifs (liste fermée de
 * C4) et types (registre public.notification_types, table G2). Aucun code technique n'est affiché : l'écran
 * admin et l'API lisent ces tables. Les tons des statuts servent au badge (domaine « notification »).
 */

export type OutboxStatus = 'PENDING' | 'SENDING' | 'SENT' | 'FAILED' | 'SKIPPED' | 'CANCELLED' | 'UNCERTAIN';
export type OutboxChannel = 'IN_APP' | 'SMS' | 'EMAIL' | 'PUSH';
export type OutboxTone = 'neutral' | 'info' | 'success' | 'danger' | 'muted' | 'warning-strong';

export const OUTBOX_STATUSES: readonly OutboxStatus[] = ['PENDING', 'SENDING', 'SENT', 'FAILED', 'SKIPPED', 'CANCELLED', 'UNCERTAIN'];
export const OUTBOX_CHANNELS: readonly OutboxChannel[] = ['IN_APP', 'SMS', 'EMAIL', 'PUSH'];

export const OUTBOX_STATUS_LABELS: Readonly<Record<OutboxStatus, string>> = {
    PENDING: 'En attente',
    SENDING: "En cours d'envoi",
    SENT: 'Envoyée',
    FAILED: 'En échec',
    SKIPPED: 'Non envoyée',
    CANCELLED: 'Annulée',
    UNCERTAIN: 'Incertaine',
};

/** Tons du badge de statut (L4). */
export const OUTBOX_STATUS_TONES: Readonly<Record<OutboxStatus, OutboxTone>> = {
    PENDING: 'neutral',
    SENDING: 'info',
    SENT: 'success',
    FAILED: 'danger',
    SKIPPED: 'muted',
    CANCELLED: 'muted',
    UNCERTAIN: 'warning-strong',
};

export const OUTBOX_CHANNEL_LABELS: Readonly<Record<OutboxChannel, string>> = {
    IN_APP: 'Application',
    SMS: 'SMS',
    EMAIL: 'Email',
    PUSH: 'Notification push',
};

/** Motifs du contrat C4 (SKIPPED, CANCELLED, FAILED, UNCERTAIN). */
export const OUTBOX_REASON_LABELS: Readonly<Record<string, string>> = {
    // Non envoyée
    PREFERENCE_DISABLED: 'Désactivée dans les préférences du destinataire',
    ACCOUNT_SUSPENDED: 'Compte suspendu',
    // Avant la finition 4 : SMS facultatif de nuit non envoyé (lignes anciennes) ; depuis, reporté à la fin de la plage.
    QUIET_HOURS: 'Plage sans SMS (nuit), ancienne règle',
    // Finition 4 : décision « reporter » (la ligne reste en attente) ; rappel annulé à moins de 30 minutes du début.
    NIGHT: 'Plage de nuit : reporté à sa fin',
    TOO_CLOSE_TO_START: 'Moins de 30 minutes avant le début',
    NO_PHONE: 'Aucun numéro de téléphone',
    NO_REAL_EMAIL: 'Aucune adresse email réelle',
    EMAIL_NOT_CONFIGURED: 'Envoi des emails non configuré',
    PUSH_NOT_CONFIGURED: 'Notifications push non configurées',
    NO_PUSH_SUBSCRIPTION: 'Aucun appareil abonné aux notifications push',
    // Lot 9 bis (R28) : SENT = push accepté par le service push, jamais une preuve d'affichage.
    PUSH_DELIVERED: 'Push accepté par le service, SMS non envoyé (affichage non garanti)',
    SMS_POLICY_NEVER: 'Rappel sans SMS selon les réglages',
    SMS_DAILY_CAP: 'Plafond quotidien de SMS atteint',
    // Lot 7 (7.0 a, 7.0 b) : budget des SMS optionnels ; rappel d'un porteur de billets gratuits seulement.
    SMS_OPTIONAL_CAP: 'Plafond journalier des SMS optionnels atteint',
    FREE_TICKETS_ONLY: 'Billets gratuits seulement : rappel sans SMS',
    SMS_RECIPIENT_CAP: 'Limite de SMS du destinataire atteinte',
    SMS_ACCOUNT_CAP: 'Limite de SMS du compte déclencheur atteinte',
    COUNTER_RECEIPT_CAP: 'Limite de reçus de la caisse atteinte',
    NO_VALID_TICKET: 'Plus de billet valable',
    TITLE_ONLY: 'Seul le titre a changé',
    // Lot « Avis », phase 2 : plafond de 2 SMS d'avis par heure (libellé qui manquait) ; SMS fondu dans un SMS regroupé (2d)
    LAST_HOUR_CAP: 'Déjà 2 SMS sur cet événement dans l’heure',
    GROUPED_ADMIN_SMS: 'Compté dans le SMS regroupé « argent à vérifier »',
    COVERED_BY_INVITATION: "Déjà prévenu par l'invitation",
    SETTING_MISSING: 'Réglage des notifications manquant',
    MIGRATED_NO_PHONE: 'Reprise sans numéro de téléphone',
    // Lot 9 bis (G.52, I1) : adresse email non vérifiée ; destinataire d'un compte de démonstration hors simulation.
    EMAIL_NOT_VERIFIED: 'Adresse email non vérifiée',
    DEMO_ACCOUNT: 'Non envoyé : compte de démonstration',
    // Annulée
    EVENT_SUSPENDU: 'Événement suspendu',
    EVENT_ANNULE: 'Événement annulé',
    EVENT_TERMINE: 'Événement terminé',
    EVENT_RESCHEDULED: "Date de l'événement modifiée",
    EVENT_NOT_PUBLISHED: "Événement qui n'est plus en ligne",
    EVENT_STARTED: 'Événement déjà commencé',
    NO_LONGER_HOLDER: "Billet passé à quelqu'un d'autre",
    NO_LONGER_ASSIGNED: 'Affectation retirée',
    NO_LONGER_RELEVANT: "N'est plus d'actualité",
    SUPERSEDED: 'Remplacée par une notification plus récente',
    // En échec
    SMS_REJECTED: 'SMS refusé par le fournisseur',
    SMS_GUARD_UNAVAILABLE: 'Contrôle des SMS momentanément indisponible',
    SMS_PROVIDER_ERROR: 'Fournisseur SMS indisponible',
    EMAIL_REJECTED: 'Email refusé par le fournisseur',
    EMAIL_PROVIDER_ERROR: "Fournisseur d'emails indisponible",
    PUSH_REJECTED: 'Notification refusée par le service push',
    PUSH_PAYLOAD_TOO_LARGE: 'Notification trop volumineuse',
    PUSH_PROVIDER_ERROR: 'Service push indisponible',
    TEMPLATE_ERROR: 'Contenu du message incomplet',
    SENDING_INTERRUPTED: 'Envoi interrompu',
    // Lot 9 bis (I1) : garde des comptes de démonstration injoignable, la ligne est reprise plus tard (échec fermé).
    DEMO_GUARD_UNAVAILABLE: 'Contrôle des comptes de démonstration indisponible',
    MIGRATED_FAILED: 'Reprise en échec',
    // Incertaine
    PROVIDER_TIMEOUT: 'Délai dépassé : remise non confirmée',
    PROVIDER_UNREADABLE: 'Réponse du fournisseur illisible : remise non confirmée',
    MIGRATED_WHILE_SENDING: "Reprise pendant l'envoi : remise non confirmée",
};

/** Types du registre (table G2). */
export const OUTBOX_TYPE_LABELS: Readonly<Record<string, string>> = {
    PURCHASE_CONFIRMED: 'Confirmation d’achat',
    FREE_TICKETS_CONFIRMED: 'Billets gratuits confirmés',
    COUNTER_RECEIPT: 'Reçu de vente au guichet',
    INVITATION_RECEIVED: 'Invitation reçue',
    TRANSFER_OFFERED: 'Billet transféré',
    TRANSFER_CANCELLED: 'Transfert annulé',
    TRANSFER_EXPIRED: 'Transfert expiré',
    TRANSFER_CLAIMED_SENDER: 'Transfert accepté',
    TRANSFER_RECEIVED: 'Billet reçu',
    TICKET_SCANNED: 'Entrée validée',
    EVENT_CANCELLED: 'Événement annulé',
    EVENT_SUSPENDED_HOLDER: 'Événement suspendu (porteurs)',
    EVENT_REACTIVATED_HOLDER: 'Événement de nouveau en ligne (porteurs)',
    EVENT_CHANGED: 'Événement modifié',
    REMINDER_J1: 'Rappel la veille',
    REMINDER_H3: 'Rappel avant le début',
    REFUND_REQUESTED: 'Remboursement demandé',
    REFUND_PAID: 'Remboursement versé',
    PASSWORD_CHANGED: 'Mot de passe modifié',
    PHONE_CHANGED: 'Numéro de téléphone modifié',
    EMAIL_CLAIMED_ELSEWHERE: 'Adresse email validée par un autre compte',
    PUSH_TEST: "Notification d'essai",
    EVENT_VALIDATED: 'Événement validé',
    EVENT_REJECTED: 'Événement non validé',
    EVENT_SUSPENDED: 'Événement suspendu',
    EVENT_REACTIVATED: 'Événement réactivé',
    EVENT_PUBLISHED_BY_ADMIN: "Événement publié par l'administration",
    FIRST_TICKET_SOLD: 'Premier billet vendu',
    NEW_ORDER: 'Nouvelle commande',
    CATEGORY_SOLD_OUT: 'Catégorie complète',
    EVENT_SOLD_OUT: 'Événement complet',
    SHIFT_DISCREPANCY: 'Écart de caisse',
    WITHDRAWAL_PAID: 'Retrait versé',
    WITHDRAWAL_REJECTED: 'Retrait refusé',
    WITHDRAWAL_UNCERTAIN: 'Retrait en vérification',
    CANCEL_REFUNDS_DONE: "Remboursements de l'annulation terminés",
    CANCEL_REFUNDS_BLOCKED: "Remboursements de l'annulation en attente",
    PARTNER_REGISTERED_ACK: 'Inscription partenaire reçue',
    PARTNER_VALIDATED: 'Compte partenaire validé',
    PARTNER_REJECTED: 'Demande partenaire refusée',
    PARTNER_SUSPENDED: 'Compte partenaire suspendu',
    PARTNER_REACTIVATED: 'Compte partenaire réactivé',
    TRIAL_STARTED: "Période d'essai activée",
    SUBSCRIPTION_ACTIVATED: 'Abonnement activé',
    PAYMENT_SUCCESS: 'Paiement confirmé',
    // Finition 4
    SALES_UPDATE_SMS: 'Ventes groupées par SMS',
    PARTNER_DAILY_SUMMARY: 'Résumé du matin',
    ENTRY_WELCOME: 'Bienvenue à l’entrée',
    ENTRY_THANKS: 'Merci du lendemain',
    PARTNER_REFUND_REQUESTS: 'Remboursements demandés par des clients',
    HALL_RESERVATION_REQUESTED: 'Nouvelle réservation de salle',
    HALL_RESERVATION_CONFIRMED: 'Réservation de salle confirmée',
    HALL_RESERVATION_CANCELLED: 'Réservation de salle annulée',
    HALL_RESERVATION_CANCELLED_PRO: 'Réservation de salle annulée (salle)',
    HALL_BALANCE_PAID: 'Solde d’une réservation de salle payé',
    HALL_BALANCE_REMINDER: 'Rappel du solde d’une réservation de salle',
    HALL_PAYMENT_DEADLINE_PASSED: 'Délai de paiement d’une réservation de salle dépassé',
    HALL_PAYMENT_REFUNDED: 'Paiement de salle remboursé',
    HALL_VALIDATION_DECIDED: 'Décision sur une salle',
    HALL_RESERVATION_PENDING: 'Réservation de salle demandée',
    HALL_EVE_REMINDER: 'Rappel la veille d’une réservation de salle',
    HALL_EARNINGS_AVAILABLE: 'Recettes d’une réservation de salle disponibles',
    HALL_REFUND_PAID: 'Remboursement d’une réservation de salle versé',
    ADMIN_HALL_SUBMITTED: 'Salle à valider',
    ADMIN_HALL_CHANGED: 'Salle validée modifiée',
    ADMIN_PERMISSIONS_CHANGED: 'Droits d’administration modifiés',
    ADMIN_PERMISSIONS_ALERT: 'Droits d’un administrateur modifiés (super-administrateurs)',
    TABLE_RESERVATION_CONFIRMED: 'Réservation de table confirmée',
    TABLE_REQUEST_SENT: 'Demande de table envoyée',
    TABLE_REQUEST_TO_ANSWER: 'Demande de table à accepter',
    TABLE_NEW_RESERVATION: 'Nouvelle réservation de table',
    TABLE_REQUEST_REFUSED: 'Demande de table refusée',
    TABLE_REQUEST_EXPIRED: 'Demande de table sans réponse',
    TABLE_HOLD_EXPIRED: 'Acompte de table non payé à temps',
    TABLE_RESERVATION_CANCELLED: 'Réservation de table annulée',
    TABLE_RESERVATION_CANCELLED_PRO: 'Réservation de table annulée (établissement)',
    TABLE_NO_SHOW: 'Absence à une réservation de table',
    TABLE_PAYMENT_REFUNDED: 'Paiement de table remboursé',
    TABLE_REMINDER: 'Rappel de réservation de table',
    TABLE_CLIENT_COMING: 'Client qui confirme sa venue',
    TABLE_REFUND_PAID: 'Remboursement d’une table versé',
    EVENT_TABLE_CONFIRMED: 'Table d’un événement réservée',
    EVENT_TABLE_SOLD: 'Table d’un événement vendue',
    EVENT_TABLE_SEATS_REMINDER: 'Places de table à envoyer',
    ADMIN_EVENT_TABLES_CHANGED: 'Tables modifiées après validation',
    VENUE_VALIDATION_DECIDED: 'Décision sur un établissement',
    PROMOTION_DECIDED: 'Mise en avant décidée',
    CONTROLLER_ASSIGNED: 'Affectation de contrôle',
    CONTROLLER_UNASSIGNED: 'Affectation de contrôle retirée',
    CONTROLLER_REMINDER: 'Rappel de contrôle la veille',
    SHIFT_CLOSED_BY_OTHER: 'Caisse fermée par un tiers',
    CONTROLLER_ACTIVATED: 'Compte de contrôle activé',
    ADMIN_EVENT_SUBMITTED: 'Événement à valider',
    ADMIN_VENUE_SUBMITTED: 'Établissement à valider',
    // Lot 12a : commandes
    ORDER_RECEIVED: 'Commande reçue',
    ORDER_ACCEPTED: 'Commande acceptée',
    ORDER_PREPARING: 'Commande en préparation',
    ORDER_READY: 'Commande prête',
    ORDER_ON_THE_WAY: 'Commande en route',
    ORDER_HANDED_OVER: 'Commande remise',
    ORDER_CANCELLED: 'Commande annulée',
    ORDER_PAYMENT_REFUNDED: 'Paiement de commande remboursé',
    ORDER_REFUND_PAID: 'Remboursement de commande versé',
    ORDER_PICKUP_REMINDER: 'Commande à retirer',
    ORDER_NOT_COLLECTED: 'Commande non retirée',
    ORDER_NEW: 'Nouvelle commande à accepter',
    ORDER_CANCELLED_PRO: 'Commande annulée (établissement)',
    ORDER_HANDED_OVER_PRO: 'Commande remise par le livreur',
    ORDER_COURIER_ASSIGNED: 'Livraison confiée',
    ORDER_COURIER_CANCELLED: 'Livraison annulée',
    ORDER_COURIER_INVITED: 'Invitation à livrer',
    // Contre-vérification du lot 12c (point 7)
    ORDER_CODE_LOCKED: 'Code de remise bloqué',
    ORDER_RESPONSE_REMINDER: 'Commande sans réponse',
    ORDER_PREP_REMINDER: 'Commande programmée à préparer',
    ORDER_READY_COURIER: 'Commande prête à livrer',
    ORDER_SCHEDULED_REMINDER: 'Commande programmée bientôt',
    // Lot 12c : vérification des produits
    ADMIN_PRODUCT_REVIEW: 'Produit à vérifier',
    PRODUCT_REVIEW_DECIDED: 'Produit vérifié',
    PRODUCT_DECISION_SMS: 'SMS : produit vérifié',
    ADMIN_ORDER_REFUND_BLOCKED: 'SMS : remboursement de commande à reprendre',
    ADMIN_PRODUCTS_REVIEW_BATCH: 'Produits déjà en vente à vérifier',
    // Lot « Avis », phase 2 (2c)
    WITHDRAWAL_REQUESTED: 'Demande de retrait enregistrée',
    PARTNER_RESUBMITTED_ACK: 'Dossier complété envoyé',
    SHIFT_DISCREPANCY_VALIDATED: 'Caisse validée',
    CONTROLLER_POST_CHANGED: 'Poste du contrôleur modifié',
    ACCOUNT_WELCOME: 'Bienvenue après l’inscription',
    // Lot « Avis », phase 2 (2d)
    ADMIN_MONEY_SMS: 'SMS : argent à vérifier',
    // Lot « Avis », phase 2 (2f, 2g, D8)
    REFERRAL_SIGNUP: 'Nouveau filleul',
    REFERRAL_EARNED: 'Commissions de parrainage de la veille',
    REFERRAL_AVAILABLE: 'Commissions de parrainage disponibles',
    PAYMENT_NOT_COMPLETED: 'Paiement non abouti',
    ACCOUNT_ANONYMIZATION_NOTICE: 'Compte supprimé par l’équipe (avis avant l’effacement)',
    ADMIN_PARTNER_REGISTERED: 'Nouvelle candidature partenaire',
    ADMIN_REFUND_TO_RETRY: 'Remboursement à reprendre',
    ADMIN_DUPLICATE_PAYMENT: 'Paiement en double remboursé',
    ADMIN_CASHOUT_UNCERTAIN: 'Versement incertain',
    ADMIN_WITHDRAWAL_REJECTED: "Retrait refusé par l'opérateur ou constaté non versé",
    ADMIN_FINANCE_DEBT: 'Créance sur un compte',
    ADMIN_NOTIFICATION_FAILED: 'Notification en échec',
    ADMIN_SMS_DAILY_THRESHOLD: 'Volume de SMS indispensables élevé',
    ADMIN_SMS_CAP_GLOBAL: 'Plafond de SMS atteint',
    ADMIN_SMS_CAP_NON_OTP: 'Quota de SMS hors codes atteint',
    ADMIN_SMS_CAP_NEW_NUMBERS: 'Codes d’inscription : part du jour atteinte',
    ADMIN_SMS_OPTIONAL_80: 'SMS optionnels à 80 % du plafond',
    ADMIN_SMS_FORECAST: 'Rappels de demain au-delà du budget SMS',
    OTP_LOGIN: 'Code de connexion',
    OTP_REGISTER: "Code d'inscription",
    OTP_PASSWORD_RESET: 'Code de réinitialisation du mot de passe',
    OTP_WITHDRAWAL: 'Code de confirmation de retrait',
    OTP_PHONE_CHANGE: 'Code de changement de numéro',
    OTP_AUTH_HOOK: 'Code de connexion (authentification)',
    CONTROLLER_INVITE: "Invitation d'un contrôleur",
    ACCOUNT_ACTIVATION: "Lien d'activation d'un compte",
    OTP_ADMIN: 'Code administrateur',
    // Lot 9 bis (contrat 11.1, N1 à N26)
    REFUND_DELAYED: 'Remboursement retardé',
    WITHDRAWAL_DELAYED: 'Retrait retardé',
    ADMIN_CASHOUT_TO_RESUME: 'Versement à reprendre',
    PAYMENT_REFUND_STARTED: 'Remboursement d’un paiement',
    ADMIN_PARTNER_RESUBMITTED: 'Dossier partenaire complété',
    EVENT_CLOSED_HOLDER: 'Événement suspendu clos (porteurs)',
    EVENT_CLOSED_BY_ADMIN: "Événement clos par l'administration",
    SHIFT_OPEN_AT_END: 'Caisse encore ouverte à la fin',
    TRANSFER_REVOKED: 'Transfert annulé par un remboursement',
    TRANSFER_DECLINED_SENDER: 'Transfert refusé',
    TRANSFER_RECIPIENT_CHANGED: 'Transfert annulé : numéro du destinataire changé',
    CONTROLLER_INVITATION: 'Invitation à contrôler l’entrée',
    CONTROLLER_INVITATION_ACCEPTED: 'Invitation de contrôleur acceptée',
    CONTROLLER_INVITATION_DECLINED: 'Invitation de contrôleur refusée',
    CONTROLLER_INVITATION_EXPIRED: 'Invitation de contrôleur sans réponse',
    CONTROLLER_BECAME_ADMIN: 'Contrôleur devenu administrateur',
    EVENT_CANCELLED_BY_ADMIN: "Événement annulé par l'administration",
    ADMIN_EVENT_CANCELLED: "Événement annulé par l'organisateur",
    CONTROLLER_EVENT_CANCELLED: 'Contrôle annulé',
    CONTROLLER_EVENT_CHANGED: 'Contrôle modifié',
    CONTROLLER_EVENT_STATUS: 'Suspension ou reprise d’un contrôle',
    TICKET_CANCELLED: 'Billet ou invitation annulé',
    ACCOUNT_SUSPENDED: 'Compte suspendu',
    ACCOUNT_REACTIVATED: 'Compte réactivé',
    ADMIN_EVENT_CHANGED: 'Événement modifié après validation',
    EVENT_SUBMITTED_ACK: 'Événement envoyé en validation',
    EVENT_FINISHED: 'Événement terminé',
    CLOSING_REPORT_READY: 'Rapport de clôture prêt',
    FUNDS_AVAILABLE: 'Recettes disponibles',
    EMAIL_VERIFICATION: "Lien de vérification de l'adresse email",
    // Lot 9 ter (contrat 11.2 N1 à N4)
    TICKET_REFUNDED_HOLDER: 'Billet transféré annulé (détenteur)',
    ADMIN_EVENT_PUBLISHED: 'Événement publié par l’organisateur',
    ADMIN_EVENT_WITHDRAWN: 'Soumission retirée par l’organisateur',
    SCAN_REFUSALS_ALERT: 'Refus en série à une porte',
    // Lot 9 quinquies (D1)
    ADMIN_REVIEW_SMS: 'SMS aux administrateurs : à valider',
    ACCOUNT_LOGIN_FAILURES: 'Essais de connexion échoués',
    EMAIL_ADDED: 'Adresse email ajoutée au compte',
    // Finition 3d (recours et suppléance)
    CASH_REFUND_MARKED_BY_ADMIN: 'Espèces marquées rendues par l’administration',
    SUPERADMIN_PROMOTED: 'Nouveau super-administrateur (alerte)',
    ADMIN_BACKUP_CODE_USED: 'Code de secours utilisé (alerte)',
    ADMIN_PHONE_CHANGED: 'Numéro d’un administrateur remplacé (ancien numéro)',
    ADMIN_PHONE_CONFIRMED: 'Numéro d’un administrateur confirmé (nouveau numéro)',
    OTP_ADMIN_PHONE: 'Code au nouveau numéro d’un administrateur',
    ORDER_HANDOVER_CODE: 'Code de remise d’une commande',
};

export function outboxStatusLabel(status: string): string {
    return (OUTBOX_STATUS_LABELS as Record<string, string>)[status] ?? 'Statut inconnu';
}

export function outboxChannelLabel(channel: string): string {
    return (OUTBOX_CHANNEL_LABELS as Record<string, string>)[channel] ?? 'Canal inconnu';
}

export function outboxReasonLabel(reason: string | null | undefined): string | null {
    if (!reason) return null;
    return OUTBOX_REASON_LABELS[reason] ?? 'Motif non répertorié';
}

export function outboxTypeLabel(type: string): string {
    return OUTBOX_TYPE_LABELS[type] ?? 'Notification';
}

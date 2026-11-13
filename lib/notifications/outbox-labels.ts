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
    QUIET_HOURS: 'Plage sans SMS (nuit)',
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
    HALL_RESERVATION_REQUESTED: 'Demande de réservation de salle',
    HALL_RESERVATION_CONFIRMED: 'Réservation de salle confirmée',
    HALL_RESERVATION_CANCELLED: 'Réservation de salle annulée',
    PROMOTION_DECIDED: 'Mise en avant décidée',
    CONTROLLER_ASSIGNED: 'Affectation de contrôle',
    CONTROLLER_UNASSIGNED: 'Affectation de contrôle retirée',
    CONTROLLER_REMINDER: 'Rappel de contrôle la veille',
    SHIFT_CLOSED_BY_OTHER: 'Caisse fermée par un tiers',
    CONTROLLER_ACTIVATED: 'Compte de contrôle activé',
    ADMIN_EVENT_SUBMITTED: 'Événement à valider',
    ADMIN_PARTNER_REGISTERED: 'Nouvelle candidature partenaire',
    ADMIN_REFUND_TO_RETRY: 'Remboursement à reprendre',
    ADMIN_DUPLICATE_PAYMENT: 'Paiement en double remboursé',
    ADMIN_CASHOUT_UNCERTAIN: 'Versement incertain',
    ADMIN_WITHDRAWAL_REJECTED: "Retrait refusé par l'opérateur",
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

/**
 * Finition 3b (E-37) — libellés français du journal d'audit (/admin/audit) : action, objet et rôle de l'auteur ne sont
 * jamais montrés par leur code. Table de la revue d'ergonomie (section 5.2) ; une action inconnue dit « Autre action »,
 * un objet inconnu « Autre », un auteur sans rôle « Automatique ». Module pur, lisible par un composant client.
 */
import { ROLE_LABELS } from './account';

export const AUDIT_ACTION_LABELS: Readonly<Record<string, string>> = {
    CREATE_USER: 'Compte créé',
    UPDATE_USER: 'Compte modifié (statut ambassadeur)',
    ROLES_SET: 'Rôles du compte changés',
    USER_STATUS_SET: 'Compte suspendu ou réactivé',
    ANONYMIZE_USER: 'Compte supprimé (données effacées)',
    ANONYMIZE_USER_CLEANUP_FAILED: 'Suppression incomplète',
    USER_SESSIONS_REVOKED: 'Déconnexion de tous les appareils',
    UPDATE_PERMISSIONS: 'Droits d’un administrateur changés',
    SUPERADMIN_BOOTSTRAP: 'Premier Superadmin créé',
    UNAUTHORIZED_ACCESS_ATTEMPT: 'Tentative d’accès refusée',
    PARTNER_REGISTRATION: 'Candidature de partenaire déposée',
    PARTNER_DOSSIER_RESUBMITTED: 'Dossier complété après refus',
    PARTNER_STATUS_SET: 'Partenaire validé, refusé, suspendu ou réactivé',
    PARTNER_DOCUMENT_VIEWED: 'Pièce d’un dossier consultée',
    EVENT_CREATED: 'Événement créé',
    EVENT_UPDATED: 'Événement modifié',
    EVENT_LIVE_UPDATED: 'Événement modifié en ligne',
    EVENT_ZONES_UPDATED: 'Zones et portes modifiées',
    CATEGORY_CREATED: 'Catégorie de billets ajoutée',
    CATEGORY_UPDATED: 'Catégorie de billets modifiée',
    CATEGORY_DELETED: 'Catégorie de billets supprimée',
    TICKET_INVITATIONS_SENT: 'Invitations envoyées',
    TICKET_INVITATION_CANCELLED: 'Invitation annulée',
    TICKET_INVITATION_GUEST_NAMED: 'Nom d’invité saisi',
    TICKET_CANCELLED: 'Billet annulé',
    TICKET_REFUND_REQUESTED: 'Remboursement d’un billet demandé',
    ACCOUNT_PHONE_CHANGED: 'Numéro changé',
    ACCOUNT_EMAIL_VERIFIED: 'Email vérifié',
    ACCOUNT_PASSWORD_CHANGED: 'Mot de passe changé',
    ACCOUNT_PROFILE_UPDATED: 'Profil modifié',
    FIRST_ACTIVATION: 'Première activation du compte',
    CASHOUT_RESENT: 'Versement renvoyé',
    CASHOUT_MARKED_PAID: 'Versement marqué versé',
    CASHOUT_NOT_SENT: 'Versement constaté non versé',
    CASHOUT_UNCERTAIN: 'Versement à l’issue incertaine',
    CASHOUT_BATCH_PARTIAL: 'Lot de versements incomplet',
    CASH_COLLECTED: 'Espèces encaissées',
    CASH_REFUND_MARKED: 'Remboursement en espèces noté',
    COUNTER_SALE: 'Vente au guichet',
    SHIFT_OPENED: 'Caisse ouverte',
    SHIFT_CLOSED: 'Caisse clôturée',
    FINANCE_ALERT: 'Alerte financière',
    ADMIN_FINANCE_DEBT: 'Créance sur un compte',
    REFERRAL_COMMISSION_DEFERRED: 'Commission de parrainage reportée',
    CONTROLLER_INVITATION_CREATED: 'Invitation de contrôleur envoyée',
    CONTROLLER_INVITATION_ACCEPTED: 'Invitation de contrôleur acceptée',
    CONTROLLER_INVITATION_DECLINED: 'Invitation de contrôleur refusée',
    CONTROLLER_ASSIGNMENTS_UPDATED: 'Affectations de contrôleurs changées',
    CONTROLLER_GATE_CHANGED: 'Porte d’un contrôleur changée',
    CONTROLLER_GATE_SET: 'Porte d’un contrôleur changée',
    CONTROLLER_CASH_PERMISSION_SET: 'Droit d’encaisser changé',
    CONTROLLER_ACCOUNT_ACTIVATED: 'Compte contrôleur activé',
    CONTROLLER_REMOVED: 'Contrôleur retiré',
    CONTROLLER_REMOVED_ALL: 'Contrôleur retiré de toute l’équipe',
    CONTROLLER_DELETED: 'Contrôleur supprimé',
    REGISSEUR_PIN_REGENERATED: 'Code PIN du régisseur changé',
    MANUAL_LOOKUP: 'Billet recherché par son numéro',
    GUEST_LIST_SEARCH: 'Liste des invités consultée',
    SCAN_FORBIDDEN: 'Scan refusé (droits)',
    NOTIFICATION_RETRY: 'Envoi relancé',
    SAVE_COMMUNICATION_DRAFT: 'Brouillon de campagne enregistré',
    UPDATE_SERVICE_STATUS: 'Service activé ou désactivé',
    UPDATE_PRICING: 'Tarif modifié (ancienne page Tarification)',
    ACCOUNT_AUTH_DESYNC: 'Incohérence du compte de connexion',
};

export const AUDIT_OBJECT_LABELS: Readonly<Record<string, string>> = {
    users: 'Compte',
    partners: 'Partenaire',
    events: 'Événement',
    cashouts: 'Versement',
    payments: 'Paiement',
    platform_settings: 'Réglage',
    admin_permissions: 'Droits',
    campaigns: 'Campagne',
};

/** Actions proposées au filtre du journal (les plus utiles au Superadmin), dans l'ordre de la liste. */
export const AUDIT_ACTION_FILTER: readonly string[] = [
    'USER_STATUS_SET', 'ROLES_SET', 'UPDATE_PERMISSIONS', 'PARTNER_STATUS_SET', 'EVENT_UPDATED', 'CASHOUT_MARKED_PAID',
    'CASHOUT_NOT_SENT', 'ANONYMIZE_USER', 'UNAUTHORIZED_ACCESS_ATTEMPT',
];

export function auditActionLabel(action: string | null | undefined): string {
    return (action && AUDIT_ACTION_LABELS[action]) || 'Autre action';
}

export function auditObjectLabel(object: string | null | undefined): string {
    return (object && AUDIT_OBJECT_LABELS[object]) || 'Autre';
}

/** Rôle de l'auteur au moment de l'action ; sans rôle (automate, migration) : « Automatique ». */
export function auditActorRoleLabel(role: string | null | undefined): string {
    if (!role || role === 'SYSTEM') return 'Automatique';
    return ROLE_LABELS[role] ?? 'Rôle inconnu';
}

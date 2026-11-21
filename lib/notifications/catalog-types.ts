/**
 * Lot 6 (contrat G1, G2) — types du catalogue des notifications : canaux, types, et données de chaque
 * modèle (`notification_outbox.template_data`).
 *
 * Noms des variables fixés par le contrat et par les tests rouges (lot6-red-results, « canaux ») :
 * title, location, city, start_at (ISO), event_id ; ticket_count, service_fee, total ; amount, reference ;
 * operator (code WAVE | ORANGE_MONEY) ; expires_at ; refund_mode (AUTO | ORGANIZER | NONE) ;
 * changed_fields (colonnes du lot 5) avec new_start_at, new_end_at, new_location, new_address, old_title ;
 * reason ; company ; category ; days ; controller_name, difference (signé) ; entry_point (null : absent),
 * can_accept_cash, events (affectations regroupées dans un SMS, l'affectation principale comprise).
 * Ajoutés ici (le contrat les laisse ouverts) : account_kind (ORGANISATEUR | PARRAINAGE, lien des
 * retraits), closed_by (PARTNER | ADMIN), cashout_status (ECHOUE | BLOQUE), blocked_reason, plan, hall_name,
 * start_date / end_date (réservation de salle), recipient_role (CLIENT | PARTNER), status (promotion),
 * failed_type / channel / attempts (envoi en échec), day / count / threshold (volume de SMS), cap / limit
 * (plafond), entry_type / debt (créance).
 * Lot 7 (7.9) : categories / ticket_numbers (confirmations d'achat et de billets gratuits), ticket_number /
 * category (billet reçu par transfert).
 * Lot 9 bis (contrat 11.1, 11.2 ; noms fixés ici pour les émetteurs de la vague S3) :
 *  - EVENT_CANCELLED : refund_mode += TRANSFERRED (billet reçu par transfert, R13) ; recipient_kind = 'PHONE' pour une
 *    ligne « numéro seul » (invitation non réclamée, acheteur au guichet, transfert révoqué : SMS sans lien, R12, R23) ;
 *  - EVENT_CHANGED : refund_open (report qui ouvre un remboursement, R32), address_cleared (adresse retirée, R80) ;
 *  - TICKET_SCANNED : ticket_count, payment_id (avis regroupé par commande, R78) ;
 *  - PAYMENT_REFUND_STARTED : duplicate_of (variante « double ») ; ADMIN_CASHOUT_TO_RESUME : kind (nature du
 *    versement), cause (DELAYED | BLOCKED), blocked_reason ; SHIFT_OPEN_AT_END : open_shifts ;
 *  - CONTROLLER_INVITATION : invitation_id, company, expires_at, events ; CONTROLLER_INVITATION_ACCEPTED, _DECLINED,
 *    _EXPIRED (finition 1) : invitation_id, controller_name, events ; CONTROLLER_EVENT_STATUS : status
 *    (SUSPENDU | PUBLIE) ; TICKET_CANCELLED : kind (INVITATION | FREE | CASH) ; ADMIN_EVENT_CHANGED : changes
 *    (TITLE | POSTER | PLACE | DATE | CATEGORY), old_title, category ; motifs : reason (motif interne ou de l'admin),
 *    public_notice (avis public d'une annulation).
 * Lot 9 ter (contrat 11.1, 11.2 N1 à N4, M1 ; noms fixés ici pour les émetteurs des vagues S2 et S4) :
 *  - TICKET_REFUNDED_HOLDER : ticket_id, category (nom de la catégorie du billet) ;
 *  - ADMIN_EVENT_PUBLISHED, ADMIN_EVENT_WITHDRAWN : company ;
 *  - SCAN_REFUSALS_ALERT : gate_name (toujours présent), zone_name (null sans zone), refused_count, window_minutes,
 *    threshold ;
 *  - ADMIN_EVENT_CHANGED : changes += PRICE | CHANNELS, avec old_price, new_price (PRICE) et sale_online, sale_counter
 *    (CHANNELS, valeurs d'après la modification).
 *
 * Jamais de code, de jeton, de QR ni de secret dans ces données (contrainte notification_outbox_no_secret_chk).
 */

export type Channel = 'IN_APP' | 'SMS' | 'EMAIL' | 'PUSH';
export const CHANNELS: readonly Channel[] = ['IN_APP', 'SMS', 'EMAIL', 'PUSH'];

export type Family = 'ESSENTIAL' | 'OPTIONAL';
/** Finition 4 : SALES_SUMMARY (résumé du matin des ventes, partenaires), AFTER_EVENT (merci du lendemain). */
export type Topic = 'REMINDERS' | 'EVENT_UPDATES' | 'PRO_ACTIVITY' | 'SALES_SUMMARY' | 'AFTER_EVENT';
/** Finition 4 : DEFER = non urgent, SMS et push de la nuit reportés à sa fin ; SEND = urgent. */
export type NightPolicy = 'SEND' | 'DEFER';
export type Audience = 'CLIENT' | 'PARTNER' | 'CONTROLLER' | 'ADMIN' | 'ANY';
export type SuspendedPolicy = 'BLOCK' | 'ALLOW';
export type AdminPermission =
    | 'events.read' | 'partners.read' | 'refunds.manage' | 'payments.read' | 'notifications.read'
    /** Lot 11a : établissement à valider ; lot 10b : salles et établissements (halls.validate). */
    | 'partners.validate' | 'halls.validate';

/** Types journalisés seulement (OTP et invitation d'un contrôleur) : le code n'est jamais stocké. */
export type SyncType = 'OTP_LOGIN' | 'OTP_REGISTER' | 'OTP_PASSWORD_RESET' | 'OTP_WITHDRAWAL' | 'OTP_PHONE_CHANGE' | 'OTP_AUTH_HOOK' | 'CONTROLLER_INVITE'
    /** Lot 9 quinquies : lien d'activation d'un compte créé par un admin (A2) ; code administrateur (A3). */
    | 'ACCOUNT_ACTIVATION' | 'OTP_ADMIN'
    /** Finition 3d (point 2a) : code au nouveau numéro d'un administrateur, à dicter au Superadmin. */
    | 'OTP_ADMIN_PHONE'
    /** Lot 12a : code de remise d'une commande (retrait, livraison, nouveau code), envoyé tout de suite, jamais stocké. */
    | 'ORDER_HANDOVER_CODE';

/** Lot 9 bis (11.1 N26) : email synchrone, journal seulement ; le jeton du lien n'est jamais stocké. */
export type EmailSyncType = 'EMAIL_VERIFICATION';

/** Données d'un événement, présentes pour tout type lié à un événement. */
export interface EventData {
    event_id: string;
    title: string;
    /** Début, ISO 8601. */
    start_at: string;
    location: string;
    city: string;
}

/** Variante sans événement obligatoire (remboursement versé hors événement). */
export type OptionalEventData = Partial<EventData>;

export type OperatorCode = 'WAVE' | 'ORANGE_MONEY';
export type AccountKind = 'ORGANISATEUR' | 'PARRAINAGE';

export interface MoneyData { cashout_id: string; amount: number; operator: OperatorCode | string; account_kind?: AccountKind | string }

export interface ControllerEventRef { event_id: string; title: string; start_at: string }

/** Lot 7 (7.9, D87, D89) : une ligne « quantité × catégorie » d'une confirmation. */
export interface TicketCategoryLine { name: string; quantity: number }

/**
 * Lot 7 (7.9, D87 à D90) : détail d'une confirmation, figé à l'émission par notif_ticket_lines (migration
 * 20261105000007) : catégories et quantités dans l'ordre du nom, 10 premiers numéros dans l'ordre (catégorie,
 * numéro). Facultatifs : une ligne mise en file avant cette migration ne les a pas, l'email se rend sans eux.
 */
export interface TicketLinesData { categories?: TicketCategoryLine[]; ticket_numbers?: string[] }

export interface TemplateData {
    PURCHASE_CONFIRMED: EventData & { payment_id: string; ticket_count: number; service_fee: number; total: number } & TicketLinesData;
    FREE_TICKETS_CONFIRMED: EventData & { ticket_count: number; ticket_id?: string } & TicketLinesData;
    COUNTER_RECEIPT: EventData & { payment_id: string; ticket_count: number; amount: number; reference: string };
    /** Lot 9 (9.0, L10) : `ticket_count` = billets de ce numéro, `ticket_id` = premier billet de l'envoi. */
    INVITATION_RECEIVED: EventData & { ticket_count: number; ticket_id?: string };
    TRANSFER_OFFERED: EventData & { transfer_id: string; ticket_id: string; expires_at: string; recipient_kind?: string };
    TRANSFER_CANCELLED: EventData & { transfer_id: string; ticket_id: string };
    TRANSFER_EXPIRED: EventData & { transfer_id: string; ticket_id: string };
    TRANSFER_CLAIMED_SENDER: EventData & { transfer_id: string; ticket_id: string };
    /**
     * Lot 7 (7.9, D88, D91) : `ticket_number` = NOUVEAU numéro du billet (le transfert le renouvelle), `category` =
     * nom de sa catégorie. Facultatifs : une ligne mise en file avant la migration 20261105000007 ne les a pas.
     */
    TRANSFER_RECEIVED: EventData & { transfer_id: string; ticket_id: string; ticket_number?: string; category?: string };
    /** Lot 9 bis (11.2 M4, R78) : `ticket_count` = billets de la commande contrôlés (avis regroupé), 1 si absent. */
    TICKET_SCANNED: EventData & { ticket_id?: string; ticket_count?: number; payment_id?: string | null };
    /**
     * Lot 9 bis (11.2 M2) : TRANSFERRED = billet reçu par transfert, remboursé à l'acheteur d'origine (R13) ;
     * `recipient_kind: 'PHONE'` = ligne SMS « numéro seul », sans lien (ORGANIZER : guichet ; NONE : invitation non
     * réclamée ou transfert révoqué).
     */
    EVENT_CANCELLED: EventData & { public_notice?: string | null; refund_mode: 'AUTO' | 'ORGANIZER' | 'NONE' | 'TRANSFERRED'; recipient_kind?: 'PHONE' | string };
    EVENT_SUSPENDED_HOLDER: EventData;
    EVENT_REACTIVATED_HOLDER: EventData;
    /**
     * Lot 9 bis (11.2 M1) : `refund_open` = report de plus de 24 h qui ouvre le remboursement (R32) ; `address_cleared` =
     * adresse retirée (R80, `new_address` absent dans ce cas).
     */
    EVENT_CHANGED: EventData & {
        changed_fields: string[]; new_start_at?: string; new_end_at?: string; new_location?: string; new_address?: string; new_city?: string; old_title?: string;
        refund_open?: boolean; address_cleared?: boolean;
    };
    REMINDER_J1: EventData & { sms_policy?: string };
    REMINDER_H3: EventData & { sms_policy?: string };
    /** Finition 4 : by = qui a lancé le remboursement (CLIENT, ORGANIZER, ADMIN, CANCELLATION) ; operator du paiement. */
    REFUND_REQUESTED: EventData & { cashout_id: string; amount: number; operator?: string | null; by?: 'CLIENT' | 'ORGANIZER' | 'ADMIN' | 'CANCELLATION' };
    REFUND_PAID: OptionalEventData & MoneyData;
    PASSWORD_CHANGED: Record<string, never>;
    /** Lot 9 (9.2, L30) : SMS à l'ancien numéro, aucune donnée. */
    PHONE_CHANGED: Record<string, never>;
    EMAIL_CLAIMED_ELSEWHERE: Record<string, never>;
    PUSH_TEST: Record<string, never>;
    EVENT_VALIDATED: EventData;
    EVENT_REJECTED: EventData & { reason: string };
    EVENT_SUSPENDED: EventData & { reason: string };
    EVENT_REACTIVATED: EventData;
    EVENT_PUBLISHED_BY_ADMIN: EventData;
    FIRST_TICKET_SOLD: EventData;
    /** Finition 4 : cloche groupée toutes les 15 minutes (order_count commandes depuis since). */
    NEW_ORDER: EventData & { payment_id: string; ticket_count: number; total: number; order_count?: number; since?: string };
    CATEGORY_SOLD_OUT: EventData & { category_id: string; category: string };
    /** Finition 4 : dernière catégorie vendue (avis fusionné avec « catégorie complète »). */
    EVENT_SOLD_OUT: EventData & { category_id?: string; category?: string };
    SHIFT_DISCREPANCY: EventData & { shift_id: string; controller_name: string; difference: number; declared?: number | null; justification?: string | null };
    WITHDRAWAL_PAID: MoneyData;
    /** Finition 4 : not_paid = retrait constaté non versé (jamais un refus de l'opérateur). */
    WITHDRAWAL_REJECTED: MoneyData & { not_paid?: boolean };
    WITHDRAWAL_UNCERTAIN: MoneyData;
    CANCEL_REFUNDS_DONE: EventData;
    CANCEL_REFUNDS_BLOCKED: EventData;
    PARTNER_REGISTERED_ACK: { partner_id: string; company: string };
    PARTNER_VALIDATED: { partner_id: string; company: string };
    /** Finition 4 : resubmitted = second refus (dossier déjà complété une fois). */
    PARTNER_REJECTED: { partner_id: string; company?: string; reason: string; resubmitted?: boolean };
    PARTNER_SUSPENDED: { partner_id: string; company?: string; reason: string };
    PARTNER_REACTIVATED: { partner_id: string; company?: string };
    TRIAL_STARTED: { partner_id: string; days: number };
    SUBSCRIPTION_ACTIVATED: { partner_id: string; plan_id?: string; plan: string; days: number };
    PAYMENT_SUCCESS: { payment_id: string; amount: number; payment_target?: string };
    // Lot 10a : données de hall_notif_data (réservation de salle), plus les champs propres à chaque avis
    HALL_RESERVATION_REQUESTED: HallReservationData;
    HALL_RESERVATION_CONFIRMED: HallReservationData;
    HALL_BALANCE_PAID: HallReservationData & { recipient_role: 'CLIENT' | 'PARTNER' };
    HALL_BALANCE_REMINDER: HallReservationData & { step?: 'J10' | 'J8' | string };
    HALL_PAYMENT_DEADLINE_PASSED: HallReservationData & HallCancelData;
    HALL_RESERVATION_CANCELLED: HallReservationData & HallCancelData;
    HALL_RESERVATION_CANCELLED_PRO: HallReservationData & HallCancelData;
    HALL_PAYMENT_REFUNDED: HallReservationData & { payment_id: string; amount: number; operator?: string | null };
    HALL_VALIDATION_DECIDED: { hall_id: string; hall_name?: string | null; decision: 'VALIDER' | 'REFUSER' | 'SUSPENDRE' | 'REACTIVER' | string; reason?: string | null };
    // Lot 10b : réservation demandée, veille, recettes disponibles, remboursement versé ; administrateurs
    HALL_RESERVATION_PENDING: HallReservationData & { amount_due: number; hold_expires_at: string; full_payment_required?: boolean };
    HALL_EVE_REMINDER: HallReservationData & { recipient_role: 'CLIENT' | 'PARTNER' };
    HALL_EARNINGS_AVAILABLE: HallReservationData & { earned: number };
    HALL_REFUND_PAID: HallReservationData & { cashout_id: string; amount: number; operator?: string | null };
    ADMIN_HALL_SUBMITTED: { hall_id: string; hall_name: string; city?: string | null; resubmitted?: boolean };
    ADMIN_HALL_CHANGED: { hall_id: string; hall_name: string; previous_name?: string | null; city?: string | null; changes: string[] };
    // Contre-vérification du lot 10b : droits d'un administrateur donnés ou retirés (admin_permissions_set)
    ADMIN_PERMISSIONS_CHANGED: { admin_id: string; added: string[]; removed: string[]; target_name?: string | null; actor_name?: string | null };
    ADMIN_PERMISSIONS_ALERT: { admin_id: string; added: string[]; removed: string[]; target_name?: string | null; actor_name?: string | null };
    // Lot 11a : données de table_notif_data (réservation de table), plus les champs propres à chaque avis
    TABLE_RESERVATION_CONFIRMED: TableReservationData;
    TABLE_REQUEST_SENT: TableReservationData;
    TABLE_REQUEST_TO_ANSWER: TableReservationData;
    TABLE_NEW_RESERVATION: TableReservationData;
    TABLE_REQUEST_REFUSED: TableReservationData & TableCancelData;
    TABLE_REQUEST_EXPIRED: TableReservationData & TableCancelData;
    TABLE_HOLD_EXPIRED: TableReservationData;
    TABLE_RESERVATION_CANCELLED: TableReservationData & TableCancelData;
    TABLE_RESERVATION_CANCELLED_PRO: TableReservationData & TableCancelData;
    TABLE_NO_SHOW: TableReservationData & Partial<TableCancelData>;
    TABLE_PAYMENT_REFUNDED: TableReservationData & { payment_id: string; amount: number; operator?: string | null };
    TABLE_REMINDER: TableReservationData;
    VENUE_VALIDATION_DECIDED: { venue_id: string; venue_name?: string | null; decision: 'VALIDER' | 'REFUSER' | 'SUSPENDRE' | 'REACTIVER' | string; reason?: string | null };
    ADMIN_VENUE_SUBMITTED: { venue_id: string; venue_name: string; kind?: string; city?: string | null; resubmitted?: boolean };
    // Lot 12a : données de order_notif_data (commande), plus les champs propres à chaque avis ; jamais le code de remise
    // (envoyé à part, par SMS immédiat : ORDER_HANDOVER_CODE)
    ORDER_RECEIVED: OrderNotifData;
    ORDER_ACCEPTED: OrderNotifData;
    ORDER_PREPARING: OrderNotifData;
    ORDER_READY: OrderNotifData;
    ORDER_ON_THE_WAY: OrderNotifData;
    ORDER_HANDED_OVER: OrderNotifData;
    ORDER_CANCELLED: OrderNotifData & OrderCancelData;
    ORDER_PAYMENT_REFUNDED: OrderNotifData & { payment_id: string; amount: number; operator?: string | null };
    ORDER_REFUND_PAID: OrderNotifData & { cashout_id: string; amount: number; operator?: string | null };
    ORDER_PICKUP_REMINDER: OrderNotifData & { closes_at: string };
    ORDER_NOT_COLLECTED: OrderNotifData & Partial<OrderCancelData>;
    ORDER_NEW: OrderNotifData;
    ORDER_CANCELLED_PRO: OrderNotifData & OrderCancelData;
    ORDER_HANDED_OVER_PRO: OrderNotifData;
    ORDER_COURIER_ASSIGNED: OrderNotifData;
    ORDER_COURIER_CANCELLED: OrderNotifData;
    ORDER_COURIER_INVITED: { invitation_id: string; partner_name?: string | null };
    PROMOTION_DECIDED: EventData & { promotion_id: string; status: 'APPROUVEE' | 'REFUSEE' | string; reason?: string | null };
    CONTROLLER_ASSIGNED: Partial<EventData> & { assignment_id?: string; entry_point: string | null; can_accept_cash: boolean; events?: ControllerEventRef[] };
    CONTROLLER_UNASSIGNED: Partial<EventData> & { assignment_id?: string; events?: ControllerEventRef[] };
    CONTROLLER_REMINDER: EventData & { assignment_id?: string; entry_point: string | null; can_accept_cash: boolean };
    SHIFT_CLOSED_BY_OTHER: EventData & { shift_id: string; closed_by: 'PARTNER' | 'ADMIN' | string; declared?: number | null };
    CONTROLLER_ACTIVATED: Record<string, never>;
    ADMIN_EVENT_SUBMITTED: EventData & { company?: string | null };
    ADMIN_PARTNER_REGISTERED: { partner_id: string; company: string };
    ADMIN_REFUND_TO_RETRY: { cashout_id: string; amount: number; cashout_status: 'ECHOUE' | 'BLOQUE' | string; blocked_reason?: string | null };
    /** Lot 8 (8.2 a, L32) : second paiement réussi d'un même panier. */
    ADMIN_DUPLICATE_PAYMENT: { payment_id: string; duplicate_of: string; amount: number; duplicate_rank?: number; withheld?: number };
    ADMIN_CASHOUT_UNCERTAIN: { cashout_id: string; amount: number };
    ADMIN_WITHDRAWAL_REJECTED: { cashout_id: string; amount: number; not_paid?: boolean };
    ADMIN_FINANCE_DEBT: { debt_id: string; amount: number; debt: number; account_kind: AccountKind | string; entry_type?: string };
    ADMIN_NOTIFICATION_FAILED: { outbox_id: string; failed_type: string; channel: Channel | string; reason?: string; attempts?: number };
    ADMIN_SMS_DAILY_THRESHOLD: { day: string; count: number; threshold: number };
    ADMIN_SMS_CAP_GLOBAL: { day?: string; cap: number };
    ADMIN_SMS_CAP_NON_OTP: { day?: string; cap: number; limit: number };
    ADMIN_SMS_CAP_NEW_NUMBERS: { day?: string; cap: number; limit: number };
    /** Lot 7 (7.0 a, D15) : 80 % du budget des SMS optionnels du jour de Dakar atteint. */
    ADMIN_SMS_OPTIONAL_80: { day: string; used: number; cap: number; threshold: number; percent: number };
    /** Lot 7 (7.0 a, D16) : rappels SMS prévus pour le lendemain au-delà du budget restant. */
    ADMIN_SMS_FORECAST: { day: string; planned: number; cap: number; remaining: number };
    OTP_LOGIN: { purpose?: string };
    OTP_REGISTER: { purpose?: string };
    OTP_PASSWORD_RESET: { purpose?: string };
    OTP_WITHDRAWAL: { purpose?: string };
    OTP_PHONE_CHANGE: { purpose?: string };
    OTP_AUTH_HOOK: { purpose?: string };
    CONTROLLER_INVITE: { purpose?: string };
    ACCOUNT_ACTIVATION: { purpose?: string };
    OTP_ADMIN: { purpose?: string };
    OTP_ADMIN_PHONE: { purpose?: string };
    ORDER_HANDOVER_CODE: { purpose?: string };

    // ── Lot 9 bis (contrat 11.1, N1 à N26) ──
    REFUND_DELAYED: OptionalEventData & { cashout_id: string; amount: number };
    WITHDRAWAL_DELAYED: { cashout_id: string; amount: number; account_kind?: AccountKind | string };
    ADMIN_CASHOUT_TO_RESUME: {
        cashout_id: string; amount: number; kind: 'REFUND' | 'EVENT_CANCELLATION_REFUND' | 'TICKET_REFUND' | 'WITHDRAWAL' | string;
        cause: 'DELAYED' | 'BLOCKED' | string; blocked_reason?: string | null;
    };
    PAYMENT_REFUND_STARTED: OptionalEventData & { payment_id: string; amount: number; operator?: OperatorCode | string | null; duplicate_of?: string | null; withheld?: number | null; refund_amount?: number | null };
    ADMIN_PARTNER_RESUBMITTED: { partner_id: string; company: string };
    EVENT_CLOSED_HOLDER: EventData;
    EVENT_CLOSED_BY_ADMIN: EventData & { reason: string };
    SHIFT_OPEN_AT_END: EventData & { open_shifts: number };
    TRANSFER_REVOKED: EventData & { transfer_id?: string; ticket_id?: string };
    TRANSFER_DECLINED_SENDER: EventData & { transfer_id: string; ticket_id: string };
    TRANSFER_RECIPIENT_CHANGED: EventData & { transfer_id: string; ticket_id: string };
    CONTROLLER_INVITATION: Partial<EventData> & { invitation_id: string; company: string; expires_at: string; events?: ControllerEventRef[] };
    // Finition 1 (E-20) : avis à la partenaire (nom complet pour une acceptation, masqué sinon)
    CONTROLLER_INVITATION_ACCEPTED: { invitation_id: string; controller_name: string; events?: ControllerEventRef[] };
    CONTROLLER_INVITATION_DECLINED: { invitation_id: string; controller_name: string; events?: ControllerEventRef[] };
    CONTROLLER_INVITATION_EXPIRED: { invitation_id: string; controller_name: string; events?: ControllerEventRef[] };
    // Migration 20261115000014 : contrôleur devenu compte d'administration (nom complet : il était dans l'équipe)
    CONTROLLER_BECAME_ADMIN: { controller_name: string };
    EVENT_CANCELLED_BY_ADMIN: EventData & { public_notice?: string | null };
    ADMIN_EVENT_CANCELLED: EventData & { company?: string | null; reason?: string | null };
    CONTROLLER_EVENT_CANCELLED: EventData;
    CONTROLLER_EVENT_CHANGED: EventData & {
        changed_fields: string[]; new_start_at?: string; new_end_at?: string; new_location?: string; new_address?: string; new_city?: string;
    };
    CONTROLLER_EVENT_STATUS: EventData & { status: 'SUSPENDU' | 'PUBLIE' | string };
    TICKET_CANCELLED: EventData & { ticket_id?: string; kind: 'INVITATION' | 'FREE' | 'CASH' | string };
    ACCOUNT_SUSPENDED: { reason: string };
    ACCOUNT_REACTIVATED: Record<string, never>;
    ADMIN_EVENT_CHANGED: EventData & {
        company?: string | null; changes: Array<'TITLE' | 'POSTER' | 'PLACE' | 'DATE' | 'CATEGORY' | 'PRICE' | 'CHANNELS' | string>; old_title?: string | null; category?: string | null;
        old_price?: number | null; new_price?: number | null; sale_online?: boolean | null; sale_counter?: boolean | null;
    };
    EVENT_SUBMITTED_ACK: EventData;
    EVENT_FINISHED: EventData;
    CLOSING_REPORT_READY: EventData;
    FUNDS_AVAILABLE: EventData;
    EMAIL_VERIFICATION: { purpose?: string };

    // ── Lot 9 ter (contrat 11.1, 11.2 N1 à N4) ──
    TICKET_REFUNDED_HOLDER: EventData & { ticket_id?: string; category: string };
    ADMIN_EVENT_PUBLISHED: EventData & { company?: string | null };
    ADMIN_EVENT_WITHDRAWN: EventData & { company?: string | null };
    SCAN_REFUSALS_ALERT: EventData & { gate_name: string; zone_name?: string | null; refused_count: number; window_minutes: number; threshold: number };

    // ── Lot 9 quinquies (D1) ──
    /**
     * SMS regroupé aux admins qui peuvent agir (migration 20261112000001) : `partner_count` = candidatures et dossiers
     * complétés, `event_count` = événements soumis, `company` = société de l'unique candidature nouvelle (absente dès qu'il y
     * a plus d'un élément), `refs` = références déjà comptées.
     */
    ADMIN_REVIEW_SMS: { partner_count: number; event_count: number; venue_count?: number; company?: string | null; refs?: string[] };
    /** Lot 9 quinquies (A1 : AUTH-01) : 10e échec de mot de passe sur le compte, une fois par jour (`day` de Dakar). */
    ACCOUNT_LOGIN_FAILURES: { day?: string };
    /** Lot 9 quinquies (C2 : AUTH-09) : nouvelle adresse email vérifiée sur le compte (aucune donnée : jamais l'adresse dans un SMS). */
    EMAIL_ADDED: Record<string, never>;

    // ── Finition 3d (recours et suppléance) ──
    /** Point 4a : espèces d'une vente au guichet marquées rendues par un admin, à la place de l'organisatrice (avec le motif). */
    CASH_REFUND_MARKED_BY_ADMIN: EventData & { payment_id: string; reference: string; amount: number; reason: string };
    /** Point 3 : un compte devient SUPERADMIN ; alerte à chaque SUPERADMIN actif (nom du compte promu et de l'auteur). */
    SUPERADMIN_PROMOTED: { user_name: string; actor_name: string };
    /** Point 2c : un code de secours a servi ; SMS à l'ancien numéro et email (codes restants). */
    ADMIN_BACKUP_CODE_USED: { remaining: number };
    /** Points 2a et 2c : SMS à l'ANCIEN numéro (by_self : changé par le Superadmin lui-même, avec ou sans code de secours). */
    ADMIN_PHONE_CHANGED: { by_self: boolean };
    /** Points 2a et 2c : SMS au NOUVEAU numéro et cloche. */
    ADMIN_PHONE_CONFIRMED: { by_self: boolean };
    // Finition 4 (décisions du client du 19/11)
    /** SMS des ventes groupé (30 min) : ticket_count billets, total (hors frais) depuis since. */
    SALES_UPDATE_SMS: EventData & { payment_id?: string; ticket_count: number; total: number; since: string };
    /** Résumé du matin (9 h) : activité de la veille (day, AAAA-MM-JJ) ; données de l'événement quand il n'y en a qu'un. */
    PARTNER_DAILY_SUMMARY: Partial<EventData> & {
        day: string; sold_count: number; sold_amount: number; refund_count: number; refund_amount: number; entry_count: number; event_count: number;
    };
    /** Bienvenue au premier passage du spectateur : organizer = nom de la structure. */
    ENTRY_WELCOME: EventData & { organizer: string; ticket_id?: string; entered_at?: string };
    /** Merci du lendemain à 11 h. */
    ENTRY_THANKS: EventData & { organizer: string };
    /** Demandes de remboursement des clients, groupées (15 min), sans nom ni numéro. */
    PARTNER_REFUND_REQUESTS: EventData & { ticket_count: number; amount: number; since: string };
}

export type NotificationType = keyof TemplateData;

/** Lot 10a : données communes d'un avis de réservation de salle (hall_notif_data). */
export interface HallReservationData {
    reservation_id: string;
    hall_id?: string;
    hall_name?: string | null;
    start_date: string;
    end_date: string;
    start_time?: string | null;
    end_time?: string | null;
    mode?: 'JOUR' | 'HEURE' | string;
    total_amount: number;
    paid_amount: number;
    balance_amount?: number | null;
    balance_due_at?: string | null;
    cancellation_policy?: string | null;
}

/** Lot 11a : données communes d'un avis de réservation de table (table_notif_data). */
export interface TableReservationData {
    reservation_id: string;
    venue_id?: string;
    venue_name?: string | null;
    date: string;
    time: string;
    end_time?: string | null;
    guests: number;
    table_number?: string | null;
    deposit_amount: number;
    total_amount: number;
    paid_amount: number;
    response_due_at?: string | null;
}

/** Lot 12a : données d'une commande (order_notif_data) ; montants en F CFA, heures en UTC (= Dakar). */
export interface OrderNotifData {
    order_id: string;
    order_number: string;
    venue_id?: string;
    venue_name?: string | null;
    mode: 'LIVRAISON' | 'RETRAIT' | 'SUR_PLACE' | string;
    state?: string;
    items_count: number;
    goods_total: number;
    paid_amount: number;
    balance_due: number;
    payment_type?: string;
    scheduled_for?: string | null;
    estimated_at?: string | null;
    response_due_at?: string | null;
    zone_name?: string | null;
    onsite_label?: string | null;
    recipient_role?: 'CLIENT' | 'OWNER' | 'COURIER' | string;
}

/** Lot 12a : fin d'une commande (order_close_apply, order_expire_hold). */
export interface OrderCancelData {
    origin: 'CLIENT' | 'PARTENAIRE' | 'EVENT_VILLAGE' | 'SANS_REPONSE' | 'REFUSEE' | 'EXPIREE' | 'NON_RETIREE' | string;
    refund_amount: number;
    reason?: string | null;
}

/** Lot 11a : fin d'une réservation de table (table_close_apply). */
export interface TableCancelData {
    origin: 'CLIENT' | 'ETABLISSEMENT' | 'EVENT_VILLAGE' | 'SANS_REPONSE' | 'REFUSEE' | 'ABSENT' | string;
    refund_amount: number;
    refund_percent?: number | null;
    reason?: string | null;
}

/** Lot 10a : annulation ou délai dépassé (hall_cancel_apply). */
export interface HallCancelData {
    origin: 'CLIENT' | 'SALLE' | 'EVENT_VILLAGE' | 'DELAI' | string;
    refund_amount: number;
    refund_percent?: number | null;
    reason?: string | null;
}

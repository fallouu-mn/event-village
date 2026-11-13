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
 *  - CONTROLLER_INVITATION : invitation_id, company, expires_at, events ; CONTROLLER_EVENT_STATUS : status
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
export type Topic = 'REMINDERS' | 'EVENT_UPDATES' | 'PRO_ACTIVITY';
export type Audience = 'CLIENT' | 'PARTNER' | 'CONTROLLER' | 'ADMIN' | 'ANY';
export type SuspendedPolicy = 'BLOCK' | 'ALLOW';
export type AdminPermission =
    | 'events.read' | 'partners.read' | 'refunds.manage' | 'payments.read' | 'notifications.read';

/** Types journalisés seulement (OTP et invitation d'un contrôleur) : le code n'est jamais stocké. */
export type SyncType = 'OTP_LOGIN' | 'OTP_REGISTER' | 'OTP_PASSWORD_RESET' | 'OTP_WITHDRAWAL' | 'OTP_PHONE_CHANGE' | 'OTP_AUTH_HOOK' | 'CONTROLLER_INVITE';

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
    REFUND_REQUESTED: EventData & { cashout_id: string; amount: number };
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
    NEW_ORDER: EventData & { payment_id: string; ticket_count: number; total: number };
    CATEGORY_SOLD_OUT: EventData & { category_id: string; category: string };
    EVENT_SOLD_OUT: EventData;
    SHIFT_DISCREPANCY: EventData & { shift_id: string; controller_name: string; difference: number; declared?: number | null; justification?: string | null };
    WITHDRAWAL_PAID: MoneyData;
    WITHDRAWAL_REJECTED: MoneyData;
    WITHDRAWAL_UNCERTAIN: MoneyData;
    CANCEL_REFUNDS_DONE: EventData;
    CANCEL_REFUNDS_BLOCKED: EventData;
    PARTNER_REGISTERED_ACK: { partner_id: string; company: string };
    PARTNER_VALIDATED: { partner_id: string; company: string };
    PARTNER_REJECTED: { partner_id: string; company?: string; reason: string };
    PARTNER_SUSPENDED: { partner_id: string; company?: string; reason: string };
    PARTNER_REACTIVATED: { partner_id: string; company?: string };
    TRIAL_STARTED: { partner_id: string; days: number };
    SUBSCRIPTION_ACTIVATED: { partner_id: string; plan_id?: string; plan: string; days: number };
    PAYMENT_SUCCESS: { payment_id: string; amount: number; payment_target?: string };
    HALL_RESERVATION_REQUESTED: { reservation_id: string; hall_name?: string | null; start_date: string; end_date: string };
    HALL_RESERVATION_CONFIRMED: { reservation_id: string; hall_name?: string | null; start_date: string; end_date: string };
    HALL_RESERVATION_CANCELLED: {
        reservation_id: string; hall_name?: string | null; start_date: string; end_date: string; recipient_role: 'CLIENT' | 'PARTNER'; reason?: string | null;
    };
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
    ADMIN_WITHDRAWAL_REJECTED: { cashout_id: string; amount: number };
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
    ADMIN_REVIEW_SMS: { partner_count: number; event_count: number; company?: string | null; refs?: string[] };
}

export type NotificationType = keyof TemplateData;

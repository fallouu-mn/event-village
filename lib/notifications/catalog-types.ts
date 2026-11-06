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
export type SyncType = 'OTP_LOGIN' | 'OTP_REGISTER' | 'OTP_PASSWORD_RESET' | 'OTP_WITHDRAWAL' | 'OTP_AUTH_HOOK' | 'CONTROLLER_INVITE';

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
    TRANSFER_OFFERED: EventData & { transfer_id: string; ticket_id: string; expires_at: string; recipient_kind?: string };
    TRANSFER_CANCELLED: EventData & { transfer_id: string; ticket_id: string };
    TRANSFER_EXPIRED: EventData & { transfer_id: string; ticket_id: string };
    TRANSFER_CLAIMED_SENDER: EventData & { transfer_id: string; ticket_id: string };
    /**
     * Lot 7 (7.9, D88, D91) : `ticket_number` = NOUVEAU numéro du billet (le transfert le renouvelle), `category` =
     * nom de sa catégorie. Facultatifs : une ligne mise en file avant la migration 20261105000007 ne les a pas.
     */
    TRANSFER_RECEIVED: EventData & { transfer_id: string; ticket_id: string; ticket_number?: string; category?: string };
    TICKET_SCANNED: EventData & { ticket_id: string };
    EVENT_CANCELLED: EventData & { public_notice?: string | null; refund_mode: 'AUTO' | 'ORGANIZER' | 'NONE' };
    EVENT_SUSPENDED_HOLDER: EventData;
    EVENT_REACTIVATED_HOLDER: EventData;
    EVENT_CHANGED: EventData & {
        changed_fields: string[]; new_start_at?: string; new_end_at?: string; new_location?: string; new_address?: string; new_city?: string; old_title?: string;
    };
    REMINDER_J1: EventData & { sms_policy?: string };
    REMINDER_H3: EventData & { sms_policy?: string };
    REFUND_REQUESTED: EventData & { cashout_id: string; amount: number };
    REFUND_PAID: OptionalEventData & MoneyData;
    PASSWORD_CHANGED: Record<string, never>;
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
    ADMIN_DUPLICATE_PAYMENT: { payment_id: string; duplicate_of: string; amount: number };
    ADMIN_CASHOUT_UNCERTAIN: { cashout_id: string; amount: number };
    ADMIN_WITHDRAWAL_REJECTED: { cashout_id: string; amount: number };
    ADMIN_FINANCE_DEBT: { debt_id: string; amount: number; debt: number; account_kind: AccountKind | string; entry_type?: string };
    ADMIN_NOTIFICATION_FAILED: { outbox_id: string; failed_type: string; channel: Channel | string; reason?: string; attempts?: number };
    ADMIN_SMS_DAILY_THRESHOLD: { day: string; count: number; threshold: number };
    ADMIN_SMS_CAP_GLOBAL: { day?: string; cap: number };
    ADMIN_SMS_CAP_NON_OTP: { day?: string; cap: number; limit: number };
    /** Lot 7 (7.0 a, D15) : 80 % du budget des SMS optionnels du jour de Dakar atteint. */
    ADMIN_SMS_OPTIONAL_80: { day: string; used: number; cap: number; threshold: number; percent: number };
    /** Lot 7 (7.0 a, D16) : rappels SMS prévus pour le lendemain au-delà du budget restant. */
    ADMIN_SMS_FORECAST: { day: string; planned: number; cap: number; remaining: number };
    OTP_LOGIN: { purpose?: string };
    OTP_REGISTER: { purpose?: string };
    OTP_PASSWORD_RESET: { purpose?: string };
    OTP_WITHDRAWAL: { purpose?: string };
    OTP_AUTH_HOOK: { purpose?: string };
    CONTROLLER_INVITE: { purpose?: string };
}

export type NotificationType = keyof TemplateData;

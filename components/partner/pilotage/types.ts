/**
 * Lot 5, tâche 5.10 — formes des réponses des routes GET /api/partner/events/[id]/pilotage/* (corps des
 * RPC pilotage_*, migration 20261102000005_lot5_pilotage.sql). Toutes les valeurs sont calculées par la
 * base : l'écran les affiche sans les recalculer.
 */
import type { EventAction, LastReason } from '@/components/partner/events-list/PartnerEventCard';

export type { EventAction, LastReason };

export interface PilotageOverview {
    event: {
        id: string;
        title: string;
        status: string;
        start_date: string | null;
        start_time: string | null;
        end_date: string | null;
        end_time: string | null;
        end_at: string | null;
        location: string | null;
        city: string | null;
        image_url: string | null;
    };
    status: string;
    actions: EventAction[];
    can_edit: boolean;
    can_cancel: boolean;
    last_reason: LastReason | null;
    tickets: {
        sold: number;
        invitations: number;
        capacity: number;
        in_payment: number;
        remaining: number;
        declared_capacity: number | null;
        capacity_exceeded: boolean;
        by_channel?: { online: number; cash: number; unpaid: number; free: number };
    };
    entries: { total: number; counter: number; refused: number; attendance_rate: number | null; guest_list: number };
    revenue: {
        online: number;
        online_gross?: number;
        cash: number;
        refunded: number;
        refunded_online?: number;
        refunded_cash_organizer?: number;
    };
    computed_at: string;
}

export interface PilotageSales {
    by_category: Array<{
        category_id: string;
        name: string;
        price: number;
        is_active: boolean;
        is_visible: boolean;
        sale_online: boolean;
        sale_counter: boolean;
        total: number;
        sold: number;
        sold_online: number;
        sold_cash: number;
        sold_unpaid: number;
        invitations: number;
        in_payment: number;
        remaining: number;
        revenue_online: number;
    }>;
    by_day: Array<{ day: string; sold: number; sold_online: number; sold_cash: number; revenue_online: number }>;
    computed_at: string;
}

/** Origine d'un billet (règle R50, ticket_origin) : libellé servi par la base (ticket_origin_label). */
export type EntryOrigin = 'ONLINE' | 'COUNTER' | 'FREE' | 'INVITATION';

/** Ligne « par zone » de pilotage_compute_entries (lot 9 ter, 9t.18). ENTREE : entrés sur attendus ; CONTROLE : contrôlés sur entrés. */
export interface EntriesZoneRow {
    zone_id: string | null;
    name: string;
    kind: 'ENTREE' | 'CONTROLE' | null;
    implicit: boolean;
    expected: number | null;
    entered: number | null;
    checked: number | null;
    /** Lot 9 quater (E2 : AUD-14) : passages confirmés au-delà du premier à un contrôle de zone. */
    repeats?: number | null;
    refused: number;
}

/** Ligne « par porte » : une porte d'une zone, ou un point d'entrée sans porte (gate_id null). Débit et contrôleurs actifs : en direct seulement. */
export interface EntriesGateRow {
    gate_key: string;
    gate_id: string | null;
    name: string | null;
    zone_id: string | null;
    zone_name: string | null;
    accepted: number;
    refused: number;
    controllers_assigned: number;
    rate_per_minute?: number;
    controllers_active?: number;
}

export interface EntriesCategoryRow {
    category_id: string;
    name: string;
    expected: number;
    accepted: number;
}

export interface EntriesOriginRow {
    origin: EntryOrigin;
    label: string;
    expected: number;
    entered: number;
}

export interface EntriesQuarterRow {
    start: string;
    accepted: number;
    refused: number;
}

export interface EntriesRefusalRow {
    result: string;
    label: string | null;
    count: number;
}

/** Entrées validées par la liste des invités ; guest_name n'est servi qu'à la propriétaire de l'événement. */
export interface EntriesGuestList {
    count: number;
    items: Array<{
        scan_id: string;
        at: string;
        category: string | null;
        gate: string | null;
        zone: string | null;
        controller: string;
        guest_name: string | null;
    }>;
}

/**
 * Vues figées des entrées (pilotage_compute_entries) : même source pour l'onglet Entrées et le rapport de clôture.
 * Tous les nombres sont calculés par la base.
 */
export interface EntriesViews {
    configured: boolean;
    totals: { total: number; counter: number; guest_list: number; refused: number; zone_checks: number };
    by_zone: EntriesZoneRow[];
    by_gate: EntriesGateRow[];
    by_category: EntriesCategoryRow[];
    by_origin: EntriesOriginRow[];
    by_quarter: EntriesQuarterRow[];
    refusals_by_reason: EntriesRefusalRow[];
    guest_list: EntriesGuestList;
}

/** Données « en direct » de l'onglet Entrées seulement (pilotage_entries), jamais dans la clôture. */
export interface EntriesLive {
    rate: { window_minutes: number; per_minute: number; by_minute: Array<{ start: string; accepted: number }> };
    controllers: { window_minutes: number; assigned: number; active: number };
    alerts: Array<{ gate_key: string; name: string; zone_name: string | null; refused: number; window_minutes: number; threshold: number }>;
    alert_settings: { threshold: number; minutes: number };
}

export interface PilotageEntries extends EntriesLive {
    total: number;
    counter: number;
    refused: number;
    configured: boolean;
    zone_checks: number;
    by_scanner: Array<{
        scanner_id: string;
        name: string;
        role: string | null;
        entry_point: string | null;
        gate: string | null;
        active: boolean;
        assigned: boolean;
        accepted: number;
        refused: number;
        incidents: number;
        last_activity_at: string | null;
        last_incident_at: string | null;
    }>;
    by_entry_point: Array<{ entry_point: string | null; accepted: number; refused: number }>;
    by_zone: EntriesZoneRow[];
    by_gate: EntriesGateRow[];
    by_category: EntriesCategoryRow[];
    by_origin: EntriesOriginRow[];
    by_quarter: EntriesQuarterRow[];
    refusals_by_reason: EntriesRefusalRow[];
    guest_list: EntriesGuestList;
    repeated_attempts: Array<{
        ticket_id: string;
        ticket_number: string | null;
        category: string | null;
        attempts: number;
        last_result: string;
        last_result_label: string | null;
        first_at: string | null;
        last_at: string | null;
        entered_at: string | null;
    }>;
    incidents: Array<{ scanner_id: string; name: string; kind: string; count: number; last_at: string | null }>;
    computed_at: string;
}

export interface PilotageTeam {
    controllers: Array<{
        assignment_id: string;
        controller_id: string;
        name: string;
        phone: string | null;
        account_status: string | null;
        account_active: boolean;
        entry_point: string | null;
        can_accept_cash: boolean;
        assigned_at: string | null;
        open_shift_id: string | null;
        accepted: number;
        last_activity_at: string | null;
    }>;
    can_manage: boolean;
    computed_at: string;
}

export interface CashShift {
    id: string;
    controller_id: string;
    controller_name: string | null;
    status: string;
    opened_at: string | null;
    closed_at: string | null;
    opening_float: number;
    cash_collected: number;
    expected: number | null;
    declared: number | null;
    difference: number | null;
    justification: string | null;
    pin_cosigned: boolean;
    /** Lot 9 quater (C7 : AUD-16) : écart validé par l'organisatrice (null : en attente, ou aucun écart). */
    discrepancy_validated_at?: string | null;
    scan_count: number;
    scan_amount: number;
    counter_count: number;
    counter_amount: number;
}

export interface PilotageCash {
    shifts: CashShift[];
    by_controller: Array<{ controller_id: string; name: string | null; cash_collected: number; shifts: number; open_shifts: number }>;
    totals: { cash_collected: number; open: number; closed: number; difference: number };
    pin: { hasPin: boolean; updatedAt: string | null };
    computed_at: string;
}

export interface ZReport {
    shift_id: string;
    controller_id: string;
    controller_name: string | null;
    status: string;
    opened_at: string | null;
    closed_at: string | null;
    opening_float: number;
    expected: number | null;
    declared: number | null;
    difference: number | null;
    justification: string | null;
    pin_cosigned: boolean;
    by_source: Array<{ source: string; count: number; amount: number }>;
    by_category: Array<{ category_id: string; name: string; count: number; amount: number }>;
}

export interface PilotageClosing {
    status: string;
    after_end: boolean;
    absents: { count: number; list_available: boolean; list: Array<{ name: string; category: string; category_id: string }> | null };
    z: ZReport[];
    finance: {
        organizer_net: number | null;
        online_sales: number | null;
        refunded: number | null;
        available: number | null;
        pending: number | null;
        buyer_service_fees: number | null;
        cash_sales: number | null;
        cash_tickets: number | null;
        funds_available_from: string | null;
        funds_available_to: string | null;
    };
    report: Pick<PilotageOverview, 'tickets' | 'entries' | 'revenue'>;
    /** Vues figées des entrées (pilotage_compute_entries, sans nom d'invité ni donnée en direct). */
    entries?: EntriesViews;
    computed_at: string;
}

/** Libellés des statuts d'une caisse (controller_shifts.status). */
export const SHIFT_STATUS_LABELS: Record<string, string> = {
    OUVERT: 'Ouverte',
    CLOTURE: 'Clôturée',
    LITIGE: 'En litige',
};

export function shiftStatusLabel(value: string | null | undefined): string {
    return (value && SHIFT_STATUS_LABELS[value]) || 'Statut inconnu';
}

/** Libellés des incidents techniques du scan (scan_incidents.kind, contrat C8). */
const INCIDENT_LABELS: Record<string, string> = {
    RATE_LIMITED: 'Trop de scans rapprochés',
    SERVER_ERROR: 'Erreur du serveur',
    GUARD_UNAVAILABLE: 'Contrôle anti-abus indisponible',
    NETWORK: 'Coupure réseau',
    TIMEOUT: 'Délai de réponse dépassé',
};

export function incidentLabel(kind: string | null | undefined): string {
    return (kind && INCIDENT_LABELS[kind]) || 'Autre incident';
}

/**
 * Horodatage « sans fuseau » rendu par la base à l'heure de Dakar (`AT TIME ZONE 'Africa/Dakar'`) : Dakar
 * est à UTC+0 toute l'année, on le lit donc comme de l'UTC (sans dépendre du fuseau du navigateur).
 */
export function dakarLocalToIso(value: string | null | undefined): string | null {
    if (!value) return null;
    return /(?:Z|[+-]\d{2}:?\d{2})$/.test(value) ? value : `${value.replace(' ', 'T')}Z`;
}

const PER_MINUTE_FORMAT = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** Débit servi par la base (arrondi à une décimale) : « 2,2 par minute ». */
export function formatPerMinute(value: number | null | undefined): string {
    const n = typeof value === 'number' && Number.isFinite(value) ? value : 0;
    return `${PER_MINUTE_FORMAT.format(n)} par minute`;
}

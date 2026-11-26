/**
 * Lot 11c-c — tables d'un événement : forme des réponses du serveur lues par les écrans (event_table_report, liste de la
 * porte). Aucun nombre de places ni montant n'est calculé dans le navigateur : les écrans affichent ces champs tels quels.
 */

export type TableState = 'LIBRE' | 'EN_ATTENTE' | 'VENDUE';
export type TableShape = 'RONDE' | 'CARREE' | 'RECTANGLE';

export interface TablesGauge {
    capacity: number | null;
    /** Places mises en vente, billets et tables (règle unique de la base). */
    seats: number;
    table_seats: number;
    ticket_seats: number;
    /** Places encore libres sous la capacité (null sans capacité). */
    free: number | null;
}

export interface TableTypeRow {
    id: string;
    name: string;
    seats: number;
    price: number;
    price_per_person: number;
    price_per_person_exact: boolean;
    service_fee: number;
    total: number;
    included_text: string | null;
    onsite_note: string | null;
    payment_mode: string;
    is_active: boolean;
    sale_start: string | null;
    sale_end: string | null;
    scan_color: string | null;
    entry_instruction: string | null;
    total_tables: number;
    sold_tables: number;
    held_tables: number;
    free_tables: number;
    type_seats: number;
    /** Prix et places figés (une vente ou une attente). */
    locked: boolean;
    /** Déjà vendu ou mis en paiement, paiement échoué compris (contre-vérification 11c-c, T5). */
    ever_sold: boolean;
    /** Le type se supprime : même règle que la suppression en base (private.event_table_type_delete_refusal). */
    deletable: boolean;
    /** Sinon, le refus que la suppression rendrait, texte tel quel. */
    delete_refusal: EditRefusal | null;
}

export interface EventTableRow {
    id: string;
    number: number;
    type_id: string;
    zone_id: string | null;
    x: number | null;
    y: number | null;
    shape: TableShape;
    rotation: number;
    state: TableState;
    ever_sold: boolean;
}

export interface TableZoneRow { id: string; name: string; x: number | null; y: number | null; w: number | null; h: number | null }

export interface BookingCounts { sent: number; pending: number; to_send: number; entered: number; given: number }

export interface TableBookingRow {
    table_number: number;
    table_id: string;
    type_id: string;
    type_name: string;
    zone: string | null;
    seats: number;
    status: 'ACTIVE' | 'REFUNDED';
    refund_origin: string | null;
    sold_at: string;
    refunded_at: string | null;
    holder: string | null;
    price: number;
    counts: BookingCounts;
}

export interface TablesTotals {
    tables: number;
    placed: number;
    unplaced: number;
    free: number;
    held: number;
    sold: number;
    sold_seats: number;
    entered_seats: number;
    revenue: number;
    refunded: number;
    refunded_amount: number;
}

export interface EditRefusal { code: string; message: string }

export interface CopySource { event_id: string; title: string; start_at: string | null; types: number; tables: number }

export interface TablesReport {
    event_id: string;
    event_status: string;
    viewer: 'OWNER' | 'STAFF';
    service_open: boolean;
    plan_enabled: boolean;
    gauge: TablesGauge;
    types: TableTypeRow[];
    tables: EventTableRow[];
    zones: TableZoneRow[];
    bookings: TableBookingRow[];
    totals: TablesTotals;
    edit_refusal: EditRefusal | null;
    copy_sources?: CopySource[];
    /** Une ligne par enregistrement signalé ; label : « Plan copié depuis … » pour une copie (contre-vérification 11c-c, T2). */
    changes?: Array<{ at: string; label: string | null }>;
    read_at: string;
}

export interface DoorItem {
    table_number: number;
    type_name: string;
    zone: string | null;
    seats: number;
    holder: string | null;
    entered: number;
    guests: string[];
}

export interface DoorList { event_id: string; items: DoorItem[]; read_at: string }

/** Onglet « Tables » proposé : service ouvert, ou des tables existent déjà (lisibles service fermé). */
export function tablesTabVisible(report: TablesReport | null): boolean {
    return !!report && (report.service_open || report.types.length > 0);
}

/** Accord d'un nom ou d'un participe avec un nombre lu sur la réponse du serveur (« 1 vendue », « 2 vendues »). */
export function plural(n: number, one: string, many: string): string {
    return Math.abs(n) >= 2 ? many : one;
}

export const STATE_LABEL: Readonly<Record<TableState, string>> = { LIBRE: 'Libre', EN_ATTENTE: 'En paiement', VENDUE: 'Vendue' };

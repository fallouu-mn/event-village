/**
 * Lot 11b — tables : lectures pour les écrans (public, client, établissement, administration).
 *
 * Toutes passent par la clé de service, côté serveur : chaque fonction filtre elle-même ce que la personne a le droit
 * de voir (établissement public : actif, validé, partenaire VALIDE ; client : ses réservations ; établissement : les
 * réservations de SES établissements ; administration : la route a vérifié le droit halls.validate). Aucune lecture REST
 * depuis le navigateur. Aucun montant n'est calculé ici : acompte, frais, total, remboursement viennent de la base
 * (table_quote, réservation figée, table_cancel_preview, table_partner_earnings). Colonnes nommées une à une.
 */
import { getServiceRoleClient } from '@/lib/supabase/server';
import { PublicError } from '@/lib/api/public-error';
import { pgIlikeContains } from '@/lib/security/postgrest-filter';
import { tableStateIsLive, tableStateView, venueStatusView, VENUE_KIND_VIEW, type Tone } from './views';
import { POSITION_COLUMNS, publicAddress, publicPosition } from '@/lib/lieux/position-publique';

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
export const TIME_RE = /^\d{2}:\d{2}$/;

type Row = Record<string, unknown>;

const num = (v: unknown): number => Number(v ?? 0);
const str = (v: unknown): string | null => (typeof v === 'string' && v.length > 0 ? v : null);
const clock = (v: unknown): string => {
    const s = str(v) ?? '';
    return s.startsWith('24:00') ? '24:00' : s.slice(0, 5);
};
const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.trim().length > 0) : []);

async function rpc(fn: string, args: Row): Promise<Row> {
    const { data, error } = await getServiceRoleClient().rpc(fn, args);
    if (error) throw new Error(`${fn} : ${error.message}`);
    return (data ?? {}) as Row;
}

/** Refus lisible d'une fonction de la base (message déjà en français simple). */
export class TableRefusal extends Error {
    /** Phrase de la base, déjà en français simple : seule elle part vers l'écran. */
    public readonly publicText: string;

    constructor(public readonly code: string, text: string, public readonly extra: Row = {}) {
        super(`refus ${code}`);
        this.publicText = text;
    }
}

export function okOrRefuse(r: Row): Row {
    if (r.ok !== true) {
        const { ok: _ok, code, message, ...rest } = r;
        throw new TableRefusal(String(code ?? 'REFUSED'), String(message ?? 'Action impossible pour le moment.'), rest);
    }
    return r;
}

// ── Public ───────────────────────────────────────────────────────────────────────────────────────────────

export interface SlotView { time: string; endTime?: string; state: 'LIBRE' | 'COMPLET' | 'PASSE' | 'TROP_LOIN'; freeTables?: number }

export interface VenueCard {
    id: string;
    name: string;
    kind: string;
    kindLabel: string;
    city: string | null;
    address: string | null;
    photo: string | null;
    photoCount: number;
    depositPerPerson: number;
    confirmation: 'AUTO' | 'MANUELLE';
    slotMinutes: number;
    partnerName: string | null;
    floorPlan: boolean;
    /** Lot Carte B3 : point exact (lieu professionnel) ou centre de la zone de 300 m (particulier). */
    latitude: number | null;
    longitude: number | null;
    /** Lot Carte B3 : true = point exact ; false = zone (particulier : ni adresse ni point exact). */
    exact: boolean;
    slots: SlotView[];
    hasFree: boolean;
}

export interface VenueSearchFilters {
    q?: string | null;
    city?: string | null;
    kind?: string | null;
    date?: string | null;
    time?: string | null;
    guests?: number | null;
    available?: boolean;
    limit?: number;
    offset?: number;
}

function slotsOf(v: unknown): SlotView[] {
    return (Array.isArray(v) ? v : []).map((s) => {
        const r = s as Row;
        return { time: String(r.time), ...(r.end_time ? { endTime: String(r.end_time) } : {}), state: String(r.state) as SlotView['state'], ...(r.free_tables !== undefined ? { freeTables: num(r.free_tables) } : {}) };
    });
}

export async function searchVenues(f: VenueSearchFilters): Promise<{ total: number; venues: VenueCard[]; cities: string[]; limit: number; offset: number; date: string | null; time: string | null; guests: number }> {
    const r = okOrRefuse(await rpc('venue_search', {
        p: {
            q: f.q ?? null, city: f.city ?? null, kind: f.kind ?? null, date: f.date ?? null, time: f.time ?? null,
            guests: f.guests ?? null, available: f.available === true, limit: f.limit ?? 24, offset: f.offset ?? 0,
        },
    }));
    const venues = (Array.isArray(r.venues) ? r.venues : []).map((x) => {
        const v = x as Row;
        return {
            id: String(v.id), name: String(v.name), kind: String(v.kind), kindLabel: VENUE_KIND_VIEW[String(v.kind)] ?? 'Établissement',
            // Lot Carte B3 : la recherche rend déjà, pour un particulier, ni adresse ni point exact (centre de la zone)
            city: str(v.city), address: v.exact === true ? str(v.address) : null, photo: str(v.photo), photoCount: num(v.photo_count),
            depositPerPerson: num(v.deposit_per_person), confirmation: v.confirmation_mode === 'MANUELLE' ? 'MANUELLE' as const : 'AUTO' as const,
            slotMinutes: num(v.slot_minutes), partnerName: str(v.partner_name), floorPlan: v.floor_plan === true,
            latitude: v.latitude === null || v.latitude === undefined ? null : num(v.latitude),
            longitude: v.longitude === null || v.longitude === undefined ? null : num(v.longitude),
            exact: v.exact === true,
            slots: slotsOf(v.slots), hasFree: v.has_free === true,
        };
    });
    return {
        total: num(r.total), venues, cities: strings(r.cities), limit: num(r.limit), offset: num(r.offset),
        date: str(r.date), time: str(r.time), guests: num(r.guests),
    };
}

export interface PublicVenue {
    id: string;
    name: string;
    kind: string;
    kindLabel: string;
    description: string | null;
    address: string | null;
    city: string | null;
    /** Lot Carte B3 : point exact (professionnel) ou centre de la zone de 300 m (particulier). */
    latitude: number | null;
    longitude: number | null;
    exact: boolean;
    photos: string[];
    partnerName: string | null;
    hours: Array<{ weekday: number; opensAt: string; closesAt: string }>;
    zones: Array<{ id: string; name: string }>;
    minCapacity: number;
    maxCapacity: number;
    floorPlan: boolean;
    depositPerPerson: number;
    confirmation: 'AUTO' | 'MANUELLE';
    slotMinutes: number;
    rules: { holdMinutes: number; responseMinutes: number; cancelFreeHours: number; noShowMinutes: number; serviceFeeRate: number };
    closures: Array<{ startsAt: string; endsAt: string }>;
}

/** Établissement public (actif, validé, partenaire VALIDE) ; null sinon. Aucune réservation, aucune donnée personnelle. */
export async function publicVenue(id: string): Promise<PublicVenue | null> {
    if (!UUID_RE.test(id)) return null;
    const supabase = getServiceRoleClient();
    const { data, error } = await supabase.from('venues')
        .select(`id, kind, name, description, address, city, ${POSITION_COLUMNS}, photos, slot_minutes, deposit_per_person, confirmation_mode, floor_plan_enabled, partners!inner(status, company_name, commercial_name)`)
        .eq('id', id).eq('is_active', true).eq('validation_status', 'VALIDEE').eq('partners.status', 'VALIDE').maybeSingle();
    if (error) throw new Error(`établissement ${id} : ${error.message}`);
    if (!data) return null;
    const v = data as unknown as Row & { partners: Row };
    const [hours, zones, tables, closures] = await Promise.all([
        supabase.from('venue_opening_hours').select('weekday, opens_at, closes_at').eq('venue_id', id).order('weekday').order('opens_at'),
        supabase.from('restaurant_zones').select('id, name').eq('venue_id', id).eq('is_active', true).order('name'),
        supabase.from('restaurant_tables').select('capacity, min_capacity').eq('venue_id', id).eq('is_active', true),
        supabase.from('venue_closures').select('starts_at, ends_at').eq('venue_id', id).is('cancelled_at', null)
            .gt('ends_at', new Date().toISOString().slice(0, 19)).order('starts_at').limit(10),
    ]);
    for (const r of [hours, zones, tables, closures]) if (r.error) throw new Error(`établissement ${id} : ${r.error.message}`);
    // Règles de la base (réglages tables.*) par le devis d'une table de 2 : aucune valeur écrite en dur à l'écran
    const quote = okOrRefuse(await rpc('table_quote', { p: { venue_id: id, guests: 2 } }));
    const caps = (tables.data ?? []) as Row[];
    // Lot Carte B3 : particulier = ni adresse ni point exact (centre de sa zone) ; le vrai point ne sort pas d'ici
    const position = publicPosition(v);
    return {
        id: String(v.id), name: String(v.name), kind: String(v.kind), kindLabel: VENUE_KIND_VIEW[String(v.kind)] ?? 'Établissement',
        description: str(v.description), address: publicAddress(v), city: str(v.city),
        latitude: position?.lat ?? null, longitude: position?.lng ?? null, exact: position?.exact ?? false,
        photos: strings(v.photos), partnerName: str(v.partners?.commercial_name) ?? str(v.partners?.company_name),
        hours: ((hours.data ?? []) as Row[]).map((h) => ({ weekday: num(h.weekday), opensAt: clock(h.opens_at), closesAt: clock(h.closes_at) })),
        zones: ((zones.data ?? []) as Row[]).map((z) => ({ id: String(z.id), name: String(z.name) })),
        minCapacity: caps.length ? Math.min(...caps.map((t) => num(t.min_capacity))) : 0,
        maxCapacity: caps.length ? Math.max(...caps.map((t) => num(t.capacity))) : 0,
        floorPlan: v.floor_plan_enabled === true,
        depositPerPerson: num(v.deposit_per_person), confirmation: v.confirmation_mode === 'MANUELLE' ? 'MANUELLE' : 'AUTO',
        slotMinutes: num(quote.slot_minutes),
        rules: {
            holdMinutes: num(quote.hold_minutes), responseMinutes: num(quote.response_minutes), cancelFreeHours: num(quote.cancel_free_hours),
            noShowMinutes: num(quote.no_show_minutes), serviceFeeRate: num(quote.service_fee_rate),
        },
        closures: ((closures.data ?? []) as Row[]).map((c) => ({ startsAt: String(c.starts_at), endsAt: String(c.ends_at) })),
    };
}

export async function venueSlots(id: string, date: string, guests: number, zoneId: string | null): Promise<{ date: string; guests: number; slotMinutes: number; day: string; partlyClosed: boolean; message: string | null; slots: SlotView[] }> {
    const r = okOrRefuse(await rpc('venue_slots', { p: { venue_id: id, date, guests, zone_id: zoneId } }));
    return {
        date: String(r.date), guests: num(r.guests), slotMinutes: num(r.slot_minutes), day: String(r.day),
        partlyClosed: r.partly_closed === true, message: str(r.message), slots: slotsOf(r.slots),
    };
}

export interface FloorTable { id: string; number: string; capacity: number; minCapacity: number; zoneId: string | null; x: number; y: number; shape: 'RONDE' | 'CARREE' | 'RECTANGLE'; rotation: number; state: 'LIBRE' | 'PRISE' | 'HORS_CAPACITE' | null }
export interface FloorZone { id: string; name: string; x: number; y: number; w: number; h: number }

export async function venueFloor(id: string, q: { date?: string | null; time?: string | null; guests?: number | null }): Promise<{ enabled: boolean; tables: FloorTable[]; zones: FloorZone[] }> {
    const r = okOrRefuse(await rpc('venue_floor', { p: { venue_id: id, date: q.date ?? null, time: q.time ?? null, guests: q.guests ?? null } }));
    return {
        enabled: r.enabled === true,
        tables: (Array.isArray(r.tables) ? r.tables : []).map((x) => {
            const t = x as Row;
            return {
                id: String(t.id), number: String(t.number), capacity: num(t.capacity), minCapacity: num(t.min_capacity), zoneId: str(t.zone_id),
                x: num(t.x), y: num(t.y), shape: (String(t.shape) as FloorTable['shape']), rotation: num(t.rotation),
                state: t.state === null || t.state === undefined ? null : (String(t.state) as FloorTable['state']),
            };
        }),
        zones: (Array.isArray(r.zones) ? r.zones : []).map((x) => {
            const z = x as Row;
            return { id: String(z.id), name: String(z.name), x: num(z.x), y: num(z.y), w: num(z.w), h: num(z.h) };
        }),
    };
}

export interface QuoteView {
    guests: number;
    depositPerPerson: number;
    depositAmount: number;
    serviceFeeRate: number;
    serviceFeeAmount: number;
    totalAmount: number;
    confirmation: 'AUTO' | 'MANUELLE';
    slotMinutes: number;
    holdMinutes: number;
    responseMinutes: number;
    cancelFreeHours: number;
    noShowMinutes: number;
}

export async function venueQuote(id: string, guests: number): Promise<QuoteView> {
    const r = okOrRefuse(await rpc('table_quote', { p: { venue_id: id, guests } }));
    return {
        guests: num(r.guests), depositPerPerson: num(r.deposit_per_person), depositAmount: num(r.deposit_amount),
        serviceFeeRate: num(r.service_fee_rate), serviceFeeAmount: num(r.service_fee_amount), totalAmount: num(r.total_amount),
        confirmation: r.confirmation_mode === 'MANUELLE' ? 'MANUELLE' : 'AUTO', slotMinutes: num(r.slot_minutes),
        holdMinutes: num(r.hold_minutes), responseMinutes: num(r.response_minutes), cancelFreeHours: num(r.cancel_free_hours),
        noShowMinutes: num(r.no_show_minutes),
    };
}

// ── Client ───────────────────────────────────────────────────────────────────────────────────────────────

const RESERVATION_COLUMNS = 'id, venue_id, table_id, zone_id, client_id, reservation_date, reservation_time, slot_minutes, guest_count, '
    + 'booking_state, confirmation_mode, deposit_amount, service_fee_amount, total_amount, paid_amount, refunded_amount, hold_expires_at, '
    + 'response_due_at, confirmed_at, arrived_at, absent_at, cancel_origin, cancel_reason, cancelled_at, refund_percent, special_requests, '
    + 'onsite_amount, offline_payment_method, client_coming_at, created_at';

export interface TableReservationView {
    id: string;
    venueId: string;
    venueName: string;
    venuePhoto: string | null;
    venueCity: string | null;
    venueAddress: string | null;
    date: string;
    time: string;
    endTime: string;
    guests: number;
    tableNumber: string | null;
    zoneName: string | null;
    state: string;
    stateLabel: string;
    tone: Tone;
    live: boolean;
    upcoming: boolean;
    depositAmount: number;
    serviceFee: number;
    totalAmount: number;
    paidAmount: number;
    refundedAmount: number;
    holdExpiresAt: string | null;
    responseDueAt: string | null;
    /** Heure de Dakar « HH:MM » jusqu'à laquelle la table est gardée (heure + délai d'absence). */
    heldUntil: string;
    clientComing: boolean;
    notes: string | null;
    cancelReason: string | null;
    createdAt: string;
}

async function noShowMinutes(): Promise<number> {
    const { data, error } = await getServiceRoleClient().from('platform_settings').select('value').eq('key', 'tables.no_show_minutes').maybeSingle();
    if (error) throw new Error(`réglage tables.no_show_minutes : ${error.message}`);
    const v = Number(((data?.value ?? {}) as { value?: unknown }).value);
    if (!Number.isFinite(v)) throw new Error('réglage tables.no_show_minutes absent');
    return v;
}

function addMinutes(date: string, time: string, minutes: number): { date: string; time: string } {
    const d = new Date(`${date}T${time.slice(0, 5)}:00Z`);
    const e = new Date(d.getTime() + minutes * 60_000);
    return { date: e.toISOString().slice(0, 10), time: e.toISOString().slice(11, 16) };
}

/** Lot Carte B3 : états d'une réservation de table confirmée, où le client reçoit l'adresse exacte. */
export const TABLE_ADDRESS_STATES: ReadonlySet<string> = new Set(['CONFIRMEE', 'ARRIVEE']);

function reservationView(r: Row, venue: Row | undefined, table: Row | undefined, zone: Row | undefined, who: 'client' | 'partner', grace: number, now: number): TableReservationView {
    const time = clock(r.reservation_time);
    const date = String(r.reservation_date);
    const end = addMinutes(date, time, num(r.slot_minutes) || 120);
    const view = tableStateView(r.booking_state, who);
    const startMs = Date.parse(`${date}T${time}:00Z`);
    return {
        id: String(r.id), venueId: String(r.venue_id), venueName: str(venue?.name) ?? 'Établissement', venuePhoto: strings(venue?.photos)[0] ?? null,
        // Lot Carte B3 : adresse exacte donnée au client seulement quand sa réservation est confirmée ; retirée si elle
        // est en attente, refusée ou annulée. L'établissement la voit toujours.
        venueCity: str(venue?.city), venueAddress: who === 'partner' || TABLE_ADDRESS_STATES.has(String(r.booking_state)) ? str(venue?.address) : null,
        date, time, endTime: end.time, guests: num(r.guest_count), tableNumber: str(table?.table_number), zoneName: str(zone?.name),
        state: String(r.booking_state), stateLabel: view.label, tone: view.tone, live: tableStateIsLive(r.booking_state),
        upcoming: startMs > now,
        depositAmount: num(r.deposit_amount), serviceFee: num(r.service_fee_amount), totalAmount: num(r.total_amount),
        paidAmount: num(r.paid_amount), refundedAmount: num(r.refunded_amount),
        holdExpiresAt: str(r.hold_expires_at), responseDueAt: r.booking_state === 'EN_ATTENTE_ACCEPTATION' ? str(r.response_due_at) : null,
        heldUntil: addMinutes(date, time, grace).time, clientComing: r.client_coming_at !== null && r.client_coming_at !== undefined,
        notes: str(r.special_requests), cancelReason: str(r.cancel_reason), createdAt: String(r.created_at),
    };
}

async function byIds(table: string, columns: string, ids: string[]): Promise<Map<string, Row>> {
    const unique = [...new Set(ids.filter((x) => UUID_RE.test(x)))];
    if (unique.length === 0) return new Map();
    const { data, error } = await getServiceRoleClient().from(table).select(columns).in('id', unique);
    if (error) throw new Error(`lecture ${table} : ${error.message}`);
    return new Map(((data ?? []) as unknown as Row[]).map((x) => [String(x.id), x]));
}

async function viewsOf(rows: Row[], who: 'client' | 'partner'): Promise<TableReservationView[]> {
    const [venues, tables, zones, grace] = await Promise.all([
        byIds('venues', 'id, name, photos, city, address', rows.map((r) => String(r.venue_id))),
        byIds('restaurant_tables', 'id, table_number', rows.map((r) => String(r.table_id))),
        byIds('restaurant_zones', 'id, name', rows.map((r) => String(r.zone_id))),
        noShowMinutes(),
    ]);
    const now = Date.now();
    return rows.map((r) => reservationView(r, venues.get(String(r.venue_id)), tables.get(String(r.table_id)), zones.get(String(r.zone_id)), who, grace, now));
}

export async function clientReservations(clientId: string): Promise<TableReservationView[]> {
    const { data, error } = await getServiceRoleClient().from('table_reservations').select(RESERVATION_COLUMNS)
        .eq('client_id', clientId).not('venue_id', 'is', null)
        .order('reservation_date', { ascending: false }).order('reservation_time', { ascending: false }).limit(200);
    if (error) throw new Error(`lecture des réservations : ${error.message}`);
    return viewsOf((data ?? []) as unknown as Row[], 'client');
}

export interface ClientTableReservationDetail extends TableReservationView {
    canPay: boolean;
    canCancel: boolean;
    canSayComing: boolean;
    refunds: Array<{ amount: number; paid: boolean; label: string }>;
}

/** Réservation du client de la session ; null si elle n'existe pas ou appartient à un autre compte. */
export async function clientReservation(clientId: string, id: string, servicesOpen: boolean): Promise<ClientTableReservationDetail | null> {
    if (!UUID_RE.test(id)) return null;
    const supabase = getServiceRoleClient();
    const { data, error } = await supabase.from('table_reservations').select(RESERVATION_COLUMNS).eq('id', id).eq('client_id', clientId).maybeSingle();
    if (error) throw new Error(`lecture de la réservation : ${error.message}`);
    if (!data || !(data as unknown as Row).venue_id) return null;
    const [view] = await viewsOf([data as unknown as Row], 'client');
    const { data: pays, error: payErr } = await supabase.from('payments').select('id').eq('table_reservation_id', id);
    if (payErr) throw new Error(`lecture des paiements : ${payErr.message}`);
    const payIds = (pays ?? []).map((p) => String(p.id));
    let refunds: ClientTableReservationDetail['refunds'] = [];
    if (payIds.length > 0) {
        const { data: outs, error: outErr } = await supabase.from('cashouts').select('amount, status').eq('kind', 'REFUND').in('payment_id', payIds);
        if (outErr) throw new Error(`lecture des remboursements : ${outErr.message}`);
        refunds = (outs ?? []).map((c) => ({ amount: num(c.amount), paid: c.status === 'CONFIRME', label: c.status === 'CONFIRME' ? 'Versé' : 'En cours de versement' }));
    }
    const now = Date.now();
    const startMs = Date.parse(`${view.date}T${view.time}:00Z`);
    const holdOk = view.holdExpiresAt !== null && Date.parse(view.holdExpiresAt) > now;
    const graceEnd = Date.parse(`${view.date}T${view.time}:00Z`) + ((await noShowMinutes()) * 60_000);
    return {
        ...view,
        // Paiement : service ouvert, acompte en attente et attente en cours (le montant est relu en base au paiement)
        canPay: servicesOpen && view.state === 'EN_ATTENTE_PAIEMENT' && holdOk && view.upcoming,
        canCancel: view.live && view.upcoming,
        // « J'arrive » : confirmée, de 24 h avant l'heure à la fin de la garde (table_client_coming le revérifie)
        canSayComing: view.state === 'CONFIRMEE' && !view.clientComing && now >= startMs - 24 * 3_600_000 && now < graceEnd,
        refunds,
    };
}

/** Ce que le client récupère s'il annule maintenant (table_cancel_preview). */
export async function cancelPreview(clientId: string, id: string): Promise<{ canCancel: boolean; message: string | null; paidAmount: number; refundAmount: number; keptAmount: number; refundPercent: number; freeUntil: string | null; cancelFreeHours: number }> {
    if (!UUID_RE.test(id)) throw new TableRefusal('RESERVATION_NOT_FOUND', 'Réservation introuvable.');
    const r = okOrRefuse(await rpc('table_cancel_preview', { p: { reservation_id: id, client_id: clientId } }));
    return {
        canCancel: r.can_cancel === true, message: str(r.message), paidAmount: num(r.paid_amount), refundAmount: num(r.refund_amount),
        keptAmount: num(r.kept_amount), refundPercent: num(r.refund_percent), freeUntil: str(r.free_until), cancelFreeHours: num(r.cancel_free_hours),
    };
}

// ── Établissement (partenaire) ───────────────────────────────────────────────────────────────────────────

/** Fiche partenaire de la session (null si le compte n'en a pas). */
export async function partnerOf(userId: string): Promise<{ id: string; status: string } | null> {
    const { data, error } = await getServiceRoleClient().from('partners').select('id, status').eq('user_id', userId).maybeSingle();
    if (error) throw new Error(`lecture du partenaire : ${error.message}`);
    return data ? { id: String(data.id), status: String(data.status) } : null;
}

export async function partnerVenues(userId: string): Promise<Row[]> {
    const partner = await partnerOf(userId);
    if (!partner) throw new PublicError('Espace réservé aux partenaires.', 'FORBIDDEN', 403);
    const supabase = getServiceRoleClient();
    const { data, error } = await supabase.from('venues')
        .select('id, kind, name, city, address, photos, validation_status, validation_reason, is_active, confirmation_mode, deposit_per_person, slot_minutes, floor_plan_enabled, submitted_at, created_at')
        .eq('partner_id', partner.id).order('created_at', { ascending: false });
    if (error) throw new Error(`établissements : ${error.message}`);
    const venues = (data ?? []) as Row[];
    const ids = venues.map((v) => String(v.id));
    const today = new Date().toISOString().slice(0, 10);
    const [tables, live] = ids.length === 0 ? [{ data: [], error: null }, { data: [], error: null }] : await Promise.all([
        supabase.from('restaurant_tables').select('venue_id').in('venue_id', ids).eq('is_active', true),
        supabase.from('table_reservations').select('venue_id, booking_state, reservation_date').in('venue_id', ids)
            .in('booking_state', ['EN_ATTENTE_PAIEMENT', 'EN_ATTENTE_ACCEPTATION', 'CONFIRMEE', 'ARRIVEE']).gte('reservation_date', today),
    ]);
    if (tables.error) throw new Error(`tables : ${tables.error.message}`);
    if (live.error) throw new Error(`réservations : ${live.error.message}`);
    return venues.map((v) => {
        const s = venueStatusView(v.validation_status);
        const mine = ((live.data ?? []) as Row[]).filter((r) => r.venue_id === v.id);
        return {
            id: v.id, kind: v.kind, kindLabel: VENUE_KIND_VIEW[String(v.kind)] ?? 'Établissement', name: v.name, city: v.city, address: v.address,
            photo: strings(v.photos)[0] ?? null, status: v.validation_status, statusLabel: s.label, statusTone: s.tone, statusHint: s.hint,
            reason: v.validation_reason, isActive: v.is_active === true, confirmation: v.confirmation_mode,
            depositPerPerson: v.deposit_per_person === null ? 0 : num(v.deposit_per_person), floorPlan: v.floor_plan_enabled === true,
            tablesCount: ((tables.data ?? []) as Row[]).filter((t) => t.venue_id === v.id).length,
            todayCount: mine.filter((r) => r.reservation_date === today && r.booking_state !== 'EN_ATTENTE_PAIEMENT').length,
            pendingCount: mine.filter((r) => r.booking_state === 'EN_ATTENTE_ACCEPTATION').length,
            submittedAt: v.submitted_at ?? null,
        };
    });
}

/** Établissement de la partenaire de la session (fiche complète pour la modification et la fiche) ; null sinon. */
export async function ownVenue(userId: string, venueId: string): Promise<Row | null> {
    if (!UUID_RE.test(venueId)) return null;
    const partner = await partnerOf(userId);
    if (!partner) return null;
    const supabase = getServiceRoleClient();
    const { data, error } = await supabase.from('venues')
        .select('id, kind, name, description, address, city, latitude, longitude, photos, slot_minutes, deposit_per_person, confirmation_mode, floor_plan_enabled, is_active, validation_status, validation_reason, submitted_at, created_at, updated_at')
        .eq('id', venueId).eq('partner_id', partner.id).maybeSingle();
    if (error) throw new Error(`établissement : ${error.message}`);
    if (!data) return null;
    const v = data as Row;
    const [hours, zones, tables, closures, settings] = await Promise.all([
        supabase.from('venue_opening_hours').select('weekday, opens_at, closes_at').eq('venue_id', venueId).order('weekday').order('opens_at'),
        supabase.from('restaurant_zones').select('id, name, description, is_active, plan_x, plan_y, plan_w, plan_h').eq('venue_id', venueId).order('created_at'),
        supabase.from('restaurant_tables').select('id, table_number, capacity, min_capacity, zone_id, is_active, plan_x, plan_y, plan_shape, plan_rotation').eq('venue_id', venueId).order('table_number'),
        supabase.from('venue_closures').select('id, starts_at, ends_at, reason, created_at').eq('venue_id', venueId).is('cancelled_at', null)
            .gt('ends_at', new Date().toISOString().slice(0, 19)).order('starts_at'),
        supabase.from('platform_settings').select('key, value').in('key', ['tables.slot_minutes', 'tables.response_minutes', 'tables.hold_minutes', 'tables.no_show_minutes', 'tables.cancel_free_hours', 'tables.service_fee_rate']),
    ]);
    for (const r of [hours, zones, tables, closures, settings]) if (r.error) throw new Error(`établissement : ${r.error.message}`);
    const setting = (key: string): number => Number((((settings.data ?? []) as Row[]).find((s) => s.key === key)?.value as { value?: unknown } | undefined)?.value);
    const s = venueStatusView(v.validation_status);
    return {
        id: v.id, kind: v.kind, kindLabel: VENUE_KIND_VIEW[String(v.kind)] ?? 'Établissement', name: v.name, description: v.description,
        address: v.address, city: v.city, latitude: v.latitude, longitude: v.longitude, photos: strings(v.photos),
        slotMinutes: v.slot_minutes === null ? null : num(v.slot_minutes), depositPerPerson: v.deposit_per_person === null ? null : num(v.deposit_per_person),
        confirmation: v.confirmation_mode, floorPlan: v.floor_plan_enabled === true, isActive: v.is_active === true,
        status: v.validation_status, statusLabel: s.label, statusTone: s.tone, statusHint: s.hint, reason: v.validation_reason,
        submittedAt: v.submitted_at ?? null, createdAt: v.created_at, updatedAt: v.updated_at,
        hours: ((hours.data ?? []) as Row[]).map((h) => ({ weekday: num(h.weekday), opensAt: clock(h.opens_at), closesAt: clock(h.closes_at) })),
        zones: ((zones.data ?? []) as Row[]).map((z) => ({
            id: z.id, name: z.name, description: z.description, isActive: z.is_active === true,
            plan: z.plan_x === null ? null : { x: num(z.plan_x), y: num(z.plan_y), w: num(z.plan_w), h: num(z.plan_h) },
        })),
        tables: ((tables.data ?? []) as Row[]).map((t) => ({
            id: t.id, number: t.table_number, capacity: num(t.capacity), minCapacity: num(t.min_capacity), zoneId: t.zone_id, isActive: t.is_active === true,
            plan: t.plan_x === null ? null : { x: num(t.plan_x), y: num(t.plan_y) }, shape: t.plan_shape, rotation: num(t.plan_rotation),
        })),
        closures: ((closures.data ?? []) as Row[]).map((c) => ({ id: c.id, startsAt: c.starts_at, endsAt: c.ends_at, reason: c.reason, createdAt: c.created_at })),
        defaults: {
            slotMinutes: setting('tables.slot_minutes'), responseMinutes: setting('tables.response_minutes'), holdMinutes: setting('tables.hold_minutes'),
            noShowMinutes: setting('tables.no_show_minutes'), cancelFreeHours: setting('tables.cancel_free_hours'), serviceFeeRate: setting('tables.service_fee_rate'),
        },
    };
}

export interface PartnerTableReservationView extends TableReservationView {
    tableId: string | null;
    client: { name: string; phone: string | null };
    onsiteAmount: number | null;
    arrivedAt: string | null;
}

async function partnerViews(rows: Row[]): Promise<PartnerTableReservationView[]> {
    const views = await viewsOf(rows, 'partner');
    const clients = await byIds('users', 'id, first_name, last_name, phone', rows.map((r) => String(r.client_id)));
    return views.map((v, i) => {
        const r = rows[i];
        const c = clients.get(String(r.client_id));
        const last = str(c?.last_name);
        // Coordonnées du client données à l'établissement seulement pour une réservation qui tient la table : demande à
        // accepter, confirmée, ou client arrivé tant que son créneau n'est pas fini (contre-vérification T4 : l'état
        // ARRIVEE ne se clôt jamais) ; jamais pour une attente de paiement ni une réservation close
        const state = String(r.booking_state);
        const slotEnd = Date.parse(`${String(r.reservation_date)}T${clock(r.reservation_time)}:00Z`) + (num(r.slot_minutes) || 120) * 60_000;
        const contact = state === 'EN_ATTENTE_ACCEPTATION' || state === 'CONFIRMEE' || (state === 'ARRIVEE' && Date.now() < slotEnd);
        return {
            ...v, tableId: str(r.table_id),
            client: { name: `${str(c?.first_name) ?? 'Client'}${last ? ` ${last.slice(0, 1)}.` : ''}`, phone: contact ? str(c?.phone) : null },
            onsiteAmount: r.onsite_amount === null || r.onsite_amount === undefined ? null : num(r.onsite_amount),
            arrivedAt: str(r.arrived_at),
        };
    });
}

/** Planning d'un jour d'un établissement de la partenaire : tables, réservations du jour, demandes à accepter (tous les jours). */
export async function planning(userId: string, venueId: string, date: string): Promise<Row | null> {
    if (!UUID_RE.test(venueId) || !DAY_RE.test(date)) return null;
    const partner = await partnerOf(userId);
    if (!partner) return null;
    const supabase = getServiceRoleClient();
    const { data: venue, error } = await supabase.from('venues').select('id, name, floor_plan_enabled, slot_minutes').eq('id', venueId).eq('partner_id', partner.id).maybeSingle();
    if (error) throw new Error(`établissement : ${error.message}`);
    if (!venue) return null;
    const prev = new Date(Date.parse(`${date}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
    const [res, pending, tables, zones, closures] = await Promise.all([
        // La veille aussi : un créneau commencé avant minuit déborde sur le jour
        supabase.from('table_reservations').select(RESERVATION_COLUMNS).eq('venue_id', venueId).in('reservation_date', [prev, date])
            .order('reservation_time'),
        supabase.from('table_reservations').select(RESERVATION_COLUMNS).eq('venue_id', venueId).eq('booking_state', 'EN_ATTENTE_ACCEPTATION')
            .order('response_due_at'),
        supabase.from('restaurant_tables').select('id, table_number, capacity, min_capacity, zone_id, is_active, plan_x, plan_y, plan_shape, plan_rotation').eq('venue_id', venueId).order('table_number'),
        supabase.from('restaurant_zones').select('id, name, plan_x, plan_y, plan_w, plan_h').eq('venue_id', venueId).eq('is_active', true),
        supabase.from('venue_closures').select('starts_at, ends_at, reason').eq('venue_id', venueId).is('cancelled_at', null)
            .lt('starts_at', `${date}T23:59:59`).gt('ends_at', `${date}T00:00:00`),
    ]);
    for (const r of [res, pending, tables, zones, closures]) if (r.error) throw new Error(`planning : ${r.error.message}`);
    const dayStart = Date.parse(`${date}T00:00:00Z`);
    const all = ((res.data ?? []) as unknown as Row[]).filter((r) => {
        const start = Date.parse(`${String(r.reservation_date)}T${clock(r.reservation_time)}:00Z`);
        return start >= dayStart || start + (num(r.slot_minutes) || 120) * 60_000 > dayStart;
    });
    return {
        venue: { id: venue.id, name: venue.name, floorPlan: venue.floor_plan_enabled === true },
        date, now: new Date().toISOString(),
        reservations: await partnerViews(all),
        pending: await partnerViews((pending.data ?? []) as unknown as Row[]),
        tables: ((tables.data ?? []) as Row[]).map((t) => ({
            id: t.id, number: t.table_number, capacity: num(t.capacity), minCapacity: num(t.min_capacity), zoneId: t.zone_id, isActive: t.is_active === true,
            plan: t.plan_x === null ? null : { x: num(t.plan_x), y: num(t.plan_y) }, shape: t.plan_shape, rotation: num(t.plan_rotation),
        })),
        zones: ((zones.data ?? []) as Row[]).map((z) => ({ id: z.id, name: z.name, plan: z.plan_x === null ? null : { x: num(z.plan_x), y: num(z.plan_y), w: num(z.plan_w), h: num(z.plan_h) } })),
        closures: ((closures.data ?? []) as Row[]).map((c) => ({ startsAt: c.starts_at, endsAt: c.ends_at, reason: c.reason })),
    };
}

export interface PartnerReservationDetail extends PartnerTableReservationView {
    actions: { accept: boolean; refuse: boolean; arrived: boolean; absent: boolean; cancel: boolean; onsite: boolean };
    shortCode: string;
}

/** Réservation d'un établissement de la partenaire ; null sinon. Actions possibles : affichage (la base revérifie tout). */
export async function partnerReservation(userId: string, id: string): Promise<PartnerReservationDetail | null> {
    if (!UUID_RE.test(id)) return null;
    const partner = await partnerOf(userId);
    if (!partner) return null;
    const { data, error } = await getServiceRoleClient().from('table_reservations').select(`${RESERVATION_COLUMNS}, short_code`)
        .eq('id', id).eq('partner_id', partner.id).maybeSingle();
    if (error) throw new Error(`réservation : ${error.message}`);
    if (!data || !(data as unknown as Row).venue_id) return null;
    const [[view], grace] = await Promise.all([partnerViews([data as unknown as Row]), noShowMinutes()]);
    const now = Date.now();
    const start = Date.parse(`${view.date}T${view.time}:00Z`);
    const end = Date.parse(`${view.date}T${view.time}:00Z`) + ((num((data as unknown as Row).slot_minutes) || 120) * 60_000);
    const s = view.state;
    return {
        ...view, shortCode: String((data as unknown as Row).short_code),
        actions: {
            accept: s === 'EN_ATTENTE_ACCEPTATION', refuse: s === 'EN_ATTENTE_ACCEPTATION',
            arrived: s === 'CONFIRMEE' && now >= start - 3_600_000 && now < end,
            // Contre-vérification T2 : la table est gardée tables.no_show_minutes après l'heure (la base refuse avant)
            absent: s === 'CONFIRMEE' && now >= start + grace * 60_000 && now < end,
            cancel: tableStateIsLive(s) && now < start,
            onsite: s === 'CONFIRMEE' || s === 'ARRIVEE',
        },
    };
}

export async function partnerEarnings(userId: string): Promise<{ availableTotal: number; upcomingTotal: number; rows: Row[] }> {
    const r = okOrRefuse(await rpc('table_partner_earnings', { p_actor: userId }));
    return {
        availableTotal: num(r.available_total), upcomingTotal: num(r.upcoming_total),
        rows: (Array.isArray(r.rows) ? r.rows : []).map((x) => {
            const e = x as Row;
            const st = tableStateView(e.booking_state, 'partner');
            return {
                reservationId: e.reservation_id, venueId: e.venue_id, venueName: e.venue_name, date: e.date, time: e.time, endTime: e.end_time,
                guests: num(e.guests), stateLabel: st.label, tone: st.tone, paidAmount: num(e.paid_amount), refundedAmount: num(e.refunded_amount),
                earned: num(e.earned), available: e.available === true, availableAt: e.available_at ?? null,
            };
        }),
    };
}

// ── Administration ───────────────────────────────────────────────────────────────────────────────────────

export const ADMIN_STATUSES = ['EN_ATTENTE_VALIDATION', 'VALIDEE', 'REFUSEE', 'SUSPENDUE'] as const;

export async function adminVenues(opts: { status: string; q?: string | null; page: number }): Promise<{ total: number; page: number; pageSize: number; counts: Record<string, number>; venues: Row[] }> {
    if (!(ADMIN_STATUSES as readonly string[]).includes(opts.status)) throw new PublicError('Filtre de statut inconnu.', 'INVALID_FILTER', 400);
    const pageSize = 20;
    const page = Math.max(1, Math.min(opts.page, 500));
    const supabase = getServiceRoleClient();
    let query = supabase.from('venues')
        .select('id, kind, name, city, address, photos, validation_status, validation_reason, submitted_at, created_at, updated_at, partners!inner(id, company_name, commercial_name, status)', { count: 'exact' })
        .eq('validation_status', opts.status)
        // File des établissements en attente par date d'envoi, le plus ancien d'abord
        .order(opts.status === 'EN_ATTENTE_VALIDATION' ? 'submitted_at' : 'updated_at', { ascending: opts.status === 'EN_ATTENTE_VALIDATION', nullsFirst: false })
        .range((page - 1) * pageSize, page * pageSize - 1);
    const q = (opts.q ?? '').trim().slice(0, 80);
    if (q) query = query.or(`name.ilike.${pgIlikeContains(q)},city.ilike.${pgIlikeContains(q)}`);
    const { data, error, count } = await query;
    if (error) throw new Error(`lecture des établissements : ${error.message}`);
    const counts: Record<string, number> = {};
    await Promise.all(ADMIN_STATUSES.map(async (s) => {
        const { count: c, error: cErr } = await supabase.from('venues').select('id', { count: 'exact', head: true }).eq('validation_status', s);
        if (cErr) throw new Error(`compte des établissements : ${cErr.message}`);
        counts[s] = c ?? 0;
    }));
    const rows = (data ?? []) as Row[];
    const tables = rows.length === 0 ? { data: [], error: null } : await supabase.from('restaurant_tables').select('venue_id').in('venue_id', rows.map((v) => String(v.id))).eq('is_active', true);
    if (tables.error) throw new Error(`tables : ${tables.error.message}`);
    const venues = rows.map((v) => {
        const p = v.partners as Row;
        const s = venueStatusView(v.validation_status);
        const photos = strings(v.photos);
        return {
            id: v.id, kind: v.kind, kindLabel: VENUE_KIND_VIEW[String(v.kind)] ?? 'Établissement', name: v.name, city: v.city, address: v.address,
            photo: photos[0] ?? null, photoCount: photos.length,
            tablesCount: ((tables.data ?? []) as Row[]).filter((t) => t.venue_id === v.id).length,
            status: v.validation_status, statusLabel: s.label, statusTone: s.tone, reason: v.validation_reason,
            submittedAt: v.submitted_at ?? null, createdAt: v.created_at, updatedAt: v.updated_at,
            partnerName: str(p?.commercial_name) ?? str(p?.company_name), partnerValidated: p?.status === 'VALIDE',
        };
    });
    return { total: count ?? 0, page, pageSize, counts, venues };
}

/**
 * Fiche de décision d'un établissement. Téléphone et email de la partenaire seulement avec le droit partners.read
 * (« Consulter les partenaires et leurs contacts ») ; sinon null, et contactsAllowed faux (comme les salles, T2 du lot 10b).
 */
export async function adminVenue(id: string, opts: { contacts: boolean }): Promise<Row | null> {
    if (!UUID_RE.test(id)) return null;
    const supabase = getServiceRoleClient();
    const { data, error } = await supabase.from('venues')
        .select('id, kind, name, description, address, city, latitude, longitude, photos, slot_minutes, deposit_per_person, confirmation_mode, floor_plan_enabled, is_active, validation_status, validation_reason, validated_at, submitted_at, created_at, updated_at, partners!inner(id, company_name, commercial_name, status, phone, email, city)')
        .eq('id', id).maybeSingle();
    if (error) throw new Error(`lecture de l’établissement : ${error.message}`);
    if (!data) return null;
    const v = data as unknown as Row & { partners: Row };
    const [hours, zones, tables, res, history] = await Promise.all([
        supabase.from('venue_opening_hours').select('weekday, opens_at, closes_at').eq('venue_id', id).order('weekday').order('opens_at'),
        supabase.from('restaurant_zones').select('id, name, is_active').eq('venue_id', id),
        supabase.from('restaurant_tables').select('id, table_number, capacity, min_capacity, zone_id, is_active').eq('venue_id', id).order('table_number'),
        supabase.from('table_reservations').select('booking_state, reservation_date').eq('venue_id', id),
        supabase.from('audit_logs').select('action, created_at, metadata').eq('object_type', 'venues').eq('object_id', id).order('created_at', { ascending: false }).limit(20),
    ]);
    for (const r of [hours, zones, tables, res, history]) if (r.error) throw new Error(`établissement : ${r.error.message}`);
    const today = new Date().toISOString().slice(0, 10);
    const s = venueStatusView(v.validation_status);
    const p = v.partners;
    return {
        id: v.id, kind: v.kind, kindLabel: VENUE_KIND_VIEW[String(v.kind)] ?? 'Établissement', name: v.name, description: v.description,
        address: v.address, city: v.city, latitude: v.latitude, longitude: v.longitude, photos: strings(v.photos),
        slotMinutes: v.slot_minutes === null ? null : num(v.slot_minutes), depositPerPerson: v.deposit_per_person === null ? null : num(v.deposit_per_person),
        confirmation: v.confirmation_mode, floorPlan: v.floor_plan_enabled === true, isActive: v.is_active === true,
        status: v.validation_status, statusLabel: s.label, statusTone: s.tone, reason: v.validation_reason,
        validatedAt: v.validated_at, submittedAt: v.submitted_at ?? null, createdAt: v.created_at, updatedAt: v.updated_at,
        hours: ((hours.data ?? []) as Row[]).map((h) => ({ weekday: num(h.weekday), opensAt: clock(h.opens_at), closesAt: clock(h.closes_at) })),
        zones: ((zones.data ?? []) as Row[]).map((z) => ({ id: z.id, name: z.name, isActive: z.is_active === true })),
        tables: ((tables.data ?? []) as Row[]).map((t) => ({ id: t.id, number: t.table_number, capacity: num(t.capacity), minCapacity: num(t.min_capacity), zoneId: t.zone_id, isActive: t.is_active === true })),
        upcomingReservations: ((res.data ?? []) as Row[]).filter((r) => tableStateIsLive(r.booking_state) && String(r.reservation_date) >= today).length,
        partner: {
            id: p?.id, name: str(p?.commercial_name) ?? str(p?.company_name), validated: p?.status === 'VALIDE', city: str(p?.city),
            contactsAllowed: opts.contacts, phone: opts.contacts ? str(p?.phone) : null, email: opts.contacts ? str(p?.email) : null,
        },
        history: ((history.data ?? []) as Row[]).map((x) => ({
            at: x.created_at,
            what: x.action === 'VENUE_VALIDATION_DECIDED'
                ? (({ VALIDER: 'Validé', REFUSER: 'Refusé', SUSPENDRE: 'Suspendu', REACTIVER: 'Réactivé' } as Record<string, string>)[String((x.metadata as Row | null)?.decision)] ?? 'Décision')
                : x.action === 'VENUE_SUBMITTED' ? 'Renvoyé en validation' : x.action === 'VENUE_CREATED' ? 'Créé et envoyé en validation'
                    : x.action === 'VENUE_PLAN_SET' ? 'Plan de salle modifié' : x.action === 'VENUE_HOURS_SET' ? 'Horaires modifiés' : 'Modification',
            reason: str((x.metadata as Row | null)?.reason),
        })),
    };
}

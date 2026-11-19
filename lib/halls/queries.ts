/**
 * Lot 10b — salles : lectures pour les écrans (public, client, salle, administration).
 *
 * Toutes passent par la clé de service : chaque fonction filtre elle-même ce que la personne a le droit de voir
 * (salle publique : active, validée, partenaire VALIDE ; client : ses réservations ; salle : les réservations de SES
 * salles ; administration : la route a vérifié le droit halls.validate). Aucun montant n'est calculé ici : prix, frais,
 * acompte, solde et remboursement viennent de la base (hall_quote, réservation figée, hall_cancel_preview,
 * hall_partner_earnings). Colonnes nommées une à une : jamais de « * » renvoyé à un écran.
 */
import { getServiceRoleClient } from '@/lib/supabase/server';
import { PublicError } from '@/lib/api/public-error';
import { cancellationText, type CancellationTerms } from './booking';
import { bookingIsLive, bookingView, hallStatusView } from './views';

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type Row = Record<string, unknown>;

const num = (v: unknown): number => Number(v ?? 0);
const str = (v: unknown): string | null => (typeof v === 'string' && v.length > 0 ? v : null);
const clock = (v: unknown): string | null => {
    const s = str(v);
    if (!s) return null;
    return s === '24:00:00' ? '24:00' : s.slice(0, 5);
};
const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.trim().length > 0) : []);

async function rpc(fn: string, args: Row): Promise<Row> {
    const { data, error } = await getServiceRoleClient().rpc(fn, args);
    if (error) throw new Error(`${fn} : ${error.message}`);
    return (data ?? {}) as Row;
}

/** Refus lisible d'une fonction de la base (message déjà en français simple). */
export class HallRefusal extends Error {
    constructor(public readonly code: string, message: string) {
        super(message);
    }
}

function okOrRefuse(r: Row): Row {
    if (r.ok !== true) throw new HallRefusal(String(r.code ?? 'REFUSED'), String(r.message ?? 'Action impossible pour le moment.'));
    return r;
}

// ── Public ───────────────────────────────────────────────────────────────────────────────────────────────

export interface HallSearchFilters {
    q?: string | null;
    city?: string | null;
    date?: string | null;
    days?: number | null;
    capacity?: number | null;
    priceMax?: number | null;
    sort?: 'recent' | 'price';
    limit?: number;
    offset?: number;
}

export interface HallCard {
    id: string;
    name: string;
    city: string | null;
    address: string | null;
    capacity: number;
    pricePerDay: number;
    pricePerHour: number | null;
    photo: string | null;
    photoCount: number;
    latitude: number | null;
    longitude: number | null;
    partnerName: string | null;
    amenities: string[];
}

export async function searchHalls(f: HallSearchFilters): Promise<{ total: number; halls: HallCard[]; cities: string[]; limit: number; offset: number }> {
    const r = okOrRefuse(await rpc('hall_search', {
        p: {
            q: f.q ?? null, city: f.city ?? null, date: f.date ?? null, days: f.days ?? null,
            capacity: f.capacity ?? null, price_max: f.priceMax ?? null, sort: f.sort ?? 'recent', limit: f.limit ?? 24, offset: f.offset ?? 0,
        },
    }));
    const halls = (Array.isArray(r.halls) ? r.halls : []) as Row[];
    return {
        total: num(r.total),
        limit: num(r.limit),
        offset: num(r.offset),
        cities: strings(r.cities),
        halls: halls.map((h) => ({
            id: String(h.id),
            name: String(h.name),
            city: str(h.city),
            address: str(h.address),
            capacity: num(h.capacity),
            pricePerDay: num(h.price_per_day),
            pricePerHour: h.price_per_hour === null || h.price_per_hour === undefined ? null : num(h.price_per_hour),
            photo: str(h.photo),
            photoCount: num(h.photo_count),
            latitude: h.latitude === null || h.latitude === undefined ? null : Number(h.latitude),
            longitude: h.longitude === null || h.longitude === undefined ? null : Number(h.longitude),
            partnerName: str(h.partner_name),
            amenities: strings(h.amenities).slice(0, 12),
        })),
    };
}

export interface PublicHall extends HallCard {
    description: string | null;
    photos: string[];
    deposit: { mode: 'POURCENTAGE' | 'MONTANT_FIXE'; value: number | null };
    depositText: string;
    cancellation: string;
    policy: string;
    serviceFeeRate: number;
    balanceDueDays: number;
}

/** Fiche publique d'une salle (null si absente, inactive, non validée ou d'une partenaire non VALIDE). */
export async function publicHall(id: string): Promise<PublicHall | null> {
    if (!UUID_RE.test(id)) return null;
    const supabase = getServiceRoleClient();
    const { data, error } = await supabase
        .from('halls')
        .select('id, name, description, capacity, price_per_day, price_per_hour, deposit_mode, deposit_value, cancellation_policy, '
            + 'latitude, longitude, address, city, amenities, images, partners!inner(commercial_name, company_name, status)')
        .eq('id', id)
        .eq('is_active', true)
        .eq('validation_status', 'VALIDEE')
        .eq('partners.status', 'VALIDE')
        .maybeSingle();
    if (error) throw new Error(`lecture de la salle : ${error.message}`);
    if (!data) return null;
    const h = data as unknown as Row & { partners: Row };
    if (h.price_per_day === null || num(h.price_per_day) < 1) return null;
    const [terms, settings] = await Promise.all([
        rpc('hall_cancel_terms', { p_policy: h.cancellation_policy }),
        supabase.from('platform_settings').select('key, value').in('key', ['halls.service_fee_rate', 'halls.deposit_default_percent', 'halls.balance_due_days']),
    ]);
    if (settings.error) throw new Error(`réglages des salles : ${settings.error.message}`);
    const setting = (key: string): number => num(((settings.data ?? []).find((s) => s.key === key)?.value as { value?: unknown } | undefined)?.value);
    const mode = h.deposit_mode === 'MONTANT_FIXE' ? 'MONTANT_FIXE' : 'POURCENTAGE';
    const depositValue = h.deposit_value === null || h.deposit_value === undefined ? null : num(h.deposit_value);
    const pct = mode === 'POURCENTAGE' ? (depositValue ?? setting('halls.deposit_default_percent')) : null;
    const photos = strings(h.images);
    const partner = h.partners;
    return {
        id: String(h.id),
        name: String(h.name),
        description: str(h.description),
        city: str(h.city),
        address: str(h.address),
        capacity: num(h.capacity),
        pricePerDay: num(h.price_per_day),
        pricePerHour: h.price_per_hour === null || h.price_per_hour === undefined ? null : num(h.price_per_hour),
        photo: photos[0] ?? null,
        photos,
        photoCount: photos.length,
        latitude: h.latitude === null || h.latitude === undefined ? null : Number(h.latitude),
        longitude: h.longitude === null || h.longitude === undefined ? null : Number(h.longitude),
        partnerName: str(partner?.commercial_name) ?? str(partner?.company_name),
        amenities: (Array.isArray(h.amenities) ? h.amenities : []).filter((a): a is string => typeof a === 'string').slice(0, 30),
        deposit: { mode, value: depositValue },
        depositText: mode === 'MONTANT_FIXE'
            ? `Acompte fixe de ${String(depositValue).replace(/\B(?=(\d{3})+(?!\d))/g, ' ')} F CFA (plafonné au prix), plus sa part des frais de service.`
            : `Acompte de ${pct} % du prix, plus sa part des frais de service.`,
        cancellation: cancellationText(terms as unknown as CancellationTerms),
        policy: String(h.cancellation_policy ?? ''),
        serviceFeeRate: setting('halls.service_fee_rate'),
        balanceDueDays: setting('halls.balance_due_days'),
    };
}

export interface BusySlot { startDate: string; endDate: string; startTime: string | null; endTime: string | null }

export async function hallCalendar(id: string, from: string | null, to: string | null): Promise<{ from: string; to: string; today: string; busy: BusySlot[] }> {
    const r = okOrRefuse(await rpc('hall_calendar', { p: { hall_id: id, from, to } }));
    const busy = (Array.isArray(r.busy) ? r.busy : []) as Row[];
    return {
        from: String(r.from),
        to: String(r.to),
        today: String(r.today),
        busy: busy.map((b) => ({ startDate: String(b.start_date), endDate: String(b.end_date), startTime: clock(b.start_time), endTime: clock(b.end_time) })),
    };
}

export interface HallQuoteView {
    mode: 'JOUR' | 'HEURE';
    units: number;
    startDate: string;
    endDate: string;
    startTime: string | null;
    endTime: string | null;
    priceAmount: number;
    serviceFeeAmount: number;
    totalAmount: number;
    depositAmount: number;
    balanceAmount: number;
    balanceDueAt: string | null;
    fullPaymentRequired: boolean;
    cancellation: string;
}

export function quoteView(r: Row): HallQuoteView {
    return {
        mode: r.mode === 'HEURE' ? 'HEURE' : 'JOUR',
        units: num(r.units),
        startDate: String(r.start_date),
        endDate: String(r.end_date),
        startTime: clock(r.start_time),
        endTime: clock(r.end_time),
        priceAmount: num(r.price_amount),
        serviceFeeAmount: num(r.service_fee_amount),
        totalAmount: num(r.total_amount),
        depositAmount: num(r.deposit_amount),
        balanceAmount: num(r.balance_amount),
        balanceDueAt: str(r.balance_due_at),
        fullPaymentRequired: r.full_payment_required === true,
        cancellation: cancellationText(r.cancellation_terms as CancellationTerms),
    };
}

/** Devis d'une réservation (calculé en base par hall_quote, rien n'est écrit). */
export async function hallQuote(p: { hallId: string; mode: 'JOUR' | 'HEURE'; startDate: string; units: number; startTime: string | null }): Promise<HallQuoteView> {
    const r = okOrRefuse(await rpc('hall_quote', {
        p: { hall_id: p.hallId, mode: p.mode, start_date: p.startDate, units: p.units, start_time: p.mode === 'HEURE' ? p.startTime : null },
    }));
    return quoteView(r);
}

// ── Réservations : colonnes communes ────────────────────────────────────────────────────────────────────

const RESERVATION_COLUMNS = 'id, hall_id, client_id, start_date, end_date, start_time, end_time, booking_state, booking_mode, units, '
    + 'price_amount, service_fee_amount, total_amount, deposit_amount, balance_amount, paid_amount, refunded_amount, '
    + 'full_payment_required, balance_due_at, hold_expires_at, cancellation_policy, cancellation_terms, cancel_origin, '
    + 'cancel_reason, cancelled_at, refund_percent, confirmed_at, created_at';

export interface ReservationView {
    id: string;
    hallId: string;
    hallName: string;
    hallCity: string | null;
    hallAddress: string | null;
    hallPhoto: string | null;
    startDate: string;
    endDate: string;
    startTime: string | null;
    endTime: string | null;
    mode: 'JOUR' | 'HEURE';
    units: number;
    state: string;
    stateLabel: string;
    stateTone: string;
    priceAmount: number;
    serviceFeeAmount: number;
    totalAmount: number;
    depositAmount: number;
    paidAmount: number;
    refundedAmount: number;
    remainingAmount: number;
    fullPaymentRequired: boolean;
    balanceDueAt: string | null;
    holdExpiresAt: string | null;
    cancellation: string;
    cancelReason: string | null;
    cancelledAt: string | null;
    createdAt: string;
    live: boolean;
    upcoming: boolean;
}

function reservationView(r: Row, hall: Row | undefined, who: 'client' | 'partner', now: number): ReservationView {
    const state = String(r.booking_state);
    const view = bookingView(state, who);
    const startAt = Date.parse(`${String(r.start_date)}T${clock(r.start_time) ?? '00:00'}:00Z`);
    const photos = strings(hall?.images);
    return {
        id: String(r.id),
        hallId: String(r.hall_id),
        hallName: String(hall?.name ?? 'Salle'),
        hallCity: str(hall?.city),
        hallAddress: str(hall?.address),
        hallPhoto: photos[0] ?? null,
        startDate: String(r.start_date),
        endDate: String(r.end_date),
        startTime: clock(r.start_time),
        endTime: clock(r.end_time),
        mode: r.booking_mode === 'HEURE' ? 'HEURE' : 'JOUR',
        units: num(r.units),
        state,
        stateLabel: view.label,
        stateTone: view.tone,
        priceAmount: num(r.price_amount),
        serviceFeeAmount: num(r.service_fee_amount),
        totalAmount: num(r.total_amount),
        depositAmount: num(r.deposit_amount),
        paidAmount: num(r.paid_amount),
        refundedAmount: num(r.refunded_amount),
        remainingAmount: bookingIsLive(state) ? Math.max(num(r.total_amount) - num(r.paid_amount), 0) : 0,
        fullPaymentRequired: r.full_payment_required === true,
        balanceDueAt: state === 'ACOMPTE_PAYE' ? str(r.balance_due_at) : null,
        holdExpiresAt: state === 'EN_ATTENTE_PAIEMENT' ? str(r.hold_expires_at) : null,
        cancellation: cancellationText(r.cancellation_terms as CancellationTerms),
        cancelReason: str(r.cancel_reason),
        cancelledAt: str(r.cancelled_at),
        createdAt: String(r.created_at),
        live: bookingIsLive(state),
        upcoming: Number.isFinite(startAt) && startAt > now,
    };
}

async function hallsById(ids: string[]): Promise<Map<string, Row>> {
    const unique = [...new Set(ids)];
    if (unique.length === 0) return new Map();
    const { data, error } = await getServiceRoleClient().from('halls').select('id, name, city, address, images').in('id', unique);
    if (error) throw new Error(`lecture des salles : ${error.message}`);
    return new Map((data ?? []).map((h) => [String(h.id), h as Row]));
}

// ── Client ───────────────────────────────────────────────────────────────────────────────────────────────

/** Réservations de salle du client de la session, les plus récentes d'abord (200 au plus). */
export async function clientReservations(clientId: string): Promise<ReservationView[]> {
    const { data, error } = await getServiceRoleClient()
        .from('hall_reservations').select(RESERVATION_COLUMNS)
        .eq('client_id', clientId)
        .order('start_date', { ascending: false })
        .limit(200);
    if (error) throw new Error(`lecture des réservations : ${error.message}`);
    const rows = (data ?? []) as unknown as Row[];
    const halls = await hallsById(rows.map((r) => String(r.hall_id)));
    const now = Date.now();
    return rows.map((r) => reservationView(r, halls.get(String(r.hall_id)), 'client', now));
}

export interface ClientReservationDetail extends ReservationView {
    canPay: null | { parts: Array<'ACOMPTE' | 'SOLDE' | 'INTEGRAL'>; amounts: Partial<Record<'ACOMPTE' | 'SOLDE' | 'INTEGRAL', number>> };
    canCancel: boolean;
    refunds: Array<{ amount: number; paid: boolean; label: string }>;
}

/** Réservation du client de la session ; null si elle n'existe pas ou appartient à un autre compte. */
export async function clientReservation(clientId: string, id: string): Promise<ClientReservationDetail | null> {
    if (!UUID_RE.test(id)) return null;
    const supabase = getServiceRoleClient();
    const { data, error } = await supabase.from('hall_reservations').select(RESERVATION_COLUMNS).eq('id', id).eq('client_id', clientId).maybeSingle();
    if (error) throw new Error(`lecture de la réservation : ${error.message}`);
    if (!data) return null;
    const r = data as unknown as Row;
    const halls = await hallsById([String(r.hall_id)]);
    const view = reservationView(r, halls.get(String(r.hall_id)), 'client', Date.now());
    const { data: pays, error: payErr } = await supabase.from('payments').select('id').eq('hall_reservation_id', id);
    if (payErr) throw new Error(`lecture des paiements : ${payErr.message}`);
    const payIds = (pays ?? []).map((p) => String(p.id));
    let refunds: ClientReservationDetail['refunds'] = [];
    if (payIds.length > 0) {
        const { data: outs, error: outErr } = await supabase.from('cashouts').select('amount, status').eq('kind', 'REFUND').in('payment_id', payIds);
        if (outErr) throw new Error(`lecture des remboursements : ${outErr.message}`);
        refunds = (outs ?? []).map((c) => ({
            amount: num(c.amount),
            paid: c.status === 'CONFIRME',
            label: c.status === 'CONFIRME' ? 'Versé' : 'En cours de versement',
        }));
    }
    // Paiements possibles : montants relus sur la réservation figée (jamais recalculés ici)
    let canPay: ClientReservationDetail['canPay'] = null;
    const holdOk = view.holdExpiresAt !== null && Date.parse(view.holdExpiresAt) > Date.now();
    if (view.state === 'EN_ATTENTE_PAIEMENT' && holdOk && view.upcoming) {
        canPay = view.fullPaymentRequired || view.depositAmount >= view.totalAmount
            ? { parts: ['INTEGRAL'], amounts: { INTEGRAL: view.totalAmount } }
            : { parts: ['ACOMPTE', 'INTEGRAL'], amounts: { ACOMPTE: view.depositAmount, INTEGRAL: view.totalAmount } };
    } else if (view.state === 'ACOMPTE_PAYE' && view.balanceDueAt && Date.parse(view.balanceDueAt) > Date.now()) {
        canPay = { parts: ['SOLDE'], amounts: { SOLDE: view.remainingAmount } };
    }
    return { ...view, canPay, canCancel: view.live && view.upcoming, refunds };
}

/** Montant rendu si le client annule maintenant (hall_cancel_preview). */
export async function cancelPreview(clientId: string, id: string): Promise<{ refundAmount: number; refundPercent: number; paidAmount: number; keptAmount: number }> {
    if (!UUID_RE.test(id)) throw new HallRefusal('RESERVATION_NOT_FOUND', 'Réservation introuvable.');
    const r = okOrRefuse(await rpc('hall_cancel_preview', { p: { reservation_id: id, client_id: clientId } }));
    return { refundAmount: num(r.refund_amount), refundPercent: num(r.refund_percent), paidAmount: num(r.paid_amount), keptAmount: num(r.kept_amount) };
}

// ── Salle (partenaire) ───────────────────────────────────────────────────────────────────────────────────

/** Fiche partenaire de la session (null si le compte n'en a pas). */
export async function partnerOf(userId: string): Promise<{ id: string; status: string } | null> {
    const { data, error } = await getServiceRoleClient().from('partners').select('id, status').eq('user_id', userId).maybeSingle();
    if (error) throw new Error(`lecture du partenaire : ${error.message}`);
    return data ? { id: String(data.id), status: String(data.status) } : null;
}

export interface PartnerReservationView extends ReservationView {
    clientName: string | null;
    clientPhone: string | null;
    notes: string | null;
}

async function clientsById(ids: string[]): Promise<Map<string, Row>> {
    const unique = [...new Set(ids)];
    if (unique.length === 0) return new Map();
    const { data, error } = await getServiceRoleClient().from('users').select('id, first_name, last_name, phone').in('id', unique);
    if (error) throw new Error(`lecture des clients : ${error.message}`);
    return new Map((data ?? []).map((u) => [String(u.id), u as Row]));
}

/** Coordonnées du client données à la salle seulement pour une réservation payée (acompte au moins). */
function partnerReservationView(r: Row, hall: Row | undefined, client: Row | undefined, now: number): PartnerReservationView {
    const view = reservationView(r, hall, 'partner', now);
    const paid = view.state === 'ACOMPTE_PAYE' || view.state === 'PAYEE';
    const name = [str(client?.first_name), str(client?.last_name)].filter(Boolean).join(' ');
    return {
        ...view,
        clientName: name ? (paid ? name : `${str(client?.first_name) ?? 'Client'}`) : null,
        clientPhone: paid ? str(client?.phone) : null,
        notes: paid ? str(r.notes) : null,
    };
}

/**
 * Réservations des salles de la partenaire de la session, sur une période (calendrier) ; une salle donnée si `hallId`.
 * Seules celles qui tiennent ou ont tenu une date utile : les attentes échues (« Non payée à temps ») sont exclues.
 */
export async function partnerReservations(userId: string, opts: { from: string; to: string; hallId?: string | null }): Promise<PartnerReservationView[]> {
    const partner = await partnerOf(userId);
    if (!partner) return [];
    let query = getServiceRoleClient().from('hall_reservations').select(`${RESERVATION_COLUMNS}, notes`)
        .eq('partner_id', partner.id)
        .neq('booking_state', 'EXPIREE')
        .lte('start_date', opts.to)
        .gte('end_date', opts.from)
        .order('start_date', { ascending: true })
        .limit(500);
    if (opts.hallId) query = query.eq('hall_id', opts.hallId);
    const { data, error } = await query;
    if (error) throw new Error(`lecture des réservations : ${error.message}`);
    const rows = (data ?? []) as unknown as Row[];
    const [halls, clients] = await Promise.all([hallsById(rows.map((r) => String(r.hall_id))), clientsById(rows.map((r) => String(r.client_id)))]);
    const now = Date.now();
    return rows.map((r) => partnerReservationView(r, halls.get(String(r.hall_id)), clients.get(String(r.client_id)), now));
}

/** Une réservation d'une salle de la partenaire de la session ; null sinon (404 pour tout autre compte). */
export async function partnerReservation(userId: string, id: string): Promise<(PartnerReservationView & { canCancel: boolean }) | null> {
    if (!UUID_RE.test(id)) return null;
    const partner = await partnerOf(userId);
    if (!partner) return null;
    const { data, error } = await getServiceRoleClient().from('hall_reservations').select(`${RESERVATION_COLUMNS}, notes`)
        .eq('id', id).eq('partner_id', partner.id).maybeSingle();
    if (error) throw new Error(`lecture de la réservation : ${error.message}`);
    if (!data) return null;
    const r = data as unknown as Row;
    const [halls, clients] = await Promise.all([hallsById([String(r.hall_id)]), clientsById([String(r.client_id)])]);
    const view = partnerReservationView(r, halls.get(String(r.hall_id)), clients.get(String(r.client_id)), Date.now());
    return { ...view, canCancel: view.live && view.upcoming };
}

export interface EarningRow {
    reservationId: string;
    hallId: string;
    hallName: string;
    startDate: string;
    endDate: string;
    startTime: string | null;
    endTime: string | null;
    stateLabel: string;
    paidAmount: number;
    refundedAmount: number;
    earned: number;
    availableAt: string | null;
    available: boolean;
}

export async function partnerEarnings(userId: string): Promise<{ availableTotal: number; upcomingTotal: number; rows: EarningRow[] }> {
    const r = okOrRefuse(await rpc('hall_partner_earnings', { p_actor: userId }));
    const rows = (Array.isArray(r.rows) ? r.rows : []) as Row[];
    return {
        availableTotal: num(r.available_total),
        upcomingTotal: num(r.upcoming_total),
        rows: rows.map((x) => ({
            reservationId: String(x.reservation_id),
            hallId: String(x.hall_id),
            hallName: String(x.hall_name),
            startDate: String(x.start_date),
            endDate: String(x.end_date),
            startTime: clock(x.start_time),
            endTime: clock(x.end_time),
            stateLabel: bookingView(x.booking_state, 'partner').label,
            paidAmount: num(x.paid_amount),
            refundedAmount: num(x.refunded_amount),
            earned: num(x.earned),
            availableAt: str(x.available_at),
            available: x.available === true,
        })),
    };
}

/** Salles de la partenaire de la session, avec le nombre de réservations à venir qui tiennent une date. */
export async function partnerHalls(userId: string): Promise<Array<Row & { statusLabel: string; statusTone: string; statusHint: string; upcomingCount: number }>> {
    const partner = await partnerOf(userId);
    if (!partner) return [];
    const supabase = getServiceRoleClient();
    const { data, error } = await supabase.from('halls')
        .select('id, name, capacity, price_per_day, price_per_hour, city, address, images, is_active, validation_status, validation_reason, updated_at')
        .eq('partner_id', partner.id).order('created_at', { ascending: false });
    if (error) throw new Error(`lecture des salles : ${error.message}`);
    const halls = (data ?? []) as Row[];
    const ids = halls.map((h) => String(h.id));
    const counts = new Map<string, number>();
    if (ids.length > 0) {
        const today = new Date().toISOString().slice(0, 10);
        const { data: res, error: resErr } = await supabase.from('hall_reservations').select('hall_id')
            .in('hall_id', ids).in('booking_state', ['EN_ATTENTE_PAIEMENT', 'ACOMPTE_PAYE', 'PAYEE']).gte('end_date', today);
        if (resErr) throw new Error(`lecture des réservations : ${resErr.message}`);
        for (const r of res ?? []) counts.set(String(r.hall_id), (counts.get(String(r.hall_id)) ?? 0) + 1);
    }
    return halls.map((h) => {
        const v = hallStatusView(h.validation_status);
        return { ...h, statusLabel: v.label, statusTone: v.tone, statusHint: v.hint, upcomingCount: counts.get(String(h.id)) ?? 0 };
    });
}

// ── Administration ───────────────────────────────────────────────────────────────────────────────────────

const ADMIN_STATUSES = ['EN_ATTENTE_VALIDATION', 'VALIDEE', 'REFUSEE', 'SUSPENDUE'] as const;

export async function adminHalls(opts: { status: string; q?: string | null; page: number }): Promise<{ total: number; page: number; pageSize: number; counts: Record<string, number>; halls: Row[] }> {
    if (!(ADMIN_STATUSES as readonly string[]).includes(opts.status)) throw new PublicError('Filtre de statut inconnu.', 'INVALID_FILTER', 400);
    const pageSize = 20;
    const page = Math.max(1, Math.min(opts.page, 500));
    const supabase = getServiceRoleClient();
    let query = supabase.from('halls')
        .select('id, name, city, address, capacity, price_per_day, price_per_hour, images, validation_status, validation_reason, created_at, updated_at, partners!inner(id, company_name, commercial_name, status)', { count: 'exact' })
        .eq('validation_status', opts.status)
        .order(opts.status === 'EN_ATTENTE_VALIDATION' ? 'updated_at' : 'updated_at', { ascending: opts.status === 'EN_ATTENTE_VALIDATION' })
        .range((page - 1) * pageSize, page * pageSize - 1);
    const q = (opts.q ?? '').trim().slice(0, 80).replace(/[%_,()\\]/g, ' ').trim();
    if (q) query = query.or(`name.ilike.%${q}%,city.ilike.%${q}%`);
    const { data, error, count } = await query;
    if (error) throw new Error(`lecture des salles : ${error.message}`);
    const counts: Record<string, number> = {};
    await Promise.all(ADMIN_STATUSES.map(async (s) => {
        const { count: c, error: cErr } = await supabase.from('halls').select('id', { count: 'exact', head: true }).eq('validation_status', s);
        if (cErr) throw new Error(`compte des salles : ${cErr.message}`);
        counts[s] = c ?? 0;
    }));
    const halls = ((data ?? []) as Row[]).map((h) => {
        const p = h.partners as Row;
        const v = hallStatusView(h.validation_status);
        const photos = strings(h.images);
        return {
            id: h.id, name: h.name, city: h.city, address: h.address, capacity: h.capacity,
            pricePerDay: h.price_per_day === null ? null : num(h.price_per_day),
            pricePerHour: h.price_per_hour === null ? null : num(h.price_per_hour),
            photo: photos[0] ?? null, photoCount: photos.length,
            status: h.validation_status, statusLabel: v.label, statusTone: v.tone, reason: h.validation_reason,
            createdAt: h.created_at, updatedAt: h.updated_at,
            partnerName: str(p?.commercial_name) ?? str(p?.company_name),
            partnerValidated: p?.status === 'VALIDE',
        };
    });
    return { total: count ?? 0, page, pageSize, counts, halls };
}

export async function adminHall(id: string): Promise<Row | null> {
    if (!UUID_RE.test(id)) return null;
    const supabase = getServiceRoleClient();
    const { data, error } = await supabase.from('halls')
        .select('id, name, description, capacity, price_per_day, price_per_hour, deposit_mode, deposit_value, cancellation_policy, latitude, longitude, address, city, amenities, images, is_active, validation_status, validation_reason, validated_at, created_at, updated_at, partners!inner(id, company_name, commercial_name, status, phone, email, city)')
        .eq('id', id).maybeSingle();
    if (error) throw new Error(`lecture de la salle : ${error.message}`);
    if (!data) return null;
    const h = data as unknown as Row & { partners: Row };
    const terms = await rpc('hall_cancel_terms', { p_policy: h.cancellation_policy });
    const { data: res, error: resErr } = await supabase.from('hall_reservations').select('booking_state, end_date').eq('hall_id', id);
    if (resErr) throw new Error(`lecture des réservations : ${resErr.message}`);
    const today = new Date().toISOString().slice(0, 10);
    const upcoming = (res ?? []).filter((r) => bookingIsLive(r.booking_state) && String(r.end_date) >= today).length;
    const { data: history, error: histErr } = await supabase.from('audit_logs')
        .select('action, created_at, new_value, metadata').eq('object_type', 'halls').eq('object_id', id)
        .order('created_at', { ascending: false }).limit(20);
    if (histErr) throw new Error(`lecture de l’historique : ${histErr.message}`);
    const v = hallStatusView(h.validation_status);
    const p = h.partners;
    return {
        id: h.id, name: h.name, description: h.description, capacity: h.capacity,
        pricePerDay: h.price_per_day === null ? null : num(h.price_per_day),
        pricePerHour: h.price_per_hour === null ? null : num(h.price_per_hour),
        depositMode: h.deposit_mode, depositValue: h.deposit_value === null ? null : num(h.deposit_value),
        cancellation: cancellationText(terms as unknown as CancellationTerms),
        latitude: h.latitude, longitude: h.longitude, address: h.address, city: h.city,
        amenities: Array.isArray(h.amenities) ? h.amenities : [], photos: strings(h.images),
        isActive: h.is_active === true,
        status: h.validation_status, statusLabel: v.label, statusTone: v.tone, reason: h.validation_reason,
        validatedAt: h.validated_at, createdAt: h.created_at, updatedAt: h.updated_at,
        upcomingReservations: upcoming,
        partner: { id: p?.id, name: str(p?.commercial_name) ?? str(p?.company_name), validated: p?.status === 'VALIDE', phone: str(p?.phone), email: str(p?.email), city: str(p?.city) },
        history: (history ?? []).map((x) => ({
            at: x.created_at,
            what: x.action === 'HALL_VALIDATION_DECIDED'
                ? (({ VALIDER: 'Validée', REFUSER: 'Refusée', SUSPENDRE: 'Suspendue', REACTIVER: 'Réactivée' } as Record<string, string>)[String((x.metadata as Row | null)?.decision)] ?? 'Décision')
                : x.action === 'HALL_SUBMITTED' ? 'Renvoyée en validation' : 'Modification',
            reason: str((x.metadata as Row | null)?.reason),
        })),
    };
}

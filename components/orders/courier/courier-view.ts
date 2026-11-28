/**
 * Lot 12d — lecture défensive des réponses du livreur (GET /api/courier/orders, GET /api/courier/orders/[id],
 * GET /api/courier/invitations/[id]). Aucun montant n'est calculé ici : chaque montant affiché est un champ servi par la
 * base, tel quel (amounts.balance_due = reste à encaisser).
 */

type Row = Record<string, unknown>;

const isRow = (v: unknown): v is Row => !!v && typeof v === 'object' && !Array.isArray(v);
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() !== '' ? v : null);
const num = (v: unknown): number => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
};

export interface CourierItem {
    name: string;
    quantity: number;
    options: string[];
    notes: string | null;
}

export type AbsencePhase = 'ATTENTE' | 'EQUIPE' | 'DECIDEE';

export interface CourierDelivery {
    id: string;
    orderNumber: string;
    state: string;
    venueName: string;
    venueAddress: string | null;
    zoneName: string | null;
    scheduledFor: string | null;
    estimatedAt: string | null;
    steps: Record<string, unknown>;
    items: CourierItem[];
    /** Reste à encaisser auprès du client, servi par la base (0 : rien à encaisser). */
    balanceDue: number;
    address: string | null;
    notes: string | null;
    /** Téléphone du client : servi seulement pendant la livraison (commande en route). */
    phone: string | null;
    calls: number;
    canReportAbsent: boolean;
    absence: { phase: AbsencePhase; waitUntil: string | null; reportedAt: string | null } | null;
}

export interface CourierDone {
    id: string;
    orderNumber: string;
    stateLabel: string;
    venueName: string;
    zoneName: string | null;
    closedAt: string | null;
    onsiteAmount: number | null;
}

export interface CourierInvitationRef {
    id: string;
    partnerName: string;
    invitedAt: string | null;
}

export interface CourierDay {
    active: CourierDelivery[];
    done: CourierDone[];
    invitations: CourierInvitationRef[];
}

export function readDelivery(o: unknown): CourierDelivery | null {
    if (!isRow(o)) return null;
    const id = str(o.id);
    const state = str(o.state);
    if (!id || !state) return null;
    const venue = isRow(o.venue) ? o.venue : {};
    const a = isRow(o.amounts) ? o.amounts : {};
    const contact = isRow(o.contact) ? o.contact : {};
    const abs = isRow(o.absence) ? o.absence : null;
    const phase = abs && (abs.phase === 'ATTENTE' || abs.phase === 'EQUIPE' || abs.phase === 'DECIDEE') ? abs.phase : null;
    return {
        id,
        orderNumber: str(o.order_number) ?? '',
        state,
        venueName: str(venue.name) ?? 'Établissement',
        venueAddress: str(o.venue_address),
        zoneName: str(o.zone_name),
        scheduledFor: str(o.scheduled_for),
        estimatedAt: str(o.estimated_at),
        steps: isRow(o.steps) ? o.steps : {},
        items: (Array.isArray(o.items) ? o.items : []).filter(isRow).map((it) => ({
            name: str(it.name) ?? 'Produit',
            quantity: num(it.quantity),
            options: (Array.isArray(it.options) ? it.options : []).filter(isRow).map((x) => str(x.name)).filter((x): x is string => x !== null),
            notes: str(it.notes),
        })),
        balanceDue: num(a.balance_due),
        address: str(contact.address),
        notes: str(contact.notes),
        phone: str(contact.phone),
        calls: num(o.calls),
        canReportAbsent: o.can_report_absent === true,
        absence: phase ? { phase, waitUntil: str(abs!.wait_until), reportedAt: str(abs!.reported_at) } : null,
    };
}

export function readDay(body: unknown): CourierDay | null {
    if (!isRow(body) || !Array.isArray(body.orders)) return null;
    const active = body.orders.map(readDelivery).filter((x): x is CourierDelivery => x !== null);
    const done = (Array.isArray(body.done) ? body.done : []).filter(isRow).map((d): CourierDone | null => {
        const id = str(d.id);
        if (!id) return null;
        const venue = isRow(d.venue) ? d.venue : {};
        return {
            id,
            orderNumber: str(d.order_number) ?? '',
            stateLabel: str(d.stateLabel) ?? 'Terminée',
            venueName: str(venue.name) ?? 'Établissement',
            zoneName: str(d.zone_name),
            closedAt: str(d.closed_at),
            onsiteAmount: d.onsite_amount === null || d.onsite_amount === undefined ? null : num(d.onsite_amount),
        };
    }).filter((x): x is CourierDone => x !== null);
    const invitations = (Array.isArray(body.invitations) ? body.invitations : []).filter(isRow).map((i): CourierInvitationRef | null => {
        const id = str(i.id);
        return id ? { id, partnerName: str(i.partner_name) ?? 'Un établissement', invitedAt: str(i.invited_at) } : null;
    }).filter((x): x is CourierInvitationRef => x !== null);
    return { active, done, invitations };
}

export interface CourierInvitation {
    id: string;
    status: 'PENDING' | 'ACTIVE' | 'DECLINED' | 'REMOVED' | string;
    partnerName: string;
    venues: string[];
    invitedAt: string | null;
}

export function readInvitation(body: unknown): CourierInvitation | null {
    if (!isRow(body) || !isRow(body.invitation)) return null;
    const i = body.invitation;
    const id = str(i.id);
    if (!id) return null;
    return {
        id,
        status: str(i.status) ?? 'PENDING',
        partnerName: str(i.partner_name) ?? 'Un établissement',
        venues: (Array.isArray(i.venues) ? i.venues : []).map(str).filter((x): x is string => x !== null),
        invitedAt: str(i.invited_at),
    };
}

/** Groupe d'une livraison en cours (écran du jour). */
export type CourierGroup = 'CUISINE' | 'PRETE' | 'ROUTE' | 'ABSENT';

export function groupOf(d: CourierDelivery): CourierGroup {
    if (d.state === 'PRETE') return 'PRETE';
    if (d.state === 'EN_ROUTE') return d.absence ? 'ABSENT' : 'ROUTE';
    return 'CUISINE';
}

export const GROUP_LABELS: Record<CourierGroup, string> = {
    ROUTE: 'En route',
    ABSENT: 'Client absent',
    PRETE: 'Prêtes à partir',
    CUISINE: 'En cuisine',
};

/** Ordre d'affichage : ce qui demande une action tout de suite d'abord. */
export const GROUP_ORDER: CourierGroup[] = ['ROUTE', 'ABSENT', 'PRETE', 'CUISINE'];

/** Libellé court de l'état d'une livraison en cours, pour le livreur. */
export function courierStateLabel(d: CourierDelivery): string {
    if (d.state === 'EN_ROUTE') {
        if (d.absence?.phase === 'EQUIPE') return 'Décision de l’équipe';
        if (d.absence) return 'Client absent';
        return 'En route';
    }
    if (d.state === 'PRETE') return 'Prête à partir';
    if (d.state === 'EN_PREPARATION') return 'En préparation';
    return 'Acceptée';
}

/** « 13 h 15 » (heure de Dakar = UTC toute l'année). */
export function hourText(iso: string | null): string {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return `${String(d.getUTCHours()).padStart(2, '0')} h ${String(d.getUTCMinutes()).padStart(2, '0')}`;
}

/** « 77 123 45 67 » pour un numéro sénégalais servi en +221… ; sinon tel quel. */
export function phoneText(phone: string): string {
    const m = /^(?:\+221)?(\d{2})(\d{3})(\d{2})(\d{2})$/.exec(phone.replace(/\s+/g, ''));
    return m ? `${m[1]} ${m[2]} ${m[3]} ${m[4]}` : phone;
}

/** Lien d'itinéraire en un geste vers l'application de cartes du téléphone. */
export function directionsUrl(address: string): string {
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;
}

/** Compte à rebours « 12:05 » (minutes:secondes) ; « 0:00 » une fois passé. */
export function countdownText(untilIso: string | null, nowMs: number): string {
    if (!untilIso) return '';
    const left = Math.max(0, Math.floor((Date.parse(untilIso) - nowMs) / 1000));
    return `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
}

/**
 * Lot 12d : adresses de l'espace du livreur (pages et routes). Gardées dans ce module .ts : la règle de la police à chasse
 * fixe de tests/parcours/design-systeme.test.ts lit le mot « courier » dans les chaînes des fichiers .tsx.
 */
export const COURIER_PATHS = {
    home: '/courier/orders',
    order: (id: string): string => `/courier/orders/${id}`,
    invitation: (id: string): string => `/courier/invitations/${id}`,
    apiDay: '/api/courier/orders',
    apiOrder: (id: string): string => `/api/courier/orders/${encodeURIComponent(id)}`,
    apiInvitation: (id: string): string => `/api/courier/invitations/${encodeURIComponent(id)}`,
} as const;

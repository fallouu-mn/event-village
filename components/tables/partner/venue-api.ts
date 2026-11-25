/**
 * Lot 11b (écrans quotidiens de l'établissement) : types des réponses des routes /api/partner/venues/** et
 * /api/partner/tables/**, et petites aides d'affichage partagées par « Mes établissements », le planning du jour, le
 * détail d'une réservation et les recettes. Aucun montant calculé ici : les montants viennent des routes et ne sont que
 * mis en forme. Les types du serveur sont importés en `import type` (effacés à la compilation).
 */
import type { PartnerReservationDetail, PartnerTableReservationView } from '@/lib/tables/queries';
import type { BadgeVariant } from '@/components/ui/Badge';
import { ApiError, sendJson } from '@/components/partner/fetch-json';
import { dayText, hmText } from '@/lib/tables/views';

export type { PartnerReservationDetail, PartnerTableReservationView };

/** Un établissement de « Mes établissements » (GET /api/partner/venues). */
export interface PartnerVenueRow {
    id: string;
    kind: string;
    kindLabel: string;
    name: string;
    city: string | null;
    address: string | null;
    photo: string | null;
    status: string;
    statusLabel: string;
    statusTone: string;
    statusHint: string;
    reason: string | null;
    isActive: boolean;
    confirmation: string | null;
    depositPerPerson: number;
    floorPlan: boolean;
    tablesCount: number;
    todayCount: number;
    pendingCount: number;
    submittedAt: string | null;
}

/** Fiche d'un établissement (GET /api/partner/venues/[id]) : seulement ce que la fiche du jour affiche. */
export interface OwnVenue {
    id: string;
    kind: string;
    kindLabel: string;
    name: string;
    address: string | null;
    city: string | null;
    /** Lot Carte B3 : position sur la carte (null : absente, établissement hors de la carte). */
    latitude?: number | null;
    longitude?: number | null;
    photos: string[];
    slotMinutes: number | null;
    depositPerPerson: number | null;
    confirmation: string | null;
    floorPlan: boolean;
    isActive: boolean;
    status: string;
    statusLabel: string;
    statusTone: string;
    statusHint: string;
    reason: string | null;
    tables: Array<{ id: string; isActive: boolean }>;
}

export interface PlanningTable {
    id: string;
    number: string;
    capacity: number;
    minCapacity: number;
    zoneId: string | null;
    isActive: boolean;
    plan: { x: number; y: number } | null;
    shape: string | null;
    rotation: number;
}

export interface PlanningZone {
    id: string;
    name: string;
    plan: { x: number; y: number; w: number; h: number } | null;
}

/** Planning d'un jour (GET /api/partner/venues/[id]/planning?date=). */
export interface PlanningBody {
    venue: { id: string; name: string; floorPlan: boolean };
    date: string;
    /** Heure du serveur (ISO) : base des comptes à rebours et des actions selon l'heure. */
    now: string;
    reservations: PartnerTableReservationView[];
    pending: PartnerTableReservationView[];
    tables: PlanningTable[];
    zones: PlanningZone[];
    closures: Array<{ startsAt: string; endsAt: string; reason: string | null }>;
}

/** Ligne de recettes (GET /api/partner/tables/earnings). */
export interface TableEarningRow {
    reservationId: string;
    venueId: string;
    venueName: string;
    date: string;
    time: string;
    endTime: string;
    guests: number;
    stateLabel: string;
    tone: string;
    paidAmount: number;
    refundedAmount: number;
    earned: number;
    available: boolean;
    availableAt: string | null;
}

export interface TableEarningsBody {
    availableTotal: number;
    upcomingTotal: number;
    rows: TableEarningRow[];
}

/** Actions de l'établissement sur une réservation (PATCH /api/partner/tables/reservations/[id]). */
export type ReservationAction = 'ACCEPTER' | 'REFUSER' | 'ARRIVEE' | 'ABSENT' | 'ANNULER' | 'PAIEMENT_SUR_PLACE';

/** Moyens du paiement sur place (offline_payment_method_enum) et leurs mots. */
export const ONSITE_METHODS: readonly { value: 'ESPECES' | 'WAVE_DIRECT' | 'OM_DIRECT' | 'AUTRE'; label: string }[] = [
    { value: 'ESPECES', label: 'Espèces' },
    { value: 'WAVE_DIRECT', label: 'Wave' },
    { value: 'OM_DIRECT', label: 'Orange Money' },
    { value: 'AUTRE', label: 'Autre moyen' },
];

/** Longueur minimale d'un motif de refus ou d'annulation (fonctions en base : 5 caractères). */
export const REASON_MIN = 5;
export const REASON_MAX = 500;

export interface ActionResult {
    success: boolean;
    state?: string;
    refundAmount?: number;
}

export function sendReservationAction(id: string, action: ReservationAction, extra: { reason?: string; amount?: number; method?: string } = {}): Promise<ActionResult> {
    return sendJson<ActionResult>(`/api/partner/tables/reservations/${encodeURIComponent(id)}`, 'PATCH', { action, ...extra });
}

/** Message affichable d'un refus : celui de la route seulement, jamais le texte d'une exception du navigateur. */
export function routeMessage(err: unknown, fallback: string): string {
    return err instanceof ApiError && err.message ? err.message : fallback;
}

/** Ton d'un état → variante de pastille. */
export function toneVariant(tone: string | null | undefined): BadgeVariant {
    return tone === 'info' || tone === 'success' || tone === 'warning' || tone === 'danger' ? tone : 'neutral';
}

/** Ton d'un état → ton de bandeau. */
export function toneBanner(tone: string | null | undefined): 'neutral' | 'info' | 'success' | 'warning' | 'danger' {
    return tone === 'info' || tone === 'success' || tone === 'warning' || tone === 'danger' ? tone : 'neutral';
}

// ── Heures ──────────────────────────────────────────────────────────────────────────────────────────────

/** « HH:MM » → minutes depuis minuit. */
export function minutesOf(hm: string): number {
    const m = /^(\d{2}):(\d{2})/.exec(hm);
    return m ? Number(m[1]) * 60 + Number(m[2]) : 0;
}

/** Début du créneau (ms) : l'heure de Dakar est l'heure UTC toute l'année. */
export function startMs(r: { date: string; time: string }): number {
    return Date.parse(`${r.date}T${r.time.slice(0, 5)}:00Z`);
}

/** Fin du créneau (ms), lue dans l'heure de fin donnée par la route (créneau de 30 à 360 min, minuit franchi compris). */
export function endMs(r: { date: string; time: string; endTime: string }): number {
    const span = ((minutesOf(r.endTime) - minutesOf(r.time)) % 1440 + 1440) % 1440;
    return startMs(r) + (span === 0 ? 120 : span) * 60_000;
}

/** Jour de Dakar d'un instant (ms), « AAAA-MM-JJ ». */
export function dayOf(ms: number): string {
    return new Date(ms).toISOString().slice(0, 10);
}

/** Jour décalé de n jours, « AAAA-MM-JJ ». */
export function shiftDay(day: string, n: number): string {
    return dayOf(Date.parse(`${day}T00:00:00Z`) + n * 86_400_000);
}

/** Jour en mots relatif à aujourd'hui : « aujourd'hui », « demain », « hier », sinon « samedi 5 décembre ». */
export function relativeDay(day: string, today: string): string {
    if (day === today) return 'aujourd’hui';
    if (day === shiftDay(today, 1)) return 'demain';
    if (day === shiftDay(today, -1)) return 'hier';
    return dayText(day);
}

/** Majuscule initiale. */
export function capitalize(text: string): string {
    return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Durée restante lisible : « moins d'une minute », « 12 min », « 1 h 12 », « 1 h ». */
export function remainingText(ms: number): string {
    if (ms < 60_000) return 'moins d’une minute';
    const total = Math.floor(ms / 60_000);
    const h = Math.floor(total / 60);
    const m = total % 60;
    if (h === 0) return `${m} min`;
    if (h >= 48) return `${Math.floor(h / 24)} jours`;
    return m === 0 ? `${h} h` : `${h} h ${String(m).padStart(2, '0')}`;
}

/** Échéance en mots, relative à aujourd'hui : « 21 h 30 », « demain à 9 h », « le samedi 5 décembre à 9 h ». */
export function dueText(iso: string, today: string): string {
    const ms = Date.parse(iso);
    if (Number.isNaN(ms)) return '';
    const day = dayOf(ms);
    const hm = hmText(new Date(ms).toISOString().slice(11, 16));
    if (day === today) return hm;
    if (day === shiftDay(today, 1)) return `demain à ${hm}`;
    return `le ${dayText(day)} à ${hm}`;
}

/** Téléphone pour un lien tel: (espaces retirés). */
export function telHref(phone: string): string {
    return `tel:${phone.replace(/[\s.-]+/g, '')}`;
}

// ── Actions selon l'heure (affichage ; la base revérifie tout) ──────────────────────────────────────────

export interface TimedActions {
    accept: boolean;
    refuse: boolean;
    arrived: boolean;
    absent: boolean;
    cancel: boolean;
    onsite: boolean;
}

/** Mêmes règles que partnerReservation (lib/tables/queries.ts), à l'heure du serveur. */
export function actionsAt(r: PartnerTableReservationView, now: number): TimedActions {
    const s = r.state;
    const start = startMs(r);
    const end = endMs(r);
    // Contre-vérification T2 : fin de la garde de la table (« gardée jusqu'à », heure + tables.no_show_minutes)
    const heldUntil = start + (((minutesOf(r.heldUntil) - minutesOf(r.time)) % 1440 + 1440) % 1440) * 60_000;
    const live = s === 'EN_ATTENTE_PAIEMENT' || s === 'EN_ATTENTE_ACCEPTATION' || s === 'CONFIRMEE';
    return {
        accept: s === 'EN_ATTENTE_ACCEPTATION',
        refuse: s === 'EN_ATTENTE_ACCEPTATION',
        arrived: s === 'CONFIRMEE' && now >= start - 3_600_000 && now < end,
        absent: s === 'CONFIRMEE' && now >= heldUntil && now < end,
        cancel: live && now < start,
        onsite: s === 'CONFIRMEE' || s === 'ARRIVEE',
    };
}

/** Réservation close qui a libéré sa table (absence, annulation, refus, sans réponse, acompte non payé). */
export function tableFreed(state: string): boolean {
    return state === 'ABSENT' || state === 'EXPIREE' || state === 'SANS_REPONSE' || state === 'REFUSEE' || state.startsWith('ANNULEE_');
}

/** Ce que dit l'écran après une action réussie. */
export function actionDoneText(action: ReservationAction, result: ActionResult, fcfa: (n: number) => string): string {
    const refund = Number(result.refundAmount ?? 0);
    switch (action) {
        case 'ACCEPTER': return 'Réservation acceptée : le client est prévenu.';
        case 'REFUSER': return refund > 0 ? `Demande refusée : ${fcfa(refund)} rendus au client, qui est prévenu.` : 'Demande refusée : le client est prévenu.';
        case 'ARRIVEE': return 'Client arrivé : bon service.';
        case 'ABSENT': return 'Client absent : la table est libérée.';
        case 'ANNULER': return refund > 0 ? `Réservation annulée : ${fcfa(refund)} rendus au client. La table est libérée.` : 'Réservation annulée : le client est prévenu. La table est libérée.';
        case 'PAIEMENT_SUR_PLACE': return 'Paiement sur place enregistré.';
        default: return 'C’est fait.';
    }
}

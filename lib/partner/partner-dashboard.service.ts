import { getServiceRoleClient } from '@/lib/supabase/server';
import { accountBalance } from '@/lib/finance/ledger';
import { formatFcfa } from '@/lib/format';
import { dakarInstant } from '@/lib/validations/event';

/**
 * Tableau de bord, rapport de clôture (et son PDF) et export comptable du partenaire (lot 3, contrat G).
 *  - Aucun montant n'est recalculé ici avec des taux : tout est lu dans le grand livre (finance_ledger)
 *    ou dans les colonnes recopiées sur les paiements et les billets par le moteur financier unique.
 *  - Net organisateur = Σ écritures VENTE + REMBOURSEMENT (finance_partner_summary) : un remboursement
 *    n'est déduit qu'une fois. Paiements plateforme uniquement : les ventes espèces (paiements
 *    is_platform_payment = false) et les invitations ne produisent aucune écriture ; les espèces sont
 *    affichées à part, à titre informatif, jamais dans le net ni dans le solde retirable.
 *  - Frais de service payés par l'acheteur : ligne informative, jamais déduite de l'organisateur.
 *  - Toute lecture en échec lève une erreur (la route répond 500 et la journalise).
 */

// ─────────────────────────────────────────────────────────────────────────────
// INTERFACES & TYPES DU DASHBOARD PARTENAIRE & RAPPORTS
// ─────────────────────────────────────────────────────────────────────────────

export interface PartnerKPIs {
    /** Ventes en ligne, prix faciaux (Σ écritures VENTE du grand livre, toutes activités). */
    grossRevenue: number;
    /** Net organisateur = ventes en ligne − remboursements (grand livre). */
    netRevenue: number;
    refundedAmount: number;
    availableRevenue: number;
    pendingRevenue: number;
    nextAvailableAt: string | null;
    debt: number;
    /** Frais de service payés par les acheteurs (informatif, non déduit). */
    buyerServiceFees: number;
    /** Ventes espèces au guichet (informatif, hors plateforme). */
    cashSales: number;
    cashTickets: number;
    ticketsSold: number;
    ticketsCheckedIn: number;
    ticketsCancelled: number;
    totalEvents: number;
    activeEvents: number;
    ordersCount: number;
    ordersRevenue: number;
    /** Solde retirable du compte organisateur (grand livre). */
    soldeDisponible: number;
    totalWithdrawn: number;
    pendingWithdrawals: number;
}

export interface PartnerEventBreakdown {
    id: string;
    title: string;
    startDate: string;
    startTime: string;
    /** Début de l'événement (instant ISO, heure de Dakar appliquée par le serveur), null si illisible. */
    startAt: string | null;
    location: string;
    city: string;
    status: string;
    capacity: number;
    ticketsSold: number;
    ticketsAvailable: number;
    ticketsCheckedIn: number;
    fillRatePercent: number;
    checkInRatePercent: number;
    grossRevenue: number;
    refundedAmount: number;
    netRevenue: number;
}

export interface PartnerActivityItem {
    id: string;
    type: 'SALE' | 'CHECKIN' | 'ORDER' | 'WITHDRAWAL';
    title: string;
    description: string;
    amount?: number;
    status: string;
    createdAt: string;
}

/** Étapes de la première utilisation (lot 7, D70, contrat 3.8), dans l'ordre d'affichage. */
export const ONBOARDING_STEP_KEYS = ['PROFILE', 'CREATE', 'POSTER', 'CATEGORY', 'SUBMIT', 'VALIDATED', 'PUBLISH', 'CONTROLLERS'] as const;
export type OnboardingStepKey = (typeof ONBOARDING_STEP_KEYS)[number];

export interface OnboardingStep {
    key: OnboardingStepKey;
    /** Étape franchie, décidée par le serveur (fiche, événement, catégories, affectations). */
    done: boolean;
    /** Lien interne de l'espace partenaire où l'étape se fait. */
    href: string;
}

export interface PartnerOnboarding {
    /** Carte visible : partenaire VALIDE qui n'a encore aucun événement PUBLIE ni TERMINE. */
    visible: boolean;
    steps: OnboardingStep[];
    /** Nombre d'étapes franchies (affiché « N étapes sur 8 »). */
    done_count: number;
    /** Prochaine étape à faire (création à publication), null si tout est fait ou si la validation est attendue. */
    next: OnboardingStepKey | null;
    /** Événement soumis, en attente de la validation par l'équipe Event Village. */
    awaiting_validation: boolean;
}

export interface PartnerTrial {
    /** Durée de l'essai en jours (fin − début, servie telle que activate_partner_trial l'a posée), null sans essai. */
    days: number | null;
    started_at: string | null;
    ends_at: string | null;
    /** Essai en cours à l'horloge du serveur. */
    active: boolean;
}

export interface PartnerDashboardData {
    partner: {
        id: string;
        companyName: string;
        commercialName: string;
        phone?: string;
        email?: string;
        status: string;
        isVerified: boolean;
        /** Motif du refus (bandeau REJETE), null sinon. */
        rejectionReason: string | null;
        /** Motif de la suspension (bandeau SUSPENDU), null sinon. */
        suspendedReason: string | null;
    };
    kpis: PartnerKPIs;
    events: PartnerEventBreakdown[];
    recentActivity: PartnerActivityItem[];
    onboarding: PartnerOnboarding;
    trial: PartnerTrial;
}

export interface CategorySalesSummary {
    categoryId: string;
    name: string;
    unitPrice: number;
    totalAllocated: number;
    /** Billets valables ou utilisés, tous canaux. */
    soldQuantity: number;
    onlineQuantity: number;
    cashQuantity: number;
    checkedInQuantity: number;
    remainingQuantity: number;
    /** Prix faciaux des billets payés en ligne encore valables (prix réellement payés). */
    grossAmount: number;
    /** Prix des billets payés en espèces (informatif). */
    cashAmount: number;
    /** Reversement organisateur de la catégorie : prix facial (aucune commission déduite). */
    netAmount: number;
}

export interface ClosingReportData {
    reportId: string;
    generatedAt: string;
    event: {
        id: string;
        title: string;
        category: string;
        startDate: string;
        startTime: string;
        venue: string;
        city: string;
        status: string;
        capacity: number;
    };
    partner: {
        id: string;
        companyName: string;
        commercialName: string;
        phone: string;
        email: string;
    };
    salesByCategory: CategorySalesSummary[];
    paymentsSummary: {
        confirmedCount: number;
        confirmedGross: number;
        pendingCount: number;
        pendingGross: number;
        refundedCount: number;
        refundedGross: number;
    };
    ticketsSummary: {
        totalAllocated: number;
        sold: number;
        checkedIn: number;
        cancelled: number;
        refunded: number;
        remaining: number;
        checkInRatePercent: number;
        fillRatePercent: number;
    };
    financialSummary: {
        /** Ventes en ligne de l'événement, prix faciaux (Σ VENTE). */
        totalGross: number;
        /** Remboursements débités à l'organisateur (Σ REMBOURSEMENT, en valeur positive). */
        totalRefunded: number;
        /** Net organisateur = totalGross − totalRefunded (grand livre, une seule déduction). */
        totalNet: number;
        availableNet: number;
        pendingNet: number;
        /** Frais de service payés par l'acheteur (informatif, non déduits). */
        buyerServiceFees: number;
        /** Ventes espèces au guichet (informatif, hors plateforme, hors net). */
        cashSales: number;
        cashTickets: number;
    };
}

/** Synthèse financière d'un partenaire (finance_partner_summary, lue dans le grand livre). */
export interface PartnerFinanceSummary {
    organizerNet: number;
    onlineSales: number;
    refunded: number;
    available: number;
    pending: number;
    byTarget: Record<string, number>;
    buyerServiceFees: number;
    cashSales: number;
    cashTickets: number;
}

export interface LedgerBucket {
    sales: number;
    refunded: number;
    net: number;
}

export interface LedgerSplit {
    byTarget: Record<string, LedgerBucket>;
    byEvent: Record<string, LedgerBucket>;
}

// ─────────────────────────────────────────────────────────────────────────────
// LECTURES (paginées, erreurs remontées)
// ─────────────────────────────────────────────────────────────────────────────

const PAGE_SIZE = 1000;
const ID_CHUNK = 100;

/** Colonnes et types d'écritures de vente lus dans le grand livre organisateur. */
export const LEDGER_SALES_COLUMNS = 'id, amount, entry_type, event_id, payment:payments(payment_target)';
export const LEDGER_SALES_TYPES = ['VENTE', 'REMBOURSEMENT'];

export interface LedgerSalesRow {
    id: string;
    amount: number;
    entry_type: string;
    event_id: string | null;
    payment: { payment_target: string } | null;
}

type PageResult = { data: unknown[] | null; error: { message: string } | null };

/** Lit toutes les lignes d'une requête paginée (plafond max_rows de PostgREST). */
export async function fetchAllRows<T>(label: string, page: (from: number, to: number) => PromiseLike<PageResult>): Promise<T[]> {
    const rows: T[] = [];
    for (let from = 0; ; from += PAGE_SIZE) {
        const { data, error } = await page(from, from + PAGE_SIZE - 1);
        if (error) throw new Error(`Lecture impossible (${label}) : ${error.message}`);
        rows.push(...((data ?? []) as T[]));
        if (!data || data.length < PAGE_SIZE) return rows;
    }
}

/** Billets d'un ensemble d'événements (identifiants par lots, pages de 1 000), filtre de date optionnel. */
export async function ticketsOfEvents<T>(eventIds: string[], columns: string, period: { from?: string; to?: string } = {}): Promise<T[]> {
    const supabase = getServiceRoleClient();
    const out: T[] = [];
    for (let i = 0; i < eventIds.length; i += ID_CHUNK) {
        const chunk = eventIds.slice(i, i + ID_CHUNK);
        out.push(...await fetchAllRows<T>('billets', (from, to) => {
            let q = supabase.from('tickets').select(columns).in('event_id', chunk);
            if (period.from) q = q.gte('created_at', period.from);
            if (period.to) q = q.lte('created_at', period.to);
            return q.order('id', { ascending: true }).range(from, to);
        }));
    }
    return out;
}

/** Canal de paiement des billets : true si le paiement est un paiement plateforme. */
async function platformFlags(paymentIds: string[]): Promise<Map<string, { platform: boolean; reference: string }>> {
    const supabase = getServiceRoleClient();
    const flags = new Map<string, { platform: boolean; reference: string }>();
    const ids = Array.from(new Set(paymentIds));
    for (let i = 0; i < ids.length; i += ID_CHUNK) {
        const chunk = ids.slice(i, i + ID_CHUNK);
        const { data, error } = await supabase.from('payments').select('id, transaction_id, is_platform_payment').in('id', chunk);
        if (error) throw new Error(`Lecture impossible (paiements des billets) : ${error.message}`);
        for (const p of data ?? []) flags.set(p.id, { platform: p.is_platform_payment === true, reference: p.transaction_id });
    }
    return flags;
}

/** Réponse de finance_partner_summary → synthèse typée (erreur de lecture remontée). */
export function toPartnerSummary(res: { data: unknown; error: { message: string } | null }): PartnerFinanceSummary {
    if (res.error || !res.data) throw new Error(`Lecture impossible (synthèse financière du partenaire) : ${res.error?.message ?? 'réponse vide'}`);
    const s = res.data as Record<string, unknown>;
    const byTarget: Record<string, number> = {};
    for (const [k, v] of Object.entries((s.by_target ?? {}) as Record<string, unknown>)) byTarget[k] = Number(v);
    return {
        organizerNet: Number(s.organizer_net),
        onlineSales: Number(s.online_sales),
        refunded: Number(s.refunded),
        available: Number(s.available),
        pending: Number(s.pending),
        byTarget,
        buyerServiceFees: Number(s.buyer_service_fees),
        cashSales: Number(s.cash_sales),
        cashTickets: Number(s.cash_tickets),
    };
}

/** Ventilation des écritures de vente du grand livre par activité et par événement. */
export function splitLedgerRows(rows: LedgerSalesRow[]): LedgerSplit {
    const byTarget: Record<string, LedgerBucket> = {};
    const byEvent: Record<string, LedgerBucket> = {};
    const add = (map: Record<string, LedgerBucket>, key: string, row: LedgerSalesRow) => {
        const b = map[key] ?? (map[key] = { sales: 0, refunded: 0, net: 0 });
        const amount = Number(row.amount);
        if (row.entry_type === 'VENTE') b.sales += amount;
        else b.refunded -= amount;
        b.net += amount;
    };
    for (const row of rows) {
        if (row.payment?.payment_target) add(byTarget, row.payment.payment_target, row);
        if (row.event_id) add(byEvent, row.event_id, row);
    }
    return { byTarget, byEvent };
}

export const EMPTY_BUCKET: LedgerBucket = { sales: 0, refunded: 0, net: 0 };

/** Retraits du compte organisateur : total versé, montant en cours, derniers retraits. */
export async function organizerWithdrawals(userId: string): Promise<{ totalWithdrawn: number; pending: number; rows: Array<Record<string, unknown>> }> {
    const supabase = getServiceRoleClient();
    const rows = await fetchAllRows<Record<string, unknown>>('retraits', (from, to) => supabase
        .from('withdrawals')
        .select('id, gross_amount, fee_amount, net_amount, status, withdrawal_method, operator, phone_number, payment_details, account_kind, created_at, processed_at')
        .eq('user_id', userId)
        .eq('account_kind', 'ORGANISATEUR')
        .order('created_at', { ascending: false })
        .order('id', { ascending: true })
        .range(from, to));
    let totalWithdrawn = 0;
    let pending = 0;
    for (const w of rows) {
        if (w.status === 'PAID') totalWithdrawn += Number(w.net_amount);
        if (w.status === 'PENDING' || w.status === 'PROCESSING') pending += Number(w.gross_amount);
    }
    return { totalWithdrawn, pending, rows };
}

// ─────────────────────────────────────────────────────────────────────────────
// PREMIÈRE UTILISATION ET ESSAI (lot 7, tâche 7.4, D70 ; contrat 3.8)
// ─────────────────────────────────────────────────────────────────────────────

const DAY_MS = 24 * 3600_000;

/** Statuts d'un événement qui a déjà été soumis, validé, publié (règles du cycle de vie, event_transition). */
const SUBMITTED_STATUSES = new Set(['EN_ATTENTE', 'VALIDE', 'PUBLIE', 'SUSPENDU', 'TERMINE']);
const VALIDATED_STATUSES = new Set(['VALIDE', 'PUBLIE', 'SUSPENDU', 'TERMINE']);
const PUBLISHED_STATUSES = new Set(['PUBLIE', 'TERMINE']);
/** Étapes obligatoires de la publication, dans l'ordre (PROFILE et CONTROLLERS sont facultatives). */
const REQUIRED_STEPS: OnboardingStepKey[] = ['CREATE', 'POSTER', 'CATEGORY', 'SUBMIT', 'VALIDATED', 'PUBLISH'];

/** Rang d'avancement d'un événement dans le parcours de publication (événement suivi par la carte). */
function progressRank(status: string): number {
    if (PUBLISHED_STATUSES.has(status)) return 4;
    if (VALIDATED_STATUSES.has(status)) return 3;
    if (status === 'EN_ATTENTE') return 2;
    if (status === 'BROUILLON') return 1;
    return 0; // ANNULE : jamais l'événement suivi
}

/** Instant ISO d'une date et d'une heure de Dakar (null si l'une est illisible). */
function dakarStartIso(date: unknown, time: unknown): string | null {
    if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
    const t = typeof time === 'string' && /^\d{2}:\d{2}(:\d{2})?$/.test(time) ? time : '00:00';
    const ms = dakarInstant(date, t);
    return Number.isNaN(ms) ? null : new Date(ms).toISOString();
}

interface OnboardingEventRow {
    id: string;
    status: string;
    image_url: string | null;
    created_at: string | null;
}

interface OnboardingPartnerRow {
    status: string;
    description: string | null;
    logo_url: string | null;
}

/**
 * Étapes de la première utilisation, toutes décidées ici (aucune dans le navigateur) :
 *  - l'événement suivi est le plus avancé des événements non annulés (puis le plus récent) ;
 *  - CREATE, POSTER (affiche non vide), CATEGORY (au moins une catégorie active), SUBMIT, VALIDATED, PUBLISH
 *    reprennent les conditions du serveur (event_create, SUBMIT_INCOMPLETE de event_transition, publication) ;
 *  - PROFILE : fiche publique complétée (description et logo) ; CONTROLLERS : au moins une affectation ;
 *  - visible tant que le partenaire est VALIDE et n'a aucun événement PUBLIE ni TERMINE.
 */
export async function partnerOnboarding(partnerId: string, partner: OnboardingPartnerRow, events: OnboardingEventRow[]): Promise<PartnerOnboarding> {
    const supabase = getServiceRoleClient();
    const tracked = events
        .filter((e) => progressRank(e.status) > 0)
        .sort((a, b) => progressRank(b.status) - progressRank(a.status) || String(b.created_at ?? '').localeCompare(String(a.created_at ?? '')))[0] ?? null;

    let hasActiveCategory = false;
    if (tracked) {
        const { data, error } = await supabase
            .from('ticket_categories')
            .select('id')
            .eq('event_id', tracked.id)
            .eq('is_active', true)
            .limit(1);
        if (error) throw new Error(`Lecture impossible (catégories de l'événement suivi) : ${error.message}`);
        hasActiveCategory = (data ?? []).length > 0;
    }

    let hasController = false;
    const ids = events.map((e) => e.id);
    for (let i = 0; i < ids.length && !hasController; i += ID_CHUNK) {
        const { data, error } = await supabase
            .from('event_controllers')
            .select('id')
            .in('event_id', ids.slice(i, i + ID_CHUNK))
            .limit(1);
        if (error) throw new Error(`Lecture impossible (équipe de contrôle) : ${error.message}`);
        hasController = (data ?? []).length > 0;
    }

    const status = tracked?.status ?? '';
    const eventHref = tracked ? `/partner/events/${tracked.id}` : '/partner/events/new';
    const editHref = tracked ? `/partner/events/${tracked.id}/edit` : '/partner/events/new';
    const done: Record<OnboardingStepKey, boolean> = {
        PROFILE: Boolean(partner.description?.trim()) && Boolean(partner.logo_url?.trim()),
        CREATE: tracked !== null,
        POSTER: Boolean(tracked?.image_url?.trim()),
        CATEGORY: hasActiveCategory,
        SUBMIT: SUBMITTED_STATUSES.has(status),
        VALIDATED: VALIDATED_STATUSES.has(status),
        PUBLISH: PUBLISHED_STATUSES.has(status),
        CONTROLLERS: hasController,
    };
    const href: Record<OnboardingStepKey, string> = {
        PROFILE: '/partner/profile',
        CREATE: eventHref,
        POSTER: editHref,
        CATEGORY: editHref,
        SUBMIT: eventHref,
        VALIDATED: eventHref,
        PUBLISH: eventHref,
        CONTROLLERS: '/partner/team',
    };
    const awaitingValidation = done.SUBMIT && !done.VALIDATED;
    const next = awaitingValidation ? null : (REQUIRED_STEPS.find((k) => !done[k]) ?? null);
    return {
        visible: partner.status === 'VALIDE' && !events.some((e) => PUBLISHED_STATUSES.has(e.status)),
        steps: ONBOARDING_STEP_KEYS.map((key) => ({ key, done: done[key], href: href[key] })),
        done_count: ONBOARDING_STEP_KEYS.filter((k) => done[k]).length,
        next,
        awaiting_validation: awaitingValidation,
    };
}

/** Essai du partenaire tel qu'enregistré (activate_partner_trial) : durée, début, fin, en cours à l'horloge du serveur. */
export function partnerTrial(startedAt: string | null, endsAt: string | null, now = Date.now()): PartnerTrial {
    const start = startedAt ? Date.parse(startedAt) : NaN;
    const end = endsAt ? Date.parse(endsAt) : NaN;
    return {
        days: Number.isNaN(start) || Number.isNaN(end) ? null : Math.round((end - start) / DAY_MS),
        started_at: startedAt,
        ends_at: endsAt,
        active: !Number.isNaN(end) && end > now,
    };
}

/** Pourcentage entier de l'essai écoulé à l'horloge du serveur (0 à 100), null sans essai. */
export function trialPercentUsed(startedAt: string | null, endsAt: string | null, now = Date.now()): number | null {
    const start = startedAt ? Date.parse(startedAt) : NaN;
    const end = endsAt ? Date.parse(endsAt) : NaN;
    if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return null;
    return Math.min(100, Math.max(0, Math.round(((now - start) / (end - start)) * 100)));
}

const DELIVERY_MODE_LABELS: Record<string, string> = { LIVRAISON: 'Livraison', RETRAIT: 'Retrait', SUR_PLACE: 'Sur place' };
const WITHDRAWAL_METHOD_LABELS: Record<string, string> = { MOBILE_MONEY: 'Mobile Money', BANK: 'Virement bancaire' };

const SOLD = new Set(['VALIDE', 'UTILISE']);
const REFUNDED_TICKET = new Set(['REMBOURSE', 'REMBOURSEMENT_EN_COURS']);

interface TicketRow {
    id: string;
    event_id: string;
    category_id: string;
    ticket_number: string | null;
    price: number;
    service_fee: number | null;
    status: string;
    payment_id: string | null;
    checked_in_at: string | null;
    created_at: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPER D'ÉCHAPPEMENT TEXTE PDF (WINANSI & CARACTÈRES ACCENTUÉS)
// ─────────────────────────────────────────────────────────────────────────────
function escapePdfText(str: string): string {
    if (!str) return '';
    const clean = str
        .replace(/[   - ]/g, ' ')
        .replace(/\\/g, '\\\\')
        .replace(/\(/g, '\\(')
        .replace(/\)/g, '\\)');

    return clean
        .replace(/é/g, '\xE9')
        .replace(/è/g, '\xE8')
        .replace(/ê/g, '\xEA')
        .replace(/ë/g, '\xEB')
        .replace(/à/g, '\xE0')
        .replace(/â/g, '\xE2')
        .replace(/ä/g, '\xE4')
        .replace(/î/g, '\xEE')
        .replace(/ï/g, '\xEF')
        .replace(/ô/g, '\xF4')
        .replace(/ö/g, '\xF6')
        .replace(/ù/g, '\xF9')
        .replace(/û/g, '\xFB')
        .replace(/ü/g, '\xFC')
        .replace(/ç/g, '\xE7')
        .replace(/É/g, '\xC9')
        .replace(/È/g, '\xC8')
        .replace(/Ê/g, '\xCA')
        .replace(/À/g, '\xC0')
        .replace(/Ç/g, '\xC7')
        .replace(/’/g, "'")
        .replace(/–/g, '-')
        .replace(/—/g, '--')
        .replace(/«/g, '"')
        .replace(/»/g, '"');
}

/** Montant FCFA pour le PDF (séparateurs de milliers normalisés, encodage WinAnsi). */
function pdfAmount(n: number, suffix = 'FCFA'): string {
    return escapePdfText(`${n.toLocaleString('fr-FR')} ${suffix}`);
}

/**
 * Champ CSV (séparateur point-virgule) : guillemets si nécessaire. Anomalie A23 (AM1) : un TEXTE commençant par un
 * caractère de formule reçoit une apostrophe, sinon un titre d'événement s'évaluerait à l'ouverture dans un tableur.
 * Un nombre reste un nombre, négatif compris (lignes de remboursement de la synthèse).
 */
function csvField(value: string | number): string {
    const text = String(value);
    const s = typeof value === 'string' && /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
    return /[;"\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// ─────────────────────────────────────────────────────────────────────────────
// SERVICE PRINCIPAL : PARTNER DASHBOARD & EXPORTS COMPTABLES
// ─────────────────────────────────────────────────────────────────────────────

export class PartnerDashboardService {

    /**
     * Résout le profil partenaire à partir du user_id de la session.
     * Garantit l'isolation multi-tenant stricte.
     */
    public static async resolvePartner(userId: string) {
        const supabase = getServiceRoleClient();
        const { data: partner, error } = await supabase
            .from('partners')
            .select('id, user_id, company_name, commercial_name, phone, email, status, is_verified, rejection_reason, suspended_reason, trial_started_at, trial_ends_at, description, logo_url')
            .eq('user_id', userId)
            .maybeSingle();

        if (error) throw new Error(`Lecture impossible (profil partenaire) : ${error.message}`);
        if (!partner) throw new Error('PROFIL_PARTENAIRE_INTROUVABLE');
        return partner;
    }

    /**
     * KPIs et métriques du Dashboard partenaire : montants lus dans le grand livre (paiements
     * plateforme uniquement), comptages de billets tous canaux.
     */
    public static async getDashboardData(userId: string): Promise<PartnerDashboardData> {
        const supabase = getServiceRoleClient();
        const partner = await this.resolvePartner(userId);
        const partnerId = partner.id;

        const [events, recentOrdersRes, ordersCountRes, summaryRes, ledgerRows, balance, withdrawals] = await Promise.all([
            fetchAllRows<Record<string, unknown>>('événements', (from, to) => supabase
                .from('events')
                .select('id, title, start_date, start_time, location, city, status, capacity, image_url, created_at')
                .eq('partner_id', partnerId)
                .order('start_date', { ascending: false })
                .order('id', { ascending: true })
                .range(from, to)),
            supabase.from('orders')
                .select('id, order_number, delivery_mode, total_amount, order_status, created_at')
                .eq('partner_id', partnerId)
                .order('created_at', { ascending: false })
                .limit(5),
            supabase.from('orders')
                .select('id', { count: 'exact', head: true })
                .eq('partner_id', partnerId)
                .not('order_status', 'in', '(ANNULEE,REJETEE)'),
            supabase.rpc('finance_partner_summary', { p_partner_id: partnerId, p_event_id: null }),
            fetchAllRows<LedgerSalesRow>('grand livre', (from, to) => supabase
                .from('finance_ledger')
                .select(LEDGER_SALES_COLUMNS)
                .eq('partner_id', partnerId)
                .eq('account_kind', 'ORGANISATEUR')
                .in('entry_type', LEDGER_SALES_TYPES)
                .order('id', { ascending: true })
                .range(from, to)),
            accountBalance(userId, 'ORGANISATEUR'),
            organizerWithdrawals(userId),
        ]);
        if (recentOrdersRes.error) throw new Error(`Lecture impossible (commandes) : ${recentOrdersRes.error.message}`);
        if (ordersCountRes.error) throw new Error(`Lecture impossible (nombre de commandes) : ${ordersCountRes.error.message}`);
        const summary = toPartnerSummary(summaryRes);
        const split = splitLedgerRows(ledgerRows);
        const recentOrders = recentOrdersRes.data ?? [];

        const [tickets, onboarding] = await Promise.all([
            ticketsOfEvents<TicketRow>(events.map((e) => String(e.id)), 'id, event_id, ticket_number, price, status, checked_in_at, created_at'),
            partnerOnboarding(partnerId, { status: String(partner.status), description: partner.description ?? null, logo_url: partner.logo_url ?? null },
                events.map((e) => ({ id: String(e.id), status: String(e.status), image_url: (e.image_url as string | null) ?? null, created_at: (e.created_at as string | null) ?? null }))),
        ]);
        const validTickets = tickets.filter((t) => SOLD.has(t.status));
        const checkedInTickets = tickets.filter((t) => t.status === 'UTILISE');
        const cancelledTickets = tickets.filter((t) => t.status === 'ANNULE');

        const eventBreakdowns: PartnerEventBreakdown[] = events.map((ev) => {
            const evId = String(ev.id);
            const evTickets = tickets.filter((t) => t.event_id === evId);
            const evSold = evTickets.filter((t) => SOLD.has(t.status)).length;
            const evCheckedIn = evTickets.filter((t) => t.status === 'UTILISE').length;
            const evCapacity = Number(ev.capacity) || 1;
            const ledger = split.byEvent[evId] ?? EMPTY_BUCKET;
            return {
                id: evId,
                title: String(ev.title),
                startDate: String(ev.start_date),
                startTime: String(ev.start_time),
                startAt: dakarStartIso(ev.start_date, ev.start_time),
                location: String(ev.location ?? ''),
                city: String(ev.city ?? ''),
                status: String(ev.status),
                capacity: evCapacity,
                ticketsSold: evSold,
                ticketsAvailable: Math.max(0, evCapacity - evSold),
                ticketsCheckedIn: evCheckedIn,
                fillRatePercent: Math.min(100, Math.round((evSold / evCapacity) * 100)),
                checkInRatePercent: evSold > 0 ? Math.min(100, Math.round((evCheckedIn / evSold) * 100)) : 0,
                grossRevenue: ledger.sales,
                refundedAmount: ledger.refunded,
                netRevenue: ledger.net,
            };
        });

        // Flux d'activité récent unifié (Ventes, Scans, Commandes, Retraits)
        const recentActivity: PartnerActivityItem[] = [];
        const titleOf = (eventId: string) => String(events.find((e) => e.id === eventId)?.title ?? 'Événement');
        const byDateDesc = (a: { created_at: string }, b: { created_at: string }) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime();

        [...validTickets].sort(byDateDesc).slice(0, 8).forEach((t) => {
            recentActivity.push({
                id: `sale-${t.id}`,
                type: 'SALE',
                title: `Billet vendu : ${titleOf(t.event_id)}`,
                description: `Billet ${t.ticket_number ?? t.id.slice(0, 8)} · ${formatFcfa(Number(t.price))}`,
                amount: Number(t.price),
                status: t.status,
                createdAt: t.created_at,
            });
        });

        checkedInTickets
            .filter((t) => t.checked_in_at)
            .sort((a, b) => new Date(String(b.checked_in_at)).getTime() - new Date(String(a.checked_in_at)).getTime())
            .slice(0, 5)
            .forEach((t) => {
                recentActivity.push({
                    id: `scan-${t.id}`,
                    type: 'CHECKIN',
                    title: 'Entrée validée',
                    description: `${titleOf(t.event_id)} · contrôle à l’entrée`,
                    status: 'UTILISE',
                    createdAt: String(t.checked_in_at),
                });
            });

        recentOrders.forEach((o) => {
            recentActivity.push({
                id: `order-${o.id}`,
                type: 'ORDER',
                title: `Commande ${o.order_number}`,
                description: `${DELIVERY_MODE_LABELS[String(o.delivery_mode)] ?? 'Commande'} · ${formatFcfa(Number(o.total_amount))}`,
                amount: Number(o.total_amount),
                status: o.order_status,
                createdAt: o.created_at,
            });
        });

        withdrawals.rows.slice(0, 3).forEach((w) => {
            recentActivity.push({
                id: `w-${w.id}`,
                type: 'WITHDRAWAL',
                title: 'Demande de retrait',
                description: `${WITHDRAWAL_METHOD_LABELS[String(w.withdrawal_method)] ?? 'Retrait'} · ${formatFcfa(Number(w.gross_amount))}`,
                amount: Number(w.net_amount),
                status: String(w.status),
                createdAt: String(w.created_at),
            });
        });

        recentActivity.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        return {
            partner: {
                id: partner.id,
                companyName: partner.company_name,
                commercialName: partner.commercial_name || partner.company_name,
                phone: partner.phone,
                email: partner.email,
                status: partner.status,
                isVerified: partner.is_verified,
                rejectionReason: partner.status === 'REJETE' ? (partner.rejection_reason ?? null) : null,
                suspendedReason: partner.status === 'SUSPENDU' ? (partner.suspended_reason ?? null) : null,
            },
            onboarding,
            trial: partnerTrial(partner.trial_started_at ?? null, partner.trial_ends_at ?? null),
            kpis: {
                grossRevenue: summary.onlineSales,
                netRevenue: summary.organizerNet,
                refundedAmount: summary.refunded,
                availableRevenue: summary.available,
                pendingRevenue: summary.pending,
                nextAvailableAt: balance.next_available_at,
                debt: balance.debt,
                buyerServiceFees: summary.buyerServiceFees,
                cashSales: summary.cashSales,
                cashTickets: summary.cashTickets,
                ticketsSold: validTickets.length,
                ticketsCheckedIn: checkedInTickets.length,
                ticketsCancelled: cancelledTickets.length,
                totalEvents: events.length,
                activeEvents: events.filter((e) => e.status === 'PUBLIE').length,
                ordersCount: ordersCountRes.count ?? 0,
                ordersRevenue: summary.byTarget.ORDER ?? 0,
                soldeDisponible: balance.withdrawable,
                totalWithdrawn: withdrawals.totalWithdrawn,
                pendingWithdrawals: withdrawals.pending,
            },
            events: eventBreakdowns,
            recentActivity: recentActivity.slice(0, 15),
        };
    }

    /**
     * Rapport de clôture (Z de caisse / clôture événement) : net organisateur lu dans le grand livre
     * de l'événement, frais de service de l'acheteur et ventes espèces en lignes informatives.
     */
    public static async getClosingReportData(userId: string, eventId: string): Promise<ClosingReportData> {
        const supabase = getServiceRoleClient();
        const partner = await this.resolvePartner(userId);

        if (!eventId) {
            throw new Error('EVENT_ID_REQUIS');
        }

        const { data: event, error: evErr } = await supabase
            .from('events')
            .select('*')
            .eq('id', eventId)
            .maybeSingle();
        if (evErr) throw new Error(`Lecture impossible (événement) : ${evErr.message}`);
        if (!event) throw new Error('EVENEMENT_INTROUVABLE');
        if (event.partner_id !== partner.id) throw new Error('ACCES_REFUSE_AUTRE_TENANT');

        const [categoriesRes, tickets, summaryRes, eventPayments] = await Promise.all([
            supabase.from('ticket_categories').select('id, name, price, total_quantity').eq('event_id', eventId).order('price', { ascending: true }),
            ticketsOfEvents<TicketRow>([eventId], 'id, category_id, price, service_fee, status, payment_id'),
            supabase.rpc('finance_partner_summary', { p_partner_id: partner.id, p_event_id: eventId }),
            fetchAllRows<{ id: string; status: string; amount: number; refunded_amount: number | null }>('paiements de l’événement', (from, to) => supabase
                .from('payments')
                .select('id, status, amount, refunded_amount')
                .eq('event_id', eventId)
                .eq('is_platform_payment', true)
                .order('id', { ascending: true })
                .range(from, to)),
        ]);
        if (categoriesRes.error) throw new Error(`Lecture impossible (catégories) : ${categoriesRes.error.message}`);
        const categories = categoriesRes.data ?? [];
        const summary = toPartnerSummary(summaryRes);
        const flags = await platformFlags(tickets.map((t) => t.payment_id).filter((id): id is string => Boolean(id)));
        const isOnline = (t: TicketRow) => Boolean(t.payment_id && flags.get(t.payment_id)?.platform);

        // Ventilation par catégorie : prix réellement payés (billets), canal de paiement séparé
        const salesByCategory: CategorySalesSummary[] = categories.map((cat) => {
            const sold = tickets.filter((t) => t.category_id === cat.id && SOLD.has(t.status));
            const online = sold.filter(isOnline);
            const cash = sold.filter((t) => !isOnline(t) && Number(t.price) > 0);
            const grossAmount = online.reduce((s, t) => s + Number(t.price), 0);
            const totalAllocated = Number(cat.total_quantity) || 0;
            return {
                categoryId: cat.id,
                name: cat.name,
                unitPrice: Number(cat.price) || 0,
                totalAllocated,
                soldQuantity: sold.length,
                onlineQuantity: online.length,
                cashQuantity: cash.length,
                checkedInQuantity: sold.filter((t) => t.status === 'UTILISE').length,
                remainingQuantity: Math.max(0, totalAllocated - sold.length),
                grossAmount,
                cashAmount: cash.reduce((s, t) => s + Number(t.price), 0),
                netAmount: grossAmount,
            };
        });

        const totalAllocated = categories.reduce((s, c) => s + (Number(c.total_quantity) || 0), 0);
        const totalSold = tickets.filter((t) => SOLD.has(t.status)).length;
        const totalCheckedIn = tickets.filter((t) => t.status === 'UTILISE').length;
        const capacity = Number(event.capacity) || totalAllocated;

        const confirmed = eventPayments.filter((p) => p.status === 'SUCCESS' || p.status === 'PARTIAL');
        const pending = eventPayments.filter((p) => p.status === 'PENDING');
        const refundedPayments = eventPayments.filter((p) => p.status === 'REFUNDED');

        const dateSuffix = new Date().toISOString().split('T')[0].replace(/-/g, '');
        return {
            reportId: `CLOTURE-${eventId.slice(0, 8).toUpperCase()}-${dateSuffix}`,
            generatedAt: new Date().toISOString(),
            event: {
                id: event.id,
                title: event.title,
                category: event.category || 'Événement',
                startDate: event.start_date,
                startTime: event.start_time,
                venue: event.location,
                city: event.city,
                status: event.status,
                capacity,
            },
            partner: {
                id: partner.id,
                companyName: partner.company_name,
                commercialName: partner.commercial_name || partner.company_name,
                phone: partner.phone || '',
                email: partner.email || '',
            },
            salesByCategory,
            paymentsSummary: {
                confirmedCount: confirmed.length,
                confirmedGross: confirmed.reduce((s, p) => s + Number(p.amount), 0),
                pendingCount: pending.length,
                pendingGross: pending.reduce((s, p) => s + Number(p.amount), 0),
                refundedCount: refundedPayments.length,
                refundedGross: eventPayments.reduce((s, p) => s + Number(p.refunded_amount ?? 0), 0),
            },
            ticketsSummary: {
                totalAllocated: capacity,
                sold: totalSold,
                checkedIn: totalCheckedIn,
                cancelled: tickets.filter((t) => t.status === 'ANNULE').length,
                refunded: tickets.filter((t) => REFUNDED_TICKET.has(t.status)).length,
                remaining: Math.max(0, capacity - totalSold),
                checkInRatePercent: totalSold > 0 ? Math.min(100, Math.round((totalCheckedIn / totalSold) * 100)) : 0,
                fillRatePercent: capacity > 0 ? Math.min(100, Math.round((totalSold / capacity) * 100)) : 0,
            },
            financialSummary: {
                totalGross: summary.onlineSales,
                totalRefunded: summary.refunded,
                totalNet: summary.organizerNet,
                availableNet: summary.available,
                pendingNet: summary.pending,
                buyerServiceFees: summary.buyerServiceFees,
                cashSales: summary.cashSales,
                cashTickets: summary.cashTickets,
            },
        };
    }

    /**
     * Génère un document PDF vectoriel officiel pour le Rapport de Clôture (Z de Caisse).
     */
    public static async generateClosingReportPdf(data: ClosingReportData): Promise<Buffer> {
        const pageWidth = 595.28; // A4 portrait (points)
        const pageHeight = 841.89;

        let stream = '';

        // 1. Fond neutre haute définition
        stream += 'q\n';
        stream += '0.98 0.98 0.99 rg\n';
        stream += `0 0 ${pageWidth} ${pageHeight} re f\n`;

        // 2. En-tête Sunset Coral Event Village
        const headerY = pageHeight - 90;
        stream += '1 0.34 0.13 rg\n'; // #FF5722 Sunset Coral
        stream += `36 ${headerY} ${pageWidth - 72} 70 re f\n`;

        // Accent Gradient Bar
        stream += '1 0.24 0.41 rg\n'; // #FF3D68
        stream += `36 ${headerY} ${pageWidth - 72} 4 re f\n`;

        // Titres Header
        stream += 'BT\n/F2 16 Tf\n1 1 1 rg\n';
        stream += `52 ${headerY + 44} Td\n(${escapePdfText('Rapport de clôture')}) Tj\nET\n`;

        stream += 'BT\n/F1 9 Tf\n1 1 1 rg\n';
        stream += `52 ${headerY + 28} Td\n(Event Village -- Billetterie et recettes de la session) Tj\nET\n`;

        stream += 'BT\n/F2 9 Tf\n1 1 1 rg\n';
        stream += `${pageWidth - 210} ${headerY + 44} Td\n(ID: ${escapePdfText(data.reportId)}) Tj\nET\n`;

        const genDateFormatted = new Date(data.generatedAt).toLocaleDateString('fr-FR', {
            day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
        });
        stream += 'BT\n/F1 8 Tf\n1 1 1 rg\n';
        stream += `${pageWidth - 210} ${headerY + 28} Td\n(Edite le: ${escapePdfText(genDateFormatted)}) Tj\nET\n`;

        // 3. Carte Résumé Événement & Partenaire (2 Colonnes)
        const infoY = headerY - 70;
        stream += '1 1 1 rg\n0.85 0.88 0.92 RG\n1 w\n';
        stream += `36 ${infoY} ${pageWidth - 72} 58 re B\n`;

        // Colonne 1 : Événement
        stream += 'BT\n/F2 11 Tf\n0.06 0.09 0.16 rg\n';
        stream += `50 ${infoY + 40} Td\n(${escapePdfText(data.event.title.slice(0, 42))}) Tj\nET\n`;

        stream += 'BT\n/F1 8.5 Tf\n0.45 0.52 0.60 rg\n';
        stream += `50 ${infoY + 26} Td\n(Date: ${escapePdfText(data.event.startDate)} a ${escapePdfText(data.event.startTime)} -- Lieu: ${escapePdfText(data.event.venue)}, ${escapePdfText(data.event.city)}) Tj\nET\n`;

        stream += 'BT\n/F1 8.5 Tf\n0.45 0.52 0.60 rg\n';
        stream += `50 ${infoY + 12} Td\n(Statut: ${escapePdfText(data.event.status)} -- Capacite: ${data.event.capacity} places) Tj\nET\n`;

        // Colonne 2 : Organisateur / Partenaire
        stream += 'BT\n/F2 10 Tf\n1 0.34 0.13 rg\n';
        stream += `${pageWidth - 230} ${infoY + 40} Td\n(Organisateur: ${escapePdfText(data.partner.commercialName.slice(0, 28))}) Tj\nET\n`;

        stream += 'BT\n/F1 8.5 Tf\n0.45 0.52 0.60 rg\n';
        stream += `${pageWidth - 230} ${infoY + 26} Td\n(Societe: ${escapePdfText(data.partner.companyName.slice(0, 30))}) Tj\nET\n`;

        stream += 'BT\n/F1 8.5 Tf\n0.45 0.52 0.60 rg\n';
        stream += `${pageWidth - 230} ${infoY + 12} Td\n(Contact: ${escapePdfText(data.partner.phone || data.partner.email || 'support@event-village.sn')}) Tj\nET\n`;

        // 4. Section : VENTES PAR CATÉGORIE (Tableau Vectoriel)
        const tableY = infoY - 26;
        stream += 'BT\n/F2 11 Tf\n0.06 0.09 0.16 rg\n';
        stream += `36 ${tableY} Td\n(1. VENTILATION DES VENTES PAR FORMULE / CATEGORIE) Tj\nET\n`;

        // En-tête du tableau
        const theadY = tableY - 22;
        stream += '0.94 0.96 0.98 rg\n';
        stream += `36 ${theadY} ${pageWidth - 72} 20 re f\n`;

        stream += 'BT\n/F2 8.5 Tf\n0.20 0.25 0.35 rg\n';
        stream += `44 ${theadY + 6} Td\n(CATEGORIE) Tj\n`;
        stream += `160 0 Td\n(PRIX UNIT.) Tj\n`;
        stream += `80 0 Td\n(VENDUS) Tj\n`;
        stream += `70 0 Td\n(COMPOSTES) Tj\n`;
        stream += `70 0 Td\n(RESTANTS) Tj\n`;
        stream += `70 0 Td\n(EN LIGNE) Tj\n`;
        stream += 'ET\n';

        // Lignes du tableau
        let rowY = theadY - 18;
        data.salesByCategory.forEach((cat, idx) => {
            const bg = idx % 2 === 0 ? '1 1 1' : '0.98 0.98 0.99';
            stream += `${bg} rg\n`;
            stream += `36 ${rowY} ${pageWidth - 72} 18 re f\n`;

            stream += '0.88 0.90 0.94 RG\n0.5 w\n';
            stream += `36 ${rowY} m ${pageWidth - 36} ${rowY} l S\n`;

            stream += 'BT\n/F1 8.5 Tf\n0.06 0.09 0.16 rg\n';
            stream += `44 ${rowY + 5} Td\n(${escapePdfText(cat.name.slice(0, 22))}) Tj\n`;
            stream += `160 0 Td\n(${pdfAmount(cat.unitPrice, 'F')}) Tj\n`;
            stream += `80 0 Td\n(${cat.soldQuantity}) Tj\n`;
            stream += `70 0 Td\n(${cat.checkedInQuantity}) Tj\n`;
            stream += `70 0 Td\n(${cat.remainingQuantity}) Tj\n`;
            stream += 'ET\n';

            stream += 'BT\n/F2 8.5 Tf\n0.06 0.09 0.16 rg\n';
            stream += `${pageWidth - 110} ${rowY + 5} Td\n(${pdfAmount(cat.grossAmount)}) Tj\nET\n`;

            rowY -= 18;
        });

        // 5. Section : SYNTHÈSE DE BILLETTERIE & CONTRÔLE D'ACCÈS
        const summaryBoxY = rowY - 14;
        stream += 'BT\n/F2 11 Tf\n0.06 0.09 0.16 rg\n';
        stream += `36 ${summaryBoxY} Td\n(2. STATISTIQUES D'ACCES & RECONCILIATION) Tj\nET\n`;

        const statGridY = summaryBoxY - 58;
        const boxWidth = (pageWidth - 72 - 20) / 3;

        // Box 1 : Billets Vendus / Capacité
        stream += '1 1 1 rg\n0.85 0.88 0.92 RG\n1 w\n';
        stream += `36 ${statGridY} ${boxWidth} 48 re B\n`;
        stream += 'BT\n/F1 8 Tf\n0.45 0.52 0.60 rg\n';
        stream += `46 ${statGridY + 34} Td\n(BILLETS VENDUS / CAPACITE) Tj\nET\n`;
        stream += 'BT\n/F2 12 Tf\n0.06 0.09 0.16 rg\n';
        stream += `46 ${statGridY + 16} Td\n(${data.ticketsSummary.sold} / ${data.ticketsSummary.totalAllocated} (${data.ticketsSummary.fillRatePercent}%)) Tj\nET\n`;

        // Box 2 : Billets Compostés aux Portes
        stream += '1 1 1 rg\n0.85 0.88 0.92 RG\n1 w\n';
        stream += `${36 + boxWidth + 10} ${statGridY} ${boxWidth} 48 re B\n`;
        stream += 'BT\n/F1 8 Tf\n0.45 0.52 0.60 rg\n';
        stream += `${46 + boxWidth + 10} ${statGridY + 34} Td\n(ENTREES VALIDEES / SCAN) Tj\nET\n`;
        stream += 'BT\n/F2 12 Tf\n0.10 0.60 0.30 rg\n';
        stream += `${46 + boxWidth + 10} ${statGridY + 16} Td\n(${data.ticketsSummary.checkedIn} entr\xE9es (${data.ticketsSummary.checkInRatePercent}%)) Tj\nET\n`;

        // Box 3 : Annulations & Remboursements
        stream += '1 1 1 rg\n0.85 0.88 0.92 RG\n1 w\n';
        stream += `${36 + (boxWidth + 10) * 2} ${statGridY} ${boxWidth} 48 re B\n`;
        stream += 'BT\n/F1 8 Tf\n0.45 0.52 0.60 rg\n';
        stream += `${46 + (boxWidth + 10) * 2} ${statGridY + 34} Td\n(ANNULES / REMBOURSES) Tj\nET\n`;
        stream += 'BT\n/F2 12 Tf\n0.80 0.20 0.20 rg\n';
        stream += `${46 + (boxWidth + 10) * 2} ${statGridY + 16} Td\n(${data.ticketsSummary.cancelled} annule(s) / ${data.ticketsSummary.refunded} remb.) Tj\nET\n`;

        // 6. Section : SYNTHÈSE COMPTABLE (grand livre) & REVERSEMENT NET
        const finSectionY = statGridY - 26;
        stream += 'BT\n/F2 11 Tf\n0.06 0.09 0.16 rg\n';
        stream += `36 ${finSectionY} Td\n(3. RECAPITULATIF FINANCIER & REVERSEMENT NET) Tj\nET\n`;

        const finBoxY = finSectionY - 150;
        stream += '0.96 0.97 0.99 rg\n0.80 0.85 0.90 RG\n1.5 w\n';
        stream += `36 ${finBoxY} ${pageWidth - 72} 138 re B\n`;

        const finLine = (y: number, label: string, amount: string, color: string) => {
            stream += 'BT\n/F1 10 Tf\n0.20 0.25 0.35 rg\n';
            stream += `52 ${finBoxY + y} Td\n(${escapePdfText(label)}) Tj\nET\n`;
            stream += `BT\n/F2 11 Tf\n${color} rg\n`;
            stream += `${pageWidth - 180} ${finBoxY + y} Td\n(${amount}) Tj\nET\n`;
        };
        const fin = data.financialSummary;
        finLine(114, 'Ventes en ligne (prix faciaux des billets)', pdfAmount(fin.totalGross), '0.06 0.09 0.16');
        finLine(94, 'Remboursements aux acheteurs (part organisateur)', `- ${pdfAmount(fin.totalRefunded)}`, '0.80 0.20 0.20');
        finLine(74, 'Frais de service payes par l\'acheteur (informatif, non deduits)', pdfAmount(fin.buyerServiceFees), '0.45 0.52 0.60');
        finLine(54, `Ventes especes au guichet, hors plateforme (${fin.cashTickets} billet(s), informatif)`, pdfAmount(fin.cashSales), '0.45 0.52 0.60');
        finLine(34, 'Dont disponible / en attente de disponibilite', `${pdfAmount(fin.availableNet, 'F')} / ${pdfAmount(fin.pendingNet, 'F')}`, '0.06 0.09 0.16');

        // NET PARTENAIRE (Surbrillance Orange)
        stream += '1 0.34 0.13 rg\n';
        stream += `36 ${finBoxY} ${pageWidth - 72} 26 re f\n`;

        stream += 'BT\n/F2 11 Tf\n1 1 1 rg\n';
        stream += `52 ${finBoxY + 8} Td\n(NET ORGANISATEUR -- VENTES EN LIGNE) Tj\nET\n`;
        stream += 'BT\n/F2 13 Tf\n1 1 1 rg\n';
        stream += `${pageWidth - 190} ${finBoxY + 7} Td\n(${pdfAmount(fin.totalNet)}) Tj\nET\n`;

        // 7. Footer & Sceau d'authenticité
        const footerY = 30;
        stream += '0.85 0.88 0.92 RG\n0.75 w\n';
        stream += `36 ${footerY + 22} m ${pageWidth - 36} ${footerY + 22} l S\n`;

        stream += 'BT\n/F1 7.5 Tf\n0.45 0.52 0.60 rg\n';
        stream += `36 ${footerY + 10} Td\n(Genere automatiquement par Event Village Senegal -- contact@event-village.sn) Tj\nET\n`;

        stream += 'BT\n/F2 7.5 Tf\n0.35 0.40 0.50 rg\n';
        stream += `36 ${footerY} Td\n(Reference : ${escapePdfText(data.reportId)}) Tj\nET\n`;

        stream += 'Q\n';

        // 8. Structure PDF-1.4 standard
        const streamLength = Buffer.byteLength(stream, 'latin1');
        const objects = [];
        objects[1] = '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj';
        objects[2] = '2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj';
        objects[3] = `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth.toFixed(2)} ${pageHeight.toFixed(2)}] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>\nendobj`;
        objects[4] = `4 0 obj\n<< /Length ${streamLength} >>\nstream\n${stream}\nendstream\nendobj`;
        objects[5] = '5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>\nendobj';
        objects[6] = '6 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>\nendobj';

        let body = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n';
        const xrefOffsets = [0];

        for (let i = 1; i <= 6; i++) {
            xrefOffsets[i] = Buffer.byteLength(body, 'latin1');
            body += objects[i] + '\n';
        }

        const startXref = Buffer.byteLength(body, 'latin1');
        body += 'xref\n0 7\n0000000000 65535 f \n';
        for (let i = 1; i <= 6; i++) {
            const offsetStr = String(xrefOffsets[i]).padStart(10, '0');
            body += `${offsetStr} 00000 n \n`;
        }

        body += 'trailer\n<< /Size 7 /Root 1 0 R >>\n';
        body += `startxref\n${startXref}\n%%EOF\n`;

        return Buffer.from(body, 'latin1');
    }

    /**
     * Export comptable (CSV UTF-8 avec BOM, séparateur point-virgule) : une ligne par billet (canal,
     * prix facial, frais de service payés par l'acheteur, remboursement, net organisateur en ligne),
     * puis la synthèse du grand livre (finance_partner_summary), cohérente avec le rapport de clôture.
     */
    public static async generateAccountingExport(
        userId: string,
        eventId?: string,
        format: 'xlsx' | 'csv' = 'csv'
    ): Promise<{ buffer: Buffer; contentType: string; filename: string }> {
        const supabase = getServiceRoleClient();
        const partner = await this.resolvePartner(userId);

        let eventsQuery = supabase.from('events').select('id, title, start_date').eq('partner_id', partner.id);
        if (eventId) eventsQuery = eventsQuery.eq('id', eventId);
        const { data: events, error: evErr } = await eventsQuery;
        if (evErr) throw new Error(`Lecture impossible (événements) : ${evErr.message}`);
        if (eventId && (!events || events.length === 0)) throw new Error('EVENEMENT_INTROUVABLE');
        const eventList = events ?? [];
        const eventIds = eventList.map((e) => e.id as string);

        const [tickets, categories, summaryRes] = await Promise.all([
            ticketsOfEvents<TicketRow>(eventIds, 'id, event_id, category_id, ticket_number, price, service_fee, status, payment_id, created_at'),
            eventIds.length > 0
                ? fetchAllRows<{ id: string; name: string }>('catégories', (from, to) => supabase
                    .from('ticket_categories').select('id, name').in('event_id', eventIds).order('id', { ascending: true }).range(from, to))
                : Promise.resolve([] as Array<{ id: string; name: string }>),
            supabase.rpc('finance_partner_summary', { p_partner_id: partner.id, p_event_id: eventId ?? null }),
        ]);
        const summary = toPartnerSummary(summaryRes);
        // Canal de chaque billet : paiement plateforme (is_platform_payment) ou hors plateforme
        const flags = await platformFlags(tickets.map((t) => t.payment_id).filter((id): id is string => Boolean(id)));

        const headers = [
            'Date',
            'Evenement',
            'Reference Transaction',
            'Canal',
            'Billet',
            'Categorie',
            'Quantite',
            'Prix facial (FCFA)',
            'Frais de service acheteur (FCFA, informatif)',
            'Remboursement (FCFA)',
            'Net organisateur en ligne (FCFA)',
            'Statut billet',
        ];

        const rows: Array<Array<string | number>> = tickets
            .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
            .map((t) => {
                const flag = t.payment_id ? flags.get(t.payment_id) : undefined;
                const online = flag?.platform === true;
                const price = Number(t.price) || 0;
                const channel = online ? 'EN_LIGNE' : price > 0 ? 'ESPECES' : 'INVITATION';
                return [
                    t.created_at ? new Date(t.created_at).toISOString().split('T')[0] : '',
                    String(eventList.find((e) => e.id === t.event_id)?.title ?? 'Evenement'),
                    flag?.reference ?? '',
                    channel,
                    t.ticket_number || t.id,
                    categories.find((c) => c.id === t.category_id)?.name ?? 'Standard',
                    1,
                    price,
                    online ? Number(t.service_fee ?? 0) : 0,
                    online && REFUNDED_TICKET.has(t.status) ? price : 0,
                    online && SOLD.has(t.status) ? price : 0,
                    t.status,
                ];
            });

        const blank = headers.map(() => '');
        const totalLine = (label: string, amount: number): Array<string | number> => {
            const line: Array<string | number> = [...blank];
            line[1] = label;
            line[10] = amount;
            return line;
        };
        rows.push(blank);
        rows.push(totalLine('SYNTHESE DU GRAND LIVRE : ventes en ligne (prix faciaux)', summary.onlineSales));
        rows.push(totalLine('Remboursements (part organisateur)', -summary.refunded));
        rows.push(totalLine('NET ORGANISATEUR (ventes en ligne)', summary.organizerNet));
        rows.push(totalLine('Frais de service payes par l\'acheteur (informatif, non deduits)', summary.buyerServiceFees));
        rows.push(totalLine(`Ventes especes hors plateforme (${summary.cashTickets} billet(s), informatif)`, summary.cashSales));

        const csvLines = [headers, ...rows].map((r) => r.map(csvField).join(';'));
        const csvContent = '﻿' + csvLines.join('\r\n');
        const buffer = Buffer.from(csvContent, 'utf8');

        const prefix = eventId ? `Cloture-${eventId.slice(0, 8)}` : `Comptabilite-${partner.company_name.replace(/[^a-zA-Z0-9]/g, '_')}`;
        const dateTag = new Date().toISOString().split('T')[0];
        // Format CSV uniquement (le paramètre format=xlsx est accepté pour compatibilité de l'API, mais produit un CSV)
        const filename = `EventVillage-${prefix}-${dateTag}.csv`;

        return {
            buffer,
            contentType: 'text/csv; charset=utf-8',
            filename,
        };
    }
}

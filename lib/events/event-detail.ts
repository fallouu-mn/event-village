/**
 * Design 1b (points 1, 6, 11) — fiche publique d'un événement : forme des données et règles pures, partagées par le
 * serveur (lib/events/event-detail.server.ts, GET /api/events/[id], page app/events/[id]) et par les îlots du téléphone
 * (components/event-page). Aucune lecture en base ici, aucune donnée personnelle ni de caisse : seulement ce que la
 * fiche publique montre à tout le monde.
 */
import type { ScanCategoryColor } from '../scan/scan-result';
import { formatFcfa } from '../format';

export type Availability = 'AVAILABLE' | 'LOW' | 'SOLD_OUT';
export type BannerKind = 'SUSPENDU' | 'ANNULE' | 'TERMINE';
export type PublicSheetStatus = 'PUBLIE' | BannerKind;

export interface PublicCategory {
    id: string;
    name: string;
    price: number;
    priceFormatted: string;
    isFree: boolean;
    availability: Availability;
    /** Restant affiché seulement dans la tranche « bientôt complet » (contrat O). */
    remainingHint: number | null;
    availableQuantity?: number;
    status: 'SOLD_OUT' | 'ACTIVE';
    isSoldOut: boolean;
    isHeld: boolean;
    isClosed: boolean;
    /** Vente en ligne ouverte pour cette catégorie (événement publié, pas fini, vente commencée et non close, places). */
    isAvailable: boolean;
    saleOpen: boolean;
    saleStarted: boolean;
    saleEnded: boolean;
    saleStart: string | null;
    saleEnd: string | null;
    maxPerOrder: number;
    description: string;
    /** Design 1b (point 6) : couleur de la catégorie, la même qu'au contrôle (jetons --scan-cat-*), ou null. */
    scanColor: ScanCategoryColor | null;
}

export interface ProgramItem {
    id?: string;
    time?: string | null;
    kind?: string | null;
    title?: string | null;
    participant?: string | null;
    description?: string | null;
    day?: string | null;
}

/** Ligne « Remboursement » : seulement quand une règle vraie s'applique à l'événement (point 6). */
export interface RefundRule {
    kind: 'ANNULATION' | 'REPORT';
    text: string;
}

export interface PublicEventDetail {
    id: string;
    slug: string;
    title: string;
    category: string | null;
    categoryLabel: string | null;
    description: string;
    subtitle: string;
    organizer: { id?: string; name: string; avatar: string | null };
    posterUrl: string | null;
    /** Design 1d (point 1) : couleur de l'affiche (contraste ≥ 4,5:1 avec le blanc), « bleu nuit » à défaut. */
    posterColor: string;
    /** Design 1d (point 1) : petite image floutée de l'affiche (adresse data:), null sans calcul. */
    posterBlur: string | null;
    galleryUrls: string[];
    dateFormatted: string;
    time: string;
    /** Fin lisible (« jusqu’à 23:00 »), absente sans date de fin saisie. */
    endFormatted?: string;
    /** Design 1b (point 11) : début et fin retenue (même règle que public.event_end_at), instants ISO. */
    startsAt: string;
    endsAt: string;
    venue: string;
    city: string | null;
    latitude: number | null;
    longitude: number | null;
    capacity: number | null;
    status: PublicSheetStatus;
    purchasable: boolean;
    banner: { kind: BannerKind; title: string; message: string } | null;
    cancellation?: { publicNotice: string; cancelledAt: string; refundInfo: string };
    isFullySoldOut: boolean;
    hasHeldSeats: boolean;
    salesEnded: boolean;
    hasAvailableTickets: boolean;
    /**
     * Design 1b (point 11) : des billets sont vendus au guichet sur place (catégorie active vendue au guichet, avec des
     * places, événement publié et pas fini). Un seul booléen : ni nom, ni prix, ni quantité, ni donnée de caisse.
     */
    counterSale: boolean;
    refund: RefundRule | null;
    /**
     * Design 1c bis (point 3, erreur 418) : faux dans la fiche en cache (aucun état qui dépend de l'heure n'y est figé :
     * achat, disponibilité, vente ouverte ou close, guichet, remboursement d'un report) ; vrai une fois l'heure appliquée
     * (withClock : route de l'API à l'heure du serveur, billetterie dans le navigateur après le chargement).
     */
    clockKnown: boolean;
    /** Faits sans heure, d'où withClock déduit le guichet et le remboursement d'un report. */
    counterCapable: boolean;
    postponedOver24h: boolean;
    program: ProgramItem[];
    practicalInfo: {
        address: string | null;
        accessNotes: string | null;
        parking: string | null;
        contactPhone: string | null;
        contactPhoneTel: string | null;
        rules: string | null;
    };
    categories: PublicCategory[];
}

/** Règle de l'annulation (vérifiée dans event_cancel, refund_request et event_cash_refunds). */
export const REFUND_INFO =
    'Les billets payés en ligne sont remboursés automatiquement sur le compte Mobile Money utilisé pour l’achat, '
    + 'frais de service compris. Les billets réglés en espèces sont remboursés par l’organisateur.';

/**
 * Règle du report (ticket_postponement_refund_open, migration 20261109000006) : billet payé en ligne avant un report de
 * plus de 24 h, remboursement total (frais compris) sur demande dans Mes billets, jusqu'au nouveau début.
 */
export const POSTPONEMENT_REFUND_INFO =
    'L’événement a été reporté de plus de 24 h. Les billets payés en ligne avant le report peuvent être remboursés en '
    + 'totalité, frais de service compris : demandez-le dans Mes billets, jusqu’au début de l’événement.';

/** Report de plus de 24 h : l'écart entre le début actuel et un ancien début. */
export const POSTPONEMENT_MIN_MS = 24 * 3600_000;

export function priceLabel(price: number): string {
    return price === 0 ? 'Gratuit' : formatFcfa(price);
}

/**
 * Prix d'appel de la barre d'achat (« Dès 5 000 F CFA », « Gratuit », « Gratuit ou dès 5 000 F CFA »), sur les seules
 * catégories en vente en ligne ; null si aucune ne l'est.
 */
export function fromPriceLabel(categories: ReadonlyArray<Pick<PublicCategory, 'price' | 'isAvailable'>>): string | null {
    const open = categories.filter((c) => c.isAvailable);
    if (open.length === 0) return null;
    const paid = open.filter((c) => c.price > 0).map((c) => c.price);
    const hasFree = open.some((c) => c.price === 0);
    if (paid.length === 0) return 'Gratuit';
    const from = formatFcfa(Math.min(...paid));
    return hasFree ? `Gratuit ou dès ${from}` : `Dès ${from}`;
}

/**
 * Prochain instant où la vente en ligne peut changer d'état sans écriture en base (début ou fin de vente d'une
 * catégorie, fin de l'événement) : la fiche se relit alors d'elle-même. null s'il n'y en a plus.
 */
export function nextSaleBoundary(detail: Pick<PublicEventDetail, 'categories' | 'endsAt'>, now: Date): Date | null {
    const t = now.getTime();
    let best: number | null = null;
    const consider = (iso: string | null | undefined): void => {
        if (!iso) return;
        const v = Date.parse(iso);
        if (Number.isFinite(v) && v > t && (best === null || v < best)) best = v;
    };
    for (const c of detail.categories) {
        consider(c.saleStart);
        consider(c.saleEnd);
    }
    consider(detail.endsAt);
    return best === null ? null : new Date(best);
}

/** Vrai si la ligne « Remboursement » dit encore la vraie règle à cet instant (le report vaut jusqu'au début). */
export function refundRuleApplies(rule: RefundRule | null, startsAt: string, now: Date): boolean {
    if (!rule) return false;
    if (rule.kind === 'ANNULATION') return true;
    const start = Date.parse(startsAt);
    return Number.isFinite(start) && now.getTime() < start;
}

/**
 * Design 1c bis (point 3) — état de la billetterie à une heure donnée, calculé depuis les seuls faits sans heure de la
 * fiche (dates de vente, début, fin, statut, stock). `now` nul : horloge inconnue (fiche en cache, premier rendu du
 * navigateur) : rien d'ouvert ni de fermé, aucun guichet, aucun remboursement de report ; seule l'annulation, qui ne
 * dépend pas de l'heure, garde sa règle. Le même calcul sert la route de l'API (heure du serveur) et la billetterie
 * (heure du téléphone, après le chargement) : la page en cache ne dépend jamais de l'heure.
 */
export function withClock(detail: PublicEventDetail, now: Date | null): PublicEventDetail {
    const cancelRefund = detail.status === 'ANNULE' && detail.refund?.kind === 'ANNULATION' ? detail.refund : null;
    if (now === null) {
        return {
            ...detail,
            clockKnown: false,
            purchasable: false,
            hasAvailableTickets: false,
            salesEnded: false,
            counterSale: false,
            refund: cancelRefund,
            categories: detail.categories.map((c) => ({ ...c, saleStarted: false, saleEnded: false, saleOpen: false, isAvailable: false })),
        };
    }
    const t = now.getTime();
    const ended = Date.parse(detail.endsAt) <= t;
    const categories = detail.categories.map((c) => {
        const saleStarted = !c.saleStart || Date.parse(c.saleStart) <= t;
        const saleEnded = c.saleEnd ? Date.parse(c.saleEnd) <= t : false;
        const saleOpen = saleStarted && !saleEnded;
        const isAvailable = detail.status === 'PUBLIE' && !ended && saleOpen && !c.isSoldOut;
        return { ...c, saleStarted, saleEnded, saleOpen, isAvailable };
    });
    const hasAvailableTickets = categories.some((c) => c.isAvailable);
    const postponeRefund = detail.postponedOver24h && (detail.status === 'PUBLIE' || detail.status === 'SUSPENDU') && t < Date.parse(detail.startsAt)
        ? { kind: 'REPORT' as const, text: POSTPONEMENT_REFUND_INFO } : null;
    return {
        ...detail,
        clockKnown: true,
        purchasable: detail.status === 'PUBLIE' && !ended && hasAvailableTickets,
        hasAvailableTickets,
        salesEnded: categories.length > 0 && categories.every((c) => c.saleEnded),
        counterSale: detail.status === 'PUBLIE' && !ended && detail.counterCapable,
        refund: cancelRefund ?? postponeRefund,
        categories,
    };
}

/** Lecture prudente de la réponse de GET /api/events/[id] (îlot de la billetterie). */
export function readPublicEventDetail(body: unknown): PublicEventDetail | null {
    if (typeof body !== 'object' || body === null) return null;
    const event = (body as { event?: unknown }).event;
    if (typeof event !== 'object' || event === null) return null;
    const e = event as Partial<PublicEventDetail>;
    if (typeof e.id !== 'string' || typeof e.title !== 'string' || typeof e.purchasable !== 'boolean') return null;
    return {
        ...(e as PublicEventDetail),
        categories: Array.isArray(e.categories) ? e.categories : [],
        program: Array.isArray(e.program) ? e.program : [],
        banner: e.banner ?? null,
        counterSale: e.counterSale === true,
        refund: e.refund ?? null,
        clockKnown: e.clockKnown === true,
        counterCapable: e.counterCapable === true,
        postponedOver24h: e.postponedOver24h === true,
    };
}

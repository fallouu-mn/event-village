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
    };
}

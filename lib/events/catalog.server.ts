import { getCategoryLabel } from '@/lib/constants/event-categories';
import { eventEndAt } from '@/lib/events/event-end';
import { eventStartAt } from '@/lib/events/live-status';
import { posterColorOrFallback } from '@/lib/events/poster-color';
import { foldText } from '@/lib/text/fold';

/**
 * Lot 9 (9.1, contrat 5.2) — sélection et format de carte du catalogue public, extraits de GET /api/events pour que
 * « Populaires » serve exactement la même carte. Contrat E du lot 5 : prix « à partir de » calculé sur les catégories
 * actives ET vendues en ligne ; sans catégorie achetable, aucun prix et « Bientôt en vente », jamais « Gratuit » ;
 * aucune donnée de stock, aucune catégorie masquée ni identifiant de partenaire exposé.
 * Lot 9 bis (R35, R36 ; contrat 4.3, B59, B60) : catégorie achetable = active, vendue en ligne, avec des places
 * restantes, vente commencée et non close ; `saleLabel` dit l'état de la vente en une ligne (« À partir de … »,
 * « Gratuit », « Bientôt en vente », « Vente sur place uniquement », « Complet », « Vente en ligne terminée ») ;
 * `endFormatted` seulement quand une date de fin est saisie. `priceFormatted` garde sa règle (contrat E du lot 5).
 * Lot 9 ter (9t.19, consigne 5, contrat D.2.3) : `stock` (« Complet », « Dernières places ») calculé sur les catégories
 * actives vendues en ligne, jamais un nombre de places ; « Complet » passe avant « Vente sur place uniquement » quand
 * plus aucune catégorie au guichet n'a de place (le guichet partage le quota de la catégorie).
 * Design 1b (point 4) : « Dernières places » relatif à la jauge (lowStockLimit) ; la carte reçoit aussi `startsAt` et
 * `endsAt` (instants ISO du début et de la fin retenue, pour « En cours » calculé sur le téléphone) et `paidFrom` (plus
 * petit prix payant achetable, pour « Gratuit ou dès … »). Aucun nombre de places n'est exposé.
 */
export const CATALOG_SELECT = `
    id,
    slug,
    title,
    category,
    description,
    location,
    city,
    start_date,
    start_time,
    end_date,
    end_time,
    image_url,
    poster_color,
    status,
    created_at,
    partner_id,
    partners(company_name, commercial_name),
    ticket_categories(price, is_active, sale_online, sale_counter, total_quantity, sold_quantity, held_quantity, sale_start, sale_end)
`;

export interface CatalogRow {
    id: string;
    slug: string | null;
    title: string;
    category: string | null;
    location: string | null;
    city: string | null;
    start_date: string;
    start_time: string | null;
    end_date: string | null;
    end_time: string | null;
    image_url: string | null;
    /** Design 1d : couleur de l'affiche (migration 20261127000001), NULL sans calcul. */
    poster_color?: string | null;
    status: string;
    partners: { company_name: string | null; commercial_name: string | null } | null;
    ticket_categories: CatalogCategoryRow[] | null;
}

export interface CatalogCategoryRow {
    price: number | string;
    is_active: boolean | null;
    sale_online: boolean | null;
    sale_counter: boolean | null;
    total_quantity: number | null;
    sold_quantity: number | null;
    held_quantity: number | null;
    sale_start: string | null;
    sale_end: string | null;
}

export interface CatalogEventDto {
    id: string;
    slug: string;
    title: string;
    subtitle: string;
    imageUrl: string | null;
    /** Design 1d (point 2) : couleur de l'affiche, contraste ≥ 4,5:1 avec le blanc, « bleu nuit » à défaut. */
    posterColor: string;
    dateFormatted: string;
    dayNumber: string;
    monthShort: string;
    timeFormatted: string;
    venue: string;
    category: string | null;
    categoryLabel: string | null;
    city: string;
    price: number | null;
    priceFormatted: string;
    onSaleSoon: boolean;
    /** Lot 9 bis (R35) : état de la vente, à afficher tel quel sur la carte. */
    saleLabel: string;
    /** Lot 9 bis (R36) : fin lisible, seulement si une date de fin est saisie. */
    endFormatted?: string;
    status: string;
    /** Lot 9 ter (9t.19) : tranche de stock en ligne (badge « Complet » ou « Dernières places »), null sinon. */
    stock: CatalogStock;
    /** Design 1b : début (date et heure saisies, Dakar = UTC), instant ISO. */
    startsAt: string;
    /** Design 1b : fin retenue (même règle que public.event_end_at), instant ISO. */
    endsAt: string;
    /** Design 1b : plus petit prix payant (> 0) des catégories achetables, null s'il n'y en a pas (« Gratuit ou dès … »). */
    paidFrom: number | null;
}

/**
 * Lot 9 ter (9t.19) : SOLD_OUT = plus aucune place en ligne. Design 1b (point 4) : LOW = places restantes en ligne au plus
 * à 10 % de la jauge en ligne (lowStockLimit).
 */
export type CatalogStock = 'SOLD_OUT' | 'LOW' | null;

/**
 * Design 1b (point 4) — part de la jauge sous laquelle la carte dit « Dernières places » : 10 %. Jauge en ligne = places
 * mises en vente en ligne par les catégories actives dont la vente n'est pas close (vendues comprises) ; restantes = places
 * encore achetables en ligne (catégories achetables). Au moins 1 : sur une petite jauge, la dernière place compte.
 */
export const LOW_STOCK_SHARE = 0.1;

/** Plus grand nombre de places restantes qui vaut « Dernières places » pour une jauge en ligne donnée. */
export function lowStockLimit(capacity: number): number {
    if (!Number.isFinite(capacity) || capacity <= 0) return 0;
    return Math.max(1, Math.floor(capacity * LOW_STOCK_SHARE));
}

function remainingOf(c: CatalogCategoryRow): number {
    return Number(c.total_quantity ?? 0) - Number(c.sold_quantity ?? 0) - Number(c.held_quantity ?? 0);
}

function saleStarted(c: CatalogCategoryRow, now: number): boolean {
    return !c.sale_start || Date.parse(c.sale_start) <= now;
}

function saleEnded(c: CatalogCategoryRow, now: number): boolean {
    return Boolean(c.sale_end) && Date.parse(String(c.sale_end)) <= now;
}

/** Catégorie achetable en ligne maintenant (R35, B60). */
export function isBuyableOnline(c: CatalogCategoryRow, now: number): boolean {
    return c.is_active === true && c.sale_online === true && remainingOf(c) > 0 && saleStarted(c, now) && !saleEnded(c, now);
}

/**
 * Lot 9 ter (9t.19) : une catégorie en ligne épuisée sans être close, et toutes les autres épuisées ou closes. Les
 * places au guichet ne comptent pas : elles partagent le quota de la catégorie.
 */
function onlineSoldOut(online: CatalogCategoryRow[], now: number): boolean {
    return online.length > 0
        && online.some((c) => remainingOf(c) <= 0 && !saleEnded(c, now))
        && online.every((c) => remainingOf(c) <= 0 || saleEnded(c, now));
}

/**
 * Lot 9 ter (9t.19, contrat D.2.3) : tranche de stock de la carte, sans nombre de places. Design 1b (point 4) : « LOW »
 * quand les places restantes en ligne ne dépassent pas 10 % de la jauge en ligne (lowStockLimit) ; jamais quand rien
 * n'est achetable (« Complet » ou rien).
 */
export function stockOf(categories: CatalogCategoryRow[], now: number): CatalogStock {
    const online = categories.filter((c) => c.is_active === true && c.sale_online === true);
    const buyable = online.filter((c) => isBuyableOnline(c, now));
    if (buyable.length === 0) return onlineSoldOut(online, now) ? 'SOLD_OUT' : null;
    const capacity = online
        .filter((c) => !saleEnded(c, now))
        .reduce((sum, c) => sum + Math.max(0, Number(c.total_quantity ?? 0)), 0);
    const remaining = buyable.reduce((sum, c) => sum + Math.max(0, remainingOf(c)), 0);
    return remaining <= lowStockLimit(capacity) ? 'LOW' : null;
}

function saleLabelOf(categories: CatalogCategoryRow[], minPrice: number | null, now: number): string {
    if (minPrice !== null) return minPrice === 0 ? 'Gratuit' : `À partir de ${minPrice.toLocaleString('fr-FR')} F CFA`;
    const active = categories.filter((c) => c.is_active === true);
    const online = active.filter((c) => c.sale_online === true);
    if (online.some((c) => remainingOf(c) > 0 && !saleStarted(c, now) && !saleEnded(c, now))) return 'Bientôt en vente';
    // Lot 9 ter (9t.19) : « Complet » d'abord quand le guichet n'a plus de place non plus ; « sur place » seulement
    // s'il en reste au guichet.
    const counterOpen = active.some((c) => c.sale_counter === true && remainingOf(c) > 0);
    if (!counterOpen && onlineSoldOut(online, now)) return 'Complet';
    if (counterOpen) return 'Vente sur place uniquement';
    if (online.length > 0 && online.every((c) => saleEnded(c, now))) return 'Vente en ligne terminée';
    if (online.length > 0 && online.every((c) => remainingOf(c) <= 0 || saleEnded(c, now))) return 'Complet';
    return 'Bientôt en vente';
}

/**
 * Lot 9 bis (R36, B59) : fin d'un événement, seulement si une date de fin est saisie (sinon `undefined` : la fin par
 * défaut, début + 6 h, n'est jamais montrée). Même jour que le début : « jusqu’à 23:00 » ; sinon « jusqu’au samedi
 * 14 novembre à 02:00 ». Fuseau Africa/Dakar.
 */
export function formatEventEnd(row: { start_date: string; end_date: string | null; end_time: string | null }): string | undefined {
    if (!row.end_date) return undefined;
    const time = row.end_time ? row.end_time.substring(0, 5) : null;
    if (row.end_date === row.start_date) return time ? `jusqu’à ${time}` : undefined;
    const day = new Date(`${row.end_date}T00:00:00Z`).toLocaleDateString('fr-FR', {
        weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Africa/Dakar',
    });
    return time ? `jusqu’au ${day} à ${time}` : `jusqu’au ${day}`;
}

/**
 * Lot 9 bis (ex-10.0 e, B94) — villes proposées par le catalogue, une par forme pliée (« Thiès » et « THIES » ne
 * font qu'une). Forme affichée : la plus fréquente parmi les événements donnés ; à égalité, la première dans l'ordre
 * `localeCompare('fr')` (déterministe). Liste triée par `localeCompare('fr')`. Aucune donnée réécrite.
 */
export function catalogCities(events: ReadonlyArray<Pick<CatalogEventDto, 'city'>>): string[] {
    const byKey = new Map<string, Map<string, number>>();
    for (const { city } of events) {
        const key = foldText(city);
        const forms = byKey.get(key) ?? new Map<string, number>();
        forms.set(city, (forms.get(city) ?? 0) + 1);
        byKey.set(key, forms);
    }
    const shown = Array.from(byKey.values(), (forms) => Array.from(forms.entries())
        .sort(([a, na], [b, nb]) => nb - na || a.localeCompare(b, 'fr'))[0][0]);
    return shown.sort((a, b) => a.localeCompare(b, 'fr'));
}

/** Instant ISO, ou `fallback` si la date est illisible (jamais d'exception pour une carte). */
function isoOr(d: Date, fallback: string): string {
    return Number.isNaN(d.getTime()) ? fallback : d.toISOString();
}

const MONTHS = ['JAN', 'FÉV', 'MAR', 'AVR', 'MAI', 'JUIN', 'JUIL', 'AOÛT', 'SEP', 'OCT', 'NOV', 'DÉC'];

/**
 * Carte du catalogue. Le second paramètre (ancien seuil absolu access.low_stock_threshold) n'est plus lu depuis le design
 * 1b : « Dernières places » est relatif à la jauge (stockOf). Il reste accepté pour les appelants d'autres lots.
 */
export function formatCatalogEvent(evt: CatalogRow, _ancienSeuil?: number): CatalogEventDto {
    const startDate = new Date(evt.start_date);
    const monthShort = MONTHS[startDate.getMonth()] || 'SEP';
    const dayNumber = String(startDate.getDate()).padStart(2, '0');
    const timeFormatted = evt.start_time ? evt.start_time.substring(0, 5) : '20:00';
    const dateFormatted = `${dayNumber} ${monthShort} ${startDate.getFullYear()}`;
    const endFormatted = formatEventEnd(evt);

    const now = Date.now();
    const categories = evt.ticket_categories || [];
    const buyable = categories.filter((c) => isBuyableOnline(c, now));
    const minPrice: number | null = buyable.length > 0
        ? Math.min(...buyable.map((c) => Number(c.price)))
        : null;
    const paid = buyable.map((c) => Number(c.price)).filter((p) => Number.isFinite(p) && p > 0);
    const paidFrom: number | null = paid.length > 0 ? Math.min(...paid) : null;
    const times = { start_date: evt.start_date, start_time: evt.start_time, end_date: evt.end_date, end_time: evt.end_time };

    return {
        id: evt.id,
        slug: evt.slug || evt.id,
        title: evt.title,
        subtitle: evt.partners?.commercial_name || evt.partners?.company_name || 'Event Village',
        imageUrl: evt.image_url || null,
        posterColor: posterColorOrFallback(evt.poster_color),
        dateFormatted,
        dayNumber,
        monthShort,
        timeFormatted,
        venue: evt.location || 'Dakar, Sénégal',
        category: evt.category || null,
        categoryLabel: getCategoryLabel(evt.category),
        city: (evt.city || 'DAKAR').toUpperCase(),
        price: minPrice,
        priceFormatted: minPrice === null
            ? 'Bientôt en vente'
            : minPrice === 0 ? 'Gratuit' : `${minPrice.toLocaleString('fr-FR')} F CFA`,
        onSaleSoon: minPrice === null,
        saleLabel: saleLabelOf(categories, minPrice, now),
        ...(endFormatted ? { endFormatted } : {}),
        status: evt.status,
        stock: stockOf(categories, now),
        startsAt: isoOr(eventStartAt(times), `${evt.start_date}T00:00:00.000Z`),
        endsAt: isoOr(eventEndAt(times), `${evt.start_date}T23:59:00.000Z`),
        paidFrom,
    };
}

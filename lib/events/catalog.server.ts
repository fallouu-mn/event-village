import { getCategoryLabel } from '@/lib/constants/event-categories';
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

function saleLabelOf(categories: CatalogCategoryRow[], minPrice: number | null, now: number): string {
    if (minPrice !== null) return minPrice === 0 ? 'Gratuit' : `À partir de ${minPrice.toLocaleString('fr-FR')} F CFA`;
    const active = categories.filter((c) => c.is_active === true);
    const online = active.filter((c) => c.sale_online === true);
    if (online.some((c) => remainingOf(c) > 0 && !saleStarted(c, now) && !saleEnded(c, now))) return 'Bientôt en vente';
    if (active.some((c) => c.sale_counter === true)) return 'Vente sur place uniquement';
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

const MONTHS = ['JAN', 'FÉV', 'MAR', 'AVR', 'MAI', 'JUIN', 'JUIL', 'AOÛT', 'SEP', 'OCT', 'NOV', 'DÉC'];

export function formatCatalogEvent(evt: CatalogRow): CatalogEventDto {
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

    return {
        id: evt.id,
        slug: evt.slug || evt.id,
        title: evt.title,
        subtitle: evt.partners?.commercial_name || evt.partners?.company_name || 'Event Village',
        imageUrl: evt.image_url || null,
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
    };
}

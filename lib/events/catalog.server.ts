import { getCategoryLabel } from '@/lib/constants/event-categories';

/**
 * Lot 9 (9.1, contrat 5.2) — sélection et format de carte du catalogue public, extraits de GET /api/events pour que
 * « Populaires » serve exactement la même carte. Contrat E du lot 5 : prix « à partir de » calculé sur les catégories
 * actives ET vendues en ligne ; sans catégorie achetable, aucun prix et « Bientôt en vente », jamais « Gratuit » ;
 * aucune donnée de stock, aucune catégorie masquée ni identifiant de partenaire exposé.
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
    ticket_categories(price, is_active, sale_online)
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
    ticket_categories: Array<{ price: number | string; is_active: boolean | null; sale_online: boolean | null }> | null;
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
    status: string;
}

const MONTHS = ['JAN', 'FÉV', 'MAR', 'AVR', 'MAI', 'JUIN', 'JUIL', 'AOÛT', 'SEP', 'OCT', 'NOV', 'DÉC'];

export function formatCatalogEvent(evt: CatalogRow): CatalogEventDto {
    const startDate = new Date(evt.start_date);
    const monthShort = MONTHS[startDate.getMonth()] || 'SEP';
    const dayNumber = String(startDate.getDate()).padStart(2, '0');
    const timeFormatted = evt.start_time ? evt.start_time.substring(0, 5) : '20:00';
    const dateFormatted = `${dayNumber} ${monthShort} ${startDate.getFullYear()}`;

    const buyable = (evt.ticket_categories || []).filter((c) => c.is_active === true && c.sale_online === true);
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
        status: evt.status,
    };
}

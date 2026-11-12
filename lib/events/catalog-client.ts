/**
 * Lot 5 (tâches 5.3 et 5.13) — lecture du catalogue public par le navigateur (accueil et catalogue).
 * Une seule source : GET /api/events (contrat E). Toute erreur est rendue au lieu d'être avalée :
 * l'écran l'affiche (état d'erreur avec « Réessayer », ou bandeau si une liste est déjà affichée).
 */

export interface CatalogEvent {
    id: string;
    title: string;
    /** Organisateur (nom commercial). */
    subtitle: string | null;
    imageUrl: string | null;
    dateFormatted: string;
    dayNumber: string | null;
    monthShort: string | null;
    timeFormatted: string | null;
    venue: string;
    category: string | null;
    categoryLabel: string | null;
    /** Ville en capitales (« DAKAR »), telle que le serveur la renvoie pour le filtre. */
    city: string | null;
    /** Prix « à partir de » des catégories achetables ; null : aucune catégorie achetable en ligne. */
    price: number | null;
    /** Lot 9 bis (R35, B60) : état de la vente dit par le serveur (« Vente sur place uniquement », « Complet »…). */
    saleLabel: string | null;
    /** Lot 9 ter (9t.19) : badge de stock dit par le serveur (« Complet » ou « Dernières places »), null sinon. */
    stock: 'SOLD_OUT' | 'LOW' | null;
}

export type CatalogResult = { ok: true; events: CatalogEvent[]; cities: string[] } | { ok: false; message: string };

/** Filtres du serveur (lot 9, A28). `tous`, la valeur « sans filtre » des écrans, n'est jamais envoyée. */
export interface CatalogFilters {
    q?: string;
    city?: string;
    category?: string;
}

const NO_FILTER = 'tous';

const NETWORK_MESSAGE = 'Connexion impossible : vérifiez votre réseau, puis réessayez.';

function text(value: unknown): string | null {
    return typeof value === 'string' && value.trim() !== '' ? value : null;
}

function toCatalogEvent(raw: unknown): CatalogEvent | null {
    if (typeof raw !== 'object' || raw === null) return null;
    const r = raw as Record<string, unknown>;
    const id = text(r.id);
    const title = text(r.title);
    if (!id || !title) return null;
    const price = typeof r.price === 'number' && Number.isFinite(r.price) ? r.price : null;
    return {
        id,
        title,
        subtitle: text(r.subtitle),
        imageUrl: text(r.imageUrl),
        dateFormatted: text(r.dateFormatted) ?? '',
        dayNumber: text(r.dayNumber),
        monthShort: text(r.monthShort),
        timeFormatted: text(r.timeFormatted),
        venue: text(r.venue) ?? '',
        category: text(r.category),
        categoryLabel: text(r.categoryLabel),
        city: text(r.city),
        price,
        saleLabel: text(r.saleLabel),
        stock: r.stock === 'SOLD_OUT' || r.stock === 'LOW' ? r.stock : null,
    };
}

function catalogUrl(filters: CatalogFilters): string {
    const params = new URLSearchParams();
    const q = filters.q?.trim();
    if (q) params.set('q', q);
    for (const key of ['city', 'category'] as const) {
        const value = filters[key];
        if (value && value !== NO_FILTER) params.set(key, value);
    }
    const query = params.toString();
    return query ? `/api/events?${query}` : '/api/events';
}

/** Charge le catalogue, filtré par le serveur ; `tag` identifie l'écran dans le journal de la console. */
export function readCatalog(tag: string, filters: CatalogFilters = {}): Promise<CatalogResult> {
    return readEvents(tag, catalogUrl(filters));
}

/** Charge « Populaires » (lot 9, 9.1), avec la même lecture et le même traitement d'erreur que le catalogue. */
export function readPopular(tag: string): Promise<CatalogResult> {
    return readEvents(tag, '/api/events/popular');
}

async function readEvents(tag: string, url: string): Promise<CatalogResult> {
    let res: Response;
    try {
        res = await fetch(url, { cache: 'no-store' });
    } catch (err) {
        console.error(`[${tag}] catalogue injoignable :`, err instanceof Error ? err.message : String(err));
        return { ok: false, message: NETWORK_MESSAGE };
    }
    let body: unknown = null;
    try {
        body = await res.json();
    } catch (err) {
        console.error(`[${tag}] réponse illisible du catalogue (HTTP ${res.status}) :`, err instanceof Error ? err.message : String(err));
        return { ok: false, message: `Réponse inattendue du serveur (erreur ${res.status}).` };
    }
    const payload = (typeof body === 'object' && body !== null ? body : {}) as { events?: unknown; cities?: unknown; error?: unknown };
    if (!res.ok) {
        return { ok: false, message: text(payload.error) ?? `Le catalogue n’a pas pu être chargé (erreur ${res.status}).` };
    }
    if (!Array.isArray(payload.events)) {
        console.error(`[${tag}] catalogue sans liste d’événements :`, body);
        return { ok: false, message: 'Réponse inattendue du serveur.' };
    }
    const events = payload.events.map(toCatalogEvent).filter((e): e is CatalogEvent => e !== null);
    const cities = Array.isArray(payload.cities) ? payload.cities.filter((c): c is string => text(c) !== null) : [];
    return { ok: true, events, cities };
}

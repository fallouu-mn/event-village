import { EVENT_CATEGORIES } from '@/lib/constants/event-categories';
import { foldText } from '@/lib/text/fold';

/**
 * Design 1b (point 5) — filtres du catalogue (Explorer, sections de l'accueil, GET /api/events), en fonctions pures :
 * la même règle sert au serveur (page et route) et à l'écran (mise à jour immédiate pendant que le serveur répond).
 *
 * Adresse de l'Explorer : `?q=&quand=aujourdhui|weekend|semaine&categorie=&gratuit=1&ville=&tri=prix&page=`.
 * Fuseau Africa/Dakar = UTC+0 toute l'année : les jours se découpent en UTC.
 *  - « Aujourd'hui » : de minuit à minuit, le jour même ;
 *  - « Ce week-end » : du vendredi 18:00 au lundi 00:00 (le week-end en cours du vendredi soir au dimanche, sinon le
 *    prochain) ;
 *  - « Cette semaine » : aujourd'hui et les six jours suivants (sept jours glissants, jamais vide le dimanche).
 * Un événement correspond quand il se déroule au moins en partie dans la plage (début avant la fin de la plage, fin
 * retenue après son début) : un festival commencé hier et qui finit demain est « aujourd'hui ».
 * « Gratuit » : au moins une catégorie gratuite achetable (prix « à partir de » égal à 0).
 */

export const CATALOG_WHEN = ['aujourdhui', 'weekend', 'semaine'] as const;
export type CatalogWhen = typeof CATALOG_WHEN[number];

export const CATALOG_SORTS = ['date', 'prix'] as const;
export type CatalogSort = typeof CATALOG_SORTS[number];

/** Cartes par page de l'Explorer ; « Voir plus » ajoute une page. */
export const EXPLORE_PAGE_SIZE = 12;
/** Au-delà, la page demandée est ramenée à ce plafond (une adresse forgée ne fait pas rendre des milliers de cartes). */
export const EXPLORE_MAX_PAGE = 30;
const QUERY_MAX = 120;
const CITY_MAX = 80;

export interface CatalogFilterState {
    /** Texte cherché (titre, lieu, organisateur, ville), 120 caractères au plus ; '' sans recherche. */
    q: string;
    quand: CatalogWhen | null;
    /** Identifiant de catégorie (EVENT_CATEGORIES) ou null. */
    categorie: string | null;
    gratuit: boolean;
    /** Ville telle qu'affichée par le catalogue, ou null. */
    ville: string | null;
    tri: CatalogSort;
    /** Page demandée, à partir de 1 (l'Explorer affiche les pages 1 à `page`). */
    page: number;
}

export const NO_FILTERS: CatalogFilterState = { q: '', quand: null, categorie: null, gratuit: false, ville: null, tri: 'date', page: 1 };

/** Champs lus par les filtres (sous-ensemble de la carte du catalogue). */
export interface FilterableEvent {
    title: string;
    venue: string;
    subtitle: string | null;
    city: string | null;
    category: string | null;
    price: number | null;
    startsAt: string;
    endsAt: string;
}

type RawParams = Record<string, string | string[] | undefined> | URLSearchParams;

function first(params: RawParams, key: string): string {
    const raw = params instanceof URLSearchParams ? params.get(key) : params[key];
    const value = Array.isArray(raw) ? raw[0] : raw;
    return typeof value === 'string' ? value : '';
}

const CATEGORY_IDS = new Set<string>(EVENT_CATEGORIES.map((c) => c.id));

/** Paramètres d'adresse → filtres valides (valeur inconnue : ignorée ; page bornée de 1 à EXPLORE_MAX_PAGE). */
export function parseCatalogParams(params: RawParams): CatalogFilterState {
    const quand = first(params, 'quand');
    const categorie = first(params, 'categorie').trim().toUpperCase();
    const ville = first(params, 'ville').trim().slice(0, CITY_MAX);
    const tri = first(params, 'tri');
    const page = Number.parseInt(first(params, 'page'), 10);
    return {
        q: first(params, 'q').trim().slice(0, QUERY_MAX),
        quand: (CATALOG_WHEN as readonly string[]).includes(quand) ? quand as CatalogWhen : null,
        categorie: CATEGORY_IDS.has(categorie) ? categorie : null,
        gratuit: first(params, 'gratuit') === '1',
        ville: ville.length >= 2 ? ville : null,
        tri: tri === 'prix' ? 'prix' : 'date',
        page: Number.isFinite(page) ? Math.min(EXPLORE_MAX_PAGE, Math.max(1, page)) : 1,
    };
}

/** Paramètres d'adresse des filtres, dans un ordre stable, sans les valeurs par défaut. */
export function catalogSearchParams(f: CatalogFilterState): URLSearchParams {
    const p = new URLSearchParams();
    if (f.q.trim()) p.set('q', f.q.trim());
    if (f.quand) p.set('quand', f.quand);
    if (f.categorie) p.set('categorie', f.categorie);
    if (f.gratuit) p.set('gratuit', '1');
    if (f.ville) p.set('ville', f.ville);
    if (f.tri !== 'date') p.set('tri', f.tri);
    if (f.page > 1) p.set('page', String(f.page));
    return p;
}

/** Adresse de l'Explorer pour ces filtres (`/explore` sans filtre). */
export function exploreHref(f: Partial<CatalogFilterState> = {}): string {
    const query = catalogSearchParams({ ...NO_FILTERS, ...f }).toString();
    return query ? `/explore?${query}` : '/explore';
}

/** Vrai si un filtre restreint la liste (la page et le tri ne restreignent rien). */
export function hasActiveFilters(f: CatalogFilterState): boolean {
    return Boolean(f.q.trim()) || f.quand !== null || f.categorie !== null || f.gratuit || f.ville !== null;
}

const DAY_MS = 86_400_000;

function startOfDayUtc(now: Date): number {
    return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
}

/** Plage [from, to[ d'un filtre de date, à l'heure de Dakar (UTC). */
export function whenRange(quand: CatalogWhen, now: Date): { from: Date; to: Date } {
    const today = startOfDayUtc(now);
    if (quand === 'aujourdhui') return { from: new Date(today), to: new Date(today + DAY_MS) };
    if (quand === 'semaine') return { from: new Date(today), to: new Date(today + 7 * DAY_MS) };
    // Week-end : vendredi 18:00 → lundi 00:00. getUTCDay : 0 dimanche … 6 samedi.
    const day = now.getUTCDay();
    const toFriday = day === 0 ? -2 : day === 6 ? -1 : 5 - day;
    const friday = today + toFriday * DAY_MS;
    return { from: new Date(friday + 18 * 3_600_000), to: new Date(friday + 3 * DAY_MS) };
}

/** L'événement se déroule au moins en partie dans la plage du filtre. */
export function matchesWhen(evt: Pick<FilterableEvent, 'startsAt' | 'endsAt'>, quand: CatalogWhen, now: Date): boolean {
    const { from, to } = whenRange(quand, now);
    const start = Date.parse(evt.startsAt);
    const end = Date.parse(evt.endsAt);
    if (!Number.isFinite(start) || !Number.isFinite(end)) return false;
    return start < to.getTime() && end > from.getTime();
}

/** Gratuit : au moins une catégorie gratuite achetable. */
export function isFree(evt: Pick<FilterableEvent, 'price'>): boolean {
    return evt.price === 0;
}

/** Prix croissant ; sans prix (« Bientôt en vente », « Complet ») en fin de liste ; ordre d'origine gardé à égalité. */
function byPrice<T extends Pick<FilterableEvent, 'price'>>(a: T, b: T): number {
    if (a.price === null && b.price === null) return 0;
    if (a.price === null) return 1;
    if (b.price === null) return -1;
    return a.price - b.price;
}

/**
 * Filtres du catalogue, appliqués à une liste déjà dans l'ordre du catalogue (date de début). La page n'est pas
 * appliquée ici (paginate). Recherche et ville comparées sur leur forme pliée (« thies » trouve « THIÈS »).
 */
export function applyCatalogFilters<T extends FilterableEvent>(events: readonly T[], f: CatalogFilterState, now: Date): T[] {
    const search = foldText(f.q);
    const city = f.ville ? foldText(f.ville) : '';
    const out = events.filter((e) => {
        if (search && ![e.title, e.venue, e.subtitle ?? '', e.city ?? ''].some((field) => foldText(field).includes(search))) return false;
        if (f.categorie && e.category !== f.categorie) return false;
        if (city && foldText(e.city ?? '') !== city) return false;
        if (f.gratuit && !isFree(e)) return false;
        if (f.quand && !matchesWhen(e, f.quand, now)) return false;
        return true;
    });
    return f.tri === 'prix' ? out.slice().sort(byPrice) : out;
}

/** Cartes affichées pour la page demandée (pages 1 à `page`) et suite éventuelle. */
export function paginate<T>(events: readonly T[], page: number, size = EXPLORE_PAGE_SIZE): { shown: T[]; total: number; hasMore: boolean; page: number } {
    const total = events.length;
    const lastPage = Math.max(1, Math.ceil(total / size));
    const current = Math.min(Math.max(1, Math.floor(page) || 1), lastPage, EXPLORE_MAX_PAGE);
    const shown = events.slice(0, current * size);
    return { shown, total, hasMore: shown.length < total && current < EXPLORE_MAX_PAGE, page: current };
}

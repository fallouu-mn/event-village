import { isBuyableOnline, type CatalogCategoryRow } from '@/lib/events/catalog.server';
import { eventEndAt } from '@/lib/events/event-end';
import { eventStartAt } from '@/lib/events/live-status';
import { posterBlurOrNull, posterColorOrFallback } from '@/lib/events/poster-color';
import { partnerPublicName } from '@/lib/partner/public-name';
import { applyCatalogFilters, parseCatalogParams, type CatalogFilterState } from '@/lib/events/catalog-filters';
import { SENEGAL_BOUNDS, MAP_MAX_RANGE_DAYS, MAP_RESULT_LIMIT, type MapHighlight, type MapZone, type PublicMapEvent } from '@/lib/events/map-shared';

/**
 * Lot Carte B (B0) — données publiques de la carte et du calendrier d'Explorer, en fonctions pures (sans base) : la même
 * règle sert à la route GET /api/events/carte et aux tests.
 *
 * Contrat de sortie (PublicMapEvent) : UNIQUEMENT identifiant, titre, dates (début et fin retenue), prix d'appel, couleur
 * et petite image floutée de l'affiche, type de mise en avant, position. Rien d'autre : ni la partenaire (nom, compte,
 * coordonnées), ni le lieu en clair, ni la description, ni un nombre de places. Les champs servant aux filtres (texte
 * cherché, catégorie, ville) restent dans l'entrée interne (MapEntry.f) et ne sortent jamais.
 *
 * Événements rendus : PUBLIE seulement (lecture), fin retenue à venir (un événement en cours reste), position présente et
 * au Sénégal (bornes de event_position_refusal : latitude 12,2 à 16,8, longitude -17,6 à -11,3).
 */

/** Entrée du cache : l'événement public et, à part, les seuls champs des filtres (jamais rendus). */
export interface MapEntry {
    pub: PublicMapEvent;
    f: { title: string; venue: string; subtitle: string | null; city: string | null; category: string | null };
}

/** Ligne lue en base (service_role, colonnes choisies : MAP_SELECT de map-data.server.ts). */
export interface MapRow {
    id: string;
    title: string;
    status: string;
    category: string | null;
    location: string | null;
    city: string | null;
    start_date: string;
    start_time: string | null;
    end_date: string | null;
    end_time: string | null;
    latitude: number | string | null;
    longitude: number | string | null;
    poster_color: string | null;
    poster_blur: string | null;
    partners: { commercial_name: string | null } | null;
    ticket_categories: CatalogCategoryRow[] | null;
}

/** Position lisible et au Sénégal, sinon null. */
export function positionOf(row: Pick<MapRow, 'latitude' | 'longitude'>): { lat: number; lng: number } | null {
    if (row.latitude === null || row.longitude === null || row.latitude === '' || row.longitude === '') return null;
    const lat = Number(row.latitude);
    const lng = Number(row.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    const b = SENEGAL_BOUNDS;
    if (lat < b.south || lat > b.north || lng < b.west || lng > b.east) return null;
    return { lat, lng };
}

/**
 * Ligne → entrée du cache, ou null si elle ne doit jamais être rendue (statut autre que PUBLIE, position absente ou hors
 * du Sénégal, dates illisibles, fin passée à `now`).
 */
export function toMapEntry(row: MapRow, highlight: MapHighlight | null, now: number): MapEntry | null {
    if (row.status !== 'PUBLIE') return null;
    const pos = positionOf(row);
    if (!pos) return null;
    const times = { start_date: row.start_date, start_time: row.start_time, end_date: row.end_date, end_time: row.end_time };
    const start = eventStartAt(times);
    const end = eventEndAt(times);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end.getTime() <= now) return null;
    const buyable = (row.ticket_categories ?? []).filter((c) => isBuyableOnline(c, now)).map((c) => Number(c.price)).filter(Number.isFinite);
    return {
        pub: {
            id: row.id,
            title: row.title,
            startsAt: start.toISOString(),
            endsAt: end.toISOString(),
            price: buyable.length > 0 ? Math.min(...buyable) : null,
            color: posterColorOrFallback(row.poster_color),
            blur: posterBlurOrNull(row.poster_blur),
            highlight,
            lat: pos.lat,
            lng: pos.lng,
        },
        f: {
            title: row.title,
            venue: row.location || 'Dakar, Sénégal',
            subtitle: partnerPublicName(row.partners),
            city: (row.city || 'DAKAR').toUpperCase(),
            category: row.category || null,
        },
    };
}

export type { MapZone } from '@/lib/events/map-shared';

export interface MapQuery {
    /** Zone demandée, ramenée aux bornes du Sénégal (tout le Sénégal sans zone). */
    zone: MapZone;
    /** Plage de dates [from, to[ (calendrier), ou null. */
    range: { from: number; to: number } | null;
    filters: CatalogFilterState;
}

export type MapQueryResult = { ok: true; query: MapQuery } | { ok: false; message: string };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const NUM_RE = /^-?\d{1,3}(\.\d{1,8})?$/;

function dayStart(value: string): number | null {
    if (!DATE_RE.test(value)) return null;
    const t = Date.parse(`${value}T00:00:00.000Z`);
    return Number.isFinite(t) && new Date(t).toISOString().slice(0, 10) === value ? t : null;
}

/**
 * Paramètres de la route : `zone=<sud>,<ouest>,<nord>,<est>` (degrés décimaux), `du=AAAA-MM-JJ&au=AAAA-MM-JJ` (au exclu,
 * 93 jours au plus), et les filtres de l'Explorer (q, quand, categorie, gratuit, ville ; même lecture que la page).
 */
export function parseMapQuery(params: URLSearchParams): MapQueryResult {
    let zone: MapZone = { ...SENEGAL_BOUNDS };
    const rawZone = params.get('zone');
    if (rawZone !== null) {
        const parts = rawZone.split(',');
        if (parts.length !== 4 || !parts.every((p) => NUM_RE.test(p.trim()))) return { ok: false, message: 'Zone illisible.' };
        const [south, west, north, east] = parts.map((p) => Number(p.trim()));
        if (!(south < north) || !(west < east) || Math.abs(south) > 90 || Math.abs(north) > 90 || Math.abs(west) > 180 || Math.abs(east) > 180) {
            return { ok: false, message: 'Zone illisible.' };
        }
        const b = SENEGAL_BOUNDS;
        zone = { south: Math.max(south, b.south), west: Math.max(west, b.west), north: Math.min(north, b.north), east: Math.min(east, b.east) };
    }
    let range: MapQuery['range'] = null;
    const du = params.get('du');
    const au = params.get('au');
    if (du !== null || au !== null) {
        const from = du === null ? null : dayStart(du);
        const to = au === null ? null : dayStart(au);
        if (from === null || to === null || to <= from || to - from > MAP_MAX_RANGE_DAYS * 86_400_000) {
            return { ok: false, message: 'Période illisible.' };
        }
        range = { from, to };
    }
    return { ok: true, query: { zone, range, filters: { ...parseCatalogParams(params), tri: 'date', page: 1 } } };
}

function inZone(e: PublicMapEvent, z: MapZone): boolean {
    return e.lat >= z.south && e.lat <= z.north && e.lng >= z.west && e.lng <= z.east;
}

/**
 * Entrées du cache → réponse : encore à venir à `now`, dans la zone, dans la plage (au moins en partie), filtres de
 * l'Explorer ; ordre du cache (date de début) ; MAP_RESULT_LIMIT au plus. Ne rend que les champs publics.
 */
export function selectMapEvents(entries: readonly MapEntry[], q: MapQuery, now: Date): { events: PublicMapEvent[]; total: number; truncated: boolean } {
    const t = now.getTime();
    const candidates = entries.filter((e) => {
        if (Date.parse(e.pub.endsAt) <= t || !inZone(e.pub, q.zone)) return false;
        if (q.range && !(Date.parse(e.pub.startsAt) < q.range.to && Date.parse(e.pub.endsAt) > q.range.from)) return false;
        return true;
    });
    const filterable = candidates.map((e) => ({ ...e.f, price: e.pub.price, startsAt: e.pub.startsAt, endsAt: e.pub.endsAt, entry: e }));
    const kept = applyCatalogFilters(filterable, q.filters, now).map((x) => x.entry);
    const events = kept.slice(0, MAP_RESULT_LIMIT).map(({ pub }) => publicOnly(pub));
    return { events, total: kept.length, truncated: kept.length > MAP_RESULT_LIMIT };
}

/** Copie champ par champ (PUBLIC_MAP_FIELDS) : rien d'autre ne peut sortir, même si l'entrée en portait davantage. */
export function publicOnly(e: PublicMapEvent): PublicMapEvent {
    return {
        id: e.id, title: e.title, startsAt: e.startsAt, endsAt: e.endsAt, price: e.price, color: e.color,
        blur: e.blur, highlight: e.highlight, lat: e.lat, lng: e.lng,
    };
}

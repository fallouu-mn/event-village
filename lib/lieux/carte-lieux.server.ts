import { unstable_cache } from 'next/cache';
import { PUBLIC_REVALIDATE_SECONDS } from '@/lib/events/catalog-cache.server';
import { getServiceRoleClient } from '@/lib/supabase/server';
import { searchHalls } from '@/lib/halls/queries';
import { searchVenues } from '@/lib/tables/queries';
import { POSITION_COLUMNS, publicPosition } from '@/lib/lieux/position-publique';
import { PLACE_PHOTOS_MAX, PLACES_RESULT_LIMIT, type OpeningRange, type PlacesQuery, type PublicMapPlace } from '@/lib/lieux/carte-lieux';
import { PLACES_CACHE_TAG } from '@/lib/lieux/cache-lieux.server';

/**
 * Lot Carte B3 — lecture publique des salles et des établissements pour la carte d'Explorer, en lecture seule.
 *
 *  - Lecture service_role des seules colonnes utiles, conditions de visibilité PAR LA REQUÊTE : lieu actif, validé par
 *    l'administration, partenaire VALIDE, position présente ; salle avec un prix par jour (comme la recherche) ;
 *  - position publique décidée ICI, avant le cache : point exact d'un lieu professionnel, centre de la zone de 300 m d'un
 *    particulier (lib/lieux/position-publique.ts) ; le vrai point d'un particulier n'entre ni dans le cache ni dans la
 *    réponse ; aucune adresse lue ;
 *  - cache de 60 s sous l'étiquette `lieux-publics`, vidé aussitôt par invalidatePublicPlaces (validation, refus,
 *    suspension, réactivation, retrait, modification de la fiche, statut de la partenaire) : rien de retiré ne reste
 *    affiché. Une panne n'est pas gardée (unstable_cache ne garde pas une exception).
 */

type Row = Record<string, unknown>;

const HALL_SELECT = `id, name, city, capacity, price_per_day, images, ${POSITION_COLUMNS}, partners!inner(status)`;
const VENUE_SELECT = `id, name, city, deposit_per_person, photos, ${POSITION_COLUMNS}, partners!inner(status), `
    + 'venue_opening_hours(weekday, opens_at, closes_at), restaurant_tables(capacity, is_active)';

const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.trim().length > 0) : []);
const text = (v: unknown): string | null => (typeof v === 'string' && v.trim().length > 0 ? v.trim() : null);
const clock = (v: unknown): string => {
    const s = String(v ?? '');
    return s.startsWith('24:00') ? '24:00' : s.slice(0, 5);
};

function hallEntry(h: Row): PublicMapPlace | null {
    const pos = publicPosition(h);
    const price = Number(h.price_per_day);
    if (!pos || !Number.isFinite(price) || price < 1) return null;
    return {
        id: String(h.id), type: 'salle', name: String(h.name), area: text(h.city), photos: strings(h.images).slice(0, PLACE_PHOTOS_MAX),
        price, capacity: Number.isFinite(Number(h.capacity)) ? Number(h.capacity) : null,
        lat: pos.lat, lng: pos.lng, exact: pos.exact, hours: null,
    };
}

function venueEntry(v: Row): PublicMapPlace | null {
    const pos = publicPosition(v);
    if (!pos) return null;
    const deposit = v.deposit_per_person === null || v.deposit_per_person === undefined ? null : Number(v.deposit_per_person);
    const tables = (Array.isArray(v.restaurant_tables) ? v.restaurant_tables : []) as Row[];
    const seats = tables.filter((t) => t.is_active === true).reduce((n, t) => n + (Number(t.capacity) || 0), 0);
    const hours = ((Array.isArray(v.venue_opening_hours) ? v.venue_opening_hours : []) as Row[])
        .map((r): OpeningRange => [Number(r.weekday), clock(r.opens_at), clock(r.closes_at)])
        .filter(([d]) => d >= 1 && d <= 7)
        .sort((a, b) => a[0] - b[0] || a[1].localeCompare(b[1]));
    return {
        id: String(v.id), type: 'restaurant', name: String(v.name), area: text(v.city), photos: strings(v.photos).slice(0, PLACE_PHOTOS_MAX),
        price: deposit !== null && Number.isFinite(deposit) && deposit > 0 ? deposit : null, capacity: seats > 0 ? seats : null,
        lat: pos.lat, lng: pos.lng, exact: pos.exact, hours,
    };
}

/** Lieux publics (salles puis établissements, les plus récents d'abord). Lève en cas de panne (jamais une carte vide). */
export async function readPlaceEntries(): Promise<PublicMapPlace[]> {
    const supabase = getServiceRoleClient();
    const [halls, venues] = await Promise.all([
        supabase.from('halls').select(HALL_SELECT)
            .eq('is_active', true).eq('validation_status', 'VALIDEE').eq('partners.status', 'VALIDE')
            .not('latitude', 'is', null).not('longitude', 'is', null).gte('price_per_day', 1)
            .order('created_at', { ascending: false }).order('id', { ascending: true }),
        supabase.from('venues').select(VENUE_SELECT)
            .eq('is_active', true).eq('validation_status', 'VALIDEE').eq('partners.status', 'VALIDE')
            .not('latitude', 'is', null).not('longitude', 'is', null)
            .order('created_at', { ascending: false }).order('id', { ascending: true }),
    ]);
    if (halls.error) throw new Error(`salles de la carte illisibles : ${halls.error.code ?? ''} ${halls.error.message}`);
    if (venues.error) throw new Error(`établissements de la carte illisibles : ${venues.error.code ?? ''} ${venues.error.message}`);
    const out: PublicMapPlace[] = [];
    for (const h of (halls.data ?? []) as unknown as Row[]) {
        const e = hallEntry(h);
        if (e) out.push(e);
    }
    for (const v of (venues.data ?? []) as unknown as Row[]) {
        const e = venueEntry(v);
        if (e) out.push(e);
    }
    return out;
}

const cachedRead = unstable_cache(readPlaceEntries, ['lieux-publics', 'v1'], { revalidate: PUBLIC_REVALIDATE_SECONDS, tags: [PLACES_CACHE_TAG] });

/** Lieux de la carte sous cache (60 s, étiquette `lieux-publics`). */
export async function cachedPlaceEntries(): Promise<PublicMapPlace[]> {
    return cachedRead();
}

/** Pages de la recherche lues au plus pour une disponibilité (48 lieux par page : PLACES_RESULT_LIMIT couvert). */
const SEARCH_PAGE = 48;
const SEARCH_PAGES_MAX = Math.ceil(PLACES_RESULT_LIMIT / SEARCH_PAGE) + 1;

/**
 * Identifiants des lieux disponibles pour les filtres de la couche (date et nombre d'invités d'une salle ; date, heure et
 * nombre de personnes d'un restaurant), par la recherche publique des lots 10b et 11b (mêmes règles que les pages
 * /halls et /tables). Pas de cache : la disponibilité change à chaque réservation.
 */
export async function availablePlaceIds(q: PlacesQuery): Promise<Set<string>> {
    const ids = new Set<string>();
    for (let page = 0; page < SEARCH_PAGES_MAX; page += 1) {
        const offset = page * SEARCH_PAGE;
        if (q.layer === 'salles') {
            const r = await searchHalls({ date: q.halls.date, days: q.halls.days, capacity: q.halls.guests, limit: SEARCH_PAGE, offset });
            for (const h of r.halls) ids.add(h.id);
            if (offset + SEARCH_PAGE >= r.total) break;
        } else {
            const r = await searchVenues({
                date: q.venues.date, time: q.venues.time, guests: q.venues.guests, available: q.venues.date !== null, limit: SEARCH_PAGE, offset,
            });
            for (const v of r.venues) ids.add(v.id);
            if (offset + SEARCH_PAGE >= r.total) break;
        }
    }
    return ids;
}

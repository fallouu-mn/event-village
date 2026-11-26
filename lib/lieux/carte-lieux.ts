/**
 * Lot Carte B3 — salles et établissements sur la carte d'Explorer : contrat public, lecture des paramètres et sélection,
 * en fonctions pures (sans base, sans dépendance : importable par le serveur, les tests et la carte).
 *
 * Contrat de sortie (PublicMapPlace) : UNIQUEMENT identifiant, type (salle ou restaurant), nom, ville ou quartier,
 * photos (4 au plus, la première sert de vignette), prix d'appel (salle : par jour ; restaurant : acompte par personne,
 * null = réservation gratuite), capacité, position exacte, horaires (restaurants). Rien de la partenaire (ni nom, ni
 * téléphone, ni adresse électronique). Décision du client du 25/11 : application entièrement publique, chaque lieu à sa
 * position exacte (l'adresse est sur la fiche, pas dans cette lecture : la carte n'en a pas besoin).
 */

export type PlaceLayer = 'salles' | 'restaurants';
export type PlaceType = 'salle' | 'restaurant';

export const PLACE_LAYERS: readonly PlaceLayer[] = ['salles', 'restaurants'];

/** Nombre maximal de lieux rendus par une lecture (une adresse forgée ne fait pas rendre tout le catalogue). */
export const PLACES_RESULT_LIMIT = 300;

/** Photos rendues par lieu (feuille du téléphone). */
export const PLACE_PHOTOS_MAX = 4;

/** Plage d'ouverture d'un restaurant : jour ISO (1 = lundi … 7 = dimanche), ouverture, fermeture (« 24:00 » possible). */
export type OpeningRange = [number, string, string];

export interface PublicMapPlace {
    id: string;
    type: PlaceType;
    name: string;
    /** Ville ou quartier saisi par la partenaire. */
    area: string | null;
    /** Photos (adresses publiques des photos de la fiche), 4 au plus. */
    photos: string[];
    /** Salle : prix par jour (F CFA) ; restaurant : acompte par personne, null = réservation gratuite. */
    price: number | null;
    /** Salle : invités au plus ; restaurant : places assises (tables actives), null si inconnu. */
    capacity: number | null;
    lat: number;
    lng: number;
    /** Restaurants : horaires d'ouverture ; salles : null. */
    hours: OpeningRange[] | null;
    /**
     * Lot 12b : l'établissement prend des commandes en ligne (vente ouverte par la partenaire, service des commandes
     * ouvert) : lien « Commander » vers sa carte des plats. Salles : toujours faux. Absent : faux.
     */
    orders?: boolean;
}

/** Liste exhaustive des champs rendus (contrôlée par les tests : aucun champ en trop). */
export const PUBLIC_PLACE_FIELDS = ['id', 'type', 'name', 'area', 'photos', 'price', 'capacity', 'lat', 'lng', 'hours', 'orders'] as const;

export interface PlacesResponse {
    places: PublicMapPlace[];
    total: number;
    truncated: boolean;
}

/** Copie champ par champ (PUBLIC_PLACE_FIELDS) : rien d'autre ne peut sortir, même si l'entrée en portait davantage. */
export function publicPlaceOnly(p: PublicMapPlace): PublicMapPlace {
    return {
        id: p.id, type: p.type, name: p.name, area: p.area, photos: p.photos.slice(0, PLACE_PHOTOS_MAX), price: p.price,
        capacity: p.capacity, lat: p.lat, lng: p.lng, hours: p.hours ? p.hours.map(([d, o, c]) => [d, o, c]) : null,
        orders: p.type === 'restaurant' && p.orders === true,
    };
}

// ── Paramètres ─────────────────────────────────────────────────────────────────────────────────────────

/** Bornes du Sénégal (mêmes que lib/events/map-shared.ts et les contraintes de position des lieux). */
const BOUNDS = { south: 12.2, west: -17.6, north: 16.8, east: -11.3 } as const;

export interface PlaceZone { south: number; west: number; north: number; east: number }

export interface HallFilters { date: string | null; days: number; guests: number | null }
export interface VenueFilters { date: string | null; time: string | null; guests: number | null }

export interface PlacesQuery {
    layer: PlaceLayer;
    zone: PlaceZone;
    halls: HallFilters;
    venues: VenueFilters;
}

export type PlacesQueryResult = { ok: true; query: PlacesQuery } | { ok: false; message: string };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):(00|15|30|45)$/;
const NUM_RE = /^-?\d{1,3}(\.\d{1,8})?$/;
const INT_RE = /^\d{1,6}$/;

function validDate(v: string): boolean {
    if (!DATE_RE.test(v)) return false;
    const t = Date.parse(`${v}T00:00:00.000Z`);
    return Number.isFinite(t) && new Date(t).toISOString().slice(0, 10) === v;
}

function intIn(raw: string | null, min: number, max: number): number | null | 'bad' {
    if (raw === null || raw === '') return null;
    if (!INT_RE.test(raw)) return 'bad';
    const n = Number(raw);
    return n >= min && n <= max ? n : 'bad';
}

/**
 * Paramètres de GET /api/lieux/carte : `couche=salles|restaurants` (obligatoire), `zone=<sud>,<ouest>,<nord>,<est>`
 * (ramenée aux bornes du Sénégal ; sans zone : tout le Sénégal). Salles : `date=AAAA-MM-JJ`, `jours` (1 à 30),
 * `invites` (1 à 100 000). Restaurants : `date`, `heure=HH:MM` (au quart d'heure), `personnes` (1 à 50).
 */
export function parsePlacesQuery(params: URLSearchParams): PlacesQueryResult {
    const layer = params.get('couche');
    if (layer !== 'salles' && layer !== 'restaurants') return { ok: false, message: 'Choisissez les salles ou les restaurants.' };
    let zone: PlaceZone = { ...BOUNDS };
    const rawZone = params.get('zone');
    if (rawZone !== null) {
        const parts = rawZone.split(',');
        if (parts.length !== 4 || !parts.every((p) => NUM_RE.test(p.trim()))) return { ok: false, message: 'Zone illisible.' };
        const [south, west, north, east] = parts.map((p) => Number(p.trim()));
        if (!(south < north) || !(west < east) || Math.abs(south) > 90 || Math.abs(north) > 90 || Math.abs(west) > 180 || Math.abs(east) > 180) {
            return { ok: false, message: 'Zone illisible.' };
        }
        zone = { south: Math.max(south, BOUNDS.south), west: Math.max(west, BOUNDS.west), north: Math.min(north, BOUNDS.north), east: Math.min(east, BOUNDS.east) };
    }
    const date = params.get('date') || null;
    if (date !== null && !validDate(date)) return { ok: false, message: 'Date illisible.' };
    const days = intIn(params.get('jours'), 1, 30);
    const invites = intIn(params.get('invites'), 1, 100_000);
    const personnes = intIn(params.get('personnes'), 1, 50);
    if (days === 'bad') return { ok: false, message: 'La durée va de 1 à 30 jours.' };
    if (invites === 'bad') return { ok: false, message: 'Indiquez un nombre d’invités entre 1 et 100 000.' };
    if (personnes === 'bad') return { ok: false, message: 'Indiquez un nombre de personnes entre 1 et 50.' };
    const time = params.get('heure') || null;
    if (time !== null && !TIME_RE.test(time)) return { ok: false, message: 'Choisissez une heure au quart d’heure près.' };
    return {
        ok: true,
        query: {
            layer,
            zone,
            halls: { date, days: days ?? 1, guests: invites },
            venues: { date, time, guests: personnes },
        },
    };
}

/** Vrai si la lecture demande une disponibilité (recherche des salles ou des établissements nécessaire). */
export function needsAvailability(q: PlacesQuery): boolean {
    return q.layer === 'salles' ? q.halls.date !== null : q.venues.date !== null || q.venues.guests !== null;
}

function inZone(p: PublicMapPlace, z: PlaceZone): boolean {
    return p.lat >= z.south && p.lat <= z.north && p.lng >= z.west && p.lng <= z.east;
}

/**
 * Lieux du cache → réponse : type de la couche, dans la zone, capacité suffisante (salles), disponibles si une liste
 * d'identifiants disponibles est donnée ; ordre du cache ; PLACES_RESULT_LIMIT au plus. Ne rend que les champs publics.
 */
export function selectPlaces(entries: readonly PublicMapPlace[], q: PlacesQuery, available: ReadonlySet<string> | null): PlacesResponse {
    const type: PlaceType = q.layer === 'salles' ? 'salle' : 'restaurant';
    const kept = entries.filter((p) => {
        if (p.type !== type || !inZone(p, q.zone)) return false;
        if (type === 'salle' && q.halls.guests !== null && (p.capacity === null || p.capacity < q.halls.guests)) return false;
        if (available && !available.has(p.id)) return false;
        return true;
    });
    return { places: kept.slice(0, PLACES_RESULT_LIMIT).map(publicPlaceOnly), total: kept.length, truncated: kept.length > PLACES_RESULT_LIMIT };
}

// ── Affichage (navigateur) ────────────────────────────────────────────────────────────────────────────

/** « Dès 150 000 F/jour », « Acompte 2 000 F », « Réservation gratuite ». */
export function placePriceBadge(p: Pick<PublicMapPlace, 'type' | 'price'>): string {
    const f = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} F`;
    if (p.type === 'salle') return p.price !== null ? `Dès ${f(p.price)}/jour` : 'Salle';
    return p.price !== null ? `Acompte ${f(p.price)}` : 'Réservation gratuite';
}

/** Nom accessible complet : « Salle Teranga, jusqu'à 300 personnes, dès 150 000 F par jour ». */
export function placeAccessibleName(p: Pick<PublicMapPlace, 'type' | 'name' | 'capacity' | 'price'>): string {
    const f = (n: number) => `${Math.round(n).toLocaleString('fr-FR')} F`;
    const parts: string[] = [p.name];
    if (p.type === 'salle') {
        if (p.capacity !== null) parts.push(`jusqu’à ${p.capacity.toLocaleString('fr-FR')} personnes`);
        if (p.price !== null) parts.push(`dès ${f(p.price)} par jour`);
    } else {
        parts.push(p.price !== null ? `acompte de ${f(p.price)} par personne` : 'réservation gratuite');
    }
    return parts.join(', ');
}

/** Minutes depuis lundi 00:00 (Dakar = UTC). */
function weekMinute(d: Date): number {
    const day = (d.getUTCDay() + 6) % 7; // lundi = 0
    return day * 1440 + d.getUTCHours() * 60 + d.getUTCMinutes();
}

function clockMinutes(hhmm: string): number {
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + m;
}

/**
 * Plages de la semaine en minutes depuis lundi 00:00 (une fermeture avant l'ouverture finit le lendemain), recopiées la
 * semaine d'avant et celle d'après, puis réunies quand elles se touchent : une plage qui passe minuit ou dimanche soir
 * reste d'un seul tenant.
 */
function mergedRanges(hours: readonly OpeningRange[]): Array<[number, number]> {
    const week = 7 * 1440;
    const base: Array<[number, number]> = [];
    for (const [day, opens, closes] of hours) {
        const start = (day - 1) * 1440 + clockMinutes(opens);
        let end = (day - 1) * 1440 + clockMinutes(closes);
        if (end <= start) end += 1440;
        for (const shift of [-week, 0, week]) base.push([start + shift, end + shift]);
    }
    base.sort((a, b) => a[0] - b[0]);
    const out: Array<[number, number]> = [];
    for (const r of base) {
        const last = out[out.length - 1];
        if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
        else out.push([r[0], r[1]]);
    }
    return out;
}

function hourText(minuteOfDay: number): string {
    const m = ((minuteOfDay % 1440) + 1440) % 1440;
    const h = Math.floor(m / 60);
    const mm = m % 60;
    return mm === 0 ? `${h} h` : `${h} h ${String(mm).padStart(2, '0')}`;
}

/**
 * « Ouvert maintenant · ferme à 23 h », « Ouvre à 19 h », « Fermé aujourd'hui » (horaires du lot 11b, heure de Dakar),
 * ou null sans horaires. Les plages qui se suivent sont réunies (ouvert 24 h sur 24 : « Ouvert maintenant »).
 */
export function openingState(hours: readonly OpeningRange[] | null, now: Date): { open: boolean; text: string } | null {
    if (!hours || hours.length === 0) return null;
    const t = weekMinute(now);
    const ranges = mergedRanges(hours);
    const current = ranges.find(([s, e]) => t >= s && t < e);
    if (current) {
        if (current[1] - t >= 6 * 1440) return { open: true, text: 'Ouvert maintenant' };
        return { open: true, text: `Ouvert maintenant · ferme à ${hourText(current[1])}` };
    }
    const dayEnd = (Math.floor(t / 1440) + 1) * 1440;
    const later = ranges.find(([s]) => s > t && s < dayEnd);
    if (later) return { open: false, text: `Fermé · ouvre à ${hourText(later[0])}` };
    return { open: false, text: 'Fermé pour aujourd’hui' };
}

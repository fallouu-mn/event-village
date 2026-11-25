/**
 * Lot Carte B — constantes et types de la carte et du calendrier d'Explorer partagés par le serveur et le navigateur
 * (aucune dépendance : importable par un îlot client sans rien alourdir).
 */

/** Bornes du Sénégal (mêmes que public.event_position_refusal, 20261116000003). */
export const SENEGAL_BOUNDS = { south: 12.2, west: -17.6, north: 16.8, east: -11.3 } as const;

/** Nombre maximal d'événements rendus par une lecture (une adresse forgée ne fait pas rendre tout le catalogue). */
export const MAP_RESULT_LIMIT = 300;

/** Plage de dates la plus longue d'une lecture du calendrier (jours). */
export const MAP_MAX_RANGE_DAYS = 93;

export type MapHighlight = 'A_LA_UNE' | 'SPONSORISE';

/** Zone de la carte (degrés décimaux). */
export interface MapZone { south: number; west: number; north: number; east: number }

/** Événement tel que GET /api/events/carte le rend : ces champs et aucun autre. */
export interface PublicMapEvent {
    id: string;
    title: string;
    /** Début (date et heure saisies, Dakar = UTC), instant ISO. */
    startsAt: string;
    /** Fin retenue (même règle que public.event_end_at), instant ISO. */
    endsAt: string;
    /** Prix d'appel : plus petit prix des catégories achetables en ligne ; 0 = gratuit ; null = rien d'achetable. */
    price: number | null;
    /** Couleur de l'affiche (contraste ≥ 4,5:1 avec le blanc, « bleu nuit » à défaut). */
    color: string;
    /** Petite image floutée de l'affiche (data:image/webp, 3 000 caractères au plus), ou null. */
    blur: string | null;
    /** Mise en avant (« À la une »), ou null. */
    highlight: MapHighlight | null;
    lat: number;
    lng: number;
}

/** Liste exhaustive des champs rendus (contrôlée par les tests : aucun champ en trop). */
export const PUBLIC_MAP_FIELDS = ['id', 'title', 'startsAt', 'endsAt', 'price', 'color', 'blur', 'highlight', 'lat', 'lng'] as const;

/** Réponse de GET /api/events/carte. */
export interface MapResponse {
    events: PublicMapEvent[];
    /** Nombre d'événements qui correspondent (au-delà de la limite, `truncated`). */
    total: number;
    truncated: boolean;
}

/** Texte de la pastille de prix : « Gratuit », « Dès 5 000 F », ou null (rien d'achetable : repère sans prix). */
export function priceBadge(price: number | null): string | null {
    if (price === null) return null;
    if (price === 0) return 'Gratuit';
    return `Dès ${Math.round(price).toLocaleString('fr-FR')} F`;
}

/**
 * Choix rapide de ville ou de quartier (décision du client du 21/11 : pas de recherche d'adresse publique). Centre et
 * niveau de zoom ; positions publiques des lieux (aucune donnée d'utilisateur).
 */
export interface QuickPlace { id: string; label: string; lat: number; lng: number; zoom: number }

export const QUICK_PLACES: readonly QuickPlace[] = [
    { id: 'senegal', label: 'Tout le Sénégal', lat: 14.45, lng: -14.45, zoom: 7 },
    { id: 'dakar', label: 'Dakar', lat: 14.7167, lng: -17.4677, zoom: 12 },
    { id: 'almadies', label: 'Almadies', lat: 14.7447, lng: -17.5106, zoom: 14 },
    { id: 'plateau', label: 'Plateau', lat: 14.6681, lng: -17.4357, zoom: 14 },
    { id: 'ngor', label: 'Ngor', lat: 14.7484, lng: -17.5146, zoom: 14 },
    { id: 'ouakam', label: 'Ouakam', lat: 14.7243, lng: -17.4893, zoom: 14 },
    { id: 'mermoz', label: 'Mermoz', lat: 14.7069, lng: -17.4752, zoom: 14 },
    { id: 'sacre-coeur', label: 'Sacré-Cœur', lat: 14.7213, lng: -17.4659, zoom: 14 },
    { id: 'saly', label: 'Saly', lat: 14.4473, lng: -17.0113, zoom: 13 },
    { id: 'mbour', label: 'Mbour', lat: 14.4198, lng: -16.9634, zoom: 13 },
    { id: 'thies', label: 'Thiès', lat: 14.791, lng: -16.9359, zoom: 13 },
    { id: 'saint-louis', label: 'Saint-Louis', lat: 16.0179, lng: -16.4896, zoom: 13 },
    { id: 'kaolack', label: 'Kaolack', lat: 14.1652, lng: -16.0758, zoom: 13 },
    { id: 'ziguinchor', label: 'Ziguinchor', lat: 12.5681, lng: -16.2733, zoom: 13 },
];

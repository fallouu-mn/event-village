/**
 * Lot 9 ter (consigne 0.8, R96 ; décisions D-R96-1, B-D17, B-D18) — villes d'un événement.
 *
 * Liste fermée de 26 villes : les 14 chefs-lieux de région et 12 communes et lieux d'événements, en forme accentuée,
 * triée en français. Le formulaire propose la liste puis « Autre ville » (saisie libre de 2 à 80 caractères, gardée
 * telle quelle). Une ville de la liste saisie sans accents ou dans une autre casse (« THIES ») est ramenée à sa forme
 * de la liste (« Thiès ») ; la comparaison passe par foldText (lib/text/fold.ts), comme la recherche. Aucune donnée
 * existante n'est réécrite. Sans dépendance serveur : importable côté client.
 */
import { foldText } from '@/lib/text/fold';

export const SENEGAL_CITIES: readonly string[] = [
    'Cap Skirring',
    'Dakar',
    'Diamniadio',
    'Diourbel',
    'Fatick',
    'Guédiawaye',
    'Joal-Fadiouth',
    'Kaffrine',
    'Kaolack',
    'Kédougou',
    'Kolda',
    'Louga',
    'Matam',
    'Mbacké',
    'Mbour',
    'Pikine',
    'Richard-Toll',
    'Rufisque',
    'Saint-Louis',
    'Saly',
    'Sédhiou',
    'Tambacounda',
    'Thiès',
    'Tivaouane',
    'Touba',
    'Ziguinchor',
];

/** Valeur de l'option « Autre ville » du formulaire. */
export const OTHER_CITY_VALUE = 'AUTRE';

const BY_FOLDED = new Map(SENEGAL_CITIES.map((c) => [foldText(c), c] as const));

/** Forme de la liste d'une ville saisie (même forme une fois pliée), ou null si la ville n'est pas dans la liste. */
export function senegalCity(input: string | null | undefined): string | null {
    if (typeof input !== 'string') return null;
    return BY_FOLDED.get(foldText(input)) ?? null;
}

/** Ville à enregistrer : forme de la liste si elle y figure, sinon la saisie sans espaces autour. */
export function canonicalCity(input: string): string {
    return senegalCity(input) ?? input.trim();
}

/**
 * Finition 2a (3) — position d'un lieu : bornes du Sénégal (rectangle, mêmes valeurs que public.event_position_refusal),
 * centre fixe de chaque ville de la liste (la carte s'y place tant qu'aucun repère n'est choisi) et vue du pays entier
 * pour une ville hors liste.
 */
export const SENEGAL_BOUNDS = { minLatitude: 12.2, maxLatitude: 16.8, minLongitude: -17.6, maxLongitude: -11.3 } as const;

export interface GeoPoint {
    latitude: number;
    longitude: number;
}

export function inSenegal(latitude: number, longitude: number): boolean {
    return Number.isFinite(latitude) && Number.isFinite(longitude)
        && latitude >= SENEGAL_BOUNDS.minLatitude && latitude <= SENEGAL_BOUNDS.maxLatitude
        && longitude >= SENEGAL_BOUNDS.minLongitude && longitude <= SENEGAL_BOUNDS.maxLongitude;
}

/** Vue du pays entier (aucune ville de la liste choisie). */
export const SENEGAL_VIEW = { center: { latitude: 14.45, longitude: -14.45 }, zoom: 6 } as const;

export const SENEGAL_CITY_CENTERS: Readonly<Record<string, GeoPoint>> = {
    'Cap Skirring': { latitude: 12.39, longitude: -16.75 },
    'Dakar': { latitude: 14.6928, longitude: -17.4467 },
    'Diamniadio': { latitude: 14.72, longitude: -17.18 },
    'Diourbel': { latitude: 14.655, longitude: -16.231 },
    'Fatick': { latitude: 14.339, longitude: -16.416 },
    'Guédiawaye': { latitude: 14.776, longitude: -17.396 },
    'Joal-Fadiouth': { latitude: 14.166, longitude: -16.833 },
    'Kaffrine': { latitude: 14.106, longitude: -15.55 },
    'Kaolack': { latitude: 14.146, longitude: -16.073 },
    'Kédougou': { latitude: 12.556, longitude: -12.18 },
    'Kolda': { latitude: 12.893, longitude: -14.941 },
    'Louga': { latitude: 15.619, longitude: -16.224 },
    'Matam': { latitude: 15.656, longitude: -13.255 },
    'Mbacké': { latitude: 14.791, longitude: -15.908 },
    'Mbour': { latitude: 14.416, longitude: -16.966 },
    'Pikine': { latitude: 14.755, longitude: -17.391 },
    'Richard-Toll': { latitude: 16.462, longitude: -15.7 },
    'Rufisque': { latitude: 14.716, longitude: -17.273 },
    'Saint-Louis': { latitude: 16.018, longitude: -16.489 },
    'Saly': { latitude: 14.446, longitude: -17.008 },
    'Sédhiou': { latitude: 12.708, longitude: -15.557 },
    'Tambacounda': { latitude: 13.77, longitude: -13.667 },
    'Thiès': { latitude: 14.791, longitude: -16.926 },
    'Tivaouane': { latitude: 14.95, longitude: -16.817 },
    'Touba': { latitude: 14.866, longitude: -15.875 },
    'Ziguinchor': { latitude: 12.583, longitude: -16.272 },
};

/** Centre fixe de la ville choisie (forme de la liste ou saisie équivalente), ou null pour une ville hors liste. */
export function cityCenter(city: string | null | undefined): GeoPoint | null {
    const known = senegalCity(city);
    return known ? SENEGAL_CITY_CENTERS[known] ?? null : null;
}

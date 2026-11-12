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

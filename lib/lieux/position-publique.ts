/**
 * Lot Carte B3 — position publique d'un lieu (salle ou établissement), sans dépendance : importable par le serveur et
 * par un écran.
 *
 * Décision du client (21/11) : un lieu tenu par un particulier n'est montré que par une ZONE d'environ 300 m (centre
 * stocké en base, décalé de 80 à 220 m du vrai point et tiré une fois : migration 20261210000001) ; son adresse exacte
 * n'est donnée qu'après une réservation confirmée. Un lieu professionnel montre son point et son adresse. Un lieu sans
 * déclaration est un lieu de particulier (protection par défaut).
 *
 * Règle : le vrai point d'un particulier ne sort jamais du serveur ; ces fonctions rendent soit le point (professionnel),
 * soit le centre de la zone (particulier), jamais les deux.
 */

export type HostKind = 'PARTICULIER' | 'PROFESSIONNEL';

export const HOST_KINDS: readonly HostKind[] = ['PARTICULIER', 'PROFESSIONNEL'];

/** Rayon de la zone montrée pour un particulier (mètres). */
export const ZONE_RADIUS_M = 300;

/** Phrase montrée avec la zone d'un particulier. */
export const ZONE_SENTENCE = 'Adresse exacte après réservation';

/** Vrai seulement pour un lieu déclaré professionnel (toute autre valeur : particulier). */
export function isProfessional(kind: unknown): boolean {
    return kind === 'PROFESSIONNEL';
}

export interface PublicPosition {
    lat: number;
    lng: number;
    /** true : point exact (professionnel) ; false : centre de la zone de 300 m (particulier). */
    exact: boolean;
}

interface PlaceRow {
    [key: string]: unknown;
    host_kind?: unknown;
    latitude?: unknown;
    longitude?: unknown;
    zone_latitude?: unknown;
    zone_longitude?: unknown;
}

function coord(v: unknown): number | null {
    if (v === null || v === undefined || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
}

/** Position publique d'une ligne lue par le serveur (null : pas de position, ou zone absente). */
export function publicPosition(row: PlaceRow): PublicPosition | null {
    if (isProfessional(row.host_kind)) {
        const lat = coord(row.latitude);
        const lng = coord(row.longitude);
        return lat === null || lng === null ? null : { lat, lng, exact: true };
    }
    const lat = coord(row.zone_latitude);
    const lng = coord(row.zone_longitude);
    return lat === null || lng === null ? null : { lat, lng, exact: false };
}

/** Adresse publique : celle d'un lieu professionnel ; jamais celle d'un particulier. */
export function publicAddress(row: { [key: string]: unknown; host_kind?: unknown; address?: unknown }): string | null {
    if (!isProfessional(row.host_kind)) return null;
    return typeof row.address === 'string' && row.address.trim().length > 0 ? row.address : null;
}

/** Colonnes à lire pour décider de la position publique (lecture par le serveur seulement). */
export const POSITION_COLUMNS = 'host_kind, latitude, longitude, zone_latitude, zone_longitude';

/** Libellés pour la partenaire et l'administration. */
export const HOST_KIND_TEXT: Readonly<Record<HostKind, { label: string; hint: string }>> = {
    PARTICULIER: {
        label: 'Chez un particulier',
        hint: 'Le public voit seulement le quartier (une zone d’environ 300 m). L’adresse exacte est donnée à la cliente une fois sa réservation confirmée.',
    },
    PROFESSIONNEL: {
        label: 'Lieu professionnel',
        hint: 'L’adresse et l’emplacement exacts sont visibles par tout le monde, sur la fiche et sur la carte.',
    },
};

export function hostKindOf(v: unknown): HostKind {
    return isProfessional(v) ? 'PROFESSIONNEL' : 'PARTICULIER';
}

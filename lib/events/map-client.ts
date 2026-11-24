import type { MapResponse, MapZone, PublicMapEvent } from '@/lib/events/map-shared';

/**
 * Lot Carte B — lecture de GET /api/events/carte par la carte, le calendrier et l'aperçu de l'accueil (navigateur).
 * Les filtres de l'Explorer arrivent déjà écrits en adresse par la page (`filtersQuery`, même écriture que la liste, sans la
 * page ni le tri : catalogSearchParams) ; ce module n'importe pas les filtres du catalogue, pour ne rien partager avec le
 * premier chargement d'Explorer (sinon webpack sort ces modules dans un morceau commun de plus). Zone et période
 * facultatives. Aucune donnée de l'appareil n'est envoyée : la position de « Autour de moi » ne sert qu'à centrer la
 * carte ; la zone envoyée ensuite (« Rechercher dans cette zone ») est élargie sur une grille de 5,5 km (T1).
 */

export type MapReadResult = { ok: true; data: MapResponse } | { ok: false; message: string };

const NETWORK_MESSAGE = 'Connexion impossible : vérifiez votre réseau, puis réessayez.';

/**
 * Contre-vérification T1 : la zone envoyée au serveur est arrondie VERS L'EXTÉRIEUR sur une grille de 0,05° (≈ 5,5 km,
 * le grain d'une tuile au zoom 13). Après « Autour de moi », le centre de la zone envoyée ne redonne donc plus la position
 * du téléphone (au plus 4 décimales gardaient une dizaine de mètres). La zone ne peut que s'agrandir : aucun événement
 * visible n'est perdu ; la liste de l'ordinateur reste filtrée sur la vue exacte dans le navigateur (ExploreMap).
 */
export const ZONE_GRID_DEG = 0.05;
const gridDown = (n: number): string => (Math.floor(n / ZONE_GRID_DEG + 1e-9) * ZONE_GRID_DEG).toFixed(2);
const gridUp = (n: number): string => (Math.ceil(n / ZONE_GRID_DEG - 1e-9) * ZONE_GRID_DEG).toFixed(2);

export function mapUrl(filtersQuery: string, opts: { zone?: MapZone | null; from?: string; to?: string } = {}): string {
    const params = new URLSearchParams(filtersQuery);
    params.delete('tri');
    params.delete('page');
    params.delete('vue');
    if (opts.zone) {
        const z = opts.zone;
        params.set('zone', [gridDown(z.south), gridDown(z.west), gridUp(z.north), gridUp(z.east)].join(','));
    }
    if (opts.from && opts.to) {
        params.set('du', opts.from);
        params.set('au', opts.to);
    }
    const q = params.toString();
    return q ? `/api/events/carte?${q}` : '/api/events/carte';
}

function isEvent(raw: unknown): raw is PublicMapEvent {
    if (typeof raw !== 'object' || raw === null) return false;
    const r = raw as Record<string, unknown>;
    return typeof r.id === 'string' && typeof r.title === 'string' && typeof r.startsAt === 'string' && typeof r.endsAt === 'string'
        && typeof r.lat === 'number' && typeof r.lng === 'number' && typeof r.color === 'string'
        && (r.price === null || typeof r.price === 'number') && (r.blur === null || typeof r.blur === 'string');
}

/** Lit la carte ; `tag` identifie l'écran dans le journal de la console. */
export async function readMapEvents(tag: string, url: string): Promise<MapReadResult> {
    let res: Response;
    try {
        res = await fetch(url, { cache: 'no-store' });
    } catch (err) {
        console.error(`[${tag}] carte injoignable :`, err instanceof Error ? err.message : String(err));
        return { ok: false, message: NETWORK_MESSAGE };
    }
    let body: unknown = null;
    try {
        body = await res.json();
    } catch (err) {
        console.error(`[${tag}] réponse illisible de la carte (HTTP ${res.status}) :`, err instanceof Error ? err.message : String(err));
        return { ok: false, message: 'Les événements n’ont pas pu être chargés. Réessayez dans un instant.' };
    }
    const payload = (typeof body === 'object' && body !== null ? body : {}) as { events?: unknown; total?: unknown; truncated?: unknown; error?: unknown };
    if (!res.ok || !Array.isArray(payload.events)) {
        if (res.ok) console.error(`[${tag}] carte sans liste d’événements`);
        return { ok: false, message: 'Les événements n’ont pas pu être chargés. Réessayez dans un instant.' };
    }
    const events = payload.events.filter(isEvent);
    return {
        ok: true,
        data: {
            events,
            total: typeof payload.total === 'number' ? payload.total : events.length,
            truncated: payload.truncated === true,
        },
    };
}

import { catalogSearchParams, type CatalogFilterState } from '@/lib/events/catalog-filters';
import type { MapResponse, MapZone, PublicMapEvent } from '@/lib/events/map-shared';

/**
 * Lot Carte B — lecture de GET /api/events/carte par la carte, le calendrier et l'aperçu de l'accueil (navigateur).
 * Les filtres de l'Explorer sont envoyés tels quels (même adresse que la liste, sans la page ni le tri) ; la zone et la
 * période sont facultatives. Aucune donnée de l'appareil n'est envoyée (la position de « Autour de moi » ne sert qu'à
 * centrer la carte, jamais transmise).
 */

export type MapReadResult = { ok: true; data: MapResponse } | { ok: false; message: string };

const NETWORK_MESSAGE = 'Connexion impossible : vérifiez votre réseau, puis réessayez.';

/** Arrondi à 4 décimales (une dizaine de mètres) : adresses stables d'un déplacement à l'autre. */
const round = (n: number): string => (Math.round(n * 1e4) / 1e4).toString();

export function mapUrl(filters: CatalogFilterState, opts: { zone?: MapZone | null; from?: string; to?: string } = {}): string {
    const params = catalogSearchParams({ ...filters, tri: 'date', page: 1 });
    if (opts.zone) params.set('zone', [opts.zone.south, opts.zone.west, opts.zone.north, opts.zone.east].map(round).join(','));
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

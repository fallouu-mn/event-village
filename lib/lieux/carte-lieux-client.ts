import { zoneQueryValue } from '@/lib/events/map-client';
import type { MapZone } from '@/lib/events/map-shared';
import type { PlaceLayer, PlacesResponse, PublicMapPlace } from '@/lib/lieux/carte-lieux';

/**
 * Lot Carte B3 — lecture de GET /api/lieux/carte par la carte d'Explorer (navigateur). Aucune donnée de l'appareil
 * n'est envoyée : la zone est élargie sur la même grille que celle des événements (règle T1 de la carte B : après
 * « Autour de moi », le centre de la zone envoyée ne redonne pas la position du téléphone).
 */

export interface HallLayerFilters { date: string; guests: string }
export interface VenueLayerFilters { date: string; time: string; guests: string }

export const EMPTY_HALL_FILTERS: HallLayerFilters = { date: '', guests: '' };
export const EMPTY_VENUE_FILTERS: VenueLayerFilters = { date: '', time: '', guests: '' };

export function placesUrl(layer: PlaceLayer, zone: MapZone | null, f: { halls: HallLayerFilters; venues: VenueLayerFilters }): string {
    const params = new URLSearchParams({ couche: layer });
    if (zone) params.set('zone', zoneQueryValue(zone));
    if (layer === 'salles') {
        if (f.halls.date) params.set('date', f.halls.date);
        if (f.halls.guests) params.set('invites', f.halls.guests);
    } else {
        if (f.venues.date) params.set('date', f.venues.date);
        if (f.venues.time) params.set('heure', f.venues.time);
        if (f.venues.guests) params.set('personnes', f.venues.guests);
    }
    return `/api/lieux/carte?${params.toString()}`;
}

function isPlace(raw: unknown): raw is PublicMapPlace {
    if (typeof raw !== 'object' || raw === null) return false;
    const r = raw as Record<string, unknown>;
    return typeof r.id === 'string' && (r.type === 'salle' || r.type === 'restaurant') && typeof r.name === 'string'
        && typeof r.lat === 'number' && typeof r.lng === 'number' && Array.isArray(r.photos)
        && (r.price === null || typeof r.price === 'number') && (r.capacity === null || typeof r.capacity === 'number');
}

export type PlacesReadResult = { ok: true; data: PlacesResponse } | { ok: false; message: string };

/** Lit une couche ; une réponse 400 rend la phrase du serveur (filtre refusé : date passée, trop lointaine…). */
export async function readPlaces(url: string): Promise<PlacesReadResult> {
    let res: Response;
    try {
        res = await fetch(url, { cache: 'no-store' });
    } catch (err) {
        console.error('[carte] lieux injoignables :', err instanceof Error ? err.message : String(err));
        return { ok: false, message: 'Connexion impossible : vérifiez votre réseau, puis réessayez.' };
    }
    let body: unknown = null;
    try {
        body = await res.json();
    } catch (err) {
        console.error(`[carte] réponse illisible des lieux (HTTP ${res.status}) :`, err instanceof Error ? err.message : String(err));
        return { ok: false, message: 'Les lieux n’ont pas pu être chargés. Réessayez dans un instant.' };
    }
    const payload = (typeof body === 'object' && body !== null ? body : {}) as { places?: unknown; total?: unknown; truncated?: unknown; error?: unknown };
    if (res.status === 400 && typeof payload.error === 'string') return { ok: false, message: payload.error };
    if (!res.ok || !Array.isArray(payload.places)) {
        if (res.ok) console.error('[carte] réponse des lieux sans liste');
        return { ok: false, message: 'Les lieux n’ont pas pu être chargés. Réessayez dans un instant.' };
    }
    const places = payload.places.filter(isPlace);
    return { ok: true, data: { places, total: typeof payload.total === 'number' ? payload.total : places.length, truncated: payload.truncated === true } };
}

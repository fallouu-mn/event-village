import { unstable_cache } from 'next/cache';
import { PUBLIC_REVALIDATE_SECONDS } from '@/lib/events/catalog-cache.server';
import { readHomeFeaturedPlacements, HOME_FEATURED_MAX } from '@/lib/events/featured.server';
import { toMapEntry, type MapEntry, type MapRow } from '@/lib/events/map-data';
import type { MapHighlight } from '@/lib/events/map-shared';
import { getServiceRoleClient } from '@/lib/supabase/server';

/**
 * Lot Carte B (B0) — lecture publique de la carte et du calendrier d'Explorer, en lecture seule.
 *
 *  - Lecture service_role des seules colonnes utiles (MAP_SELECT), statut PUBLIE exigé PAR LA REQUÊTE (et revérifié par
 *    toMapEntry), position présente exigée par la requête ; mises en avant lues par home_featured_public (placements
 *    actifs valides seulement, sans auteur ni motif).
 *  - Cache de 60 s sous l'étiquette `catalogue-public` : MÊME invalidation que le catalogue (invalidatePublicEvent, appelé
 *    après chaque changement de statut, de date, de lieu, de catégorie, de mise en avant, et après la suspension d'une
 *    partenaire). Une panne n'est pas gardée (unstable_cache ne garde pas une exception).
 *  - Ce module ne rend que des entrées internes ; la route (app/api/events/carte/route.ts) ne sort que les champs publics
 *    (selectMapEvents → publicOnly).
 */
export const MAP_SELECT = `
    id,
    title,
    status,
    category,
    location,
    city,
    start_date,
    start_time,
    end_date,
    end_time,
    latitude,
    longitude,
    poster_color,
    poster_blur,
    partners(company_name, commercial_name),
    ticket_categories(price, is_active, sale_online, sale_counter, total_quantity, sold_quantity, held_quantity, sale_start, sale_end)
`;

/** Entrées de la carte, dans l'ordre de début. Lève en cas de panne (jamais une carte vide à la place). */
export async function readMapEntries(): Promise<MapEntry[]> {
    const [{ data, error }, placements] = await Promise.all([
        getServiceRoleClient()
            .from('events')
            .select(MAP_SELECT)
            .eq('status', 'PUBLIE')
            .not('latitude', 'is', null)
            .not('longitude', 'is', null)
            .order('start_date', { ascending: true })
            .order('start_time', { ascending: true, nullsFirst: true })
            .order('id', { ascending: true }),
        readHomeFeaturedPlacements(HOME_FEATURED_MAX),
    ]);
    if (error) throw new Error(`carte publique illisible : ${error.code ?? ''} ${error.message}`);
    const highlights = new Map<string, MapHighlight>(placements.map((p) => [p.eventId, p.label]));
    const now = Date.now();
    const out: MapEntry[] = [];
    for (const row of (data ?? []) as unknown as MapRow[]) {
        const entry = toMapEntry(row, highlights.get(row.id) ?? null, now);
        if (entry) out.push(entry);
    }
    return out;
}

const cachedRead = unstable_cache(readMapEntries, ['carte-publique', 'v1'], { revalidate: PUBLIC_REVALIDATE_SECONDS, tags: ['catalogue-public'] });

/** Entrées de la carte sous cache (60 s, étiquette `catalogue-public`). */
export async function cachedMapEntries(): Promise<MapEntry[]> {
    return cachedRead();
}

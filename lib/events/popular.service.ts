import { CATALOG_SELECT, formatCatalogEvent, type CatalogEventDto, type CatalogRow } from '@/lib/events/catalog.server';
import { getServiceRoleClient } from '@/lib/supabase/server';

/**
 * Lot 9 (9.1, contrat 5.2, L20, L21, AR12) — « Populaires » : événements PUBLIE les plus vendus sur 7 jours, classés
 * par la RPC events_popular, servis avec la carte du catalogue. `sold` reste côté serveur.
 *
 * Cache : mémoire du module, 60 s strictes. Une panne n'est jamais gardée et aucune liste périmée n'est servie à sa
 * place ; les appels simultanés partagent la même lecture. Un événement suspendu reste visible 60 s au plus, assumé.
 */
const POPULAR_LIMIT = 10;
const TTL_MS = 60_000;

interface CacheEntry { at: number; value: Promise<CatalogEventDto[]> }

let entry: CacheEntry | null = null;

export async function readPopularEvents(): Promise<CatalogEventDto[]> {
    const supabase = getServiceRoleClient();
    const { data: ranked, error } = await supabase.rpc('events_popular', { p_limit: POPULAR_LIMIT });
    if (error) throw new Error(`events_popular : ${error.code ?? ''} ${error.message}`);

    const ids = ((ranked ?? []) as Array<{ event_id: string }>).map((r) => r.event_id);
    if (ids.length === 0) return [];

    const { data: rows, error: readError } = await supabase
        .from('events')
        .select(CATALOG_SELECT)
        .in('id', ids)
        .eq('status', 'PUBLIE');
    if (readError) throw new Error(`lecture des événements populaires : ${readError.code ?? ''} ${readError.message}`);

    const byId = new Map(((rows ?? []) as unknown as CatalogRow[]).map((row) => [row.id, row]));
    return ids.flatMap((id) => {
        const row = byId.get(id);
        return row ? [formatCatalogEvent(row)] : [];
    });
}

/** `deps` : horloge (millisecondes) et lecteur injectables pour les tests, jamais renseignés par la route. */
export function getPopularEvents(deps: { now?: () => number; read?: () => Promise<CatalogEventDto[]> } = {}): Promise<CatalogEventDto[]> {
    const at = (deps.now ?? Date.now)();
    if (entry && at - entry.at < TTL_MS) return entry.value;

    const fresh: CacheEntry = { at, value: (deps.read ?? readPopularEvents)() };
    entry = fresh;
    // L'appelant reçoit le rejet et le journalise ; ce gestionnaire retire seulement l'entrée du cache.
    fresh.value.catch(() => {
        if (entry === fresh) entry = null;
    });
    return fresh.value;
}

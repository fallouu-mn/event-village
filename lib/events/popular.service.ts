import { CATALOG_SELECT, formatCatalogEvent, type CatalogEventDto, type CatalogRow } from '@/lib/events/catalog.server';
import { lowStockThreshold } from '@/lib/events/low-stock.server';
import { getServiceRoleClient } from '@/lib/supabase/server';

/**
 * Lot 9 (9.1, contrat 5.2, L20, L21, AR12) — « Populaires » : événements PUBLIE les plus vendus sur 7 jours, classés
 * par la RPC events_popular, servis avec la carte du catalogue. `sold` reste côté serveur.
 *
 * Lot 9 ter (9t.19, consigne 5, D-S4, contrat D.2.3) : le cache ne porte plus que le classement ; les cartes sont
 * relues à chaque appel (une lecture indexée de 10 événements au plus), pour qu'une catégorie épuisée apparaisse
 * aussitôt (« Complet », « Dernières places »).
 *
 * Cache du classement : mémoire du module, 60 s strictes. Une panne n'est jamais gardée et aucun classement périmé
 * n'est servi à sa place ; les appels simultanés partagent la même lecture. Un événement suspendu n'est plus servi
 * (cartes relues avec le statut PUBLIE).
 */
const POPULAR_LIMIT = 10;
const TTL_MS = 60_000;

interface CacheEntry { at: number; value: Promise<string[]> }

let entry: CacheEntry | null = null;

/** Classement des événements populaires (identifiants, dans l'ordre de la RPC). */
export async function readPopularRanking(): Promise<string[]> {
    const { data: ranked, error } = await getServiceRoleClient().rpc('events_popular', { p_limit: POPULAR_LIMIT });
    if (error) throw new Error(`events_popular : ${error.code ?? ''} ${error.message}`);
    return ((ranked ?? []) as Array<{ event_id: string }>).map((r) => r.event_id);
}

/** `deps` : horloge (millisecondes) et lecteur injectables pour les tests, jamais renseignés par la route. */
export function getPopularRanking(deps: { now?: () => number; read?: () => Promise<string[]> } = {}): Promise<string[]> {
    const at = (deps.now ?? Date.now)();
    if (entry && at - entry.at < TTL_MS) return entry.value;

    const fresh: CacheEntry = { at, value: (deps.read ?? readPopularRanking)() };
    entry = fresh;
    // L'appelant reçoit le rejet et le journalise ; ce gestionnaire retire seulement l'entrée du cache.
    fresh.value.catch(() => {
        if (entry === fresh) entry = null;
    });
    return fresh.value;
}

/** Cartes des événements classés, lues à chaque appel, dans l'ordre du classement ; un événement non PUBLIE est omis. */
export async function readPopularCards(ids: string[]): Promise<CatalogEventDto[]> {
    if (ids.length === 0) return [];
    const { data: rows, error: readError } = await getServiceRoleClient()
        .from('events')
        .select(CATALOG_SELECT)
        .in('id', ids)
        .eq('status', 'PUBLIE');
    if (readError) throw new Error(`lecture des événements populaires : ${readError.code ?? ''} ${readError.message}`);
    const threshold = await lowStockThreshold();

    const byId = new Map(((rows ?? []) as unknown as CatalogRow[]).map((row) => [row.id, row]));
    return ids.flatMap((id) => {
        const row = byId.get(id);
        return row ? [formatCatalogEvent(row, threshold)] : [];
    });
}

export async function getPopularEvents(): Promise<CatalogEventDto[]> {
    return readPopularCards(await getPopularRanking());
}

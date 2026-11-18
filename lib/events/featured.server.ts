import { CATALOG_SELECT, formatCatalogEvent, type CatalogEventDto, type CatalogRow } from '@/lib/events/catalog.server';
import { lowStockThreshold } from '@/lib/events/low-stock.server';
import { getServiceRoleClient } from '@/lib/supabase/server';

/**
 * Design 1b (À LA UNE) — événements « À la une » de l'accueil, choisis par le Superadmin (page /admin/a-la-une).
 *
 * Lecture : RPC `home_featured_public` (20261122000001_d1b_a_la_une.sql), qui ne rend que les placements actifs
 * valides (événement PUBLIE, non terminé selon event_end_at, dans la fenêtre d'affichage), dans l'ordre, avec
 * l'étiquette, et rien d'autre (ni auteur, ni motif). Les cartes sont relues avec le select et la mise en forme du
 * catalogue (CATALOG_SELECT, formatCatalogEvent), statut PUBLIE exigé une seconde fois.
 *
 * Jamais d'erreur affichée : base pas encore migrée (fonction absente), panne de lecture → tableau vide, l'accueil
 * montre alors les plus vendus. Aucune donnée personnelle : ce module peut servir une page mise en cache.
 */
export type FeaturedLabel = 'A_LA_UNE' | 'SPONSORISE';

export type HomeFeaturedEvent = CatalogEventDto & { featuredLabel: FeaturedLabel };

export const HOME_FEATURED_MAX = 20;

interface FeaturedRow { event_id: string; sort_order: number; label: string }

/** Fonction ou table absente (base pas encore migrée) : PostgREST PGRST202 / PGRST205, Postgres 42883 / 42P01. */
function isMissing(error: { code?: string | null }): boolean {
    return ['PGRST202', 'PGRST205', '42883', '42P01'].includes(String(error.code ?? ''));
}

let missingLogged = false;

function labelOf(raw: string): FeaturedLabel {
    return raw === 'SPONSORISE' ? 'SPONSORISE' : 'A_LA_UNE';
}

/** Placements valides, dans l'ordre (identifiant d'événement et étiquette). Vide en cas d'absence ou de panne. */
export async function readHomeFeaturedPlacements(limit: number): Promise<Array<{ eventId: string; label: FeaturedLabel }>> {
    const n = Math.max(0, Math.min(HOME_FEATURED_MAX, Math.floor(Number(limit) || 0)));
    if (n === 0) return [];
    try {
        const { data, error } = await getServiceRoleClient().rpc('home_featured_public', { p_limit: n });
        if (error) {
            if (isMissing(error)) {
                if (!missingLogged) {
                    missingLogged = true;
                    console.warn('[à la une] fonction home_featured_public absente : accueil sans sélection.');
                }
            } else {
                console.error('[à la une] lecture impossible :', error.code ?? '', error.message);
            }
            return [];
        }
        return ((data ?? []) as FeaturedRow[])
            .slice()
            .sort((a, b) => a.sort_order - b.sort_order)
            .map((r) => ({ eventId: r.event_id, label: labelOf(r.label) }));
    } catch (e) {
        console.error('[à la une] lecture impossible :', e instanceof Error ? e.message : e);
        return [];
    }
}

/**
 * Événements à la une, dans l'ordre choisi, au format des cartes du catalogue, chacun avec `featuredLabel`.
 * Tableau vide s'il n'y en a pas, si la base n'est pas migrée ou en cas de panne (jamais d'exception).
 */
export async function listHomeFeatured(limit: number): Promise<HomeFeaturedEvent[]> {
    const placements = await readHomeFeaturedPlacements(limit);
    if (placements.length === 0) return [];
    try {
        const { data: rows, error } = await getServiceRoleClient()
            .from('events')
            .select(CATALOG_SELECT)
            .in('id', placements.map((p) => p.eventId))
            .eq('status', 'PUBLIE');
        if (error) {
            console.error('[à la une] lecture des cartes impossible :', error.code ?? '', error.message);
            return [];
        }
        const threshold = await lowStockThreshold();
        const byId = new Map(((rows ?? []) as unknown as CatalogRow[]).map((row) => [row.id, row]));
        return placements.flatMap(({ eventId, label }) => {
            const row = byId.get(eventId);
            return row ? [{ ...formatCatalogEvent(row, threshold), featuredLabel: label }] : [];
        });
    } catch (e) {
        console.error('[à la une] lecture des cartes impossible :', e instanceof Error ? e.message : e);
        return [];
    }
}

import { CATALOG_SELECT, formatCatalogEvent, type CatalogEventDto, type CatalogRow } from '@/lib/events/catalog.server';
import { eventEndAt } from '@/lib/events/event-end';
import { getServiceRoleClient } from '@/lib/supabase/server';

/**
 * Design 1b (point 1) — lecture du catalogue public, partagée par GET /api/events (sans cache : temps réel des écrans)
 * et par les pages serveur de l'accueil et de l'Explorer (cache de 60 s : lib/events/catalog-cache.server.ts).
 *
 * Contrat E du lot 5, inchangé : événements PUBLIE dont la fin retenue (event_end_at) est à venir, un événement en cours
 * reste listé ; ordre du lot 9 ter (date de début, puis à date égale les complets après ceux en vente, puis l'heure de
 * début, puis l'identifiant). Aucune donnée personnelle : la liste est la même pour tous, elle peut être mise en cache.
 */

type Ordered = { row: CatalogRow; dto: CatalogEventDto };

function compareText(a: string, b: string): number {
    return a < b ? -1 : a > b ? 1 : 0;
}

/** Lot 9 ter (9t.19) : date de début, complet après en vente, heure de début, identifiant. */
function catalogOrder(a: Ordered, b: Ordered): number {
    return compareText(a.row.start_date, b.row.start_date)
        || Number(a.dto.stock === 'SOLD_OUT') - Number(b.dto.stock === 'SOLD_OUT')
        || compareText(a.row.start_time ?? '', b.row.start_time ?? '')
        || compareText(a.row.id, b.row.id);
}

/** Catalogue public à venir, dans l'ordre du catalogue. Lève en cas de panne (jamais une liste vide à la place). */
export async function readCatalogEvents(): Promise<CatalogEventDto[]> {
    const { data, error } = await getServiceRoleClient()
        .from('events')
        .select(CATALOG_SELECT)
        .eq('status', 'PUBLIE')
        .order('start_date', { ascending: true });
    if (error) throw new Error(`catalogue public illisible : ${error.code ?? ''} ${error.message}`);
    const now = Date.now();
    return ((data ?? []) as unknown as CatalogRow[])
        .filter((row) => eventEndAt(row).getTime() > now)
        .map((row) => ({ row, dto: formatCatalogEvent(row) }))
        .sort(catalogOrder)
        .map(({ dto }) => dto);
}

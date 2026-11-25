import { getServiceRoleClient } from '@/lib/supabase/server';

/**
 * Contre-vérification du lot Carte B, T4 — les ventes et les réservations rendues changent ce qu'affichent les pages
 * publiques (« Complet », prix d'appel du catalogue et de la carte) : une écriture de stock qui fait passer une catégorie
 * À ZÉRO place, ou qui la fait REPARTIR de zéro, doit les invalider, sans vider le cache à chaque billet un soir
 * d'affluence.
 *
 * Méthode (les fonctions en base ne rendent pas toutes les catégories touchées) : places restantes des catégories
 * concernées lues avant l'écriture (`stockSnapshot`), puis après (`stockCrossedZero`), en une requête chacune ; une
 * catégorie passée de > 0 à ≤ 0, ou de ≤ 0 à > 0, désigne son événement. Regroupement : au plus une invalidation par
 * événement toutes les 5 s (par instance du serveur ; le cache expire de toute façon en 60 s).
 *
 * Places restantes = quota − vendues − retenues (`total_quantity - sold_quantity - held_quantity`), comme le catalogue.
 * Une lecture impossible est journalisée et ne bloque jamais la vente : aucune invalidation alors (cache de 60 s).
 * L'appelant invalide lui-même (`invalidatePublicEvent`) les événements rendus.
 */

export const STOCK_INVALIDATION_WINDOW_MS = 5_000;

export interface StockScope {
    eventIds?: readonly string[];
    categoryIds?: readonly string[];
}

/** Places restantes par catégorie, avec son événement. */
export type StockSnapshot = Map<string, { eventId: string; remaining: number }>;

interface CategoryRow {
    id: string;
    event_id: string;
    total_quantity: number | string | null;
    sold_quantity: number | string | null;
    held_quantity: number | string | null;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const clean = (ids: readonly string[] | undefined): string[] => Array.from(new Set((ids ?? []).filter((id) => UUID_RE.test(id))));

/** Lecture des places restantes ; null si rien à lire ou en cas d'échec (journalisé). */
export async function stockSnapshot(scope: StockScope): Promise<StockSnapshot | null> {
    const eventIds = clean(scope.eventIds);
    const categoryIds = clean(scope.categoryIds);
    if (eventIds.length === 0 && categoryIds.length === 0) return null;
    let query = getServiceRoleClient().from('ticket_categories').select('id, event_id, total_quantity, sold_quantity, held_quantity');
    query = eventIds.length > 0 ? query.in('event_id', eventIds) : query.in('id', categoryIds);
    const { data, error } = await query;
    if (error) {
        console.error('[stock] lecture des places restantes impossible (aucune invalidation, cache de 60 s) :', error.code ?? '', error.message);
        return null;
    }
    const out: StockSnapshot = new Map();
    for (const row of (data ?? []) as CategoryRow[]) {
        const remaining = Number(row.total_quantity ?? 0) - Number(row.sold_quantity ?? 0) - Number(row.held_quantity ?? 0);
        out.set(row.id, { eventId: row.event_id, remaining });
    }
    return out;
}

/** Événements dont une catégorie est passée à zéro ou repartie de zéro entre deux lectures (fonction pure). */
export function eventsCrossingZero(before: StockSnapshot, after: StockSnapshot): string[] {
    const out = new Set<string>();
    for (const [id, now] of Array.from(after.entries())) {
        const was = before.get(id);
        if (!was) continue;
        if ((was.remaining > 0) !== (now.remaining > 0)) out.add(now.eventId);
    }
    return Array.from(out);
}

const lastInvalidation = new Map<string, number>();

/** Regroupement : garde les événements non invalidés depuis 5 s et note l'heure (fonction de l'instance). */
export function throttleStockEvents(eventIds: readonly string[], now = Date.now()): string[] {
    const kept: string[] = [];
    for (const id of eventIds) {
        const last = lastInvalidation.get(id);
        if (last !== undefined && now - last < STOCK_INVALIDATION_WINDOW_MS) continue;
        lastInvalidation.set(id, now);
        kept.push(id);
    }
    // Mémoire bornée : les entrées de plus de 5 s ne servent plus
    if (lastInvalidation.size > 1_000) {
        for (const [id, at] of Array.from(lastInvalidation.entries())) if (now - at >= STOCK_INVALIDATION_WINDOW_MS) lastInvalidation.delete(id);
    }
    return kept;
}

/**
 * Après l'écriture : relit le même périmètre, rend les événements à invalider (passage par zéro, regroupés à 5 s).
 * `before` null (lecture impossible ou rien à lire) : aucun.
 */
export async function stockCrossedZero(before: StockSnapshot | null, scope: StockScope): Promise<string[]> {
    if (!before || before.size === 0) return [];
    const after = await stockSnapshot(scope);
    if (!after) return [];
    return throttleStockEvents(eventsCrossingZero(before, after));
}

/**
 * Catégories des réservations échues que `stock_reservations_expire` va rendre (même condition : ACTIVE et échéance
 * passée), lues juste avant l'appel par les tâches planifiées. Null si aucune ou en cas d'échec (journalisé).
 */
export async function expiringReservationsScope(now = new Date()): Promise<StockScope | null> {
    const { data, error } = await getServiceRoleClient()
        .from('stock_reservations')
        .select('category_id')
        .eq('status', 'ACTIVE')
        .lte('expires_at', now.toISOString())
        .limit(1_000);
    if (error) {
        console.error('[stock] réservations échues illisibles (aucune invalidation, cache de 60 s) :', error.code ?? '', error.message);
        return null;
    }
    const categoryIds = Array.from(new Set((data ?? []).map((r: { category_id: string | null }) => String(r.category_id ?? ''))));
    return categoryIds.length > 0 ? { categoryIds } : null;
}

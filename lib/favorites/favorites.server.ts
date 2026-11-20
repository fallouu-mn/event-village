/**
 * Design 1d (point 8) — favoris d'un compte, côté serveur seulement.
 *
 * La table public.event_favorites n'a AUCUN droit de table (migration 20261127000001) : lecture et écriture passent par
 * event_favorite_set et event_favorite_list, exécutables par le service_role seul. Le compte est TOUJOURS celui de la
 * session lue par la route (requireActiveSession) : aucune fonction de ce module ne reçoit un compte venu du navigateur.
 * Aucun avis n'est créé (le rappel de la veille viendra dans un lot suivant). Module serveur (service_role).
 */
import { CATALOG_SELECT, formatCatalogEvent, type CatalogEventDto, type CatalogRow } from '@/lib/events/catalog.server';
import { isEventId } from '@/lib/events/public-status';
import { getServiceRoleClient } from '@/lib/supabase/server';

/** Favoris lus au plus par compte (même borne que la fonction et que la limite d'ajout). */
export const FAVORITES_MAX = 500;

export class FavoritesUnavailable extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'FavoritesUnavailable';
    }
}

export type FavoriteSetResult =
    | { ok: true; favorite: boolean }
    | { ok: false; code: 'EVENT_NOT_FOUND' | 'ACCOUNT_INACTIVE' | 'FAVORITES_LIMIT' };

/** Ajout ou retrait d'un favori du compte de la session. Lève FavoritesUnavailable si la base ne répond pas. */
export async function setFavorite(userId: string, eventId: string, on: boolean): Promise<FavoriteSetResult> {
    if (!isEventId(eventId)) return { ok: false, code: 'EVENT_NOT_FOUND' };
    const { data, error } = await getServiceRoleClient().rpc('event_favorite_set', { p_user: userId, p_event: eventId, p_on: on });
    if (error) throw new FavoritesUnavailable(`favori non enregistré : ${error.code ?? ''} ${error.message}`);
    const res = data as { ok?: unknown; favorite?: unknown; code?: unknown } | null;
    if (res?.ok === true) return { ok: true, favorite: res.favorite === true };
    if (res?.code === 'EVENT_NOT_FOUND' || res?.code === 'ACCOUNT_INACTIVE' || res?.code === 'FAVORITES_LIMIT') {
        return { ok: false, code: res.code };
    }
    throw new FavoritesUnavailable(`réponse inattendue de event_favorite_set : ${JSON.stringify(res).slice(0, 200)}`);
}

/** Identifiants des favoris encore publics du compte de la session, du plus récent au plus ancien. */
export async function favoriteIds(userId: string): Promise<string[]> {
    const { data, error } = await getServiceRoleClient().rpc('event_favorite_list', { p_user: userId, p_limit: FAVORITES_MAX });
    if (error) throw new FavoritesUnavailable(`favoris illisibles : ${error.code ?? ''} ${error.message}`);
    return ((data ?? []) as Array<{ event_id: string }>).map((r) => String(r.event_id));
}

/** Carte d'un favori : la carte du catalogue (aucune donnée de plus), dans l'ordre des favoris. */
export async function favoriteCards(userId: string): Promise<CatalogEventDto[]> {
    const ids = await favoriteIds(userId);
    if (ids.length === 0) return [];
    const { data, error } = await getServiceRoleClient()
        .from('events')
        .select(CATALOG_SELECT)
        .in('id', ids)
        .in('status', ['PUBLIE', 'SUSPENDU', 'ANNULE', 'TERMINE'])
        .eq('ended_unpublished', false);
    if (error) throw new FavoritesUnavailable(`cartes des favoris illisibles : ${error.code ?? ''} ${error.message}`);
    const byId = new Map(((data ?? []) as unknown as CatalogRow[]).map((row) => [row.id, formatCatalogEvent(row)]));
    return ids.flatMap((id) => {
        const card = byId.get(id);
        return card ? [card] : [];
    });
}

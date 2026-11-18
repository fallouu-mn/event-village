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

// ── Administration (Superadmin) ──────────────────────────────────────────────────────────────────────────────────
// Appelées seulement par les routes app/api/admin/a-la-une/**, après verifyAdminAuth (Superadmin) et, pour une
// écriture, requireAdminIdentity (mot de passe et code administrateur de moins de 10 minutes). La base revérifie tout
// (Superadmin actif, identité, événement publié non terminé, fenêtre, motif) et journalise. Jamais servi à une page
// publique : les noms d'auteur et les motifs ne sortent que vers le Superadmin.

/** État d'affichage d'un placement actif, calculé par la base. */
export type FeaturedDisplayState = 'LIVE' | 'SCHEDULED' | 'WINDOW_ENDED' | 'EVENT_FINISHED' | 'EVENT_NOT_PUBLISHED';

export interface FeaturedAdminItem {
    id: string;
    event_id: string;
    sort_order: number;
    label: FeaturedLabel;
    starts_at: string | null;
    ends_at: string | null;
    reason: string;
    created_at: string;
    created_by_name: string | null;
    title: string;
    slug: string | null;
    start_date: string;
    start_time: string | null;
    city: string | null;
    image_url: string | null;
    event_status: string;
    event_end_at: string;
    display_state: FeaturedDisplayState;
}

export type FeaturedRemovalCode = 'MANUAL' | 'EVENT_CANCELLED' | 'EVENT_SUSPENDED' | 'EVENT_FINISHED' | 'EVENT_UNPUBLISHED';

export interface FeaturedHistoryItem {
    id: string;
    event_id: string;
    label: FeaturedLabel;
    reason: string;
    title: string;
    created_at: string;
    created_by_name: string | null;
    removed_at: string;
    removed_reason: string;
    removed_code: FeaturedRemovalCode;
    removed_by_name: string | null;
}

export type FeaturedJournalAction =
    | 'HOME_FEATURED_ADDED' | 'HOME_FEATURED_REORDERED' | 'HOME_FEATURED_WINDOW_SET' | 'HOME_FEATURED_REMOVED' | 'HOME_FEATURED_AUTO_REMOVED';

export interface FeaturedJournalItem {
    id: string;
    created_at: string;
    action: FeaturedJournalAction | string;
    user_role: string | null;
    /** null : action automatique. */
    actor_name: string | null;
    reason: string | null;
    event_title: string | null;
}

export interface FeaturedAdminList {
    active: FeaturedAdminItem[];
    history: FeaturedHistoryItem[];
    journal: FeaturedJournalItem[];
}

export interface FeaturedCandidate {
    id: string;
    title: string;
    slug: string | null;
    start_date: string;
    start_time: string | null;
    city: string | null;
    location: string | null;
    image_url: string | null;
    event_end_at: string;
}

/** Refus de la base → statut HTTP (le texte français vient de la base). */
const FEATURED_REFUSALS: Readonly<Record<string, number>> = {
    INVALID_INPUT: 400,
    INVALID_DATE: 400,
    REASON_REQUIRED: 400,
    REASON_INVALID_CHARACTERS: 400,
    LABEL_NOT_OPEN: 400,
    WINDOW_IN_PAST: 400,
    WINDOW_INVALID: 400,
    WINDOW_AFTER_EVENT: 400,
    SUPERADMIN_ONLY: 403,
    PASSWORD_CONFIRMATION_REQUIRED: 403,
    ADMIN_CODE_CONFIRMATION_REQUIRED: 403,
    EVENT_NOT_FOUND: 404,
    NOT_FOUND: 404,
    EVENT_NOT_PUBLISHED: 409,
    EVENT_FINISHED: 409,
    ALREADY_FEATURED: 409,
    LIMIT_REACHED: 409,
    ORDER_STALE: 409,
};

/** Refus voulu, à montrer tel quel (texte français de la base). */
export class FeaturedRefusal extends Error {
    constructor(message: string, readonly code: string, readonly status: number) {
        super(message);
        this.name = 'FeaturedRefusal';
    }
}

type FeaturedRpc =
    | 'home_featured_admin_list' | 'home_featured_candidates' | 'home_featured_add'
    | 'home_featured_reorder' | 'home_featured_set_window' | 'home_featured_remove';

/**
 * Appel d'une fonction d'administration. Rend la réponse `ok` ; lève FeaturedRefusal pour un refus connu, et une
 * erreur ordinaire (journalisée par la route, jamais montrée) pour une panne ou une réponse inattendue. Base pas encore
 * migrée : refus 503 « pas encore disponible ».
 */
export async function callFeaturedAdmin(fn: FeaturedRpc, p: Record<string, unknown>): Promise<Record<string, unknown>> {
    const { data, error } = await getServiceRoleClient().rpc(fn, { p });
    if (error) {
        if (isMissing(error)) {
            throw new FeaturedRefusal('La page « À la une » n’est pas encore disponible. Réessayez plus tard.', 'FEATURE_UNAVAILABLE', 503);
        }
        throw new Error(`${fn} : ${error.code ?? ''} ${error.message}`);
    }
    const reply = data as { ok?: unknown; code?: unknown; message?: unknown } | null;
    if (!reply || typeof reply !== 'object') throw new Error(`${fn} : réponse vide`);
    if (reply.ok === true) return reply as Record<string, unknown>;
    const status = FEATURED_REFUSALS[String(reply.code)];
    if (!status || typeof reply.message !== 'string') throw new Error(`${fn} : refus inattendu ${JSON.stringify(reply)}`);
    throw new FeaturedRefusal(reply.message, String(reply.code), status);
}

export async function adminListFeatured(actorId: string): Promise<FeaturedAdminList> {
    const reply = await callFeaturedAdmin('home_featured_admin_list', { actor_id: actorId });
    return {
        active: (reply.active ?? []) as FeaturedAdminItem[],
        history: (reply.history ?? []) as FeaturedHistoryItem[],
        journal: (reply.journal ?? []) as FeaturedJournalItem[],
    };
}

export async function adminSearchFeaturedCandidates(actorId: string, q: string, limit = 20): Promise<FeaturedCandidate[]> {
    const reply = await callFeaturedAdmin('home_featured_candidates', { actor_id: actorId, q, limit });
    return (reply.events ?? []) as FeaturedCandidate[];
}

/** Preuve d'identité rendue par requireAdminIdentity (session et appareil), revérifiée par la base. */
export interface FeaturedIdentity { actorId: string; sessionId: string; deviceKey: string }

function identityOf(who: FeaturedIdentity): Record<string, string> {
    return { actor_id: who.actorId, session_id: who.sessionId, device_key: who.deviceKey };
}

export async function adminAddFeatured(who: FeaturedIdentity, input: {
    eventId: string; startsAt: string | null; endsAt: string | null; reason: string; label?: FeaturedLabel;
}): Promise<{ id: string; sort_order: number }> {
    const reply = await callFeaturedAdmin('home_featured_add', {
        ...identityOf(who), event_id: input.eventId, starts_at: input.startsAt, ends_at: input.endsAt, reason: input.reason,
        ...(input.label ? { label: input.label } : {}),
    });
    return { id: String(reply.id), sort_order: Number(reply.sort_order) };
}

export async function adminReorderFeatured(who: FeaturedIdentity, ids: string[], reason?: string): Promise<{ changed: boolean; order: string[] }> {
    const reply = await callFeaturedAdmin('home_featured_reorder', { ...identityOf(who), ids, ...(reason ? { reason } : {}) });
    return { changed: reply.changed === true, order: (reply.order ?? []) as string[] };
}

export async function adminSetFeaturedWindow(who: FeaturedIdentity, id: string, input: {
    startsAt: string | null; endsAt: string | null; reason: string;
}): Promise<{ id: string; starts_at: string | null; ends_at: string | null }> {
    const reply = await callFeaturedAdmin('home_featured_set_window', {
        ...identityOf(who), id, starts_at: input.startsAt, ends_at: input.endsAt, reason: input.reason,
    });
    return { id: String(reply.id), starts_at: (reply.starts_at ?? null) as string | null, ends_at: (reply.ends_at ?? null) as string | null };
}

export async function adminRemoveFeatured(who: FeaturedIdentity, id: string, reason: string): Promise<{ id: string }> {
    const reply = await callFeaturedAdmin('home_featured_remove', { ...identityOf(who), id, reason });
    return { id: String(reply.id) };
}

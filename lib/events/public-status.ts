import { getServiceRoleClient } from '@/lib/supabase/server';

/**
 * Lot 8, tâche 8.2 h — visibilité publique d'un événement (contrat 8.1, L49), partagée par la fiche
 * GET /api/events/[id] et le layout serveur de la page : un seul exemplaire de la liste des statuts.
 */

/** Statuts visibles du public (contrat E) ; BROUILLON, EN_ATTENTE et VALIDE répondent 404. */
export type PublicEventStatus = 'PUBLIE' | 'SUSPENDU' | 'ANNULE' | 'TERMINE';

export const PUBLIC_EVENT_STATUSES: ReadonlySet<string> = new Set<PublicEventStatus>(['PUBLIE', 'SUSPENDU', 'ANNULE', 'TERMINE']);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Un identifiant illisible ne part jamais en base : il y lèverait 22P02, pris pour une panne. */
export function isEventId(id: string | null | undefined): boolean {
    return UUID.test(id ?? '');
}

/** `UNAVAILABLE` : lecture impossible. Une panne ne se présente jamais comme une absence. */
export type PublicEventRead = 'PUBLIC' | 'NOT_PUBLIC' | 'UNAVAILABLE';

/**
 * Lot 9 ter (R106 a) : un événement terminé par le cron sans avoir jamais été publié (events.ended_unpublished) n'est
 * pas public, même au statut TERMINE (même règle que la politique events_read_public et la vue events_public_status).
 */
export function isPublicEvent<T extends { status: unknown; ended_unpublished?: unknown }>(row: T | null | undefined): row is T {
    return !!row && PUBLIC_EVENT_STATUSES.has(String(row.status)) && row.ended_unpublished !== true;
}

/**
 * Statut public d'un événement, lu en service_role. Identifiant non UUID, ligne absente, statut non public ou
 * terminé sans publication : NOT_PUBLIC. Erreur de lecture : journalisée, UNAVAILABLE ; la page s'affiche et l'API
 * reste protectrice (L49).
 */
export async function readPublicEventStatus(id: string): Promise<PublicEventRead> {
    if (!isEventId(id)) return 'NOT_PUBLIC';
    try {
        const { data, error } = await getServiceRoleClient().from('events').select('id, status, ended_unpublished').eq('id', id).maybeSingle();
        if (error) {
            console.error('[events/public-status] lecture du statut impossible :', error.message);
            return 'UNAVAILABLE';
        }
        return isPublicEvent(data) ? 'PUBLIC' : 'NOT_PUBLIC';
    } catch (err) {
        console.error('[events/public-status] lecture du statut impossible :', err instanceof Error ? err.message : String(err));
        return 'UNAVAILABLE';
    }
}

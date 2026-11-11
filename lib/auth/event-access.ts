/**
 * Lot 9 bis, tâche 11 (R2 ; contrat 4.2, B30, B31) — accès d'un compte à un événement d'une partenaire, pour les routes
 * `app/api/partner/**` qui décident en TypeScript (remboursement, recherche de billet, PIN régisseur, caisses,
 * promotion, fiche, équipe).
 *
 * Règle : la propriétaire de l'événement (`events.partner_id → partners.user_id`) passe ; un ADMIN passe s'il a la
 * permission de l'action (lue sur `user_roles` et `admin_permissions`, jamais sur `users.role`), le SUPERADMIN
 * toujours ; un admin sans la permission reçoit 403 PERMISSION_MISSING, sans effet. Tout autre compte (client,
 * partenaire B) reçoit le refus actuel de la route : l'aide rend `NONE` et la route garde sa réponse (même statut,
 * aucun indice). Une lecture des permissions en échec donne 503 ADMIN_AUTH_UNAVAILABLE, une lecture de l'événement en
 * échec 500 EVENT_UNAVAILABLE ; jamais un accès par défaut.
 */
import { NextResponse } from 'next/server';
import {
    adminAuthUnavailableResponse,
    AdminPermissionsUnavailable,
    loadAdminPermissions,
    permissionMissingResponse,
    type AdminPermission,
} from '@/lib/admin/admin-auth';
import { apiFailure } from '@/lib/api/public-error';
import { serverIsAdmin, type ServerUser } from '@/lib/auth/session';
import { getServiceRoleClient } from '@/lib/supabase/server';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type EventAccess =
    /** Propriétaire de l'événement. */
    | { kind: 'OWNER' }
    /** Admin muni de la permission (ou SUPERADMIN). */
    | { kind: 'ADMIN' }
    /** Ni propriétaire ni admin, ou événement inconnu : la route garde son refus actuel. */
    | { kind: 'NONE' }
    /** Admin sans la permission (403) ou lecture impossible (503) : réponse à rendre telle quelle. */
    | { kind: 'DENIED'; response: NextResponse };

/**
 * Seconde moitié de la règle, pour une route qui a déjà écarté la propriétaire : un admin sans la permission reçoit
 * 403 PERMISSION_MISSING, une panne 503 ; `null` si l'admin a la permission. À n'appeler que pour un compte admin.
 */
export async function requireAdminPermission(user: ServerUser, permission: AdminPermission): Promise<NextResponse | null> {
    try {
        const permissions = await loadAdminPermissions(user.id, user.roles);
        return permissions.includes(permission) ? null : permissionMissingResponse(permission);
    } catch (err) {
        if (err instanceof AdminPermissionsUnavailable) {
            console.error('[requireAdminPermission]', err.message);
            return adminAuthUnavailableResponse();
        }
        throw err;
    }
}

/** Accès de `user` à l'événement `eventId` pour une action qui exige `permission` d'un admin. */
export async function requireEventAccess(user: ServerUser, eventId: string, permission: AdminPermission): Promise<EventAccess> {
    if (UUID_RE.test(eventId)) {
        const { data, error } = await getServiceRoleClient()
            .from('events')
            .select('id, partners!inner(user_id)')
            .eq('id', eventId)
            .maybeSingle();
        if (error) {
            // Reste S3 (A26, A32 du lot 9) : l'événement illisible est une panne de l'événement, pas de l'authentification
            // de l'admin : 500 EVENT_UNAVAILABLE, journalisée, jamais une absence (pannes-absences, messages-bruts).
            return {
                kind: 'DENIED',
                response: apiFailure('requireEventAccess', new Error(`événement ${eventId} illisible : ${error.message}`),
                    { message: 'Événement momentanément indisponible.', code: 'EVENT_UNAVAILABLE', status: 500 }),
            };
        }
        const rel = (data as { partners?: { user_id?: string } | Array<{ user_id?: string }> } | null)?.partners;
        const ownerId = Array.isArray(rel) ? rel[0]?.user_id : rel?.user_id;
        if (data && ownerId === user.id) return { kind: 'OWNER' };
    }
    if (!serverIsAdmin(user)) return { kind: 'NONE' };
    const refusal = await requireAdminPermission(user, permission);
    return refusal ? { kind: 'DENIED', response: refusal } : { kind: 'ADMIN' };
}

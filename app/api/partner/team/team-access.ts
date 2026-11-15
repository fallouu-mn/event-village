/**
 * Lot 9 bis (R2, B30, B31, contrat 4.2) — droit d'un admin sur les routes de l'équipe de contrôle
 * (`app/api/partner/team/**`) : lecture events.read, écriture events.write (SUPERADMIN toujours). Un admin sans la
 * permission reçoit 403 PERMISSION_MISSING sans effet ; une lecture des permissions en échec, 503. La partenaire garde
 * le contrôle de propriété de chaque route. Module serveur (pas une route), aide de S-B (lib/auth/event-access.ts).
 */
import { NextResponse } from 'next/server';
import type { AdminPermission } from '@/lib/admin/admin-auth';
import { requireAdminPermission } from '@/lib/auth/event-access';
import { serverHasRole, serverIsAdmin, type ServerUser } from '@/lib/auth/session';
import { getServiceRoleClient } from '@/lib/supabase/server';

/** Refus à rendre pour un admin (sans rôle partenaire) qui n'a pas `permission` ; null sinon. */
export async function adminTeamRefusal(user: ServerUser, permission: AdminPermission): Promise<NextResponse | null> {
    if (!serverIsAdmin(user) || serverHasRole(user, 'PARTENAIRE')) return null;
    return requireAdminPermission(user, permission);
}

/**
 * Lot 9 quater (B3 : AUD-24) — un ADMIN qui porte aussi le rôle PARTENAIRE n'échappe à la permission admin que sur les
 * ressources de SA fiche partenaire. Dès qu'une ressource (événement, équipe d'un organisateur) appartient à une autre
 * fiche, ou que la fiche n'est pas connue, la permission est vérifiée comme pour un admin. null : rien à refuser.
 */
export async function adminForeignTeamRefusal(
    user: ServerUser,
    permission: AdminPermission,
    resourcePartnerIds: ReadonlyArray<string | null | undefined>,
): Promise<NextResponse | null> {
    if (!serverIsAdmin(user) || !serverHasRole(user, 'PARTENAIRE')) return null;
    const { data, error } = await getServiceRoleClient().from('partners').select('id').eq('user_id', user.id).maybeSingle();
    if (error) throw new Error(`lecture de la fiche partenaire de ${user.id} : ${error.message}`);
    const own = data ? String(data.id) : null;
    if (own && resourcePartnerIds.length > 0 && resourcePartnerIds.every((id) => id === own)) return null;
    return requireAdminPermission(user, permission);
}

/** Fiche partenaire du compte (son identifiant), ou null s'il n'en a pas. Une panne lève. */
export async function ownPartnerId(user: ServerUser): Promise<string | null> {
    if (!serverHasRole(user, 'PARTENAIRE')) return null;
    const { data, error } = await getServiceRoleClient().from('partners').select('id').eq('user_id', user.id).maybeSingle();
    if (error) throw new Error(`lecture de la fiche partenaire de ${user.id} : ${error.message}`);
    return data ? String(data.id) : null;
}

/**
 * Finition 1 (E-17) — motif d'une action d'un admin sur l'équipe d'un organisateur : 5 caractères au moins, inscrit au
 * journal. `actsAsAdmin` : l'appelant est admin et la ressource n'appartient pas à sa propre fiche. Rend la réponse
 * 400 REASON_REQUIRED, ou null (motif présent, ou partenaire sur sa propre équipe).
 */
export const REASON_REQUIRED_TEXT = 'Indiquez le motif de cette action (5 caractères au moins) : il est inscrit au journal.';

/** cvf1 T5, R3 : motif de plus de 500 caractères, avec un message qui le dit (et non « 5 caractères au moins »). */
export const REASON_TOO_LONG_TEXT = 'Le motif est trop long : 500 caractères au plus. Raccourcissez-le.';

export function adminReasonRefusal(actsAsAdmin: boolean, reason: unknown): NextResponse | null {
    if (!actsAsAdmin) return null;
    const text = typeof reason === 'string' ? reason.trim() : '';
    if (text.length > 500) return NextResponse.json({ error: REASON_TOO_LONG_TEXT, code: 'REASON_TOO_LONG', field: 'reason' }, { status: 400 });
    if (text.length >= 5) return null;
    return NextResponse.json({ error: REASON_REQUIRED_TEXT, code: 'REASON_REQUIRED', field: 'reason' }, { status: 400 });
}

/** Motif nettoyé (ou null) pour le journal. */
export function cleanReason(reason: unknown): string | null {
    const text = typeof reason === 'string' ? reason.trim() : '';
    return text ? text.slice(0, 500) : null;
}

/**
 * Vrai si l'appelant agit en admin sur une ressource de l'organisateur `resourcePartnerId` : admin (ou SUPERADMIN) dont
 * la propre fiche n'est pas celle-là. Une partenaire sans rôle admin : toujours faux (sa propriété est vérifiée ailleurs).
 */
export async function actsAsTeamAdmin(user: ServerUser, resourcePartnerId: string | null | undefined): Promise<boolean> {
    if (!serverIsAdmin(user)) return false;
    const own = await ownPartnerId(user);
    return !(own && resourcePartnerId && own === resourcePartnerId);
}

/** Corps JSON facultatif d'une requête DELETE (motif de l'admin) : {} si vide ; illisible : null. */
export async function optionalJsonBody(req: Request): Promise<Record<string, unknown> | null> {
    const text = await req.text();
    if (!text.trim()) return {};
    try {
        const parsed = JSON.parse(text) as unknown;
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null;
    } catch {
        return null;
    }
}

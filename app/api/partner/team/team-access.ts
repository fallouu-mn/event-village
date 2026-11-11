/**
 * Lot 9 bis (R2, B30, B31, contrat 4.2) — droit d'un admin sur les routes de l'équipe de contrôle
 * (`app/api/partner/team/**`) : lecture events.read, écriture events.write (SUPERADMIN toujours). Un admin sans la
 * permission reçoit 403 PERMISSION_MISSING sans effet ; une lecture des permissions en échec, 503. La partenaire garde
 * le contrôle de propriété de chaque route. Module serveur (pas une route), aide de S-B (lib/auth/event-access.ts).
 */
import type { NextResponse } from 'next/server';
import type { AdminPermission } from '@/lib/admin/admin-auth';
import { requireAdminPermission } from '@/lib/auth/event-access';
import { serverHasRole, serverIsAdmin, type ServerUser } from '@/lib/auth/session';

/** Refus à rendre pour un admin (sans rôle partenaire) qui n'a pas `permission` ; null sinon. */
export async function adminTeamRefusal(user: ServerUser, permission: AdminPermission): Promise<NextResponse | null> {
    if (!serverIsAdmin(user) || serverHasRole(user, 'PARTENAIRE')) return null;
    return requireAdminPermission(user, permission);
}

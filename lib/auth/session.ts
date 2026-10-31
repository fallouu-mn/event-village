import { NextRequest, NextResponse } from 'next/server';
import { getServiceRoleClient, getAuthenticatedUser } from '../supabase/server';
import { type UserRoleType } from './roles';

export interface ServerUser {
    id: string;
    email?: string;
    phone?: string;
    role: string;
    roles: string[];
    status: string;
    firstName?: string;
    lastName?: string;
}

export function serverHasRole(user: ServerUser, role: UserRoleType): boolean {
    return user.roles.includes(role);
}

export function serverHasAnyRole(user: ServerUser, roles: UserRoleType[]): boolean {
    return roles.some(r => user.roles.includes(r));
}

export function serverIsAdmin(user: ServerUser): boolean {
    return serverHasAnyRole(user, ['ADMIN', 'SUPERADMIN']);
}

export function serverIsController(user: ServerUser): boolean {
    return serverHasAnyRole(user, ['CONTROLEUR', 'ADMIN', 'SUPERADMIN']);
}

export function serverIsPartner(user: ServerUser): boolean {
    return serverHasAnyRole(user, ['PARTENAIRE', 'ADMIN', 'SUPERADMIN']);
}

export type ActiveSessionResult =
    | { user: ServerUser; response?: undefined }
    | { user?: undefined; response: NextResponse };

/**
 * Lot 1B.6 — contrôle commun des routes /api/partner/* et /api/tickets/* :
 * session obligatoire (401) et compte ACTIF obligatoire (403, code ACCOUNT_NOT_ACTIVE).
 * Usage : `const s = await requireActiveSession(req); if (s.response) return s.response;`
 * Lot 1C.2 : `allowStatuses` élargit explicitement les statuts admis pour une route donnée
 * (ex. EN_ATTENTE : titulaire d'un dossier partenaire en cours de validation).
 */
export async function requireActiveSession(
    req: NextRequest,
    options: { allowStatuses?: readonly string[] } = {}
): Promise<ActiveSessionResult> {
    const allowed = options.allowStatuses ?? ['ACTIF'];
    const user = await getServerSessionUser(req);
    if (!user) {
        return { response: NextResponse.json({ error: 'Authentification requise.', code: 'AUTH_REQUIRED' }, { status: 401 }) };
    }
    if (!allowed.includes(user.status)) {
        console.warn(`[requireActiveSession] accès refusé à ${new URL(req.url).pathname} : compte ${user.id} au statut ${user.status}`);
        return {
            response: NextResponse.json(
                { error: `Votre compte n'est pas actif (statut ${user.status}). Contactez le support.`, code: 'ACCOUNT_NOT_ACTIVE' },
                { status: 403 }
            ),
        };
    }
    return { user };
}

export async function getServerSessionUser(req: NextRequest): Promise<ServerUser | null> {
    try {
        const authUser = await getAuthenticatedUser(req);
        if (!authUser) return null;

        const supabase = getServiceRoleClient();

        const [{ data: profile, error: profErr }, { data: userRoles, error: rolesErr }] = await Promise.all([
            supabase
                .from('users')
                .select('id, email, phone, role, status, first_name, last_name')
                .eq('id', authUser.id)
                .single(),
            supabase
                .from('user_roles')
                .select('role')
                .eq('user_id', authUser.id),
        ]);

        if (profErr || !profile) {
            return null;
        }
        if (rolesErr) {
            throw new Error(`lecture des rôles de ${authUser.id} impossible : ${rolesErr.message}`);
        }

        // Lot 1B.8 : user_roles est la seule source des rôles (comme la RLS). Le rôle legacy
        // users.role n'est plus ajouté : il pouvait diverger (écriture directe) et accorder côté
        // serveur un rôle que la base refusait.
        const roles = (userRoles || []).map(r => r.role as string);

        return {
            id: profile.id,
            email: profile.email,
            phone: profile.phone,
            role: profile.role,
            roles,
            status: profile.status,
            firstName: profile.first_name,
            lastName: profile.last_name,
        };
    } catch (err) {
        console.error('[getServerSessionUser] Erreur session:', err);
        return null;
    }
}

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
 */
export async function requireActiveSession(req: NextRequest): Promise<ActiveSessionResult> {
    const user = await getServerSessionUser(req);
    if (!user) {
        return { response: NextResponse.json({ error: 'Authentification requise.', code: 'AUTH_REQUIRED' }, { status: 401 }) };
    }
    if (user.status !== 'ACTIF') {
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

        const [{ data: profile, error: profErr }, { data: userRoles }] = await Promise.all([
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

        const dbRoles = (userRoles || []).map(r => r.role as string);
        if (profile.role && !dbRoles.includes(profile.role)) {
            dbRoles.push(profile.role);
        }
        const roles = dbRoles.length > 0 ? dbRoles : ['CLIENT'];

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

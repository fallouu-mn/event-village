import { NextRequest } from 'next/server';
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

        const roles = (userRoles && userRoles.length > 0)
            ? userRoles.map(r => r.role as string)
            : [profile.role as string];

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

import { getServiceRoleClient } from '@/lib/supabase/server';

export type UserRoleType = 'CLIENT' | 'PARTENAIRE' | 'CONTROLEUR' | 'ADMIN' | 'SUPERADMIN';

const ROLE_PRIORITY: UserRoleType[] = ['SUPERADMIN', 'ADMIN', 'PARTENAIRE', 'CONTROLEUR', 'CLIENT'];

export function hasRole(roles: string[] | string | undefined | null, role: UserRoleType): boolean {
    if (!roles) return false;
    if (typeof roles === 'string') return roles === role;
    return roles.includes(role);
}

export function hasAnyRole(roles: string[] | string | undefined | null, required: UserRoleType[]): boolean {
    if (!roles) return false;
    if (typeof roles === 'string') return required.includes(roles as UserRoleType);
    return required.some(r => roles.includes(r));
}

export function isAdmin(roles: string[] | string | undefined | null): boolean {
    return hasAnyRole(roles, ['ADMIN', 'SUPERADMIN']);
}

export function isController(roles: string[] | string | undefined | null): boolean {
    return hasAnyRole(roles, ['CONTROLEUR', 'ADMIN', 'SUPERADMIN']);
}

export function isPartner(roles: string[] | string | undefined | null): boolean {
    return hasAnyRole(roles, ['PARTENAIRE', 'ADMIN', 'SUPERADMIN']);
}

export function getPrimaryRole(roles: string[] | undefined | null): UserRoleType {
    if (!roles || roles.length === 0) return 'CLIENT';
    for (const r of ROLE_PRIORITY) {
        if (roles.includes(r)) return r;
    }
    return 'CLIENT';
}

export function parseRolesFromJwt(userMetadata: Record<string, unknown> | undefined | null): string[] {
    if (!userMetadata) return ['CLIENT'];
    const rolesField = userMetadata.roles;
    if (Array.isArray(rolesField) && rolesField.length > 0) {
        return rolesField as string[];
    }
    const legacyRole = userMetadata.role as string | undefined;
    if (legacyRole) return [legacyRole];
    return ['CLIENT'];
}

export async function getUserRolesFromDb(userId: string): Promise<UserRoleType[]> {
    const supabase = getServiceRoleClient();
    const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId);

    if (error || !data || data.length === 0) {
        return ['CLIENT'];
    }
    return data.map(r => r.role as UserRoleType);
}

export async function addUserRole(userId: string, role: UserRoleType): Promise<{ error?: string }> {
    const supabase = getServiceRoleClient();
    const { error } = await supabase
        .from('user_roles')
        .insert({ user_id: userId, role })
        .select('id')
        .single();

    if (error) {
        if (error.code === '23505') return {};
        return { error: error.message };
    }
    return {};
}

export async function removeUserRole(userId: string, role: UserRoleType): Promise<{ error?: string }> {
    const supabase = getServiceRoleClient();
    const { error } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId)
        .eq('role', role);

    if (error) return { error: error.message };
    return {};
}

export async function setUserRoles(userId: string, roles: UserRoleType[]): Promise<{ error?: string }> {
    const supabase = getServiceRoleClient();

    const { data: existing } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId);

    const existingRoles = (existing || []).map(r => r.role as UserRoleType);
    const toAdd = roles.filter(r => !existingRoles.includes(r));
    const toRemove = existingRoles.filter(r => !roles.includes(r));

    const ops: PromiseLike<unknown>[] = [];

    if (toAdd.length > 0) {
        ops.push(
            supabase.from('user_roles').insert(
                toAdd.map(role => ({ user_id: userId, role }))
            )
        );
    }

    if (toRemove.length > 0) {
        for (const role of toRemove) {
            ops.push(
                supabase.from('user_roles').delete().eq('user_id', userId).eq('role', role)
            );
        }
    }

    if (ops.length > 0) {
        await Promise.all(ops);
    }

    return {};
}

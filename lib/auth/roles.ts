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

// Lot 1B.1 : supprimés, faute d'appelant dans le code applicatif : la lecture des rôles dans
// user_metadata (modifiable par l'utilisateur) et la lecture en base qui retombait sans bruit
// sur CLIENT en cas d'erreur.

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

/**
 * Attribution explicite de rôles par le serveur (service_role), seule voie d'obtention des rôles
 * PARTENAIRE, CONTROLEUR, ADMIN et SUPERADMIN depuis le lot 1A (le trigger d'inscription ne
 * crée plus que CLIENT). Idempotente. Lève une erreur si l'écriture échoue.
 * L'insertion dans user_roles déclenche la synchronisation des rôles vers le jeton.
 */
export async function grantUserRoles(userId: string, roles: UserRoleType[]): Promise<void> {
    const unique = Array.from(new Set<UserRoleType>(['CLIENT', ...roles]));
    const supabase = getServiceRoleClient();
    const { error } = await supabase
        .from('user_roles')
        .upsert(unique.map((role) => ({ user_id: userId, role })), { onConflict: 'user_id,role', ignoreDuplicates: true });
    if (error) {
        throw new Error(`Attribution des rôles ${unique.join(', ')} impossible : ${error.message}`);
    }
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

export interface RoleChange {
    before: UserRoleType[];
    after: UserRoleType[];
    added: UserRoleType[];
    removed: UserRoleType[];
}

/**
 * Lot 1B.8 — fixe exactement l'ensemble des rôles d'un compte dans user_roles (CLIENT toujours
 * conservé). Ajouts puis retraits ; la moindre erreur est levée (aucune écriture ignorée).
 * Le trigger de synchronisation recalcule users.role à chaque ligne modifiée.
 */
export async function setUserRoles(userId: string, roles: UserRoleType[]): Promise<RoleChange> {
    const supabase = getServiceRoleClient();
    const target = Array.from(new Set<UserRoleType>(['CLIENT', ...roles]));

    const { data: existing, error: readErr } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId);
    if (readErr) throw new Error(`Lecture des rôles de ${userId} impossible : ${readErr.message}`);

    const before = (existing || []).map(r => r.role as UserRoleType);
    const added = target.filter(r => !before.includes(r));
    const removed = before.filter(r => !target.includes(r));

    if (added.length > 0) {
        const { error } = await supabase.from('user_roles').insert(added.map(role => ({ user_id: userId, role })));
        if (error) throw new Error(`Ajout des rôles ${added.join(', ')} impossible : ${error.message}`);
    }
    if (removed.length > 0) {
        const { error } = await supabase.from('user_roles').delete().eq('user_id', userId).in('role', removed);
        if (error) throw new Error(`Retrait des rôles ${removed.join(', ')} impossible : ${error.message}`);
    }

    return { before: before.sort(), after: target.sort(), added, removed };
}

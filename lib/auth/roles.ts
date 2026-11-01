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

/** Refus de user_roles_set : code stable ; CONTROLLER_HAS_OPEN_SHIFT porte aussi le SQLSTATE EV409. */
export class RoleChangeError extends Error {
    constructor(public readonly code: string, message: string) {
        super(message);
        this.name = 'RoleChangeError';
    }
}

/**
 * Lot 5 (C4) — fixe exactement l'ensemble des rôles d'un compte (CLIENT toujours conservé) en une seule
 * transaction, par la RPC user_roles_set (droits de l'acteur vérifiés en base). Si le retrait de
 * CONTROLEUR est refusé (caisse ouverte, trigger controller_removal_guard), aucun rôle n'est modifié et
 * l'erreur levée est reconnue par isControllerRemovalBlocked (code EV409). Toute autre erreur est levée.
 */
export async function setUserRoles(userId: string, roles: UserRoleType[], actorId: string): Promise<RoleChange> {
    const { data, error } = await getServiceRoleClient().rpc('user_roles_set', {
        p: { user_id: userId, roles: Array.from(new Set<UserRoleType>(['CLIENT', ...roles])), actor_id: actorId },
    });
    if (error) throw new Error(`user_roles_set : ${error.code ?? ''} ${error.message}`);
    const reply = (data ?? null) as { ok?: boolean; code?: string; message?: string; before?: string[]; after?: string[]; added?: string[]; removed?: string[] } | null;
    if (!reply) throw new Error('user_roles_set : réponse vide');
    if (reply.ok !== true) {
        const code = String(reply.code ?? 'ROLE_CHANGE_REFUSED');
        const err = new RoleChangeError(code === 'CONTROLLER_HAS_OPEN_SHIFT' ? 'EV409' : code, `${code} : ${reply.message ?? 'changement de rôles refusé'}`);
        throw err;
    }
    const asRoles = (v: string[] | undefined): UserRoleType[] => (v ?? []).map((r) => r as UserRoleType).sort();
    return { before: asRoles(reply.before), after: asRoles(reply.after), added: asRoles(reply.added), removed: asRoles(reply.removed) };
}

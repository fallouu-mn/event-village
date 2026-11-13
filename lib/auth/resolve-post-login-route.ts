import { safeInternalPath } from './safe-redirect';

/** Espace du compte selon ses rôles (destination par défaut, et destination de repli d'un `redirect` refusé). */
function accountSpace(roleList: string[]): string {
    if (roleList.length === 0) return '/';
    if (roleList.includes('SUPERADMIN') || roleList.includes('ADMIN')) return '/admin';
    if (roleList.includes('PARTENAIRE')) return '/partner';
    if (roleList.includes('CONTROLEUR')) return '/controller/scanner';
    return '/';
}

/**
 * Destination après connexion. Lot 9 quater (A1 : AUD-17, G-03) : `redirectUrl` passe par safeInternalPath ; une
 * destination qui n'est pas un chemin interne du site (javascript:, //site, /\site, https://…, forme encodée de l'un
 * d'eux) est ignorée : espace du compte.
 */
export function resolvePostLoginRoute(
    roles?: string[] | string | null,
    redirectUrl?: string | null
): string {
    const roleList = typeof roles === 'string' ? [roles] : (roles ?? []);
    const target = safeInternalPath(redirectUrl);

    if (!target || target === '/') return accountSpace(roleList);

    if (roleList.includes('CONTROLEUR') && (target === '/scan' || target === '/partner/scan')) {
        return '/controller/scanner';
    }

    return target;
}

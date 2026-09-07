export function resolvePostLoginRoute(
    roles?: string[] | string | null,
    redirectUrl?: string | null
): string {
    const rawTarget = redirectUrl && redirectUrl !== '/' ? redirectUrl.trim() : '/';
    const roleList = typeof roles === 'string' ? [roles] : (roles ?? []);

    if (!redirectUrl || redirectUrl === '/') {
        if (!roleList || roleList.length === 0) return '/';
        if (roleList.includes('SUPERADMIN') || roleList.includes('ADMIN')) return '/admin';
        if (roleList.includes('PARTENAIRE')) return '/partner';
        if (roleList.includes('CONTROLEUR')) return '/controller/scanner';
        return '/';
    }

    if (roleList.includes('CONTROLEUR') && (rawTarget === '/scan' || rawTarget === '/partner/scan' || rawTarget === '/')) {
        return '/controller/scanner';
    }

    return rawTarget;
}

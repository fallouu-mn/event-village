/**
 * Finition 3b (E-36) — profils prêts et dépendances des droits d'administration.
 *
 * Un droit d'écriture amène sa lecture : cocher « Gérer les événements » coche « Consulter les événements ». La route
 * POST /api/admin/permissions applique la même règle (withDependencies) : la base ne garde jamais une écriture sans sa
 * lecture. Module pur (sans `next/server`), lisible par un composant client.
 */

/** Droit d'écriture → droit de lecture qu'il exige. */
export const PERMISSION_DEPENDENCIES: Readonly<Record<string, string>> = {
    'users.write': 'users.read',
    'partners.validate': 'partners.read',
    'partners.suspend': 'partners.read',
    'events.write': 'events.read',
    'notifications.write': 'notifications.read',
};

/** Droits complétés de leurs lectures, sans doublon, dans l'ordre d'entrée. */
export function withDependencies(permissions: readonly string[]): string[] {
    const out: string[] = [];
    for (const p of permissions) {
        const read = PERMISSION_DEPENDENCIES[p];
        if (read && !out.includes(read)) out.push(read);
        if (!out.includes(p)) out.push(p);
    }
    return out;
}

/** Droits à retirer avec une lecture décochée (ceux qui en dépendent). */
export function dependentsOf(permission: string): string[] {
    return Object.entries(PERMISSION_DEPENDENCIES).filter(([, read]) => read === permission).map(([write]) => write);
}

/** Profils prêts, proposés à la création d'un administrateur ; les cases restent modifiables ensuite. */
export const PERMISSION_PROFILES: ReadonlyArray<{ key: string; label: string; hint: string; permissions: string[] }> = [
    {
        key: 'validation',
        label: 'Validation',
        hint: 'Valide les événements et les partenaires.',
        permissions: withDependencies(['events.write', 'partners.validate']),
    },
    {
        key: 'support',
        label: 'Support client',
        hint: 'Aide les clients : comptes, envois de messages, événements en lecture.',
        permissions: withDependencies(['users.write', 'notifications.write', 'events.read', 'partners.read']),
    },
    {
        key: 'finance',
        label: 'Finance',
        hint: 'Suit l’argent et traite les versements à reprendre.',
        permissions: withDependencies(['payments.read', 'refunds.manage', 'statistics.read']),
    },
    {
        key: 'lecture',
        label: 'Lecture seule',
        hint: 'Voit tout ce qui se lit, sans rien changer.',
        permissions: ['users.read', 'partners.read', 'events.read', 'payments.read', 'statistics.read', 'notifications.read', 'settings.read'],
    },
];

/** Thèmes de la grille des droits (fieldset et légende). */
export const PERMISSION_GROUPS: ReadonlyArray<{ title: string; permissions: string[] }> = [
    { title: 'Événements et partenaires', permissions: ['events.read', 'events.write', 'partners.read', 'partners.validate', 'partners.suspend'] },
    { title: 'Comptes et messages', permissions: ['users.read', 'users.write', 'notifications.read', 'notifications.write', 'communications.manage'] },
    { title: 'Argent', permissions: ['payments.read', 'refunds.manage', 'referrals.manage', 'statistics.read'] },
    { title: 'Terrain et réglages', permissions: ['access.operate', 'settings.read'] },
];

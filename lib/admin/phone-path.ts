/**
 * Contre-vérification de la finition 3d (T1) — un compte ADMIN ou SUPERADMIN ne change jamais son numéro par le profil
 * client (/api/account/phone/start et /confirm, account_phone_finalize en base). Le numéro d'un administrateur reçoit ses
 * codes administrateur : il ne se change que par les chemins de la finition 3d, où le nouveau numéro est prouvé et où le
 * mot de passe et un code récent sont exigés.
 *  - ADMIN : par le super-administrateur (Comptes, « Changer le numéro ») ;
 *  - SUPERADMIN : par « Sécurité du compte » (/admin/securite).
 * Module sans dépendance serveur : lu par les routes et par l'écran du profil (le serveur décide toujours).
 */

export const ADMIN_PHONE_MESSAGE = 'Demandez au super-administrateur de changer votre numéro.';
export const SUPERADMIN_PHONE_MESSAGE = 'Changez votre numéro depuis « Sécurité du compte », dans l’administration.';
export const SECURITY_PAGE_HREF = '/admin/securite';

export interface AdminPhonePath {
    code: 'PHONE_CHANGE_BY_SUPERADMIN' | 'PHONE_CHANGE_SECURITY_PAGE';
    message: string;
}

/** Chemin du changement de numéro d'un compte administrateur ; null pour tout autre compte (profil client). */
export function adminPhonePath(roles: readonly string[]): AdminPhonePath | null {
    if (roles.includes('SUPERADMIN')) return { code: 'PHONE_CHANGE_SECURITY_PAGE', message: SUPERADMIN_PHONE_MESSAGE };
    if (roles.includes('ADMIN')) return { code: 'PHONE_CHANGE_BY_SUPERADMIN', message: ADMIN_PHONE_MESSAGE };
    return null;
}

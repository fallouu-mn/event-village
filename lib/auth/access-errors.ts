/**
 * Lot 8 (8.2 j, L53, L54) — messages des redirections du middleware vers `/?error=<clé>`.
 *
 * Table fermée, seule source des textes affichés à l'accueil (components/layout/AccessNotice.tsx). Le paramètre
 * reçu n'est jamais affiché : une clé inconnue, même héritée de Object.prototype, ne produit aucun message.
 */
export const ACCESS_ERROR_MESSAGES: Readonly<Record<string, string>> = Object.freeze({
    unauthorized_admin: 'Cet espace est réservé aux administrateurs.',
    unauthorized_partner: 'Cet espace est réservé aux partenaires.',
    unauthorized_scanner: 'Le contrôle des billets est réservé aux contrôleurs et aux organisateurs.',
    unauthorized_controller: 'Cet espace est réservé aux contrôleurs dont le compte est actif.',
    roles_unavailable: 'Vérification de vos droits impossible pour le moment. Réessayez dans un instant.',
});

export function accessErrorMessage(key: string | null | undefined): string | null {
    if (!key || !Object.prototype.hasOwnProperty.call(ACCESS_ERROR_MESSAGES, key)) return null;
    return ACCESS_ERROR_MESSAGES[key];
}

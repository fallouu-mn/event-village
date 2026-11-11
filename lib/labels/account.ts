/**
 * Lot 9 bis, tâche 41 (R75 ; contrat 5.41, D-txt 2) — libellés français des rôles et des statuts d'un compte : une seule
 * table pour tous les écrans (administration des comptes, menu, fiche d'un événement). Aucun écran n'affiche la valeur
 * brute de la base (`ADMIN`, `SUSPENDU`, `SUPPRIME`).
 */

export const ROLE_LABELS: Readonly<Record<string, string>> = {
    SUPERADMIN: 'Superadmin',
    ADMIN: 'Administrateur',
    PARTENAIRE: 'Partenaire',
    CONTROLEUR: 'Contrôleur',
    CLIENT: 'Client',
};

export const ACCOUNT_STATUS_LABELS: Readonly<Record<string, string>> = {
    ACTIF: 'Actif',
    SUSPENDU: 'Suspendu',
    EN_ATTENTE: 'En attente',
    SUPPRIME: 'Supprimé',
};

/** Compte effacé à la demande de son titulaire (RGPD) : ses données personnelles ne sont plus en base. */
export const ERASED_ACCOUNT_LABEL = 'Données effacées';

/** Libellé d'un rôle ; une valeur inconnue n'est jamais montrée telle quelle. */
export function roleLabel(role: string | null | undefined): string {
    return (role && ROLE_LABELS[role]) || 'Rôle inconnu';
}

/** Libellé du statut d'un compte ; une valeur inconnue n'est jamais montrée telle quelle. */
export function accountStatusLabel(status: string | null | undefined): string {
    return (status && ACCOUNT_STATUS_LABELS[status]) || 'Statut inconnu';
}
